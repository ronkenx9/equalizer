# EQUALIZER

**An AI agent that evaluates work and pays people.** Internet handshakes finally mean something.

*Bot is live 24/7 at @equalizer_agent_bot*  
*Deployed on Railway, auto-deploys from main branch*

EQUALIZER is an AI agent that lives in Telegram group chats. It detects deals forming in natural conversation, guides the brand to lock ETH in onchain escrow, autonomously evaluates delivery using Claude, and makes binding payment decisions — releasing, refunding, or splitting funds based on its own AI judgment. No human approval needed. Silence = satisfied.

## Why This Matters

Every day, millions of informal deals happen in group chats: "I'll design your logo for $50," "Send me 0.1 ETH and I'll write the thread." Most of these deals rely on trust alone. EQUALIZER replaces trust with an autonomous agent that:

- **Locks funds** — Brand deposits ETH directly into the escrow contract. From that moment, no human touches the money again.
- **Evaluates delivery** against the original deal terms using AI
- **Makes payment decisions** autonomously — release, refund, or split
- **Creates permanent records** via onchain attestations

The brand puts the money in. The agent decides what happens to it.

## How It Works

```
1. Two people agree on a deal in chat
2. EQUALIZER detects it → surfaces a deal card with terms
3. Both parties confirm → agent locks ETH in onchain escrow
4. Creator delivers → agent evaluates delivery against terms (Claude AI)
5. Dispute window starts (24 hours)
6. No dispute? Agent auto-releases payment. Dispute? Agent mediates and splits funds.
7. EAS attestation minted → permanent onchain receipt
```

## The Key Mechanic

**`autoRelease()` is permissionless.** After the dispute window closes, *anyone* can trigger the release. No human needed. No approval bottleneck. Silence = release.

This flips the default: instead of requiring action to pay, it requires action to *not* pay. The system assumes satisfaction unless someone speaks up.

## Agent Architecture

The brand locks funds in the escrow contract. From that moment, the AI agent (arbiter) controls the money:

```
Brand sends ETH → Escrow Contract ← Agent decides: release / refund / split
                                   ← Agent evaluates delivery
                                   ← Agent mediates disputes
                                   ← autoRelease() if silence (permissionless)
```

**The separation is clean:**
- **Brand** deposits ETH directly into the contract (their wallet, their transaction)
- **Agent** acts as arbiter — evaluates, mediates, executes rulings on-chain
- **Contract** holds funds — neither the brand nor the agent can bypass the escrow logic
- **autoRelease** is permissionless — if the agent goes down, silence still releases payment

The `/fund` command exists as a demo shortcut where the agent funds on behalf of the brand (for hackathon demos where testnet ETH friction matters). In production, brands deposit directly.

## The AI Does Real Work

EQUALIZER uses Claude (claude-sonnet-4-6) for three distinct AI tasks — none of which are simple wrappers:

### 1. Intent Detection
The agent reads conversation context (last 20 messages) and identifies when a deal is forming. It extracts structured terms: deliverable, price, deadline, who's paying, who's delivering. Only triggers above 80% confidence. This is genuine NLU, not keyword matching.

### 2. Delivery Evaluation
When a creator submits work, the agent evaluates it against the original deal terms. It assesses completeness, quality relative to what was agreed, and flags specific shortcomings. The evaluation determines whether the dispute window starts clean or flagged.

### 3. Dispute Mediation
When a brand disputes, both parties submit evidence. The agent reads everything — original terms, delivered work, brand's complaint, creator's defense — and issues a binding ruling: full release, full refund, or percentage split. The ruling is executed on-chain immediately.

**The agent makes financial decisions.** A hallucinating response could execute an unfair split. A bad evaluation could release funds for incomplete work. This is real consequential AI — exactly what "Agents that Pay" means.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              EQUALIZER Agent                     │
│          (Grammy.js + TypeScript)                │
│                                                  │
│  ┌─────────────┐ ┌──────────────┐ ┌───────────┐ │
│  │   Intent    │ │   Delivery   │ │  Dispute  │ │
│  │  Detection  │ │  Evaluation  │ │ Mediation │ │
│  │ (Claude AI) │ │ (Claude AI)  │ │(Claude AI)│ │
│  └──────┬──────┘ └──────┬───────┘ └─────┬─────┘ │
│         │               │               │       │
│  ┌──────▼───────────────▼───────────────▼─────┐ │
│  │           Agent Wallet (Arbiter)            │ │
│  │  Holds funds · Executes rulings · Signs tx  │ │
│  └──────────────────┬──────────────────────────┘ │
└─────────────────────┼───────────────────────────┘
                      │
         ┌────────────▼────────────┐
         │    Escrow Contract      │
         │   (Base Sepolia)        │
         │  createDeal · release   │
         │  refund · rule · auto   │
         └────────────┬────────────┘
                      │
         ┌────────────▼────────────┐
         │   EAS Attestations      │
         │  (Onchain deal receipts)│
         └─────────────────────────┘
