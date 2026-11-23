// Co-op (online) screens: lobby, in-run status bar, quiz team panels.
import { constants as C } from '../../engine/index.js';
import { chem, esc } from '../chem.js';
import { MAX_PLAYERS } from '../../net/coop.js';

export function shareUrl(code) {
  try {
    const u = new URL(location.href);
    u.search = '';
    u.hash = '';
    u.searchParams.set('room', code);
    return u.href;
  } catch { return ''; }
}

function playerList(coop, { showCtl = false } = {}) {
  const s = coop.state;
  const ctl = showCtl ? coop.controllerId() : null;
  return `<ul class="coop-players">${s.players.map((p) => `<li class="${p.id === ctl ? 'ctl' : ''}">
      <span class="cp-name">${esc(p.name)}</span>
      ${p.id === 'host' ? '<span class="badge">ホスト</span>' : ''}
      ${p.id === s.selfId ? '<span class="badge nb">あなた</span>' : ''}
      ${p.id === ctl ? '<span class="badge lv">操作中</span>' : ''}
    </li>`).join('')}</ul>`;
}

const RULES = `<section class="panel coop-rules">
  <h2>協力プレイのルール</h2>
  <ul>
    <li>デッキ・HP・研究費は<b>全員で共有</b>。最大${MAX_PLAYERS}人。</li>
    <li>戦闘は<b>ターンごとに操作担当が交代</b>。マップや報酬の選択は階ごとにリーダーが交代。</li>
    <li>出題は<b>全員がそれぞれ解答</b>。半数以上が正解ならチーム正解。</li>
    <li>誤答は<b>自分の端末の誤答ノート</b>に入る。人任せにすると自分だけ弱点が残る。</li>
    <li>解説は全員が「次へ」を押すまで閉じない。チャットで解法を教え合え。</li>
  </ul>
</section>`;

export function coopView(ctx) {
  const { coop, ui, game } = ctx;
  const s = coop.state;
  let body;
  if (s.status === 'connecting') {
    body = `<section class="panel"><p class="coop-wait" role="status">接続中…（数秒〜20秒ほど）</p>
      <button class="btn" data-a="coopLeave">やめる</button></section>`;
  } else if (s.role === 'host') {
    const cur = ui.newDifficulty || 'hyojun';
    const url = shareUrl(s.code);
    const canContinue = safe(() => game.hasSavedRun());
    body = `<section class="panel coop-room">
        <h2>部屋を開いた</h2>
        <p class="muted">このコードかリンクを友達に送る。この画面（タブ）を開いたままにすること。</p>
        <div class="coop-code" aria-label="ルームコード ${esc(s.code)}">${esc(s.code)}</div>
        <div class="row-btns">
          <button class="btn" data-a="coopCopy" data-t="${esc(s.code)}">コードをコピー</button>
          <button class="btn" data-a="coopCopy" data-t="${esc(url)}">招待リンクをコピー</button>
        </div>
      </section>
      <section class="panel">
        <h2>参加者（${s.players.length}/${MAX_PLAYERS}）</h2>
        ${playerList(coop)}
        ${s.players.length < 2 ? '<p class="note">まだ自分だけ。友達の参加を待つか、このまま始めて途中参加してもらうこともできる。</p>' : ''}
      </section>
      <section class="panel">
        <h2>難易度</h2>
        <div class="coop-diff" role="radiogroup" aria-label="難易度">
          ${Object.values(C.DIFFICULTIES).map((d) => `<button class="btn${d.id === cur ? ' primary' : ''}" role="radio" aria-checked="${d.id === cur}" data-a="pickDiff" data-id="${esc(d.id)}">${esc(d.label)}</button>`).join('')}
        </div>
        <div class="row-btns coop-start">
          <button class="btn primary big" data-a="coopStart">新しいランで開始</button>
          ${canContinue ? '<button class="btn big" data-a="coopStart" data-continue="1">自分の中断ランを全員で続ける</button>' : ''}
        </div>
        ${canContinue ? '<p class="note warn">「新しいランで開始」すると、自分の中断中のランは放棄（敗北扱い）になる。</p>' : ''}
      </section>
      <button class="btn danger" data-a="coopLeave">部屋を閉じて戻る</button>`;
  } else if (s.role === 'guest') {
    body = `<section class="panel">
        <h2>部屋 ${esc(s.code)} に参加中</h2>
        ${playerList(coop)}
        <p class="coop-wait" role="status">ホストの開始を待っている…</p>
      </section>
      <button class="btn danger" data-a="coopLeave">退出して戻る</button>`;
  } else {
    const name = ui.coopName || '';
    const code = ui.coopCode || '';
    body = `${s.closeReason ? `<p class="note warn" role="status">${esc(s.closeReason)}</p>` : ''}
      ${s.error ? `<p class="note warn" role="alert">${esc(s.error)}</p>` : ''}
      <section class="panel">
        <h2>名前</h2>
        <div class="form-row"><label for="coop-name">表示名（12文字まで）</label>
          <input id="coop-name" type="text" maxlength="12" autocomplete="nickname" value="${esc(name)}" data-input="coopName" placeholder="例: たろう"></div>
      </section>
      <section class="panel">
        <h2>部屋を作る</h2>
        <p class="muted">自分がホストになり、ルームコードを友達に送る。</p>
        <button class="btn primary big" data-a="coopHost">部屋を作る</button>
      </section>
      <section class="panel">
        <h2>部屋に入る</h2>
        <form data-form="coopJoin" autocomplete="off">
          <div class="form-row"><label for="coop-code">ルームコード（英数字5文字）</label>
            <input id="coop-code" type="text" maxlength="8" autocapitalize="characters" spellcheck="false" value="${esc(code)}" data-input="coopCode" placeholder="例: K7MQ2"></div>
          <button type="submit" class="btn primary big">参加する</button>
        </form>
      </section>
      <p class="note">通信は端末どうしの直接接続（WebRTC）。接続の仲介にだけ PeerJS の公開サーバーを使う。学校やカフェのWi-Fiではつながらないことがある。その場合はモバイル回線やテザリングで試す。</p>`;
  }
  return `<main class="screen coop-screen">
    <div class="view-head">${s.role || s.status === 'connecting' ? '' : '<button class="btn" data-a="back">← 戻る</button>'}<h1>友達と協力（オンライン）</h1></div>
    ${body}
    ${RULES}
  </main>`;
}

