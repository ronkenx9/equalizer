import { config } from "../config.js";
import { PRIVATE_DISPUTE_MEDIATION_PROMPT } from "../prompts/dispute-mediation.js";
import { DealTerms } from "../types/deal.js";

interface PrivateMediationResult {
  ruling: "release" | "refund" | "split";
  creatorShare: number;
  reasoning: string;
  privateReasoning: string;
}

export async function mediatePrivately(
  terms: DealTerms,
  delivery: string,
  brandEvidence: string,
  creatorEvidence: string
): Promise<PrivateMediationResult> {
  const userMessage = [
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

  const response = await fetch("https://api.venice.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.veniceApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b",
      messages: [
        { role: "system", content: PRIVATE_DISPUTE_MEDIATION_PROMPT },
        { role: "user", content: userMessage },
      ],
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Venice API error ${response.status}: ${text}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Venice returned empty response");

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Venice response contained no JSON");

  const parsed = JSON.parse(jsonMatch[0]) as PrivateMediationResult;

  // Validate required fields
  if (!parsed.ruling || typeof parsed.creatorShare !== "number") {
    throw new Error("Venice response missing required fields");
  }

  return {
    ruling: parsed.ruling,
    creatorShare: parsed.creatorShare,
    reasoning: parsed.reasoning || "Ruling issued by private mediation.",
    privateReasoning: parsed.privateReasoning || "No detailed analysis provided.",
  };
}
