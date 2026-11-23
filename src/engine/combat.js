// Combat: setup, units, damage/block math, statuses, reactions, card play,
// turn flow steps and enemy AI. Turn flow is expressed as internal "_step"
// effects pushed on the run's effect queue (see effects.js) so that any step can
// pause for a quiz/selection and be resumed (and saved) at any time.

import {
  DEBUFFS, DECAY_AT_TURN_END, DIFFICULTIES, DEFAULT_DIFFICULTY, HAND_LIMIT, MAX_ENEMIES,
  MAX_MISCONCEPTIONS, PH_MAX, PH_MIN, PH_START, SIGNED_STATUSES, STATUS_INFO,
} from './constants.js';
import { cardDef, hasKeyword } from './data.js';
import { emit, clamp, newUid } from './util.js';
import { randInt, shuffle, weightedPick } from './rng.js';
import { pushFrame, fireTrigger } from './effects.js';
import { recordReaction } from './meta.js';
import { finishRun } from './run.js';

// ---------------------------------------------------------------------------
// Unit accessors. A unit "ref" is 'player' or an enemy uid ('e1', 'e2', ...).
// Player HP lives in run.player, block/statuses/energy in run.combat.player.
// ---------------------------------------------------------------------------

export function findEnemy(G, uid) {
  return G.run.combat?.enemies.find((e) => e.uid === uid) || null;
}
/** holder of block & statuses */
export function sh(G, ref) {
  return ref === 'player' ? G.run.combat?.player : findEnemy(G, ref);
}
/** holder of hp/maxHp */
export function hh(G, ref) {
  return ref === 'player' ? G.run.player : findEnemy(G, ref);
}
export function isAlive(G, ref) {
  if (ref === 'player') return G.run.player.hp > 0;
  const e = findEnemy(G, ref);
  return !!e && e.alive;
}
export function livingEnemies(G) {
  return G.run.combat ? G.run.combat.enemies.filter((e) => e.alive) : [];
}
export function isCombatActive(G) {
  const c = G.run.combat;
  return !!c && c.phase !== 'won' && c.phase !== 'lost';
}
export function unitName(G, ref) {
  if (ref === 'player') return 'あなた';
  return findEnemy(G, ref)?.name || '敵';
}
export function getStatus(G, ref, id) {
  const u = sh(G, ref);
  return u ? u.statuses[id] || 0 : 0;
}

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

/** Apply (add) a status. Handles colloid negation and precip-on-boss. */
export function applyStatus(G, ref, id, amount) {
  amount = Math.trunc(Number(amount) || 0);
  if (!amount || !STATUS_INFO[id]) return false;
  const u = sh(G, ref);
  if (!u || !isAlive(G, ref)) return false;
  const isDebuff = (DEBUFFS.includes(id) && amount > 0) || (SIGNED_STATUSES.includes(id) && amount < 0);
  if (isDebuff && (u.statuses.colloid || 0) > 0) {
    u.statuses.colloid -= 1;
    if (u.statuses.colloid <= 0) delete u.statuses.colloid;
    emit(G, { type: 'statusBlocked', target: ref, status: id, msg: `${unitName(G, ref)}の保護コロイドが${STATUS_INFO[id].label}を無効化した` });
    return false;
  }
  if (id === 'precip' && ref !== 'player' && u.tier === 'boss') {
    id = 'vulnerable'; amount = 2;
    emit(G, { type: 'info', target: ref, msg: `${u.name}は沈殿しない！代わりに活性化` });
  }
  let v = (u.statuses[id] || 0) + amount;
  if (!SIGNED_STATUSES.includes(id)) v = Math.max(0, v);
  if (v === 0) delete u.statuses[id]; else u.statuses[id] = v;
  emit(G, { type: 'status', target: ref, status: id, amount, value: v, msg: `${unitName(G, ref)}: ${STATUS_INFO[id].label} ${amount > 0 ? '+' : ''}${amount}` });
  return true;
}

function decStatus(u, id, by = 1) {
  if (!u.statuses[id]) return;
  u.statuses[id] -= by;
  if (u.statuses[id] <= 0) delete u.statuses[id];
}

// ---------------------------------------------------------------------------
// pH
// ---------------------------------------------------------------------------

export function setPh(G, value, ctx) {
  const c = G.run.combat;
  if (!c) return;
  const old = c.ph;
  const v = clamp(Math.round(Number(value) || 0), PH_MIN, PH_MAX);
  if (v === old) return;
  c.ph = v;
  emit(G, { type: 'ph', from: old, to: v, msg: `pH ${old} → ${v}` });
  fireTrigger(G, 'onPhChange', { from: old, to: v, delta: v - old }, ctx?.depth || 0);
}

