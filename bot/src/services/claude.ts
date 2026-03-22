/**
 * AI Inference Layer
 *
 * Groq (Llama 3.3 70B)  → deal detection, delivery eval, monitor, Q&A
 * Venice (private)       → dispute mediation (privacy-preserving)
 * Anthropic Claude       → fallback only if Groq is unavailable
 */

import Groq from "groq-sdk";
import { config } from "../config.js";
import { INTENT_DETECTION_PROMPT } from "../prompts/intent-detection.js";
import { DELIVERY_EVALUATION_PROMPT } from "../prompts/delivery-evaluation.js";
import { DISPUTE_MEDIATION_PROMPT } from "../prompts/dispute-mediation.js";
import { CRITERIA_EXTRACTION_PROMPT } from "../prompts/criteria-extraction.js";
import { DealState, DealTerms, ExtractedCriteria, CriterionResult } from "../types/deal.js";

// ── Groq Client (primary inference) ──────────────────
const groq = new Groq({ apiKey: config.groqApiKey });

const GROQ_MODEL = "llama-3.3-70b-versatile";

async function callGroq(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await groq.chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: 1024,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: 0.3,
  });
  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Empty Groq response");
  return text;
}

// ── Venice Client (private dispute mediation) ────────
async function callVenice(systemPrompt: string, userMessage: string): Promise<string> {
  if (!config.veniceApiKey) {
    console.warn("[AI] Venice API key not set, falling back to Groq for mediation");
    return callGroq(systemPrompt, userMessage);
  }

  const res = await fetch("https://api.venice.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.veniceApiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 1024,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "unknown");
    console.warn(`[AI] Venice failed (${res.status}): ${errBody}, falling back to Groq`);
    return callGroq(systemPrompt, userMessage);
  }

  const data = (await res.json()) as any;
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty Venice response");
  return text;
}

// ── Shared JSON parser ───────────────────────────────
function extractJSON(raw: string): any {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON object found in response");
  return JSON.parse(jsonMatch[0]);
}

// ── Intent Detection (Groq) ─────────────────────────

export interface IntentResult {
  stage: "NOISE" | "SIGNAL" | "CRYSTALLIZED";
  confidence: number;
  terms: {
    deliverable: string;
    price: string;
    currency: string;
    deadline: string;
    disputeWindowSeconds: number;
    brandUsername: string;
    creatorUsername: string;
  } | null;
  missing: string[];
  message: string | null;
}

export async function detectIntent(messages: { user: string; text: string; timestamp?: number }[]): Promise<IntentResult> {
  const transcript = messages.map((m) => `[${new Date(m.timestamp || Date.now()).toISOString()}] ${m.user}: ${m.text}`).join("\n");
  const raw = await callGroq(INTENT_DETECTION_PROMPT, `Conversation History:\n${transcript}`);
  try {
    return extractJSON(raw) as IntentResult;
  } catch {
    return { stage: "NOISE", confidence: 0, terms: null, missing: [], message: null };
  }
}

// ── Delivery Evaluation (Groq) ──────────────────────

interface EvalResult {
  passed: boolean;
  confidence: number;
  reasoning: string;
  flags?: string[];
}

export async function evaluateDelivery(terms: DealTerms, delivery: string): Promise<EvalResult> {
  const message = `Deal Terms:\nDeliverable: ${terms.deliverable}\nPrice: ${terms.price} ${terms.currency}\nDeadline: ${terms.deadline}\n\nSubmitted Delivery:\n${delivery}`;
  const raw = await callGroq(DELIVERY_EVALUATION_PROMPT, message);
  try {
    return extractJSON(raw) as EvalResult;
  } catch {
    return { passed: true, confidence: 0.5, reasoning: "Could not parse evaluation. Defaulting to pass.", flags: undefined };
  }
}

// ── Dispute Mediation (Venice — private inference) ──

