// Shared UI components (pure: state -> HTML string). Every data string goes
// through chem() (or esc() for non-data/plain values).
import { constants as C } from '../engine/index.js';
import { chem, esc, numMarkup } from './chem.js';
import {
  TYPE_LABELS, RARITY_LABELS, CARD_FIELD_LABELS, KEYWORD_LABELS, TARGET_LABELS, LEVEL_LABELS,
  fieldClass, fieldLabel, costLabel, condText, describeEffects, statusChips, actLabel, tagLabel, phRangeText,
  INTENT_INFO, STATUS_ICONS,
} from './format.js';

// ---------------------------------------------------------------------------
// small pieces
// ---------------------------------------------------------------------------

/** data attributes from an object */
export function attrs(o) {
  if (!o) return '';
  return Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => ` data-${k}="${esc(v === true ? '1' : v)}"`).join('');
}

/** Button calling an engine action directly: game[fn](arg). */
export function doBtn(label, fn, arg, { cls = 'btn', disabled = false, aria = null, html = false } = {}) {
  return `<button class="${cls}" data-a="do" data-fn="${esc(fn)}"${arg !== undefined && arg !== null ? ` data-arg="${esc(arg)}"` : ''}${disabled ? ' disabled' : ''}${aria ? ` aria-label="${esc(aria)}"` : ''}>${html ? label : esc(label)}</button>`;
}

export function hpBar(hp, max, { block = 0, cls = '' } = {}) {
  const p = max > 0 ? Math.max(0, Math.min(100, (hp / max) * 100)) : 0;
  const low = p <= 30 ? ' low' : '';
  return `<div class="hpbar${low} ${cls}" role="meter" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${hp}" aria-label="HP ${hp}/${max}">
    <div class="hpbar-fill" style="width:${p.toFixed(1)}%"></div>
    <span class="hpbar-text">${hp} / ${max}</span>
    ${block > 0 ? `<span class="hpbar-block" aria-label="ブロック ${block}">🛡${block}</span>` : ''}
  </div>`;
}

/** Element-tile style card. def = card def (upgrade merged) */
export function cardTile(def, opts = {}) {
  if (!def) return '';
  const {
    a = 'cardInfo', data = {}, cost = def.cost, playable = true, hint = null, selected = false,
    info = true, footer = '', small = false, sold = false, disabled = false, ariaExtra = '',
  } = opts;
  const unplayable = def.cost === null || (def.keywords || []).includes('unplayable');
  const cls = [
    'card', fieldClass(def.field), 't-' + (def.type || 'skill'), 'r-' + (def.rarity || 'common'),
    !playable || unplayable ? 'dim' : '', selected ? 'selected' : '', hint ? 'hint-' + hint.state : '',
    small ? 'small' : '', sold ? 'sold' : '', def.upgraded ? 'upgraded' : '',
  ].filter(Boolean).join(' ');
  const symbol = def.formula ? chem(def.formula) : esc([...(def.name || '?')][0]);
  const hintBadge = hint && hint.state === 'yes' ? '<span class="card-hint yes">⚗ 反応</span>'
    : hint && hint.state === 'maybe' ? '<span class="card-hint maybe">⚗ 反応?</span>'
      : hint && hint.state === 'no' && def.strict ? '<span class="card-hint no">不発</span>' : '';
  const kws = (def.keywords || []).filter((k) => k !== 'unplayable').map((k) => KEYWORD_LABELS[k]?.[0] || k);
  const label = `${def.name}、コスト${costLabel(cost)}、${TYPE_LABELS[def.type] || ''}${hint?.state === 'yes' ? '、反応成立見込み' : ''}${ariaExtra ? '、' + ariaExtra : ''}`;
  return `<div class="${cls}">
    <button class="card-main" data-a="${esc(a)}"${attrs(data)} data-lp="card" data-id="${esc(def.id)}" data-up="${def.upgraded ? 1 : 0}"${disabled ? ' disabled' : ''} aria-label="${esc(label)}">
      <span class="card-cost${cost !== def.cost && cost != null && def.cost != null ? ' changed' : ''}">${esc(costLabel(cost))}</span>
      <span class="card-field">${esc(CARD_FIELD_LABELS[def.field] || '')}</span>
      <span class="card-symbol">${symbol}</span>
      <span class="card-name">${chem(def.name)}</span>
      <span class="card-type">${esc(TYPE_LABELS[def.type] || '')}${kws.length ? '・' + esc(kws.join('・')) : ''}</span>
      <span class="card-text">${chem(def.text || '')}</span>
      ${hintBadge}
      ${footer}
    </button>
    ${info ? `<button class="card-info" data-a="cardInfo" data-id="${esc(def.id)}" data-up="${def.upgraded ? 1 : 0}" aria-label="${esc(def.name)}の詳細">ⓘ</button>` : ''}
  </div>`;
}

