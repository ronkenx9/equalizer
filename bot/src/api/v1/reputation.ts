import { Router, Request, Response } from "express";
import { getWalletReputation } from "../../services/reputation.js";
import { resolveEnsAddress, resolveEnsName } from "../../services/ens.js";

const router = Router();

router.get("/:walletAddress", async (req: Request, res: Response): Promise<void> => {
  let walletAddress = req.params.walletAddress as string;

  // Accept ENS names (anything containing a dot, e.g. vitalik.eth)
  if (walletAddress.includes(".")) {
    const resolved = await resolveEnsAddress(walletAddress);
    if (!resolved) {
      res.status(400).json({ error: `Could not resolve ENS name: ${walletAddress}` });
      return;
    }
    walletAddress = resolved;
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    res.status(400).json({ error: "Invalid wallet address format" });
    return;
  }

  const reputation = getWalletReputation(walletAddress);

  // Resolve ENS name for the address (graceful — may be null)
  const ensName = await resolveEnsName(walletAddress);

  res.json({ ...reputation, ensName });
});

export { router as reputationRouter };
