# MetaMask Delegation Toolkit Integration — Design Spec

## Summary

Replace EQUALIZER's scaffold delegation (SHA-256 scope hash + local `verifyDelegation()`) with the real MetaMask Delegation Toolkit (`@metamask/delegation-toolkit`). The agent wallet becomes an ERC-4337 Hybrid DeleGator smart account. Brands sign EIP-712 delegations offchain (no gas) scoping the agent's authority to specific escrow functions for a specific deal. The agent redeems delegations via the DelegationManager contract through a Pimlico bundler on Base Sepolia. Onchain caveat enforcers guarantee the agent cannot exceed its mandate.

## Architecture

### Current Flow
```
Agent EOA → writeContract() → Escrow Contract
```

### New Flow
```
Brand's DeleGator smart account signs EIP-712 Delegation (offchain, free)
    ↓
Agent stores signed delegation on deal record (DealState.delegation)
    ↓
When action needed (release/refund/rule):
    Agent → redeemDelegations() calldata → UserOperation → Pimlico Bundler
        → DelegationManager validates signature + caveats onchain
        → DelegationManager calls Escrow Contract on agent's behalf
```

### Key Decisions

- **Brand gets a Hybrid DeleGator smart account transparently.** The MetaMask Delegation Toolkit requires delegators to be smart accounts. When the brand connects their wallet on the payment portal, we call `toMetaMaskSmartAccount()` with their EOA as the signer. This creates a counterfactual smart account address (deterministic via CREATE2) — no deployment tx needed. The brand signs the delegation with their EOA key and includes `accountMeta` (factory address + deploy calldata). When the agent redeems the delegation via `sendUserOperationWithDelegation`, the toolkit automatically deploys the brand's DeleGator before redeeming — all in one atomic UserOperation. The brand never pays gas for smart account deployment. Brand experience: connect wallet → sign one message → fund escrow. No extra steps.
- **Per-deal delegations.** Each deal gets its own delegation with deal-specific caveats. Compromise of one delegation cannot affect other deals.
- **Local fast-path guard stays.** `verifyDelegation()` checks locally before hitting the bundler — saves unnecessary UserOperation submissions.
- **Backward compatible.** Deals created before this sprint (no delegation on record) use the existing direct EOA `writeContract()` path.
- **`dispute` is intentionally excluded from delegation scope.** Disputes are initiated by deal parties directly, not by the agent. The agent only arbitrates disputes via `rule()`.

## New Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PIMLICO_API_KEY` | Yes (for delegation) | — | Free tier from pimlico.io |
| `BUNDLER_RPC_URL` | No | `https://api.pimlico.io/v2/84532/rpc?apikey=${PIMLICO_API_KEY}` | ERC-4337 bundler endpoint |

If `PIMLICO_API_KEY` is not set, the system falls back to direct EOA calls. Delegation features are disabled gracefully.

## File Changes

### New Files

| File | Purpose |
|---|---|
| `bot/src/services/smartAccount.ts` | Singleton: creates the agent's Hybrid DeleGator smart account via `toMetaMaskSmartAccount()`, sets up the Pimlico bundler client via `createBundlerClient()` from `viem/account-abstraction`. Exports `getAgentSmartAccount()`, `getBundlerClient()`, `getDelegatorEnvironment()`, `isSmartAccountReady()`. Initialized once at startup via `initSmartAccount()`. |
| `bot/src/services/delegationManager.ts` | Core delegation lifecycle. Imports `createDelegation`, `createCaveatBuilder`, `SINGLE_DEFAULT_MODE` from `@metamask/delegation-toolkit`. Functions: `createDealDelegation(dealId)` builds unsigned delegation struct with caveats, `getSigningPayload(dealId)` returns EIP-712 typed data for the portal, `storeDelegationSignature(dealId, signature)` validates and stores brand's signature on the `DealState`, `redeemDealDelegation(dealId, action, args)` redeems via bundler. |
| `payment-ui/src/components/DelegationStep.tsx` | Shows scope summary, "Sign Delegation" button. Uses wagmi's `useSignTypedData` to call `wallet_signTypedData_v4` with the EIP-712 payload fetched from the API. |
| `payment-ui/src/hooks/useDelegation.ts` | `useDelegation(dealId)` hook: fetches unsigned delegation + EIP-712 payload from `GET /api/v1/delegation/:dealId`, submits signature via `POST /api/v1/delegation/sign`, tracks signing state. |

### Modified Files

