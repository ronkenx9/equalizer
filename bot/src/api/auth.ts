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
  (req as any).apiKeyId = entry.id;
  next();
}

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
