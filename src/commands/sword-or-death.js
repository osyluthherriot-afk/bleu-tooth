/**
 * commands/sword-or-death.js
 *
 * SWORD OR DEATH — a DM-run challenge.
 *
 * The DM runs /swordordeath ac:<number> limit:<number>
 * Bleu posts a dramatic challenge message showing the target AC.
 * Players reply to that message with a Bogsy dice roll.
 * Bleu intercepts replies, compares the roll to the AC, and keeps a running
 * score. The round ends when:
 *   - The roll falls below the AC, OR
 *   - The configured limit of rounds is reached.
 */
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { parseBogsyResult } from '../bogsyParser.js';

// In-memory store: messageId → SodSession
export const activeSessions = new Map();

const QUOTES = [
  '"Steel your nerve. The blade awaits."',
  '"Fortune favours the bold — or buries them."',
  '"Every swing could be your last. Make it count."',
  '"The dice do not care for heroes."',
  '"Fate is a cruel game master."',
  '"Die with glory, or live with shame."',
  '"The floor is red. The dice are redder."',
];

export const data = new SlashCommandBuilder()
  .setName('swordordeath')
  .setDescription('🗡️ Start a SWORD OR DEATH challenge. Players must keep hitting the AC or fall.')
  .addIntegerOption((opt) =>
    opt
      .setName('ac')
      .setDescription('The Armour Class / target number to beat')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(30)
  )
  .addIntegerOption((opt) =>
    opt
      .setName('limit')
      .setDescription('Maximum number of rounds (default: 10)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(50)
  )
  .addStringOption((opt) =>
    opt
      .setName('custom_quote')
      .setDescription('Custom flavour text for the challenge (optional)')
      .setRequired(false)
  );

export async function execute(interaction) {
  const ac    = interaction.options.getInteger('ac');
  const limit = interaction.options.getInteger('limit') ?? 10;
  const quote = interaction.options.getString('custom_quote')
    ?? QUOTES[Math.floor(Math.random() * QUOTES.length)];

  const embed = new EmbedBuilder()
    .setColor(0x0055aa)
    .setTitle('⚔️ SWORD OR DEATH ⚔️')
    .setDescription(quote)
    .addFields(
      { name: '🎯 Target to Beat', value: `**${ac}**`, inline: true },
      { name: '🔢 Round Limit',    value: `**${limit}**`, inline: true },
      { name: '📜 How to play',
        value: `Reply to **this message** with a Bogsy dice roll.\n`
             + `Keep rolling — if your total falls below **${ac}**, you're done!\n`
             + `Bogsy syntax: \`.d20\` or \`.2d6+4\`` }
    )
    .setFooter({ text: 'Bleu the Blue Tooth • Sword or Death' });

  const reply = await interaction.reply({ embeds: [embed], fetchReply: true });

  // Register session keyed on the bot's reply message ID
  activeSessions.set(reply.id, {
    ac,
    limit,
    round: 0,
    history: [],     // { user, roll, beat }
    alive: true,
  });
}

/**
 * Called by the message listener when a message references an active SoD session.
 * @param {import('discord.js').Message} message – the player's reply
 * @param {string} sessionId                     – the bot message ID the player replied to
 */
export async function handleSodReply(message, sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session || !session.alive) return;

  // Bogsy posts the result as a reply too — wait a moment and look for it
  // We watch for Bogsy's response that was triggered by this message.
  // Because Bogsy is async, we give it a short window.
  // If the message itself IS a Bogsy result, parse it directly.
  const parsed = parseBogsyResult(message.content);

  if (!parsed) {
    // Not a Bogsy result yet — might be the player's trigger command.
    // We'll catch Bogsy's follow-up in the messageCreate handler.
    return;
  }

  session.round += 1;
  const beat = parsed.total >= session.ac;
  session.history.push({ user: parsed.user, roll: parsed.total, beat });

  const progressBar = session.history
    .map((h) => (h.beat ? '🟦' : '🟥'))
    .join('');

  const roundsLeft = session.limit - session.round;

  if (!beat) {
    session.alive = false;
    activeSessions.delete(sessionId);

    const embed = new EmbedBuilder()
      .setColor(0xcc0000)
      .setTitle('💀 FALLEN! 💀')
      .setDescription(
        `${parsed.user} rolled **${parsed.total}** — needed **${session.ac}**.\n` +
        `*The blade finds its mark.*`
      )
      .addFields(
        { name: 'Rounds Survived', value: `${session.round - 1}`, inline: true },
        { name: 'Final Roll',      value: `${parsed.total}`,       inline: true },
        { name: 'History',         value: progressBar || '—'                   }
      )
      .setFooter({ text: 'Sword or Death • Challenge over' });

    return message.reply({ embeds: [embed] });
  }

  if (session.round >= session.limit) {
    session.alive = false;
    activeSessions.delete(sessionId);

    const embed = new EmbedBuilder()
      .setColor(0x00cc55)
      .setTitle('🏆 VICTORIOUS! 🏆')
      .setDescription(
        `${parsed.user} survived all **${session.limit}** rounds!\n` +
        `*The crowd roars. The blade is sheathed.*`
      )
      .addFields(
        { name: 'Rounds Completed', value: `${session.round}`, inline: true },
        { name: 'History',          value: progressBar                       }
      )
      .setFooter({ text: 'Sword or Death • Victory!' });

    return message.reply({ embeds: [embed] });
  }

  // Still alive — show progress
  const embed = new EmbedBuilder()
    .setColor(0x0055aa)
    .setTitle(`⚔️ Round ${session.round} — Survived!`)
    .setDescription(
      `${parsed.user} rolled **${parsed.total}** ≥ **${session.ac}** ✅\n` +
      `*Keep going — ${roundsLeft} round${roundsLeft !== 1 ? 's' : ''} remain!*`
    )
    .addFields({ name: 'History', value: progressBar })
    .setFooter({ text: 'Sword or Death • Reply with another Bogsy roll to continue' });

  return message.reply({ embeds: [embed] });
}
