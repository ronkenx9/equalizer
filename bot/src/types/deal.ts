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

export interface EvaluationCriterion {
  id: string;
  description: string;
  check_type: "keyword_presence" | "hashtag_presence" | "mention_presence" | "url_accessible" | "min_count" | "deadline_check" | "format_check" | "structural_check" | "content_match";
  required_value: string;
  required: boolean;
}

export interface ExtractedCriteria {
  type: "social_post" | "video_content" | "written_content" | "code" | "design" | "stream" | "other";
  platform: string | null;
  criteria: EvaluationCriterion[];
  ambiguities: string[] | null;
}

export interface CriterionResult {
  criterion_id: string;
  description: string;
  result: "PASS" | "FAIL" | "PARTIAL";
  found_value?: string;
  reasoning?: string;
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

export type SupportedChain = "base-sepolia" | "xlayer";

export interface DealState {
  id: string;
  chatId: number;
  terms: DealTerms;
  status: DealStatus;
  chain?: SupportedChain;
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
  webhookUrl?: string;
  webhookSecret?: string;
  apiKeyId?: string;
  partyAWallet?: string;
  partyBWallet?: string;
  evaluationCriteria?: string;
  extractedCriteria?: ExtractedCriteria;
  criteriaResults?: CriterionResult[];
  easAttestationUid?: string;
  delegation?: DealDelegation;
  creatorAddress?: string; // stored when payment link is sent so deposit instructions survive restarts
}

export interface DealDelegation {
  signature: string;
  delegationHash: string;
  delegation: any; // Delegation struct from toolkit — serialized to JSON for disk persistence
  caveats: {
    target: string;
    methods: string[];
    deadline: number;
  };
  accountMeta?: { factory: string; factoryData: string };
  brandEOA: string;
  brandSmartAccount: string;
  agentSmartAccount: string;
  signedAt: number;
}
