import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  encodeFunctionData,
  type Hex,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { config } from "../config.js";
import { toDealIdBytes32 } from "../utils/dealId.js";
import { verifyDelegation } from "./delegation.js";
import { getDeal } from "./store.js";
import { isSmartAccountReady } from "./smartAccount.js";
import { redeemDealDelegation } from "./delegationManager.js";
import type { SupportedChain } from "../types/deal.js";

// ── Chain Definitions ──────────────────────────────────

const xlayer = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: [config.xlayerRpc] } },
  blockExplorers: {
    default: { name: "OKX Explorer", url: "https://www.okx.com/web3/explorer/xlayer" },
  },
});

const CHAIN_CONFIG: Record<SupportedChain, {
  viemChain: typeof baseSepolia | typeof xlayer;
  rpc: string;
  contractAddress: () => Hex;
  explorerTx: (hash: string) => string;
  nativeToken: string;
  supportsDelegation: boolean;
}> = {
  "base-sepolia": {
    viemChain: baseSepolia,
    rpc: config.baseTestnetRpc,
    contractAddress: () => {
      if (config.yieldEscrowAddress) return config.yieldEscrowAddress as Hex;
      if (!config.escrowContractAddress) throw new Error("ESCROW_CONTRACT_ADDRESS not set");
      return config.escrowContractAddress as Hex;
    },
    explorerTx: (hash) => `https://sepolia.basescan.org/tx/${hash}`,
    nativeToken: "ETH",
    supportsDelegation: true,
  },
  "xlayer": {
    viemChain: xlayer,
    rpc: config.xlayerRpc,
    contractAddress: () => {
      if (!config.xlayerEscrowAddress) throw new Error("XLAYER_ESCROW_ADDRESS not set");
      return config.xlayerEscrowAddress as Hex;
    },
    explorerTx: (hash) => `https://www.okx.com/web3/explorer/xlayer/tx/${hash}`,
    nativeToken: "OKB",
    supportsDelegation: false, // Pimlico bundler doesn't support X Layer — use direct EOA
  },
};

function resolveChain(chain?: SupportedChain): SupportedChain {
  return chain ?? "base-sepolia";
}

export function getChainConfig(chain?: SupportedChain) {
  return CHAIN_CONFIG[resolveChain(chain)];
}

export function getNativeToken(chain?: SupportedChain): string {
  return getChainConfig(chain).nativeToken;
}

// ABI — only the functions we call (keeps bundle small)
const ESCROW_ABI = [
  {
    name: "createDeal",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "dealId", type: "bytes32" },
      { name: "creator", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "disputeWindowDuration", type: "uint256" },
      { name: "termsHash", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "submitDelivery",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "dealId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "release",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "dealId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "refund",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "dealId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "dispute",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "dealId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "rule",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "dealId", type: "bytes32" },
      { name: "creatorBps", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "autoRelease",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "dealId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "getDeal",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "dealId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "brand", type: "address" },
          { name: "creator", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "disputeWindowEnd", type: "uint256" },
          { name: "termsHash", type: "string" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
  {
    name: "DealCreated",
    type: "event",
    inputs: [
      { name: "dealId", type: "bytes32", indexed: true },
      { name: "brand", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "termsHash", type: "string", indexed: false },
    ],
  },
] as const;

// ── Clients ───────────────────────────────────────────

// Keep legacy export for backward compat (used by delegation/smartAccount services)
export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(config.baseTestnetRpc, { timeout: 120_000 }),
});

function getPublicClient(chain?: SupportedChain) {
  const c = getChainConfig(chain);
  return createPublicClient({ chain: c.viemChain, transport: http(c.rpc, { timeout: 120_000 }) });
}

function getWalletClient(chain?: SupportedChain) {
  if (!config.agentPrivateKey) throw new Error("AGENT_PRIVATE_KEY not set");
  const c = getChainConfig(chain);
  const account = privateKeyToAccount(config.agentPrivateKey as Hex);
  return createWalletClient({ account, chain: c.viemChain, transport: http(c.rpc, { timeout: 120_000 }) });
}

