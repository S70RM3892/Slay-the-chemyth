// Static rules / tuning constants shared by engine, validator and simulator.

export const ENGINE_VERSION = 1;

export const STORAGE_KEYS = Object.freeze({ run: 'chemyth.run', meta: 'chemyth.meta' });

export const PLAYER_START = Object.freeze({
  hp: 80, maxHp: 80, energy: 3, draw: 5, potionSlots: 3, gold: 99,
});

export const HAND_LIMIT = 10;
export const MAX_ENEMIES = 5;
export const PH_MIN = 0;
export const PH_MAX = 14;
export const PH_START = 7;
export const MAP_ROWS = 8;
export const FINAL_ACT = 5;
export const MAX_MISCONCEPTIONS = 5; // cap of 'misconception' copies auto-added to the deck
export const MAX_QUEUE_STEPS = 20000; // loop guard per action
export const MAX_TRIGGER_DEPTH = 6;

export const STATUS_IDS = Object.freeze([
  'strength', 'dexterity', 'weak', 'vulnerable', 'frail', 'poison', 'precip',
  'thorns', 'buffer', 'chain', 'catalyst', 'colloid', 'excited', 'regen',
]);

export const STATUS_INFO = Object.freeze({
  strength: { label: '濃度', desc: '攻撃ダメージ +N（永続）' },
  dexterity: { label: '安定化', desc: '得るブロック +N（永続）' },
  weak: { label: '希釈', desc: '与ダメージ ×0.75（自ターン終了時 −1）' },
  vulnerable: { label: '活性化', desc: '被ダメージ ×1.5（自ターン終了時 −1）' },
  frail: { label: '不安定', desc: '得るブロック ×0.75（自ターン終了時 −1）' },
  poison: { label: '腐食', desc: '自ターン開始時 Nダメージ（ブロック無視）後 −1' },
  precip: { label: '沈殿', desc: '次の行動をスキップして解除（ボスには無効で代わりに活性化2）' },
  thorns: { label: '発熱', desc: '攻撃を受けるたび攻撃者に Nダメージ' },
  buffer: { label: '緩衝', desc: '被ダメージを1ヒットにつき N 軽減（自ターン終了時 −1）' },
  chain: { label: '連鎖反応', desc: '自ターン開始時 濃度 +N' },
  catalyst: { label: '触媒', desc: 'このターン次に使うカードN枚のコスト −1' },
  colloid: { label: '保護コロイド', desc: 'デバフ付与を N 回無効化' },
  excited: { label: '励起', desc: '次の自ターン開始時 エネルギー +N して消滅' },
  regen: { label: '再結晶', desc: '自ターン終了時 HP +N、その後 −1' },
});

export const DEBUFFS = Object.freeze(['weak', 'vulnerable', 'frail', 'poison', 'precip']);
/** statuses that may go negative */
export const SIGNED_STATUSES = Object.freeze(['strength', 'dexterity']);
/** statuses that decay by 1 at the end of their owner's turn */
export const DECAY_AT_TURN_END = Object.freeze(['weak', 'vulnerable', 'frail', 'buffer']);

export const TRIGGERS = Object.freeze([
  'combatStart', 'combatEnd', 'turnStart', 'turnEnd', 'onCardPlayed', 'onReaction',
  'onFizzle', 'onQuizCorrect', 'onQuizWrong', 'onAttacked', 'onPhChange', 'onExhaust',
  'onEnemyDeath', 'onPickup', 'onRest', 'onShopEnter',
]);

export const KEYWORDS = Object.freeze(['exhaust', 'retain', 'innate', 'ethereal', 'unplayable']);

export const CARD_TYPES = Object.freeze(['attack', 'skill', 'power', 'status', 'curse']);
export const CARD_RARITIES = Object.freeze(['starter', 'common', 'uncommon', 'rare', 'special']);
export const CARD_FIELDS = Object.freeze(['theory', 'inorganic', 'organic', 'polymer', 'neutral']);
export const CARD_TARGETS = Object.freeze(['enemy', 'all', 'self', 'none']);
export const RELIC_RARITIES = Object.freeze(['starter', 'common', 'uncommon', 'rare', 'boss', 'shop']);
export const POTION_RARITIES = Object.freeze(['common', 'uncommon', 'rare']);
export const ENEMY_TIERS = Object.freeze(['normal', 'elite', 'boss', 'minion']);
export const ENCOUNTER_TIERS = Object.freeze(['normal', 'elite', 'boss']);
export const INTENTS = Object.freeze(['attack', 'defend', 'buff', 'debuff', 'quiz', 'special']);
export const NODE_TYPES = Object.freeze(['battle', 'elite', 'event', 'rest', 'shop', 'treasure', 'boss']);