export function bedtimeBanner(msg) {
  if (!msg) return '';
  return `<div class="bedtime" role="status">
    <span class="bedtime-moon" aria-hidden="true">🌙</span>
    <p>${esc(msg)}</p>
    <button class="icon-btn" data-a="dismissBedtime" aria-label="バナーを閉じる">✕</button>
  </div>`;
}

// ---------------------------------------------------------------------------
// top bar
// ---------------------------------------------------------------------------

export function topbar(ctx) {
  const { run, db } = ctx;
  const p = run.player;
  const relicEm = run.relics.map((r) => db.relics.get(r.id)?.emoji || '◆').join('');
  const pots = run.potions.map((pid, i) => {
    const d = pid && db.potions.get(pid);
    if (!d) return `<button class="pot empty" data-a="potion" data-slot="${i}" aria-label="空の試薬瓶スロット${i + 1}" disabled>·</button>`;
    const sel = ctx.ui.selected?.kind === 'potion' && ctx.ui.selected.slot === i ? ' selected' : '';
    return `<button class="pot${sel}" data-a="potion" data-slot="${i}" aria-label="試薬瓶: ${esc(d.name)}">${esc(d.emoji || '🧪')}</button>`;
  }).join('');
  const hpLow = p.hp / p.maxHp <= 0.3 ? ' low' : '';
  return `<header class="topbar">
    <div class="tb-main">
      <button class="icon-btn" data-a="menu" aria-label="メニュー">☰</button>
      <div class="tb-act" title="${esc(C.ACT_NAMES[run.act] || '')}">
        <span class="tb-act-no">Act ${esc(actLabel(run.act))}</span>
        <span class="tb-act-name">${esc(C.ACT_NAMES[run.act] || '')}</span>
        <span class="tb-floor">${esc(run.floor)}F</span>
      </div>
      <button class="tb-deck" data-a="pile" data-pile="deck" aria-label="デッキを見る（${run.deck.length}枚）"><span aria-hidden="true">🂠</span><b>${run.deck.length}</b></button>
    </div>
    <div class="tb-stats">
      <span class="tb-hp${hpLow}" data-unit-hp="player" aria-label="HP ${p.hp}/${p.maxHp}"><span aria-hidden="true">❤</span><b>${p.hp}</b>/${p.maxHp}</span>
      <span class="tb-gold" aria-label="研究費 ${p.gold}"><span aria-hidden="true">💰</span><b>${p.gold}</b></span>
      <span class="tb-pots" role="group" aria-label="試薬瓶">${pots}</span>
      <button class="tb-relics" data-a="relics" aria-label="器具一覧（${run.relics.length}個）"><span class="tb-relic-em">${esc(relicEm || '—')}</span></button>
    </div>
  </header>`;
}

// ---------------------------------------------------------------------------
// sheets (bottom sheet / dialog)
// ---------------------------------------------------------------------------

function sheetFrame(title, body, { actions = '', wide = false, back = false } = {}) {
  return `<div class="sheet-backdrop" data-a="closeSheet"></div>
  <div class="sheet${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title.replace(/<[^>]+>/g, ''))}">
    <div class="sheet-head">
      ${back ? '<button class="icon-btn" data-a="closeSheet" aria-label="戻る">←</button>' : ''}
      <h2 class="sheet-title" tabindex="-1">${title}</h2>
      <button class="icon-btn" data-a="closeAllSheets" aria-label="閉じる">✕</button>
    </div>
    <div class="sheet-body" data-scroll-key="sheet">${body}</div>
    ${actions ? `<div class="sheet-actions">${actions}</div>` : ''}
  </div>`;
}

function actionButtons(actions) {
  return (actions || []).map((x) => `<button class="btn ${x.primary ? 'primary' : ''}" data-a="${esc(x.a)}"${attrs(x.data)}${x.disabled ? ' disabled' : ''}>${esc(x.label)}</button>`).join('');
}