export function phMult(G, enemy, key) {
  const def = G.db.enemies.get(enemy.id);
  const ph = G.run.combat.ph;
  let m = 1;
  for (const r of def?.phRules || []) {
    if (ph >= (r.min ?? PH_MIN) && ph <= (r.max ?? PH_MAX) && typeof r[key] === 'number') m *= r[key];
  }
  return m;
}

/** Active phRules (for UI highlighting). */
export function activePhRules(G, enemy) {
  const def = G.db.enemies.get(enemy.id);
  const ph = G.run.combat?.ph ?? PH_START;
  return (def?.phRules || []).filter((r) => ph >= (r.min ?? PH_MIN) && ph <= (r.max ?? PH_MAX));
}

// ---------------------------------------------------------------------------
// Damage / block / heal
// ---------------------------------------------------------------------------

/** Damage before buffer/block (pure; used for intent preview too). */
export function computeDamage(G, source, target, base, isAttack) {
  let amt = base;
  let mult = 1;
  if (isAttack && source && sh(G, source)) {
    const s = sh(G, source);
    amt += s.statuses.strength || 0;
    if ((s.statuses.weak || 0) > 0) mult *= 0.75;
    if (source !== 'player') mult *= phMult(G, findEnemy(G, source), 'dealtMult');
  }
  const t = sh(G, target);
  if (t && (t.statuses.vulnerable || 0) > 0) mult *= 1.5;
  if (target !== 'player' && t) mult *= phMult(G, t, 'takenMult');
  return Math.max(0, Math.floor(Math.max(0, amt) * mult + 1e-9));
}

/**
 * Deal damage. opts: { source, target, base, isAttack, pierce, depth }
 * Returns hp lost.
 */
export function dealDamage(G, { source = null, target, base, isAttack = false, pierce = false, depth = 0 }) {
  if (!isCombatActive(G) || !isAlive(G, target)) return 0;
  const t = sh(G, target);
  const th = hh(G, target);
  let dmg = computeDamage(G, source, target, base, isAttack);
  const buf = t.statuses.buffer || 0;
  if (buf > 0) dmg = Math.max(0, dmg - buf);
  let blocked = 0;
  if (!pierce) {
    blocked = Math.min(t.block, dmg);
    t.block -= blocked;
  }
  const loss = dmg - blocked;
  th.hp -= loss;
  emit(G, {
    type: 'damage', source, target, amount: dmg, blocked, hpLoss: loss,
    msg: `${unitName(G, target)}に${dmg}ダメージ${blocked ? `（${blocked}ブロック）` : ''}`,
  });
  if (target === 'player' && G.run.combat) G.run.combat.damageTaken = (G.run.combat.damageTaken || 0) + loss;
  if (th.hp <= 0) {
    th.hp = 0;
    if (target === 'player') { defeat(G); return loss; }
    killEnemy(G, t, depth);
  } else {
    if (target === 'player' && loss > 0 && isAttack) fireTrigger(G, 'onAttacked', { amount: loss, source }, depth);
    if (target !== 'player') checkPhases(G, t);
  }
  // thorns (発熱): retaliate against attacker
  const thorns = t.statuses.thorns || 0;
  if (isAttack && thorns > 0 && source && source !== target && isAlive(G, source) && isCombatActive(G)) {
    dealDamage(G, { source: target, target: source, base: thorns, isAttack: false, depth });
  }
  return loss;
}

/** HP loss ignoring block (poison, loseHp). */
export function loseHp(G, ref, amount, reason = '', depth = 0) {
  amount = Math.max(0, Math.floor(amount));
  if (!amount) return 0;
  if (ref === 'player' && !G.run.combat) {
    // outside combat (events): never kill the player
    const p = G.run.player;
    const loss = Math.min(amount, p.hp - 1);
    p.hp -= Math.max(0, loss);
    emit(G, { type: 'loseHp', target: 'player', amount: loss, msg: `HPを${loss}失った${reason ? '（' + reason + '）' : ''}` });
    return loss;
  }
  if (!isCombatActive(G) || !isAlive(G, ref)) return 0;
  const h = hh(G, ref);
  h.hp -= amount;
  emit(G, { type: 'loseHp', target: ref, amount, msg: `${unitName(G, ref)}はHPを${amount}失った${reason ? '（' + reason + '）' : ''}` });
  if (h.hp <= 0) {
    h.hp = 0;
    if (ref === 'player') defeat(G); else killEnemy(G, h, depth);
  } else if (ref !== 'player') checkPhases(G, h);
  return amount;
}

export function heal(G, ref, amount) {
  amount = Math.max(0, Math.floor(amount));
  const h = ref === 'player' ? G.run.player : findEnemy(G, ref);
  if (!h || (ref !== 'player' && !h.alive) || h.hp <= 0) return 0;
  const before = h.hp;
  h.hp = Math.min(h.maxHp, h.hp + amount);
  const got = h.hp - before;
  if (got > 0) emit(G, { type: 'heal', target: ref, amount: got, msg: `${ref === 'player' ? 'あなた' : h.name}のHPが${got}回復` });
  return got;
}