| File | Change |
|---|---|
| `bot/src/services/delegation.ts` | Refactor: `initDelegation()` becomes async, calls `initSmartAccount()` from `smartAccount.ts` (no self-delegation). Keep `verifyDelegation()` as local fast-path. Remove self-delegation on startup. |
| `bot/src/services/chain.ts` | The 5 write functions gain a second code path. Import `getDeal` from `../services/store.js` and `redeemDealDelegation` from `./delegationManager.js`. Before calling `writeContract()`, check if `getDeal(dealId)?.delegation?.signature` exists. If yes, call `redeemDealDelegation()`. Otherwise fall back to direct EOA `writeContract()`. Function signatures unchanged — they already take `dealId: string`. |
| `bot/src/api/v1/delegation.ts` | New endpoints added BEFORE the existing parameterized routes (route ordering matters): `GET /v1/delegation/deal/:dealId` (unsigned delegation struct for portal), `POST /v1/delegation/sign` (brand submits signature), `GET /v1/delegation/deal/:dealId/status` (check if signed). Existing `/status` GET and `/create` POST unchanged. Using `/deal/:dealId` prefix avoids collision with existing `/status` route. |
| `bot/src/types/deal.ts` | Add `delegation?: DealDelegation` to `DealState` interface (the type is `DealState`, not `Deal`). Add `DealDelegation` interface. |
| `bot/src/config.ts` | Add `pimlicoApiKey`, `bundlerRpcUrl`. |
| `bot/src/index.ts` | `initDelegation()` becomes async with await. Logs DeleGator smart account address on startup. |
| `bot/src/services/agentLog.ts` | Add `logDelegationRedemption()` function that logs delegation redemption events. |
| `payment-ui/src/App.tsx` | Add `DelegationStep` component between wallet connect and fund button. Sequential gating: connect → sign delegation → fund. Fund button disabled until delegation signed. |

### Unchanged
- Telegram/Discord handlers — deal detection, confirmation, message flows
- `createDealOnChain()` — brand deposits directly
- x402 payment protocol
- ENS, trust, reputation endpoints

## Deal Delegation Type

```typescript
import type { Delegation } from "@metamask/delegation-toolkit";

export interface DealDelegation {
  signature: string;          // EIP-712 signature from brand's EOA
  delegationHash: string;     // keccak256 of the delegation struct, for agentLog reference
  delegation: Delegation;     // full delegation struct from toolkit (delegator, delegate, authority, caveats, salt, signature)
  caveats: {
    target: string;           // escrow contract address
    methods: string[];        // ["release", "refund", "rule", "autoRelease", "submitDelivery"]
    deadline: number;         // deal deadline timestamp
  };
  brandEOA: string;           // brand's original EOA address (the signer)
  brandSmartAccount: string;  // brand's DeleGator address (the delegator)
  agentSmartAccount: string;  // agent's DeleGator address (the delegate)
  signedAt: number;           // timestamp brand signed
}
```

Note: `delegation` is typed as `Delegation` from `@metamask/delegation-toolkit`, not `object`. This preserves full type safety when passing to `redeemDelegations()`.

## Caveat Enforcers Per Deal

```typescript
import { createCaveatBuilder } from "@metamask/delegation-toolkit";

// environment comes from getDelegatorEnvironment() in smartAccount.ts
const caveatBuilder = createCaveatBuilder(environment);

caveatBuilder
  .addCaveat("allowedTargets", [escrowContractAddress])
  .addCaveat("allowedMethods", [
    "release(bytes32)",
    "refund(bytes32)",
    "rule(bytes32,uint256)",
    "autoRelease(bytes32)",
    "submitDelivery(bytes32)"
  ]);
```

Caveats enforce:
- **AllowedTargets**: Agent can only call the escrow contract. No other addresses.
- **AllowedMethods**: Agent can only call the 5 escrow management functions. No `transfer()`, no `selfdestruct()`, nothing else.

**Why no timestamp/expiry caveat:** The escrow contract's own `deadline` field enforces time bounds. `autoRelease()` checks `block.timestamp > deadline` in Solidity. Adding a redundant timestamp caveat would require syncing two deadlines. The local `verifyDelegation()` fast-path also catches expired deals before they hit the bundler.

**Why `dispute` is excluded:** Disputes are initiated by deal parties (brand or creator) directly on the contract. The agent's role is to arbitrate via `rule()`, not to initiate disputes.

## Payment Portal Flow (Three-Step)

