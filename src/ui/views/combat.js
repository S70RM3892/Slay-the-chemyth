// Combat screen.
import { chem, esc } from '../chem.js';
import { cardTile, hpBar } from '../components.js';
import { INTENT_INFO, statusChips, tagLabel, phRangeText, describeEffects } from '../format.js';
import { reactionHint } from '../hints.js';

const PH_COLORS = 'var(--ph-gradient)';

function phKind(ph) {
  if (ph <= 2) return '強酸性';
  if (ph <= 6) return '酸性';
  if (ph === 7) return '中性';
  if (ph <= 11) return '塩基性';
  return '強塩基性';
}

function selectedCard(ctx) {
  const sel = ctx.ui.selected;
  if (!sel || sel.kind !== 'card') return null;
  const inst = ctx.run.combat.hand.find((x) => x.uid === sel.uid);
  return inst ? ctx.game.cardDef(inst.id, !!inst.upgraded) : null;
}

function intentHtml(e) {
  const it = e.intent;
  if (!it) return '<div class="intent none">—</div>';
  const info = INTENT_INFO[it.intent] || INTENT_INFO.special;
  const pv = it.preview || {};
  let nums = '';
  if (pv.damage != null) nums += `<b class="i-dmg">${pv.damage}${pv.times > 1 ? '×' + pv.times : ''}</b>`;
  if (pv.block) nums += `<b class="i-blk">🛡${pv.block}</b>`;
  return `<div class="intent i-${esc(it.intent)}" title="${esc(info.label)}"><span class="i-icon" aria-hidden="true">${info.icon}</span>${nums}<span class="i-name">${chem(it.name)}</span></div>`;
}

function enemyPanel(ctx, e, selDef) {
  const { game, db, run } = ctx;
  if (!e.alive) {
    return `<div class="enemy dead" data-unit="${esc(e.uid)}"><div class="enemy-main" aria-label="${esc(e.name)}（撃破）"><span class="enemy-emoji" aria-hidden="true">${esc(e.emoji)}</span><span class="enemy-name">${chem(e.name)}</span><span class="dead-label">撃破</span></div></div>`;
  }
  const targeting = !!(ctx.ui.selected && ((ctx.ui.selected.kind === 'card' && selDef?.target === 'enemy') || ctx.ui.selected.kind === 'potion'));
  let rxBadge = '';
  if (targeting && selDef) {
    const h = reactionHint(run.combat, selDef, e.uid);
    if (h.state === 'yes') rxBadge = '<span class="rx-badge yes">⚗ 反応する</span>';
    else if (h.state === 'maybe') rxBadge = '<span class="rx-badge maybe">⚗ 反応?</span>';
    else if (h.state === 'no' && selDef.strict) rxBadge = '<span class="rx-badge no">不発</span>';
  }
  const tags = game.displayTags(e).map((t) => t.hidden
    ? '<button class="chip tag hidden" data-a="hiddenTag" aria-label="隠れた性質（未判明）">?</button>'
    : `<button class="chip tag${t.wasHidden ? ' revealed' : ''}" data-a="tag" data-id="${esc(t.tag)}"><span>${chem(tagLabel(db, t.tag))}</span></button>`).join('');
  const label = `${e.name}、HP ${e.hp}/${e.maxHp}${e.block ? '、ブロック' + e.block : ''}${e.intent ? '、次の行動 ' + (INTENT_INFO[e.intent.intent]?.label || '') + (e.intent.preview?.damage != null ? ' ' + e.intent.preview.damage + 'ダメージ' + (e.intent.preview.times > 1 ? '×' + e.intent.preview.times : '') : '') : ''}${targeting ? '。タップで対象に選ぶ' : '。タップで解説'}`;
  return `<div class="enemy tier-${esc(e.tier)}${targeting ? ' targetable' : ''}" data-unit="${esc(e.uid)}">
    <button class="enemy-main" data-a="enemy" data-uid="${esc(e.uid)}" aria-label="${esc(label)}">
      ${intentHtml(e)}
      <span class="enemy-emoji" aria-hidden="true">${esc(e.emoji)}</span>
      <span class="enemy-name">${chem(e.name)}</span>
      ${hpBar(e.hp, e.maxHp, { block: e.block })}
      ${rxBadge}
    </button>
    <div class="chips">${statusChips(e.statuses, e.uid)}</div>
    <div class="chips tags">${tags}</div>
  </div>`;
}

