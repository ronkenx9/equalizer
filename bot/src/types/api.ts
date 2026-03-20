export interface CreateDealRequest {
  party_a: string;
  party_b: string;
  deliverable: string;
  amount: string;
  currency?: string;
  deadline_seconds: number;
  evaluation_criteria: string;
  webhook_url?: string;
}

export interface CreateDealResponse {
  deal_id: string;
  escrow_address: string;
  payment_instructions: {
    send_usdc_to: string;
    amount: string;
    chain_id: number;
    x402_endpoint: string;
  };
  status: "pending_funding";
}

export interface DeliverRequest {
  party_b_address: string;
  delivery_url?: string;
  delivery_content?: string;
  delivery_hash?: string;
}

export interface DisputeRequest {
  disputing_party: string;
  reason: string;
  evidence_url?: string;
  evidence_content?: string;
}

export interface ReputationResponse {
  wallet: string;
  deals_completed: number;
  deals_as_buyer: number;
  deals_as_seller: number;
  total_volume_usdc: string;
  completion_rate: number;
  avg_delivery_time_hours: number;
  dispute_rate: number;
  eas_attestations: string[];
  trust_score: number;
}

export interface DealStatusResponse {
  deal_id: string;
  status: string;
  next_action: string;
}

export interface FullDealResponse {
  deal_id: string;
  status: string;
  party_a: string;
  party_b: string;
  deliverable: string;
  amount: string;
  deadline: string;
  evaluation_result: {
    passed: boolean;
    confidence: number;
    reasoning: string;
    flags?: string[];
  } | null;
  dispute_status: string | null;
  payment_released: boolean;
  eas_attestation: string | null;
  created_at: number;
  updated_at: number;
}
