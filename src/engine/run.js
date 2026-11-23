// Run-level flow: new run, map navigation, encounters, rewards, events, rest,
// shop, treasure, potions, deck/relic management, quiz answering, run end.

import {
  ACT_CARD_FIELDS, ACT_NAMES, DEFAULT_DIFFICULTY, DIFFICULTIES, ENGINE_VERSION, FINAL_ACT,
  PLAYER_START, REST, REWARD, SHOP, COMBAT_ONLY_EFFECTS,
} from './constants.js';
import { cardDef, isUpgradable } from './data.js';
import { hashSeed, chance, pick, randInt, sample, weightedPick } from './rng.js';
import { emit, newUid } from './util.js';
import { availableNodeIds, findNode, generateMap } from './map.js';
import {
  addMisconception, heal, isCombatActive, livingEnemies, startCombat,
} from './combat.js';
import { fireTrigger, handRemove, pushFrame, runQueue } from './effects.js';
import { correctAnswerText, judgePending } from './quiz.js';
import { recordAnswer } from './meta.js';

// ---------------------------------------------------------------------------
// Run creation
// ---------------------------------------------------------------------------

export function createRun(G, { seed, difficulty } = {}) {
  const diff = DIFFICULTIES[difficulty] ? difficulty : DEFAULT_DIFFICULTY;
  const run = {
    version: ENGINE_VERSION,
    seed: String(seed),
    rng: hashSeed(seed),
    difficulty: diff,
    act: 1,
    floor: 0,
    screen: 'map', // map|combat|reward|event|rest|shop|treasure|victory|gameOver
    map: null,
    position: null, // node id within current act map, 'boss', or null (act start)
    visited: [],
    player: {
      hp: PLAYER_START.hp, maxHp: PLAYER_START.maxHp, gold: PLAYER_START.gold,
      energyPerTurn: PLAYER_START.energy, drawPerTurn: PLAYER_START.draw, potionSlots: PLAYER_START.potionSlots,
    },
    deck: [],
    relics: [],
    potions: new Array(PLAYER_START.potionSlots).fill(null),
    combat: null, reward: null, event: null, shop: null, rest: null, treasure: null,
    pending: null,
    queue: [],
    log: [],
    errors: [],
    askedQuestions: [],
    quizLog: [],
    seenEvents: [],
    recentEncounters: [],
    stats: { cardsPlayed: 0, enemiesDefeated: 0, combatsWon: 0, reactions: {}, fizzles: 0, correct: 0, wrong: 0, goldEarned: 0 },
    nextUid: 1,
    removalsBought: 0,
    lastQuiz: null,
    result: null,
    startedAt: G.now(),
  };
  G.run = run;
  for (const id of G.db.starterDeck) if (G.db.cards.has(id)) addCardToDeck(G, id, false, true);
  if (G.db.starterRelic && G.db.relics.has(G.db.starterRelic)) addRelic(G, G.db.starterRelic, true);
  run.map = generateMap(run, 1);
  emit(G, { type: 'actStart', act: 1, msg: `Act 1: ${ACT_NAMES[1]}` });
  runQueue(G);
  return run;
}

// ---------------------------------------------------------------------------
// Map navigation
// ---------------------------------------------------------------------------

export function availableNodes(G) {
  const run = G.run;
  if (!run || run.screen !== 'map' || run.pending) return [];
  return availableNodeIds(run.map, run.position);
}

export function chooseNode(G, id) {
  const run = G.run;
  if (run.screen !== 'map') return 'マップ画面ではない';
  if (run.pending || run.queue.length) return '処理中';
  if (!availableNodeIds(run.map, run.position).includes(id)) return '進めないノード';
  const node = findNode(run.map, id);
  run.position = id;
  run.visited.push(run.act + ':' + id);
  run.floor++;
  emit(G, { type: 'enterNode', node: id, nodeType: node.type });
  switch (node.type) {
    case 'battle': startEncounter(G, 'normal', node.row ?? 0); break;
    case 'elite': startEncounter(G, 'elite', node.row ?? 0); break;
    case 'boss': startEncounter(G, 'boss', 99); break;
    case 'event': enterEvent(G); break;
    case 'rest': enterRest(G); break;
    case 'shop': enterShop(G); break;
    case 'treasure': enterTreasure(G); break;
    default: run.screen = 'map';
  }
  return null;
}

function returnToMap(G) {
  const run = G.run;
  run.screen = 'map';
  run.event = null; run.shop = null; run.rest = null; run.treasure = null; run.reward = null;
}

// ---------------------------------------------------------------------------
// Encounters
// ---------------------------------------------------------------------------

