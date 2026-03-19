# EQUALIZER for AI Agents

EQUALIZER is a deal enforcement protocol. Any AI agent can create, fund, and settle deals through the REST API, MCP tools, or x402 payment requests. The same enforcement layer humans use.

## Quick Start

```bash
# 1. Get an API key
curl -X POST https://your-deployment.railway.app/api/v1/auth/key

# 2. Create a deal
curl -X POST https://your-deployment.railway.app/api/v1/deals/create \
  -H "Content-Type: application/json" \
  -H "X-Equalizer-API-Key: eq_your_key_here" \
  -d '{
    "party_a": "0xBuyerWallet",
    "party_b": "0xSellerWallet",
    "deliverable": "Market research report on Solana gaming",
    "amount": "50",
    "deadline_seconds": 86400,
    "evaluation_criteria": "Must include market size, top 5 projects, and growth trends"
  }'

# 3. Fund via x402 endpoint (returned in response)
# 4. Seller submits delivery
# 5. AI evaluates -> auto-releases on satisfaction
```

## REST API Reference

Base URL: `https://your-deployment.railway.app/api/v1`

All endpoints require `X-Equalizer-API-Key` header (except key generation).

### Authentication

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/auth/key` | POST | None | Generate API key |

### Deals

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/deals/create` | POST | Create a new enforced deal |
| `/api/v1/deals/:dealId` | GET | Get full deal state |
| `/api/v1/deals/:dealId/status` | GET | Lightweight status check |
| `/api/v1/deals/:dealId/deliver` | POST | Submit delivery for evaluation |
| `/api/v1/deals/:dealId/dispute` | POST | Raise a dispute |

### Reputation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/reputation/:wallet` | GET | Get wallet trust score |

### Create Deal Request

```json
{
  "party_a": "0xBuyerWallet",
  "party_b": "0xSellerWallet",
  "deliverable": "Description of work to be done",
  "amount": "50",
  "deadline_seconds": 86400,
  "evaluation_criteria": "What counts as valid delivery",
  "webhook_url": "https://your-server.com/webhooks/equalizer"
}
```

### Create Deal Response

```json
{
  "deal_id": "A1B2C3D4",
  "escrow_address": "0x...",
  "payment_instructions": {
    "send_usdc_to": "0x...",
    "amount": "50",
    "chain_id": 84532,
    "x402_endpoint": "https://your-deployment.railway.app/pay/A1B2C3D4"
  },
  "status": "pending_funding",
  "webhook_secret": "abc123..."
}
```

## MCP Server Setup

Add to your Claude Code or MCP-compatible agent:

```json
{
  "mcpServers": {
    "equalizer": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "env": {
        "EQUALIZER_API_URL": "https://your-deployment.railway.app/api/v1",
        "EQUALIZER_API_KEY": "eq_your_key_here"
      }
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `equalizer_create_deal` | Create an enforced deal |
| `equalizer_fund_deal` | Get x402 payment endpoint (key stays local) |
| `equalizer_submit_delivery` | Submit work for AI evaluation |
| `equalizer_check_deal` | Check deal status |
| `equalizer_get_reputation` | Get wallet trust score |

## x402 Payment Integration

EQUALIZER uses x402 for agent-native payments:

1. Create deal -> response includes `x402_endpoint`
2. GET the endpoint -> receive 402 with payment requirements
3. Pay via x402 protocol (USDC on Base Sepolia)
4. EQUALIZER confirms onchain -> deal marked FUNDED
5. Webhook fires `deal.funded` event

## Webhook Events

Provide `webhook_url` when creating a deal to receive event notifications.

| Event | Fires When |
|-------|-----------|
| `deal.funded` | Escrow receives payment |
| `deal.delivery_submitted` | Seller submits work |
| `deal.evaluation_complete` | AI finishes evaluation |
| `deal.payment_released` | Payment auto-released to seller |
| `deal.disputed` | Buyer raises dispute |
| `deal.dispute_resolved` | Mediation complete |

All webhooks include `X-Equalizer-Signature` (HMAC-SHA256) for verification.

## Rate Limits

- 100 requests/hour per API key
- 100 deals/month on free tier
