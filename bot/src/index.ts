import "dotenv/config";
import { config } from "./config.js";
import { initEAS } from "./services/eas.js";

console.log("EQUALIZER starting...");

// Register EAS schema in background (non-blocking)
initEAS().catch((err) => console.warn("EAS init skipped:", err.message));

// ── Telegram Bot ──────────────────────────────────────
if (config.telegramBotToken) {
  const { createBot } = await import("./bot.js");
  const bot = createBot();
  bot.start({
    onStart: (info) => {
      console.log(`Telegram bot running as @${info.username}`);
    },
  });
} else {
  console.log("TELEGRAM_BOT_TOKEN not set, skipping Telegram bot");
}

// ── Discord Bot ───────────────────────────────────────
if (config.discordBotToken) {
  const { startDiscordBot } = await import("./discord/bot.js");
  startDiscordBot().catch((err) => console.error("Discord bot failed:", err));
} else {
  console.log("DISCORD_BOT_TOKEN not set, skipping Discord bot");
}
