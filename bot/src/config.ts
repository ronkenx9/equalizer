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
  groqApiKey: process.env.GROQ_API_KEY || "",
  claudeApiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "",
  baseTestnetRpc: process.env.BASE_TESTNET_RPC || process.env.RPC_URL || "https://base-sepolia-rpc.publicnode.com",
  agentPrivateKey: process.env.AGENT_PRIVATE_KEY || process.env.PRIVATE_KEY || "",
  escrowContractAddress: (process.env.ESCROW_CONTRACT_ADDRESS || process.env.CONTRACT_ADDRESS || "") as `0x${string}`,
  easContractAddress: (process.env.EAS_CONTRACT_ADDRESS ?? "0x4200000000000000000000000000000000000021") as `0x${string}`,
  veniceApiKey: process.env.VENICE_API_KEY ?? "",
  yieldEscrowAddress: (process.env.YIELD_ESCROW_ADDRESS || "") as `0x${string}`,
  // x402 Payment Protocol
  x402FacilitatorUrl: process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator",
  agentWalletAddress: process.env.AGENT_WALLET_ADDRESS || "",
  botPublicUrl: (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, ""),
  ensRpcUrl: process.env.ENS_RPC_URL ?? "https://eth.llamarpc.com",
  // MetaMask Delegation + Pimlico bundler
  pimlicoApiKey: process.env.PIMLICO_API_KEY ?? "",
  bundlerRpcUrl: process.env.PIMLICO_API_KEY
    ? `https://api.pimlico.io/v2/84532/rpc?apikey=${process.env.PIMLICO_API_KEY}`
    : "",
  // X Layer (chain ID 196)
  xlayerRpc: process.env.XLAYER_RPC || "https://rpc.xlayer.tech",
  xlayerEscrowAddress: (process.env.XLAYER_ESCROW_ADDRESS || "") as `0x${string}`,
};
