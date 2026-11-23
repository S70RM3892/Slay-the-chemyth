// Title screen and settings.
import { constants as C } from '../../engine/index.js';
import { esc } from '../chem.js';
import { bedtimeBanner } from '../components.js';

const DIFF_DESC = {
  kiso: '教科書の基礎（L1）中心。用語・反応・公式の確認から。',
  hyojun: '入試標準（L2）中心。計算と知識の運用を鍛える。',
  kyodai: '京大レベル（L2〜L3）中心。多段の思考と状況把握。敵HP+10%。',
};

export function titleView(ctx) {
  const { game, ui, meta } = ctx;
  const canContinue = (game.run && !game.run.result) || safeHasSaved(game);
  const wr = game.weaknessReport();
  const totalAsked = wr.fields.reduce((s, f) => s + f.asked, 0);
  const totalCorrect = wr.fields.reduce((s, f) => s + f.correct, 0);
  const banner = ui.bedtimeKey !== 'title' ? bedtimeBanner(game.bedtimeWarning()) : '';

  let panel;
  if (ui.titleMode === 'new') {
    const cur = ui.newDifficulty || meta.settings.difficulty || 'hyojun';
    panel = `<section class="title-panel" aria-labelledby="diff-h">
      <h2 id="diff-h">難易度を選ぶ</h2>
      <div class="diff-list" role="radiogroup" aria-label="難易度">
        ${Object.values(C.DIFFICULTIES).map((d) => `<button class="diff${d.id === cur ? ' on' : ''}" role="radio" aria-checked="${d.id === cur}" data-a="pickDiff" data-id="${esc(d.id)}">
          <span class="diff-name">${esc(d.label)}</span><span class="diff-id">${esc(d.id)}</span>
          <span class="diff-desc">${esc(DIFF_DESC[d.id] || '')}</span>
          <span class="diff-mix">出題: L1 ${d.levelWeights[1]}% / L2 ${d.levelWeights[2]}% / L3 ${d.levelWeights[3]}%</span>
        </button>`).join('')}
      </div>
      ${canContinue ? '<p class="note warn">中断中のランがあります。新規に始めると放棄（敗北扱い）になります。</p>' : ''}
      <div class="row-btns">
        <button class="btn" data-a="titleMode" data-mode="main">戻る</button>
        <button class="btn primary" data-a="startRun">この難易度で始める</button>
      </div>
    </section>`;
  } else {
    panel = `<nav class="title-menu" aria-label="タイトルメニュー">
      ${canContinue ? '<button class="btn primary big" data-a="continue">▶ 続きから</button>' : ''}
      <button class="btn ${canContinue ? '' : 'primary'} big" data-a="titleMode" data-mode="new">＋ 新規</button>
      <button class="btn big" data-a="coopOpen">🤝 友達と協力（オンライン）</button>
      <div class="title-sub">
        <button class="btn" data-a="openView" data-view="codex">📚 図鑑</button>
        <button class="btn" data-a="openView" data-view="weakness">📊 弱点分析</button>
        <button class="btn" data-a="openView" data-view="settings">⚙ 設定</button>
      </div>
    </nav>`;
  }

  return `<main class="screen title-screen">
    ${banner}
    <div class="title-logo" aria-label="Slay the Chemyth">
      <div class="logo-tiles" aria-hidden="true">
        <span class="ptile f-theory"><i>6</i>C</span><span class="ptile f-inorganic"><i>1</i>H</span><span class="ptile f-organic"><i>8</i>O</span>
      </div>
      <h1>Slay the <span>Chemyth</span></h1>
      <p class="tagline-main">化学の誤概念（ミス）を倒し、京大化学を登りきれ。</p>
    </div>
    ${panel}
    <section class="title-stats" aria-label="記録">
      <div><b>${meta.runs.played}</b><span>挑戦</span></div>
      <div><b>${meta.runs.won}</b><span>突破</span></div>
      <div><b>${totalAsked ? Math.round((totalCorrect / totalAsked) * 100) + '%' : '—'}</b><span>正答率</span></div>
      <div><b>${wr.notebookCount}</b><span>誤答ノート</span></div>
    </section>
    <p class="foot muted">タップのみで遊べます。カード長押し／ⓘで学習メモ。進行は自動保存。</p>
  </main>`;
}

function safeHasSaved(game) {
  try { return game.hasSavedRun(); } catch { return false; }
}

export function settingsView(ctx) {
  const { meta, ui } = ctx;
  const s = meta.settings;
  return `<main class="screen settings-screen">
    <div class="view-head"><button class="btn" data-a="back">← 戻る</button><h1>設定</h1></div>
    <section class="panel">
      <h2>睡眠ガード</h2>
      <p class="muted">就寝時刻〜起床時刻の間は、タイトルとノード移動ごとに「寝ろ」バナーを表示します（プレイは止めません）。</p>
      <div class="form-row"><label for="set-bed">就寝時刻</label><input id="set-bed" type="time" value="${esc(s.bedtime || '23:00')}" data-setting="bedtime"></div>
      <div class="form-row"><label for="set-wake">起床時刻</label><input id="set-wake" type="time" value="${esc(s.wakeTime || '05:00')}" data-setting="wakeTime"></div>
    </section>
    <section class="panel">
      <h2>既定の難易度</h2>
      <div class="form-row"><label for="set-diff">難易度</label>
        <select id="set-diff" data-setting="difficulty">${Object.values(C.DIFFICULTIES).map((d) => `<option value="${esc(d.id)}"${d.id === s.difficulty ? ' selected' : ''}>${esc(d.label)}（${esc(d.id)}）</option>`).join('')}</select></div>
    </section>
    <section class="panel">
      <h2>表示</h2>
      <div class="form-row"><label for="set-anim">演出アニメーション</label>
        <select id="set-anim" data-pref="anim"><option value="1"${ui.prefs.anim ? ' selected' : ''}>オン（OSの「視差効果を減らす」を優先）</option><option value="0"${ui.prefs.anim ? '' : ' selected'}>オフ</option></select></div>
    </section>
    <section class="panel">
      <h2>データ</h2>
      <p class="muted">誤答ノート・正答率・反応ノート・図鑑はこの端末のブラウザに保存されています。</p>
      <button class="btn danger" data-a="confirmResetMeta">学習記録をすべて消去</button>
    </section>
  </main>`;
}
