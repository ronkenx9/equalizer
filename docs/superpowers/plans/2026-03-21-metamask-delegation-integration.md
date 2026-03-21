# MetaMask Delegation Toolkit Integration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace EQUALIZER's scaffold delegation with the real MetaMask Delegation Toolkit — ERC-4337 smart accounts, EIP-712 delegation signing, onchain caveat enforcement, and Pimlico bundler integration.

**Architecture:** Agent wallet becomes a Hybrid DeleGator smart account. Brands sign per-deal delegations offchain (free). Agent redeems delegations via DelegationManager contract through Pimlico bundler on Base Sepolia. Brand's DeleGator is deployed atomically during first redemption via `accountMeta`.

**Tech Stack:** `@metamask/delegation-toolkit ^4.0.0`, `permissionless ^0.2`, `viem ^2.47.4`, Pimlico bundler (Base Sepolia), wagmi/RainbowKit (payment portal)

**Spec:** `docs/superpowers/specs/2026-03-21-metamask-delegation-integration-design.md`

---

## Chunk 1: Backend Foundation (Tasks 1-5)

### Task 1: Install Dependencies

**Files:**
- Modify: `bot/package.json`
- Modify: `payment-ui/package.json`

- [ ] **Step 1: Install delegation toolkit in bot/**

```bash
cd bot && npm install @metamask/delegation-toolkit permissionless
```

- [ ] **Step 2: Install delegation toolkit in payment-ui/**

The payment-ui needs the toolkit for `toMetaMaskSmartAccount` (computing brand's counterfactual address) and the delegation type exports.

```bash
cd payment-ui && npm install @metamask/delegation-toolkit
```

- [ ] **Step 3: Verify build still passes**

```bash
cd bot && npm run build
cd ../payment-ui && npx tsc -b --noEmit
```

Expected: Clean compile. No type conflicts with existing viem.

- [ ] **Step 4: Commit**

```bash
git add bot/package.json bot/package-lock.json payment-ui/package.json payment-ui/package-lock.json
git commit -m "chore: install @metamask/delegation-toolkit and permissionless"
```

---

### Task 2: Add DealDelegation Type and Config

**Files:**
- Modify: `bot/src/types/deal.ts:59-89`
- Modify: `bot/src/config.ts:15-32`

- [ ] **Step 1: Add DealDelegation interface to deal.ts**

Add after the `DealState` interface closing brace (line 89):

```typescript
export interface DealDelegation {
  signature: string;
  delegationHash: string;
  delegation: any; // Delegation struct from toolkit — stored as serialized JSON, rehydrated at redemption
  caveats: {
    target: string;
    methods: string[];
    deadline: number;
  };
  accountMeta?: { factory: string; factoryData: string }; // for brand DeleGator auto-deploy
  brandEOA: string;
  brandSmartAccount: string;
  agentSmartAccount: string;
  signedAt: number;
}
```

Note: `delegation` is typed as `any` for JSON serialization to disk (the `DealState` is stored in `data/deals.json`). It's cast to the toolkit's `Delegation` type at redemption time.

- [ ] **Step 2: Add delegation field to DealState**

In the `DealState` interface, add after `easAttestationUid?` (line 88):

```typescript
  delegation?: DealDelegation;
```

- [ ] **Step 3: Add Pimlico config to config.ts**

Add after line 31 (`ensRpcUrl`):

```typescript
  pimlicoApiKey: process.env.PIMLICO_API_KEY || "",
  bundlerRpcUrl: process.env.BUNDLER_RPC_URL || "",
```

- [ ] **Step 4: Verify build**

```bash
cd bot && npm run build
```

Expected: Clean compile.

- [ ] **Step 5: Commit**

```bash
git add bot/src/types/deal.ts bot/src/config.ts
git commit -m "feat: add DealDelegation type and Pimlico config"
```

---

### Task 3: Extract toDealIdBytes32 to Shared Utility

**Files:**
- Create: `bot/src/utils/dealId.ts`
- Modify: `bot/src/services/chain.ts:132-136`

This prevents a circular dependency: `delegationManager.ts` needs `toDealIdBytes32`, and `chain.ts` needs `redeemDealDelegation`. Extract the helper to a shared utility.

- [ ] **Step 1: Create bot/src/utils/dealId.ts**

```typescript
import type { Hex } from "viem";

/**
 * Pad a short deal ID string into a bytes32 hex string.
 */
export function toDealIdBytes32(dealId: string): Hex {
  const hex = Buffer.from(dealId, "utf8").toString("hex");
  return `0x${hex.padEnd(64, "0")}` as Hex;
}
```

- [ ] **Step 2: Update chain.ts to import from shared utility**

In `bot/src/services/chain.ts`, replace lines 132-136:

```typescript
export function toDealIdBytes32(dealId: string): Hex {
  // Pad the short deal ID into a bytes32 hex string
  const hex = Buffer.from(dealId, "utf8").toString("hex");
  return `0x${hex.padEnd(64, "0")}` as Hex;
}
```

With:

```typescript
export { toDealIdBytes32 } from "../utils/dealId.js";
```

This re-exports so existing callers of `chain.toDealIdBytes32` are unaffected.

- [ ] **Step 3: Verify build**

```bash
cd bot && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add bot/src/utils/dealId.ts bot/src/services/chain.ts
git commit -m "refactor: extract toDealIdBytes32 to shared utility to avoid circular deps"
```

---

### Task 4: Create Smart Account Service

**Files:**
- Create: `bot/src/services/smartAccount.ts`

This is the singleton that creates the agent's Hybrid DeleGator smart account and the Pimlico bundler client. All delegation operations depend on this.

- [ ] **Step 1: Create smartAccount.ts**

```typescript
import {
  toMetaMaskSmartAccount,
  Implementation,
} from "@metamask/delegation-toolkit";
import { createPublicClient, http, type Hex } from "viem";
import { createBundlerClient } from "viem/account-abstraction";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../config.js";

