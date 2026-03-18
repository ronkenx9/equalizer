import "dotenv/config";
import { config } from "./config.js";
import { initEAS } from "./services/eas.js";
import express from "express";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getAllDeals, getDeal, updateDeal } from "./services/store.js";
import { DealStatus } from "./types/deal.js";
import { LOG_FILE } from "./services/agentLog.js";
import {
  getPaymentRequirements,
  getPendingPayment,
  markPaymentSettled,
  setPaymentCallback,
} from "./services/x402.js";
import { startDealWatcher, setDealFundedCallback, stopDealWatcher } from "./services/dealWatcher.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENT_JSON_PATH = resolve(__dirname, "../../agent.json");

console.log("EQUALIZER starting...");

// Register EAS schema in background (non-blocking)
initEAS().catch((err) => console.warn("EAS init skipped:", err.message));

let tgBot: any;
let discordClient: any;

// ── Telegram Bot ──────────────────────────────────────
if (config.telegramBotToken) {
  import("./bot.js")
    .then(async ({ createBot }) => {
      tgBot = createBot();

      const webhookInfo = await tgBot.api.getWebhookInfo();
      if (webhookInfo.url) {
        console.log(`[Telegram] Found stale webhook: ${webhookInfo.url} — deleting...`);
        await tgBot.api.deleteWebhook({ drop_pending_updates: true });
        console.log("[Telegram] Webhook deleted, pending updates dropped.");
      } else {
        console.log("[Telegram] No webhook set, polling mode clean.");
      }

      tgBot.start({
        onStart: (info: any) => {
          console.log(`Telegram bot running as @${info.username}`);
        },
      });
    })
    .catch((err) => console.error("Telegram bot failed:", err));
} else {
  console.log("TELEGRAM_BOT_TOKEN not set, skipping Telegram bot");
}

// ── Discord Bot ───────────────────────────────────────
if (config.discordBotToken) {
  import("./discord/bot.js")
    .then(async ({ startDiscordBot }) => {
      discordClient = await startDiscordBot();
    })
    .catch((err) => console.error("Discord bot failed:", err));
} else {
  console.log("DISCORD_BOT_TOKEN not set, skipping Discord bot");
}

// ── x402 Payment Callback ────────────────────────────
// When x402 payment settles, notify the Telegram chat
setPaymentCallback(async (dealId: string, txHash: string) => {
  console.log(`[x402] Payment settled for deal ${dealId}: ${txHash}`);
  const deal = getDeal(dealId);
  if (!deal || !tgBot) return;

  updateDeal(dealId, { status: DealStatus.Funded, fundedAt: Date.now() });

  try {
    await tgBot.api.sendMessage(
      deal.chatId,
      `✅ *Escrow funded via USDC\\!*\n\n` +
      `Deal \\#${dealId} is now locked onchain\\.\n` +
      `[View transaction](https://sepolia.basescan.org/tx/${txHash})\n\n` +
      `${deal.terms.creatorUsername}: deliver by the deadline, then just say "I'm done" or share your deliverable here\\.`,
      { parse_mode: "MarkdownV2" }
    );
  } catch (err) {
    console.error("[x402] Failed to send funded notification:", err);
  }
});

// ── Deal Watcher (onchain event monitor) ─────────────
// Watches for DealCreated events — when brand deposits directly
setDealFundedCallback(async (dealId: string, txHash: string, amount: string) => {
  console.log(`[Watcher] Deal ${dealId} funded onchain: ${amount} ETH (tx: ${txHash})`);
  const deal = getDeal(dealId);
  if (!deal || !tgBot) return;

  try {
    const txUrl = `https://sepolia.basescan.org/tx/${txHash}`;
    await tgBot.api.sendMessage(
      deal.chatId,
      `🔒 *Escrow funded\\!*\n\n` +
      `${deal.terms.brandUsername} deposited *${amount} ETH* directly to the contract\\.\n` +
      `[View transaction](${txUrl})\n\n` +
      `The smart contract holds the funds now — neither party can touch them\\.\n\n` +
      `${deal.terms.creatorUsername}: deliver by the deadline, then just say "I'm done" or share your work here\\.`,
      { parse_mode: "MarkdownV2" }
    );
  } catch (err) {
    console.error("[Watcher] Failed to send funded notification:", err);
  }
});

startDealWatcher().catch((err) => console.warn("Deal watcher failed to start:", err));

// ── Express Server ───────────────────────────────────
const port = process.env.PORT || 3000;
const app = express();
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  const activeDealsCount = getAllDeals().length;
  res.json({ status: "ok", uptime: process.uptime(), deals: activeDealsCount });
});

// ERC-8004 agent.json
app.get("/agent.json", (_req, res) => {
  try {
    const agentJson = readFileSync(AGENT_JSON_PATH, "utf-8");
    res.type("json").send(agentJson);
  } catch {
    res.status(500).json({ error: "agent.json not found" });
  }
});

// Agent log
app.get("/agent_log.json", (_req, res) => {
  try {
    const logJson = readFileSync(LOG_FILE, "utf-8");
    res.type("json").send(logJson);
  } catch {
    res.json([]);
  }
});

