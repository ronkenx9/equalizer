# EQUALIZER — Agent Architecture

## Identity

**EQUALIZER** is an autonomous deal enforcement agent that lives inside Telegram and Discord group chats. It detects when two parties agree on a deal, locks payment in onchain escrow, evaluates delivery against the exact agreed terms, and releases payment automatically. No human arbiter required.

Built by a creator in Lagos, Nigeria who was ghosted after delivering real work. EQUALIZER makes trust unnecessary.

## Agent Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js + TypeScript | Core agent process |
| **Chat Interface** | Grammy.js (Telegram) + Discord.js | Listens to group conversations |
| **Deal Detection LLM** | Llama 3.3 70B via Groq | Detects deals forming in natural language |
| **Delivery Evaluation LLM** | Llama 3.3 70B via Groq | Evaluates deliverables against locked criteria |
| **Dispute Mediation LLM** | Llama 3.3 70B via Venice AI | Private, encrypted dispute mediation |
| **Onchain Escrow** | Solidity + viem (Base Sepolia) | Trustless fund custody and release |
| **Delegation** | MetaMask Delegation Toolkit + Pimlico | ERC-4337 UserOps for gasless agent actions |
| **Attestation** | Ethereum Attestation Service (EAS) | Onchain reputation records |
| **Payments** | x402 / MPP protocol | Agent-native HTTP 402 payment flow |
| **Development Harness** | Claude Code (claude-opus-4-6) | Built the entire codebase |

## How The Agent Makes Decisions

### 1. Deal Detection (Autonomous)
The agent monitors every message in a group chat. When it detects price signals, deliverable descriptions, and deadline language, it calls Groq (Llama 3.3 70B) to analyze the conversation and extract structured deal terms. No slash commands needed — it reads natural language.

### 2. Criteria Extraction (Autonomous)
When a deal is confirmed, the agent extracts measurable evaluation criteria from the conversation. These are locked onchain and shown to both parties. Only these locked criteria are used for evaluation — never stale chat history.

### 3. Escrow Funding (Human-in-the-loop)
The brand receives a payment link. They connect their wallet, optionally sign a MetaMask delegation (EIP-712), and fund the escrow contract. The agent monitors the chain for `DealCreated` events.

### 4. Delivery Evaluation (Autonomous)
When the creator says "I'm done" and provides deliverables, the agent calls Groq to evaluate the submission against the locked criteria. Each criterion gets a pass/fail with reasoning. The evaluation uses the Telegram message timestamp for deadline checks.

### 5. Approval Detection (Autonomous)
The agent uses semantic detection via Groq to identify natural approval language from the brand: "looks good", "nice", "approved", "pay them", etc. No exact phrase matching required.

### 6. Payment Release (Autonomous)
On approval (or 48-hour silence), the agent calls `release()` on the escrow contract. It first attempts delegation redemption via Pimlico bundler, falling back to direct EOA transaction if the smart account lacks gas.

### 7. Dispute Mediation (Autonomous + Private)
If the brand disputes, both parties submit evidence. The agent routes mediation through Venice AI for encrypted, private deliberation. Venice returns a ruling with percentage split, which the agent executes onchain via `rule()`.

## Smart Contract

**Escrow.sol** on Base Sepolia: `0xc7D90AD1fa90FedF26d18494228CE8AD5671E8f0`

Functions the agent can call autonomously:
- `release(dealId)` — full payment to creator
- `refund(dealId)` — full refund to brand
- `rule(dealId, creatorBps)` — split payment (dispute resolution)
- `autoRelease(dealId)` — release after 48hr silence
- `submitDelivery(dealId)` — mark delivery submitted onchain

## Delegation Framework

The agent uses MetaMask's Delegation Toolkit (ERC-7710) to act on behalf of the brand:

1. Brand signs an EIP-712 delegation scoped to 5 escrow functions only
2. Agent's DeleGator smart account (`0xFbF6c46D0A32DbD788E4E0c2F0276e0F7bd8C5c0`) redeems via Pimlico bundler
3. Caveats enforce: AllowedTargets (escrow only) + AllowedMethods (5 functions only)
4. If bundler fails (insufficient gas), falls back to direct EOA calls

## MCP Server (Agent-to-Agent)

EQUALIZER exposes an MCP server so other AI agents can create and manage deals programmatically:

| Tool | Description |
|------|-------------|
| `equalizer_create_deal` | Create an enforced deal |
| `equalizer_fund_deal` | Get x402 payment endpoint |
| `equalizer_submit_delivery` | Submit work for AI evaluation |
| `equalizer_check_deal` | Check deal status |
| `equalizer_get_reputation` | Get wallet trust score |

## Key Design Principle

EQUALIZER doesn't answer "can you trust this agent?" — it makes the question irrelevant. When terms are locked onchain before work begins, when payment is held by a contract neither party controls, when silence defaults to payment — trust becomes unnecessary.
