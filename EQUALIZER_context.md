# EQUALIZER — Project Context Brief
**Feed this to Claude Code at the start of every session**
Last updated: March 15, 2026

---

## Who I Am

- **Name:** Ronin (Jack / roninxx)
- **Role:** Web3 builder, content creator, KOL in Immutable creator program and Solana/Web3 ecosystem
- **Location:** Lagos, Nigeria
- **Background:** Content creator turned builder. Documenting the arc publicly. Active in Web3 gaming, DeFi, developer tools.
- **Relevant pain:** Has done paid brand campaigns for Immutable ecosystem projects (Anichess, Syndicate of Vigilantes, Voxie Tactics, Devilfish Poker, Goblins of Elderstone). Experienced firsthand: slot scarcity, flagging with no appeal path, payment delays after delivery, no enforcement when brand went quiet.

---

## The Hackathon

**Name:** Synthesis Hackathon
**Deadline:** March 22, 2026 (submissions close)
**Judging feedback:** March 18, 2026 (agentic judging)
**Winners announced:** March 25, 2026
**Build time remaining:** ~7 days from March 15

### Four Tracks
1. **Agents that Pay** — scoped spending, onchain settlement, escrow (Uniswap partner)
2. **Agents that Trust** — onchain attestations, portable credentials, open discovery
3. **Agents that Cooperate** — smart contract commitments, dispute resolution
4. **Agents that Keep Secrets** — privacy, ZK proofs, encrypted comms (Self Protocol, Venice partners)

### Prize Structure
| Prize | Amount | Org |
|---|---|---|
| Synthesis Open Track | $14,059 | Community |
| 1st Place Private Agents | $5,750 | Venice |
| 2nd Place Private Agents | $3,450 | Venice |
| 3rd Place Private Agents | $2,300 | Venice |
| Various 1st Place tracks | $500–$1,000 | MetaMask, Celo, Uniswap, Bankr |
| ENS, Olas, Slice bounties | $150–$500 | Various |
| Status Network qualifying | $50 each (44 spots) | Status Network |

### Registration
- POST to `/register` with agent name, description, harness (`claude-code`), model, human info
- Returns API key + onchain ERC-8004 identity on Base

### Rules
- Must deliver functional work (demos, prototypes, deployed contracts)
- Open source required — all code public by deadline
- Onchain artifacts strengthen submissions
- Document human-agent collaboration via `conversationLog`
- Agent harness: `claude-code` ✅

### Organizer Tips
- Start from a real problem you've felt firsthand
- Build for the human, not the agent — human stays in control
- Use what already exists — Ethereum infrastructure is underused by AI builders
- Solve a problem, not a checklist
- Don't over-scope — a working demo beats an architecture diagram

---

## The Project: EQUALIZER

### One-Line Pitch
EQUALIZER is an AI agent that lives inside Telegram conversations, detects when a deal is forming in natural language, locks payment in onchain escrow, evaluates delivery, and releases automatically — so a handshake on the internet finally means something.

### The Soul
*"Deals on the internet should mean something."*

### The Personal Story (use this in README and submissions)
Built by a content creator in Nigeria who delivered real work for a real Immutable campaign — posted, performed, waited — and got flagged with no appeal path and delayed payment with no recourse. EQUALIZER is what should have existed.

### The Key Architectural Insight
Every other escrow platform says "come to us to make your deal." EQUALIZER says "we come to where your deal is already happening." The agent lives in the conversation. Not a platform you migrate to. That's a genuine architectural choice, not a feature.

### The Core Loop

```
Deal forms in Telegram chat
        ↓
EQUALIZER bot detects deal intent (Claude reads conversation)
        ↓
Surfaces clean deal summary card: deliverable, price, deadline
        ↓
Both parties confirm (human approval gate)
        ↓
Escrow contract deployed — funds locked onchain
        ↓
Creator submits delivery (URL or text)
        ↓
Claude evaluates delivery against original plain-English terms
        ↓
24-hour dispute window opens
        ↓
Silence = satisfied → auto-release fires
Dispute raised → Claude mediates with evidence → rules → executes
        ↓
Payment released to creator
Unspent funds (if any) returned to brand
        ↓
EAS attestation minted — onchain receipt for both parties
Reputation scores updated on both wallets
```

