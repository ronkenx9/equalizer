import "dotenv/config";
import { config } from "./config.js";
import { initEAS } from "./services/eas.js";
import http from "http";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getAllDeals } from "./services/store.js";
import { LOG_FILE } from "./services/agentLog.js";

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
    .then(({ createBot }) => {
      tgBot = createBot();
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

// ── Health Check Server ───────────────────────────────
const port = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  if (req.url === "/health" && req.method === "GET") {
    const activeDealsCount = getAllDeals().length;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", uptime: process.uptime(), deals: activeDealsCount }));
  } else if (req.url === "/agent.json" && req.method === "GET") {
    try {
      const agentJson = readFileSync(AGENT_JSON_PATH, "utf-8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(agentJson);
    } catch {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "agent.json not found" }));
    }
  } else if (req.url === "/agent_log.json" && req.method === "GET") {
    try {
      const logJson = readFileSync(LOG_FILE, "utf-8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(logJson);
    } catch {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("[]");
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(port, () => {
  console.log(`Health check server listening on port ${port}`);
});

// ── Graceful Shutdown ─────────────────────────────────
const shutdown = async () => {
  console.log("SIGTERM/SIGINT received, shutting down gracefully...");

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
