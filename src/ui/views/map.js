// Act map: rows from bottom (row 0) to top, then the boss.
import { constants as C } from '../../engine/index.js';
import { esc } from '../chem.js';
import { NODE_INFO, actLabel } from '../format.js';

const ROW_H = 78;

export function mapView(ctx) {
  const { run, game } = ctx;
  const map = run.map;
  const avail = new Set(game.availableNodes());
  const visited = new Set(run.visited.filter((v) => v.startsWith(run.act + ':')).map((v) => v.slice(String(run.act).length + 1)));
  const rows = map.rows;
  const nRows = rows.length + 1;
  const H = nRows * ROW_H + 16;
  const pos = new Map();
  rows.forEach((row, r) => row.forEach((n, c) => {
    pos.set(n.id, { x: ((c + 1) / (row.length + 1)) * 100, y: (nRows - 1 - r) * ROW_H + ROW_H / 2 + 8, node: n });
  }));
  pos.set('boss', { x: 50, y: ROW_H / 2 + 8, node: { id: 'boss', type: 'boss', row: rows.length } });

  // edges
  let lines = '';
  const edge = (a, b) => {
    const A = pos.get(a); const B = pos.get(b);
    if (!A || !B) return;
    let cls = 'edge';
    if (visited.has(a) && visited.has(b)) cls += ' taken';
    else if (a === run.position && avail.has(b)) cls += ' open';
    lines += `<line class="${cls}" x1="${A.x.toFixed(2)}" y1="${A.y}" x2="${B.x.toFixed(2)}" y2="${B.y}" />`;
  };
  rows.forEach((row, r) => row.forEach((n) => {
    if (r === rows.length - 1) edge(n.id, 'boss');
    else for (const t of n.next) edge(n.id, t);
  }));

  const nodes = [...pos.values()].map(({ x, y, node }) => {
    const info = NODE_INFO[node.type] || { icon: '?', label: node.type };
    const isAvail = avail.has(node.id);
    const isCur = run.position === node.id;
    const isVisited = visited.has(node.id);
    const cls = ['mnode', 'n-' + node.type, isAvail ? 'avail' : '', isCur ? 'current' : '', isVisited ? 'visited' : '', node.type === 'boss' ? 'boss' : ''].filter(Boolean).join(' ');
    const label = `${info.label}${node.type !== 'boss' ? `（${node.row + 1}段目）` : ''}${isAvail ? '・進める' : ''}${isCur ? '・現在地' : ''}${isVisited && !isCur ? '・通過済み' : ''}`;
    return `<button class="${cls}" style="left:${x.toFixed(2)}%;top:${y}px" data-a="node" data-id="${esc(node.id)}"${isAvail ? '' : ' disabled aria-disabled="true"'} aria-label="${esc(label)}">
      <span class="mnode-icon" aria-hidden="true">${info.icon}</span><span class="mnode-label">${esc(info.label)}</span>
      ${isCur ? '<span class="mnode-here" aria-hidden="true">現在地</span>' : ''}
    </button>`;
  }).join('');

  const legend = ['battle', 'elite', 'event', 'rest', 'shop', 'treasure', 'boss']
    .map((t) => `<li><span aria-hidden="true">${NODE_INFO[t].icon}</span>${esc(NODE_INFO[t].label)}</li>`).join('');

  return `<main class="screen map-screen">
    <div class="map-head">
      <h1><span class="act-no">Act ${esc(actLabel(run.act))}</span> ${esc(C.ACT_NAMES[run.act] || '')}</h1>
      <p class="muted">${avail.size ? '光っているノードをタップして進む（下から上へ）。' : '進めるノードがない。'}</p>
    </div>
    <div class="map-wrap" data-scroll-key="map">
      <div class="map" style="height:${H}px">
        <svg class="map-edges" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
        ${nodes}
      </div>
    </div>
    <ul class="legend" aria-label="凡例">${legend}</ul>
  </main>`;
}
