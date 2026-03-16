import { Bot } from "grammy";
import { config } from "./config.js";

// Commands
import { registerStart } from "./commands/start.js";
import { registerHelp } from "./commands/help.js";
import { registerWallet } from "./commands/wallet.js";
import { registerDeal } from "./commands/deal.js";
import { registerSubmit } from "./commands/submit.js";
import { registerDispute } from "./commands/dispute.js";
import { registerStatus } from "./commands/status.js";
import { registerFund } from "./commands/fund.js";

// Handlers
import { registerMessageHandler } from "./handlers/message.js";
import { registerConfirmationHandler } from "./handlers/confirmation.js";
import { registerDisputeHandler } from "./handlers/dispute.js";
import { startTimeoutChecker } from "./handlers/timeout.js";

export function createBot(): Bot {
  const bot = new Bot(config.telegramBotToken);

  // Global error handler
  bot.catch((err) => {
    console.error("Bot error:", err.message);
  });

  // Register commands
  registerStart(bot);
  registerHelp(bot);
  registerWallet(bot);
  registerDeal(bot);
  registerSubmit(bot);
  registerDispute(bot);
  registerStatus(bot);
  registerFund(bot);

  // Register handlers
  registerConfirmationHandler(bot);
  registerDisputeHandler(bot);
  registerMessageHandler(bot);

  // Start timeout checker
  startTimeoutChecker(bot);

  return bot;
}
