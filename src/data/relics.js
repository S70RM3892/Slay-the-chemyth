// 実験器具（レリック）。データのみ。
// レリック効果の対象: block/heal/energy/draw はプレイヤー、status の target:'self' はプレイヤー、
// target:'all' は敵全体、damage の target:'random'|'all' は敵。

export const STARTER_RELIC = 'lab_notebook';

export const RELICS = [
  // ---------------- starter ----------------
  {
    id: 'lab_notebook', name: '実験ノート', emoji: '📓', rarity: 'starter',
    text: '戦闘終了時、HPを5回復する。',
    chem: '実験は日付・条件・観察事実をその場で記録する。記録が残っていれば、失敗からも学べる。',
    triggers: [{ trigger: 'combatEnd', effects: [{ type: 'heal', amount: 5 }] }],
  },

  // ---------------- common ----------------
  {
    id: 'beaker', name: 'ビーカー', emoji: '🥛', rarity: 'common',
    text: '戦闘開始時、緩衝3を得る。',
    chem: 'ビーカーの目盛りはおおよその目安。正確な体積はメスシリンダーやホールピペットで量る。',
    triggers: [{ trigger: 'combatStart', effects: [{ type: 'status', status: 'buffer', amount: 3, target: 'self' }] }],
  },
  {
    id: 'whole_pipette', name: 'ホールピペット', emoji: '💉', rarity: 'common',
    text: '戦闘開始時、濃度1を得る。',
    chem: '一定体積の溶液を正確にはかり取る器具。内部が水でぬれているときは、使う溶液で数回すすいでから（共洗い）使う。',
    triggers: [{ trigger: 'combatStart', effects: [{ type: 'status', status: 'strength', amount: 1, target: 'self' }] }],
  },
  {
    id: 'glass_rod', name: 'ガラス棒', emoji: '🥢', rarity: 'common',
    text: '攻撃カードを3枚使うたび、ランダムな敵に4ダメージ。',
    chem: 'かき混ぜるとき、液を注ぐときに使う。ろ過では液をガラス棒に伝わらせて注ぐ。',
    triggers: [{ trigger: 'onCardPlayed', every: 3, filter: { cardType: 'attack' }, effects: [{ type: 'damage', amount: 4, target: 'random' }] }],
  },
  {
    id: 'funnel', name: 'ろうと', emoji: '🔻', rarity: 'common',
    text: '反応が3回成立するたび、ブロック5を得る。',
    chem: 'ろ紙を四つ折りにしてろうとにはめ、水でぬらして密着させる。ろうとの足はビーカーの内壁につける。',
    triggers: [{ trigger: 'onReaction', every: 3, effects: [{ type: 'block', amount: 5 }] }],
  },
  {
    id: 'test_tube_rack', name: '試験管立て', emoji: '🧪', rarity: 'common',
    text: '戦闘開始時、2枚引く。',
    chem: '複数の試料に同じ試薬を加えて比べる「対照実験」では、試験管を並べて同時に観察する。',
    triggers: [{ trigger: 'combatStart', effects: [{ type: 'draw', amount: 2 }] }],
  },
  {
    id: 'litmus_paper', name: 'リトマス紙', emoji: '📜', rarity: 'common',
    text: 'pHが3回変化するたび、1枚引く。',
    chem: '酸性で青→赤、塩基性で赤→青。変色域はおよそpH 4.5〜8.3で、大まかな酸・塩基の判定に使う。',
    triggers: [{ trigger: 'onPhChange', every: 3, effects: [{ type: 'draw', amount: 1 }] }],
  },
  {
    id: 'gas_burner', name: 'ガスバーナー', emoji: '🔥', rarity: 'common',
    text: '戦闘開始時、敵全体に活性化1。',
    chem: '点火はガス調節ねじ→空気調節ねじの順。空気が足りない赤い炎（不完全燃焼）を、空気を入れて青い炎にする。',
    triggers: [{ trigger: 'combatStart', effects: [{ type: 'status', status: 'vulnerable', amount: 1, target: 'all' }] }],
  },
  {
    id: 'wash_bottle', name: '洗浄瓶', emoji: '🧴', rarity: 'common',
    text: '自習室で休憩するとき、さらにHPを12回復する。',
    chem: '純水を少しずつ出して器具を洗う。最後に純水ですすぐと、水道水由来のイオンが残らない。',
    triggers: [{ trigger: 'onRest', effects: [{ type: 'heal', amount: 12 }] }],
  },
  {
    id: 'watch_glass', name: '時計皿', emoji: '🍽️', rarity: 'common',
    text: '敵を倒すたび、HPを3回復する。',
    chem: '少量の試料を乾燥させたり、ビーカーのふたにしたりする。',
    triggers: [{ trigger: 'onEnemyDeath', effects: [{ type: 'heal', amount: 3 }] }],
  },
  {
    id: 'safety_gloves', name: '保護手袋', emoji: '🧤', rarity: 'common',
    text: '戦闘開始時、保護コロイド1を得る（最初のデバフを1回無効化）。',
    chem: '腐食性の試薬（濃酸・濃塩基・フェノールなど）を扱うときに着用する。',
    triggers: [{ trigger: 'combatStart', effects: [{ type: 'status', status: 'colloid', amount: 1, target: 'self' }] }],
  },
  {
    id: 'spatula', name: '薬さじ', emoji: '🥄', rarity: 'common',
    text: '購買部に入るたび、研究費を15得る。',
    chem: '固体試薬は薬さじで必要量だけ取り出す。取りすぎた試薬を元の瓶に戻してはいけない（汚染の原因）。',
    triggers: [{ trigger: 'onShopEnter', effects: [{ type: 'gold', amount: 15 }] }],
  },

  // ---------------- uncommon ----------------
  {
    id: 'erlenmeyer', name: '三角フラスコ', emoji: '⚗️', rarity: 'uncommon',
    text: '問題に正解するたび、エネルギー+1。',
    chem: '口が細く振り混ぜても液がこぼれにくい。中和滴定ではコニカルビーカーとともに受け器として使う。',
    triggers: [{ trigger: 'onQuizCorrect', effects: [{ type: 'energy', amount: 1 }] }],
  },
  {
    id: 'separatory_funnel', name: '分液漏斗', emoji: '🍐', rarity: 'uncommon',
    text: '反応が2回成立するたび、1枚引く。',
    chem: '混ざり合わない2液を分ける。下層は下のコックから、上層は上の口から取り出す。',
    triggers: [{ trigger: 'onReaction', every: 2, effects: [{ type: 'draw', amount: 1 }] }],
  },
  {
    id: 'liebig_condenser', name: 'リービッヒ冷却器', emoji: '🌀', rarity: 'uncommon',
    text: 'ターン終了時、ブロック3を得る。',
    chem: '蒸留で蒸気を冷やして液体に戻す。冷却水は下から入れて上から出す（管内を水で満たすため）。',
    triggers: [{ trigger: 'turnEnd', effects: [{ type: 'block', amount: 3 }] }],
  },
  {
    id: 'kipp_apparatus', name: 'キップの装置', emoji: '🫙', rarity: 'uncommon',
    text: '3ターンごとに、ターン開始時エネルギー+1。',
    chem: '固体と液体から気体を発生させる装置（例: FeS + H_2SO_4 → FeSO_4 + H_2S）。コックを閉じると液が押し戻されて反応が止まる。',
    triggers: [{ trigger: 'turnStart', every: 3, effects: [{ type: 'energy', amount: 1 }] }],
  },
  {
    id: 'pt_wire', name: '白金線', emoji: '🪡', rarity: 'uncommon',
    text: '戦闘開始時、敵全体の隠れた性質を1つずつ公開する。',
    chem: '炎色反応に使う。白金はそれ自身が炎に色をつけず、高温でも酸化されにくい。使う前に濃塩酸で洗って焼く。',
    triggers: [{ trigger: 'combatStart', effects: [{ type: 'reveal', count: 1, target: 'all' }] }],
  },
  {
    id: 'crucible', name: 'るつぼ', emoji: '🏺', rarity: 'uncommon',
    text: 'カードが廃棄されるたび、ブロック4を得る。',
    chem: '固体を強熱するための耐熱容器。熱いうちはるつぼばさみで扱い、デシケーター中で冷ます。',
    triggers: [{ trigger: 'onExhaust', effects: [{ type: 'block', amount: 4 }] }],
  },
  {
    id: 'centrifuge', name: '遠心分離機', emoji: '🌪️', rarity: 'uncommon',
    text: 'カードが不発になるたび、1枚引きブロック3を得る。',
    chem: '沈殿を素早く沈めて分離する。陰性の結果も「その成分がない」という重要な情報になる。',
    triggers: [{ trigger: 'onFizzle', effects: [{ type: 'draw', amount: 1 }, { type: 'block', amount: 3 }] }],
  },
  {
    id: 'salt_bridge', name: '塩橋', emoji: '🌉', rarity: 'uncommon',
    text: 'pHが2回変化するたび、ブロック3を得る。',
    chem: 'KClなどの電解質を寒天で固めたもの。電池の2つの電解液をつなぎ、イオンを移動させて電荷のかたよりを防ぐ。',
    triggers: [{ trigger: 'onPhChange', every: 2, effects: [{ type: 'block', amount: 3 }] }],
  },
  {
    id: 'desiccator', name: 'デシケーター', emoji: '🫧', rarity: 'uncommon',
    text: '戦闘開始時、励起1を得る（最初のターンのエネルギー+1）。',
    chem: '乾燥剤（シリカゲル・塩化カルシウムなど）を入れた密閉容器。吸湿性の試料を保存・放冷する。',
    triggers: [{ trigger: 'combatStart', effects: [{ type: 'status', status: 'excited', amount: 1, target: 'self' }] }],
  },
  {
    id: 'voltmeter', name: '電圧計', emoji: '📟', rarity: 'uncommon',
    text: '問題に誤答するたび、緩衝2を得て1枚引く。',
    chem: '起電力の測定値がおかしいときは、配線（つなぐ向き）を確認する。誤りは原因がわかれば次に生かせる。',
    triggers: [{ trigger: 'onQuizWrong', effects: [{ type: 'status', status: 'buffer', amount: 2, target: 'self' }, { type: 'draw', amount: 1 }] }],
  },
  {
    id: 'ph_meter', name: 'pHメーター', emoji: '📏', rarity: 'uncommon',
    text: 'pHが変化するたび、敵全体に1ダメージ。',
    chem: 'ガラス電極の電位差からpHを測る。使う前に標準緩衝液（pH 4・7・9など）で校正する。',
    triggers: [{ trigger: 'onPhChange', effects: [{ type: 'damage', amount: 1, target: 'all' }] }],
  },

  // ---------------- rare ----------------
  {
    id: 'elemental_analyzer', name: '元素分析装置', emoji: '🔬', rarity: 'rare',
    text: '戦闘開始時、敵全体の隠れた性質を2つずつ公開する。',
    chem: '燃焼管→塩化カルシウム管（H_2O吸収）→ソーダ石灰管（CO_2吸収）の順につなぐ。',
    triggers: [{ trigger: 'combatStart', effects: [{ type: 'reveal', count: 2, target: 'all' }] }],
  },
  {
    id: 'autoclave', name: 'オートクレーブ', emoji: '♨️', rarity: 'rare',
    text: '戦闘開始時、濃度2を得る。',
    chem: '高温高圧の飽和水蒸気で滅菌する装置。密閉容器では水の沸点が100℃より高くなる（約121℃で使う）。',
    triggers: [{ trigger: 'combatStart', effects: [{ type: 'status', status: 'strength', amount: 2, target: 'self' }] }],
  },
  {
    id: 'calorimeter', name: '断熱容器（熱量計）', emoji: '🫖', rarity: 'rare',
    text: '戦闘開始時、発熱3を得る。',
    chem: '断熱容器内の温度変化から反応熱を求める。グラフの外挿で、熱の逃げを補正した最高温度を読み取る。',
    triggers: [{ trigger: 'combatStart', effects: [{ type: 'status', status: 'thorns', amount: 3, target: 'self' }] }],
  },
  {
    id: 'electrolytic_cell', name: '電解槽', emoji: '🔋', rarity: 'rare',
    text: '反応が4回成立するたび、エネルギー+1。',
    chem: 'イオン交換膜法ではNaCl水溶液を電気分解して、陰極側でNaOH、陽極でCl_2を得る。',
    triggers: [{ trigger: 'onReaction', every: 4, effects: [{ type: 'energy', amount: 1 }] }],
  },
  {
    id: 'spectroscope', name: '分光器', emoji: '🌈', rarity: 'rare',
    text: '反応が2回成立するたび、敵全体に活性化1。',
    chem: '炎色反応の光をプリズムや回折格子で分けると、元素ごとに固有の輝線が見える。',
    triggers: [{ trigger: 'onReaction', every: 2, effects: [{ type: 'status', status: 'vulnerable', amount: 1, target: 'all' }] }],
  },
  {
    id: 'burette', name: 'ビュレット', emoji: '📐', rarity: 'rare',
    text: '問題に正解するたび、敵全体に5ダメージ。',
    chem: '滴下した体積を0.01 mL単位まで読む。目盛りは液面のへこみの底を真横から読む。',
    triggers: [{ trigger: 'onQuizCorrect', effects: [{ type: 'damage', amount: 5, target: 'all' }] }],
  },
  {
    id: 'mortar', name: '乳鉢と乳棒', emoji: '🥣', rarity: 'rare',
    text: '戦闘開始時、安定化1を得る。',
    chem: '固体をすりつぶして粒を細かくすると表面積が増え、溶解や反応が速くなる。',
    triggers: [{ trigger: 'combatStart', effects: [{ type: 'status', status: 'dexterity', amount: 1, target: 'self' }] }],
  },

  // ---------------- boss ----------------
  {
    id: 'pt_catalyst', name: '白金触媒', emoji: '⚪', rarity: 'boss',
    text: '毎ターン開始時、触媒1を得る（そのターン最初に使うカードのコスト−1）。',
    chem: '白金は多くの反応の触媒になる（オストワルト法のNH_3の酸化、燃料電池の電極など）。',
    triggers: [{ trigger: 'turnStart', effects: [{ type: 'status', status: 'catalyst', amount: 1, target: 'self' }] }],
  },
  {
    id: 'reflux_condenser', name: '還流冷却器', emoji: '🔁', rarity: 'boss',
    text: '毎ターン開始時、エネルギー+1。戦闘開始時、山札に「ケアレスミス」を2枚混ぜる。',
    chem: '加熱で蒸発した成分を冷やしてフラスコに戻し、長時間加熱し続けられる。',
    triggers: [
      { trigger: 'turnStart', effects: [{ type: 'energy', amount: 1 }] },
      { trigger: 'combatStart', effects: [{ type: 'addCard', cardId: 'careless', to: 'draw', count: 2 }] },
    ],
  },
  {
    id: 'draft_chamber', name: 'ドラフトチャンバー', emoji: '🌬️', rarity: 'boss',
    text: '毎ターン開始時、エネルギー+1。取得時、最大HP−8。',
    chem: '有毒・悪臭の気体が出る実験はドラフト内で行い、排気する。H_2S・Cl_2・NO_2などの発生実験に必須。',
    triggers: [
      { trigger: 'turnStart', effects: [{ type: 'energy', amount: 1 }] },
      { trigger: 'onPickup', effects: [{ type: 'maxHp', amount: -8 }] },
    ],
  },
  {
    id: 'dewar_flask', name: 'デュワー瓶', emoji: '🧯', rarity: 'boss',
    text: '毎ターン開始時、エネルギー+1。戦闘開始時、不安定2を受ける。',
    chem: '二重壁の間を真空にした断熱容器。液体窒素の保存に使う。',
    triggers: [
      { trigger: 'turnStart', effects: [{ type: 'energy', amount: 1 }] },
      { trigger: 'combatStart', effects: [{ type: 'status', status: 'frail', amount: 2, target: 'self' }] },
    ],
  },

  // ---------------- shop ----------------
  {
    id: 'alarm_clock', name: '目覚まし時計', emoji: '⏰', rarity: 'shop',
    text: '自習室で休憩するたび、さらにHPを10回復し最大HP+2。',
    chem: '起きる時刻を固定すると睡眠のリズムが整う。記憶の定着は睡眠中に進む。',
    triggers: [{ trigger: 'onRest', effects: [{ type: 'heal', amount: 10 }, { type: 'maxHp', amount: 2 }] }],
  },
  {
    id: 'lab_coat', name: '白衣', emoji: '🥼', rarity: 'shop',
    text: '取得時、最大HP+10。',
    chem: '試薬の飛散から体と衣服を守る。綿製は燃えにくく、化学繊維は溶けて皮膚に付着しやすい。',
    triggers: [{ trigger: 'onPickup', effects: [{ type: 'maxHp', amount: 10 }] }],
  },
  {
    id: 'safety_goggles', name: '保護メガネ', emoji: '🥽', rarity: 'shop',
    text: '戦闘開始時、保護コロイド2を得る。',
    chem: '実験中は必ず着用する。薬品が目に入ったら、すぐに多量の流水で洗い続ける。',
    triggers: [{ trigger: 'combatStart', effects: [{ type: 'status', status: 'colloid', amount: 2, target: 'self' }] }],
  },
  {
    id: 'periodic_table', name: '周期表', emoji: '🗂️', rarity: 'shop',
    text: '問題に正解するたび、HPを3回復する。',
    chem: '元素を原子番号順に並べ、性質の似た元素が縦（族）にそろう。周期表の位置から性質を推測できる。',
    triggers: [{ trigger: 'onQuizCorrect', effects: [{ type: 'heal', amount: 3 }] }],
  },
];