```

## Commands

| Command | Who | What |
|---------|-----|------|
| `/start` | Anyone | Welcome + explainer |
| `/help` | Anyone | Command reference |
| `/deal @user 0.05ETH "deliverable" by March 20` | Brand | Create deal manually |
| `/wallet 0x...` | Anyone | Link ETH address |
| `/submit <url or description>` | Creator | Submit delivery for AI evaluation |
| `/dispute` | Brand | Raise dispute during review window |
| `/fund <dealId>` | Brand | Demo: agent funds on your behalf |
| `/status` | Anyone | View active deals |

## Smart Contract

**Escrow.sol** — Factory-pattern single contract managing all deals.

- **Address:** [`0x7a5c38be124c78da88D4C9F5ebEf72dC41869010`](https://sepolia.basescan.org/address/0x7a5c38be124c78da88D4C9F5ebEf72dC41869010)
- **Network:** Base Sepolia (Chain ID: 84532)
- **Arbiter:** Agent wallet (`0x4ECb9254a0bd6fEf749B8B8ab56812Bc44Ee0220`)
- **Platform Fee:** 2.5% (250 bps) — deducted on creator payouts only. No fee on refunds or cancellations.
- **Tests:** 22/22 passing (Hardhat)
- **Security:** OpenZeppelin ReentrancyGuard, immutable arbiter, access-controlled functions, max 10% fee cap hardcoded

### Deal Lifecycle

```
Created → DeliverySubmitted → [DisputeWindow] → Completed (auto-release)
                                    │
                                    └→ Disputed → Ruled (split/release/refund)

Cancelled ← Created (brand can cancel before delivery)
```

### Key Functions

| Function | Access | Description |
|----------|--------|-------------|
| `createDeal()` | Anyone (payable) | Deposit ETH, set creator + deadline + terms |
| `submitDelivery()` | Creator/Arbiter | Mark delivered, start dispute window |
| `autoRelease()` | **Permissionless** | Anyone calls after window → pays creator (minus fee) |
| `dispute()` | Brand only | Flag during window |
| `rule(dealId, bps)` | Arbiter only | Split funds (0-10000 basis points), fee on creator share |
| `release()` / `refund()` | Arbiter only | Full release (minus fee) or full refund (no fee) |
| `cancelDeal()` | Brand only | Cancel before delivery, full refund (no fee) |
| `setFeeBps()` | Arbiter only | Update platform fee (max 10%) |
| `setFeeRecipient()` | Arbiter only | Update fee treasury address |

## Tech Stack

- **Runtime:** TypeScript, Grammy.js (Telegram), Node.js
- **AI:** Claude API (claude-sonnet-4-6) — 3 specialized prompt chains
- **Chain:** Solidity 0.8.24, Hardhat, Viem, Base Sepolia
- **Attestations:** EAS (Ethereum Attestation Service) via Viem
- **Contract Security:** OpenZeppelin ReentrancyGuard

## Setup

```bash
git clone https://github.com/ronkenx9/equalizer
cd equalizer

# Bot
cd bot && npm install

# Contracts
cd ../contracts && npm install

# Configure
cp .env.example .env
# Fill in: TELEGRAM_BOT_TOKEN, CLAUDE_API_KEY, AGENT_PRIVATE_KEY

# Deploy (needs Base Sepolia ETH)
cd contracts && npx hardhat run scripts/deploy.ts --network baseSepolia

# Run
cd ../bot && npm run dev
```

## Hackathon

Built for **Synthesis Hackathon** and **PL Genesis**.

### Track Alignment

| Track | How EQUALIZER Fits |
|-------|-------------------|
| **Agents that Pay** (primary) | Agent holds wallet, makes autonomous payment decisions, executes conditional payments based on AI evaluation, creates auditable onchain tx history |
| **Agents that Trust** (secondary) | EAS attestations = portable onchain reputation. Every completed deal mints a permanent record. |
| **Agents that Cooperate** (tertiary) | Smart contract = neutral enforcement layer. Agent mediates between parties. Immutable deal execution. |

### Onchain Artifacts

- Escrow contract (v2 with fees): [`0x7a5c38be...`](https://sepolia.basescan.org/address/0x7a5c38be124c78da88D4C9F5ebEf72dC41869010)
- Agent wallet: `0x4ECb9254a0bd6fEf749B8B8ab56812Bc44Ee0220`
- Synthesis registration: [`0x56c1d3c0...`](https://basescan.org/tx/0x56c1d3c078b8fd71732b117441c03f1920e1e0e7553b7e692577726993b69664)
- EAS attestations: Minted per completed deal on Base Sepolia

## License

MIT
