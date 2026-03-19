# EQUALIZER Agent-to-Agent Infrastructure Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add REST API, webhook system, MCP server, x402 extension, and documentation so any AI agent can create, fund, and settle deals through EQUALIZER programmatically.

**Architecture:** New Express routes (`/api/v1/*`) mounted on the existing server in `index.ts`. Webhook service fires HTTP POSTs on deal events. MCP server runs as a separate stdio process reusing the same store/chain/inference modules. API authentication via simple API key system with in-memory rate limiting.

**Tech Stack:** Express 5, @modelcontextprotocol/sdk, Groq SDK, viem, existing store/chain/x402/eas services.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `bot/src/api/auth.ts` | API key generation, validation, rate limiting (100 req/hr) |
| `bot/src/api/v1/deals.ts` | REST endpoints: create, get, status, deliver, dispute |
| `bot/src/api/v1/reputation.ts` | REST endpoint: wallet reputation/trust score |
| `bot/src/api/v1/x402.ts` | x402 payment endpoint for API-created deals |
| `bot/src/api/router.ts` | Mount all v1 routes under `/api/v1` |
| `bot/src/services/webhook.ts` | Webhook delivery: fire, retry, HMAC signing, logging |
| `bot/src/services/reputation.ts` | Compute trust score from deal history |
| `bot/src/types/api.ts` | Request/response types for API endpoints |
| `bot/src/types/deal.ts` | Extended with `webhookUrl?`, `apiKeyId?`, `partyAWallet?`, `partyBWallet?` fields |
| `mcp/server.ts` | MCP server with 5 tools (stdio transport) |
| `mcp/package.json` | MCP server dependencies |
| `mcp/tsconfig.json` | MCP server TypeScript config |
| `mcp_config.json` | MCP server config for consumers |
| `AGENTS.md` | Integration guide for agent developers |

---

## Chunk 1: API Auth + Types + Reputation Service

### Task 1: Add API types

**Files:**
- Create: `bot/src/types/api.ts`

- [ ] **Step 1: Create API request/response type definitions**

```typescript
// bot/src/types/api.ts
export interface CreateDealRequest {
  party_a: string;       // wallet address (buyer)
  party_b: string;       // wallet address (seller)
  deliverable: string;
  amount: string;        // in USDC
  deadline_seconds: number;
  evaluation_criteria: string;
  webhook_url?: string;
}

export interface CreateDealResponse {
  deal_id: string;
  escrow_address: string;
  payment_instructions: {
    send_usdc_to: string;
    amount: string;
    chain_id: number;
    x402_endpoint: string;
  };
  status: "pending_funding";
}

export interface DeliverRequest {
  party_b_address: string;
  delivery_url?: string;
  delivery_content?: string;
  delivery_hash?: string;
}

export interface DisputeRequest {
  disputing_party: string;
  reason: string;
  evidence_url?: string;
  evidence_content?: string;
}

export interface ReputationResponse {
  wallet: string;
  deals_completed: number;
  deals_as_buyer: number;
  deals_as_seller: number;
  total_volume_usdc: string;
  completion_rate: number;
  avg_delivery_time_hours: number;
  dispute_rate: number;
  eas_attestations: string[];
  trust_score: number;
}

export interface DealStatusResponse {
  deal_id: string;
  status: string;
  next_action: string;
}

export interface FullDealResponse {
  deal_id: string;
  status: string;
  party_a: string;
  party_b: string;
  deliverable: string;
  amount: string;
  deadline: string;
  evaluation_result: {
    passed: boolean;
    confidence: number;
    reasoning: string;
    flags?: string[];
  } | null;
  dispute_status: string | null;
  payment_released: boolean;
  eas_attestation: string | null;
  created_at: number;
  updated_at: number;
}
```

- [ ] **Step 2: Extend DealState with API fields**

In `bot/src/types/deal.ts`, add optional fields to `DealState`:

```typescript
// Add to DealState interface:
  webhookUrl?: string;
  webhookSecret?: string;
  apiKeyId?: string;
  partyAWallet?: string;
  partyBWallet?: string;
  evaluationCriteria?: string;
  easAttestationUid?: string;
```

- [ ] **Step 3: Commit**

