import { detectIntent, callClaude, IntentResult } from "./src/services/claude.js";
import { INTENT_DETECTION_PROMPT } from "./src/prompts/intent-detection.js";

const buffer = [
    { user: "@Roninxx", text: "Hey i heard you fo graphic design ?", timestamp: Date.now() - 60000 },
    { user: "@TegaB", text: "Yes I do", timestamp: Date.now() - 50000 },
    { user: "@Roninxx", text: "i want to rebrand my business can you do that ?", timestamp: Date.now() - 40000 },
    { user: "@TegaB", text: "Yes sir I can", timestamp: Date.now() - 30000 },
    { user: "@Roninxx", text: "okay great what is your rate ?", timestamp: Date.now() - 25000 },
    { user: "@TegaB", text: "I charge 200$ but its negotiable", timestamp: Date.now() - 20000 },
    { user: "@Roninxx", text: "alright nice i can do that hows 2 week deadline ?", timestamp: Date.now() - 15000 },
    { user: "@TegaB", text: "Sounds good to me", timestamp: Date.now() - 10000 },
    { user: "@Roninxx", text: "so its a deal ?", timestamp: Date.now() - 5000 },
];

const DEAL_KEYWORDS = /\b(deal|pay|deliver|deliverable|hire|gig|deadline|rate|budget|commission|sponsor|collab|collaboration|campaign|post|tweet|thread|content)\b/i;
const PRICE_PATTERN = /(\$|eth|usdc|usdt|sol|bnb|matic)\s*\d|\d+\s*(\$|eth|usdc|usdt|sol|bnb|matic)/i;

function shouldTriggerDetection(messages: { user: string; text: string }[]): boolean {
    const recent = messages.slice(-5).map((m) => m.text).join(" ");
    return DEAL_KEYWORDS.test(recent) && PRICE_PATTERN.test(recent);
}

async function run() {
    console.log("Analyzing buffer...");

    const triggers = shouldTriggerDetection(buffer);
    console.log("Regex Triggers:", triggers);
    if (!triggers) {
        console.log("Would not trigger Claude.");
        return;
    }

    const transcript = buffer.map((m) => `[${new Date(m.timestamp || Date.now()).toISOString()}] ${m.user}: ${m.text}`).join("\\n");
    const raw = await callClaude(INTENT_DETECTION_PROMPT, `Conversation History:\\n${transcript}`);
    console.log("Raw Response:", raw);

    try {
        console.log("Parsed:", JSON.parse(raw) as IntentResult);
    } catch {
        console.log("Failed to parse JSON.");
    }
}

run().catch(console.error);
