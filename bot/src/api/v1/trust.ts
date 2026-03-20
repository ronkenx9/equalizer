import { Router, Request, Response } from "express";
import { createHash } from "crypto";
import { getWalletReputation } from "../../services/reputation.js";
import { resolveEnsAddress } from "../../services/ens.js";

const router = Router();

router.post("/verify", async (req: Request, res: Response): Promise<void> => {
  const { deal_terms, party_a, party_b } = req.body as {
    deal_terms?: string;
    party_a?: string;
    party_b?: string;
  };

  if (!deal_terms || !party_a || !party_b) {
    res.status(400).json({
      error: "Missing required fields: deal_terms, party_a, party_b",
    });
    return;
  }

  // Compute SHA-256 of deal terms
  const terms_hash = createHash("sha256").update(deal_terms).digest("hex");

  // Resolve ENS names if needed
  let resolvedPartyA = party_a;
  if (party_a.includes(".")) {
    const resolved = await resolveEnsAddress(party_a);
    if (!resolved) {
      res.status(400).json({ error: `Could not resolve ENS name: ${party_a}` });
      return;
    }
    resolvedPartyA = resolved;
  }

  let resolvedPartyB = party_b;
  if (party_b.includes(".")) {
    const resolved = await resolveEnsAddress(party_b);
    if (!resolved) {
      res.status(400).json({ error: `Could not resolve ENS name: ${party_b}` });
      return;
    }
    resolvedPartyB = resolved;
  }

  // Fetch reputation for both parties
  const reputationA = getWalletReputation(resolvedPartyA);
  const reputationB = getWalletReputation(resolvedPartyB);

  res.status(200).json({
    trust_required: false,
    enforcement_mechanism: "onchain_escrow",
    terms_locked_before_work: true,
    terms_hash,
    arbitration_model: "specificity_not_quality",
    dispute_requires: "reference_to_locked_criteria",
    default_on_silence: "payment_to_worker",
    reputation: {
      party_a: reputationA,
      party_b: reputationB,
    },
    philosophy:
      "EQUALIZER makes trust unnecessary. The math enforces what both parties agreed to before either had reason to lie.",
  });
});

export { router as trustRouter };
