// 図鑑 (cards / enemies / reaction notebook / wrong-answer notebook) and 弱点分析.
import { constants as C } from '../../engine/index.js';
import { chem, esc } from '../chem.js';
import { cardTile } from '../components.js';
import { CARD_FIELD_LABELS, RARITY_LABELS, fieldLabel, fieldClass, pct, tagLabel, fmtDate, LEVEL_LABELS, phRangeText } from '../format.js';

const TABS = [['cards', 'カード'], ['enemies', '敵'], ['reactions', '反応ノート'], ['notebook', '誤答ノート']];

export function codexView(ctx) {
  const { ui } = ctx;
  const tab = ui.codexTab || 'cards';
  let body = '';
  if (tab === 'cards') body = cardsTab(ctx);
  else if (tab === 'enemies') body = enemiesTab(ctx);
  else if (tab === 'reactions') body = reactionsTab(ctx);
  else body = notebookTab(ctx);
  return `<main class="screen codex-screen">
    <div class="view-head"><button class="btn" data-a="back">← 戻る</button><h1>📚 図鑑</h1></div>
    <div class="tabs" role="tablist">${TABS.map(([id, label]) => `<button role="tab" class="tab${tab === id ? ' on' : ''}" aria-selected="${tab === id}" data-a="codexTab" data-id="${id}">${esc(label)}</button>`).join('')}</div>
    <div class="tab-body" role="tabpanel">${body}</div>
  </main>`;
}

function filterBar(name, cur, options) {
  return `<div class="filter" role="group" aria-label="${esc(name)}">${options.map(([id, label]) => `<button class="chip filter-chip${cur === id ? ' on' : ''}" aria-pressed="${cur === id}" data-a="codexFilter" data-k="${esc(name)}" data-id="${esc(id)}">${esc(label)}</button>`).join('')}</div>`;
}

function cardsTab(ctx) {
  const { db, ui, meta, game } = ctx;
  const f = ui.codexField || 'all';
  const r = ui.codexRarity || 'all';
  const fields = [['all', 'すべて'], ...Object.entries(CARD_FIELD_LABELS)];
  const rars = [['all', 'すべて'], ['starter', '初期'], ['common', 'コモン'], ['uncommon', 'アンコモン'], ['rare', 'レア'], ['special', '特殊']];
  const order = { starter: 0, common: 1, uncommon: 2, rare: 3, special: 4 };
  const list = db.cardList
    .filter((c) => (f === 'all' || c.field === f) && (r === 'all' || c.rarity === r))
    .slice().sort((a, b) => (order[a.rarity] ?? 9) - (order[b.rarity] ?? 9) || a.name.localeCompare(b.name, 'ja'));
  const seen = meta.seen?.cards || {};
  return `${filterBar('field', f, fields)}${filterBar('rarity', r, rars)}
    <p class="muted">${list.length}枚。タップで学習メモと反応一覧。${Object.keys(seen).length ? '' : ''}</p>
    <div class="card-grid">${list.map((c) => cardTile(game.cardDef(c.id), { small: true, a: 'cardInfo', info: false })).join('')}</div>`;
}

function enemiesTab(ctx) {
  const { db, meta } = ctx;
  const seen = meta.seen?.enemies || {};
  const acts = [1, 2, 3, 4, 5];
  const tierL = { normal: '通常', elite: '強敵', boss: 'ボス', minion: '取り巻き' };
  const total = db.enemyList.length;
  const seenN = db.enemyList.filter((e) => seen[e.id]).length;
  return `<p class="muted">遭遇済み ${seenN} / ${total}。未遭遇の敵は伏せられている。</p>` + acts.map((a) => {
    const list = db.enemyList.filter((e) => e.act === a);
    if (!list.length) return '';
    return `<section class="codex-sec"><h2>Act ${a >= 5 ? '終' : a}：${esc(C.ACT_NAMES[a] || '')}</h2><ul class="enemy-list">${list.map((e) => {
      if (!seen[e.id]) return `<li class="locked"><span class="el-emoji" aria-hidden="true">❔</span><div><b>？？？</b><p class="muted">${esc(tierL[e.tier] || '')}・未遭遇</p></div></li>`;
      const tags = (e.tags || []).map((t) => `<span class="chip tag static">${chem(tagLabel(db, t))}</span>`).join('') + (e.hiddenTags || []).map(() => '<span class="chip tag hidden static">?</span>').join('');
      const rules = (e.phRules || []).map((r) => `<li><b>${esc(phRangeText(r))}</b> ${chem(r.note || '')}</li>`).join('');
      return `<li><span class="el-emoji" aria-hidden="true">${esc(e.emoji)}</span><div>
        <b>${chem(e.name)}</b> ${e.formula ? `<span class="formula">${chem(e.formula)}</span>` : ''} <span class="tagline">${esc(tierL[e.tier] || '')}</span>${e.pI != null ? ` <span class="tagline">pI ${esc(e.pI)}</span>` : ''}
        <div class="chips">${tags}</div>
        ${rules ? `<ul class="rule-list">${rules}</ul>` : ''}
        <details><summary>解説を読む</summary><p>${chem(e.lore || '')}</p></details>
      </div></li>`;
    }).join('')}</ul></section>`;
  }).join('');
}

