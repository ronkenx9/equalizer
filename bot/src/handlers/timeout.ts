import { Bot, RawApi } from "grammy";
import { getAllDeals, updateDeal } from "../services/store.js";
import { DealStatus } from "../types/deal.js";
import { isDisputeWindowExpired } from "../utils/timer.js";
import { autoReleaseOnChain, explorerTxUrl, getDealFromChain } from "../services/chain.js";
import { mintAttestation, easExplorerUrl } from "../services/eas.js";
import { parseEther } from "viem";

export function startTimeoutChecker(bot: Bot) {
  setInterval(async () => {
    const allDeals = getAllDeals();
    const expiredDeals = allDeals.filter(
      (d) =>
        d.status === DealStatus.DisputeWindow &&
        d.disputeWindowEnd !== undefined &&
        isDisputeWindowExpired(d.disputeWindowEnd)
    );

    for (const deal of expiredDeals) {
      // Execute auto-release on-chain
      let txUrl = "";
      try {
        const txHash = await autoReleaseOnChain(deal.id);
        txUrl = explorerTxUrl(txHash);
      } catch (err: any) {
        console.error(`Auto-release onchain failed for deal ${deal.id}:`, err.message);
      }

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
    }
  }, 60_000); // Check every 60 seconds
}