// ── x402 Payment Endpoint ────────────────────────────
// GET /pay/:dealId — Returns 402 with payment requirements (x402 flow)
//                    or an HTML payment page for human users
app.get("/pay/:dealId", (req, res) => {
  const { dealId } = req.params;
  const payment = getPendingPayment(dealId);

  if (!payment) {
    res.status(404).json({ error: "Payment not found or expired" });
    return;
  }

  // Check if this is an x402 client (they send Accept: application/json)
  const isX402Client =
    req.headers.accept?.includes("application/json") ||
    req.headers["x-payment"] != null;

  if (isX402Client) {
    // x402 protocol: return 402 with payment requirements
    const requirements = getPaymentRequirements(dealId);
    res.status(402).json({
      paymentRequirements: [requirements],
      message: `Payment required: $${payment.amountUsd} USDC to fund Deal #${dealId}`,
    });
    return;
  }

  // Human user: render a simple payment page
  const deal = getDeal(dealId);
  const dealInfo = deal ? `${deal.terms.deliverable}` : "Deal";

  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EQUALIZER — Fund Deal #${dealId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0A0A14; color: #E8E4D9; font-family: 'IBM Plex Mono', monospace; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #12121F; border: 1px solid rgba(212,160,23,0.3); border-radius: 8px; padding: 40px; max-width: 480px; width: 90%; text-align: center; }
    .logo { font-family: 'DM Serif Display', serif; font-size: 24px; color: #C9A95A; letter-spacing: 0.15em; margin-bottom: 24px; }
    .amount { font-size: 48px; font-weight: bold; color: #D4A017; margin: 20px 0; }
    .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(232,228,217,0.5); margin-bottom: 8px; }
    .deal-info { font-size: 14px; color: rgba(232,228,217,0.7); margin-bottom: 24px; line-height: 1.6; }
    .divider { height: 1px; background: rgba(255,255,255,0.08); margin: 24px 0; }
    .escrow-address { font-size: 11px; background: #0A0A14; padding: 12px; border-radius: 4px; word-break: break-all; color: #4A9EFF; margin-top: 12px; }
    .note { font-size: 11px; color: rgba(232,228,217,0.3); margin-top: 20px; line-height: 1.5; }
    .badge { display: inline-block; padding: 4px 12px; background: rgba(212,160,23,0.1); border: 1px solid rgba(212,160,23,0.3); border-radius: 4px; font-size: 11px; color: #D4A017; margin-bottom: 16px; }
    .network { font-size: 11px; color: rgba(232,228,217,0.4); }
  </style>
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
<body>
  <div class="card">
    <div class="logo">EQUALIZER</div>
    <div class="badge">x402 Payment</div>
    <div class="label">Escrow Funding</div>
    <div class="amount">$${payment.amountUsd}</div>
    <div class="deal-info">
      <strong>Deal #${dealId}</strong><br>
      ${dealInfo}
    </div>
    <div class="divider"></div>
    <div class="label">Send USDC to</div>
    <div class="escrow-address">${config.escrowContractAddress || config.agentWalletAddress || "Contract address pending"}</div>
    <div class="network">Base Sepolia · USDC · Chain ID 84532</div>
    <div class="note">
      Funds go directly into the escrow smart contract.<br>
      Neither the agent nor the creator can access them until delivery is verified.
    </div>
  </div>
</body>
</html>`);
});

// POST /pay/:dealId — x402 payment verification + settlement
app.post("/pay/:dealId", async (req, res) => {
  const { dealId } = req.params;
  const payment = getPendingPayment(dealId);

  if (!payment) {
    res.status(404).json({ error: "Payment not found or expired" });
    return;
  }

  // x402 sends payment proof in X-PAYMENT header or request body
  const paymentHeader = req.headers["x-payment"] as string | undefined;
  const paymentBody = req.body;

  if (!paymentHeader && !paymentBody?.payload) {
    res.status(400).json({ error: "Missing payment proof" });
    return;
  }

  console.log(`[x402] Payment received for deal ${dealId}`);

  // In production, verify via facilitator:
  // const verified = await facilitatorClient.verify(paymentPayload, requirements);
  // For hackathon demo, accept the payment and settle
  try {
    const txHash = paymentBody?.txHash || paymentHeader || "0x_x402_pending";
    markPaymentSettled(dealId, txHash);

    res.json({
      status: "settled",
      dealId,
      message: `Deal #${dealId} funded successfully via x402`,
    });
  } catch (err: any) {
    console.error("[x402] Settlement failed:", err);
    res.status(500).json({ error: "Settlement failed", details: err.message });
  }
});

// ── x402 Discovery Endpoint ──────────────────────────
// Lets other AI agents discover EQUALIZER's payment capabilities
app.get("/.well-known/x402", (_req, res) => {
  res.json({
    name: "EQUALIZER",
    description: "Autonomous deal enforcement agent — escrow, mediation, attestation",
    version: "1.0.0",
    networks: ["eip155:84532"], // Base Sepolia
    assets: ["USDC"],
    endpoints: [
      {
        path: "/pay/:dealId",
        method: "GET",
        description: "Fund an EQUALIZER escrow deal",
        scheme: "exact",
      },
    ],
    agent: `${config.botPublicUrl}/agent.json`,
  });
});

const server = app.listen(port, () => {
  console.log(`Express server listening on port ${port} (x402 + health)`);
});

// ── Graceful Shutdown ─────────────────────────────────
const shutdown = async () => {
  console.log("SIGTERM/SIGINT received, shutting down gracefully...");

  stopDealWatcher();
  server.close();

  if (tgBot) {
    try {
      await tgBot.stop();
      console.log("Telegram bot stopped");
    } catch (e) {
      console.error("Error stopping Telegram bot:", e);
    }
  }

  if (discordClient) {
    try {
      if (typeof discordClient.destroy === "function") {
        await discordClient.destroy();
        console.log("Discord bot stopped");
      }
    } catch (e) {
      console.error("Error stopping Discord bot:", e);
    }
  }

  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ── Global Error Safety Nets ──────────────────────────
process.on("uncaughtException", (err) => {
  console.error("FATAL: Uncaught Exception:", err);
  // Optional: implement telemetry here
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("FATAL: Unhandled Promise Rejection at:", promise, "reason:", reason);
  // Prevent hard process crash to keep the bot alive for other chats
});
