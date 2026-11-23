import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createMemoryStorage, generateMap, createRng, isBedtime } from '../src/engine/index.js';
import { availableNodeIds } from '../src/engine/map.js';
import { DATA, newGame, solvePending } from './helpers.js';

test('map generation invariants', () => {
  for (let s = 0; s < 200; s++) {
    for (const act of [1, 2, 3, 4]) {
      const m = generateMap(createRng('map' + s), act);
      assert.equal(m.rows.length, 8);
      const ids = new Set();
      m.rows.forEach((row, r) => {
        assert.ok(row.length >= 2 && row.length <= 4, 'row size');
        for (const n of row) {
          assert.ok(!ids.has(n.id)); ids.add(n.id);
          if (r === 0) assert.equal(n.type, 'battle');
          if (r === 7) assert.equal(n.type, 'rest');
          if (r < 2) assert.notEqual(n.type, 'elite');
          if (r < 7) {
            assert.ok(n.next.length >= 1, 'has outgoing');
            for (const nx of n.next) assert.ok(m.rows[r + 1].some((x) => x.id === nx), 'edge to next row');
          } else assert.equal(n.next.length, 0);
        }
        if (r > 0) for (const n of row) assert.ok(m.rows[r - 1].some((p) => p.next.includes(n.id)), 'has incoming');
        // planarity: edges do not cross
        if (r < 7) {
          const edges = row.flatMap((n) => n.next.map((nx) => [n.col, Number(nx.split('-')[1])]));
          for (const [a, b] of edges) for (const [c, d] of edges) if (a < c) assert.ok(b <= d, 'crossing edges');
        }
      });
      assert.ok(m.rows.flat().some((n) => n.type === 'shop'));
      assert.ok(m.rows.flat().some((n) => n.type === 'elite'));
      assert.deepEqual(availableNodeIds(m, '7-0'), ['boss']);
    }
  }
  const f = generateMap(createRng('x'), 5);
  assert.equal(f.rows.length, 4);
  assert.deepEqual(availableNodeIds(f, '3-0'), ['boss']);
});

test('determinism: same seed + same policy => identical state', () => {
  const play = () => {
    const g = createGame({ data: DATA, storage: null, now: () => 0 });
    g.newRun({ seed: 'det', difficulty: 'kyodai' });
    for (let i = 0; i < 400 && !g.run.result; i++) {
      const acts = g.legalActions();
      let a = acts.find((x) => x.type === 'playCard') || acts.find((x) => x.type === 'pickRewardCard') || acts[0];
      if (a.type === 'answerQuiz' && a.numeric) a = { ...a, answer: '1' };
      g.dispatch(a);
    }
    return JSON.stringify(g.run);
  };
  assert.equal(play(), play());
});

test('save/load round-trip mid-combat and mid-quiz, then identical continuation', () => {
  const storage = createMemoryStorage();
  const g1 = createGame({ data: DATA, storage, now: () => 0 });
  g1.newRun({ seed: 'save' });
  g1.chooseNode(g1.availableNodes()[0]);
  assert.equal(g1.run.screen, 'combat');
  // put a quiz card in hand and start it
  g1.run.combat.hand.push({ uid: 'qq', id: 'study' });
  g1.run.combat.player.energy = 3;
  g1._G.run = g1.run; // same object
  g1.playCard('qq');
  assert.equal(g1.run.pending.kind, 'quiz');
  const snapshot = JSON.stringify(g1.run);
  const g2 = createGame({ data: DATA, storage, now: () => 0 });
  assert.equal(g2.hasSavedRun(), true);
  assert.ok(g2.continueRun().ok);
  assert.equal(JSON.stringify(g2.run), snapshot);
  // continue both identically
  for (const g of [g1, g2]) {
    solvePending(g, true);
    for (let i = 0; i < 50 && !g.run.result; i++) {
      const acts = g.legalActions();
      let a = acts.find((x) => x.type === 'playCard') || acts[0];
      if (a.type === 'answerQuiz' && a.numeric) a = { ...a, answer: '1' };
      g.dispatch(a);
    }
  }
  assert.equal(JSON.stringify(g1.run), JSON.stringify(g2.run));
  // meta persisted too
  const g3 = createGame({ data: DATA, storage, now: () => 0 });
  assert.deepEqual(g3.meta.stats, g2.meta.stats);
});

test('corrupt save is ignored', () => {
  const storage = createMemoryStorage({ 'chemyth.run': '{not json', 'chemyth.meta': '[]' });
  const g = createGame({ data: DATA, storage });
  assert.equal(g.hasSavedRun(), false);
  assert.equal(g.continueRun().ok, false);
  assert.ok(g.meta.notebook && typeof g.meta.notebook === 'object');
});

