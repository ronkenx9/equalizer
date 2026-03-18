/**
 * x402 Payment Service
 *
 * Generates x402-compatible payment endpoints for deal funding.
 * When a brand needs to fund an escrow, the bot sends a payment link.
 *
 * Two payment paths:
 * 1. x402 agents/wallets → automated HTTP 402 flow → facilitator settles USDC
 * 2. Manual fallback → brand sends ETH directly to escrow contract
 *
 * The x402 endpoint serves as both:
 * - A resource server for agent-to-agent payments (autonomous AI agents can fund deals)
 * - A payment link for human users (renders a paywall page)
 */

import { config } from "../config.js";
import { getDeal, updateDeal } from "./store.js";
import { DealStatus } from "../types/deal.js";
import { usdToEth } from "./price.js";

// Base Sepolia USDC contract
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// Track pending x402 payments
const pendingPayments = new Map<string, {
  dealId: string;
  amountUsd: number;
  amountUsdc: string; // 6 decimal USDC amount
  createdAt: number;
  expiresAt: number;
}>();

// Callbacks for chat notifications
type PaymentCallback = (dealId: string, txHash: string) => void;
let onPaymentReceived: PaymentCallback | null = null;

export function setPaymentCallback(cb: PaymentCallback) {
  onPaymentReceived = cb;
}

/**
 * Generate an x402 payment URL for a deal.
 * Returns the URL the brand can tap to pay.
 */
export function generatePaymentUrl(dealId: string): string {
  return `${config.botPublicUrl}/pay/${dealId}`;
}

/**
 * Create a pending payment request for a deal.
 * Called when both parties confirm and brand is ready to fund.
 */
export function createPaymentRequest(dealId: string, amountUsd: number): {
  paymentUrl: string;
  amountUsd: number;
  amountUsdc: string;
} {
  const amountUsdc = (amountUsd * 1e6).toString(); // USDC has 6 decimals
  const now = Date.now();

  pendingPayments.set(dealId, {
    dealId,
    amountUsd,
    amountUsdc,
    createdAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000, // 24h expiry
  });

  return {
    paymentUrl: generatePaymentUrl(dealId),
    amountUsd,
    amountUsdc,
  };
}

export function getPendingPayment(dealId: string) {
  return pendingPayments.get(dealId) ?? null;
}

export function clearPendingPayment(dealId: string) {
  pendingPayments.delete(dealId);
}

/**
 * Get the x402 payment requirements for a deal.
 * This is what gets returned in the 402 response headers.
 */
export function getPaymentRequirements(dealId: string) {
  const payment = pendingPayments.get(dealId);
  if (!payment) return null;

  // x402 payment requirement format
  return {
    scheme: "exact",
    network: "eip155:84532", // Base Sepolia
    maxAmountRequired: payment.amountUsdc,
    resource: `${config.botPublicUrl}/pay/${dealId}`,
    description: `Fund EQUALIZER Deal #${dealId}`,
    mimeType: "application/json",
    payTo: config.agentWalletAddress || config.escrowContractAddress,
    maxTimeoutSeconds: 300,
    asset: USDC_BASE_SEPOLIA,
    extra: {
      dealId,
      name: "EQUALIZER Escrow Payment",
    },
  };
}

/**
 * Mark a payment as settled (called after x402 facilitator confirms).
 */
export function markPaymentSettled(dealId: string, txHash: string) {
  clearPendingPayment(dealId);
  if (onPaymentReceived) {
    onPaymentReceived(dealId, txHash);
  }
}

/**
 * Get a human-readable payment summary for the bot to send in chat.
 */
export async function getPaymentMessage(
  dealId: string,
  amountUsd: number,
  brandUsername: string,
  creatorUsername: string
): Promise<{ text: string; paymentUrl: string }> {
  const { paymentUrl } = createPaymentRequest(dealId, amountUsd);
  const { ethAmount, ethPrice } = await usdToEth(amountUsd);

  const esc = (s: string) => s.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");

  const text =
    `Deal locked in\\. To fund the escrow:\n\n` +
    `💳 *Pay with USDC \\(recommended\\)* — tap the button below\n\n` +
    `💰 *Or send ETH directly:*\n` +
    `${esc(ethAmount)} ETH \\(≈ \\$${esc(String(amountUsd))} @ \\$${esc(ethPrice.toLocaleString())}/ETH\\)\n\n` +
    `_Your funds go directly into the escrow contract — ` +
    `neither the agent nor ${esc(creatorUsername)} can touch them until delivery\\._`;

  return { text, paymentUrl };
}
