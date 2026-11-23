// Non-combat node screens: reward, event, rest, shop, treasure, run result.
import { constants as C } from '../../engine/index.js';
import { chem, esc } from '../chem.js';
import { cardTile, doBtn } from '../components.js';
import { RARITY_LABELS, answerMarkup, fieldLabel, fieldClass, pct, actLabel } from '../format.js';

function relicRow(db, id, { a = 'relicInfo', data = {}, extra = '', disabled = false } = {}) {
  const d = db.relics.get(id);
  if (!d) return '';
  const dataAttrs = Object.entries({ id, ...data }).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<button class="item-row" data-a="${esc(a)}"${dataAttrs}${disabled ? ' disabled' : ''}>
    <span class="item-em" aria-hidden="true">${esc(d.emoji || '◆')}</span>
    <span class="item-body"><b>${chem(d.name)}</b> <span class="tagline">${esc(RARITY_LABELS[d.rarity] || '')}</span><span class="item-text">${chem(d.text)}</span></span>
    ${extra}
  </button>`;
}

function potionRow(db, id, { a, data = {}, extra = '', disabled = false } = {}) {
  const d = db.potions.get(id);
  if (!d) return '';
  const dataAttrs = Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<button class="item-row" data-a="${esc(a)}"${dataAttrs}${disabled ? ' disabled' : ''}>
    <span class="item-em" aria-hidden="true">${esc(d.emoji || '🧪')}</span>
    <span class="item-body"><b>${chem(d.name)}</b> <span class="tagline">試薬瓶</span><span class="item-text">${chem(d.text)}</span></span>
    ${extra}
  </button>`;
}

// ---------------------------------------------------------------------------

export function rewardView(ctx) {
  const { run, game, db } = ctx;
  const r = run.reward;
  if (!r) return '<main class="screen"></main>';
  const title = { battle: '戦闘に勝利', elite: '強敵を撃破', boss: 'ボスを撃破！' }[r.kind] || '報酬';
  const slotsFull = !run.potions.includes(null);
  let cards;
  if (r.cardTaken === true) {
    const d = r.cardPicked && game.cardDef(r.cardPicked);
    cards = `<p class="done">✔ 「${chem(d?.name || '')}」をデッキに加えた</p>`;
  } else if (r.cardTaken === 'skipped') {
    cards = '<p class="done muted">カードは見送った</p>';
  } else {
    cards = `<p class="muted">1枚選んでデッキに加える（タップで詳細→決定）。</p>
      <div class="card-row">${r.cards.map((id, i) => cardTile(game.cardDef(id), { a: 'rewardCard', data: { i }, info: false })).join('')}</div>
      <button class="btn" data-a="do" data-fn="skipRewardCard">カードを取らない</button>`;
  }
  let potion = '';
  if (r.potion) {
    potion = `<section class="reward-sec"><h2>試薬瓶</h2>${r.potionTaken
      ? '<p class="done">✔ 受け取った</p>'
      : potionRow(db, r.potion, { a: 'do', data: { fn: 'takeRewardPotion' }, disabled: slotsFull, extra: `<span class="item-cta">${slotsFull ? 'スロット満杯' : '受け取る'}</span>` })}
      ${!r.potionTaken && slotsFull ? '<p class="note">上部の試薬瓶をタップして捨てると空きができる。</p>' : ''}</section>`;
  }
  let relic = '';
  if (r.relicChoices?.length) {
    relic = `<section class="reward-sec"><h2>ボス報酬：器具を1つ選ぶ</h2>${r.relicTaken
      ? `<p class="done">✔ 「${chem(db.relics.get(r.relicPicked)?.name || '')}」を得た</p>`
      : `<div class="item-list">${r.relicChoices.map((id, i) => relicRow(db, id, { a: 'do', data: { fn: 'takeRewardRelic', arg: i }, extra: '<span class="item-cta">選ぶ</span>' })).join('')}</div>`}</section>`;
  } else if (r.relic) {
    relic = `<section class="reward-sec"><h2>器具</h2>${r.relicTaken
      ? `<p class="done">✔ 「${chem(db.relics.get(r.relic)?.name || '')}」を得た</p>`
      : relicRow(db, r.relic, { a: 'do', data: { fn: 'takeRewardRelic', arg: 0 }, extra: '<span class="item-cta">受け取る</span>' })}</section>`;
  }
  const last = run.lastCombat;
  const leaveLabel = r.kind === 'boss' ? (run.act + 1 >= C.FINAL_ACT ? '二次試験当日へ ▶' : '次の層へ ▶') : 'マップへ進む ▶';
  return `<main class="screen reward-screen">
    <h1 class="screen-title">🏆 ${esc(title)}</h1>
    <div class="reward-summary">
      <span>💰 研究費 +${r.gold}</span>
      ${r.heal ? `<span>❤ HP +${r.heal}</span>` : ''}
      ${last ? `<span>⚗ 反応 ${last.reactions || 0}</span><span>✔ 正解 ${last.correct || 0}</span><span>⏱ ${last.turns}ターン</span>` : ''}
    </div>
    <section class="reward-sec"><h2>カード</h2>${cards}</section>
    ${potion}
    ${relic}
    <div class="row-btns end">${doBtn(leaveLabel, 'leaveReward', null, { cls: 'btn primary big' })}</div>
  </main>`;
}

