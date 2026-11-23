// Labels and human-readable descriptions derived from engine constants/data.
import { constants as C } from '../engine/index.js';
import { chem, esc, numMarkup } from './chem.js';

export const TYPE_LABELS = { attack: '攻撃', skill: 'スキル', power: 'パワー', status: '状態異常', curse: '呪い' };
export const RARITY_LABELS = { starter: '初期', common: 'コモン', uncommon: 'アンコモン', rare: 'レア', special: '特殊', boss: 'ボス', shop: '購買部' };
export const CARD_FIELD_LABELS = { theory: '理論', inorganic: '無機', organic: '有機', polymer: '高分子', neutral: '共通' };
export const LEVEL_LABELS = { 1: 'L1 基礎', 2: 'L2 標準', 3: 'L3 京大' };
export const TARGET_LABELS = { enemy: '敵1体', all: '敵全体', self: '自分', none: '—' };
export const KEYWORD_LABELS = {
  exhaust: ['廃棄', '使用後、この戦闘から除外される。'],
  retain: ['保持', 'ターン終了時に捨てられず手札に残る。'],
  innate: ['初期手札', '戦闘開始時に必ず手札に入る。'],
  ethereal: ['揮発', 'ターン終了時に手札にあると除外される。'],
  unplayable: ['使用不可', 'このカードは使用できない。'],
};

export const NODE_INFO = {
  battle: { icon: '⚔️', label: '戦闘' },
  elite: { icon: '🔥', label: '強敵' },
  event: { icon: '❔', label: '演習室' },
  rest: { icon: '📖', label: '自習室' },
  shop: { icon: '🛒', label: '購買部' },
  treasure: { icon: '🧰', label: '器具庫' },
  boss: { icon: '👑', label: 'ボス' },
};

export const INTENT_INFO = {
  attack: { icon: '🗡️', label: '攻撃' },
  defend: { icon: '🛡️', label: '防御' },
  buff: { icon: '⬆️', label: '強化' },
  debuff: { icon: '⬇️', label: '妨害' },
  quiz: { icon: '❓', label: '出題' },
  special: { icon: '✴️', label: '特殊' },
};

export const STATUS_ICONS = {
  strength: '💪', dexterity: '🧱', weak: '💧', vulnerable: '⚡', frail: '🫥', poison: '☣️', precip: '⬇️',
  thorns: '🔥', buffer: '⚖️', chain: '🔗', catalyst: '⚙️', colloid: '🫧', excited: '✨', regen: '❇️',
};

export function fieldClass(field) {
  if (!field) return 'f-neutral';
  if (field.startsWith('theory')) return 'f-theory';
  return 'f-' + field;
}

export function fieldLabel(field) {
  return C.FIELD_LABELS[field] || CARD_FIELD_LABELS[field] || field || '';
}

export function statusLabel(id) {
  return C.STATUS_INFO[id]?.label || id;
}

export function costLabel(cost) {
  if (cost === null || cost === undefined) return '−';
  return String(cost);
}

export function pct(rate) {
  return rate == null ? '—' : Math.round(rate * 100) + '%';
}

export function actLabel(act) {
  return act >= C.FINAL_ACT ? '終' : String(act);
}

/** Tag label (markup) by id. */
export function tagLabel(db, id) {
  return db.tags.get(id)?.label || id;
}

/** Condition object -> markup string (for reaction lists). */
export function condText(db, when) {
  if (!when) return '常に';
  const parts = [];
  const tl = (t) => tagLabel(db, t);
  if (when.anyTags?.length) parts.push(when.anyTags.map(tl).join('・'));
  if (when.allTags?.length) parts.push(when.allTags.map(tl).join(' かつ '));
  if (when.noTags?.length) parts.push(when.noTags.map(tl).join('・') + ' なし');
  if (when.ph) {
    const { min, max } = when.ph;
    if (min != null && max != null) parts.push(`pH ${min}〜${max}`);
    else if (min != null) parts.push(`pH ${min}以上`);
    else if (max != null) parts.push(`pH ${max}以下`);
  }
  if (when.targetStatus) parts.push(`対象が${statusLabel(when.targetStatus)}`);
  if (when.selfStatus) parts.push(`自分が${statusLabel(when.selfStatus)}`);
  return parts.join('、') || '常に';
}

/** pH-rule range text */
export function phRangeText(r) {
  const min = r.min ?? 0; const max = r.max ?? 14;
  if (min === 0) return `pH ≤ ${max}`;
  if (max === 14) return `pH ≥ ${min}`;
  return `pH ${min}〜${max}`;
}

function who(t, side) {
  if (t === 'self') return side === 'enemy' ? '自身' : '自分';
  if (t === 'player') return 'あなた';
  if (t === 'all') return '敵全体';
  if (t === 'enemy') return side === 'enemy' ? 'あなた' : '敵';
  if (t === 'random') return 'ランダムな敵';
  return '';
}

/**
 * Describe an effect list as plain markup (enemy moves, potions, events).
 * opts.enemy: the acting enemy (hidden tags it hasn't revealed are masked).
 */
