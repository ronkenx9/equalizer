/**
 * OKX Onchain OS Integration
 *
 * Wraps 4 Onchain OS skills:
 *   - okx-onchain-gateway  → tx simulation + broadcast (X Layer native)
 *   - okx-agentic-wallet   → agent OKB balance check before release/refund
 *   - okx-wallet-portfolio → brand wallet balance check before payment link
 *   - okx-security         → pre-execution safety scan
 *
 * All functions are ADDITIVE — they never replace existing viem logic.
 * If credentials are missing or the API fails, functions return null
 * and the caller falls back to the existing viem path silently.
 */

import crypto from "crypto";
import { config } from "../config.js";

const BASE_URL = "https://web3.okx.com";

// X Layer mainnet chainIndex used by OKX APIs
const XLAYER_CHAIN_INDEX = "196";

// ── Auth ──────────────────────────────────────────────

function buildHeaders(method: string, path: string, body: string = ""): Record<string, string> {
    const apiKey = config.xlayerDeveloperKey;
    const secretKey = config.xlayerSecretKey;
    const passphrase = config.okxPassphrase;

    // If no credentials, return empty — caller handles gracefully
    if (!apiKey || !secretKey || !passphrase) return {};

    const timestamp = new Date().toISOString();
    const preHash = timestamp + method.toUpperCase() + path + (body || "");
    const sign = crypto
        .createHmac("sha256", secretKey)
        .update(preHash)
        .digest("base64");

    return {
        "Content-Type": "application/json",
        "OK-ACCESS-KEY": apiKey,
        "OK-ACCESS-SIGN": sign,
        "OK-ACCESS-TIMESTAMP": timestamp,
        "OK-ACCESS-PASSPHRASE": passphrase,
    };
}

function hasCredentials(): boolean {
    return !!(config.xlayerDeveloperKey && config.xlayerSecretKey && config.okxPassphrase);
}

