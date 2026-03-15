import { config } from "../config.js";

export function getDisputeWindowEnd(): number {
  return Date.now() + config.disputeWindowSeconds * 1000;
}

export function isDisputeWindowExpired(windowEnd: number): boolean {
  return Date.now() > windowEnd;
}

export function formatTimeRemaining(windowEnd: number): string {
  const ms = Math.max(0, windowEnd - Date.now());
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
