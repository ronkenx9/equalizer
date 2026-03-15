import { Bot } from "grammy";
import { getDeal, getActiveDealsByChat, updateDeal } from "../services/store.js";
import { DealStatus } from "../types/deal.js";
import { mediate } from "../services/claude.js";

// Track which deals are collecting evidence and from whom
const evidenceCollecting = new Set<string>();

export function registerDisputeHandler(bot: Bot) {
  // Listen for text messages during evidence collection
  bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id;
    const username = ctx.from.username ? `@${ctx.from.username}` : null;
    if (!username || ctx.message.text.startsWith("/")) return;

    const active = getActiveDealsByChat(chatId);
    const deal = active.find((d) => d.status === DealStatus.EvidenceCollection);
    if (!deal) return;

    const isBrand = deal.terms.brandUsername === username;
    const isCreator = deal.terms.creatorUsername === username;
    if (!isBrand && !isCreator) return;

    const evidence = deal.evidence ?? {};
    if (isBrand && !evidence.brandEvidence) {
      evidence.brandEvidence = ctx.message.text;
      updateDeal(deal.id, { evidence });
      await ctx.reply(`📝 Brand evidence recorded for Deal \\#${deal.id}\\.`, { parse_mode: "MarkdownV2" });
    } else if (isCreator && !evidence.creatorEvidence) {
      evidence.creatorEvidence = ctx.message.text;
      updateDeal(deal.id, { evidence });
      await ctx.reply(`📝 Creator evidence recorded for Deal \\#${deal.id}\\.`, { parse_mode: "MarkdownV2" });
    }

    // If both have submitted, mediate
    if (evidence.brandEvidence && evidence.creatorEvidence) {
      await ctx.reply(`⚖️ Both evidence submitted\\. Mediating\\.\\.\\.`, { parse_mode: "MarkdownV2" });
      updateDeal(deal.id, { status: DealStatus.Disputed });

      try {
        const ruling = await mediate(
          deal.terms,
          deal.delivery ?? "(no delivery submitted)",
          evidence.brandEvidence,
          evidence.creatorEvidence
        );

        updateDeal(deal.id, { ruling, status: DealStatus.Completed });

        const verdictLine =
          ruling.ruling === "release"
            ? `Full payment released to ${deal.terms.creatorUsername}`
            : ruling.ruling === "refund"
            ? `Full refund to ${deal.terms.brandUsername}`
            : `Split: ${ruling.creatorShare}% to ${deal.terms.creatorUsername}, ${100 - ruling.creatorShare}% refunded to ${deal.terms.brandUsername}`;

        await ctx.reply(
          `⚖️ *EQUALIZER Ruling — Deal \\#${deal.id}*\n\n` +
          `*Verdict:* ${verdictLine}\n\n` +
          `*Reasoning:* _${ruling.reasoning}_\n\n` +
          `_Ruling will be executed onchain once escrow integration is active\\._`,
          { parse_mode: "MarkdownV2" }
        );
      } catch (err) {
        await ctx.reply("Error during mediation\\. Please contact support\\.", { parse_mode: "MarkdownV2" });
      }
    }
  });
}
