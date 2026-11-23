#!/usr/bin/env node
// Headless bot that plays full runs with the real data (balancing / crash hunting).
//
//   node tools/sim.js [--runs=50] [--correct=0.7] [--difficulty=hyojun] [--seed=sim]
//                     [--max-steps=30000] [--fixtures] [--allow-missing] [--verbose]
//
// Prints win rate, average floor, per-act death distribution, deadliest
// encounters, quiz accuracy, reaction/fizzle stats and every exception or
// soft-lock (no legal action, failing action, step cap).

import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createGame } from '../src/engine/index.js';
import { cardDef } from '../src/engine/data.js';
import { findReaction, livingEnemies, effectiveCost, computeDamage } from '../src/engine/combat.js';
import { createRng, random, pick } from '../src/engine/rng.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
const RUNS = Number(argv.runs ?? 50);
const P_CORRECT = Number(argv.correct ?? 0.7);
const DIFF = argv.difficulty ?? 'hyojun';
const SEED = argv.seed ?? 'sim';
const MAX_STEPS = Number(argv['max-steps'] ?? 30000);
const VERBOSE = !!argv.verbose;

const DATA_FILES = [
  ['src/data/tags.js', ['TAGS']],
  ['src/data/cards.js', ['CARDS', 'STARTER_DECK']],
  ['src/data/relics.js', ['RELICS', 'STARTER_RELIC']],
  ['src/data/potions.js', ['POTIONS']],
  ['src/data/enemies.js', ['ENEMIES']],
  ['src/data/encounters.js', ['ENCOUNTERS']],
  ['src/data/events.js', ['EVENTS']],
  ['src/data/questions/theory1.js', ['QUESTIONS', 'QUIZ_SETS']],
  ['src/data/questions/theory2.js', ['QUESTIONS', 'QUIZ_SETS']],
  ['src/data/questions/inorganic.js', ['QUESTIONS', 'QUIZ_SETS']],
  ['src/data/questions/organic.js', ['QUESTIONS', 'QUIZ_SETS']],
  ['src/data/questions/polymer.js', ['QUESTIONS', 'QUIZ_SETS']],
];

async function loadData() {
  if (argv.fixtures) return (await import(pathToFileURL(path.join(ROOT, 'tests/fixtures/data.js')).href)).DATA;
  const data = { QUESTIONS: [], QUIZ_SETS: [] };
  const missing = [];
  for (const [rel, exps] of DATA_FILES) {
    const abs = path.join(ROOT, rel);
    if (!existsSync(abs)) { missing.push(rel); continue; }
    const mod = await import(pathToFileURL(abs).href);
    for (const ex of exps) {
      if (ex === 'QUESTIONS' || ex === 'QUIZ_SETS') data[ex].push(...(mod[ex] || []));
      else data[ex] = mod[ex];
    }
  }
  if (missing.length) {
    console.log(`missing data files:\n  ${missing.join('\n  ')}`);
    if (!argv['allow-missing']) {
      console.log('(run with --allow-missing to simulate anyway, or --fixtures to use test fixtures)');
      process.exit(2);
    }
  }
  return data;
}

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

function answerFor(game, p, botRng) {
  const q = game.db.questions.get(p.questionId);
  const correct = random(botRng) < P_CORRECT;
  if (q.type === 'choice') {
    const right = p.choiceOrder.indexOf(q.answer);
    return correct ? right : (right + 1 + Math.floor(random(botRng) * 3)) % 4;
  }
  if (correct) return random(botRng) < 0.5 ? String(q.answer) : Number(q.answer).toExponential(2).replace('e', '×10^');
  return String(Number(q.answer) * 2 + 1);
}

function effectDamage(effects) {
  let d = 0;
  for (const e of effects || []) if (e.type === 'damage') d += (e.amount || 0) * (e.times === 'X' ? 2 : e.times ?? 1) * (e.target === 'all' ? 1.3 : 1);
  return d;
}
function effectBlock(effects) {
  let b = 0;
  for (const e of effects || []) if (e.type === 'block') b += e.amount || 0;
  return b;
}

function incomingDamage(G) {
  let sum = 0;
  for (const e of livingEnemies(G)) sum += e.intent?.preview?.total || 0;
  return sum;
}

