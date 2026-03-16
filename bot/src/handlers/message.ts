import { Bot, Context } from "grammy";
import { detectIntent } from "../services/claude.js";
import { createDeal } from "../services/store.js";
import { formatDealCard } from "../utils/format.js";

// Message buffer per chat
const messageBuffers = new Map<number, { user: string; text: string; timestamp: number }[]>();
const BUFFER_SIZE = 20;
const analyzingLocks = new Set<number>();

export function registerMessageHandler(bot: Bot) {
  bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id;
    const text = ctx.message.text;
    const username = ctx.from.username ? `@${ctx.from.username}` : `User#${ctx.from.id}`;
    const timestamp = ctx.message.date * 1000;

    // Skip commands
    if (text.startsWith("/")) return;

    // Buffer message
    const buffer = messageBuffers.get(chatId) ?? [];
    buffer.push({ user: username, text, timestamp });
    if (buffer.length > BUFFER_SIZE) buffer.shift();
    messageBuffers.set(chatId, buffer);

    // Prevent concurrent Claude calls per chat to avoid race conditions
    if (analyzingLocks.has(chatId)) return;
    analyzingLocks.add(chatId);

    try {
      const result = await detectIntent(buffer);

      if (result.stage === "NOISE") {
        return;
      }

      if (result.stage === "SIGNAL") {
        if (result.missing && result.missing.length > 0 && result.message) {
          // Ask for missing details
          const escapedMsg = result.message.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
          await ctx.reply(escapedMsg, { parse_mode: "MarkdownV2" });
        } else {
          // Subtle indicator
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
        const { text: cardText, keyboard } = formatDealCard(deal.terms, deal.id);

        await ctx.reply(
          `👀 *I detected a deal forming\\!*\n\n${cardText}\n\n_Confidence: ${Math.round(result.confidence)}%_`,
          { parse_mode: "MarkdownV2", reply_markup: keyboard }
        );

        // Clear history after deal is created
        messageBuffers.delete(chatId);
      }
    } catch (err) {
      console.error("Deal Intent Detection Error:", err);
    } finally {
      analyzingLocks.delete(chatId);
    }
  });
}
