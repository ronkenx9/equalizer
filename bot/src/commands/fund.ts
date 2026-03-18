import { Bot } from "grammy";
import { getDeal, updateDeal } from "../services/store.js";
import { DealStatus } from "../types/deal.js";
import { walletRegistry, usernameToTgId } from "./wallet.js";
import { createDealOnChain, explorerTxUrl, toDealIdBytes32 } from "../services/chain.js";
import { usdToEth } from "../services/price.js";
import { type Hex } from "viem";

/**
 * /fund <dealId> — Demo command. Agent locks funds on behalf of the brand.
 * In production, the brand would send ETH directly to the contract.
 * This exists to make the hackathon demo frictionless.
 */
export function registerFund(bot: Bot) {
  bot.command("fund", async (ctx) => {
    const username = ctx.from?.username ? `@${ctx.from.username}` : null;
    if (!username) return;

    const args = ctx.message?.text?.split(" ").slice(1) ?? [];
    const dealId = args[0];

    if (!dealId) {
      await ctx.reply("Usage: `/fund <dealId>`", { parse_mode: "MarkdownV2" });
      return;
    }

    const deal = getDeal(dealId);
    if (!deal) {
      await ctx.reply("Deal not found\\.", { parse_mode: "MarkdownV2" });
      return;
    }

    if (deal.status !== DealStatus.Confirmed) {
      await ctx.reply("Deal must be confirmed by both parties before funding\\.", { parse_mode: "MarkdownV2" });
      return;
    }

    // Only the brand (or anyone in demo mode) can fund
    if (deal.terms.brandUsername !== username) {
      await ctx.reply("Only the brand can fund this deal\\.", { parse_mode: "MarkdownV2" });
      return;
    }

    // Look up creator's wallet
    const creatorTgId = usernameToTgId.get(deal.terms.creatorUsername);
    const creatorAddress = creatorTgId ? (walletRegistry.get(creatorTgId) as Hex | undefined) ?? null : null;

    if (!creatorAddress) {
      await ctx.reply("Creator must link a wallet first\\. Use /wallet 0x\\.\\.\\.", { parse_mode: "MarkdownV2" });
      return;
    }

    await ctx.reply("🔒 Locking funds in escrow\\.\\.\\.", { parse_mode: "MarkdownV2" });

    try {
      const deadlineDate = new Date(deal.terms.deadline);
      const deadlineUnix = Math.floor(deadlineDate.getTime() / 1000);
      const effectiveDeadline = isNaN(deadlineUnix) ? Math.floor(Date.now() / 1000) + 7 * 86400 : deadlineUnix;
      const termsHash = `${deal.terms.deliverable}|${deal.terms.price}|${deal.terms.deadline}`;
      const priceLabel = deal.terms.price.replace(/[^0-9.]/g, "");
      const currency = deal.terms.currency?.toUpperCase() || "USD";
      const numericPrice = parseFloat(priceLabel);
      let amountEth: string;
      let ethPrice = 0;
      if (currency === "ETH") {
        amountEth = priceLabel;
      } else {
        const conversion = await usdToEth(numericPrice);
        amountEth = conversion.ethAmount;
        ethPrice = conversion.ethPrice;
      }

      const txHash = await createDealOnChain(dealId, creatorAddress, effectiveDeadline, deal.terms.disputeWindowSeconds, termsHash, amountEth);

      const onChainId = toDealIdBytes32(dealId);
      updateDeal(dealId, {
        status: DealStatus.Funded,
        onChainId,
        fundedAt: Date.now(),
      });

      const txUrl = explorerTxUrl(txHash);
      await ctx.reply(
        `🔒 *Deal \\#${dealId} locked onchain\\!*\n\n` +
        `*${priceLabel} ${currency}* \\(${amountEth} ETH\\) secured in escrow\\.\n` +
        `[View transaction](${txUrl})\n\n` +
        `The agent controls the funds now\\. No human touches the money\\.\n\n` +
        `${deal.terms.creatorUsername}: deliver by the deadline, then share your deliverable here\\.`,
        { parse_mode: "MarkdownV2" }
      );
    } catch (err: any) {
      console.error("Failed to fund deal:", err);
      await ctx.reply(
        `❌ Failed to lock funds: ${err.message ?? "unknown error"}`,
        { parse_mode: "MarkdownV2" }
      );
    }
  });
}
