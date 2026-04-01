import { Bot } from "grammy";
import { DealState, DealStatus } from "../types/deal.js";
import { updateDeal, getDeal } from "./store.js";
import { mintAttestation, easExplorerUrl } from "./eas.js";
import { archiveDealToStoracha, DealArtifact } from "./storacha.js";
import { parseEther } from "viem";
import { getDealFromChain, explorerTxUrl } from "./chain.js";
import { notifyWebhook } from "./webhook.js";

/**
 * Perform final archival and notifications for a completed deal.
 * This is called after funds are released on-chain.
 */
export async function finalizeDealCompletion(
    bot: Bot,
    dealId: string,
    txHash?: string,
    outcome: "completed" | "refunded" | "split" = "completed"
): Promise<void> {
    const deal = getDeal(dealId);
    if (!deal) return;

    console.log(`[Completion] Finalizing deal ${dealId} with outcome ${outcome}...`);

    // 1. EAS Attestation
    let easUid = deal.easAttestationUid;
    try {
        if (!easUid) {
            const amountWei = parseEther(deal.terms.price.replace(/[^0-9.]/g, ""));
            const onChainDeal = await getDealFromChain(deal.id, deal.chain).catch(() => null);

            easUid = await mintAttestation({
                dealId: deal.id,
                brand: onChainDeal?.brand ?? deal.partyAWallet ?? "0x0000000000000000000000000000000000000000",
                creator: onChainDeal?.creator ?? deal.partyBWallet ?? "0x0000000000000000000000000000000000000000",
                amountWei,
                deliverable: deal.terms.deliverable,
                outcome,
                chain: deal.chain,
            });
            if (easUid) updateDeal(dealId, { easAttestationUid: easUid });
        }
    } catch (err: any) {
        console.error(`[Completion] EAS failed for ${dealId}:`, err.message);
    }

    // 2. Storacha Archival
    let storachaCid = deal.storachaCid;
    try {
        if (!storachaCid) {
            const artifact: DealArtifact = {
                dealId: deal.id,
                partyA: deal.partyAWallet || deal.terms.brandUsername,
                partyB: deal.partyBWallet || deal.terms.creatorUsername,
                deliverable: deal.terms.deliverable,
                amount: deal.terms.price,
                evaluationResult: deal.deliveryEvaluation || {},
                easAttestation: easUid || "pending",
                txHash: txHash || "offchain",
                timestamp: Date.now(),
                conversationLog: deal.conversationLog || []
            };

            storachaCid = await archiveDealToStoracha(artifact);
            if (storachaCid) updateDeal(dealId, { storachaCid });
        }
    } catch (err: any) {
        console.error(`[Completion] Storacha failed for ${dealId}:`, err.message);
    }

    // 3. Status Update (if not already set)
    if (deal.status !== DealStatus.Completed) {
        updateDeal(dealId, { status: DealStatus.Completed, completedAt: Date.now() });
    }

    // 4. Webhook Notification
    notifyWebhook(deal.webhookUrl, deal.webhookSecret, {
        event: "deal.completed",
        deal_id: deal.id,
        eas_attestation: easUid,
        storacha_cid: storachaCid,
        tx_hash: txHash,
        timestamp: Date.now(),
    });

    // 5. Chat Notification
    if (deal.chatId) {
        let message = `📦 *Deal \\#${deal.id} — Fully Archived*\n\n` +
            `The deal has been permanently stored and verified\\.\n\n`;

        if (easUid) {
            message += `🔗 [View EAS Attestation](${easExplorerUrl(easUid)})\n`;
        }
        if (storachaCid) {
            message += `🗄️ *Filecoin CID:* \`${storachaCid}\`\n`;
            message += `_This artifact contains the full conversation and delivery log\\._\n`;
        }

        await bot.api.sendMessage(deal.chatId, message, { parse_mode: "MarkdownV2" }).catch(console.error);
    }
}
