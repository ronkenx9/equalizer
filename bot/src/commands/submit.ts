import { Bot } from "grammy";
import { getActiveDealsByChat, updateDeal } from "../services/store.js";
import { DealStatus } from "../types/deal.js";
import { evaluateDelivery } from "../services/claude.js";
import { getDisputeWindowEnd } from "../utils/timer.js";
import { config } from "../config.js";
import { submitDeliveryOnChain, explorerTxUrl } from "../services/chain.js";

export function registerSubmit(bot: Bot) {
  bot.command("submit", async (ctx) => {
    const userId = ctx.from?.id;
    const username = ctx.from?.username ? `@${ctx.from.username}` : null;
    if (!userId || !username) return;

    const delivery = ctx.message?.text?.slice("/submit".length).trim() ?? "";
    if (!delivery) {
      await ctx.reply("Usage: `/submit <url or description of your delivery>`", { parse_mode: "MarkdownV2" });
      return;
    }

    // Find a funded deal where this user is the creator
    const active = getActiveDealsByChat(ctx.chat.id);
    const deal = active.find(
      (d) => d.status === DealStatus.Funded && d.terms.creatorUsername === username
    );

    if (!deal) {
      await ctx.reply("No funded deal found where you are the creator\\.", { parse_mode: "MarkdownV2" });
      return;
    }

    await ctx.reply("📦 Delivery received\\. Evaluating against deal terms\\.\\.\\.", { parse_mode: "MarkdownV2" });

    const evaluation = await evaluateDelivery(deal.terms, delivery);
    const windowEnd = getDisputeWindowEnd();

    // Submit delivery on-chain
    let txUrl = "";
    try {
      const txHash = await submitDeliveryOnChain(deal.id);
      txUrl = explorerTxUrl(txHash);
    } catch (err: any) {
      console.error("Failed to submit delivery onchain:", err);
      // Continue anyway — delivery is recorded off-chain
    }

    updateDeal(deal.id, {
      status: DealStatus.DisputeWindow,
      delivery,
      deliveryEvaluation: evaluation,
      deliverySubmittedAt: Date.now(),
      disputeWindowEnd: windowEnd,
    });

    const windowHours = config.disputeWindowSeconds / 3600;
    const windowLabel = windowHours < 1
      ? `${config.disputeWindowSeconds / 60} minutes`
      : `${windowHours} hours`;

    const txLine = txUrl ? `\n[View onchain tx](${txUrl})\n` : "";

    if (evaluation.passed) {
      await ctx.reply(
        `✅ *Delivery evaluated — PASSED*\n\n` +
        `_${evaluation.reasoning}_\n\n` +
        txLine +
        `⏰ *${windowLabel} dispute window started\\.* ${deal.terms.brandUsername}: review the delivery\\. If you see no issues, stay silent and payment will release automatically\\.`,
        { parse_mode: "MarkdownV2" }
      );
    } else {
      const flags = evaluation.flags?.map((f) => `• ${f}`).join("\n") ?? "";
      await ctx.reply(
        `⚠️ *Delivery evaluation — FLAGGED*\n\n` +
        `_${evaluation.reasoning}_\n\n` +
        `Issues:\n${flags}\n\n` +
        txLine +
        `⏰ *${windowLabel} dispute window has started regardless\\.* ${deal.terms.brandUsername} may dispute or allow auto\\-release\\.`,
        { parse_mode: "MarkdownV2" }
      );
    }
  });
}
