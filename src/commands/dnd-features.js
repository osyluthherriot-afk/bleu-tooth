/**
 * commands/dnd-features.js
 * D&D 5.5e special roll features:
 *   /gwf         — Great Weapon Fighting (replace 1s and 2s with 3)
 *   /savageattack — Savage Attacker (re-roll all damage dice, keep higher per die)
 *   /tavernbrawler — Tavern Brawler (re-roll all 1s)
 */
import { SlashCommandBuilder } from 'discord.js';
import {
  parseBogsyResult,
  isBogsy,
  greatWeaponFighting,
  savageAttacker,
  tavernBrawler,
  formatResult,
} from '../bogsyParser.js';

// ─── Great Weapon Fighting ────────────────────────────────────────────────────
export const gwfData = new SlashCommandBuilder()
  .setName('gwf')
  .setDescription('Great Weapon Fighting: replace any 1 or 2 on damage dice with 3.')
  .addStringOption((opt) =>
    opt.setName('message_id').setDescription('Message ID of Bogsy roll (optional)').setRequired(false)
  );

export async function executeGwf(interaction) {
  const parsed = await fetchAndParse(interaction);
  if (!parsed) return;

  const result = greatWeaponFighting(parsed);
  const note = result.replaced
    ? `${result.replaced} die${result.replaced > 1 ? 's' : ''} replaced with 3`
    : 'No dice needed replacing';

  await interaction.reply(formatResult('⚔️ Great Weapon Fighting', parsed.user, result, note));
}

// ─── Savage Attacker ──────────────────────────────────────────────────────────
export const savageData = new SlashCommandBuilder()
  .setName('savageattack')
  .setDescription('Savage Attacker: re-roll all damage dice once, keep higher result per die.')
  .addStringOption((opt) =>
    opt.setName('message_id').setDescription('Message ID of Bogsy roll (optional)').setRequired(false)
  );

export async function executeSavage(interaction) {
  const parsed = await fetchAndParse(interaction);
  if (!parsed) return;

  const result = savageAttacker(parsed);
  await interaction.reply(
    formatResult('🪓 Savage Attacker', parsed.user, result, 'All dice re-rolled; kept higher per die')
  );
}

// ─── Tavern Brawler ───────────────────────────────────────────────────────────
export const brawlerData = new SlashCommandBuilder()
  .setName('tavernbrawler')
  .setDescription('Tavern Brawler: re-roll each damage die that shows a 1.')
  .addStringOption((opt) =>
    opt.setName('message_id').setDescription('Message ID of Bogsy roll (optional)').setRequired(false)
  );

export async function executeBrawler(interaction) {
  const parsed = await fetchAndParse(interaction);
  if (!parsed) return;

  const result = tavernBrawler(parsed);
  const note = result.rerolled
    ? `${result.rerolled} die${result.rerolled > 1 ? 's' : ''} re-rolled (showed 1)`
    : 'No 1s to re-roll';

  await interaction.reply(formatResult('🍺 Tavern Brawler', parsed.user, result, note));
}

// ─── Shared helper ────────────────────────────────────────────────────────────
async function fetchAndParse(interaction) {
  const msgId   = interaction.options.getString('message_id');
  const channel = interaction.channel;

  let bogsyMessage;
  try {
    bogsyMessage = msgId
      ? await channel.messages.fetch(msgId)
      : (await channel.messages.fetch({ limit: 10 })).find(
          (m) => m.author.bot && isBogsy(m.content)
        );
  } catch {
    await interaction.reply({ content: '❌ Could not find the Bogsy message.', ephemeral: true });
    return null;
  }

  if (!bogsyMessage) {
    await interaction.reply({ content: '❌ No Bogsy roll found nearby.', ephemeral: true });
    return null;
  }

  const parsed = parseBogsyResult(bogsyMessage.content);
  if (!parsed) {
    await interaction.reply({ content: '❌ Could not parse that Bogsy roll.', ephemeral: true });
    return null;
  }

  return parsed;
}


