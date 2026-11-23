import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combatGame, enemy, newGame, solvePending, DATA } from './helpers.js';
import { addMisconception, applyStatus, computeBlock, dealDamage, setPh } from '../src/engine/combat.js';

test('damage: base, strength, weak, vulnerable, floor', () => {
  const { g, G } = combatGame(['phslime'], ['strike', 'strike', 'strike', 'strike']);
  const e = enemy(G);
  g.playCard('h0', e.uid);
  assert.equal(e.hp, 24); // 30 - 6
  applyStatus(G, 'player', 'strength', 2);
  g.playCard('h1', e.uid);
  assert.equal(e.hp, 16); // 6+2
  applyStatus(G, 'player', 'weak', 1);
  g.playCard('h2', e.uid);
  assert.equal(e.hp, 10); // floor(8*0.75)=6
  applyStatus(G, e.uid, 'vulnerable', 1);
  G.run.combat.player.energy = 3;
  g.playCard('h3', e.uid);
  assert.equal(e.hp, 1); // floor(8*0.75*1.5)=9
});

test('damage: block absorbs, pierce ignores block, buffer reduces per hit', () => {
  const { G } = combatGame(['dummy'], []);
  const e = enemy(G);
  e.block = 4;
  dealDamage(G, { source: 'player', target: e.uid, base: 6, isAttack: true });
  assert.equal(e.block, 0);
  assert.equal(e.hp, 38);
  e.block = 10;
  dealDamage(G, { source: 'player', target: e.uid, base: 5, isAttack: true, pierce: true });
  assert.equal(e.block, 10);
  assert.equal(e.hp, 33);
  e.block = 0;
  applyStatus(G, e.uid, 'buffer', 2);
  dealDamage(G, { source: 'player', target: e.uid, base: 5, isAttack: true });
  assert.equal(e.hp, 30);
});

test('phRules: takenMult / dealtMult depend on current pH', () => {
  const { G } = combatGame(['phslime'], []);
  const e = enemy(G);
  setPh(G, 3);
  dealDamage(G, { source: 'player', target: e.uid, base: 5, isAttack: true });
  assert.equal(e.hp, 20); // 5*2
  setPh(G, 12);
  const hp = G.run.player.hp;
  dealDamage(G, { source: e.uid, target: 'player', base: 10, isAttack: true });
  assert.equal(G.run.player.hp, hp - 5);
});

test('block formula: dexterity and frail', () => {
  const { g, G } = combatGame(['dummy'], ['defend', 'defend']);
  applyStatus(G, 'player', 'dexterity', 2);
  g.playCard('h0');
  assert.equal(G.run.combat.player.block, 7);
  applyStatus(G, 'player', 'frail', 1);
  g.playCard('h1');
  assert.equal(G.run.combat.player.block, 7 + 5); // floor(7*0.75)=5
  assert.equal(computeBlock(G, 'player', 0), 1);
});

test('thorns retaliates against attacker', () => {
  const { G } = combatGame(['dummy'], []);
  const e = enemy(G);
  applyStatus(G, e.uid, 'thorns', 3);
  const hp = G.run.player.hp;
  dealDamage(G, { source: 'player', target: e.uid, base: 1, isAttack: true });
  assert.equal(G.run.player.hp, hp - 3);
});

test('poison ticks at owner turn start and decays; regen heals at turn end', () => {
  const { g, G } = combatGame(['dummy'], []);
  const e = enemy(G);
  applyStatus(G, e.uid, 'poison', 3);
  applyStatus(G, e.uid, 'regen', 2);
  e.hp = 30;
  g.endTurn();
  // enemy turn: poison 3 -> hp 27, then regen +2 -> 29
  assert.equal(e.hp, 29);
  assert.equal(e.statuses.poison, 2);
  assert.equal(e.statuses.regen, 1);
  // player poison ticks at player's turn start
  applyStatus(G, 'player', 'poison', 2);
  const hp = G.run.player.hp;
  g.endTurn();
  assert.equal(G.run.player.statuses?.poison, undefined);
  assert.equal(G.run.combat.player.statuses.poison, 1);
  assert.ok(G.run.player.hp <= hp - 2);
});

test('weak/vulnerable/frail/buffer decay at end of own turn only', () => {
  const { g, G } = combatGame(['dummy'], []);
  const e = enemy(G);
  applyStatus(G, 'player', 'weak', 2);
  applyStatus(G, e.uid, 'vulnerable', 2);
  g.endTurn();
  assert.equal(G.run.combat.player.statuses.weak, 1);
  assert.equal(e.statuses.vulnerable, 1);
});

