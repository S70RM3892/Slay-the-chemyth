import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combatGame, enemy, newGame, solvePending, DATA } from './helpers.js';
import { parseNumericAnswer, judgeNumeric, judgePending, makeQuizPending, selectQuestion } from '../src/engine/quiz.js';
import { createMeta, recordAnswer } from '../src/engine/meta.js';
import { createGame } from '../src/engine/index.js';

test('parseNumericAnswer accepts common formats', () => {
  const cases = [
    ['1.2', 1.2], ['1.2e-5', 1.2e-5], ['1.2E-5', 1.2e-5], ['1.2×10^-5', 1.2e-5], ['1.2*10^-5', 1.2e-5],
    ['1.2x10^-5', 1.2e-5], ['1.2×10^{-5}', 1.2e-5], ['1.2×10^(-5)', 1.2e-5], ['１．２×１０^－５', 1.2e-5],
    ['1.2×10⁻⁵', 1.2e-5], ['10^-3', 1e-3], ['-3.5', -3.5], ['  42 ', 42], ['0.10 mol/L', 0.1], ['1,000', 1000],
    ['６.０２×１０＾２３', 6.02e23], ['.5', 0.5], ['2.0 × 10^3', 2000],
  ];
  for (const [s, v] of cases) {
    const got = parseNumericAnswer(s);
    assert.ok(Math.abs(got - v) <= Math.abs(v) * 1e-12, `${s} -> ${got}, expected ${v}`);
  }
  for (const bad of ['', 'abc', '1.2.3', '1.210^-5', '1.2×10', 'e5']) {
    assert.ok(Number.isNaN(parseNumericAnswer(bad)), `${bad} should be NaN`);
  }
});

test('judgeNumeric: relative tolerance (default 3%) and absTolerance', () => {
  const q = { type: 'numeric', answer: 1.2e-5 };
  assert.equal(judgeNumeric(q, '1.23e-5'), true);
  assert.equal(judgeNumeric(q, '1.25e-5'), false);
  assert.equal(judgeNumeric({ answer: 4.75, tolerance: 0.01 }, 4.79), true);
  assert.equal(judgeNumeric({ answer: 4.75, tolerance: 0.01 }, 4.81), false);
  assert.equal(judgeNumeric({ answer: 0, absTolerance: 0.01 }, '0.005'), true);
  assert.equal(judgeNumeric({ answer: 0, absTolerance: 0.01 }, '0.02'), false);
  assert.equal(judgeNumeric(q, 'garbage'), false);
});

test('choice shuffling: displayed index maps back to original answer', () => {
  const g = newGame();
  const q = DATA.QUESTIONS.find((x) => x.id === 'th1-003');
  for (let i = 0; i < 10; i++) {
    const p = makeQuizPending(g._G, q, {});
    assert.equal(p.choices.length, 4);
    assert.deepEqual([...p.choiceOrder].sort(), [0, 1, 2, 3]);
    const right = p.choiceOrder.indexOf(q.answer);
    assert.equal(p.choices[right], q.choices[q.answer]);
    assert.equal(judgePending(q, p, right).correct, true);
    assert.equal(judgePending(q, p, (right + 1) % 4).correct, false);
  }
});

test('notebook: wrong adds, 2 consecutive correct graduates, wrong resets streak', () => {
  const meta = createMeta();
  const q = { id: 'x1', field: 'theory1', topic: 't' };
  recordAnswer(meta, q, false);
  assert.ok(meta.notebook.x1);
  recordAnswer(meta, q, true);
  assert.equal(meta.notebook.x1.streak, 1);
  recordAnswer(meta, q, false);
  assert.equal(meta.notebook.x1.streak, 0);
  recordAnswer(meta, q, true);
  const r = recordAnswer(meta, q, true);
  assert.equal(r.graduated, true);
  assert.equal(meta.notebook.x1, undefined);
  assert.ok(meta.graduated.x1 !== undefined);
  assert.deepEqual(meta.stats.fields.theory1, { asked: 5, correct: 3 });
  assert.deepEqual(meta.stats.topics['theory1/t'].asked, 5);
});

test('quiz card flow: correct -> onCorrect; wrong -> onWrong + misconception + notebook', () => {
  const { g, G } = combatGame(['dummy'], ['study', 'study'], { energy: 3 });
  g.playCard('h0');
  const p = G.run.pending;
  assert.equal(p.kind, 'quiz');
  assert.ok(['theory1'].includes(p.field), 'act 1 field');
  solvePending(g, true);
  assert.equal(G.run.combat.player.energy, 3 - 1 + 2);
  assert.ok(G.run.combat.exhaust.some((x) => x.uid === 'h0'));
  assert.equal(G.run.combat.correctThisCombat, 1);

  const deckBefore = G.run.deck.length;
  const hp = G.run.player.hp;
  g.playCard('h1');
  const q = G.run.pending;
  const wrongAns = q.type === 'choice' ? (q.choiceOrder.indexOf(g.db.questions.get(q.questionId).answer) + 1) % 4 : '999999';
  g.answerQuiz(wrongAns);
  assert.equal(G.run.pending.kind, 'quizResult');
  assert.equal(G.run.pending.correct, false);
  assert.ok(G.run.pending.explain.length > 0);
  assert.equal(G.run.pending.misconceptionAdded, true);
  assert.equal(G.run.deck.length, deckBefore + 1);
  assert.ok(G.run.combat.draw.some((x) => x.id === 'misconception'));
  assert.ok(G.meta.notebook[q.questionId]);
  g.continueQuiz();
  assert.equal(G.run.player.hp, hp - 2);
  assert.equal(G.run.pending, null);
});

