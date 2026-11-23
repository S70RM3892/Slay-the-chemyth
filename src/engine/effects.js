// Effect DSL interpreter and the resumable effect queue.
//
// run.queue is a stack of frames { effects:[...], i, ctx }. runQueue() executes
// effects depth-first until the stack is empty or something sets run.pending
// (a quiz or a card selection). The UI resolves the pending item through the
// facade, which pushes the continuation and calls runQueue() again. Because the
// queue is plain JSON, a run can be saved and resumed mid-card / mid-quiz.
//
// ctx: { side:'player'|'enemy', source:'card'|'potion'|'relic'|'power'|'enemy'|'event'|'rest'|'system',
//        sourceId, actor:'player'|enemyUid, target?:enemyUid, cardTarget?, x?:number, cardUid?,
//        combat:boolean, depth:number }

import {
  COMBAT_ONLY_EFFECTS, MAX_ENEMIES, MAX_QUEUE_STEPS, MAX_TRIGGER_DEPTH,
} from './constants.js';
import { actQuestionFields, expandQuestionFields, fieldMatches, isUpgradable } from './data.js';
import { emit, newUid } from './util.js';
import { pick, sample } from './rng.js';
import {
  addToPile, applyStatus, createEnemy, dealDamage, drawCards, enemyQuizSource, exhaustCard, findEnemy,
  gainBlock, heal, instDef, isAlive, isCombatActive, livingEnemies, loseHp, revealTags, rollIntent, setPh,
  sh, stepDiscardHand, stepDrawTurn, stepEndTurnInHand, stepEnemiesTurnEnd, stepEnemyAct, stepEnemyPhase,
  stepEnemyTurnStart, stepFinishCard, stepPlayerTurnEnd, stepRollIntents, stepStartPlayerTurn, getStatus,
} from './combat.js';
import { makeQuizPending, selectQuestion } from './quiz.js';
import {
  addCardToDeck, addPotion, addRelic, endCombat, eventDone, randomCardId, randomPotionId, randomRelicId,
  removeCardsFromDeck, upgradeCardsInDeck,
} from './run.js';

export function pushFrame(G, effects, ctx) {
  if (!Array.isArray(effects) || !effects.length) return;
  G.run.queue.push({ effects, i: 0, ctx: ctx || {} });
}

export function runQueue(G) {
  let steps = 0;
  while (G.run.queue.length && !G.run.pending) {
    if (++steps > MAX_QUEUE_STEPS) {
      recordError(G, new Error('effect loop guard tripped (possible infinite trigger loop)'));
      G.run.queue = [];
      break;
    }
    const frame = G.run.queue[G.run.queue.length - 1];
    if (frame.i >= frame.effects.length) { G.run.queue.pop(); continue; }
    const eff = frame.effects[frame.i++];
    try {
      execEffect(G, eff, frame.ctx);
    } catch (err) {
      recordError(G, err, eff);
    }
  }
}

export function recordError(G, err, eff) {
  const msg = (err && err.message) || String(err);
  const errors = (G.run.errors ||= []);
  errors.push({ msg, effect: eff ? eff.type : null });
  if (errors.length > 30) errors.shift();
  emit(G, { type: 'error', msg: '[engine] ' + msg, stack: err && err.stack });
}

// ---------------------------------------------------------------------------
// Targeting & scaling
// ---------------------------------------------------------------------------

/**
 * kind: 'offense' (damage/stripBlock), 'status', 'tag' (reveal/addTag/...)
 * Returns list of unit refs.
 */