export function computeBlock(G, ref, amount) {
  const u = sh(G, ref);
  let v = amount + (u?.statuses.dexterity || 0);
  if ((u?.statuses.frail || 0) > 0) v *= 0.75;
  return Math.max(0, Math.floor(v + 1e-9));
}

export function gainBlock(G, ref, amount) {
  if (!isCombatActive(G) || !isAlive(G, ref)) return 0;
  const v = computeBlock(G, ref, amount);
  const u = sh(G, ref);
  u.block += v;
  if (v > 0) emit(G, { type: 'block', target: ref, amount: v, msg: `${unitName(G, ref)}はブロック${v}を得た` });
  return v;
}

// ---------------------------------------------------------------------------
// Death / victory / defeat
// ---------------------------------------------------------------------------

export function killEnemy(G, e, depth = 0) {
  if (!e.alive) return;
  e.alive = false; e.hp = 0; e.block = 0; e.intent = null;
  emit(G, { type: 'enemyDeath', target: e.uid, enemyId: e.id, msg: `${e.name}を倒した！` });
  G.run.stats.enemiesDefeated = (G.run.stats.enemiesDefeated || 0) + 1;
  let living = livingEnemies(G);
  if (living.length && living.every((x) => x.tier === 'minion')) {
    for (const m of living) {
      m.alive = false; m.hp = 0; m.intent = null;
      emit(G, { type: 'enemyDeath', target: m.uid, enemyId: m.id, msg: `${m.name}は消えた` });
    }
    living = [];
  }
  if (!living.length) victory(G, depth);
  else fireTrigger(G, 'onEnemyDeath', { enemyId: e.id }, depth);
}

/** All enemies dead: drop remaining combat work and wrap up. */
export function victory(G, depth = 0) {
  const c = G.run.combat;
  if (!c || c.phase === 'won' || c.phase === 'lost') return;
  c.phase = 'won';
  G.run.queue = G.run.queue.filter((f) => !f.ctx?.combat);
  if (G.run.pending && G.run.pending.ctx?.combat) G.run.pending = null;
  emit(G, { type: 'combatWon', msg: '戦闘に勝利した！' });
  pushFrame(G, [
    { type: '_trigger', trigger: 'onEnemyDeath' },
    { type: '_trigger', trigger: 'combatEnd' },
    { type: '_endCombat' },
  ], { side: 'player', source: 'system', actor: 'player', combat: false, depth });
}

export function defeat(G) {
  const c = G.run.combat;
  if (c) c.phase = 'lost';
  G.run.queue = [];
  G.run.pending = null;
  emit(G, { type: 'defeat', msg: '力尽きた……' });
  finishRun(G, false);
}

// ---------------------------------------------------------------------------
// Enemies: creation, phases, intents
// ---------------------------------------------------------------------------

export function createEnemy(G, enemyId) {
  const def = G.db.enemies.get(enemyId);
  if (!def) return null;
  const [mn, mx] = Array.isArray(def.hp) ? def.hp : [def.hp || 10, def.hp || 10];
  const diff = DIFFICULTIES[G.run.difficulty] || DIFFICULTIES[DEFAULT_DIFFICULTY];
  const hp = Math.max(1, Math.round(randInt(G.run, mn, mx) * diff.enemyHpMult));
  const c = G.run.combat;
  c.nextEnemy = (c.nextEnemy || 0) + 1;
  G.meta.seen.enemies[def.id] = (G.meta.seen.enemies[def.id] || 0) + 1;
  return {
    uid: 'e' + c.nextEnemy,
    id: def.id, name: def.name, emoji: def.emoji || '', formula: def.formula ?? null,
    tier: def.tier || 'normal',
    hp, maxHp: hp, block: 0, statuses: {},
    tags: (def.tags || []).slice(),
    hiddenTags: (def.hiddenTags || []).slice(),
    revealed: [],
    pI: def.pI ?? null,
    alive: true,
    intent: null,
    phaseIndex: -1,
    patternPos: 0,
    moveHistory: [],
    quizProgress: {},
  };
}

/** Current pattern (phase-aware). */
function currentPhase(G, e) {
  const def = G.db.enemies.get(e.id);
  return e.phaseIndex >= 0 ? def?.phases?.[e.phaseIndex] || null : null;
}