async function okxGet(path: string): Promise<any | null> {
    if (!hasCredentials()) return null;
    try {
        const headers = buildHeaders("GET", path);
        const res = await fetch(`${BASE_URL}${path}`, { headers, signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const json = await res.json() as any;
        return json?.data ?? null;
    } catch {
        return null;
    }
}

async function okxPost(path: string, body: object): Promise<any | null> {
    if (!hasCredentials()) return null;
    try {
        const bodyStr = JSON.stringify(body);
        const headers = buildHeaders("POST", path, bodyStr);
        const res = await fetch(`${BASE_URL}${path}`, {
            method: "POST",
            headers,
            body: bodyStr,
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return null;
        const json = await res.json() as any;
        return json?.data ?? null;
    } catch {
        return null;
    }
}

// ── okx-onchain-gateway: Gas + Simulation + Broadcast ─

/**
 * Get current gas price on X Layer via Onchain Gateway.
 * Returns gwei string or null if unavailable.
 */
export async function getXLayerGasPrice(): Promise<string | null> {
    const path = `/api/v5/wallet/pre-transaction/gas-price?chainIndex=${XLAYER_CHAIN_INDEX}`;
    const data = await okxGet(path);
    if (!data?.[0]?.normalGasPrice) return null;
    return data[0].normalGasPrice;
}

/**
 * Simulate a transaction on X Layer before broadcasting.
 * Returns { success: boolean, errorMsg?: string } or null if check unavailable.
 */
export async function simulateTransaction(
    fromAddress: string,
    toAddress: string,
    data: string,
    value: string = "0"
): Promise<{ success: boolean; errorMsg?: string } | null> {
    const path = "/api/v5/wallet/pre-transaction/transaction-simulate";
    const result = await okxPost(path, {
        chainIndex: XLAYER_CHAIN_INDEX,
        fromAddr: fromAddress,
        toAddr: toAddress,
        txAmount: value,
        extJson: { calldata: data },
    });

    if (!result?.[0]) return null;
    const { executeResult, executeErrorMsg } = result[0];
    return {
        success: executeResult === true,
        errorMsg: executeErrorMsg || undefined,
    };
}

/**
 * Broadcast a signed transaction on X Layer via Onchain Gateway.
 * Returns orderId for tracking, or null if broadcast failed.
 */
export async function broadcastTransaction(
    signedTx: string,
    fromAddress: string
): Promise<string | null> {
    const path = "/api/v5/wallet/pre-transaction/broadcast-transaction";
    const result = await okxPost(path, {
        signedTx,
        chainIndex: XLAYER_CHAIN_INDEX,
        accountId: fromAddress,
    });
    return result?.[0]?.orderId ?? null;
}

// ── okx-agentic-wallet: Agent Balance Check ──────────

/**
 * Check the EQUALIZER agent wallet OKB balance on X Layer mainnet.
 * Returns OKB balance as string, or null if check unavailable.
 */
export async function getAgentOKBBalance(agentAddress: string): Promise<string | null> {
    const path = `/api/v5/wallet/asset/wallet-asset-detail?address=${agentAddress}&chains=${XLAYER_CHAIN_INDEX}`;
    const data = await okxGet(path);

    // Find native OKB token (empty tokenAddress = native coin)
    const native = data?.[0]?.tokenAssets?.find(
        (t: any) => !t.tokenAddress || t.symbol === "OKB"
    );
    return native?.balance ?? null;
}

/**
 * Returns true if the agent has enough OKB for gas operations.
 * Threshold: 0.001 OKB (enough for several txs — X Layer has very low gas).
 */
export async function agentHasSufficientGas(agentAddress: string): Promise<boolean | null> {
    const balance = await getAgentOKBBalance(agentAddress);
    if (balance === null) return null; // Unknown — caller proceeds anyway
    return parseFloat(balance) >= 0.001;
}

// ── okx-wallet-portfolio: Brand Balance Check ────────

/**
 * Get OKB balance for any public wallet address on X Layer.
 * Used to warn brands if they have insufficient OKB before generating a payment link.
 */
export async function getBrandOKBBalance(walletAddress: string): Promise<string | null> {
    const path = `/api/v5/wallet/asset/all-token-balances-by-address?address=${walletAddress}&chains=${XLAYER_CHAIN_INDEX}`;
    const data = await okxGet(path);

    const native = data?.[0]?.tokenAssets?.find(
        (t: any) => !t.tokenAddress || t.symbol === "OKB"
    );
    return native?.balance ?? null;
}

// ── okx-security: Pre-execution Safety Scan ──────────

/**
 * Run a security pre-execution check before release/refund.
 * Returns { safe: boolean, riskAction?: string, message?: string } or null.
 *
 * riskAction: "block" | "warn" | "" (safe)
 */
export async function preExecutionCheck(
    fromAddress: string,
    toAddress: string,
    calldata: string,
    value: string = "0"
): Promise<{ safe: boolean; riskAction?: string; message?: string } | null> {
    const path = "/api/v5/wallet/security/pre-execute-check";
    const result = await okxPost(path, {
        chainIndex: XLAYER_CHAIN_INDEX,
        fromAddr: fromAddress,
        toAddr: toAddress,
        txAmount: value,
        inputData: calldata,
    });

    if (!result?.[0]) return null;
    const { action, riskItemDetail } = result[0];

    // action: "block" = stop, "warn" = show warning, "" = safe
    return {
        safe: action !== "block",
        riskAction: action || "",
        message: riskItemDetail?.[0]?.description ?? undefined,
    };
}

// ── Composite: Full Pre-flight Check ─────────────────

/**
 * Run all pre-flight checks before a release or refund on X Layer.
 * Returns a status object. If all checks pass (or are unavailable), proceed.
 *
 * Usage in chain.ts:
 *   const preflight = await runXLayerPreflight(agentAddr, contractAddr, calldata);
 *   if (preflight && !preflight.safe) throw new Error(preflight.reason);
 *   // then proceed with wallet.writeContract(...)
 */
export async function runXLayerPreflight(
    agentAddress: string,
    contractAddress: string,
    calldata: string,
    valueWei: string = "0"
): Promise<{ safe: boolean; reason?: string } | null> {
    // Run gas check + security check in parallel (non-blocking)
    const [gasOk, security] = await Promise.all([
        agentHasSufficientGas(agentAddress),
        preExecutionCheck(agentAddress, contractAddress, calldata, valueWei),
    ]);

    // Gas check failed and we got a definitive answer
    if (gasOk === false) {
        return { safe: false, reason: "Agent wallet has insufficient OKB for gas. Top up and retry." };
    }

    // Security check returned a hard block
    if (security && !security.safe && security.riskAction === "block") {
        return { safe: false, reason: `Security check blocked tx: ${security.message ?? "unknown risk"}` };
    }

    // Warn but don't block on "warn" action — log it
    if (security?.riskAction === "warn") {
        console.warn(`[OnchainOS] Security warning on preflight: ${security.message}`);
    }

    return { safe: true };
}