// ---------------------------------------------------------------------------

export function eventView(ctx) {
  const { run, game, db } = ctx;
  const ev = run.event && db.eventMap.get(run.event.id);
  if (!ev) return `<main class="screen"><p>イベント</p>${doBtn('マップへ', 'leaveEvent')}</main>`;
  let body;
  if (run.event.phase === 'choose') {
    body = `<div class="choice-list">${ev.choices.map((ch, i) => {
      const st = game.eventChoiceStatus(i);
      return `<button class="event-choice" data-a="do" data-fn="chooseEventOption" data-arg="${i}"${st.ok ? '' : ' disabled'}>
        <span class="ec-label">${ch.quiz ? '<span class="badge">❓ 出題</span> ' : ''}${chem(ch.label)}</span>
        ${st.ok ? '' : `<span class="ec-reason">${esc(st.reason || '')}</span>`}
      </button>`;
    }).join('')}</div>`;
    const any = ev.choices.some((_, i) => game.eventChoiceStatus(i).ok);
    if (!any) body += doBtn('立ち去る', 'leaveEvent', null, { cls: 'btn' });
  } else {
    const ch = ev.choices[run.event.choiceIndex] || {};
    const qc = run.event.quizCorrect;
    body = `<div class="event-result">
      <p class="ev-chosen">▶ ${chem(ch.label || '')}</p>
      ${qc === true ? '<p class="verdict-inline ok">◯ 正解</p>' : qc === false ? '<p class="verdict-inline ng">✕ 不正解</p>' : ''}
      <p>${chem(run.event.resultText || '')}</p>
    </div>
    <div class="row-btns end">${doBtn('マップへ進む ▶', 'leaveEvent', null, { cls: 'btn primary big', disabled: run.event.phase === 'resolving' && !!run.pending })}</div>`;
  }
  return `<main class="screen event-screen">
    <h1 class="screen-title">❔ ${chem(ev.name)}</h1>
    <div class="event-text">${chem(ev.text)}</div>
    ${body}
  </main>`;
}

// ---------------------------------------------------------------------------

