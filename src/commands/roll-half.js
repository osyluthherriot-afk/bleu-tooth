/**
 * commands/roll-half.js
 * Reply to a Bogsy message and halve all die rolls (rounded down, min 1).
 */
import { SlashCommandBuilder } from 'discord.js';
import { parseBogsyResult, isBogsy, halfRolls, formatResult } from '../bogsyParser.js';

export const data = new SlashCommandBuilder()
  .setName('half')
  .setDescription('Halve every die roll from a Bogsy message (rounded down, min 1).')
  .addStringOption((opt) =>
    opt
      .setName('message_id')
      .setDescription('The Message ID of the Bogsy roll to halve')
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
    return interaction.reply({
      content: '❌ No Bogsy roll found nearby. Provide a message ID or run right after a Bogsy roll.',
      ephemeral: true,
    });
  }

  const parsed = parseBogsyResult(bogsyMessage.content);
  if (!parsed) {
    return interaction.reply({ content: '❌ Could not parse that Bogsy roll.', ephemeral: true });
  }

  const result = halfRolls(parsed);
  await interaction.reply(formatResult('🔵 Halved', parsed.user, result));
}


