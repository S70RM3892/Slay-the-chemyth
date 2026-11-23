#!/usr/bin/env node
// End-to-end test of online co-op through the real UI (Playwright + Chromium).
//
//   node tools/e2e-coop.mjs [--out=DIR] [--net=local|peer]
//
// Two pages (host: desktop viewport, guest: phone viewport). `--net=local` (default) uses the
// BroadcastChannel transport (no network); `--net=peer` uses real WebRTC through the PeerJS broker.
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
const OUT = path.resolve(args.out || path.join(os.tmpdir(), 'chemyth-e2e-coop'));
const NET = args.net === 'peer' ? 'peer' : 'local';
fs.mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const srv = await new Promise((resolve) => {
  const s = http.createServer((req, res) => {
    let u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (u.endsWith('/')) u += 'index.html';
    const f = path.join(ROOT, path.normalize(u));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  s.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${srv.address().port}/`;
const q = NET === 'local' ? '?net=local&seed=coop-e2e' : '?seed=coop-e2e';

const problems = [];
const check = (cond, msg) => { if (!cond) { problems.push(msg); console.log('  ✗', msg); } else console.log('  ✓', msg); };

const browser = await chromium.launch();
// local transport needs one browser context (BroadcastChannel); peer mode uses two separate ones
const ctxH = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const ctxG = NET === 'local' ? ctxH : await browser.newContext({ viewport: { width: 390, height: 844 } });
const H = await ctxH.newPage();
const G = await ctxG.newPage();
if (args.peerserver) { // e.g. --peerserver=127.0.0.1:9000 (a local `peerjs` broker) for sandboxes without internet
  const [host, port] = String(args.peerserver).split(':');
  for (const pg of [H]) await pg.context().addInitScript((o) => { globalThis.CHEMYTH_PEER_OPTIONS = o; }, { host, port: Number(port), path: '/', secure: false, config: { iceServers: [] } });
  if (ctxG !== ctxH) await ctxG.addInitScript((o) => { globalThis.CHEMYTH_PEER_OPTIONS = o; }, { host, port: Number(port), path: '/', secure: false, config: { iceServers: [] } });
}
await G.setViewportSize({ width: 390, height: 844 });
for (const [n, pg] of [['host', H], ['guest', G]]) {
  pg.on('console', (m) => { if (m.type() === 'error') problems.push(`[${n}] console: ${m.text()}`); });
  pg.on('pageerror', (e) => problems.push(`[${n}] pageerror: ${e.message}`));
}
const shot = (pg, name) => pg.screenshot({ path: path.join(OUT, name + '.png') });
const st = (pg) => pg.evaluate(() => { const a = window.__chemyth; const r = a.game.run; return { view: a.ui.view, screen: r?.screen, pending: r?.pending?.kind, turn: r?.combat?.turn, mine: a.coop.isMyTurn(), players: a.coop.state.players.length, role: a.coop.state.role, status: a.coop.state.status, hp: r?.player?.hp }; });

try {
  await H.goto(base + q);
  await H.click('[data-a="coopOpen"]');
  await H.fill('#coop-name', 'ホスト太郎');
  await shot(H, '01-host-entry');
  await H.click('[data-a="coopHost"]');
  await H.waitForSelector('.coop-code', { timeout: 30000 });
  const code = (await H.textContent('.coop-code')).trim();
  check(/^[A-Z2-9]{5}$/.test(code), `host got room code ${code}`);
  await shot(H, '02-host-lobby');

  // guest joins through the invite link (?room=CODE prefills the form)
  await G.goto(base + q + '&room=' + code);
  await G.waitForSelector('#coop-code');
  check((await G.inputValue('#coop-code')) === code, 'invite link prefills the room code');
  await G.fill('#coop-name', 'ゲスト花子');
  await shot(G, '03-guest-entry');
  await G.click('[data-form="coopJoin"] button[type="submit"]');
  await H.waitForFunction(() => window.__chemyth.coop.state.players.length === 2, null, { timeout: 30000 });
  await G.waitForFunction(() => window.__chemyth.coop.state.players.length === 2);
  await shot(H, '04-host-lobby-2p');
  await shot(G, '05-guest-lobby');

  await H.click('[data-a="coopStart"]:not([data-continue])');
  await G.waitForFunction(() => window.__chemyth.ui.view === 'run' && window.__chemyth.game.run?.screen === 'map');
  check((await st(H)).mine === true && (await st(G)).mine === false, 'floor 0: host leads, guest waits');
  await shot(G, '06-guest-map');

  // guest cannot move; host can
  await G.click('.mnode.avail');
  await G.waitForTimeout(300);
  check((await st(G)).screen === 'map', 'guest tap on the map is refused while the host leads');
  await H.click('.mnode.avail');
  await G.waitForFunction(() => window.__chemyth.game.run?.screen === 'combat');
  check((await st(H)).screen === 'combat', 'both entered combat');
  await shot(H, '07-host-combat');
  await shot(G, '08-guest-combat-waiting');

  // host plays a card then ends turn → guest controls turn 2
  const hpBefore = await H.evaluate(() => window.__chemyth.game.run.combat.enemies[0].hp);
  const uid = await H.evaluate(() => { const g = window.__chemyth.game; const c = g.run.combat; const e = c.enemies.find((x) => x.alive); const h = c.hand.find((x) => g.cardDef(x.id, x.upgraded).type === 'attack' && g.canPlayCard(x.uid, e.uid).ok); return h?.uid; });
  if (uid) {
    await H.click(`.hand [data-a="card"][data-uid="${uid}"]`);
    const sel = await H.evaluate(() => !!window.__chemyth.ui.selected);
    if (sel) await H.click('[data-a="enemy"]');
    await G.waitForFunction((hp) => { const c = window.__chemyth.game.run.combat; return !c || c.enemies[0].hp < hp || c.hand.length < 5; }, hpBefore);
    check(true, 'host card play is mirrored on the guest');
  }
  await H.click('[data-a="endTurn"]');
  await G.waitForFunction(() => { const r = window.__chemyth.game.run; return r.pending || r.screen !== 'combat' || r.combat.turn >= 2; });
  let s = await st(G);
  if (s.screen === 'combat' && !s.pending) {
    check(s.mine === true && (await st(H)).mine === false, 'turn 2: control passed to the guest');
    await shot(G, '09-guest-combat-my-turn');
    await H.click('[data-a="endTurn"]');
    await H.waitForTimeout(300);
    check((await st(H)).turn === 2, 'host cannot end the guest turn');
    await G.click('[data-a="endTurn"]');
    await H.waitForFunction(() => { const r = window.__chemyth.game.run; return r.pending || r.screen !== 'combat' || r.combat.turn >= 3; });
    check(true, 'guest ended its turn through the UI');
  }

  // chat (guest → host), sent through the drawer
  await G.click('[data-a="coopChatToggle"]');
  await G.fill('#cc-input', 'まず酸化数を確認しよう <b>x</b>');
  await G.press('#cc-input', 'Enter');
  await H.waitForFunction(() => window.__chemyth.coop.state.chat.some((m) => m.text.startsWith('まず酸化数')));
  await H.click('[data-a="coopChatToggle"]');
  await H.waitForSelector('.cc-msg:not(.sys)');
  const chatHtml = await H.innerHTML('.cc-log');
  check(chatHtml.includes('&lt;b&gt;x&lt;/b&gt;') && !chatHtml.includes('<b>x</b>'), 'chat text is escaped');
  await shot(H, '10-host-chat');
  await shot(G, '11-guest-chat');
  await H.click('[data-cc="close"]');
  await G.click('[data-cc="close"]');

  // force a quiz (numeric) on the host and solve it as a team: host wrong, guest right → team correct (1 of 2)
  const qinfo = await H.evaluate(async () => {
    const a = window.__chemyth; const g = a.game; const GG = g._G;
    if (GG.run.pending) return null;
    const { makeQuizPending } = await import('./src/engine/quiz.js');
    const qq = g.data.QUESTIONS.find((x) => x.type === 'numeric' && x.field === 'theory1');
    GG.run.pending = makeQuizPending(GG, qq, { onCorrect: [], onWrong: [], ctx: { side: 'player', source: 'system', actor: 'player', combat: false, depth: 0 } });
    a.coop.resync();
    return { id: qq.id, answer: qq.answer };
  });
  if (qinfo) {
    await G.waitForSelector('#quiz-num');
    await H.waitForSelector('#quiz-num');
    await shot(G, '12-guest-quiz');
    await G.fill('#quiz-num', String(qinfo.answer));
    await H.fill('#quiz-num', '12');           // host is still typing when the guest submits
    await G.click('[data-form="numeric"] button[type="submit"]');
    await H.waitForFunction(() => window.__chemyth.coop.state.quiz.answered.length === 1);
    check((await H.inputValue('#quiz-num')) === '12', 'host draft survives the guest submitting');
    check((await H.textContent('#coop-quiz-status')).includes('1/2'), 'host sees 1/2 answered');
    await shot(G, '13-guest-quiz-waiting');
    await H.fill('#quiz-num', String(qinfo.answer * 5 + 3));
    await H.click('[data-form="numeric"] button[type="submit"]');
    await G.waitForSelector('.coop-team');
    await H.waitForSelector('.coop-team');
    check((await H.textContent('.verdict')).includes('チーム正解'), 'team verdict: correct with 1 of 2');
    const nb = await Promise.all([H, G].map((pg) => pg.evaluate((id) => !!window.__chemyth.game.meta.notebook[id], qinfo.id)));
    if (NET === 'peer') check(nb[0] === true && nb[1] === false, 'only the host (who was wrong) got the question in the notebook');
    await shot(H, '14-host-quiz-result');
    await shot(G, '15-guest-quiz-result');
    await G.click('[data-a="continueQuiz"]');
    await G.waitForTimeout(300);
    check((await st(H)).pending === 'quizResult', 'explanation stays until everybody is ready');
    await H.click('[data-a="continueQuiz"]');
    await G.waitForFunction(() => !window.__chemyth.game.run.pending);
    check(true, 'quiz closed after both pressed 次へ');
  }

  // host leaves → guest is returned to the lobby screen with a notice
  await H.click('[data-a="menu"]');
  await H.click('[data-a="coopLeaveConfirm"]');
  await H.click('[data-a="coopLeaveConfirmed"]');
  await G.waitForFunction(() => window.__chemyth.coop.state.status !== 'playing' && !window.__chemyth.game.run, null, { timeout: 15000 });
  s = await st(G);
  check(s.view === 'coop' && s.role === null, 'guest is back on the co-op screen after the host closed the room');
  await shot(G, '16-guest-closed');
  check((await st(H)).view === 'title', 'host is back on the title');
  check(await H.evaluate(() => window.__chemyth.game.hasSavedRun()), 'host keeps the run as a normal save');
} catch (err) {
  problems.push('exception: ' + (err.stack || err.message));
  try { await shot(H, 'zz-host-fail'); await shot(G, 'zz-guest-fail'); } catch { /* */ }
}
await browser.close();
srv.close();
console.log(`\nnet=${NET}  screenshots: ${OUT}`);
if (problems.length) { console.log('PROBLEMS:\n' + problems.map((p) => ' - ' + p).join('\n')); process.exit(1); }
console.log('co-op e2e: OK');