export function cardSheet(ctx, s) {
  const { game, db } = ctx;
  const def = game.cardDef(s.id, !!s.upgraded);
  if (!def) return sheetFrame('カード', '<p>不明なカード</p>');
  const base = db.cards.get(s.id);
  const up = !s.upgraded && base.upgrade ? game.cardDef(s.id, true) : null;
  const rx = (def.reactions || []).map((r, i) => `<li class="rx">
      <div class="rx-when"><span class="rx-no">${i + 1}</span>［${chem(condText(db, r.when))}］${r.replace ? '<span class="tagline">基本効果と置換</span>' : ''}</div>
      ${r.equation ? `<div class="equation">${chem(r.equation)}</div>` : ''}
      <div class="rx-eff">追加効果: ${chem(describeEffects(db, r.effects, { side: 'player' }) || '—')}</div>
      ${r.explain ? `<div class="rx-explain">${chem(r.explain)}</div>` : ''}
    </li>`).join('');
  const kws = (def.keywords || []).map((k) => `<li><b>${esc(KEYWORD_LABELS[k]?.[0] || k)}</b>: ${esc(KEYWORD_LABELS[k]?.[1] || '')}</li>`).join('');
  const body = `<div class="card-detail">
      <div class="cd-tile">${cardTile(def, { info: false, a: 'noop' })}</div>
      <div class="cd-info">
        <p class="meta-line">${esc(TYPE_LABELS[def.type] || '')} ・ ${esc(CARD_FIELD_LABELS[def.field] || '')} ・ ${esc(RARITY_LABELS[def.rarity] || '')} ・ コスト ${esc(costLabel(def.cost))} ・ 対象 ${esc(TARGET_LABELS[def.target] || '—')}</p>
        <div class="cd-text">${chem(def.text || '')}</div>
        ${def.strict ? '<p class="note warn">厳密: どの反応も成立しないと不発になる。</p>' : ''}
        ${kws ? `<ul class="kw-list">${kws}</ul>` : ''}
      </div>
    </div>
    ${up ? `<section class="cd-sec"><h3>強化後（${chem(up.name)}）</h3><div class="cd-text up">${chem(up.text || '')}</div>${up.cost !== def.cost ? `<p class="note">コスト ${esc(costLabel(def.cost))} → ${esc(costLabel(up.cost))}</p>` : ''}</section>` : ''}
    ${rx ? `<section class="cd-sec"><h3>反応（上から順に判定）</h3><ol class="rx-list">${rx}</ol></section>` : ''}
    ${def.chem ? `<section class="cd-sec study"><h3>📓 学習メモ</h3><p>${chem(def.chem)}</p></section>` : ''}`;
  return sheetFrame(chem(def.name), body, { actions: actionButtons(s.actions), wide: true, back: s.back });
}