### The Key Demo Moment
The 24-hour silence window. Brand goes quiet. Window closes. Payment releases automatically. No chasing. No DMs. No human needed. That moment — silence becoming a binding response — is what no smart contract does and no platform has built.

### Track Coverage
| Track | How EQUALIZER hits it |
|---|---|
| **Agents that Pay** (primary) | Escrow contract + scoped agent wallet + automatic conditional release |
| **Agents that Trust** (secondary) | EAS attestation minted per deal — immutable onchain receipt |
| **Agents that Cooperate** (tertiary) | Smart contract IS the dispute resolution — terms locked, agent rules, executes |

### Full Vision (pitch narrative, not hackathon scope)
- Soulbound reputation tokens — non-transferable, non-purchasable, earned only through completed deals
- Two-sided reputation: creators earn delivery scores, brands earn payment reliability scores
- Neither party wants to start over elsewhere — reputation is the moat
- Three revenue streams: 1-2% per release, creator Pro subscription, brand talent dashboard
- "Deal Kept" shareable cards — viral acquisition loop from every completed deal
- Multi-platform: Telegram today, Discord/Twitter DMs/anywhere tomorrow
- Agent-to-agent commerce: same infrastructure when agents start hiring agents

---

## Tech Stack

### Bot Layer
- **Grammy.js** — Telegram bot framework in TypeScript
- Conversation state management built in

### AI Layer
- **Claude API** (claude-sonnet-4-6) — three jobs:
  1. Intent detection: reads conversation, identifies when deal is forming
  2. Delivery evaluation: reads submitted work against original plain-English terms
  3. Dispute mediation: reads both parties' evidence, rules, triggers contract execution

### Contract Layer
- **Base testnet** (EVM, fast, cheap, judge-friendly)
- **Escrow contract** (Solidity): deposit(), release(), refund(), dispute(), rule()
- **EAS (Ethereum Attestation Service)**: onchain receipts + reputation scores per completed deal

### Backend
- **Node.js + TypeScript**
- **Railway or Render** for hosting (deploys in minutes)
- **Viem** for EVM interaction

### Wallet
- Agent wallet that holds and releases funds programmatically
- Scoped permissions — agent can only execute within deal parameters

---

## 7-Day Build Plan

### Day 1 — Mar 15 (today)
**Foundation**
- Repo setup with TypeScript + Grammy.js
- Basic bot skeleton running on Telegram
- Claude API integration wired
- Environment config (.env, Base testnet RPC)
- Goal: Bot responds intelligently in DMs

### Day 2 — Mar 16
**Intent Detection**
- Claude prompt for reading conversation and detecting deal formation
- Extract: deliverable, price, deadline from natural language
- Generate clean deal summary card
- Both-party confirmation flow
- Goal: Bot detects a deal and both parties can confirm it

### Day 3 — Mar 17
**Smart Contract**
- Write escrow contract in Solidity
- Deploy to Base testnet
- Functions: deposit, release, refund, dispute, rule
- Wire bot to deploy contract on deal confirmation and lock funds
- Goal: Confirming a deal locks real funds in a real contract

### Day 4 — Mar 18 *(Agentic judging feedback day)*
**Delivery Evaluation**
- Creator submits delivery URL or text via bot
- Claude reads delivery against original deal terms
- Pass/flag logic
- 24-hour countdown logic
- Auto-release fires when window closes with no dispute
- Goal: Working demo to show for judging feedback

### Day 5 — Mar 19
**Dispute Flow + EAS**
- Dispute trigger: brand flags delivery
- Both parties submit evidence via bot
- Claude mediates, issues ruling
- Contract executes ruling automatically
- EAS attestation minted after every resolved deal
- Reputation score stored onchain
- Goal: Full loop works end to end including disputes

