# EQUALIZER — MetaMask Delegation Toolkit Integration

## The Problem: Agents With Unlimited Wallet Access

When an AI agent holds a private key, it holds unlimited power. It can drain wallets, sign arbitrary transactions, interact with any contract on any chain. This is the "agent with unlimited credit card" problem — once you hand the keys over, there is no programmatic boundary on what the agent can do.

## The Solution: Onchain Delegation via MetaMask Delegation Toolkit

EQUALIZER uses the **MetaMask Delegation Toolkit** (`@metamask/delegation-toolkit`) for real onchain delegation enforcement. Instead of trusting the agent to self-limit, brands sign **EIP-712 delegations** that are validated and enforced by the **DelegationManager** smart contract on Base Sepolia.

### How It Works

1. **Brand connects wallet** — EOA connects via RainbowKit in the payment portal
2. **Brand signs delegation** — Free offchain EIP-712 signature granting the agent scoped authority
3. **Brand funds escrow** — Standard token transfer to the escrow contract
4. **Agent redeems delegation** — When the agent needs to act (release, refund, rule), it redeems the delegation through the DelegationManager via a Pimlico bundler as a UserOperation

### Key Architecture

- **Agent wallet** = Hybrid DeleGator smart account (ERC-4337)
- **Brand wallet** = EOA with counterfactual DeleGator (auto-deployed atomically during first redemption via `accountMeta`)
- **Caveat enforcers** = Onchain contracts that validate delegation scope at redemption time
- **Pimlico bundler** = ERC-4337 bundler service for Base Sepolia (submits UserOperations)

## Delegation Scope

Each deal delegation is constrained by two onchain caveat enforcers:

### AllowedTargetsEnforcer (`0x7F20f61b1f09b08D970938F6fa563634d65c4EeB`)

Restricts the delegation to only call the escrow contract. The agent cannot interact with any other contract.

### AllowedMethodsEnforcer (`0x2c21fD0Cb9DC8445CB3fb0DC5E7Bb0Aca01842B5`)

Restricts the delegation to exactly five function selectors:

| Function | Purpose |
|---|---|
| `release(bytes32)` | Release escrowed funds to the creator after delivery |
| `refund(bytes32)` | Return funds to the brand if the deal fails |
| `rule(bytes32,uint256)` | Split ruling after a dispute |
| `autoRelease(bytes32)` | Time-based automatic release |
| `submitDelivery(bytes32)` | Record creator's deliverable submission |

**Prohibited:** All other onchain actions — the DelegationManager contract reverts if the agent tries anything outside scope.

## Contract Addresses (Base Sepolia)

| Contract | Address |
|---|---|
| Escrow | `0xc7D90AD1fa90FedF26d18494228CE8AD5671E8f0` |
| Agent DeleGator | `0xFbF6c46D0A32DbD788E4E0c2F0276e0F7bd8C5c0` |
| Agent EOA | `0x4ECb9254a0bd6fEf749B8B8ab56812Bc44Ee0220` |
| DelegationManager | `0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3` |
| AllowedTargetsEnforcer | `0x7F20f61b1f09b08D970938F6fa563634d65c4EeB` |
| AllowedMethodsEnforcer | `0x2c21fD0Cb9DC8445CB3fb0DC5E7Bb0Aca01842B5` |

## API Endpoints

### `GET /api/v1/delegation/deal/:dealId?brandSmartAccount=0x...`

Returns the unsigned delegation struct for the brand to sign. Includes caveats, agent smart account address, and accountMeta for counterfactual deployment.

### `POST /api/v1/delegation/sign`

Stores the brand's EIP-712 signature. Body: `{ dealId, signature, delegation, brandEOA, brandSmartAccount, accountMeta }`.

### `GET /api/v1/delegation/deal/:dealId/status`

Returns whether a deal has a signed delegation, the delegation hash, and signing timestamp.

### `GET /api/v1/delegation/status`

Returns the agent's local fast-path delegation scope (legacy endpoint, still active).

## Backward Compatibility

Deals created before delegation integration (no `delegation` field) fall back to direct EOA execution. The 5 write functions in `chain.ts` check `hasDelegation(dealId)` — if true, redeem via bundler; if false, use direct `writeContract`. Zero regression on existing flows.

## Payment Portal Flow

The RainbowKit payment portal enforces a sequential 3-step flow:

1. **Connect Wallet** — RainbowKit wallet connection
2. **Sign Delegation** — DelegationStep component presents scope summary, brand signs EIP-712 typed data
3. **Fund Escrow** — Pay button unlocks only after delegation is signed

Each step gates the next. The brand cannot fund without signing delegation first.

## Runtime Enforcement

Enforcement happens at two levels:

1. **Local fast-path** — `verifyDelegation()` checks function name against allowed list before any execution attempt
2. **Onchain** — DelegationManager contract validates the EIP-712 signature and caveat enforcers at redemption time. If caveats fail, the transaction reverts onchain.

This is not a trust model — it is cryptographic enforcement. The agent literally cannot execute functions outside its delegated scope.
