import { Router, Request, Response } from "express";
import { getWalletReputation } from "../../services/reputation.js";

const router = Router();

router.get("/:walletAddress", (req: Request, res: Response): void => {
  const walletAddress = req.params.walletAddress as string;

  if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    res.status(400).json({ error: "Invalid wallet address format" });
    return;
  }

  const reputation = getWalletReputation(walletAddress);
  res.json(reputation);
});

export { router as reputationRouter };
