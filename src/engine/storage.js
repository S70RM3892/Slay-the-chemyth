// Injectable key/value storage. Every access is try/catch-safe so the game keeps
// working when localStorage is unavailable (private mode, quota, Node).

import { ENGINE_VERSION, STORAGE_KEYS } from './constants.js';
import { normalizeMeta } from './meta.js';

/** In-memory adapter (Node / tests / fallback). */
export function createMemoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    _map: m,
  };
}

/** Browser localStorage adapter; falls back to memory when unusable. */
export function createBrowserStorage() {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return createMemoryStorage();
    const t = '__chemyth_probe__';
    ls.setItem(t, '1');
    ls.removeItem(t);
    return {
      getItem: (k) => ls.getItem(k),
      setItem: (k, v) => ls.setItem(k, v),
      removeItem: (k) => ls.removeItem(k),
    };
  } catch {
    return createMemoryStorage();
  }
}

export function safeGet(storage, key) {
  try { return storage ? storage.getItem(key) : null; } catch { return null; }
}
export function safeSet(storage, key, value) {
  try { if (storage) storage.setItem(key, value); return true; } catch { return false; }
}
export function safeRemove(storage, key) {
  try { if (storage) storage.removeItem(key); return true; } catch { return false; }
}

export function saveRun(storage, run) {
  if (!run) return safeRemove(storage, STORAGE_KEYS.run);
  let json;
  try { json = JSON.stringify(run); } catch { return false; }
  return safeSet(storage, STORAGE_KEYS.run, json);
}

/**
 * Load and sanity-check a saved run. Unknown card/relic/potion ids (data changed)
 * are dropped. Returns null if missing/corrupt/finished.
 */
export function loadRun(storage, db) {
  const raw = safeGet(storage, STORAGE_KEYS.run);
  if (!raw) return null;
  let run;
  try { run = JSON.parse(raw); } catch { return null; }
  if (!run || typeof run !== 'object' || run.version !== ENGINE_VERSION) return null;
  if (!run.player || !Array.isArray(run.deck) || !run.map || typeof run.rng !== 'number') return null;
  if (run.result) return null;
  if (db) {
    run.deck = run.deck.filter((d) => d && db.cards.has(d.id));
    run.relics = (run.relics || []).filter((r) => r && db.relics.has(r.id));
    run.potions = (run.potions || []).map((p) => (p && db.potions.has(p) ? p : null));
    if (run.combat) {
      const ok = (i) => i && db.cards.has(i.id);
      for (const k of ['draw', 'hand', 'discard', 'exhaust', 'playing']) run.combat[k] = (run.combat[k] || []).filter(ok);
      if (run.combat.enemies.some((e) => !db.enemies.has(e.id))) return null;
    }
  }
  run.queue ||= [];
  run.log ||= [];
  run.errors ||= [];
  return run;
}

export function clearRun(storage) {
  return safeRemove(storage, STORAGE_KEYS.run);
}

export function saveMeta(storage, meta) {
  let json;
  try { json = JSON.stringify(meta); } catch { return false; }
  return safeSet(storage, STORAGE_KEYS.meta, json);
}

export function loadMeta(storage) {
  const raw = safeGet(storage, STORAGE_KEYS.meta);
  if (!raw) return normalizeMeta(null);
  try { return normalizeMeta(JSON.parse(raw)); } catch { return normalizeMeta(null); }
}
