# Engine API (src/engine)

DOM-free, deterministic (seeded) game engine. The UI imports **only** `src/engine/index.js`
and re-renders from the plain-JSON state after every action.

```js
import { createGame } from './engine/index.js';
import { DATA } from './data/index.js';

const game = createGame({ data: DATA });          // browser: localStorage (memory fallback)
if (game.hasSavedRun()) game.continueRun(); else game.newRun({ difficulty: 'hyojun' });
render(game.run, game.meta);
const res = game.playCard(uid, enemyUid);         // -> { ok, error, events }
animate(res.events); render(game.run, game.meta);
```

## createGame(opts)

| opt | default | |
|---|---|---|
| `data` | `{}` | data bundle (`DATA` from `src/data/index.js`, or test fixtures) |
| `storage` | localStorage (memory fallback) | `{getItem,setItem,removeItem}`; `null` = no persistence. All access is try/catch-safe |
| `now` | `Date.now` | clock (timestamps, default seed). Not used for game randomness |
| `autosave` | `true` | saves run (`chemyth.run`) + meta (`chemyth.meta`) after every action; deletes the run save when the run ends |

Returned object (`game`):

- `game.run` — current run state or `null` (see below). `game.meta` — persistent meta. `game.db` — lookup maps built from data (`db.cards`, `db.enemies`, `db.relics`, `db.potions`, `db.tags`, `db.questions`, `db.quizSets`, `db.eventMap` are `Map`s).
- Every **action** returns `{ ok:boolean, error:string|null, events:Event[] }`. On `ok:false` nothing changed (error is a short Japanese message suitable for a toast).

### Actions

| Screen / state | Action |
|---|---|
| any | `newRun({seed?, difficulty?:'kiso'|'hyojun'|'kyodai'})`, `continueRun()`, `hasSavedRun()`, `abandonRun()` (counts as loss), `closeRun()` (drop finished run from memory) |
| `map` | `chooseNode(nodeId)` — ids from `availableNodes()` (`'boss'` after the last row) |
| `combat` | `playCard(uid, targetEnemyUid?)`, `endTurn()`, `usePotion(slot, target?)`, `discardPotion(slot)` |
| pending `quiz` | `answerQuiz(answer)` — choice: **displayed** index 0–3; numeric: string/number (`'1.2e-5'`, `'1.2×10^-5'`, full-width OK) |
| pending `quizResult` | `continueQuiz()` — after showing correctness + `explain`/`trap` |
| pending `selectCards` | `selectCards([uid...])`, `cancelSelection()` (only if `canCancel`) |
| `reward` | `pickRewardCard(i)`, `skipRewardCard()`, `takeRewardPotion()`, `takeRewardRelic(i=0)`, `leaveReward()` |
| `event` | `chooseEventOption(i)`, `leaveEvent()` (after `event.phase==='result'`) |
| `rest` | `chooseRestOption('rest'|'upgrade'|'review')`, `leaveRest()` |
| `shop` | `buyCard(i)`, `buyRelic(i)`, `buyPotion(i)`, `buyRemoval()` (→ selectCards), `leaveShop()` |
| `treasure` | `openTreasure()`, `leaveTreasure()` |
| generic | `dispatch({type, ...})` (same names; args: `nodeId`, `uid`, `target`, `slot`, `answer`, `uids`, `index`, `option`), `legalActions()` → list of dispatchable actions |

While `run.pending` is non-null only the matching pending action is accepted.

### Queries (pure)

`availableNodes()`, `canPlayCard(uid, target?)` → `{ok, reason, needsTarget?}`, `canUsePotion(slot, target?)`,
`eventChoiceStatus(i)` → `{ok, reason}`, `restOptions()` → `[{id,label,desc,ok}]`, `removalPrice()`,
`cardDef(id, upgraded)` (upgrade merged, name gets `+`), `cardView(inst)` → def + `{uid, cost (live, incl. catalyst), playable, upgradable, isUnplayable}`,
`displayTags(enemy)` → `[{tag|null, hidden, wasHidden?}]` (`tag:null` = show “?”), `activePhRules(enemy)`, `intentPreview(enemy)`,
`runSummary()` (result screen: `byField`, `reactions`, `wrongQuestions`, …), `weaknessReport()` (弱点分析: per field + per topic accuracy),
`notebookList()` (誤答ノート with question objects), `reactionList()` (反応ノート), `bedtimeWarning(date?)` → message or `null`,
`setSetting(key, value)` (`bedtime`, `wakeTime`, `difficulty`), `resetMeta()`.