export function enemySheet(ctx, s) {
  const { game, db, run } = ctx;
  const e = run.combat?.enemies.find((x) => x.uid === s.uid);
  if (!e) return sheetFrame('敵', '<p>対象が見つからない</p>');
  const def = db.enemies.get(e.id) || {};
  const tags = game.displayTags(e).map((t) => t.hidden
    ? '<button class="chip tag hidden" data-a="hiddenTag" aria-label="隠れた性質">?</button>'
    : `<button class="chip tag${t.wasHidden ? ' revealed' : ''}" data-a="tag" data-id="${esc(t.tag)}">${chem(tagLabel(db, t.tag))}</button>`).join('');
  const active = new Set(game.activePhRules(e).map((r) => r.note));
  const rules = (def.phRules || []).map((r) => `<li class="${active.has(r.note) ? 'active' : ''}"><b>${esc(phRangeText(r))}</b>${r.takenMult ? ` 被ダメ×${esc(r.takenMult)}` : ''}${r.dealtMult ? ` 与ダメ×${esc(r.dealtMult)}` : ''}<br>${chem(r.note || '')}${active.has(r.note) ? ' <span class="tagline">有効中</span>' : ''}</li>`).join('');
  const intent = e.intent ? `<p><span aria-hidden="true">${INTENT_INFO[e.intent.intent]?.icon || ''}</span> <b>${chem(e.intent.name)}</b>（${esc(INTENT_INFO[e.intent.intent]?.label || '')}）: ${chem(describeEffects(db, e.intent.effects, { side: 'enemy', enemy: e }) || '—')}</p>` : '<p>—</p>';
  const body = `<div class="enemy-detail">
      <div class="ed-head"><span class="ed-emoji" aria-hidden="true">${esc(e.emoji)}</span>
        <div><div class="ed-name">${chem(e.name)}</div>${def.formula ? `<div class="ed-formula">${chem(def.formula)}</div>` : ''}
        <div class="meta-line">${esc({ normal: '通常', elite: '強敵', boss: 'ボス', minion: '取り巻き' }[e.tier] || '')}${e.pI != null ? ` ・ 等電点 pI ${esc(e.pI)}` : ''}</div></div></div>
      ${hpBar(e.hp, e.maxHp, { block: e.block })}
      <div class="chips">${statusChips(e.statuses, e.uid)}</div>
      <section class="cd-sec"><h3>次の行動</h3>${intent}</section>
      <section class="cd-sec"><h3>性質タグ</h3><div class="chips">${tags || '<span class="muted">なし</span>'}</div>
        ${e.hiddenTags.some((t) => !e.revealed.includes(t)) ? '<p class="note">「?」は隠れた性質。検出試薬の反応や「公開」効果で判明する。</p>' : ''}</section>
      ${rules ? `<section class="cd-sec"><h3>pHによる変化</h3><ul class="rule-list">${rules}</ul></section>` : ''}
      <section class="cd-sec study"><h3>📓 解説</h3><p>${chem(def.lore || '')}</p></section>
    </div>`;
  return sheetFrame(chem(e.name), body, { wide: true });
}

export function infoSheet(s) {
  return sheetFrame(s.title, s.body, { back: s.back });
}

export function pileSheet(ctx, s) {
  const { run, game } = ctx;
  const names = { deck: 'デッキ', draw: '山札', discard: '捨て札', exhaust: '除外' };
  let list;
  if (s.pile === 'deck') list = run.deck;
  else list = (run.combat && run.combat[s.pile]) || [];
  const defs = list.map((inst) => game.cardDef(inst.id, !!inst.upgraded)).filter(Boolean);
  if (s.pile === 'draw' || s.pile === 'deck') defs.sort((a, b) => (a.type > b.type ? 1 : a.type < b.type ? -1 : a.name.localeCompare(b.name, 'ja')));
  const body = defs.length
    ? `${s.pile === 'draw' ? '<p class="note">山札の順番は伏せて、種類順に表示しています。</p>' : ''}<div class="card-grid">${defs.map((d) => cardTile(d, { small: true, a: 'cardInfo', info: false })).join('')}</div>`
    : '<p class="muted">カードがない。</p>';
  return sheetFrame(`${names[s.pile] || ''}（${defs.length}枚）`, body, { wide: true });
}

export function relicsSheet(ctx) {
  const { run, db } = ctx;
  const body = run.relics.length ? `<ul class="relic-list">${run.relics.map((r) => {
    const d = db.relics.get(r.id);
    if (!d) return '';
    return `<li><span class="relic-em" aria-hidden="true">${esc(d.emoji || '◆')}</span><div><b>${chem(d.name)}</b> <span class="tagline">${esc(RARITY_LABELS[d.rarity] || '')}</span><p>${chem(d.text)}</p>${d.chem ? `<p class="study-inline">📓 ${chem(d.chem)}</p>` : ''}</div></li>`;
  }).join('')}</ul>` : '<p class="muted">器具はまだない。</p>';
  return sheetFrame('実験器具（レリック）', body, { wide: true });
}

export function relicSheet(ctx, s) {
  const d = ctx.db.relics.get(s.id);
  if (!d) return sheetFrame('器具', '');
  const body = `<div class="relic-detail"><span class="relic-em big" aria-hidden="true">${esc(d.emoji || '◆')}</span>
    <p class="meta-line">${esc(RARITY_LABELS[d.rarity] || '')}</p><p>${chem(d.text)}</p>${d.chem ? `<section class="cd-sec study"><h3>📓 学習メモ</h3><p>${chem(d.chem)}</p></section>` : ''}</div>`;
  return sheetFrame(chem(d.name), body, { actions: actionButtons(s.actions) });
}