function getContractAddress(chain?: SupportedChain): Hex {
  return getChainConfig(chain).contractAddress();
}

/** Check if a deal has a signed onchain delegation we can redeem via bundler. */
function hasDelegation(dealId: string): boolean {
  if (!isSmartAccountReady()) return false;
  const deal = getDeal(dealId);
  return !!deal?.delegation?.signature;
}

// ── Write Functions ───────────────────────────────────

export async function createDealOnChain(
  dealId: string,
  creatorAddress: Hex,
  deadlineUnix: number,
  disputeWindowSeconds: number,
  termsHash: string,
  amountEth: string,
  chain?: SupportedChain
): Promise<Hex> {
  const wallet = getWalletClient(chain);
  const hash = await wallet.writeContract({
    address: getContractAddress(chain),
    abi: ESCROW_ABI,
    functionName: "createDeal",
    args: [toDealIdBytes32(dealId), creatorAddress, BigInt(deadlineUnix), 172800n, termsHash],
    value: parseEther(amountEth),
  });
  return hash;
}

export async function submitDeliveryOnChain(dealId: string, chain?: SupportedChain): Promise<Hex> {
  const chainCfg = getChainConfig(chain);
  if (chainCfg.supportsDelegation) {
    if (!verifyDelegation("submitDelivery"))
      throw new Error("Delegation denied: submitDelivery not in scope");
    if (hasDelegation(dealId)) {
      try {
        return await (redeemDealDelegation(dealId, "submitDelivery", [toDealIdBytes32(dealId)]) as Promise<Hex>);
      } catch (err: any) {
        console.warn(`[Chain] Delegation redemption failed for submitDelivery, falling back to EOA: ${err.shortMessage || err.message}`);
      }
    }
  }
  const wallet = getWalletClient(chain);
  return wallet.writeContract({
    address: getContractAddress(chain),
    abi: ESCROW_ABI,
    functionName: "submitDelivery",
    args: [toDealIdBytes32(dealId)],
  });
}

export async function releaseFunds(dealId: string, chain?: SupportedChain): Promise<Hex> {
  const chainCfg = getChainConfig(chain);
  if (chainCfg.supportsDelegation) {
    if (!verifyDelegation("release"))
      throw new Error("Delegation denied: release not in scope");
    if (hasDelegation(dealId)) {
      try {
        return await (redeemDealDelegation(dealId, "release", [toDealIdBytes32(dealId)]) as Promise<Hex>);
      } catch (err: any) {
        console.warn(`[Chain] Delegation redemption failed for release, falling back to EOA: ${err.shortMessage || err.message}`);
      }
    }
  }
  const wallet = getWalletClient(chain);
  return wallet.writeContract({
    address: getContractAddress(chain),
    abi: ESCROW_ABI,
    functionName: "release",
    args: [toDealIdBytes32(dealId)],
  });
}

export async function refundFunds(dealId: string, chain?: SupportedChain): Promise<Hex> {
  const chainCfg = getChainConfig(chain);
  if (chainCfg.supportsDelegation) {
    if (!verifyDelegation("refund"))
      throw new Error("Delegation denied: refund not in scope");
    if (hasDelegation(dealId)) {
      try {
        return await (redeemDealDelegation(dealId, "refund", [toDealIdBytes32(dealId)]) as Promise<Hex>);
      } catch (err: any) {
        console.warn(`[Chain] Delegation redemption failed for refund, falling back to EOA: ${err.shortMessage || err.message}`);
      }
    }
  }
  const wallet = getWalletClient(chain);
  return wallet.writeContract({
    address: getContractAddress(chain),
    abi: ESCROW_ABI,
    functionName: "refund",
    args: [toDealIdBytes32(dealId)],
  });
}

