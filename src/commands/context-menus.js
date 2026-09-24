/**
 * commands/context-menus.js
 *
 * Message context menu commands — right-click any Bogsy message → Apps → pick action.
 * These are far more convenient than slash commands with message IDs.
 */
import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import {
  parseBogsyResult,
  doubleRolls,
  halfRolls,
  rankUpReroll,
  greatWeaponFighting,
  savageAttacker,
  tavernBrawler,
  applyOpToTotal,
  formatResult,
} from '../bogsyParser.js';

// ── Builder helpers ───────────────────────────────────────────────────────────

function msgMenu(name) {
  return new ContextMenuCommandBuilder()
    .setName(name)
    .setType(ApplicationCommandType.Message);
}

// ── Exported command definitions ──────────────────────────────────────────────

export const contextMenuData = [
  msgMenu('🔵 Math Operation'),
  msgMenu('🔵 Double Roll'),
  msgMenu('🔵 Half Roll'),
  msgMenu('🔵 Rank Up & Re-roll'),
  msgMenu('⚔️ Great Weapon Fighting'),
  msgMenu('🪓 Savage Attacker'),
  msgMenu('🍺 Tavern Brawler'),
];

// ── Shared parse helper ───────────────────────────────────────────────────────

function getParsed(interaction) {
  const msg = interaction.targetMessage;
  const content = msg?.content || msg?.embeds?.[0]?.description || '';
  return parseBogsyResult(content);
}

async function failNotBogsy(interaction) {
  const content = interaction.targetMessage?.content;
  console.log('[Context Menu] Failed to parse message content:', JSON.stringify(content));
  return interaction.reply({
    content: '❌ That message doesn\'t look like a Bogsy roll. Right-click a Bogsy result message.',
    ephemeral: true,
  });
}

// ── Executor map ──────────────────────────────────────────────────────────────

export async function executeContextMenu(interaction) {
  const name   = interaction.commandName;
  const parsed = getParsed(interaction);

  if (!parsed) return failNotBogsy(interaction);

  // ── Modal for Math Operation (RollOp) ──────────────────────────────────────
  if (name === '🔵 Math Operation') {
    const modal = new ModalBuilder()
      .setCustomId(`rollop_modal_${interaction.targetMessage.id}`)
      .setTitle('Apply Math to Roll');

    const input = new TextInputBuilder()
      .setCustomId('math_input')
      .setLabel('Operation & Number (e.g. +5, *2, /4)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('+5, -3, *2, /4')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  switch (name) {
    case '🔵 Double Roll': {
      const result = doubleRolls(parsed);
      return interaction.reply(formatResult('🔵 Doubled', parsed.user, result));
    }

    case '🔵 Half Roll': {
      const result = halfRolls(parsed);
      return interaction.reply(formatResult('🔵 Halved', parsed.user, result));
    }

    case '🔵 Rank Up & Re-roll': {
      const before = parsed.groups.map((g) => `${g.count}d${g.sides}`).join(' + ');
      const result = rankUpReroll(parsed);
      const after  = result.groups.map((g) => `${g.count}d${g.sides}`).join(' + ');
      return interaction.reply(
        formatResult('🔵 Rank Up Re-roll', parsed.user, result, `${before} → ${after}`)
      );
    }

    case '⚔️ Great Weapon Fighting': {
      const result = greatWeaponFighting(parsed);
      const note   = result.replaced
        ? `${result.replaced} die${result.replaced > 1 ? 's' : ''} replaced with 3`
        : 'No dice needed replacing';
      return interaction.reply(formatResult('⚔️ Great Weapon Fighting', parsed.user, result, note));
    }

    case '🪓 Savage Attacker': {
      const result = savageAttacker(parsed);
      return interaction.reply(
        formatResult('🪓 Savage Attacker', parsed.user, result, 'All dice re-rolled; kept higher per die')
      );
    }

    case '🍺 Tavern Brawler': {
      const result = tavernBrawler(parsed);
      const note   = result.rerolled
        ? `${result.rerolled} die${result.rerolled > 1 ? 's' : ''} re-rolled (showed 1)`
        : 'No 1s to re-roll';
      return interaction.reply(formatResult('🍺 Tavern Brawler', parsed.user, result, note));
    }

    default:
      return interaction.reply({ content: '❌ Unknown context menu action.', ephemeral: true });
  }
}

// ── Modal submit handler for Math Operation ───────────────────────────────────

export async function handleModalSubmit(interaction) {
  if (!interaction.customId.startsWith('rollop_modal_')) return;

  const targetMessageId = interaction.customId.replace('rollop_modal_', '');
  let targetMsg;
  try {
    targetMsg = await interaction.channel.messages.fetch(targetMessageId);
  } catch (err) {
    return interaction.reply({
      content: '❌ Could not find the original Bogsy message.',
      ephemeral: true,
    });
  }

  const content = targetMsg?.content || targetMsg?.embeds?.[0]?.description || '';
  const parsed = parseBogsyResult(content);
  if (!parsed) {
    return interaction.reply({
      content: '❌ Could not parse the Bogsy roll.',
      ephemeral: true,
    });
  }

  const rawInput = interaction.fields.getTextInputValue('math_input').trim();
  const match = rawInput.match(/^([+\-*/xX])\s*(\d+(?:\.\d+)?)$/);
  if (!match) {
    return interaction.reply({
      content: '❌ Invalid format. Please enter an operation and number like `+5`, `-3`, `*2`, or `/4`.',
      ephemeral: true,
    });
  }

  let op = match[1];
  if (op.toLowerCase() === 'x') op = '*';
  const value = parseFloat(match[2]);

  const newTotal = applyOpToTotal(parsed.total, op, value);
  const opLabel = `${op} ${value}`;

  return interaction.reply(
    formatResult(
      `🔵 Roll ${opLabel}`,
      parsed.user,
      { groups: parsed.groups, modifiers: parsed.modifiers, total: newTotal }
    )
  );
}