function scorePlay(game, a) {
  const G = game._G;
  const c = G.run.combat;
  const inst = c.hand.find((x) => x.uid === a.uid);
  const def = cardDef(G.db, inst.id, inst.upgraded);
  const cost = effectiveCost(G, inst);
  const r = findReaction(G, def, a.target);
  if (def.strict && !r) return -1; // would fizzle
  let s = 1;
  const effs = r ? (r.reaction.replace ? r.reaction.effects : [...(def.effects || []), ...(r.reaction.effects || [])]) : def.effects;
  const dmg = effectDamage(effs);
  if (dmg && a.target) {
    const e = livingEnemies(G).find((x) => x.uid === a.target);
    const real = computeDamage(G, 'player', a.target, dmg, true);
    s += real;
    if (e && real >= e.hp + e.block) s += 15; // lethal
  } else s += dmg;
  const blk = effectBlock(effs);
  const need = Math.max(0, incomingDamage(G) - c.player.block);
  s += Math.min(blk, need) * 1.2 + Math.max(0, blk - need) * 0.2;
  if (r) s += 8;
  if (def.type === 'power') s += c.turn <= 2 ? 12 : 4;
  if ((effs || []).some((e) => e.type === 'quiz')) s += 4;
  if ((effs || []).some((e) => e.type === 'status' || e.type === 'draw' || e.type === 'energy' || e.type === 'reveal')) s += 3;
  if (cost === 'X') s = c.player.energy > 0 ? s + c.player.energy * 3 : -1;
  else s = s / Math.max(0.6, cost);
  return s;
}

function chooseCombat(game, acts) {
  const G = game._G;
  const plays = acts.filter((a) => a.type === 'playCard');
  let best = null; let bestS = 0.5;
  for (const a of plays) {
    const s = scorePlay(game, a);
    if (s > bestS) { bestS = s; best = a; }
  }
  // potions: heal when low, damage potions in big fights
  const hpRatio = G.run.player.hp / G.run.player.maxHp;
  const pots = acts.filter((a) => a.type === 'usePotion');
  if (pots.length && (hpRatio < 0.35 || (G.run.combat.kind !== 'battle' && G.run.combat.turn === 1))) return pots[0];
  return best || acts.find((a) => a.type === 'endTurn');
}

function chooseNode(game, acts) {
  const G = game._G;
  const hp = G.run.player.hp / G.run.player.maxHp;
  const score = (a) => {
    if (a.nodeId === 'boss') return 0;
    const n = G.run.map.rows.flat().find((x) => x.id === a.nodeId);
    switch (n?.type) {
      case 'rest': return hp < 0.5 ? 10 : 2;
      case 'elite': return hp > 0.75 ? 6 : -5;
      case 'shop': return G.run.player.gold >= 150 ? 7 : 1;
      case 'treasure': return 8;
      case 'event': return 4;
      default: return 5;
    }
  };
  return acts.slice().sort((a, b) => score(b) - score(a))[0];
}

function chooseCardIndex(game, ids, botRng) {
  const G = game._G;
  if (G.run.deck.length > 28) return -1;
  const rank = { rare: 3, uncommon: 2, common: 1 };
  let best = -1; let bs = 0;
  ids.forEach((id, i) => {
    const d = G.db.cards.get(id);
    const s = (rank[d.rarity] || 0) + (d.type === 'power' ? 0.5 : 0) + random(botRng) * 1.5;
    if (s > bs) { bs = s; best = i; }
  });
  return best;
}

function chooseSelection(game, p) {
  const G = game._G;
  const pool = p.from === 'hand' ? G.run.combat.hand : G.run.deck;
  const val = (uid) => {
    const inst = pool.find((x) => x.uid === uid);
    const d = G.db.cards.get(inst?.id);
    if (!d) return 0;
    let v = { curse: -10, status: -8 }[d.type] ?? 0;
    v += { starter: 1, common: 2, uncommon: 3, rare: 4, special: 0 }[d.rarity] ?? 0;
    return v;
  };
  const n = Math.min(p.min ?? p.count, p.options.length);
  const sorted = p.options.slice().sort((a, b) => val(a) - val(b));
  // upgrades: pick the most valuable; removal/exhaust/discard: the least valuable
  const uids = p.purpose === 'upgradeCard' || p.purpose === 'restUpgrade' ? sorted.reverse().slice(0, n) : sorted.slice(0, n);
  return { type: 'selectCards', uids };
}