```bash
git add bot/src/types/api.ts bot/src/types/deal.ts
git commit -m "feat: add API types and extend DealState for programmatic access"
```

### Task 2: API key auth + rate limiting

**Files:**
- Create: `bot/src/api/auth.ts`

- [ ] **Step 1: Write auth middleware**

```typescript
// bot/src/api/auth.ts
import { randomBytes } from "crypto";
import { Request, Response, NextFunction } from "express";

interface ApiKey {
  id: string;
  key: string;
  createdAt: number;
  dealsThisMonth: number;
  monthStart: number;
}

const apiKeys = new Map<string, ApiKey>();
const rateLimitCounters = new Map<string, { count: number; resetAt: number }>();

const FREE_TIER_DEALS = 100;
const RATE_LIMIT_PER_HOUR = 100;

export function generateApiKey(): ApiKey {
  const id = randomBytes(8).toString("hex");
  const key = `eq_${randomBytes(24).toString("hex")}`;
  const now = Date.now();
  const entry: ApiKey = {
    id,
    key,
    createdAt: now,
    dealsThisMonth: 0,
    monthStart: now,
  };
  apiKeys.set(key, entry);
  return entry;
}

export function validateApiKey(key: string): ApiKey | null {
  return apiKeys.get(key) ?? null;
}

export function incrementDealCount(key: string): boolean {
  const entry = apiKeys.get(key);
  if (!entry) return false;
  // Reset monthly counter if new month
  const now = Date.now();
  if (now - entry.monthStart > 30 * 24 * 60 * 60 * 1000) {
    entry.dealsThisMonth = 0;
    entry.monthStart = now;
  }
  if (entry.dealsThisMonth >= FREE_TIER_DEALS) return false;
  entry.dealsThisMonth++;
  return true;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const counter = rateLimitCounters.get(key);
  if (!counter || now > counter.resetAt) {
    rateLimitCounters.set(key, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (counter.count >= RATE_LIMIT_PER_HOUR) return false;
  counter.count++;
  return true;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers["x-equalizer-api-key"] as string | undefined;
  if (!apiKey) {
    res.status(401).json({ error: "Missing X-Equalizer-API-Key header" });
    return;
  }
  const entry = validateApiKey(apiKey);
  if (!entry) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }
  if (!checkRateLimit(apiKey)) {
    res.status(429).json({ error: "Rate limit exceeded (100 requests/hour)" });
    return;
  }
  // Attach to request for downstream use
  (req as any).apiKeyId = entry.id;
  next();
}

// POST /api/v1/auth/key — generate a new API key (no auth required)
export function handleGenerateKey(_req: Request, res: Response): void {
  const entry = generateApiKey();
  res.status(201).json({
    api_key: entry.key,
    message: "Store this key securely. It cannot be retrieved later.",
    limits: {
      deals_per_month: FREE_TIER_DEALS,
      requests_per_hour: RATE_LIMIT_PER_HOUR,
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add bot/src/api/auth.ts
git commit -m "feat: add API key auth middleware with rate limiting"
```

### Task 3: Reputation service

**Files:**
- Create: `bot/src/services/reputation.ts`

- [ ] **Step 1: Write reputation computation**