export function rollIntent(G, e) {
  const def = G.db.enemies.get(e.id);
  const moves = def?.moves || {};
  const ids = Object.keys(moves);
  if (!ids.length) { e.intent = null; return; }
  const pattern = currentPhase(G, e)?.pattern || def.pattern;
  let moveId;
  if (pattern?.type === 'cycle' && Array.isArray(pattern.seq)) {
    const seq = pattern.seq.filter((m) => moves[m]);
    moveId = seq.length ? seq[e.patternPos % seq.length] : ids[0];
    e.patternPos++;
  } else if (pattern?.type === 'weighted' && Array.isArray(pattern.table)) {
    let table = pattern.table.filter((r) => moves[r.move]);
    const n = pattern.noRepeat;
    if (n && e.moveHistory.length >= n) {
      const last = e.moveHistory.slice(-n);
      const filtered = table.filter((r) => !last.every((m) => m === r.move));
      if (filtered.length) table = filtered;
    }
    moveId = weightedPick(G.run, table, (r) => r.w ?? 1)?.move ?? ids[0];
  } else {
    moveId = ids[e.patternPos % ids.length];
    e.patternPos++;
  }
  const mv = moves[moveId];
  e.moveHistory.push(moveId);
  if (e.moveHistory.length > 8) e.moveHistory.shift();
  e.intent = { moveId, name: mv.name || moveId, intent: mv.intent || 'special', effects: mv.effects || [] };
}

/** Phase transitions when HP ratio drops below thresholds. */
export function checkPhases(G, e) {
  const def = G.db.enemies.get(e.id);
  const phases = def?.phases;
  if (!Array.isArray(phases) || !e.alive) return;
  let changed = false;
  const frames = [];
  while (e.phaseIndex + 1 < phases.length && e.hp / e.maxHp < (phases[e.phaseIndex + 1].hpBelow ?? 0)) {
    e.phaseIndex++;
    e.patternPos = 0;
    changed = true;
    const ph = phases[e.phaseIndex];
    emit(G, { type: 'phase', target: e.uid, index: e.phaseIndex, name: ph.name || null, msg: `${e.name}: ${ph.name || '第' + (e.phaseIndex + 2) + '形態'}へ移行` });
    if (Array.isArray(ph.onEnter) && ph.onEnter.length) frames.push(ph.onEnter);
  }
  if (changed) {
    e.moveHistory = [];
    rollIntent(G, e);
    for (let i = frames.length - 1; i >= 0; i--) {
      pushFrame(G, frames[i], { side: 'enemy', source: 'enemy', sourceId: e.id, actor: e.uid, combat: true, depth: 0 });
    }
  }
}

/** Quiz-set used by this enemy right now (phase overrides enemy). */
export function enemyQuizSource(G, e) {
  const def = G.db.enemies.get(e.id) || {};
  const ph = currentPhase(G, e) || {};
  return {
    quizSetId: ph.quizSetId ?? def.quizSetId ?? null,
    quizField: ph.quizField ?? def.quizField ?? null,
  };
}

/** Intent preview numbers for the UI (stored on e.intent.preview). */
export function intentPreview(G, e) {
  if (!e.intent) return null;
  let damage = null; let times = 0; let block = 0;
  for (const eff of e.intent.effects || []) {
    if ((eff.type === 'attack' || eff.type === 'damage') && (!eff.target || eff.target === 'player' || eff.target === 'enemy')) {
      const base = (eff.amount || 0) + scaleValueStatic(G, eff.scale, e.uid, 'player');
      const d = computeDamage(G, e.uid, 'player', base, true);
      const buf = G.run.combat.player.statuses.buffer || 0;
      damage = Math.max(0, d - buf);
      times += eff.times ?? 1;
    } else if (eff.type === 'block' && (!eff.target || eff.target === 'self')) {
      block += computeBlock(G, e.uid, eff.amount || 0);
    }
  }
  return { damage, times, total: damage == null ? 0 : damage * times, block };
}

/** scale metric for enemy-side previews (subset; see effects.scaleValue). */
function scaleValueStatic(G, scale, actor, target) {
  if (!scale) return 0;
  const c = G.run.combat;
  const per = scale.per ?? 1;
  const by = String(scale.by || '');
  let m = 0;
  if (by === 'phBelow7') m = Math.max(0, 7 - c.ph);
  else if (by === 'phAbove7') m = Math.max(0, c.ph - 7);
  else if (by === 'phDist') { const a = findEnemy(G, actor); m = Math.abs(c.ph - (a?.pI ?? 7)); }
  else if (by === 'block') m = sh(G, actor)?.block || 0;
  else if (by.startsWith('selfStatus:')) m = getStatus(G, actor, by.slice(11));
  else if (by.startsWith('targetStatus:')) m = getStatus(G, target, by.slice(13));
  else if (by === 'handSize') m = c.hand.length;
  return per * m;
}

// ---------------------------------------------------------------------------
// Tags / conditions / reactions
// ---------------------------------------------------------------------------

export function enemyHasTag(e, tag) {
  return e.tags.includes(tag) || e.hiddenTags.includes(tag);
}

/** Visible tag list for UI: [{tag, hidden:boolean}] ('?' when hidden && !revealed). */
export function displayTags(e) {
  return [
    ...e.tags.map((t) => ({ tag: t, hidden: false })),
    ...e.hiddenTags.map((t) => (e.revealed.includes(t) ? { tag: t, hidden: false, wasHidden: true } : { tag: null, hidden: true })),
  ];
}

