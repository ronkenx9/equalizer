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

// Delegation endpoints — GET /status is public (no auth), POST /create requires auth
// Mount the full router at /v1/delegation; auth is applied per-route inside the router
// but we apply authMiddleware only on POST here via a targeted route before the router mount.
apiRouter.post("/v1/delegation/create", authMiddleware, (req, res, next) => next());
apiRouter.use("/v1/delegation", delegationRouter);

export { apiRouter };