```typescript
// bot/src/services/reputation.ts
import { getAllDeals } from "./store.js";
import { DealStatus } from "../types/deal.js";
import type { ReputationResponse } from "../types/api.js";

export function getWalletReputation(walletAddress: string): ReputationResponse {
  const wallet = walletAddress.toLowerCase();
  const allDeals = getAllDeals();

  // Find deals where this wallet is party_a (buyer) or party_b (seller)
  // Match by wallet fields OR by username containing the address
  const asBuyer = allDeals.filter(
    (d) => d.partyAWallet?.toLowerCase() === wallet
  );
  const asSeller = allDeals.filter(
    (d) => d.partyBWallet?.toLowerCase() === wallet
  );
  const allWalletDeals = [...asBuyer, ...asSeller];

  const completed = allWalletDeals.filter(
    (d) => d.status === DealStatus.Completed
  );
  const disputed = allWalletDeals.filter(
    (d) =>
      d.status === DealStatus.Disputed ||
      d.status === DealStatus.EvidenceCollection
  );

  // Calculate total volume
  let totalVolumeUsdc = 0;
  for (const d of allWalletDeals) {
    const price = parseFloat(d.terms.price.replace(/[^0-9.]/g, ""));
    if (!isNaN(price)) totalVolumeUsdc += price;
  }

  // Average delivery time (funded → completed)
  let totalDeliveryHours = 0;
  let deliveryCount = 0;
  for (const d of completed) {
    if (d.fundedAt && d.completedAt) {
      totalDeliveryHours += (d.completedAt - d.fundedAt) / 3600_000;
      deliveryCount++;
    }
  }

  const completionRate =
    allWalletDeals.length > 0
      ? completed.length / allWalletDeals.length
      : 0;
  const disputeRate =
    allWalletDeals.length > 0
      ? disputed.length / allWalletDeals.length
      : 0;

  // Trust score: 0-100
  // Base 50 + up to 30 for completion rate + up to 20 for volume - dispute penalty
  const trustScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        50 +
          completionRate * 30 +
          Math.min(20, totalVolumeUsdc / 500) -
          disputeRate * 40
      )
    )
  );

  // Collect attestation UIDs
  const attestations = allWalletDeals
    .filter((d) => d.easAttestationUid)
    .map((d) => d.easAttestationUid!);

  return {
    wallet: walletAddress,
    deals_completed: completed.length,
    deals_as_buyer: asBuyer.length,
    deals_as_seller: asSeller.length,
    total_volume_usdc: totalVolumeUsdc.toFixed(2),
    completion_rate: Math.round(completionRate * 100) / 100,
    avg_delivery_time_hours:
      deliveryCount > 0
        ? Math.round((totalDeliveryHours / deliveryCount) * 10) / 10
        : 0,
    dispute_rate: Math.round(disputeRate * 100) / 100,
    eas_attestations: attestations,
    trust_score: trustScore,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add bot/src/services/reputation.ts
git commit -m "feat: add wallet reputation/trust score computation"
```

---

## Chunk 2: Webhook System

### Task 4: Webhook service

**Files:**
- Create: `bot/src/services/webhook.ts`

- [ ] **Step 1: Write webhook delivery service**

```typescript
// bot/src/services/webhook.ts
import { createHmac } from "crypto";

export type WebhookEvent =
  | "deal.funded"
  | "deal.delivery_submitted"
  | "deal.evaluation_complete"
  | "deal.payment_released"
  | "deal.disputed"
  | "deal.dispute_resolved";

interface WebhookPayload {
  event: WebhookEvent;
  deal_id: string;
  timestamp: number;
  [key: string]: any;
}

interface WebhookLog {
  event: WebhookEvent;
  deal_id: string;
  url: string;
  status: number | null;
  attempt: number;
  timestamp: number;
  error?: string;
}

const webhookLogs: WebhookLog[] = [];
const MAX_RETRIES = 3;
const TIMEOUT_MS = 5000;

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export async function fireWebhook(
  url: string,
  secret: string,
  payload: WebhookPayload
): Promise<void> {
  const body = JSON.stringify(payload);
  const signature = signPayload(body, secret);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Equalizer-Signature": signature,
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      webhookLogs.push({
        event: payload.event,
        deal_id: payload.deal_id,
        url,
        status: res.status,
        attempt,
        timestamp: Date.now(),
      });

      if (res.ok) {
        console.log(`[Webhook] ${payload.event} delivered to ${url} (attempt ${attempt})`);
        return;
      }

      console.warn(`[Webhook] ${payload.event} got ${res.status} from ${url} (attempt ${attempt})`);
    } catch (err: any) {
      webhookLogs.push({
        event: payload.event,
        deal_id: payload.deal_id,
        url,
        status: null,
        attempt,
        timestamp: Date.now(),
        error: err.message,
      });
      console.warn(`[Webhook] ${payload.event} failed (attempt ${attempt}): ${err.message}`);
    }
  }

  console.error(`[Webhook] ${payload.event} exhausted ${MAX_RETRIES} retries for ${url}`);
}

/**
 * Fire webhook if the deal has a webhook URL configured.
 * Non-blocking — errors are logged but don't propagate.
 */
export function notifyWebhook(
  webhookUrl: string | undefined,
  webhookSecret: string | undefined,
  payload: WebhookPayload
): void {
  if (!webhookUrl) return;
  const secret = webhookSecret || "default-secret";
  // Fire and forget
  fireWebhook(webhookUrl, secret, payload).catch((err) =>
    console.error(`[Webhook] Unexpected error:`, err)
  );
}

export function getWebhookLogs(): WebhookLog[] {
  return webhookLogs.slice(-100); // Last 100 entries
}
```

