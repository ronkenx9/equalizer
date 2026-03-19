import { DealTerms, DealState, DealStatus } from "../types/deal.js";
import { InlineKeyboard } from "grammy";

function escape(text: string | null | undefined): string {
  if (!text) return "";
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

export function formatDealCard(terms: DealTerms, dealId: string): { text: string; keyboard: InlineKeyboard } {
  const text = [
    `*EQUALIZER Deal \\#${escape(dealId)}*`,
    ``,
    `📋 *Deliverable:* ${escape(terms.deliverable)}`,
    `💰 *Price:* ${escape(terms.price)} ${escape(terms.currency)}`,
    `📅 *Deadline:* ${escape(terms.deadline)}`,
    ``,
    `🏢 *Brand:* ${escape(terms.brandUsername)}`,
    `🎨 *Creator:* ${escape(terms.creatorUsername)}`,
    ``,
    `_Both parties must confirm to lock this deal\\._`,
  ].join("\n");

  const keyboard = new InlineKeyboard()
    .text("✅ Confirm", `confirm:${dealId}`)
    .text("❌ Reject", `reject:${dealId}`);

  return { text, keyboard };
}

export function formatDealStatus(deal: DealState): string {
  const statusEmoji: Record<DealStatus, string> = {
    [DealStatus.Pending]: "⏳",
    [DealStatus.BrandConfirmed]: "✅",
    [DealStatus.CreatorConfirmed]: "✅",
    [DealStatus.Confirmed]: "🤝",
    [DealStatus.Funded]: "💰",
    [DealStatus.DeliverySubmitted]: "📦",
    [DealStatus.DisputeWindow]: "⏰",
    [DealStatus.Disputed]: "⚠️",
    [DealStatus.EvidenceCollection]: "📝",
    [DealStatus.Completed]: "✅",
    [DealStatus.Refunded]: "↩️",
  };

  const lines = [
    `*Deal \\#${deal.id}* ${statusEmoji[deal.status]}`,
    `Status: ${deal.status.replace(/_/g, " ")}`,
    `Brand: ${deal.terms.brandUsername}`,
    `Creator: ${deal.terms.creatorUsername}`,
    `Price: ${deal.terms.price} ${deal.terms.currency}`,
  ];

  if (deal.status === DealStatus.DisputeWindow && deal.disputeWindowEnd) {
    const remaining = Math.max(0, Math.ceil((deal.disputeWindowEnd - Date.now()) / 1000 / 60));
    lines.push(`Dispute window: ${remaining} min remaining`);
  }

  return lines.join("\n");
}

export function explorerTx(txHash: string): string {
  return `https://sepolia.basescan.org/tx/${txHash}`;
}
