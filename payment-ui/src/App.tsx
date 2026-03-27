import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useSendTransaction,
  useSwitchChain,
} from 'wagmi';
import { type Hex } from 'viem';
import { baseSepolia } from 'wagmi/chains';
import { xlayer } from './main';
import { DelegationStep } from './components/DelegationStep';

const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

interface TokenAmount {
  symbol: string;
  name: string;
  address: string | null;
  decimals: number;
  amount: number;
  rawAmount: string;
  icon: string;
}

function SuccessCheck() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="check-circle">
      <circle cx="32" cy="32" r="30" stroke="#34D399" strokeWidth="2" fill="rgba(52, 211, 153, 0.08)" />
      <path
        d="M20 33L28 41L44 25"
        stroke="#34D399"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className="check-mark"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function ScalesIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-gold)]">
      <path d="M12 3v18" />
      <path d="M5 7l7-4 7 4" />
      <path d="M3 13l2-6 2 6a4 4 0 0 1-4 0z" />
      <path d="M17 13l2-6 2 6a4 4 0 0 1-4 0z" />
    </svg>
  );
}

function formatAmount(amount: number, symbol: string): string {
  if (['ETH', 'WETH', 'DAI'].includes(symbol)) {
    // Show up to 6 decimals, trim trailing zeros
    return amount.toFixed(6).replace(/\.?0+$/, '') || '0';
  }
  return amount.toFixed(2);
}