- [ ] **Step 2: Commit**

```bash
git add bot/src/services/webhook.ts
git commit -m "feat: add webhook delivery service with HMAC signing and retries"
```

---

## Chunk 3: REST API Routes

### Task 5: Deal CRUD endpoints

**Files:**
- Create: `bot/src/api/v1/deals.ts`

- [ ] **Step 1: Write deal endpoints**

```typescript
// bot/src/api/v1/deals.ts
import { Router, Request, Response } from "express";
import { randomBytes } from "crypto";
import { createDeal, getDeal, updateDeal, getAllDeals } from "../../services/store.js";
import { evaluateDelivery } from "../../services/claude.js";
import { DealStatus } from "../../types/deal.js";
import { incrementDealCount } from "../auth.js";
import { createPaymentRequest, generatePaymentUrl } from "../../services/x402.js";
import { notifyWebhook } from "../../services/webhook.js";
import { getDisputeWindowEnd } from "../../utils/timer.js";
import { config } from "../../config.js";
import type {
  CreateDealRequest,
  CreateDealResponse,
  DeliverRequest,
  DisputeRequest,
  DealStatusResponse,
  FullDealResponse,
} from "../../types/api.js";

const router = Router();

// POST /api/v1/deals/create
router.post("/create", (req: Request, res: Response): void => {
  const body = req.body as CreateDealRequest;
  const apiKeyId = (req as any).apiKeyId;

  // Validation
  if (!body.party_a || !body.party_b || !body.deliverable || !body.amount || !body.deadline_seconds) {
    res.status(400).json({ error: "Missing required fields: party_a, party_b, deliverable, amount, deadline_seconds" });
    return;
  }

  // Check deal quota
  const apiKey = req.headers["x-equalizer-api-key"] as string;
  if (!incrementDealCount(apiKey)) {
    res.status(403).json({ error: "Monthly deal limit reached (100 deals/month on free tier)" });
    return;
  }

  const deadlineDate = new Date(Date.now() + body.deadline_seconds * 1000);
  const webhookSecret = body.webhook_url ? randomBytes(16).toString("hex") : undefined;

  const deal = createDeal(0, {
    deliverable: body.deliverable,
    price: body.amount,
    currency: "USDC",
    deadline: deadlineDate.toISOString(),
    disputeWindowSeconds: 7200, // 2 hours default
    brandUsername: body.party_a,
    creatorUsername: body.party_b,
  });

  // Store API-specific fields
  updateDeal(deal.id, {
    status: DealStatus.Confirmed,
    confirmedAt: Date.now(),
    apiKeyId,
    partyAWallet: body.party_a,
    partyBWallet: body.party_b,
    evaluationCriteria: body.evaluation_criteria,
    webhookUrl: body.webhook_url,
    webhookSecret,
  });

  // Create x402 payment request
  const amountUsd = parseFloat(body.amount);
  createPaymentRequest(deal.id, amountUsd);

  const response: CreateDealResponse = {
    deal_id: deal.id,
    escrow_address: config.escrowContractAddress || config.yieldEscrowAddress || "",
    payment_instructions: {
      send_usdc_to: config.agentWalletAddress || config.escrowContractAddress || "",
      amount: body.amount,
      chain_id: 84532,
      x402_endpoint: `${config.botPublicUrl}/pay/${deal.id}`,
    },
    status: "pending_funding",
  };

  // Include webhook_secret in response if webhook was provided
  const fullResponse: any = { ...response };
  if (webhookSecret) {
    fullResponse.webhook_secret = webhookSecret;
  }

  res.status(201).json(fullResponse);
});

// GET /api/v1/deals/:dealId
router.get("/:dealId", (req: Request, res: Response): void => {
  const deal = getDeal(req.params.dealId);
  if (!deal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  const response: FullDealResponse = {
    deal_id: deal.id,
    status: deal.status,
    party_a: deal.partyAWallet || deal.terms.brandUsername,
    party_b: deal.partyBWallet || deal.terms.creatorUsername,
    deliverable: deal.terms.deliverable,
    amount: deal.terms.price,
    deadline: deal.terms.deadline,
    evaluation_result: deal.deliveryEvaluation || null,
    dispute_status: deal.status === DealStatus.Disputed || deal.status === DealStatus.EvidenceCollection
      ? deal.status
      : null,
    payment_released: deal.status === DealStatus.Completed,
    eas_attestation: deal.easAttestationUid || null,
    created_at: deal.createdAt,
    updated_at: deal.completedAt || deal.fundedAt || deal.confirmedAt || deal.createdAt,
  };

  res.json(response);
});

// GET /api/v1/deals/:dealId/status
router.get("/:dealId/status", (req: Request, res: Response): void => {
  const deal = getDeal(req.params.dealId);
  if (!deal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  let next_action = "none";
  switch (deal.status) {
    case DealStatus.Confirmed:
      next_action = "fund_escrow";
      break;
    case DealStatus.Funded:
      next_action = "submit_delivery";
      break;
    case DealStatus.DeliverySubmitted:
      next_action = "awaiting_evaluation";
      break;
    case DealStatus.DisputeWindow:
      next_action = "awaiting_dispute_window_close";
      break;
    case DealStatus.EvidenceCollection:
      next_action = "submit_evidence";
      break;
    case DealStatus.Disputed:
      next_action = "awaiting_mediation";
      break;
  }

  const response: DealStatusResponse = {
    deal_id: deal.id,
    status: deal.status,
    next_action,
  };

  res.json(response);
});

// POST /api/v1/deals/:dealId/deliver
router.post("/:dealId/deliver", async (req: Request, res: Response): Promise<void> => {
  const deal = getDeal(req.params.dealId);
  if (!deal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  if (deal.status !== DealStatus.Funded) {
    res.status(400).json({ error: `Deal is in ${deal.status} state, expected FUNDED` });
    return;
  }

  const body = req.body as DeliverRequest;
  if (!body.party_b_address) {
    res.status(400).json({ error: "Missing party_b_address" });
    return;
  }

  // Verify party_b matches
  if (deal.partyBWallet && body.party_b_address.toLowerCase() !== deal.partyBWallet.toLowerCase()) {
    res.status(403).json({ error: "party_b_address does not match deal seller" });
    return;
  }

  const deliveryContent = body.delivery_content || body.delivery_url || body.delivery_hash || "";

  updateDeal(deal.id, {
    status: DealStatus.DeliverySubmitted,
    delivery: deliveryContent,
    deliverySubmittedAt: Date.now(),
  });

  notifyWebhook(deal.webhookUrl, deal.webhookSecret, {
    event: "deal.delivery_submitted",
    deal_id: deal.id,
    delivery_url: body.delivery_url,
    evaluation_pending: true,
    timestamp: Date.now(),
  });

  // Trigger evaluation asynchronously
  const criteria = deal.evaluationCriteria
    ? { ...deal.terms, deliverable: `${deal.terms.deliverable}\n\nEvaluation Criteria: ${deal.evaluationCriteria}` }
    : deal.terms;

  evaluateDelivery(criteria, deliveryContent)
    .then((evaluation) => {
      const windowEnd = getDisputeWindowEnd(deal.terms.disputeWindowSeconds);
      updateDeal(deal.id, {
        status: DealStatus.DisputeWindow,
        deliveryEvaluation: evaluation,
        disputeWindowEnd: windowEnd,
      });
      notifyWebhook(deal.webhookUrl, deal.webhookSecret, {
        event: "deal.evaluation_complete",
        deal_id: deal.id,
        passed: evaluation.passed,
        confidence: evaluation.confidence,
        reasoning: evaluation.reasoning,
        next: "dispute_window",
        timestamp: Date.now(),
      });
    })
    .catch((err) => console.error(`[API] Evaluation failed for deal ${deal.id}:`, err));

  res.json({
    deal_id: deal.id,
    evaluation_status: "evaluating",
    estimated_resolution: 30,
  });
});

// POST /api/v1/deals/:dealId/dispute
router.post("/:dealId/dispute", (req: Request, res: Response): void => {
  const deal = getDeal(req.params.dealId);
  if (!deal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  if (deal.status !== DealStatus.DisputeWindow) {
    res.status(400).json({ error: `Deal is in ${deal.status} state, expected DISPUTE_WINDOW` });
    return;
  }

  const body = req.body as DisputeRequest;
  if (!body.disputing_party || !body.reason) {
    res.status(400).json({ error: "Missing disputing_party or reason" });
    return;
  }

  // Check dispute window hasn't closed
  if (deal.disputeWindowEnd && Date.now() > deal.disputeWindowEnd) {
    res.status(400).json({ error: "Dispute window has closed" });
    return;
  }

  updateDeal(deal.id, {
    status: DealStatus.EvidenceCollection,
    evidence: {
      brandEvidence: body.reason,
      creatorEvidence: undefined,
    },
  });

  notifyWebhook(deal.webhookUrl, deal.webhookSecret, {
    event: "deal.disputed",
    deal_id: deal.id,
    disputing_party: body.disputing_party,
    reason: body.reason,
    evidence_deadline: Date.now() + 24 * 3600_000,
    timestamp: Date.now(),
  });

  res.json({
    deal_id: deal.id,
    dispute_status: "evidence_collection",
    evidence_deadline: Date.now() + 24 * 3600_000,
  });
});

export { router as dealsRouter };
```