test('rewards: gold, 3 distinct non-starter cards, elite relic', () => {
  const g = newGame();
  const G = g._G;
  g.chooseNode(g.availableNodes()[0]);
  for (const e of G.run.combat.enemies) e.hp = 1;
  G.run.combat.hand = [{ uid: 'a', id: 'xblast' }];
  G.run.combat.player.energy = 1;
  const gold = G.run.player.gold;
  g.playCard('a');
  const r = G.run.reward;
  assert.equal(G.run.screen, 'reward');
  assert.ok(r.gold >= 10 && r.gold <= 20);
  assert.equal(G.run.player.gold, gold + r.gold);
  assert.equal(new Set(r.cards).size, r.cards.length);
  for (const id of r.cards) assert.ok(['common', 'uncommon', 'rare'].includes(g.db.cards.get(id).rarity));
  const deck = G.run.deck.length;
  assert.ok(g.pickRewardCard(0).ok);
  assert.equal(G.run.deck.length, deck + 1);
  assert.equal(g.pickRewardCard(1).ok, false);
  assert.ok(g.leaveReward().ok);
  assert.equal(G.run.screen, 'map');
});

test('shop: buy card, removal service with selection, prices', () => {
  const g = newGame();
  const G = g._G;
  G.run.player.gold = 1000;
  G.run.screen = 'map';
  // enter shop directly
  G.run.map.rows[0][0].type = 'shop';
  g.chooseNode(G.run.map.rows[0][0].id);
  assert.equal(G.run.screen, 'shop');
  assert.ok(G.run.shop.cards.length > 0);
  const price = G.run.shop.cards[0].price;
  assert.ok(g.buyCard(0).ok);
  assert.equal(G.run.player.gold, 1000 - price);
  assert.equal(g.buyCard(0).ok, false);
  const deck = G.run.deck.length;
  assert.ok(g.buyRemoval().ok);
  assert.equal(G.run.pending.kind, 'selectCards');
  assert.ok(g.selectCards([G.run.deck[0].uid]).ok);
  assert.equal(G.run.deck.length, deck - 1);
  assert.equal(g.buyRemoval().ok, false);
  assert.ok(g.leaveShop().ok);
});

test('rest: heal 30% and upgrade with cancel', () => {
  const g = newGame();
  const G = g._G;
  G.run.screen = 'rest';
  G.run.rest = { used: false, choice: null, reviewResults: [] };
  assert.ok(g.chooseRestOption('upgrade').ok);
  assert.ok(g.cancelSelection().ok);
  assert.equal(G.run.rest.used, false);
  G.run.player.hp = 10;
  assert.ok(g.chooseRestOption('rest').ok);
  assert.equal(G.run.player.hp, 34);
  assert.equal(g.chooseRestOption('upgrade').ok, false);
});

test('relic onPickup and treasure', () => {
  const g = newGame();
  const G = g._G;
  G.run.screen = 'treasure';
  G.run.treasure = { relicId: 'notebook', gold: 30, opened: false };
  const max = G.run.player.maxHp;
  assert.ok(g.openTreasure().ok);
  assert.equal(G.run.player.maxHp, max + 7);
  assert.ok(G.run.relics.some((r) => r.id === 'notebook'));
});

test('full runs with a naive bot never soft-lock (fixture data)', () => {
  for (let s = 0; s < 15; s++) {
    const g = createGame({ data: DATA, storage: null, now: () => 0 });
    g.newRun({ seed: 'bot' + s, difficulty: ['kiso', 'hyojun', 'kyodai'][s % 3] });
    let i = 0;
    for (; i < 6000 && !g.run.result; i++) {
      const acts = g.legalActions();
      assert.ok(acts.length > 0, 'no legal actions on ' + g.run.screen);
      let a = acts.find((x) => x.type === 'playCard') || acts.find((x) => x.type === 'pickRewardCard') || acts.find((x) => x.type === 'chooseRestOption') || acts[0];
      if (a.type === 'answerQuiz' && a.numeric) a = { ...a, answer: '1' };
      const r = g.dispatch(a);
      assert.ok(r.ok, `${a.type}: ${r.error}`);
    }
    assert.ok(g.run.result, 'run finished');
    assert.deepEqual(g.run.errors, []);
  }
});

test('bedtime guard', () => {
  const at = (h, m = 0) => new Date(2026, 0, 1, h, m);
  assert.equal(isBedtime(at(22, 59)), false);
  assert.equal(isBedtime(at(23, 0)), true);
  assert.equal(isBedtime(at(2, 30)), true);
  assert.equal(isBedtime(at(4, 59)), true);
  assert.equal(isBedtime(at(5, 0)), false);
  assert.equal(isBedtime(at(12, 0)), false);
  assert.equal(isBedtime(at(0, 30), '00:15'), true);
  assert.equal(isBedtime(at(23, 30), '00:15'), false);
  assert.equal(isBedtime(at(21, 30), '21:00'), true);
  assert.equal(isBedtime(at(21, 30), 'bogus'), false);
  const g = newGame();
  g.setSetting('bedtime', '01:00');
  assert.equal(g.bedtimeWarning(at(0, 30)), null);
  assert.ok(g.bedtimeWarning(at(1, 30)));
});
