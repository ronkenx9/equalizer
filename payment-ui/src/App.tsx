import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { type Hex } from 'viem';
import { baseSepolia } from 'wagmi/chains';

// Minimal ABI for USDC transfer
const USDC_ABI = [
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

const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: hash, writeContract, isPending: isWritePending, error: writeError } = useWriteContract();
  const { isLoading: isTxConfirming, isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({ hash });

  const [dealId, setDealId] = useState<string | null>(null);
  const [dealData, setDealData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('dealId');
    if (!id) {
      setError('No Deal ID found in URL. Use ?dealId=XYZ');
      setLoading(false);
      return;
    }
    setDealId(id);

    // Fetch deal data from the bot API
    fetch(`/pay/${id}`, {
      headers: { 'Accept': 'application/json' }
    })
      .then(res => {
        if (res.status === 402) return res.json();
        throw new Error('Could not load deal details');
      })
      .then(data => {
        const requirements = data.paymentRequirements?.[0];
        if (!requirements) throw new Error('Missing payment requirements');
        setDealData(requirements);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Tell the bot when settlement is complete
  useEffect(() => {
    if (isTxConfirmed && dealId && !settled) {
      fetch(`/pay/${dealId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: hash, payload: 'x402_web_checkout' })
      })
        .then(() => setSettled(true))
        .catch(console.error);
    }
  }, [isTxConfirmed, dealId, hash, settled]);

  const handlePay = () => {
    if (!dealData || !dealId) return;

    writeContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [dealData.payTo as Hex, BigInt(dealData.maxAmountRequired)],
    });
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading deal...</div>;
  if (error) return <div className="flex items-center justify-center min-h-screen text-red-500">{error}</div>;

  const isCorrectChain = chainId === baseSepolia.id;

  return (
    <div className="flex items-center justify-center min-h-screen w-full px-4">
      <div className="bg-[#12121F] border border-[#D4A017]/30 rounded-lg p-10 max-w-md w-full text-center shadow-2xl">
        <div className="font-serif text-2xl text-[#C9A95A] tracking-[0.15em] mb-6">EQUALIZER</div>

        <div className="inline-block px-3 py-1 bg-[#D4A017]/10 border border-[#D4A017]/30 rounded text-[11px] text-[#D4A017] mb-4 uppercase">
          x402 Payment Portal
        </div>

        <div className="text-[12px] uppercase tracking-widest text-[#E8E4D9]/50 mb-2">Escrow Funding</div>
        <div className="text-5xl font-bold text-[#D4A017] my-5">
          ${(parseFloat(dealData.maxAmountRequired) / 1e6).toLocaleString()}
        </div>

        <div className="text-sm text-[#E8E4D9]/70 mb-6 leading-relaxed">
          <strong className="text-[#E8E4D9]">Deal #{dealId}</strong><br />
          {dealData.description}
        </div>

        <div className="h-[1px] bg-white/10 my-6"></div>

        {!isConnected ? (
          <div className="flex justify-center">
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <button
                  onClick={openConnectModal}
                  className="w-full bg-[#D4A017] hover:bg-[#B88A14] text-white font-bold py-4 rounded transition-all shadow-lg active:scale-95"
                >
                  Connect Wallet to Pay
                </button>
              )}
            </ConnectButton.Custom>
          </div>
        ) : !isCorrectChain ? (
          <div className="text-amber-500 text-sm mb-4">Please switch to Base Sepolia</div>
        ) : isTxConfirmed ? (
          <div className="space-y-4">
            <div className="text-4xl">✅</div>
            <div className="text-xl font-bold text-green-500">${(parseFloat(dealData.maxAmountRequired) / 1e6).toLocaleString()} locked.</div>
            <div className="text-sm text-[#E8E4D9]/50">Work can begin.</div>
            <a
              href={`https://sepolia.basescan.org/tx/${hash}`}
              target="_blank"
              className="text-[#4A9EFF] text-xs hover:underline block"
            >
              View on BaseScan
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={handlePay}
              disabled={isWritePending || isTxConfirming}
              className={`w-full font-bold py-4 rounded transition-all shadow-lg active:scale-95 flex items-center justify-center space-x-2 ${isWritePending || isTxConfirming
                ? 'bg-[#D4A017]/50 cursor-not-allowed'
                : 'bg-[#D4A017] hover:bg-[#B88A14] text-white'
                }`}
            >
              {(isWritePending || isTxConfirming) && (
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <span>
                {isTxConfirming
                  ? 'Locking funds in escrow...'
                  : isWritePending
                    ? 'Confirm in Wallet...'
                    : `Pay $${(parseFloat(dealData.maxAmountRequired) / 1e6).toLocaleString()} USDC → Lock in Escrow`}
              </span>
            </button>
            <div className="text-[10px] text-[#E8E4D9]/40 flex justify-between items-center px-2">
              <span>Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</span>
              <span className="text-[#4A9EFF]">Base Sepolia</span>
            </div>
          </div>
        )}

        {writeError && (
          <div className="text-red-500 text-[10px] mt-4 line-clamp-2">
            Error: {writeError.message}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-white/5">
          <details className="text-left group cursor-pointer">
            <summary className="text-[10px] uppercase tracking-widest text-[#E8E4D9]/30 list-none flex justify-between">
              <span>Manual Transfer Details</span>
              <span className="group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="mt-4 p-3 bg-black/40 rounded text-[10px] break-all text-[#4A9EFF]">
              {dealData.payTo}
            </div>
            <div className="mt-2 text-[9px] text-[#E8E4D9]/20 text-center">
              Base Sepolia · USDC · Chain ID 84532
            </div>
          </details>
        </div>

        <div className="text-[10px] text-[#E8E4D9]/20 mt-6 leading-relaxed italic">
          Funds go directly into the escrow smart contract.<br />
          The agent triggers release only after verified delivery.
        </div>
      </div>
    </div>
  );
}

export default App;
