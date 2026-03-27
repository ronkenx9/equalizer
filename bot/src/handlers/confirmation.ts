import { Bot } from "grammy";
import { getDeal, updateDeal } from "../services/store.js";
import { DealStatus, type SupportedChain } from "../types/deal.js";
import { walletRegistry, usernameToTgId } from "../commands/wallet.js";
import { getPaymentMessage } from "../services/x402.js";
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
      // Ask brand to pick a chain before showing payment link
      await ctx.reply(
        `🤝 *Deal \\#${dealId} confirmed by both parties\\!*\n\n` +
        `⛓ *Which blockchain for the escrow?*\n\n` +
        `Choose where funds will be locked:`,
        {
          parse_mode: "MarkdownV2",
          reply_markup: {
            inline_keyboard: [[
              { text: "🔵 Base Sepolia (ETH)", callback_data: `chain_select:base-sepolia:${dealId}` },
              { text: "⚫ X Layer (OKB)", callback_data: `chain_select:xlayer:${dealId}` },
            ]],
          },
        }
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

  bot.callbackQuery(/^chain_select:(.+):(.+)$/, async (ctx) => {
    const chain = ctx.match[1] as SupportedChain;
    const dealId = ctx.match[2];
    const deal = getDeal(dealId);
    if (!deal) { await ctx.answerCallbackQuery("Deal not found."); return; }

    updateDeal(dealId, { chain });
    await ctx.answerCallbackQuery(`Chain set to ${chain === "xlayer" ? "X Layer" : "Base Sepolia"}`);

    // Look up creator's wallet
    const creatorTgId = usernameToTgId.get(deal.terms.creatorUsername);
    const creatorAddress = creatorTgId ? (walletRegistry.get(creatorTgId) as Hex | undefined) ?? null : null;
    const chainLabel = chain === "xlayer" ? "X Layer \\(OKB\\)" : "Base Sepolia \\(ETH\\)";

    if (!creatorAddress) {
      await ctx.reply(
        `⛓ *Escrow chain: ${chainLabel}*\n\n` +
        `${deal.terms.creatorUsername}: drop your wallet address here so we can set up the escrow\\.`,
        { parse_mode: "MarkdownV2" }
      );
      return;
    }

    const priceNum = parseFloat(deal.terms.price.replace(/[^0-9.]/g, ""));
    const { text: paymentMsg, paymentUrl, usdValue } = await getPaymentMessage(
      dealId,
      priceNum,
      deal.terms.currency,
      deal.terms.brandUsername,
      deal.terms.creatorUsername
    );

    const btnLabel = usdValue < 1 ? `$${usdValue.toFixed(4)}` : `$${usdValue.toFixed(2)}`;
    await ctx.reply(
      `⛓ *Chain: ${chainLabel}*\n\n` + paymentMsg,
      {
        parse_mode: "MarkdownV2",
        reply_markup: {
          inline_keyboard: [[{ text: `💳 Pay ${btnLabel}`, url: paymentUrl }]],
        },
      }
    );
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
