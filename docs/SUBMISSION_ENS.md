# EQUALIZER × ENS — Bounty Submission

Agents shouldn't interact with 42-character hex strings. Neither should humans watching them work.

## What Was Integrated

ENS name resolution is threaded throughout EQUALIZER's REST API. Wherever the protocol accepts a wallet address — deal creation, reputation lookups, trust verification — it also accepts an ENS name. The resolution happens server-side, invisibly, before any onchain logic runs.

## How It Surfaces

**Reputation lookups accept ENS names directly.**

```
GET /api/v1/reputation/vitalik.eth
```

The API resolves the name to its underlying address, fetches the onchain deal history and EAS attestations for that address, and returns a trust score attributed to the human-readable identity — not an opaque hex string.

**Deal creation accepts ENS names for both parties.**

When `party_a` or `party_b` is an ENS name, the server resolves it before writing the deal record. The resolved address is stored for onchain interactions; the ENS name is retained for display.

**Telegram deal cards show ENS names when available.**

Deal summaries posted to Telegram show `vitalik.eth` instead of `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`. Counterparties can read the card and immediately recognise who they are dealing with.

## Implementation

Resolution uses viem's built-in ENS support against Ethereum mainnet — no third-party API dependency, no external service that can be rate-limited or shut down. Resolved addresses are cached in-memory for 10 minutes to avoid hammering the RPC on repeated lookups for the same name.

This is not an ENS widget bolted onto a product. It is ENS as the default identity layer throughout the stack.
