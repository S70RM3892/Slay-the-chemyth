// Quiz system: answer parsing/judging, question selection, pending-quiz objects.

import { DEFAULT_TOLERANCE, DIFFICULTIES, DEFAULT_DIFFICULTY, NOTEBOOK_PRIORITY } from './constants.js';
import { actQuestionFields, expandQuestionFields } from './data.js';
import { chance, pick, shuffle, weightedPick } from './rng.js';
import { weakestField } from './meta.js';

// ---------------------------------------------------------------------------
// Numeric answer parsing
// ---------------------------------------------------------------------------

const FW_MAP = {
  '．': '.', '。': '.', '，': ',', '、': ',', '－': '-', '−': '-', '‐': '-', '‑': '-', '–': '-', '—': '-',
  'ー': '-', '＋': '+', '＊': '*', '＾': '^', '（': '(', '）': ')', '｛': '{', '｝': '}', 'ｅ': 'e', 'Ｅ': 'E',
  'ｘ': 'x', 'Ｘ': 'X', '　': ' ', '✕': '×', '✖': '×', '⋅': '×', '·': '×', '・': '×',
};
const SUPERSCRIPTS = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+' };

/** Normalize full-width / typographic characters. */
export function normalizeAnswerText(s) {
  let out = '';
  for (const ch of String(s ?? '')) {
    const code = ch.charCodeAt(0);
    if (code >= 0xff10 && code <= 0xff19) out += String.fromCharCode(code - 0xff10 + 48);
    else if (FW_MAP[ch] !== undefined) out += FW_MAP[ch];
    else out += ch;
  }
  return out.trim();
}

const NUM = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
const RE_PLAIN = new RegExp('^(' + NUM + ')(?:[eE]([+-]?\\d+))?');
const RE_TIMES10 = new RegExp('^(' + NUM + ')?\\s*(?:[×xX*]\\s*)?10\\s*(?:\\^|\\*\\*)\\s*[({]?\\s*([+-]?\\d+)\\s*[)}]?');

/**
 * Parse a user's numeric answer. Accepts e.g. "1.2", "1.2e-5", "1.2×10^-5",
 * "1.2*10^-5", "1.2x10^{-5}", "1.2×10⁻⁵", "10^-3", full-width digits, thousands
 * commas and a trailing unit ("0.10 mol/L"). Returns NaN when not parseable.
 */
export function parseNumericAnswer(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : NaN;
  let s = normalizeAnswerText(input);
  if (!s) return NaN;
  // superscript exponents: 10⁻⁵ -> 10^-5
  s = s.replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+)/g, (m) => '^' + [...m].map((c) => SUPERSCRIPTS[c]).join(''));
  s = s.replace(/\s+/g, '');
  // thousands separators "1,000" (only when groups of 3 follow)
  s = s.replace(/(\d),(?=\d{3}(?!\d))/g, '$1');
  s = s.replace(/,/g, '.'); // decimal comma fallback
  // "1.2×10^-5" / "10^-5" style
  let m = RE_TIMES10.exec(s);
  if (m && (m[1] !== undefined || /^[+-]?10/.test(s))) {
    const rest = s.slice(m[0].length);
    if (/\d/.test(rest)) return NaN;
    let mant = m[1] === undefined ? 1 : Number(m[1]);
    if (m[1] !== undefined && !/[×xX*]/.test(s.slice(m[1].length, m[1].length + 2))) {
      // "1.210^-5" without a multiplication sign is ambiguous -> reject
      return NaN;
    }
    if (m[1] === undefined && s.startsWith('-')) mant = -1;
    const v = mant * Math.pow(10, Number(m[2]));
    return Number.isFinite(v) ? v : NaN;
  }
  m = RE_PLAIN.exec(s);
  if (!m) return NaN;
  const rest = s.slice(m[0].length);
  if (/\d/.test(rest)) return NaN; // e.g. "1.2.3", "1.2×10" without exponent
  const v = Number(m[1]) * (m[2] !== undefined ? Math.pow(10, Number(m[2])) : 1);
  return Number.isFinite(v) ? v : NaN;
}

/** Judge a numeric value against a question. */
export function judgeNumeric(q, value) {
  const v = typeof value === 'number' ? value : parseNumericAnswer(value);
  const a = Number(q.answer);
  if (!Number.isFinite(v) || !Number.isFinite(a)) return false;
  const tol = q.tolerance ?? DEFAULT_TOLERANCE;
  if (q.absTolerance != null && Math.abs(v - a) <= q.absTolerance + 1e-15) return true;
  if (a === 0) return Math.abs(v) <= (q.absTolerance ?? 1e-12);
  return Math.abs(v - a) / Math.abs(a) <= tol + 1e-12;
}

// ---------------------------------------------------------------------------
// Question selection
// ---------------------------------------------------------------------------

export function rollLevel(G) {
  const diff = DIFFICULTIES[G.run?.difficulty] || DIFFICULTIES[DEFAULT_DIFFICULTY];
  const items = Object.entries(diff.levelWeights).map(([l, w]) => ({ l: Number(l), w }));
  const r = weightedPick(G.run, items, (x) => x.w);
  return r ? r.l : 2;
}

