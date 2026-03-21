import { Bot, Context } from "grammy";
import { detectIntent, extractCriteria } from "../services/claude.js";
import { createDeal, getActiveDealsByChat, updateDeal, getDeal } from "../services/store.js";
import { DealStatus } from "../types/deal.js";
import { formatDealCard } from "../utils/format.js";
import { walletRegistry, usernameToTgId } from "../commands/wallet.js";
import { getDepositInstructions, explorerTxUrl, submitDeliveryOnChain, releaseFunds } from "../services/chain.js";
import { toDealIdBytes32 } from "../utils/dealId.js";
import { evaluateDelivery, evaluateDeliveryWithCriteria } from "../services/claude.js";
import { getDisputeWindowEnd } from "../utils/timer.js";
import { logAgentDecision } from "../services/agentLog.js";
import { type Hex } from "viem";
import { usdToEth } from "../services/price.js";
import { getPaymentMessage } from "../services/x402.js";

// Message buffer per chat
const messageBuffers = new Map<number, { user: string; text: string; timestamp: number }[]>();
const BUFFER_SIZE = 20;
const analyzingLocks = new Set<number>();

async function priceToEth(price: string, currency: string): Promise<{ ethAmount: string; ethPrice: number }> {
  const numericPrice = parseFloat(price.replace(/[^0-9.]/g, ""));
  if (isNaN(numericPrice) || numericPrice === 0) return { ethAmount: "0.001", ethPrice: 0 };

  if (currency.toUpperCase() === "ETH") {
    return { ethAmount: numericPrice.toString(), ethPrice: 0 };
  }
  return usdToEth(numericPrice);
}

