/**
 * Deal Watcher
 *
 * Polls the escrow contract for DealCreated events.
 * When a brand deposits funds directly (not through the agent),
 * this watcher detects it and marks the deal as funded.
 *
 * The agent never funds deals — it only watches for brand deposits
 * and performs arbiter actions (release, refund, rule).
 */

import { type Hex, parseAbiItem } from "viem";
import { publicClient } from "./chain.js";
import { getAllDeals, updateDeal } from "./store.js";
import { DealStatus } from "../types/deal.js";
import { config } from "../config.js";
import { explorerTxUrl } from "./chain.js";
import { toDealIdBytes32 } from "../utils/dealId.js";

const DEAL_CREATED_EVENT = parseAbiItem(
  "event DealCreated(bytes32 indexed dealId, address indexed brand, address indexed creator, uint256 amount, uint256 disputeWindowDuration, string termsHash)"
);

type FundedCallback = (dealId: string, txHash: string, amount: string) => void;
let onDealFunded: FundedCallback | null = null;

export function setDealFundedCallback(cb: FundedCallback) {
  onDealFunded = cb;
}

let lastBlockChecked = 0n;
let watcherInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start watching for DealCreated events on the escrow contract.
 * Polls every 15 seconds for new events.
 */
export async function startDealWatcher() {
  const contractAddress = (config.yieldEscrowAddress || config.escrowContractAddress) as Hex;
  if (!contractAddress) {
    console.warn("[Watcher] No escrow contract address set, skipping deal watcher");
    return;
  }

  try {
    lastBlockChecked = await publicClient.getBlockNumber();
    console.log(`[Watcher] Starting deal watcher from block ${lastBlockChecked}`);
  } catch (err) {
    console.warn("[Watcher] Failed to get block number, will retry:", err);
    lastBlockChecked = 0n;
  }

  watcherInterval = setInterval(async () => {
    try {
      const currentBlock = await publicClient.getBlockNumber();
      if (currentBlock <= lastBlockChecked) return;

      const logs = await publicClient.getLogs({
        address: contractAddress,
        event: DEAL_CREATED_EVENT,
        fromBlock: lastBlockChecked + 1n,
        toBlock: currentBlock,
      });

      for (const log of logs) {
        const dealIdBytes32 = log.args.dealId as Hex;
        const amount = log.args.amount;
        const txHash = log.transactionHash;

        console.log(`[Watcher] DealCreated event: ${dealIdBytes32} in tx ${txHash}`);

        // Match against our pending deals
        const allDeals = getAllDeals();
        const matchedDeal = allDeals.find((d) => {
          const expectedBytes32 = toDealIdBytes32(d.id);
          return expectedBytes32.toLowerCase() === dealIdBytes32?.toLowerCase();
        });

        if (matchedDeal && matchedDeal.status === DealStatus.Confirmed) {
          const amountStr = amount ? (Number(amount) / 1e18).toFixed(6) : "unknown";
          console.log(`[Watcher] Matched deal ${matchedDeal.id} — funded with ${amountStr} ETH`);

          updateDeal(matchedDeal.id, {
            status: DealStatus.Funded,
            onChainId: dealIdBytes32,
            fundedAt: Date.now(),
          });

          if (onDealFunded && txHash) {
            onDealFunded(matchedDeal.id, txHash, amountStr);
          }
        }
      }

      lastBlockChecked = currentBlock;
    } catch (err) {
      console.warn("[Watcher] Poll error:", err);
    }
  }, 15_000); // Poll every 15 seconds

  console.log("[Watcher] Deal watcher active — polling every 15s");
}

export function stopDealWatcher() {
  if (watcherInterval) {
    clearInterval(watcherInterval);
    watcherInterval = null;
    console.log("[Watcher] Deal watcher stopped");
  }
}
