// Act map generation: 8 rows, 2-4 nodes per row, planar DAG from bottom (row 0)
// to top (row 7), then the boss. Row 0 = battle, row 7 = rest, elite only from
// row index 2 (= 3段目). The final act (5) is a fixed 4-row review gauntlet.

import { FINAL_ACT, MAP_ROWS } from './constants.js';
import { randInt, random, weightedPick, pick } from './rng.js';

const ROW_WEIGHTS = (r) => [
  { t: 'battle', w: 45 },
  { t: 'event', w: 22 },
  { t: 'elite', w: r >= 2 ? 14 : 0 },
  { t: 'rest', w: r >= 3 && r <= 5 ? 9 : 0 },
  { t: 'shop', w: r >= 1 ? 6 : 0 },
  { t: 'treasure', w: r >= 2 && r <= 6 ? 4 : 0 },
];

function nodeId(r, c) { return r + '-' + c; }

export function generateMap(holder, act) {
  if (act >= FINAL_ACT) {
    // 二次試験当日: a short review gauntlet, then the final boss
    const layout = [['battle', 'battle'], ['event', 'shop', 'battle'], ['elite', 'battle'], ['rest', 'rest']];
    const rows = layout.map((types, r) => types.map((type, c) => ({ id: nodeId(r, c), row: r, col: c, type, next: [] })));
    for (let r = 0; r < rows.length - 1; r++) connectRows(holder, rows[r], rows[r + 1]);
    return { act, rows, boss: { id: 'boss', type: 'boss' } };
  }
  const rows = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    const n = randInt(holder, 2, 4);
    const row = [];
    for (let c = 0; c < n; c++) {
      let type;
      if (r === 0) type = 'battle';
      else if (r === MAP_ROWS - 1) type = 'rest';
      else type = weightedPick(holder, ROW_WEIGHTS(r), (x) => x.w).t;
      row.push({ id: nodeId(r, c), row: r, col: c, type, next: [] });
    }
    // never force an elite: a row made only of elites keeps one battle
    if (row.length > 1 && row.every((x) => x.type === 'elite')) row[randInt(holder, 0, row.length - 1)].type = 'battle';
    rows.push(row);
  }
  // guarantee at least one shop and one elite in the middle rows
  ensureType(holder, rows, 'shop', 1, MAP_ROWS - 3);
  ensureType(holder, rows, 'elite', 2, MAP_ROWS - 2);

  for (let r = 0; r < MAP_ROWS - 1; r++) connectRows(holder, rows[r], rows[r + 1]);
  return { act, rows, boss: { id: 'boss', type: 'boss' } };
}

function ensureType(holder, rows, type, fromRow, toRow) {
  for (let r = fromRow; r <= toRow; r++) if (rows[r].some((n) => n.type === type)) return;
  const cands = [];
  for (let r = fromRow; r <= toRow; r++) for (const n of rows[r]) if (n.type === 'battle' || n.type === 'event') cands.push(n);
  const n = pick(holder, cands);
  if (n) n.type = type;
}

function connectRows(holder, A, B) {
  const n = A.length; const m = B.length;
  const base = A.map((_, i) => (n === 1 ? Math.round((m - 1) / 2) : Math.round((i * (m - 1)) / (n - 1))));
  const next = A.map((_, i) => new Set([base[i]]));
  for (let i = 0; i < n; i++) {
    if (random(holder) < 0.35) {
      const dir = random(holder) < 0.5 ? -1 : 1;
      const j = base[i] + dir;
      if (j < 0 || j >= m) continue;
      // keep the graph planar: no edge of a node to the right may end left of j, and vice versa
      if (dir === 1 && next.slice(i + 1).some((s) => Math.min(...s) < j)) continue;
      if (dir === -1 && next.slice(0, i).some((s) => Math.max(...s) > j)) continue;
      next[i].add(j);
    }
  }
  // coverage: every node in B gets an incoming edge
  for (let j = 0; j < m; j++) {
    if (next.some((s) => s.has(j))) continue;
    let from = 0;
    for (let i = 0; i < n; i++) if (base[i] < j) from = i;
    next[from].add(j);
  }
  A.forEach((node, i) => { node.next = [...next[i]].sort((a, b) => a - b).map((j) => B[j].id); });
}

export function findNode(map, id) {
  if (!map) return null;
  if (id === 'boss') return map.boss;
  for (const row of map.rows) for (const n of row) if (n.id === id) return n;
  return null;
}

/** Node ids the player may move to from `position` (null = start of act). */
export function availableNodeIds(map, position) {
  if (!map) return [];
  if (position == null) return map.rows[0].map((n) => n.id);
  if (position === 'boss') return [];
  const cur = findNode(map, position);
  if (!cur) return map.rows[0].map((n) => n.id);
  if (cur.row === map.rows.length - 1) return ['boss'];
  return cur.next.slice();
}
