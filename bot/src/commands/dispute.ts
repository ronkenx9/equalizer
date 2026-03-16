import { Bot } from "grammy";
import { getActiveDealsByChat, updateDeal } from "../services/store.js";
import { DealStatus } from "../types/deal.js";

// Note: on-chain dispute() requires msg.sender == brand, but our agent wallet is the arbiter.
// The dispute is recorded off-chain here; the arbiter executes the ruling on-chain via rule()/refund().

export function registerDispute(bot: Bot) {
  bot.command("dispute", async (ctx) => {
    const username = ctx.from?.username ? `@${ctx.from.username}` : null;
    if (!username) return;

    const active = getActiveDealsByChat(ctx.chat.id);
    const deal = active.find(
      (d) =>
        d.status === DealStatus.DisputeWindow &&
        d.terms.brandUsername === username
    );

    if (!deal) {
      await ctx.reply(
        "No active dispute window found for you\\. You can only dispute during the review window after delivery is submitted\\.",
        { parse_mode: "MarkdownV2" }
      );
      return;
    }

    updateDeal(deal.id, { status: DealStatus.EvidenceCollection });

    await ctx.reply(
      `⚠️ *Dispute raised on Deal \\#${deal.id}*\n\n` +
      `Both parties: please submit your evidence\\.\n\n` +
      `${deal.terms.brandUsername}: reply with your reason and any proof\\.\n` +
      `${deal.terms.creatorUsername}: reply with your defense and any proof\\.\n\n` +
      `_I will mediate and issue a binding ruling once both parties have submitted evidence\\._`,
      { parse_mode: "MarkdownV2" }
    );
  });
}
