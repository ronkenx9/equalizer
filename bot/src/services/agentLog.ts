import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, join } from "path";

const DATA_DIR = join(process.cwd(), "data");
export const LOG_FILE = resolve(DATA_DIR, "agentLog.json");

// Ensure data directory and log file exist on import
try {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(LOG_FILE)) writeFileSync(LOG_FILE, "[]");
} catch { /* Railway ephemeral FS — best effort */ }

export function logAgentDecision(
  dealId: string,
  observation: string,
  decision: string,
  action: string,
  extras?: {
    onchain_tx_hash?: string;
    private_reasoning?: string;
    inference_provider?: "claude" | "venice";
  }
) {
  try {
    const logs = JSON.parse(readFileSync(LOG_FILE, "utf-8"));
    logs.push({
      timestamp: new Date().toISOString(),
      dealId,
      observation,
      decision,
      action,
      ...(extras?.onchain_tx_hash && { onchain_tx_hash: extras.onchain_tx_hash }),
      ...(extras?.private_reasoning && { private_reasoning: extras.private_reasoning }),
      ...(extras?.inference_provider && { inference_provider: extras.inference_provider }),
    });
    writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
    console.log(`[Agent] ${action} for deal ${dealId}`);
  } catch (err) {
    console.error("Failed to write to agentLog.json", err);
  }
}

export function logDelegationRedemption(entry: {
  dealId: string;
  delegationHash: string;
  action: string;
  txHash: string;
  userOpHash: string;
}) {
  try {
    const logs = JSON.parse(readFileSync(LOG_FILE, "utf-8"));
    logs.push({
      timestamp: new Date().toISOString(),
      type: "delegation_redemption",
      dealId: entry.dealId,
      delegationHash: entry.delegationHash,
      caveatEnforcers: ["AllowedTargets", "AllowedMethods"],
      action: entry.action,
      txHash: entry.txHash,
      userOpHash: entry.userOpHash,
      delegationManager: "0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3",
    });
    writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
    console.log(`[Agent] Delegation redeemed: ${entry.action} for deal ${entry.dealId}`);
  } catch (err) {
    console.error("Failed to log delegation redemption:", err);
  }
}