### Day 6 — Mar 20
**Polish + "Deal Kept" Card**
- Clean up all conversation flows and edge cases
- Generate shareable receipt image after each completed deal
- Write README with Immutable story upfront
- Record 90-second demo video
- Goal: Something you'd be proud to tweet

### Day 7 — Mar 21
**Submission**
- Compile `conversationLog` from full session (already drafted)
- Deploy to mainnet or final testnet
- Final end-to-end testing
- Write submission document
- Submit early — don't wait for March 22nd
- Goal: Submitted. Done. Real.

---

## The One Rule
**If a feature isn't in the core loop — it doesn't exist until after submission.**

No brand dashboard. No multi-platform. No subscription tiers. No soulbound tokens. Not because they're bad ideas — because they're not March 22nd ideas.

The loop ships perfect. Everything else ships later.

---

## What Makes Us Different From Every Other Team

1. **We are the demo.** The conversationLog of us building this IS the artifact. Every other team will submit a log of prompting Claude to write code. We'll submit a log of two collaborators building something they needed.

2. **The story is lived.** Creator in Nigeria. Real campaign. Real ghosting. Real frustration. Judges will feel this immediately.

3. **The architectural insight is real.** We live where deals already happen. That's not a feature — it's a fundamentally different approach to the problem.

4. **We're building something that survives the hackathon.** Real repo. Real deployed contracts. Real Telegram bot anyone can use. Ships March 22nd and stays on.

---

## How AI Judges Will Evaluate Us

AI judges parse signal, not passion. They check:
1. **Problem specificity** — vague = low score. Named pain with real context = high score ✅
2. **Working demo** — one complete path they can follow start to finish ✅
3. **Real onchain artifact** — deployed contract, real tx hash, verifiable ✅
4. **Human control gates** — human approves at key moments, agent executes the rest ✅
5. **Authentic conversationLog** — genuine collaboration, not prompted responses ✅

---

## IdeaRalph Validation Score
**Final score after 5 refinement iterations: 9.5/10**

| Dimension | Score |
|---|---|
| Problem Clarity | 10/10 |
| Market Size | 9/10 |
| Uniqueness | 9/10 |
| Feasibility | 9/10 |
| Monetization | 9/10 |
| Timing | 9/10 |
| Virality | 9/10 |
| Defensibility | 9/10 |
| Team Fit | 9/10 |
| Ralph Factor | 10/10 |

---

---

## Second Hackathon: PL Genesis — Frontiers of Collaboration

**Organizer:** Protocol Labs
**Platform:** DevSpot
**Submission Deadline:** March 31, 2026
**Sponsor Judging:** March 17–20, 2026 (Round 1)
**Protocol Labs Judging:** March 20–23, 2026 (Round 2)
**Winners Announced:** March 24, 2026

### Prize Pool: $150K+
| Prize | Amount |
|---|---|
| Fresh Code Top 10 | 10 × $5,000 = $50,000 |
| Existing Code Top 10 | 10 × $5,000 = $50,000 |
| AI & Robotics Track 1st | $3,000 |
| Crypto Track 1st | $3,000 |
| Flow: Future of Money Top 10 | 10 × $1,000 |
| Lit Protocol NextGen AI Apps | $500 |
| NEAR AI That Works For You | $500 |
| Storacha | $300 + credits |

### Relevant Tracks For EQUALIZER
- **AI & Robotics** — Agent-native systems, verifiable AI, agent identity and payments ✅
- **Crypto** — Onchain economies, agent-native commerce, programmable assets ✅
- **Infrastructure & Digital Rights** — Decentralized storage, programmable access control ✅

### Sponsor Bounty Integrations