Also exported: `parseNumericAnswer`, `judgeNumeric`, `isBedtime(date, bedtime='23:00', wake='05:00')`, `bedtimeWarning`, `BEDTIME_MESSAGE`,
`constants` (`STATUS_INFO` labels, `FIELD_LABELS`, `ACT_NAMES`, `DIFFICULTIES`, …), `createMemoryStorage`, `createBrowserStorage`, `legalActions(G)`.

## Run state (`game.run`) — plain JSON

```js
{
  seed, rng, difficulty, act: 1..5, floor, screen: 'map'|'combat'|'reward'|'event'|'rest'|'shop'|'treasure'|'victory'|'gameOver',
  map: { act, rows: [[{id:'r-c', row, col, type, next:[ids]}]], boss:{id:'boss'} }, position: nodeId|'boss'|null, visited:['act:id'],
  player: { hp, maxHp, gold, energyPerTurn, drawPerTurn, potionSlots },
  deck: [{uid, id, upgraded}], relics: [{id, counters:{triggerIndex:n}}], potions: [potionId|null ×3],
  combat: null | {
    kind:'battle'|'elite'|'boss', turn, phase:'player'|'enemy'|'won'|'lost', ph: 0..14,
    player: { block, energy, statuses:{id:n}, powers:[{trigger, effects, every, counter, filter, name}] },
    enemies: [{ uid:'e1', id, name, emoji, tier, hp, maxHp, block, statuses, tags, hiddenTags, revealed, pI, alive,
                intent:{moveId, name, intent, effects, preview:{damage, times, total, block}} | null, phaseIndex }],
    hand, draw, discard, exhaust, playing: [{uid, id, upgraded, temp?}],
    correctThisCombat, reactionsThisCombat, cardsPlayedThisTurn
  },
  reward: null | { kind, gold, cards:[cardId], cardTaken:false|true|'skipped', potion, potionTaken, relic, relicChoices:[relicId], relicTaken, heal },
  event: null | { id, phase:'choose'|'resolving'|'result', choiceIndex, resultText, quizCorrect },
  rest: null | { used, choice, reviewResults:[bool] },
  shop: null | { cards:[{cardId, price, sold}], relics:[{relicId, price, sold}], potions:[{potionId, price, sold}], removalUsed },
  treasure: null | { relicId, gold, opened },
  pending: null | Quiz | QuizResult | SelectCards,
  queue: [...]            // internal resumable effect stack (do not touch)
  log: [{type, msg}]      // rolling combat/run log (last 120)
  quizLog, askedQuestions, stats:{cardsPlayed, enemiesDefeated, combatsWon, reactions:{key:{cardId,equation,explain,count}}, fizzles, correct, wrong, goldEarned},
  result: null | { won, act, floor, difficulty, endedAt }, errors: []
}
```

Hidden tags: UI shows `enemy.tags` plus, for each `hiddenTags` entry, the tag if it is in `revealed` else “?” (use `displayTags`).
Intents: `enemy.intent.preview.damage` already includes strength/weak/vulnerable/phRules/buffer (refreshed after every action).

### Pending objects

```js
// quiz (UI shows lead → text → choices/number input)
{ kind:'quiz', questionId, field, topic, level, type:'choice'|'numeric', text, given, unit,
  choices:[4 strings, already shuffled] | null, setId, setTitle, lead, partIndex, partCount,
  inNotebook, source:'card'|'enemy'|'event'|'rest'|..., sourceName }
// quizResult (after answerQuiz) = quiz fields +
{ kind:'quizResult', answer, parsed, correct, correctDisplay (index in choices), correctAnswerText,
  explain, trap, addedToNotebook, graduated, streak, misconceptionAdded }
// selectCards
{ kind:'selectCards', purpose:'exhaustFromHand'|'discardFromHand'|'removeCard'|'upgradeCard'|'shopRemove'|'restUpgrade',
  from:'hand'|'deck', options:[uid], count, min, canCancel, title }
```

## Meta state (`game.meta`)

```js
{ settings:{bedtime:'23:00', wakeTime:'05:00', difficulty},
  notebook:{ qid:{wrong, streak, addedAt, lastAt, field, topic} },   // 誤答ノート (2 consecutive correct → graduated)
  graduated:{ qid: time },
  stats:{ fields:{field:{asked,correct}}, topics:{'field/topic':{field,topic,asked,correct}}, questions:{qid:{asked,correct,lastCorrect}} },
  reactions:{ 'cardId#i':{cardId, index, equation, explain, count, firstAt} },   // 反応ノート
  seen:{cards, enemies, relics}, runs:{played, won, bestFloor, bestAct, history:[...]} }
```

## Events (`res.events`)

