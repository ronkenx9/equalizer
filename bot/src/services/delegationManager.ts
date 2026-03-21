import {
  createCaveat,
  contracts,
  ExecutionMode,
  ROOT_AUTHORITY,
} from "@metamask/delegation-toolkit";
import { encodeFunctionData, keccak256, toBytes, encodeAbiParameters, type Hex } from "viem";
import { getDeal, updateDeal } from "./store.js";
import {
  getAgentSmartAccount,
  getBundlerClient,
  isSmartAccountReady,
  getAgentSmartAccountAddress,
  getDelegatorEnv,
} from "./smartAccount.js";
import { logDelegationRedemption } from "./agentLog.js";
import { config } from "../config.js";
import { toDealIdBytes32 } from "../utils/dealId.js";

interface Delegation {
  delegate: Hex;
  delegator: Hex;
  authority: Hex;
  caveats: Array<{ enforcer: Hex; terms: Hex; args: Hex }>;
  salt: Hex;
  signature: Hex;
}

// Escrow ABI fragments for the 5 delegated functions
const DELEGATED_ABI = [
  { name: "release", type: "function", stateMutability: "nonpayable", inputs: [{ name: "dealId", type: "bytes32" }], outputs: [] },
  { name: "refund", type: "function", stateMutability: "nonpayable", inputs: [{ name: "dealId", type: "bytes32" }], outputs: [] },
  { name: "rule", type: "function", stateMutability: "nonpayable", inputs: [{ name: "dealId", type: "bytes32" }, { name: "creatorBps", type: "uint256" }], outputs: [] },
  { name: "autoRelease", type: "function", stateMutability: "nonpayable", inputs: [{ name: "dealId", type: "bytes32" }], outputs: [] },
  { name: "submitDelivery", type: "function", stateMutability: "nonpayable", inputs: [{ name: "dealId", type: "bytes32" }], outputs: [] },
] as const;

const ALLOWED_METHOD_SELECTORS = [
  "release(bytes32)",
  "refund(bytes32)",
  "rule(bytes32,uint256)",
  "autoRelease(bytes32)",
  "submitDelivery(bytes32)",
];

function getEscrowAddress(): Hex {
  const addr = config.yieldEscrowAddress || config.escrowContractAddress;
  if (!addr) throw new Error("ESCROW_CONTRACT_ADDRESS not set");
  return addr as Hex;
}

// ── Create Unsigned Delegation ─────────────────────────

/**
 * Creates an unsigned delegation struct for a deal.
 * Called when the payment portal requests the delegation to present to the brand.
 */
export function createDealDelegation(
  dealId: string,
  brandSmartAccountAddress: string,
  brandAccountMeta?: { factory: string; factoryData: string }
) {
  const deal = getDeal(dealId);
  if (!deal) throw new Error(`Deal ${dealId} not found`);

  const agentSmartAccount = getAgentSmartAccount();
  const escrowAddress = getEscrowAddress();
  const env = getDelegatorEnv();

  // Parse deadline from deal terms
  const deadlineDate = new Date(deal.terms.deadline);
  const deadlineUnix = Math.floor(deadlineDate.getTime() / 1000);

  // Build caveats using the real enforcer addresses
  const allowedTargetsCaveat = createCaveat(
    env.caveatEnforcers.AllowedTargetsEnforcer,
    encodeAbiParameters([{ type: "address[]" }], [[escrowAddress]]),
  );
  // Compute function selectors (first 4 bytes of keccak256 of each method signature)
  const selectors = ALLOWED_METHOD_SELECTORS.map(
    (s) => keccak256(toBytes(s)).slice(0, 10) as Hex
  );
  const allowedMethodsCaveat = createCaveat(
    env.caveatEnforcers.AllowedMethodsEnforcer,
    encodeAbiParameters([{ type: "bytes4[]" }], [selectors]),
  );

  // Build delegation struct directly (v0.13.0 createDelegation requires scope config we don't need)
  const delegation: Delegation = {
    delegate: agentSmartAccount.address,
    delegator: brandSmartAccountAddress as Hex,
    authority: ROOT_AUTHORITY as Hex,
    caveats: [allowedTargetsCaveat, allowedMethodsCaveat],
    salt: "0x0" as Hex,
    signature: "0x" as Hex,
  };

  return {
    delegation,
    caveats: {
      target: escrowAddress,
      methods: ALLOWED_METHOD_SELECTORS,
      deadline: deadlineUnix,
    },
    accountMeta: brandAccountMeta,
  };
}

