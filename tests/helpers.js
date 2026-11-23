// Shared test helpers (not a test file itself).
import { createGame } from '../src/engine/index.js';
import { startCombat } from '../src/engine/combat.js';
import { runQueue } from '../src/engine/effects.js';
import { DATA } from './fixtures/data.js';

export { DATA };

export function newGame(opts = {}) {
  const g = createGame({ data: opts.data || DATA, storage: opts.storage ?? null, now: () => 1000 });
  g.newRun({ seed: opts.seed || 'test-seed', difficulty: opts.difficulty || 'hyojun' });
  return g;
}

/**
 * Start a combat directly with the given enemies, and set the hand to `hand`
 * (card ids). Draw/discard piles emptied unless `draw` given.
 */
export function combatGame(enemies, hand = [], opts = {}) {
  const g = newGame(opts);
  const G = g._G;
  if (opts.relics) G.run.relics = opts.relics.map((id) => ({ id, counters: {} }));
  startCombat(G, { enemies, kind: opts.kind || 'battle' });
  runQueue(G);
  const c = G.run.combat;
  c.hand = hand.map((id, i) => ({ uid: 'h' + i, id, upgraded: false }));
  c.draw = (opts.draw || []).map((id, i) => ({ uid: 'd' + i, id, upgraded: false }));
  c.discard = [];
  c.player.energy = opts.energy ?? 3;
  return { g, G, c };
}

export function enemy(G, i = 0) {
  return G.run.combat.enemies[i];
}

/** Answer any pending quiz correctly (or wrongly) and continue. */
export function solvePending(g, correct = true) {
  const p = g.run.pending;
  if (!p || p.kind !== 'quiz') throw new Error('no pending quiz');
  const q = g.db.questions.get(p.questionId);
  let ans;
  if (q.type === 'choice') {
    const right = p.choiceOrder.indexOf(q.answer);
    ans = correct ? right : (right + 1) % 4;
  } else ans = correct ? String(q.answer) : String(Number(q.answer) * 3 + 17);
  const r1 = g.answerQuiz(ans);
  if (!r1.ok) throw new Error(r1.error);
  const r2 = g.continueQuiz();
  if (!r2.ok) throw new Error(r2.error);
  return q;
}
