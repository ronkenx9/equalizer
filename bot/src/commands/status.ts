import { Bot } from "grammy";
import { getActiveDealsByChat } from "../services/store.js";
import { formatDealStatus } from "../utils/format.js";

export function registerStatus(bot: Bot) {
  bot.command("status", async (ctx) => {
    const chatId = ctx.chat.id;
    const active = getActiveDealsByChat(chatId);

    if (active.length === 0) {
      await ctx.reply("No active deals in this chat\\.", { parse_mode: "MarkdownV2" });
      return;
    }

    const lines = active.map((deal) => formatDealStatus(deal));
    await ctx.reply(lines.join("\n\n"), { parse_mode: "MarkdownV2" });
  });
}