- [ ] **Step 2: Commit**

```bash
git add bot/src/api/v1/deals.ts
git commit -m "feat: add REST API deal CRUD endpoints"
```

### Task 6: Reputation endpoint

**Files:**
- Create: `bot/src/api/v1/reputation.ts`

- [ ] **Step 1: Write reputation route**

```typescript
// bot/src/api/v1/reputation.ts
import { Router, Request, Response } from "express";
import { getWalletReputation } from "../../services/reputation.js";

const router = Router();

// GET /api/v1/reputation/:walletAddress
router.get("/:walletAddress", (req: Request, res: Response): void => {
  const { walletAddress } = req.params;

  if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    res.status(400).json({ error: "Invalid wallet address format" });
    return;
  }

  const reputation = getWalletReputation(walletAddress);
  res.json(reputation);
});

export { router as reputationRouter };
```

- [ ] **Step 2: Commit**

```bash
git add bot/src/api/v1/reputation.ts
git commit -m "feat: add reputation endpoint"
```

### Task 7: API router + mount on Express

**Files:**
- Create: `bot/src/api/router.ts`
- Modify: `bot/src/index.ts`

- [ ] **Step 1: Create the API router**

```typescript
// bot/src/api/router.ts
import { Router } from "express";
import { authMiddleware, handleGenerateKey } from "./auth.js";
import { dealsRouter } from "./v1/deals.js";
import { reputationRouter } from "./v1/reputation.js";

const apiRouter = Router();

// Public: generate API key (no auth required)
apiRouter.post("/v1/auth/key", handleGenerateKey);

// Protected routes
apiRouter.use("/v1/deals", authMiddleware, dealsRouter);
apiRouter.use("/v1/reputation", authMiddleware, reputationRouter);

export { apiRouter };
```