/**
 * Evaluate a condition. enemy may be null (then tag/targetStatus conditions fail).
 * Returns { ok, usedHidden:[tags] }.
 */
export function evalCondition(G, when, enemy) {
  const fail = { ok: false, usedHidden: [] };
  if (!when) return { ok: true, usedHidden: [] };
  const used = [];
  const isHiddenOnly = (t) => enemy && enemy.hiddenTags.includes(t) && !enemy.tags.includes(t);
  if (Array.isArray(when.anyTags) && when.anyTags.length) {
    if (!enemy) return fail;
    const m = when.anyTags.filter((t) => enemyHasTag(enemy, t));
    if (!m.length) return fail;
    used.push(...m.filter(isHiddenOnly));
  }
  if (Array.isArray(when.allTags) && when.allTags.length) {
    if (!enemy) return fail;
    if (!when.allTags.every((t) => enemyHasTag(enemy, t))) return fail;
    used.push(...when.allTags.filter(isHiddenOnly));
  }
  if (Array.isArray(when.noTags) && when.noTags.length) {
    if (enemy && when.noTags.some((t) => enemyHasTag(enemy, t))) return fail;
  }
  if (when.ph) {
    const ph = G.run.combat?.ph ?? PH_START;
    if (ph < (when.ph.min ?? PH_MIN) || ph > (when.ph.max ?? PH_MAX)) return fail;
  }
  if (when.targetStatus) {
    if (!enemy || !((enemy.statuses[when.targetStatus] || 0) > 0)) return fail;
  }
  if (when.selfStatus) {
    if (!((G.run.combat?.player.statuses[when.selfStatus] || 0) > 0)) return fail;
  }
  return { ok: true, usedHidden: [...new Set(used)] };
}

function conditionNeedsEnemy(when) {
  return !!when && ((when.anyTags && when.anyTags.length) || (when.allTags && when.allTags.length) || when.targetStatus);
}

/**
 * First matching reaction of a card. For target:'enemy' the chosen target is
 * checked; otherwise the reaction holds if ANY living enemy satisfies it.
 * Returns { index, reaction, matched:[{uid, usedHidden}] } or null.
 */
export function findReaction(G, def, targetUid) {
  const reactions = Array.isArray(def.reactions) ? def.reactions : [];
  const living = livingEnemies(G);
  const cands = def.target === 'enemy' && targetUid ? living.filter((e) => e.uid === targetUid) : living;
  for (let i = 0; i < reactions.length; i++) {
    const r = reactions[i];
    if (!r) continue;
    if (!conditionNeedsEnemy(r.when)) {
      // tag-free condition (e.g. pH/selfStatus/noTags) – noTags checked against candidates if any
      const enemies = r.when?.noTags?.length ? cands : [null];
      const ok = enemies.length ? enemies.some((e) => evalCondition(G, r.when, e).ok) : evalCondition(G, r.when, null).ok;
      if (ok) return { index: i, reaction: r, matched: [] };
      continue;
    }
    const matched = [];
    for (const e of cands) {
      const res = evalCondition(G, r.when, e);
      if (res.ok) matched.push({ uid: e.uid, usedHidden: res.usedHidden });
    }
    if (matched.length) return { index: i, reaction: r, matched };
  }
  return null;
}

export function revealTags(G, e, tags) {
  const newly = [];
  for (const t of tags) {
    if (e.hiddenTags.includes(t) && !e.revealed.includes(t)) { e.revealed.push(t); newly.push(t); }
  }
  if (newly.length) {
    const labels = newly.map((t) => G.db.tags.get(t)?.label || t).join('・');
    emit(G, { type: 'reveal', target: e.uid, tags: newly, msg: `${e.name}の隠れた性質が判明: ${labels}` });
  }
  return newly;
}

// ---------------------------------------------------------------------------
// Piles
// ---------------------------------------------------------------------------

export function drawCards(G, n) {
  const c = G.run.combat;
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    if (c.hand.length >= HAND_LIMIT) break;
    if (!c.draw.length) {
      if (!c.discard.length) break;
      c.draw = shuffle(G.run, c.discard);
      c.discard = [];
      emit(G, { type: 'shuffle', msg: '捨て札を山札に戻した' });
    }
    const card = c.draw.shift();
    c.hand.push(card);
    drawn++;
    emit(G, { type: 'draw', uid: card.uid, cardId: card.id });
  }
  return drawn;
}

/** Put a card instance into a pile ('hand' overflows to discard). */
export function addToPile(G, inst, to) {
  const c = G.run.combat;
  if (to === 'hand') {
    if (c.hand.length < HAND_LIMIT) c.hand.push(inst); else c.discard.push(inst);
  } else if (to === 'draw') {
    const pos = randInt(G.run, 0, c.draw.length);
    c.draw.splice(pos, 0, inst);
  } else if (to === 'exhaust') c.exhaust.push(inst);
  else c.discard.push(inst);
}

