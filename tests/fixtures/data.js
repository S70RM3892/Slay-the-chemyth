// Small, self-contained fixture data for engine tests (NOT real game content).

export const TAGS = [
  { id: 'acid', label: '酸', group: 'acidbase', desc: '' },
  { id: 'base', label: '塩基', group: 'acidbase', desc: '' },
  { id: 'alcohol1', label: '第一級アルコール', group: 'organic', desc: '' },
  { id: 'aldehyde', label: 'アルデヒド', group: 'organic', desc: '' },
  { id: 'carboxylic', label: 'カルボン酸', group: 'organic', desc: '' },
  { id: 'phenol', label: 'フェノール性OH', group: 'organic', desc: '' },
  { id: 'metal', label: '金属', group: 'inorganic', desc: '' },
];

export const CARDS = [
  { id: 'strike', name: '打撃', type: 'attack', rarity: 'starter', field: 'neutral', cost: 1, target: 'enemy',
    effects: [{ type: 'damage', amount: 6 }], text: '6ダメージ', chem: '-', upgrade: { effects: [{ type: 'damage', amount: 9 }], text: '9ダメージ' } },
  { id: 'defend', name: '防御', type: 'skill', rarity: 'starter', field: 'neutral', cost: 1, target: 'self',
    effects: [{ type: 'block', amount: 5 }], text: 'ブロック5', chem: '-', upgrade: { effects: [{ type: 'block', amount: 8 }] } },
  { id: 'hcl', name: '塩酸', type: 'attack', rarity: 'starter', field: 'theory', cost: 1, target: 'enemy',
    effects: [{ type: 'damage', amount: 4 }, { type: 'ph', delta: -2 }],
    reactions: [{ when: { anyTags: ['base'] }, effects: [{ type: 'damage', amount: 6 }], equation: 'HCl + NaOH → NaCl + H_2O', explain: '中和' }],
    text: '4ダメージ。pH−2。', chem: '-' },
  { id: 'naoh', name: '水酸化ナトリウム', type: 'skill', rarity: 'common', field: 'theory', cost: 1, target: 'none',
    effects: [{ type: 'ph', delta: 3 }], text: 'pH+3', chem: '-' },
  { id: 'fehling', name: 'フェーリング液', type: 'attack', rarity: 'common', field: 'organic', cost: 1, target: 'enemy', strict: true,
    effects: [{ type: 'damage', amount: 1 }],
    reactions: [{ when: { anyTags: ['aldehyde'] }, effects: [{ type: 'damage', amount: 12 }], equation: 'RCHO + 2Cu^{2+} → Cu_2O', explain: '還元性' }],
    fizzle: [{ type: 'block', amount: 1 }],
    text: 'アルデヒドに12。不発時ブロック1', chem: '-' },
  { id: 'fecl3', name: '塩化鉄(III)', type: 'skill', rarity: 'common', field: 'organic', cost: 0, target: 'enemy', strict: true,
    effects: [],
    reactions: [{ when: { anyTags: ['phenol'] }, effects: [{ type: 'status', status: 'vulnerable', amount: 2 }], explain: '呈色' }],
    text: 'フェノールに活性化2', chem: '-' },
  { id: 'oxidize', name: '二クロム酸カリウム', type: 'skill', rarity: 'common', field: 'organic', cost: 1, target: 'enemy',
    effects: [{ type: 'transformTag', from: 'aldehyde', to: 'carboxylic' }, { type: 'transformTag', from: 'alcohol1', to: 'aldehyde' }],
    text: '酸化', chem: '-' },
  { id: 'detect', name: '検出試薬', type: 'skill', rarity: 'common', field: 'organic', cost: 0, target: 'enemy',
    effects: [{ type: 'reveal', count: 1 }], text: '隠しタグを1つ公開', chem: '-' },
  { id: 'acidburst', name: '強酸ラッシュ', type: 'attack', rarity: 'uncommon', field: 'theory', cost: 1, target: 'enemy',
    effects: [{ type: 'damage', amount: 2, scale: { by: 'phBelow7', per: 2 } }], text: '', chem: '-' },
  { id: 'xblast', name: 'X反応', type: 'attack', rarity: 'rare', field: 'neutral', cost: 'X', target: 'all',
    effects: [{ type: 'damage', amount: 0, scale: { by: 'energy', per: 5 } }], text: '', chem: '-' },
  { id: 'chainpower', name: '連鎖反応理論', type: 'power', rarity: 'rare', field: 'theory', cost: 1, target: 'self',
    effects: [{ type: 'power', trigger: 'onReaction', effects: [{ type: 'block', amount: 3 }], name: '反応熱' }], text: '', chem: '-' },
  { id: 'everythird', name: '三度目', type: 'power', rarity: 'uncommon', field: 'neutral', cost: 0, target: 'self',
    effects: [{ type: 'power', trigger: 'onCardPlayed', every: 3, filter: { cardType: 'attack' }, effects: [{ type: 'draw', amount: 1 }], name: '三度目' }], text: '', chem: '-' },
  { id: 'study', name: '演習', type: 'skill', rarity: 'common', field: 'theory', cost: 1, target: 'self', keywords: ['exhaust'],
    effects: [{ type: 'quiz', onCorrect: [{ type: 'energy', amount: 2 }], onWrong: [{ type: 'loseHp', amount: 2 }] }], text: '', chem: '-' },
  { id: 'keep', name: '保存', type: 'skill', rarity: 'common', field: 'neutral', cost: 1, target: 'self', keywords: ['retain'],
    effects: [{ type: 'block', amount: 2 }], text: '', chem: '-' },
  { id: 'opening', name: '序論', type: 'skill', rarity: 'common', field: 'neutral', cost: 0, target: 'self', keywords: ['innate'],
    effects: [{ type: 'draw', amount: 1 }], text: '', chem: '-' },
  { id: 'purge', name: '精製', type: 'skill', rarity: 'common', field: 'neutral', cost: 0, target: 'self',
    effects: [{ type: 'exhaustFromHand', count: 1 }], text: '', chem: '-' },
  { id: 'washall', name: '全体洗浄', type: 'attack', rarity: 'common', field: 'organic', cost: 1, target: 'all',
    effects: [{ type: 'damage', amount: 1 }],
    reactions: [{ when: { anyTags: ['phenol'] }, effects: [{ type: 'status', status: 'weak', amount: 1 }], explain: '-' }],
    text: '', chem: '-' },
  { id: 'misconception', name: '思い込み', type: 'curse', rarity: 'special', field: 'neutral', cost: null, target: 'none', keywords: ['unplayable'],
    effects: [], endTurnInHand: [{ type: 'loseHp', amount: 1 }], text: '', chem: '-' },
  { id: 'careless', name: 'ケアレスミス', type: 'status', rarity: 'special', field: 'neutral', cost: null, target: 'none', keywords: ['unplayable', 'ethereal'],
    effects: [], text: '', chem: '-' },
];

