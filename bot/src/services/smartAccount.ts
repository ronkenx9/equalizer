import {
  toMetaMaskSmartAccount,
  Implementation,
  getDeleGatorEnvironment,
} from "@metamask/delegation-toolkit";
import { createPublicClient, http, type Hex } from "viem";
import { createBundlerClient } from "viem/account-abstraction";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../config.js";

// ── State ──────────────────────────────────────────────
let agentSmartAccount: Awaited<ReturnType<typeof toMetaMaskSmartAccount>> | null = null;
let bundlerClient: any = null;
let environment: ReturnType<typeof getDeleGatorEnvironment> | null = null;
let ready = false;

// ── Public Getters ─────────────────────────────────────

export function isSmartAccountReady(): boolean {
  return ready;
}

export function getAgentSmartAccount() {
  if (!agentSmartAccount) throw new Error("Smart account not initialized");
  return agentSmartAccount;
}

export function getBundlerClient() {
  if (!bundlerClient) throw new Error("Bundler client not initialized");
  return bundlerClient;
}

export function getAgentSmartAccountAddress(): string {
  if (!agentSmartAccount) return "";
  return agentSmartAccount.address;
}

export function getDelegatorEnv() {
  if (!environment) {
    environment = getDeleGatorEnvironment(baseSepolia.id);
  }
  return environment;
}

// ── Init ───────────────────────────────────────────────

export async function initSmartAccount(): Promise<void> {
  if (!config.pimlicoApiKey) {
    console.log("[SmartAccount] PIMLICO_API_KEY not set — delegation features disabled.");
    return;
  }

  if (!config.agentPrivateKey) {
    console.log("[SmartAccount] AGENT_PRIVATE_KEY not set — skipping smart account init.");
    return;
  }

  try {
    const agentEOA = privateKeyToAccount(config.agentPrivateKey as Hex);

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(config.baseTestnetRpc, { timeout: 120_000 }),
    });

    environment = getDeleGatorEnvironment(baseSepolia.id);

    // Create the agent's Hybrid DeleGator smart account
    // Cast to any to avoid viem version mismatch between project and toolkit
    agentSmartAccount = await (toMetaMaskSmartAccount as any)({
      client: publicClient,
      implementation: Implementation.Hybrid,
      deployParams: [agentEOA.address, [], [], []],
      deploySalt: "0x",
      signer: { account: agentEOA },
    });

    // Set up bundler client (Pimlico)
    const bundlerUrl = config.bundlerRpcUrl ||
      `https://api.pimlico.io/v2/84532/rpc?apikey=${config.pimlicoApiKey}`;

    bundlerClient = createBundlerClient({
      client: publicClient,
      transport: http(bundlerUrl, { timeout: 120_000 }),
    });

    ready = true;
    console.log(`[SmartAccount] Agent DeleGator initialized: ${agentSmartAccount!.address}`);
    console.log(`[SmartAccount] Bundler: Pimlico (Base Sepolia)`);
  } catch (err) {
    console.error("[SmartAccount] Failed to initialize:", err);
    ready = false;
  }
}
