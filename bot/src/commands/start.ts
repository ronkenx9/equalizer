import { Bot } from "grammy";

export function registerStart(bot: Bot) {
  bot.command("start", async (ctx) => {
    await ctx.reply(
      `*EQUALIZER*\n\nDeals on the internet should mean something\\.\n\nI live in your conversations\\. When a deal forms in natural language, I:\n\n` +
      `🔍 Detect the deal intent\n` +
      `📋 Surface a clean deal summary\n` +
      `🔒 Lock payment in onchain escrow\n` +
      `🤖 Evaluate delivery against your terms\n` +
      `⏰ Auto\\-release payment after 24hrs of silence\n` +
      `⚖️ Mediate disputes if raised\n\n` +
      `*Getting started:*\n` +
      `1\\. Link your wallet: /wallet 0x\\.\\.\\.\n` +
      `2\\. Have a deal conversation \\— I'll detect it\n` +
      `3\\. Or create one manually: /deal\n\n` +
      `Type /help for all commands\\.`,
      { parse_mode: "MarkdownV2" }
    );
  });
}