export const STARTER_DECK = ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'hcl', 'naoh'];

export const RELICS = [
  { id: 'flask', name: '三角フラスコ', emoji: '⚗', rarity: 'starter', text: '', chem: '-',
    triggers: [{ trigger: 'combatEnd', effects: [{ type: 'heal', amount: 3 }] }] },
  { id: 'burner', name: 'バーナー', emoji: '🔥', rarity: 'common', text: '', chem: '-',
    triggers: [{ trigger: 'combatStart', effects: [{ type: 'status', status: 'strength', amount: 1, target: 'self' }] }] },
  { id: 'pipette', name: 'ピペット', emoji: '💧', rarity: 'uncommon', text: '', chem: '-',
    triggers: [{ trigger: 'onCardPlayed', every: 2, effects: [{ type: 'block', amount: 1 }] }] },
  { id: 'notebook', name: '実験ノート', emoji: '📓', rarity: 'rare', text: '', chem: '-',
    triggers: [{ trigger: 'onPickup', effects: [{ type: 'maxHp', amount: 7 }] }] },
  { id: 'crown', name: '王冠', emoji: '👑', rarity: 'boss', text: '', chem: '-', triggers: [] },
];
export const STARTER_RELIC = 'flask';

export const POTIONS = [
  { id: 'p_heal', name: '回復瓶', emoji: '🧪', rarity: 'common', target: 'self', effects: [{ type: 'heal', amount: 10 }], text: '', chem: '-' },
  { id: 'p_fire', name: '爆発瓶', emoji: '💥', rarity: 'common', target: 'enemy', effects: [{ type: 'damage', amount: 20 }], text: '', chem: '-' },
];

const atk = (n, times) => ({ name: '攻撃', intent: 'attack', effects: [{ type: 'attack', amount: n, ...(times ? { times } : {}) }] });