interface MediationResult {
  ruling: "release" | "refund" | "split";
  creatorShare: number;
  reasoning: string;
}

export async function mediate(
  terms: DealTerms,
  delivery: string,
  brandEvidence: string,
  creatorEvidence: string
): Promise<MediationResult> {
  const message = [
    `Original Deal Terms:`,
    `Deliverable: ${terms.deliverable}`,
    `Price: ${terms.price} ${terms.currency}`,
    `Deadline: ${terms.deadline}`,
    ``,
    `Submitted Delivery:`,
    delivery,
    ``,
    `Brand's Dispute:`,
    brandEvidence,
    ``,
    `Creator's Defense:`,
    creatorEvidence,
  ].join("\n");

  // Venice for private reasoning — neither party sees the logic
  const raw = await callVenice(DISPUTE_MEDIATION_PROMPT, message);
  try {
    return extractJSON(raw) as MediationResult;
  } catch {
    return { ruling: "split", creatorShare: 50, reasoning: "Could not parse mediation. Defaulting to 50/50 split." };
  }
}

// ── Deal Monitor Decision (Groq) ────────────────────

export interface MonitorDecision {
  observation: string;
  decision: "remind_funding" | "remind_delivery" | "auto_release" | "flag_delivery" | "none";
  action: string;
  message?: string;
}

export async function decideDealAction(deal: DealState): Promise<MonitorDecision> {
  const prompt = `You are the EQUALIZER Deal Monitor Agent. You run autonomously.
Your job is to read the state of a deal, compare it to the current time, and decide if an autonomous action is required.

Rules:
1. If status is "CONFIRMED", and it has been more than 2 hours since createdAt, decision = 'remind_funding'.
2. If status is "FUNDED", estimate the total time from 'fundedAt' to the 'deadline' string and check if we are at or past 80% of that time. If so, decision = 'remind_delivery'.
3. If status is "DISPUTE_WINDOW", and the disputeWindowEnd timestamp is in the past, decision = 'auto_release'.
4. If status is "DELIVERY_SUBMITTED" or inside the dispute window and 'deliveryEvaluation.confidence' is below 0.70, and we haven't flagged it yet, decision = 'flag_delivery'.
5. Otherwise, decision = 'none'.

IMPORTANT: Only send 'remind_funding' or 'remind_delivery' or 'flag_delivery' ONCE. If you observe that the action was already taken recently, or the status progressed, output 'none'.

Current Date/Time: ${new Date().toISOString()}
Current Timestamp: ${Date.now()}

Deal State:
${JSON.stringify(deal, null, 2)}

Respond with JSON only:
{
  "observation": "What do you see?",
  "decision": "remind_funding" | "remind_delivery" | "auto_release" | "flag_delivery" | "none",
  "action": "Description of the action you are taking or 'No action'",
  "message": "If reminding or flagging, what exactly should the bot say in the chat to the parties involved? Keep it professional, and use Telegram MarkdownV2."
}`;

  const raw = await callGroq("You are a helpful JSON-only AI agent.", prompt);
  try {
    return extractJSON(raw) as MonitorDecision;
  } catch {
    return { observation: "Failed to parse decision", decision: "none", action: "Error decoding." };
  }
}

// ── Criteria Extraction (Groq) ──────────────────────
export async function extractCriteria(terms: DealTerms): Promise<ExtractedCriteria> {
  const message = [
    `Deal Description:`,
    `Deliverable: ${terms.deliverable}`,
    `Price: ${terms.price} ${terms.currency}`,
    `Deadline: ${terms.deadline}`,
    `Brand: ${terms.brandUsername}`,
    `Creator: ${terms.creatorUsername}`,
  ].join("\n");

  const raw = await callGroq(CRITERIA_EXTRACTION_PROMPT, message);
  try {
    return extractJSON(raw) as ExtractedCriteria;
  } catch {
    return {
      type: "other",
      platform: null,
      criteria: [
        {
          id: "c1",
          description: `Deliver: ${terms.deliverable}`,
          check_type: "content_match",
          required_value: terms.deliverable,
          required: true,
        },
      ],
      ambiguities: ["Could not extract structured criteria — using deliverable description as single criterion"],
    };
  }
}

