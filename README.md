# Slay the Chemyth

化学を題材にしたオリジナルのローグライク・デッキ構築ゲーム。京都大学 個別試験「化学」に通用する力をプレイ中に鍛えるための学習ツール。

- 4つの Act が京大化学の大問構成に対応（理論 I → 理論 II＋無機 → 有機の構造決定 → 高分子）
- カードは実在の試薬・反応・法則。条件が合えば「反応成立」、合わなければ不発
- 268問＋ボスの大問9セット。解説は正誤に関わらず必ず表示
- 誤答ノート（2回連続正解で卒業）と分野・トピック別の弱点分析
- 友達とのオンライン協力プレイ（最大4人）

## 遊ぶ

ビルド不要の静的サイト。リポジトリ直下を静的サーバーで配信するだけで動く。

```sh
npm run serve        # または: python3 -m http.server
```

GitHub Pages: Settings → Pages → Source を「GitHub Actions」にすると、`.github/workflows/pages.yml` がテストとデータ検証を通してから公開する。

## 協力プレイ

タイトルの「友達と協力（オンライン）」から。ホストが部屋を作り、ルームコードか招待リンク（`?room=XXXXX`）を送る。

- デッキ・HP・研究費は共有。戦闘はターンごとに操作担当が交代、マップや報酬は階ごとにリーダーが交代
- 出題は全員が個別に解答し、半数以上の正解でチーム正解。誤答は各自の端末の誤答ノートに入る
- 解説は全員が「次へ」を押すまで閉じない。チャットあり

通信は WebRTC の P2P（同梱の PeerJS、`vendor/`）。接続の仲介にだけ PeerJS の公開サーバーを使う。ホストの端末がゲームを進めるので、ホストはタブを開いたままにする。別の仲介サーバーや TURN を使う場合は、接続前に `globalThis.CHEMYTH_PEER_OPTIONS` に PeerJS のオプションを入れる。

## 開発

```sh
npm test             # エンジンと協力セッションの単体テスト
npm run validate     # データ（カード・敵・問題）のスキーマ検証
npm run sim          # ボットによる通しプレイ（バランス確認・クラッシュ検出）
node tools/e2e-smoke.mjs                 # ソロの通しプレイ（Playwright）
node tools/e2e-coop.mjs [--net=peer]     # 協力プレイ（Playwright）
```

設計は `docs/DESIGN.md`、エンジンの API は `docs/ENGINE_API.md`。
