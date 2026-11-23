// UI controller: holds UI-only state, renders purely from game.run / game.meta,
// routes taps to engine actions, and shows feedback for returned events.
import { constants as C } from '../engine/index.js';
import { chem, esc } from './chem.js';
import {
  topbar, bedtimeBanner, renderSheet, quizModal, pickerModal, fatalOverlay,
} from './components.js';
import { statusLabel, tagLabel } from './format.js';
import { createFx } from './fx.js';
import { titleView, settingsView } from './views/title.js';
import { mapView } from './views/map.js';
import { combatView, powerInfo } from './views/combat.js';
import { rewardView, eventView, restView, shopView, treasureView, resultView } from './views/nodes.js';
import { codexView, weaknessView } from './views/codex.js';

const PREFS_KEY = 'chemyth.ui';

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const p = raw ? JSON.parse(raw) : {};
    return { anim: p.anim !== false, logOpen: !!p.logOpen };
  } catch { return { anim: true, logOpen: false }; }
}
function savePrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function startApp({ createGame, DATA, root = document }) {
  const appEl = root.getElementById('app');
  const overlayEl = root.getElementById('overlay');
  const fxEl = root.getElementById('fx');

  let game;
  const prefs = loadPrefs();
  const ui = {
    view: 'title', back: 'title', titleMode: 'main', newDifficulty: null,
    selected: null, sheets: [], pick: new Set(), pickKey: null,
    bedtimeKey: null, codexTab: 'cards', codexField: 'all', codexRarity: 'all',
    quizDraft: null, leadOpen: true, logOpen: prefs.logOpen, prefs,
    fatal: null, lastScreenKey: null, reloadOnContinue: false,
  };
  const fx = createFx(fxEl, appEl, () => ui.prefs, () => !!overlayEl.querySelector('.modal.quiz, .modal.picker, .modal.fatal'), () => screenKey());
  const params = (() => { try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); } })();

  try {
    game = createGame({ data: DATA });
  } catch (err) {
    overlayEl.innerHTML = fatalOverlay(err);
    return null;
  }
  if (!ui.newDifficulty) ui.newDifficulty = game.meta.settings.difficulty || 'hyojun';

  // -------------------------------------------------------------------------
  // rendering
  // -------------------------------------------------------------------------

  function ctx() {
    return { game, ui, db: game.db, run: game.run, meta: game.meta };
  }

  function screenKey() {
    const r = game.run;
    if (ui.view !== 'run' || !r) return ui.view + ':' + (ui.view === 'codex' ? ui.codexTab : '');
    return `run:${r.act}:${r.floor}:${r.screen}`;
  }

  function runBody(c) {
    const r = c.run;
    switch (r.screen) {
      case 'map': return mapView(c);
      case 'combat': return combatView(c);
      case 'reward': return rewardView(c);
      case 'event': return eventView(c);
      case 'rest': return restView(c);
      case 'shop': return shopView(c);
      case 'treasure': return treasureView(c);
      case 'victory':
      case 'gameOver': return resultView(c);
      default: return `<main class="screen"><p>${esc(r.screen)}</p></main>`;
    }
  }

  function bedtimeKeyRun() {
    const r = game.run;
    return r ? `run:${r.act}:${r.position}:${r.floor}` : 'run';
  }

  function appHtml(c) {
    if (ui.view === 'title') return titleView(c);
    if (ui.view === 'settings') return settingsView(c);
    if (ui.view === 'codex') return codexView(c);
    if (ui.view === 'weakness') return weaknessView(c);
    const r = c.run;
    if (!r) { ui.view = 'title'; return titleView(c); }
    const ended = r.screen === 'victory' || r.screen === 'gameOver';
    const key = bedtimeKeyRun();
    const banner = !ended && ui.bedtimeKey !== key ? bedtimeBanner(game.bedtimeWarning()) : '';
    return `${ended ? '' : topbar(c)}${banner}${runBody(c)}`;
  }

  function overlayHtml(c) {
    if (ui.fatal) return fatalOverlay(ui.fatal);
    let html = '';
    const p = ui.view === 'run' ? c.run?.pending : null;
    if (p) {
      if (p.kind === 'quiz' || p.kind === 'quizResult') html += quizModal(c, p);
      else if (p.kind === 'selectCards') {
        const k = p.purpose + ':' + p.options.join(',');
        if (ui.pickKey !== k) { ui.pickKey = k; ui.pick = new Set(); }
        html += pickerModal(c, p);
      }
    }
    if (ui.sheets.length) html += `<div class="sheet-layer">${renderSheet(c, ui.sheets[ui.sheets.length - 1])}</div>`;
    return html;
  }

  function focusKey(el) {
    if (!el || el === document.body) return null;
    if (el.id) return '#' + el.id;
    const d = el.dataset || {};
    if (!d.a) return null;
    return [d.a, d.fn, d.arg, d.id, d.i, d.uid, d.slot, d.pile, d.view, d.mode].map((x) => x ?? '').join('|');
  }
  function findByFocusKey(k) {
    if (!k) return null;
    if (k.startsWith('#')) return document.getElementById(k.slice(1));
    for (const el of document.querySelectorAll('[data-a]')) if (focusKey(el) === k) return el;
    return null;
  }

  function render() {
    try {
      const c = ctx();
      const sk = screenKey();
      const changed = sk !== ui.lastScreenKey;
      const scroll = {};
      document.querySelectorAll('[data-scroll-key]').forEach((el) => { scroll[el.dataset.scrollKey] = [el.scrollTop, el.scrollLeft]; });
      const fk = focusKey(document.activeElement);
      const hadModal = !!overlayEl.querySelector('.modal, .sheet');

      appEl.innerHTML = appHtml(c);
      appEl.dataset.view = ui.view;
      appEl.dataset.screen = ui.view === 'run' && c.run ? c.run.screen : ui.view;
      overlayEl.innerHTML = overlayHtml(c);
      const modal = overlayEl.querySelector('.modal, .sheet');
      document.body.classList.toggle('modal-open', !!modal);
      document.body.classList.toggle('no-anim', !ui.prefs.anim);
      // inert background while a modal is open
      if (modal) appEl.setAttribute('inert', ''); else appEl.removeAttribute('inert');

      if (!changed) {
        document.querySelectorAll('[data-scroll-key]').forEach((el) => {
          const s = scroll[el.dataset.scrollKey];
          if (s) { el.scrollTop = s[0]; el.scrollLeft = s[1]; }
        });
      } else {
        window.scrollTo(0, 0);
        ui.lastScreenKey = sk;
        if (ui.view !== 'run') fxEl.querySelectorAll('.toast').forEach((t) => t.remove());
        if (c.run && ui.view === 'run' && c.run.screen === 'map') {
          const target = appEl.querySelector('.mnode.avail') || appEl.querySelector('.mnode.current');
          const wrap = appEl.querySelector('.map-wrap');
          if (target && wrap) {
            const top = target.offsetTop - wrap.clientHeight / 2;
            wrap.scrollTop = Math.max(0, top);
          }
        }
      }
      document.querySelectorAll('[data-autoscroll]').forEach((el) => { el.scrollTop = el.scrollHeight; });
      if (!overlayEl.querySelector('.modal')) fx.flush();
      else fxEl.querySelectorAll('.toast:not(.warn)').forEach((t) => t.remove());

      // focus management
      const again = findByFocusKey(fk);
      if (modal && (!again || !modal.contains(again))) {
        if (!hadModal || !modal.contains(document.activeElement)) {
          const f = modal.querySelector('#quiz-q, .sheet-title, #picker-title, #fatal-title, button');
          if (f) f.focus({ preventScroll: true });
        }
      } else if (again && again !== document.activeElement) {
        again.focus({ preventScroll: true });
      }
    } catch (err) {
      showFatal(err);
    }
  }

  function showFatal(err) {
    try { console.warn('[chemyth ui]', err); } catch { /* */ }
    ui.fatal = err || new Error('unknown');
    ui.sheets = [];
    try {
      overlayEl.innerHTML = fatalOverlay(ui.fatal);
      appEl.setAttribute('inert', '');
      const f = overlayEl.querySelector('#fatal-title');
      if (f) f.focus();
    } catch { /* last resort */ }
  }

  // -------------------------------------------------------------------------
  // actions
  // -------------------------------------------------------------------------

  function act(fn, ...args) {
    let res;
    try {
      if (typeof game[fn] !== 'function') throw new Error('unknown action ' + fn);
      res = game[fn](...args);
    } catch (err) {
      showFatal(err);
      return null;
    }
    res = res || { ok: true, events: [] };
    if (!res.ok && res.error) {
      if (String(res.error).startsWith('[engine]')) { showFatal(new Error(res.error)); return res; }
      fx.plainToast(res.error, 'warn', 2400);
    }
    if (res.ok) {
      ui.selected = null;
      ui.sheets = [];
    }
    render();
    try { fx.events(res.events, game.db); } catch { /* feedback is optional */ }
    return res;
  }

  function openSheet(s, push = false) {
    if (push) ui.sheets.push(s); else ui.sheets = [s];
    render();
  }

  function info(title, body, push = false) {
    openSheet({ type: 'info', title, body, back: push }, push);
  }

  function startNewRun() {
    try {
      if (game.run && !game.run.result) game.abandonRun();
      else if (game.hasSavedRun()) { game.continueRun(); game.abandonRun(); }
    } catch (err) { showFatal(err); return; }
    const d = ui.newDifficulty || 'hyojun';
    game.setSetting('difficulty', d);
    const opts = { difficulty: d };
    const seed = params.get('seed');
    if (seed) opts.seed = seed;
    ui.view = 'run';
    ui.titleMode = 'main';
    ui.sheets = [];
    ui.bedtimeKey = null;
    act('newRun', opts);
  }

  function goTitle() {
    ui.view = 'title';
    ui.titleMode = 'main';
    ui.selected = null;
    ui.sheets = [];
    ui.bedtimeKey = null;
    render();
  }

  const H = {
    noop() {},
    do(el) {
      const fn = el.dataset.fn;
      let arg = el.dataset.arg;
      if (arg !== undefined && /^-?\d+$/.test(arg)) arg = Number(arg);
      if (arg === undefined) act(fn); else act(fn, arg);
    },
    // ---- title ----
    titleMode(el) { ui.titleMode = el.dataset.mode; render(); },
    pickDiff(el) { ui.newDifficulty = el.dataset.id; render(); },
    startRun() {
      const has = (game.run && !game.run.result) || safe(() => game.hasSavedRun());
      if (has) {
        openSheet({ type: 'confirm', title: '新しく始める', body: '中断中のランは放棄され、敗北として記録されます。よろしいですか？', yes: 'startRunConfirmed', yesLabel: '放棄して始める', danger: true });
      } else startNewRun();
    },
    startRunConfirmed() { ui.sheets = []; startNewRun(); },
    continue() {
      ui.sheets = [];
      if (!game.run || game.run.result || ui.reloadOnContinue) {
        let res;
        try { res = game.continueRun(); } catch (err) { showFatal(err); return; }
        ui.reloadOnContinue = false;
        if (!res.ok) { fx.plainToast(res.error || '再開できない', 'warn'); render(); return; }
      }
      ui.view = 'run';
      ui.bedtimeKey = null;
      render();
    },
    openView(el) {
      const v = el.dataset.view;
      if (ui.view !== v) ui.back = ui.view === 'run' || ui.view === 'title' ? ui.view : ui.back;
      ui.view = v;
      ui.sheets = [];
      render();
    },
    back() {
      ui.view = ui.back && ui.back !== ui.view ? ui.back : 'title';
      if (ui.view === 'run' && !game.run) ui.view = 'title';
      if (ui.view === 'title') ui.bedtimeKey = null;
      render();
    },
    dismissBedtime() {
      ui.bedtimeKey = ui.view === 'title' ? 'title' : bedtimeKeyRun();
      render();
    },
    // ---- map ----
    node(el) { ui.bedtimeKey = null; act('chooseNode', el.dataset.id); },
    // ---- combat ----
    card(el) {
      const uid = el.dataset.uid;
      const c = game.run?.combat;
      if (!c) return;
      if (ui.selected?.kind === 'card' && ui.selected.uid === uid) { ui.selected = null; render(); return; }
      const inst = c.hand.find((x) => x.uid === uid);
      if (!inst) return;
      const chk = game.canPlayCard(uid);
      if (!chk.ok && !chk.needsTarget) {
        fx.plainToast(chk.reason || '使えない', 'warn', 1800);
        const host = el.closest('.card');
        if (host) { host.classList.remove('shake'); void host.offsetWidth; host.classList.add('shake'); }
        return;
      }
      if (chk.needsTarget) { ui.selected = { kind: 'card', uid }; render(); return; }
      act('playCard', uid);
    },
    enemy(el) {
      const uid = el.dataset.uid;
      if (ui.selected?.kind === 'card') { const s = ui.selected.uid; act('playCard', s, uid); return; }
      if (ui.selected?.kind === 'potion') { const s = ui.selected.slot; act('usePotion', s, uid); return; }
      openSheet({ type: 'enemy', uid });
    },
    cancelSelect() { ui.selected = null; render(); },
    endTurn() { ui.selected = null; act('endTurn'); },
    toggleLog() { ui.logOpen = !ui.logOpen; ui.prefs.logOpen = ui.logOpen; savePrefs(ui.prefs); render(); },
    pile(el) { openSheet({ type: 'pile', pile: el.dataset.pile }); },
    status(el) {
      const id = el.dataset.id;
      const d = C.STATUS_INFO[id];
      info(esc(statusLabel(id)) + ' ' + esc(el.dataset.n || ''), `<p>${esc(d?.desc || '')}</p>${C.DEBUFFS.includes(id) ? '<p class="note">デバフ（保護コロイドで無効化できる）</p>' : ''}`, ui.sheets.length > 0);
    },
    tag(el) {
      const t = game.db.tags.get(el.dataset.id);
      info(chem(tagLabel(game.db, el.dataset.id)), `<p>${chem(t?.desc || '')}</p>`, ui.sheets.length > 0);
    },
    hiddenTag() {
      info('隠れた性質（?）', '<p>まだ判明していない性質タグ。反応の条件判定には使われるので、試薬が「反応成立」すれば判明する。検出試薬（銀鏡反応・ヨードホルム反応・塩化鉄(III)など）の「公開」効果でも明らかになる。</p><p class="note">構造決定そのもの: 反応する／しないの結果から官能基を推理しよう。</p>', ui.sheets.length > 0);
    },
    power(el) {
      const p = powerInfo(ctx(), Number(el.dataset.i));
      if (p) info(p.title, p.body);
    },
    cardInfo(el) {
      openSheet({ type: 'card', id: el.dataset.id, upgraded: el.dataset.up === '1', back: ui.sheets.length > 0 }, ui.sheets.length > 0);
    },
    // ---- potions ----
    potion(el) { openSheet({ type: 'potion', slot: Number(el.dataset.slot) }); },
    usePotion(el) {
      const slot = Number(el.dataset.slot);
      const chk = game.canUsePotion(slot);
      if (chk.needsTarget) { ui.sheets = []; ui.selected = { kind: 'potion', slot }; render(); return; }
      act('usePotion', slot);
    },
    discardPotion(el) {
      const slot = Number(el.dataset.slot);
      openSheet({ type: 'confirm', title: '試薬瓶を捨てる', body: 'この試薬瓶を捨てますか？', yes: 'discardPotionConfirmed', data: { slot }, yesLabel: '捨てる', danger: true });
    },
    discardPotionConfirmed(el) { act('discardPotion', Number(el.dataset.slot)); },
    // ---- quiz ----
    answerChoice(el) { act('answerQuiz', Number(el.dataset.i)); },
    ins(el) {
      const input = document.getElementById('quiz-num');
      if (!input) return;
      const t = el.dataset.t;
      const s = input.selectionStart ?? input.value.length;
      const e = input.selectionEnd ?? input.value.length;
      input.value = input.value.slice(0, s) + t + input.value.slice(e);
      const pos = s + t.length;
      try { input.setSelectionRange(pos, pos); } catch { /* */ }
      input.focus();
      saveDraft(input);
    },
    clr() {
      const input = document.getElementById('quiz-num');
      if (!input) return;
      input.value = '';
      input.focus();
      saveDraft(input);
    },
    continueQuiz() { ui.quizDraft = null; act('continueQuiz'); },
    toggleLead() { ui.leadOpen = !ui.leadOpen; render(); },
    // ---- picker ----
    pickToggle(el) {
      const p = game.run?.pending;
      if (!p || p.kind !== 'selectCards') return;
      const uid = el.dataset.uid;
      if (ui.pick.has(uid)) ui.pick.delete(uid);
      else {
        if (p.count === 1) ui.pick.clear();
        if (ui.pick.size < p.count) ui.pick.add(uid);
      }
      render();
    },
    pickConfirm() { const uids = [...ui.pick]; ui.pick = new Set(); act('selectCards', uids); },
    pickCancel() { ui.pick = new Set(); act('cancelSelection'); },
    // ---- reward ----
    rewardCard(el) {
      const i = Number(el.dataset.i);
      const id = game.run.reward.cards[i];
      openSheet({ type: 'card', id, upgraded: false, actions: [{ label: 'デッキに加える', a: 'do', data: { fn: 'pickRewardCard', arg: i }, primary: true }] });
    },
    // ---- rest ----
    restOpt(el) { act('chooseRestOption', el.dataset.id); },
    // ---- shop ----
    shopCard(el) {
      const i = Number(el.dataset.i);
      const it = game.run.shop.cards[i];
      const poor = game.run.player.gold < it.price;
      openSheet({ type: 'card', id: it.cardId, upgraded: false, actions: [{ label: poor ? `研究費不足（${it.price}）` : `購入する（💰${it.price}）`, a: 'do', data: { fn: 'buyCard', arg: i }, primary: true, disabled: poor || it.sold }] });
    },
    shopRelic(el) {
      const i = Number(el.dataset.i);
      const it = game.run.shop.relics[i];
      const poor = game.run.player.gold < it.price;
      openSheet({ type: 'relic', id: it.relicId, actions: [{ label: poor ? `研究費不足（${it.price}）` : `購入する（💰${it.price}）`, a: 'do', data: { fn: 'buyRelic', arg: i }, primary: true, disabled: poor || it.sold }] });
    },
    shopPotion(el) {
      const i = Number(el.dataset.i);
      const it = game.run.shop.potions[i];
      const poor = game.run.player.gold < it.price;
      const full = !game.run.potions.includes(null);
      openSheet({ type: 'potion', potionId: it.potionId, actions: [{ label: full ? 'スロット満杯' : poor ? `研究費不足（${it.price}）` : `購入する（💰${it.price}）`, a: 'do', data: { fn: 'buyPotion', arg: i }, primary: true, disabled: poor || full || it.sold }] });
    },
    relicInfo(el) { openSheet({ type: 'relic', id: el.dataset.id }); },
    relics() { openSheet({ type: 'relics' }); },
    // ---- menu / sheets ----
    menu() { openSheet({ type: 'menu' }); },
    closeSheet() { ui.sheets.pop(); render(); },
    closeAllSheets() { ui.sheets = []; render(); },
    toTitle() { goTitle(); },
    confirmAbandon() {
      openSheet({ type: 'confirm', title: 'ランを放棄', body: '現在のランを終了し、敗北として記録します。誤答ノートや正答率は残ります。', yes: 'abandonConfirmed', yesLabel: '放棄する', danger: true });
    },
    abandonConfirmed() {
      try { game.abandonRun(); } catch (err) { showFatal(err); return; }
      goTitle();
    },
    finishToTitle() { try { game.closeRun(); } catch { /* */ } goTitle(); },
    confirmResetMeta() {
      openSheet({ type: 'confirm', title: '学習記録を消去', body: '誤答ノート・正答率・反応ノート・図鑑の記録をすべて消去します。元に戻せません。', yes: 'resetMetaConfirmed', yesLabel: '消去する', danger: true });
    },
    resetMetaConfirmed() { game.resetMeta(); ui.sheets = []; fx.plainToast('学習記録を消去した', 'info'); render(); },
    // ---- codex ----
    codexTab(el) { ui.codexTab = el.dataset.id; render(); },
    codexFilter(el) {
      if (el.dataset.k === 'field') ui.codexField = el.dataset.id; else ui.codexRarity = el.dataset.id;
      render();
    },
    // ---- fatal ----
    fatalTitle() {
      ui.fatal = null;
      ui.reloadOnContinue = true;
      goTitle();
    },
    reload() { try { location.reload(); } catch { /* */ } },
  };

  function safe(f) { try { return f(); } catch { return false; } }

  function saveDraft(input) {
    const p = game.run?.pending;
    if (p && p.kind === 'quiz') ui.quizDraft = { qid: p.questionId, value: input.value };
  }

  // -------------------------------------------------------------------------
  // DOM wiring (event delegation)
  // -------------------------------------------------------------------------

  let suppressClick = false;
  let lpTimer = null;

  function handle(el, ev) {
    const a = el.dataset.a;
    const fn = H[a];
    if (!fn) return;
    try { fn(el, ev); } catch (err) { showFatal(err); }
  }

  document.addEventListener('click', (ev) => {
    if (suppressClick) { suppressClick = false; ev.preventDefault(); ev.stopPropagation(); return; }
    const el = ev.target.closest('[data-a]');
    if (!el || el.disabled) return;
    if (el.closest('[inert]')) return;
    ev.preventDefault();
    handle(el, ev);
  });

  // long-press on a card -> detail sheet
  document.addEventListener('pointerdown', (ev) => {
    const el = ev.target.closest('[data-lp="card"]');
    if (!el || ev.button > 0) return;
    clearTimeout(lpTimer);
    const sx = ev.clientX; const sy = ev.clientY;
    const cancel = () => { clearTimeout(lpTimer); el.removeEventListener('pointerup', cancel); el.removeEventListener('pointerleave', cancel); el.removeEventListener('pointermove', move); };
    const move = (e) => { if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) cancel(); };
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointermove', move);
    lpTimer = setTimeout(() => {
      cancel();
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 700);
      openSheet({ type: 'card', id: el.dataset.id, upgraded: el.dataset.up === '1', back: ui.sheets.length > 0 }, ui.sheets.length > 0);
    }, 480);
  });
  document.addEventListener('contextmenu', (ev) => {
    const el = ev.target.closest('[data-lp="card"]');
    if (el) ev.preventDefault();
  });

  document.addEventListener('submit', (ev) => {
    const form = ev.target.closest('[data-form="numeric"]');
    if (!form) return;
    ev.preventDefault();
    const input = form.querySelector('input');
    const v = (input?.value || '').trim();
    if (!v) { fx.plainToast('答えを入力してください', 'warn', 1800); input?.focus(); return; }
    act('answerQuiz', v);
  });

  document.addEventListener('input', (ev) => {
    if (ev.target.matches('[data-input="quizDraft"]')) saveDraft(ev.target);
  });

  document.addEventListener('change', (ev) => {
    const t = ev.target;
    try {
      if (t.matches('[data-setting]')) {
        const key = t.dataset.setting;
        if ((key === 'bedtime' || key === 'wakeTime') && !/^\d{1,2}:\d{2}$/.test(t.value)) return;
        game.setSetting(key, t.value);
        if (key === 'difficulty') ui.newDifficulty = t.value;
        fx.plainToast('設定を保存した', 'info', 1400);
      } else if (t.matches('[data-pref]')) {
        ui.prefs[t.dataset.pref] = t.value === '1';
        savePrefs(ui.prefs);
        render();
      }
    } catch (err) { showFatal(err); }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (ui.sheets.length) { ui.sheets.pop(); render(); return; }
      if (ui.selected) { ui.selected = null; render(); }
    }
  });

  window.addEventListener('error', (ev) => {
    // errors thrown outside our handlers (should not happen) -> friendly overlay
    try {
      if (ev?.error && (!ev.filename || ev.filename.startsWith(location.origin))) showFatal(ev.error);
    } catch { /* */ }
  });

  render();

  const api = { game, ui, render, act };
  try { window.__chemyth = api; } catch { /* */ }
  return api;
}
