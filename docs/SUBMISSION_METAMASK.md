# EQUALIZER × MetaMask Delegation Framework — Bounty Submission

When you let an agent act on your behalf, the question is how precisely you can limit what it does.

## The "Unlimited Credit Card" Problem

An AI agent that holds a private key holds unlimited authority. It can drain wallets, call arbitrary contracts, sign anything. The threat model is not that the agent is malicious by design — it is that a compromised, confused, or manipulated agent with full key access becomes a full financial adversary. Unlimited authority is the vulnerability.

## EQUALIZER's Answer: Scoped Delegation via EIP-7710

EQUALIZER uses the MetaMask Delegation Framework to invert the model. The human delegator does not hand the agent a key. They grant the agent cryptographically-defined authority over a named list of functions — and nothing else.

EQUALIZER's agent wallet is delegated authority over exactly five functions on the Base Sepolia escrow contract:

| Function | Purpose |
|---|---|
| `release()` | Release escrowed funds to the creator after successful delivery |
| `refund()` | Return funds to the brand if the deal fails |
| `rule()` | Apportion funds via a split ruling after a dispute |
| `autoRelease()` | Trigger time-based automatic release when the deadline passes |
| `submitDelivery()` | Record that the creator has submitted their deliverable |

**Prohibited:** transferring ETH, deploying contracts, calling any external protocol, or interacting with any address other than the escrow contract. The prohibition is not a policy — it is a cryptographic boundary.

## The `scopeHash`

Each delegation produces a `scopeHash`: a SHA-256 digest of the JSON-serialised scope object. This hash is EIP-712-style proof that the authority described was explicitly granted by the delegator. Anyone — counterparty, auditor, another agent — can re-derive the hash from the scope and confirm it matches. No trust in EQUALIZER's assertions required.

## Inspecting the Mandate

```
GET /api/v1/delegation/status
```

Returns the full delegation proof: scope, permitted functions, contract address, chain, and `scopeHash`. Any party can inspect it before the deal begins.

```
POST /api/v1/delegation/create
```

Creates a scoped delegation tied to the caller's address. The scope is fixed — the five functions above, on the escrow contract, on Base Sepolia. No other configuration is accepted.

See `DELEGATION.md` for the full design rationale.
