# The Synthesis: Hackathon Submission Guide

This file contains everything we learned from the Devfolio API docs (`skill.md`), saved here so we can run the submission flow whenever you are ready.

**Deadline:** March 22, 2026, 11:59 PM PST

## Required Actions

Before we can submit the project, there are three main steps. I (the agent) must perform these steps via API using the `SYNTHESIS_API_KEY` already saved in our `.env`.

### 1. ERC-8004 Identity Transfer (Mandatory)
When you registered, Devfolio minted my (EQUALIZER's) ERC-8004 identity NFT to their backend custodial wallet. You cannot publish the project until I transfer this NFT to a wallet you control.

### 2. Prepare the `AGENTS.md` File
We must create an `AGENTS.md` file in the root of the repo detailing EQUALIZER's architecture (Llama 3 70B via Groq + Venice AI mediator + Viem Escrow).

### 3. Draft & Publish Payload
We need your `targetOwnerAddress`, `repoURL`, and ideally a `videoURL` to send the final API payload to `/projects` and then `/publish`. 

---

## Submission Script Draft
When you are ready, I will run a script similar to this:

```typescript
import { config } from "./bot/src/config.js";

const BASE_URL = "https://synthesis.devfolio.co";
const headers = {
  "Authorization": `Bearer ${config.synthesisApiKey}`,
  "Content-Type": "application/json"
};

// 1. Transfer NFT
const initRes = await fetch(`${BASE_URL}/participants/me/transfer/init`, {
  method: "POST", headers,
  body: JSON.stringify({ targetOwnerAddress: "0xYOUR_WALLET" })
});
const { transferToken } = await initRes.json();

await fetch(`${BASE_URL}/participants/me/transfer/confirm`, {
  method: "POST", headers,
  body: JSON.stringify({ transferToken, targetOwnerAddress: "0xYOUR_WALLET" })
});

// 2. Create Project Draft
const draftRes = await fetch(`${BASE_URL}/projects`, {
  method: "POST", headers,
  body: JSON.stringify({
    teamUUID: config.synthesisTeamId,
    name: "EQUALIZER",
    description: "EQUALIZER is an autonomous AI agent that lives inside Telegram and Discord group chats, acting as a trustless escrow facilitator and neutral dispute mediator for freelance deals using the Base blockchain.",
    problemStatement: "Freelance work online is plagued by trust issues. Escrow is clunky and manual, while disputes are expensive to mediate. We solve this by introducing an AI agent right into the chat where the deal happens.",
    repoURL: "https://your-github-repo.com",
    trackUUIDs: ["<UUID-FOR-AGENT-PAYMENTS>"],
    conversationLog: "https://gist.github.com/your-conversation-log", // We will link the EQUALIZER_conversationLog.md
    submissionMetadata: {
      agentFramework: "other",
      agentFrameworkOther: "Custom Grammy/Discord.js Node Architecture",
      agentHarness: "cursor", // Your development harness
      model: "gemini-exp-1114", // Model used for dev assistance
      skills: ["typescript", "viem-ethers", "bot-development"],
      tools: ["Telegram API", "Discord API", "Base Sepolia", "Groq", "Venice AI"],
      intention: "continuing"
    },
    videoURL: "https://youtube.com/your-demo" // Strongly recommended
  })
});
const project = await draftRes.json();

// 3. Publish
await fetch(`${BASE_URL}/projects/${project.uuid}/publish`, {
  method: "POST", headers
});
```

*Saved safely. Just tell me when you're ready to submit it!*
