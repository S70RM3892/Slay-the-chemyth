import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createMemoryStorage } from '../src/engine/index.js';
import { DATA } from '../src/data/index.js';
import { createCoop, controllerOf } from '../src/net/coop.js';
import { normalizeRoomCode, makeRoomCode } from '../src/net/transport.js';

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 3000) {
  const t0 = Date.now();
  while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timeout waiting for condition'); await tick(10); }
}
function player() {
  const game = createGame({ data: DATA, storage: createMemoryStorage() });
  const updates = [];
  const coop = createCoop({ game, onUpdate: (u) => updates.push(u) });
  return { game, coop, updates };
}

test('room codes', () => {
  const c = makeRoomCode();
  assert.equal(normalizeRoomCode(c.toLowerCase()), c);
  assert.equal(normalizeRoomCode('abc'), '');
  assert.equal(normalizeRoomCode('ab-c 23'), 'ABC23');
});

test('controller rotates by combat turn and by floor', () => {
  const ps = [{ id: 'a' }, { id: 'b' }];
  assert.equal(controllerOf({ screen: 'map', floor: 0 }, ps), 'a');
  assert.equal(controllerOf({ screen: 'map', floor: 1 }, ps), 'b');
  assert.equal(controllerOf({ screen: 'combat', floor: 1, combat: { phase: 'player', turn: 1 } }, ps), 'a');
  assert.equal(controllerOf({ screen: 'combat', floor: 1, combat: { phase: 'player', turn: 2 } }, ps), 'b');
});

test('host + 2 guests: sync, turn control, team quiz, personal notebooks', async () => {
  const H = player(); const A = player(); const B = player();
  const code = await H.coop.host({ name: 'ホスト', kind: 'local' });
  await A.coop.join({ code, name: 'A', kind: 'local' });
  await B.coop.join({ code, name: 'B', kind: 'local' });
  await until(() => H.coop.state.players.length === 3 && B.coop.state.players.length === 3 && A.coop.state.selfId && B.coop.state.selfId);

  assert.equal(H.coop.start({ difficulty: 'hyojun', seed: 'coop-test' }).ok, true);
  await until(() => A.game.run && B.game.run);
  assert.equal(A.game.isMirror, true);
  assert.deepEqual(A.game.run.map, H.game.run.map);

  // floor 0 → host leads; guests are rejected
  assert.equal(H.coop.isMyTurn(), true);
  assert.equal(A.coop.isMyTurn(), false);
  assert.equal(A.coop.act({ type: 'chooseNode', nodeId: H.game.availableNodes()[0] }).ok, false);
  assert.equal(H.coop.act({ type: 'chooseNode', nodeId: H.game.availableNodes()[0] }).ok, true);
  await until(() => A.game.run.screen === 'combat' && B.game.run.screen === 'combat');

  // combat turn 1 → host; turn 2 → A
  assert.equal(H.coop.controllerId(), 'host');
  assert.equal(H.coop.act({ type: 'endTurn' }).ok, true);
  await until(() => A.game.run.combat?.turn === 2 || A.game.run.pending || A.game.run.screen !== 'combat');
  if (H.game.run.screen === 'combat' && !H.game.run.pending) {
    assert.equal(H.coop.controllerId(), A.coop.state.selfId);
    assert.equal(H.coop.act({ type: 'endTurn' }).ok, false);
    assert.equal(A.coop.act({ type: 'endTurn' }).ok, true);
    await until(() => H.game.run.combat?.turn === 3 || H.game.run.pending || H.game.run.screen !== 'combat');
  }

  // force a quiz through the engine and resolve it as a team: host wrong, A right, B right → team correct
  const G = H.game._G;
  const q = DATA.QUESTIONS.find((x) => x.type === 'choice');
  const { makeQuizPending } = await import('../src/engine/quiz.js');
  G.run.pending = makeQuizPending(G, q, { onCorrect: [], onWrong: [], ctx: { side: 'player', source: 'system', actor: 'player', combat: false, depth: 0 } });
  H.coop.resync();
  await until(() => A.game.run.pending?.kind === 'quiz' && B.game.run.pending?.kind === 'quiz');
  const p = H.game.run.pending;
  const right = p.choices.indexOf(q.choices[q.answer]);
  const wrong = (right + 1) % 4;
  const missBefore = H.game.run.deck.filter((c) => c.id === 'misconception').length;
  H.coop.submitAnswer(wrong);
  A.coop.submitAnswer(right);
  await tick(50);
  assert.equal(H.game.run.pending.kind, 'quiz', 'waits for everybody');
  assert.equal(B.coop.state.quiz.answered.length, 2);
  B.coop.submitAnswer(right);
  await until(() => B.game.run.pending?.kind === 'quizResult');
  const r = H.game.run.pending;
  assert.equal(r.correct, true, 'team correct with 2 of 3');
  assert.equal(r.team.length, 3);
  assert.equal(H.game.run.deck.filter((c) => c.id === 'misconception').length, missBefore, 'no misconception on team success');
  assert.ok(H.game.meta.notebook[q.id], 'host answered wrong → own notebook');
  assert.equal(A.game.meta.notebook[q.id], undefined);
  assert.equal(A.game.meta.stats.questions[q.id].correct, 1);
  assert.equal(B.game.meta.stats.questions[q.id].asked, 1);

  // explanation stays until all are ready
  H.coop.ready(); A.coop.ready();
  await tick(50);
  assert.equal(H.game.run.pending?.kind, 'quizResult');
  B.coop.ready();
  await until(() => !H.game.run.pending && !A.game.run.pending);

  // chat reaches everybody
  A.coop.chat('  酸化数から攻めよう  ');
  await until(() => B.coop.state.chat.some((c) => c.text === '酸化数から攻めよう') && H.coop.state.chat.some((c) => c.text === '酸化数から攻めよう'));

  // guest leaves → rotation shrinks; host leaves → guests are closed and un-mirrored
  B.coop.leave();
  await until(() => H.coop.state.players.length === 2 && A.coop.state.players.length === 2);
  H.coop.leave();
  await until(() => A.coop.state.status === 'closed');
  assert.equal(A.game.run, null);
  assert.equal(A.game.isMirror, false);
});