export function potionSheet(ctx, s) {
  const { run, db, game } = ctx;
  const pid = s.potionId || run.potions[s.slot];
  const d = pid && db.potions.get(pid);
  if (!d) return sheetFrame('試薬瓶', '<p class="muted">空のスロット</p>');
  let actions = s.actions;
  if (!actions) {
    const chk = game.canUsePotion(s.slot);
    actions = [
      { label: '使う', a: 'usePotion', data: { slot: s.slot }, primary: true, disabled: !(chk.ok || chk.needsTarget) },
      { label: '捨てる', a: 'discardPotion', data: { slot: s.slot } },
    ];
    if (!(chk.ok || chk.needsTarget)) s.reason = chk.reason;
  }
  const body = `<div class="relic-detail"><span class="relic-em big" aria-hidden="true">${esc(d.emoji || '🧪')}</span>
    <p class="meta-line">${esc(RARITY_LABELS[d.rarity] || '')} ・ 対象 ${esc(TARGET_LABELS[d.target] || '—')}</p>
    <p>${chem(d.text)}</p>${s.reason ? `<p class="note warn">${esc(s.reason)}</p>` : ''}
    ${d.chem ? `<section class="cd-sec study"><h3>📓 学習メモ</h3><p>${chem(d.chem)}</p></section>` : ''}</div>`;
  return sheetFrame(chem(d.name), body, { actions: actionButtons(actions) });
}

export function menuSheet(ctx) {
  const body = `<div class="menu-list">
    <button class="btn" data-a="toTitle">タイトルへ戻る（自動保存済み）</button>
    <button class="btn" data-a="openView" data-view="codex">📚 図鑑</button>
    <button class="btn" data-a="openView" data-view="weakness">📊 弱点分析</button>
    <button class="btn" data-a="openView" data-view="settings">⚙ 設定</button>
    <button class="btn danger" data-a="confirmAbandon">ランを放棄する</button>
  </div>
  <p class="note">進行は行動ごとに自動保存されます。いつ閉じても「続きから」で再開できます。</p>`;
  return sheetFrame('メニュー', body);
}

export function confirmSheet(s) {
  const actions = `<button class="btn" data-a="closeSheet">やめる</button><button class="btn ${s.danger ? 'danger' : 'primary'}" data-a="${esc(s.yes)}"${attrs(s.data)}>${esc(s.yesLabel || 'はい')}</button>`;
  return sheetFrame(esc(s.title), `<p>${esc(s.body)}</p>`, { actions });
}

export function renderSheet(ctx, s) {
  switch (s.type) {
    case 'card': return cardSheet(ctx, s);
    case 'enemy': return enemySheet(ctx, s);
    case 'info': return infoSheet(s);
    case 'pile': return pileSheet(ctx, s);
    case 'relics': return relicsSheet(ctx);
    case 'relic': return relicSheet(ctx, s);
    case 'potion': return potionSheet(ctx, s);
    case 'menu': return menuSheet(ctx);
    case 'confirm': return confirmSheet(s);
    default: return '';
  }
}

// ---------------------------------------------------------------------------
// quiz modal
// ---------------------------------------------------------------------------

const SOURCE_LABEL = { card: 'カード', enemy: '敵の出題', event: 'イベント', rest: '復習', potion: '試薬瓶', relic: '器具' };

