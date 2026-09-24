/**
 * bogsyParser.js
 * Parses and re-rolls dice based on Bogsy bot output format.
 *
 * Bogsy output example:
 *   @Nineveth d20 + 2d10  =   1d20 {10} + 2d10 {5 9} = ✨ 24 ✨
 *
 * This module:
 *  - Extracts individual die results from a Bogsy message
 *  - Provides a roller for arbitrary dice expressions
 *  - Provides transformation helpers (double, half, multiply, rank-up, etc.)
 */

// ─── Die roller ──────────────────────────────────────────────────────────────

/**
 * Roll a single die with `sides` faces.
 * @param {number} sides
 * @returns {number}
 */
export function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Roll `count` dice with `sides` faces.
 * @param {number} count
 * @param {number} sides
 * @returns {number[]}
 */
export function rollDice(count, sides) {
  return Array.from({ length: count }, () => rollDie(sides));
}

// ─── Bogsy output parser ──────────────────────────────────────────────────────

/**
 * Represents a parsed die group from a Bogsy message.
 * @typedef {Object} DieGroup
 * @property {number} count      – number of dice rolled
 * @property {number} sides      – die face count (e.g. 20, 10, 6)
 * @property {number[]} rolls    – individual roll results
 */

/**
 * Represents a parsed Bogsy result message.
 * @typedef {Object} BogsyResult
 * @property {string}     original  – original bogsy line
 * @property {string}     user      – @mentioned user
 * @property {string}     expr      – dice expression (e.g. "d20 + 2d10")
 * @property {DieGroup[]} groups    – parsed die groups with individual rolls
 * @property {number[]}   modifiers – flat numeric modifiers (+5, -2 etc.)
 * @property {number}     total     – the final total
 */

/**
 * Parse a Bogsy output line into a structured result.
 *
 * Supports both the short form and the expanded form:
 *   @User d20 + 2d10  =  1d20 {10} + 2d10 {5 9} = ✨ 24 ✨
 *
 * @param {string} text
 * @returns {BogsyResult|null}
 */
export function parseBogsyResult(text) {
  if (!text) return null;

  // Normalise whitespace / strip emoji
  const clean = text.replace(/✨/g, '').trim();

  // Capture: user mention, expression, expanded detail, total
  // Pattern: @User <expr> = <expanded> = <total>
  // The "expanded" section has groups like: NdS {r1 r2 ...}
  // Some rolls may be plain numbers (modifiers).
  const topMatch = clean.match(
    /^(<@[!&]?\d+>|@\S+)\s+(.+?)\s+=\s+(.+?)\s+=\s+(-?\d+)\s*$/
  );

  if (!topMatch) return null;

  const [, user, expr, expanded, totalStr] = topMatch;
  const total = parseInt(totalStr, 10);

  const groups = [];
  const modifiers = [];

  // Parse each token in the expanded section
  // Tokens: NdS {r1 r2 ...}  or  +5  or  -3
  const tokenRe = /(\d*)d(\d+)\s*\{([^}]*)\}|([+-]?\s*\d+)(?!\s*d)/gi;
  let m;
  while ((m = tokenRe.exec(expanded)) !== null) {
    if (m[1] !== undefined && m[2] !== undefined) {
      // Die group
      const count = parseInt(m[1] || '1', 10);
      const sides = parseInt(m[2], 10);
      const rolls = m[3].trim().split(/\s+/).map(Number).filter((n) => !isNaN(n));
      groups.push({ count, sides, rolls });
    } else if (m[4] !== undefined) {
      // Flat modifier
      const mod = parseInt(m[4].replace(/\s/g, ''), 10);
      if (!isNaN(mod)) modifiers.push(mod);
    }
  }

  return { original: text, user, expr, groups, modifiers, total };
}

// ─── Die rank helpers ─────────────────────────────────────────────────────────

/** Standard die rank ladder for rank-up/rank-down */
const DIE_LADDER = [4, 6, 8, 10, 12, 20, 100];

/**
 * Return the next higher die size (or same if already at max).
 * @param {number} sides
 * @returns {number}
 */
export function rankUp(sides) {
  const idx = DIE_LADDER.indexOf(sides);
  if (idx === -1) return sides; // unknown size — leave unchanged
  return DIE_LADDER[Math.min(idx + 1, DIE_LADDER.length - 1)];
}

/**
 * Return the next lower die size (or same if already at min).
 * @param {number} sides
 * @returns {number}
 */
export function rankDown(sides) {
  const idx = DIE_LADDER.indexOf(sides);
  if (idx === -1) return sides;
  return DIE_LADDER[Math.max(idx - 1, 0)];
}

// ─── Transformation helpers ───────────────────────────────────────────────────

/**
 * Double every individual die roll (not the modifiers).
 * @param {BogsyResult} parsed
 * @returns {{ groups: DieGroup[], modifiers: number[], total: number }}
 */
export function doubleRolls(parsed) {
  const groups = parsed.groups.map((g) => ({
    ...g,
    rolls: g.rolls.map((r) => r * 2),
  }));
  const total = sumResult({ groups, modifiers: parsed.modifiers });
  return { groups, modifiers: parsed.modifiers, total };
}

/**
 * Halve every individual die roll (rounded down, minimum 1).
 * @param {BogsyResult} parsed
 * @returns {{ groups: DieGroup[], modifiers: number[], total: number }}
 */
