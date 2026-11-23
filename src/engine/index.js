// Slay the Chemyth — engine facade.
//
//   import { createGame } from './engine/index.js';
//   import { DATA } from './data/index.js';
//   const game = createGame({ data: DATA });            // browser: localStorage
//   game.newRun({ seed: 'abc', difficulty: 'hyojun' });
//   game.run   -> plain JSON run state (re-render from it)
//   game.meta  -> plain JSON meta state (notebook, stats, settings, 図鑑)
//   const res = game.playCard(uid, enemyUid);          // { ok, error, events }
//
// Every action returns { ok, error, events } where `events` is the list of
// engine events produced by that action (for animation). State is never
// returned by copy: read game.run / game.meta after each action.
// See docs/ENGINE_API.md for the full contract.

import { buildDb, cardDef as dbCardDef, hasKeyword, isUpgradable } from './data.js';
import { createBrowserStorage, loadMeta, loadRun, saveMeta, saveRun, clearRun } from './storage.js';
import { createMeta, notebookList, reactionList, weaknessReport } from './meta.js';
import { bedtimeWarning, isBedtime, BEDTIME_MESSAGE } from './bedtime.js';
import { parseNumericAnswer, judgeNumeric, judgePending, correctAnswerText } from './quiz.js';
import { recordAnswer, recordReaction } from './meta.js';
import {
  activePhRules, canPlayCard, displayTags, effectiveCost, endTurn, instDef, intentPreview, isCombatActive,
  livingEnemies, playCard,
} from './combat.js';
import { runQueue } from './effects.js';
import * as R from './run.js';
import { recordError } from './effects.js';
import * as C from './constants.js';

export { C as constants };
export { parseNumericAnswer, judgeNumeric, isBedtime, bedtimeWarning, BEDTIME_MESSAGE };
export { createMemoryStorage, createBrowserStorage } from './storage.js';
export { buildDb } from './data.js';
export { generateMap } from './map.js';
export { createRng } from './rng.js';

const ACTIONS = {
  // run lifecycle
  newRun: (G, opts = {}) => {
    R.createRun(G, {
      seed: opts.seed ?? String(G.now()),
      difficulty: opts.difficulty ?? G.meta.settings.difficulty,
    });
    return null;
  },
  // map
  chooseNode: (G, id) => R.chooseNode(G, id),
  // combat
  playCard: (G, uid, target) => { const e = playCard(G, uid, target); if (!e) runQueue(G); return e; },
  endTurn: (G) => { const e = endTurn(G); if (!e) runQueue(G); return e; },
  usePotion: (G, slot, target) => R.usePotion(G, slot, target),
  discardPotion: (G, slot) => R.discardPotion(G, slot),
  // pending
  answerQuiz: (G, answer, opts) => R.answerQuiz(G, answer, opts),
  continueQuiz: (G) => R.continueQuiz(G),
  selectCards: (G, uids) => R.selectCards(G, uids),
  cancelSelection: (G) => R.cancelSelection(G),
  // reward
  pickRewardCard: (G, i) => R.pickRewardCard(G, i),
  skipRewardCard: (G) => R.skipRewardCard(G),
  takeRewardPotion: (G) => R.takeRewardPotion(G),
  takeRewardRelic: (G, i) => R.takeRewardRelic(G, i),
  leaveReward: (G) => R.leaveReward(G),
  // event
  chooseEventOption: (G, i) => R.chooseEventOption(G, i),
  leaveEvent: (G) => R.leaveEvent(G),
  // rest
  chooseRestOption: (G, id) => R.chooseRestOption(G, id),
  leaveRest: (G) => R.leaveRest(G),
  // shop
  buyCard: (G, i) => R.buyCard(G, i),
  buyRelic: (G, i) => R.buyRelic(G, i),
  buyPotion: (G, i) => R.buyPotion(G, i),
  buyRemoval: (G) => R.buyRemoval(G),
  leaveShop: (G) => R.leaveShop(G),
  // treasure
  openTreasure: (G) => R.openTreasure(G),
  leaveTreasure: (G) => R.leaveTreasure(G),
};

/** Argument order used by dispatch({type, ...}) */
const DISPATCH_ARGS = {
  newRun: (a) => [{ seed: a.seed, difficulty: a.difficulty }],
  chooseNode: (a) => [a.nodeId ?? a.id],
  playCard: (a) => [a.uid, a.target],
  usePotion: (a) => [a.slot, a.target],
  discardPotion: (a) => [a.slot],
  answerQuiz: (a) => [a.answer],
  selectCards: (a) => [a.uids],
  pickRewardCard: (a) => [a.index],
  takeRewardRelic: (a) => [a.index ?? 0],
  chooseEventOption: (a) => [a.index],
  chooseRestOption: (a) => [a.option],
  buyCard: (a) => [a.index],
  buyRelic: (a) => [a.index],
  buyPotion: (a) => [a.index],
};

