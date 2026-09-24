/**
 * bogsyParser.js
 * Parses and re-rolls dice based on Bogsy bot output format.
 *
 * Bogsy output example:
 *   @Nineveth d20 + 2d10  =   1d20 {10} + 2d10 {5 9} = ✨ 24 ✨
 *   <@123456789> d20 + 2d10  =   1d20 {10} + 2d10 {5 9} = ✨ 24 ✨
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
 * Parse a Bogsy output line into a structured result.
 * Strategy:
 *  1. Extract the ✨ total ✨ from the end
 *  2. Extract all NdS {r1 r2 ...} groups from anywhere in the string
 *  3. The user mention is the first token
 *
 * @param {string} text
 * @returns {BogsyResult|null}
 */
export function parseBogsyResult(text) {
  if (!text) return null;

  // ── 1. Must contain ✨ and at least one die group ──────────────────────────
  if (!text.includes('✨')) return null;
  if (!/\d*d\d+\s*\{/.test(text)) return null;

  // ── 2. Extract the final total (number between last pair of ✨) ────────────
  const totalMatch = text.match(/✨\s*(-?\d+)\s*✨\s*$/);
  if (!totalMatch) return null;
  const total = parseInt(totalMatch[1], 10);

  // ── 3. Extract user mention (first token: <@id> or @name) ─────────────────
  const userMatch = text.match(/^(<@!?\d+>|@\S+)/);
  const user = userMatch ? userMatch[1] : '';

  // ── 4. Extract the dice expression (between first token and first "=") ────
  const exprMatch = text.match(/(?:<@!?\d+>|@\S+)\s+(.+?)\s*=/);
  const expr = exprMatch ? exprMatch[1].trim() : '';

  // ── 5. Extract all die groups: NdS {r1 r2 ...} ────────────────────────────
  const groups = [];
  const dieGroupRe = /(\d*)d(\d+)\s*\{([^}]*)\}/gi;
  let m;
  while ((m = dieGroupRe.exec(text)) !== null) {
    const count = parseInt(m[1] || '1', 10);
    const sides = parseInt(m[2], 10);
    const rolls = m[3]
      .trim()
      .split(/\s+/)
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0);
    if (rolls.length > 0) groups.push({ count, sides, rolls });
  }

  if (groups.length === 0) return null;

  // ── 6. Extract flat modifiers ──────────────────────────────────────────────
  // Look in the section between the first "=" and the last "=" for modifiers
  // that aren't part of a die group
  const sections = text.split('=');
  const modifiers = [];
  // modifiers appear in the expanded section (between the two = signs)
  if (sections.length >= 3) {
    const expanded = sections.slice(1, -1).join('=');
    // Remove all die group tokens first, then find loose numbers
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
  return `${user} **${label}**\n${detail} = ✨ **${total}** ✨${note}`;
}