export function exhaustCard(G, inst, depth = 0) {
  G.run.combat.exhaust.push(inst);
  const def = cardDef(G.db, inst.id, inst.upgraded);
  emit(G, { type: 'exhaust', uid: inst.uid, cardId: inst.id, msg: `${def?.name || inst.id}を除外` });
  fireTrigger(G, 'onExhaust', { cardId: inst.id, cardType: def?.type, field: def?.field }, depth);
}

export function instDef(G, inst) {
  return cardDef(G.db, inst.id, inst.upgraded);
}

// ---------------------------------------------------------------------------
// Combat setup
// ---------------------------------------------------------------------------

export function startCombat(G, { enemies, kind = 'battle', encounterId = null }) {
  const run = G.run;
  const c = {
    kind, encounterId, turn: 0, phase: 'player', ph: PH_START,
    player: { block: 0, statuses: {}, energy: 0, powers: [] },
    enemies: [], nextEnemy: 0,
    draw: [], hand: [], discard: [], exhaust: [], playing: [],
    cardsPlayedThisTurn: 0, cardsPlayed: 0, correctThisCombat: 0, wrongThisCombat: 0,
    reactionsThisCombat: 0, innateCount: 0, damageTaken: 0,
  };
  run.combat = c;
  run.screen = 'combat';
  for (const id of enemies || []) {
    if (c.enemies.length >= MAX_ENEMIES) break;
    const e = createEnemy(G, id);
    if (e) c.enemies.push(e);
  }
  const insts = run.deck.map((d) => ({ uid: d.uid, id: d.id, upgraded: !!d.upgraded }));
  shuffle(run, insts);
  const innate = insts.filter((i) => hasKeyword(instDef(G, i), 'innate'));
  c.innateCount = innate.length;
  c.draw = [...innate, ...insts.filter((i) => !innate.includes(i))];
  for (const e of c.enemies) rollIntent(G, e);
  emit(G, { type: 'combatStart', kind, enemies: c.enemies.map((e) => e.id), msg: `戦闘開始: ${c.enemies.map((e) => e.name).join('、') || '（敵なし）'}` });
  if (!c.enemies.length) { victory(G); return; }
  pushFrame(G, [
    { type: '_trigger', trigger: 'combatStart' },
    { type: '_startPlayerTurn' },
  ], sysCtx());
}

export function sysCtx() {
  return { side: 'player', source: 'system', actor: 'player', combat: true, depth: 0 };
}

// ---------------------------------------------------------------------------
// Card play
// ---------------------------------------------------------------------------

export function effectiveCost(G, inst) {
  const def = instDef(G, inst);
  if (!def) return null;
  if (def.cost === 'X') return 'X';
  if (def.cost === null) return null;
  let n = Number(def.cost ?? 0);
  if (inst.costOverride != null) n = inst.costOverride;
  if (n > 0 && (G.run.combat?.player.statuses.catalyst || 0) > 0) n -= 1;
  return Math.max(0, n);
}

/** { ok, reason?, needsTarget? } */
export function canPlayCard(G, uid, targetUid) {
  const c = G.run.combat;
  if (!isCombatActive(G) || c.phase !== 'player') return { ok: false, reason: '今はカードを使えない' };
  if (G.run.pending || G.run.queue.length) return { ok: false, reason: '処理中' };
  const inst = c.hand.find((x) => x.uid === uid);
  if (!inst) return { ok: false, reason: '手札にないカード' };
  const def = instDef(G, inst);
  if (!def) return { ok: false, reason: '不明なカード' };
  if (def.cost === null || hasKeyword(def, 'unplayable')) return { ok: false, reason: '使用できないカード' };
  const cost = effectiveCost(G, inst);
  if (cost !== 'X' && cost > c.player.energy) return { ok: false, reason: 'エネルギー不足' };
  if (def.target === 'enemy') {
    const living = livingEnemies(G);
    if (!living.length) return { ok: false, reason: '対象がいない' };
    if (targetUid != null) {
      if (!living.some((e) => e.uid === targetUid)) return { ok: false, reason: '無効な対象', needsTarget: true };
    } else if (living.length > 1) return { ok: false, reason: '対象を選んでください', needsTarget: true };
  }
  return { ok: true };
}

