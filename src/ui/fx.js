// Light feedback for engine events: floating numbers, reaction/fizzle toasts.
// Short, tap-to-dismiss, and disabled when the user prefers reduced motion.
import { chem, esc } from './chem.js';

export function createFx(layer, appRoot, getPrefs, isBlocked = () => false, getKey = () => '') {
  const queue = [];
  const reduced = () => {
    try {
      return !getPrefs().anim || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch { return false; }
  };

  /** Toasts raised while a quiz/picker modal is open wait until it closes
      (they must never cover the question). Warnings show immediately. */
  function toast(html, kind = 'info', ms = 2600) {
    if (kind !== 'warn' && isBlocked()) { queue.push([html, kind, ms, getKey()]); if (queue.length > 4) queue.shift(); return null; }
    return show(html, kind, ms);
  }

  /** On phones during combat, float toasts over the pH/log area (never over enemies or the hand). */
  function place() {
    try {
      const mid = window.innerWidth < 900 ? appRoot.querySelector('.combat-mid') : null;
      if (mid) {
        const r = mid.getBoundingClientRect();
        layer.style.top = Math.max(56, r.top) + 'px';
        layer.style.bottom = 'auto';
        layer.style.flexDirection = 'column';
      } else {
        layer.style.top = ''; layer.style.bottom = ''; layer.style.flexDirection = '';
      }
    } catch { /* */ }
  }

  function flush() {
    if (isBlocked()) return;
    const key = getKey();
    while (queue.length) {
      const [html, kind, ms, k] = queue.shift();
      if (k === key) show(html, kind, ms); // stale (screen changed) -> dropped; the log keeps it
    }
  }

  function show(html, kind, ms) {
    for (const t of layer.querySelectorAll('.toast')) if (t.dataset.html === html) t.remove();
    place();
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.dataset.html = html;
    el.setAttribute('role', kind === 'warn' ? 'alert' : 'status');
    el.innerHTML = `<div class="toast-body">${html}</div><button class="toast-x" aria-label="通知を閉じる">✕</button>`;
    const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), reduced() ? 0 : 180); };
    el.addEventListener('click', close);
    layer.appendChild(el);
    // keep at most 2 (phones) / 3
    const all = layer.querySelectorAll('.toast');
    const max = window.innerWidth < 600 ? 2 : 3;
    for (let i = 0; i < all.length - max; i++) all[i].remove();
    setTimeout(close, ms);
    return el;
  }

  function unitEl(target) {
    if (target == null) return null;
    return appRoot.querySelector(`[data-unit="${CSS.escape(String(target))}"]`);
  }

  function float(target, text, cls, delay) {
    const host = unitEl(target);
    if (!host) return;
    setTimeout(() => {
      const s = document.createElement('span');
      s.className = `float ${cls}`;
      s.textContent = text;
      s.setAttribute('aria-hidden', 'true');
      host.appendChild(s);
      if (cls === 'dmg') { host.classList.remove('hit'); void host.offsetWidth; host.classList.add('hit'); }
      setTimeout(() => s.remove(), 1000);
    }, delay);
  }

  function events(evs, db) {
    if (!Array.isArray(evs) || !evs.length) return;
    const anim = !reduced();
    let n = 0;
    const step = () => Math.min(n++, 12) * 110;
    const reactions = [];
    for (const e of evs) {
      switch (e.type) {
        case 'damage':
          if (anim) {
            if (e.hpLoss > 0) float(e.target, `−${e.hpLoss}`, 'dmg', step());
            else if (e.blocked > 0) float(e.target, `🛡${e.blocked}`, 'blk', step());
          }
          break;
        case 'loseHp': if (anim && e.amount > 0) float(e.target, `−${e.amount}`, 'dmg', step()); break;
        case 'heal': if (anim) float(e.target, `+${e.amount}`, 'heal', step()); break;
        case 'block': if (anim) float(e.target, `🛡+${e.amount}`, 'blk', step()); break;
        case 'reaction': reactions.push(e); break;
        case 'fizzle':
          toast(`<b>反応しない</b> — ${chem(db.cards.get(e.cardId)?.name || '')}は不発（反応条件を満たさない）`, 'fizzle', 2600);
          break;
        case 'reveal': {
          const labels = (e.tags || []).map((t) => chem(db.tags.get(t)?.label || t)).join('・');
          toast(`🔍 隠れた性質が判明: <b>${labels}</b>`, 'reveal', 3200);
          break;
        }
        case 'phase': toast(`⚠ ${chem(e.msg || '')}`, 'reveal', 3000); break;
        case 'statusBlocked': toast(chem(e.msg || ''), 'info', 2200); break;
        case 'relicTrigger': break;
        default: break;
      }
    }
    const uniq = [];
    for (const r of reactions) if (!uniq.some((u) => u.cardId === r.cardId && u.index === r.index)) uniq.push(r);
    for (const r of uniq.slice(-2)) {
      const name = db.cards.get(r.cardId)?.name || '';
      toast(`<div class="rx-flash-title">⚗ 反応成立！ <span>${chem(name)}</span></div>${r.equation ? `<div class="equation">${chem(r.equation)}</div>` : r.explain ? `<div class="rx-flash-ex">${chem(r.explain)}</div>` : ''}`, 'reaction', 3600);
    }
  }

  return { toast, flush, events, plainToast: (msg, kind, ms) => toast(esc(msg), kind, ms) };
}