// ── State ──────────────────────────────────────────────
let agentSmartAccount: Awaited<ReturnType<typeof toMetaMaskSmartAccount>> | null = null;
let bundlerClient: ReturnType<typeof createBundlerClient> | null = null;
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

export function getDelegatorEnvironment() {
  if (!agentSmartAccount) throw new Error("Smart account not initialized");
  return (agentSmartAccount as any).environment;
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

    // Create the agent's Hybrid DeleGator smart account
    agentSmartAccount = await toMetaMaskSmartAccount({
      client: publicClient,
      implementation: Implementation.Hybrid,
      deployParams: [agentEOA.address, [], [], []],
      deploySalt: "0x",
      signatory: { account: agentEOA },
    });

    // Set up bundler client (Pimlico)
    const bundlerUrl =
      config.bundlerRpcUrl ||
      `https://api.pimlico.io/v2/84532/rpc?apikey=${config.pimlicoApiKey}`;

    bundlerClient = createBundlerClient({
      client: publicClient,
      transport: http(bundlerUrl, { timeout: 120_000 }),
    });

    ready = true;
    console.log(`[SmartAccount] Agent DeleGator initialized: ${agentSmartAccount.address}`);
    console.log(`[SmartAccount] Bundler: Pimlico (Base Sepolia)`);
  } catch (err) {
    console.error("[SmartAccount] Failed to initialize:", err);
    ready = false;
  }
}
```

Note: The exact imports from `@metamask/delegation-toolkit` may need adjustment based on the installed version's actual exports. Check `node_modules/@metamask/delegation-toolkit/dist/index.d.ts` after install. The key APIs are:
- `toMetaMaskSmartAccount` — from `@metamask/delegation-toolkit`
- `createBundlerClient` — from `viem/account-abstraction` (NOT from `viem`)
- `Implementation.Hybrid` — from `@metamask/delegation-toolkit`

- [ ] **Step 2: Verify build**

```bash
cd bot && npm run build
```

If import paths differ from the toolkit's actual exports, fix them now. Check `node_modules/@metamask/delegation-toolkit/dist/index.d.ts` for actual export names.

- [ ] **Step 3: Commit**

```bash
git add bot/src/services/smartAccount.ts
git commit -m "feat: add smart account service — agent DeleGator + Pimlico bundler"
```

---

### Task 5: Create Delegation Manager Service

**Files:**
- Create: `bot/src/services/delegationManager.ts`

This is the core delegation lifecycle service: create unsigned delegations, store signatures, redeem via bundler.

- [ ] **Step 1: Create delegationManager.ts**

```typescript
import {
  createDelegation,
  createCaveatBuilder,
  type Delegation,
  SINGLE_DEFAULT_MODE,
  DelegationManager,
} from "@metamask/delegation-toolkit";
import { encodeFunctionData, type Hex } from "viem";
import { getDeal, updateDeal } from "./store.js";
import {
  getAgentSmartAccount,
  getBundlerClient,
  isSmartAccountReady,
  getAgentSmartAccountAddress,
  getDelegatorEnvironment,
} from "./smartAccount.js";
import { logDelegationRedemption } from "./agentLog.js";
import { config } from "../config.js";
import { toDealIdBytes32 } from "../utils/dealId.js";

// Escrow ABI fragments for the 5 delegated functions
const DELEGATED_ABI = [
  { name: "release", type: "function", stateMutability: "nonpayable", inputs: [{ name: "dealId", type: "bytes32" }], outputs: [] },
  { name: "refund", type: "function", stateMutability: "nonpayable", inputs: [{ name: "dealId", type: "bytes32" }], outputs: [] },
  { name: "rule", type: "function", stateMutability: "nonpayable", inputs: [{ name: "dealId", type: "bytes32" }, { name: "creatorBps", type: "uint256" }], outputs: [] },
  { name: "autoRelease", type: "function", stateMutability: "nonpayable", inputs: [{ name: "dealId", type: "bytes32" }], outputs: [] },
  { name: "submitDelivery", type: "function", stateMutability: "nonpayable", inputs: [{ name: "dealId", type: "bytes32" }], outputs: [] },
] as const;