export function resolveTargets(G, eff, ctx, kind) {
  const living = livingEnemies(G).map((e) => e.uid);
  let t = eff.target;
  if (ctx.side === 'enemy') {
    if (!t) t = kind === 'offense' || kind === 'status' ? 'player' : 'self';
    if (t === 'self') return isAlive(G, ctx.actor) ? [ctx.actor] : [];
    if (t === 'all') return kind === 'offense' ? ['player'] : living;
    if (t === 'random') return kind === 'offense' ? ['player'] : living.length ? [pick(G.run, living)] : [];
    return ['player'];
  }
  if (!t) {
    if (ctx.source === 'card' || ctx.source === 'potion') t = ctx.cardTarget || 'self';
    else t = kind === 'offense' ? 'random' : 'self';
  }
  let res;
  switch (t) {
    case 'self': case 'player': case 'none': res = ['player']; break;
    case 'enemy':
      if (ctx.target) res = isAlive(G, ctx.target) ? [ctx.target] : [];
      else res = living.length ? [pick(G.run, living)] : [];
      break;
    case 'all': res = living; break;
    case 'random': res = living.length ? [pick(G.run, living)] : []; break;
    default: res = [];
  }
  if (kind === 'offense' || kind === 'tag') {
    // the player never receives offensive/tag effects from its own side
    res = res.flatMap((r) => {
      if (r !== 'player') return [r];
      if (ctx.target && isAlive(G, ctx.target)) return [ctx.target];
      if (kind === 'tag') return living;
      return living.length ? [pick(G.run, living)] : [];
    });
  }
  return res;
}

/** per × metric (DESIGN §5.1 scale). tref = the effect's target unit. */
export function scaleValue(G, scale, ctx, tref) {
  if (!scale || !scale.by) return 0;
  const c = G.run.combat;
  if (!c) return 0;
  const per = Number(scale.per ?? 1);
  const by = String(scale.by);
  const actor = ctx.actor || 'player';
  const tgt = tref && tref !== actor ? tref : ctx.target && ctx.target !== actor ? ctx.target : tref;
  let m = 0;
  if (by === 'phBelow7') m = Math.max(0, 7 - c.ph);
  else if (by === 'phAbove7') m = Math.max(0, c.ph - 7);
  else if (by === 'phDist') {
    const e = tgt && tgt !== 'player' ? findEnemy(G, tgt) : ctx.side === 'enemy' ? findEnemy(G, actor) : null;
    m = Math.abs(c.ph - (e && e.pI != null ? e.pI : 7));
  } else if (by === 'block') m = sh(G, actor)?.block || 0;
  else if (by.startsWith('targetStatus:')) m = tgt ? getStatus(G, tgt, by.slice('targetStatus:'.length)) : 0;
  else if (by.startsWith('selfStatus:')) m = getStatus(G, actor, by.slice('selfStatus:'.length));
  else if (by === 'handSize') m = c.hand.length;
  else if (by === 'revealedTags') { const e = tgt && tgt !== 'player' ? findEnemy(G, tgt) : null; m = e ? e.revealed.length : 0; }
  else if (by === 'energy') m = ctx.x || 0;
  else if (by === 'correctThisCombat') m = c.correctThisCombat || 0;
  return per * m;
}

// ---------------------------------------------------------------------------
// Triggers (relics + powers)
// ---------------------------------------------------------------------------

function filterOk(filter, info) {
  if (!filter) return true;
  if (filter.cardType && info.cardType !== filter.cardType) return false;
  if (filter.field && !fieldMatches(filter.field, info.field) && !fieldMatches(filter.field, info.quizField)) return false;
  return true;
}

export function fireTrigger(G, trigger, info = {}, depth = 0) {
  if (depth >= MAX_TRIGGER_DEPTH) return;
  const frames = [];
  const inCombat = !!G.run.combat && isCombatActive(G);
  for (const r of G.run.relics || []) {
    const def = G.db.relics.get(r.id);
    if (!def || !Array.isArray(def.triggers)) continue;
    def.triggers.forEach((t, ti) => {
      if (!t || t.trigger !== trigger || trigger === 'onPickup') return;
      if (!filterOk(t.filter, info)) return;
      if (t.every > 1) {
        r.counters ||= {};
        r.counters[ti] = (r.counters[ti] || 0) + 1;
        if (r.counters[ti] < t.every) return;
        r.counters[ti] = 0;
      }
      frames.push({
        effects: t.effects || [],
        ctx: { side: 'player', source: 'relic', sourceId: r.id, actor: 'player', combat: inCombat, depth: depth + 1, target: info.target },
      });
      emit(G, { type: 'relicTrigger', relicId: r.id, trigger });
    });
  }
  if (inCombat) {
    for (const p of G.run.combat.player.powers) {
      if (p.trigger !== trigger || !filterOk(p.filter, info)) continue;
      if (p.every > 1) {
        p.counter = (p.counter || 0) + 1;
        if (p.counter < p.every) continue;
        p.counter = 0;
      }
      frames.push({
        effects: p.effects || [],
        ctx: { side: 'player', source: 'power', sourceId: p.sourceId, actor: 'player', combat: true, depth: depth + 1, target: info.target },
      });
      emit(G, { type: 'powerTrigger', name: p.name, trigger });
    }
  }
  for (let i = frames.length - 1; i >= 0; i--) pushFrame(G, frames[i].effects, frames[i].ctx);
}

