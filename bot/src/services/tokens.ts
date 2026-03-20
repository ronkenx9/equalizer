/**
 * Supported payment tokens on Base Sepolia.
 * Add new tokens here to enable them across the payment system.
 */

export interface TokenConfig {
  symbol: string;
  name: string;
  address: string | null; // null = native ETH
  decimals: number;
  coingeckoId: string | null; // null = stablecoin pegged at $1
  icon: string;
}

export const SUPPORTED_TOKENS: TokenConfig[] = [
  {
    symbol: "ETH",
    name: "Ether",
    address: null,
    decimals: 18,
    coingeckoId: "ethereum",
    icon: "⟠",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    decimals: 6,
    coingeckoId: null,
    icon: "💲",
  },
  {
    symbol: "USDT",
    name: "Tether",
    address: "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06",
    decimals: 6,
    coingeckoId: null,
    icon: "💵",
  },
  {
    symbol: "DAI",
    name: "Dai",
    address: "0x7683022d84F726a96c4A6611cD31DBf5409c0Ac9",
    decimals: 18,
    coingeckoId: null,
    icon: "◆",
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0x4200000000000000000000000000000000000006",
    decimals: 18,
    coingeckoId: "ethereum",
    icon: "⟠",
  },
];

export function getTokenBySymbol(symbol: string): TokenConfig | undefined {
  return SUPPORTED_TOKENS.find(
    (t) => t.symbol.toUpperCase() === symbol.toUpperCase()
  );
}

export function getAllTokens(): TokenConfig[] {
  return SUPPORTED_TOKENS;
}
