#!/usr/bin/env node
// Strict validator for all game data files against docs/DESIGN.md.
//
//   node tools/validate-data.js [--allow-missing] [--quiet-warnings] [--max=N]
//
// Reports ALL problems (errors + warnings) grouped by file and exits non-zero
// when there is at least one error. Missing data files are reported clearly
// (as errors, or warnings with --allow-missing) and the rest is still checked.

import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  CARD_FIELDS, CARD_RARITIES, CARD_TARGETS, CARD_TYPES, EFFECT_TYPES, ENCOUNTER_TIERS, ENEMY_TIERS,
  INTENTS, KEYWORDS, POTION_RARITIES, QUESTION_FIELDS, QUESTION_PREFIX, RELIC_RARITIES, SCALE_BY,
  SCALE_BY_PREFIX, STATUS_IDS, TRIGGERS,
} from '../src/engine/constants.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const ALLOW_MISSING = args.includes('--allow-missing');
const QUIET_WARN = args.includes('--quiet-warnings');
const MAX = Number((args.find((a) => a.startsWith('--max=')) || '--max=100000').slice(6));

const FILES = {
  tags: { path: 'src/data/tags.js', exports: ['TAGS'] },
  cards: { path: 'src/data/cards.js', exports: ['CARDS', 'STARTER_DECK'] },
  relics: { path: 'src/data/relics.js', exports: ['RELICS', 'STARTER_RELIC'] },
  potions: { path: 'src/data/potions.js', exports: ['POTIONS'] },
  enemies: { path: 'src/data/enemies.js', exports: ['ENEMIES'] },
  encounters: { path: 'src/data/encounters.js', exports: ['ENCOUNTERS'] },
  events: { path: 'src/data/events.js', exports: ['EVENTS'] },
  theory1: { path: 'src/data/questions/theory1.js', exports: ['QUESTIONS', 'QUIZ_SETS'], field: 'theory1' },
  theory2: { path: 'src/data/questions/theory2.js', exports: ['QUESTIONS', 'QUIZ_SETS'], field: 'theory2' },
  inorganic: { path: 'src/data/questions/inorganic.js', exports: ['QUESTIONS', 'QUIZ_SETS'], field: 'inorganic' },
  organic: { path: 'src/data/questions/organic.js', exports: ['QUESTIONS', 'QUIZ_SETS'], field: 'organic' },
  polymer: { path: 'src/data/questions/polymer.js', exports: ['QUESTIONS', 'QUIZ_SETS'], field: 'polymer' },
};

// ---------------------------------------------------------------------------
const problems = []; // {level, file, where, msg}
const err = (file, where, msg) => problems.push({ level: 'error', file, where, msg });
const warn = (file, where, msg) => problems.push({ level: 'warn', file, where, msg });

const isStr = (x) => typeof x === 'string' && x.trim().length > 0;
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isInt = (x) => Number.isInteger(x);
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

async function loadAll() {
  const mods = {};
  for (const [key, f] of Object.entries(FILES)) {
    const abs = path.join(ROOT, f.path);
    if (!existsSync(abs)) {
      (ALLOW_MISSING ? warn : err)(f.path, '', 'file does not exist yet (skipped)');
      mods[key] = null;
      continue;
    }
    try {
      mods[key] = await import(pathToFileURL(abs).href);
    } catch (e) {
      err(f.path, '', `failed to import: ${e.message}`);
      mods[key] = null;
      continue;
    }
    for (const ex of f.exports) {
      if (!(ex in mods[key])) err(f.path, '', `missing export "${ex}"`);
    }
  }
  return mods;
}

// ---------------------------------------------------------------------------
// Markup sanity for all display strings
// ---------------------------------------------------------------------------
function checkMarkup(file, where, s) {
  if (typeof s !== 'string') return;
  let depth = 0;
  for (const ch of s) {
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth < 0) break; }
  }
  if (depth !== 0) err(file, where, `unbalanced braces in text: "${clip(s)}"`);
  if (/<\/?[a-zA-Z][^>]*>/.test(s)) err(file, where, `HTML tag in text (use chem markup): "${clip(s)}"`);
  if (/[_^](\s|$)/.test(s)) warn(file, where, `dangling _ or ^ in text: "${clip(s)}"`);
  if (/[_^]\{\}/.test(s)) warn(file, where, `empty sub/superscript braces: "${clip(s)}"`);
  if (/\\n/.test(s) && !s.includes('\n')) { /* literal backslash-n is fine in source as \n */ }
}
function clip(s) { return s.length > 60 ? s.slice(0, 57) + '…' : s; }

function walkStrings(file, where, obj, depth = 0) {
  if (depth > 8 || obj == null) return;
  if (typeof obj === 'string') { checkMarkup(file, where, obj); return; }
  if (Array.isArray(obj)) { obj.forEach((x, i) => walkStrings(file, `${where}[${i}]`, x, depth + 1)); return; }
  if (typeof obj === 'object') for (const [k, v] of Object.entries(obj)) {
    if (['id', 'cardId', 'relicId', 'potionId', 'enemyId', 'tag', 'from', 'to', 'status', 'type', 'trigger', 'by'].includes(k)) continue;
    walkStrings(file, `${where}.${k}`, v, depth + 1);
  }
}

