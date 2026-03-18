# EQUALIZER Telegram Bot Debugging Context

## The Issue
The EQUALIZER Telegram bot is unable to receive or process messages sent within a Telegram Group chat. 
The bot runs fine locally and connects to the Telegram API without crashing, but when a user sends a message in the group, the bot's terminal receives absolutely zero event payloads from Telegram.

## What Has Been Fixed/Attempted So Far

### 1. Telegram API Lock / Polling Conflicts
- **Problem:** Railway was keeping a ghost container alive, causing `409 Conflict: terminated by other getUpdates request` when trying to run the bot locally or deploy new code.
- **Solution:** Deleted the Railway service completely, revoked the Telegram Bot Token via BotFather, and generated a brand new token to permanently sever the ghost connections. The bot now boots locally with 0 errors and a clean connection.

### 2. Telegram Group Privacy Mode
- **Problem:** By default, Telegram blocks bots from reading group messages unless they are commands starting with `/`.
- **Solution:** 
  - Went to BotFather -> Bot Settings -> Group Privacy -> Turned OFF.
  - Removed and re-added the bot to the group to clear Telegram's cached permissions.
  - Created a brand new group with the bot.
  - Promoted the bot to **Administrator** in the group (which inherently overrides all privacy restrictions and forces Telegram to send it all messages).

### 3. Grammy Framework Listener Scope
- **Problem:** In `bot/src/handlers/message.ts`, the listener was set to `bot.on("message:text")`, which might filter out group messages if Telegram attaches metadata that modifies the message type.
- **Solution:** Broadened the listener to `bot.on("message")` to catch the raw payload.

### 4. Middleware Swallowing Events (The Code Logic Bug)
- **Problem:** In `bot/src/handlers/dispute.ts`, there was a `bot.on("message:text")` listener configured to catch evidence for disputes. If there was no active dispute, it simply returned out of the function without calling `next()`. Because this handler was registered before the main intent handler, it was silently consuming and destroying all text events the bot received.
- **Solution:** Added `next()` to the early return conditions so unhandled messages successfully cascade down to the main `message.ts` intent detector. 

### 5. Raw Payload Debugging
- **Problem:** We weren't sure if the messages were getting dropped by Grammy's router or not arriving at all.
- **Solution:** Injected a global raw middleware at the absolute top of `bot/src/bot.ts` (right after error handling) to dump every raw `ctx.update` to the console.

## Current Status (The Blocker)
Even after fixing the middleware bug, making the bot a Group Admin, turning off Privacy Mode, and using a fresh token, **the bot's local terminal still prints absolutely nothing when a message is sent in the group.** The raw update logger remains completely silent. 

It appears Telegram's backend is still refusing to forward group message events to our local polling wrapper for this specific bot entity.