```
┌─────────────────────────────────────┐
│         EQUALIZER ESCROW            │
│         Deal #A1B2C3D4              │
│                                     │
│  Step 1: Connect Wallet       ✓    │
│                                     │
│  Step 2: Sign Delegation            │
│  ┌─────────────────────────────┐    │
│  │ Grant EQUALIZER scoped      │    │
│  │ authority over this deal:   │    │
│  │                             │    │
│  │ ✓ Release / Refund / Rule   │    │
│  │ ✓ This escrow contract only │    │
│  │ ✓ Expires: Mar 28 2026      │    │
│  │ ✗ No token transfers        │    │
│  │ ✗ No other contracts        │    │
│  │                             │    │
│  │ [Sign Delegation]           │    │
│  └─────────────────────────────┘    │
│                                     │
│  Step 3: Fund Escrow (locked)       │
│  [Fund 0.0001 ETH] (greyed out)    │
└─────────────────────────────────────┘
```

After signing:
- POST signature to `/api/v1/delegation/sign`
- Step 2 shows green checkmark
- Step 3 unlocks
- Same RainbowKit session, zero context switch

## API Endpoints

### New

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/v1/delegation/deal/:dealId` | GET | Public | Returns unsigned delegation struct + EIP-712 typed data payload + human-readable caveats for the payment portal |
| `/v1/delegation/sign` | POST | Public | Brand submits `{ dealId, signature }`. Server validates, stores on `DealState.delegation` |
| `/v1/delegation/deal/:dealId/status` | GET | Public | Returns `{ signed: boolean, delegationHash?, signedAt? }` |

Note: New routes use `/deal/:dealId` prefix to avoid collision with existing `/status` static route. Static routes (`/status`, `/create`) are registered first in the router.

### Existing (unchanged)
| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/v1/delegation/status` | GET | Public | Returns active agent delegation proof (global) |
| `/v1/delegation/create` | POST | Auth | Create delegation manually via API |

## Execution Path: Agent Redeems Delegation

```typescript
import { getDeal } from "../services/store.js";
import { encodeFunctionData } from "viem";
import { SINGLE_DEFAULT_MODE } from "@metamask/delegation-toolkit";
import { getAgentSmartAccount, getBundlerClient } from "./smartAccount.js";
import { logDelegationRedemption } from "./agentLog.js";

async function redeemDealDelegation(
  dealId: string,
  action: "release" | "refund" | "rule" | "autoRelease" | "submitDelivery",
  args: any[]
): Promise<string> {
  const deal = getDeal(dealId);
  if (!deal?.delegation?.signature) throw new Error("No signed delegation for this deal");

  const agentSmartAccount = getAgentSmartAccount();
  const bundlerClient = getBundlerClient();

  // 1. Build the execution calldata (what we want the escrow to do)
  const executionCalldata = encodeFunctionData({
    abi: ESCROW_ABI,
    functionName: action,
    args,
  });

  const execution = {
    target: getContractAddress(),
    value: 0n,
    callData: executionCalldata,
  };

  // 2. Encode the redeemDelegations call
  // The signed delegation includes the full Delegation struct with brand's signature
  const signedDelegation = deal.delegation.delegation;

  const redeemCalldata = DelegationManager.encode.redeemDelegations({
    delegations: [[signedDelegation]],
    modes: [SINGLE_DEFAULT_MODE],
    executions: [[execution]],
  });

  // 3. Submit via bundler as UserOperation
  // The call targets the agent's own smart account, which forwards to DelegationManager
  const userOpHash = await bundlerClient.sendUserOperation({
    account: agentSmartAccount,
    calls: [{ to: agentSmartAccount.address, data: redeemCalldata }],
  });

  // 4. Wait for receipt
  const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });

  // 5. Log to agentLog.json
  logDelegationRedemption({
    dealId,
    delegationHash: deal.delegation.delegationHash,
    action,
    txHash: receipt.receipt.transactionHash,
    userOpHash,
  });

  return receipt.receipt.transactionHash;
}
```

**Note on `calls[].to`:** The UserOperation's call target is the agent's own smart account address. The smart account contract internally routes `redeemDelegations` to the DelegationManager. This is the standard pattern in the MetaMask Delegation Toolkit — the smart account acts as the entry point, not the DelegationManager directly.

## chain.ts Integration

The 5 write functions in `chain.ts` gain the delegation code path. Example for `releaseFunds`:

