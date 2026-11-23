// Co-op session logic (DOM-free). One host runs the real engine; guests mirror its state.
//
//   const coop = createCoop({ game, onUpdate });
//   await coop.host({ name })            // → coop.state.code is the room code to share
//   await coop.join({ code, name })
//   coop.start({ difficulty })           // host: new run (or { continueSaved:true })
//   coop.act({ type:'playCard', uid, target })   // any player; the host validates whose turn it is
//   coop.submitAnswer(answer)            // quiz: everybody answers on their own
//   coop.ready()                         // quiz explanation read → continue when everybody is ready
//
// Rules
//   - Shared deck / HP / gold. In combat the controller rotates every player turn; outside combat a
//     "leader" rotates every floor. Only the controller's actions are accepted.
//   - Quiz: every online player answers individually. The team is correct when at least half are correct.
//     Each player's own result goes to that player's own notebook and stats (no free riding).
//   - The explanation stays until every online player pressed 次へ.

import { hostRoom, joinRoom, makeRoomCode, normalizeRoomCode } from './transport.js';

export const MAX_PLAYERS = 4;
const HOST_ID = 'host';
const GUEST_ACTIONS = new Set([
  'chooseNode', 'playCard', 'endTurn', 'usePotion', 'discardPotion', 'selectCards', 'cancelSelection',
  'pickRewardCard', 'skipRewardCard', 'takeRewardPotion', 'takeRewardRelic', 'leaveReward',
  'chooseEventOption', 'leaveEvent', 'chooseRestOption', 'leaveRest',
  'buyCard', 'buyRelic', 'buyPotion', 'buyRemoval', 'leaveShop', 'openTreasure', 'leaveTreasure',
]);
const CHAT_MAX = 60;

const cleanName = (s, fallback) => (String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 12) || fallback);
const cleanText = (s) => String(s ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, 200);

/** Who may act on this run state? `players` = online players in join order. */
export function controllerOf(run, players) {
  if (!run || !players.length) return null;
  const c = run.combat;
  const inCombat = run.screen === 'combat' && c && (c.phase === 'player' || c.phase === 'enemy');
  const idx = inCombat ? Math.max(0, (c.turn || 1) - 1) : Math.max(0, run.floor || 0);
  return players[idx % players.length].id;
}