- [ ] **Step 2: Mount in index.ts**

Add after `app.use(express.json());` in `bot/src/index.ts`:

```typescript
import { apiRouter } from "./api/router.js";

// Mount REST API
app.use("/api", apiRouter);
```

- [ ] **Step 3: Verify the bot starts without errors**

Run: `cd equalizer/bot && npx tsx src/index.ts`
Expected: "Express server listening on port 3000" with no import errors.
Kill after verifying.

- [ ] **Step 4: Commit**

```bash
git add bot/src/api/router.ts bot/src/index.ts
git commit -m "feat: mount REST API router on Express server"
```

---

## Chunk 4: x402 Extension for API Deals

### Task 8: Wire x402 payment settlement to webhook notifications

**Files:**
- Modify: `bot/src/index.ts`

- [ ] **Step 1: Add webhook notification on x402 payment settlement**

In the `setPaymentCallback` block in `index.ts`, after `updateDeal(dealId, { status: DealStatus.Funded, fundedAt: Date.now() })`, add:

```typescript
import { notifyWebhook } from "./services/webhook.js";

// Inside setPaymentCallback, after updateDeal:
notifyWebhook(deal.webhookUrl, deal.webhookSecret, {
  event: "deal.funded",
  deal_id: dealId,
  amount: deal.terms.price,
  party_a: deal.partyAWallet || deal.terms.brandUsername,
  party_b: deal.partyBWallet || deal.terms.creatorUsername,
  timestamp: Date.now(),
  escrow_address: config.escrowContractAddress || "",
});
```