test('precip skips next enemy action; on boss it becomes vulnerable 2', () => {
  const { g, G } = combatGame(['dummy'], []);
  const e = enemy(G);
  applyStatus(G, e.uid, 'precip', 1);
  const hp = G.run.player.hp;
  g.endTurn();
  assert.equal(G.run.player.hp, hp);
  assert.equal(e.statuses.precip, undefined);
  g.endTurn();
  assert.equal(G.run.player.hp, hp - 5);

  const b = combatGame(['boss1'], []);
  const boss = enemy(b.G);
  applyStatus(b.G, boss.uid, 'precip', 1);
  assert.equal(boss.statuses.precip, undefined);
  assert.equal(boss.statuses.vulnerable, 2);
});

test('colloid negates debuffs and is consumed', () => {
  const { G } = combatGame(['dummy'], []);
  const e = enemy(G);
  applyStatus(G, e.uid, 'colloid', 1);
  applyStatus(G, e.uid, 'weak', 2);
  assert.equal(e.statuses.weak, undefined);
  assert.equal(e.statuses.colloid, undefined);
  applyStatus(G, e.uid, 'weak', 2);
  assert.equal(e.statuses.weak, 2);
  // buffs are not negated
  applyStatus(G, e.uid, 'colloid', 1);
  applyStatus(G, e.uid, 'strength', 2);
  assert.equal(e.statuses.strength, 2);
  assert.equal(e.statuses.colloid, 1);
});

test('chain adds strength each turn start; excited adds energy once', () => {
  const { g, G } = combatGame(['dummy'], []);
  applyStatus(G, 'player', 'chain', 2);
  applyStatus(G, 'player', 'excited', 2);
  g.endTurn();
  assert.equal(G.run.combat.player.statuses.strength, 2);
  assert.equal(G.run.combat.player.energy, 5);
  assert.equal(G.run.combat.player.statuses.excited, undefined);
  g.endTurn();
  assert.equal(G.run.combat.player.statuses.strength, 4);
  assert.equal(G.run.combat.player.energy, 3);
});

test('catalyst reduces next card cost and is consumed; removed at turn end', () => {
  const { g, G } = combatGame(['dummy'], ['strike', 'strike'], { energy: 1 });
  applyStatus(G, 'player', 'catalyst', 1);
  assert.equal(g.cardView(G.run.combat.hand[0]).cost, 0);
  g.playCard('h0', enemy(G).uid);
  assert.equal(G.run.combat.player.energy, 1);
  assert.equal(G.run.combat.player.statuses.catalyst, undefined);
  applyStatus(G, 'player', 'catalyst', 2);
  g.endTurn();
  assert.equal(G.run.combat.player.statuses.catalyst, undefined);
});

test('reaction adds effects; strict card fizzles; replace', () => {
  const { g, G } = combatGame(['dummy', 'phslime'], ['hcl', 'hcl', 'fehling']);
  const [dummy, slime] = G.run.combat.enemies;
  const res = g.playCard('h0', dummy.uid); // dummy has base -> 4+6
  assert.ok(res.events.some((e) => e.type === 'reaction'));
  assert.equal(dummy.hp, 30);
  g.playCard('h1', slime.uid); // no base -> 4 only (damage resolves at pH 5, before this card's pH drop)
  assert.equal(G.run.combat.ph, 3);
  assert.equal(slime.hp, 26);
  const r2 = g.playCard('h2', slime.uid); // fehling strict: no aldehyde -> fizzle (block 1), no damage
  assert.ok(r2.events.some((e) => e.type === 'fizzle'));
  assert.equal(slime.hp, 26);
  assert.equal(G.run.combat.player.block, 1);
  assert.ok(G.meta.reactions['hcl#0'].count >= 1);
});

test('hidden tags: used for reactions, revealed only when used', () => {
  const { g, G } = combatGame(['phenolic'], ['fehling', 'detect']);
  const e = enemy(G);
  assert.deepEqual(g.displayTags(e).map((t) => t.hidden), [true, true]);
  g.playCard('h0', e.uid); // aldehyde (hidden) reacts
  assert.equal(e.hp, 50 - 13);
  assert.deepEqual(e.revealed, ['aldehyde']);
  g.playCard('h1', e.uid); // reveal 1 more -> phenol
  assert.deepEqual(e.revealed.sort(), ['aldehyde', 'phenol']);
});

test('transformTag chains alcohol1 -> aldehyde -> carboxylic (hidden stays hidden)', () => {
  const { g, G } = combatGame(['ethanol'], ['oxidize', 'oxidize', 'fehling'], { energy: 3 });
  const e = enemy(G);
  g.playCard('h0', e.uid);
  assert.deepEqual(e.hiddenTags, ['aldehyde']);
  assert.deepEqual(e.revealed, []);
  g.playCard('h2', e.uid); // fehling now reacts with the aldehyde and reveals it
  assert.deepEqual(e.revealed, ['aldehyde']);
  g.playCard('h1', e.uid);
  assert.deepEqual(e.hiddenTags, ['carboxylic']);
  assert.deepEqual(e.revealed, ['carboxylic']);
});

