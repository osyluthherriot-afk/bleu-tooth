/**
 * commands/roll-multiply.js
 * Apply an arithmetic operation to a Bogsy roll total.
 * Supports: +, -, *, /
 */
import { SlashCommandBuilder } from 'discord.js';
import { parseBogsyResult, applyOpToTotal, formatResult } from '../bogsyParser.js';

export const data = new SlashCommandBuilder()
  .setName('rollop')
  .setDescription('Apply a math operation to a Bogsy roll total.')
  .addStringOption((opt) =>
    opt
      .setName('operation')
      .setDescription('Operation to apply (+, -, *, /)')
      .setRequired(true)
      .addChoices(
        { name: 'Add (+)', value: '+' },
        { name: 'Subtract (-)', value: '-' },
        { name: 'Multiply (*)', value: '*' },
        { name: 'Divide (/)', value: '/' }
      )
  )
  .addNumberOption((opt) =>
    opt.setName('value').setDescription('The number to apply').setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName('message_id')
      .setDescription('The Message ID of the Bogsy roll (optional, defaults to last roll)')
      .setRequired(false)
  );

export async function execute(interaction) {
  const op    = interaction.options.getString('operation');
  const value = interaction.options.getNumber('value');
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
      content: '❌ No Bogsy roll found nearby.',
      ephemeral: true,
    });
  }

  const parsed = parseBogsyResult(bogsyMessage.content);
  if (!parsed) {
    return interaction.reply({ content: '❌ Could not parse that Bogsy roll.', ephemeral: true });
  }

  const newTotal = applyOpToTotal(parsed.total, op, value);
  const opLabel = `${op} ${value}`;

  // Show groups unchanged but apply operation to total
  await interaction.reply(
    formatResult(
      `🔵 Roll ${opLabel}`,
      parsed.user,
      { groups: parsed.groups, modifiers: parsed.modifiers, total: newTotal }
    )
  );
}

function isBogsy(content) {
  return /\d+d\d+\s*\{/.test(content) && content.includes('✨');
}
