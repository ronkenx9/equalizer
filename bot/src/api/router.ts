import { Router } from "express";
import { authMiddleware, handleGenerateKey } from "./auth.js";
import { dealsRouter } from "./v1/deals.js";
import { reputationRouter } from "./v1/reputation.js";
import { trustRouter } from "./v1/trust.js";
import { delegationRouter } from "./v1/delegation.js";

const apiRouter = Router();

apiRouter.post("/v1/auth/key", handleGenerateKey);
apiRouter.use("/v1/deals", authMiddleware, dealsRouter);
apiRouter.use("/v1/reputation", authMiddleware, reputationRouter);
apiRouter.use("/v1/trust", authMiddleware, trustRouter);

// Delegation endpoints — GET /status is public, POST /create requires auth (applied inside router)
apiRouter.use("/v1/delegation", delegationRouter);

export { apiRouter };