function phMeter(ctx) {
  const { run, game, db } = ctx;
  const c = run.combat;
  const ph = c.ph;
  const x = (v) => ((v / 14) * 100).toFixed(2);
  const living = c.enemies.filter((e) => e.alive);
  let bands = '';
  let notes = '';
  let pis = '';
  living.forEach((e) => {
    const def = db.enemies.get(e.id) || {};
    const active = new Set(game.activePhRules(e).map((r) => r.note));
    (def.phRules || []).forEach((r) => {
      const a = r.min ?? 0; const b = r.max ?? 14;
      const on = active.has(r.note);
      bands += `<span class="ph-band${on ? ' active' : ''}" style="left:${x(a)}%;width:${Math.max(1.2, ((b - a) / 14) * 100).toFixed(2)}%" aria-hidden="true"></span>`;
      const mult = [r.takenMult ? `被ダメ×${r.takenMult}` : '', r.dealtMult ? `与ダメ×${r.dealtMult}` : ''].filter(Boolean).join(' ');
      notes += `<li class="${on ? 'active' : ''}"><span aria-hidden="true">${esc(e.emoji)}</span> <b>${esc(phRangeText(r))}</b> ${esc(mult)}${on ? ' <span class="tagline">有効中</span>' : ''}<span class="ph-note-text">${chem(r.note || '')}</span></li>`;
    });
    if (e.pI != null) {
      pis += `<span class="ph-pi" style="left:${x(e.pI)}%" aria-hidden="true"><span>pI</span></span>`;
      notes += `<li class="pi-note"><span aria-hidden="true">${esc(e.emoji)}</span> <b>等電点 pI ${esc(e.pI)}</b><span class="ph-note-text">|pH − pI| が大きいほど正味の電荷が大きい（現在 ${Math.abs(ph - e.pI).toFixed(1)}）。</span></li>`;
    }
  });
  const ticks = [0, 2, 4, 6, 7, 8, 10, 12, 14].map((t) => `<span style="left:${x(t)}%">${t}</span>`).join('');
  return `<section class="ph-meter" aria-label="場のpH ${ph}（${phKind(ph)}）">
    <div class="ph-head"><span class="ph-title">場のpH</span><b class="ph-val">${ph}</b><span class="ph-kind">${phKind(ph)}</span></div>
    <div class="ph-track">
      <div class="ph-bar" style="background:${PH_COLORS}">${bands}</div>
      ${pis}
      <span class="ph-marker" style="left:${x(ph)}%" aria-hidden="true"><span>${ph}</span></span>
    </div>
    <div class="ph-scale" aria-hidden="true">${ticks}</div>
    ${notes ? `<ul class="ph-notes">${notes}</ul>` : ''}
  </section>`;
}

function logPanel(ctx) {
  const log = (ctx.run.log || []).slice(-40);
  const open = ctx.ui.logOpen;
  const items = log.map((l) => `<li class="lg-${esc(l.type)}">${chem(l.msg)}</li>`).join('');
  return `<section class="combat-log${open ? ' open' : ''}">
    <button class="log-toggle" data-a="toggleLog" aria-expanded="${!!open}">📜 戦闘ログ <span aria-hidden="true">${open ? '▲' : '▼'}</span></button>
    <ol class="log-list" data-scroll-key="log" data-autoscroll="1" tabindex="0" aria-label="戦闘ログ">${items}</ol>
  </section>`;
}

function playerStrip(ctx) {
  const { run, db } = ctx;
  const c = run.combat;
  const p = c.player;
  const powers = (p.powers || []).map((pw, i) => `<button class="chip power" data-a="power" data-i="${i}"><span>✦ ${chem(pw.name || '常在効果')}</span></button>`).join('');
  return `<section class="player-strip" data-unit="player">
    <div class="ps-who"><span class="ps-emoji" aria-hidden="true">🧑‍🔬</span><span class="ps-name">あなた</span></div>
    ${hpBar(run.player.hp, run.player.maxHp, { block: p.block, cls: 'player' })}
    <div class="chips">${statusChips(p.statuses, 'player')}${powers}</div>
  </section>`;
}

