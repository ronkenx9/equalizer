import { Router, Request, Response } from "express";
import {
  createDelegation,
  getDelegationStatus,
} from "../../services/delegation.js";
import { resolveEnsAddress } from "../../services/ens.js";
import { authMiddleware } from "../auth.js";
import { isSmartAccountReady, getAgentSmartAccountAddress } from "../../services/smartAccount.js";
import { createDealDelegation, storeDelegationSignature } from "../../services/delegationManager.js";
import { getDeal } from "../../services/store.js";

const router = Router();

/**
 * GET /v1/delegation/status
 * Public endpoint — no auth required.
 * Returns the current active delegation proof so agents/humans can verify scope.
 */
router.get("/status", (_req: Request, res: Response): void => {
  const delegation = getDelegationStatus();

  if (!delegation) {
    res.status(200).json({
      active: false,
      message: "No delegation configured",
    });
    return;
  }

  res.status(200).json({
    active: true,
    delegation,
  });
});

/**
 * POST /v1/delegation/create
 * Auth required (API key).
 * Body: { delegator_address: string }
 * Creates a new scoped delegation from the given human address to the agent.
 */
router.post("/create", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { delegator_address } = req.body as { delegator_address?: string };

  if (!delegator_address) {
    res.status(400).json({ error: "Missing required field: delegator_address" });
    return;
  }

  let resolvedAddress = delegator_address;

  // Resolve ENS name if provided (contains a dot, e.g. "vitalik.eth")
  if (delegator_address.includes(".")) {
    const resolved = await resolveEnsAddress(delegator_address);
    if (!resolved) {
      res
        .status(400)
        .json({ error: `Could not resolve ENS name: ${delegator_address}` });
      return;
    }
    resolvedAddress = resolved;
  }

  // Validate it's a valid 0x address (40 hex chars after 0x)
  if (!/^0x[0-9a-fA-F]{40}$/.test(resolvedAddress)) {
    res.status(400).json({
      error:
        "delegator_address must be a valid Ethereum address (0x followed by 40 hex characters)",
    });
    return;
  }

  const proof = createDelegation(resolvedAddress);

  res.status(201).json({
    success: true,
    delegation: proof,
  });
});

// ── MetaMask Delegation Toolkit Endpoints ─────────────

/**
 * GET /v1/delegation/deal/:dealId
 * Returns the unsigned delegation struct for a deal.
 * Called by the payment portal to get the EIP-712 data for the brand to sign.
 */
router.get("/deal/:dealId", (req: Request, res: Response): void => {
  const dealId = req.params.dealId as string;
  const { brandSmartAccount, factory, factoryData } = req.query as {
    brandSmartAccount?: string;
    factory?: string;
    factoryData?: string;
  };

  if (!isSmartAccountReady()) {
    res.status(503).json({ error: "Delegation service not initialized (missing PIMLICO_API_KEY)" });
    return;
  }

  if (!brandSmartAccount) {
    res.status(400).json({ error: "Missing required query param: brandSmartAccount" });
    return;
  }

  const deal = getDeal(dealId);
  if (!deal) {
    res.status(404).json({ error: `Deal ${dealId} not found` });
    return;
  }

  try {
    const accountMeta = factory && factoryData ? { factory: factory as string, factoryData: factoryData as string } : undefined;
    const result = createDealDelegation(dealId, brandSmartAccount as string, accountMeta);

    res.json({
      delegation: result.delegation,
      caveats: result.caveats,
      accountMeta: result.accountMeta,
      agentSmartAccount: getAgentSmartAccountAddress(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /v1/delegation/sign
 * Stores the brand's EIP-712 signature on the deal record.
 * Called by the payment portal after the brand signs the delegation.
 */
router.post("/sign", (req: Request, res: Response): void => {
  const { dealId, signature, delegation, brandEOA, brandSmartAccount, accountMeta } = req.body as {
    dealId?: string;
    signature?: string;
    delegation?: any;
    brandEOA?: string;
    brandSmartAccount?: string;
    accountMeta?: { factory: string; factoryData: string };
  };

  if (!dealId || !signature || !delegation || !brandEOA || !brandSmartAccount) {
    res.status(400).json({ error: "Missing required fields: dealId, signature, delegation, brandEOA, brandSmartAccount" });
    return;
  }

  if (!isSmartAccountReady()) {
    res.status(503).json({ error: "Delegation service not initialized" });
    return;
  }

  try {
    storeDelegationSignature(dealId, signature, delegation, brandEOA, brandSmartAccount, accountMeta);
    res.json({ success: true, dealId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /v1/delegation/deal/:dealId/status
 * Returns whether a deal has a signed delegation.
 */
router.get("/deal/:dealId/status", (req: Request, res: Response): void => {
  const dealId = req.params.dealId as string;
  const deal = getDeal(dealId);

  if (!deal) {
    res.status(404).json({ error: `Deal ${dealId} not found` });
    return;
  }

  res.json({
    dealId,
    hasDelegation: !!deal.delegation?.signature,
    delegationHash: deal.delegation?.delegationHash || null,
    signedAt: deal.delegation?.signedAt || null,
    agentSmartAccount: getAgentSmartAccountAddress() || null,
    smartAccountReady: isSmartAccountReady(),
  });
});

export { router as delegationRouter };
