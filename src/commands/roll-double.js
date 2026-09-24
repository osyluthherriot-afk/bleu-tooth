/**
 * commands/roll-double.js
 * Reply to a Bogsy message and double all die rolls.
 */
import { SlashCommandBuilder } from 'discord.js';
import { parseBogsyResult, isBogsy, doubleRolls, formatResult } from '../bogsyParser.js';

export const data = new SlashCommandBuilder()
  .setName('double')
  .setDescription('Double every die roll from a Bogsy message.')
  .addStringOption((opt) =>
    opt
      .setName('message_id')
      .setDescription('The Message ID of the Bogsy roll to double')
      .setRequired(false)
  );

export async function execute(interaction) {
  // Try to get referenced message from context or option
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
    return interaction.reply({
      content: '❌ No Bogsy roll found nearby. Provide a message ID or run right after a Bogsy roll.',
      ephemeral: true,
    });
  }

  const parsed = parseBogsyResult(bogsyMessage.content);
  if (!parsed) {
    return interaction.reply({ content: '❌ Could not parse that Bogsy roll.', ephemeral: true });
  }

  const result = doubleRolls(parsed);
  await interaction.reply(formatResult('🔵 Doubled', parsed.user, result));
}


