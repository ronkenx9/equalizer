import { Bot } from "grammy";
import { getDeal, updateDeal } from "../services/store.js";
import { DealStatus } from "../types/deal.js";

export function registerConfirmationHandler(bot: Bot) {
  bot.callbackQuery(/^confirm:(.+)$/, async (ctx) => {
    const dealId = ctx.match[1];
    const username = ctx.from.username ? `@${ctx.from.username}` : null;
    if (!username) {
      await ctx.answerCallbackQuery("Set a Telegram username to confirm deals.");
      return;
    }

    const deal = getDeal(dealId);
    if (!deal) {
      await ctx.answerCallbackQuery("Deal not found.");
      return;
    }

    if (deal.status === DealStatus.Completed || deal.status === DealStatus.Refunded) {
      await ctx.answerCallbackQuery("This deal is already closed.");
      return;
    }

    const isBrand = deal.terms.brandUsername === username;
    const isCreator = deal.terms.creatorUsername === username;

    if (!isBrand && !isCreator) {
      await ctx.answerCallbackQuery("You are not a party to this deal.");
      return;
    }

    let newStatus = deal.status;
    if (isBrand && deal.status === DealStatus.Pending) {
      newStatus = DealStatus.BrandConfirmed;
    } else if (isCreator && deal.status === DealStatus.Pending) {
      newStatus = DealStatus.CreatorConfirmed;
    } else if (isBrand && deal.status === DealStatus.CreatorConfirmed) {
      newStatus = DealStatus.Confirmed;
    } else if (isCreator && deal.status === DealStatus.BrandConfirmed) {
      newStatus = DealStatus.Confirmed;
    } else {
      await ctx.answerCallbackQuery("You have already confirmed.");
      return;
    }

    updateDeal(dealId, { status: newStatus, ...(newStatus === DealStatus.Confirmed ? { confirmedAt: Date.now() } : {}) });
    await ctx.answerCallbackQuery("Confirmed!");

    if (newStatus === DealStatus.Confirmed) {
      await ctx.reply(
        `🤝 *Deal \\#${dealId} confirmed by both parties\\!*\n\n` +
        `${deal.terms.brandUsername}: to lock this deal, send *${deal.terms.price} ${deal.terms.currency}* to the escrow contract\\.\n\n` +
        `Run /status to see funding instructions once the contract is deployed\\.`,
        { parse_mode: "MarkdownV2" }
      );
    } else {
      const waiting = newStatus === DealStatus.BrandConfirmed
        ? deal.terms.creatorUsername
        : deal.terms.brandUsername;
      await ctx.reply(
        `✅ ${username} confirmed Deal \\#${dealId}\\. Waiting for ${waiting} to confirm\\.`,
        { parse_mode: "MarkdownV2" }
      );
    }
  });

  bot.callbackQuery(/^reject:(.+)$/, async (ctx) => {
    const dealId = ctx.match[1];
    const deal = getDeal(dealId);
    if (!deal) {
      await ctx.answerCallbackQuery("Deal not found.");
      return;
    }
    const username = ctx.from.username ? `@${ctx.from.username}` : "Someone";
    updateDeal(dealId, { status: DealStatus.Refunded });
    await ctx.answerCallbackQuery("Deal rejected.");
    await ctx.reply(`❌ Deal \\#${dealId} rejected by ${username}\\.`, { parse_mode: "MarkdownV2" });
  });
}