export function restView(ctx) {
  const { run, game } = ctx;
  const rs = run.rest;
  const icons = { rest: '🛏️', upgrade: '⚒️', review: '📕' };
  let body;
  if (!rs.used) {
    body = `<div class="rest-options">${game.restOptions().map((o) => `<button class="rest-opt" data-a="restOpt" data-id="${esc(o.id)}"${o.ok ? '' : ' disabled'}>
        <span class="ro-icon" aria-hidden="true">${icons[o.id] || '•'}</span><span class="ro-label">${esc(o.label)}</span><span class="ro-desc">${chem(o.desc)}</span></button>`).join('')}</div>
      <div class="row-btns end">${doBtn('何もせず進む', 'leaveRest', null, { cls: 'btn' })}</div>`;
  } else {
    const res = rs.reviewResults || [];
    const msg = rs.choice === 'rest' ? '少し眠って回復した。' : rs.choice === 'upgrade' ? 'カードを強化した。' : '復習を終えた。';
    body = `<div class="event-result"><p>${esc(msg)}</p>
      ${rs.choice === 'review' ? `<p class="review-res" aria-label="復習の結果">${res.map((ok) => `<span class="${ok ? 'ok' : 'ng'}">${ok ? '◯' : '✕'}</span>`).join('') || '—'}</p>` : ''}</div>
      <div class="row-btns end">${doBtn('マップへ進む ▶', 'leaveRest', null, { cls: 'btn primary big', disabled: !!run.pending })}</div>`;
  }
  return `<main class="screen rest-screen">
    <h1 class="screen-title">📖 自習室</h1>
    <p class="muted">ひとつだけ選べる。「復習」は誤答ノートと弱点分野から出題される。</p>
    ${body}
  </main>`;
}

// ---------------------------------------------------------------------------

export function shopView(ctx) {
  const { run, game, db } = ctx;
  const s = run.shop;
  const gold = run.player.gold;
  const slotsFull = !run.potions.includes(null);
  const priceTag = (price, sold) => `<span class="price${sold ? ' sold' : price > gold ? ' short' : ''}">${sold ? '売り切れ' : '💰' + price}</span>`;
  const cards = s.cards.map((it, i) => cardTile(game.cardDef(it.cardId), {
    a: 'shopCard', data: { i }, info: false, sold: it.sold, footer: priceTag(it.price, it.sold), disabled: it.sold,
    ariaExtra: it.sold ? '売り切れ' : `価格${it.price}`,
  })).join('');
  const relics = s.relics.map((it, i) => relicRow(db, it.relicId, { a: 'shopRelic', data: { i }, disabled: it.sold, extra: priceTag(it.price, it.sold) })).join('');
  const pots = s.potions.map((it, i) => potionRow(db, it.potionId, { a: 'shopPotion', data: { i }, disabled: it.sold, extra: priceTag(it.price, it.sold) })).join('');
  const rp = game.removalPrice();
  return `<main class="screen shop-screen">
    <h1 class="screen-title">🛒 購買部 <span class="gold-now">所持 💰${gold}</span></h1>
    <section class="reward-sec"><h2>カード</h2><div class="card-row shop-cards">${cards}</div></section>
    <div class="shop-cols">
      <section class="reward-sec"><h2>器具</h2><div class="item-list">${relics || '<p class="muted">品切れ</p>'}</div></section>
      <section class="reward-sec"><h2>試薬瓶</h2><div class="item-list">${pots || '<p class="muted">品切れ</p>'}</div>${slotsFull ? '<p class="note">試薬瓶スロットが満杯。</p>' : ''}</section>
    </div>
    <section class="reward-sec"><h2>カード除去サービス</h2>
      <button class="item-row" data-a="do" data-fn="buyRemoval"${s.removalUsed || gold < rp ? ' disabled' : ''}>
        <span class="item-em" aria-hidden="true">✂️</span><span class="item-body"><b>デッキからカードを1枚除去</b><span class="item-text">「思い込み」や弱いカードを手放す。</span></span>
        <span class="price${s.removalUsed ? ' sold' : gold < rp ? ' short' : ''}">${s.removalUsed ? '利用済み' : '💰' + rp}</span>
      </button></section>
    <div class="row-btns end">${doBtn('店を出る ▶', 'leaveShop', null, { cls: 'btn primary big' })}</div>
  </main>`;
}

