/**
 * commands/rank-up.js
 * Increase the rank of all dice in a Bogsy roll and re-roll them.
 * Rank ladder: d4 → d6 → d8 → d10 → d12 → d20 → d100
 */
import { SlashCommandBuilder } from 'discord.js';
import { parseBogsyResult, isBogsy, rankUpReroll, formatResult } from '../bogsyParser.js';

export const data = new SlashCommandBuilder()
  .setName('rankup')
  .setDescription('Increase the die rank of a Bogsy roll and re-roll (d6→d8, d10→d12, etc.).')
  .addStringOption((opt) =>
    opt
      .setName('message_id')
      .setDescription('The Message ID of the Bogsy roll (optional)')
      .setRequired(false)
  );

export async function execute(interaction) {
  const msgId = interaction.options.getString('message_id');
  const channel = interaction.channel;

  let bogsyMessage;
  try {
    bogsyMessage = msgId
      ? await channel.messages.fetch(msgId)
      : (await channel.messages.fetch({ limit: 10 })).find(
          (m) => m.author.bot && isBogsy(m.content)
        );
  } catch {
    return interaction.reply({ content: '❌ Could not find the Bogsy message.', ephemeral: true });
  }

  if (!bogsyMessage) {
    return interaction.reply({ content: '❌ No Bogsy roll found nearby.', ephemeral: true });
  }

  const parsed = parseBogsyResult(bogsyMessage.content);
  if (!parsed) {
    return interaction.reply({ content: '❌ Could not parse that Bogsy roll.', ephemeral: true });
  }

  const before = parsed.groups.map((g) => `${g.count}d${g.sides}`).join(' + ');
  const result = rankUpReroll(parsed);
  const after  = result.groups.map((g) => `${g.count}d${g.sides}`).join(' + ');

  await interaction.reply(
    formatResult(
      '🔵 Rank Up Re-roll',
      parsed.user,
      result,
      `Dice upgraded: ${before} → ${after}`
    )
  );
}


