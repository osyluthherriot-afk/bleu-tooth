/**
 * commands/tr.js
 *
 * Anonymous echo command: sends an inputted message as Bleu
 * without revealing who invoked it. Restricted to Administrators.
 */
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('tr')
  .setDescription('Speak as Bleu anonymously (Admin only).')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt
      .setName('message')
      .setDescription('The message Bleu will say')
      .setRequired(true)
  );

export async function execute(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ Only administrators can use this command.',
      ephemeral: true,
    });
  }

  const text = interaction.options.getString('message');

  try {
    await interaction.channel.send(text);
    await interaction.reply({
      content: 'Message sent.',
      ephemeral: true,
    });
  } catch (err) {
    console.error('Error sending /tr message:', err);
    await interaction.reply({
      content: '❌ Failed to send message in this channel.',
      ephemeral: true,
    });
  }
}
