# EQUALIZER — Deal Enforcement Protocol
PL Genesis Submission | Fresh Code Track
AI & Robotics + Infrastructure & Digital Rights

## THE PROBLEM
Every day someone delivers work and gets ghosted. Someone pays upfront and gets nothing.

The entire agent identity space tries to solve this with credentials and registries — asking "can you trust this agent?"

**EQUALIZER asks a different question:**
*What if trust was never required?*

## THE SOLUTION
EQUALIZER is a deal enforcement protocol living where deals happen — Telegram, Discord, any DM. When a deal forms in natural language, EQUALIZER locks payment in escrow, evaluates delivery against exact agreed terms, and releases automatically.

You don't need to trust the agent.
You need to trust the math.

## ARCHITECTURE
- **Telegram + Discord adapters** (natural language)
- **Solidity escrow** on Base Sepolia + Flow EVM
- **MetaMask Delegation Framework** (scoped authority)
- **Pimlico bundler** (ERC-4337 UserOperations)
- **Groq llama-3.3-70b** (deal evaluation)
- **Venice AI** (private dispute mediation)
- **EAS attestations** (portable reputation)
- **Storacha/Filecoin** (permanent deal archival)
- **NEAR implicit account** (agent identity)
- **Lit Protocol v3 Chipotle TEE** (trustless execution)
- **x402/MPP** (agent-native payments)
- **REST API + MCP server** (agent integrations)

## SPONSOR INTEGRATIONS

### Storacha
Every completed deal archives its full artifact — chat logs, deliverables, evaluation results, tx hashes — permanently to Filecoin. CID returned and posted in chat.
Neither party can dispute what was agreed.
The record exists forever.

### Lit Protocol
Dispute mediation runs inside a Lit v3 Chipotle TEE. Private key pairs execute releases via hardware-backed enclaves.
Trustless execution. No human can interfere.

### NEAR
EQUALIZER agent has a sovereign NEAR implicit account identity linked to all autonomous actions and cross-chain operations.

### Flow
Escrow contract deployed on Flow EVM testnet (`0xF0CdE46E1c42d44aE42f9a1476afA39BA01b3A95`).
Frontend auto-detects Flow deals and prompts chain switch. Low-cost gas. Native VRF ready.

## LIVE DEPLOYMENT
- **Bot:** [@EqualizerThebot](https://t.me/EqualizerThebot) (Telegram)
- **Repo:** [github.com/ronkenx9/equalizer](https://github.com/ronkenx9/equalizer)
- **Frontend:** [eqalizer.vercel.app](https://eqalizer.vercel.app)
- **Contract (Base):** `0x7a5c38be124c78da88D4C9F5ebEf72dC41869010`
- **Contract (Flow):** `0xF0CdE46E1c42d44aE42f9a1476afA39BA01b3A95`

## THE ORIGIN
Built by a content creator in Nigeria who delivered real work for a real campaign, was publicly announced as the winner, asked for payment, and got blocked.

EQUALIZER is what should have existed.

*"You don't need to trust the agent.
You need to trust the math."*
