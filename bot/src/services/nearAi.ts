import { config } from "../config.js";

/**
 * Register EQUALIZER on the NEAR AI Registry.
 * This provides the bot with a verifiable AI Identity for the hackathon.
 */
export async function registerNearAiIdentity(): Promise<boolean> {
    if (!config.nearAiToken) {
        console.warn("[NEAR AI] No NEAR_AI_TOKEN set, skipping registration");
        return false;
    }

    try {
        console.log("[NEAR AI] Registering agent identity...");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(config.nearAiRegistryUrl, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Authorization': `Bearer ${config.nearAiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: "EQUALIZER",
                description: "Autonomous deal enforcement agent — escrow, mediation, and Filecoin-based archiving.",
                url: config.botPublicUrl,
                category: "finance",
                tags: ["escrow", "mediation", "verifiable"],
                ownerId: config.nearAccountId,
                version: "1.0.0"
            })
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`NEAR AI registration failed (${response.status}): ${errorText}`);
        }

        console.log("[NEAR AI] ✅ Agent identity registered successfully.");
        return true;
    } catch (err: any) {
        console.error("[NEAR AI] ❌ Registration error:", err.message);
        return false;
    }
}
