// Persistent meta-progression: wrong-answer notebook, stats, reaction notebook,
// settings, encyclopedia ("seen"). Plain JSON.

import { DEFAULT_SETTINGS, ENGINE_VERSION, GRADUATE_STREAK, QUESTION_FIELDS } from './constants.js';

export function createMeta() {
  return {
    version: ENGINE_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    // questionId -> { wrong, streak, addedAt, lastAt }
    notebook: {},
    // questionId -> graduatedAt timestamp
    graduated: {},
    stats: {
      fields: {}, // field -> { asked, correct }
      topics: {}, // 'field/topic' -> { field, topic, asked, correct }
      questions: {}, // qid -> { asked, correct, lastCorrect, lastAt }
    },
    // key 'cardId#index' -> { cardId, index, equation, explain, count, firstAt }
    reactions: {},
    seen: { cards: {}, enemies: {}, relics: {} },
    runs: { played: 0, won: 0, bestFloor: 0, bestAct: 0, history: [] },
  };
}

/** Accepts anything (possibly corrupt) and returns a valid meta object. */
export function normalizeMeta(m) {
  const base = createMeta();
  if (!m || typeof m !== 'object') return base;
  const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  return {
    version: ENGINE_VERSION,
    settings: { ...base.settings, ...obj(m.settings) },
    notebook: obj(m.notebook),
    graduated: obj(m.graduated),
    stats: {
      fields: obj(m.stats?.fields),
      topics: obj(m.stats?.topics),
      questions: obj(m.stats?.questions),
    },
    reactions: obj(m.reactions),
    seen: { cards: obj(m.seen?.cards), enemies: obj(m.seen?.enemies), relics: obj(m.seen?.relics) },
    runs: {
      ...base.runs,
      ...obj(m.runs),
      history: Array.isArray(m.runs?.history) ? m.runs.history.slice(-50) : [],
    },
  };
}

/**
 * Record an answer in stats and the wrong-answer notebook.
 * Returns { addedToNotebook, graduated, streak }.
 */
export function recordAnswer(meta, q, correct, now = 0) {
  const field = q.field || 'unknown';
  const topic = q.topic || '(未分類)';
  const f = (meta.stats.fields[field] ||= { asked: 0, correct: 0 });
  f.asked++; if (correct) f.correct++;
  const tk = field + '/' + topic;
  const t = (meta.stats.topics[tk] ||= { field, topic, asked: 0, correct: 0 });
  t.asked++; if (correct) t.correct++;
  const s = (meta.stats.questions[q.id] ||= { asked: 0, correct: 0 });
  s.asked++; if (correct) s.correct++;
  s.lastCorrect = !!correct; s.lastAt = now;

  const res = { addedToNotebook: false, graduated: false, streak: 0 };
  const nb = meta.notebook[q.id];
  if (!correct) {
    if (nb) { nb.wrong++; nb.streak = 0; nb.lastAt = now; }
    else {
      meta.notebook[q.id] = { wrong: 1, streak: 0, addedAt: now, lastAt: now, field, topic };
      res.addedToNotebook = true;
    }
    delete meta.graduated[q.id];
  } else if (nb) {
    nb.streak = (nb.streak || 0) + 1; nb.lastAt = now;
    res.streak = nb.streak;
    if (nb.streak >= GRADUATE_STREAK) {
      delete meta.notebook[q.id];
      meta.graduated[q.id] = now;
      res.graduated = true;
    }
  }
  return res;
}

export function recordReaction(meta, cardId, index, reaction, now = 0) {
  const key = cardId + '#' + index;
  const r = (meta.reactions[key] ||= {
    cardId, index, equation: reaction.equation || '', explain: reaction.explain || '', count: 0, firstAt: now,
  });
  r.count++;
  return r;
}

/** Field/topic accuracy table for the "弱点分析" screen. */
export function weaknessReport(meta) {
  const fields = QUESTION_FIELDS.map((field) => {
    const s = meta.stats.fields[field] || { asked: 0, correct: 0 };
    return { field, asked: s.asked, correct: s.correct, rate: s.asked ? s.correct / s.asked : null };
  });
  const topics = Object.values(meta.stats.topics)
    .map((t) => ({ ...t, rate: t.asked ? t.correct / t.asked : null }))
    .sort((a, b) => (a.rate ?? 1) - (b.rate ?? 1) || b.asked - a.asked);
  const notebookCount = Object.keys(meta.notebook).length;
  return { fields, topics, notebookCount };
}

/** Weakest field (lowest accuracy among fields with answers; null if no data). */
export function weakestField(meta) {
  let best = null;
  for (const field of QUESTION_FIELDS) {
    const s = meta.stats.fields[field];
    if (!s || !s.asked) continue;
    const rate = s.correct / s.asked;
    if (!best || rate < best.rate) best = { field, rate };
  }
  return best ? best.field : null;
}

/** Notebook entries joined with question data (for 図鑑/誤答ノート). */
export function notebookList(meta, db) {
  return Object.entries(meta.notebook)
    .map(([id, e]) => ({ id, ...e, question: db?.questions.get(id) || null }))
    .sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
}

export function reactionList(meta) {
  return Object.values(meta.reactions).sort((a, b) => (a.firstAt || 0) - (b.firstAt || 0));
}