// ---------------------------------------------------------------------------
// Effect DSL
// ---------------------------------------------------------------------------
function makeEffectChecker(ref) {
  const { tagIds, cardIds, relicIds, potionIds, enemyIds, questionIds } = ref;
  const tagOk = (file, where, t) => {
    if (!isStr(t)) err(file, where, 'tag must be a string');
    else if (tagIds && !tagIds.has(t)) err(file, where, `unknown tag "${t}"`);
  };
  function checkScale(file, where, sc) {
    if (sc == null) return;
    if (!isObj(sc)) return err(file, where, 'scale must be an object {by, per}');
    const by = sc.by;
    const ok = SCALE_BY.includes(by) || SCALE_BY_PREFIX.some((p) => typeof by === 'string' && by.startsWith(p) && STATUS_IDS.includes(by.slice(p.length)));
    if (!ok) err(file, where, `unknown scale.by "${by}"`);
    if (sc.per != null && !isNum(sc.per)) err(file, where, 'scale.per must be a number');
  }
  function list(file, where, effects, ctx) {
    if (effects == null) return;
    if (!Array.isArray(effects)) return err(file, where, 'effects must be an array');
    effects.forEach((e, i) => one(file, `${where}[${i}]`, e, ctx));
  }
  function one(file, where, e, ctx) {
    if (!isObj(e)) return err(file, where, 'effect must be an object');
    const t = e.type;
    if (!EFFECT_TYPES.includes(t)) return err(file, where, `unknown effect type "${t}"`);
    const needNum = (k, opt = false) => {
      if (e[k] == null) { if (!opt) err(file, where, `${t}: missing numeric "${k}"`); return; }
      if (!isNum(e[k])) err(file, where, `${t}: "${k}" must be a finite number`);
    };
    const tgt = (allowed) => { if (e.target != null && !allowed.includes(e.target)) err(file, where, `${t}: invalid target "${e.target}" (allowed: ${allowed.join('|')})`); };
    switch (t) {
      case 'damage': case 'attack':
        needNum('amount');
        if (e.times != null && !(e.times === 'X' || (isInt(e.times) && e.times >= 1))) err(file, where, `${t}: times must be an integer >= 1`);
        tgt(['enemy', 'all', 'random', 'player', 'self']);
        checkScale(file, where, e.scale);
        if (e.pierce != null && typeof e.pierce !== 'boolean') err(file, where, 'pierce must be boolean');
        if (t === 'attack' && ctx.kind !== 'enemy') warn(file, where, '"attack" is meant for enemy moves; cards use "damage"');
        break;
      case 'block': needNum('amount'); checkScale(file, where, e.scale); tgt(['self', 'all']); break;
      case 'status':
        if (!STATUS_IDS.includes(e.status)) err(file, where, `unknown status "${e.status}"`);
        needNum('amount');
        if (e.amount === 0) warn(file, where, 'status amount 0 has no effect');
        tgt(['self', 'enemy', 'all', 'player', 'random']);
        break;
      case 'draw': case 'energy': case 'heal': case 'loseHp': case 'gold': case 'maxHp': needNum('amount'); break;
      case 'ph': needNum('delta'); break;
      case 'phSet': needNum('value'); if (isNum(e.value) && (e.value < 0 || e.value > 14)) err(file, where, 'phSet value must be 0..14'); break;
      case 'reveal': needNum('count', true); break;
      case 'addTag': case 'removeTag': tagOk(file, where + '.tag', e.tag); break;
      case 'transformTag': tagOk(file, where + '.from', e.from); tagOk(file, where + '.to', e.to); if (e.from === e.to) warn(file, where, 'transformTag from === to'); break;
      case 'stripBlock': break;
      case 'addCard':
        if (!cardIds.has(e.cardId)) err(file, where, `addCard: unknown cardId "${e.cardId}"`);
        if (!['hand', 'draw', 'discard'].includes(e.to)) err(file, where, `addCard: to must be hand|draw|discard (got "${e.to}")`);
        needNum('count', true);
        break;
      case 'exhaustFromHand': case 'discardFromHand': needNum('count', true); break;
      case 'upgradeHand': needNum('count', true); break;
      case 'quiz':
        if (e.field != null && !QUESTION_FIELDS.includes(e.field) && e.field !== 'theory') err(file, where, `quiz: unknown field "${e.field}"`);
        if (e.level != null && ![1, 2, 3].includes(e.level)) err(file, where, 'quiz: level must be 1|2|3');
        if (e.questionId != null && questionIds && !questionIds.has(e.questionId)) err(file, where, `quiz: unknown questionId "${e.questionId}"`);
        if (!Array.isArray(e.onCorrect) && !Array.isArray(e.onWrong)) warn(file, where, 'quiz without onCorrect/onWrong');
        list(file, where + '.onCorrect', e.onCorrect, ctx);
        list(file, where + '.onWrong', e.onWrong, ctx);
        break;
      case 'summon':
        if (!enemyIds.has(e.enemyId)) err(file, where, `summon: unknown enemyId "${e.enemyId}"`);
        if (ctx.kind !== 'enemy') err(file, where, 'summon is enemy-only');
        break;
      case 'power':
        if (!TRIGGERS.includes(e.trigger)) err(file, where, `power: unknown trigger "${e.trigger}"`);
        if (e.every != null && !(isInt(e.every) && e.every >= 1)) err(file, where, 'power: every must be an integer >= 1');
        checkFilter(file, where, e.filter);
        if (ctx.kind === 'enemy') err(file, where, 'power is player-only');
        list(file, where + '.effects', e.effects, { ...ctx, kind: 'power' });
        if (!Array.isArray(e.effects) || !e.effects.length) err(file, where, 'power: effects must be a non-empty array');
        break;
      case 'gainRelic':
        if (e.relicId != null && !relicIds.has(e.relicId)) err(file, where, `gainRelic: unknown relicId "${e.relicId}"`);
        if (e.rarity != null && !RELIC_RARITIES.includes(e.rarity)) err(file, where, `gainRelic: unknown rarity "${e.rarity}"`);
        break;
      case 'gainCard':
        if (e.cardId != null && !cardIds.has(e.cardId)) err(file, where, `gainCard: unknown cardId "${e.cardId}"`);
        if (e.rarity != null && !CARD_RARITIES.includes(e.rarity)) err(file, where, `gainCard: unknown rarity "${e.rarity}"`);
        if (e.field != null && !CARD_FIELDS.includes(e.field)) err(file, where, `gainCard: unknown field "${e.field}"`);
        break;
      case 'gainPotion':
        if (e.potionId != null && !potionIds.has(e.potionId)) err(file, where, `gainPotion: unknown potionId "${e.potionId}"`);
        break;
      case 'removeCard':
        if (e.cardId != null && !cardIds.has(e.cardId)) err(file, where, `removeCard: unknown cardId "${e.cardId}"`);
        needNum('count', true);
        break;
      case 'upgradeCard': needNum('count', true); break;
      default: break;
    }
  }
  function checkFilter(file, where, f) {
    if (f == null) return;
    if (!isObj(f)) return err(file, where, 'filter must be an object');
    if (f.cardType != null && !CARD_TYPES.includes(f.cardType)) err(file, where, `filter.cardType "${f.cardType}" unknown`);
    if (f.field != null && !CARD_FIELDS.includes(f.field) && !QUESTION_FIELDS.includes(f.field)) err(file, where, `filter.field "${f.field}" unknown`);
  }
  function checkCondition(file, where, w) {
    if (w == null) return err(file, where, 'reaction.when is required');
    if (!isObj(w)) return err(file, where, 'when must be an object');
    const allowed = ['anyTags', 'allTags', 'noTags', 'ph', 'targetStatus', 'selfStatus'];
    for (const k of Object.keys(w)) if (!allowed.includes(k)) err(file, where, `unknown condition key "${k}"`);
    for (const k of ['anyTags', 'allTags', 'noTags']) {
      if (w[k] == null) continue;
      if (!Array.isArray(w[k])) err(file, where, `${k} must be an array`);
      else w[k].forEach((t, i) => tagOk(file, `${where}.${k}[${i}]`, t));
    }
    if (w.ph != null) {
      if (!isObj(w.ph)) err(file, where, 'ph must be {min?, max?}');
      else {
        for (const k of ['min', 'max']) if (w.ph[k] != null && !(isNum(w.ph[k]) && w.ph[k] >= 0 && w.ph[k] <= 14)) err(file, where, `ph.${k} must be 0..14`);
        if (isNum(w.ph.min) && isNum(w.ph.max) && w.ph.min > w.ph.max) err(file, where, 'ph.min > ph.max');
      }
    }
    for (const k of ['targetStatus', 'selfStatus']) if (w[k] != null && !STATUS_IDS.includes(w[k])) err(file, where, `${k} "${w[k]}" unknown`);
    if (!Object.keys(w).length) warn(file, where, 'empty condition (always true)');
  }
  return { list, one, checkFilter, checkCondition };
}

