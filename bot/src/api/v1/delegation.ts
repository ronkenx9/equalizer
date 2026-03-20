import { Router, Request, Response } from "express";
import {
  createDelegation,
  getDelegationStatus,
} from "../../services/delegation.js";
import { resolveEnsAddress } from "../../services/ens.js";
import { authMiddleware } from "../auth.js";

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

export { router as delegationRouter };