export const ENEMIES = [
  { id: 'dummy', name: '的', emoji: '🎯', act: 1, tier: 'normal', hp: [40, 40], tags: ['base'], lore: '-',
    moves: { hit: atk(5) }, pattern: { type: 'cycle', seq: ['hit'] } },
  { id: 'phslime', name: 'pHスライム', emoji: '🟢', act: 1, tier: 'normal', hp: [30, 30], tags: [], lore: '-',
    phRules: [{ max: 4, takenMult: 2, note: '酸性で弱る' }, { min: 10, dealtMult: 0.5, note: '塩基性で弱る' }],
    moves: { hit: atk(6), guard: { name: '防御', intent: 'defend', effects: [{ type: 'block', amount: 5 }] } },
    pattern: { type: 'weighted', table: [{ move: 'hit', w: 1 }, { move: 'guard', w: 1 }], noRepeat: 2 } },
  { id: 'ethanol', name: '謎のアルコール', emoji: '🍶', act: 3, tier: 'normal', hp: [50, 50], tags: [], hiddenTags: ['alcohol1'], lore: '-',
    moves: { hit: atk(3) }, pattern: { type: 'cycle', seq: ['hit'] } },
  { id: 'phenolic', name: '謎の芳香族', emoji: '💠', act: 3, tier: 'normal', hp: [50, 50], tags: [], hiddenTags: ['phenol', 'aldehyde'], lore: '-',
    moves: { hit: atk(3) }, pattern: { type: 'cycle', seq: ['hit'] } },
  { id: 'examiner', name: '出題者', emoji: '📝', act: 1, tier: 'elite', hp: [60, 60], tags: [], lore: '-',
    moves: {
      ask: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 1, target: 'self' }], onWrong: [{ type: 'attack', amount: 10 }] }] },
      hit: atk(8),
      junk: { name: '混乱', intent: 'debuff', effects: [{ type: 'addCard', cardId: 'careless', to: 'discard', count: 2 }] },
    },
    pattern: { type: 'cycle', seq: ['ask', 'hit', 'junk'] } },
  { id: 'minion', name: '手下', emoji: '·', act: 1, tier: 'minion', hp: [5, 5], tags: [], lore: '-', moves: { hit: atk(1) } },
  { id: 'boss1', name: '大問の主', emoji: '👹', act: 1, tier: 'boss', hp: [100, 100], tags: [], lore: '-', quizSetId: 'set-th1-01', quizField: 'theory1',
    moves: {
      ask: { name: '大問', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [], onWrong: [{ type: 'attack', amount: 5 }] }] },
      hit: atk(10),
      call: { name: '召喚', intent: 'special', effects: [{ type: 'summon', enemyId: 'minion' }] },
      rage: { name: '激昂', intent: 'buff', effects: [{ type: 'status', status: 'strength', amount: 3, target: 'self' }] },
    },
    pattern: { type: 'cycle', seq: ['ask', 'hit'] },
    phases: [{ hpBelow: 0.5, name: '第二形態', pattern: { type: 'cycle', seq: ['rage', 'call', 'hit'] }, onEnter: [{ type: 'block', amount: 10 }] }] },
  { id: 'final', name: '二次試験', emoji: '🏯', act: 5, tier: 'boss', hp: [80, 80], tags: [], lore: '-', moves: { hit: atk(5) } },
];

export const ENCOUNTERS = [];
for (const act of [1, 2, 3, 4]) {
  ENCOUNTERS.push({ id: `n${act}`, act, tier: 'normal', enemies: ['dummy'] });
  ENCOUNTERS.push({ id: `e${act}`, act, tier: 'elite', enemies: ['examiner'] });
  ENCOUNTERS.push({ id: `b${act}`, act, tier: 'boss', enemies: ['boss1'] });
}
ENCOUNTERS.push({ id: 'b5', act: 5, tier: 'boss', enemies: ['final'] });

export const EVENTS = [
  { id: 'ev_quiz', name: '演習室', acts: [1, 2, 3, 4], text: '問題に挑戦する？', choices: [
    { label: '挑戦', quiz: { field: 'theory1' }, onCorrect: [{ type: 'gold', amount: 50 }], onWrong: [{ type: 'loseHp', amount: 5 }], result: '終わった' },
    { label: '寄付', effects: [{ type: 'gold', amount: -500 }], result: '払った' },
    { label: '去る', result: '去った' },
  ] },
];

const mk = (id, field, level, type, extra) => ({ id, field, topic: 'テスト', level, type, text: `問題 ${id}`, explain: '解説', ...extra });

export const QUESTIONS = [
  mk('th1-001', 'theory1', 1, 'choice', { choices: ['正', '誤1', '誤2', '誤3'], answer: 0 }),
  mk('th1-002', 'theory1', 2, 'numeric', { answer: 1.2e-5, unit: 'mol/L' }),
  mk('th1-003', 'theory1', 2, 'choice', { choices: ['a', 'b', 'c', 'd'], answer: 2 }),
  mk('th1-004', 'theory1', 3, 'numeric', { answer: 0, absTolerance: 0.01 }),
  mk('th2-001', 'theory2', 2, 'numeric', { answer: 4.75, tolerance: 0.01 }),
  mk('ino-001', 'inorganic', 2, 'choice', { choices: ['a', 'b', 'c', 'd'], answer: 1 }),
  mk('org-001', 'organic', 2, 'choice', { choices: ['a', 'b', 'c', 'd'], answer: 3 }),
  mk('pol-001', 'polymer', 2, 'numeric', { answer: 180 }),
];

export const QUIZ_SETS = [
  { id: 'set-th1-01', field: 'theory1', title: '大問1', lead: 'リード文', parts: [
    mk('set-th1-01-1', 'theory1', 2, 'numeric', { answer: 1 }),
    mk('set-th1-01-2', 'theory1', 2, 'numeric', { answer: 2 }),
    mk('set-th1-01-3', 'theory1', 3, 'numeric', { answer: 3 }),
    mk('set-th1-01-4', 'theory1', 3, 'numeric', { answer: 4 }),
  ] },
];

export const DATA = { TAGS, CARDS, STARTER_DECK, RELICS, STARTER_RELIC, POTIONS, ENEMIES, ENCOUNTERS, EVENTS, QUESTIONS, QUIZ_SETS };
