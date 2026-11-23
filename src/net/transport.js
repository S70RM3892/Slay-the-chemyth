// Transports for co-op play. Two implementations with the same interface:
//   'peer'  — WebRTC data channels via the vendored PeerJS (signalling through the public PeerJS broker).
//             Works from a static host such as GitHub Pages: no server of our own.
//   'local' — BroadcastChannel between tabs/contexts of one browser (and inside Node). For tests and demos.
//
// Host:  const t = await hostRoom(kind, code, handlers)   handlers: { onPeer(id), onMessage(id, msg), onLeave(id), onError(err) }
//        t.send(id, msg) / t.broadcast(msg) / t.close()
// Guest: const t = await joinRoom(kind, code, handlers)   handlers: { onMessage(msg), onClose(), onError(err) }
//        t.send(msg) / t.close()
// Messages are plain JSON-serialisable objects.

const ROOM_PREFIX = 'chemyth-coop-v1-';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
export const CODE_LENGTH = 5;

export function makeRoomCode() {
  const buf = new Uint32Array(CODE_LENGTH);
  globalThis.crypto.getRandomValues(buf);
  let s = '';
  for (const n of buf) s += CODE_ALPHABET[n % CODE_ALPHABET.length];
  return s;
}

/** Normalise user input ("ab-c 12" → "ABC12"); returns '' if it cannot be a room code. */
export function normalizeRoomCode(input) {
  const s = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length !== CODE_LENGTH) return '';
  for (const ch of s) if (!CODE_ALPHABET.includes(ch)) return '';
  return s;
}

export function hostRoom(kind, code, handlers) {
  return kind === 'local' ? hostLocal(code, handlers) : hostPeer(code, handlers);
}
export function joinRoom(kind, code, handlers) {
  return kind === 'local' ? joinLocal(code, handlers) : joinPeer(code, handlers);
}

// ---------------------------------------------------------------------------
// PeerJS (WebRTC)
// ---------------------------------------------------------------------------

let peerLib = null;
function loadPeerJs() {
  if (globalThis.Peer) return Promise.resolve(globalThis.Peer);
  if (peerLib) return peerLib;
  peerLib = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') { reject(new Error('PeerJS needs a browser')); return; }
    const s = document.createElement('script');
    s.src = new URL('../../vendor/peerjs.min.js', import.meta.url).href;
    s.onload = () => (globalThis.Peer ? resolve(globalThis.Peer) : reject(new Error('PeerJS failed to initialise')));
    s.onerror = () => { peerLib = null; reject(new Error('通信ライブラリを読み込めなかった')); };
    document.head.appendChild(s);
  });
  return peerLib;
}

const CONNECT_TIMEOUT_MS = 20000;
/** Optional override of the PeerJS options (own broker / TURN): set globalThis.CHEMYTH_PEER_OPTIONS before connecting. */
const peerOptions = () => ({ debug: 0, ...(globalThis.CHEMYTH_PEER_OPTIONS || {}) });

function describePeerError(err) {
  switch (err && err.type) {
    case 'peer-unavailable': return 'その部屋は見つからない（コードを確認。ホストが部屋を開いている必要がある）';
    case 'unavailable-id': return 'ルームコードが衝突した';
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed': return '接続サーバーに届かない（ネットワークを確認）';
    case 'browser-incompatible': return 'このブラウザはWebRTCに対応していない';
    case 'webrtc': return 'P2P接続に失敗した（ネットワークの制限の可能性）';
    default: return '通信エラー: ' + ((err && (err.type || err.message)) || 'unknown');
  }
}

async function hostPeer(code, h) {
  const Peer = await loadPeerJs();
  return new Promise((resolve, reject) => {
    const peer = new Peer(ROOM_PREFIX + code, peerOptions());
    const conns = new Map();
    let opened = false;
    const timer = setTimeout(() => { if (!opened) { peer.destroy(); reject(new Error('接続サーバーが応答しない')); } }, CONNECT_TIMEOUT_MS);
    const api = {
      kind: 'peer',
      send(id, msg) { const c = conns.get(id); if (c && c.open) { try { c.send(msg); } catch { /* dropped */ } } },
      broadcast(msg) { for (const id of conns.keys()) api.send(id, msg); },
      kick(id) { const c = conns.get(id); if (c) c.close(); },
      close() { clearTimeout(timer); try { peer.destroy(); } catch { /* already gone */ } conns.clear(); },
    };
    peer.on('open', () => { opened = true; clearTimeout(timer); resolve(api); });
    peer.on('connection', (conn) => {
      const id = conn.peer;
      conn.on('open', () => { conns.set(id, conn); h.onPeer?.(id); });
      conn.on('data', (msg) => h.onMessage?.(id, msg));
      const gone = () => { if (conns.get(id) === conn) { conns.delete(id); h.onLeave?.(id); } };
      conn.on('close', gone);
      conn.on('error', gone);
    });
    // The broker socket may drop while data channels stay alive: try to get it back so new guests can still join.
    peer.on('disconnected', () => { if (!peer.destroyed) { try { peer.reconnect(); } catch { /* ignore */ } } });
    peer.on('error', (err) => {
      const e = Object.assign(new Error(describePeerError(err)), { type: err && err.type });
      if (!opened) { clearTimeout(timer); peer.destroy(); reject(e); } else if (err && err.type !== 'peer-unavailable') h.onError?.(e);
    });
  });
}

