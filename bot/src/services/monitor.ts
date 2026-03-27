import { Bot } from "grammy";
import { getActiveDealsByChat, getAllDeals, updateDeal } from "./store.js";
import { DealStatus } from "../types/deal.js";
import { autoReleaseOnChain, checkDealFunded, explorerTxUrl, getDealFromChain } from "./chain.js";
import { easExplorerUrl, mintAttestation } from "./eas.js";
import { parseEther } from "viem";
import { decideDealAction } from "./claude.js";
import { logAgentDecision } from "./agentLog.js";
import { notifyWebhook } from "./webhook.js";

// Memory block to avoid spamming the same autonomous messages every 60s
const actionMemory = new Set<string>();

export function startDealMonitor(bot: Bot) {
    setInterval(async () => {
        const allDeals = getAllDeals();
        // Only evaluate deals that are active
        const activeDeals = allDeals.filter(d =>
            d.status !== DealStatus.Completed &&
            d.status !== DealStatus.Refunded &&
            d.status !== DealStatus.Pending
        );

        for (const deal of activeDeals) {
            try {
                // Poll for funding on-chain (similar to timeout.ts)
                if (deal.status === DealStatus.Confirmed) {
                    const onChain = await checkDealFunded(deal.id, deal.chain);
                    if (onChain && onChain.funded) {
                        updateDeal(deal.id, {
                            status: DealStatus.Funded,
                            fundedAt: Date.now(),
                        });
                        if (deal.chatId) {
                            await bot.api.sendMessage(
                                deal.chatId,
                                `🔒 *Deal \\#${deal.id} funded onchain\\!*\n\n` +
                                `*${onChain.amount} ETH* locked in escrow by ${deal.terms.brandUsername}\\.\n` +
                                `Brand wallet: \`${onChain.brand}\`\n\n` +
                                `From this point, the agent controls the funds\\. No human touches the money\\.\n\n` +
                                `${deal.terms.creatorUsername}: deliver by the deadline, then run /submit\\.`,
                                { parse_mode: "MarkdownV2" }
                            );
                        }
                        continue;
                    }
                }

                // Deterministic local pre-checks to PREVENT burning AI credits every 60s
                let needsDecision = false;

                if (deal.status === DealStatus.DisputeWindow && deal.disputeWindowEnd && Date.now() > deal.disputeWindowEnd) {
                    needsDecision = true; // Dispute window expired, needs auto-release
                } else if (deal.status === DealStatus.Confirmed) {
                    if (Date.now() - deal.createdAt > 2 * 60 * 60 * 1000) needsDecision = true; // 2 hours passed
                } else if (deal.status === DealStatus.Funded && deal.fundedAt) {
                    // Try to guess 80% time passed purely roughly so we don't call AI until close
                    const deadlineUnix = new Date(deal.terms.deadline).getTime();
                    if (!isNaN(deadlineUnix)) {
                        const total = deadlineUnix - deal.fundedAt;
                        const elapsed = Date.now() - deal.fundedAt;
                        if (elapsed / total >= 0.8) needsDecision = true;
                    }
                } else if (deal.status === DealStatus.DeliverySubmitted) {
                    if (deal.deliveryEvaluation && deal.deliveryEvaluation.confidence < 0.70) needsDecision = true;
                }

                if (!needsDecision) continue;

                // Stop the AI from evaluating the exact same state every 60 seconds if it already acted
                const stateMemKey = `${deal.id}-state-${deal.status}`;
                if (actionMemory.has(stateMemKey)) continue;

                const decisionNode = await decideDealAction(deal);

                // Lock this state so we never call the AI for it again
                actionMemory.add(stateMemKey);

                const memKey = `${deal.id}-${decisionNode.decision}`;

                // Memory lock ALWAYS triggers if we processed it, even if "none", to stop infinite retry burn
                if (actionMemory.has(memKey) || decisionNode.decision === "none") {
                    if (decisionNode.decision === "none") actionMemory.add(memKey);
                    continue;
                }

                if (decisionNode.decision === "auto_release") {
                    // Mark so we don't spam release if it fails once
                    actionMemory.add(memKey);

                    let txUrl = "";
                    let txHash = "";
                    try {
                        txHash = await autoReleaseOnChain(deal.id, deal.chain);
                        txUrl = explorerTxUrl(txHash, deal.chain);
                    } catch (err: any) {
                        console.error(`Auto-release onchain failed for deal ${deal.id} (non-blocking):`, err.shortMessage || err.message);
                    }

                    logAgentDecision(deal.id, decisionNode.observation, decisionNode.decision, decisionNode.action, {
                        onchain_tx_hash: txHash || "offchain_only",
                        inference_provider: "claude",
                    });

                    updateDeal(deal.id, { status: DealStatus.Completed, completedAt: Date.now() });

                    // Fire webhook for API-created deals
                    notifyWebhook(deal.webhookUrl, deal.webhookSecret, {
                        event: "deal.payment_released",
                        deal_id: deal.id,
                        amount: deal.terms.price,
                        recipient: deal.partyBWallet || deal.terms.creatorUsername,
                        tx_hash: txHash || "offchain_only",
                        eas_attestation: deal.easAttestationUid || null,
                        timestamp: Date.now(),
                    });

                    // Mint EAS attestation
                    let easLine = "";
                    try {
                        const amountWei = parseEther(deal.terms.price.replace(/[^0-9.]/g, ""));
                        const onChainDeal = await getDealFromChain(deal.id, deal.chain).catch(() => null);
                        const attestationUID = await mintAttestation({
                            dealId: deal.id,
                            brand: onChainDeal?.brand ?? "0x0000000000000000000000000000000000000000",
                            creator: onChainDeal?.creator ?? "0x0000000000000000000000000000000000000000",
                            amountWei,
                            deliverable: deal.terms.deliverable,
                            outcome: "completed",
                            chain: deal.chain,
                        });
                        if (attestationUID) {
                            easLine = `\n[View attestation](${easExplorerUrl(attestationUID)})\n`;
                        }
                    } catch (err: any) {
                        console.error(`EAS attestation failed for deal ${deal.id}:`, err.message);
                    }

                    const txLine = txUrl ? `\n[View transaction](${txUrl})\n` : "";
                    if (!deal.chatId) continue; // Skip Telegram notification for API-created deals
                    try {
                        await bot.api.sendMessage(
                            deal.chatId,
                            `✅ *Deal \\#${deal.id} — Payment Auto\\-Released*\n\n` +
                            `The dispute window closed with no dispute raised\\.\n\n` +
                            `Silence \\= satisfied\\.\n\n` +
                            `Payment released to ${deal.terms.creatorUsername}\\.` +
                            txLine + easLine,
                            { parse_mode: "MarkdownV2" }
                        );
                    } catch {
                        console.error(`Failed to notify chat ${deal.chatId} for deal ${deal.id}`);
                    }

                } else if (decisionNode.decision === "remind_funding" || decisionNode.decision === "remind_delivery" || decisionNode.decision === "flag_delivery") {
                    actionMemory.add(memKey);
                    logAgentDecision(deal.id, decisionNode.observation, decisionNode.decision, decisionNode.action, {
                        inference_provider: "claude",
                    });
                    if (decisionNode.message && deal.chatId) {
                        await bot.api.sendMessage(deal.chatId, decisionNode.message, { parse_mode: "MarkdownV2" }).catch(console.error);
                    }
                }

            } catch (err) {
                console.error(`Monitor error on deal ${deal.id}:`, err);
            }
        }
    }, 60_000); // Poll every 60 seconds
}