function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  // ERC20 transfer
  const {
    data: erc20Hash,
    writeContract,
    isPending: isErc20Pending,
    error: erc20Error,
  } = useWriteContract();

  // Native ETH transfer
  const {
    data: ethHash,
    sendTransaction,
    isPending: isEthPending,
    error: ethError,
  } = useSendTransaction();

  // The active tx hash (ERC20 or native)
  const txHash = erc20Hash || ethHash;
  const writeError = erc20Error || ethError;
  const isWritePending = isErc20Pending || isEthPending;

  const { isLoading: isTxConfirming, isSuccess: isTxConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  const [dealId, setDealId] = useState<string | null>(null);
  const [dealData, setDealData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  const [selectedToken, setSelectedToken] = useState<string>('USDC');
  const [delegationSigned, setDelegationSigned] = useState(false);
  const [dealChain, setDealChain] = useState<'base-sepolia' | 'xlayer'>('base-sepolia');

  // Parse supported tokens from deal data
  const supportedTokens: TokenAmount[] = dealData?.extra?.supportedTokens ?? [];
  const usdValue: number = dealData?.extra?.usdValue ?? 0;
  const originalCurrency: string = dealData?.extra?.originalCurrency ?? 'USD';
  const originalAmount: number = dealData?.extra?.originalAmount ?? 0;

  // Get the currently selected token info
  const activeToken = supportedTokens.find((t) => t.symbol === selectedToken) ??
    supportedTokens[0] ?? null;

  // Fallback for old backend (no supportedTokens)
  const legacyAmount = dealData ? parseFloat(dealData.maxAmountRequired) / 1e6 : 0;
  const displayAmount = activeToken ? formatAmount(activeToken.amount, activeToken.symbol) : legacyAmount.toFixed(2);
  const displaySymbol = activeToken?.symbol ?? 'USDC';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('dealId');
    if (!id) {
      setError('No deal ID provided');
      setLoading(false);
      return;
    }
    setDealId(id);

    // Fetch chain info from deposit instructions (lightweight)
    fetch(`/pay/${id}/onchain`)
      .then((r) => r.ok ? r.json() : null)
      .then((info) => { if (info?.chain) setDealChain(info.chain); })
      .catch(() => {});

    fetch(`/pay/${id}`, { headers: { Accept: 'application/json' } })
      .then((res) => {
        if (res.status === 402) return res.json();
        throw new Error('Deal not found or already funded');
      })
      .then((data) => {
        const requirements = data.paymentRequirements?.[0];
        if (!requirements) throw new Error('Missing payment details');
        setDealData(requirements);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Settlement notification
  useEffect(() => {
    if (isTxConfirmed && dealId && !settled) {
      fetch(`/pay/${dealId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash, payload: 'x402_web_checkout' }),
      })
        .then(() => setSettled(true))
        .catch(console.error);
    }
  }, [isTxConfirmed, dealId, txHash, settled]);

  const handlePay = async () => {
    if (!dealData || !dealId) return;

    if (activeToken && activeToken.address === null) {
      // Native token (ETH / OKB) — call createDeal() on the escrow contract
      const res = await fetch(`/pay/${dealId}/onchain`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to fetch deposit instructions' }));
        alert(`Cannot pay right now: ${err.error || 'Try again in a moment'}`);
        return;
      }
      const instructions = await res.json();
      // Sync chain state from instructions
      if (instructions.chain && instructions.chain !== dealChain) {
        setDealChain(instructions.chain);
      }
      sendTransaction({
        to: instructions.to as Hex,
        data: instructions.data as Hex,
        value: BigInt(instructions.value),
      });
    } else {
      // ERC20 — use writeContract with transfer()
      const tokenAddress = activeToken?.address ?? dealData.asset;
      const rawAmount = activeToken?.rawAmount ?? dealData.maxAmountRequired;
      writeContract({
        address: tokenAddress as Hex,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [dealData.payTo as Hex, BigInt(rawAmount)],
      });
    }
  };

  const requiredChainId = dealChain === 'xlayer' ? xlayer.id : baseSepolia.id;
  const requiredChainName = dealChain === 'xlayer' ? 'X Layer' : 'Base Sepolia';
  const isCorrectChain = chainId === requiredChainId;
  const supportsDelegate = dealChain !== 'xlayer';

  // --- Loading state ---
  if (loading) {
    return (
      <>
        <div className="ambient-glow" />
        <div className="payment-card scale-in w-full max-w-[420px] mx-4 p-8">
          <div className="flex items-center justify-center gap-3 mb-8">
            <ScalesIcon />
            <span className="text-lg font-semibold tracking-wide text-[var(--color-gold)]">EQUALIZER</span>
          </div>
          <div className="space-y-4">
            <div className="shimmer h-4 rounded w-1/3 mx-auto" />
            <div className="shimmer h-12 rounded w-2/3 mx-auto" />
            <div className="shimmer h-4 rounded w-1/2 mx-auto" />
          </div>
        </div>
      </>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <>
        <div className="ambient-glow" />
        <div className="payment-card scale-in w-full max-w-[420px] mx-4 p-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <ScalesIcon />
            <span className="text-lg font-semibold tracking-wide text-[var(--color-gold)]">EQUALIZER</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-[var(--color-danger)]/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-[var(--color-danger)] text-xl">!</span>
          </div>
          <p className="text-[var(--color-danger)] text-sm font-medium mb-1">Payment unavailable</p>
          <p className="text-[var(--color-text-muted)] text-xs">{error}</p>
        </div>
      </>
    );
  }

  // --- Success state ---
  if (isTxConfirmed) {
    return (
      <>
        <div className="ambient-glow" />
        <div className="payment-card scale-in w-full max-w-[420px] mx-4 p-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-8">
            <ScalesIcon />
            <span className="text-lg font-semibold tracking-wide text-[var(--color-gold)]">EQUALIZER</span>
          </div>

          <div className="flex justify-center mb-5">
            <SuccessCheck />
          </div>

          <p className="text-[var(--color-success)] text-lg font-semibold mb-1">
            {displayAmount} {displaySymbol} Locked
          </p>
          <p className="text-[var(--color-text-muted)] text-xs mb-6">Escrow funded. Work can begin.</p>

          <div className="bg-[var(--color-card-elevated)] rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="text-[var(--color-text-dim)]">Deal</span>
              <span className="mono text-[var(--color-text-muted)]">#{dealId}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--color-text-dim)]">Transaction</span>
              <a
                href={`https://sepolia.basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mono text-[var(--color-gold)] hover:text-[var(--color-gold-bright)] transition-colors text-[11px]"
              >
                {txHash?.slice(0, 10)}...{txHash?.slice(-6)} ↗
              </a>
            </div>
          </div>

          <p className="text-[var(--color-text-dim)] text-[10px] italic">
            The agent will release funds only after verified delivery.
          </p>
        </div>
      </>
    );
  }

  // --- Main payment state ---
  return (
    <>
      <div className="ambient-glow" />
      <div className="payment-card scale-in w-full max-w-[420px] mx-4">
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <ScalesIcon />
              <span className="text-base font-semibold tracking-wide text-[var(--color-gold)]">EQUALIZER</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] pulse-dot" />
              <span className="text-[10px] text-[var(--color-text-dim)] uppercase tracking-wider">Live</span>
            </div>
          </div>

          {/* Amount */}
          <div className="text-center mb-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-dim)] mb-3">
              Escrow Payment
            </p>
            <div className="flex items-baseline justify-center gap-2">
              <span className="mono text-4xl font-bold text-[var(--color-text)] leading-none">
                {displayAmount}
              </span>
              <span className="text-[var(--color-text-muted)] text-lg font-medium">
                {displaySymbol}
              </span>
            </div>
            {usdValue > 0 && displaySymbol !== 'USDC' && displaySymbol !== 'USDT' && displaySymbol !== 'DAI' && (
              <p className="mono text-[11px] text-[var(--color-text-dim)] mt-2">
                ≈ ${usdValue.toFixed(2)} USD
              </p>
            )}
            {originalCurrency.toUpperCase() !== displaySymbol && (
              <p className="mono text-[11px] text-[var(--color-text-dim)] mt-1">
                Deal price: {originalAmount} {originalCurrency}
              </p>
            )}
          </div>

          {/* Token Selector */}
          {supportedTokens.length > 1 && (
            <div className="mb-6">
              <p className="text-[9px] uppercase tracking-[0.15em] text-[var(--color-text-dim)] mb-2 text-center">
                Pay with
              </p>
              <div className="token-selector">
                {supportedTokens.map((token) => (
                  <button
                    key={token.symbol}
                    onClick={() => setSelectedToken(token.symbol)}
                    className={`token-pill ${selectedToken === token.symbol ? 'token-pill-active' : ''}`}
                  >
                    <span className="token-pill-icon">{token.icon}</span>
                    <span className="token-pill-symbol">{token.symbol}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Deal info */}
        <div className="mx-6 bg-[var(--color-card-elevated)] rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center text-xs mb-2.5">
            <span className="text-[var(--color-text-dim)]">Deal</span>
            <span className="mono text-[var(--color-gold)] font-medium">#{dealId}</span>
          </div>
          {dealData.description && (
            <div className="flex justify-between items-start text-xs">
              <span className="text-[var(--color-text-dim)] shrink-0 mr-4">Description</span>
              <span className="text-[var(--color-text-muted)] text-right text-[11px] leading-relaxed">
                {dealData.description}
              </span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-[var(--color-border)] mx-6" />

        {/* Action area */}
        <div className="p-6">
          {!isConnected ? (
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <button
                  onClick={openConnectModal}
                  className="btn-glow w-full bg-[var(--color-gold)] text-[var(--color-surface)] font-semibold py-3.5 rounded-lg text-sm"
                >
                  Connect Wallet
                </button>
              )}
            </ConnectButton.Custom>
          ) : !isCorrectChain ? (
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                <span className="text-amber-400 text-lg">⚠</span>
              </div>
              <p className="text-amber-400 text-sm font-medium mb-1">Wrong Network</p>
              <p className="text-[var(--color-text-dim)] text-xs mb-3">Switch to {requiredChainName} to continue</p>
              <button
                onClick={() => switchChain({ chainId: requiredChainId })}
                className="btn-glow w-full bg-amber-500 text-black font-semibold py-2.5 rounded-lg text-sm"
              >
                Switch to {requiredChainName}
              </button>
            </div>
          ) : !delegationSigned && supportsDelegate ? (
            <div>
              {/* Step 2: Sign Delegation (before funding) */}
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-gold)]/20 text-[var(--color-gold)] text-[10px] font-bold">2</div>
                  <span className="text-[11px] font-medium text-[var(--color-text-muted)]">Sign Delegation</span>
                </div>
                {dealId && (
                  <DelegationStep
                    dealId={dealId}
                    onSigned={() => setDelegationSigned(true)}
                  />
                )}
              </div>

              {/* Connected wallet info */}
              <div className="flex items-center justify-between mt-4 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
                  <span className="mono text-[10px] text-[var(--color-text-dim)]">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                </div>
                <span className="text-[10px] text-[var(--color-text-dim)]">Base Sepolia</span>
              </div>
            </div>
          ) : (
            <div>
              {/* Step 3: Fund Escrow (after delegation signed) */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-gold)]/20 text-[var(--color-gold)] text-[10px] font-bold">3</div>
                <span className="text-[11px] font-medium text-[var(--color-text-muted)]">Fund Escrow</span>
              </div>
              <button
                onClick={handlePay}
                disabled={isWritePending || isTxConfirming}
                className="btn-glow w-full bg-[var(--color-gold)] text-[var(--color-surface)] font-semibold py-3.5 rounded-lg text-sm flex items-center justify-center gap-2"
              >
                {(isWritePending || isTxConfirming) && <Spinner />}
                <span>
                  {isTxConfirming
                    ? 'Confirming transaction...'
                    : isWritePending
                      ? 'Approve in wallet...'
                      : `Pay ${displayAmount} ${displaySymbol}`}
                </span>
              </button>

              {/* Connected wallet info */}
              <div className="flex items-center justify-between mt-4 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
                  <span className="mono text-[10px] text-[var(--color-text-dim)]">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                </div>
                <span className="text-[10px] text-[var(--color-text-dim)]">Base Sepolia</span>
              </div>
            </div>
          )}

          {/* Error display */}
          {writeError && (
            <div className="mt-4 p-3 bg-[var(--color-danger)]/5 border border-[var(--color-danger)]/20 rounded-lg">
              <p className="text-[var(--color-danger)] text-[11px] line-clamp-2">
                {writeError.message.includes('User rejected')
                  ? 'Transaction rejected in wallet'
                  : writeError.message.slice(0, 120)}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--color-border)] px-6 py-4">
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer select-none">
              <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-dim)]">
                Manual transfer
              </span>
              <svg
                width="12" height="12" viewBox="0 0 12 12" fill="none"
                className="text-[var(--color-text-dim)] transition-transform group-open:rotate-180"
              >
                <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </summary>
            <div className="mt-3 space-y-2">
              <div className="bg-[var(--color-card-elevated)] rounded-lg p-3">
                <p className="text-[9px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1.5">
                  Send {displaySymbol} to
                </p>
                <p className="mono text-[11px] text-[var(--color-gold)] break-all leading-relaxed">
                  {dealData.payTo}
                </p>
              </div>
              {activeToken?.address && (
                <div className="bg-[var(--color-card-elevated)] rounded-lg p-3">
                  <p className="text-[9px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1.5">
                    Token contract
                  </p>
                  <p className="mono text-[11px] text-[var(--color-text-muted)] break-all leading-relaxed">
                    {activeToken.address}
                  </p>
                </div>
              )}
              <p className="text-[9px] text-[var(--color-text-dim)] text-center">
                Base Sepolia · {displayAmount} {displaySymbol}
                {activeToken ? ` · ${activeToken.rawAmount} raw units` : ''}
              </p>
            </div>
          </details>
        </div>

        {/* Trust line */}
        <div className="px-6 pb-5">
          <p className="text-[9px] text-[var(--color-text-dim)] text-center leading-relaxed">
            Funds are held in escrow. Released only after verified delivery.
          </p>
        </div>
      </div>
    </>
  );
}

export default App;
