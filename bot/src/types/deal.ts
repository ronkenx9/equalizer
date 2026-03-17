export enum DealStatus {
  Pending = "PENDING",
  BrandConfirmed = "BRAND_CONFIRMED",
  CreatorConfirmed = "CREATOR_CONFIRMED",
  Confirmed = "CONFIRMED",
  Funded = "FUNDED",
  DeliverySubmitted = "DELIVERY_SUBMITTED",
  DisputeWindow = "DISPUTE_WINDOW",
  Disputed = "DISPUTED",
  EvidenceCollection = "EVIDENCE_COLLECTION",
  Completed = "COMPLETED",
  Refunded = "REFUNDED",
}

export interface DealTerms {
  deliverable: string;
  price: string;
  currency: string;
  deadline: string;
  disputeWindowSeconds: number;
  brandUsername: string;
  creatorUsername: string;
}

export interface DealEvidence {
  brandEvidence?: string;
  creatorEvidence?: string;
}

export interface DealRuling {
  verdict: "release" | "refund" | "split";
  creatorShare: number;
  reasoning: string;
}

export interface DealState {
  id: string;
  chatId: number;
  terms: DealTerms;
  status: DealStatus;
  onChainId?: `0x${string}`;
  delivery?: string;
  deliveryEvaluation?: {
    passed: boolean;
    confidence: number;
    reasoning: string;
    flags?: string[];
  };
  evidence?: DealEvidence;
  ruling?: DealRuling;
  createdAt: number;
  confirmedAt?: number;
  fundedAt?: number;
  deliverySubmittedAt?: number;
  disputeWindowEnd?: number;
  completedAt?: number;
}
