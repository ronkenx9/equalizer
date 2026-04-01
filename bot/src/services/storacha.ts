import { create } from "@storacha/client";
import { config } from "../config.js";

/**
 * Deal Artifact Interface
 * This is signed and stored permanently on Filecoin via Storacha.
 */
export interface DealArtifact {
    dealId: string;
    partyA: string;
    partyB: string;
    deliverable: string;
    amount: string;
    evaluationResult: any;
    easAttestation: string;
    txHash: string;
    timestamp: number;
    conversationLog: string[];
}

/**
 * Archive a deal artifact to Storacha (Filecoin/IPFS).
 * Returns the CID of the stored JSON object.
 */
export async function archiveDealToStoracha(artifact: DealArtifact): Promise<string> {
    if (!config.storachaApiKey) {
        console.warn("[Storacha] No API key set, skipping archival");
        return "";
    }

    try {
        console.log(`[Storacha] Initiating archival for deal ${artifact.dealId}...`);

        // Initializing the client
        // Note: The library handles principal/agent creation.
        const client = await create();

        // Convert artifact to a File/Blob for upload
        const jsonStr = JSON.stringify(artifact, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const file = new File([blob], `deal-${artifact.dealId}.json`, { type: "application/json" });

        const cid = await client.uploadFile(file as any);

        if (!cid) {
            throw new Error("Upload succeeded but returned no CID");
        }

        console.log(`[Storacha] ✅ Deal ${artifact.dealId} archived. CID: ${cid}`);
        return cid.toString();
    } catch (err: any) {
        console.error(`[Storacha] ❌ Archival failed for deal ${artifact.dealId}:`, err.message);
        return "";
    }
}
