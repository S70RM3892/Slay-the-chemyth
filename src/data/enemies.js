// 敵定義。データのみ。
// 敵の quiz 行動の onCorrect/onWrong は敵を主体として実行される:
//   target:'self' = その敵、target:'player' = プレイヤー、loseHp = その敵がHPを失う、attack = プレイヤーへの攻撃。

export const ENEMIES = [
  // =====================================================================
  // ACT 1 理論の層 I「構造と状態」
  // =====================================================================
  {
    id: 'calcite', name: '方解石', formula: 'CaCO_3', emoji: '🪨', act: 1, tier: 'normal',
    hp: [30, 36], tags: ['ionic_crystal', 'ca_ion', 'co3_ion', 'basic'],
    phRules: [{ max: 4, takenMult: 1.5, note: '酸性: CaCO_3 + 2H^+ → Ca^{2+} + H_2O + CO_2↑ で溶ける（被ダメージ1.5倍）' }],
    lore: '炭酸カルシウムの結晶。石灰石・大理石・貝殻の主成分。弱酸の塩なので、塩酸や酢酸のような炭酸より強い酸を加えるとCO_2を出して溶ける（弱酸の遊離）。水には溶けにくいが、CO_2を含む水にはCa(HCO_3)_2となって溶け、鍾乳洞をつくる。',
    moves: {
      press: { name: '圧壊', intent: 'attack', effects: [{ type: 'attack', amount: 8 }] },
      cleave: { name: 'へき開', intent: 'attack', effects: [{ type: 'attack', amount: 4, times: 2 }] },
      limestone: { name: '石灰岩の層', intent: 'defend', effects: [{ type: 'block', amount: 8 }, { type: 'ph', delta: 1 }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'press', w: 2 }, { move: 'cleave', w: 2 }, { move: 'limestone', w: 1 }], noRepeat: 2 },
  },
  {
    id: 'dry_ice', name: 'ドライアイス', formula: 'CO_2(固)', emoji: '🧊', act: 1, tier: 'normal',
    hp: [24, 30], tags: ['molecular_crystal'],
    lore: '二酸化炭素の分子結晶。分子間力が弱く、1.013×10^5 Paでは液体を経ずに約−79℃で昇華する。CO_2の三重点は約5.2×10^5 Paなので、大気圧では液体のCO_2は存在できない。',
    moves: {
      chill: { name: '冷却', intent: 'attack', effects: [{ type: 'attack', amount: 6 }] },
      sublime: { name: '昇華', intent: 'debuff', effects: [{ type: 'block', amount: 5 }, { type: 'status', status: 'weak', amount: 1, target: 'player' }] },
      burst: { name: 'CO_2噴出', intent: 'attack', effects: [{ type: 'attack', amount: 3, times: 2 }, { type: 'ph', delta: -1 }] },
    },
    pattern: { type: 'cycle', seq: ['chill', 'sublime', 'burst'] },
  },
  {
    id: 'quartz', name: '石英', formula: 'SiO_2', emoji: '💎', act: 1, tier: 'normal',
    hp: [36, 42], tags: ['covalent_crystal', 'silicate'],
    lore: 'Si原子とO原子が共有結合で立体網目状につながった共有結合結晶。硬く融点が高い（約1700℃）。ほとんどの酸に溶けないが、フッ化水素酸には溶ける（SiO_2 + 6HF → H_2SiF_6 + 2H_2O）。',
    moves: {
      lattice: { name: '網目構造', intent: 'defend', effects: [{ type: 'block', amount: 12 }] },
      shard: { name: '鋭い破片', intent: 'attack', effects: [{ type: 'attack', amount: 10 }] },
      piezo: { name: '圧電効果', intent: 'attack', effects: [{ type: 'attack', amount: 5 }, { type: 'status', status: 'frail', amount: 1, target: 'player' }] },
    },
    pattern: { type: 'cycle', seq: ['lattice', 'shard', 'piezo'] },
  },
  {
    id: 'fe_sol', name: '水酸化鉄(III)のゾル', formula: 'Fe(OH)_3', emoji: '🟤', act: 1, tier: 'normal',
    hp: [26, 32], tags: ['colloid', 'hydrophobic_colloid'],
    lore: '沸騰水に塩化鉄(III)水溶液を加えると得られる赤褐色のコロイド。正に帯電した疎水コロイドで、チンダル現象やブラウン運動を示す。少量の電解質で凝析し、価数の大きい陰イオン（PO_4^{3-} > SO_4^{2-} > Cl^-）ほど効果が大きい。',
    moves: {
      brownian: { name: 'ブラウン運動', intent: 'attack', effects: [{ type: 'attack', amount: 4, times: 2 }] },
      repel: { name: '電気的反発', intent: 'buff', effects: [{ type: 'status', status: 'colloid', amount: 1, target: 'self' }, { type: 'block', amount: 5 }] },
      adsorb: { name: '吸着', intent: 'debuff', effects: [{ type: 'attack', amount: 4 }, { type: 'status', status: 'weak', amount: 1, target: 'player' }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'brownian', w: 2 }, { move: 'repel', w: 1 }, { move: 'adsorb', w: 2 }], noRepeat: 2 },
  },
  {
    id: 'myth_boil100', name: '「沸点はいつも100℃」', emoji: '♨️', act: 1, tier: 'normal',
    hp: [28, 34], tags: ['water', 'h_bond'],
    lore: '誤概念: 水の沸点は常に100℃である。\n正しくは: 沸点は飽和蒸気圧が外圧と等しくなる温度。1.013×10^5 Paのとき100℃であり、外圧が低い高山では100℃より低く、圧力鍋の中では高くなる。',
    moves: {
      boil: { name: '沸騰', intent: 'attack', effects: [{ type: 'attack', amount: 9 }] },
      insist: { name: '思い込みの強化', intent: 'buff', effects: [{ type: 'status', status: 'strength', amount: 2, target: 'self' }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 6 }], onWrong: [{ type: 'attack', amount: 8 }] }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'boil', w: 3 }, { move: 'insist', w: 1 }, { move: 'quiz', w: 2 }], noRepeat: 2 },
  },
  {
    id: 'myth_vapor_volume', name: '「蒸気圧は体積で変わる」', emoji: '🫧', act: 1, tier: 'normal',
    hp: [26, 32], tags: ['gas'],
    lore: '誤概念: 液体と共存する蒸気も、圧縮すればボイルの法則どおり圧力が上がる。\n正しくは: 気液が共存している限り、蒸気の圧力は飽和蒸気圧（温度だけで決まる）で一定。体積を減らすと蒸気の一部が凝縮するだけである。',
    moves: {
      compress: { name: '押し縮める', intent: 'attack', effects: [{ type: 'attack', amount: 6 }, { type: 'status', status: 'frail', amount: 1, target: 'player' }] },
      expand: { name: '膨張', intent: 'defend', effects: [{ type: 'block', amount: 7 }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 6 }], onWrong: [{ type: 'attack', amount: 8 }] }] },
    },
    pattern: { type: 'cycle', seq: ['compress', 'expand', 'quiz'] },
  },
  {
    id: 'supercooled_water', name: '過冷却水', formula: 'H_2O', emoji: '💧', act: 1, tier: 'normal',
    hp: [22, 28], tags: ['water', 'h_bond'],
    lore: '凝固点より低い温度でも液体のままの水。わずかな刺激で一気に凝固が始まり、放出される凝固熱で温度は凝固点まで上がる（冷却曲線のくぼみ）。',
    moves: {
      still: { name: '静かな過冷却', intent: 'buff', effects: [{ type: 'block', amount: 4 }, { type: 'status', status: 'strength', amount: 2, target: 'self' }] },
      freeze: { name: '突然の凝固', intent: 'attack', effects: [{ type: 'attack', amount: 12 }] },
    },
    pattern: { type: 'cycle', seq: ['still', 'still', 'freeze'] },
  },
  {
    id: 'myth_ionic_solid', name: '「イオン結晶は固体でも電気を通す」', emoji: '⚡', act: 1, tier: 'normal',
    hp: [30, 36], tags: ['ionic_crystal', 'na_ion', 'cl_ion'],
    lore: '誤概念: イオンでできているのだから、NaClの結晶はそのままで電気を通す。\n正しくは: 固体ではイオンが定位置に固定されて動けず、電気を通さない。融解液や水溶液ではイオンが動けるので電気を通す。電気を通す固体は、自由電子をもつ金属や黒鉛。',
    moves: {
      shock: { name: '幻の電流', intent: 'attack', effects: [{ type: 'attack', amount: 7 }] },
      overload: { name: '過負荷', intent: 'debuff', effects: [{ type: 'attack', amount: 4 }, { type: 'status', status: 'vulnerable', amount: 1, target: 'player' }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 6 }], onWrong: [{ type: 'attack', amount: 9 }] }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'shock', w: 3 }, { move: 'overload', w: 2 }, { move: 'quiz', w: 1 }], noRepeat: 2 },
  },
  {
    id: 'minion_ice', name: '氷の結晶', formula: 'H_2O(固)', emoji: '❄️', act: 1, tier: 'minion',
    hp: [12, 15], tags: ['water', 'h_bond', 'molecular_crystal'],
    lore: '水分子が水素結合で正四面体状につながった、すき間の多い分子結晶。そのため氷は液体の水より密度が小さく水に浮く（水の密度は約4℃で最大）。',
    moves: {
      shard: { name: '氷片', intent: 'attack', effects: [{ type: 'attack', amount: 4 }] },
      float: { name: '浮上', intent: 'defend', effects: [{ type: 'block', amount: 5 }] },
    },
    pattern: { type: 'cycle', seq: ['shard', 'float'] },
  },
  {
    id: 'diamond', name: 'ダイヤモンド', formula: 'C', emoji: '💠', act: 1, tier: 'elite',
    hp: [92, 100], tags: ['covalent_crystal'],
    lore: '炭素原子が4本の共有結合で正四面体状につながった共有結合結晶。最も硬い物質の一つで電気を通さない。同素体の黒鉛は層状構造で、層内を動ける電子があるため電気を通す。空気中で強熱すると燃えてCO_2になる。',
    moves: {
      tetra: { name: '正四面体の網目', intent: 'defend', effects: [{ type: 'block', amount: 16 }] },
      strike: { name: '最硬の一撃', intent: 'attack', effects: [{ type: 'attack', amount: 15 }] },
      refract: { name: '強い屈折', intent: 'debuff', effects: [{ type: 'status', status: 'weak', amount: 2, target: 'player' }, { type: 'status', status: 'vulnerable', amount: 1, target: 'player' }] },
      facets: { name: '多面カット', intent: 'attack', effects: [{ type: 'attack', amount: 5, times: 3 }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 10 }], onWrong: [{ type: 'attack', amount: 14 }] }] },
    },
    pattern: { type: 'cycle', seq: ['tetra', 'strike', 'quiz', 'refract', 'facets'] },
  },
  {
    id: 'real_gas', name: '実在気体', emoji: '☁️', act: 1, tier: 'elite',
    hp: [84, 92], tags: ['gas'],
    lore: '理想気体は分子の体積と分子間力を0とみなすが、実在気体にはどちらもある。低温では分子間力のため、高圧では分子自身の体積のため、pV/(nRT)が1からずれる。高温・低圧ほど理想気体に近づく。',
    moves: {
      attract: { name: '分子間力', intent: 'debuff', effects: [{ type: 'attack', amount: 6 }, { type: 'status', status: 'weak', amount: 2, target: 'player' }] },
      excluded: { name: '排除体積', intent: 'buff', effects: [{ type: 'block', amount: 12 }, { type: 'status', status: 'strength', amount: 2, target: 'self' }] },
      pressure: { name: '高圧', intent: 'attack', effects: [{ type: 'attack', amount: 8, times: 2 }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 10 }], onWrong: [{ type: 'attack', amount: 12 }] }] },
    },
    pattern: { type: 'cycle', seq: ['quiz', 'attract', 'pressure', 'excluded', 'quiz', 'pressure'] },
  },
  {
    id: 'boss_triple_point', name: '三重点の番人', formula: 'H_2O', emoji: '🌡️', act: 1, tier: 'boss',
    hp: [140, 148], tags: ['water', 'h_bond'],
    quizSetId: 'set-th1-01', quizField: 'theory1',
    lore: '水の状態図の三重点（約0.01℃・約610 Pa）に住む番人。固体・液体・気体の三相が共存する唯一の点。水の融解曲線は右上がりでなく左上がり（圧力を上げると融点が下がる）で、これは氷の密度が液体より小さいため。臨界点（約374℃・約2.2×10^7 Pa）を越えると液体と気体の区別がない超臨界流体になる。',
    moves: {
      quiz: { name: '大問', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 12 }], onWrong: [{ type: 'attack', amount: 10 }, { type: 'status', status: 'frail', amount: 2, target: 'player' }] }] },
      liquid: { name: '液相の奔流', intent: 'attack', effects: [{ type: 'attack', amount: 12 }] },
      crystallize: { name: '結晶化', intent: 'special', effects: [{ type: 'summon', enemyId: 'minion_ice' }, { type: 'block', amount: 10 }] },
      gas: { name: '気相の拡散', intent: 'attack', effects: [{ type: 'attack', amount: 4, times: 3 }] },
      latent: { name: '潜熱', intent: 'buff', effects: [{ type: 'status', status: 'strength', amount: 2, target: 'self' }, { type: 'block', amount: 8 }] },
      supercritical: { name: '超臨界の圧', intent: 'attack', effects: [{ type: 'attack', amount: 9, times: 2 }] },
    },
    pattern: { type: 'cycle', seq: ['quiz', 'liquid', 'crystallize', 'gas', 'quiz', 'latent'] },
    phases: [
      {
        hpBelow: 0.5, name: '超臨界流体',
        onEnter: [{ type: 'status', status: 'strength', amount: 2, target: 'self' }, { type: 'removeTag', tag: 'h_bond' }],
        pattern: { type: 'cycle', seq: ['quiz', 'supercritical', 'liquid', 'quiz', 'crystallize', 'gas'] },
      },
    ],
  },

  // =====================================================================
  // ACT 2 理論の層 II「平衡と変化」＋無機
  // =====================================================================
  {
    id: 'ag_ion', name: '銀イオン', formula: 'Ag^+', emoji: '⚪', act: 2, tier: 'normal',
    hp: [40, 46], tags: ['ag_ion'],
    lore: 'Cl^-で白色AgCl、H_2Sで黒色Ag_2S、CrO_4^{2-}で赤褐色Ag_2CrO_4、少量のアンモニア水やNaOHで褐色Ag_2Oが沈殿する。過剰のアンモニア水では[Ag(NH_3)_2]^+となって溶ける。AgClなどのハロゲン化銀は光で分解し銀が析出する（感光性）。',
    moves: {
      strike: { name: '銀の一撃', intent: 'attack', effects: [{ type: 'attack', amount: 10 }] },
      photo: { name: '感光', intent: 'attack', effects: [{ type: 'attack', amount: 5 }, { type: 'status', status: 'colloid', amount: 1, target: 'self' }] },
      mirror: { name: '銀鏡', intent: 'defend', effects: [{ type: 'block', amount: 9 }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'strike', w: 2 }, { move: 'photo', w: 2 }, { move: 'mirror', w: 1 }], noRepeat: 2 },
  },
  {
    id: 'pb_ion', name: '鉛(II)イオン', formula: 'Pb^{2+}', emoji: '🩶', act: 2, tier: 'normal',
    hp: [42, 48], tags: ['pb_ion', 'amphoteric'],
    lore: 'Cl^-で白色PbCl_2（熱水に溶ける）、SO_4^{2-}で白色PbSO_4、CrO_4^{2-}で黄色PbCrO_4、H_2Sで黒色PbS。両性元素で、Pb(OH)_2は過剰のNaOH水溶液に溶ける。重金属として毒性をもつ。',
    moves: {
      strike: { name: '重い一撃', intent: 'attack', effects: [{ type: 'attack', amount: 11 }] },
      heavy: { name: '重金属の毒', intent: 'debuff', effects: [{ type: 'attack', amount: 4 }, { type: 'status', status: 'poison', amount: 3, target: 'player' }] },
      hot_water: { name: '熱水で再溶解', intent: 'defend', effects: [{ type: 'block', amount: 8 }, { type: 'status', status: 'colloid', amount: 1, target: 'self' }] },
    },
    pattern: { type: 'cycle', seq: ['strike', 'heavy', 'hot_water'] },
  },
  {
    id: 'cu_ion', name: '銅(II)イオン', formula: 'Cu^{2+}', emoji: '🔵', act: 2, tier: 'normal',
    hp: [40, 46], tags: ['cu_ion'],
    lore: '水溶液中では[Cu(H_2O)_4]^{2+}として青色。塩基で青白色Cu(OH)_2が沈殿し、過剰のアンモニア水では深青色の[Cu(NH_3)_4]^{2+}となって溶けるが、過剰のNaOHには溶けない。Cu(OH)_2を加熱すると黒色CuO。H_2Sでは酸性でも黒色CuS。炎色反応は青緑。',
    moves: {
      hydrate: { name: '水和', intent: 'defend', effects: [{ type: 'block', amount: 8 }] },
      wave: { name: '青い波', intent: 'attack', effects: [{ type: 'attack', amount: 9 }] },
      verdigris: { name: '緑青', intent: 'debuff', effects: [{ type: 'attack', amount: 5 }, { type: 'status', status: 'weak', amount: 1, target: 'player' }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 7 }], onWrong: [{ type: 'attack', amount: 10 }] }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'hydrate', w: 1 }, { move: 'wave', w: 3 }, { move: 'verdigris', w: 2 }, { move: 'quiz', w: 1 }], noRepeat: 2 },
  },
  {
    id: 'zn_ion', name: '亜鉛イオン', formula: 'Zn^{2+}', emoji: '⚙️', act: 2, tier: 'normal',
    hp: [40, 46], tags: ['zn_ion', 'amphoteric'],
    lore: '無色のイオン。Zn(OH)_2（白）は両性で過剰のNaOH水溶液に[Zn(OH)_4]^{2-}として溶け、さらに過剰のアンモニア水にも[Zn(NH_3)_4]^{2+}として溶ける（Al(OH)_3との違い）。H_2SとはZnS（白）をつくるが、酸性では沈殿しない。',
    moves: {
      strike: { name: '亜鉛の刃', intent: 'attack', effects: [{ type: 'attack', amount: 9 }] },
      amph: { name: '両性の構え', intent: 'buff', effects: [{ type: 'block', amount: 6 }, { type: 'status', status: 'strength', amount: 1, target: 'self' }] },
      dual: { name: '酸にも塩基にも', intent: 'attack', effects: [{ type: 'attack', amount: 5, times: 2 }] },
    },
    pattern: { type: 'cycle', seq: ['strike', 'amph', 'dual'] },
  },
  {
    id: 'fe2_ion', name: '鉄(II)イオン', formula: 'Fe^{2+}', emoji: '🟢', act: 2, tier: 'normal',
    hp: [38, 44], tags: ['fe2_ion', 'reducer'],
    lore: '淡緑色。K_3[Fe(CN)_6]で濃青色沈殿、塩基で緑白色Fe(OH)_2。KSCNでは呈色しない。空気中で徐々に酸化されてFe^{3+}になる（この敵も時間がたつとFe^{3+}に変わる）。H_2Sでは中性〜塩基性でのみ黒色FeSが沈殿する。',
    moves: {
      strike: { name: '鉄の一撃', intent: 'attack', effects: [{ type: 'attack', amount: 9 }] },
      green: { name: '緑白色の沈殿', intent: 'debuff', effects: [{ type: 'attack', amount: 6 }, { type: 'status', status: 'weak', amount: 1, target: 'player' }] },
      air_ox: { name: '空気酸化', intent: 'special', effects: [{ type: 'removeTag', tag: 'fe2_ion' }, { type: 'removeTag', tag: 'reducer' }, { type: 'addTag', tag: 'fe3_ion' }, { type: 'block', amount: 6 }] },
    },
    pattern: { type: 'cycle', seq: ['strike', 'green', 'air_ox', 'strike', 'green'] },
  },
  {
    id: 'fe3_ion', name: '鉄(III)イオン', formula: 'Fe^{3+}', emoji: '🟠', act: 2, tier: 'normal',
    hp: [40, 46], tags: ['fe3_ion', 'acidic'],
    lore: '黄褐色。KSCNで血赤色、K_4[Fe(CN)_6]で濃青色沈殿、塩基で赤褐色Fe(OH)_3。水溶液中では加水分解してH^+を出すため酸性を示す。',
    moves: {
      hydrolysis: { name: '加水分解', intent: 'defend', effects: [{ type: 'block', amount: 7 }, { type: 'ph', delta: -1 }] },
      strike: { name: '赤褐色の一撃', intent: 'attack', effects: [{ type: 'attack', amount: 10 }] },
      rust: { name: '赤さび', intent: 'debuff', effects: [{ type: 'status', status: 'poison', amount: 2, target: 'player' }, { type: 'status', status: 'frail', amount: 1, target: 'player' }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'hydrolysis', w: 1 }, { move: 'strike', w: 3 }, { move: 'rust', w: 1 }], noRepeat: 2 },
  },
  {
    id: 'al_hydroxide', name: '水酸化アルミニウム', formula: 'Al(OH)_3', emoji: '⬜', act: 2, tier: 'normal',
    hp: [44, 50], tags: ['al_ion', 'amphoteric', 'hydroxide'],
    phRules: [
      { min: 4, max: 10, takenMult: 0.4, note: '中性付近では難溶性の白色ゲル状沈殿のまま（被ダメージ0.4倍）' },
      { max: 3, takenMult: 1.5, note: '強酸性で溶ける: Al(OH)_3 + 3H^+ → Al^{3+} + 3H_2O' },
      { min: 11, takenMult: 1.5, note: '強塩基性で溶ける: Al(OH)_3 + OH^- → [Al(OH)_4]^-' },
    ],
    lore: '白色ゲル状の両性水酸化物。酸にも強塩基にも溶けるが、中性付近では溶けない。過剰のアンモニア水には溶けない（Zn(OH)_2との区別点）。胃酸を中和する制酸剤にも使われる。',
    moves: {
      strike: { name: 'ゲルの塊', intent: 'attack', effects: [{ type: 'attack', amount: 9 }] },
      gel: { name: 'ゲル状沈殿', intent: 'defend', effects: [{ type: 'block', amount: 10 }] },
      antacid: { name: '制酸', intent: 'attack', effects: [{ type: 'attack', amount: 5 }, { type: 'ph', delta: 2 }] },
    },
    pattern: { type: 'cycle', seq: ['strike', 'gel', 'antacid'] },
  },
  {
    id: 'ba_ion', name: 'バリウムイオン', formula: 'Ba^{2+}', emoji: '🟩', act: 2, tier: 'normal',
    hp: [38, 44], tags: ['ba_ion'],
    lore: 'SO_4^{2-}で白色BaSO_4、CrO_4^{2-}で黄色BaCrO_4、CO_3^{2-}で白色BaCO_3。炎色反応は黄緑。BaSO_4は水にも酸にも溶けないので無毒でX線造影剤に使われるが、水に溶けるBa^{2+}の塩は有毒。',
    moves: {
      toxic: { name: '可溶性バリウムの毒', intent: 'debuff', effects: [{ type: 'attack', amount: 3 }, { type: 'status', status: 'poison', amount: 3, target: 'player' }] },
      strike: { name: '重い一撃', intent: 'attack', effects: [{ type: 'attack', amount: 9 }] },
      flame: { name: '黄緑の炎', intent: 'attack', effects: [{ type: 'attack', amount: 6 }, { type: 'status', status: 'vulnerable', amount: 1, target: 'player' }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'toxic', w: 1 }, { move: 'strike', w: 2 }, { move: 'flame', w: 2 }], noRepeat: 2 },
  },
  {
    id: 'myth_catalyst', name: '「触媒は平衡を移動させる」', emoji: '⚖️', act: 2, tier: 'normal',
    hp: [40, 46], tags: ['equilibrium'],
    lore: '誤概念: 触媒を加えると生成物が増える（平衡が右に移動する）。\n正しくは: 触媒は正反応と逆反応の活性化エネルギーを同じだけ下げ、両方を同じ割合で速くする。平衡に達するまでの時間は短くなるが、平衡定数・平衡組成・反応エンタルピーは変わらない。',
    moves: {
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', field: 'theory2', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 7 }], onWrong: [{ type: 'attack', amount: 10 }] }] },
      strike: { name: '偽りの加速', intent: 'attack', effects: [{ type: 'attack', amount: 10 }] },
      shift: { name: '偽りの平衡移動', intent: 'buff', effects: [{ type: 'status', status: 'strength', amount: 2, target: 'self' }, { type: 'block', amount: 5 }] },
    },
    pattern: { type: 'cycle', seq: ['quiz', 'strike', 'shift', 'strike'] },
  },
  {
    id: 'myth_gold', name: '「金はどんな酸にも溶けない」', formula: 'Au', emoji: '🥇', act: 2, tier: 'normal',
    hp: [46, 52], tags: ['metal', 'noble_metal'],
    lore: '誤概念: 金はどんな酸にも溶けない。\n正しくは: 金や白金は塩酸・硫酸・硝酸には溶けないが、濃硝酸と濃塩酸を1:3で混ぜた王水には溶ける（Au + HNO_3 + 4HCl → H[AuCl_4] + NO + 2H_2O）。',
    moves: {
      luster: { name: '不変の輝き', intent: 'defend', effects: [{ type: 'block', amount: 12 }] },
      strike: { name: '黄金の一撃', intent: 'attack', effects: [{ type: 'attack', amount: 10 }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', field: 'inorganic', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 7 }], onWrong: [{ type: 'attack', amount: 10 }] }] },
    },
    pattern: { type: 'cycle', seq: ['luster', 'strike', 'quiz', 'strike'] },
  },
  {
    id: 'iron_nail', name: '鉄くぎ', formula: 'Fe', emoji: '🔩', act: 2, tier: 'normal',
    hp: [42, 48], tags: ['metal', 'passivating', 'reducer'],
    phRules: [{ max: 2, takenMult: 1.3, note: '強酸性（希酸）では Fe + 2H^+ → Fe^{2+} + H_2↑ で溶ける（被ダメージ1.3倍）。濃硝酸では不動態。' }],
    lore: '鉄の単体。希塩酸・希硫酸にはH_2を出して溶けFe^{2+}になるが、濃硝酸中では表面に緻密な酸化被膜ができて溶けない（不動態）。湿った空気中では赤さび（主にFe_2O_3·nH_2O）を生じる。',
    moves: {
      strike: { name: '鉄の一撃', intent: 'attack', effects: [{ type: 'attack', amount: 10 }] },
      film: { name: '酸化被膜', intent: 'defend', effects: [{ type: 'block', amount: 10 }] },
      rust: { name: '赤さびの棘', intent: 'debuff', effects: [{ type: 'attack', amount: 5 }, { type: 'status', status: 'poison', amount: 2, target: 'player' }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'strike', w: 3 }, { move: 'film', w: 1 }, { move: 'rust', w: 2 }], noRepeat: 2 },
  },
  {
    id: 'unk_sol_a', name: '未知の水溶液A', emoji: '🧴', act: 2, tier: 'normal',
    hp: [36, 42], tags: [], hiddenTags: ['na_ion', 'cl_ion'],
    lore: '無色透明の水溶液。陽イオンは沈殿をつくりにくく、炎色反応でしか確かめられないかもしれない。陰イオンは硝酸銀水溶液で調べられる。',
    moves: {
      splash: { name: '飛沫', intent: 'attack', effects: [{ type: 'attack', amount: 8 }] },
      seep: { name: 'しみこみ', intent: 'debuff', effects: [{ type: 'attack', amount: 4 }, { type: 'status', status: 'weak', amount: 1, target: 'player' }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', field: 'inorganic', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 6 }], onWrong: [{ type: 'attack', amount: 9 }] }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'splash', w: 3 }, { move: 'seep', w: 2 }, { move: 'quiz', w: 1 }], noRepeat: 2 },
  },
  {
    id: 'unk_sol_b', name: '未知の水溶液B', emoji: '🧴', act: 2, tier: 'normal',
    hp: [38, 44], tags: [], hiddenTags: ['ca_ion', 'cl_ion'],
    lore: '無色透明の水溶液。炭酸塩や硫酸塩が沈殿するかどうか、炎の色が何色かが手がかりになる。',
    moves: {
      splash: { name: '飛沫', intent: 'attack', effects: [{ type: 'attack', amount: 9 }] },
      scale: { name: '湯あか', intent: 'defend', effects: [{ type: 'block', amount: 8 }] },
      seep: { name: 'しみこみ', intent: 'debuff', effects: [{ type: 'attack', amount: 4 }, { type: 'status', status: 'frail', amount: 1, target: 'player' }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'splash', w: 3 }, { move: 'scale', w: 1 }, { move: 'seep', w: 2 }], noRepeat: 2 },
  },
  {
    id: 'sn_ion', name: 'スズ(II)イオン', formula: 'Sn^{2+}', emoji: '🥫', act: 2, tier: 'normal',
    hp: [40, 46], tags: ['sn_ion', 'amphoteric', 'reducer'],
    lore: 'Sn^{2+}は還元剤としてはたらき、Sn^{4+}になりやすい（SnCl_2はニトロベンゼンの還元にも使われる）。両性元素で、白色のSn(OH)_2は過剰のNaOH水溶液に溶ける。H_2Sでは酸性でも褐色のSnSが沈殿する。',
    moves: {
      strike: { name: 'スズの一撃', intent: 'attack', effects: [{ type: 'attack', amount: 9 }] },
      reduce: { name: '還元', intent: 'debuff', effects: [{ type: 'attack', amount: 5 }, { type: 'status', status: 'weak', amount: 2, target: 'player' }] },
      plate: { name: 'めっき（ブリキ）', intent: 'defend', effects: [{ type: 'block', amount: 9 }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'strike', w: 3 }, { move: 'reduce', w: 2 }, { move: 'plate', w: 1 }], noRepeat: 2 },
  },
  {
    id: 'unk_sol_c', name: '未知の水溶液C', emoji: '🧴', act: 2, tier: 'normal',
    hp: [36, 42], tags: [], hiddenTags: ['k_ion', 'so4_ion'],
    lore: '無色透明の水溶液。K^+は沈殿をつくりにくいので炎色反応（赤紫、青色のコバルトガラスを通すと見やすい）で確かめる。陰イオンはBa^{2+}を加えて白色沈殿ができるかで調べられる。',
    moves: {
      splash: { name: '飛沫', intent: 'attack', effects: [{ type: 'attack', amount: 9 }] },
      seep: { name: 'しみこみ', intent: 'debuff', effects: [{ type: 'attack', amount: 4 }, { type: 'status', status: 'vulnerable', amount: 1, target: 'player' }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', field: 'inorganic', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 6 }], onWrong: [{ type: 'attack', amount: 9 }] }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'splash', w: 3 }, { move: 'seep', w: 2 }, { move: 'quiz', w: 1 }], noRepeat: 2 },
  },
  {
    id: 'firework_star', name: '赤い花火の星', emoji: '🎆', act: 2, tier: 'normal',
    hp: [38, 44], tags: ['exothermic'], hiddenTags: ['sr_ion', 'li_ion'],
    lore: '花火の色は炎色反応による。赤い炎はLi（赤）とSr（紅・深赤）のどちらでも出るので、色だけで1つに決めつけないこと。黄はNa、黄緑はBa、青緑はCu。',
    moves: {
      burst: { name: '炸裂', intent: 'attack', effects: [{ type: 'attack', amount: 5, times: 2 }] },
      glare: { name: '閃光', intent: 'debuff', effects: [{ type: 'status', status: 'weak', amount: 1, target: 'player' }, { type: 'status', status: 'vulnerable', amount: 1, target: 'player' }] },
      heat: { name: '燃焼熱', intent: 'buff', effects: [{ type: 'status', status: 'thorns', amount: 2, target: 'self' }, { type: 'block', amount: 6 }] },
    },
    pattern: { type: 'cycle', seq: ['burst', 'glare', 'burst', 'heat'] },
  },
  {
    id: 'minion_nh3', name: 'アンモニア分子', formula: 'NH_3', emoji: '💨', act: 2, tier: 'minion',
    hp: [14, 18], tags: ['basic', 'gas'],
    lore: '三角錐形の極性分子。窒素の非共有電子対で金属イオンに配位結合し、錯イオンをつくる。水に非常によく溶けて弱塩基性を示す。',
    moves: {
      base: { name: '弱塩基', intent: 'attack', effects: [{ type: 'attack', amount: 4 }, { type: 'ph', delta: 1 }] },
      coordinate: { name: '配位', intent: 'defend', effects: [{ type: 'block', amount: 5 }] },
    },
    pattern: { type: 'cycle', seq: ['base', 'coordinate'] },
  },
  {
    id: 'permanganate', name: '過マンガン酸イオン', formula: 'MnO_4^-', emoji: '🟣', act: 2, tier: 'elite',
    hp: [120, 130], tags: ['oxidizer'],
    phRules: [
      { max: 4, dealtMult: 1.3, note: '酸性で強力: MnO_4^- + 8H^+ + 5e^- → Mn^{2+} + 4H_2O（与ダメージ1.3倍）' },
      { min: 7, dealtMult: 0.8, note: '中性〜塩基性ではMnO_2までしか還元されず酸化力が弱い（与ダメージ0.8倍）' },
    ],
    lore: '赤紫色の強い酸化剤。硫酸酸性で最も強く、5電子を受け取ってほぼ無色のMn^{2+}になる。酸性にするのに塩酸を使わないのはCl^-が酸化されてCl_2が出るから、硝酸を使わないのはそれ自身が酸化剤だから。H_2O_2やSO_2のような還元剤で打ち消せる。',
    moves: {
      acidify: { name: '硫酸酸性化', intent: 'buff', effects: [{ type: 'ph', delta: -2 }, { type: 'status', status: 'strength', amount: 2, target: 'self' }] },
      oxidize: { name: '酸化', intent: 'attack', effects: [{ type: 'attack', amount: 14 }] },
      grab: { name: '電子を奪う', intent: 'attack', effects: [{ type: 'attack', amount: 6, times: 2 }, { type: 'status', status: 'weak', amount: 1, target: 'player' }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', field: 'inorganic', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 10 }], onWrong: [{ type: 'attack', amount: 12 }] }] },
    },
    pattern: { type: 'cycle', seq: ['acidify', 'oxidize', 'quiz', 'grab', 'quiz'] },
  },
  {
    id: 'ammine_cu', name: 'テトラアンミン銅(II)イオン', formula: '[Cu(NH_3)_4]^{2+}', emoji: '🔷', act: 2, tier: 'elite',
    hp: [112, 122], tags: ['cu_ion', 'complex_ion', 'basic'],
    phRules: [
      { max: 4, takenMult: 1.5, note: '酸を加えるとNH_3がNH_4^+になり、錯イオンが壊れる（被ダメージ1.5倍）' },
      { min: 10, takenMult: 0.75, note: 'アンモニアが十分にあると錯イオンは安定（被ダメージ0.75倍）' },
    ],
    lore: 'Cu^{2+}に4個のNH_3が配位結合した正方形の錯イオン。深青色。Cu(OH)_2に過剰のアンモニア水を加えると生じる。この水溶液（シュバイツァー試薬）はセルロースを溶かし、銅アンモニアレーヨンの製造に使われる。',
    moves: {
      ligand: { name: '配位結合', intent: 'defend', effects: [{ type: 'block', amount: 14 }, { type: 'ph', delta: 1 }] },
      strike: { name: '深青の衝撃', intent: 'attack', effects: [{ type: 'attack', amount: 13 }] },
      deep_blue: { name: '深青色', intent: 'debuff', effects: [{ type: 'status', status: 'weak', amount: 2, target: 'player' }, { type: 'status', status: 'frail', amount: 1, target: 'player' }] },
      call: { name: '配位子の招集', intent: 'special', effects: [{ type: 'summon', enemyId: 'minion_nh3' }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', field: 'inorganic', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 10 }], onWrong: [{ type: 'attack', amount: 12 }] }] },
    },
    pattern: { type: 'cycle', seq: ['ligand', 'strike', 'quiz', 'deep_blue', 'call', 'strike', 'quiz'] },
  },
  {
    id: 'boss_haber', name: 'ハーバー・ボッシュ反応塔', formula: 'N_2 + 3H_2 ⇄ 2NH_3', emoji: '🏭', act: 2, tier: 'boss',
    hp: [200, 210], tags: ['equilibrium', 'gas', 'exothermic'],
    quizSetId: 'set-th2-01', quizField: 'theory2',
    lore: 'N_2 + 3H_2 ⇄ 2NH_3  ΔH = −92 kJ。発熱反応で気体分子数が減るので、平衡を右に寄せるには低温・高圧が有利。しかし低温では反応が遅いため、実際には400〜600℃・高圧で、四酸化三鉄を主成分とする触媒を使う。触媒は平衡に達する時間を短くするが、平衡の位置は変えない。',
    moves: {
      quiz: { name: '大問', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 14 }], onWrong: [{ type: 'attack', amount: 12 }, { type: 'status', status: 'vulnerable', amount: 1, target: 'player' }] }] },
      synth: { name: 'アンモニア合成', intent: 'attack', effects: [{ type: 'attack', amount: 7, times: 2 }] },
      pressurize: { name: '加圧（平衡は右へ）', intent: 'buff', effects: [{ type: 'status', status: 'strength', amount: 2, target: 'self' }, { type: 'block', amount: 6 }] },
      iron_cat: { name: '鉄触媒', intent: 'defend', effects: [{ type: 'block', amount: 18 }] },
      exotherm: { name: '発熱（ΔH < 0）', intent: 'buff', effects: [{ type: 'status', status: 'thorns', amount: 3, target: 'self' }, { type: 'block', amount: 8 }] },
      call: { name: '生成物の放出', intent: 'special', effects: [{ type: 'summon', enemyId: 'minion_nh3' }] },
      mass: { name: '大量合成', intent: 'attack', effects: [{ type: 'attack', amount: 19 }] },
    },
    pattern: { type: 'cycle', seq: ['quiz', 'synth', 'pressurize', 'iron_cat', 'quiz', 'exotherm', 'synth'] },
    phases: [
      {
        hpBelow: 0.5, name: '高温高圧運転',
        onEnter: [{ type: 'status', status: 'strength', amount: 2, target: 'self' }, { type: 'summon', enemyId: 'minion_nh3' }],
        pattern: { type: 'cycle', seq: ['quiz', 'synth', 'mass', 'quiz', 'iron_cat', 'exotherm'] },
      },
    ],
  },

  // =====================================================================
  // ACT 3 有機の層「構造決定」 — 官能基は隠しタグ
  // =====================================================================
  {
    id: 'unk_c2h6o_a', name: '化合物 C_2H_6O（甲）', emoji: '🧪', act: 3, tier: 'normal',
    hp: [48, 54], tags: [], hiddenTags: ['alcohol1', 'iodoform'],
    lore: '分子式C_2H_6Oの異性体はエタノールとジメチルエーテルの2つ。ナトリウムで-OHの有無を、ヨードホルム反応でCH_3CH(OH)-の有無を確かめよう。',
    moves: {
      splash: { name: '揮発', intent: 'attack', effects: [{ type: 'attack', amount: 10 }] },
      intox: { name: '酩酊', intent: 'debuff', effects: [{ type: 'attack', amount: 4 }, { type: 'status', status: 'weak', amount: 2, target: 'player' }] },
      evap: { name: '気化熱', intent: 'defend', effects: [{ type: 'block', amount: 9 }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 8 }], onWrong: [{ type: 'attack', amount: 11 }] }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'splash', w: 3 }, { move: 'intox', w: 2 }, { move: 'evap', w: 1 }, { move: 'quiz', w: 1 }], noRepeat: 2 },
  },
  {
    id: 'unk_c2h6o_b', name: '化合物 C_2H_6O（乙）', emoji: '🧪', act: 3, tier: 'normal',
    hp: [46, 52], tags: [], hiddenTags: ['ether'],
    lore: '分子式C_2H_6Oの異性体はエタノールとジメチルエーテルの2つ。-OHがなければ水素結合をつくれず、沸点はずっと低い（ジメチルエーテルは約−25℃）。',
    moves: {
      flash: { name: '引火', intent: 'attack', effects: [{ type: 'attack', amount: 12 }] },
      vapor: { name: '蒸気', intent: 'debuff', effects: [{ type: 'block', amount: 6 }, { type: 'status', status: 'weak', amount: 1, target: 'player' }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 8 }], onWrong: [{ type: 'attack', amount: 11 }] }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'flash', w: 3 }, { move: 'vapor', w: 2 }, { move: 'quiz', w: 1 }], noRepeat: 2 },
  },
  {
    id: 'unk_c3h6o_a', name: '化合物 C_3H_6O（甲）', emoji: '🧪', act: 3, tier: 'normal',
    hp: [48, 54], tags: [], hiddenTags: ['aldehyde'],
    lore: '分子式C_3H_6Oにはプロパナール（アルデヒド）とアセトン（ケトン）などがある。還元性の有無（銀鏡反応・フェーリング液）とヨードホルム反応で区別できる。',
    moves: {
      reduce: { name: '還元', intent: 'debuff', effects: [{ type: 'attack', amount: 6 }, { type: 'status', status: 'weak', amount: 1, target: 'player' }] },
      strike: { name: '刺激臭', intent: 'attack', effects: [{ type: 'attack', amount: 11 }] },
      guard: { name: '揮発', intent: 'defend', effects: [{ type: 'block', amount: 9 }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'reduce', w: 2 }, { move: 'strike', w: 3 }, { move: 'guard', w: 1 }], noRepeat: 2 },
  },
  {
    id: 'unk_c3h6o_b', name: '化合物 C_3H_6O（乙）', emoji: '🧪', act: 3, tier: 'normal',
    hp: [50, 56], tags: [], hiddenTags: ['ketone', 'iodoform'],
    lore: '分子式C_3H_6Oにはプロパナール（アルデヒド）とアセトン（ケトン）などがある。ケトンは還元性を示さない。CH_3CO-をもてばヨードホルム反応が陽性。',
    moves: {
      dissolve: { name: '溶剤', intent: 'debuff', effects: [{ type: 'attack', amount: 7 }, { type: 'status', status: 'frail', amount: 2, target: 'player' }] },
      strike: { name: '揮発性の一撃', intent: 'attack', effects: [{ type: 'attack', amount: 11 }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 8 }], onWrong: [{ type: 'attack', amount: 11 }] }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'dissolve', w: 2 }, { move: 'strike', w: 3 }, { move: 'quiz', w: 1 }], noRepeat: 2 },
  },
  {
    id: 'unk_ch2o2', name: '化合物 CH_2O_2', emoji: '🐜', act: 3, tier: 'normal',
    hp: [44, 50], tags: ['acidic'], hiddenTags: ['carboxylic', 'aldehyde'],
    lore: '分子式CH_2O_2のカルボン酸は1つしかない。この分子はカルボキシ基だけでなくホルミル基（H-CO-）ももつので、酸性を示すうえに還元性もある（銀鏡反応陽性）。酸化されるとCO_2とH_2Oになる。',
    moves: {
      sting: { name: '刺す酸', intent: 'attack', effects: [{ type: 'attack', amount: 9 }, { type: 'ph', delta: -1 }] },
      reduce: { name: '還元', intent: 'debuff', effects: [{ type: 'attack', amount: 4 }, { type: 'status', status: 'weak', amount: 2, target: 'player' }] },
      guard: { name: '水素結合', intent: 'defend', effects: [{ type: 'block', amount: 8 }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'sting', w: 3 }, { move: 'reduce', w: 2 }, { move: 'guard', w: 1 }], noRepeat: 2 },
  },
  {
    id: 'unk_c2h4o2', name: '化合物 C_2H_4O_2', emoji: '🍶', act: 3, tier: 'normal',
    hp: [50, 56], tags: ['acidic'], hiddenTags: ['carboxylic'],
    lore: '分子式C_2H_4O_2には酢酸とギ酸メチルがある。酸性を示すならカルボン酸。なおCH_3CO-をもっていても、酢酸はヨードホルム反応陰性（CH_3CO-のRがOH）。純粋なものは冬に凍る（融点約17℃）。',
    moves: {
      sour: { name: '酸味', intent: 'attack', effects: [{ type: 'attack', amount: 11 }, { type: 'ph', delta: -1 }] },
      dimer: { name: '二量体（水素結合）', intent: 'defend', effects: [{ type: 'block', amount: 10 }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 8 }], onWrong: [{ type: 'attack', amount: 11 }] }] },
    },
    pattern: { type: 'cycle', seq: ['sour', 'dimer', 'sour', 'quiz'] },
  },
  {
    id: 'unk_c6h6o', name: '化合物 C_6H_6O', emoji: '⬡', act: 3, tier: 'normal',
    hp: [52, 58], tags: ['acidic'], hiddenTags: ['phenol', 'benzene'],
    lore: 'ベンゼン環に-OHが直結した化合物。非常に弱い酸で、NaOHには溶けるが炭酸水素ナトリウムとは反応しない。FeCl_3で紫色、臭素水で白色沈殿。皮膚を腐食する。',
    moves: {
      corrode: { name: '皮膚の腐食', intent: 'debuff', effects: [{ type: 'attack', amount: 4 }, { type: 'status', status: 'poison', amount: 3, target: 'player' }] },
      strike: { name: '芳香の一撃', intent: 'attack', effects: [{ type: 'attack', amount: 12 }] },
      resonance: { name: '共鳴安定化', intent: 'defend', effects: [{ type: 'block', amount: 10 }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'corrode', w: 2 }, { move: 'strike', w: 3 }, { move: 'resonance', w: 1 }], noRepeat: 2 },
  },
  {
    id: 'unk_c4h10o', name: '化合物 C_4H_{10}O', emoji: '🧪', act: 3, tier: 'normal',
    hp: [54, 60], tags: [], hiddenTags: ['alcohol3'],
    lore: 'C_4H_{10}Oにはアルコール4種とエーテル3種の構造異性体がある。Naと反応するのにK_2Cr_2O_7で酸化されないなら、-OHのついた炭素にHがない第三級アルコール（2-メチル-2-プロパノール）。',
    moves: {
      steric: { name: '立体障害', intent: 'defend', effects: [{ type: 'block', amount: 12 }] },
      strike: { name: '分岐の一撃', intent: 'attack', effects: [{ type: 'attack', amount: 12 }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 8 }], onWrong: [{ type: 'attack', amount: 12 }] }] },
    },
    pattern: { type: 'cycle', seq: ['strike', 'steric', 'quiz', 'strike'] },
  },
  {
    id: 'unk_c4h8o2', name: '化合物 C_4H_8O_2', emoji: '🍎', act: 3, tier: 'normal',
    hp: [50, 56], tags: [], hiddenTags: ['ester'],
    lore: '果実のような香りの中性物質。C_4H_8O_2にはカルボン酸とエステルの異性体がある。エステルはNaHCO_3と反応せず、NaOHでけん化される。酢酸エチルのCH_3CO-O-はヨードホルム反応陰性。',
    moves: {
      fragrance: { name: '果実の香り', intent: 'debuff', effects: [{ type: 'status', status: 'weak', amount: 2, target: 'player' }, { type: 'block', amount: 4 }] },
      strike: { name: '溶剤の一撃', intent: 'attack', effects: [{ type: 'attack', amount: 11 }] },
      guard: { name: '疎水性', intent: 'defend', effects: [{ type: 'block', amount: 8 }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'fragrance', w: 1 }, { move: 'strike', w: 3 }, { move: 'guard', w: 1 }], noRepeat: 2 },
  },
  {
    id: 'unk_c3h6', name: '化合物 C_3H_6', emoji: '🔥', act: 3, tier: 'normal',
    hp: [46, 52], tags: ['gas'], hiddenTags: ['alkene'],
    lore: 'C_3H_6にはプロペン（C=Cあり）とシクロプロパン（環状・C=Cなし）がある。臭素水を脱色すればアルケン。プロペンは付加重合でポリプロピレンになる。',
    moves: {
      chain: { name: '付加の連鎖', intent: 'attack', effects: [{ type: 'attack', amount: 5, times: 2 }] },
      strike: { name: '燃焼', intent: 'attack', effects: [{ type: 'attack', amount: 10 }] },
      grow: { name: '重合', intent: 'buff', effects: [{ type: 'status', status: 'strength', amount: 2, target: 'self' }] },
    },
    pattern: { type: 'cycle', seq: ['chain', 'strike', 'grow'] },
  },
  {
    id: 'unk_c2h2', name: '化合物 C_2H_2', emoji: '💥', act: 3, tier: 'normal',
    hp: [46, 52], tags: ['gas'], hiddenTags: ['alkyne'],
    lore: '炭化カルシウムに水を加えると発生する（CaC_2 + 2H_2O → C_2H_2 + Ca(OH)_2）。三重結合に臭素が2段階で付加し、臭素水を脱色する。水が付加すると不安定なビニルアルコールを経てアセトアルデヒドになる。',
    moves: {
      flare: { name: '酸素アセチレン炎', intent: 'attack', effects: [{ type: 'attack', amount: 13 }] },
      add: { name: '付加', intent: 'buff', effects: [{ type: 'status', status: 'strength', amount: 2, target: 'self' }, { type: 'block', amount: 5 }] },
      spark: { name: '火花', intent: 'attack', effects: [{ type: 'attack', amount: 4, times: 3 }] },
    },
    pattern: { type: 'cycle', seq: ['flare', 'add', 'spark'] },
  },
  {
    id: 'unk_fat', name: '植物油', emoji: '🫒', act: 3, tier: 'normal',
    hp: [56, 62], tags: ['lipid'], hiddenTags: ['ester', 'alkene'],
    lore: '油脂はグリセリン1分子と高級脂肪酸3分子のエステル。植物油は不飽和脂肪酸（C=Cを含む）が多く常温で液体。Ni触媒でH_2を付加すると硬化油になる。けん化価・ヨウ素価で分子量や不飽和度がわかる。',
    moves: {
      slick: { name: '油膜', intent: 'defend', effects: [{ type: 'block', amount: 12 }] },
      strike: { name: '高温の油', intent: 'attack', effects: [{ type: 'attack', amount: 12 }] },
      rancid: { name: '酸敗', intent: 'debuff', effects: [{ type: 'status', status: 'poison', amount: 3, target: 'player' }] },
    },
    pattern: { type: 'cycle', seq: ['strike', 'slick', 'rancid', 'strike'] },
  },
  {
    id: 'unk_c7h6o3', name: '化合物 C_7H_6O_3', emoji: '💊', act: 3, tier: 'elite',
    hp: [150, 160], tags: ['acidic'], hiddenTags: ['phenol', 'carboxylic', 'benzene'],
    lore: 'ベンゼン環の隣り合う位置に-OHと-COOHをもつ。FeCl_3で赤紫色に呈色し、NaHCO_3でCO_2を発生する。メタノールでエステル化するとサリチル酸メチル（消炎鎮痛の湿布薬）、無水酢酸でアセチル化するとアセチルサリチル酸（解熱鎮痛剤、FeCl_3で呈色しない）。',
    moves: {
      acid: { name: '酸性', intent: 'buff', effects: [{ type: 'ph', delta: -2 }, { type: 'status', status: 'strength', amount: 2, target: 'self' }] },
      strike: { name: '強烈な一撃', intent: 'attack', effects: [{ type: 'attack', amount: 16 }] },
      chelate: { name: '分子内水素結合', intent: 'defend', effects: [{ type: 'block', amount: 16 }] },
      sting: { name: '二つの官能基', intent: 'attack', effects: [{ type: 'attack', amount: 7, times: 2 }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', field: 'organic', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 12 }], onWrong: [{ type: 'attack', amount: 14 }] }] },
    },
    pattern: { type: 'cycle', seq: ['quiz', 'acid', 'strike', 'chelate', 'quiz', 'sting'] },
  },
  {
    id: 'unk_c6h7n', name: '化合物 C_6H_7N', emoji: '🟪', act: 3, tier: 'elite',
    hp: [145, 155], tags: ['basic'], hiddenTags: ['amine_ar', 'benzene'],
    lore: '芳香族アミン。弱塩基で塩酸に塩となって溶ける。さらし粉水溶液で赤紫色、二クロム酸カリウムで黒色（アニリンブラック）。氷冷下で亜硝酸ナトリウムと塩酸を加えるとジアゾニウム塩になり、フェノキシドとカップリングしてアゾ染料になる。',
    moves: {
      strike: { name: '連打', intent: 'attack', effects: [{ type: 'attack', amount: 8, times: 2 }] },
      toxic: { name: '毒性', intent: 'debuff', effects: [{ type: 'status', status: 'poison', amount: 4, target: 'player' }, { type: 'status', status: 'frail', amount: 1, target: 'player' }] },
      darken: { name: '空気酸化（着色）', intent: 'buff', effects: [{ type: 'status', status: 'strength', amount: 2, target: 'self' }, { type: 'block', amount: 8 }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', field: 'organic', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 12 }], onWrong: [{ type: 'attack', amount: 14 }] }] },
    },
    pattern: { type: 'cycle', seq: ['strike', 'toxic', 'quiz', 'darken', 'strike', 'quiz'] },
  },
  {
    id: 'boss_c8h10o', name: '構造未決定体 C_8H_{10}O', emoji: '🧩', act: 3, tier: 'boss',
    hp: [260, 272], tags: [], hiddenTags: ['benzene', 'alcohol2', 'iodoform'],
    quizSetId: 'set-org-01', quizField: 'organic',
    lore: 'C_8H_{10}Oのベンゼン環をもつ異性体は、アルコール・フェノール類・エーテルを合わせて多数ある。Naとの反応（-OH）、FeCl_3（フェノール性-OH）、ヨードホルム反応（CH_3CH(OH)-）、酸化生成物の性質を組み合わせて1つに絞り込め。追い詰められると自ら酸化され、分子式C_8H_8Oのケトンに姿を変える。',
    moves: {
      quiz: { name: '大問', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 16 }], onWrong: [{ type: 'attack', amount: 14 }, { type: 'status', status: 'vulnerable', amount: 1, target: 'player' }] }] },
      strike: { name: '側鎖の一撃', intent: 'attack', effects: [{ type: 'attack', amount: 16 }] },
      isomer: { name: '異性体の幻影', intent: 'defend', effects: [{ type: 'block', amount: 18 }, { type: 'status', status: 'colloid', amount: 1, target: 'self' }] },
      multi: { name: '置換反応', intent: 'attack', effects: [{ type: 'attack', amount: 7, times: 3 }] },
      confuse: { name: '思い違いの誘発', intent: 'debuff', effects: [{ type: 'addCard', cardId: 'careless', to: 'draw', count: 2 }, { type: 'status', status: 'weak', amount: 1, target: 'player' }] },
      crush: { name: '確定構造の圧', intent: 'attack', effects: [{ type: 'attack', amount: 22 }] },
    },
    pattern: { type: 'cycle', seq: ['quiz', 'strike', 'isomer', 'quiz', 'multi', 'confuse'] },
    phases: [
      {
        hpBelow: 0.5, name: '自動酸化（C_8H_8O）',
        onEnter: [{ type: 'removeTag', tag: 'alcohol2' }, { type: 'addTag', tag: 'ketone' }, { type: 'status', status: 'strength', amount: 2, target: 'self' }],
        pattern: { type: 'cycle', seq: ['quiz', 'multi', 'strike', 'quiz', 'isomer', 'crush'] },
      },
    ],
  },

  // =====================================================================
  // ACT 4 高分子の層
  // =====================================================================
  {
    id: 'glucose', name: 'グルコース', formula: 'C_6H_{12}O_6', emoji: '🍬', act: 4, tier: 'normal',
    hp: [58, 64], tags: ['saccharide'], hiddenTags: ['reducing'],
    lore: '単糖。水溶液中ではα型・β型の環状構造と鎖状構造が平衡にあり、鎖状構造のホルミル基のため還元性を示す。アルコール発酵でエタノールとCO_2になる（C_6H_{12}O_6 → 2C_2H_5OH + 2CO_2）。',
    moves: {
      energy: { name: 'エネルギー源', intent: 'defend', effects: [{ type: 'heal', amount: 6 }, { type: 'block', amount: 6 }] },
      strike: { name: '糖の一撃', intent: 'attack', effects: [{ type: 'attack', amount: 12 }] },
      glycate: { name: '糖化', intent: 'debuff', effects: [{ type: 'attack', amount: 6 }, { type: 'status', status: 'weak', amount: 1, target: 'player' }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'energy', w: 1 }, { move: 'strike', w: 3 }, { move: 'glycate', w: 2 }], noRepeat: 2 },
  },
  {
    id: 'sucrose', name: 'スクロース', formula: 'C_{12}H_{22}O_{11}', emoji: '🍭', act: 4, tier: 'normal',
    hp: [62, 68], tags: ['saccharide'], hiddenTags: ['nonreducing'],
    lore: 'グルコースとフルクトースが、互いの還元性を示す部分（ヘミアセタール構造）どうしで結合した二糖。開環できないので還元性を示さない。希酸やインベルターゼで加水分解すると転化糖になり、還元性を示す。',
    moves: {
      strike: { name: '甘い一撃', intent: 'attack', effects: [{ type: 'attack', amount: 12 }] },
      crystal: { name: '結晶化', intent: 'defend', effects: [{ type: 'block', amount: 12 }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 9 }], onWrong: [{ type: 'attack', amount: 12 }] }] },
    },
    pattern: { type: 'cycle', seq: ['strike', 'crystal', 'strike', 'quiz'] },
  },
  {
    id: 'starch', name: 'デンプン', formula: '(C_6H_{10}O_5)_n', emoji: '🍚', act: 4, tier: 'normal',
    hp: [66, 72], tags: ['saccharide', 'hydrophilic_colloid'], hiddenTags: ['helix', 'nonreducing'],
    lore: 'α-グルコースが縮合重合した多糖。直鎖状のアミロースと枝分かれの多いアミロペクチンからなり、らせん構造のためヨウ素デンプン反応を示す。還元性はほとんどない。アミラーゼでマルトースに分解される。',
    moves: {
      swell: { name: '糊化', intent: 'defend', effects: [{ type: 'block', amount: 14 }] },
      strike: { name: '粘りの一撃', intent: 'attack', effects: [{ type: 'attack', amount: 13 }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 9 }], onWrong: [{ type: 'attack', amount: 12 }] }] },
    },
    pattern: { type: 'cycle', seq: ['strike', 'swell', 'quiz', 'strike'] },
  },
  {
    id: 'cellulose', name: 'セルロース', formula: '(C_6H_{10}O_5)_n', emoji: '🌿', act: 4, tier: 'normal',
    hp: [70, 76], tags: ['saccharide'], hiddenTags: ['nonreducing'],
    lore: 'β-グルコースが直線状に縮合重合した多糖。鎖どうしが水素結合で束になり、丈夫な繊維になる。らせんをつくらないのでヨウ素デンプン反応を示さず、アミラーゼでは分解されない。シュバイツァー試薬に溶ける。',
    moves: {
      fiber: { name: '繊維の束（水素結合）', intent: 'defend', effects: [{ type: 'block', amount: 15 }] },
      strike: { name: '繊維の鞭', intent: 'attack', effects: [{ type: 'attack', amount: 14 }] },
      tangle: { name: '絡みつく', intent: 'debuff', effects: [{ type: 'attack', amount: 6 }, { type: 'status', status: 'frail', amount: 2, target: 'player' }] },
    },
    pattern: { type: 'cycle', seq: ['strike', 'fiber', 'tangle'] },
  },
  {
    id: 'glycine', name: 'グリシン', formula: 'H_2N-CH_2-COOH', emoji: '🔹', act: 4, tier: 'normal',
    hp: [56, 62], tags: ['aminoacid', 'amino'], pI: 6.0,
    lore: '最も単純なα-アミノ酸（側鎖がH）。不斉炭素をもたないので鏡像異性体がない。等電点は約6.0で、このpHでは双性イオンH_3N^+-CH_2-COO^-として正味の電荷が0になり、電気泳動で移動しない。',
    moves: {
      zwitter: { name: '双性イオン', intent: 'defend', effects: [{ type: 'block', amount: 10 }] },
      strike: { name: '単純な一撃', intent: 'attack', effects: [{ type: 'attack', amount: 12 }] },
      chelate: { name: 'キレート', intent: 'debuff', effects: [{ type: 'attack', amount: 6 }, { type: 'status', status: 'weak', amount: 1, target: 'player' }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'zwitter', w: 1 }, { move: 'strike', w: 3 }, { move: 'chelate', w: 2 }], noRepeat: 2 },
  },
  {
    id: 'glutamic_acid', name: 'グルタミン酸', emoji: '🔸', act: 4, tier: 'normal',
    hp: [58, 64], tags: ['aminoacid', 'amino', 'acidic'], pI: 3.2,
    lore: '側鎖にもカルボキシ基をもつ酸性アミノ酸。等電点は約3.2と低く、中性の水溶液中では正味で負に帯電して陽極側へ移動する。ナトリウム塩はうま味調味料。',
    moves: {
      strike: { name: 'うま味', intent: 'attack', effects: [{ type: 'attack', amount: 13 }] },
      acid: { name: '酸性側鎖', intent: 'defend', effects: [{ type: 'block', amount: 8 }, { type: 'ph', delta: -1 }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 9 }], onWrong: [{ type: 'attack', amount: 12 }] }] },
    },
    pattern: { type: 'cycle', seq: ['strike', 'acid', 'strike', 'quiz'] },
  },
  {
    id: 'lysine', name: 'リシン', emoji: '🔷', act: 4, tier: 'normal',
    hp: [58, 64], tags: ['aminoacid', 'amino', 'basic'], pI: 9.7,
    lore: '側鎖にもアミノ基をもつ塩基性アミノ酸。等電点は約9.7と高く、中性の水溶液中では正味で正に帯電して陰極側へ移動する。ヒトが体内で合成できない必須アミノ酸の一つ。',
    moves: {
      strike: { name: '塩基性の一撃', intent: 'attack', effects: [{ type: 'attack', amount: 13 }] },
      base: { name: '塩基性側鎖', intent: 'defend', effects: [{ type: 'block', amount: 8 }, { type: 'ph', delta: 1 }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 9 }], onWrong: [{ type: 'attack', amount: 12 }] }] },
    },
    pattern: { type: 'cycle', seq: ['strike', 'base', 'strike', 'quiz'] },
  },
  {
    id: 'cysteine', name: 'システイン', emoji: '🟡', act: 4, tier: 'normal',
    hp: [56, 62], tags: ['aminoacid', 'amino'], hiddenTags: ['sulfur'], pI: 5.1,
    lore: '側鎖に-SHをもつ含硫アミノ酸。2分子の-SHが酸化されるとジスルフィド結合-S-S-でつながり、タンパク質の立体構造を固定する。NaOHで加熱し酢酸鉛(II)を加えると黒色PbSが沈殿する。等電点は約5.1。',
    moves: {
      disulfide: { name: 'ジスルフィド結合', intent: 'buff', effects: [{ type: 'block', amount: 12 }, { type: 'status', status: 'strength', amount: 1, target: 'self' }] },
      strike: { name: '硫黄の一撃', intent: 'attack', effects: [{ type: 'attack', amount: 12 }] },
      smell: { name: '硫黄臭', intent: 'debuff', effects: [{ type: 'attack', amount: 5 }, { type: 'status', status: 'weak', amount: 1, target: 'player' }] },
    },
    pattern: { type: 'cycle', seq: ['strike', 'disulfide', 'smell', 'strike'] },
  },
  {
    id: 'phenylalanine', name: 'フェニルアラニン', emoji: '🟢', act: 4, tier: 'normal',
    hp: [58, 64], tags: ['aminoacid', 'amino'], hiddenTags: ['benzene'], pI: 5.5,
    lore: '側鎖にベンゼン環をもつ芳香族アミノ酸。濃硝酸でベンゼン環がニトロ化され黄色になる（キサントプロテイン反応）。等電点は約5.5。必須アミノ酸の一つ。',
    moves: {
      strike: { name: '芳香族の一撃', intent: 'attack', effects: [{ type: 'attack', amount: 13 }] },
      hydrophobic: { name: '疎水性側鎖', intent: 'defend', effects: [{ type: 'block', amount: 10 }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 9 }], onWrong: [{ type: 'attack', amount: 12 }] }] },
    },
    pattern: { type: 'weighted', table: [{ move: 'strike', w: 3 }, { move: 'hydrophobic', w: 1 }, { move: 'quiz', w: 1 }], noRepeat: 2 },
  },
  {
    id: 'tripeptide', name: 'トリペプチド', emoji: '🔗', act: 4, tier: 'normal',
    hp: [62, 68], tags: ['peptide', 'amino'], hiddenTags: ['polypeptide', 'benzene'],
    lore: '3つのアミノ酸がペプチド結合2つでつながった分子。ペプチド結合を2つ以上もつので、ビウレット反応が陽性になる（ジペプチドは陰性）。3種類のアミノ酸からなるトリペプチドの配列は3! = 6通り。',
    moves: {
      strike: { name: '連結', intent: 'attack', effects: [{ type: 'attack', amount: 7, times: 2 }] },
      fold: { name: '折りたたみ', intent: 'defend', effects: [{ type: 'block', amount: 10 }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 9 }], onWrong: [{ type: 'attack', amount: 12 }] }] },
    },
    pattern: { type: 'cycle', seq: ['strike', 'fold', 'quiz', 'strike'] },
  },
  {
    id: 'nylon66', name: 'ナイロン66', emoji: '🧵', act: 4, tier: 'normal',
    hp: [66, 72], tags: ['polyamide', 'thermoplastic'], hiddenTags: ['amide'],
    lore: 'アジピン酸とヘキサメチレンジアミンの縮合重合でできるポリアミド。分子間のアミド結合どうしが水素結合し、強くしなやかな繊維になる。世界初の合成繊維の一つ。',
    moves: {
      tough: { name: '強靭な繊維', intent: 'defend', effects: [{ type: 'block', amount: 14 }] },
      strike: { name: '引張', intent: 'attack', effects: [{ type: 'attack', amount: 14 }] },
      spin: { name: '溶融紡糸', intent: 'attack', effects: [{ type: 'attack', amount: 6, times: 2 }] },
    },
    pattern: { type: 'cycle', seq: ['strike', 'tough', 'spin'] },
  },
  {
    id: 'pet', name: 'ポリエチレンテレフタラート', formula: 'PET', emoji: '🍼', act: 4, tier: 'normal',
    hp: [66, 72], tags: ['polyester', 'thermoplastic'], hiddenTags: ['ester', 'benzene'],
    lore: 'テレフタル酸とエチレングリコールの縮合重合でできるポリエステル。ペットボトルや衣料用繊維に使われる。エステル結合をもつので、塩基で加水分解できる（ケミカルリサイクル）。',
    moves: {
      strike: { name: 'ボトルの一撃', intent: 'attack', effects: [{ type: 'attack', amount: 14 }] },
      guard: { name: '耐薬品性', intent: 'defend', effects: [{ type: 'block', amount: 12 }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 9 }], onWrong: [{ type: 'attack', amount: 12 }] }] },
    },
    pattern: { type: 'cycle', seq: ['strike', 'guard', 'strike', 'quiz'] },
  },
  {
    id: 'minion_substrate', name: '基質（デンプン断片）', emoji: '🔸', act: 4, tier: 'minion',
    hp: [16, 20], tags: ['saccharide'], hiddenTags: ['helix', 'nonreducing'],
    lore: '酵素の活性部位に結合する物質（基質）。酵素は特定の基質にしかはたらかない（基質特異性）。',
    moves: {
      strike: { name: '結合', intent: 'attack', effects: [{ type: 'attack', amount: 5 }] },
      guard: { name: '基質の盾', intent: 'defend', effects: [{ type: 'block', amount: 5 }] },
    },
    pattern: { type: 'cycle', seq: ['strike', 'guard'] },
  },
  {
    id: 'albumin', name: '卵白アルブミン', emoji: '🥚', act: 4, tier: 'elite',
    hp: [170, 180], tags: ['protein', 'hydrophilic_colloid', 'amino'], hiddenTags: ['polypeptide', 'benzene', 'sulfur'], pI: 4.6,
    lore: '卵白に含まれる球状タンパク質（等電点約4.6）。水溶液は親水コロイドで、多量の硫酸アンモニウムで塩析する。加熱すると変性して固まり、元に戻らない。ビウレット反応・キサントプロテイン反応・硫黄の検出がすべて陽性。',
    moves: {
      fold: { name: '高次構造', intent: 'defend', effects: [{ type: 'block', amount: 18 }] },
      strike: { name: '凝固の一撃', intent: 'attack', effects: [{ type: 'attack', amount: 16 }] },
      protect: { name: '保護コロイド', intent: 'buff', effects: [{ type: 'status', status: 'colloid', amount: 2, target: 'self' }, { type: 'status', status: 'strength', amount: 2, target: 'self' }] },
      multi: { name: 'ペプチド鎖', intent: 'attack', effects: [{ type: 'attack', amount: 6, times: 3 }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', field: 'polymer', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 14 }], onWrong: [{ type: 'attack', amount: 15 }] }] },
    },
    pattern: { type: 'cycle', seq: ['quiz', 'strike', 'fold', 'quiz', 'protect', 'multi'] },
  },
  {
    id: 'vulcanized_rubber', name: '加硫ゴム', emoji: '⚫', act: 4, tier: 'elite',
    hp: [165, 175], tags: ['rubber'], hiddenTags: ['sulfur', 'alkene'],
    lore: '天然ゴム（ポリイソプレン、シス形）に硫黄を加えて加熱し、鎖どうしを架橋したもの。弾性・強度・耐久性が増す。C=Cが残っているので空気中のO_3などで劣化する。',
    moves: {
      elastic: { name: '弾性', intent: 'buff', effects: [{ type: 'status', status: 'thorns', amount: 3, target: 'self' }, { type: 'block', amount: 12 }] },
      bounce: { name: '反発', intent: 'attack', effects: [{ type: 'attack', amount: 7, times: 3 }] },
      snap: { name: '引きちぎり', intent: 'attack', effects: [{ type: 'attack', amount: 18 }] },
      quiz: { name: '出題', intent: 'quiz', effects: [{ type: 'quiz', field: 'polymer', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 14 }], onWrong: [{ type: 'attack', amount: 15 }] }] },
    },
    pattern: { type: 'cycle', seq: ['elastic', 'bounce', 'quiz', 'snap', 'bounce', 'quiz'] },
  },
  {
    id: 'boss_enzyme', name: '巨大酵素オプティマ', emoji: '🧬', act: 4, tier: 'boss',
    hp: [320, 330], tags: ['protein', 'enzyme', 'hydrophilic_colloid', 'amino'], hiddenTags: ['polypeptide', 'benzene'],
    quizSetId: 'set-pol-01', quizField: 'polymer',
    phRules: [
      { min: 6, max: 8, takenMult: 0.75, dealtMult: 1.25, note: '最適pH付近で最も活性が高い（被ダメージ0.75倍・与ダメージ1.25倍）' },
      { max: 3, takenMult: 1.4, note: '強酸性で変性しかける（被ダメージ1.4倍）' },
      { min: 11, takenMult: 1.4, note: '強塩基性で変性しかける（被ダメージ1.4倍）' },
    ],
    lore: 'タンパク質でできた触媒（酵素）。基質特異性をもち、最適温度（35〜40℃付近）・最適pHでよくはたらく。中性付近の最適pHをもつこの酵素は、生体の緩衝作用でpHを7に戻そうとする。熱や強酸・強塩基で高次構造が壊れると失活する。',
    moves: {
      quiz: { name: '大問', intent: 'quiz', effects: [{ type: 'quiz', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 18 }], onWrong: [{ type: 'attack', amount: 15 }, { type: 'status', status: 'frail', amount: 2, target: 'player' }] }] },
      hydrolyze: { name: '加水分解', intent: 'attack', effects: [{ type: 'attack', amount: 9, times: 2 }] },
      homeostasis: { name: '生体の緩衝作用', intent: 'defend', effects: [{ type: 'phSet', value: 7 }, { type: 'block', amount: 16 }] },
      catalyze: { name: '触媒作用', intent: 'buff', effects: [{ type: 'status', status: 'strength', amount: 3, target: 'self' }] },
      crush: { name: '活性部位の締めつけ', intent: 'attack', effects: [{ type: 'attack', amount: 24 }] },
      substrate: { name: '基質の取り込み', intent: 'special', effects: [{ type: 'summon', enemyId: 'minion_substrate' }, { type: 'block', amount: 8 }] },
      refold: { name: '再折りたたみ', intent: 'defend', effects: [{ type: 'heal', amount: 18 }, { type: 'block', amount: 10 }] },
    },
    pattern: { type: 'cycle', seq: ['quiz', 'hydrolyze', 'homeostasis', 'quiz', 'catalyze', 'crush', 'substrate'] },
    phases: [
      {
        hpBelow: 0.5, name: '活性部位の暴走',
        onEnter: [{ type: 'status', status: 'strength', amount: 2, target: 'self' }, { type: 'status', status: 'colloid', amount: 2, target: 'self' }],
        pattern: { type: 'cycle', seq: ['quiz', 'crush', 'homeostasis', 'hydrolyze', 'quiz', 'refold', 'substrate'] },
      },
    ],
  },

  // =====================================================================
  // ACT 5 二次試験当日
  // =====================================================================
  {
    id: 'final_exam', name: '二次試験本番', emoji: '📝', act: 5, tier: 'boss',
    hp: [450, 460], tags: [],
    quizField: 'theory1',
    lore: '京都大学 個別試験「化学」。大問4題、長いリード文の中から条件を拾い、知識を論理的に組み合わせる力が問われる。ここまでの層で積み上げた反応と計算のすべてが試される。十分に眠ってから挑むこと。',
    moves: {
      q_th1: { name: '大問1（構造と状態）', intent: 'quiz', effects: [{ type: 'quiz', field: 'theory1', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 18 }], onWrong: [{ type: 'attack', amount: 14 }, { type: 'status', status: 'frail', amount: 2, target: 'player' }] }] },
      q_th2: { name: '大問2（平衡と変化）', intent: 'quiz', effects: [{ type: 'quiz', field: 'theory2', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 18 }], onWrong: [{ type: 'attack', amount: 14 }, { type: 'status', status: 'vulnerable', amount: 2, target: 'player' }] }] },
      q_ino: { name: '小問（無機）', intent: 'quiz', effects: [{ type: 'quiz', field: 'inorganic', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 14 }], onWrong: [{ type: 'attack', amount: 12 }] }] },
      q_org: { name: '大問3（有機）', intent: 'quiz', effects: [{ type: 'quiz', field: 'organic', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 18 }], onWrong: [{ type: 'attack', amount: 15 }, { type: 'status', status: 'weak', amount: 2, target: 'player' }] }] },
      q_pol: { name: '大問4（高分子）', intent: 'quiz', effects: [{ type: 'quiz', field: 'polymer', onCorrect: [{ type: 'status', status: 'weak', amount: 2, target: 'self' }, { type: 'loseHp', amount: 18 }], onWrong: [{ type: 'attack', amount: 15 }, { type: 'status', status: 'frail', amount: 2, target: 'player' }] }] },
      time: { name: '残り時間の圧迫', intent: 'attack', effects: [{ type: 'attack', amount: 6, times: 3 }] },
      nerves: { name: '緊張', intent: 'debuff', effects: [{ type: 'addCard', cardId: 'careless', to: 'draw', count: 2 }, { type: 'status', status: 'weak', amount: 1, target: 'player' }] },
      hard: { name: '難問', intent: 'attack', effects: [{ type: 'attack', amount: 24 }] },
      focus: { name: '試験官の視線', intent: 'buff', effects: [{ type: 'status', status: 'strength', amount: 3, target: 'self' }, { type: 'block', amount: 12 }] },
      lead: { name: '長いリード文', intent: 'defend', effects: [{ type: 'block', amount: 22 }] },
    },
    pattern: { type: 'cycle', seq: ['q_th1', 'time', 'q_th1', 'nerves', 'hard'] },
    phases: [
      {
        hpBelow: 0.75, name: '大問2: 平衡と変化', quizField: 'theory2',
        onEnter: [{ type: 'block', amount: 15 }, { type: 'addTag', tag: 'equilibrium' }],
        pattern: { type: 'cycle', seq: ['q_th2', 'time', 'q_ino', 'focus', 'q_th2', 'hard'] },
      },
      {
        hpBelow: 0.5, name: '大問3: 有機の構造決定', quizField: 'organic',
        onEnter: [{ type: 'status', status: 'strength', amount: 2, target: 'self' }, { type: 'addTag', tag: 'benzene' }, { type: 'addTag', tag: 'ester' }],
        pattern: { type: 'cycle', seq: ['q_org', 'hard', 'q_org', 'nerves', 'time', 'lead'] },
      },
      {
        hpBelow: 0.25, name: '大問4: 高分子', quizField: 'polymer',
        onEnter: [{ type: 'status', status: 'strength', amount: 2, target: 'self' }, { type: 'addTag', tag: 'protein' }, { type: 'addTag', tag: 'polypeptide' }],
        pattern: { type: 'cycle', seq: ['q_pol', 'time', 'q_pol', 'hard', 'lead'] },
      },
    ],
  },
];
