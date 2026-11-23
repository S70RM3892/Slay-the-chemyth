# Slay the Chemyth — 設計仕様書（実装の契約）

化学を題材にしたオリジナルのローグライク・デッキ構築ゲーム。目的は **京都大学 個別試験「化学」に通用する力をプレイ中に鍛えること**。
ジャンル（デッキ構築ローグライク）の枠組みだけを借り、カード・敵・レリック・名称・文章・見た目はすべて本作オリジナルにする。既存ゲームのカード名・キャラクター・固有名詞・アートを流用しない。

この文書が **エンジン／データ／問題／UI の各実装者間の唯一の契約**。ここに書かれたスキーマ名・export名・ファイルパスは勝手に変えない。足りない点は「最小の拡張」をして、拡張内容を自分の最終報告に明記する。

---

## 1. 学習設計（最優先）

京大化学は大問4題（理論中心の2題・有機の構造決定・高分子（糖／アミノ酸等））で、長いリード文を読んで状況を把握し、知識を「論理的思考」に使えるかを問う。本作はこれを3つの仕組みで鍛える。

1. **反応システム**（知識の運用）: 敵は「性質タグ」を持ち、カード（試薬・反応・法則）は条件が合うと「反応成立」して追加効果が出る。反応しない試薬は不発。有機の敵は官能基が**隠れて**おり、検出試薬カードで暴く ＝ 構造決定そのもの。
2. **出題システム**（計算力・論述前の思考）: 敵の行動「出題」、カードの「演習」、イベント、ボスの「大問（リード文＋連続小問）」で問題が出る。正解で有利、誤答で不利＋誤答ノート入り。**解説は正誤に関わらず必ず表示**。
3. **誤答ノート**（間隔反復）: 誤答した問題は localStorage に永続保存。以後の出題で優先的に再出題され、**2回連続正解**で卒業。分野別正答率を「弱点分析」で見せる。

問題・カード・敵の化学的内容は **高校化学（新課程: エンタルピー変化 ΔH 表記）として正確**でなければならない。曖昧な内容は入れない。過去問の文章を転載しない（京大型の**オリジナル問題**を作る）。

### 睡眠ガード
ローカル時刻が就寝時刻（既定 23:00、設定で変更可）〜 05:00 の間は、タイトルと各ノード遷移時に「寝ろ。記憶の定着は睡眠中に起こる。進行は自動保存済み。」のバナーを出す（プレイは禁止しない）。ランは常に自動保存し、いつでも中断・再開できる。配色は暗色・低輝度・暖色寄り。

---

## 2. 技術方針

- **ビルド不要の静的サイト**。素の ES Modules（`<script type="module">`）、依存ライブラリなし、画像アセットなし（CSS・絵文字・Unicode・インラインSVGのみ）。
- エンジン（`src/engine`）は **DOM非依存の純ロジック**。Node でテスト・シミュレーション可能にする。
- 乱数は seed 付き PRNG（`src/engine/rng.js`）。`Math.random` をエンジン内で直接使わない。
- スマホ縦画面（幅 360px〜）とPCの両対応。タップ操作のみで完結（ドラッグ必須にしない: カードをタップ→対象をタップ）。
- 永続化は localStorage（必ず try/catch。使えなくても動く）。キー: `chemyth.run`（中断セーブ）, `chemyth.meta`（誤答ノート・統計・設定・図鑑）。
- `package.json` は `"type":"module"`、scripts: `test`（`node --test tests/`）, `validate`（`node tools/validate-data.js`）, `sim`（`node tools/sim.js`）, `serve`（`npx serve .` 等）。

### ファイル配置と担当

```
index.html, styles/*.css, src/main.js, src/ui/**      … UI担当
src/engine/**, tests/**, tools/**, package.json       … エンジン担当
src/data/index.js, src/data/questions/index.js        … エンジン担当（集約のみ）
src/data/{tags,cards,relics,potions,enemies,encounters,events}.js … ゲームデータ担当
src/data/questions/{theory1,theory2,inorganic,organic,polymer}.js … 各問題担当
```

export 名（厳守）:

| ファイル | export |
|---|---|
| tags.js | `TAGS`（`{id, label, group, desc}` の配列） |
| cards.js | `CARDS`, `STARTER_DECK`（cardId配列） |
| relics.js | `RELICS`, `STARTER_RELIC`（relicId） |
| potions.js | `POTIONS` |
| enemies.js | `ENEMIES` |
| encounters.js | `ENCOUNTERS` |
| events.js | `EVENTS` |
| questions/*.js | `QUESTIONS`, `QUIZ_SETS` |

### 化学式マークアップ（全テキスト共通）
プレーンテキスト中で `_` を下付き、`^` を上付きに使う。1文字なら `H_2O`、複数文字は波括弧 `SO_4^{2-}`, `C_{12}H_{22}O_{11}`, `10^{-5}`。矢印は `→`、平衡は `⇄`。UI は `chem(text)` 関数（HTMLエスケープ後に sub/sup へ変換）で描画する。HTMLタグを直接書かない。改行は `\n`。

---

## 3. ランの構成

| Act | 名称 | 範囲（京大の大問に対応） | ボス |
|---|---|---|---|
| 1 | 理論の層 I「構造と状態」 | 原子・結合・結晶格子、気体・蒸気圧、溶液（希薄溶液・浸透圧・コロイド）、エンタルピー | theory1 の大問 |
| 2 | 理論の層 II「平衡と変化」＋無機 | 反応速度、化学平衡、酸塩基・電離平衡・緩衝液・溶解度積、酸化還元・電池・電気分解、無機各論 | theory2 の大問 |
| 3 | 有機の層「構造決定」 | 脂肪族・芳香族、異性体、検出反応、元素分析、エステル・油脂 | organic の大問 |
| 4 | 高分子の層 | 糖、アミノ酸・ペプチド・タンパク質、核酸、合成高分子、イオン交換樹脂 | polymer の大問 |
| 終 | 二次試験当日 | 全範囲 | 4フェーズ（各分野の大問を1つずつ） |

- 各Actは **8段**のマップ（各段2〜4ノード、下から上へ分岐する有向グラフ）＋ボス。ノード種: `battle`（戦闘）, `elite`（強敵）, `event`（演習室・イベント）, `rest`（自習室）, `shop`（購買部）, `treasure`（実験器具庫）。1段目は必ず battle、最終段（8段目）は必ず rest。elite は3段目以降。
- **難易度** = 出題レベル配分: `kiso`（基礎: L1中心）, `hyojun`（標準: L2中心）, `kyodai`（京大: L2〜L3中心、敵HP+10%）。
- プレイヤー初期値: HP 80 / 最大80、毎ターン エネルギー3・ドロー5、試薬瓶スロット3、所持金(研究費) 99。
- 戦闘報酬: 研究費＋カード3択（スキップ可）＋確率で試薬瓶。elite は器具(レリック)追加。boss は rare 器具3択＋HP全回復の一部（最大HPの50%回復）。
- 自習室: 「休憩（最大HPの30%回復）」「強化（カード1枚アップグレード）」「復習（誤答ノート/弱点分野から3問。正解1問ごとにHP5回復、デッキの『思い込み』を1枚除去）」から1つ。
- 購買部: カード5枚・器具2個・試薬瓶2個・カード除去サービス。
- 勝敗: HP0で敗北。最終ボス撃破でクリア。終了時にリザルト（分野別正答率・成立させた反応一覧・誤答一覧）を表示。

---

## 4. 戦闘ルール

- ターン制。プレイヤーターン開始: ブロック消滅 → エネルギー回復 → ドロー。カードを使い、ターン終了で手札を捨てる（`retain` 除く）。その後、敵が予告済みの行動（インテント）を順に実行。
- **場のpH**: 戦闘ごとに 7 から開始、範囲 0〜14 の整数にクランプ。酸のカードで下がり塩基で上がる。敵の `phRules`・カードの条件・ダメージ倍率が参照する。
- **反応判定**: カードは `reactions` を上から順に評価し、最初に条件を満たした1つが「反応成立」。反応の `effects` は基本 `effects` に**追加**で実行（`replace:true` なら基本効果の代わり）。`strict:true` のカードはどの反応も成立しないと「不発」となり、基本 `effects` の代わりに `fizzle`（省略時は何も起きない）を実行する。成立した反応は `equation`/`explain` を戦闘ログと「反応ノート（図鑑）」に記録。
- **隠しタグ**: 敵の `hiddenTags` は条件判定には**使われる**（実際に反応する）が、UI上は「?」表示。反応が成立したとき、その条件に使われた隠しタグは公開される。`reveal` 効果でも公開。
- ダメージ計算（プレイヤー→敵）: `floor((amount + 濃度) × (希釈なら0.75) × (敵が活性化なら1.5) × phRules.takenMult)`、ブロックで軽減。敵→プレイヤーも対称（`dealtMult` を掛ける、プレイヤーの活性化で1.5倍、緩衝で1ヒットごとに軽減）。
- ブロック計算: `floor((amount + 安定化) × (不安定なら0.75))`。

### ステータス（id固定）

| id | 表示名 | 効果 | 減衰 |
|---|---|---|---|
| `strength` | 濃度 | 攻撃ダメージ +N | 永続 |
| `dexterity` | 安定化 | 得るブロック +N | 永続 |
| `weak` | 希釈 | 与ダメージ ×0.75 | 自ターン終了時 −1 |
| `vulnerable` | 活性化 | 被ダメージ ×1.5 | 自ターン終了時 −1 |
| `frail` | 不安定 | 得るブロック ×0.75 | 自ターン終了時 −1 |
| `poison` | 腐食 | 自ターン開始時 Nダメージ（ブロック無視）後 −1 | — |
| `precip` | 沈殿 | 次の行動をスキップして解除。boss には無効で、代わりに活性化2を付与 | 行動時 |
| `thorns` | 発熱 | 攻撃を受けるたび攻撃者に Nダメージ | 永続 |
| `buffer` | 緩衝 | 被ダメージを1ヒットにつき N 軽減 | 自ターン終了時 −1 |
| `chain` | 連鎖反応 | 自ターン開始時 濃度 +N | 永続 |
| `catalyst` | 触媒 | このターン次に使うカードN枚のコスト −1 | 使用時/ターン終了で消滅 |
| `colloid` | 保護コロイド | デバフ付与を N 回無効化 | 無効化時 −1 |
| `excited` | 励起 | 次の自ターン開始時 エネルギー +N して消滅 | — |
| `regen` | 再結晶 | 自ターン終了時 HP +N、その後 −1 | — |

デバフ = weak, vulnerable, frail, poison, precip。

---

## 5. データスキーマ

### 5.1 効果DSL（カード・レリック・試薬瓶・イベント・敵で共通）

`target` 省略時: カード効果ではカードの `target` に従う。敵の行動では攻撃系はプレイヤー、`self` 指定は自分。

```js
{type:'damage', amount, times?:1, target?:'enemy'|'all'|'random', scale?:{by, per}, pierce?:false}
   // scale.by: 'phBelow7'(7-pH) | 'phAbove7'(pH-7) | 'phDist'(敵の pI からの |pH-pI|、pI 無しなら |pH-7|)
   //         | 'block'(自分のブロック) | 'targetStatus:<id>' | 'selfStatus:<id>' | 'handSize' | 'revealedTags'(対象の公開済みタグ数)
   //         | 'energy'(X コスト時の消費E) | 'correctThisCombat'(この戦闘の正解数)
   //   最終基礎値 = amount + per × 指標。 pierce:true はブロック無視。
{type:'block', amount, scale?:{by, per}}
{type:'status', status:'<id>', amount, target:'self'|'enemy'|'all'|'player'}
{type:'draw', amount}
{type:'energy', amount}
{type:'heal', amount}
{type:'loseHp', amount}                       // 自分のHPを失う（ブロック無視）
{type:'ph', delta}                            // 場のpHを増減
{type:'phSet', value}
{type:'reveal', count?:99}                    // 対象の隠しタグを公開
{type:'addTag', tag} / {type:'removeTag', tag}
{type:'transformTag', from, to}               // 対象が from を持てば to に置換（例: alcohol1 → aldehyde）。持たなければ何もしない
{type:'stripBlock'}                           // 対象のブロックを0に
{type:'addCard', cardId, to:'hand'|'draw'|'discard', count?:1}
{type:'exhaustFromHand', count:1, random?:true}
{type:'discardFromHand', count:1, random?:true}
{type:'upgradeHand', count?:99}               // この戦闘中のみ手札を強化
{type:'quiz', field?, topic?, level?, questionId?, onCorrect:[effects], onWrong:[effects]}
   // field 省略時は現在のActの分野。level 省略時は難易度に従う。
{type:'summon', enemyId}                      // 敵専用
{type:'power', trigger, effects:[...], every?:n, filter?:{cardType?, field?}, name?}
   // プレイヤーにこの戦闘中の常在効果を付与（パワーカード用）。
// --- ラン単位（イベント・レリック取得時・戦闘外）---
{type:'gold', amount}                         // 負値で消費
{type:'maxHp', amount}
{type:'gainRelic', relicId?|rarity?}          // 省略でランダム
{type:'gainCard', cardId?|rarity?|field?}
{type:'gainPotion', potionId?}
{type:'removeCard', count?:1, choose?:true, cardId?}   // cardId 指定でそのカードを除去（例: 思い込み）
{type:'upgradeCard', count?:1, choose?:false}
```

トリガー名（`power` とレリックの `triggers` で共通）:
`combatStart`, `combatEnd`, `turnStart`, `turnEnd`, `onCardPlayed`, `onReaction`（反応成立時）, `onFizzle`, `onQuizCorrect`, `onQuizWrong`, `onAttacked`（HPを失う攻撃を受けた時）, `onPhChange`, `onExhaust`, `onEnemyDeath`, `onPickup`（レリック取得時・ラン単位効果用）, `onRest`, `onShopEnter`。

条件オブジェクト（反応の `when` 等）:
```js
{ anyTags?:[...], allTags?:[...], noTags?:[...], ph?:{min?, max?}, targetStatus?:'<id>', selfStatus?:'<id>' }
```

### 5.2 カード

```js
{
  id:'hcl', name:'塩酸', formula?:'HCl',
  type:'attack'|'skill'|'power'|'status'|'curse',
  rarity:'starter'|'common'|'uncommon'|'rare'|'special',   // special = 報酬に出ない（生成専用・状態異常等）
  field:'theory'|'inorganic'|'organic'|'polymer'|'neutral',
  cost: 0|1|2|3|'X'|null,          // null = 使用不可
  target:'enemy'|'all'|'self'|'none',
  effects:[...], reactions?:[{when, effects, replace?:false, equation?, explain}], strict?:false, fizzle?:[...],
  keywords?:['exhaust'|'retain'|'innate'|'ethereal'|'unplayable'],
  text:'プレイヤー向けの効果説明（数値入り）',
  chem:'学習メモ: このカードの化学的根拠（1〜3文）',
  upgrade:{ ...上書きするフィールド（cost/effects/reactions/fizzle/text など）}   // 強化版は名前に「+」
}
```

必須の特殊カード（id固定、ゲームデータ担当が定義）:
- `misconception`「思い込み」: curse, unplayable。誤答時に山札へ混入。手札にある間ターン終了時にHP1失う、などの軽いペナルティ（`power` ではなく専用フィールド `endTurnInHand:[effects]` を使ってよい。エンジンはこのフィールドをサポートする）。
- `careless`「ケアレスミス」: status, unplayable, ethereal。敵が混入させる。

### 5.3 敵

```js
{
  id, name, formula?, emoji, act:1|2|3|4|5, tier:'normal'|'elite'|'boss'|'minion',
  hp:[min,max], tags:[...], hiddenTags?:[...], pI?:number,
  phRules?:[{min?, max?, takenMult?, dealtMult?, note}],     // pH が範囲内の間有効
  lore:'この敵が体現する物質・現象・よくある誤概念の解説',
  moves:{ <moveId>:{ name, intent:'attack'|'defend'|'buff'|'debuff'|'quiz'|'special', effects:[...] } },
  pattern:{type:'cycle', seq:[moveId...]} | {type:'weighted', table:[{move, w}], noRepeat?:2},
  phases?:[{ hpBelow:0.5, pattern, onEnter?:[effects], name? }],   // boss用。HP割合を下回ると移行
  quizSetId?:'...',     // boss用: このボスの quiz 行動は大問の小問を順番に出題（尽きたら field からランダム）
  quizField?:'theory1'|'theory2'|'inorganic'|'organic'|'polymer'
}
```
敵の効果: `{type:'attack', amount, times?}`（プレイヤーへ）, `block`, `status`（`target:'player'|'self'`）, `addCard`, `ph`, `quiz`, `summon`, `heal`, `addTag/removeTag`（self）。インテント表示は UI が `effects` から数値を計算する。

### 5.4 遭遇・イベント・レリック・試薬瓶

```js
// encounters.js
{ id, act, tier:'normal'|'elite'|'boss', enemies:[enemyId...], weight?:1, minRow?:1 }
// events.js
{ id, name, acts?:[1,2,3,4], text, choices:[{ label, quiz?:{field?, level?, topic?}, effects?:[...], onCorrect?:[...], onWrong?:[...], result:'結果テキスト' }] }
// relics.js
{ id, name, emoji, rarity:'starter'|'common'|'uncommon'|'rare'|'boss'|'shop', text, chem, triggers:[{trigger, effects, every?:n, filter?}] }
// potions.js
{ id, name, emoji, rarity:'common'|'uncommon'|'rare', target:'enemy'|'all'|'self'|'none', effects:[...], text, chem }
```

### 5.5 問題

```js
// QUESTIONS
{
  id:'th1-001',                        // 接頭辞: th1 / th2 / ino / org / pol
  field:'theory1'|'theory2'|'inorganic'|'organic'|'polymer',
  topic:'結晶格子',                     // 分野内トピック（自由文字列、同じ表記を再利用）
  level:1|2|3,                         // 1=教科書基礎 2=入試標準 3=京大レベル（多段思考・状況把握）
  type:'choice'|'numeric',
  text:'問題文', given?:'与えられる定数・原子量',
  choices?:['…','…','…','…'], answer: 0〜3 の index（choice）| 数値（numeric）,
  unit?:'mol/L', tolerance?:0.03,      // numeric: 相対許容誤差（既定3%）。answerが0付近なら absTolerance を使う
  absTolerance?:number,
  explain:'解説（立式→計算→結論。なぜ他の選択肢が誤りかにも触れる）',
  trap?:'ありがちなミス（1文）'
}
// QUIZ_SETS（ボスの大問）
{ id:'set-th1-01', field, title:'大問タイトル', lead:'リード文（実験設定・与条件。京大型に長めでよい）', parts:[ 上と同じ問題オブジェクト（id は 'set-th1-01-1' …）4〜6個 ] }
```
- choice はエンジンが選択肢をシャッフルする。「上のすべて」等の位置依存の選択肢は禁止。
- numeric は有効数字2〜3桁で答えが定まるよう、必要な定数をすべて `given` か本文に書く。UI は `1.2e-5` / `1.2×10^-5` 形式も受け付ける。
- 定数は新課程の標準に揃える: 気体定数 R = 8.31×10^3 Pa·L/(K·mol)、標準状態 0℃・1.013×10^5 Pa で 22.4 L/mol、ファラデー定数 9.65×10^4 C/mol、アボガドロ定数 6.02×10^23 /mol、水のイオン積 1.0×10^{-14}（25℃）。log や平方根の値は問題ごとに与える。熱は**反応エンタルピー ΔH（発熱が負）**で表記。

出題選択アルゴリズム（エンジン）: 候補（field/topic/level 条件）から、(a) 誤答ノートにある問題を40%で優先、(b) 残りは未出題を優先、(c) 同一ラン中の重複は避ける。

---

## 6. コンテンツ量の目安

- カード: 90枚以上（starter 4種 / theory 22 / inorganic 22 / organic 22 / polymer 16 / neutral 8 程度、+ special）。各カードは**実在の試薬・反応・法則**に対応し、`chem` に根拠を書く。
- 敵: 各Act normal 6体以上・elite 2体・boss 1体、最終ボス1体（計40体以上）。Act3 は隠しタグ（官能基）中心、Act4 は pI・還元性の有無など。Act2 は金属イオン（沈殿・錯イオン）と pH。
- レリック30以上、試薬瓶12以上、イベント16以上。
- 問題: 各分野 QUESTIONS 45問以上（L1:10 / L2:20 / L3:15 目安、numeric 4割以上）＋ QUIZ_SETS 各2セット（inorganic は1セット）。

## 7. UI 画面

タイトル（続きから／新規／難易度／図鑑／弱点分析／設定）→ マップ → 各ノード画面（戦闘・報酬・イベント・自習室・購買部・器具庫）→ リザルト。
戦闘画面: 上部に敵（名前・HP・ブロック・ステータス・タグ（隠しは?）・インテント）、中央に **pHメーター（0〜14のバー）** とログ、下部に手札・エネルギー・山札/捨て札/除外数・試薬瓶・ターン終了。カード長押し/詳細ボタンで `chem` メモを表示。敵タップで `lore` 表示。
出題モーダル: リード文（大問時）→ 問題文 → 選択肢 or 数値入力 → 正誤と**解説・trap**表示 →「次へ」。制限時間なし。
図鑑: カード／敵／反応ノート／誤答ノート。弱点分析: 分野×トピック別の正答率と出題数。
