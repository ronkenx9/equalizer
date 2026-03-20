/**
 * Live ETH/USD price feed using CoinGecko free API.
 * Caches price for 60 seconds to avoid rate limits.
 */

import { SUPPORTED_TOKENS } from "./tokens.js";

let cachedPrice: { ethUsd: number; fetchedAt: number } | null = null;
const CACHE_TTL = 60_000; // 1 minute

export async function getEthUsdPrice(): Promise<number> {
  // Return cached price if fresh
  if (cachedPrice && Date.now() - cachedPrice.fetchedAt < CACHE_TTL) {
    return cachedPrice.ethUsd;
  }

  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { signal: AbortSignal.timeout(10_000) }
    );

    if (!res.ok) throw new Error(`CoinGecko API ${res.status}`);

    const data = (await res.json()) as { ethereum: { usd: number } };
    const price = data.ethereum.usd;

    cachedPrice = { ethUsd: price, fetchedAt: Date.now() };
    console.log(`[Price] ETH/USD: $${price}`);
    return price;
  } catch (err: any) {
    console.warn(`[Price] CoinGecko failed: ${err.message}`);

    // Return stale cache if available
    if (cachedPrice) {
      console.warn(`[Price] Using stale cached price: $${cachedPrice.ethUsd}`);
      return cachedPrice.ethUsd;
    }

    // Last resort fallback
    console.warn("[Price] No cached price, using fallback $3500");
    return 3500;
  }
}

/**
 * Convert a USD amount to ETH using live market price.
 * Returns the ETH amount as a string with 6 decimal places.
 */
export async function usdToEth(usdAmount: number): Promise<{ ethAmount: string; ethPrice: number }> {
  const ethPrice = await getEthUsdPrice();
  const ethAmount = usdAmount / ethPrice;
  return {
    ethAmount: ethAmount.toFixed(6),
    ethPrice,
  };
}

/**
 * Convert a deal amount (in any currency) to USD value,
 * then compute the equivalent amount for each supported token.
 */
export async function convertToTokenAmounts(
  amount: number,
  currency: string
): Promise<{
  usdValue: number;
  tokens: { symbol: string; amount: number; rawAmount: string }[];
}> {
  const ethPrice = await getEthUsdPrice();

  // Step 1: Convert deal amount to USD
  let usdValue: number;
  const cur = currency.toUpperCase().replace("$", "USD");

  if (cur === "ETH" || cur === "WETH") {
    usdValue = amount * ethPrice;
  } else if (["USD", "USDC", "USDT", "DAI"].includes(cur)) {
    usdValue = amount;
  } else {
    // Unknown currency — treat as USD
    usdValue = amount;
  }

  // Step 2: For each supported token, calculate the equivalent amount
  const tokens = SUPPORTED_TOKENS.map((token) => {
    let tokenAmount: number;

    if (token.coingeckoId === "ethereum") {
      // ETH or WETH — divide USD by ETH price
      tokenAmount = usdValue / ethPrice;
    } else {
      // Stablecoin — 1:1 with USD
      tokenAmount = usdValue;
    }

    // Calculate raw amount with proper decimals
    const rawAmount = BigInt(
      Math.round(tokenAmount * 10 ** token.decimals)
    ).toString();

    return { symbol: token.symbol, amount: tokenAmount, rawAmount };
  });

  return { usdValue, tokens };
}