function reactionsTab(ctx) {
  const { game, db } = ctx;
  const list = game.reactionList();
  if (!list.length) return '<p class="empty">まだ反応を成立させていない。敵の性質タグに合う試薬カードを使うと「反応成立」し、ここに記録される。</p>';
  return `<p class="muted">成立させた反応 ${list.length}種</p><ul class="rx-done">${list.map((r) => {
    const card = db.cards.get(r.cardId);
    const rx = card?.reactions?.[r.index];
    return `<li><div class="rxn-head"><b>${chem(card?.name || r.cardId)}</b>${card?.formula ? ` <span class="formula">${chem(card.formula)}</span>` : ''} <span class="tagline">×${r.count}</span> <span class="tagline">${esc(fmtDate(r.firstAt))}</span></div>
      ${r.equation ? `<div class="equation">${chem(r.equation)}</div>` : ''}
      ${r.explain ? `<div class="rx-explain">${chem(r.explain)}</div>` : ''}
      ${rx?.when ? '' : ''}</li>`;
  }).join('')}</ul>`;
}

function notebookTab(ctx) {
  const { game } = ctx;
  const list = game.notebookList();
  if (!list.length) return '<p class="empty">誤答ノートは空。誤答した問題はここに残り、以後優先的に再出題される。2回連続で正解すると卒業。</p>';
  return `<p class="muted">${list.length}問。2回連続正解で卒業。</p><ul class="wrong-list">${list.map((n) => {
    const q = n.question;
    if (!q) return '';
    const ans = q.type === 'choice' ? q.choices[q.answer] : `${q.answer}${q.unit ? ' ' + q.unit : ''}`;
    return `<li><details><summary><span class="badge ${fieldClass(q.field)}">${esc(fieldLabel(q.field))}</span> ${chem(q.text)}</summary>
      <p class="muted">${chem(q.topic || '')} ・ ${esc(LEVEL_LABELS[q.level] || '')} ・ 誤答 ${n.wrong}回 ・ 連続正解 ${n.streak || 0}/${C.GRADUATE_STREAK}</p>
      ${q.given ? `<div class="given"><span class="given-label">与条件</span><div>${chem(q.given)}</div></div>` : ''}
      ${q.type === 'choice' ? `<ol class="nb-choices">${q.choices.map((c, i) => `<li class="${i === q.answer ? 'correct' : ''}">${chem(c)}</li>`).join('')}</ol>` : ''}
      <p><b>正答:</b> ${chem(ans)}</p>
      <div class="explain"><h3>解説</h3>${chem(q.explain || '')}</div>
      ${q.trap ? `<div class="trap"><h3>⚠ ありがちなミス</h3>${chem(q.trap)}</div>` : ''}
    </details></li>`;
  }).join('')}</ul>`;
}

// ---------------------------------------------------------------------------

export function weaknessView(ctx) {
  const { game } = ctx;
  const wr = game.weaknessReport();
  const fields = wr.fields.slice().sort((a, b) => (a.rate ?? 2) - (b.rate ?? 2) || b.asked - a.asked);
  const bar = (rate) => `<span class="br-bar"><span class="${rate != null && rate < 0.5 ? 'weak' : ''}" style="width:${rate == null ? 0 : Math.round(rate * 100)}%"></span></span>`;
  const fieldRows = fields.map((f) => `<li class="bar-row${f.asked ? '' : ' nodata'}"><span class="br-label"><span class="badge ${fieldClass(f.field)}">${esc(fieldLabel(f.field))}</span></span>${bar(f.rate)}<span class="br-val">${pct(f.rate)} <small>(${f.correct}/${f.asked})</small></span></li>`).join('');
  const topics = wr.topics;
  const topicRows = topics.length ? topics.map((t) => `<li class="bar-row"><span class="br-label"><span class="dot ${fieldClass(t.field)}" aria-hidden="true"></span>${chem(t.topic)}<small class="muted"> ${esc(fieldLabel(t.field))}</small></span>${bar(t.rate)}<span class="br-val">${pct(t.rate)} <small>(${t.correct}/${t.asked})</small></span></li>`).join('') : '<li class="muted">まだデータがない。</li>';
  const weakest = fields.find((f) => f.asked && f.rate != null);
  return `<main class="screen weakness-screen">
    <div class="view-head"><button class="btn" data-a="back">← 戻る</button><h1>📊 弱点分析</h1></div>
    ${weakest ? `<p class="callout">いちばんの弱点: <b>${esc(fieldLabel(weakest.field))}</b>（正答率 ${pct(weakest.rate)}）。自習室の「復習」で集中的に出題されます。</p>` : '<p class="callout">まだ解答データがありません。ランで問題に答えると、ここに分野別・トピック別の正答率が表示されます。</p>'}
    <section class="panel"><h2>分野別（弱い順）</h2><ul class="bars">${fieldRows}</ul></section>
    <section class="panel"><h2>トピック別（弱い順）</h2><ul class="bars topics">${topicRows}</ul></section>
    <p class="muted">誤答ノート: ${wr.notebookCount}問</p>
  </main>`;
}
