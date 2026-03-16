import "dotenv/config";
import { createBot } from "./bot.js";
import { initEAS } from "./services/eas.js";

const bot = createBot();

console.log("EQUALIZER bot starting...");

// Register EAS schema in background (non-blocking)
initEAS().catch((err) => console.warn("EAS init skipped:", err.message));

bot.start({
  onStart: (info) => {
    console.log(`Bot running as @${info.username}`);
  },
});
