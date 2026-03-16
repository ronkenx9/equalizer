# EQUALIZER

**AI-powered deal enforcement for Telegram.** Internet handshakes finally mean something.

EQUALIZER lives in your Telegram conversations, detects when deals are forming, locks payment in onchain escrow, evaluates delivery with AI, and auto-releases payment when no one disputes. Silence = satisfied.

## How It Works

```
1. Two people agree on a deal in chat
2. EQUALIZER detects it → surfaces a deal card
3. Both parties confirm → ETH locked in escrow
4. Creator delivers → AI evaluates against terms
5. 24-hour dispute window starts
6. No dispute? Payment auto-releases. Dispute? AI mediates and splits funds.
7. EAS attestation minted → portable onchain reputation
```

## The Key Mechanic

**`autoRelease()` is permissionless.** After the dispute window closes, *anyone* can trigger the release. No human needed. No approval bottleneck. Silence = release.

This flips the default: instead of requiring action to pay, it requires action to *not* pay. The person receiving the work doesn't need to do anything — the system assumes satisfaction unless they speak up.

## Architecture

```
┌──────────────────────────────────────────────┐
│                 Telegram Bot                  │
│            (Grammy.js + TypeScript)           │
├──────────────┬───────────────┬───────────────┤
│  Intent      │  Delivery     │  Dispute      │
│  Detection   │  Evaluation   │  Mediation    │
│  (Claude AI) │  (Claude AI)  │  (Claude AI)  │
├──────────────┴───────────────┴───────────────┤
│              Escrow Contract                  │
│         (Solidity on Base Sepolia)            │
│  createDeal │ submitDelivery │ autoRelease    │
│  dispute    │ rule           │ refund         │
├──────────────────────────────────────────────┤
│           EAS Attestations                    │
│     (Onchain deal receipts on Base)           │
└──────────────────────────────────────────────┘
```

## Commands

| Command | Who | What |
|---------|-----|------|
| `/start` | Anyone | Welcome message |
| `/help` | Anyone | List all commands |
| `/deal @user 0.05ETH "deliverable" by March 20` | Brand | Create a deal manually |
| `/wallet 0x...` | Anyone | Link your ETH address |
| `/submit <url or description>` | Creator | Submit delivery for evaluation |
| `/dispute` | Brand | Raise dispute during review window |
| `/status` | Anyone | View active deals in this chat |

## Smart Contract

**Escrow.sol** — Factory-pattern single contract managing all deals.

- **Address:** `0x02a51207f114b47DED4fa1597639344747eb4b4D`
- **Network:** Base Sepolia (Chain ID: 84532)
- **Explorer:** [View on BaseScan](https://sepolia.basescan.org/address/0x02a51207f114b47DED4fa1597639344747eb4b4D)

### Deal Lifecycle

```
Created → DeliverySubmitted → [DisputeWindow] → Completed
                                    │
                                    └→ Disputed → Ruled (split/release/refund)
```

### Key Functions

- `createDeal()` — Brand deposits ETH, sets creator + deadline + terms hash
- `submitDelivery()` — Creator/arbiter marks delivery, starts dispute window
- `autoRelease()` — **Permissionless.** Anyone calls after window closes → pays creator
- `dispute()` — Brand flags during window
- `rule(dealId, creatorBps)` — Arbiter splits funds (basis points: 0-10000)
- `release()` / `refund()` — Arbiter full release or refund

### Security

- OpenZeppelin `ReentrancyGuard` on all fund-moving functions
- 18/18 tests passing (Hardhat)
- Arbiter is immutable (set at construction)

## Tech Stack

- **Bot:** TypeScript, Grammy.js, Claude API (claude-sonnet-4-6)
- **Chain:** Solidity 0.8.24, Hardhat, Viem, Base Sepolia
- **AI:** Intent detection, delivery evaluation, dispute mediation (3 specialized prompts)
- **Attestations:** EAS (Ethereum Attestation Service) via Viem

## Setup

```bash
# Clone
git clone https://github.com/user/equalizer
cd equalizer

# Install
cd bot && npm install
cd ../contracts && npm install

# Configure
cp .env.example .env
# Fill in: TELEGRAM_BOT_TOKEN, CLAUDE_API_KEY, AGENT_PRIVATE_KEY

# Deploy contract (needs Base Sepolia ETH)
cd contracts && npx hardhat run scripts/deploy.ts --network baseSepolia

# Run bot
cd bot && npm run dev
```

## Environment Variables

```
TELEGRAM_BOT_TOKEN=         # From @BotFather
CLAUDE_API_KEY=             # Anthropic API key
BASE_TESTNET_RPC=           # Base Sepolia RPC (default: https://sepolia.base.org)
AGENT_PRIVATE_KEY=          # Agent wallet (becomes arbiter)
ESCROW_CONTRACT_ADDRESS=    # After deployment
EAS_CONTRACT_ADDRESS=       # Base Sepolia EAS (default provided)
DISPUTE_WINDOW_SECONDS=     # Default: 86400 (24 hours), use 120 for testing
```

## Testing

```bash
# Contract tests
cd contracts && npx hardhat test

# Bot (manual — interact via Telegram)
cd bot && npm run dev
```

## Hackathon

Built for [Synthesis Hackathon](https://synthesis.md) and PL Genesis.

**Tracks:**
- **Agents that Pay** (primary) — Scoped spending, onchain escrow, conditional payments
- **Agents that Trust** (secondary) — EAS attestations = portable onchain reputation
- **Agents that Cooperate** (tertiary) — Smart contract = neutral enforcement layer

## License

MIT
