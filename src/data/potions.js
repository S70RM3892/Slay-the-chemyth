// 試薬瓶（ポーション）。データのみ。

export const POTIONS = [
  {
    id: 'bottle_conc_h2so4', name: '濃硫酸の瓶', emoji: '🧪', rarity: 'uncommon', target: 'enemy',
    effects: [{ type: 'damage', amount: 20 }, { type: 'ph', delta: -3 }],
    text: '20ダメージ。pH−3。',
    chem: '濃硫酸は不揮発性・吸湿性・脱水作用をもつ。希釈するときは水に濃硫酸を少しずつ加える。',
  },
  {
    id: 'bottle_naoh', name: '水酸化ナトリウムの瓶', emoji: '🧪', rarity: 'common', target: 'enemy',
    effects: [{ type: 'damage', amount: 15 }, { type: 'ph', delta: 4 }],
    text: '15ダメージ。pH+4。',
    chem: '固体のNaOHは潮解性があり、空気中のCO_2も吸収する。ガラスを侵すのでゴム栓で保存する。',
  },
  {
    id: 'bottle_nh3', name: 'アンモニア水の瓶', emoji: '🧴', rarity: 'common', target: 'self',
    effects: [{ type: 'block', amount: 12 }, { type: 'ph', delta: 3 }],
    text: 'ブロック12。pH+3。',
    chem: 'NH_3 + H_2O ⇄ NH_4^+ + OH^-。電離度が小さい弱塩基。',
  },
  {
    id: 'bottle_buffer', name: '緩衝液の瓶', emoji: '⚖️', rarity: 'common', target: 'self',
    effects: [{ type: 'status', status: 'buffer', amount: 4, target: 'self' }],
    text: '緩衝4を得る。',
    chem: 'NH_3とNH_4Clの混合液は塩基性側（pH約9）の緩衝液。血液はおもにH_2CO_3/HCO_3^-の緩衝作用でpH約7.4に保たれる。',
  },
  {
    id: 'bottle_mno2', name: '酸化マンガン(IV)の瓶', emoji: '⚫', rarity: 'uncommon', target: 'self',
    effects: [{ type: 'status', status: 'catalyst', amount: 3, target: 'self' }],
    text: '触媒3を得る（このターン次に使うカード3枚のコスト−1）。',
    chem: '2H_2O_2 → 2H_2O + O_2 の触媒。反応の前後でMnO_2自身は変化しない。',
  },
  {
    id: 'bottle_glucose', name: 'ブドウ糖液', emoji: '🍯', rarity: 'common', target: 'self',
    effects: [{ type: 'heal', amount: 15 }],
    text: 'HPを15回復する。',
    chem: '脳のおもなエネルギー源はグルコース。とはいえ、試験前に最も効くのは十分な睡眠。',
  },
  {
    id: 'bottle_saline', name: '生理食塩水', emoji: '💧', rarity: 'common', target: 'self',
    effects: [{ type: 'status', status: 'regen', amount: 6, target: 'self' }],
    text: '再結晶6を得る（ターン終了時にHP回復、毎ターン−1）。',
    chem: '約0.9%のNaCl水溶液。血液と浸透圧が等しい（等張液）ので、赤血球が膨らんだり縮んだりしない。',
  },
  {
    id: 'bottle_kmno4', name: '過マンガン酸カリウムの瓶', emoji: '🟣', rarity: 'uncommon', target: 'enemy',
    effects: [{ type: 'damage', amount: 12 }, { type: 'status', status: 'weak', amount: 2, target: 'enemy' }],
    text: '12ダメージ。希釈2。',
    chem: '光で分解するので褐色瓶に保存する。酸化還元滴定では自身の色の変化で終点がわかる（指示薬不要）。',
  },
  {
    id: 'bottle_thermite', name: 'テルミット剤', emoji: '💥', rarity: 'rare', target: 'all',
    effects: [{ type: 'damage', amount: 14, target: 'all' }],
    text: '敵全体に14ダメージ。',
    chem: 'Al粉末と酸化鉄(III)の混合物。点火するとAlがFe_2O_3を還元し、2000℃を超える高温になる。',
  },
  {
    id: 'bottle_liquid_n2', name: '液体窒素', emoji: '🧊', rarity: 'uncommon', target: 'enemy',
    effects: [{ type: 'status', status: 'precip', amount: 1, target: 'enemy' }, { type: 'status', status: 'vulnerable', amount: 1, target: 'enemy' }],
    text: '沈殿1、活性化1を与える（凍結）。',
    chem: '沸点は約−196℃。デュワー瓶で保存し、密閉容器に入れてはいけない（気化で破裂する）。',
  },
  {
    id: 'bottle_indicator', name: '万能指示薬', emoji: '🌈', rarity: 'common', target: 'enemy',
    effects: [{ type: 'reveal', count: 99 }, { type: 'draw', amount: 2 }],
    text: '対象の隠れた性質をすべて公開。2枚引く。',
    chem: '複数の指示薬を混ぜたもので、pHに応じて赤〜紫に連続的に色が変わる。',
  },
  {
    id: 'bottle_luminol', name: 'ルミノール液', emoji: '✨', rarity: 'uncommon', target: 'self',
    effects: [{ type: 'status', status: 'excited', amount: 2, target: 'self' }],
    text: '励起2を得る（次のターン開始時にエネルギー+2）。',
    chem: '塩基性でH_2O_2などにより酸化されると青白く発光する（化学発光）。血痕の鑑識に使われる。',
  },
  {
    id: 'bottle_h2o2', name: '過酸化水素水の瓶', emoji: '🫧', rarity: 'common', target: 'enemy',
    effects: [{ type: 'status', status: 'vulnerable', amount: 3, target: 'enemy' }],
    text: '活性化3を与える。',
    chem: '約3%の水溶液はオキシドールとして消毒に使われる。冷暗所に保存する。',
  },
  {
    id: 'bottle_ethanol', name: '消毒用エタノール', emoji: '🧼', rarity: 'common', target: 'self',
    effects: [{ type: 'status', status: 'colloid', amount: 2, target: 'self' }, { type: 'heal', amount: 5 }],
    text: '保護コロイド2を得る。HPを5回復する。',
    chem: '約80%のエタノール水溶液はタンパク質を変性させ、殺菌効果が高い。引火しやすいので火気厳禁。',
  },
  {
    id: 'bottle_cold_pack', name: '瞬間冷却パック', emoji: '❄️', rarity: 'uncommon', target: 'self',
    effects: [{ type: 'block', amount: 18 }],
    text: 'ブロック18。',
    chem: '硝酸アンモニウムが水に溶けるときの吸熱（溶解エンタルピーΔH > 0）を利用する。',
  },
  {
    id: 'bottle_agno3', name: '硝酸銀水溶液の瓶', emoji: '⚪', rarity: 'rare', target: 'enemy',
    effects: [{ type: 'damage', amount: 10 }, { type: 'status', status: 'precip', amount: 1, target: 'enemy' }, { type: 'reveal', count: 1 }],
    text: '10ダメージ。沈殿1。隠れた性質を1つ公開。',
    chem: '光で分解するので褐色瓶に保存する。皮膚につくと黒く変色する（Agが析出）。',
  },
];
