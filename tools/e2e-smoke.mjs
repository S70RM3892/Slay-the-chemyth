#!/usr/bin/env node
// End-to-end smoke test of the browser UI (Playwright + Chromium).
//
//   node tools/e2e-smoke.mjs [--out=DIR] [--only=mobile|desktop] [--seed=SEED]
//
// Serves the repository with a tiny built-in static server, then for a phone
// (390x844) and a desktop (1280x800) viewport:
//   title (zero console errors / failed requests) -> new run -> walks the act-1
//   map through combat / reward / event / rest / shop / treasure screens, answers
//   quizzes through the real UI (choice + numeric, incl. one deliberate wrong
//   answer each), reloads mid-combat and continues from the save, beats the boss
//   (incl. a 大問 with lead text), then opens 図鑑 / 弱点分析.
// All game input is done by clicking the real UI. To keep the run alive the
// script may top up HP (and, for very long fights, weaken enemies) via the
// engine from the page — clicks still go through the UI.
// Screenshots (deviceScaleFactor 1) go to --out (default: $TMPDIR/chemyth-e2e).

import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const OUT = path.resolve(args.out || path.join(os.tmpdir(), 'chemyth-e2e'));
const SEED = args.seed || 'e2e-7';
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------------------
// tiny static server (serves the repo under a sub-path to prove relative URLs)
// ---------------------------------------------------------------------------
const SUB = '/sub/path/';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };
function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (!u.startsWith(SUB)) { res.writeHead(404); res.end('not under sub-path'); return; }
      u = u.slice(SUB.length - 1);
      if (u.endsWith('/')) u += 'index.html';
      const f = path.join(ROOT, path.normalize(u));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