async function joinPeer(code, h) {
  const Peer = await loadPeerJs();
  return new Promise((resolve, reject) => {
    const peer = new Peer(peerOptions());
    let conn = null;
    let settled = false;
    let closed = false;
    const fail = (e) => {
      if (settled) { h.onError?.(e); return; }
      settled = true; clearTimeout(timer);
      try { peer.destroy(); } catch { /* ignore */ }
      reject(e);
    };
    const timer = setTimeout(() => fail(new Error('ホストに接続できなかった（時間切れ）')), CONNECT_TIMEOUT_MS);
    const api = {
      kind: 'peer',
      send(msg) { if (conn && conn.open) { try { conn.send(msg); } catch { /* dropped */ } } },
      close() { closed = true; clearTimeout(timer); try { peer.destroy(); } catch { /* ignore */ } },
    };
    const lost = () => { if (!closed && settled) { closed = true; h.onClose?.(); try { peer.destroy(); } catch { /* ignore */ } } };
    peer.on('open', () => {
      conn = peer.connect(ROOM_PREFIX + code, { reliable: true, serialization: 'json' });
      conn.on('open', () => { settled = true; clearTimeout(timer); resolve(api); });
      conn.on('data', (msg) => h.onMessage?.(msg));
      conn.on('close', lost);
      conn.on('error', lost);
    });
    peer.on('error', (err) => fail(Object.assign(new Error(describePeerError(err)), { type: err && err.type })));
  });
}

// ---------------------------------------------------------------------------
// BroadcastChannel (same browser / Node) — deterministic, no network.
// ---------------------------------------------------------------------------

function localChannel(code) {
  if (typeof BroadcastChannel === 'undefined') throw new Error('BroadcastChannel is not available');
  return new BroadcastChannel(ROOM_PREFIX + code);
}
const randomId = () => 'p-' + Math.floor(globalThis.crypto.getRandomValues(new Uint32Array(1))[0]).toString(36);

async function hostLocal(code, h) {
  const ch = localChannel(code);
  const peers = new Set();
  const api = {
    kind: 'local',
    send(id, msg) { if (peers.has(id)) ch.postMessage({ to: id, from: 'host', msg }); },
    broadcast(msg) { for (const id of peers) api.send(id, msg); },
    kick(id) { if (peers.delete(id)) { ch.postMessage({ to: id, from: 'host', ctl: 'bye' }); h.onLeave?.(id); } },
    close() { ch.postMessage({ to: '*', from: 'host', ctl: 'bye' }); ch.close(); peers.clear(); },
  };
  ch.onmessage = (ev) => {
    const d = ev.data;
    if (!d || d.to !== 'host') return;
    if (d.ctl === 'hello') { peers.add(d.from); ch.postMessage({ to: d.from, from: 'host', ctl: 'welcome' }); h.onPeer?.(d.from); }
    else if (d.ctl === 'bye') { if (peers.delete(d.from)) h.onLeave?.(d.from); }
    else if (peers.has(d.from)) h.onMessage?.(d.from, d.msg);
  };
  return api;
}

function joinLocal(code, h) {
  return new Promise((resolve, reject) => {
    const ch = localChannel(code);
    const id = randomId();
    let open = false;
    let closed = false;
    const timer = setTimeout(() => { if (!open) { ch.close(); reject(new Error('その部屋は見つからない')); } }, 1500);
    const api = {
      kind: 'local',
      send(msg) { if (open && !closed) ch.postMessage({ to: 'host', from: id, msg }); },
      close() { if (closed) return; closed = true; clearTimeout(timer); ch.postMessage({ to: 'host', from: id, ctl: 'bye' }); ch.close(); },
    };
    ch.onmessage = (ev) => {
      const d = ev.data;
      if (!d || d.from !== 'host' || (d.to !== id && d.to !== '*')) return;
      if (d.ctl === 'welcome') { open = true; clearTimeout(timer); resolve(api); }
      else if (d.ctl === 'bye') { if (!closed) { closed = true; ch.close(); if (open) h.onClose?.(); } }
      else if (open) h.onMessage?.(d.msg);
    };
    ch.postMessage({ to: 'host', from: id, ctl: 'hello' });
  });
}