- [ ] **Step 2: Add webhook notification on deal watcher funded callback**

Same pattern in the `setDealFundedCallback` block.

- [ ] **Step 3: Add webhook notification on auto-release in monitor**

In `bot/src/services/monitor.ts`, after `updateDeal(deal.id, { status: DealStatus.Completed, ... })`, add:

```typescript
notifyWebhook(deal.webhookUrl, deal.webhookSecret, {
  event: "deal.payment_released",
  deal_id: deal.id,
  amount: deal.terms.price,
  recipient: deal.partyBWallet || deal.terms.creatorUsername,
  tx_hash: txHash,
  eas_attestation: deal.easAttestationUid || null,
  timestamp: Date.now(),
});
```

- [ ] **Step 4: Commit**

```bash
git add bot/src/index.ts bot/src/services/monitor.ts
git commit -m "feat: fire webhooks on deal.funded and deal.payment_released events"
```

---

## Chunk 5: MCP Server

### Task 9: MCP server setup

**Files:**
- Create: `mcp/package.json`
- Create: `mcp/tsconfig.json`

- [ ] **Step 1: Create MCP package.json**

```json
{
  "name": "equalizer-mcp",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "npx tsx server.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "dotenv": "^17.3.1"
  },
  "devDependencies": {
    "tsx": "^4.21.0",
    "typescript": "^5.9.3",
    "@types/node": "^25.5.0"
  }
}
```

