// Builds a read-only lookup database from injected data (real data or test
// fixtures). Data objects are never mutated.

import { ACT_QUESTION_FIELDS, QUESTION_FIELDS } from './constants.js';

const arr = (x) => (Array.isArray(x) ? x : []);

export function buildDb(data = {}) {
  const db = {
    raw: data,
    tags: new Map(),
    cards: new Map(),
    cardList: arr(data.CARDS),
    relics: new Map(),
    relicList: arr(data.RELICS),
    potions: new Map(),
    potionList: arr(data.POTIONS),
    enemies: new Map(),
    enemyList: arr(data.ENEMIES),
    encounters: arr(data.ENCOUNTERS),
    events: arr(data.EVENTS),
    eventMap: new Map(),
    questions: new Map(), // QUESTIONS + quiz-set parts
    questionPool: arr(data.QUESTIONS), // random-selection pool (parts excluded)
    quizSets: new Map(),
    partOf: new Map(), // part question id -> { setId, index }
    starterDeck: arr(data.STARTER_DECK),
    starterRelic: data.STARTER_RELIC ?? null,
    _cardCache: new Map(),
  };
  for (const t of arr(data.TAGS)) if (t && t.id) db.tags.set(t.id, t);
  for (const c of db.cardList) if (c && c.id) db.cards.set(c.id, c);
  for (const r of db.relicList) if (r && r.id) db.relics.set(r.id, r);
  for (const p of db.potionList) if (p && p.id) db.potions.set(p.id, p);
  for (const e of db.enemyList) if (e && e.id) db.enemies.set(e.id, e);
  for (const e of db.events) if (e && e.id) db.eventMap.set(e.id, e);
  db.questionPool = db.questionPool.filter((q) => q && q.id);
  for (const q of db.questionPool) db.questions.set(q.id, q);
  for (const s of arr(data.QUIZ_SETS)) {
    if (!s || !s.id) continue;
    const parts = arr(s.parts).filter((p) => p && p.id).map((p) => (p.field ? p : { ...p, field: s.field }));
    const set = { ...s, parts };
    db.quizSets.set(s.id, set);
    parts.forEach((p, index) => {
      db.questions.set(p.id, p);
      db.partOf.set(p.id, { setId: s.id, index });
    });
  }
  return db;
}

/** Card definition with upgrade overrides merged in (cached). */
export function cardDef(db, id, upgraded = false) {
  const base = db.cards.get(id);
  if (!base) return null;
  if (!upgraded || !base.upgrade) return base;
  const key = id + '+';
  let d = db._cardCache.get(key);
  if (!d) {
    d = { ...base, ...base.upgrade, id: base.id, name: base.name + '+', upgraded: true };
    delete d.upgrade;
    db._cardCache.set(key, d);
  }
  return d;
}

export function hasKeyword(def, kw) {
  return !!def && Array.isArray(def.keywords) && def.keywords.includes(kw);
}

export function isUpgradable(db, inst) {
  const d = db.cards.get(inst.id);
  return !!d && !inst.upgraded && !!d.upgrade;
}

/**
 * Expand a field spec to the list of question fields.
 * 'theory' -> theory1+theory2, 'neutral'/'all'/undefined -> null (=no restriction), arrays flattened.
 */
export function expandQuestionFields(field) {
  if (field == null || field === 'neutral' || field === 'all' || field === '') return null;
  if (Array.isArray(field)) {
    const out = [];
    for (const f of field) {
      const e = expandQuestionFields(f);
      if (e === null) return null;
      for (const x of e) if (!out.includes(x)) out.push(x);
    }
    return out.length ? out : null;
  }
  if (field === 'theory') return ['theory1', 'theory2'];
  if (QUESTION_FIELDS.includes(field)) return [field];
  return null;
}

export function actQuestionFields(act) {
  return (ACT_QUESTION_FIELDS[act] || ACT_QUESTION_FIELDS[5]).slice();
}

/** Does a filter field (card-field or question-field) match a value? */
export function fieldMatches(filterField, value) {
  if (filterField == null) return true;
  if (value == null) return false;
  if (filterField === value) return true;
  if (filterField === 'theory' && (value === 'theory1' || value === 'theory2')) return true;
  return false;
}