export const QUESTION_FIELDS = Object.freeze(['theory1', 'theory2', 'inorganic', 'organic', 'polymer']);
export const QUESTION_PREFIX = Object.freeze({
  theory1: 'th1', theory2: 'th2', inorganic: 'ino', organic: 'org', polymer: 'pol',
});
export const FIELD_LABELS = Object.freeze({
  theory1: '理論I（構造と状態）', theory2: '理論II（平衡と変化）', inorganic: '無機',
  organic: '有機', polymer: '高分子', theory: '理論', neutral: '共通',
});

/** question fields used for each act when a quiz does not specify one */
export const ACT_QUESTION_FIELDS = Object.freeze({
  1: ['theory1'], 2: ['theory2', 'inorganic'], 3: ['organic'], 4: ['polymer'],
  5: ['theory1', 'theory2', 'inorganic', 'organic', 'polymer'],
});
/** card fields favoured in rewards per act */
export const ACT_CARD_FIELDS = Object.freeze({
  1: ['theory'], 2: ['theory', 'inorganic'], 3: ['organic'], 4: ['polymer'], 5: [],
});

export const ACT_NAMES = Object.freeze({
  1: '理論の層 I「構造と状態」', 2: '理論の層 II「平衡と変化」', 3: '有機の層「構造決定」',
  4: '高分子の層', 5: '二次試験当日',
});

export const DIFFICULTIES = Object.freeze({
  kiso: { id: 'kiso', label: '基礎', levelWeights: { 1: 70, 2: 30, 3: 0 }, enemyHpMult: 1.0 },
  hyojun: { id: 'hyojun', label: '標準', levelWeights: { 1: 20, 2: 60, 3: 20 }, enemyHpMult: 1.0 },
  kyodai: { id: 'kyodai', label: '京大', levelWeights: { 1: 0, 2: 55, 3: 45 }, enemyHpMult: 1.1 },
});
export const DEFAULT_DIFFICULTY = 'hyojun';

export const NOTEBOOK_PRIORITY = 0.4; // chance to prefer a notebook question
export const GRADUATE_STREAK = 2; // consecutive correct answers to leave the notebook
export const DEFAULT_TOLERANCE = 0.03;

export const REWARD = Object.freeze({
  gold: { battle: [10, 20], elite: [25, 35], boss: [70, 90] },
  cardRarity: {
    battle: { common: 60, uncommon: 35, rare: 5 },
    elite: { common: 45, uncommon: 40, rare: 15 },
    boss: { common: 0, uncommon: 0, rare: 100 },
  },
  potionChance: { battle: 0.4, elite: 0.5, boss: 0 },
  relicRarity: { common: 50, uncommon: 33, rare: 17 },
  potionRarity: { common: 65, uncommon: 25, rare: 10 },
  fieldWeight: { match: 3, neutral: 1.5, other: 1 },
  bossHealRatio: 0.5,
  bossRelicChoices: 3,
  treasureGold: [20, 40],
});

export const SHOP = Object.freeze({
  cards: 5, relics: 2, potions: 2,
  cardPrice: { common: 50, uncommon: 75, rare: 150 },
  relicPrice: { common: 150, uncommon: 200, rare: 260, shop: 180, boss: 300, starter: 150 },
  potionPrice: { common: 50, uncommon: 75, rare: 100 },
  removalBase: 75, removalStep: 25,
});

export const REST = Object.freeze({ healRatio: 0.3, reviewCount: 3, reviewHeal: 5 });

export const DEFAULT_SETTINGS = Object.freeze({
  bedtime: '23:00', wakeTime: '05:00', difficulty: DEFAULT_DIFFICULTY,
});

/** effect types understood by the engine (validator uses this list) */
export const EFFECT_TYPES = Object.freeze([
  'damage', 'attack', 'block', 'status', 'draw', 'energy', 'heal', 'loseHp', 'ph', 'phSet',
  'reveal', 'addTag', 'removeTag', 'transformTag', 'stripBlock', 'addCard', 'exhaustFromHand',
  'discardFromHand', 'upgradeHand', 'quiz', 'summon', 'power',
  'gold', 'maxHp', 'gainRelic', 'gainCard', 'gainPotion', 'removeCard', 'upgradeCard',
]);
/** effects that only make sense inside combat */
export const COMBAT_ONLY_EFFECTS = Object.freeze([
  'damage', 'attack', 'block', 'status', 'draw', 'energy', 'ph', 'phSet', 'reveal', 'addTag',
  'removeTag', 'transformTag', 'stripBlock', 'addCard', 'exhaustFromHand', 'discardFromHand',
  'upgradeHand', 'summon', 'power',
]);

export const SCALE_BY = Object.freeze([
  'phBelow7', 'phAbove7', 'phDist', 'block', 'handSize', 'revealedTags', 'energy', 'correctThisCombat',
]);
export const SCALE_BY_PREFIX = Object.freeze(['targetStatus:', 'selfStatus:']);
