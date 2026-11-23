// Small shared helpers.

const LOG_LIMIT = 120;

/**
 * Emit an engine event. Events are transient (returned from each action for the
 * UI to animate) and, when they carry a `msg`, also appended to the persistent
 * `run.log` (capped).
 */
export function emit(G, ev) {
  G.events.push(ev);
  if (ev.msg && G.run) {
    const log = (G.run.log ||= []);
    log.push({ type: ev.type, msg: ev.msg });
    if (log.length > LOG_LIMIT) log.splice(0, log.length - LOG_LIMIT);
  }
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function newUid(G, prefix = 'c') {
  G.run.nextUid = (G.run.nextUid || 1) + 1;
  return prefix + G.run.nextUid;
}

export function deepClone(x) {
  return x === undefined ? undefined : JSON.parse(JSON.stringify(x));
}
