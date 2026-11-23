// Reaction hints for the hand — computed ONLY from information visible to the
// player (public tags, revealed hidden tags, pH, statuses). Unrevealed hidden
// tags are treated as unknown, so the hint can say "maybe" but never leaks
// which hidden tag an enemy has.

const YES = 2; const MAYBE = 1; const NO = 0;
const PH_MIN = 0; const PH_MAX = 14;

function visibleTags(e) {
  return new Set([...(e.tags || []), ...(e.revealed || []).filter((t) => (e.hiddenTags || []).includes(t))]);
}
function unknownCount(e) {
  return (e.hiddenTags || []).filter((t) => !(e.revealed || []).includes(t) && !(e.tags || []).includes(t)).length;
}

const and = (a, b) => Math.min(a, b);

function evalVisible(combat, when, e) {
  if (!when) return YES;
  let r = YES;
  const needsEnemy = (when.anyTags?.length || when.allTags?.length || when.targetStatus);
  if (needsEnemy && !e) return NO;
  if (e) {
    const vis = visibleTags(e);
    const unk = unknownCount(e) > 0;
    if (when.anyTags?.length) {
      if (when.anyTags.some((t) => vis.has(t))) r = and(r, YES);
      else r = and(r, unk ? MAYBE : NO);
    }
    if (when.allTags?.length) {
      if (when.allTags.every((t) => vis.has(t))) r = and(r, YES);
      else r = and(r, unk ? MAYBE : NO);
    }
    if (when.noTags?.length) {
      if (when.noTags.some((t) => vis.has(t))) r = NO;
      else r = and(r, unk ? MAYBE : YES);
    }
    if (when.targetStatus && !((e.statuses?.[when.targetStatus] || 0) > 0)) r = NO;
  }
  if (when.ph) {
    const ph = combat.ph;
    if (ph < (when.ph.min ?? PH_MIN) || ph > (when.ph.max ?? PH_MAX)) r = NO;
  }
  if (when.selfStatus && !((combat.player.statuses?.[when.selfStatus] || 0) > 0)) r = NO;
  return r;
}

function condNeedsEnemy(when) {
  return !!when && !!((when.anyTags && when.anyTags.length) || (when.allTags && when.allTags.length) || when.targetStatus);
}

/**
 * @param combat run.combat
 * @param def    card definition (upgrade merged)
 * @param targetUid  selected enemy uid (for target:'enemy'), or null = consider all living
 * @returns {{state:'yes'|'maybe'|'no'|'none', index:number|null}}
 */
export function reactionHint(combat, def, targetUid = null) {
  const reactions = Array.isArray(def?.reactions) ? def.reactions : [];
  if (!combat || !reactions.length) return { state: 'none', index: null };
  const living = combat.enemies.filter((e) => e.alive);
  const cands = def.target === 'enemy' && targetUid ? living.filter((e) => e.uid === targetUid) : living;
  let best = NO; let index = null; let sawMaybe = false;
  for (let i = 0; i < reactions.length; i++) {
    const w = reactions[i]?.when;
    let v;
    if (!condNeedsEnemy(w)) {
      const es = w?.noTags?.length ? cands : [null];
      v = es.length ? Math.max(...es.map((e) => evalVisible(combat, w, e))) : evalVisible(combat, w, null);
    } else {
      v = cands.length ? Math.max(...cands.map((e) => evalVisible(combat, w, e))) : NO;
    }
    if (v === YES) { best = YES; if (!sawMaybe && index == null) index = i; break; }
    if (v === MAYBE) { sawMaybe = true; best = Math.max(best, MAYBE); }
  }
  return { state: best === YES ? 'yes' : best === MAYBE ? 'maybe' : 'no', index };
}
