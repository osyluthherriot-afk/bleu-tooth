/**
 * index.js — Bleu the Blue Tooth, entry point
 *
 * Registers commands and listens for:
 *   - interactionCreate  → slash commands
 *   - messageCreate      → Bogsy result replies into active SoD sessions
 */
import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';

// ── Command imports ───────────────────────────────────────────────────────────
import { data as doubleData,   execute as executeDouble   } from './commands/roll-double.js';
import { data as halfData,     execute as executeHalf     } from './commands/roll-half.js';
import { data as rollOpData,   execute as executeRollOp   } from './commands/roll-multiply.js';
import { data as rankUpData,   execute as executeRankUp   } from './commands/rank-up.js';
import {
  gwfData,     executeGwf,
  savageData,  executeSavage,
  brawlerData, executeBrawler,
} from './commands/dnd-features.js';
import {
  data as sodData,
  execute as executeSod,
  activeSessions,
  handleSodReply,
} from './commands/sword-or-death.js';

// ── Client setup ──────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

// ── Command registry ──────────────────────────────────────────────────────────
client.commands = new Collection();

const commandMap = [
  { data: doubleData,  execute: executeDouble  },
  { data: halfData,    execute: executeHalf    },
  { data: rollOpData,  execute: executeRollOp  },
  { data: rankUpData,  execute: executeRankUp  },
  { data: gwfData,     execute: executeGwf     },
  { data: savageData,  execute: executeSavage  },
  { data: brawlerData, execute: executeBrawler },
  { data: sodData,     execute: executeSod     },
];

for (const cmd of commandMap) {
  client.commands.set(cmd.data.name, cmd);
}

// ── Events ────────────────────────────────────────────────────────────────────

client.once('ready', (c) => {
  console.log(`🔵 Bleu the Blue Tooth is online as ${c.user.tag}!`);
});

/** Handle slash command interactions */
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;

  try {
    await cmd.execute(interaction);
  } catch (err) {
    console.error(`Error executing /${interaction.commandName}:`, err);
    const msg = { content: '❌ Something went wrong executing that command.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});

/**
 * Handle regular messages for Sword or Death session tracking.
 *
 * Bogsy is a bot. When a player replies to Bleu's SoD challenge message,
 * Bogsy also replies. We intercept Bogsy's reply (which is a reply to the
 * player's message, in the same reply chain) and compare to the session.
 *
 * Strategy:
 *  1. If a message is a bot message AND is a Bogsy-format result:
 *     Walk up its reply chain to find if any ancestor is a SoD session message.
 *  2. If yes, handle as a SoD round.
 */
client.on('messageCreate', async (message) => {
  // Only care about bot messages that look like Bogsy results
  if (!message.author.bot) return;
  if (!isBogsy(message.content)) return;

  // Check if this is a reply in an active SoD chain
  const sessionId = await findAncestorSession(message);
  if (!sessionId) return;

  try {
    await handleSodReply(message, sessionId);
  } catch (err) {
    console.error('Error handling SoD reply:', err);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function isBogsy(content) {
  return /\d+d\d+\s*\{/.test(content) && content.includes('✨');
}

/**
 * Walk up the reply chain up to 5 levels to find a SoD session message ID.
 * @param {import('discord.js').Message} message
 * @returns {Promise<string|null>}
 */
async function findAncestorSession(message) {
  let current = message;
  for (let depth = 0; depth < 5; depth++) {
    const ref = current.reference;
    if (!ref?.messageId) break;

    // Direct hit
    if (activeSessions.has(ref.messageId)) return ref.messageId;

    // Fetch parent and keep walking
    try {
      current = await current.channel.messages.fetch(ref.messageId);
    } catch {
      break;
    }
  }
  return null;
}

// ── Login ─────────────────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
