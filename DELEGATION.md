# EQUALIZER — MetaMask Delegation Framework

## The Problem: Agents With Unlimited Wallet Access

When an AI agent holds a private key, it holds unlimited power. It can drain wallets, sign arbitrary transactions, interact with any contract on any chain. This is the "agent with unlimited credit card" problem — once you hand the keys over, there is no programmatic boundary on what the agent can do. A compromised agent becomes an adversary with full financial access.

## The Solution: Scoped Delegation via EIP-7710

The MetaMask Delegation Framework changes the model. Instead of giving the agent a raw private key and trusting it to self-limit, a human **delegator** explicitly grants a **delegatee** (the agent) a cryptographically-defined scope of authority. The delegation is:

- **Specific** — only named functions are permitted
- **Bound** — locked to a single contract address on a single chain
- **Verifiable** — the scope is hashed (EIP-712 style) so any party can confirm the exact permissions granted
- **Revocable** — the human can issue a new delegation at any time

## EQUALIZER's Delegation Scope

EQUALIZER's agent wallet is delegated authority over exactly five functions on the Base Sepolia escrow contract:

| Function | Purpose |
|---|---|
| `release` | Release escrowed funds to the creator after successful delivery |
| `refund` | Return funds to the brand if the deal fails |
| `rule` | Apportion funds via a split ruling after a dispute |
| `autoRelease` | Trigger time-based automatic release when deadline passes |
| `submitDelivery` | Record that the creator has submitted their deliverable |

**Prohibited:** All other on-chain actions — including transferring ETH, deploying contracts, calling any external protocol, or interacting with any address other than the escrow contract.

## The Proof

Each delegation produces a `scopeHash`: a SHA-256 digest of the JSON-serialised scope object. This hash is the verifiable evidence that authority was explicitly granted. Anyone can re-hash the scope and confirm it matches — no trust in EQUALIZER's assertions required.

The delegation proof is exposed publicly at `GET /api/v1/delegation/status` so counterparties and auditors can inspect the agent's authority before a deal begins.

## The Mandate

> "The human grants EQUALIZER exactly the authority it needs to enforce deals. Nothing more. The delegation is provable. The agent cannot exceed its mandate even if compromised."

This is not a workaround — it is the correct architecture for agentic finance. Authority should be minimal, explicit, and auditable. EQUALIZER enforces that principle at the protocol level.