test('selection: avoids repeats within a run, prefers notebook entries, relaxes filters', () => {
  const g = newGame();
  const G = g._G;
  const seen = new Set();
  for (let i = 0; i < 4; i++) {
    const q = selectQuestion(G, { fields: ['theory1'] });
    assert.equal(q.field, 'theory1');
    assert.ok(!seen.has(q.id), 'no repeat while fresh ones exist');
    seen.add(q.id);
    G.run.askedQuestions.push(q.id);
  }
  // exhausted pool -> still returns something
  assert.ok(selectQuestion(G, { fields: ['theory1'] }));
  // unknown topic -> falls back to field
  assert.equal(selectQuestion(G, { fields: ['polymer'], topic: 'nonexistent' }).field, 'polymer');
  // notebook preference ~40%
  G.run.askedQuestions = [];
  G.meta.notebook['th1-004'] = { wrong: 1, streak: 0 };
  let hits = 0;
  for (let i = 0; i < 400; i++) if (selectQuestion(G, { fields: ['theory1'], level: 1 }).id === 'th1-004') hits++;
  assert.ok(hits > 100 && hits < 230, 'notebook hits ' + hits);
});

test('empty question bank: quiz resolves neutrally (no soft-lock)', () => {
  const data = { ...DATA, QUESTIONS: [], QUIZ_SETS: [] };
  const { g, G } = combatGame(['dummy'], ['study'], { data });
  const hp = G.run.player.hp;
  const r = g.playCard('h0');
  assert.ok(r.ok);
  assert.equal(G.run.pending, null);
  assert.equal(G.run.player.hp, hp);
  assert.equal(G.run.combat.player.energy, 2);
});

test('boss quizSet parts are asked in order, then falls back to the field', () => {
  const { g, G } = combatGame(['boss1'], [], { kind: 'boss' });
  const boss = enemy(G);
  boss.hp = 10000; boss.maxHp = 10000;
  const asked = [];
  for (let t = 0; t < 12 && asked.length < 6; t++) {
    G.run.player.hp = 80;
    g.endTurn();
    if (G.run.pending?.kind === 'quiz') {
      asked.push(G.run.pending.questionId);
      if (G.run.pending.setId) assert.equal(G.run.pending.lead, 'リード文');
      solvePending(g, true);
    }
  }
  assert.deepEqual(asked.slice(0, 4), ['set-th1-01-1', 'set-th1-01-2', 'set-th1-01-3', 'set-th1-01-4']);
  assert.ok(asked[4].startsWith('th1-'), 'fallback to theory1: ' + asked[4]);
});

test('enemy quiz pauses the enemy turn and resumes after the answer', () => {
  const { g, G } = combatGame(['examiner'], [], { kind: 'elite' });
  const e = enemy(G);
  assert.equal(e.intent.moveId, 'ask');
  g.endTurn();
  assert.equal(G.run.pending.kind, 'quiz');
  assert.equal(G.run.combat.phase, 'enemy');
  const hp = G.run.player.hp;
  solvePending(g, false);
  assert.equal(G.run.player.hp, hp - 10);
  assert.equal(G.run.combat.phase, 'player');
  assert.equal(G.run.combat.turn, 2);
});

test('event quiz choice and gold requirement', () => {
  const g = newGame();
  const G = g._G;
  G.run.screen = 'event';
  G.run.event = { id: 'ev_quiz', phase: 'choose', choiceIndex: null, resultText: null, quizCorrect: null };
  assert.equal(g.eventChoiceStatus(1).ok, false); // costs 500
  const gold = G.run.player.gold;
  g.chooseEventOption(0);
  assert.equal(G.run.pending.kind, 'quiz');
  assert.equal(G.run.pending.field, 'theory1');
  solvePending(g, true);
  assert.equal(G.run.player.gold, gold + 50);
  assert.equal(G.run.event.phase, 'result');
  assert.equal(G.run.event.quizCorrect, true);
  assert.ok(g.leaveEvent().ok);
  assert.equal(G.run.screen, 'map');
});

test('rest review: 3 questions, each correct heals 5 and removes a misconception', () => {
  const g = newGame();
  const G = g._G;
  G.run.deck.push({ uid: 'm1', id: 'misconception' }, { uid: 'm2', id: 'misconception' });
  G.run.player.hp = 50;
  G.run.screen = 'rest';
  G.run.rest = { used: false, choice: null, reviewResults: [] };
  G.meta.notebook['pol-001'] = { wrong: 1, streak: 0 };
  g.chooseRestOption('review');
  assert.equal(G.run.pending.questionId, 'pol-001', 'notebook first');
  solvePending(g, true);
  solvePending(g, true);
  solvePending(g, false);
  assert.equal(G.run.pending, null);
  assert.equal(G.run.player.hp, 60);
  // 2 removed by correct answers, +1 added by the wrong answer
  assert.equal(G.run.deck.filter((d) => d.id === 'misconception').length, 1);
  assert.deepEqual(G.run.rest.reviewResults, [true, true, false]);
});

test('createGame works without storage and with a throwing storage', () => {
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  const g = createGame({ data: DATA, storage: bad, now: () => 0 });
  const r = g.newRun({ seed: 1 });
  assert.ok(r.ok);
  assert.equal(g.hasSavedRun(), false);
});