export function pickEncounter(G, tier, row) {
  const { db, run } = G;
  const act = run.act;
  let pool = db.encounters.filter((e) => e.act === act && e.tier === tier && (e.minRow ?? 1) <= row + 1);
  if (!pool.length) pool = db.encounters.filter((e) => e.act === act && e.tier === tier);
  if (!pool.length) {
    for (let d = 1; d <= 4 && !pool.length; d++) {
      pool = db.encounters.filter((e) => (e.act === act - d || e.act === act + d) && e.tier === tier);
    }
  }
  if (pool.length) {
    const fresh = pool.filter((e) => !run.recentEncounters.includes(e.id));
    const enc = weightedPick(run, fresh.length ? fresh : pool, (e) => e.weight ?? 1);
    run.recentEncounters.push(enc.id);
    if (run.recentEncounters.length > 3) run.recentEncounters.shift();
    return { id: enc.id, enemies: enc.enemies.filter((id) => db.enemies.has(id)) };
  }
  // fallback: build from enemy list
  let enemies = db.enemyList.filter((e) => e.act === act && e.tier === tier);
  if (!enemies.length) enemies = db.enemyList.filter((e) => e.tier === tier);
  if (!enemies.length) enemies = db.enemyList.filter((e) => e.tier !== 'minion');
  const e = pick(run, enemies);
  return { id: null, enemies: e ? [e.id] : [] };
}

export function startEncounter(G, tier, row) {
  const enc = pickEncounter(G, tier, row);
  const kind = tier === 'normal' ? 'battle' : tier;
  startCombat(G, { enemies: enc.enemies, kind, encounterId: enc.id });
}

/** Called from the queue after a won combat (post combatEnd triggers). */
export function endCombat(G) {
  const run = G.run;
  const c = run.combat;
  if (!c) return;
  const kind = c.kind;
  run.stats.combatsWon++;
  run.lastCombat = { kind, turns: c.turn, reactions: c.reactionsThisCombat, correct: c.correctThisCombat, damageTaken: c.damageTaken };
  run.combat = null;
  if (kind === 'boss' && run.act >= FINAL_ACT) {
    emit(G, { type: 'victory', msg: '二次試験を突破した！' });
    finishRun(G, true);
    return;
  }
  const reward = {
    kind, gold: 0, cards: [], cardTaken: false, potion: null, potionTaken: false,
    relic: null, relicChoices: [], relicTaken: false, heal: 0,
  };
  const [gmin, gmax] = REWARD.gold[kind] || REWARD.gold.battle;
  reward.gold = randInt(run, gmin, gmax);
  gainGold(G, reward.gold);
  reward.cards = rollCardChoices(G, kind, 3);
  if (chance(run, REWARD.potionChance[kind] ?? 0)) reward.potion = randomPotionId(G);
  if (kind === 'elite') reward.relic = randomRelicId(G);
  if (kind === 'boss') {
    reward.relicChoices = bossRelicChoices(G);
    reward.heal = heal(G, 'player', Math.floor(run.player.maxHp * REWARD.bossHealRatio));
  }
  run.reward = reward;
  run.screen = 'reward';
}

function gainGold(G, n) {
  G.run.player.gold += n;
  G.run.stats.goldEarned += n;
  emit(G, { type: 'gold', amount: n, msg: `研究費 +${n}` });
}

// ---------------------------------------------------------------------------
// Random pools
// ---------------------------------------------------------------------------

function rewardCards(G) {
  return G.db.cardList.filter((c) => ['common', 'uncommon', 'rare'].includes(c.rarity) && c.type !== 'curse' && c.type !== 'status');
}

function fieldWeight(G, card) {
  const fav = ACT_CARD_FIELDS[G.run.act] || [];
  if (!fav.length) return 1;
  if (fav.includes(card.field)) return REWARD.fieldWeight.match;
  if (card.field === 'neutral') return REWARD.fieldWeight.neutral;
  return REWARD.fieldWeight.other;
}

export function rollCardChoices(G, kind = 'battle', n = 3) {
  const pool = rewardCards(G);
  const weights = REWARD.cardRarity[kind] || REWARD.cardRarity.battle;
  const out = [];
  for (let k = 0; k < n; k++) {
    const avail = pool.filter((c) => !out.includes(c.id));
    if (!avail.length) break;
    const rarities = Object.keys(weights).filter((r) => weights[r] > 0 && avail.some((c) => c.rarity === r));
    const rarity = rarities.length ? weightedPick(G.run, rarities, (r) => weights[r]) : null;
    const cands = rarity ? avail.filter((c) => c.rarity === rarity) : avail;
    const card = weightedPick(G.run, cands, (c) => fieldWeight(G, c));
    if (card) out.push(card.id);
  }
  return out;
}

