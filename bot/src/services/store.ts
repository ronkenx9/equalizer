import { DealState, DealStatus, DealTerms } from "../types/deal.js";
import { randomBytes } from "crypto";

const deals = new Map<string, DealState>();

export function createDeal(chatId: number, terms: DealTerms): DealState {
  const id = randomBytes(4).toString("hex").toUpperCase();
  const deal: DealState = {
    id,
    chatId,
    terms,
    status: DealStatus.Pending,
    createdAt: Date.now(),
  };
  deals.set(id, deal);
  return deal;
}

export function getDeal(id: string): DealState | undefined {
  return deals.get(id);
}

export function updateDeal(id: string, update: Partial<DealState>): DealState | undefined {
  const deal = deals.get(id);
  if (!deal) return undefined;
  const updated = { ...deal, ...update };
  deals.set(id, updated);
  return updated;
}

export function getDealsByChat(chatId: number): DealState[] {
  return [...deals.values()].filter((d) => d.chatId === chatId);
}

export function getActiveDealsByChat(chatId: number): DealState[] {
  const terminal = [DealStatus.Completed, DealStatus.Refunded];
  return getDealsByChat(chatId).filter((d) => !terminal.includes(d.status));
}

export function getAllDeals(): DealState[] {
  return [...deals.values()];
}