export function createCoop({ game, onUpdate = () => {} }) {
  const state = {
    role: null,            // 'host' | 'guest' | null
    status: 'idle',        // 'idle' | 'connecting' | 'lobby' | 'playing' | 'closed'
    code: '', kind: 'peer', error: null, selfId: null,
    players: [],           // [{id, name, online}]
    started: false,
    chat: [],              // [{id, name, text, at, system?}]
    quiz: { key: null, answered: [], ready: [], mine: null },
    closeReason: null,
  };
  let transport = null;
  const answers = new Map();   // host: playerId -> raw answer for the current quiz
  const recorded = new Set();  // guest: quiz results already written to the local notebook

  const emit = (type, extra = {}) => { try { onUpdate({ type, ...extra }); } catch (err) { console.error(err); } };
  const online = () => state.players.filter((p) => p.online);
  const pub = () => ({
    players: state.players, started: state.started, code: state.code,
    quiz: { key: state.quiz.key, answered: state.quiz.answered, ready: state.quiz.ready },
  });
  const quizKey = (run) => {
    const p = run && run.pending;
    return p && (p.kind === 'quiz' || p.kind === 'quizResult') ? `${run.quizLog.length - (p.kind === 'quizResult' ? 1 : 0)}:${p.questionId}` : null;
  };

  function pushChat(entry) {
    state.chat.push(entry);
    if (state.chat.length > CHAT_MAX) state.chat.splice(0, state.chat.length - CHAT_MAX);
  }
  const systemChat = (text) => ({ id: null, name: '', text, at: Date.now(), system: true });

  // ------------------------------------------------------------------ host
  function hostBroadcastState(events = []) {
    const run = game.run;
    const key = quizKey(run);
    if (key !== state.quiz.key) {
      state.quiz = { key, answered: [], ready: [], mine: null };
      answers.clear();
    }
    transport?.broadcast({ t: 'state', run, events, coop: pub() });
    emit('state', { events });
  }

  function hostSay(entry) {
    pushChat(entry);
    transport?.broadcast({ t: 'chat', entry });
    emit('chat');
  }

  function hostPlayersChanged() {
    transport?.broadcast({ t: 'players', coop: pub() });
    emit('players');
    hostCheckQuiz();
  }

  function answerText(pending, answer) {
    if (pending.type === 'choice') return pending.choices?.[Number(answer)] ?? '';
    return String(answer ?? '');
  }

  /** Resolve the quiz when everybody online has answered; continue when everybody is ready. */
  function hostCheckQuiz() {
    const run = game.run;
    const p = run && run.pending;
    if (!p) return;
    const on = online();
    if (!on.length) return;
    if (p.kind === 'quiz') {
      if (!on.every((pl) => answers.has(pl.id))) return;
      const team = on.map((pl) => {
        const a = answers.get(pl.id);
        const j = game.judgeAnswer(a);
        return { id: pl.id, name: pl.name, answerText: answerText(p, a), correct: !!(j && j.correct) };
      });
      const right = team.filter((x) => x.correct).length;
      const teamCorrect = right * 2 >= team.length;
      const mine = team.find((x) => x.id === HOST_ID);
      const rep = answers.has(HOST_ID) ? answers.get(HOST_ID) : answers.get(on[0].id);
      const res = game.answerQuiz(rep, { teamCorrect, personalCorrect: mine ? mine.correct : teamCorrect, team });
      hostBroadcastState(res.events);
    } else if (p.kind === 'quizResult') {
      if (!on.every((pl) => state.quiz.ready.includes(pl.id))) return;
      const res = game.continueQuiz();
      hostBroadcastState(res.events);
    }
  }

  function hostSubmit(id, answer) {
    const p = game.run && game.run.pending;
    if (!p || p.kind !== 'quiz' || answers.has(id)) return;
    if (p.type === 'choice') {
      const n = Number(answer);
      if (!Number.isInteger(n) || n < 0 || n >= (p.choices?.length || 0)) return;
      answer = n;
    } else answer = String(answer ?? '').slice(0, 40);
    answers.set(id, answer);
    if (!state.quiz.answered.includes(id)) state.quiz.answered.push(id);
    if (id === HOST_ID) state.quiz.mine = { answer };
    transport?.broadcast({ t: 'quiz', coop: pub() });
    emit('quiz');
    hostCheckQuiz();
  }

  function hostReady(id) {
    const p = game.run && game.run.pending;
    if (!p || p.kind !== 'quizResult' || state.quiz.ready.includes(id)) return;
    state.quiz.ready.push(id);
    transport?.broadcast({ t: 'quiz', coop: pub() });
    emit('quiz');
    hostCheckQuiz();
  }

  function hostAct(id, action) {
    if (!state.started || !game.run) return { ok: false, error: 'まだ始まっていない' };
    if (!action || !GUEST_ACTIONS.has(action.type)) return { ok: false, error: 'その操作はできない' };
    if (controllerOf(game.run, online()) !== id) return { ok: false, error: '今は自分の番ではない' };
    const res = game.dispatch(action);
    if (res.ok) hostBroadcastState(res.events);
    return { ok: res.ok, error: res.error };
  }

  function hostOnMessage(id, msg) {
    if (!msg || typeof msg !== 'object') return;
    const pl = state.players.find((p) => p.id === id);
    if (msg.t === 'join') {
      if (pl) return;
      if (state.players.length >= MAX_PLAYERS) {
        transport.send(id, { t: 'end', reason: '満員（最大' + MAX_PLAYERS + '人）' });
        setTimeout(() => transport?.kick?.(id), 200);
        return;
      }
      const name = cleanName(msg.name, 'ゲスト' + state.players.length);
      state.players.push({ id, name, online: true });
      transport.send(id, { t: 'hello', you: id, coop: pub(), chat: state.chat, run: state.started ? game.run : null });
      hostSay(systemChat(`${name} が参加した`));
      hostPlayersChanged();
      return;
    }
    if (!pl) return;
    if (msg.t === 'act') {
      const r = hostAct(id, msg.action);
      if (!r.ok) transport.send(id, { t: 'reject', error: r.error });
    } else if (msg.t === 'answer') hostSubmit(id, msg.answer);
    else if (msg.t === 'ready') hostReady(id);
    else if (msg.t === 'chat') {
      const text = cleanText(msg.text);
      if (text) hostSay({ id, name: pl.name, text, at: Date.now() });
    }
  }

  function hostOnLeave(id) {
    const i = state.players.findIndex((p) => p.id === id);
    if (i < 0) return;
    const [pl] = state.players.splice(i, 1);
    answers.delete(id);
    state.quiz.answered = state.quiz.answered.filter((x) => x !== id);
    state.quiz.ready = state.quiz.ready.filter((x) => x !== id);
    hostSay(systemChat(`${pl.name} が退出した`));
    hostPlayersChanged();
    if (state.started) hostBroadcastState([]);
  }

  // ------------------------------------------------------------------ guest
  function applyPub(c) {
    if (!c) return;
    state.players = c.players || [];
    state.started = !!c.started;
    if (c.quiz) {
      if (c.quiz.key !== state.quiz.key) state.quiz = { key: c.quiz.key, answered: [], ready: [], mine: null };
      state.quiz.answered = c.quiz.answered || [];
      state.quiz.ready = c.quiz.ready || [];
    }
  }

  function guestApplyRun(run, events = []) {
    game.setMirror(run);
    if (run) state.status = 'playing';
    for (const ev of events) if (ev && ev.type === 'reaction') game.recordReactionEvent(ev);
    const p = run && run.pending;
    if (p && p.kind === 'quizResult' && Array.isArray(p.team)) {
      const key = quizKey(run);
      const mine = p.team.find((x) => x.id === state.selfId);
      if (mine && !recorded.has(key)) {
        recorded.add(key);
        const nb = game.recordQuizAnswer(p.questionId, mine.correct);
        state.quiz.personal = { key, correct: mine.correct, ...(nb || {}) };
      }
    }
  }

  function guestOnMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'hello':
        state.selfId = msg.you;
        state.chat = Array.isArray(msg.chat) ? msg.chat.slice(-CHAT_MAX) : [];
        applyPub(msg.coop);
        state.status = msg.run ? 'playing' : 'lobby';
        if (msg.run) guestApplyRun(msg.run);
        emit('joined');
        break;
      case 'players': applyPub(msg.coop); emit('players'); break;
      case 'quiz': applyPub(msg.coop); emit('quiz'); break;
      case 'state':
        applyPub(msg.coop);
        guestApplyRun(msg.run, msg.events || []);
        emit('state', { events: msg.events || [] });
        break;
      case 'chat': pushChat(msg.entry); emit('chat'); break;
      case 'reject': emit('reject', { error: msg.error }); break;
      case 'end': shutdown(msg.reason || 'ホストが部屋を閉じた'); break;
      default: break;
    }
  }

  // ------------------------------------------------------------------ common
  function shutdown(reason) {
    const wasGuest = state.role === 'guest';
    try { transport?.close(); } catch { /* ignore */ }
    transport = null;
    if (wasGuest) game.setMirror(null);
    Object.assign(state, {
      role: null, status: 'closed', players: [], started: false, closeReason: reason || null,
      quiz: { key: null, answered: [], ready: [], mine: null },
    });
    answers.clear();
    emit('closed', { reason });
  }

  const api = {
    state,
    get active() { return state.role !== null; },
    get isHost() { return state.role === 'host'; },
    get isGuest() { return state.role === 'guest'; },
    onlinePlayers: online,
    controllerId: () => (state.started ? controllerOf(game.run, online()) : null),
    controllerName() { const id = api.controllerId(); return state.players.find((p) => p.id === id)?.name || ''; },
    /** May I perform game actions right now (not counting quiz answers)? */
    isMyTurn: () => state.role !== null && api.controllerId() === state.selfId,
    /** Solo play → always true. Co-op → only the controller, and never quiz actions (use submitAnswer/ready). */
    canAct(type) {
      if (state.role === null) return true;
      if (!GUEST_ACTIONS.has(type)) return false;
      return api.isMyTurn();
    },

    async host({ name, kind = 'peer' } = {}) {
      if (state.role) throw new Error('すでに部屋に入っている');
      Object.assign(state, { status: 'connecting', error: null, kind, closeReason: null, chat: [] });
      emit('status');
      let lastErr = null;
      for (let attempt = 0; attempt < 4 && !transport; attempt++) {
        const code = makeRoomCode();
        try {
          transport = await hostRoom(kind, code, {
            onPeer: () => {},
            onMessage: hostOnMessage,
            onLeave: hostOnLeave,
            onError: (err) => { state.error = err.message; emit('error', { error: err.message }); },
          });
          state.code = code;
        } catch (err) {
          lastErr = err;
          if (err.type !== 'unavailable-id') break;
        }
      }
      if (!transport) {
        Object.assign(state, { status: 'idle', error: lastErr?.message || '部屋を作れなかった' });
        emit('error', { error: state.error });
        throw lastErr || new Error(state.error);
      }
      Object.assign(state, {
        role: 'host', status: 'lobby', selfId: HOST_ID, started: false,
        players: [{ id: HOST_ID, name: cleanName(name, 'ホスト'), online: true }],
      });
      emit('hosted');
      return state.code;
    },

    async join({ code, name, kind = 'peer' } = {}) {
      if (state.role) throw new Error('すでに部屋に入っている');
      const norm = normalizeRoomCode(code);
      if (!norm) { state.error = 'ルームコードは英数字5文字'; emit('error', { error: state.error }); throw new Error(state.error); }
      Object.assign(state, { status: 'connecting', error: null, kind, code: norm, closeReason: null, chat: [] });
      emit('status');
      try {
        transport = await joinRoom(kind, norm, {
          onMessage: guestOnMessage,
          onClose: () => shutdown('ホストとの接続が切れた'),
          onError: (err) => { state.error = err.message; emit('error', { error: err.message }); },
        });
      } catch (err) {
        Object.assign(state, { status: 'idle', error: err.message });
        emit('error', { error: err.message });
        throw err;
      }
      state.role = 'guest';
      state.status = 'lobby';
      transport.send({ t: 'join', name: cleanName(name, 'ゲスト') });
      emit('status');
    },

    /** Host: begin the shared run. */
    start({ difficulty, continueSaved = false, seed } = {}) {
      if (state.role !== 'host') return { ok: false, error: 'ホストだけが開始できる' };
      const res = continueSaved ? game.continueRun() : game.newRun({ difficulty, seed });
      if (!res.ok) return res;
      state.started = true;
      state.status = 'playing';
      hostBroadcastState(res.events);
      return res;
    },

    /** Perform a game action (routed through the host). Returns {ok, error}; state arrives via onUpdate('state'). */
    act(action) {
      if (state.role === 'host') return hostAct(HOST_ID, action);
      if (state.role === 'guest') {
        if (!api.canAct(action?.type)) return { ok: false, error: '今は自分の番ではない' };
        transport?.send({ t: 'act', action });
        return { ok: true, error: null, remote: true };
      }
      return { ok: false, error: '部屋に入っていない' };
    },

    submitAnswer(answer) {
      if (state.quiz.mine) return;
      if (state.role === 'host') hostSubmit(HOST_ID, answer);
      else if (state.role === 'guest') {
        state.quiz.mine = { answer };
        transport?.send({ t: 'answer', answer });
        emit('quiz');
      }
    },
    hasAnswered: () => !!state.quiz.mine || state.quiz.answered.includes(state.selfId),
    ready() {
      if (state.role === 'host') hostReady(HOST_ID);
      else if (state.role === 'guest') transport?.send({ t: 'ready' });
    },
    isReady: () => state.quiz.ready.includes(state.selfId),

    chat(text) {
      const t = cleanText(text);
      if (!t) return;
      if (state.role === 'host') hostSay({ id: HOST_ID, name: state.players[0]?.name || 'ホスト', text: t, at: Date.now() });
      else if (state.role === 'guest') transport?.send({ t: 'chat', text: t });
    },

    /** Host only: push the current engine state again (e.g. after a host-side action outside act()). */
    resync(events = []) { if (state.role === 'host' && state.started) hostBroadcastState(events); },

    leave(reason = '退出した') {
      if (!state.role && !transport) { state.status = 'idle'; return; }
      if (state.role === 'host') transport?.broadcast({ t: 'end', reason: 'ホストが部屋を閉じた' });
      shutdown(reason);
      state.status = 'idle';
    },
  };
  return api;
}
