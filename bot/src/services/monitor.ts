import { Bot } from "grammy";
import { getActiveDealsByChat, getAllDeals, updateDeal } from "./store.js";
import { DealStatus } from "../types/deal.js";
import { autoReleaseOnChain, checkDealFunded, explorerTxUrl, getDealFromChain } from "./chain.js";
import { easExplorerUrl, mintAttestation } from "./eas.js";
import { parseEther } from "viem";
import { decideDealAction } from "./claude.js";
import { logAgentDecision } from "./agentLog.js";

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
                    const onChain = await checkDealFunded(deal.id);
                    if (onChain && onChain.funded) {
                        updateDeal(deal.id, {
                            status: DealStatus.Funded,
                            fundedAt: Date.now(),
                        });
                        await bot.api.sendMessage(
                            deal.chatId,
                            `🔒 *Deal \\#${deal.id} funded onchain\\!*\n\n` +
                            `*${onChain.amount} ETH* locked in escrow by ${deal.terms.brandUsername}\\.\n` +
                            `Brand wallet: \`${onChain.brand}\`\n\n` +
                            `From this point, the agent controls the funds\\. No human touches the money\\.\n\n` +
                            `${deal.terms.creatorUsername}: deliver by the deadline, then run /submit\\.`,
                            { parse_mode: "MarkdownV2" }
                        );
                        continue;
                    }
                }

                // AI Decision making Loop
                const decisionNode = await decideDealAction(deal);
                const memKey = `${deal.id}-${decisionNode.decision}`;

                if (decisionNode.decision === "none" || actionMemory.has(memKey)) {
                    continue;
                }

                if (decisionNode.decision === "auto_release") {
                    // Mark so we don't spam release if it fails once
                    actionMemory.add(memKey);
                    let txUrl = "";
                    let txHash = "";
                    try {
                        txHash = await autoReleaseOnChain(deal.id);
                        txUrl = explorerTxUrl(txHash);
                    } catch (err: any) {
                        console.error(`Auto-release onchain failed for deal ${deal.id}:`, err.message);
                    }

                    logAgentDecision(deal.id, decisionNode.observation, decisionNode.decision, decisionNode.action, {
                        onchain_tx_hash: txHash || undefined,
                        inference_provider: "claude",
                    });

                    updateDeal(deal.id, { status: DealStatus.Completed, completedAt: Date.now() });

                    // Mint EAS attestation
                    let easLine = "";
                    try {
                        const amountWei = parseEther(deal.terms.price.replace(/[^0-9.]/g, ""));
                        const onChainDeal = await getDealFromChain(deal.id).catch(() => null);
                        const attestationUID = await mintAttestation({
                            dealId: deal.id,
                            brand: onChainDeal?.brand ?? "0x0000000000000000000000000000000000000000",
                            creator: onChainDeal?.creator ?? "0x0000000000000000000000000000000000000000",
                            amountWei,
                            deliverable: deal.terms.deliverable,
                            outcome: "completed",
                        });
                        if (attestationUID) {
                            easLine = `\n[View attestation](${easExplorerUrl(attestationUID)})\n`;
                        }
                    } catch (err: any) {
                        console.error(`EAS attestation failed for deal ${deal.id}:`, err.message);
                    }

                    const txLine = txUrl ? `\n[View transaction](${txUrl})\n` : "";
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
                    if (decisionNode.message) {
                        await bot.api.sendMessage(deal.chatId, decisionNode.message, { parse_mode: "MarkdownV2" }).catch(console.error);
                    }
                }

            } catch (err) {
                console.error(`Monitor error on deal ${deal.id}:`, err);
            }
        }
    }, 60_000); // Poll every 60 seconds
}
