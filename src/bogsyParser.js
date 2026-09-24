/**
 * bogsyParser.js
 * Parses and re-rolls dice based on Bogsy bot output format.
 *
 * Example Bogsy outputs:
 *   @Nineveth **d20** = **1d20 {9}** = ✨ **9** ✨
 *   <@318854497334788097> **d20 + 2d10** = **1d20 {10} + 2d10 {5 9}** = ✨ **24** ✨
 *   @Nineveth d20 = 1d20 {9} = ✨ 9 ✨
 *   Perception = 1d20 {12} + 4 = ✨ 16 ✨
 */

// ─── Die roller ──────────────────────────────────────────────────────────────

export function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollDice(count, sides) {
  return Array.from({ length: count }, () => rollDie(sides));
}

// ─── Bogsy output parser ──────────────────────────────────────────────────────

/**
 * @typedef {Object} DieGroup
 * @property {number} count
 * @property {number} sides
 * @property {number[]} rolls
 */

/**
 * @typedef {Object} BogsyResult
 * @property {string}     original
 * @property {string}     user
 * @property {string}     expr
 * @property {DieGroup[]} groups
 * @property {number[]}   modifiers
 * @property {number}     total
 */

/**
 * Test whether a text string looks like a Bogsy roll.
 * @param {string} text
 * @returns {boolean}
 */
export function isBogsy(text) {
  return parseBogsyResult(text) !== null;
}

/**
 * Parse a Bogsy output line into a structured result.
 *
 * @param {string} text
 * @returns {BogsyResult|null}
 */
export function parseBogsyResult(text) {
  if (!text) return null;

  // Clean markdown syntax (*, _, ~, `) that Bogsy uses for bolding/strikethrough
  const clean = text.replace(/[*_~`]/g, '').trim();

  // Must contain at least one die notation with brace results, e.g. 1d20 {9} or d20 {9}
  if (!/\d*d\d+\s*\{[^}]*\}/i.test(clean)) return null;

  // Must have an '=' separating parts
  if (!clean.includes('=')) return null;

  const sections = clean.split('=');
  if (sections.length < 2) return null;

  // 1. Extract final total from the last section (after the final '=')
  const lastSection = sections[sections.length - 1];
  const totalMatch = lastSection.match(/-?\d+/);
  if (!totalMatch) return null;
  const total = parseInt(totalMatch[0], 10);

  // 2. Extract user mention (e.g. <@12345> or @Username)
  const userMatch = text.match(/^(<@!?\d+>|@\S+)/);
  const user = userMatch ? userMatch[1] : '';

  // 3. Extract original expression (before the first '=')
  const firstSection = sections[0].trim();
  const expr = firstSection.replace(/^(<@!?\d+>|@\S+)\s*/, '').trim();

  // 4. Extract all die groups: NdS {r1 r2 ...}
  const groups = [];
  const dieGroupRe = /(\d*)d(\d+)\s*\{([^}]*)\}/gi;
  let m;
  while ((m = dieGroupRe.exec(clean)) !== null) {
    const count = parseInt(m[1] || '1', 10);
    const sides = parseInt(m[2], 10);
    const rolls = m[3]
      .trim()
      .split(/\s+/)
      .map((n) => parseInt(n.replace(/\D/g, ''), 10))
      .filter((n) => !isNaN(n));
    if (rolls.length > 0) {
      groups.push({ count, sides, rolls });
    }
  }

  if (groups.length === 0) return null;

  // 5. Extract flat modifiers from middle sections (e.g. + 5, - 2)
  const modifiers = [];
  if (sections.length >= 3) {
    const expanded = sections.slice(1, -1).join('=');
    const stripped = expanded.replace(/\d*d\d+\s*\{[^}]*\}/gi, '');
    const modRe = /([+-])\s*(\d+)(?!\s*d)/g;
    let mm;
    while ((mm = modRe.exec(stripped)) !== null) {
      const val = parseInt(mm[2], 10);
      modifiers.push(mm[1] === '-' ? -val : val);
    }
  }

  return { original: text, user, expr, groups, modifiers, total };
}

// ─── Die rank helpers ─────────────────────────────────────────────────────────

const DIE_LADDER = [4, 6, 8, 10, 12, 20, 100];

export function rankUp(sides) {
  const idx = DIE_LADDER.indexOf(sides);
  if (idx === -1) return sides;
  return DIE_LADDER[Math.min(idx + 1, DIE_LADDER.length - 1)];
}

export function rankDown(sides) {
  const idx = DIE_LADDER.indexOf(sides);
  if (idx === -1) return sides;
  return DIE_LADDER[Math.max(idx - 1, 0)];
}

// ─── Transformation helpers ───────────────────────────────────────────────────

export function doubleRolls(parsed) {
  const groups = parsed.groups.map((g) => ({
    ...g,
    rolls: g.rolls.map((r) => r * 2),
  }));
  const total = sumResult({ groups, modifiers: parsed.modifiers });
  return { groups, modifiers: parsed.modifiers, total };
}

export function halfRolls(parsed) {
  const groups = parsed.groups.map((g) => ({
    ...g,
    rolls: g.rolls.map((r) => Math.max(1, Math.floor(r / 2))),
  }));
  const total = sumResult({ groups, modifiers: parsed.modifiers });
  return { groups, modifiers: parsed.modifiers, total };
}

export function multiplyRolls(parsed, factor) {
  const groups = parsed.groups.map((g) => ({
    ...g,
    rolls: g.rolls.map((r) => Math.floor(r * factor)),
  }));
  const total = sumResult({ groups, modifiers: parsed.modifiers });
  return { groups, modifiers: parsed.modifiers, total };
}

export function applyOpToTotal(total, op, value) {
  switch (op) {
    case '+': return total + value;
    case '-': return total - value;
    case '*': return Math.floor(total * value);
    case '/': return Math.floor(total / value);
    default:  return total;
  }
}

export function rankUpReroll(parsed) {
  const groups = parsed.groups.map((g) => {
    const newSides = rankUp(g.sides);
    const rolls = rollDice(g.count, newSides);
    return { count: g.count, sides: newSides, rolls };
  });
  const total = sumResult({ groups, modifiers: parsed.modifiers });
  return { groups, modifiers: parsed.modifiers, total };
}

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

export function savageAttacker(parsed) {
  const groups = parsed.groups.map((g) => {
    const rerolled = rollDice(g.count, g.sides);
    const rolls = g.rolls.map((orig, i) => Math.max(orig, rerolled[i]));
    return { ...g, rolls };
  });
  const total = sumResult({ groups, modifiers: parsed.modifiers });
  return { groups, modifiers: parsed.modifiers, total };
}

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

export function sumResult({ groups, modifiers }) {
  const diceSum = groups.reduce((a, g) => a + g.rolls.reduce((b, r) => b + r, 0), 0);
  const modSum  = modifiers.reduce((a, m) => a + m, 0);
  return diceSum + modSum;
}

export function formatResult(label, user, { groups, modifiers, total }, extra = '') {
  const groupStr = groups
    .map((g) => `${g.count}d${g.sides} {${g.rolls.join(' ')}}`)
    .join(' + ');
  const modStr = modifiers
    .map((m) => (m >= 0 ? `+ ${m}` : `- ${Math.abs(m)}`))
    .join(' ');
  const detail = [groupStr, modStr].filter(Boolean).join(' ');
  const note = extra ? `\n*${extra}*` : '';
  const prefix = user ? `${user} ` : '';
  return `${prefix}**${label}**\n${detail} = ✨ **${total}** ✨${note}`;
}