export async function executeRuling(dealId: string, creatorPercent: number, chain?: SupportedChain): Promise<Hex> {
  const creatorBps = BigInt(Math.round(creatorPercent * 100));
  const chainCfg = getChainConfig(chain);
  if (chainCfg.supportsDelegation) {
    if (!verifyDelegation("rule"))
      throw new Error("Delegation denied: rule not in scope");
    if (hasDelegation(dealId)) {
      try {
        return await (redeemDealDelegation(dealId, "rule", [toDealIdBytes32(dealId), creatorBps]) as Promise<Hex>);
      } catch (err: any) {
        console.warn(`[Chain] Delegation redemption failed for rule, falling back to EOA: ${err.shortMessage || err.message}`);
      }
    }
  }
  const wallet = getWalletClient(chain);
  return wallet.writeContract({
    address: getContractAddress(chain),
    abi: ESCROW_ABI,
    functionName: "rule",
    args: [toDealIdBytes32(dealId), creatorBps],
  });
}

export async function autoReleaseOnChain(dealId: string, chain?: SupportedChain): Promise<Hex> {
  const chainCfg = getChainConfig(chain);
  if (chainCfg.supportsDelegation) {
    if (!verifyDelegation("autoRelease"))
      throw new Error("Delegation denied: autoRelease not in scope");
    if (hasDelegation(dealId)) {
      try {
        return await (redeemDealDelegation(dealId, "autoRelease", [toDealIdBytes32(dealId)]) as Promise<Hex>);
      } catch (err: any) {
        console.warn(`[Chain] Delegation redemption failed for autoRelease, falling back to EOA: ${err.shortMessage || err.message}`);
      }
    }
  }
  const wallet = getWalletClient(chain);
  return wallet.writeContract({
    address: getContractAddress(chain),
    abi: ESCROW_ABI,
    functionName: "autoRelease",
    args: [toDealIdBytes32(dealId)],
  });
}

// ── Read Functions ────────────────────────────────────

export async function getDealFromChain(dealId: string, chain?: SupportedChain) {
  const client = getPublicClient(chain);
  const result = await client.readContract({
    address: getContractAddress(chain),
    abi: ESCROW_ABI,
    functionName: "getDeal",
    args: [toDealIdBytes32(dealId)],
  });
  return {
    brand: result.brand,
    creator: result.creator,
    amount: formatEther(result.amount),
    deadline: Number(result.deadline),
    disputeWindowEnd: Number(result.disputeWindowEnd),
    termsHash: result.termsHash,
    status: Number(result.status),
  };
}

export function explorerTxUrl(txHash: string, chain?: SupportedChain): string {
  return getChainConfig(chain).explorerTx(txHash);
}

// ── Brand Deposit Helpers ────────────────────────────

/**
 * Generate the calldata for a brand to call createDeal() directly.
 * Returns the contract address, calldata, and value to send.
 */
export function getDepositInstructions(
  dealId: string,
  creatorAddress: Hex,
  deadlineUnix: number,
  disputeWindowSeconds: number,
  termsHash: string,
  amountEth: string,
  chain?: SupportedChain
): { to: Hex; data: Hex; value: string; valueBigInt: bigint } {
  const data = encodeFunctionData({
    abi: ESCROW_ABI,
    functionName: "createDeal",
    args: [toDealIdBytes32(dealId), creatorAddress, BigInt(deadlineUnix), 172800n, termsHash],
  });

  return {
    to: getContractAddress(chain),
    data,
    value: amountEth,
    valueBigInt: parseEther(amountEth),
  };
}

/**
 * Check if a deal has been funded on-chain by polling the contract state.
 * Returns the on-chain deal data if funded, or null if not yet created.
 */
export async function checkDealFunded(dealId: string, chain?: SupportedChain): Promise<{
  brand: string;
  creator: string;
  amount: string;
  funded: boolean;
} | null> {
  try {
    const deal = await getDealFromChain(dealId, chain);
    if (deal.brand === "0x0000000000000000000000000000000000000000") {
      return null;
    }
    return {
      brand: deal.brand,
      creator: deal.creator,
      amount: deal.amount,
      funded: true,
    };
  } catch {
    return null;
  }
}
