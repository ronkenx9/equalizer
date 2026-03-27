import {
  createWalletClient,
  http,
  type Hex,
  encodePacked,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { config } from "../config.js";
import { publicClient } from "./chain.js";

// Base Sepolia EAS contract
const EAS_CONTRACT = config.easContractAddress;

// Schema Registry on Base Sepolia
const SCHEMA_REGISTRY = "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0" as Hex;

// Schema: dealId, brand, creator, amount, deliverable, outcome, timestamp
const SCHEMA_STRING =
  "bytes32 dealId,address brand,address creator,uint256 amount,string deliverable,string outcome,uint256 timestamp";

// Will be set after registration or from env
let schemaUID: string = process.env.EAS_SCHEMA_UID ?? "";

const transport = http(config.baseTestnetRpc, { timeout: 120_000 });

function getWalletClient() {
  if (!config.agentPrivateKey) throw new Error("AGENT_PRIVATE_KEY not set");
  const account = privateKeyToAccount(config.agentPrivateKey as Hex);
  return createWalletClient({ account, chain: baseSepolia, transport });
}

// EAS ABI — only the attest function
const EAS_ABI = [
  {
    name: "attest",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "schema", type: "bytes32" },
          {
            name: "data",
            type: "tuple",
            components: [
              { name: "recipient", type: "address" },
              { name: "expirationTime", type: "uint64" },
              { name: "revocable", type: "bool" },
              { name: "refUID", type: "bytes32" },
              { name: "data", type: "bytes" },
              { name: "value", type: "uint256" },
            ],
          },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

// Schema Registry ABI — register function
const SCHEMA_REGISTRY_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "schema", type: "string" },
      { name: "resolver", type: "address" },
      { name: "revocable", type: "bool" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

/**
 * Register the EQUALIZER deal schema on EAS.
 * Only needs to be called once — returns schemaUID.
 */
export async function registerSchema(): Promise<string> {
  if (schemaUID) return schemaUID;

  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    address: SCHEMA_REGISTRY,
    abi: SCHEMA_REGISTRY_ABI,
    functionName: "register",
    args: [
      SCHEMA_STRING,
      "0x0000000000000000000000000000000000000000" as Hex, // no resolver
      false, // not revocable
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  // The schema UID is emitted in the Registered event — first topic after event sig
  const registeredLog = receipt.logs.find(
    (log) => log.topics.length > 1
  );
  if (registeredLog && registeredLog.topics[1]) {
    schemaUID = registeredLog.topics[1];
    console.log(`EAS Schema registered: ${schemaUID}`);
  } else {
    console.warn("Could not extract schema UID from logs");
  }

  return schemaUID;
}

/**
 * Mint an attestation for a completed deal.
 */
export async function mintAttestation(params: {
  dealId: string;
  brand: string;
  creator: string;
  amountWei: bigint;
  deliverable: string;
  outcome: "completed" | "refunded" | "split";
  chain?: string;
}): Promise<string> {
  // EAS is only deployed on Base (OP Stack) — skip for other chains
  if (params.chain && params.chain !== "base-sepolia") {
    console.log(`[EAS] Skipping attestation — not supported on ${params.chain}`);
    return "";
  }
  if (!schemaUID) {
    console.warn("EAS schema UID not set — skipping attestation. Call registerSchema() first or set EAS_SCHEMA_UID.");
    return "";
  }

  const wallet = getWalletClient();

  // Encode the attestation data
  const dealIdBytes = `0x${Buffer.from(params.dealId, "utf8").toString("hex").padEnd(64, "0")}` as Hex;

  const encodedData = encodeAbiParameters(
    parseAbiParameters("bytes32, address, address, uint256, string, string, uint256"),
    [
      dealIdBytes,
      params.brand as Hex,
      params.creator as Hex,
      params.amountWei,
      params.deliverable,
      params.outcome,
      BigInt(Math.floor(Date.now() / 1000)),
    ]
  );

  const hash = await wallet.writeContract({
    address: EAS_CONTRACT,
    abi: EAS_ABI,
    functionName: "attest",
    args: [
      {
        schema: schemaUID as Hex,
        data: {
          recipient: params.creator as Hex,
          expirationTime: 0n,
          revocable: false,
          refUID: "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex,
          data: encodedData,
          value: 0n,
        },
      },
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  // Attestation UID from the Attested event
  const attestedLog = receipt.logs.find((log) => log.topics.length > 1);
  const attestationUID = attestedLog?.topics[1] ?? hash;

  console.log(`EAS attestation minted: ${attestationUID}`);
  return attestationUID;
}

/**
 * Get the EAS explorer URL for an attestation.
 */
export function easExplorerUrl(attestationUID: string): string {
  return `https://base-sepolia.easscan.org/attestation/view/${attestationUID}`;
}

/**
 * Initialize EAS — register schema if needed.
 */
export async function initEAS(): Promise<void> {
  if (schemaUID) {
    console.log(`EAS schema already configured: ${schemaUID}`);
    return;
  }
  try {
    await registerSchema();
  } catch (err: any) {
    console.warn("EAS schema registration failed (will skip attestations):", err.message);
  }
}