export function randomCardId(G, { rarity, field } = {}) {
  let pool = rewardCards(G);
  if (rarity) pool = pool.filter((c) => c.rarity === rarity);
  if (field) pool = pool.filter((c) => c.field === field);
  if (!pool.length) pool = rewardCards(G);
  if (!pool.length) return null;
  if (!rarity) {
    const w = REWARD.cardRarity.battle;
    const rs = Object.keys(w).filter((r) => pool.some((c) => c.rarity === r));
    const r = weightedPick(G.run, rs, (x) => w[x]);
    if (r) pool = pool.filter((c) => c.rarity === r);
  }
  return weightedPick(G.run, pool, (c) => fieldWeight(G, c))?.id ?? null;
}

function ownedRelic(G, id) {
  return G.run.relics.some((r) => r.id === id);
}

export function randomRelicId(G, rarity) {
  const all = G.db.relicList.filter((r) => r.rarity !== 'starter' && !ownedRelic(G, r.id));
  let pool = rarity ? all.filter((r) => r.rarity === rarity) : [];
  if (!pool.length) {
    const base = all.filter((r) => ['common', 'uncommon', 'rare'].includes(r.rarity));
    const w = REWARD.relicRarity;
    const rs = Object.keys(w).filter((r) => base.some((x) => x.rarity === r));
    const r = weightedPick(G.run, rs, (x) => w[x]);
    pool = r ? base.filter((x) => x.rarity === r) : base;
  }
  if (!pool.length) pool = all;
  return pick(G.run, pool)?.id ?? null;
}

function bossRelicChoices(G) {
  const unowned = (r) => !ownedRelic(G, r.id);
  const boss = G.db.relicList.filter((r) => r.rarity === 'boss' && unowned(r));
  const rare = G.db.relicList.filter((r) => r.rarity === 'rare' && unowned(r));
  const picks = sample(G.run, boss, REWARD.bossRelicChoices);
  if (picks.length < REWARD.bossRelicChoices) picks.push(...sample(G.run, rare, REWARD.bossRelicChoices - picks.length));
  return picks.map((r) => r.id);
}

export function randomPotionId(G, rarity) {
  let pool = G.db.potionList;
  if (rarity) pool = pool.filter((p) => p.rarity === rarity);
  if (!pool.length) pool = G.db.potionList;
  if (!pool.length) return null;
  if (!rarity) {
    const w = REWARD.potionRarity;
    const rs = Object.keys(w).filter((r) => pool.some((p) => p.rarity === r));
    const r = weightedPick(G.run, rs, (x) => w[x]);
    if (r) pool = pool.filter((p) => p.rarity === r);
  }
  return pick(G.run, pool)?.id ?? null;
}

// ---------------------------------------------------------------------------
// Deck / relic / potion management
// ---------------------------------------------------------------------------

export function addCardToDeck(G, id, upgraded = false, silent = false) {
  if (!G.db.cards.has(id)) return null;
  const inst = { uid: newUid(G), id, upgraded: !!upgraded };
  G.run.deck.push(inst);
  G.meta.seen.cards[id] = (G.meta.seen.cards[id] || 0) + 1;
  if (!silent) emit(G, { type: 'cardGained', cardId: id, uid: inst.uid, msg: `「${cardDef(G.db, id, upgraded).name}」をデッキに加えた` });
  return inst;
}

export function addRelic(G, id, silent = false) {
  const def = G.db.relics.get(id);
  if (!def || ownedRelic(G, id)) return false;
  G.run.relics.push({ id, counters: {} });
  G.meta.seen.relics[id] = (G.meta.seen.relics[id] || 0) + 1;
  if (!silent) emit(G, { type: 'relicGained', relicId: id, msg: `器具「${def.name}」を手に入れた` });
  const pickups = (def.triggers || []).filter((t) => t && t.trigger === 'onPickup');
  for (let i = pickups.length - 1; i >= 0; i--) {
    pushFrame(G, pickups[i].effects || [], {
      side: 'player', source: 'relic', sourceId: id, actor: 'player', combat: isCombatActive(G), depth: 1,
    });
  }
  return true;
}

export function addPotion(G, id) {
  const slots = G.run.potions;
  const i = slots.indexOf(null);
  if (i < 0 || !G.db.potions.has(id)) {
    emit(G, { type: 'info', msg: '試薬瓶スロットがいっぱい' });
    return false;
  }
  slots[i] = id;
  emit(G, { type: 'potionGained', potionId: id, msg: `試薬瓶「${G.db.potions.get(id).name}」を手に入れた` });
  return true;
}

function removeDeckUids(G, uids) {
  for (const uid of uids) {
    const i = G.run.deck.findIndex((d) => d.uid === uid);
    if (i < 0) continue;
    const [inst] = G.run.deck.splice(i, 1);
    emit(G, { type: 'cardRemoved', cardId: inst.id, uid, msg: `「${cardDef(G.db, inst.id, inst.upgraded)?.name || inst.id}」をデッキから除去` });
  }
}