// ---------------------------------------------------------------------------

export function treasureView(ctx) {
  const { run, db } = ctx;
  const t = run.treasure;
  const body = !t.opened
    ? `<button class="chest" data-a="do" data-fn="openTreasure" aria-label="器具庫を開ける"><span aria-hidden="true">🧰</span><span>開ける</span></button>`
    : `<div class="item-list">${t.relicId ? relicRow(db, t.relicId) : ''}</div><p class="done">💰 研究費 +${t.gold}</p>`;
  return `<main class="screen treasure-screen">
    <h1 class="screen-title">🧰 実験器具庫</h1>
    <p class="muted">棚の奥に、使えそうな器具が眠っている。</p>
    ${body}
    <div class="row-btns end">${doBtn(t.opened ? 'マップへ進む ▶' : '開けずに進む', 'leaveTreasure', null, { cls: t.opened ? 'btn primary big' : 'btn' })}</div>
  </main>`;
}

// ---------------------------------------------------------------------------

export function resultView(ctx) {
  const { run, game, db } = ctx;
  const s = game.runSummary();
  const won = run.result?.won;
  const fields = Object.entries(s.byField || {});
  const fieldRows = fields.length ? fields.map(([f, v]) => {
    const rate = v.asked ? v.correct / v.asked : null;
    return `<li class="bar-row"><span class="br-label"><span class="badge ${fieldClass(f)}">${esc(fieldLabel(f))}</span></span>
      <span class="br-bar"><span style="width:${rate == null ? 0 : Math.round(rate * 100)}%"></span></span>
      <span class="br-val">${pct(rate)} <small>(${v.correct}/${v.asked})</small></span></li>`;
  }).join('') : '<li class="muted">出題なし</li>';
  const rx = s.reactions.length ? s.reactions.map((r) => `<li><b>${chem(db.cards.get(r.cardId)?.name || r.cardId)}</b> ×${r.count}
      ${r.equation ? `<div class="equation">${chem(r.equation)}</div>` : ''}${r.explain ? `<div class="rx-explain">${chem(r.explain)}</div>` : ''}</li>`).join('') : '<li class="muted">なし</li>';
  const wrong = s.wrongQuestions.length ? s.wrongQuestions.map((q) => `<li><details><summary>${chem(q.text)}</summary>
      <p class="muted">${esc(fieldLabel(q.field))} ・ ${chem(q.topic || '')}</p>
      <p><b>正答:</b> ${chem(answerMarkup(q))}</p>
      <div class="explain">${chem(q.explain || '')}</div>${q.trap ? `<div class="trap">⚠ ${chem(q.trap)}</div>` : ''}</details></li>`).join('') : '<li class="muted">誤答なし</li>';
  return `<main class="screen result-screen">
    <h1 class="screen-title ${won ? 'win' : 'lose'}">${won ? '🎓 二次試験 突破！' : '💤 力尽きた……'}</h1>
    <div class="reward-summary">
      <span>難易度 ${esc(C.DIFFICULTIES[s.difficulty]?.label || s.difficulty)}</span>
      <span>到達 Act ${esc(actLabel(s.act))} ・ ${s.floor}F</span>
      <span>正解 ${s.correct} ／ 誤答 ${s.wrong}</span>
    </div>
    <section class="reward-sec"><h2>分野別正答率</h2><ul class="bars">${fieldRows}</ul></section>
    <section class="reward-sec"><h2>成立させた反応（${s.reactions.length}種）</h2><ul class="rx-done">${rx}</ul></section>
    <section class="reward-sec"><h2>誤答一覧（${s.wrongQuestions.length}問）</h2><ul class="wrong-list">${wrong}</ul>
      <p class="note">誤答は誤答ノートに残り、次のランで優先的に再出題されます。2回連続正解で卒業。</p></section>
    <div class="row-btns end"><button class="btn primary big" data-a="finishToTitle">タイトルへ</button></div>
  </main>`;
}
