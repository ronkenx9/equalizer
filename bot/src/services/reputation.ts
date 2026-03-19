import { getAllDeals } from "./store.js";
import { DealState, DealStatus } from "../types/deal.js";
import { ReputationResponse } from "../types/api.js";

export function getWalletReputation(walletAddress: string): ReputationResponse {
  const allDeals = getAllDeals();
  const wallet = walletAddress.toLowerCase();

  const dealsAsBuyer = allDeals.filter(
    (d) => d.partyAWallet?.toLowerCase() === wallet
  );
  const dealsAsSeller = allDeals.filter(
    (d) => d.partyBWallet?.toLowerCase() === wallet
  );

  const allWalletDeals = allDeals.filter(
    (d) =>
      d.partyAWallet?.toLowerCase() === wallet ||
      d.partyBWallet?.toLowerCase() === wallet
  );

  const completedDeals = allWalletDeals.filter(
    (d) => d.status === DealStatus.Completed
  );
  const disputedDeals = allWalletDeals.filter(
    (d) =>
      d.status === DealStatus.Disputed ||
      d.status === DealStatus.EvidenceCollection
  );

  const totalDeals = allWalletDeals.length;
  const completionRate = totalDeals > 0 ? completedDeals.length / totalDeals : 0;
  const disputeRate = totalDeals > 0 ? disputedDeals.length / totalDeals : 0;

  const totalVolumeUsdc = completedDeals.reduce((sum, d) => {
    const amount = parseFloat(d.terms.price) || 0;
    return sum + amount;
  }, 0);

  // Average delivery time in hours for completed deals
  let avgDeliveryTimeHours = 0;
  const dealsWithDeliveryTime = completedDeals.filter(
    (d) => d.deliverySubmittedAt && d.fundedAt
  );
  if (dealsWithDeliveryTime.length > 0) {
    const totalHours = dealsWithDeliveryTime.reduce((sum, d) => {
      const hours =
        (d.deliverySubmittedAt! - d.fundedAt!) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);
    avgDeliveryTimeHours = totalHours / dealsWithDeliveryTime.length;
  }

  // Collect EAS attestation UIDs
  const easAttestations = allWalletDeals
    .filter((d) => d.easAttestationUid)
    .map((d) => d.easAttestationUid!);

  // Trust score: base 50 + completion_rate * 30 + min(20, volume/500) - dispute_rate * 40
  const trustScore = Math.min(
    100,
    Math.max(
      0,
      50 +
        completionRate * 30 +
        Math.min(20, totalVolumeUsdc / 500) -
        disputeRate * 40
    )
  );

  return {
    wallet: walletAddress,
    deals_completed: completedDeals.length,
    deals_as_buyer: dealsAsBuyer.length,
    deals_as_seller: dealsAsSeller.length,
    total_volume_usdc: totalVolumeUsdc.toFixed(2),
    completion_rate: Math.round(completionRate * 100) / 100,
    avg_delivery_time_hours: Math.round(avgDeliveryTimeHours * 100) / 100,
    dispute_rate: Math.round(disputeRate * 100) / 100,
    eas_attestations: easAttestations,
    trust_score: Math.round(trustScore * 100) / 100,
  };
}
