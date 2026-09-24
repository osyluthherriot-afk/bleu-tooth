/**
 * commands/context-menus.js
 *
 * Message context menu commands — right-click any Bogsy message → Apps → pick action.
 * These are far more convenient than slash commands with message IDs.
 */
import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
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
  msgMenu('🔵 Double Roll'),
  msgMenu('🔵 Half Roll'),
  msgMenu('🔵 Rank Up & Re-roll'),
  msgMenu('⚔️ Great Weapon Fighting'),
  msgMenu('🪓 Savage Attacker'),
  msgMenu('🍺 Tavern Brawler'),
];

// ── Shared parse helper ───────────────────────────────────────────────────────

function getParsed(interaction) {
  const msg    = interaction.targetMessage;
  const parsed = parseBogsyResult(msg.content);
  return parsed;
}

async function failNotBogsy(interaction) {
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
