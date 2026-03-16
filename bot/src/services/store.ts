import { DealState, DealStatus, DealTerms } from "../types/deal.js";
import { randomBytes } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_FILE = resolve(__dirname, "../../data/deals.json");

const deals = new Map<string, DealState>();

// Load persisted deals on startup
function loadFromDisk(): void {
  try {
    if (existsSync(STORE_FILE)) {
      const raw = readFileSync(STORE_FILE, "utf-8");
      const entries: [string, DealState][] = JSON.parse(raw);
      for (const [id, deal] of entries) {
        deals.set(id, deal);
      }
      console.log(`Loaded ${deals.size} deals from disk`);
    }
  } catch (err) {
    console.warn("Failed to load deals from disk:", err);
  }
}

function saveToDisk(): void {
  try {
    const dir = dirname(STORE_FILE);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const entries = [...deals.entries()];
    writeFileSync(STORE_FILE, JSON.stringify(entries, null, 2));
  } catch (err) {
    console.warn("Failed to save deals to disk:", err);
  }
}

// Initialize on module load
loadFromDisk();

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
  saveToDisk();
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
  saveToDisk();
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