// ── Store Signed Delegation ────────────────────────────

/**
 * Stores the brand's EIP-712 signature on the deal record.
 * Called when POST /v1/delegation/sign receives the brand's signature.
 */
export function storeDelegationSignature(
  dealId: string,
  signature: string,
  delegation: any,
  brandEOA: string,
  brandSmartAccount: string,
  accountMeta?: { factory: string; factoryData: string }
): void {
  const deal = getDeal(dealId);
  if (!deal) throw new Error(`Deal ${dealId} not found`);

  const escrowAddress = getEscrowAddress();
  const deadlineDate = new Date(deal.terms.deadline);
  const deadlineUnix = Math.floor(deadlineDate.getTime() / 1000);

  const delegationHash = `0x${Buffer.from(JSON.stringify(delegation)).toString("hex").slice(0, 64)}`;

  updateDeal(dealId, {
    delegation: {
      signature,
      delegationHash,
      delegation: { ...delegation, signature },
      caveats: {
        target: escrowAddress,
        methods: ALLOWED_METHOD_SELECTORS,
        deadline: deadlineUnix,
      },
      accountMeta,
      brandEOA,
      brandSmartAccount,
      agentSmartAccount: getAgentSmartAccountAddress(),
      signedAt: Date.now(),
    },
  });

  console.log(`[Delegation] Signed delegation stored for deal ${dealId} (hash: ${delegationHash.slice(0, 18)}...)`);
}

// ── Redeem Delegation ──────────────────────────────────

type DelegatedAction = "release" | "refund" | "rule" | "autoRelease" | "submitDelivery";

/**
 * Redeems a deal's delegation via the Pimlico bundler.
 * The DelegationManager validates the brand's EIP-712 signature and caveats onchain.
 */
export async function redeemDealDelegation(
  dealId: string,
  action: DelegatedAction,
  args: any[]
): Promise<string> {
  const deal = getDeal(dealId);
  if (!deal?.delegation?.signature) {
    throw new Error(`No signed delegation for deal ${dealId}`);
  }

  const agentSmartAccount = getAgentSmartAccount();
  const bundlerClient = getBundlerClient();
  const env = getDelegatorEnv();

  // 1. Build the execution calldata
  const executionCalldata = encodeFunctionData({
    abi: DELEGATED_ABI,
    functionName: action,
    args: args as any,
  });

  const execution = {
    target: getEscrowAddress(),
    value: 0n,
    callData: executionCalldata,
  };

  // 2. Reconstruct the signed delegation
  const signedDelegation = deal.delegation.delegation;

  // 3. Encode redeemDelegations calldata via DelegationManager contract
  const redeemCalldata = contracts.DelegationManager.encode.redeemDelegations({
    delegations: [[signedDelegation]],
    modes: [ExecutionMode.SingleDefault],
    executions: [[execution]],
  });

  // 4. Submit via bundler as UserOperation
  const userOpHash = await bundlerClient.sendUserOperation({
    account: agentSmartAccount,
    calls: [{ to: env.DelegationManager, data: redeemCalldata }],
  });

  // 5. Wait for receipt
  const receipt = await bundlerClient.waitForUserOperationReceipt({
    hash: userOpHash,
  });

  const txHash = receipt.receipt.transactionHash;

  // 6. Log
  logDelegationRedemption({
    dealId,
    delegationHash: deal.delegation.delegationHash,
    action,
    txHash,
    userOpHash,
  });

  console.log(`[Delegation] Redeemed ${action} for deal ${dealId}: ${txHash}`);
  return txHash;
}
