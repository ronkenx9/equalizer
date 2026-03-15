import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// .env lives at project root (Equalizer/), two levels up from bot/src/
dotenv.config({ path: resolve(__dirname, "../../.env") });

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const config = {
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  claudeApiKey: required("CLAUDE_API_KEY"),
  baseTestnetRpc: process.env.BASE_TESTNET_RPC ?? "https://sepolia.base.org",
  agentPrivateKey: process.env.AGENT_PRIVATE_KEY ?? "",
  escrowContractAddress: process.env.ESCROW_CONTRACT_ADDRESS ?? "" as `0x${string}`,
  easContractAddress: (process.env.EAS_CONTRACT_ADDRESS ?? "0x4200000000000000000000000000000000000021") as `0x${string}`,
  disputeWindowSeconds: parseInt(process.env.DISPUTE_WINDOW_SECONDS ?? "86400"),
};