export function halfRolls(parsed) {
  const groups = parsed.groups.map((g) => ({
    ...g,
    rolls: g.rolls.map((r) => Math.max(1, Math.floor(r / 2))),
  }));
  const total = sumResult({ groups, modifiers: parsed.modifiers });
  return { groups, modifiers: parsed.modifiers, total };
}

/**
 * Multiply every individual die roll by a factor.
 * @param {BogsyResult} parsed
 * @param {number} factor
 * @returns {{ groups: DieGroup[], modifiers: number[], total: number }}
 */
export function multiplyRolls(parsed, factor) {
  const groups = parsed.groups.map((g) => ({
    ...g,
    rolls: g.rolls.map((r) => Math.floor(r * factor)),
  }));
  const total = sumResult({ groups, modifiers: parsed.modifiers });
  return { groups, modifiers: parsed.modifiers, total };
}

/**
 * Apply an arithmetic operation to the total (e.g. "total + 5", "total * 3").
 * @param {number} total
 * @param {string} op  – one of '+', '-', '*', '/'
 * @param {number} value
 * @returns {number}
 */
export function applyOpToTotal(total, op, value) {
  switch (op) {
    case '+': return total + value;
    case '-': return total - value;
    case '*': return Math.floor(total * value);
    case '/': return Math.floor(total / value);
    default:  return total;
  }
}

/**
 * Re-roll all dice in the parsed result one rank higher and return a new result.
 * @param {BogsyResult} parsed
 * @returns {{ groups: DieGroup[], modifiers: number[], total: number }}
 */
export function rankUpReroll(parsed) {
  const groups = parsed.groups.map((g) => {
    const newSides = rankUp(g.sides);
    const rolls = rollDice(g.count, newSides);
    return { count: g.count, sides: newSides, rolls };
  });
  const total = sumResult({ groups, modifiers: parsed.modifiers });
  return { groups, modifiers: parsed.modifiers, total };
}

/**
 * Great Weapon Fighting: replace any 1 or 2 on damage dice with 3.
 * @param {BogsyResult} parsed
 * @returns {{ groups: DieGroup[], modifiers: number[], total: number, replaced: number }}
 */
export function greatWeaponFighting(parsed) {
  let replaced = 0;
  const groups = parsed.groups.map((g) => ({
    ...g,
    rolls: g.rolls.map((r) => {
      if (r <= 2) { replaced++; return 3; }
      return r;
    }),
  }));
  const total = sumResult({ groups, modifiers: parsed.modifiers });
  return { groups, modifiers: parsed.modifiers, total, replaced };
}

/**
 * Savage Attacker: re-roll ALL damage dice once and keep whichever roll is higher per die.
 * @param {BogsyResult} parsed
 * @returns {{ groups: DieGroup[], modifiers: number[], total: number }}
 */
export function savageAttacker(parsed) {
  const groups = parsed.groups.map((g) => {
    const rerolled = rollDice(g.count, g.sides);
    const rolls = g.rolls.map((orig, i) => Math.max(orig, rerolled[i]));
    return { ...g, rolls };
  });
  const total = sumResult({ groups, modifiers: parsed.modifiers });
  return { groups, modifiers: parsed.modifiers, total };
}

/**
 * Tavern Brawler: re-roll each die that shows a 1, take the new result.
 * @param {BogsyResult} parsed
 * @returns {{ groups: DieGroup[], modifiers: number[], total: number, rerolled: number }}
 */
export function tavernBrawler(parsed) {
  let rerolled = 0;
  const groups = parsed.groups.map((g) => ({
    ...g,
    rolls: g.rolls.map((r) => {
      if (r === 1) { rerolled++; return rollDie(g.sides); }
      return r;
    }),
  }));
  const total = sumResult({ groups, modifiers: parsed.modifiers });
  return { groups, modifiers: parsed.modifiers, total, rerolled };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Sum all die rolls and modifiers.
 * @param {{ groups: DieGroup[], modifiers: number[] }} result
 * @returns {number}
 */
export function sumResult({ groups, modifiers }) {
  const diceSum = groups.reduce((a, g) => a + g.rolls.reduce((b, r) => b + r, 0), 0);
  const modSum  = modifiers.reduce((a, m) => a + m, 0);
  return diceSum + modSum;
}

/**
 * Format a result back into a Bogsy-style string for display in Discord.
 * @param {string} label           – Action label (e.g. "Doubled", "Rank Up Re-roll")
 * @param {string} user            – @mention
 * @param {{ groups: DieGroup[], modifiers: number[], total: number }} result
 * @param {string} [extra]         – Optional extra note appended in italics
 * @returns {string}
 */
export function formatResult(label, user, { groups, modifiers, total }, extra = '') {
  const groupStr = groups
    .map((g) => `${g.count}d${g.sides} {${g.rolls.join(' ')}}`)
    .join(' + ');
  const modStr = modifiers.map((m) => (m >= 0 ? `+ ${m}` : `- ${Math.abs(m)}`)).join(' ');
  const detail = [groupStr, modStr].filter(Boolean).join(' ');
  const note = extra ? `\n*${extra}*` : '';
  return `${user} **${label}**\n${detail} = ✨ **${total}** ✨${note}`;
}
