import { Bot, RawApi } from "grammy";
import { getAllDeals, updateDeal } from "../services/store.js";
import { DealStatus } from "../types/deal.js";
import { isDisputeWindowExpired } from "../utils/timer.js";

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
      updateDeal(deal.id, { status: DealStatus.Completed, completedAt: Date.now() });

      try {
        await bot.api.sendMessage(
          deal.chatId,
          `✅ *Deal \\#${deal.id} — Payment Auto\\-Released*\n\n` +
          `The 24\\-hour dispute window closed with no dispute raised\\.\n\n` +
          `Silence = satisfied\\.\n\n` +
          `Payment has been released to ${deal.terms.creatorUsername}\\.\n` +
          `_Onchain execution pending escrow integration\\._`,
          { parse_mode: "MarkdownV2" }
        );
      } catch {
        // Chat may be unavailable — log and continue
        console.error(`Failed to notify chat ${deal.chatId} for deal ${deal.id}`);
      }
    }
  }, 60_000); // Check every 60 seconds
}