export function combatView(ctx) {
  const { run, game, ui } = ctx;
  const c = run.combat;
  if (!c) return '<main class="screen"><p>戦闘データがない</p></main>';
  const selDef = selectedCard(ctx);
  const living = c.enemies.filter((e) => e.alive);
  const autoTarget = living.length === 1 ? living[0].uid : null;
  const myTurn = c.phase === 'player' && !run.pending;

  const hand = c.hand.map((inst) => {
    const v = game.cardView(inst);
    if (!v) return '';
    const hint = reactionHint(c, v, v.target === 'enemy' ? autoTarget : null);
    const sel = ui.selected?.kind === 'card' && ui.selected.uid === inst.uid;
    return cardTile(v, { a: 'card', data: { uid: inst.uid, playable: v.playable ? 1 : 0 }, cost: v.cost, playable: v.playable && myTurn, hint, selected: sel });
  }).join('');

  const targetMsg = ui.selected?.kind === 'card' && selDef
    ? `<div class="target-msg" role="status"><span>🎯 「${chem(selDef.name)}」の対象の敵をタップ</span> <button class="btn small" data-a="cancelSelect">取消</button></div>`
    : ui.selected?.kind === 'potion'
      ? '<div class="target-msg" role="status"><span>🎯 試薬瓶を使う敵をタップ</span> <button class="btn small" data-a="cancelSelect">取消</button></div>'
      : '';

  const kindLabel = { battle: '戦闘', elite: '強敵', boss: 'ボス戦' }[c.kind] || '戦闘';
  return `<main class="screen combat-screen kind-${esc(c.kind)}">
    <div class="combat-top">
      <div class="combat-title"><span class="ct-kind">${esc(kindLabel)}</span><span class="ct-turn">ターン ${c.turn}</span>${c.reactionsThisCombat ? `<span class="ct-rx">⚗ 反応 ${c.reactionsThisCombat}</span>` : ''}</div>
      <section class="enemies count-${c.enemies.length}" aria-label="敵">${c.enemies.map((e) => enemyPanel(ctx, e, selDef)).join('')}</section>
    </div>
    <div class="combat-mid" data-scroll-key="mid">
      ${phMeter(ctx)}
      ${logPanel(ctx)}
    </div>
    <div class="combat-bottom">
      ${playerStrip(ctx)}
      ${targetMsg}
      <section class="hand count-${c.hand.length}" data-scroll-key="hand" aria-label="手札 ${c.hand.length}枚">${hand || '<p class="muted hand-empty">手札がない</p>'}</section>
      <div class="combat-bar">
        <div class="energy" aria-label="エネルギー ${c.player.energy}/${run.player.energyPerTurn}"><span aria-hidden="true">⚡</span><b>${c.player.energy}</b><small>/${run.player.energyPerTurn}</small></div>
        <div class="piles">
          <button class="pile" data-a="pile" data-pile="draw" aria-label="山札 ${c.draw.length}枚"><span aria-hidden="true">📚</span><b>${c.draw.length}</b><small>山札</small></button>
          <button class="pile" data-a="pile" data-pile="discard" aria-label="捨て札 ${c.discard.length}枚"><span aria-hidden="true">🗑️</span><b>${c.discard.length}</b><small>捨て札</small></button>
          <button class="pile" data-a="pile" data-pile="exhaust" aria-label="除外 ${c.exhaust.length}枚"><span aria-hidden="true">🔥</span><b>${c.exhaust.length}</b><small>除外</small></button>
        </div>
        <button class="btn end-turn primary" data-a="endTurn"${myTurn ? '' : ' disabled'}>ターン終了</button>
      </div>
    </div>
  </main>`;
}

export function powerInfo(ctx, i) {
  const pw = ctx.run.combat?.player.powers?.[i];
  if (!pw) return null;
  const trig = {
    turnStart: 'ターン開始時', turnEnd: 'ターン終了時', onCardPlayed: 'カード使用時', onReaction: '反応成立時', onFizzle: '不発時',
    onQuizCorrect: '正解時', onQuizWrong: '誤答時', onAttacked: '攻撃を受けた時', onPhChange: 'pH変化時', onExhaust: '除外時', onEnemyDeath: '敵撃破時', combatStart: '戦闘開始時',
  }[pw.trigger] || pw.trigger;
  return { title: chem(pw.name || '常在効果'), body: `<p>${esc(trig)}${pw.every ? `（${pw.every}回ごと）` : ''}: ${chem(describeEffects(ctx.db, pw.effects, { side: 'player' }) || '—')}</p>` };
}