function choose(game, acts, botRng) {
  const run = game.run;
  const p = run.pending;
  if (p?.kind === 'quiz') return { type: 'answerQuiz', answer: answerFor(game, p, botRng) };
  if (p?.kind === 'quizResult') return { type: 'continueQuiz' };
  if (p?.kind === 'selectCards') return chooseSelection(game, p);
  switch (run.screen) {
    case 'map': return chooseNode(game, acts);
    case 'combat': return chooseCombat(game, acts);
    case 'reward': {
      const r = run.reward;
      if (!r.cardTaken) {
        const i = chooseCardIndex(game, r.cards, botRng);
        return i >= 0 ? { type: 'pickRewardCard', index: i } : { type: 'skipRewardCard' };
      }
      const relic = acts.find((a) => a.type === 'takeRewardRelic');
      if (relic) return relic;
      const pot = acts.find((a) => a.type === 'takeRewardPotion');
      if (pot) return pot;
      return { type: 'leaveReward' };
    }
    case 'event': {
      const opts = acts.filter((a) => a.type === 'chooseEventOption');
      return opts.length ? pick(botRng, opts) : acts[0];
    }
    case 'rest': {
      if (run.rest.used) return { type: 'leaveRest' };
      const hp = run.player.hp / run.player.maxHp;
      const mis = run.deck.filter((d) => d.id === 'misconception').length;
      const has = (o) => acts.some((a) => a.type === 'chooseRestOption' && a.option === o);
      if (hp < 0.5 && has('rest')) return { type: 'chooseRestOption', option: 'rest' };
      if (mis >= 2 && has('review')) return { type: 'chooseRestOption', option: 'review' };
      if (has('upgrade')) return { type: 'chooseRestOption', option: 'upgrade' };
      return { type: 'chooseRestOption', option: 'rest' };
    }
    case 'shop': {
      const mis = run.deck.some((d) => d.id === 'misconception');
      if (mis && acts.some((a) => a.type === 'buyRemoval')) return { type: 'buyRemoval' };
      const buys = acts.filter((a) => a.type === 'buyCard' || a.type === 'buyRelic');
      if (buys.length && run.player.gold > 160) return pick(botRng, buys);
      return { type: 'leaveShop' };
    }
    case 'treasure': return acts.find((a) => a.type === 'openTreasure') || { type: 'leaveTreasure' };
    default: return acts[0];
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function playRun(data, i) {
  const seed = `${SEED}-${i}`;
  const botRng = createRng('bot-' + seed);
  const game = createGame({ data, storage: null, now: () => 0 });
  const out = { seed, won: false, floor: 0, act: 1, steps: 0, issues: [], deathEncounter: null, reactions: 0, fizzles: 0, correct: 0, wrong: 0, turns: 0, combats: 0 };
  let res = game.newRun({ seed, difficulty: DIFF });
  if (!res.ok) { out.issues.push(`newRun failed: ${res.error}`); return out; }
  let lastCombatKey = null;
  let turnActions = 0;
  for (; out.steps < MAX_STEPS && !game.run.result; out.steps++) {
    const acts = game.legalActions();
    if (!acts.length) {
      out.issues.push(`SOFT-LOCK: no legal actions (screen=${game.run.screen}, pending=${game.run.pending?.kind}, queue=${game.run.queue.length})`);
      break;
    }
    let a = choose(game, acts, botRng);
    if (game.run.screen === 'combat' && !game.run.pending) {
      if (a.type === 'endTurn') turnActions = 0;
      else if (++turnActions > 40) { a = { type: 'endTurn' }; turnActions = 0; }
    }
    if (game.run.combat) lastCombatKey = game.run.combat.enemies.map((e) => e.id).join('+');
    try {
      res = game.dispatch(a);
    } catch (e) {
      out.issues.push(`EXCEPTION on ${a.type}: ${e.stack}`);
      break;
    }
    if (!res.ok) {
      // fall back to the first legal action once; report if that fails too
      const alt = acts.find((x) => x.type !== a.type) || acts[0];
      const res2 = game.dispatch(alt.type === 'answerQuiz' && alt.numeric ? { ...alt, answer: '0' } : alt);
      if (!res2.ok) { out.issues.push(`SOFT-LOCK: actions failing (${a.type}: ${res.error}; ${alt.type}: ${res2.error})`); break; }
    }
    for (const ev of res.events) {
      if (ev.type === 'error') out.issues.push(`ENGINE ERROR: ${ev.msg}${VERBOSE && ev.stack ? '\n' + ev.stack : ''}`);
      if (ev.type === 'reaction') out.reactions++;
      if (ev.type === 'fizzle') out.fizzles++;
      if (ev.type === 'turnStart') out.turns++;
      if (ev.type === 'combatStart') out.combats++;
    }
  }
  if (!game.run.result && out.steps >= MAX_STEPS) out.issues.push(`STEP CAP reached (${MAX_STEPS}) on screen ${game.run.screen}`);
  const run = game.run;
  out.won = !!run.result?.won;
  out.floor = run.floor;
  out.act = run.act;
  out.correct = run.stats.correct; out.wrong = run.stats.wrong;
  out.deckSize = run.deck.length;
  out.misconceptions = run.deck.filter((d) => d.id === 'misconception').length;
  out.relics = run.relics.length;
  if (!out.won && run.result) out.deathEncounter = lastCombatKey;
  out.cardsPicked = run.deck.map((d) => d.id);
  return out;
}

async function main() {
  const data = await loadData();
  const t0 = Date.now();
  const results = [];
  for (let i = 0; i < RUNS; i++) {
    const r = playRun(data, i);
    results.push(r);
    if (VERBOSE) console.log(`#${i} ${r.won ? 'WIN ' : 'LOSS'} act ${r.act} floor ${r.floor} steps ${r.steps} deck ${r.deckSize} q ${r.correct}/${r.correct + r.wrong} ${r.issues.length ? 'ISSUES ' + r.issues.length : ''}`);
  }
  const n = results.length;
  const wins = results.filter((r) => r.won).length;
  const avg = (f) => (results.reduce((s, r) => s + f(r), 0) / Math.max(1, n));
  console.log(`\n=== sim: ${n} runs, difficulty=${DIFF}, P(correct)=${P_CORRECT}, ${((Date.now() - t0) / 1000).toFixed(1)}s ===`);
  console.log(`win rate        : ${(100 * wins / n).toFixed(1)}% (${wins}/${n})`);
  console.log(`avg floor       : ${avg((r) => r.floor).toFixed(1)}`);
  console.log(`avg turns/combat: ${(avg((r) => r.turns) / Math.max(1e-9, avg((r) => r.combats))).toFixed(2)}`);
  const deaths = {};
  for (const r of results) if (!r.won) deaths[r.act] = (deaths[r.act] || 0) + 1;
  console.log(`deaths by act   : ${[1, 2, 3, 4, 5].map((a) => `${a === 5 ? '終' : a}:${deaths[a] || 0}`).join('  ')}`);
  const killers = {};
  for (const r of results) if (r.deathEncounter) killers[r.deathEncounter] = (killers[r.deathEncounter] || 0) + 1;
  const topK = Object.entries(killers).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (topK.length) console.log(`deadliest       : ${topK.map(([k, v]) => `${k}×${v}`).join(', ')}`);
  const qs = avg((r) => r.correct + r.wrong);
  console.log(`quizzes/run     : ${qs.toFixed(1)}  (accuracy ${(100 * avg((r) => r.correct) / Math.max(1e-9, qs)).toFixed(1)}%)`);
  console.log(`reactions/run   : ${avg((r) => r.reactions).toFixed(1)}   fizzles/run: ${avg((r) => r.fizzles).toFixed(1)}`);
  console.log(`end deck size   : ${avg((r) => r.deckSize).toFixed(1)}   misconceptions: ${avg((r) => r.misconceptions).toFixed(2)}   relics: ${avg((r) => r.relics).toFixed(1)}`);
  const issues = results.flatMap((r) => r.issues.map((x) => `[${r.seed}] ${x}`));
  const uniq = [...new Set(issues.map((x) => x.replace(/^\[[^\]]+\] /, '').split('\n')[0]))];
  console.log(`issues          : ${issues.length} (${uniq.length} distinct)`);
  for (const u of uniq.slice(0, 30)) {
    const ex = issues.find((x) => x.includes(u));
    console.log('  - ' + ex.split('\n').slice(0, VERBOSE ? 12 : 1).join('\n    '));
  }
  process.exitCode = issues.length ? 1 : 0;
}

main().catch((e) => { console.error('sim crashed:', e); process.exitCode = 2; });