export function quizModal(ctx, p) {
  const { db, ui } = ctx;
  const q = db.questions.get(p.questionId);
  const result = p.kind === 'quizResult';
  const head = `<div class="quiz-meta">
      <span class="badge ${fieldClass(p.field)}">${esc(fieldLabel(p.field))}</span>
      ${p.level ? `<span class="badge lv">${esc(LEVEL_LABELS[p.level] || 'L' + p.level)}</span>` : ''}
      ${p.topic ? `<span class="badge topic">${chem(p.topic)}</span>` : ''}
      ${p.inNotebook ? '<span class="badge nb">📕 誤答ノート</span>' : ''}
    </div>
    <div class="quiz-src">${esc(SOURCE_LABEL[p.source] || '出題')}${p.sourceName ? '：' + chem(p.sourceName) : ''}</div>`;
  const setHead = p.setId ? `<div class="quiz-set"><span class="set-label">大問</span> <b>${chem(p.setTitle || '')}</b> <span class="set-part">小問 ${(p.partIndex ?? 0) + 1} / ${p.partCount ?? '?'}</span></div>` : '';
  const leadOpen = ui.leadOpen !== false;
  const lead = p.lead ? `<section class="quiz-lead${leadOpen ? '' : ' collapsed'}">
      <button class="lead-toggle" data-a="toggleLead" aria-expanded="${leadOpen}">📄 リード文 <span aria-hidden="true">${leadOpen ? '▲ たたむ' : '▼ ひらく'}</span></button>
      ${leadOpen ? `<div class="lead-body" data-scroll-key="lead" tabindex="0">${chem(p.lead)}</div>` : ''}
    </section>` : '';
  const given = p.given ? `<div class="given"><span class="given-label">与条件</span><div>${chem(p.given)}</div></div>` : '';

  let answerArea = '';
  if (p.type === 'choice' && Array.isArray(p.choices)) {
    answerArea = `<div class="choices" role="group" aria-label="選択肢">${p.choices.map((c, i) => {
      let st = '';
      if (result) {
        if (i === p.correctDisplay) st = ' correct';
        else if (Number(p.answer) === i) st = ' wrong';
      }
      return `<button class="choice${st}" data-a="answerChoice" data-i="${i}"${result ? ' disabled' : ''}><span class="choice-key">${'ABCD'[i] || i + 1}</span><span class="choice-text">${chem(c)}</span>${st === ' correct' ? '<span class="choice-mark" aria-label="正解">◯</span>' : st === ' wrong' ? '<span class="choice-mark" aria-label="あなたの解答">✕</span>' : ''}</button>`;
    }).join('')}</div>`;
  } else if (!result) {
    const draft = ui.quizDraft?.qid === p.questionId ? ui.quizDraft.value : '';
    answerArea = `<form class="numeric" data-form="numeric" autocomplete="off">
      <label class="num-label" for="quiz-num">数値で答える</label>
      <div class="num-row">
        <input id="quiz-num" name="answer" type="text" inputmode="decimal" enterkeyhint="done" autocapitalize="off" spellcheck="false" placeholder="例: 1.2×10^-5" value="${esc(draft)}" aria-describedby="num-hint" data-input="quizDraft">
        ${p.unit ? `<span class="unit">${chem(p.unit)}</span>` : ''}
      </div>
      <div class="quick" role="group" aria-label="記号入力">
        <button type="button" class="btn small" data-a="ins" data-t="×10^">×10^</button>
        <button type="button" class="btn small" data-a="ins" data-t="-" aria-label="マイナス">−</button>
        <button type="button" class="btn small" data-a="ins" data-t=".">.</button>
        <button type="button" class="btn small" data-a="clr">消去</button>
      </div>
      <p class="hint" id="num-hint"><code>1.2e-5</code> や <code>1.2×10^-5</code> の形でも入力できます（全角も可）。有効数字2〜3桁で。</p>
      <button type="submit" class="btn primary wide">解答する</button>
    </form>`;
  }

  let resultArea = '';
  if (result) {
    const yours = p.type === 'choice'
      ? (Number.isInteger(Number(p.answer)) && p.choices?.[Number(p.answer)] != null ? `${'ABCD'[Number(p.answer)]}` : '—')
      : `${chem(String(p.answer ?? ''))}${p.parsed != null ? `（${chem(numMarkup(p.parsed))} と解釈）` : '（数値として読めなかった）'}`;
    const corr = p.type === 'choice'
      ? `${'ABCD'[p.correctDisplay] || ''}　${chem(p.choices?.[p.correctDisplay] ?? p.correctAnswerText ?? '')}`
      : `${chem(numMarkup(Number(q?.answer ?? NaN)) || p.correctAnswerText)}${p.unit ? ' ' + chem(p.unit) : ''}${q?.tolerance ? `（許容 ±${Math.round(q.tolerance * 100)}%）` : ''}`;
    const nb = notebookStatus(p);
    resultArea = `<div class="verdict ${p.correct ? 'ok' : 'ng'}" role="status">${p.correct ? '◯ 正解！' : '✕ 不正解'}</div>
      <dl class="answers">
        <div><dt>あなたの解答</dt><dd>${yours}</dd></div>
        <div><dt>正答</dt><dd>${corr}</dd></div>
      </dl>
      <section class="explain"><h3>解説</h3><div>${chem(p.explain || '')}</div></section>
      ${p.trap ? `<section class="trap"><h3>⚠ ありがちなミス</h3><div>${chem(p.trap)}</div></section>` : ''}
      ${nb ? `<p class="nb-status ${p.correct ? 'ok' : 'ng'}">${nb}</p>` : ''}
      ${p.misconceptionAdded ? '<p class="nb-status ng">「思い込み」がデッキに混入した（自習室の復習で除去できる）</p>' : ''}
      <button class="btn primary wide" data-a="continueQuiz">次へ</button>`;
  }

  return `<div class="modal-backdrop quiz-backdrop"></div>
  <div class="modal quiz${p.lead ? ' has-lead' : ''}${result ? ' is-result' : ''}" role="dialog" aria-modal="true" aria-labelledby="quiz-q">
    <div class="quiz-top">${head}${setHead}</div>
    ${lead}
    <div class="quiz-body" data-scroll-key="quiz">
      <p class="quiz-text" id="quiz-q" tabindex="-1">${chem(p.text)}</p>
      ${given}
      ${answerArea}
      ${resultArea}
    </div>
  </div>`;
}