/**
 * Select a question. opts: { questionId, fields (array|null), field, topic, level, pool:'review' }
 * Algorithm (DESIGN §5.5): among candidates, 40% chance to pick a notebook question;
 * otherwise prefer the requested level, questions not yet asked this run, then never asked.
 * Relaxation order when nothing matches: topic -> field -> whole bank. Returns null if bank empty.
 */
export function selectQuestion(G, opts = {}) {
  const { db, run, meta } = G;
  if (opts.questionId) {
    const q = db.questions.get(opts.questionId);
    if (q) return q;
  }
  if (opts.pool === 'review') return selectReviewQuestion(G, opts);
  const pool = db.questionPool;
  if (!pool.length) {
    // fall back to quiz-set parts if that is all we have
    const any = [...db.questions.values()];
    return any.length ? pick(run, any) : null;
  }
  const fields = opts.fields !== undefined ? opts.fields : expandQuestionFields(opts.field);
  const asked = new Set(run?.askedQuestions || []);
  let cands = pool.filter((q) => (!fields || fields.includes(q.field)) && (!opts.topic || q.topic === opts.topic));
  if (!cands.length && opts.topic) cands = pool.filter((q) => !fields || fields.includes(q.field));
  if (!cands.length) cands = pool;

  const nb = cands.filter((q) => meta.notebook[q.id] && !asked.has(q.id));
  if (nb.length && chance(run, NOTEBOOK_PRIORITY)) return pick(run, nb);

  const level = opts.level ?? rollLevel(G);
  const fresh = cands.filter((q) => !asked.has(q.id));
  const tiers = [
    fresh.filter((q) => q.level === level),
    fresh.filter((q) => Math.abs((q.level ?? 2) - level) === 1),
    fresh,
    cands.filter((q) => q.level === level),
    cands,
  ];
  const tier = tiers.find((t) => t.length) || cands;
  const never = tier.filter((q) => !meta.stats.questions[q.id]?.asked);
  return pick(run, never.length ? never : tier);
}

/** 復習: notebook first, then the weakest field, then the current act's fields. */
export function selectReviewQuestion(G) {
  const { db, run, meta } = G;
  const asked = new Set(run?.askedQuestions || []);
  const nb = Object.keys(meta.notebook).filter((id) => db.questions.has(id) && !asked.has(id));
  if (nb.length) return db.questions.get(pick(run, nb));
  const weak = weakestField(meta);
  return selectQuestion(G, { fields: weak ? [weak] : actQuestionFields(run.act) });
}

// ---------------------------------------------------------------------------
// Pending quiz objects (plain JSON; the UI renders these)
// ---------------------------------------------------------------------------

/**
 * Build the pending quiz object. extra: { ctx, onCorrect, onWrong, source, setInfo }
 */
export function makeQuizPending(G, q, extra = {}) {
  const { db, run } = G;
  const part = db.partOf.get(q.id);
  const set = part ? db.quizSets.get(part.setId) : null;
  let choiceOrder = null;
  let choices = null;
  if (q.type === 'choice' && Array.isArray(q.choices)) {
    choiceOrder = shuffle(run, q.choices.map((_, i) => i));
    choices = choiceOrder.map((i) => q.choices[i]);
  }
  (run.askedQuestions ||= []).push(q.id);
  return {
    kind: 'quiz',
    questionId: q.id,
    field: q.field, topic: q.topic, level: q.level, type: q.type,
    text: q.text, given: q.given ?? null, unit: q.unit ?? null,
    choices, choiceOrder,
    setId: set ? set.id : null,
    setTitle: set ? set.title : null,
    lead: set ? set.lead : null,
    partIndex: part ? part.index : null,
    partCount: set ? set.parts.length : null,
    inNotebook: !!G.meta.notebook[q.id],
    source: extra.source || extra.ctx?.source || 'system',
    sourceName: extra.sourceName ?? null,
    ctx: extra.ctx || null,
    onCorrect: extra.onCorrect || [],
    onWrong: extra.onWrong || [],
  };
}

/**
 * Judge an answer for a pending quiz.
 * choice: answer is the DISPLAYED index (0..3) (a numeric string is accepted).
 * numeric: answer is a number or string.
 */
export function judgePending(q, pending, answer) {
  if (q.type === 'choice') {
    const di = typeof answer === 'number' ? answer : parseInt(normalizeAnswerText(answer), 10);
    const order = pending.choiceOrder || (q.choices || []).map((_, i) => i);
    const correctDisplay = order.indexOf(q.answer);
    const correct = Number.isInteger(di) && di >= 0 && di < order.length && order[di] === q.answer;
    return { correct, correctDisplay, parsed: Number.isInteger(di) ? di : null };
  }
  const parsed = typeof answer === 'number' ? answer : parseNumericAnswer(answer);
  return { correct: judgeNumeric(q, parsed), correctDisplay: null, parsed: Number.isFinite(parsed) ? parsed : null };
}

/** Text of the correct answer for feedback. */
export function correctAnswerText(q) {
  if (q.type === 'choice') return Array.isArray(q.choices) ? q.choices[q.answer] : String(q.answer);
  return String(q.answer) + (q.unit ? ' ' + q.unit : '');
}