test('pH clamps to 0..14 and scale phBelow7 works', () => {
  const { g, G } = combatGame(['dummy'], ['naoh', 'naoh', 'naoh', 'acidburst'], { energy: 10 });
  g.playCard('h0'); g.playCard('h1'); g.playCard('h2');
  assert.equal(G.run.combat.ph, 14);
  setPh(G, -5);
  assert.equal(G.run.combat.ph, 0);
  setPh(G, 3);
  const e = enemy(G);
  g.playCard('h3', e.uid);
  assert.equal(e.hp, 40 - (2 + 2 * 4));
});

test('X cost uses all energy; killing all enemies mid-effect ends combat cleanly', () => {
  const { g, G } = combatGame(['minion', 'dummy'], ['xblast'], { energy: 3 });
  enemy(G, 1).hp = 10;
  const r = g.playCard('h0');
  assert.ok(r.ok, r.error);
  assert.equal(G.run.combat, null);
  assert.equal(G.run.screen, 'reward');
  assert.equal(G.run.queue.length, 0);
  assert.ok(G.run.player.hp > 0);
});

test('powers: onReaction trigger and every/filter counters', () => {
  const { g, G } = combatGame(['dummy'], ['chainpower', 'hcl', 'everythird', 'strike', 'strike', 'defend', 'strike'], { energy: 10, draw: ['strike', 'strike'] });
  const e = enemy(G);
  g.playCard('h0');
  assert.equal(G.run.combat.player.powers.length, 1);
  g.playCard('h1', e.uid);
  assert.equal(G.run.combat.player.block, 3);
  g.playCard('h2');
  const hand0 = G.run.combat.hand.length;
  g.playCard('h3', e.uid);
  g.playCard('h5'); // skill: does not count
  g.playCard('h4', e.uid);
  assert.equal(G.run.combat.hand.length, hand0 - 3);
  g.playCard('h6', e.uid); // 3rd attack -> draw 1
  assert.equal(G.run.combat.hand.length, hand0 - 4 + 1);
});

test('relic triggers: combatStart status, every-N counter persists, combatEnd heal', () => {
  const { g, G } = combatGame(['dummy'], ['defend', 'defend', 'defend'], { relics: ['burner', 'pipette', 'flask'] });
  // combatStart already fired during setup
  assert.equal(G.run.combat.player.statuses.strength, 1);
  g.playCard('h0');
  assert.equal(G.run.combat.player.block, 5);
  g.playCard('h1');
  assert.equal(G.run.combat.player.block, 11); // pipette every 2
  G.run.player.hp = 50;
  enemy(G).hp = 1;
  G.run.combat.hand.push({ uid: 'zz', id: 'strike', upgraded: false });
  G.run.combat.player.energy = 1;
  g.playCard('zz', enemy(G).uid);
  assert.equal(G.run.screen, 'reward');
  assert.equal(G.run.player.hp, 53);
});

test('keywords: retain, ethereal, innate, unplayable, exhaust', () => {
  const { g, G } = combatGame(['dummy'], ['keep', 'careless', 'misconception', 'strike']);
  assert.equal(g.canPlayCard('h1').ok, false);
  assert.equal(g.canPlayCard('h2').ok, false);
  const hp = G.run.player.hp;
  g.endTurn();
  const c = G.run.combat;
  assert.ok(c.hand.some((x) => x.uid === 'h0'), 'retain kept');
  assert.ok(c.exhaust.some((x) => x.uid === 'h1'), 'ethereal exhausted');
  assert.ok(c.discard.some((x) => x.uid === 'h2') || c.hand.some((x) => x.uid === 'h2'));
  assert.equal(G.run.player.hp, hp - 1 - 5); // misconception endTurnInHand + dummy attack

  const g2 = newGame();
  g2._G.run.deck.push({ uid: 'inn', id: 'opening', upgraded: false });
  const node = g2.availableNodes()[0];
  g2.chooseNode(node);
  assert.ok(g2.run.combat.hand.some((x) => x.uid === 'inn'), 'innate drawn on turn 1');
});

test('exhaustFromHand asks for a selection, then resumes', () => {
  const { g, G } = combatGame(['dummy'], ['purge', 'strike', 'defend']);
  g.playCard('h0');
  assert.equal(G.run.pending.kind, 'selectCards');
  assert.equal(g.playCard('h1', enemy(G).uid).ok, false);
  const r = g.selectCards(['h2']);
  assert.ok(r.ok, r.error);
  assert.equal(G.run.pending, null);
  assert.ok(G.run.combat.exhaust.some((x) => x.uid === 'h2'));
  assert.ok(G.run.combat.discard.some((x) => x.uid === 'h0'));
});

