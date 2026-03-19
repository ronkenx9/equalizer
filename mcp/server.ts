import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.EQUALIZER_API_URL || "http://localhost:3000/api/v1";
const API_KEY = process.env.EQUALIZER_API_KEY || "";

async function apiCall(method: string, path: string, body?: any): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Equalizer-API-Key": API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `API returned ${res.status}`);
  }
  return data;
}

const server = new McpServer({
  name: "equalizer",
  version: "1.0.0",
});

// Tool 1: equalizer_create_deal
server.tool(
  "equalizer_create_deal",
  "Create an enforced deal between two parties. Locks payment in escrow. AI evaluates delivery. Auto-releases on satisfaction.",
  {
    deliverable: z.string().describe("What needs to be delivered"),
    amount_usdc: z.string().describe("Payment amount in USDC"),
    party_b_address: z.string().describe("Seller/worker wallet address"),
    deadline_hours: z.number().describe("Hours until deadline"),
    evaluation_criteria: z.string().describe("What counts as valid delivery"),
    my_wallet: z.string().describe("Your wallet address (buyer)"),
  },
  async ({ deliverable, amount_usdc, party_b_address, deadline_hours, evaluation_criteria, my_wallet }) => {
    const result = await apiCall("POST", "/deals/create", {
      party_a: my_wallet,
      party_b: party_b_address,
      deliverable,
      amount: amount_usdc,
      deadline_seconds: deadline_hours * 3600,
      evaluation_criteria,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool 2: equalizer_fund_deal (x402 native — returns endpoint, agent pays locally)
server.tool(
  "equalizer_fund_deal",
  "Get x402 payment endpoint to fund a deal. Returns the x402 URL — your agent pays via x402 protocol. Private key never leaves your environment.",
  {
    deal_id: z.string().describe("The deal ID to fund"),
  },
  async ({ deal_id }) => {
    const dealInfo = await apiCall("GET", `/deals/${deal_id}`);
    const x402Url = `${API_BASE.replace("/api/v1", "")}/pay/${deal_id}`;
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          deal_id,
          x402_endpoint: x402Url,
          amount: dealInfo.amount,
          chain_id: 84532,
          network: "Base Sepolia",
          instructions: "Send a GET request to x402_endpoint to receive 402 payment requirements. Then submit payment via x402 protocol. Your private key stays local.",
        }, null, 2),
      }],
    };
  }
);

// Tool 3: equalizer_submit_delivery
server.tool(
  "equalizer_submit_delivery",
  "Submit completed work for a deal. Triggers AI evaluation.",
  {
    deal_id: z.string().describe("The deal ID"),
    party_b_address: z.string().describe("Your wallet address (seller)"),
    delivery_url: z.string().optional().describe("URL to delivered work"),
    delivery_content: z.string().optional().describe("Description of delivered work"),
  },
  async ({ deal_id, party_b_address, delivery_url, delivery_content }) => {
    const result = await apiCall("POST", `/deals/${deal_id}/deliver`, {
      party_b_address,
      delivery_url,
      delivery_content,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool 4: equalizer_check_deal
server.tool(
  "equalizer_check_deal",
  "Check status of any deal. Get full state, timeline, and next action.",
  {
    deal_id: z.string().describe("The deal ID to check"),
  },
  async ({ deal_id }) => {
    const result = await apiCall("GET", `/deals/${deal_id}`);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Tool 5: equalizer_get_reputation
server.tool(
  "equalizer_get_reputation",
  "Get trust score and deal history for any wallet address. Use before agreeing to a deal.",
  {
    wallet_address: z.string().describe("Wallet address to check"),
  },
  async ({ wallet_address }) => {
    const result = await apiCall("GET", `/reputation/${wallet_address}`);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("EQUALIZER MCP server running on stdio");
}

main().catch(console.error);