/** Plays a card. Returns null on success or an error string. Caller runs the queue. */
export function playCard(G, uid, targetUid) {
  const chk = canPlayCard(G, uid, targetUid);
  if (!chk.ok) return chk.reason;
  const c = G.run.combat;
  const idx = c.hand.findIndex((x) => x.uid === uid);
  const inst = c.hand.splice(idx, 1)[0];
  const def = instDef(G, inst);
  c.playing.push(inst);
  const cost = effectiveCost(G, inst);
  let x = 0;
  if (cost === 'X') { x = c.player.energy; c.player.energy = 0; }
  else {
    const baseCost = inst.costOverride ?? Number(def.cost ?? 0);
    if (baseCost > 0 && (c.player.statuses.catalyst || 0) > 0) {
      c.player.statuses.catalyst -= 1;
      if (c.player.statuses.catalyst <= 0) delete c.player.statuses.catalyst;
    }
    c.player.energy -= cost;
  }
  let target = null;
  if (def.target === 'enemy') target = targetUid ?? livingEnemies(G)[0].uid;
  c.cardsPlayedThisTurn++; c.cardsPlayed++;
  G.run.stats.cardsPlayed = (G.run.stats.cardsPlayed || 0) + 1;
  emit(G, { type: 'cardPlayed', uid, cardId: def.id, target, msg: `${def.name}を使用` });

  const ctx = {
    side: 'player', source: 'card', sourceId: def.id, actor: 'player', target,
    cardTarget: def.target || 'none', x, cardUid: uid, combat: true, depth: 0,
  };
  const info = { cardId: def.id, cardType: def.type, field: def.field, uid };
  const found = findReaction(G, def, target);
  let effects;
  const tail = [];
  if (found) {
    for (const m of found.matched) revealTags(G, findEnemy(G, m.uid), m.usedHidden);
    recordReactionHit(G, def, found.index, found.reaction);
    effects = found.reaction.replace ? (found.reaction.effects || []) : [...(def.effects || []), ...(found.reaction.effects || [])];
    tail.push({ type: '_trigger', trigger: 'onReaction', info: { ...info, reactionIndex: found.index } });
  } else if (def.strict) {
    effects = def.fizzle || [];
    emit(G, { type: 'fizzle', cardId: def.id, msg: `${def.name}は不発……（反応条件を満たさない）` });
    G.run.stats.fizzles = (G.run.stats.fizzles || 0) + 1;
    tail.push({ type: '_trigger', trigger: 'onFizzle', info });
  } else {
    effects = def.effects || [];
  }
  pushFrame(G, [
    ...effects,
    ...tail,
    { type: '_trigger', trigger: 'onCardPlayed', info },
    { type: '_finishCard', uid },
  ], ctx);
  return null;
}

function recordReactionHit(G, def, index, r) {
  const c = G.run.combat;
  c.reactionsThisCombat++;
  const key = def.id + '#' + index;
  const rs = (G.run.stats.reactions ||= {});
  rs[key] = rs[key] || { cardId: def.id, index, equation: r.equation || '', explain: r.explain || '', count: 0 };
  rs[key].count++;
  recordReaction(G.meta, def.id, index, r, G.now());
  emit(G, {
    type: 'reaction', cardId: def.id, index, equation: r.equation || '', explain: r.explain || '',
    msg: `反応成立！ ${def.name}${r.equation ? ': ' + r.equation : ''}`,
  });
}

// ---------------------------------------------------------------------------
// Turn-flow steps (invoked from the effect queue as internal effects)
// ---------------------------------------------------------------------------

export function stepStartPlayerTurn(G) {
  const c = G.run.combat;
  const p = c.player;
  const first = c.turn === 0;
  c.turn++;
  c.phase = 'player';
  c.cardsPlayedThisTurn = 0;
  if (!first) { p.block = 0; p.energy = 0; }
  p.energy += G.run.player.energyPerTurn;
  if (p.statuses.excited) { p.energy += p.statuses.excited; delete p.statuses.excited; }
  if (p.statuses.precip) {
    p.energy = Math.max(0, p.energy - 1);
    delete p.statuses.precip;
    emit(G, { type: 'info', msg: '沈殿で動きが鈍った（エネルギー −1）' });
  }
  emit(G, { type: 'turnStart', turn: c.turn, msg: `― ターン ${c.turn} ―` });
  if (p.statuses.poison) {
    const n = p.statuses.poison;
    decStatus(p, 'poison');
    loseHp(G, 'player', n, '腐食');
    if (!isCombatActive(G)) return;
  }
  if (p.statuses.chain) applyStatus(G, 'player', 'strength', p.statuses.chain);
  pushFrame(G, [
    { type: '_trigger', trigger: 'turnStart' },
    { type: '_drawTurn' },
  ], sysCtx());
}

export function stepDrawTurn(G) {
  const c = G.run.combat;
  const n = c.turn === 1 ? Math.max(G.run.player.drawPerTurn, c.innateCount) : G.run.player.drawPerTurn;
  drawCards(G, n);
}

export function endTurn(G) {
  const c = G.run.combat;
  if (!isCombatActive(G) || c.phase !== 'player') return 'ターン終了できない';
  if (G.run.pending || G.run.queue.length) return '処理中';
  c.phase = 'enemy';
  pushFrame(G, [
    { type: '_trigger', trigger: 'turnEnd' },
    { type: '_endTurnInHand' },
    { type: '_discardHand' },
    { type: '_playerTurnEnd' },
    { type: '_enemyPhase' },
  ], sysCtx());
  return null;
}

