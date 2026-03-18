import { config } from "./src/config.js";

async function clearWebhook() {
    const token = config.telegramBotToken;
    if (!token) return console.error("No token");

    console.log("Clearing webhook...");
    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
        const data = await res.json();
        console.log("Result:", data);
    } catch (err) {
        console.error("Error:", err);
    }
}

clearWebhook();