test('draw with empty draw and discard does not loop; reshuffle works', () => {
  const { g, G } = combatGame(['dummy'], []);
  const c = G.run.combat;
  c.draw = []; c.discard = []; c.hand = [];
  assert.ok(g.endTurn().ok);
  assert.equal(c.hand.length, 0);
  assert.equal(c.phase, 'player');
  c.discard = [{ uid: 'q1', id: 'strike' }, { uid: 'q2', id: 'defend' }];
  assert.ok(g.endTurn().ok);
  assert.equal(c.hand.length, 2);
  assert.equal(c.discard.length + c.draw.length, 0);
});

test('enemy weighted pattern respects noRepeat', () => {
  const { g, G } = combatGame(['phslime'], []);
  const e = enemy(G);
  e.hp = 1000; e.maxHp = 1000;
  let run = 0; let last = null; let maxRun = 0;
  for (let i = 0; i < 40; i++) {
    const m = e.intent.moveId;
    run = m === last ? run + 1 : 1; last = m; maxRun = Math.max(maxRun, run);
    G.run.player.hp = 80;
    g.endTurn();
  }
  assert.ok(maxRun <= 2, 'max consecutive ' + maxRun);
});

test('summon adds a minion; minions vanish when the last real enemy dies', () => {
  const { g, G } = combatGame(['boss1'], ['strike'], { kind: 'boss' });
  const boss = enemy(G);
  boss.hp = 40; // below 50% on next damage
  g.playCard('h0', boss.uid);
  assert.equal(boss.phaseIndex, 0);
  assert.equal(boss.intent.moveId, 'rage');
  assert.equal(boss.block, 10); // onEnter
  G.run.player.hp = 80;
  g.endTurn(); // rage
  assert.equal(boss.intent.moveId, 'call');
  g.endTurn(); // call -> minion
  assert.equal(G.run.combat.enemies.filter((x) => x.alive).length, 2);
  boss.hp = 1; boss.block = 0;
  G.run.combat.hand.push({ uid: 'k', id: 'strike' });
  G.run.combat.player.energy = 1;
  g.playCard('k', boss.uid);
  assert.equal(G.run.screen, 'reward');
  assert.equal(G.run.reward.kind, 'boss');
  assert.ok(G.run.reward.relicChoices.length >= 1);
});

test('self-retriggering power loops terminate (trigger depth guard)', () => {
  const { g, G } = combatGame(['dummy'], ['naoh'], { energy: 3 });
  G.run.combat.player.powers.push({ trigger: 'onPhChange', effects: [{ type: 'ph', delta: -1 }], every: 0, counter: 0, name: 'loop' });
  const r = g.playCard('h0');
  assert.ok(r.ok);
  assert.equal(G.run.queue.length, 0);
  assert.equal(G.run.pending, null);
  assert.ok(G.run.combat.ph >= 0 && G.run.combat.ph <= 14);
});

test("target:'all' reaction holds if any enemy matches and reveals hidden tags on each matching enemy", () => {
  const { g, G } = combatGame(['phenolic', 'dummy', 'phenolic'], ['washall'], { energy: 2 });
  const [a, d, b] = G.run.combat.enemies;
  const r = g.playCard('h0');
  assert.ok(r.events.some((e) => e.type === 'reaction'));
  assert.deepEqual(a.revealed, ['phenol']);
  assert.deepEqual(b.revealed, ['phenol']);
  assert.deepEqual(d.revealed, []);
  assert.equal(a.hp, 49);
  assert.equal(d.statuses.weak, 1);
});

test('misconception copies are capped at 5', () => {
  const { G } = combatGame(['dummy'], []);
  for (let i = 0; i < 8; i++) addMisconception(G);
  assert.equal(G.run.deck.filter((x) => x.id === 'misconception').length, 5);
});

test('phase-level quizField overrides the enemy quizField (final boss extension)', () => {
  const data = { ...DATA, ENEMIES: DATA.ENEMIES.map((e) => (e.id !== 'final' ? e : {
    ...e, quizField: 'theory1',
    moves: { ask: { name: '大問', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [], onWrong: [] }] } },
    pattern: { type: 'cycle', seq: ['ask'] },
    phases: [{ hpBelow: 0.75, quizField: 'organic', name: '大問2' }],
  })) };
  const { g, G } = combatGame(['final'], ['strike'], { data, kind: 'boss' });
  g.endTurn();
  assert.equal(G.run.pending.field, 'theory1');
  solvePending(g, true);
  const boss = enemy(G);
  boss.hp = 50; // below 75%
  G.run.combat.hand = [{ uid: 's', id: 'strike' }];
  G.run.combat.player.energy = 1;
  g.playCard('s', boss.uid);
  assert.equal(boss.phaseIndex, 0);
  g.endTurn();
  assert.equal(G.run.pending.field, 'organic');
});
