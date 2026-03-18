import { Bot } from "grammy";
import { getDeal, getActiveDealsByChat, updateDeal } from "../services/store.js";
import { DealStatus } from "../types/deal.js";
import { mediate } from "../services/claude.js";
import { mediatePrivately } from "../services/venice.js";
import { logAgentDecision } from "../services/agentLog.js";
import { executeRuling, releaseFunds, refundFunds, explorerTxUrl, getDealFromChain } from "../services/chain.js";
import { mintAttestation, easExplorerUrl } from "../services/eas.js";
import { parseEther } from "viem";
import { config } from "../config.js";

// Track which deals are collecting evidence and from whom
const evidenceCollecting = new Set<string>();

export function registerDisputeHandler(bot: Bot) {
  // Listen for text messages during evidence collection
  bot.on("message:text", async (ctx, next) => {
    const chatId = ctx.chat.id;
    const username = ctx.from.username ? `@${ctx.from.username}` : null;
    if (!username || ctx.message.text.startsWith("/")) return next();

    const active = getActiveDealsByChat(chatId);
    const deal = active.find((d) => d.status === DealStatus.EvidenceCollection);
    if (!deal) return next();

    const isBrand = deal.terms.brandUsername === username;
    const isCreator = deal.terms.creatorUsername === username;
    if (!isBrand && !isCreator) return next();

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
        // Attempt private mediation via Venice, fall back to Claude
        let ruling: { ruling: "release" | "refund" | "split"; creatorShare: number; reasoning: string; privateReasoning?: string };
        let inferenceProvider: "venice" | "claude" = "venice";

        if (config.veniceApiKey) {
          try {
            ruling = await mediatePrivately(
              deal.terms,
              deal.delivery ?? "(no delivery submitted)",
              evidence.brandEvidence,
              evidence.creatorEvidence
            );
            console.log(`[Venice] Private mediation completed for deal ${deal.id}`);
          } catch (veniceErr: any) {
            console.warn(`[Venice] Failed, falling back to Claude: ${veniceErr.message}`);
            inferenceProvider = "claude";
            const claudeRuling = await mediate(
              deal.terms,
              deal.delivery ?? "(no delivery submitted)",
              evidence.brandEvidence,
              evidence.creatorEvidence
            );
            ruling = { ...claudeRuling, privateReasoning: undefined };
          }
        } else {
          inferenceProvider = "claude";
          const claudeRuling = await mediate(
            deal.terms,
            deal.delivery ?? "(no delivery submitted)",
            evidence.brandEvidence,
            evidence.creatorEvidence
          );
          ruling = { ...claudeRuling, privateReasoning: undefined };
        }

        // Execute ruling on-chain
        let txUrl = "";
        let txHash = "";
        try {
          if (ruling.ruling === "release") {
            txHash = await releaseFunds(deal.id);
          } else if (ruling.ruling === "refund") {
            txHash = await refundFunds(deal.id);
          } else {
            txHash = await executeRuling(deal.id, ruling.creatorShare);
          }
          txUrl = explorerTxUrl(txHash);

          // Log decision with private reasoning and tx hash
          logAgentDecision(deal.id, "Dispute mediated", "dispute_ruling",
            `Ruling: ${ruling.ruling}, creatorShare: ${ruling.creatorShare}%`, {
            onchain_tx_hash: txHash,
            private_reasoning: ruling.privateReasoning,
            inference_provider: inferenceProvider,
          });

          updateDeal(deal.id, {
            ruling: { verdict: ruling.ruling, creatorShare: ruling.creatorShare, reasoning: ruling.reasoning },
            status: DealStatus.Completed,
            completedAt: Date.now(),
          });
        } catch (err: any) {
          console.error("Failed to execute ruling onchain:", err.message);
          const escapedCreator = deal.terms.creatorUsername.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
          updateDeal(deal.id, { status: DealStatus.EvidenceCollection, evidence: { brandEvidence: evidence.brandEvidence } });
          await ctx.reply(`⚠️ Failed to execute ruling on\\-chain \\(Network Error\\)\\. ${escapedCreator} please just say anything to re\\-trigger the mediation\\.`, { parse_mode: "MarkdownV2" });
          return;
        }

        const verdictLine =
          ruling.ruling === "release"
            ? `Full payment released to ${deal.terms.creatorUsername}`
            : ruling.ruling === "refund"
              ? `Full refund to ${deal.terms.brandUsername}`
              : `Split: ${ruling.creatorShare}% to ${deal.terms.creatorUsername}, ${100 - ruling.creatorShare}% refunded to ${deal.terms.brandUsername}`;

        // Mint EAS attestation
        let easLine = "";
        try {
          const amountWei = parseEther(deal.terms.price.replace(/[^0-9.]/g, ""));
          const onChainDeal = await getDealFromChain(deal.id).catch(() => null);
          const outcome = ruling.ruling === "refund" ? "refunded" as const : ruling.ruling === "split" ? "split" as const : "completed" as const;
          const attestationUID = await mintAttestation({
            dealId: deal.id,
            brand: onChainDeal?.brand ?? "0x0000000000000000000000000000000000000000",
            creator: onChainDeal?.creator ?? "0x0000000000000000000000000000000000000000",
            amountWei,
            deliverable: deal.terms.deliverable,
            outcome,
          });
          if (attestationUID) {
            easLine = `\n[View attestation](${easExplorerUrl(attestationUID)})\n`;
          }
        } catch (err: any) {
          console.error(`EAS attestation failed for deal ${deal.id}:`, err.message);
        }

        const txLine = txUrl ? `\n[View onchain ruling](${txUrl})\n` : "";

        await ctx.reply(
          `⚖️ *EQUALIZER Ruling — Deal \\#${deal.id}*\n\n` +
          `*Verdict:* ${verdictLine}\n\n` +
          `*Reasoning:* _${ruling.reasoning}_\n\n` +
          txLine + easLine,
          { parse_mode: "MarkdownV2" }
        );
      } catch (err) {
        await ctx.reply("Error during mediation\\. Please contact support\\.", { parse_mode: "MarkdownV2" });
      }
    }
  });
}
