import { Router } from "express";
import { authMiddleware, handleGenerateKey } from "./auth.js";
import { dealsRouter } from "./v1/deals.js";
import { reputationRouter } from "./v1/reputation.js";

const apiRouter = Router();

apiRouter.post("/v1/auth/key", handleGenerateKey);
apiRouter.use("/v1/deals", authMiddleware, dealsRouter);
apiRouter.use("/v1/reputation", authMiddleware, reputationRouter);

export { apiRouter };