function uniqueIds(file, arr, label) {
  const ids = new Set();
  if (!Array.isArray(arr)) { err(file, '', `${label} must be an array`); return ids; }
  arr.forEach((x, i) => {
    if (!isObj(x)) return err(file, `${label}[${i}]`, 'entry must be an object');
    if (!isStr(x.id)) return err(file, `${label}[${i}]`, 'missing id');
    if (ids.has(x.id)) err(file, x.id, `duplicate id "${x.id}"`);
    ids.add(x.id);
  });
  return ids;
}

// ---------------------------------------------------------------------------
async function main() {
  const m = await loadAll();
  const get = (k, ex) => (m[k] && Array.isArray(m[k][ex]) ? m[k][ex] : m[k] ? m[k][ex] : null);

  const TAGS = get('tags', 'TAGS');
  const CARDS = get('cards', 'CARDS');
  const STARTER_DECK = get('cards', 'STARTER_DECK');
  const RELICS = get('relics', 'RELICS');
  const STARTER_RELIC = get('relics', 'STARTER_RELIC');
  const POTIONS = get('potions', 'POTIONS');
  const ENEMIES = get('enemies', 'ENEMIES');
  const ENCOUNTERS = get('encounters', 'ENCOUNTERS');
  const EVENTS = get('events', 'EVENTS');

  const F = (k) => FILES[k].path;

  // ---- ids ----
  const tagIds = TAGS ? uniqueIds(F('tags'), TAGS, 'TAGS') : null;
  const cardIds = CARDS ? uniqueIds(F('cards'), CARDS, 'CARDS') : new Set();
  const relicIds = RELICS ? uniqueIds(F('relics'), RELICS, 'RELICS') : new Set();
  const potionIds = POTIONS ? uniqueIds(F('potions'), POTIONS, 'POTIONS') : new Set();
  const enemyIds = ENEMIES ? uniqueIds(F('enemies'), ENEMIES, 'ENEMIES') : new Set();

  // questions (all files)
  const allQuestions = []; // {q, file}
  const allSets = [];
  const questionIds = new Set();
  const setIds = new Set();
  for (const field of QUESTION_FIELDS) {
    const mod = m[field];
    if (!mod) continue;
    const file = F(field);
    if (!Array.isArray(mod.QUESTIONS)) err(file, '', 'QUESTIONS must be an array');
    if (!Array.isArray(mod.QUIZ_SETS)) err(file, '', 'QUIZ_SETS must be an array');
    for (const q of mod.QUESTIONS || []) allQuestions.push({ q, file, field, part: false });
    for (const s of mod.QUIZ_SETS || []) {
      allSets.push({ s, file, field });
      for (const p of (s && s.parts) || []) allQuestions.push({ q: p, file, field, part: true, set: s });
    }
  }
  for (const { q, file } of allQuestions) {
    if (!isObj(q) || !isStr(q.id)) { err(file, '?', 'question without id'); continue; }
    if (questionIds.has(q.id)) err(file, q.id, `duplicate question id "${q.id}"`);
    questionIds.add(q.id);
  }
  for (const { s, file } of allSets) {
    if (!isObj(s) || !isStr(s.id)) { err(file, '?', 'quiz set without id'); continue; }
    if (setIds.has(s.id)) err(file, s.id, `duplicate quiz set id "${s.id}"`);
    setIds.add(s.id);
  }

  const ref = { tagIds, cardIds, relicIds, potionIds, enemyIds, questionIds };
  const E = makeEffectChecker(ref);

  // ---- TAGS ----
  if (TAGS) {
    const file = F('tags');
    TAGS.forEach((t, i) => {
      if (!isObj(t)) return;
      const w = t.id || `#${i}`;
      if (!/^[a-z0-9_]+$/.test(t.id || '')) warn(file, w, 'tag id should be lowercase snake_case');
      for (const k of ['label', 'group', 'desc']) if (!isStr(t[k])) err(file, w, `missing "${k}"`);
      walkStrings(file, w, t);
    });
  }

  // ---- CARDS ----
  const usedReactionTags = new Set();
  if (CARDS) {
    const file = F('cards');
    const CARD_KEYS = ['id', 'name', 'formula', 'type', 'rarity', 'field', 'cost', 'target', 'effects', 'reactions', 'strict', 'fizzle', 'keywords', 'text', 'chem', 'upgrade', 'endTurnInHand'];
    for (const c of CARDS) {
      if (!isObj(c) || !c.id) continue;
      const w = c.id;
      for (const k of Object.keys(c)) if (!CARD_KEYS.includes(k)) warn(file, w, `unknown card field "${k}"`);
      if (!isStr(c.name)) err(file, w, 'missing name');
      if (!CARD_TYPES.includes(c.type)) err(file, w, `invalid type "${c.type}"`);
      if (!CARD_RARITIES.includes(c.rarity)) err(file, w, `invalid rarity "${c.rarity}"`);
      if (!CARD_FIELDS.includes(c.field)) err(file, w, `invalid field "${c.field}"`);
      if (!('cost' in c) || ![0, 1, 2, 3, 'X', null].includes(c.cost)) err(file, w, `invalid cost ${JSON.stringify(c.cost)} (0|1|2|3|'X'|null)`);
      if (!CARD_TARGETS.includes(c.target)) err(file, w, `invalid target "${c.target}"`);
      if (!Array.isArray(c.effects)) err(file, w, 'effects must be an array');
      E.list(file, w + '.effects', c.effects, { kind: 'card' });
      if (!isStr(c.text)) err(file, w, 'missing text');
      if (!isStr(c.chem)) (c.rarity === 'special' ? warn : err)(file, w, 'missing chem (学習メモ)');
      if (c.keywords != null) {
        if (!Array.isArray(c.keywords)) err(file, w, 'keywords must be an array');
        else c.keywords.forEach((k) => { if (!KEYWORDS.includes(k)) err(file, w, `unknown keyword "${k}"`); });
      }
      const unplayable = c.cost === null || (c.keywords || []).includes('unplayable');
      if (!unplayable && (!c.effects || !c.effects.length) && !(c.reactions || []).length) warn(file, w, 'playable card with no effects and no reactions');
      if (c.reactions != null) {
        if (!Array.isArray(c.reactions)) err(file, w, 'reactions must be an array');
        else c.reactions.forEach((r, i) => {
          const rw = `${w}.reactions[${i}]`;
          if (!isObj(r)) return err(file, rw, 'reaction must be an object');
          E.checkCondition(file, rw + '.when', r.when);
          for (const k of ['anyTags', 'allTags']) for (const t of (r.when && r.when[k]) || []) usedReactionTags.add(t);
          if (!Array.isArray(r.effects)) err(file, rw, 'reaction.effects must be an array');
          E.list(file, rw + '.effects', r.effects, { kind: 'card' });
          if (!isStr(r.explain)) err(file, rw, 'reaction.explain is required');
          if (r.replace != null && typeof r.replace !== 'boolean') err(file, rw, 'replace must be boolean');
        });
      }
      if (c.strict && !(c.reactions || []).length) warn(file, w, 'strict card without reactions always fizzles');
      if (c.fizzle != null) { E.list(file, w + '.fizzle', c.fizzle, { kind: 'card' }); if (!c.strict) warn(file, w, 'fizzle given but strict is not true'); }
      if (c.endTurnInHand != null) E.list(file, w + '.endTurnInHand', c.endTurnInHand, { kind: 'card' });
      if (c.upgrade != null) {
        if (!isObj(c.upgrade)) err(file, w, 'upgrade must be an object');
        else {
          for (const k of Object.keys(c.upgrade)) if (!CARD_KEYS.includes(k) || ['id', 'upgrade'].includes(k)) err(file, w, `upgrade overrides unknown/forbidden field "${k}"`);
          if (c.upgrade.cost != null && ![0, 1, 2, 3, 'X'].includes(c.upgrade.cost)) err(file, w, 'upgrade.cost invalid');
          if (c.upgrade.effects) E.list(file, w + '.upgrade.effects', c.upgrade.effects, { kind: 'card' });
          if (c.upgrade.fizzle) E.list(file, w + '.upgrade.fizzle', c.upgrade.fizzle, { kind: 'card' });
          if (c.upgrade.reactions) c.upgrade.reactions.forEach((r, i) => {
            E.checkCondition(file, `${w}.upgrade.reactions[${i}].when`, r.when);
            E.list(file, `${w}.upgrade.reactions[${i}].effects`, r.effects, { kind: 'card' });
            if (!isStr(r.explain)) err(file, `${w}.upgrade.reactions[${i}]`, 'reaction.explain is required');
          });
          if (!Object.keys(c.upgrade).length) warn(file, w, 'empty upgrade');
        }
      } else if (!['special'].includes(c.rarity) && !['curse', 'status'].includes(c.type)) warn(file, w, 'no upgrade defined');
      if (c.type === 'curse' || c.type === 'status') { if (c.rarity !== 'special') warn(file, w, `${c.type} card should have rarity special`); }
      walkStrings(file, w, c);
    }
    const mis = CARDS.find((c) => c && c.id === 'misconception');
    if (!mis) err(file, 'misconception', 'required special card "misconception" missing');
    else {
      if (mis.type !== 'curse') err(file, 'misconception', 'must be type curse');
      if (mis.cost !== null && !(mis.keywords || []).includes('unplayable')) err(file, 'misconception', 'must be unplayable');
      if (mis.rarity !== 'special') err(file, 'misconception', 'must be rarity special');
    }
    const car = CARDS.find((c) => c && c.id === 'careless');
    if (!car) err(file, 'careless', 'required special card "careless" missing');
    else {
      if (car.type !== 'status') err(file, 'careless', 'must be type status');
      if (!(car.keywords || []).includes('ethereal')) err(file, 'careless', 'must be ethereal');
      if (car.cost !== null && !(car.keywords || []).includes('unplayable')) err(file, 'careless', 'must be unplayable');
      if (car.rarity !== 'special') err(file, 'careless', 'must be rarity special');
    }
    if (!Array.isArray(STARTER_DECK) || !STARTER_DECK.length) err(file, 'STARTER_DECK', 'must be a non-empty array of card ids');
    else {
      STARTER_DECK.forEach((id, i) => { if (!cardIds.has(id)) err(file, `STARTER_DECK[${i}]`, `unknown card "${id}"`); });
      if (STARTER_DECK.length < 8 || STARTER_DECK.length > 15) warn(file, 'STARTER_DECK', `unusual starter deck size ${STARTER_DECK.length}`);
    }
    // counts
    const byField = {};
    for (const c of CARDS) if (c && c.rarity !== 'special' && c.rarity !== 'starter') byField[c.field] = (byField[c.field] || 0) + 1;
    const rewardable = CARDS.filter((c) => c && ['common', 'uncommon', 'rare'].includes(c.rarity));
    if (CARDS.length < 90) warn(file, '', `only ${CARDS.length} cards (target 90+)`);
    for (const [f, n] of Object.entries({ theory: 22, inorganic: 22, organic: 22, polymer: 16, neutral: 8 })) {
      if ((byField[f] || 0) < n * 0.75) warn(file, '', `field ${f}: ${byField[f] || 0} reward cards (target ~${n})`);
    }
    for (const r of ['common', 'uncommon', 'rare']) if (!rewardable.some((c) => c.rarity === r)) err(file, '', `no reward cards of rarity ${r}`);
  }

  // ---- RELICS ----
  if (RELICS) {
    const file = F('relics');
    for (const r of RELICS) {
      if (!isObj(r) || !r.id) continue;
      const w = r.id;
      for (const k of ['name', 'emoji', 'text', 'chem']) if (!isStr(r[k])) err(file, w, `missing "${k}"`);
      if (!RELIC_RARITIES.includes(r.rarity)) err(file, w, `invalid rarity "${r.rarity}"`);
      if (!Array.isArray(r.triggers)) err(file, w, 'triggers must be an array');
      else r.triggers.forEach((t, i) => {
        const tw = `${w}.triggers[${i}]`;
        if (!isObj(t)) return err(file, tw, 'trigger must be an object');
        if (!TRIGGERS.includes(t.trigger)) err(file, tw, `unknown trigger "${t.trigger}"`);
        if (t.every != null && !(isInt(t.every) && t.every >= 1)) err(file, tw, 'every must be an integer >= 1');
        E.checkFilter(file, tw, t.filter);
        if (!Array.isArray(t.effects) || !t.effects.length) err(file, tw, 'effects must be a non-empty array');
        E.list(file, tw + '.effects', t.effects, { kind: 'relic', trigger: t.trigger });
        if (t.trigger === 'onPickup') for (const e of t.effects || []) {
          if (['damage', 'block', 'status', 'draw', 'energy', 'ph'].includes(e?.type)) warn(file, tw, `onPickup effect "${e.type}" only works in combat`);
        }
      });
      walkStrings(file, w, r);
    }
    if (!STARTER_RELIC) err(file, 'STARTER_RELIC', 'missing');
    else if (!relicIds.has(STARTER_RELIC)) err(file, 'STARTER_RELIC', `unknown relic "${STARTER_RELIC}"`);
    else if (RELICS.find((r) => r.id === STARTER_RELIC).rarity !== 'starter') warn(file, 'STARTER_RELIC', 'starter relic should have rarity starter');
    if (RELICS.length < 30) warn(file, '', `only ${RELICS.length} relics (target 30+)`);
    if (RELICS.filter((r) => r.rarity === 'boss' || r.rarity === 'rare').length < 3) warn(file, '', 'fewer than 3 boss/rare relics for boss rewards');
  }

  // ---- POTIONS ----
  if (POTIONS) {
    const file = F('potions');
    for (const p of POTIONS) {
      if (!isObj(p) || !p.id) continue;
      const w = p.id;
      for (const k of ['name', 'emoji', 'text', 'chem']) if (!isStr(p[k])) err(file, w, `missing "${k}"`);
      if (!POTION_RARITIES.includes(p.rarity)) err(file, w, `invalid rarity "${p.rarity}"`);
      if (!CARD_TARGETS.includes(p.target)) err(file, w, `invalid target "${p.target}"`);
      if (!Array.isArray(p.effects) || !p.effects.length) err(file, w, 'effects must be a non-empty array');
      E.list(file, w + '.effects', p.effects, { kind: 'potion' });
      walkStrings(file, w, p);
    }
    if (POTIONS.length < 12) warn(file, '', `only ${POTIONS.length} potions (target 12+)`);
  }

  // ---- ENEMIES ----
  const enemyTagPool = new Set();
  if (ENEMIES) {
    const file = F('enemies');
    for (const e of ENEMIES) {
      if (!isObj(e) || !e.id) continue;
      const w = e.id;
      for (const k of ['name', 'emoji', 'lore']) if (!isStr(e[k])) err(file, w, `missing "${k}"`);
      if (![1, 2, 3, 4, 5].includes(e.act)) err(file, w, `invalid act ${e.act}`);
      if (!ENEMY_TIERS.includes(e.tier)) err(file, w, `invalid tier "${e.tier}"`);
      if (!Array.isArray(e.hp) || e.hp.length !== 2 || !e.hp.every((x) => isInt(x) && x > 0) || e.hp[0] > e.hp[1]) err(file, w, `hp must be [min,max] positive integers (got ${JSON.stringify(e.hp)})`);
      if (!Array.isArray(e.tags)) err(file, w, 'tags must be an array');
      for (const k of ['tags', 'hiddenTags']) (e[k] || []).forEach((t, i) => { tagIdsCheck(file, `${w}.${k}[${i}]`, t); enemyTagPool.add(t); });
      const both = (e.tags || []).filter((t) => (e.hiddenTags || []).includes(t));
      if (both.length) warn(file, w, `tags both visible and hidden: ${both.join(',')}`);
      if (e.pI != null && !(isNum(e.pI) && e.pI >= 0 && e.pI <= 14)) err(file, w, 'pI must be 0..14');
      if (e.phRules != null) {
        if (!Array.isArray(e.phRules)) err(file, w, 'phRules must be an array');
        else e.phRules.forEach((r, i) => {
          const rw = `${w}.phRules[${i}]`;
          if (!isObj(r)) return err(file, rw, 'must be an object');
          for (const k of ['min', 'max']) if (r[k] != null && !(isNum(r[k]) && r[k] >= 0 && r[k] <= 14)) err(file, rw, `${k} must be 0..14`);
          for (const k of ['takenMult', 'dealtMult']) if (r[k] != null && !(isNum(r[k]) && r[k] >= 0)) err(file, rw, `${k} must be a number >= 0`);
          if (r.takenMult == null && r.dealtMult == null) warn(file, rw, 'rule has neither takenMult nor dealtMult');
          if (!isStr(r.note)) warn(file, rw, 'missing note');
        });
      }
      const moves = e.moves;
      if (!isObj(moves) || !Object.keys(moves).length) err(file, w, 'moves must be a non-empty object');
      const moveIds = new Set(Object.keys(moves || {}));
      for (const [mid, mv] of Object.entries(moves || {})) {
        const mw = `${w}.moves.${mid}`;
        if (!isObj(mv)) { err(file, mw, 'move must be an object'); continue; }
        if (!isStr(mv.name)) err(file, mw, 'missing name');
        if (!INTENTS.includes(mv.intent)) err(file, mw, `invalid intent "${mv.intent}"`);
        if (!Array.isArray(mv.effects)) err(file, mw, 'effects must be an array');
        E.list(file, mw + '.effects', mv.effects, { kind: 'enemy' });
        if (mv.intent === 'quiz' && !(mv.effects || []).some((x) => x && x.type === 'quiz')) warn(file, mw, 'intent quiz without a quiz effect');
      }
      const checkPattern = (pw, p) => {
        if (p == null) return;
        if (!isObj(p)) return err(file, pw, 'pattern must be an object');
        if (p.type === 'cycle') {
          if (!Array.isArray(p.seq) || !p.seq.length) err(file, pw, 'cycle.seq must be non-empty');
          else p.seq.forEach((mid) => { if (!moveIds.has(mid)) err(file, pw, `unknown move "${mid}"`); });
        } else if (p.type === 'weighted') {
          if (!Array.isArray(p.table) || !p.table.length) err(file, pw, 'weighted.table must be non-empty');
          else p.table.forEach((r) => {
            if (!moveIds.has(r?.move)) err(file, pw, `unknown move "${r?.move}"`);
            if (!(isNum(r?.w) && r.w > 0)) err(file, pw, `weight must be > 0 for "${r?.move}"`);
          });
          if (p.noRepeat != null && !(isInt(p.noRepeat) && p.noRepeat >= 1)) err(file, pw, 'noRepeat must be an integer >= 1');
        } else err(file, pw, `unknown pattern type "${p.type}"`);
      };
      if (e.pattern == null && e.tier !== 'minion') warn(file, w, 'no pattern (moves used in declaration order)');
      checkPattern(w + '.pattern', e.pattern);
      if (e.phases != null) {
        if (!Array.isArray(e.phases)) err(file, w, 'phases must be an array');
        else {
          let last = 1;
          e.phases.forEach((ph, i) => {
            const pw = `${w}.phases[${i}]`;
            if (!isObj(ph)) return err(file, pw, 'must be an object');
            if (!(isNum(ph.hpBelow) && ph.hpBelow > 0 && ph.hpBelow < 1)) err(file, pw, 'hpBelow must be in (0,1)');
            else { if (ph.hpBelow >= last) err(file, pw, 'phases must have strictly decreasing hpBelow'); last = ph.hpBelow; }
            checkPattern(pw + '.pattern', ph.pattern);
            E.list(file, pw + '.onEnter', ph.onEnter, { kind: 'enemy' });
            if (ph.quizSetId != null && !setIds.has(ph.quizSetId)) err(file, pw, `unknown quizSetId "${ph.quizSetId}"`);
            if (ph.quizField != null && !QUESTION_FIELDS.includes(ph.quizField)) err(file, pw, `invalid quizField "${ph.quizField}"`);
          });
        }
      }
      if (e.quizSetId != null && setIds.size && !setIds.has(e.quizSetId)) err(file, w, `unknown quizSetId "${e.quizSetId}"`);
      if (e.quizField != null && !QUESTION_FIELDS.includes(e.quizField)) err(file, w, `invalid quizField "${e.quizField}"`);
      if (e.tier === 'boss' && e.act <= 4 && !e.quizSetId) warn(file, w, 'boss without quizSetId');
      if (e.tier === 'boss' && !Object.values(moves || {}).some((mv) => (mv.effects || []).some((x) => x?.type === 'quiz'))) warn(file, w, 'boss has no quiz move');
      walkStrings(file, w, e);
    }
    for (const act of [1, 2, 3, 4]) {
      const n = ENEMIES.filter((e) => e.act === act && e.tier === 'normal').length;
      if (n < 6) warn(file, '', `act ${act}: ${n} normal enemies (target 6+)`);
      if (ENEMIES.filter((e) => e.act === act && e.tier === 'elite').length < 2) warn(file, '', `act ${act}: fewer than 2 elites`);
      if (!ENEMIES.some((e) => e.act === act && e.tier === 'boss')) err(file, '', `act ${act}: no boss enemy`);
    }
    if (!ENEMIES.some((e) => e.act === 5 && e.tier === 'boss')) err(file, '', 'no final boss (act 5)');
  }
  function tagIdsCheck(file, where, t) {
    if (!isStr(t)) err(file, where, 'tag must be a string');
    else if (tagIds && !tagIds.has(t)) err(file, where, `unknown tag "${t}"`);
  }

  // ---- ENCOUNTERS ----
  if (ENCOUNTERS) {
    const file = F('encounters');
    uniqueIds(file, ENCOUNTERS, 'ENCOUNTERS');
    for (const en of ENCOUNTERS) {
      if (!isObj(en)) continue;
      const w = en.id || '?';
      if (![1, 2, 3, 4, 5].includes(en.act)) err(file, w, `invalid act ${en.act}`);
      if (!ENCOUNTER_TIERS.includes(en.tier)) err(file, w, `invalid tier "${en.tier}"`);
      if (!Array.isArray(en.enemies) || !en.enemies.length) err(file, w, 'enemies must be non-empty');
      else {
        if (en.enemies.length > 5) err(file, w, 'more than 5 enemies');
        en.enemies.forEach((id) => {
          if (!enemyIds.has(id)) err(file, w, `unknown enemy "${id}"`);
          const def = ENEMIES?.find((x) => x.id === id);
          if (def && def.tier !== en.tier && def.tier !== 'minion' && !(en.tier === 'normal' && def.tier === 'normal')) {
            if (!(en.tier === 'elite' && def.tier === 'normal')) warn(file, w, `enemy "${id}" tier ${def.tier} in ${en.tier} encounter`);
          }
          if (def && def.act !== en.act && en.act !== 5) warn(file, w, `enemy "${id}" is act ${def.act} but encounter is act ${en.act}`);
        });
      }
      if (en.weight != null && !(isNum(en.weight) && en.weight > 0)) err(file, w, 'weight must be > 0');
      if (en.minRow != null && !(isInt(en.minRow) && en.minRow >= 1 && en.minRow <= 8)) err(file, w, 'minRow must be 1..8');
    }
    for (const act of [1, 2, 3, 4]) for (const tier of ENCOUNTER_TIERS) {
      const list = ENCOUNTERS.filter((e) => e.act === act && e.tier === tier);
      if (!list.length) err(file, '', `no ${tier} encounter for act ${act}`);
      if (tier === 'normal' && list.length && !list.some((e) => (e.minRow ?? 1) <= 1)) err(file, '', `act ${act}: no normal encounter available on row 1 (minRow)`);
    }
    if (!ENCOUNTERS.some((e) => e.act === 5 && e.tier === 'boss')) err(file, '', 'no boss encounter for act 5 (final)');
  }

  // ---- EVENTS ----
  if (EVENTS) {
    const file = F('events');
    uniqueIds(file, EVENTS, 'EVENTS');
    for (const ev of EVENTS) {
      if (!isObj(ev)) continue;
      const w = ev.id || '?';
      for (const k of ['name', 'text']) if (!isStr(ev[k])) err(file, w, `missing "${k}"`);
      if (ev.acts != null && (!Array.isArray(ev.acts) || ev.acts.some((a) => ![1, 2, 3, 4, 5].includes(a)))) err(file, w, 'acts must be an array of 1..5');
      if (!Array.isArray(ev.choices) || !ev.choices.length) { err(file, w, 'choices must be non-empty'); continue; }
      ev.choices.forEach((ch, i) => {
        const cw = `${w}.choices[${i}]`;
        if (!isObj(ch)) return err(file, cw, 'choice must be an object');
        if (!isStr(ch.label)) err(file, cw, 'missing label');
        if (typeof ch.result !== 'string') err(file, cw, 'missing result text');
        if (ch.quiz != null) {
          if (!isObj(ch.quiz)) err(file, cw, 'quiz must be an object');
          else {
            if (ch.quiz.field != null && !QUESTION_FIELDS.includes(ch.quiz.field) && ch.quiz.field !== 'theory') err(file, cw, `quiz.field "${ch.quiz.field}" unknown`);
            if (ch.quiz.level != null && ![1, 2, 3].includes(ch.quiz.level)) err(file, cw, 'quiz.level must be 1|2|3');
            if (ch.quiz.topic != null && !allQuestions.some(({ q }) => q && q.topic === ch.quiz.topic)) warn(file, cw, `quiz.topic "${ch.quiz.topic}" matches no question`);
          }
        } else if (ch.onCorrect || ch.onWrong) warn(file, cw, 'onCorrect/onWrong without quiz are ignored');
        E.list(file, cw + '.effects', ch.effects, { kind: 'event' });
        E.list(file, cw + '.onCorrect', ch.onCorrect, { kind: 'event' });
        E.list(file, cw + '.onWrong', ch.onWrong, { kind: 'event' });
        for (const k of ['effects', 'onCorrect', 'onWrong']) for (const e of ch[k] || []) {
          if (e && ['damage', 'attack', 'block', 'status', 'draw', 'energy', 'ph', 'phSet', 'reveal', 'addCard', 'summon', 'power'].includes(e.type)) {
            warn(file, cw, `effect "${e.type}" has no effect outside combat`);
          }
        }
      });
      walkStrings(file, w, ev);
    }
    for (const act of [1, 2, 3, 4]) if (!EVENTS.some((e) => !e.acts || e.acts.includes(act))) err(file, '', `no event available in act ${act}`);
    if (EVENTS.length < 16) warn(file, '', `only ${EVENTS.length} events (target 16+)`);
  }

  // ---- QUESTIONS ----
  const POS_DEP = /(上の|以上の)(すべて|全て|いずれ)|すべて正しい|全て正しい|いずれも正しくない|どれも正しくない|該当なし|上記/;
  for (const { q, file, field, part, set } of allQuestions) {
    if (!isObj(q) || !isStr(q.id)) continue;
    const w = q.id;
    const expectField = part ? set?.field ?? field : field;
    const qf = q.field ?? (part ? set?.field : undefined);
    if (!QUESTION_FIELDS.includes(qf)) err(file, w, `invalid field "${q.field}"`);
    else if (qf !== field) err(file, w, `field "${qf}" in ${field} file`);
    if (part && qf && qf !== expectField) err(file, w, 'part field differs from set field');
    const prefix = QUESTION_PREFIX[field];
    if (!part && !w.startsWith(prefix + '-')) err(file, w, `id must start with "${prefix}-"`);
    if (!isStr(q.topic)) err(file, w, 'missing topic');
    if (![1, 2, 3].includes(q.level)) err(file, w, `level must be 1|2|3 (got ${q.level})`);
    if (!isStr(q.text)) err(file, w, 'missing text');
    if (!isStr(q.explain)) err(file, w, 'missing explain');
    if (q.trap != null && typeof q.trap !== 'string') err(file, w, 'trap must be a string');
    if (q.given != null && typeof q.given !== 'string') err(file, w, 'given must be a string');
    if (q.type === 'choice') {
      if (!Array.isArray(q.choices) || q.choices.length !== 4) err(file, w, 'choice question must have exactly 4 choices');
      else {
        if (!q.choices.every(isStr)) err(file, w, 'choices must be non-empty strings');
        if (new Set(q.choices.map((c) => String(c).trim())).size !== 4) err(file, w, 'choices must be distinct');
        q.choices.forEach((c, i) => { if (typeof c === 'string' && POS_DEP.test(c)) err(file, `${w}.choices[${i}]`, `position-dependent choice "${clip(c)}"`); });
      }
      if (!(isInt(q.answer) && q.answer >= 0 && q.answer <= 3)) err(file, w, `choice answer must be an index 0..3 (got ${JSON.stringify(q.answer)})`);
      if (q.unit != null || q.tolerance != null) warn(file, w, 'unit/tolerance on a choice question');
    } else if (q.type === 'numeric') {
      if (!isNum(q.answer)) err(file, w, `numeric answer must be a finite number (got ${JSON.stringify(q.answer)})`);
      if (q.choices != null) warn(file, w, 'choices on a numeric question');
      if (q.tolerance != null && !(isNum(q.tolerance) && q.tolerance >= 0 && q.tolerance < 1)) err(file, w, 'tolerance must be in [0,1)');
      if (q.tolerance === 0 && q.absTolerance == null) warn(file, w, 'tolerance 0 without absTolerance requires an exact answer');
      if (q.absTolerance != null && !(isNum(q.absTolerance) && q.absTolerance >= 0)) err(file, w, 'absTolerance must be >= 0');
      if (isNum(q.answer) && Math.abs(q.answer) < 1e-12 && q.absTolerance == null) err(file, w, 'answer is 0: absTolerance required');
      if (q.unit != null && typeof q.unit !== 'string') err(file, w, 'unit must be a string');
    } else err(file, w, `type must be choice|numeric (got "${q.type}")`);
    walkStrings(file, w, q);
  }
  for (const { s, file, field } of allSets) {
    if (!isObj(s) || !isStr(s.id)) continue;
    const w = s.id;
    const prefix = QUESTION_PREFIX[field];
    if (!s.id.startsWith(`set-${prefix}-`)) err(file, w, `set id must start with "set-${prefix}-"`);
    if (s.field !== field) err(file, w, `set field "${s.field}" in ${field} file`);
    for (const k of ['title', 'lead']) if (!isStr(s[k])) err(file, w, `missing "${k}"`);
    if (!Array.isArray(s.parts) || s.parts.length < 4 || s.parts.length > 6) err(file, w, `parts must have 4..6 questions (got ${Array.isArray(s.parts) ? s.parts.length : 'none'})`);
    (s.parts || []).forEach((p, i) => {
      if (p && p.id !== `${s.id}-${i + 1}`) err(file, w, `part ${i + 1} id should be "${s.id}-${i + 1}" (got "${p?.id}")`);
    });
    walkStrings(file, w, { title: s.title, lead: s.lead });
  }
  // question counts per field
  for (const field of QUESTION_FIELDS) {
    if (!m[field]) continue;
    const file = F(field);
    const qs = (m[field].QUESTIONS || []).filter(isObj);
    if (qs.length < 45) warn(file, '', `${qs.length} questions (target 45+)`);
    const lv = [1, 2, 3].map((l) => qs.filter((q) => q.level === l).length);
    if (qs.length && (lv[0] < 5 || lv[1] < 10 || lv[2] < 8)) warn(file, '', `level mix L1/L2/L3 = ${lv.join('/')} (target ~10/20/15)`);
    const num = qs.filter((q) => q.type === 'numeric').length;
    if (qs.length && num / qs.length < 0.4) warn(file, '', `numeric ratio ${(100 * num / qs.length).toFixed(0)}% (target 40%+)`);
    const sets = (m[field].QUIZ_SETS || []).length;
    const want = field === 'inorganic' ? 1 : 2;
    if (sets < want) warn(file, '', `${sets} quiz sets (target ${want})`);
  }
  if (ENEMIES && setIds.size) {
    for (const e of ENEMIES) {
      if (e?.quizSetId && setIds.has(e.quizSetId) && e.quizField) {
        const s = allSets.find((x) => x.s.id === e.quizSetId)?.s;
        if (s && s.field !== e.quizField) warn(F('enemies'), e.id, `quizField ${e.quizField} differs from set field ${s.field}`);
      }
    }
  }

  // ---- cross checks ----
  if (CARDS && ENEMIES) {
    // tags reachable on enemies: base pool + those produced by addTag/transformTag anywhere
    const producible = new Set(enemyTagPool);
    const scan = (effs) => { for (const e of effs || []) { if (!e) continue; if (e.type === 'addTag') producible.add(e.tag); if (e.type === 'transformTag') producible.add(e.to); scan(e.effects); scan(e.onCorrect); scan(e.onWrong); } };
    for (const c of CARDS) { scan(c?.effects); for (const r of c?.reactions || []) scan(r.effects); }
    for (const e of ENEMIES) for (const mv of Object.values(e?.moves || {})) scan(mv.effects);
    for (const c of CARDS) for (const [i, r] of (c?.reactions || []).entries()) {
      const tags = [...(r.when?.anyTags || []), ...(r.when?.allTags || [])];
      if (!tags.length) continue;
      const any = r.when?.anyTags?.length ? r.when.anyTags.some((t) => producible.has(t)) : true;
      const all = (r.when?.allTags || []).every((t) => producible.has(t));
      if (!any || !all) warn(F('cards'), `${c.id}.reactions[${i}]`, `reaction can never trigger: no enemy has/gets tags ${tags.join(',')}`);
    }
  }
  if (TAGS && ENEMIES && CARDS) {
    for (const t of TAGS) if (t?.id && !enemyTagPool.has(t.id) && !usedReactionTags.has(t.id)) warn(F('tags'), t.id, 'tag used by neither enemies nor reactions');
  }

  report();
}

function report() {
  const errors = problems.filter((p) => p.level === 'error');
  const warns = problems.filter((p) => p.level === 'warn');
  const byFile = new Map();
  for (const p of problems) {
    if (p.level === 'warn' && QUIET_WARN) continue;
    if (!byFile.has(p.file)) byFile.set(p.file, []);
    byFile.get(p.file).push(p);
  }
  let shown = 0;
  for (const [file, list] of byFile) {
    const e = list.filter((p) => p.level === 'error').length;
    const w = list.length - e;
    console.log(`\n== ${file}  (${e} error${e === 1 ? '' : 's'}, ${w} warning${w === 1 ? '' : 's'})`);
    list.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
    for (const p of list) {
      if (shown++ >= MAX) break;
      console.log(`  ${p.level === 'error' ? 'ERROR' : 'warn '} ${p.where ? '[' + p.where + '] ' : ''}${p.msg}`);
    }
  }
  console.log(`\nvalidate-data: ${errors.length} error(s), ${warns.length} warning(s)`);
  process.exitCode = errors.length ? 1 : 0;
}

main().catch((e) => {
  console.error('validate-data crashed:', e);
  process.exitCode = 2;
});
