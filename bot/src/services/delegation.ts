import { createHash, randomBytes } from "crypto";
import { config } from "../config.js";

// ── Types ─────────────────────────────────────────────

/**
 * Delegation scope — what the agent is allowed to do.
 * Based on EIP-7710 concepts: human delegates EXACTLY scoped permissions.
 */
export interface DelegationScope {
  allowedFunctions: string[];  // e.g. ["release", "refund", "rule", "autoRelease", "submitDelivery"]
  contractAddress: string;     // the escrow contract
  delegator: string;           // human operator address
  delegatee: string;           // agent wallet address
  chainId: number;             // 84532 (Base Sepolia)
  issuedAt: number;            // Unix timestamp
  expiresAt: number | null;    // null = no expiry
  delegationId: string;        // unique ID, UUID-like
}

export interface DelegationProof {
  scope: DelegationScope;
  // EIP-712 style signature hash of the scope
  scopeHash: string;
  // Human-readable summary of what the agent can and cannot do
  summary: string;
  verificationMethod: "eip712_scope_hash";
}

// ── State ─────────────────────────────────────────────

let activeDelegation: DelegationProof | null = null;

const ALLOWED_FUNCTIONS = ["release", "refund", "rule", "autoRelease", "submitDelivery"];

// ── Helpers ───────────────────────────────────────────

function buildSummary(scope: DelegationScope): string {
  const shortDelegatee = `${scope.delegatee.slice(0, 6)}...${scope.delegatee.slice(-4)}`;
  const shortContract = `${scope.contractAddress.slice(0, 6)}...${scope.contractAddress.slice(-4)}`;
  const allowed = scope.allowedFunctions.join(", ");
  return (
    `Delegated to agent ${shortDelegatee} on contract ${shortContract}. ` +
    `Allowed: ${allowed}. ` +
    `Prohibited: all other actions.`
  );
}

function computeScopeHash(scope: DelegationScope): string {
  // Canonical key ordering for deterministic hashing
  const canonical = JSON.stringify({
    allowedFunctions: scope.allowedFunctions,
    chainId: scope.chainId,
    contractAddress: scope.contractAddress,
    delegatee: scope.delegatee,
    delegationId: scope.delegationId,
    delegator: scope.delegator,
    expiresAt: scope.expiresAt,
    issuedAt: scope.issuedAt,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

// ── Public API ────────────────────────────────────────

/**
 * Creates a delegation from the given human address to the agent wallet.
 * Stores it as the active delegation and returns the proof.
 */
export function createDelegation(delegatorAddress: string): DelegationProof {
  const delegatee = config.agentWalletAddress;
  const contractAddress =
    config.yieldEscrowAddress || config.escrowContractAddress || "";

  const scope: DelegationScope = {
    allowedFunctions: ALLOWED_FUNCTIONS,
    contractAddress,
    delegator: delegatorAddress,
    delegatee,
    chainId: 84532, // Base Sepolia
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: null,
    delegationId: randomBytes(16).toString("hex"),
  };

  const scopeHash = computeScopeHash(scope);
  const summary = buildSummary(scope);

  const proof: DelegationProof = {
    scope,
    scopeHash,
    summary,
    verificationMethod: "eip712_scope_hash",
  };

  activeDelegation = proof;
  console.log(`[Delegation] New delegation created. ID: ${scope.delegationId}`);
  console.log(`[Delegation] ${summary}`);
  console.log(`[Delegation] Scope hash: ${scopeHash}`);

  return proof;
}

/**
 * Returns the current active delegation, or null if none exists.
 */
export function getDelegationStatus(): DelegationProof | null {
  return activeDelegation;
}

/**
 * Returns true if the current delegation allows calling the given function name.
 */
export function verifyDelegation(functionName: string): boolean {
  if (!activeDelegation) return false;
  return activeDelegation.scope.allowedFunctions.includes(functionName);
}

/**
 * Called on startup if AGENT_WALLET_ADDRESS and ESCROW_CONTRACT_ADDRESS are set.
 * Creates a default delegation using the agent wallet as both delegator and delegatee
 * (hackathon simplicity — in production the human operator would sign this).
 */
export function initDelegation(): void {
  const agentWallet = config.agentWalletAddress;
  const contract = config.yieldEscrowAddress || config.escrowContractAddress;

  if (!agentWallet || !contract) {
    console.log(
      "[Delegation] AGENT_WALLET_ADDRESS or ESCROW_CONTRACT_ADDRESS not set — skipping delegation init."
    );
    return;
  }

  // Use agent wallet as placeholder delegator (hackathon mode)
  createDelegation(agentWallet);
  console.log("[Delegation] Default delegation initialised on startup.");
}
