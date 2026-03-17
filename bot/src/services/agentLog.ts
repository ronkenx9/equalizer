import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const LOG_FILE = resolve(__dirname, "../../data/agentLog.json");

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