function upgradeDeckUids(G, uids) {
  for (const uid of uids) {
    const inst = G.run.deck.find((d) => d.uid === uid);
    if (!inst || !isUpgradable(G.db, inst)) continue;
    inst.upgraded = true;
    emit(G, { type: 'cardUpgraded', cardId: inst.id, uid, msg: `「${cardDef(G.db, inst.id, true).name}」に強化` });
  }
}

/** removeCard effect. */
export function removeCardsFromDeck(G, eff, ctx) {
  const count = Math.max(1, Number(eff.count ?? 1));
  const deck = G.run.deck;
  if (eff.cardId) {
    const uids = deck.filter((d) => d.id === eff.cardId).slice(0, count).map((d) => d.uid);
    removeDeckUids(G, uids);
    return;
  }
  if (!deck.length) return;
  if (eff.choose === false) {
    removeDeckUids(G, sample(G.run, deck, count).map((d) => d.uid));
    return;
  }
  const n = Math.min(count, deck.length);
  G.run.pending = {
    kind: 'selectCards', purpose: 'removeCard', from: 'deck', options: deck.map((d) => d.uid),
    count: n, min: n, canCancel: false, ctx, title: `デッキから除去するカードを${n}枚選ぶ`,
  };
}

/** upgradeCard effect. */
export function upgradeCardsInDeck(G, eff, ctx) {
  const count = Math.max(1, Number(eff.count ?? 1));
  const ups = G.run.deck.filter((d) => isUpgradable(G.db, d));
  if (!ups.length) return;
  if (!eff.choose) {
    upgradeDeckUids(G, sample(G.run, ups, count).map((d) => d.uid));
    return;
  }
  const n = Math.min(count, ups.length);
  G.run.pending = {
    kind: 'selectCards', purpose: 'upgradeCard', from: 'deck', options: ups.map((d) => d.uid),
    count: n, min: n, canCancel: false, ctx, title: `強化するカードを${n}枚選ぶ`,
  };
}

// ---------------------------------------------------------------------------
// Pending resolution: card selection & quiz
// ---------------------------------------------------------------------------

export function selectCards(G, uids) {
  const run = G.run;
  const p = run.pending;
  if (!p || p.kind !== 'selectCards') return 'カード選択中ではない';
  if (!Array.isArray(uids)) uids = [uids];
  uids = [...new Set(uids)];
  if (uids.some((u) => !p.options.includes(u))) return '選択できないカード';
  const need = Math.min(p.min ?? p.count, p.options.length);
  if (uids.length < need || uids.length > p.count) return `${need}枚選んでください`;
  if (p.purpose === 'shopRemove' && run.player.gold < removalPrice(G)) return '研究費が足りない';
  run.pending = null;
  switch (p.purpose) {
    case 'exhaustFromHand':
    case 'discardFromHand':
      if (isCombatActive(G)) handRemove(G, uids, p.purpose, p.ctx?.depth || 0);
      break;
    case 'removeCard': removeDeckUids(G, uids); break;
    case 'upgradeCard': upgradeDeckUids(G, uids); break;
    case 'shopRemove': {
      run.player.gold -= removalPrice(G);
      run.removalsBought++;
      if (run.shop) run.shop.removalUsed = true;
      removeDeckUids(G, uids);
      break;
    }
    case 'restUpgrade':
      upgradeDeckUids(G, uids);
      if (run.rest) { run.rest.used = true; run.rest.choice = 'upgrade'; }
      fireTrigger(G, 'onRest', { option: 'upgrade' });
      break;
    default: break;
  }
  runQueue(G);
  return null;
}

export function cancelSelection(G) {
  const p = G.run.pending;
  if (!p || p.kind !== 'selectCards') return 'カード選択中ではない';
  if (!p.canCancel) return 'キャンセルできない';
  G.run.pending = null;
  runQueue(G);
  return null;
}

/**
 * @param {object} [opts] co-op only: { teamCorrect?:boolean (overrides the game outcome),
 *   personalCorrect?:boolean (what is recorded in this player's own notebook/stats), team?:[{name, answerText, correct}] }
 */
