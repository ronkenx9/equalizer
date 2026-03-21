import { useState, useCallback } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import {
  toMetaMaskSmartAccount,
  Implementation,
  getDeleGatorEnvironment,
} from "@metamask/delegation-toolkit";
import { createPublicClient, http, type Hex } from "viem";
import { baseSepolia } from "viem/chains";

export type DelegationStatus = "idle" | "loading" | "signing" | "signed" | "error";

interface UseDelegationReturn {
  status: DelegationStatus;
  error: string | null;
  delegationHash: string | null;
  signDelegation: (dealId: string) => Promise<void>;
}

const API_BASE = "";

/**
 * Hook that manages the delegation signing flow:
 * 1. Computes brand's counterfactual DeleGator address
 * 2. Fetches unsigned delegation from backend
 * 3. Prompts brand to sign EIP-712 typed data
 * 4. Posts signature back to backend
 */
export function useDelegation(): UseDelegationReturn {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const [status, setStatus] = useState<DelegationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [delegationHash, setDelegationHash] = useState<string | null>(null);

  const signDelegation = useCallback(
    async (dealId: string) => {
      if (!address) {
        setError("Wallet not connected");
        return;
      }

      try {
        setStatus("loading");
        setError(null);

        // 1. Compute brand's counterfactual DeleGator address
        const publicClient = createPublicClient({
          chain: baseSepolia,
          transport: http("https://sepolia.base.org", { timeout: 30_000 }),
        });

        const brandSmartAccount = await toMetaMaskSmartAccount({
          client: publicClient,
          implementation: Implementation.Hybrid,
          deployParams: [address, [], [], []],
          deploySalt: "0x",
          signer: { account: address },
        });

        // Get accountMeta for counterfactual deployment
        const factory = brandSmartAccount.factory;
        const factoryData = brandSmartAccount.factoryData;

        // 2. Fetch unsigned delegation from backend
        const params = new URLSearchParams({
          brandSmartAccount: brandSmartAccount.address,
          ...(factory && { factory: factory as string }),
          ...(factoryData && { factoryData: factoryData as string }),
        });

        const res = await fetch(`${API_BASE}/api/v1/delegation/deal/${dealId}?${params}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Failed to fetch delegation" }));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const { delegation, agentSmartAccount, accountMeta } = await res.json();

        // 3. Sign the delegation via EIP-712
        setStatus("signing");

        const env = getDeleGatorEnvironment(baseSepolia.id);

        const signature = await signTypedDataAsync({
          domain: {
            name: "DelegationManager",
            version: "1",
            chainId: baseSepolia.id,
            verifyingContract: env.DelegationManager as Hex,
          },
          types: {
            Delegation: [
              { name: "delegate", type: "address" },
              { name: "delegator", type: "address" },
              { name: "authority", type: "bytes32" },
              { name: "caveats", type: "Caveat[]" },
              { name: "salt", type: "uint256" },
              { name: "signature", type: "bytes" },
            ],
            Caveat: [
              { name: "enforcer", type: "address" },
              { name: "terms", type: "bytes" },
              { name: "args", type: "bytes" },
            ],
          },
          primaryType: "Delegation",
          message: delegation,
        });

        // 4. Post signature to backend
        const signRes = await fetch(`${API_BASE}/api/v1/delegation/sign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dealId,
            signature,
            delegation: { ...delegation, signature },
            brandEOA: address,
            brandSmartAccount: brandSmartAccount.address,
            accountMeta,
          }),
        });

        if (!signRes.ok) {
          const data = await signRes.json().catch(() => ({ error: "Failed to store signature" }));
          throw new Error(data.error || `HTTP ${signRes.status}`);
        }

        const result = await signRes.json();
        setDelegationHash(result.delegationHash || "signed");
        setStatus("signed");
      } catch (err: any) {
        console.error("[useDelegation]", err);
        setError(
          err.message?.includes("User rejected")
            ? "Delegation signing rejected"
            : err.message || "Delegation failed"
        );
        setStatus("error");
      }
    },
    [address, signTypedDataAsync]
  );

  return { status, error, delegationHash, signDelegation };
}
