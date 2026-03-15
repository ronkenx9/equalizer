import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { INTENT_DETECTION_PROMPT } from "../prompts/intent-detection.js";
import { DELIVERY_EVALUATION_PROMPT } from "../prompts/delivery-evaluation.js";
import { DISPUTE_MEDIATION_PROMPT } from "../prompts/dispute-mediation.js";
import { DealTerms } from "../types/deal.js";

const client = new Anthropic({ apiKey: config.claudeApiKey });

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });
  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");
  return block.text;
}

interface IntentResult {
  isDeal: boolean;
  confidence: number;
  terms: {
    deliverable: string;
    price: string;
    currency: string;
    deadline: string;
    brandUsername: string;
    creatorUsername: string;
  } | null;
}

export async function detectIntent(messages: { user: string; text: string }[]): Promise<IntentResult> {
  const transcript = messages.map((m) => `${m.user}: ${m.text}`).join("\n");
  const raw = await callClaude(INTENT_DETECTION_PROMPT, `Conversation:\n${transcript}`);
  try {
    return JSON.parse(raw) as IntentResult;
  } catch {
    return { isDeal: false, confidence: 0, terms: null };
  }
}

interface EvalResult {
  passed: boolean;
  confidence: number;
  reasoning: string;
  flags?: string[];
}

export async function evaluateDelivery(terms: DealTerms, delivery: string): Promise<EvalResult> {
  const message = `Deal Terms:\nDeliverable: ${terms.deliverable}\nPrice: ${terms.price} ${terms.currency}\nDeadline: ${terms.deadline}\n\nSubmitted Delivery:\n${delivery}`;
  const raw = await callClaude(DELIVERY_EVALUATION_PROMPT, message);
  try {
    return JSON.parse(raw) as EvalResult;
  } catch {
    return { passed: true, confidence: 0.5, reasoning: "Could not parse evaluation. Defaulting to pass.", flags: undefined };
  }
}

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

  const raw = await callClaude(DISPUTE_MEDIATION_PROMPT, message);
  try {
    return JSON.parse(raw) as MediationResult;
  } catch {
    return { ruling: "split", creatorShare: 50, reasoning: "Could not parse mediation. Defaulting to 50/50 split." };
  }
}

export { callClaude };