// ---------------------------------------------------------------------------
// Effect execution
// ---------------------------------------------------------------------------

export function execEffect(G, eff, ctx) {
  if (!eff || typeof eff !== 'object' || typeof eff.type !== 'string') return;
  const t = eff.type;
  if (t.startsWith('_')) { execInternal(G, eff, ctx); return; }
  const inCombat = isCombatActive(G);
  if (COMBAT_ONLY_EFFECTS.includes(t) && !inCombat) return; // silently ignored outside combat
  const c = G.run.combat;
  const run = G.run;
  switch (t) {
    case 'damage':
    case 'attack': {
      if (ctx.side === 'enemy' && !isAlive(G, ctx.actor)) return;
      const times = eff.times === 'X' ? ctx.x || 0 : Math.max(0, Math.floor(Number(eff.times ?? 1)));
      const isAttack = ctx.source === 'card' || ctx.source === 'enemy';
      for (let h = 0; h < times; h++) {
        if (!isCombatActive(G)) return;
        if (ctx.side === 'enemy' && !isAlive(G, ctx.actor)) return;
        for (const tr of resolveTargets(G, eff, ctx, 'offense')) {
          if (!isCombatActive(G)) return;
          if (!isAlive(G, tr)) continue;
          const base = (Number(eff.amount) || 0) + scaleValue(G, eff.scale, ctx, tr);
          const src = ctx.actor && isAlive(G, ctx.actor) ? ctx.actor : null;
          dealDamage(G, { source: src, target: tr, base, isAttack: isAttack && tr !== ctx.actor, pierce: !!eff.pierce, depth: ctx.depth || 0 });
        }
      }
      return;
    }
    case 'block': {
      let targets;
      if (ctx.side === 'enemy') targets = eff.target === 'all' ? livingEnemies(G).map((e) => e.uid) : [ctx.actor];
      else targets = ['player'];
      for (const tr of targets) {
        const amt = (Number(eff.amount) || 0) + scaleValue(G, eff.scale, ctx, ctx.target || tr);
        gainBlock(G, tr, amt);
      }
      return;
    }
    case 'status': {
      for (const tr of resolveTargets(G, eff, ctx, 'status')) applyStatus(G, tr, eff.status, eff.amount);
      return;
    }
    case 'draw': drawCards(G, Math.max(0, Number(eff.amount) || 0)); return;
    case 'energy': {
      c.player.energy = Math.max(0, c.player.energy + (Number(eff.amount) || 0));
      emit(G, { type: 'energy', amount: eff.amount, msg: `エネルギー ${eff.amount > 0 ? '+' : ''}${eff.amount}` });
      return;
    }
    case 'heal': {
      const amt = Number(eff.amount) || 0;
      if (ctx.side === 'enemy' && inCombat) {
        const targets = eff.target === 'all' ? livingEnemies(G).map((e) => e.uid) : [ctx.actor];
        for (const tr of targets) heal(G, tr, amt);
      } else heal(G, 'player', amt);
      return;
    }
    case 'loseHp': {
      const ref = ctx.side === 'enemy' && inCombat ? ctx.actor : 'player';
      loseHp(G, ref, Number(eff.amount) || 0, '', ctx.depth || 0);
      return;
    }
    case 'ph': setPh(G, c.ph + (Number(eff.delta) || 0), ctx); return;
    case 'phSet': setPh(G, Number(eff.value), ctx); return;
    case 'reveal': {
      const count = eff.count ?? 99;
      for (const tr of resolveTargets(G, eff, ctx, 'tag')) {
        const e = findEnemy(G, tr);
        if (!e) continue;
        const hidden = e.hiddenTags.filter((x) => !e.revealed.includes(x)).slice(0, count);
        if (hidden.length) revealTags(G, e, hidden);
        else emit(G, { type: 'info', msg: `${e.name}にはこれ以上隠れた性質はない` });
      }
      return;
    }
    case 'addTag': case 'removeTag': case 'transformTag': {
      for (const tr of resolveTargets(G, eff, ctx, 'tag')) {
        const e = findEnemy(G, tr);
        if (e) tagOp(G, e, eff);
      }
      return;
    }
    case 'stripBlock': {
      for (const tr of resolveTargets(G, eff, ctx, 'offense')) {
        const u = sh(G, tr);
        if (u && u.block) { u.block = 0; emit(G, { type: 'stripBlock', target: tr, msg: 'ブロックを剥がした' }); }
      }
      return;
    }
    case 'addCard': {
      if (!G.db.cards.has(eff.cardId)) return;
      const n = Math.max(0, Number(eff.count ?? 1));
      for (let i = 0; i < n; i++) {
        addToPile(G, { uid: newUid(G), id: eff.cardId, upgraded: !!eff.upgraded, temp: true }, eff.to || 'discard');
      }
      const name = G.db.cards.get(eff.cardId).name;
      const where = { hand: '手札', draw: '山札', discard: '捨て札' }[eff.to || 'discard'];
      emit(G, { type: 'cardAdded', cardId: eff.cardId, to: eff.to || 'discard', count: n, msg: `「${name}」×${n}が${where}に加わった` });
      return;
    }
    case 'exhaustFromHand': case 'discardFromHand': {
      const count = Math.max(0, Number(eff.count ?? 1));
      if (!count || !c.hand.length) return;
      const random = eff.random ?? ctx.side === 'enemy';
      const purpose = t === 'exhaustFromHand' ? 'exhaustFromHand' : 'discardFromHand';
      if (!random && c.hand.length > count) {
        run.pending = {
          kind: 'selectCards', purpose, from: 'hand', options: c.hand.map((x) => x.uid),
          count, min: count, canCancel: false, ctx,
          title: purpose === 'exhaustFromHand' ? `除外するカードを${count}枚選ぶ` : `捨てるカードを${count}枚選ぶ`,
        };
        return;
      }
      const chosen = random ? sample(G.run, c.hand, count) : c.hand.slice(0, count);
      handRemove(G, chosen.map((x) => x.uid), purpose, ctx.depth || 0);
      return;
    }
    case 'upgradeHand': {
      let n = eff.count ?? 99;
      for (const inst of c.hand) {
        if (n <= 0) break;
        if (isUpgradable(G.db, inst)) { inst.upgraded = true; n--; }
      }
      emit(G, { type: 'upgradeHand', msg: '手札を強化した（この戦闘中）' });
      return;
    }
    case 'quiz': startQuiz(G, eff, ctx); return;
    case 'summon': {
      if (livingEnemies(G).length >= MAX_ENEMIES) return;
      const e = createEnemy(G, eff.enemyId);
      if (!e) return;
      c.enemies.push(e);
      rollIntent(G, e);
      emit(G, { type: 'summon', target: e.uid, enemyId: e.id, msg: `${e.name}が現れた` });
      return;
    }
    case 'power': {
      if (ctx.side !== 'player') return;
      c.player.powers.push({
        trigger: eff.trigger, effects: eff.effects || [], every: eff.every || 0, filter: eff.filter || null,
        counter: 0, name: eff.name || instName(G, ctx), sourceId: ctx.sourceId || null,
      });
      emit(G, { type: 'power', name: eff.name || instName(G, ctx), msg: `常在効果「${eff.name || instName(G, ctx)}」を得た` });
      return;
    }
    // ----- run-level -----
    case 'gold': {
      const before = run.player.gold;
      run.player.gold = Math.max(0, before + (Number(eff.amount) || 0));
      const d = run.player.gold - before;
      if (d) emit(G, { type: 'gold', amount: d, msg: `研究費 ${d > 0 ? '+' : ''}${d}` });
      return;
    }
    case 'maxHp': {
      const p = run.player;
      const a = Number(eff.amount) || 0;
      p.maxHp = Math.max(1, p.maxHp + a);
      if (a > 0) p.hp += a;
      p.hp = Math.min(p.hp, p.maxHp);
      emit(G, { type: 'maxHp', amount: a, msg: `最大HP ${a > 0 ? '+' : ''}${a}` });
      return;
    }
    case 'gainRelic': {
      const id = eff.relicId && G.db.relics.has(eff.relicId) ? eff.relicId : randomRelicId(G, eff.rarity);
      if (id) addRelic(G, id);
      else { emit(G, { type: 'info', msg: '器具は見つからなかった（代わりに研究費+25）' }); run.player.gold += 25; }
      return;
    }
    case 'gainCard': {
      const n = Math.max(1, Number(eff.count ?? 1));
      for (let i = 0; i < n; i++) {
        const id = eff.cardId && G.db.cards.has(eff.cardId) ? eff.cardId : randomCardId(G, { rarity: eff.rarity, field: eff.field });
        if (id) addCardToDeck(G, id, !!eff.upgraded);
      }
      return;
    }
    case 'gainPotion': {
      const id = eff.potionId && G.db.potions.has(eff.potionId) ? eff.potionId : randomPotionId(G);
      if (id) addPotion(G, id);
      return;
    }
    case 'removeCard': removeCardsFromDeck(G, eff, ctx); return;
    case 'upgradeCard': upgradeCardsInDeck(G, eff, ctx); return;
    default:
      emit(G, { type: 'warn', msg: `[engine] unknown effect type: ${t}` });
  }
}

