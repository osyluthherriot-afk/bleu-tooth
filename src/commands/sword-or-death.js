/**
 * commands/sword-or-death.js
 *
 * SWORD OR DEATH: a DM-run challenge.
 *
 * The DM runs /swordordeath ac:<number> limit:<number>
 * Bleu posts a challenge message showing the target AC.
 * Players reply to that message with a Bogsy dice roll.
 * Bleu intercepts replies, compares the roll to the AC, and keeps a running
 * score. The round ends when:
 *   - The roll falls below the AC, OR
 *   - The configured limit of rounds is reached.
 */
import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { parseBogsyResult } from '../bogsyParser.js';

// In-memory store: sessionId -> SodSession
export const activeSessions = new Map();

/**
 * Find an active session by any message ID it has posted (initial or round results).
 * @param {string} messageId
 * @returns {Object|null}
 */
export function getSessionByMessageId(messageId) {
  for (const session of activeSessions.values()) {
    if (session.messageIds.has(messageId)) return session;
  }
  return null;
}

/**
 * Find an active session in a channel.
 * @param {string} channelId
 * @returns {Object|null}
 */
export function getSessionByChannel(channelId) {
  for (const session of activeSessions.values()) {
    if (session.channelId === channelId && session.alive) return session;
  }
  return null;
}

const QUOTES = [
  '"And on the eighth day he asked who had opened the seventh seal."',
  '"Behold, the altar burns without flame, and the fire burns without light."',
  '"The angel spoke once, and the mountain answered twice."',
  '"Write this vision before the trumpet, so that even the deaf may understand it."',
  '"And the heavens were divided, not because of anger, but because of the need to rule."',
  '"Seven lamps before the throne and eight shadows behind."',
  '"The form of the cherubim changed. There is no mention of it in the holy books."',
  '"And the sword goes everywhere except those who wield it."',
  '"Let there be light, so take it."',
  '"The fourth horseman arrived without a horse, and this is proof of that."',
  '"Blessed are the silences, machines do not understand."',
  '"Up down, in, nowhere."',
  '"He completed his tour of heaven. count your soul"',
  '"Saturn enters the house of unanswered questions."',
  '"Mercury retrograde is a test. The real problem is justice."',
  '"Subtle beats rough. book to the stars"',
  '"The positions of the celestial spheres are not aligned by one centimeter."',
  '"Don\'t line up with those bullets. They are not aligned."',
  '"Zodiac opened the thirteenth door and acted as if he had always been there."',
  '"Raise the world soul to the ninth level and then go down the ladder."',
  '"Correlator created. alternative interpretation."',
];

export const data = new SlashCommandBuilder()
  .setName('swordordeath')
  .setDescription('Start a SWORD OR DEATH challenge. Players must keep hitting the AC or fall.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ Only administrators can start Sword or Death.',
      ephemeral: true,
    });
  }

  const ac    = interaction.options.getInteger('ac');
  const limit = interaction.options.getInteger('limit') ?? 10;
  const quote = interaction.options.getString('custom_quote')
    ?? QUOTES[Math.floor(Math.random() * QUOTES.length)];

  const embed = new EmbedBuilder()
    .setColor(0x0055aa)
    .setTitle('SWORD OR DEATH')
    .setDescription(quote)
    .addFields(
      { name: 'Target to Beat', value: `**${ac}**`, inline: true },
      { name: 'Round Limit',    value: `**${limit}**`, inline: true },
      {
        name: 'How to play',
        value: `Reply to **this message** with a Bogsy dice roll.\n`
             + `Keep rolling: if your total falls below **${ac}**, you are done.\n`
             + `Bogsy syntax: \`.d20\` or \`.2d6+4\``,
      }
    )
    .setFooter({ text: 'Bleu the Blue Tooth | Sword or Death' });

  const reply = await interaction.reply({ embeds: [embed], fetchReply: true });

  // Register session keyed on the bot's reply message ID
  const session = {
    id: reply.id,
    channelId: interaction.channelId,
    messageIds: new Set([reply.id]),
    ac,
    limit,
    round: 0,
    history: [],     // { user, roll, beat }
    alive: true,
    lastTriggerTimestamp: 0,
    lastTriggerUser: null,
  };

  activeSessions.set(reply.id, session);
}

/**
 * Called by the message listener when a Bogsy message matches an active SoD session.
 * @param {import('discord.js').Message} message – the Bogsy result message
 * @param {Object|string} sessionOrId            – the session object or session ID
 */
export async function handleSodReply(message, sessionOrId) {
  const session = typeof sessionOrId === 'string'
    ? activeSessions.get(sessionOrId)
    : sessionOrId;

  if (!session || !session.alive) return;

  const parsed = parseBogsyResult(message.content);
  if (!parsed) return;

  session.round += 1;
  const beat = parsed.total >= session.ac;
  session.history.push({ user: parsed.user, roll: parsed.total, beat });

  const progressBar = session.history
    .map((h) => (h.beat ? '[O]' : '[X]'))
    .join(' ');

  const roundsLeft = session.limit - session.round;

  if (!beat) {
    session.alive = false;
    activeSessions.delete(session.id);

    const embed = new EmbedBuilder()
      .setColor(0xcc0000)
      .setTitle('FALLEN!')
      .setDescription(
        `${parsed.user} rolled **${parsed.total}** (needed **${session.ac}**).\n` +
        `*The blade finds its mark.*`
      )
      .addFields(
        { name: 'Rounds Survived', value: `${session.round - 1}`, inline: true },
        { name: 'Final Roll',      value: `${parsed.total}`,       inline: true },
        { name: 'History',         value: progressBar || 'None'                 }
      )
      .setFooter({ text: 'Sword or Death | Challenge over' });

    return message.reply({ embeds: [embed] });
  }

  if (session.round >= session.limit) {
    session.alive = false;
    activeSessions.delete(session.id);

    const embed = new EmbedBuilder()
      .setColor(0x00cc55)
      .setTitle('VICTORIOUS!')
      .setDescription(
        `${parsed.user} survived all **${session.limit}** rounds.\n` +
        `*The crowd roars. The blade is sheathed.*`
      )
      .addFields(
        { name: 'Rounds Completed', value: `${session.round}`, inline: true },
        { name: 'History',          value: progressBar                       }
      )
      .setFooter({ text: 'Sword or Death | Victory!' });

    return message.reply({ embeds: [embed] });
  }

  // Still alive: show progress
  const embed = new EmbedBuilder()
    .setColor(0x0055aa)
    .setTitle(`Round ${session.round}: Survived!`)
    .setDescription(
      `${parsed.user} rolled **${parsed.total}** >= **${session.ac}**\n` +
      `*Keep going: ${roundsLeft} round${roundsLeft !== 1 ? 's' : ''} remain.*`
    )
    .addFields({ name: 'History', value: progressBar })
    .setFooter({ text: 'Sword or Death | Reply with another Bogsy roll to continue' });

  const replyMsg = await message.reply({ embeds: [embed] });
  session.messageIds.add(replyMsg.id);
  session.lastTriggerTimestamp = 0;
  session.lastTriggerUser = null;
  return replyMsg;
}