/**
 * Create a game instance.
 * @param {object} opts
 * @param {object} opts.data     data bundle { TAGS, CARDS, STARTER_DECK, RELICS, STARTER_RELIC, POTIONS, ENEMIES, ENCOUNTERS, EVENTS, QUESTIONS, QUIZ_SETS }
 * @param {object|null} [opts.storage]  {getItem,setItem,removeItem}; default localStorage (memory fallback); null = no persistence
 * @param {() => number} [opts.now]      clock (ms) used for timestamps / default seeds
 * @param {boolean} [opts.autosave=true]
 */
export function createGame({ data = {}, storage, now, autosave = true } = {}) {
  const db = buildDb(data);
  const store = storage === undefined ? createBrowserStorage() : storage;
  const G = { db, run: null, meta: store ? loadMeta(store) : createMeta(), now: now || (() => Date.now()), events: [] };

  function after() {
    const c = G.run?.combat;
    if (c) for (const e of c.enemies) if (e.alive && e.intent) e.intent.preview = intentPreview(G, e);
    if (autosave && store) {
      if (!G.mirror) {
        if (G.run && !G.run.result) saveRun(store, G.run);
        else if (G.run && G.run.result) clearRun(store);
      }
      saveMeta(store, G.meta);
    }
  }

  function perform(name, args) {
    G.events = [];
    const fn = ACTIONS[name];
    if (!fn) return { ok: false, error: `unknown action ${name}`, events: [] };
    if (name !== 'newRun' && !G.run) return { ok: false, error: 'ランが開始されていない', events: [] };
    let error = null;
    try {
      error = fn(G, ...args) || null;
      if (G.run && !G.run.pending && G.run.queue.length) runQueue(G);
    } catch (err) {
      error = '[engine] ' + (err && err.message);
      if (G.run) recordError(G, err);
    }
    try { after(); } catch (err) { if (G.run) recordError(G, err); }
    return { ok: !error, error, events: G.events };
  }

  const game = {
    /** current run state (plain JSON) or null */
    get run() { return G.run; },
    /** meta state (plain JSON) */
    get meta() { return G.meta; },
    /** read-only lookup db built from data */
    db,
    data,

    // ---- run lifecycle ----
    newRun: (opts) => perform('newRun', [opts]),
    hasSavedRun: () => !!(store && loadRun(store, db)),
    continueRun() {
      G.events = [];
      const run = store ? loadRun(store, db) : null;
      if (!run) return { ok: false, error: '中断データがない', events: [] };
      G.run = run;
      try { runQueue(G); after(); } catch (err) { recordError(G, err); }
      return { ok: true, error: null, events: G.events };
    },
    /** Give up the current run (counts as a loss) and delete the save. */
    abandonRun() {
      G.events = [];
      if (G.run && !G.run.result) R.finishRun(G, false);
      G.run = null;
      if (store) { clearRun(store); saveMeta(store, G.meta); }
      return { ok: true, error: null, events: G.events };
    },
    /** Drop the in-memory run without touching stats (e.g. after the result screen). */
    closeRun() { const m = G.mirror; G.run = null; G.mirror = false; if (store && !m) clearRun(store); },

    // ---- co-op support (see src/net/coop.js) ----
    /** true while this instance only mirrors a host's run (never saved locally). */
    get isMirror() { return !!G.mirror; },
    /** Guest: replace the run with the host's authoritative state (or null to leave). Does not touch the local save. */
    setMirror(run) { G.run = run || null; G.mirror = !!run; },
    /** Judge an answer against the pending quiz without consuming it. */
    judgeAnswer(answer) {
      const p = G.run?.pending;
      const q = p && p.kind === 'quiz' ? db.questions.get(p.questionId) : null;
      if (!q) return null;
      const j = judgePending(q, p, answer);
      return { correct: j.correct, parsed: j.parsed, correctDisplay: j.correctDisplay, correctAnswerText: correctAnswerText(q) };
    },
    /** Record a personal quiz result in this player's own notebook/stats (guest side). */
    recordQuizAnswer(questionId, correct) {
      const q = db.questions.get(questionId);
      if (!q) return null;
      const nb = recordAnswer(G.meta, q, !!correct, G.now());
      if (store) saveMeta(store, G.meta);
      return nb;
    },
    /** Record a reaction event in this player's own 反応ノート (guest side). */
    recordReactionEvent(ev) {
      if (!ev || !ev.cardId) return;
      recordReaction(G.meta, ev.cardId, ev.index ?? 0, { equation: ev.equation, explain: ev.explain }, G.now());
      if (store) saveMeta(store, G.meta);
    },

    // ---- actions ----
    chooseNode: (id) => perform('chooseNode', [id]),
    playCard: (uid, target) => perform('playCard', [uid, target]),
    endTurn: () => perform('endTurn', []),
    usePotion: (slot, target) => perform('usePotion', [slot, target]),
    discardPotion: (slot) => perform('discardPotion', [slot]),
    answerQuiz: (answer, opts) => perform('answerQuiz', [answer, opts]),
    continueQuiz: () => perform('continueQuiz', []),
    selectCards: (uids) => perform('selectCards', [uids]),
    cancelSelection: () => perform('cancelSelection', []),
    pickRewardCard: (i) => perform('pickRewardCard', [i]),
    skipRewardCard: () => perform('skipRewardCard', []),
    takeRewardPotion: () => perform('takeRewardPotion', []),
    takeRewardRelic: (i = 0) => perform('takeRewardRelic', [i]),
    leaveReward: () => perform('leaveReward', []),
    chooseEventOption: (i) => perform('chooseEventOption', [i]),
    leaveEvent: () => perform('leaveEvent', []),
    chooseRestOption: (id) => perform('chooseRestOption', [id]),
    leaveRest: () => perform('leaveRest', []),
    buyCard: (i) => perform('buyCard', [i]),
    buyRelic: (i) => perform('buyRelic', [i]),
    buyPotion: (i) => perform('buyPotion', [i]),
    buyRemoval: () => perform('buyRemoval', []),
    leaveShop: () => perform('leaveShop', []),
    openTreasure: () => perform('openTreasure', []),
    leaveTreasure: () => perform('leaveTreasure', []),

    /** Generic entry point: dispatch({type:'playCard', uid, target}) etc. */
    dispatch(action) {
      if (!action || !ACTIONS[action.type]) return { ok: false, error: 'unknown action', events: [] };
      const args = DISPATCH_ARGS[action.type] ? DISPATCH_ARGS[action.type](action) : [];
      return perform(action.type, args);
    },

    /** All currently legal actions (for bots / UI enabling). */
    legalActions: () => legalActions(G),

    // ---- queries (pure) ----
    availableNodes: () => (G.run ? R.availableNodes(G) : []),
    canPlayCard: (uid, target) => (G.run ? canPlayCard(G, uid, target) : { ok: false, reason: 'no run' }),
    canUsePotion: (slot, target) => (G.run ? R.canUsePotion(G, slot, target) : { ok: false, reason: 'no run' }),
    eventChoiceStatus: (i) => (G.run ? R.eventChoiceStatus(G, i) : { ok: false }),
    restOptions: () => (G.run ? R.restOptions(G) : []),
    removalPrice: () => (G.run ? R.removalPrice(G) : 0),
    /** card definition with upgrade merged */
    cardDef: (id, upgraded = false) => dbCardDef(db, id, upgraded),
    /** combat/deck card instance -> def + live cost/playability */
    cardView(inst) {
      const def = dbCardDef(db, inst.id, inst.upgraded);
      if (!def) return null;
      const inCombat = G.run && isCombatActive(G) && G.run.combat.hand.some((h) => h.uid === inst.uid);
      return {
        ...def,
        uid: inst.uid,
        upgraded: !!inst.upgraded,
        baseCost: def.cost,
        cost: inCombat ? effectiveCost(G, inst) : def.cost,
        playable: inCombat ? canPlayCard(G, inst.uid, livingEnemies(G)[0]?.uid).ok : false,
        upgradable: isUpgradable(db, inst),
        keywords: def.keywords || [],
        isUnplayable: def.cost === null || hasKeyword(def, 'unplayable'),
      };
    },
    /** enemy tags for UI: [{tag, hidden, wasHidden?}] (tag null when still hidden) */
    displayTags: (enemy) => displayTags(enemy),
    activePhRules: (enemy) => (G.run?.combat ? activePhRules(G, enemy) : []),
    intentPreview: (enemy) => (G.run?.combat ? intentPreview(G, enemy) : null),
    runSummary: () => R.runSummary(G),
    weaknessReport: () => weaknessReport(G.meta),
    notebookList: () => notebookList(G.meta, db),
    reactionList: () => reactionList(G.meta),
    bedtimeWarning: (date = new Date(G.now())) => bedtimeWarning(date, G.meta.settings),
    setSetting(key, value) {
      G.meta.settings[key] = value;
      if (store) saveMeta(store, G.meta);
    },
    /** wipe meta (notebook/stats). */
    resetMeta() { G.meta = createMeta(); if (store) saveMeta(store, G.meta); },
    _G: G, // internal access for tests/tools
  };
  return game;
}