// ── Natural language patterns ───────────────────────────
const WALLET_PATTERN = /0x[0-9a-fA-F]{40}/;
const DEAL_KEYWORDS = /\b(deal|pay|deliver|deliverable|hire|gig|deadline|rate|budget|commission|sponsor|collab|collaboration|campaign|post|tweet|thread|content)\b/i;
const PRICE_PATTERN = /(\$|eth|usdc|usdt|sol|bnb|matic)\s*\d|\d+\s*(\$|eth|usdc|usdt|sol|bnb|matic)|\d+\s*\$|\$\d+/i;
const FUND_INTENT = /\b(fund|deposit|lock|send.*(funds?|money|payment|eth)|pay.*escrow|lock.*deal|put.*escrow)\b/i;
const SUBMIT_INTENT = /\b(done|finished|completed|delivered|here.*(is|are)|submission|deliverable|i('ve| have)\s*(done|finished|completed|delivered)|check.*(this|it)\s*out|take\s*a\s*look)\b/i;
const DISPUTE_INTENT = /\b(dispute|not\s*(what|right|correct|good|satisfied|happy|acceptable)|unhappy|disagree|poor\s*quality|didn'?t\s*deliver|wrong|scam|fraud|refuse|reject.*delivery|unsatisfied|ripped\s*off|problem\s*with)\b/i;
const APPROVAL_INTENT = /\b(approved?|looks?\s*(great|good|perfect|amazing|awesome|fantastic|solid|clean|fire|sick|dope|beautiful|excellent|outstanding|superb)|perfect(ly)?|love\s*it|this\s*is\s*(great|good|perfect|amazing|awesome|exactly\s*what|it|the\s*one)|great\s*(work|job|stuff)|well\s*done|nicely\s*done|nailed\s*it|killed\s*it|this\s*works?|exactly\s*what\s*i\s*(needed|wanted|asked)|satisfied|happy\s*with|good\s*to\s*go|lgtm|ship\s*it|release(\s*the\s*funds?)?|pay\s*(them|him|her|out)|send\s*(the\s*)?(money|payment|funds))\b/i;

export function registerMessageHandler(bot: Bot) {
  bot.on("message", async (ctx) => {
    if (!ctx.chat || !ctx.message) return;

    const chatId = ctx.chat.id;
    const text = ctx.message.text || ctx.message.caption || "";
    const username = ctx.from?.username ? `@${ctx.from.username}` : null;
    const userId = ctx.from?.id;
    const timestamp = ctx.message.date * 1000;

    if (!text || text.startsWith("/")) return;

    console.log(`[Message] ${username}: ${text}`);

    // ── 1. Wallet detection — "my wallet is 0x..." ──────
    const walletMatch = text.match(WALLET_PATTERN);
    if (walletMatch && userId && username) {
      const address = walletMatch[0].toLowerCase();
      walletRegistry.set(userId, address);
      usernameToTgId.set(username, userId);
      await ctx.reply(`✅ Wallet linked: \`${address}\``, { parse_mode: "MarkdownV2" });

      // Check if this unblocks a confirmed deal waiting for wallet
      const active = getActiveDealsByChat(chatId);
      const waitingDeal = active.find(
        (d) => d.status === DealStatus.Confirmed &&
          (d.terms.creatorUsername === username || d.terms.brandUsername === username)
      );
      if (waitingDeal) {
        // We need the CREATOR's wallet to set up escrow
        const creatorTgId = usernameToTgId.get(waitingDeal.terms.creatorUsername);
        const creatorAddress = creatorTgId ? walletRegistry.get(creatorTgId) ?? null : null;

        if (!creatorAddress) {
          // Brand linked wallet but creator hasn't yet — nudge the creator
          await ctx.reply(
            `Got it\\! Still need ${waitingDeal.terms.creatorUsername} to drop their wallet address to set up the escrow\\.`,
            { parse_mode: "MarkdownV2" }
          );
        } else {
          // Creator wallet is known — persist it so deposit instructions survive restarts
          updateDeal(waitingDeal.id, { creatorAddress });
          // Creator wallet is known — send payment link
          const priceNum = parseFloat(waitingDeal.terms.price.replace(/[^0-9.]/g, ""));
          const { text: paymentMsg, paymentUrl, usdValue } = await getPaymentMessage(
            waitingDeal.id,
            priceNum,
            waitingDeal.terms.currency,
            waitingDeal.terms.brandUsername,
            waitingDeal.terms.creatorUsername
          );
          const btnLabel = usdValue < 1 ? `$${usdValue.toFixed(4)}` : `$${usdValue.toFixed(2)}`;
          await ctx.reply(
            `Wallet linked\\!\n\n${paymentMsg}`,
            {
              parse_mode: "MarkdownV2",
              reply_markup: {
                inline_keyboard: [[{ text: `💳 Pay ${btnLabel}`, url: paymentUrl }]],
              },
            }
          );
        }
      }
      return;
    }

    // ── 2. Funding intent — "fund the deal", "lock the funds" ──
    // Agent does NOT fund — brand deposits directly. Bot gives instructions.
    if (FUND_INTENT.test(text) && username) {
      const active = getActiveDealsByChat(chatId);
      const deal = active.find(
        (d) => d.status === DealStatus.Confirmed && d.terms.brandUsername === username
      );
      if (deal) {
        const creatorTgId = usernameToTgId.get(deal.terms.creatorUsername);
        const creatorAddress = creatorTgId ? (walletRegistry.get(creatorTgId) as Hex | undefined) ?? null : null;

        if (!creatorAddress) {
          await ctx.reply(
            `${deal.terms.creatorUsername} needs to share their wallet address first\\. ` +
            `Just drop a message with your 0x address\\.`,
            { parse_mode: "MarkdownV2" }
          );
          return;
        }

        // Persist creator address so deposit instructions survive restarts
        updateDeal(deal.id, { creatorAddress });

        // Send the x402 payment link + ETH deposit instructions
        const priceNum = parseFloat(deal.terms.price.replace(/[^0-9.]/g, ""));
        const { text: paymentMsg, paymentUrl, usdValue: usdVal } = await getPaymentMessage(
          deal.id,
          priceNum,
          deal.terms.currency,
          deal.terms.brandUsername,
          deal.terms.creatorUsername
        );
        const fundBtnLabel = usdVal < 1 ? `$${usdVal.toFixed(4)}` : `$${usdVal.toFixed(2)}`;
        await ctx.reply(paymentMsg, {
          parse_mode: "MarkdownV2",
          reply_markup: {
            inline_keyboard: [[{ text: `💳 Pay ${fundBtnLabel}`, url: paymentUrl }]],
          },
        });

        // Also provide direct deposit details for ETH
        const { ethAmount: amountEth, ethPrice } = await priceToEth(deal.terms.price, deal.terms.currency);
        const deadlineDate = new Date(deal.terms.deadline);
        const deadlineUnix = Math.floor(deadlineDate.getTime() / 1000);
        const effectiveDeadline = isNaN(deadlineUnix) ? Math.floor(Date.now() / 1000) + 7 * 86400 : deadlineUnix;
        const termsHash = `${deal.terms.deliverable}|${deal.terms.price}|${deal.terms.deadline}`;

        const instructions = getDepositInstructions(
          deal.id, creatorAddress, effectiveDeadline,
          deal.terms.disputeWindowSeconds, termsHash, amountEth
        );

        const esc = (s: string) => s.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
        await ctx.reply(
          `📋 *Direct ETH deposit details:*\n\n` +
          `Contract: \`${instructions.to}\`\n` +
          `Amount: \`${amountEth} ETH\` \\(≈ \\$${esc(String(priceNum))} @ \\$${esc(ethPrice.toLocaleString())}/ETH\\)\n` +
          `Network: Base Sepolia\n\n` +
          `_Send this exact amount to the contract address\\. The agent will detect your deposit automatically\\._`,
          { parse_mode: "MarkdownV2" }
        );
        return;
      }
    }

    // ── 3. Delivery submission — "I'm done", "here's the deliverable" ──
    if (SUBMIT_INTENT.test(text) && username) {
      const active = getActiveDealsByChat(chatId);
      const deal = active.find(
        (d) => d.status === DealStatus.Funded && d.terms.creatorUsername === username
      );
      if (deal) {
        // Use the message text as the delivery description
        const delivery = text;

        await ctx.reply(
          deal.extractedCriteria
            ? "📦 Delivery received\\. Evaluating against locked criteria\\.\\.\\."
            : "📦 Delivery received\\. Evaluating against deal terms\\.\\.\\.",
          { parse_mode: "MarkdownV2" }
        );

        try {
          // Use criteria-based evaluation if criteria were extracted, otherwise fallback
          let evaluation: { passed: boolean; confidence: number; reasoning: string; flags?: string[] };
          let criteriaResultsText = "";

          if (deal.extractedCriteria && deal.extractedCriteria.criteria.length > 0) {
            const criteriaEval = await evaluateDeliveryWithCriteria(
              deal.extractedCriteria, delivery, deal.terms
            );
            evaluation = {
              passed: criteriaEval.overall === "PASS",
              confidence: criteriaEval.confidence / 100,
              reasoning: criteriaEval.summary,
              flags: criteriaEval.results
                .filter((r) => r.result !== "PASS")
                .map((r) => `${r.description}: ${r.reasoning ?? r.result}`),
            };
            // Store per-criterion results
            updateDeal(deal.id, { criteriaResults: criteriaEval.results });

            // Build transparent results display
            const resultLines = criteriaEval.results.map((r) => {
              const icon = r.result === "PASS" ? "✅" : r.result === "FAIL" ? "❌" : "⚠️";
              return `${icon} ${escapeMarkdown(r.description)}`;
            });
            criteriaResultsText = `\n\n📋 *Criteria Results:*\n${resultLines.join("\n")}`;
          } else {
            evaluation = await evaluateDelivery(deal.terms, delivery);
          }

          const windowEnd = getDisputeWindowEnd(deal.terms.disputeWindowSeconds);

          // Submit on-chain
          let txUrl = "";
          try {
            const txHash = await submitDeliveryOnChain(deal.id);
            txUrl = explorerTxUrl(txHash);

            updateDeal(deal.id, {
              status: DealStatus.DisputeWindow,
              delivery,
              deliveryEvaluation: evaluation,
              deliverySubmittedAt: Date.now(),
              disputeWindowEnd: windowEnd,
            });
          } catch (err: any) {
            console.error("Failed to submit delivery onchain:", err);
            await ctx.reply("⚠️ Failed to submit delivery on\\-chain \\(Network Error\\)\\. Please try saying \\\"I'm done\\\" again soon\\.", { parse_mode: "MarkdownV2" });
            return;
          }

          const windowHours = deal.terms.disputeWindowSeconds / 3600;
          const windowLabel = windowHours < 1
            ? `${deal.terms.disputeWindowSeconds / 60} minutes`
            : `${windowHours} hours`;
          const txLine = txUrl ? `\n[View onchain tx](${txUrl})\n` : "";

          if (evaluation.passed) {
            await ctx.reply(
              `✅ *Delivery evaluated — PASSED*\n\n` +
              `_${escapeMarkdown(evaluation.reasoning)}_` +
              criteriaResultsText + `\n\n` +
              txLine +
              `⏰ *${windowLabel} dispute window started\\.* ${deal.terms.brandUsername}: review the delivery\\. ` +
              `If everything looks good, stay silent and payment releases automatically\\. ` +
              `If something's off, just say so\\.`,
              { parse_mode: "MarkdownV2" }
            );
          } else {
            const flags = evaluation.flags?.map((f) => `• ${escapeMarkdown(f)}`).join("\n") ?? "";
            await ctx.reply(
              `⚠️ *Delivery evaluation — FLAGGED*\n\n` +
              `_${escapeMarkdown(evaluation.reasoning)}_` +
              criteriaResultsText + `\n\n` +
              `Issues:\n${flags}\n\n` +
              txLine +
              `⏰ *${windowLabel} dispute window started\\.*\n` +
              `${deal.terms.brandUsername}: if you're not satisfied, just say "I want to dispute this"\\.`,
              { parse_mode: "MarkdownV2" }
            );
          }
        } catch (err: any) {
          console.error("Delivery evaluation error:", err);
          await ctx.reply("Something went wrong evaluating the delivery\\. Please try again\\.", { parse_mode: "MarkdownV2" });
        }
        return;
      }
    }

    // ── 3.5 Explicit approval — brand says "looks great", "approved", etc. ──
    if (APPROVAL_INTENT.test(text) && username && !DISPUTE_INTENT.test(text)) {
      const active = getActiveDealsByChat(chatId);
      const deal = active.find(
        (d) => d.status === DealStatus.DisputeWindow && d.terms.brandUsername === username
      );
      if (deal) {
        await ctx.reply(
          `✅ Approval received\\. Releasing payment to ${escapeMarkdown(deal.terms.creatorUsername)} now\\.\\.\\.`,
          { parse_mode: "MarkdownV2" }
        );

        try {
          const txHash = await releaseFunds(deal.id);
          const txUrl = explorerTxUrl(txHash);

          updateDeal(deal.id, { status: DealStatus.Completed, completedAt: Date.now() });

          logAgentDecision(
            deal.id,
            `Brand ${username} explicitly approved delivery: "${text.slice(0, 120)}"`,
            "release",
            "explicit_approval",
            { onchain_tx_hash: txHash }
          );

          await ctx.reply(
            `🎉 *Deal \\#${escapeMarkdown(deal.id)} — Complete\\!*\n\n` +
            `Payment released to ${escapeMarkdown(deal.terms.creatorUsername)}\\.\\n` +
            `[View transaction](${txUrl})`,
            { parse_mode: "MarkdownV2" }
          );
        } catch (err: any) {
          console.error("[ExplicitApproval] Release failed:", err);
          await ctx.reply(
            `⚠️ Approval noted but release failed on\\-chain\\. Will retry automatically when the dispute window closes\\.`,
            { parse_mode: "MarkdownV2" }
          );
        }
        return;
      }
    }

    // ── 4. Dispute intent — "this isn't what I asked for" ──
    if (DISPUTE_INTENT.test(text) && username) {
      const active = getActiveDealsByChat(chatId);
      const deal = active.find(
        (d) => d.status === DealStatus.DisputeWindow && d.terms.brandUsername === username
      );
      if (deal) {
        if (deal.disputeWindowEnd && Date.now() > deal.disputeWindowEnd) {
          await ctx.reply("⏰ The dispute window has closed\\. Payment has been released\\.", { parse_mode: "MarkdownV2" });
          return;
        }

        updateDeal(deal.id, { status: DealStatus.EvidenceCollection });

        await ctx.reply(
          `⚖️ *Dispute raised on Deal \\#${deal.id}*\n\n` +
          `Both parties: please share your side of the story\\. Just type your evidence naturally — ` +
          `explain what happened, what was agreed, and what went wrong\\.\n\n` +
          `${deal.terms.brandUsername}: What's the issue?\n` +
          `${deal.terms.creatorUsername}: What's your response?\n\n` +
          `_The agent will mediate privately once both sides are heard\\._`,
          { parse_mode: "MarkdownV2" }
        );
        return;
      }
    }

    // ── 5. Deal detection (existing flow) ───────────────
    // Buffer message
    const buffer = messageBuffers.get(chatId) ?? [];
    buffer.push({ user: username ?? `User#${userId}`, text, timestamp });
    if (buffer.length > BUFFER_SIZE) buffer.shift();
    messageBuffers.set(chatId, buffer);

    // Prevent concurrent Claude calls per chat
    if (analyzingLocks.has(chatId)) return;

    // Pre-filter before calling Groq to save API costs
    const recent = buffer.slice(-5).map((m) => m.text).join(" ");
    if (!PRICE_PATTERN.test(recent)) return; // Wake up Groq anytime money is discussed!

    console.log(`[Deal Detection] Triggers matched, analyzing with Claude...`);
    analyzingLocks.add(chatId);

    try {
      const result = await detectIntent(buffer);

      if (result.stage === "NOISE") return;

      if (result.stage === "SIGNAL") {
        if (result.missing && result.missing.length > 0 && result.message) {
          const escapedMsg = escapeMarkdown(result.message);
          await ctx.reply(escapedMsg, { parse_mode: "MarkdownV2" });
        } else {
          const sent = await ctx.reply("💬 _Detecting potential deal\\.\\.\\._", { parse_mode: "MarkdownV2" });
          setTimeout(() => {
            ctx.api.deleteMessage(chatId, sent.message_id).catch(() => { });
          }, 5000);
        }
        return;
      }

      if (result.stage === "CRYSTALLIZED") {
        if (!result.terms || result.confidence < 85) return;

        const deal = createDeal(chatId, result.terms);

        // Extract structured evaluation criteria
        let criteriaText = "";
        try {
          const extracted = await extractCriteria(result.terms);
          updateDeal(deal.id, { extractedCriteria: extracted });
          console.log(`[Criteria] Extracted ${extracted.criteria.length} criteria for deal ${deal.id}`);

          if (extracted.criteria.length > 0) {
            const criteriaLines = extracted.criteria.map(
              (c) => `  → ${escapeMarkdown(c.description)}`
            );
            criteriaText =
              `\n\n🔍 *I'll evaluate this delivery against:*\n` +
              criteriaLines.join("\n");

            if (extracted.ambiguities && extracted.ambiguities.length > 0) {
              criteriaText += `\n\n⚠️ _Note: ${escapeMarkdown(extracted.ambiguities[0])}_`;
            }
          }
        } catch (err) {
          console.error("[Criteria] Extraction failed:", err);
        }

        const { text: cardText, keyboard } = formatDealCard(deal.terms, deal.id);

        await ctx.reply(
          `👀 *I detected a deal forming\\!*\n\n${cardText}${criteriaText}\n\n_Confidence: ${Math.round(result.confidence)}%_`,
          { parse_mode: "MarkdownV2", reply_markup: keyboard }
        );

        messageBuffers.delete(chatId);
      }
    } catch (err) {
      console.error("Deal Intent Detection Error:", err);
    } finally {
      analyzingLocks.delete(chatId);
    }
  });
}

// ── Helpers ─────────────────────────────────────────────
function escapeMarkdown(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}
