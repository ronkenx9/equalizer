import { Bot } from "grammy";
import { createDeal } from "../services/store.js";
import { formatDealCard } from "../utils/format.js";

// Usage: /deal @creator 0.05ETH "3 tweets about ProjectX" by March 20
export function registerDeal(bot: Bot) {
  bot.command("deal", async (ctx) => {
    const text = ctx.message?.text ?? "";
    const parts = text.slice("/deal".length).trim();

    if (!parts) {
      await ctx.reply(
        `*Create a deal manually:*\n\n` +
        `/deal @creator amount currency "deliverable" by deadline\n\n` +
        `Example:\n` +
        `/deal @creatoruser 0\\.05 ETH "3 tweets \\+ 1 thread about ProjectX" by March 20`,
        { parse_mode: "MarkdownV2" }
      );
      return;
    }

    // Parse: @creator amount currency "deliverable" by deadline
    const match = parts.match(/(@\S+)\s+([\d.]+)\s+(\S+)\s+"([^"]+)"\s+by\s+(.+)/i);
    if (!match) {
      await ctx.reply(
        "Format: `/deal @creator amount currency \\"deliverable\\" by deadline`\n\nExample: `/deal @alice 0\\.05 ETH \\"3 tweets about X\\" by March 20`",
        { parse_mode: "MarkdownV2" }
      );
      return;
    }

    const [, creatorUsername, price, currency, deliverable, deadline] = match;
    const brandUsername = ctx.from?.username ? `@${ctx.from.username}` : `User#${ctx.from?.id}`;

    const deal = createDeal(ctx.chat.id, {
      deliverable,
      price,
      currency,
      deadline,
      brandUsername,
      creatorUsername,
    });

    const { text: cardText, keyboard } = formatDealCard(deal.terms, deal.id);
    await ctx.reply(cardText, { parse_mode: "MarkdownV2", reply_markup: keyboard });
  });
}