function instName(G, ctx) {
  if (ctx.source === 'card' && ctx.sourceId) return G.db.cards.get(ctx.sourceId)?.name || ctx.sourceId;
  return ctx.sourceId || '常在効果';
}

function tagOp(G, e, eff) {
  const label = (x) => G.db.tags.get(x)?.label || x;
  if (eff.type === 'addTag') {
    if (!e.tags.includes(eff.tag) && !e.hiddenTags.includes(eff.tag)) {
      e.tags.push(eff.tag);
      emit(G, { type: 'tag', target: e.uid, op: 'add', tag: eff.tag, msg: `${e.name}: ${label(eff.tag)}を獲得` });
    }
  } else if (eff.type === 'removeTag') {
    const had = enemyHas(e, eff.tag);
    e.tags = e.tags.filter((x) => x !== eff.tag);
    e.hiddenTags = e.hiddenTags.filter((x) => x !== eff.tag);
    e.revealed = e.revealed.filter((x) => x !== eff.tag);
    if (had) emit(G, { type: 'tag', target: e.uid, op: 'remove', tag: eff.tag, msg: `${e.name}: ${label(eff.tag)}が消えた` });
  } else {
    const { from, to } = eff;
    if (!from || !to || !enemyHas(e, from)) return;
    const already = enemyHas(e, to);
    const repl = (list) => {
      const i = list.indexOf(from);
      if (i < 0) return list;
      const out = list.slice();
      if (already) out.splice(i, 1); else out[i] = to;
      return out;
    };
    const wasHidden = e.hiddenTags.includes(from) && !e.revealed.includes(from);
    e.tags = repl(e.tags);
    e.hiddenTags = repl(e.hiddenTags);
    e.revealed = repl(e.revealed);
    emit(G, {
      type: 'tag', target: e.uid, op: 'transform', from, to,
      msg: wasHidden ? `${e.name}の隠れた性質が変化した` : `${e.name}: ${label(from)} → ${label(to)}`,
    });
  }
}

