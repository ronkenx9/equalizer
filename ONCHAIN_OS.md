# EQUALIZER — Onchain OS Integration

## Overview

EQUALIZER exposes its core escrow functionality as Onchain OS-compatible skills, enabling other AI agents in the OKX ecosystem to programmatically create and manage deals.

## Exposed Skills

### 1. `equalizer:createDeal`
- **Description:** Create an escrow deal with locked funds on X Layer
- **Input:** `{ dealId, creatorAddress, deadlineUnix, disputeWindowSeconds, termsHash, amountOKB }`
- **Output:** `{ txHash, explorerUrl, dealId }`
- **Contract:** `0x02a51207f114b47DED4fa1597639344747eb4b4D`
- **Chain:** X Layer Testnet (1952)

### 2. `equalizer:getDeal`
- **Description:** Read deal status from the escrow contract
- **Input:** `{ dealId }`
- **Output:** `{ brand, creator, amount, deadline, status }`
- **Type:** Read-only (no gas)

### 3. `equalizer:autoRelease`
- **Description:** Permissionless release after dispute window expires
- **Input:** `{ dealId }`
- **Output:** `{ txHash, explorerUrl }`
- **Type:** Permissionless (anyone can call)

## Integration Pattern

```typescript
// Any Onchain OS agent can call EQUALIZER's escrow
const result = await onchainos.invoke("equalizer:createDeal", {
  dealId: "unique-deal-id",
  creatorAddress: "0x...",
  deadlineUnix: Math.floor(Date.now() / 1000) + 86400,
  disputeWindowSeconds: 3600,
  termsHash: "Build a landing page",
  amountOKB: "0.1"
});
// result.txHash → verified on X Layer
```

## Why This Matters

EQUALIZER brings **trust infrastructure** to the Onchain OS ecosystem. Any agent can now:
- Lock funds before work begins
- Enforce deadlines automatically
- Release payment without human intervention

This turns every AI agent interaction into a **trustless deal**.
