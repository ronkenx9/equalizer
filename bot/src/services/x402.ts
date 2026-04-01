/**
 * x402 Payment Service — Multi-Token Support
 *
 * Generates x402-compatible payment endpoints for deal funding.
 * Supports multiple tokens: ETH, USDC, USDT, DAI, WETH.
 *
 * Two payment paths:
 * 1. x402 agents/wallets → automated HTTP 402 flow
 * 2. Human checkout → React payment portal with token selector
 */

import { config } from "../config.js";
import { convertToTokenAmounts } from "./price.js";
import { SUPPORTED_TOKENS, type TokenConfig } from "./tokens.js";
import type { SupportedChain } from "../types/deal.js";

// x402 network IDs per chain
const CHAIN_NETWORK: Record<SupportedChain, string> = {
  "base-sepolia": "eip155:84532",
  "xlayer": "eip155:196",
  "flow-testnet": "eip155:545",
};

// Native OKB has no ERC-20 address on X Layer
const XLAYER_OKB_PLACEHOLDER = "0x0000000000000000000000000000000000000000";

export interface TokenAmount {
  symbol: string;
  name: string;
  address: string | null;
  decimals: number;
  amount: number;
  rawAmount: string;
  icon: string;
}

interface PendingPayment {
  dealId: string;
  originalAmount: number;
  originalCurrency: string;
  usdValue: number;
  supportedTokens: TokenAmount[];
  createdAt: number;
  expiresAt: number;
}

// Track pending x402 payments
const pendingPayments = new Map<string, PendingPayment>();

// Callbacks for chat notifications
type PaymentCallback = (dealId: string, txHash: string) => void;
let onPaymentReceived: PaymentCallback | null = null;

export function setPaymentCallback(cb: PaymentCallback) {
  onPaymentReceived = cb;
}

/**
 * Generate an x402 payment URL for a deal.
 */
export function generatePaymentUrl(dealId: string): string {
  return `${config.botPublicUrl}/pay/${dealId}`;
}

/**
 * Create a pending payment request for a deal.
 * Converts the deal's native currency to all supported tokens.
 */
export async function createPaymentRequest(
  dealId: string,
  amount: number,
  currency: string
): Promise<{
  paymentUrl: string;
  usdValue: number;
  supportedTokens: TokenAmount[];
}> {
  const { usdValue, tokens } = await convertToTokenAmounts(amount, currency);
  const now = Date.now();

  const supportedTokens: TokenAmount[] = tokens.map((t) => {
    const tokenConfig = SUPPORTED_TOKENS.find(
      (tc) => tc.symbol === t.symbol
    ) as TokenConfig;
    return {
      symbol: tokenConfig.symbol,
      name: tokenConfig.name,
      address: tokenConfig.address,
      decimals: tokenConfig.decimals,
      amount: t.amount,
      rawAmount: t.rawAmount,
      icon: tokenConfig.icon,
    };
  });

  pendingPayments.set(dealId, {
    dealId,
    originalAmount: amount,
    originalCurrency: currency,
    usdValue,
    supportedTokens,
    createdAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000,
  });

  return { paymentUrl: generatePaymentUrl(dealId), usdValue, supportedTokens };
}

export function getPendingPayment(dealId: string) {
  return pendingPayments.get(dealId) ?? null;
}

export function clearPendingPayment(dealId: string) {
  pendingPayments.delete(dealId);
}

/**
 * Get the x402 payment requirements for a deal.
 * Returns multi-token support info in the 402 response.
 */
export function getPaymentRequirements(dealId: string, chain?: SupportedChain) {
  const payment = pendingPayments.get(dealId);
  if (!payment) return null;

  const resolvedChain: SupportedChain = chain ?? "base-sepolia";
  const network = CHAIN_NETWORK[resolvedChain];
  const isXLayer = resolvedChain === "xlayer";

  // X Layer deals use OKB (native); Base Sepolia deals use USDC
  const preferredToken = isXLayer
    ? payment.supportedTokens.find((t) => t.symbol === "OKB") ?? payment.supportedTokens[0]
    : payment.supportedTokens.find((t) => t.symbol === "USDC") ?? payment.supportedTokens[0];

  const contractAddress = isXLayer
    ? config.xlayerEscrowAddress
    : (config.yieldEscrowAddress || config.escrowContractAddress || config.agentWalletAddress);

  const assetAddress = isXLayer
    ? XLAYER_OKB_PLACEHOLDER
    : (preferredToken?.address ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e");

  return {
    scheme: "exact",
    network,
    maxAmountRequired: preferredToken?.rawAmount ?? "0",
    resource: `${config.botPublicUrl}/pay/${dealId}`,
    description: `Fund EQUALIZER Deal #${dealId}`,
    mimeType: "application/json",
    payTo: contractAddress,
    maxTimeoutSeconds: 300,
    asset: assetAddress,
    extra: {
      dealId,
      chain: resolvedChain,
      name: "EQUALIZER Escrow Payment",
      usdValue: payment.usdValue,
      originalAmount: payment.originalAmount,
      originalCurrency: payment.originalCurrency,
      supportedTokens: payment.supportedTokens,
    },
  };
}

/**
 * Mark a payment as settled.
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
  amount: number,
  currency: string,
  brandUsername: string,
  creatorUsername: string
): Promise<{ text: string; paymentUrl: string; usdValue: number }> {
  const { paymentUrl, usdValue, supportedTokens } =
    await createPaymentRequest(dealId, amount, currency);

  const esc = (s: string) =>
    s.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");

  const ethToken = supportedTokens.find((t) => t.symbol === "ETH");
  const usdcToken = supportedTokens.find((t) => t.symbol === "USDC");

  const text =
    `Deal locked in\\. To fund the escrow:\n\n` +
    `💳 *Tap the button below to pay* — choose your token \\(USDC, ETH, USDT, DAI, WETH\\)\n\n` +
    `💰 *Quick amounts:*\n` +
    (usdcToken
      ? `• ${esc(usdcToken.amount.toFixed(2))} USDC\n`
      : "") +
    (ethToken
      ? `• ${esc(ethToken.amount.toFixed(6))} ETH\n`
      : "") +
    `\n≈ \\$${esc(usdValue.toFixed(2))} USD\n\n` +
    `_Your funds go directly into escrow — ` +
    `neither the agent nor ${esc(creatorUsername)} can touch them until delivery\\._`;

  return { text, paymentUrl, usdValue };
}
