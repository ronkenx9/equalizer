import { detectIntent } from "./src/services/claude.js";

const buffer = [
    { user: "@Roninxx", text: "i want to rebrand my business can you do that ?", timestamp: Date.now() - 40000 },
    { user: "@TegaB", text: "Yes I can my rate is 200$", timestamp: Date.now() - 30000 },
    { user: "@Roninxx", text: "okay hows a 2 week timeline for you ?", timestamp: Date.now() - 20000 },
    { user: "@TegaB", text: "Sounds good", timestamp: Date.now() - 10000 },
    { user: "@Roninxx", text: "its a deal then", timestamp: Date.now() - 5000 },
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

    const result = await detectIntent(buffer);
    console.log("Result:", JSON.stringify(result, null, 2));
}

run().catch(console.error);
