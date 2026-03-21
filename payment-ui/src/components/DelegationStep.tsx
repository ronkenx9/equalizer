import { useDelegation, type DelegationStatus } from "../hooks/useDelegation";

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

interface DelegationStepProps {
  dealId: string;
  onSigned: () => void;
}

export function DelegationStep({ dealId, onSigned }: DelegationStepProps) {
  const { status, error, delegationHash, signDelegation } = useDelegation();

  const handleSign = async () => {
    await signDelegation(dealId);
  };

  // Auto-notify parent when signed
  if (status === "signed") {
    // Defer to avoid setState during render
    setTimeout(() => onSigned(), 0);
  }

  const statusLabel: Record<DelegationStatus, string> = {
    idle: "Sign Delegation",
    loading: "Preparing delegation...",
    signing: "Sign in wallet...",
    signed: "Delegation signed",
    error: "Try again",
  };

  const isActionable = status === "idle" || status === "error";

  return (
    <div className="space-y-3">
      {/* Scope summary */}
      <div className="bg-[var(--color-card-elevated)] rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-[var(--color-gold)]">
            <ShieldIcon />
          </div>
          <span className="text-[11px] font-medium text-[var(--color-text-muted)]">
            Delegation Scope
          </span>
        </div>
        <div className="space-y-1.5 text-[10px] text-[var(--color-text-dim)]">
          <div className="flex justify-between">
            <span>Allowed</span>
            <span className="text-[var(--color-success)]">release, refund, rule, autoRelease, submitDelivery</span>
          </div>
          <div className="flex justify-between">
            <span>Target</span>
            <span className="mono">Escrow contract only</span>
          </div>
          <div className="flex justify-between">
            <span>Prohibited</span>
            <span className="text-[var(--color-danger)]">all other actions</span>
          </div>
        </div>
      </div>

      {/* Sign button */}
      <button
        onClick={handleSign}
        disabled={!isActionable}
        className={`w-full font-semibold py-3 rounded-lg text-sm flex items-center justify-center gap-2 transition-all ${
          status === "signed"
            ? "bg-[var(--color-success)]/20 text-[var(--color-success)] border border-[var(--color-success)]/30"
            : isActionable
              ? "btn-glow bg-[var(--color-gold)]/80 text-[var(--color-surface)] hover:bg-[var(--color-gold)]"
              : "bg-[var(--color-card-elevated)] text-[var(--color-text-muted)] cursor-wait"
        }`}
      >
        {(status === "loading" || status === "signing") && <Spinner />}
        {status === "signed" && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
        <span>{statusLabel[status]}</span>
      </button>

      {/* Error */}
      {error && (
        <p className="text-[var(--color-danger)] text-[11px] text-center">{error}</p>
      )}

      {/* Info text */}
      <p className="text-[9px] text-[var(--color-text-dim)] text-center leading-relaxed">
        {status === "signed"
          ? "The agent can now execute escrow actions on your behalf. No gas required."
          : "This is a free offchain signature. It does not cost gas. The agent can only call the 5 escrow functions listed above."}
      </p>
    </div>
  );
}