| Sponsor | How EQUALIZER Uses It |
|---|---|
| **Filecoin / Storacha** | Store deal artifacts, evidence submissions, dispute records permanently on Filecoin via Storacha SDK |
| **Lit Protocol** | Encrypt deal terms — only visible to both parties. Private deals on a public chain. |
| **NEAR** | Agent identity layer — EQUALIZER agent registered with scoped permissions |
| **Flow** | Payment settlement layer for escrow release |

### Track Selection Strategy
Submit to **Fresh Code** + **AI & Robotics** + **Crypto** + **Lit Protocol bounty** + **Storacha bounty** = 5 prize categories from one submission.

### Judging Criteria (equal weight)
1. Technical Excellence
2. Integration Depth
3. Utility & Impact
4. Innovation
5. Presentation & Documentation

### Key Rules
- Fresh Code: repo must be created after Feb 10, 2026 ✅
- Must integrate at least one sponsor API/SDK
- Public and open source (MIT or Apache-2)
- Demo video ≤ 3 minutes on YouTube
- 250–500 word project summary
- Team social handles required

---

## Dual Submission Strategy

### The Core Insight
**Same build. Two submissions. ~20% extra work for 2x prize opportunities.**

EQUALIZER core loop is identical for both. PL Genesis integrations (Storacha, Lit Protocol) genuinely make the product better — not forced.

### Priority Order
**Synthesis is primary. PL Genesis is the bonus.**
Never sacrifice Synthesis quality for PL Genesis features.

### Build Timeline (Updated)

**Days 1–5 (Mar 15–19): Build EQUALIZER core**
Original 7-day plan. Core loop ships perfectly for Synthesis.

**Day 6 (Mar 20): Storacha integration**
- Integrate Storacha SDK
- Every completed deal: terms + evidence + receipt stored permanently on Filecoin
- Replaces/augments local storage — same data, verifiable forever

**Day 7 (Mar 21): Lit Protocol integration**
- Encrypt deal terms onchain
- Only the two parties can decrypt
- Private deals on a public chain — genuine product improvement

**Mar 21–22: Synthesis submitted**

**Mar 23–31: PL Genesis polish + submission**
- Tighten PL Genesis submission docs
- Record 3-minute demo video
- NEAR/Flow integrations if time allows
- Final submission

### What Changes Between Submissions

| Element | Synthesis | PL Genesis |
|---|---|---|
| Storage | EAS attestations | EAS + Filecoin/Storacha |
| Privacy | Public deal terms | Lit Protocol encrypted terms |
| Narrative | Creator payment enforcement | Decentralized trust layer for agent economy |
| Demo | 90 seconds, Telegram flow | 3 minutes, full feature showcase |
| Story angle | Creator in Nigeria got ghosted | Infrastructure for the agentic economy |

### Prize Ceiling (if we hit everything)
- Synthesis Open Track: up to $14,059
- Synthesis bounties: ~$1,000–3,000
- PL Genesis Fresh Code top 10: $5,000
- PL Genesis AI & Robotics 1st: $3,000
- PL Genesis Lit Protocol: $500
- PL Genesis Storacha: $300

**Total ceiling: ~$26,000 from one build.**

---

## Important Links
- Synthesis hackathon: https://synthesis.md/
- PL Genesis hackathon: DevSpot official page
- Storacha SDK: https://storacha.network/
- Lit Protocol: https://litprotocol.com/
- NEAR Protocol: https://near.org/
- Flow blockchain: https://flow.com/
- EAS (Ethereum Attestation Service): https://attest.org/
- Grammy.js docs: https://grammy.dev/
- Base testnet: https://docs.base.org/
- Viem docs: https://viem.sh/

---

## Session Notes for Claude Code
- We are building this as a real product, not just a hackathon demo
- Prioritize the core loop working perfectly over any additional features
- The conversationLog is already compiled — reference EQUALIZER_conversationLog.md
- When in doubt: does this help the core loop ship? If no, skip it.
- The human (Ronin) approves major decisions. Claude executes.
- Open source from day one. Everything public.