/** Enumerate legal actions as dispatchable objects. */
export function legalActions(G) {
  const run = G.run;
  if (!run) return [{ type: 'newRun' }];
  const out = [];
  const p = run.pending;
  if (p) {
    if (p.kind === 'quiz') {
      if (p.type === 'choice' && p.choices) p.choices.forEach((_, i) => out.push({ type: 'answerQuiz', answer: i }));
      else out.push({ type: 'answerQuiz', answer: null, numeric: true });
    } else if (p.kind === 'quizResult') out.push({ type: 'continueQuiz' });
    else if (p.kind === 'selectCards') {
      const n = Math.min(p.min ?? p.count, p.options.length);
      out.push({ type: 'selectCards', uids: p.options.slice(0, n) });
      if (p.canCancel) out.push({ type: 'cancelSelection' });
    }
    return out;
  }
  switch (run.screen) {
    case 'map':
      for (const id of R.availableNodes(G)) out.push({ type: 'chooseNode', nodeId: id });
      break;
    case 'combat': {
      if (!isCombatActive(G) || run.combat.phase !== 'player') break;
      const living = livingEnemies(G);
      for (const inst of run.combat.hand) {
        const def = instDef(G, inst);
        if (def?.target === 'enemy') {
          for (const e of living) if (canPlayCard(G, inst.uid, e.uid).ok) out.push({ type: 'playCard', uid: inst.uid, target: e.uid });
        } else if (canPlayCard(G, inst.uid).ok) out.push({ type: 'playCard', uid: inst.uid });
      }
      run.potions.forEach((pid, slot) => {
        if (!pid) return;
        const def = G.db.potions.get(pid);
        if (def?.target === 'enemy') {
          for (const e of living) if (R.canUsePotion(G, slot, e.uid).ok) out.push({ type: 'usePotion', slot, target: e.uid });
        } else if (R.canUsePotion(G, slot).ok) out.push({ type: 'usePotion', slot });
      });
      out.push({ type: 'endTurn' });
      break;
    }
    case 'reward': {
      const r = run.reward;
      if (!r.cardTaken) {
        r.cards.forEach((_, i) => out.push({ type: 'pickRewardCard', index: i }));
        out.push({ type: 'skipRewardCard' });
      }
      if (r.potion && !r.potionTaken && run.potions.includes(null)) out.push({ type: 'takeRewardPotion' });
      if (!r.relicTaken) {
        if (r.relicChoices.length) r.relicChoices.forEach((_, i) => out.push({ type: 'takeRewardRelic', index: i }));
        else if (r.relic) out.push({ type: 'takeRewardRelic', index: 0 });
      }
      out.push({ type: 'leaveReward' });
      break;
    }
    case 'event':
      if (run.event?.phase === 'choose') {
        const ev = G.db.eventMap.get(run.event.id);
        (ev?.choices || []).forEach((_, i) => { if (R.eventChoiceStatus(G, i).ok) out.push({ type: 'chooseEventOption', index: i }); });
        if (!out.length) out.push({ type: 'leaveEvent' }); // safety: should not happen
      } else out.push({ type: 'leaveEvent' });
      break;
    case 'rest':
      if (!run.rest.used) for (const o of R.restOptions(G)) if (o.ok) out.push({ type: 'chooseRestOption', option: o.id });
      out.push({ type: 'leaveRest' });
      break;
    case 'shop': {
      const s = run.shop;
      const g = run.player.gold;
      s.cards.forEach((it, i) => { if (!it.sold && it.price <= g) out.push({ type: 'buyCard', index: i }); });
      s.relics.forEach((it, i) => { if (!it.sold && it.price <= g) out.push({ type: 'buyRelic', index: i }); });
      if (run.potions.includes(null)) s.potions.forEach((it, i) => { if (!it.sold && it.price <= g) out.push({ type: 'buyPotion', index: i }); });
      if (!s.removalUsed && g >= R.removalPrice(G) && run.deck.length) out.push({ type: 'buyRemoval' });
      out.push({ type: 'leaveShop' });
      break;
    }
    case 'treasure':
      if (!run.treasure.opened) out.push({ type: 'openTreasure' });
      out.push({ type: 'leaveTreasure' });
      break;
    default:
      break;
  }
  return out;
}