// ── Criteria-Based Delivery Evaluation (Groq) ───────
const CRITERIA_EVAL_PROMPT = `You are a delivery evaluator. You are given locked evaluation criteria and a submitted delivery. Check each criterion individually.

RULES:
- Only evaluate against the provided criteria. Do NOT add your own standards.
- Each criterion gets PASS, FAIL, or PARTIAL.
- PASS: criterion is clearly met
- FAIL: criterion is clearly not met
- PARTIAL: criterion is partially met or ambiguous
- Be specific about what was found vs what was required.
- Do NOT judge quality, tone, or creativity unless a criterion explicitly requires it.
- overall is PASS only if ALL required criteria pass.

LENIENT MATCHING RULES (apply these generously):
- "Call to action" or "CTA" criteria: PASS if the delivery contains ANY URL, domain name, "visit [site]", "go to [site]", "check out [site]", "head to [site]", or similar phrasing that directs the reader somewhere. Exact wording does not matter — intent matters.
- "Mention X" criteria: PASS if the concept is present in any reasonable form (e.g. "Base blockchain" matches "Base chain", "built on Base", "the Base network", etc.)
- "Word count" or "minimum words" criteria: Count actual words in the delivery text. Be accurate.
- "Deadline" criteria: Use the provided Delivery Timestamp to check. NEVER say "delivery time unknown" — the timestamp is always provided above.

Respond with valid JSON only:
{
  "overall": "PASS" | "FAIL" | "PARTIAL",
  "confidence": number (0-100),
  "results": [
    {
      "criterion_id": "c1",
      "description": "what was checked",
      "result": "PASS" | "FAIL" | "PARTIAL",
      "found_value": "what was actually found in the delivery",
      "reasoning": "1 sentence explaining the result"
    }
  ],
  "summary": "1-2 sentence plain English summary of the evaluation"
}`;

export async function evaluateDeliveryWithCriteria(
  criteria: ExtractedCriteria,
  delivery: string,
  terms: DealTerms,
  deliveredAtMs?: number
): Promise<{
  overall: "PASS" | "FAIL" | "PARTIAL";
  confidence: number;
  results: CriterionResult[];
  summary: string;
}> {
  const deliveredAtStr = deliveredAtMs
    ? new Date(deliveredAtMs).toISOString()
    : new Date().toISOString();

  const message = [
    `Deliverable Type: ${criteria.type}`,
    criteria.platform ? `Platform: ${criteria.platform}` : "",
    ``,
    `Locked Evaluation Criteria:`,
    ...criteria.criteria.map(
      (c) =>
        `- [${c.id}] ${c.description} (check: ${c.check_type}, required: ${c.required_value}, mandatory: ${c.required})`
    ),
    ``,
    `Deal Terms:`,
    `Deliverable: ${terms.deliverable}`,
    `Deadline: ${terms.deadline}`,
    ``,
    `Delivery Timestamp: ${deliveredAtStr} (this is the exact time the creator submitted — use this for any deadline checks)`,
    ``,
    `Submitted Delivery:`,
    delivery,
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await callGroq(CRITERIA_EVAL_PROMPT, message);
  try {
    const parsed = extractJSON(raw);
    return {
      overall: parsed.overall ?? "PARTIAL",
      confidence: parsed.confidence ?? 50,
      results: parsed.results ?? [],
      summary: parsed.summary ?? "Evaluation completed.",
    };
  } catch {
    return {
      overall: "PARTIAL",
      confidence: 50,
      results: [],
      summary: "Could not parse evaluation. Falling back to manual review.",
    };
  }
}

// Export for any modules that still need raw inference
export { callGroq, callVenice };
