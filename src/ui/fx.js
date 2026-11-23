// Light feedback for engine events: floating numbers, reaction/fizzle toasts.
// Short, tap-to-dismiss, and disabled when the user prefers reduced motion.
import { chem, esc } from './chem.js';

export function createFx(layer, appRoot, getPrefs) {
  const reduced = () => {
    try {
      return !getPrefs().anim || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch { return false; }
  };

  function toast(html, kind = 'info', ms = 2600) {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.setAttribute('role', kind === 'warn' ? 'alert' : 'status');
    el.innerHTML = `<div class="toast-body">${html}</div><button class="toast-x" aria-label="通知を閉じる">✕</button>`;
    const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), reduced() ? 0 : 180); };
    el.addEventListener('click', close);
    layer.appendChild(el);
    // keep at most 3
    const all = layer.querySelectorAll('.toast');
    if (all.length > 3) all[0].remove();
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
        case 'phase': toast(`⚠ ${chem(e.msg || '')}`, 'warn', 2800); break;
        case 'statusBlocked': toast(chem(e.msg || ''), 'info', 2200); break;
        case 'relicTrigger': break;
        default: break;
      }
    }
    for (const r of reactions.slice(-2)) {
      const name = db.cards.get(r.cardId)?.name || '';
      toast(`<div class="rx-flash-title">⚗ 反応成立！ <span>${chem(name)}</span></div>${r.equation ? `<div class="equation">${chem(r.equation)}</div>` : ''}${r.explain ? `<div class="rx-flash-ex">${chem(r.explain)}</div>` : ''}`, 'reaction', 4200);
    }
  }

  return { toast, events, plainToast: (msg, kind, ms) => toast(esc(msg), kind, ms) };
}
