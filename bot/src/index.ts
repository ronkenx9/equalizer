import "dotenv/config";
import { createBot } from "./bot.js";

const bot = createBot();

console.log("EQUALIZER bot starting...");

bot.start({
  onStart: (info) => {
    console.log(`Bot running as @${info.username}`);
  },
});