function notebookStatus(p) {
  const need = C.GRADUATE_STREAK;
  if (p.correct) {
    if (p.graduated) return '🎓 誤答ノートから卒業！';
    if (p.inNotebook && p.streak > 0) return `📕 誤答ノート: 連続正解 ${p.streak} — あと${Math.max(1, need - p.streak)}回正解で卒業`;
    return '';
  }
  if (p.addedToNotebook) return `📕 誤答ノートに追加（${need}回連続正解で卒業）`;
  return '📕 誤答ノート: 連続正解がリセットされた';
}

// ---------------------------------------------------------------------------
// card picker (pending selectCards)
// ---------------------------------------------------------------------------

export function pickerModal(ctx, p) {
  const { run, game, ui } = ctx;
  const pool = p.from === 'hand' ? (run.combat?.hand || []) : run.deck;
  const chosen = ui.pick || new Set();
  const need = Math.min(p.min ?? p.count, p.options.length);
  const tiles = p.options.map((uid) => {
    const inst = pool.find((x) => x.uid === uid) || run.deck.find((x) => x.uid === uid);
    if (!inst) return '';
    const showUp = p.purpose === 'restUpgrade' || p.purpose === 'upgradeCard';
    const def = game.cardDef(inst.id, !!inst.upgraded);
    const footer = showUp && game.cardDef(inst.id, true) && !inst.upgraded ? '<span class="card-foot">→ 強化</span>' : '';
    return cardTile(def, { a: 'pickToggle', data: { uid }, selected: chosen.has(uid), small: true, footer, ariaExtra: chosen.has(uid) ? '選択中' : '' });
  }).join('');
  const ok = chosen.size >= need && chosen.size <= p.count;
  return `<div class="modal-backdrop"></div>
  <div class="modal picker" role="dialog" aria-modal="true" aria-labelledby="picker-title">
    <div class="picker-head"><h2 id="picker-title" tabindex="-1">${chem(p.title || 'カードを選ぶ')}</h2>
      <p class="muted">${need === p.count ? `${p.count}枚選ぶ` : `${need}〜${p.count}枚選ぶ`}（選択中 ${chosen.size}）。ⓘで詳細。</p></div>
    <div class="picker-body" data-scroll-key="picker"><div class="card-grid">${tiles}</div></div>
    <div class="picker-actions">
      ${p.canCancel ? '<button class="btn" data-a="pickCancel">やめる</button>' : ''}
      <button class="btn primary" data-a="pickConfirm"${ok ? '' : ' disabled'}>決定</button>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// fatal error overlay
// ---------------------------------------------------------------------------

export function fatalOverlay(err) {
  const msg = err && (err.message || String(err));
  return `<div class="modal-backdrop"></div>
  <div class="modal fatal" role="alertdialog" aria-modal="true" aria-labelledby="fatal-title">
    <h2 id="fatal-title" tabindex="-1">⚠ 問題が発生しました</h2>
    <p>処理中にエラーが起きました。進行は直前の行動まで自動保存されています。</p>
    <pre class="fatal-msg">${esc(msg || '不明なエラー')}</pre>
    <div class="picker-actions">
      <button class="btn" data-a="reload">再読み込み</button>
      <button class="btn primary" data-a="fatalTitle">タイトルへ</button>
    </div>
  </div>`;
}

export { STATUS_ICONS };