Each `{type, ...data, msg?}`; `msg` (Japanese) is also appended to `run.log`. Types:
`damage{source,target,amount,blocked,hpLoss}`, `loseHp`, `block`, `heal`, `status{target,status,amount,value}`, `statusBlocked`,
`ph{from,to}`, `reaction{cardId,index,equation,explain}`, `fizzle`, `reveal{target,tags}`, `tag{op,from,to}`, `draw`, `shuffle`,
`discard`, `exhaust`, `cardPlayed{uid,cardId,target}`, `cardAdded`, `energy`, `power`, `powerTrigger`, `relicTrigger`,
`enemyMove{target,moveId,intent}`, `enemySkip`, `enemyDeath`, `summon`, `phase{target,index,name}`, `turnStart{turn}`,
`combatStart`, `combatWon`, `defeat`, `victory`, `quiz`, `quizResult{correct}`, `gold`, `maxHp`, `cardGained`, `cardRemoved`,
`cardUpgraded`, `relicGained`, `potionGained`, `potionUsed`, `actStart{act}`, `enterNode`, `event`, `info`, `warn`, `error`.
Targets are `'player'` or an enemy `uid`.

## Rules implemented (summary)

- Turn: block reset → energy (+excited, −1 if 沈殿) → poison → chain → `turnStart` → draw (turn 1: max(5, innate)). End turn: `turnEnd` → `endTurnInHand` effects → discard (retain kept, ethereal exhausted) → decay weak/vulnerable/frail/buffer, regen, catalyst removed → each enemy: block reset, poison, chain, act (precip skips) → enemy decay → new intents.
- Damage: `floor((amount + per×metric + 濃度) × 0.75(希釈) × 1.5(活性化) × takenMult/dealtMult)` → −緩衝 → block (unless `pierce`). 濃度/希釈/発熱 apply to attacks (cards & enemy moves) only; potions/relics/powers deal plain damage (vulnerable & phRules still apply).
- Reactions evaluated top-down; for `target:'enemy'` against the target, otherwise against any living enemy. Hidden tags used by the matching condition are revealed. `strict` → `fizzle`.
- Quiz wrong answer: notebook + stats + a `misconception` added to the deck and, in combat, shuffled into the draw pile (max 5 copies).
- Question selection: candidates by field/topic/level (level from difficulty weights), 40% notebook preference, then fresh-this-run, then never-asked; relaxes topic → field → whole bank; empty bank = quiz skipped neutrally.
- Rewards: gold (10–20 / 25–35 / 70–90), 3 cards (rarity weights by fight kind, current-act field ×3, neutral ×1.5), potion 40%/50%, elite relic, boss: 3 relics (boss rarity then rare) + 50% heal. Final boss → victory.
- Map: 8 rows × 2–4 planar DAG; row1 battle, row8 rest, elites from row3, ≥1 shop & elite guaranteed, never an all-elite row. Final act (終): fixed 4-row review gauntlet `[battle,battle] → [event,shop,battle] → [elite,battle] → [rest,rest]` → final boss (act-5 encounters; falls back to nearest act if none).

## Contract extensions (minimal)

- **`endTurnInHand: [effects]`** on cards (allowed by DESIGN §5.2) — run at end of turn while in hand.
- **Phase-level `quizSetId` / `quizField`** on `enemy.phases[i]` (optional): overrides the enemy's set/field while in that phase — for the 4-phase final boss (one 大問 per phase). Each set keeps its own progress.
- **`quiz` effect `pool:'review'`** (internal; used by 復習): notebook first, then weakest field.
- **`damage.times:'X'`** accepted (hits = X energy spent). `addCard.upgraded`, `gainCard.count`, `gainCard.upgraded` optional.
- **`precip` on the player**: next turn's energy −1, then removed (spec only defines it for enemies).
- **`catalyst`** is consumed only by cards whose cost it actually reduces (cost ≥ 1, not X).
- `loseHp` outside combat (events) never reduces HP below 1.
- `onRest` fires after any rest-site option; `onEnemyDeath` for the last enemy and `combatEnd` fire for relics only (powers end with the combat).
- `filter.field` on triggers matches card field (`theory` also matches `theory1/2`) or, for quiz triggers, the question field.
- Minions (`tier:'minion'`) vanish when only minions remain.
- `npm test` runs `node --test "tests/**/*.test.js"` (Node 22 does not accept a bare directory).

## Tools

- `npm test` — node:test suites in `tests/` (fixture data in `tests/fixtures/data.js`).
- `npm run validate` — `tools/validate-data.js [--allow-missing] [--quiet-warnings]`: strict schema/reference check of all data; exit 1 on errors.
- `npm run sim` — `tools/sim.js [--runs=50] [--correct=0.7] [--difficulty=hyojun] [--seed=sim] [--fixtures] [--verbose]`: headless bot runs; prints win rate, floors, deaths per act, deadliest encounters, quiz/reaction stats and any engine error or soft-lock (exit 1 if any).