export function answerQuiz(G, answer, opts = {}) {
  const run = G.run;
  const p = run.pending;
  if (!p || p.kind !== 'quiz') return '出題中ではない';
  const q = G.db.questions.get(p.questionId);
  if (!q) {
    // question vanished (data changed since save): continue neutrally
    run.pending = null;
    runQueue(G);
    return null;
  }
  const j = judgePending(q, p, answer);
  const personal = typeof opts.personalCorrect === 'boolean' ? opts.personalCorrect : j.correct;
  if (typeof opts.teamCorrect === 'boolean') j.correct = opts.teamCorrect;
  const nb = recordAnswer(G.meta, q, personal, G.now());
  run.quizLog.push({ id: q.id, field: q.field, topic: q.topic, level: q.level, correct: j.correct });
  if (j.correct) run.stats.correct++; else run.stats.wrong++;
  run.lastQuiz = { questionId: q.id, correct: j.correct };
  const c = run.combat;
  if (c && isCombatActive(G)) { if (j.correct) c.correctThisCombat++; else c.wrongThisCombat++; }
  let misconceptionAdded = false;
  if (!j.correct) misconceptionAdded = addMisconception(G);
  run.pending = {
    ...p,
    kind: 'quizResult',
    answer: typeof answer === 'number' ? answer : String(answer ?? ''),
    parsed: j.parsed,
    correct: j.correct,
    correctDisplay: j.correctDisplay,
    correctAnswerText: correctAnswerText(q),
    explain: q.explain || '',
    trap: q.trap || null,
    addedToNotebook: nb.addedToNotebook,
    graduated: nb.graduated,
    streak: nb.streak,
    misconceptionAdded,
    team: Array.isArray(opts.team) ? opts.team : null,
    personalCorrect: personal,
  };
  emit(G, { type: 'quizResult', questionId: q.id, correct: j.correct, msg: j.correct ? '正解！' : '不正解……' });
  return null;
}

/** After showing the explanation: apply onCorrect/onWrong and continue. */
export function continueQuiz(G) {
  const run = G.run;
  const p = run.pending;
  if (!p || p.kind !== 'quizResult') return '解説表示中ではない';
  run.pending = null;
  if (p.ctx?.source === 'event' && run.event) run.event.quizCorrect = p.correct;
  if (p.ctx?.source === 'rest' && run.rest) run.rest.reviewResults.push(p.correct);
  const ctx = p.ctx || { side: 'player', source: 'system', actor: 'player', combat: false, depth: 0 };
  pushFrame(G, [
    ...(p.correct ? p.onCorrect || [] : p.onWrong || []),
    { type: '_trigger', trigger: p.correct ? 'onQuizCorrect' : 'onQuizWrong', info: { quizField: p.field, questionId: p.questionId } },
  ], ctx);
  runQueue(G);
  return null;
}

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

export function pickRewardCard(G, index) {
  const r = G.run.reward;
  if (G.run.screen !== 'reward' || !r) return '報酬画面ではない';
  if (r.cardTaken) return 'カードは選択済み';
  const id = r.cards[index];
  if (!id) return '無効な選択';
  addCardToDeck(G, id);
  r.cardTaken = true;
  r.cardPicked = id;
  return null;
}

export function skipRewardCard(G) {
  const r = G.run.reward;
  if (G.run.screen !== 'reward' || !r) return '報酬画面ではない';
  if (r.cardTaken) return 'カードは選択済み';
  r.cardTaken = 'skipped';
  return null;
}

export function takeRewardPotion(G) {
  const r = G.run.reward;
  if (G.run.screen !== 'reward' || !r || !r.potion || r.potionTaken) return '受け取れる試薬瓶がない';
  if (!addPotion(G, r.potion)) return '試薬瓶スロットがいっぱい';
  r.potionTaken = true;
  return null;
}

export function takeRewardRelic(G, index = 0) {
  const r = G.run.reward;
  if (G.run.screen !== 'reward' || !r || r.relicTaken) return '受け取れる器具がない';
  const id = r.relicChoices.length ? r.relicChoices[index] : r.relic;
  if (!id) return '無効な選択';
  addRelic(G, id);
  r.relicTaken = true;
  r.relicPicked = id;
  runQueue(G);
  return null;
}

export function leaveReward(G) {
  const run = G.run;
  if (run.screen !== 'reward') return '報酬画面ではない';
  if (run.pending || run.queue.length) return '処理中';
  const wasBoss = run.reward?.kind === 'boss';
  returnToMap(G);
  if (wasBoss) nextAct(G);
  return null;
}