```typescript
import { getDeal } from "../services/store.js";
import { redeemDealDelegation } from "./delegationManager.js";
import { isSmartAccountReady } from "./smartAccount.js";

export async function releaseFunds(dealId: string): Promise<Hex> {
  if (!verifyDelegation("release"))
    throw new Error("Delegation denied: release not in scope");

  // Check if this deal has a real signed delegation
  const deal = getDeal(dealId);
  if (deal?.delegation?.signature && isSmartAccountReady()) {
    const txHash = await redeemDealDelegation(dealId, "release", [toDealIdBytes32(dealId)]);
    return txHash as Hex;
  }

  // Fallback: direct EOA writeContract (backward compat)
  const wallet = getWalletClient();
  return wallet.writeContract({
    address: getContractAddress(),
    abi: ESCROW_ABI,
    functionName: "release",
    args: [toDealIdBytes32(dealId)],
  });
}
```

Same pattern for all 5 functions. Function signatures unchanged — callers unaffected.

## Backward Compatibility

Three modes of operation:

| Mode | Condition | Behavior |
|---|---|---|
| Full delegation | Deal has `delegation.signature` + Pimlico configured | Agent redeems via DelegationManager. Real onchain enforcement. |
| No delegation on deal | Deal created before this sprint | Agent uses direct EOA `writeContract()`. Existing behavior. |
| No Pimlico key | `PIMLICO_API_KEY` not set | Smart account init skipped. All deals use direct EOA path. |

## Error Handling

| Scenario | Behavior |
|---|---|
| Pimlico bundler unreachable | **Fail the operation and retry** — do not silently fall back to EOA. Brand signed a delegation expecting onchain enforcement; bypassing it is a security regression. Log error, notify chat "transaction delayed, retrying". |
| Smart account not yet deployed | Auto-deploy on first UserOperation (bundler handles initCode). |
| Caveat validation fails onchain | UserOperation reverts, agent logs failure, notifies chat with reason. |
| Brand rejects EIP-712 signature | "Delegation required to proceed" — fund button stays locked. |
| Brand signs but doesn't fund | Delegation stored but no funds in escrow — safe (nothing to release). |
| Signature validation fails server-side | 400 error, brand re-prompted to sign. |
| Deal has no delegation (pre-sprint) | Skip delegation entirely, use direct EOA — backward compatible. |

## Agent Log Entry Format

```json
{
  "timestamp": "2026-03-21T14:30:00Z",
  "type": "delegation_redemption",
  "dealId": "A1B2C3D4",
  "delegationHash": "0xabc...",
  "caveatEnforcers": ["AllowedTargets", "AllowedMethods"],
  "action": "release",
  "txHash": "0xdef...",
  "userOpHash": "0x123...",
  "delegationManager": "0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3",
  "agentSmartAccount": "0x...",
  "brandSmartAccount": "0x..."
}
```

## Dependencies

```json
{
  "@metamask/delegation-toolkit": "^4.0.0",
  "permissionless": "^0.2"
}
```

Pin to a specific major version — the toolkit API has changed between versions. `^4.0.0` is the current stable release as of March 2026.

Peer requirement: `viem ^2.31.4` — current project has `^2.47.4` (satisfies).

## Brand Smart Account Creation (Portal-Side)

When the brand connects their wallet on the payment portal, the frontend computes their counterfactual DeleGator address:

```typescript
import { toMetaMaskSmartAccount, Implementation } from "@metamask/delegation-toolkit";

// Brand's EOA is the signer behind their DeleGator
const brandSmartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Hybrid,
  deployParams: [brandEOA, [], [], []],
  deploySalt: "0x",
  signatory: { account: brandEOA }, // wagmi connected account
});

// brandSmartAccount.address is the DeleGator address used in the delegation's `from` field
// The smart account is counterfactual — no deployment tx until first use
```

This address is sent to the server alongside the signed delegation so the server knows the delegator address.

## Testing Strategy

1. `npm run build` — TypeScript compiles clean
2. Start bot with `PIMLICO_API_KEY` unset — verify graceful fallback, no crashes
3. Start bot with `PIMLICO_API_KEY` set — verify smart account initialization logs DeleGator address
4. Hit `GET /api/v1/delegation/deal/:testDealId` — returns unsigned delegation struct with correct caveats
5. Payment portal: connect wallet → sign delegation → verify signature stored via `GET /api/v1/delegation/deal/:dealId/status`
6. Trigger release on a funded deal with signed delegation → verify UserOperation submitted via Pimlico
7. Check Base Sepolia explorer for DelegationManager transaction with correct caveat enforcement
8. Trigger release on a legacy deal (no delegation) → verify direct EOA fallback works
9. Stop Pimlico (simulate outage) → verify operation fails with retry, does NOT fall back to EOA