/** Bar under the top bar during a co-op run. */
export function coopBar(ctx) {
  const { coop, run, ui } = ctx;
  if (!coop.active) return '';
  const s = coop.state;
  const mine = coop.isMyTurn();
  const p = run?.pending;
  let who;
  if (p && (p.kind === 'quiz' || p.kind === 'quizResult')) who = '全員で解答';
  else if (mine) who = 'あなたの番';
  else who = `${esc(coop.controllerName() || '—')} の番`;
  const unread = ui.chatUnread > 0 ? `<span class="coop-unread" aria-label="未読${ui.chatUnread}件">${ui.chatUnread > 9 ? '9+' : ui.chatUnread}</span>` : '';
  return `<div class="coop-bar${mine ? ' mine' : ''}" role="status">
    <span class="coop-turn">${who}</span>
    <span class="coop-count" aria-label="参加者${s.players.length}人">👥 ${s.players.length}</span>
    <button class="btn small coop-chat-btn" data-a="coopChatToggle" aria-label="チャットと参加者を開く">💬 チャット${unread}</button>
  </div>`;
}

/** Shown in the quiz modal while answering. */
export function coopQuizStatus(ctx) {
  const { coop } = ctx;
  const s = coop.state;
  const on = coop.onlinePlayers();
  const done = on.filter((p) => s.quiz.answered.includes(p.id)).length;
  const names = on.map((p) => `<span class="cq-p${s.quiz.answered.includes(p.id) ? ' done' : ''}">${s.quiz.answered.includes(p.id) ? '✓' : '…'} ${esc(p.name)}</span>`).join('');
  return `<div class="coop-quiz" id="coop-quiz-status" role="status">
    <b>各自で解答（${done}/${on.length}）</b> ${names}
    ${coop.hasAnswered() ? '<p class="cq-wait">解答を送った。全員が答えるまで待つ。</p>' : '<p class="cq-wait">相談はチャットで。ただし答えは自分で出せ。</p>'}
  </div>`;
}

/** Team table on the result screen + the personal verdict line. */
export function coopQuizResult(ctx, p) {
  const { coop } = ctx;
  const s = coop.state;
  const team = Array.isArray(p.team) ? p.team : [];
  const me = team.find((x) => x.id === s.selfId);
  const right = team.filter((x) => x.correct).length;
  const rows = team.map((x) => `<tr class="${x.correct ? 'ok' : 'ng'}">
      <th scope="row">${esc(x.name)}${x.id === s.selfId ? '（あなた）' : ''}</th>
      <td>${chem(x.answerText || '—')}</td>
      <td class="cq-mark" aria-label="${x.correct ? '正解' : '不正解'}">${x.correct ? '◯' : '✕'}</td>
    </tr>`).join('');
  return `<section class="coop-team">
    <h3>チームの解答（正解 ${right}/${team.length}）</h3>
    <table class="cq-table"><tbody>${rows}</tbody></table>
    ${me ? `<p class="nb-status ${me.correct ? 'ok' : 'ng'}">あなたは${me.correct ? '正解' : '不正解'}。${me.correct ? '' : '自分の誤答ノートに入った。解説を読んで、なぜ間違えたかを言葉にしろ。'}</p>` : '<p class="nb-status">この問題には途中参加のため未解答。</p>'}
  </section>`;
}

export function coopReadyButton(ctx) {
  const { coop } = ctx;
  const s = coop.state;
  const on = coop.onlinePlayers();
  const n = on.filter((p) => s.quiz.ready.includes(p.id)).length;
  const ready = coop.isReady();
  return `<button class="btn primary wide" data-a="continueQuiz"${ready ? ' disabled' : ''}>${ready ? `他のプレイヤーを待っている（${n}/${on.length}）` : `解説を読んだ・次へ（${n}/${on.length}）`}</button>`;
}

function safe(f) { try { return f(); } catch { return false; } }