export function stepEndTurnInHand(G) {
  const c = G.run.combat;
  const frames = [];
  for (const inst of c.hand) {
    const def = instDef(G, inst);
    if (Array.isArray(def?.endTurnInHand) && def.endTurnInHand.length) {
      frames.push({
        effects: def.endTurnInHand,
        ctx: { side: 'player', source: 'card', sourceId: def.id, actor: 'player', cardTarget: def.target || 'self', cardUid: inst.uid, combat: true, depth: 0 },
      });
    }
  }
  for (let i = frames.length - 1; i >= 0; i--) pushFrame(G, frames[i].effects, frames[i].ctx);
}

export function stepDiscardHand(G) {
  const c = G.run.combat;
  const keep = [];
  const hand = c.hand;
  c.hand = [];
  for (const inst of hand) {
    const def = instDef(G, inst);
    if (hasKeyword(def, 'retain')) keep.push(inst);
    else if (hasKeyword(def, 'ethereal')) exhaustCard(G, inst);
    else c.discard.push(inst);
  }
  c.hand = keep;
}

function endOfTurnStatuses(G, ref) {
  const u = sh(G, ref);
  for (const id of DECAY_AT_TURN_END) decStatus(u, id);
  if (u.statuses.regen) {
    const n = u.statuses.regen;
    heal(G, ref, n);
    decStatus(u, 'regen');
  }
  delete u.statuses.catalyst;
}

export function stepPlayerTurnEnd(G) {
  endOfTurnStatuses(G, 'player');
}

export function stepEnemyPhase(G) {
  const effects = [];
  for (const e of livingEnemies(G)) {
    effects.push({ type: '_enemyTurnStart', uid: e.uid }, { type: '_enemyAct', uid: e.uid });
  }
  effects.push({ type: '_enemiesTurnEnd' }, { type: '_rollIntents' }, { type: '_startPlayerTurn' });
  pushFrame(G, effects, { side: 'enemy', source: 'system', combat: true, depth: 0 });
}

export function stepEnemyTurnStart(G, uid) {
  const e = findEnemy(G, uid);
  if (!e || !e.alive) return;
  e.block = 0;
  if (e.statuses.poison) {
    const n = e.statuses.poison;
    decStatus(e, 'poison');
    loseHp(G, uid, n, '腐食');
    if (!e.alive) return;
  }
  if (e.statuses.chain) applyStatus(G, uid, 'strength', e.statuses.chain);
  delete e.statuses.excited;
}

export function stepEnemyAct(G, uid) {
  const e = findEnemy(G, uid);
  if (!e || !e.alive) return;
  if (e.statuses.precip) {
    delete e.statuses.precip;
    emit(G, { type: 'enemySkip', target: uid, msg: `${e.name}は沈殿して動けない！` });
    return;
  }
  if (!e.intent) return;
  const def = G.db.enemies.get(e.id);
  const mv = def?.moves?.[e.intent.moveId];
  if (!mv) return;
  emit(G, { type: 'enemyMove', target: uid, moveId: e.intent.moveId, intent: mv.intent, msg: `${e.name}の「${mv.name || e.intent.moveId}」` });
  pushFrame(G, mv.effects || [], { side: 'enemy', source: 'enemy', sourceId: e.id, actor: uid, combat: true, depth: 0, moveId: e.intent.moveId });
}

export function stepEnemiesTurnEnd(G) {
  for (const e of livingEnemies(G)) endOfTurnStatuses(G, e.uid);
}

export function stepRollIntents(G) {
  for (const e of livingEnemies(G)) rollIntent(G, e);
}

export function stepFinishCard(G, uid) {
  const c = G.run.combat;
  const i = c.playing.findIndex((x) => x.uid === uid);
  if (i < 0) return;
  const inst = c.playing.splice(i, 1)[0];
  const def = instDef(G, inst);
  if (def?.type === 'power') return; // powers leave play
  if (hasKeyword(def, 'exhaust')) exhaustCard(G, inst);
  else c.discard.push(inst);
}

/** Add a 'misconception' to deck and (in combat) draw pile. Capped. */
export function addMisconception(G) {
  const id = 'misconception';
  if (!G.db.cards.has(id)) return false;
  const count = G.run.deck.filter((d) => d.id === id).length;
  if (count >= MAX_MISCONCEPTIONS) return false;
  const inst = { uid: newUid(G), id, upgraded: false };
  G.run.deck.push(inst);
  if (G.run.combat && isCombatActive(G)) addToPile(G, { ...inst }, 'draw');
  emit(G, { type: 'cardAdded', cardId: id, to: 'deck', msg: '「思い込み」がデッキに混入した' });
  return true;
}