async function runViewport(base, name, viewport, opts = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: name === 'mobile', isMobile: false, locale: 'ja-JP' });
  const page = await context.newPage();
  const problems = [];
  const report = { name, steps: 0, screens: {}, quizzes: { choice: 0, numeric: 0, wrong: 0, set: 0 }, combats: 0, reload: false, act1Cleared: false, hscroll: [] };
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console.error: ' + m.text()); });
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => problems.push('requestfailed: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
  if (opts.clock) await page.clock.setFixedTime(opts.clock);

  const shot = async (label) => {
    await sleep(60);
    await page.screenshot({ path: path.join(OUT, `${name}-${label}.png`) });
  };
  const shotOnce = new Set();
  const once = async (label) => { if (!shotOnce.has(label)) { shotOnce.add(label); await shot(label); } };
  const checkHScroll = async (where) => {
    const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    if (w.sw > w.iw + 1) report.hscroll.push(`${where}: ${w.sw}>${w.iw}`);
  };
  const fatalVisible = async () => (await page.locator('.modal.fatal').count()) > 0;

  // ---- title ----
  await page.goto(base + `?seed=${encodeURIComponent(SEED)}`);
  await page.waitForSelector('.title-screen');
  await once('title');
  await checkHScroll('title');
  if (opts.expectBedtime) {
    if (!(await page.locator('.bedtime').count())) problems.push('bedtime banner missing on title at bedtime');
    await page.click('[data-a="dismissBedtime"]');
    if (await page.locator('.bedtime').count()) problems.push('bedtime banner not dismissible');
  }
  // chem() formatter sanity (runs the real module in the page)
  const chemCheck = await page.evaluate(async () => {
    const m = await import('./src/ui/chem.js');
    return {
      a: m.chem('SO_4^{2-}'), b: m.chem('10^{-5}'), c: m.chem('C_{12}H_{22}O_{11}'), d: m.chem('Cu^{2+}'),
      e: m.chem('<img src=x onerror=alert(1)>_{<b>}'), f: m.chem('a\nb'),
    };
  });
  const want = { a: 'SO<sub>4</sub><sup>2-</sup>', b: '10<sup>-5</sup>', c: 'C<sub>12</sub>H<sub>22</sub>O<sub>11</sub>', d: 'Cu<sup>2+</sup>', e: '&lt;img src=x onerror=alert(1)&gt;<sub>&lt;b&gt;</sub>', f: 'a<br>b' };
  for (const k of Object.keys(want)) if (chemCheck[k] !== want[k]) problems.push(`chem() ${k}: ${chemCheck[k]} != ${want[k]}`);

  // ---- new run ----
  await page.click('[data-a="titleMode"][data-mode="new"]');
  await page.click('[data-a="pickDiff"][data-id="hyojun"]');
  await page.click('[data-a="startRun"]');
  await page.waitForSelector('.map-screen');
  await once('map');
  await checkHScroll('map');

  const st = () => page.evaluate(() => {
    const api = window.__chemyth; const g = api.game; const r = g.run;
    if (!r) return { view: api.ui.view, screen: null };
    const p = r.pending;
    let ans = null;
    if (p && p.kind === 'quiz') {
      const q = g.db.questions.get(p.questionId);
      ans = p.type === 'choice' ? (p.choiceOrder || [0, 1, 2, 3]).indexOf(q.answer) : q.answer;
    }
    return {
      view: api.ui.view, screen: r.screen, act: r.act, floor: r.floor, hp: r.player.hp, maxHp: r.player.maxHp, gold: r.player.gold,
      pending: p ? { kind: p.kind, qid: p.questionId, type: p.type, lead: !!p.lead, setId: p.setId, ans, purpose: p.purpose, need: p.kind === 'selectCards' ? Math.min(p.min ?? p.count, p.options.length) : 0 } : null,
      combat: r.combat ? { turn: r.combat.turn, phase: r.combat.phase, kind: r.combat.kind, living: r.combat.enemies.filter((e) => e.alive).length } : null,
      avail: g.availableNodes().map((id) => ({ id, type: id === 'boss' ? 'boss' : r.map.rows.flat().find((n) => n.id === id)?.type })),
      result: r.result,
    };
  });

  const seenTypes = new Set();
  let wrongChoiceDone = false; let wrongNumericDone = false;
  let restCount = 0; let reloadDone = false; let sheetsDone = false; let potionDone = false;
  let lastKey = ''; let stuck = 0; let plan = null; let quizReloadDone = false;

  for (let step = 0; step < 1500; step++) {
    report.steps = step;
    if (await fatalVisible()) { problems.push('fatal overlay: ' + (await page.locator('.fatal-msg').innerText())); break; }
    const s = await st();
    if (s.view !== 'run') { problems.push('left run view unexpectedly: ' + s.view); break; }
    if (s.result) { problems.push('run ended: ' + JSON.stringify(s.result)); await shot('result'); break; }
    if (s.act >= 2 && s.screen === 'map') { report.act1Cleared = true; await once('act2-map'); break; }
    const key = JSON.stringify([s.screen, s.floor, s.pending, s.combat, s.gold, s.hp]);
    if (key === lastKey) { if (++stuck > 25) { problems.push('stuck at ' + key); await shot('stuck'); break; } } else { stuck = 0; lastKey = key; }
    report.screens[s.screen] = (report.screens[s.screen] || 0) + 1;

    // ---------------- pending: quiz ----------------
    if (s.pending?.kind === 'quiz') {
      await page.waitForSelector('.modal.quiz');
      const tag = s.pending.lead ? 'set' : s.pending.type;
      // mid-quiz reload -> continue restores the same question
      if (!quizReloadDone) {
        quizReloadDone = true;
        await page.reload();
        await page.waitForSelector('.title-screen');
        if (opts.expectBedtime && await page.locator('[data-a="dismissBedtime"]').count()) await page.click('[data-a="dismissBedtime"]');
        await page.click('[data-a="continue"]');
        await page.waitForSelector('.modal.quiz');
        const after = await st();
        if (after.pending?.kind !== 'quiz' || after.pending.qid !== s.pending.qid) problems.push('mid-quiz reload mismatch');
        else report.quizReload = true;
        continue;
      }
      await once(`quiz-${tag}`);
      if (s.pending.lead) {
        report.quizzes.set++;
        if (!(await page.locator('.quiz-lead .lead-body').count())) problems.push('lead text not visible for 大問');
      }
      if (s.pending.type === 'choice') {
        report.quizzes.choice++;
        let i = s.pending.ans;
        if (!wrongChoiceDone && !s.pending.lead) { i = (i + 1) % 4; wrongChoiceDone = true; report.quizzes.wrong++; }
        await page.click(`.choice[data-i="${i}"]`);
      } else {
        report.quizzes.numeric++;
        let v = Number(s.pending.ans);
        if (!wrongNumericDone && !s.pending.lead) { v = v * 3 + 1; wrongNumericDone = true; report.quizzes.wrong++; }
        await page.click('#quiz-num');
        const a = Math.abs(v);
        if (a !== 0 && (a < 0.01 || a >= 1e4)) {
          const exp = Math.floor(Math.log10(a));
          const mant = (v / 10 ** exp).toPrecision(3);
          await page.keyboard.type(mant);
          await page.click('[data-a="ins"][data-t="×10^"]');
          if (exp < 0) await page.click('[data-a="ins"][data-t="-"]');
          await page.keyboard.type(String(Math.abs(exp)));
        } else {
          await page.keyboard.type(String(Number(v.toPrecision(4))));
        }
        await once(`quiz-${tag}-typed`);
        await page.click('.numeric button[type="submit"]');
      }
      await page.waitForSelector('[data-a="continueQuiz"]');
      await once(`quiz-${tag}-explain`);
      if (!(await page.locator('.quiz .explain').count())) problems.push('explanation missing');
      await page.click('[data-a="continueQuiz"]');
      continue;
    }
    if (s.pending?.kind === 'quizResult') { await page.click('[data-a="continueQuiz"]'); continue; }
    if (s.pending?.kind === 'selectCards') {
      await page.waitForSelector('.modal.picker');
      await once('picker');
      const tiles = page.locator('.modal.picker [data-a="pickToggle"]');
      for (let k = 0; k < s.pending.need; k++) await tiles.nth(k).click();
      await page.click('[data-a="pickConfirm"]');
      continue;
    }

    switch (s.screen) {
      case 'map': {
        await checkHScroll('map');
        // plan (once per act) the path that visits the most distinct node types
        if (!plan || plan.act !== s.act) {
          plan = await page.evaluate(() => {
            const r = window.__chemyth.game.run;
            const rows = r.map.rows;
            const want = ['shop', 'treasure', 'event', 'rest', 'elite'];
            let best = null;
            const walk = (node, path) => {
              const p = [...path, node];
              if (node.row === rows.length - 1) {
                const types = new Set(p.map((n) => n.type));
                const score = want.filter((t) => types.has(t)).length * 10 - p.filter((n) => n.type === 'elite').length;
                if (!best || score > best.score) best = { score, ids: p.map((n) => n.id) };
                return;
              }
              for (const id of node.next) walk(rows[node.row + 1].find((n) => n.id === id), p);
            };
            for (const n of rows[0]) walk(n, []);
            return { act: r.act, ids: best ? best.ids : [] };
          });
        }
        const pick = s.avail.find((a) => plan.ids.includes(a.id)) || s.avail[0];
        if (!pick) { problems.push('no available node'); break; }
        seenTypes.add(pick.type);
        await page.click(`.mnode.avail[data-id="${pick.id}"]`);
        if (opts.expectBedtime) {
          if (!(await page.locator('.bedtime').count())) problems.push('bedtime banner missing after node transition');
          else await page.click('[data-a="dismissBedtime"]');
        }
        break;
      }
      case 'combat': {
        const c = s.combat;
        await once(c.kind === 'boss' ? 'combat-boss' : 'combat');
        await checkHScroll('combat');
        if (c.turn === 1 && !report.screens.combatCounted) { /* noop */ }
        // keep the player alive (engine-side), clicks stay in the UI
        if (s.hp < s.maxHp * 0.5) await page.evaluate(() => { const g = window.__chemyth.game; g.run.player.hp = g.run.player.maxHp; window.__chemyth.render(); });
        if (c.turn > (c.kind === 'boss' ? 14 : 9)) {
          await page.evaluate(() => { for (const e of window.__chemyth.game.run.combat.enemies) if (e.alive) e.hp = Math.min(e.hp, 3); window.__chemyth.render(); });
        }
        // mid-combat reload -> continue from save
        if (!reloadDone && c.turn >= 2) {
          reloadDone = true;
          const before = await st();
          await page.reload();
          await page.waitForSelector('.title-screen');
          if (opts.expectBedtime && await page.locator('[data-a="dismissBedtime"]').count()) await page.click('[data-a="dismissBedtime"]');
          await page.click('[data-a="continue"]');
          await page.waitForSelector('.combat-screen, .modal.quiz');
          const after = await st();
          if (after.screen !== 'combat' || after.combat?.turn !== before.combat?.turn || after.hp !== before.hp) problems.push('reload/continue mismatch ' + JSON.stringify([before.combat, after.combat]));
          else report.reload = true;
          break;
        }
        // detail sheets once (card ⓘ + enemy lore)
        if (!sheetsDone) {
          sheetsDone = true;
          await page.locator('.hand .card-info').first().click();
          await page.waitForSelector('.sheet');
          await once('card-sheet');
          await page.click('.sheet [data-a="closeAllSheets"]');
          await page.locator('.enemy .enemy-main').first().click();
          await page.waitForSelector('.sheet');
          await once('enemy-sheet');
          await page.click('.sheet [data-a="closeAllSheets"]');
          await page.click('[data-a="pile"][data-pile="draw"]');
          await page.waitForSelector('.sheet');
          await once('pile-sheet');
          await page.click('.sheet [data-a="closeAllSheets"]');
          break;
        }
        // use a potion once
        if (!potionDone && (await page.locator('.tb-pots .pot:not(.empty)').count())) {
          potionDone = true;
          await page.locator('.tb-pots .pot:not(.empty)').first().click();
          await page.waitForSelector('.sheet');
          const use = page.locator('.sheet [data-a="usePotion"]');
          if (await use.isEnabled()) {
            await use.click();
            if (await page.locator('.enemy.targetable').count()) await page.locator('.enemy.targetable .enemy-main').first().click();
          } else await page.click('.sheet [data-a="closeAllSheets"]');
          break;
        }
        if (c.phase !== 'player') { await sleep(30); break; }
        const playable = page.locator('.hand .card-main[data-playable="1"]');
        if (await playable.count()) {
          await playable.first().click();
          if (await page.locator('.target-msg').count()) {
            await once('targeting');
            await page.locator('.enemy.targetable .enemy-main').first().click();
          }
        } else {
          await page.click('[data-a="endTurn"]');
          report.turns = (report.turns || 0) + 1;
        }
        break;
      }
      case 'reward': {
        await once(s.floor >= 9 || (await page.locator('.reward-screen').innerText()).includes('ボス') ? 'reward-boss' : 'reward');
        await checkHScroll('reward');
        report.combats++;
        if (await page.locator('[data-a="rewardCard"]').count()) {
          await page.locator('[data-a="rewardCard"]').first().click();
          await page.waitForSelector('.sheet');
          await page.click('.sheet .btn.primary');
          break;
        }
        const pot = page.locator('[data-fn="takeRewardPotion"]:not([disabled])');
        if (await pot.count()) { await pot.first().click(); break; }
        const rel = page.locator('[data-fn="takeRewardRelic"]');
        if (await rel.count()) { await rel.first().click(); break; }
        await page.click('[data-fn="leaveReward"]');
        break;
      }
      case 'event': {
        await once('event');
        await checkHScroll('event');
        const ch = page.locator('.event-choice:not([disabled])');
        if (await ch.count()) { await ch.first().click(); break; }
        await once('event-result');
        await page.click('[data-fn="leaveEvent"]');
        break;
      }
      case 'rest': {
        await once('rest');
        const opts2 = page.locator('[data-a="restOpt"]:not([disabled])');
        if (await opts2.count()) {
          const want = restCount === 0 ? 'review' : restCount === 1 ? 'upgrade' : 'rest';
          restCount++;
          const btn = page.locator(`[data-a="restOpt"][data-id="${want}"]:not([disabled])`);
          await (await btn.count() ? btn : opts2.first()).click();
          break;
        }
        await page.click('[data-fn="leaveRest"]');
        break;
      }
      case 'shop': {
        await once('shop');
        await checkHScroll('shop');
        if (!report.shopBought) {
          report.shopBought = true;
          await page.locator('[data-a="shopCard"]').first().click();
          await page.waitForSelector('.sheet');
          await once('shop-sheet');
          const buy = page.locator('.sheet .btn.primary');
          if (await buy.isEnabled()) await buy.click(); else await page.click('.sheet [data-a="closeAllSheets"]');
          break;
        }
        if (!report.shopRemoval && (await page.locator('[data-fn="buyRemoval"]:not([disabled])').count())) {
          report.shopRemoval = true;
          await page.click('[data-fn="buyRemoval"]');
          break;
        }
        await page.click('[data-fn="leaveShop"]');
        break;
      }
      case 'treasure': {
        await once('treasure');
        if (await page.locator('[data-fn="openTreasure"]').count()) { await page.click('[data-fn="openTreasure"]'); await once('treasure-open'); break; }
        await page.click('[data-fn="leaveTreasure"]');
        break;
      }
      default:
        problems.push('unexpected screen ' + s.screen);
        break;
    }
  }
  report.nodeTypes = [...seenTypes];

  // ---- 図鑑 / 弱点分析 via the menu ----
  if (!(await fatalVisible())) {
    await page.click('[data-a="menu"]');
    await page.click('.sheet [data-a="openView"][data-view="codex"]');
    await page.waitForSelector('.codex-screen');
    await once('codex-cards');
    await checkHScroll('codex');
    for (const tab of ['enemies', 'reactions', 'notebook']) {
      await page.click(`[data-a="codexTab"][data-id="${tab}"]`);
      await once('codex-' + tab);
      await checkHScroll('codex-' + tab);
    }
    const nb = page.locator('.wrong-list summary');
    if (await nb.count()) { await nb.first().click(); await once('codex-notebook-open'); }
    await page.click('[data-a="back"]');
    await page.click('[data-a="menu"]');
    await page.click('.sheet [data-a="openView"][data-view="weakness"]');
    await page.waitForSelector('.weakness-screen');
    await once('weakness');
    await checkHScroll('weakness');
    await page.click('[data-a="back"]');
    await page.waitForSelector('.map-screen');
    // ---- defeat -> result screen (HP forced to 1 via the engine; clicks via UI) ----
    await page.evaluate(() => { const g = window.__chemyth.game; g.run.player.hp = 1; window.__chemyth.render(); });
    await page.locator('.mnode.avail').first().click();
    for (let k = 0; k < 80; k++) {
      if (await page.locator('.result-screen').count()) break;
      if (await fatalVisible()) { problems.push('fatal during defeat test'); break; }
      if (await page.locator('[data-a="continueQuiz"]').count()) { await page.click('[data-a="continueQuiz"]'); continue; }
      if (await page.locator('.modal.quiz .choice').count()) { await page.locator('.modal.quiz .choice').first().click(); continue; }
      if (await page.locator('#quiz-num').count()) { await page.fill('#quiz-num', '1'); await page.click('.numeric button[type="submit"]'); continue; }
      if (await page.locator('.modal.picker').count()) { await page.locator('.modal.picker [data-a="pickToggle"]').first().click(); await page.click('[data-a="pickConfirm"]'); continue; }
      if (await page.locator('[data-a="endTurn"]:not([disabled])').count()) { await page.click('[data-a="endTurn"]'); continue; }
      if (await page.locator('.reward-screen, .event-screen, .shop-screen, .rest-screen, .treasure-screen').count()) { problems.push('defeat test landed on a non-combat node'); break; }
      await sleep(50);
    }
    if (await page.locator('.result-screen').count()) {
      report.resultScreen = true;
      await once('result');
      await checkHScroll('result');
      const txt = await page.locator('.result-screen').innerText();
      if (!txt.includes('分野別正答率') || !txt.includes('成立させた反応') || !txt.includes('誤答一覧')) problems.push('result screen incomplete');
      await page.click('[data-a="finishToTitle"]');
      await page.waitForSelector('.title-screen');
      if (await page.locator('[data-a="continue"]').count()) problems.push('continue still offered after the run ended');
    } else problems.push('result screen not reached');
    // a throwing action must show the friendly overlay with a working "タイトルへ"
    await page.evaluate(() => window.__chemyth.act('__noSuchAction__'));
    if (!(await fatalVisible())) problems.push('error overlay not shown for a throwing action');
    else {
      await once('error-overlay');
      await page.click('.modal.fatal [data-a="fatalTitle"]');
      await page.waitForSelector('.title-screen');
      if (await fatalVisible()) problems.push('error overlay did not close');
    }
    await page.click('[data-a="openView"][data-view="settings"]');
    await page.waitForSelector('.settings-screen');
    await once('settings');
    await page.fill('#set-bed', '22:30');
    await page.locator('#set-bed').dispatchEvent('change');
    const bed = await page.evaluate(() => window.__chemyth.game.meta.settings.bedtime);
    if (bed !== '22:30') problems.push('bedtime setting not saved: ' + bed);
  }
  if (report.hscroll.length) problems.push('horizontal scroll: ' + report.hscroll.join(', '));
  if (!report.act1Cleared) problems.push('act 1 not cleared');
  if (!report.reload) problems.push('mid-combat reload not verified');
  if (!report.quizReload) problems.push('mid-quiz reload not verified');
  if (!report.quizzes.choice || !report.quizzes.numeric) problems.push('missing quiz type ' + JSON.stringify(report.quizzes));
  if (!report.quizzes.set) problems.push('no 大問 (set) quiz with lead text encountered');
  const missingTypes = ['battle', 'event', 'rest', 'shop', 'boss'].filter((t) => !seenTypes.has(t));
  if (missingTypes.length) problems.push('node types never visited: ' + missingTypes.join(','));
  await browser.close();
  return { report, problems };
}

const srv = await startServer();
const base = `http://127.0.0.1:${srv.address().port}${SUB}`;
log('serving', ROOT, 'at', base, '-> screenshots in', OUT);
const runs = [
  ['mobile', { width: 390, height: 844 }, { clock: new Date('2026-11-23T23:30:00'), expectBedtime: true }],
  ['desktop', { width: 1280, height: 800 }, { clock: new Date('2026-11-23T14:00:00') }],
].filter(([n]) => !args.only || args.only === n);
let failed = false;
for (const [name, vp, opts] of runs) {
  const t0 = Date.now();
  const { report, problems } = await runViewport(base, name, vp, opts);
  log(`\n[${name}] ${((Date.now() - t0) / 1000).toFixed(1)}s`, JSON.stringify(report));
  if (problems.length) { failed = true; log(`[${name}] PROBLEMS:\n  - ` + problems.join('\n  - ')); } else log(`[${name}] OK`);
}
srv.close();
process.exit(failed ? 1 : 0);
