import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { getEnsName, getEnsAddress } from "viem/ens";
import { config } from "../config.js";

// ENS lives on Ethereum mainnet regardless of where deals are
const ensClient = createPublicClient({
  chain: mainnet,
  transport: http(config.ensRpcUrl),
});

// In-memory cache: key → { value, expiresAt }
const TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CacheEntry {
  value: string | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function getCached(key: string): string | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCached(key: string, value: string | null): void {
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

/**
 * Resolve an Ethereum address to its ENS name.
 * Returns null if no ENS name is set or if lookup fails.
 */
export async function resolveEnsName(address: string): Promise<string | null> {
  const key = `name:${address.toLowerCase()}`;
  const cached = getCached(key);
  if (cached !== undefined) return cached;

  try {
    const name = await getEnsName(ensClient, {
      address: address as `0x${string}`,
    });
    const result = name ?? null;
    setCached(key, result);
    return result;
  } catch {
    // Graceful failure — never throw
    return null;
  }
}

/**
 * Resolve an ENS name to its Ethereum address.
 * Returns null if the name does not resolve or if lookup fails.
 */
export async function resolveEnsAddress(name: string): Promise<string | null> {
  const key = `addr:${name.toLowerCase()}`;
  const cached = getCached(key);
  if (cached !== undefined) return cached;

  try {
    const address = await getEnsAddress(ensClient, { name });
    const result = address ?? null;
    setCached(key, result);
    return result;
  } catch {
    // Graceful failure — never throw
    return null;
  }
}

/**
 * Returns the ENS name for an address if one exists,
 * otherwise returns the address truncated to 0x1234...5678 format.
 */
export async function formatAddressOrEns(address: string): Promise<string> {
  const name = await resolveEnsName(address);
  if (name) return name;
  // Truncate: 0x + first 4 hex chars + ... + last 4 hex chars
  if (address.length >= 10) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  return address;
}