export function describeEffects(db, effects, opts = {}) {
  const side = opts.side || 'enemy';
  const enemy = opts.enemy || null;
  const maskTag = (t) => (enemy && enemy.hiddenTags?.includes(t) && !enemy.revealed?.includes(t) && !enemy.tags?.includes(t) ? '?' : tagLabel(db, t));
  const out = [];
  for (const e of effects || []) {
    switch (e.type) {
      case 'attack':
      case 'damage': {
        const t = e.times && e.times !== 1 ? `×${e.times}` : '';
        const sc = e.scale ? '（変動）' : '';
        out.push(`${e.amount ?? 0}${sc}ダメージ${t}${e.pierce ? '（貫通）' : ''}`);
        break;
      }
      case 'block': out.push(`ブロック${e.amount}`); break;
      case 'status': {
        const tgt = e.target ? who(e.target, side) + 'に' : '';
        out.push(`${tgt}${statusLabel(e.status)}${e.amount}`);
        break;
      }
      case 'ph': out.push(`pH${e.delta > 0 ? '+' : '−'}${Math.abs(e.delta)}`); break;
      case 'phSet': out.push(`pHを${e.value}に`); break;
      case 'heal': out.push(`HP${e.amount}回復`); break;
      case 'loseHp': out.push(`HP${e.amount}を失う`); break;
      case 'draw': out.push(`${e.amount}枚引く`); break;
      case 'energy': out.push(`エネルギー+${e.amount}`); break;
      case 'addCard': {
        const name = db.cards.get(e.cardId)?.name || e.cardId;
        const to = { hand: '手札', draw: '山札', discard: '捨て札' }[e.to] || '捨て札';
        out.push(`「${name}」×${e.count ?? 1}を${to}へ`);
        break;
      }
      case 'summon': out.push(`「${db.enemies.get(e.enemyId)?.name || '?'}」を呼ぶ`); break;
      case 'addTag': out.push(`性質［${maskTag(e.tag)}］を得る`); break;
      case 'removeTag': out.push(`性質［${maskTag(e.tag)}］を失う`); break;
      case 'transformTag': out.push(`［${maskTag(e.from)}］→［${tagLabel(db, e.to)}］`); break;
      case 'reveal': out.push('隠れた性質を公開'); break;
      case 'stripBlock': out.push('ブロックを0に'); break;
      case 'quiz': {
        const c = describeEffects(db, e.onCorrect, opts);
        const w = describeEffects(db, e.onWrong, opts);
        out.push(`出題（正解: ${c || 'なし'}／誤答: ${w || 'なし'}）`);
        break;
      }
      case 'gold': out.push(`研究費${e.amount > 0 ? '+' : ''}${e.amount}`); break;
      case 'maxHp': out.push(`最大HP${e.amount > 0 ? '+' : ''}${e.amount}`); break;
      case 'gainRelic': out.push('器具を得る'); break;
      case 'gainCard': out.push(e.cardId ? `「${db.cards.get(e.cardId)?.name || e.cardId}」を得る` : 'カードを得る'); break;
      case 'gainPotion': out.push('試薬瓶を得る'); break;
      case 'removeCard': out.push('カードを除去'); break;
      case 'upgradeCard': out.push('カードを強化'); break;
      case 'exhaustFromHand': out.push(`手札${e.count ?? 1}枚を除外`); break;
      case 'discardFromHand': out.push(`手札${e.count ?? 1}枚を捨てる`); break;
      case 'upgradeHand': out.push('手札を強化'); break;
      case 'power': out.push(`常在効果${e.name ? '「' + e.name + '」' : ''}`); break;
      default: break;
    }
  }
  return out.join('、');
}

/** Status chips (buttons) markup. owner: 'player' | enemy uid */
export function statusChips(statuses, owner) {
  const ids = Object.keys(statuses || {}).filter((k) => statuses[k]);
  if (!ids.length) return '';
  return ids.map((id) => {
    const n = statuses[id];
    const debuff = C.DEBUFFS.includes(id) || n < 0;
    return `<button class="chip status ${debuff ? 'debuff' : 'buff'}" data-a="status" data-id="${esc(id)}" data-n="${esc(n)}" aria-label="${esc(statusLabel(id))} ${esc(n)}"><span aria-hidden="true">${STATUS_ICONS[id] || '•'}</span><span>${esc(statusLabel(id))}</span><b>${esc(n)}</b></button>`;
  }).join('');
}

export function fmtDate(t) {
  if (!t) return '';
  try {
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch { return ''; }
}

/** Correct answer of a question as markup (numeric answers in ×10^n form). */
export function answerMarkup(q) {
  if (!q) return '';
  if (q.type === 'choice') return Array.isArray(q.choices) ? q.choices[q.answer] ?? '' : String(q.answer);
  const n = Number(q.answer);
  return (Number.isFinite(n) ? numMarkup(n) : String(q.answer)) + (q.unit ? ' ' + q.unit : '');
}

export { chem, esc };
