import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  encodeFunctionData,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { config } from "../config.js";
import { toDealIdBytes32 } from "../utils/dealId.js";
import { verifyDelegation } from "./delegation.js";
import { getDeal } from "./store.js";
import { isSmartAccountReady } from "./smartAccount.js";
import { redeemDealDelegation } from "./delegationManager.js";

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

const transport = http(config.baseTestnetRpc, { timeout: 120_000 });

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport,
});

function getWalletClient() {
  if (!config.agentPrivateKey) throw new Error("AGENT_PRIVATE_KEY not set");
  const account = privateKeyToAccount(config.agentPrivateKey as Hex);
  return createWalletClient({ account, chain: baseSepolia, transport });
}

function getContractAddress(): Hex {
  if (config.yieldEscrowAddress) return config.yieldEscrowAddress as Hex;
  if (!config.escrowContractAddress) throw new Error("ESCROW_CONTRACT_ADDRESS not set");
  return config.escrowContractAddress as Hex;
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
  amountEth: string
): Promise<Hex> {
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    address: getContractAddress(),
    abi: ESCROW_ABI,
    functionName: "createDeal",
    args: [toDealIdBytes32(dealId), creatorAddress, BigInt(deadlineUnix), BigInt(disputeWindowSeconds), termsHash],
    value: parseEther(amountEth),
  });
  return hash;
}

export async function submitDeliveryOnChain(dealId: string): Promise<Hex> {
  if (!verifyDelegation("submitDelivery"))
    throw new Error("Delegation denied: submitDelivery not in scope");
  if (hasDelegation(dealId)) {
    return redeemDealDelegation(dealId, "submitDelivery", [toDealIdBytes32(dealId)]) as Promise<Hex>;
  }
  const wallet = getWalletClient();
  return wallet.writeContract({
    address: getContractAddress(),
    abi: ESCROW_ABI,
    functionName: "submitDelivery",
    args: [toDealIdBytes32(dealId)],
  });
}

export async function releaseFunds(dealId: string): Promise<Hex> {
  if (!verifyDelegation("release"))
    throw new Error("Delegation denied: release not in scope");
  if (hasDelegation(dealId)) {
    return redeemDealDelegation(dealId, "release", [toDealIdBytes32(dealId)]) as Promise<Hex>;
  }
  const wallet = getWalletClient();
  return wallet.writeContract({
    address: getContractAddress(),
    abi: ESCROW_ABI,
    functionName: "release",
    args: [toDealIdBytes32(dealId)],
  });
}

export async function refundFunds(dealId: string): Promise<Hex> {
  if (!verifyDelegation("refund"))
    throw new Error("Delegation denied: refund not in scope");
  if (hasDelegation(dealId)) {
    return redeemDealDelegation(dealId, "refund", [toDealIdBytes32(dealId)]) as Promise<Hex>;
  }
  const wallet = getWalletClient();
  return wallet.writeContract({
    address: getContractAddress(),
    abi: ESCROW_ABI,
    functionName: "refund",
    args: [toDealIdBytes32(dealId)],
  });
}

export async function executeRuling(dealId: string, creatorPercent: number): Promise<Hex> {
  if (!verifyDelegation("rule"))
    throw new Error("Delegation denied: rule not in scope");
  const creatorBps = BigInt(Math.round(creatorPercent * 100)); // percent to bps
  if (hasDelegation(dealId)) {
    return redeemDealDelegation(dealId, "rule", [toDealIdBytes32(dealId), creatorBps]) as Promise<Hex>;
  }
  const wallet = getWalletClient();
  return wallet.writeContract({
    address: getContractAddress(),
    abi: ESCROW_ABI,
    functionName: "rule",
    args: [toDealIdBytes32(dealId), creatorBps],
  });
}

export async function autoReleaseOnChain(dealId: string): Promise<Hex> {
  if (!verifyDelegation("autoRelease"))
    throw new Error("Delegation denied: autoRelease not in scope");
  if (hasDelegation(dealId)) {
    return redeemDealDelegation(dealId, "autoRelease", [toDealIdBytes32(dealId)]) as Promise<Hex>;
  }
  const wallet = getWalletClient();
  return wallet.writeContract({
    address: getContractAddress(),
    abi: ESCROW_ABI,
    functionName: "autoRelease",
    args: [toDealIdBytes32(dealId)],
  });
}

// ── Read Functions ────────────────────────────────────

export async function getDealFromChain(dealId: string) {
  const result = await publicClient.readContract({
    address: getContractAddress(),
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

export function explorerTxUrl(txHash: string): string {
  return `https://sepolia.basescan.org/tx/${txHash}`;
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
  amountEth: string
): { to: Hex; data: Hex; value: string; valueBigInt: bigint } {
  const data = encodeFunctionData({
    abi: ESCROW_ABI,
    functionName: "createDeal",
    args: [toDealIdBytes32(dealId), creatorAddress, BigInt(deadlineUnix), BigInt(disputeWindowSeconds), termsHash],
  });

  return {
    to: getContractAddress(),
    data,
    value: amountEth,
    valueBigInt: parseEther(amountEth),
  };
}

/**
 * Check if a deal has been funded on-chain by polling the contract state.
 * Returns the on-chain deal data if funded, or null if not yet created.
 */
export async function checkDealFunded(dealId: string): Promise<{
  brand: string;
  creator: string;
  amount: string;
  funded: boolean;
} | null> {
  try {
    const deal = await getDealFromChain(dealId);
    // If brand is zero address, deal doesn't exist on-chain yet
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
