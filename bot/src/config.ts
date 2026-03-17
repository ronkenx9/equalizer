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
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  discordBotToken: process.env.DISCORD_BOT_TOKEN ?? "",
  discordAppId: process.env.DISCORD_APP_ID ?? "",
  claudeApiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || required("CLAUDE_API_KEY_OR_ANTHROPIC_API_KEY"),
  baseTestnetRpc: process.env.BASE_TESTNET_RPC || process.env.RPC_URL || "https://sepolia.base.org",
  agentPrivateKey: process.env.AGENT_PRIVATE_KEY || process.env.PRIVATE_KEY || "",
  escrowContractAddress: (process.env.ESCROW_CONTRACT_ADDRESS || process.env.CONTRACT_ADDRESS || "") as `0x${string}`,
  easContractAddress: (process.env.EAS_CONTRACT_ADDRESS ?? "0x4200000000000000000000000000000000000021") as `0x${string}`,
  veniceApiKey: process.env.VENICE_API_KEY ?? "",
  yieldEscrowAddress: (process.env.YIELD_ESCROW_ADDRESS || "") as `0x${string}`,
};