- [ ] **Step 2: Create MCP tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["*.ts"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `cd equalizer/mcp && npm install`

- [ ] **Step 4: Commit**

```bash
git add mcp/package.json mcp/tsconfig.json mcp/package-lock.json
git commit -m "feat: scaffold MCP server package"
```

### Task 10: MCP server with 5 tools

**Files:**
- Create: `mcp/server.ts`

- [ ] **Step 1: Write MCP server**

The MCP server calls the REST API (it does NOT import bot modules directly — it's a separate process). It uses `fetch()` against the bot's Express server.

```typescript
// mcp/server.ts
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.EQUALIZER_API_URL || "http://localhost:3000/api/v1";
const API_KEY = process.env.EQUALIZER_API_KEY || "";

async function apiCall(method: string, path: string, body?: any): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Equalizer-API-Key": API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

const server = new McpServer({
  name: "equalizer",
  version: "1.0.0",
});

// Tool 1: equalizer_create_deal
server.tool(
  "equalizer_create_deal",
  "Create an enforced deal between two parties. Locks payment in escrow. AI evaluates delivery. Auto-releases on satisfaction.",
  {
    deliverable: z.string().describe("What needs to be delivered"),
    amount_usdc: z.string().describe("Payment amount in USDC"),
    party_b_address: z.string().describe("Seller/worker wallet address"),
    deadline_hours: z.number().describe("Hours until deadline"),
    evaluation_criteria: z.string().describe("What counts as valid delivery"),
    my_wallet: z.string().describe("Your wallet address (buyer)"),
  },
  async ({ deliverable, amount_usdc, party_b_address, deadline_hours, evaluation_criteria, my_wallet }) => {
    const result = await apiCall("POST", "/deals/create", {
      party_a: my_wallet,
      party_b: party_b_address,
      deliverable,
      amount: amount_usdc,
      deadline_seconds: deadline_hours * 3600,
      evaluation_criteria,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool 2: equalizer_fund_deal (x402 — returns payment endpoint, agent pays locally)
server.tool(
  "equalizer_fund_deal",
  "Get x402 payment endpoint to fund a deal. Returns the x402 URL — your agent pays via x402 protocol. Private key never leaves your environment.",
  {
    deal_id: z.string().describe("The deal ID to fund"),
  },
  async ({ deal_id }) => {
    // Return the x402 endpoint info — agent handles payment locally
    const dealInfo = await apiCall("GET", `/deals/${deal_id}`);
    const x402Url = `${API_BASE.replace("/api/v1", "")}/pay/${deal_id}`;
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          deal_id,
          x402_endpoint: x402Url,
          amount: dealInfo.amount,
          chain_id: 84532,
          network: "Base Sepolia",
          instructions: "Send a GET request to x402_endpoint to receive 402 payment requirements. Then submit payment via x402 protocol. Your private key stays local.",
        }, null, 2),
      }],
    };
  }
);

// Tool 3: equalizer_submit_delivery
server.tool(
  "equalizer_submit_delivery",
  "Submit completed work for a deal. Triggers AI evaluation.",
  {
    deal_id: z.string().describe("The deal ID"),
    party_b_address: z.string().describe("Your wallet address (seller)"),
    delivery_url: z.string().optional().describe("URL to delivered work"),
    delivery_content: z.string().optional().describe("Description of delivered work"),
  },
  async ({ deal_id, party_b_address, delivery_url, delivery_content }) => {
    const result = await apiCall("POST", `/deals/${deal_id}/deliver`, {
      party_b_address,
      delivery_url,
      delivery_content,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool 4: equalizer_check_deal
server.tool(
  "equalizer_check_deal",
  "Check status of any deal. Get full state, timeline, and next action.",
  {
    deal_id: z.string().describe("The deal ID to check"),
  },
  async ({ deal_id }) => {
    const result = await apiCall("GET", `/deals/${deal_id}`);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool 5: equalizer_get_reputation
server.tool(
  "equalizer_get_reputation",
  "Get trust score and deal history for any wallet address. Use before agreeing to a deal.",
  {
    wallet_address: z.string().describe("Wallet address to check"),
  },
  async ({ wallet_address }) => {
    const result = await apiCall("GET", `/reputation/${wallet_address}`);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Start
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("EQUALIZER MCP server running on stdio");
}

main().catch(console.error);
```

- [ ] **Step 2: Commit**

```bash
git add mcp/server.ts
git commit -m "feat: add MCP server with 5 tools (create, fund, deliver, check, reputation)"
```

### Task 11: MCP config file

**Files:**
- Create: `mcp_config.json`

- [ ] **Step 1: Create MCP config**

```json
{
  "mcpServers": {
    "equalizer": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "description": "EQUALIZER deal enforcement — create, fund, and settle deals programmatically",
      "env": {
        "EQUALIZER_API_URL": "http://localhost:3000/api/v1",
        "EQUALIZER_API_KEY": ""
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add mcp_config.json
git commit -m "feat: add MCP config for Claude/GPT agent consumers"
```

---

## Chunk 6: Documentation

### Task 12: AGENTS.md

**Files:**
- Create: `AGENTS.md`

- [ ] **Step 1: Write integration guide**

```markdown
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
# 5. AI evaluates → auto-releases on satisfaction
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

1. Create deal → response includes `x402_endpoint`
2. GET the endpoint → receive 402 with payment requirements
3. Pay via x402 protocol (USDC on Base Sepolia)
4. EQUALIZER confirms onchain → deal marked FUNDED
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
```

- [ ] **Step 2: Update README.md with infrastructure section**

Add after the main description in `README.md`:

```markdown
## EQUALIZER as Infrastructure

Any AI agent can create, fund, and settle deals through EQUALIZER via REST API, MCP tools, or x402 payment requests. The same enforcement layer humans use.

See [AGENTS.md](./AGENTS.md) for the full integration guide.
```

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs: add AGENTS.md integration guide and update README"
```

### Task 13: Verify everything compiles

- [ ] **Step 1: Type-check the bot**

Run: `cd equalizer/bot && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Verify bot starts**

Run: `cd equalizer/bot && npx tsx src/index.ts`
Expected: Express server starts, API routes mounted, no import errors.

- [ ] **Step 3: Verify MCP server starts**

Run: `cd equalizer/mcp && echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}' | npx tsx server.ts`
Expected: JSON-RPC response with server capabilities.

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve any compilation issues from infrastructure sprint"
```