function nextAct(G) {
  const run = G.run;
  run.act++;
  run.position = null;
  run.map = generateMap(run, run.act);
  run.screen = 'map';
  emit(G, { type: 'actStart', act: run.act, msg: `Act ${run.act >= FINAL_ACT ? '終' : run.act}: ${ACT_NAMES[run.act] || ''}` });
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

function pickEvent(G) {
  const { db, run } = G;
  const inAct = db.events.filter((e) => !Array.isArray(e.acts) || !e.acts.length || e.acts.includes(Math.min(run.act, 4)) || e.acts.includes(run.act));
  const fresh = inAct.filter((e) => !run.seenEvents.includes(e.id));
  return pick(run, fresh.length ? fresh : inAct.length ? inAct : db.events) || null;
}

export function enterEvent(G) {
  const run = G.run;
  const ev = pickEvent(G);
  if (!ev) {
    // no events at all: fall back to a battle
    startEncounter(G, 'normal', 1);
    return;
  }
  run.seenEvents.push(ev.id);
  run.event = { id: ev.id, phase: 'choose', choiceIndex: null, resultText: null, quizCorrect: null };
  run.screen = 'event';
  emit(G, { type: 'event', eventId: ev.id, msg: `イベント: ${ev.name}` });
}

/** Whether choice i can be taken now: { ok, reason } */
export function eventChoiceStatus(G, i) {
  const ev = G.run.event && G.db.eventMap.get(G.run.event.id);
  const ch = ev?.choices?.[i];
  if (!ch) return { ok: false, reason: '無効な選択肢' };
  const cost = (ch.effects || []).filter((e) => e.type === 'gold' && e.amount < 0).reduce((s, e) => s - e.amount, 0);
  if (cost > G.run.player.gold) return { ok: false, reason: `研究費が${cost}必要` };
  const needsDeck = (ch.effects || []).some((e) => e.type === 'removeCard' && !e.cardId);
  if (needsDeck && !G.run.deck.length) return { ok: false, reason: 'デッキが空' };
  return { ok: true };
}

export function chooseEventOption(G, i) {
  const run = G.run;
  if (run.screen !== 'event' || !run.event) return 'イベント画面ではない';
  if (run.event.phase !== 'choose') return '選択済み';
  if (run.pending || run.queue.length) return '処理中';
  const st = eventChoiceStatus(G, i);
  if (!st.ok) return st.reason;
  const ev = G.db.eventMap.get(run.event.id);
  const ch = ev.choices[i];
  run.event.phase = 'resolving';
  run.event.choiceIndex = i;
  const effects = [...(ch.effects || [])];
  if (ch.quiz) effects.push({ type: 'quiz', ...ch.quiz, onCorrect: ch.onCorrect || [], onWrong: ch.onWrong || [] });
  effects.push({ type: '_eventDone', index: i });
  pushFrame(G, effects, { side: 'player', source: 'event', sourceId: ev.id, actor: 'player', combat: false, depth: 0 });
  runQueue(G);
  return null;
}

export function eventDone(G, index) {
  const run = G.run;
  if (!run.event) return;
  const ev = G.db.eventMap.get(run.event.id);
  run.event.phase = 'result';
  run.event.resultText = ev?.choices?.[index]?.result || '';
}

export function leaveEvent(G) {
  const run = G.run;
  if (run.screen !== 'event') return 'イベント画面ではない';
  if (run.event && run.event.phase === 'resolving' && (run.pending || run.queue.length)) return '処理中';
  if (run.event && run.event.phase === 'choose') {
    const ev = G.db.eventMap.get(run.event.id);
    const any = (ev?.choices || []).some((_, i) => eventChoiceStatus(G, i).ok);
    if (any) return '選択肢を選んでください';
  }
  if (run.pending || run.queue.length) return '処理中';
  returnToMap(G);
  return null;
}

// ---------------------------------------------------------------------------
// Rest site (自習室)
// ---------------------------------------------------------------------------

export function enterRest(G) {
  G.run.rest = { used: false, choice: null, reviewResults: [] };
  G.run.screen = 'rest';
}

export function restOptions(G) {
  const ups = G.run.deck.some((d) => isUpgradable(G.db, d));
  return [
    { id: 'rest', label: '休憩', desc: `HPを${Math.floor(G.run.player.maxHp * REST.healRatio)}回復`, ok: true },
    { id: 'upgrade', label: '強化', desc: 'カード1枚をアップグレード', ok: ups },
    { id: 'review', label: '復習', desc: `誤答ノート/弱点分野から${REST.reviewCount}問。正解1問ごとにHP${REST.reviewHeal}回復＋「思い込み」1枚除去`, ok: true },
  ];
}

export function chooseRestOption(G, option) {
  const run = G.run;
  if (run.screen !== 'rest' || !run.rest) return '自習室ではない';
  if (run.rest.used) return '既に行動済み';
  if (run.pending || run.queue.length) return '処理中';
  const opt = restOptions(G).find((o) => o.id === option);
  if (!opt || !opt.ok) return '選べない';
  if (option === 'rest') {
    heal(G, 'player', Math.floor(run.player.maxHp * REST.healRatio));
    run.rest.used = true; run.rest.choice = 'rest';
    fireTrigger(G, 'onRest', { option });
  } else if (option === 'upgrade') {
    const ups = run.deck.filter((d) => isUpgradable(G.db, d));
    run.pending = {
      kind: 'selectCards', purpose: 'restUpgrade', from: 'deck', options: ups.map((d) => d.uid),
      count: 1, min: 1, canCancel: true, ctx: null, title: '強化するカードを1枚選ぶ',
    };
  } else if (option === 'review') {
    run.rest.used = true; run.rest.choice = 'review';
    const q = {
      type: 'quiz', pool: 'review',
      onCorrect: [{ type: 'heal', amount: REST.reviewHeal }, { type: 'removeCard', cardId: 'misconception' }],
      onWrong: [],
    };
    const effects = [];
    for (let i = 0; i < REST.reviewCount; i++) effects.push(q);
    effects.push({ type: '_trigger', trigger: 'onRest', info: { option } });
    pushFrame(G, effects, { side: 'player', source: 'rest', actor: 'player', combat: false, depth: 0 });
  }
  runQueue(G);
  return null;
}

export function leaveRest(G) {
  const run = G.run;
  if (run.screen !== 'rest') return '自習室ではない';
  if (run.pending || run.queue.length) return '処理中';
  returnToMap(G);
  return null;
}

// ---------------------------------------------------------------------------
// Shop (購買部)
// ---------------------------------------------------------------------------

function jitter(G, price) {
  return Math.round(price * (0.9 + 0.2 * (randInt(G.run, 0, 100) / 100)));
}

export function removalPrice(G) {
  return SHOP.removalBase + SHOP.removalStep * G.run.removalsBought;
}

export function enterShop(G) {
  const run = G.run;
  const cardIds = [];
  for (let i = 0; i < SHOP.cards; i++) {
    const pool = rewardCards(G).filter((c) => !cardIds.includes(c.id));
    if (!pool.length) break;
    const w = REWARD.cardRarity.battle;
    const rs = Object.keys(w).filter((r) => pool.some((c) => c.rarity === r));
    const r = weightedPick(run, rs, (x) => w[x]);
    const c = weightedPick(run, r ? pool.filter((x) => x.rarity === r) : pool, (x) => fieldWeight(G, x));
    if (c) cardIds.push(c.id);
  }
  const relicPool = G.db.relicList.filter((r) => ['common', 'uncommon', 'rare', 'shop'].includes(r.rarity) && !ownedRelic(G, r.id));
  const relics = sample(run, relicPool, SHOP.relics);
  const potions = [];
  for (let i = 0; i < SHOP.potions; i++) { const id = randomPotionId(G); if (id) potions.push(id); }
  run.shop = {
    cards: cardIds.map((id) => ({ cardId: id, price: jitter(G, SHOP.cardPrice[G.db.cards.get(id).rarity] || 75), sold: false })),
    relics: relics.map((r) => ({ relicId: r.id, price: jitter(G, SHOP.relicPrice[r.rarity] || 200), sold: false })),
    potions: potions.map((id) => ({ potionId: id, price: jitter(G, SHOP.potionPrice[G.db.potions.get(id).rarity] || 60), sold: false })),
    removalUsed: false,
  };
  run.screen = 'shop';
  fireTrigger(G, 'onShopEnter', {});
  runQueue(G);
}

function shopBuy(G, list, i, give) {
  const run = G.run;
  if (run.screen !== 'shop' || !run.shop) return '購買部ではない';
  if (run.pending || run.queue.length) return '処理中';
  const item = run.shop[list][i];
  if (!item || item.sold) return '購入できない';
  if (run.player.gold < item.price) return '研究費が足りない';
  const err = give(item);
  if (err) return err;
  run.player.gold -= item.price;
  item.sold = true;
  runQueue(G);
  return null;
}

export function buyCard(G, i) {
  return shopBuy(G, 'cards', i, (it) => { addCardToDeck(G, it.cardId); return null; });
}
export function buyRelic(G, i) {
  return shopBuy(G, 'relics', i, (it) => (addRelic(G, it.relicId) ? null : '既に所持'));
}
export function buyPotion(G, i) {
  return shopBuy(G, 'potions', i, (it) => (G.run.potions.includes(null) ? (addPotion(G, it.potionId), null) : '試薬瓶スロットがいっぱい'));
}
export function buyRemoval(G) {
  const run = G.run;
  if (run.screen !== 'shop' || !run.shop) return '購買部ではない';
  if (run.shop.removalUsed) return '除去サービスは利用済み';
  if (run.pending || run.queue.length) return '処理中';
  if (run.player.gold < removalPrice(G)) return '研究費が足りない';
  if (!run.deck.length) return 'デッキが空';
  run.pending = {
    kind: 'selectCards', purpose: 'shopRemove', from: 'deck', options: run.deck.map((d) => d.uid),
    count: 1, min: 1, canCancel: true, ctx: null, title: `除去するカードを選ぶ（${removalPrice(G)}）`,
  };
  return null;
}

export function leaveShop(G) {
  const run = G.run;
  if (run.screen !== 'shop') return '購買部ではない';
  if (run.pending || run.queue.length) return '処理中';
  returnToMap(G);
  return null;
}

// ---------------------------------------------------------------------------
// Treasure (実験器具庫)
// ---------------------------------------------------------------------------

export function enterTreasure(G) {
  const run = G.run;
  const [a, b] = REWARD.treasureGold;
  run.treasure = { relicId: randomRelicId(G), gold: randInt(run, a, b), opened: false };
  run.screen = 'treasure';
}

export function openTreasure(G) {
  const run = G.run;
  if (run.screen !== 'treasure' || !run.treasure) return '器具庫ではない';
  if (run.treasure.opened) return '開封済み';
  run.treasure.opened = true;
  if (run.treasure.relicId) addRelic(G, run.treasure.relicId);
  gainGold(G, run.treasure.gold);
  runQueue(G);
  return null;
}

export function leaveTreasure(G) {
  const run = G.run;
  if (run.screen !== 'treasure') return '器具庫ではない';
  if (run.pending || run.queue.length) return '処理中';
  returnToMap(G);
  return null;
}

// ---------------------------------------------------------------------------
// Potions
// ---------------------------------------------------------------------------

export function canUsePotion(G, slot, targetUid) {
  const run = G.run;
  const id = run.potions[slot];
  if (!id) return { ok: false, reason: '空のスロット' };
  const def = G.db.potions.get(id);
  if (!def) return { ok: false, reason: '不明な試薬瓶' };
  if (run.pending || run.queue.length) return { ok: false, reason: '処理中' };
  const inCombat = isCombatActive(G) && run.combat.phase === 'player';
  if (!inCombat) {
    if (isCombatActive(G)) return { ok: false, reason: '今は使えない' };
    if ((def.effects || []).some((e) => COMBAT_ONLY_EFFECTS.includes(e.type) || e.type === 'quiz')) return { ok: false, reason: '戦闘中のみ使用可能' };
    if (run.screen === 'victory' || run.screen === 'gameOver') return { ok: false, reason: 'ランは終了した' };
    return { ok: true };
  }
  if (def.target === 'enemy') {
    const living = livingEnemies(G);
    if (targetUid != null) {
      if (!living.some((e) => e.uid === targetUid)) return { ok: false, reason: '無効な対象', needsTarget: true };
    } else if (living.length > 1) return { ok: false, reason: '対象を選んでください', needsTarget: true };
  }
  return { ok: true };
}

export function usePotion(G, slot, targetUid) {
  const chk = canUsePotion(G, slot, targetUid);
  if (!chk.ok) return chk.reason;
  const run = G.run;
  const id = run.potions[slot];
  const def = G.db.potions.get(id);
  run.potions[slot] = null;
  const inCombat = isCombatActive(G);
  let target = null;
  if (inCombat && def.target === 'enemy') target = targetUid ?? livingEnemies(G)[0]?.uid ?? null;
  emit(G, { type: 'potionUsed', potionId: id, target, msg: `試薬瓶「${def.name}」を使用` });
  pushFrame(G, def.effects || [], {
    side: 'player', source: 'potion', sourceId: id, actor: 'player', target, cardTarget: def.target || 'self', combat: inCombat, depth: 0,
  });
  runQueue(G);
  return null;
}

export function discardPotion(G, slot) {
  if (!G.run.potions[slot]) return '空のスロット';
  if (G.run.pending) return '処理中';
  G.run.potions[slot] = null;
  return null;
}

// ---------------------------------------------------------------------------
// Run end
// ---------------------------------------------------------------------------

export function finishRun(G, won) {
  const run = G.run;
  if (run.result) return;
  run.screen = won ? 'victory' : 'gameOver';
  run.result = { won, act: run.act, floor: run.floor, difficulty: run.difficulty, endedAt: G.now() };
  const m = G.meta.runs;
  m.played++;
  if (won) m.won++;
  m.bestFloor = Math.max(m.bestFloor || 0, run.floor);
  m.bestAct = Math.max(m.bestAct || 0, run.act);
  m.history.push({ won, act: run.act, floor: run.floor, difficulty: run.difficulty, at: G.now(), seed: run.seed });
  if (m.history.length > 50) m.history.shift();
}

/** Result-screen summary (per-field accuracy, reactions achieved, wrong questions). */
export function runSummary(G) {
  const run = G.run;
  if (!run) return null;
  const byField = {};
  for (const l of run.quizLog) {
    const f = (byField[l.field] ||= { asked: 0, correct: 0 });
    f.asked++; if (l.correct) f.correct++;
  }
  const wrong = [...new Set(run.quizLog.filter((l) => !l.correct).map((l) => l.id))].map((id) => G.db.questions.get(id)).filter(Boolean);
  return {
    won: run.result?.won ?? null,
    act: run.act, floor: run.floor, difficulty: run.difficulty,
    byField,
    correct: run.stats.correct, wrong: run.stats.wrong,
    reactions: Object.values(run.stats.reactions || {}),
    wrongQuestions: wrong,
    deck: run.deck.map((d) => d.id),
    relics: run.relics.map((r) => r.id),
  };
}