function enemyHas(e, tag) {
  return e.tags.includes(tag) || e.hiddenTags.includes(tag);
}

/** Remove cards (by uid) from hand by exhausting or discarding. */
export function handRemove(G, uids, purpose, depth = 0) {
  const c = G.run.combat;
  for (const uid of uids) {
    const i = c.hand.findIndex((x) => x.uid === uid);
    if (i < 0) continue;
    const inst = c.hand.splice(i, 1)[0];
    if (purpose === 'exhaustFromHand') exhaustCard(G, inst, depth);
    else {
      c.discard.push(inst);
      emit(G, { type: 'discard', uid: inst.uid, cardId: inst.id, msg: `${instDef(G, inst)?.name || inst.id}を捨てた` });
    }
  }
}

function startQuiz(G, eff, ctx) {
  let q = null;
  const fieldsFor = (f) => (f != null ? expandQuestionFields(f) : actQuestionFields(G.run.act));
  let sourceName = null;
  if (ctx.side === 'enemy' && ctx.actor && findEnemy(G, ctx.actor)) {
    const e = findEnemy(G, ctx.actor);
    sourceName = e.name;
    const { quizSetId, quizField } = enemyQuizSource(G, e);
    let setField = null;
    if (!eff.questionId && quizSetId) {
      const set = G.db.quizSets.get(quizSetId);
      if (set) {
        setField = set.field;
        const idx = e.quizProgress[quizSetId] || 0;
        if (idx < set.parts.length) {
          e.quizProgress[quizSetId] = idx + 1;
          q = set.parts[idx];
        }
      }
    }
    if (!q) {
      q = selectQuestion(G, {
        questionId: eff.questionId, topic: eff.topic, level: eff.level,
        fields: fieldsFor(eff.field ?? quizField ?? setField ?? undefined),
      });
    }
  } else {
    q = selectQuestion(G, {
      questionId: eff.questionId, topic: eff.topic, level: eff.level, pool: eff.pool,
      fields: fieldsFor(eff.field),
    });
    if (ctx.source === 'card' && ctx.sourceId) sourceName = G.db.cards.get(ctx.sourceId)?.name || null;
    if (ctx.source === 'event' && ctx.sourceId) sourceName = G.db.eventMap.get(ctx.sourceId)?.name || null;
  }
  if (!q) {
    // empty bank: resolve as neutral (neither onCorrect nor onWrong)
    emit(G, { type: 'info', msg: '出題できる問題がなかった（判定なしで続行）' });
    return;
  }
  G.run.pending = makeQuizPending(G, q, {
    ctx, onCorrect: eff.onCorrect || [], onWrong: eff.onWrong || [], source: ctx.source, sourceName,
  });
  emit(G, { type: 'quiz', questionId: q.id, msg: `出題: ${q.topic || q.field}` });
}

