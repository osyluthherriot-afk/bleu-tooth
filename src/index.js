/**
 * index.js — Bleu the Blue Tooth, entry point
 */
import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Collection, REST, Routes } from 'discord.js';

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
import {
  contextMenuData,
  executeContextMenu,
} from './commands/context-menus.js';
import { isBogsy } from './bogsyParser.js';

// ── Client setup ──────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

// ── Slash command registry ────────────────────────────────────────────────────
client.commands = new Collection();

const slashCommands = [
  { data: doubleData,  execute: executeDouble  },
  { data: halfData,    execute: executeHalf    },
  { data: rollOpData,  execute: executeRollOp  },
  { data: rankUpData,  execute: executeRankUp  },
  { data: gwfData,     execute: executeGwf     },
  { data: savageData,  execute: executeSavage  },
  { data: brawlerData, execute: executeBrawler },
  { data: sodData,     execute: executeSod     },
];

for (const cmd of slashCommands) {
  client.commands.set(cmd.data.name, cmd);
}

// Context menu command names
const contextMenuNames = new Set(contextMenuData.map((c) => c.name));

// ── Auto-register all commands on startup ─────────────────────────────────────
async function registerCommands(clientId, guildId) {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);

  const body = [
    ...slashCommands.map((c) => c.data.toJSON()),
    ...contextMenuData.map((c) => c.toJSON()),
  ];

  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
      console.log(`✅ Commands registered to guild ${guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body });
      console.log('✅ Commands registered globally');
    }
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }
}

// ── Events ────────────────────────────────────────────────────────────────────

client.once('ready', async (c) => {
  console.log(`🔵 Bleu the Blue Tooth is online as ${c.user.tag}!`);
  const clientId = process.env.CLIENT_ID ?? c.user.id;
  const guildId  = process.env.GUILD_ID || null;
  await registerCommands(clientId, guildId);
});

/** Handle slash commands AND context menu interactions */
client.on('interactionCreate', async (interaction) => {
  // ── Context menu (right-click message → Apps) ──────────────────────────────
  if (interaction.isMessageContextMenuCommand()) {
    if (!contextMenuNames.has(interaction.commandName)) return;
    try {
      await executeContextMenu(interaction);
    } catch (err) {
      console.error(`Context menu error [${interaction.commandName}]:`, err);
      const msg = { content: '❌ Something went wrong.', ephemeral: true };
      interaction.replied ? interaction.followUp(msg) : interaction.reply(msg);
    }
    return;
  }

  // ── Slash commands ─────────────────────────────────────────────────────────
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

/** SoD session tracking via Bogsy reply chain */
client.on('messageCreate', async (message) => {
  if (!message.author.bot) return;
  if (!isBogsy(message.content)) return;

  const sessionId = await findAncestorSession(message);
  if (!sessionId) return;

  try {
    await handleSodReply(message, sessionId);
  } catch (err) {
    console.error('Error handling SoD reply:', err);
  }
});



async function findAncestorSession(message) {
  let current = message;
  for (let depth = 0; depth < 5; depth++) {
    const ref = current.reference;
    if (!ref?.messageId) break;
    if (activeSessions.has(ref.messageId)) return ref.messageId;
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
