import { Bot } from "grammy";

// In-memory wallet registry: telegramUserId -> ethereumAddress
export const walletRegistry = new Map<number, string>();
// Reverse lookup: @username -> telegramUserId
export const usernameToTgId = new Map<string, number>();

export function registerWallet(bot: Bot) {
  bot.command("wallet", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const args = ctx.message?.text?.split(" ").slice(1) ?? [];
    const address = args[0];

    if (!address) {
      const current = walletRegistry.get(userId);
      if (current) {
        await ctx.reply(`Your linked wallet: \`${current}\``, { parse_mode: "MarkdownV2" });
      } else {
        await ctx.reply("No wallet linked\\. Use `/wallet 0x\\.\\.\\.` to link one\\.", { parse_mode: "MarkdownV2" });
      }
      return;
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      await ctx.reply("Invalid Ethereum address\\. Must be 0x followed by 40 hex characters\\.", { parse_mode: "MarkdownV2" });
      return;
    }

    walletRegistry.set(userId, address.toLowerCase());
    if (ctx.from?.username) {
      usernameToTgId.set(`@${ctx.from.username}`, userId);
    }
    await ctx.reply(`Wallet linked: \`${address.toLowerCase()}\``, { parse_mode: "MarkdownV2" });
  });
}
