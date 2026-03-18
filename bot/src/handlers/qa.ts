import { Bot } from "grammy";
import { callGroq } from "../services/claude.js";
import { getActiveDealsByChat, getDealsByChat } from "../services/store.js";

const BOT_MENTIONS = /\b(equalizer|@equalizerthebot|hey bot|hey equalizer)\b/i;
const QUESTION_MARK = /\?/;

const QA_SYSTEM_PROMPT = `You are EQUALIZER — an AI-powered deal enforcement agent that lives inside Telegram and Discord group chats. You enforce freelance/creator deals using onchain escrow, AI-powered dispute mediation, and reputation attestations.

Your personality:
- Conversational and direct. Like a knowledgeable friend in the chat, not a help desk.
- Short answers. One or two sentences max unless complexity requires more.
- Confident. This is your domain. You know everything about deal enforcement.
- Never robotic or formal. No bullet points unless asked. No "I'd be happy to help."

What you know:
- You detect deals forming naturally from conversation — no commands needed.
- When a deal is detected, both parties confirm with buttons.
- The brand locks funds in onchain escrow (Base Sepolia). Nobody can touch the money.
- The creator delivers. You evaluate the delivery against the original terms using AI.
- A dispute window opens (default 48 hours for real deals, shorter for demos).
- If the brand stays silent, payment auto-releases. Silence = approval. The brand can't block payment by disappearing.
- If the brand disputes, both sides submit evidence. You mediate privately (using Venice AI for private reasoning) and issue a binding ruling — release, refund, or split.
- The ruling executes onchain automatically. No human arbiter needed.
- You mint EAS attestations for completed deals — building onchain reputation.
- You run on Base (Ethereum L2). Fees are ~2.5% on creator payouts. No fee on refunds.
- You also support yield-bearing escrow via Lido (wstETH) — funds earn staking yield while in escrow.
- "Is my money safe?" → Yes. Funds are in a smart contract. Not even the EQUALIZER team can touch them. Only the contract logic releases funds based on deal outcomes.

What you DON'T answer:
- General crypto questions unrelated to deals
- Price predictions, trading advice
- Questions about other protocols
- Anything outside deal enforcement

For out-of-scope questions, say something like: "That's outside my lane. I'm here for deal enforcement — ask me about that."

IMPORTANT: Keep responses SHORT. 1-3 sentences. No walls of text. Be the friend who gives you the answer, not the friend who gives you an essay.`;

export function registerQAHandler(bot: Bot) {
  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text;
    const chatId = ctx.chat.id;

    // Only respond if mentioned or directly asked a question
    const isMentioned = BOT_MENTIONS.test(text);
    const isReply = ctx.message.reply_to_message?.from?.is_bot === true;

    if (!isMentioned && !isReply) return next();

    // Build context about active deals in this chat
    const activeDeals = getActiveDealsByChat(chatId);
    const allDeals = getDealsByChat(chatId);

    let dealContext = "";
    if (activeDeals.length > 0) {
      dealContext = "\n\nActive deals in this chat:\n" + activeDeals.map(d =>
        `- Deal #${d.id}: ${d.terms.deliverable} for ${d.terms.price} ${d.terms.currency} | ${d.terms.brandUsername} → ${d.terms.creatorUsername} | Status: ${d.status}`
      ).join("\n");
    }
    if (allDeals.length > 0) {
      const completed = allDeals.filter(d => d.status === "COMPLETED").length;
      const refunded = allDeals.filter(d => d.status === "REFUNDED").length;
      dealContext += `\n\nChat stats: ${allDeals.length} total deals, ${completed} completed, ${refunded} refunded.`;
    }

    const username = ctx.from?.username ? `@${ctx.from.username}` : "Someone";

    try {
      const response = await callGroq(
        QA_SYSTEM_PROMPT + dealContext,
        `${username} says: "${text}"`
      );

      // Send as plain text — no MarkdownV2 escaping headaches for conversational responses
      await ctx.reply(response, {
        reply_parameters: { message_id: ctx.message.message_id }
      });
    } catch (err) {
      console.error("QA handler error:", err);
    }

    // Don't call next() — we handled this message
  });
}
