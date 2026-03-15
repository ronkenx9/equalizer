import { Bot } from "grammy";

export function registerHelp(bot: Bot) {
  bot.command("help", async (ctx) => {
    await ctx.reply(
      `*EQUALIZER Commands*\n\n` +
      `/wallet 0x\\.\\.\\. — Link your Ethereum wallet\n` +
      `/deal — Create a deal manually\n` +
      `/submit \\<url or text\\> — Submit your delivery\n` +
      `/dispute — Flag a delivery \\(brand only\\)\n` +
      `/status — Show active deals in this chat\n` +
      `/start — Introduction\n` +
      `/help — This message\n\n` +
      `_I also auto\\-detect deals in conversation\\. Just talk — I'm watching\\._`,
      { parse_mode: "MarkdownV2" }
    );
  });
}
