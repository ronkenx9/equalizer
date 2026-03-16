import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Interaction,
  type Message,
  type TextChannel,
  PermissionFlagsBits,
} from "discord.js";
import { config } from "../config.js";
import { createDeal, getDeal, updateDeal, getDealsByChat, getActiveDealsByChat } from "../services/store.js";
import { detectIntent, evaluateDelivery, mediate } from "../services/claude.js";
import { explorerTxUrl, getDealFromChain, submitDeliveryOnChain, createDealOnChain, getDepositInstructions } from "../services/chain.js";
import { DealStatus } from "../types/deal.js";

// ── Slash Command Definitions ──────────────────────────

const dealCommand = new SlashCommandBuilder()
  .setName("deal")
  .setDescription("Create a new escrow deal")
  .addUserOption((o) => o.setName("freelancer").setDescription("The freelancer/creator").setRequired(true))
  .addStringOption((o) => o.setName("amount").setDescription("Payment amount (e.g. 0.5)").setRequired(true))
  .addStringOption((o) => o.setName("currency").setDescription("Currency (ETH, USDC, etc.)").setRequired(true))
  .addStringOption((o) => o.setName("deliverable").setDescription("What needs to be delivered").setRequired(true))
  .addStringOption((o) => o.setName("deadline").setDescription("Deadline (e.g. 3 days, Friday, 2026-03-20)").setRequired(true));

const statusCommand = new SlashCommandBuilder()
  .setName("dealstatus")
  .setDescription("Check the status of a deal")
  .addStringOption((o) => o.setName("deal_id").setDescription("Deal ID").setRequired(true));

const submitCommand = new SlashCommandBuilder()
  .setName("submit")
  .setDescription("Submit delivery for a deal")
  .addStringOption((o) => o.setName("deal_id").setDescription("Deal ID").setRequired(true))
  .addStringOption((o) => o.setName("delivery").setDescription("Delivery details / link / proof").setRequired(true));

const disputeCommand = new SlashCommandBuilder()
  .setName("dispute")
  .setDescription("Dispute a deal during the dispute window")
  .addStringOption((o) => o.setName("deal_id").setDescription("Deal ID").setRequired(true))
  .addStringOption((o) => o.setName("reason").setDescription("Why are you disputing?").setRequired(true));

const listCommand = new SlashCommandBuilder()
  .setName("deals")
  .setDescription("List active deals in this channel");

const commands = [dealCommand, statusCommand, submitCommand, disputeCommand, listCommand];

// ── Embed Helpers ──────────────────────────────────────

function dealEmbed(dealId: string, terms: { deliverable: string; price: string; currency: string; deadline: string; brandUsername: string; creatorUsername: string }, status: string) {
  return new EmbedBuilder()
    .setTitle(`EQUALIZER Deal #${dealId}`)
    .setColor(0xD4A017)
    .addFields(
      { name: "Deliverable", value: terms.deliverable, inline: false },
      { name: "Price", value: `${terms.price} ${terms.currency}`, inline: true },
      { name: "Deadline", value: terms.deadline, inline: true },
      { name: "Client", value: terms.brandUsername, inline: true },
      { name: "Freelancer", value: terms.creatorUsername, inline: true },
      { name: "Status", value: status, inline: true },
    )
    .setFooter({ text: "EQUALIZER — The deal that actually holds" })
    .setTimestamp();
}

function confirmButtons(dealId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`confirm:${dealId}`).setLabel("Confirm").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`reject:${dealId}`).setLabel("Reject").setStyle(ButtonStyle.Danger),
  );
}

// ── Conversation Detection ─────────────────────────────

const messageBuffers = new Map<string, { user: string; text: string }[]>();
const lastCheckTime = new Map<string, number>();
const BUFFER_SIZE = 20;
const DEAL_KEYWORDS = /\b(deal|pay|deliver|deliverable|hire|gig|deadline|rate|budget|commission|sponsor|collab|collaboration|campaign|post|tweet|thread|content)\b/i;
const PRICE_PATTERN = /(\$|eth|usdc|usdt|sol|bnb|matic)\s*\d|\d+\s*(eth|usdc|usdt|sol|\$)/i;

function shouldTriggerDetection(messages: { user: string; text: string }[]): boolean {
  const recent = messages.slice(-5).map((m) => m.text).join(" ");
  return DEAL_KEYWORDS.test(recent) && PRICE_PATTERN.test(recent);
}

// ── Bot Setup ──────────────────────────────────────────

