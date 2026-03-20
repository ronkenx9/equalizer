import { Router, Request, Response } from "express";
import { randomBytes } from "crypto";
import { createDeal, getDeal, updateDeal } from "../../services/store.js";
import { evaluateDelivery } from "../../services/claude.js";
import { DealStatus } from "../../types/deal.js";
import { incrementDealCount } from "../auth.js";
import { createPaymentRequest } from "../../services/x402.js";
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
router.post("/create", async (req: Request, res: Response): Promise<void> => {
  const body = req.body as CreateDealRequest;
  const apiKeyId = (req as any).apiKeyId;

  if (!body.party_a || !body.party_b || !body.deliverable || !body.amount || !body.deadline_seconds) {
    res.status(400).json({ error: "Missing required fields: party_a, party_b, deliverable, amount, deadline_seconds" });
    return;
  }

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
    disputeWindowSeconds: 7200,
    brandUsername: body.party_a,
    creatorUsername: body.party_b,
  });

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

  const amountUsd = parseFloat(body.amount);
  const currency = body.currency || "USDC";
  await createPaymentRequest(deal.id, amountUsd, currency);

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

  const fullResponse: any = { ...response };
  if (webhookSecret) {
    fullResponse.webhook_secret = webhookSecret;
  }

  res.status(201).json(fullResponse);
});

// GET /api/v1/deals/:dealId
router.get("/:dealId", (req: Request, res: Response): void => {
  const deal = getDeal(req.params.dealId as string);
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
  const deal = getDeal(req.params.dealId as string);
  if (!deal) {
    res.status(404).json({ error: "Deal not found" });
    return;
  }

  let next_action = "none";
  switch (deal.status) {
    case DealStatus.Confirmed: next_action = "fund_escrow"; break;
    case DealStatus.Funded: next_action = "submit_delivery"; break;
    case DealStatus.DeliverySubmitted: next_action = "awaiting_evaluation"; break;
    case DealStatus.DisputeWindow: next_action = "awaiting_dispute_window_close"; break;
    case DealStatus.EvidenceCollection: next_action = "submit_evidence"; break;
    case DealStatus.Disputed: next_action = "awaiting_mediation"; break;
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
  const deal = getDeal(req.params.dealId as string);
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
  const deal = getDeal(req.params.dealId as string);
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
