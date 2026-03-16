import { Bot } from "grammy";
import { getDeal, updateDeal } from "../services/store.js";
import { DealStatus } from "../types/deal.js";
import { walletRegistry, usernameToTgId } from "../commands/wallet.js";
import { createDealOnChain, explorerTxUrl, toDealIdBytes32 } from "../services/chain.js";
import { type Hex } from "viem";

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
        `🤝 *Deal \\#${dealId} confirmed by both parties\\!*\n\nLocking funds onchain\\.\\.\\.`,
        { parse_mode: "MarkdownV2" }
      );

      // Look up creator's wallet address via username → tgId → wallet
      const creatorTgId = usernameToTgId.get(deal.terms.creatorUsername);
      const creatorAddress = creatorTgId ? (walletRegistry.get(creatorTgId) as Hex | undefined) ?? null : null;

      if (!creatorAddress) {
        await ctx.reply(
          `⚠️ Creator must link a wallet first\\. Use /wallet 0x\\.\\.\\. to link your ETH address\\.`,
          { parse_mode: "MarkdownV2" }
        );
        return;
      }

      try {
        // Parse deadline from deal terms
        const deadlineDate = new Date(deal.terms.deadline);
        const deadlineUnix = Math.floor(deadlineDate.getTime() / 1000);
        // If deadline can't be parsed, use 7 days from now
        const effectiveDeadline = isNaN(deadlineUnix) ? Math.floor(Date.now() / 1000) + 7 * 86400 : deadlineUnix;

        const termsHash = `${deal.terms.deliverable}|${deal.terms.price}|${deal.terms.deadline}`;
        const amountEth = deal.terms.price.replace(/[^0-9.]/g, ""); // Extract numeric value

        const txHash = await createDealOnChain(
          dealId,
          creatorAddress,
          effectiveDeadline,
          termsHash,
          amountEth
        );

        const onChainId = toDealIdBytes32(dealId);
        updateDeal(dealId, {
          status: DealStatus.Funded,
          onChainId,
          fundedAt: Date.now(),
        });

        const txUrl = explorerTxUrl(txHash);
        await ctx.reply(
          `🔒 *Deal \\#${dealId} funded onchain\\!*\n\n` +
          `*${amountEth} ETH* locked in escrow\\.\n` +
          `[View transaction](${txUrl})\n\n` +
          `${deal.terms.creatorUsername}: deliver by the deadline, then run /submit\\.`,
          { parse_mode: "MarkdownV2" }
        );
      } catch (err: any) {
        console.error("Failed to create deal onchain:", err);
        await ctx.reply(
          `❌ Failed to lock funds onchain: ${err.message ?? "unknown error"}\\. The deal is confirmed but not yet funded\\.`,
          { parse_mode: "MarkdownV2" }
        );
      }
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
