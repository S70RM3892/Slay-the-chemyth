// Chat drawer for co-op. Lives outside the main render loop so that typing
// (including Japanese IME composition) is never interrupted by re-renders.
import { esc } from './chem.js';
import { shareUrl } from './views/coop.js';

export function createCoopChat({ coop, onToggle, onLeave, toast }) {
  const el = document.createElement('aside');
  el.id = 'coop-chat';
  el.className = 'coop-chat';
  el.hidden = true;
  el.setAttribute('aria-label', 'チャットと参加者');
  el.innerHTML = `<div class="cc-head">
      <h2>チャット</h2>
      <button class="icon-btn" type="button" data-cc="close" aria-label="チャットを閉じる">✕</button>
    </div>
    <div class="cc-room"></div>
    <div class="cc-log" tabindex="0" aria-live="polite"></div>
    <form class="cc-form" autocomplete="off">
      <label class="sr-only" for="cc-input">メッセージ</label>
      <input id="cc-input" type="text" maxlength="200" placeholder="メッセージ（解法の相談など）" enterkeyhint="send">
      <button class="btn primary" type="submit">送信</button>
    </form>
    <button class="btn danger small cc-leave" type="button" data-cc="leave">部屋を出る</button>`;
  document.body.appendChild(el);
  const logEl = el.querySelector('.cc-log');
  const roomEl = el.querySelector('.cc-room');
  const input = el.querySelector('#cc-input');
  let shown = 0;

  function renderRoom() {
    const s = coop.state;
    const ctl = coop.controllerId();
    roomEl.innerHTML = `<div class="cc-code">部屋 <b>${esc(s.code)}</b>
        <button class="btn small" type="button" data-cc="copy">招待リンクをコピー</button></div>
      <div class="cc-players">${s.players.map((p) => `<span class="cc-p${p.id === ctl ? ' ctl' : ''}">${esc(p.name)}${p.id === s.selfId ? '（あなた）' : ''}${p.id === ctl ? ' ▶' : ''}</span>`).join('')}</div>`;
  }

  function renderLog(force = false) {
    const chat = coop.state.chat;
    if (chat.length >= 60) force = true; // rolling window on the host: rebuild
    if (force || chat.length < shown) { logEl.innerHTML = ''; shown = 0; }
    const nearEnd = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 60;
    for (; shown < chat.length; shown++) {
      const m = chat[shown];
      const row = document.createElement('p');
      row.className = 'cc-msg' + (m.system ? ' sys' : m.id === coop.state.selfId ? ' me' : '');
      row.innerHTML = m.system ? esc(m.text) : `<b>${esc(m.name)}</b> ${esc(m.text)}`;
      logEl.appendChild(row);
    }
    if (nearEnd || force) logEl.scrollTop = logEl.scrollHeight;
  }

  el.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    coop.chat(v);
    input.value = '';
    input.focus();
  });
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-cc]');
    if (!b) return;
    if (b.dataset.cc === 'close') api.close();
    else if (b.dataset.cc === 'leave') onLeave();
    else if (b.dataset.cc === 'copy') {
      const url = shareUrl(coop.state.code);
      (navigator.clipboard?.writeText(url) || Promise.reject()).then(() => toast('招待リンクをコピーした'), () => toast('コピーできなかった。コード: ' + coop.state.code));
    }
  });
  el.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); api.close(); } });

  const api = {
    get isOpen() { return !el.hidden; },
    open() { el.hidden = false; renderRoom(); renderLog(true); onToggle(true); try { input.focus({ preventScroll: true }); } catch { /* */ } },
    close() { if (el.hidden) return; el.hidden = true; onToggle(false); },
    toggle() { if (el.hidden) api.open(); else api.close(); },
    /** call on any coop update */
    update(type) {
      if (el.hidden) return;
      if (type === 'chat') renderLog(); else renderRoom();
    },
    reset() { el.hidden = true; logEl.innerHTML = ''; shown = 0; input.value = ''; },
  };
  return api;
}