const ALLOWED_METHODS = [
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
 *
 * @param dealId - The deal ID
 * @param brandSmartAccountAddress - The brand's DeleGator counterfactual address (computed on frontend)
 * @returns The unsigned delegation struct + human-readable summary
 */
export function createDealDelegation(
  dealId: string,
  brandSmartAccountAddress: string,
  brandAccountMeta?: { factory: string; factoryData: string }
): { delegation: Delegation; caveats: { target: string; methods: string[]; deadline: number }; accountMeta?: { factory: string; factoryData: string } } {
  const deal = getDeal(dealId);
  if (!deal) throw new Error(`Deal ${dealId} not found`);

  const agentSmartAccount = getAgentSmartAccount();
  const escrowAddress = getEscrowAddress();

  // Parse deadline from deal terms
  const deadlineDate = new Date(deal.terms.deadline);
  const deadlineUnix = Math.floor(deadlineDate.getTime() / 1000);

  // Build caveats
  const environment = getDelegatorEnvironment();
  const caveatBuilder = createCaveatBuilder(environment);

  caveatBuilder
    .addCaveat("allowedTargets", [escrowAddress])
    .addCaveat("allowedMethods", ALLOWED_METHODS);

  // Create the delegation
  const delegation = createDelegation({
    to: agentSmartAccount.address,
    from: brandSmartAccountAddress as Hex,
    caveats: caveatBuilder.build(),
  });

  return {
    delegation,
    caveats: {
      target: escrowAddress,
      methods: ALLOWED_METHODS,
      deadline: deadlineUnix,
    },
    // accountMeta allows the brand's DeleGator to be deployed atomically
    // during the first delegation redemption (no separate deploy tx needed)
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
  delegation: Delegation,
  brandEOA: string,
  brandSmartAccount: string,
  accountMeta?: { factory: string; factoryData: string }
): void {
  const deal = getDeal(dealId);
  if (!deal) throw new Error(`Deal ${dealId} not found`);

  const escrowAddress = getEscrowAddress();
  const deadlineDate = new Date(deal.terms.deadline);
  const deadlineUnix = Math.floor(deadlineDate.getTime() / 1000);

  // Compute a hash for logging/reference
  const delegationHash = `0x${Buffer.from(JSON.stringify(delegation)).toString("hex").slice(0, 64)}`;

  updateDeal(dealId, {
    delegation: {
      signature,
      delegationHash,
      delegation: { ...delegation, signature } as any,
      caveats: {
        target: escrowAddress,
        methods: ALLOWED_METHODS,
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

  // 1. Build the execution calldata
  const executionCalldata = encodeFunctionData({
    abi: DELEGATED_ABI,
    functionName: action,
    args,
  });

  const execution = {
    target: getEscrowAddress(),
    value: 0n,
    callData: executionCalldata,
  };

  // 2. Reconstruct the signed delegation
  const signedDelegation = deal.delegation.delegation as Delegation;

  // 3. Encode redeemDelegations calldata
  const redeemCalldata = DelegationManager.encode.redeemDelegations({
    delegations: [[signedDelegation]],
    modes: [SINGLE_DEFAULT_MODE],
    executions: [[execution]],
  });

  // 4. Submit via bundler as UserOperation
  const userOpHash = await bundlerClient.sendUserOperation({
    account: agentSmartAccount,
    calls: [{ to: agentSmartAccount.address, data: redeemCalldata }],
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
```

Note: Like Task 3, the exact imports from `@metamask/delegation-toolkit` may need adjustment. Key things to verify after install:
- `createDelegation` may be named `createRootDelegation` in some versions
- `DelegationManager.encode.redeemDelegations` — check if this is the correct encoding API or if it's a standalone `encodeDelegationCalldata` function
- `SINGLE_DEFAULT_MODE` — verify export name
- `createCaveatBuilder` — verify it accepts `environment` from the smart account
- `Delegation` type — verify it exists as a named export

If any of these differ, adjust the imports to match the installed version. The logic and structure remain the same.

- [ ] **Step 2: Verify build**

```bash
cd bot && npm run build
```

Fix any import issues based on the actual toolkit exports.

- [ ] **Step 3: Commit**

```bash
git add bot/src/services/delegationManager.ts
git commit -m "feat: add delegation manager — create, store, redeem deal delegations"
```

---

## Chunk 2: Backend Integration (Tasks 6-8)

### Task 6: Add Agent Log Support for Delegation Redemptions

**Files:**
- Modify: `bot/src/services/agentLog.ts:1-37`

- [ ] **Step 1: Add logDelegationRedemption function**

Add after the existing `logAgentDecision` function (after line 36):

```typescript
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
```

- [ ] **Step 2: Verify build**

```bash
cd bot && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add bot/src/services/agentLog.ts
git commit -m "feat: add delegation redemption logging to agentLog"
```

---

### Task 7: Refactor delegation.ts and Update Startup

**Files:**
- Modify: `bot/src/services/delegation.ts:1-139`
- Modify: `bot/src/index.ts:20,28`

- [ ] **Step 1: Refactor delegation.ts**

Replace the `initDelegation` function (lines 124-138) to call `initSmartAccount()` instead of self-delegating. Keep the rest of the file (types, `verifyDelegation`, `getDelegationStatus`, `createDelegation`) intact — they serve as the local fast-path guard and the legacy `/v1/delegation/status` endpoint.

Replace lines 124-138 with:

```typescript
export async function initDelegation(): Promise<void> {
  const agentWallet = config.agentWalletAddress;
  const contract = config.yieldEscrowAddress || config.escrowContractAddress;

  if (!agentWallet || !contract) {
    console.log(
      "[Delegation] AGENT_WALLET_ADDRESS or ESCROW_CONTRACT_ADDRESS not set — skipping delegation init."
    );
    return;
  }

  // Initialize MetaMask DeleGator smart account if Pimlico key is set
  try {
    const { initSmartAccount } = await import("./smartAccount.js");
    await initSmartAccount();
  } catch (err) {
    console.warn("[Delegation] Smart account init failed, falling back to local-only delegation:", err);
  }

  // Create local fast-path delegation (always, regardless of smart account)
  createDelegation(agentWallet);
  console.log("[Delegation] Default delegation initialised on startup.");
}
```

- [ ] **Step 2: Update index.ts to await async initDelegation**

In `bot/src/index.ts`, line 28 currently reads:

```typescript
initDelegation();
```

Change to:

```typescript
await initDelegation();
```

Also, wrap the top-level startup in an async IIFE if not already. Since the file uses top-level code, we need to handle the async call. The simplest approach: change line 28 to:

```typescript
initDelegation().catch((err) => console.error("Delegation init failed:", err));
```

This keeps the startup non-blocking (same pattern as `initEAS` on line 31).

- [ ] **Step 3: Verify build**

```bash
cd bot && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add bot/src/services/delegation.ts bot/src/index.ts
git commit -m "feat: refactor initDelegation to initialize smart account on startup"
```

---

### Task 8: Integrate Delegation Path into chain.ts

**Files:**
- Modify: `bot/src/services/chain.ts:1-297`

This is the critical integration point. Each of the 5 write functions gains a delegation redemption code path.

- [ ] **Step 1: Add imports to chain.ts**

Add after the existing imports (after line 13):

```typescript
import { getDeal } from "./store.js";
import { redeemDealDelegation } from "./delegationManager.js";
import { isSmartAccountReady } from "./smartAccount.js";
```

- [ ] **Step 2: Update submitDeliveryOnChain (lines 159-169)**

Replace the function body:

```typescript
export async function submitDeliveryOnChain(dealId: string): Promise<Hex> {
  if (!verifyDelegation("submitDelivery"))
    throw new Error("Delegation denied: submitDelivery not in scope");

  // Delegation path: redeem via DelegationManager
  const deal = getDeal(dealId);
  if (deal?.delegation?.signature && isSmartAccountReady()) {
    const txHash = await redeemDealDelegation(dealId, "submitDelivery", [toDealIdBytes32(dealId)]);
    return txHash as Hex;
  }

  // Fallback: direct EOA
  const wallet = getWalletClient();
  return wallet.writeContract({
    address: getContractAddress(),
    abi: ESCROW_ABI,
    functionName: "submitDelivery",
    args: [toDealIdBytes32(dealId)],
  });
}
```

- [ ] **Step 3: Update releaseFunds (lines 171-181)**

Same pattern:

```typescript
export async function releaseFunds(dealId: string): Promise<Hex> {
  if (!verifyDelegation("release"))
    throw new Error("Delegation denied: release not in scope");

  const deal = getDeal(dealId);
  if (deal?.delegation?.signature && isSmartAccountReady()) {
    const txHash = await redeemDealDelegation(dealId, "release", [toDealIdBytes32(dealId)]);
    return txHash as Hex;
  }

  const wallet = getWalletClient();
  return wallet.writeContract({
    address: getContractAddress(),
    abi: ESCROW_ABI,
    functionName: "release",
    args: [toDealIdBytes32(dealId)],
  });
}
```

- [ ] **Step 4: Update refundFunds (lines 183-193)**

```typescript
export async function refundFunds(dealId: string): Promise<Hex> {
  if (!verifyDelegation("refund"))
    throw new Error("Delegation denied: refund not in scope");

  const deal = getDeal(dealId);
  if (deal?.delegation?.signature && isSmartAccountReady()) {
    const txHash = await redeemDealDelegation(dealId, "refund", [toDealIdBytes32(dealId)]);
    return txHash as Hex;
  }

  const wallet = getWalletClient();
  return wallet.writeContract({
    address: getContractAddress(),
    abi: ESCROW_ABI,
    functionName: "refund",
    args: [toDealIdBytes32(dealId)],
  });
}
```

- [ ] **Step 5: Update executeRuling (lines 195-206)**

```typescript
export async function executeRuling(dealId: string, creatorPercent: number): Promise<Hex> {
  if (!verifyDelegation("rule"))
    throw new Error("Delegation denied: rule not in scope");

  const creatorBps = BigInt(Math.round(creatorPercent * 100));

  const deal = getDeal(dealId);
  if (deal?.delegation?.signature && isSmartAccountReady()) {
    const txHash = await redeemDealDelegation(dealId, "rule", [toDealIdBytes32(dealId), creatorBps]);
    return txHash as Hex;
  }

  const wallet = getWalletClient();
  return wallet.writeContract({
    address: getContractAddress(),
    abi: ESCROW_ABI,
    functionName: "rule",
    args: [toDealIdBytes32(dealId), creatorBps],
  });
}
```

- [ ] **Step 6: Update autoReleaseOnChain (lines 208-218)**

```typescript
export async function autoReleaseOnChain(dealId: string): Promise<Hex> {
  if (!verifyDelegation("autoRelease"))
    throw new Error("Delegation denied: autoRelease not in scope");

  const deal = getDeal(dealId);
  if (deal?.delegation?.signature && isSmartAccountReady()) {
    const txHash = await redeemDealDelegation(dealId, "autoRelease", [toDealIdBytes32(dealId)]);
    return txHash as Hex;
  }

  const wallet = getWalletClient();
  return wallet.writeContract({
    address: getContractAddress(),
    abi: ESCROW_ABI,
    functionName: "autoRelease",
    args: [toDealIdBytes32(dealId)],
  });
}
```

- [ ] **Step 7: Verify build**

```bash
cd bot && npm run build
```

- [ ] **Step 8: Commit**

```bash
git add bot/src/services/chain.ts
git commit -m "feat: integrate delegation redemption path into all 5 chain write functions"
```

---

## Chunk 3: API Endpoints (Task 9)

### Task 9: Add Delegation API Endpoints

**Files:**
- Modify: `bot/src/api/v1/delegation.ts:1-79`

Add three new endpoints for the payment portal flow. Must be added BEFORE any parameterized routes to avoid Express route collision.

- [ ] **Step 1: Add imports**

Add to existing imports at top of file (after line 5):

```typescript
import {
  createDealDelegation,
  storeDelegationSignature,
} from "../../services/delegationManager.js";
import { getDeal } from "../../services/store.js";
import { isSmartAccountReady, getAgentSmartAccountAddress } from "../../services/smartAccount.js";
```

- [ ] **Step 2: Add GET /deal/:dealId endpoint**

Add AFTER the existing `router.get("/status", ...)` block (after line 31) and BEFORE the `router.post("/create", ...)` block:

```typescript
/**
 * GET /v1/delegation/deal/:dealId
 * Public. Returns the unsigned delegation struct for the payment portal.
 * The portal uses this to present the delegation scope to the brand and get their EIP-712 signature.
 */
router.get("/deal/:dealId", (req: Request, res: Response): void => {
  const dealId = req.params.dealId as string;
  const brandSmartAccount = req.query.brandSmartAccount as string | undefined;

  if (!brandSmartAccount) {
    res.status(400).json({ error: "Missing query param: brandSmartAccount" });
    return;
  }

  if (!isSmartAccountReady()) {
    res.status(503).json({ error: "Delegation service not available — PIMLICO_API_KEY not configured" });
    return;
  }

  const deal = getDeal(dealId);
  if (!deal) {
    res.status(404).json({ error: `Deal ${dealId} not found` });
    return;
  }

  try {
    const { delegation, caveats } = createDealDelegation(dealId, brandSmartAccount);

    res.status(200).json({
      dealId,
      delegation,
      caveats,
      agentSmartAccount: getAgentSmartAccountAddress(),
      summary: {
        allowed: ["release", "refund", "rule", "autoRelease", "submitDelivery"],
        target: caveats.target,
        prohibited: ["transfer", "approve", "any other contract", "any other function"],
        deadline: new Date(caveats.deadline * 1000).toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /v1/delegation/deal/:dealId/status
 * Public. Check if a deal has a signed delegation.
 */
router.get("/deal/:dealId/status", (req: Request, res: Response): void => {
  const dealId = req.params.dealId as string;
  const deal = getDeal(dealId);

  if (!deal) {
    res.status(404).json({ error: `Deal ${dealId} not found` });
    return;
  }

  if (deal.delegation?.signature) {
    res.status(200).json({
      signed: true,
      delegationHash: deal.delegation.delegationHash,
      signedAt: deal.delegation.signedAt,
      agentSmartAccount: deal.delegation.agentSmartAccount,
      brandSmartAccount: deal.delegation.brandSmartAccount,
    });
  } else {
    res.status(200).json({ signed: false });
  }
});

/**
 * POST /v1/delegation/sign
 * Public. Brand submits their EIP-712 signature for a deal's delegation.
 */
router.post("/sign", async (req: Request, res: Response): Promise<void> => {
  const { dealId, signature, delegation, brandEOA, brandSmartAccount, accountMeta } = req.body as {
    dealId?: string;
    signature?: string;
    delegation?: any;
    brandEOA?: string;
    brandSmartAccount?: string;
    accountMeta?: { factory: string; factoryData: string };
  };

  if (!dealId || !signature || !delegation || !brandEOA || !brandSmartAccount) {
    res.status(400).json({
      error: "Missing required fields: dealId, signature, delegation, brandEOA, brandSmartAccount",
    });
    return;
  }

  const deal = getDeal(dealId);
  if (!deal) {
    res.status(404).json({ error: `Deal ${dealId} not found` });
    return;
  }

  if (deal.delegation?.signature) {
    res.status(409).json({ error: "Delegation already signed for this deal" });
    return;
  }

  try {
    storeDelegationSignature(dealId, signature, delegation, brandEOA, brandSmartAccount, accountMeta);
    res.status(201).json({
      success: true,
      dealId,
      delegationHash: getDeal(dealId)?.delegation?.delegationHash,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 3: Verify build**

```bash
cd bot && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add bot/src/api/v1/delegation.ts
git commit -m "feat: add deal delegation API endpoints — create, sign, status"
```

---

## Chunk 4: Payment Portal UI (Tasks 10-11)

### Task 10: Create Delegation Hook

**Files:**
- Create: `payment-ui/src/hooks/useDelegation.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useState, useCallback } from "react";

interface DelegationData {
  dealId: string;
  delegation: any;
  caveats: {
    target: string;
    methods: string[];
    deadline: number;
  };
  agentSmartAccount: string;
  summary: {
    allowed: string[];
    target: string;
    prohibited: string[];
    deadline: string;
  };
}

interface UseDelegationReturn {
  delegationData: DelegationData | null;
  isSigned: boolean;
  isLoading: boolean;
  isSigning: boolean;
  error: string | null;
  fetchDelegation: (dealId: string, brandSmartAccount: string) => Promise<void>;
  submitSignature: (
    dealId: string,
    signature: string,
    delegation: any,
    brandEOA: string,
    brandSmartAccount: string
  ) => Promise<void>;
}

export function useDelegation(): UseDelegationReturn {
  const [delegationData, setDelegationData] = useState<DelegationData | null>(null);
  const [isSigned, setIsSigned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDelegation = useCallback(async (dealId: string, brandSmartAccount: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // First check if already signed
      const statusRes = await fetch(`/api/v1/delegation/deal/${dealId}/status`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.signed) {
          setIsSigned(true);
          setIsLoading(false);
          return;
        }
      }

      // Fetch unsigned delegation
      const res = await fetch(
        `/api/v1/delegation/deal/${dealId}?brandSmartAccount=${brandSmartAccount}`
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch delegation");
      }
      const data = await res.json();
      setDelegationData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitSignature = useCallback(
    async (
      dealId: string,
      signature: string,
      delegation: any,
      brandEOA: string,
      brandSmartAccount: string
    ) => {
      setIsSigning(true);
      setError(null);
      try {
        const res = await fetch("/api/v1/delegation/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dealId, signature, delegation, brandEOA, brandSmartAccount }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to submit signature");
        }
        setIsSigned(true);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsSigning(false);
      }
    },
    []
  );

  return {
    delegationData,
    isSigned,
    isLoading,
    isSigning,
    error,
    fetchDelegation,
    submitSignature,
  };
}
```

- [ ] **Step 2: Verify types**

```bash
cd payment-ui && npx tsc -b --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add payment-ui/src/hooks/useDelegation.ts
git commit -m "feat: add useDelegation hook for payment portal"
```

---

### Task 11: Add Delegation Step to Payment Portal

**Files:**
- Create: `payment-ui/src/components/DelegationStep.tsx`
- Modify: `payment-ui/src/App.tsx:1-481`

- [ ] **Step 1: Create DelegationStep component**

```tsx
import { useEffect } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import {
  toMetaMaskSmartAccount,
  Implementation,
} from "@metamask/delegation-toolkit";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { useDelegation } from "../hooks/useDelegation";

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

interface DelegationStepProps {
  dealId: string;
  onSigned: () => void;
}

export function DelegationStep({ dealId, onSigned }: DelegationStepProps) {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const {
    delegationData,
    isSigned,
    isLoading,
    isSigning,
    error,
    fetchDelegation,
    submitSignature,
  } = useDelegation();

  // Compute brand's DeleGator address and fetch delegation when wallet connects
  useEffect(() => {
    if (!address || !dealId) return;

    (async () => {
      try {
        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http(),
        });

        // Compute counterfactual DeleGator address for the brand
        const brandSmartAccount = await toMetaMaskSmartAccount({
          client: publicClient,
          implementation: Implementation.Hybrid,
          deployParams: [address, [], [], []],
          deploySalt: "0x",
          signatory: { account: address },
        });

        await fetchDelegation(dealId, brandSmartAccount.address);
      } catch (err) {
        console.error("Failed to compute brand smart account:", err);
      }
    })();
  }, [address, dealId, fetchDelegation]);

  // Notify parent when signed
  useEffect(() => {
    if (isSigned) onSigned();
  }, [isSigned, onSigned]);

  const handleSign = async () => {
    if (!delegationData || !address) return;

    try {
      // The delegation struct needs to be signed as EIP-712 typed data
      // The exact domain and types come from the delegation toolkit
      // For now, sign the delegation struct as a message
      const signature = await signTypedDataAsync({
        domain: {
          name: "DelegationManager",
          version: "1",
          chainId: baseSepolia.id,
          verifyingContract: delegationData.agentSmartAccount as `0x${string}`,
        },
        types: {
          Delegation: [
            { name: "delegate", type: "address" },
            { name: "delegator", type: "address" },
            { name: "authority", type: "bytes32" },
            { name: "caveats", type: "bytes" },
            { name: "salt", type: "uint256" },
          ],
        },
        primaryType: "Delegation",
        message: delegationData.delegation,
      });

      // Compute brand's DeleGator address again for the submission
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });
      const brandSmartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Hybrid,
        deployParams: [address, [], [], []],
        deploySalt: "0x",
        signatory: { account: address },
      });

      await submitSignature(
        dealId,
        signature,
        delegationData.delegation,
        address,
        brandSmartAccount.address
      );
    } catch (err: any) {
      console.error("Signing failed:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-6 mb-4">
        <div className="bg-[var(--color-card-elevated)] rounded-lg p-4 flex items-center gap-3">
          <Spinner />
          <span className="text-xs text-[var(--color-text-dim)]">Loading delegation...</span>
        </div>
      </div>
    );
  }

  if (isSigned) {
    return (
      <div className="mx-6 mb-4">
        <div className="bg-[var(--color-card-elevated)] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[var(--color-success)]"><ShieldIcon /></div>
            <span className="text-xs font-medium text-[var(--color-success)]">Delegation Signed</span>
          </div>
          <p className="text-[10px] text-[var(--color-text-dim)]">
            EQUALIZER has scoped authority for this deal only.
          </p>
        </div>
      </div>
    );
  }

  if (!delegationData) return null;

  return (
    <div className="mx-6 mb-4">
      <div className="bg-[var(--color-card-elevated)] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="text-[var(--color-gold)]"><ShieldIcon /></div>
          <span className="text-xs font-medium text-[var(--color-text)]">Sign Delegation</span>
        </div>

        <p className="text-[10px] text-[var(--color-text-dim)] mb-3">
          Grant EQUALIZER scoped authority over this deal:
        </p>

        <div className="space-y-1.5 mb-4">
          {["Release funds to creator", "Refund funds to you", "Rule on disputes"].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <span className="text-[var(--color-success)] text-[10px]">✓</span>
              <span className="text-[10px] text-[var(--color-text-muted)]">{item}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="text-[10px]">✓</span>
            <span className="text-[10px] text-[var(--color-text-muted)]">
              This escrow contract only
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px]">✓</span>
            <span className="text-[10px] text-[var(--color-text-muted)]">
              Expires: {new Date(delegationData.caveats.deadline * 1000).toLocaleDateString()}
            </span>
          </div>
          <div className="h-px bg-[var(--color-border)] my-2" />
          {["Transfer your tokens", "Call any other contract"].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <span className="text-[var(--color-danger)] text-[10px]">✗</span>
              <span className="text-[10px] text-[var(--color-text-dim)]">{item}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleSign}
          disabled={isSigning}
          className="w-full bg-[var(--color-gold)]/10 border border-[var(--color-gold)]/30 text-[var(--color-gold)] font-medium py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 hover:bg-[var(--color-gold)]/20 transition-colors"
        >
          {isSigning ? (
            <>
              <Spinner />
              <span>Signing...</span>
            </>
          ) : (
            <span>Sign Delegation (No Gas)</span>
          )}
        </button>

        {error && (
          <p className="text-[var(--color-danger)] text-[10px] mt-2 text-center">{error}</p>
        )}

        <p className="text-[9px] text-[var(--color-text-dim)] text-center mt-2">
          EIP-712 signature — free, no gas required
        </p>
      </div>
    </div>
  );
}
```

**CRITICAL: EIP-712 Signing Implementation Note**

The EIP-712 `types`, `domain`, and `message` in `handleSign` above are **approximations**. The exact typed data structure MUST match the DelegationManager contract's EIP-712 schema. After installing the toolkit:

1. Check if the toolkit exports `getDelegationTypedData()`, `getDelegationHashTypedData()`, or a similar helper
2. Check if `MetaMaskSmartAccount.signDelegation({ delegation })` can be called from the browser with a wagmi signer — if so, use that instead of raw `signTypedDataAsync`
3. The `verifyingContract` should likely be the DelegationManager address, not the agent's smart account
4. The `caveats` field in the EIP-712 types is an array of Caveat structs, not raw `bytes`
5. The brand's `toMetaMaskSmartAccount` should return `getFactoryArgs()` — use this to populate `accountMeta` for the POST /sign request

The implementing agent MUST verify the correct typed data from the toolkit's source code or tests before finalizing this component. Do not ship hard-coded EIP-712 types without verification.

- [ ] **Step 2: Integrate DelegationStep into App.tsx**

In `payment-ui/src/App.tsx`, add the import at the top (after line 10):

```typescript
import { DelegationStep } from './components/DelegationStep';
```

Add state for delegation signing (after line 114, the `selectedToken` state):

```typescript
const [delegationSigned, setDelegationSigned] = useState(false);
```

In the main payment state section (line 387, inside the `isConnected && isCorrectChain` branch), replace the existing button with the delegation-gated flow:

Replace lines 387-413 (the `<div>` inside the ternary's last branch) with:

```tsx
<div>
  {/* Delegation step — must sign before funding */}
  <DelegationStep
    dealId={dealId!}
    onSigned={() => setDelegationSigned(true)}
  />

  <button
    onClick={handlePay}
    disabled={isWritePending || isTxConfirming || !delegationSigned}
    className={`btn-glow w-full font-semibold py-3.5 rounded-lg text-sm flex items-center justify-center gap-2 ${
      delegationSigned
        ? 'bg-[var(--color-gold)] text-[var(--color-surface)]'
        : 'bg-[var(--color-card-elevated)] text-[var(--color-text-dim)] cursor-not-allowed'
    }`}
  >
    {(isWritePending || isTxConfirming) && <Spinner />}
    <span>
      {isTxConfirming
        ? 'Confirming transaction...'
        : isWritePending
          ? 'Approve in wallet...'
          : !delegationSigned
            ? `Fund ${displayAmount} ${displaySymbol} (sign delegation first)`
            : `Fund ${displayAmount} ${displaySymbol}`}
    </span>
  </button>

  {/* Connected wallet info */}
  <div className="flex items-center justify-between mt-4 px-1">
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
      <span className="mono text-[10px] text-[var(--color-text-dim)]">
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </span>
    </div>
    <span className="text-[10px] text-[var(--color-text-dim)]">Base Sepolia</span>
  </div>
</div>
```

- [ ] **Step 3: Verify build**

```bash
cd payment-ui && npx tsc -b --noEmit
```

Note: The `toMetaMaskSmartAccount` call in `DelegationStep.tsx` may require adjustments depending on how the toolkit handles browser/wagmi integration vs. node.js. The `signatory` field may need to be a wagmi connector account rather than a raw address. Fix any type errors after install.

- [ ] **Step 4: Build the payment UI**

```bash
cd payment-ui && npm run build
```

- [ ] **Step 5: Copy built files to bot/public**

```bash
cp -r payment-ui/dist/* bot/public/
```

- [ ] **Step 6: Commit**

```bash
git add payment-ui/src/components/DelegationStep.tsx payment-ui/src/hooks/useDelegation.ts payment-ui/src/App.tsx bot/public/
git commit -m "feat: add delegation signing step to payment portal UI"
```

---

## Chunk 5: Documentation & Verification (Tasks 12-13)

### Task 12: Update DELEGATION.md

**Files:**
- Modify: `DELEGATION.md`

- [ ] **Step 1: Rewrite DELEGATION.md with real integration details**

Replace the entire file content with updated documentation that references:
- The real `@metamask/delegation-toolkit` package
- `toMetaMaskSmartAccount` with `Implementation.Hybrid`
- `AllowedTargets` and `AllowedMethods` caveat enforcers
- `DelegationManager.redeemDelegations()` onchain validation
- The Pimlico bundler flow
- Brand's counterfactual DeleGator + `accountMeta` auto-deployment
- EIP-712 offchain signature (no gas for brand)
- Remove the hackathon self-delegation disclaimer (no longer applicable — real flow is implemented)

Key sections:
1. The Problem (same)
2. The Solution — now references real MetaMask toolkit, ERC-4337, EIP-7710
3. EQUALIZER's Delegation Scope — same 5 functions
4. Caveat Enforcers — AllowedTargets + AllowedMethods
5. Payment Portal Flow — three-step: connect → sign → fund
6. Runtime Enforcement — DelegationManager onchain validation + local fast-path
7. The Proof — delegation hash from redeemDelegations tx, visible on Base Sepolia explorer
8. Agent Log — delegation redemption entries with tx hashes

- [ ] **Step 2: Commit**

```bash
git add DELEGATION.md
git commit -m "docs: update DELEGATION.md with real MetaMask Delegation Toolkit integration"
```

---

### Task 13: End-to-End Verification

- [ ] **Step 1: Build everything**

```bash
cd bot && npm run build
cd ../payment-ui && npm run build
cp -r payment-ui/dist/* bot/public/
```

All must compile clean.

- [ ] **Step 2: Start bot without PIMLICO_API_KEY**

```bash
cd bot && PIMLICO_API_KEY="" npm run start
```

Expected output includes:
```
[SmartAccount] PIMLICO_API_KEY not set — delegation features disabled.
[Delegation] Default delegation initialised on startup.
```

No crashes. All existing functionality works.

- [ ] **Step 3: Test delegation endpoints return correct fallback**

```bash
curl http://localhost:3000/api/v1/delegation/status
# Should return { active: true, delegation: { ... } } (local fast-path)

curl http://localhost:3000/api/v1/delegation/deal/TESTID/status
# Should return { signed: false } or 404 if deal doesn't exist
```

- [ ] **Step 4: Start bot WITH PIMLICO_API_KEY**

```bash
cd bot && PIMLICO_API_KEY=<your-key> npm run start
```

Expected output includes:
```
[SmartAccount] Agent DeleGator initialized: 0x...
[SmartAccount] Bundler: Pimlico (Base Sepolia)
```

- [ ] **Step 5: Test delegation creation endpoint**

Create a test deal first, then:
```bash
curl http://localhost:3000/api/v1/delegation/deal/<dealId>?brandSmartAccount=0x1234567890123456789012345678901234567890
```

Should return the unsigned delegation struct with caveats.

- [ ] **Step 6: Verify payment portal shows delegation step**

Open `http://localhost:3000/pay/<dealId>` in browser. After connecting wallet, the delegation signing step should appear before the fund button.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: MetaMask Delegation Toolkit integration complete — real ERC-4337 + EIP-712 + onchain enforcement"
```

---

## Implementation Notes for Subagents

### Import Verification

The `@metamask/delegation-toolkit` package has gone through several API iterations. After installing, the implementing agent MUST:

1. Check `node_modules/@metamask/delegation-toolkit/dist/index.d.ts` for actual exports
2. Verify these specific names exist:
   - `toMetaMaskSmartAccount`
   - `Implementation` (with `.Hybrid`)
   - `createDelegation` (might be `createRootDelegation`)
   - `createCaveatBuilder`
   - `SINGLE_DEFAULT_MODE`
   - `DelegationManager` (with `.encode.redeemDelegations`)
   - `Delegation` type
3. If any name differs, update all references in `smartAccount.ts`, `delegationManager.ts`, and `DelegationStep.tsx`

### Browser vs Node

The toolkit is designed for both browser and Node.js. However:
- In the payment-ui (browser), `toMetaMaskSmartAccount` needs a wagmi-compatible client
- In the bot (Node.js), it uses a viem `publicClient` directly
- The `signatory` field may differ between environments

### Fallback Behavior

If any toolkit import fails at runtime (package issue, version mismatch), the system MUST still start and function via the existing EOA path. Never crash on delegation init failure.

### Testing Without Pimlico

All tasks except the final e2e verification can be tested without a Pimlico API key. The build verification (`npm run build`) catches type errors. The API endpoints work in "delegation not available" mode when Pimlico is unconfigured.