function execInternal(G, eff, ctx) {
  const combatStep = (fn) => { if (isCombatActive(G)) fn(); };
  switch (eff.type) {
    case '_trigger': fireTrigger(G, eff.trigger, eff.info || {}, ctx.depth || 0); return;
    case '_startPlayerTurn': combatStep(() => stepStartPlayerTurn(G)); return;
    case '_drawTurn': combatStep(() => stepDrawTurn(G)); return;
    case '_endTurnInHand': combatStep(() => stepEndTurnInHand(G)); return;
    case '_discardHand': combatStep(() => stepDiscardHand(G)); return;
    case '_playerTurnEnd': combatStep(() => stepPlayerTurnEnd(G)); return;
    case '_enemyPhase': combatStep(() => stepEnemyPhase(G)); return;
    case '_enemyTurnStart': combatStep(() => stepEnemyTurnStart(G, eff.uid)); return;
    case '_enemyAct': combatStep(() => stepEnemyAct(G, eff.uid)); return;
    case '_enemiesTurnEnd': combatStep(() => stepEnemiesTurnEnd(G)); return;
    case '_rollIntents': combatStep(() => stepRollIntents(G)); return;
    case '_finishCard': combatStep(() => stepFinishCard(G, eff.uid)); return;
    case '_endCombat': endCombat(G); return;
    case '_eventDone': eventDone(G, eff.index); return;
    case '_noop': return;
    default:
      emit(G, { type: 'warn', msg: `[engine] unknown internal step ${eff.type}` });
  }
}
