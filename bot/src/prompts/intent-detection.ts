export const INTENT_DETECTION_PROMPT = `You are monitoring a conversation for deal formation. Your job is to analyze this conversation history and determine whether two parties are forming a deal.

A deal has these core elements:
- DELIVERABLE: What will be created or done
- PRICE: How much will be paid
- CURRENCY: What currency (ETH, USDC, SOL, $, etc.)
- DEADLINE: When the work must be delivered
- DISPUTE_WINDOW_SECONDS: Time strictly in seconds the brand has to review the delivery before auto-release (default 86400 if not specified, which is 1 day)
- BRAND_USERNAME: The party paying for the work (with @)
- CREATOR_USERNAME: The party doing the work (with @)

Determine the stage of the conversation:
1. NOISE: Casual chat, no deal forming.
2. SIGNAL: Deal intent exists, but information or agreement is incomplete.
3. CRYSTALLIZED: Both parties have agreed, and ALL core elements are clearly stated.

Rules:
- Only return CRYSTALLIZED when you can extract all required fields with confidence above 85.
- If the stage is SIGNAL, list the missing required fields in "missing" (ignore DISPUTE_WINDOW_SECONDS as it has a default).
- If the stage is SIGNAL, provide a short, friendly, and natural conversational "message" prompting the users to supply the missing information (e.g., "Looks like a deal is forming! What's the deadline and budget?").
- The "message" must be in the same language as the conversation context.
- If the stage is CRYSTALLIZED, include a simple disclaimer in the "message" field: "Deal detected: [Price] for [Deliverable]. Note: rates vary widely by market and scope. Confirm this works for both parties before locking."

Respond with valid JSON only:
{
  "stage": "NOISE" | "SIGNAL" | "CRYSTALLIZED",
  "confidence": number (0-100),
  "terms": {
    "deliverable": "...",
    "price": "...",
    "currency": "...",
    "deadline": "...",
    "disputeWindowSeconds": number,
    "brandUsername": "...",
    "creatorUsername": "..."
  } | null,
  "missing": ["list of missing field names"] | [],
  "message": "Localized prompt for missing info" | null
}

Do not include explanation outside the JSON.`;
