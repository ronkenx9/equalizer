import { Bot, Context } from "grammy";
import { detectIntent } from "../services/claude.js";
import { createDeal } from "../services/store.js";
import { formatDealCard } from "../utils/format.js";
import { DealStatus } from "../types/deal.js";

// Message buffer per chat
const messageBuffers = new Map<number, { user: string; text: string }[]>();
const BUFFER_SIZE = 20;

// Keywords that trigger intent detection
const DEAL_KEYWORDS = /\b(deal|pay|deliver|deliverable|hire|gig|deadline|rate|budget|commission|sponsor|collab|collaboration|campaign|post|tweet|thread|content)\b/i;
const PRICE_PATTERN = /(\$|eth|usdc|usdt|sol|bnb|matic)\s*\d|\d+\s*(eth|usdc|usdt|sol|\$)/i;

function shouldTriggerDetection(messages: { user: string; text: string }[]): boolean {
  const recent = messages.slice(-5).map((m) => m.text).join(" ");
  return DEAL_KEYWORDS.test(recent) && PRICE_PATTERN.test(recent);
}

export function registerMessageHandler(bot: Bot) {
  bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id;
    const text = ctx.message.text;
    const username = ctx.from.username ? `@${ctx.from.username}` : `User#${ctx.from.id}`;

    // Skip commands
    if (text.startsWith("/")) return;

    // Buffer message
    const buffer = messageBuffers.get(chatId) ?? [];
    buffer.push({ user: username, text });
    if (buffer.length > BUFFER_SIZE) buffer.shift();
    messageBuffers.set(chatId, buffer);

    // Only check if heuristic triggers
    if (!shouldTriggerDetection(buffer)) return;

    // Avoid double-checking within 30 seconds
    const lastCheck = lastCheckTime.get(chatId) ?? 0;
    if (Date.now() - lastCheck < 30_000) return;
    lastCheckTime.set(chatId, Date.now());

    try {
      const result = await detectIntent(buffer);
      if (!result.isDeal || result.confidence < 0.8 || !result.terms) return;

      const deal = createDeal(chatId, result.terms);
      const { text: cardText, keyboard } = formatDealCard(deal.terms, deal.id);

      await ctx.reply(
        `👀 *I detected a deal forming\\!*\n\n${cardText}\n\n_Confidence: ${Math.round(result.confidence * 100)}%_`,
        { parse_mode: "MarkdownV2", reply_markup: keyboard }
      );
    } catch {
      // Silently fail — intent detection is best-effort
    }
  });
}

const lastCheckTime = new Map<number, number>();
