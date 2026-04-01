import { createHmac } from "crypto";

export type WebhookEvent =
  | "deal.funded"
  | "deal.delivery_submitted"
  | "deal.evaluation_complete"
  | "deal.payment_released"
  | "deal.completed"
  | "deal.disputed"
  | "deal.dispute_resolved";

interface WebhookPayload {
  event: WebhookEvent;
  deal_id: string;
  timestamp: number;
  [key: string]: any;
}

interface WebhookLog {
  event: WebhookEvent;
  deal_id: string;
  url: string;
  status: number | null;
  attempt: number;
  timestamp: number;
  error?: string;
}

const webhookLogs: WebhookLog[] = [];
const MAX_RETRIES = 3;
const TIMEOUT_MS = 5000;

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export async function fireWebhook(
  url: string,
  secret: string,
  payload: WebhookPayload
): Promise<void> {
  const body = JSON.stringify(payload);
  const signature = signPayload(body, secret);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Equalizer-Signature": signature,
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      webhookLogs.push({
        event: payload.event,
        deal_id: payload.deal_id,
        url,
        status: res.status,
        attempt,
        timestamp: Date.now(),
      });

      if (res.ok) {
        console.log(`[Webhook] ${payload.event} delivered to ${url} (attempt ${attempt})`);
        return;
      }

      console.warn(`[Webhook] ${payload.event} got ${res.status} from ${url} (attempt ${attempt})`);
    } catch (err: any) {
      webhookLogs.push({
        event: payload.event,
        deal_id: payload.deal_id,
        url,
        status: null,
        attempt,
        timestamp: Date.now(),
        error: err.message,
      });
      console.warn(`[Webhook] ${payload.event} failed (attempt ${attempt}): ${err.message}`);
    }
  }

  console.error(`[Webhook] ${payload.event} exhausted ${MAX_RETRIES} retries for ${url}`);
}

export function notifyWebhook(
  webhookUrl: string | undefined,
  webhookSecret: string | undefined,
  payload: WebhookPayload
): void {
  if (!webhookUrl) return;
  const secret = webhookSecret || "default-secret";
  fireWebhook(webhookUrl, secret, payload).catch((err) =>
    console.error(`[Webhook] Unexpected error:`, err)
  );
}

export function getWebhookLogs(): WebhookLog[] {
  return webhookLogs.slice(-100);
}