export async function startDiscordBot() {
  if (!config.discordBotToken) {
    console.log("DISCORD_BOT_TOKEN not set, skipping Discord bot");
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  // Register slash commands
  const rest = new REST({ version: "10" }).setToken(config.discordBotToken);
  try {
    console.log("Registering Discord slash commands...");
    await rest.put(
      Routes.applicationCommands(config.discordAppId),
      { body: commands.map((c) => c.toJSON()) },
    );
    console.log("Discord slash commands registered");
  } catch (err) {
    console.error("Failed to register Discord commands:", err);
  }

  // ── Slash Command Handler ─────────────────────────

  client.on("interactionCreate", async (interaction: Interaction) => {
    if (interaction.isChatInputCommand()) {
      const channelId = interaction.channelId;

      switch (interaction.commandName) {
        case "deal": {
          const freelancer = interaction.options.getUser("freelancer", true);
          const amount = interaction.options.getString("amount", true);
          const currency = interaction.options.getString("currency", true);
          const deliverable = interaction.options.getString("deliverable", true);
          const deadline = interaction.options.getString("deadline", true);

          const terms = {
            deliverable,
            price: amount,
            currency: currency.toUpperCase(),
            deadline,
            brandUsername: interaction.user.tag,
            creatorUsername: freelancer.tag,
          };

          // Use channel ID as number-like key (hash it)
          const chatKey = hashChannelId(channelId);
          const deal = createDeal(chatKey, terms);

          const embed = dealEmbed(deal.id, terms, "PENDING — Awaiting confirmation");
          const buttons = confirmButtons(deal.id);

          await interaction.reply({ embeds: [embed], components: [buttons] });
          break;
        }

        case "dealstatus": {
          const dealId = interaction.options.getString("deal_id", true).toUpperCase();
          const deal = getDeal(dealId);
          if (!deal) {
            await interaction.reply({ content: `Deal #${dealId} not found.`, ephemeral: true });
            return;
          }
          const embed = dealEmbed(deal.id, deal.terms, deal.status.replace(/_/g, " "));
          await interaction.reply({ embeds: [embed] });
          break;
        }

        case "submit": {
          const dealId = interaction.options.getString("deal_id", true).toUpperCase();
          const delivery = interaction.options.getString("delivery", true);
          const deal = getDeal(dealId);

          if (!deal) {
            await interaction.reply({ content: `Deal #${dealId} not found.`, ephemeral: true });
            return;
          }
          if (deal.status !== DealStatus.Funded) {
            await interaction.reply({ content: `Deal #${dealId} is not in FUNDED status. Current: ${deal.status}`, ephemeral: true });
            return;
          }

          await interaction.deferReply();

          try {
            const evaluation = await evaluateDelivery(deal.terms, delivery);
            updateDeal(dealId, {
              status: DealStatus.DeliverySubmitted,
              delivery,
              deliveryEvaluation: evaluation,
              deliverySubmittedAt: Date.now(),
            });

            const embed = new EmbedBuilder()
              .setTitle(`Delivery Submitted — Deal #${dealId}`)
              .setColor(evaluation.passed ? 0x3DB87A : 0xFF6B6B)
              .addFields(
                { name: "Evaluation", value: evaluation.passed ? "PASSED" : "FLAGGED", inline: true },
                { name: "Confidence", value: `${Math.round(evaluation.confidence * 100)}%`, inline: true },
                { name: "Reasoning", value: evaluation.reasoning.slice(0, 1024), inline: false },
              )
              .setFooter({ text: "Dispute window is now open." });

            await interaction.editReply({ embeds: [embed] });
          } catch (err: any) {
            await interaction.editReply({ content: `Error evaluating delivery: ${err.message}` });
          }
          break;
        }

        case "dispute": {
          const dealId = interaction.options.getString("deal_id", true).toUpperCase();
          const reason = interaction.options.getString("reason", true);
          const deal = getDeal(dealId);

          if (!deal) {
            await interaction.reply({ content: `Deal #${dealId} not found.`, ephemeral: true });
            return;
          }
          if (deal.status !== DealStatus.DeliverySubmitted && deal.status !== DealStatus.DisputeWindow) {
            await interaction.reply({ content: `Deal #${dealId} cannot be disputed in status: ${deal.status}`, ephemeral: true });
            return;
          }

          updateDeal(dealId, {
            status: DealStatus.Disputed,
            evidence: { brandEvidence: reason },
          });

          const embed = new EmbedBuilder()
            .setTitle(`Deal #${dealId} DISPUTED`)
            .setColor(0xFF6B6B)
            .setDescription(`Dispute filed by ${interaction.user.tag}.\n\n**Reason:** ${reason}\n\nThe freelancer should provide evidence using \`/submit\` or reply here.`)
            .setFooter({ text: "EQUALIZER will mediate based on evidence from both parties." });

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case "deals": {
          const chatKey = hashChannelId(channelId);
          const active = getActiveDealsByChat(chatKey);

          if (active.length === 0) {
            await interaction.reply({ content: "No active deals in this channel.", ephemeral: true });
            return;
          }

          const embed = new EmbedBuilder()
            .setTitle("Active Deals")
            .setColor(0xD4A017)
            .setDescription(
              active.map((d) =>
                `**#${d.id}** — ${d.terms.price} ${d.terms.currency} — ${d.status.replace(/_/g, " ")}\n${d.terms.deliverable.slice(0, 80)}`
              ).join("\n\n")
            );

          await interaction.reply({ embeds: [embed] });
          break;
        }
      }
    }

    // ── Button Handler ────────────────────────────────

    if (interaction.isButton()) {
      const [action, dealId] = interaction.customId.split(":");

      if (action === "confirm") {
        const deal = getDeal(dealId);
        if (!deal) {
          await interaction.reply({ content: "Deal not found.", ephemeral: true });
          return;
        }

        const userTag = interaction.user.tag;
        const isBrand = userTag === deal.terms.brandUsername;
        const isCreator = userTag === deal.terms.creatorUsername;

        if (!isBrand && !isCreator) {
          await interaction.reply({ content: "You are not a party in this deal.", ephemeral: true });
          return;
        }

        let newStatus = deal.status;
        if (isBrand && deal.status === DealStatus.Pending) {
          newStatus = DealStatus.BrandConfirmed;
        } else if (isCreator && deal.status === DealStatus.Pending) {
          newStatus = DealStatus.CreatorConfirmed;
        } else if (isBrand && deal.status === DealStatus.CreatorConfirmed) {
          newStatus = DealStatus.Confirmed;
        } else if (isCreator && deal.status === DealStatus.BrandConfirmed) {
          newStatus = DealStatus.Confirmed;
        }

        updateDeal(dealId, { status: newStatus, confirmedAt: newStatus === DealStatus.Confirmed ? Date.now() : undefined });

        if (newStatus === DealStatus.Confirmed) {
          const depositInfo = getDepositInstructions(
            dealId,
            "0x0000000000000000000000000000000000000000",
            Math.floor(Date.now() / 1000) + config.disputeWindowSeconds,
            deal.terms.deliverable,
            deal.terms.price,
          );

          const embed = new EmbedBuilder()
            .setTitle(`Deal #${dealId} CONFIRMED`)
            .setColor(0x3DB87A)
            .setDescription(
              `Both parties confirmed! The client needs to fund the escrow.\n\n` +
              `**Send ${deal.terms.price} ${deal.terms.currency}** to:\n` +
              `\`${depositInfo.to}\`\n\n` +
              `Contract: [View on BaseScan](https://sepolia.basescan.org/address/${depositInfo.to})`
            );

          await interaction.update({ embeds: [embed], components: [] });
        } else {
          await interaction.reply({
            content: `${userTag} confirmed deal #${dealId}. Waiting for the other party.`,
          });
        }
      }

      if (action === "reject") {
        const deal = getDeal(dealId);
        if (!deal) {
          await interaction.reply({ content: "Deal not found.", ephemeral: true });
          return;
        }

        updateDeal(dealId, { status: DealStatus.Refunded });

        const embed = new EmbedBuilder()
          .setTitle(`Deal #${dealId} REJECTED`)
          .setColor(0xFF6B6B)
          .setDescription(`${interaction.user.tag} rejected this deal.`);

        await interaction.update({ embeds: [embed], components: [] });
      }
    }
  });

  // ── Conversation Detection (passive) ──────────────

  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const channelId = message.channelId;
    const text = message.content;
    const username = message.author.tag;

    // Skip commands
    if (text.startsWith("/")) return;

    // Buffer message
    const buffer = messageBuffers.get(channelId) ?? [];
    buffer.push({ user: username, text });
    if (buffer.length > BUFFER_SIZE) buffer.shift();
    messageBuffers.set(channelId, buffer);

    // Only check if heuristic triggers
    if (!shouldTriggerDetection(buffer)) return;

    // Avoid double-checking within 30 seconds
    const lastCheck = lastCheckTime.get(channelId) ?? 0;
    if (Date.now() - lastCheck < 30_000) return;
    lastCheckTime.set(channelId, Date.now());

    try {
      const result = await detectIntent(buffer);
      if (!result.isDeal || result.confidence < 0.8 || !result.terms) return;

      const chatKey = hashChannelId(channelId);
      const deal = createDeal(chatKey, result.terms);

      const embed = dealEmbed(deal.id, deal.terms, "DETECTED — Awaiting confirmation");
      const buttons = confirmButtons(deal.id);

      const channel = message.channel as TextChannel;
      await channel.send({
        content: `I detected a deal forming! (Confidence: ${Math.round(result.confidence * 100)}%)`,
        embeds: [embed],
        components: [buttons],
      });
    } catch {
      // Silently fail — intent detection is best-effort
    }
  });

  // ── Login ─────────────────────────────────────────

  client.once("ready", (c) => {
    console.log(`Discord bot running as ${c.user.tag}`);
  });

  await client.login(config.discordBotToken);
  return client;
}

// ── Utility ────────────────────────────────────────────

/** Hash a Discord channel ID string into a numeric key for the store */
function hashChannelId(channelId: string): number {
  let hash = 0;
  for (let i = 0; i < channelId.length; i++) {
    hash = ((hash << 5) - hash + channelId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
