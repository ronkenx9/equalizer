import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { INTENT_DETECTION_PROMPT } from "../prompts/intent-detection.js";
import { DELIVERY_EVALUATION_PROMPT } from "../prompts/delivery-evaluation.js";
import { DISPUTE_MEDIATION_PROMPT } from "../prompts/dispute-mediation.js";
import { DealState, DealTerms } from "../types/deal.js";

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
  const raw = await callClaude(INTENT_DETECTION_PROMPT, `Conversation History:\n${transcript}`);
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found");
    return JSON.parse(jsonMatch[0]) as IntentResult;
  } catch {
    return { stage: "NOISE", confidence: 0, terms: null, missing: [], message: null };
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
    const jsonMatch = raw.match(/\\{[\\s\\S]*\\}/);
    if (!jsonMatch) throw new Error("No JSON object found");
    return JSON.parse(jsonMatch[0]) as EvalResult;
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
    const jsonMatch = raw.match(/\\{[\\s\\S]*\\}/);
    if (!jsonMatch) throw new Error("No JSON object found");
    return JSON.parse(jsonMatch[0]) as MediationResult;
  } catch {
    return { ruling: "split", creatorShare: 50, reasoning: "Could not parse mediation. Defaulting to 50/50 split." };
  }
}

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

IMPORTANT: Only send 'remind_funding' or 'remind_delivery' or 'flag_delivery' ONCE. If you observe that the action was already taken recently, or the status progressed, output 'none'. (We assume you run every 60 seconds, so if it's over the limit, output the action).

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

  const raw = await callClaude("You are a helpful JSON-only AI agent.", prompt);
  try {
    const jsonMatch = raw.match(/\\{[\\s\\S]*\\}/);
    if (!jsonMatch) throw new Error("No JSON object found");
    return JSON.parse(jsonMatch[0]) as MonitorDecision;
  } catch {
    return { observation: "Failed to parse decision", decision: "none", action: "Error decoding." };
  }
}

export { callClaude };
