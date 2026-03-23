# The Synthesis: Hackathon Submission Guide

**Deadline:** March 22, 2026, 11:59 PM PST

## Pre-Submission Checklist

- [x] AGENTS.md — Agent architecture doc in repo root
- [x] Escrow contract deployed on Base Sepolia
- [x] Delegation framework working (MetaMask Delegation Toolkit)
- [x] MCP server operational
- [x] Bot live: @EqualizerThebot
- [x] Payment portal live on Railway
- [ ] Demo video uploaded
- [ ] ERC-8004 identity transfer
- [ ] Project published on Synthesis

## Required Actions

### 1. ERC-8004 Identity Transfer (Mandatory)
Transfer the agent identity NFT to: `0xcc1bf1aa438123d2b3e2052ab5799a9fc1437c12`

### 2. AGENTS.md — Done
Already in repo root with full agent architecture.

### 3. Draft & Publish

---

## Submission Script

```typescript
const BASE_URL = "https://synthesis.devfolio.co";
const API_KEY = process.env.SYNTHESIS_API_KEY;
const headers = {
  "Authorization": `Bearer ${API_KEY}`,
  "Content-Type": "application/json"
};

// 1. Transfer NFT
const initRes = await fetch(`${BASE_URL}/participants/me/transfer/init`, {
  method: "POST", headers,
  body: JSON.stringify({ targetOwnerAddress: "0xcc1bf1aa438123d2b3e2052ab5799a9fc1437c12" })
});
const { transferToken } = await initRes.json();

await fetch(`${BASE_URL}/participants/me/transfer/confirm`, {
  method: "POST", headers,
  body: JSON.stringify({ transferToken, targetOwnerAddress: "0xcc1bf1aa438123d2b3e2052ab5799a9fc1437c12" })
});

// 2. Create Project Draft
const draftRes = await fetch(`${BASE_URL}/projects`, {
  method: "POST", headers,
  body: JSON.stringify({
    teamUUID: process.env.SYNTHESIS_TEAM_ID,
    name: "EQUALIZER",
    description: "EQUALIZER is a deal enforcement protocol that lives where deals happen — Telegram, Discord, any DM. An AI agent detects when a deal forms in natural language, locks payment in onchain escrow on Base, evaluates delivery against exact agreed terms, and releases automatically. Silence from the client within 48 hours is a binding response. You don't need to trust the other party. You need to trust the math.",
    problemStatement: "Every day, someone delivers work and gets ghosted. Someone pays upfront and gets nothing. The entire agent identity space is trying to solve this with verifiable credentials and reputation registries — answering 'can you trust this agent?' EQUALIZER asks a different question: what if trust was never required? When terms are locked onchain before work begins — when payment is held by a contract neither party controls — when silence defaults to payment — trust becomes unnecessary. Built by a creator in Lagos, Nigeria who was ghosted after delivering real work.",
    repoURL: "https://github.com/ronkenx9/equalizer",
    trackUUIDs: ["REPLACE_WITH_TRACK_UUIDS"],
    conversationLog: "https://github.com/ronkenx9/equalizer/blob/master/EQUALIZER_conversationLog.md",
    submissionMetadata: {
      agentFramework: "other",
      agentFrameworkOther: "Custom TypeScript agent — Grammy.js + Discord.js + viem",
      agentHarness: "claude-code",
      model: "claude-opus-4-6",
      skills: [
        "Natural language deal detection",
        "Onchain escrow management",
        "AI delivery evaluation",
        "Private dispute mediation (Venice AI)",
        "Autonomous deal monitoring",
        "EAS reputation attestation",
        "MetaMask delegation enforcement",
        "x402 payment processing",
        "ERC-4337 UserOperation submission"
      ],
      tools: [
        "Grammy.js (Telegram)",
        "Discord.js",
        "viem (Base Sepolia)",
        "Groq (Llama 3.3 70B)",
        "Venice AI (encrypted mediation)",
        "MetaMask Delegation Toolkit",
        "Pimlico bundler (ERC-4337)",
        "Ethereum Attestation Service (EAS)",
        "x402 / MPP payment protocol",
        "Hardhat",
        "Express.js",
        "RainbowKit",
        "Railway",
        "Vercel"
      ],
      intention: "continuing"
    },
    videoURL: "REPLACE_WITH_VIDEO_URL"
  })
});
const project = await draftRes.json();

// 3. Publish
await fetch(`${BASE_URL}/projects/${project.uuid}/publish`, {
  method: "POST", headers
});
```

## Tracks to Target

- Synthesis Open Track
- Agent Services on Base
- Best Use of Delegations (MetaMask)
- Private Agents, Trusted Actions (Venice)
- Let the Agent Cook — No Humans Required
- Escrow Ecosystem Extensions (Arkhai)
- Agents With Receipts — ERC-8004

## Scoring (5/5 Target)

| Component | Weight | Status |
|-----------|--------|--------|
| Required fields (name, desc, repo, track, model, framework, harness) | 50% | Done |
| Visuals (demo video + cover image) | 30% | Video editing, cover image ready |
| Recommended fields (problem statement, live URL, tools, skills) | 20% | Done |

## Live Deployment URLs

- **Telegram Bot:** https://t.me/EqualizerThebot
- **Payment Portal:** https://equalizer-production.up.railway.app
- **Escrow Contract:** https://sepolia.basescan.org/address/0xc7D90AD1fa90FedF26d18494228CE8AD5671E8f0
- **GitHub:** https://github.com/ronkenx9/equalizer
