// イベント（演習室・実験室での出来事）。データのみ。
// quiz 付きの選択肢は onCorrect / onWrong を実行し、result を表示する。

export const EVENTS = [
  {
    id: 'midnight_lab', name: '午前2時の実験室',
    text: 'レポートの考察を書いていたら、時計の針は午前2時を回っていた。あと少しで何か掴めそうな気もする。',
    choices: [
      { label: '帰って寝る（HP20回復・最大HP+3）', effects: [{ type: 'heal', amount: 20 }, { type: 'maxHp', amount: 3 }],
        result: '布団に入った。翌朝、昨日の考察の穴がはっきり見えた。記憶の整理と定着は睡眠中に進む。' },
      { label: '朝まで粘る（カード1枚獲得・「思い込み」1枚・HP−6）', effects: [{ type: 'gainCard', rarity: 'uncommon' }, { type: 'gainCard', cardId: 'misconception' }, { type: 'loseHp', amount: 6 }],
        result: '朝日の中で書き上げた考察には、自信満々の勘違いが一つ紛れ込んでいた。' },
    ],
  },
  {
    id: 'power_nap', name: '15分の仮眠',
    text: '昼食後、問題集を開いたが文字が頭に入ってこない。机に突っ伏せば15分は眠れそうだ。',
    choices: [
      { label: '仮眠をとる（HP10回復・カード1枚強化）', effects: [{ type: 'heal', amount: 10 }, { type: 'upgradeCard', count: 1, choose: true }],
        result: '短い仮眠で頭がすっきりした。午後の演習ははかどった。' },
      { label: 'そのまま問題を解く（出題）', quiz: { level: 2 }, onCorrect: [{ type: 'gold', amount: 40 }], onWrong: [{ type: 'loseHp', amount: 5 }],
        result: '眠気と戦いながら解いた。正解なら研究費+40、誤答ならHP−5。' },
    ],
  },
  {
    id: 'senpai_notes', name: '先輩の実験ノート',
    text: '研究室の棚に、卒業した先輩の実験ノートが残されていた。走り書きの反応式がびっしり並んでいる。',
    choices: [
      { label: '読み込んで理解する（出題）', quiz: { level: 2 }, onCorrect: [{ type: 'gainCard', rarity: 'rare' }], onWrong: [{ type: 'gainCard', rarity: 'common' }],
        result: '正解ならレアカード、誤答でも共通カードを1枚得る。' },
      { label: 'コピーだけ取る（研究費−20・カード1枚獲得）', effects: [{ type: 'gold', amount: -20 }, { type: 'gainCard', rarity: 'uncommon' }],
        result: 'コピーは取った。理解したかどうかは、また別の話だ。' },
      { label: '棚に戻す', effects: [], result: 'ノートを元の場所に戻した。' },
    ],
  },
  {
    id: 'waste_disposal', name: '廃液処理',
    text: '実習の後片付け。重金属イオンを含む廃液、有機溶媒、酸・塩基の廃液が混ざりかけている。',
    choices: [
      { label: '種類ごとに分別して廃液タンクへ（カード1枚除去）', effects: [{ type: 'removeCard', count: 1, choose: true }],
        result: '丁寧に分別した。頭の中も整理された気がする。重金属を含む廃液を流しに捨ててはいけない。' },
      { label: '全部流しに捨てる（研究費+25・「思い込み」1枚・HP−3）', effects: [{ type: 'gold', amount: 25 }, { type: 'gainCard', cardId: 'misconception' }, { type: 'loseHp', amount: 3 }],
        result: '先生にこっぴどく叱られた。「薄めれば大丈夫」は思い込みだ。' },
    ],
  },
  {
    id: 'mixing_danger', name: '「まぜるな危険」',
    text: '掃除当番。酸性タイプの洗剤と、次亜塩素酸ナトリウムを含む塩素系漂白剤が並んでいる。両方使えば早く終わりそうだ。',
    choices: [
      { label: '混ぜない。換気して別々に使う（カード1枚強化）', effects: [{ type: 'upgradeCard', count: 1, choose: true }],
        result: '正しい判断。NaClO + 2HCl → NaCl + H_2O + Cl_2↑ の反応で有毒な塩素が発生する。' },
      { label: '混ぜて使う（HP−12・「塩素」を得る）', effects: [{ type: 'loseHp', amount: 12 }, { type: 'gainCard', cardId: 'cl2_gas' }],
        result: '黄緑色の刺激臭のある気体が発生し、むせて涙が止まらない。NaClO + 2HCl → NaCl + H_2O + Cl_2↑。' },
    ],
  },
  {
    id: 'mock_exam', name: '模試の判定',
    text: '模試の会場。最後の大問は見たことのない設定だが、配点は大きい。',
    choices: [
      { label: '難問に挑む（京大レベル）', quiz: { level: 3 }, onCorrect: [{ type: 'gainRelic', rarity: 'uncommon' }], onWrong: [{ type: 'loseHp', amount: 8 }],
        result: '正解なら器具を1つ得る。誤答ならHP−8。どちらにしても解説から学べる。' },
      { label: '標準問題を確実に取る', quiz: { level: 2 }, onCorrect: [{ type: 'gold', amount: 50 }], onWrong: [{ type: 'loseHp', amount: 4 }],
        result: '正解なら研究費+50。誤答ならHP−4。' },
      { label: '見直しに時間を使う（HP5回復）', effects: [{ type: 'heal', amount: 5 }], result: '計算ミスを2つ見つけて直した。' },
    ],
  },
  {
    id: 'festival_flame', name: '文化祭の炎色反応ショー', acts: [2, 5],
    text: '化学部の出し物。メタノールに溶かした金属塩が次々に色とりどりの炎を上げる。部員に「この炎、何色かわかる？」と聞かれた。',
    choices: [
      { label: '答える（無機の出題）', quiz: { field: 'inorganic' }, onCorrect: [{ type: 'gainCard', cardId: 'flame_test' }, { type: 'gold', amount: 30 }], onWrong: [{ type: 'loseHp', amount: 3 }],
        result: '正解なら「炎色反応」と研究費+30。Li赤・Na黄・K赤紫・Ca橙赤・Sr紅・Ba黄緑・Cu青緑。' },
      { label: '裏方を手伝う（研究費+40）', effects: [{ type: 'gold', amount: 40 }], result: '片付けまで手伝い、謝礼をもらった。' },
    ],
  },
  {
    id: 'reagent_shelf', name: '試薬棚の整理',
    text: '古い試薬棚の整理を頼まれた。ラベルが読める瓶と、色あせて読めない瓶がある。',
    choices: [
      { label: 'ラベルの読める瓶を1本もらう', effects: [{ type: 'gainPotion' }], result: '試薬瓶を1本手に入れた。' },
      { label: '読めない瓶もまとめて引き取る（試薬瓶2本・HP−5）', effects: [{ type: 'gainPotion' }, { type: 'gainPotion' }, { type: 'loseHp', amount: 5 }],
        result: '1本の栓を開けたとたん刺激臭が鼻をついた。正体不明の試薬はにおいを直接かいではいけない。' },
      { label: '整理だけして帰る（HP5回復）', effects: [{ type: 'heal', amount: 5 }], result: '棚がきれいになり、気分もすっきりした。' },
    ],
  },
  {
    id: 'fractional_wait', name: '分留の待ち時間',
    text: '温度計の値が78℃付近で止まり、留出液がぽたぽたと落ち始めた。しばらく手が空く。',
    choices: [
      { label: '問題集を解いて待つ（出題）', quiz: {}, onCorrect: [{ type: 'upgradeCard', count: 2, choose: true }], onWrong: [{ type: 'upgradeCard', count: 1, choose: true }],
        result: '正解ならカード2枚、誤答でもカード1枚を強化する。' },
      { label: '椅子で目を閉じる（HP15回復）', effects: [{ type: 'heal', amount: 15 }], result: '少し休んだだけで、集中力が戻ってきた。' },
    ],
  },
  {
    id: 'ask_teacher', name: '質問に行く',
    text: 'どうしても納得できない問題がある。職員室の前で足が止まった。',
    choices: [
      { label: '思い切って質問する（出題）', quiz: { level: 2 }, onCorrect: [{ type: 'removeCard', cardId: 'misconception' }, { type: 'removeCard', count: 1, choose: true }], onWrong: [{ type: 'removeCard', cardId: 'misconception' }],
        result: '先生は丁寧に説明してくれた。正解なら「思い込み」1枚と好きなカード1枚、誤答でも「思い込み」1枚を除去する。' },
      { label: 'ノートを添削してもらう（研究費−30・カード1枚除去）', effects: [{ type: 'gold', amount: -30 }, { type: 'removeCard', count: 1, choose: true }],
        result: '赤ペンだらけのノートが返ってきた。無駄な部分がよくわかった。' },
      { label: '恥ずかしいのでやめる', effects: [], result: '質問は恥ではない。疑問を放置するほうがずっと高くつく。' },
    ],
  },
  {
    id: 'white_crystal', name: '謎の白色結晶', acts: [3, 4, 5],
    text: '有機実験室の机の上に、ラベルのない白色の結晶が置かれている。',
    choices: [
      { label: '性質から正体を推理する（有機の出題）', quiz: { field: 'organic' }, onCorrect: [{ type: 'gainCard', field: 'organic', rarity: 'uncommon' }, { type: 'gold', amount: 20 }], onWrong: [{ type: 'loseHp', amount: 6 }],
        result: '正解なら有機のカードと研究費+20を得る。誤答ならHP−6。' },
      { label: 'なめて確かめる（HP−10）', effects: [{ type: 'loseHp', amount: 10 }],
        result: '絶対にしてはいけない。実験室の試薬を口に入れてはならない。舌がしびれ、保健室へ直行した。' },
      { label: 'そっと戻して先生に報告する', effects: [{ type: 'heal', amount: 3 }], result: '正体不明の物質には触らない。正しい判断だ。' },
    ],
  },
  {
    id: 'cafeteria', name: '学食',
    text: '昼休みの学食。今日の日替わりはカレーだ。',
    choices: [
      { label: '大盛りを食べる（研究費−15・HP15回復）', effects: [{ type: 'gold', amount: -15 }, { type: 'heal', amount: 15 }],
        result: '満腹になった。午後の眠気には気をつけよう。' },
      { label: '節約しておにぎりだけ（HP5回復）', effects: [{ type: 'heal', amount: 5 }], result: '質素だが十分だ。' },
    ],
  },
  {
    id: 'cram_night', name: '一夜漬けの誘惑',
    text: '明日は小テスト。今夜すべて詰め込むか、計画どおりに寝るか。',
    choices: [
      { label: '一夜漬けする（カード2枚獲得・「思い込み」2枚・HP−8）', effects: [{ type: 'gainCard' }, { type: 'gainCard' }, { type: 'gainCard', cardId: 'misconception' }, { type: 'gainCard', cardId: 'misconception' }, { type: 'loseHp', amount: 8 }],
        result: '詰め込んだ知識は翌週にはほとんど消え、あやふやな理解だけが残った。' },
      { label: '計画どおり寝る（HP10回復・カード1枚強化）', effects: [{ type: 'heal', amount: 10 }, { type: 'upgradeCard', count: 1, choose: true }],
        result: '睡眠で定着した知識は崩れにくい。分散して繰り返し学ぶほうが長く記憶に残る。' },
    ],
  },
  {
    id: 'nylon_factory', name: '合成繊維工場の見学', acts: [4, 5],
    text: '工場見学。ジアミンとジカルボン酸ジクロリドの界面で、糸がするすると引き出されていく。案内の技術者が質問を出してきた。',
    choices: [
      { label: '質問に答える（高分子の出題）', quiz: { field: 'polymer' }, onCorrect: [{ type: 'gainRelic' }], onWrong: [{ type: 'loseHp', amount: 5 }],
        result: '正解なら器具を1つ得る。誤答ならHP−5。' },
      { label: 'お土産をもらう（「縮合重合」を得る）', effects: [{ type: 'gainCard', cardId: 'condensation_polymerization' }],
        result: 'ナイロン66は縮合重合でできる。アミド結合どうしの水素結合が強さの秘密だ。' },
    ],
  },
  {
    id: 'past_papers', name: '過去問の束',
    text: '図書室の奥で、何年分もの入試問題の束を見つけた。どれも長いリード文が特徴的だ。',
    choices: [
      { label: '時間を計って本気で解く（京大レベル）', quiz: { level: 3 }, onCorrect: [{ type: 'gainRelic', rarity: 'rare' }], onWrong: [{ type: 'loseHp', amount: 10 }],
        result: '正解ならレアな器具を得る。誤答ならHP−10。解説はじっくり読もう。' },
      { label: '解説だけ読む（カード1枚強化）', effects: [{ type: 'upgradeCard', count: 1, choose: true }],
        result: '解法の流れはわかった。自分の手で解けるかは別問題だが。' },
    ],
  },
  {
    id: 'sleep_lecture', name: '睡眠と記憶の講演',
    text: '放課後、「睡眠と記憶」についての講演会がある。演習の時間は削られるが……。',
    choices: [
      { label: '講演を聴く（最大HP+5）', effects: [{ type: 'maxHp', amount: 5 }],
        result: '睡眠中、その日に学んだことが脳内で整理され、長期記憶として定着していく。睡眠を削った勉強は効率が悪い。今日から23時には寝よう。' },
      { label: '自習室にこもる（出題）', quiz: {}, onCorrect: [{ type: 'gold', amount: 30 }], onWrong: [{ type: 'loseHp', amount: 4 }],
        result: '正解なら研究費+30。誤答ならHP−4。' },
    ],
  },
  {
    id: 'electrolysis_demo', name: '電気分解の公開実験', acts: [2, 5],
    text: '硫酸銅(II)水溶液を白金電極で電気分解している。「陽極で発生する気体は？ 流れた電気量から析出量は？」と先生。',
    choices: [
      { label: '答える（理論IIの出題）', quiz: { field: 'theory2' }, onCorrect: [{ type: 'gold', amount: 40 }, { type: 'upgradeCard', count: 1, choose: true }], onWrong: [{ type: 'loseHp', amount: 4 }],
        result: '陰極: Cu^{2+} + 2e^- → Cu、陽極: 2H_2O → O_2 + 4H^+ + 4e^-。正解なら研究費+40とカード1枚強化。' },
      { label: '見学に徹する（HP5回復）', effects: [{ type: 'heal', amount: 5 }], result: '陰極に赤い銅が析出していくのを眺めた。' },
    ],
  },
  {
    id: 'broken_glass', name: '割れたビュレット',
    text: '手を滑らせ、ビュレットを割ってしまった。周りには誰もいない。',
    choices: [
      { label: '正直に報告する（研究費−15・カード1枚強化）', effects: [{ type: 'gold', amount: -15 }, { type: 'upgradeCard', count: 1, choose: true }],
        result: '先生は怒らず、ガラス片の安全な片付け方と、ビュレットの正しい読み方を教えてくれた。' },
      { label: 'こっそり片付ける（HP−7）', effects: [{ type: 'loseHp', amount: 7 }],
        result: '素手で拾ったガラス片で指を切った。破損はすぐに報告するのがルールだ。' },
    ],
  },
  {
    id: 'equilibrium_seminar', name: '平衡のゼミ', acts: [2, 5],
    text: '「N_2O_4 ⇄ 2NO_2 の平衡で、温度を上げると色はどうなる？」ゼミの先輩が挑戦的に問う。',
    choices: [
      { label: '受けて立つ（理論IIの出題）', quiz: { field: 'theory2', level: 2 }, onCorrect: [{ type: 'gainCard', cardId: 'le_chatelier' }], onWrong: [{ type: 'loseHp', amount: 5 }],
        result: 'NO_2の生成は吸熱反応なので、温度を上げると平衡は右へ移動し、赤褐色が濃くなる。正解なら「ルシャトリエの原理」を得る。' },
      { label: '遠慮する', effects: [], result: '先輩は少し残念そうだった。' },
    ],
  },
  {
    id: 'crystal_model', name: '結晶模型づくり', acts: [1, 5],
    text: '発泡スチロール球で単位格子の模型をつくる課題。面心立方格子にするか、体心立方格子にするか。',
    choices: [
      { label: '面心立方格子を組む（「面心立方格子」を得る）', effects: [{ type: 'gainCard', cardId: 'fcc_lattice' }],
        result: '単位格子中の原子は 1/8×8 + 1/2×6 = 4個。充填率74%。' },
      { label: '体心立方格子を組む（「体心立方格子」を得る）', effects: [{ type: 'gainCard', cardId: 'bcc_lattice' }],
        result: '単位格子中の原子は 1/8×8 + 1 = 2個。充填率68%。' },
      { label: '計算問題で確かめる（理論Iの出題）', quiz: { field: 'theory1' }, onCorrect: [{ type: 'gainRelic', rarity: 'common' }], onWrong: [{ type: 'loseHp', amount: 4 }],
        result: '正解なら器具を1つ得る。誤答ならHP−4。' },
    ],
  },
];