test('a quiz is resolved when a player who has not answered leaves; all wrong → team wrong', async () => {
  const H = player(); const A = player();
  const code = await H.coop.host({ name: 'h', kind: 'local' });
  await A.coop.join({ code, name: 'a', kind: 'local' });
  await until(() => H.coop.state.players.length === 2 && A.coop.state.selfId);
  H.coop.start({ difficulty: 'kiso', seed: 's2' });
  await until(() => A.game.run);
  const G = H.game._G;
  const q = DATA.QUESTIONS.find((x) => x.type === 'numeric');
  const { makeQuizPending } = await import('../src/engine/quiz.js');
  G.run.pending = makeQuizPending(G, q, { onCorrect: [], onWrong: [], ctx: { side: 'player', source: 'system', actor: 'player', combat: false, depth: 0 } });
  H.coop.resync();
  await until(() => A.game.run.pending?.kind === 'quiz');
  H.coop.submitAnswer(String(q.answer * 7 + 123));
  await tick(40);
  assert.equal(H.game.run.pending.kind, 'quiz');
  A.coop.leave();
  await until(() => H.game.run.pending.kind === 'quizResult');
  assert.equal(H.game.run.pending.correct, false);
  assert.ok(H.game.run.deck.some((c) => c.id === 'misconception'));
  H.coop.leave();
});

test('joining an unknown room fails cleanly', async () => {
  const A = player();
  await assert.rejects(A.coop.join({ code: 'ZZZZ9', name: 'a', kind: 'local' }));
  assert.equal(A.coop.state.role, null);
});
