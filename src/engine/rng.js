// Seeded PRNG (mulberry32). The whole RNG state is a single uint32 stored on a
// plain "holder" object (normally the run state: `run.rng`), so it serializes
// with the run and save/load preserves determinism. Never use Math.random in
// the engine.

/** Hash any seed (string/number) into a non-zero uint32. */
export function hashSeed(seed) {
  const str = String(seed ?? '');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // extra avalanche
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) || 0x9e3779b9;
}

/** Create a standalone holder (useful in tests / tools). */
export function createRng(seed) {
  return { rng: hashSeed(seed) };
}

/** Uniform float in [0,1). Mutates holder.rng. */
export function random(holder) {
  let t = (holder.rng = ((holder.rng >>> 0) + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [min, max] inclusive. */
export function randInt(holder, min, max) {
  if (max < min) [min, max] = [max, min];
  return min + Math.floor(random(holder) * (max - min + 1));
}

export function chance(holder, p) {
  return random(holder) < p;
}

export function pick(holder, arr) {
  if (!arr || arr.length === 0) return undefined;
  return arr[Math.floor(random(holder) * arr.length)];
}

/** Fisher-Yates in place; returns the same array. */
export function shuffle(holder, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random(holder) * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

/** Pick an item by weight. weightFn(item) -> number >= 0. Returns undefined if total weight is 0. */
export function weightedPick(holder, items, weightFn = (x) => x.w ?? x.weight ?? 1) {
  let total = 0;
  for (const it of items) total += Math.max(0, Number(weightFn(it)) || 0);
  if (total <= 0) return undefined;
  let r = random(holder) * total;
  for (const it of items) {
    const w = Math.max(0, Number(weightFn(it)) || 0);
    if (w <= 0) continue;
    if (r < w) return it;
    r -= w;
  }
  // floating point fallthrough
  for (let i = items.length - 1; i >= 0; i--) if ((Number(weightFn(items[i])) || 0) > 0) return items[i];
  return undefined;
}

/** n distinct items (random order). */
export function sample(holder, arr, n) {
  return shuffle(holder, arr.slice()).slice(0, Math.max(0, n));
}
