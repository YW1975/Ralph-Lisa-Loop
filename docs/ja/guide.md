[English](../en/guide.md) | [日本語](../ja/guide.md) | [中文](../zh-CN/guide.md)
<!-- Translated from: docs/en/guide.md -->

# ユーザーガイド

Ralph-Lisa Loop は、コード生成とコードレビューを厳密に分離します。一方のエージェントがコードを書き、もう一方がレビューし、ターン制のループで交互に作業します。アーキテクチャ上の意思決定を行うのはあなたです。

## 前提条件

| 依存関係 | 用途 | インストール |
|----------|------|-------------|
| [Node.js](https://nodejs.org/) >= 18 | CLI | nodejs.org を参照 |
| [Claude Code](https://claude.ai/code) | Ralph（開発者） | `npm i -g @anthropic-ai/claude-code` |
| [Codex CLI](https://github.com/openai/codex) | Lisa（レビュアー） | `npm i -g @openai/codex` |
| tmux | auto モード | `brew install tmux`（macOS）/ `apt install tmux`（Linux） |
| fswatch / inotify-tools | より高速なターン検出 | `brew install fswatch`（macOS）/ `apt install inotify-tools`（Linux） |

tmux と fswatch/inotify-tools は auto モードでのみ必要です。手動モードは Node.js、Claude Code、Codex だけで動作します。

`ralph-lisa doctor` を実行してセットアップを確認してください：

```bash
ralph-lisa doctor
```

`--strict` を付けると、不足があった場合にゼロ以外の終了コードを返します（CI で便利です）：

```bash
ralph-lisa doctor --strict
```

## インストール

```bash
npm i -g ralph-lisa-loop
```

## プロジェクトのセットアップ

### フルセットアップ

```bash
cd your-project
ralph-lisa init
```

ロールファイルとセッション状態が作成されます：

```
your-project/
├── CLAUDE.md              # Ralph のロール（Claude Code が自動読み込み）
├── CODEX.md               # Lisa のロール（.codex/config.toml 経由で読み込み）
├── .claude/
│   └── commands/          # Claude スラッシュコマンド
├── .codex/
│   ├── config.toml        # Codex 設定
│   └── skills/            # Codex スキル
└── .dual-agent/           # セッション状態
    ├── turn.txt           # 現在のターン
    ├── task.md            # タスク目標（update-task で更新）
    ├── work.md            # Ralph の提出内容
    ├── review.md          # Lisa の提出内容
    └── history.md         # 完全な履歴
```

### ミニマルセットアップ（ゼロ侵入）

```bash
ralph-lisa init --minimal
```

`.dual-agent/` セッション状態のみを作成し、プロジェクトレベルのファイル（CLAUDE.md、CODEX.md、コマンドファイル）は作成しません。以下が必要です：

- Claude Code プラグインがインストール済み（hooks 経由で Ralph のロールを提供）
- Codex のグローバル設定が `~/.codex/` に存在（Lisa のロールを提供）

`start` と `auto` コマンドはどちらのセットアップモードでも動作します。

### プロジェクトからの削除

```bash
ralph-lisa uninit
```

## 最初のセッション

### ステップ 1: タスクの開始

```bash
ralph-lisa start "implement login feature"
```

タスクが `.dual-agent/task.md` に書き込まれ、ターンが Ralph に設定されます。

### ステップ 2: Ralph が作業する（ターミナル 1）

```bash
ralph-lisa whose-turn                    # → "ralph"
# ... 作業を行う ...
# 提出内容を .dual-agent/submit.md に書き込む
ralph-lisa submit-ralph --file .dual-agent/submit.md
```

ラウンド 1 は必ず `[PLAN]` の提出でなければなりません。これにより、コーディング開始前に Lisa がタスクの理解を確認できます。

### ステップ 3: Lisa がレビューする（ターミナル 2）

```bash
ralph-lisa whose-turn                    # → "lisa"
ralph-lisa read work.md                  # Ralph の提出内容を読む
# ... レビューを .dual-agent/submit.md に書き込む ...
ralph-lisa submit-lisa --file .dual-agent/submit.md
```

### ステップ 4: consensus に達するまで繰り返す

Ralph が Lisa のレビューを読んで対応します：

```bash
ralph-lisa read review.md                # Lisa のフィードバックを読む
# [FIX]、[CHALLENGE]、[DISCUSS] などで対応する
ralph-lisa submit-ralph --file .dual-agent/submit.md
```

両エージェントが `[CONSENSUS]` に達するまでループが続きます。

### ステップ 5: 次のステップへ

consensus 後、次のフェーズに進みます：

```bash
ralph-lisa step "phase-2-implementation"
```

## Auto モード

auto モードは tmux を使ってターミナルを管理し、ファイル watcher でターンの切り替えを自動的にトリガーします。

```bash
ralph-lisa auto "implement login feature"
```

2つのペインを持つ tmux セッションが作成されます。一方は Ralph（Claude Code）用、もう一方は Lisa（Codex）用です。watcher が `.dual-agent/turn.txt` を監視し、ターンが変わると適切なエージェントをトリガーします。

### Full-Auto モード

```bash
ralph-lisa auto --full-auto "implement login feature"
```

許可プロンプトなしで実行します。現在のタスクで両エージェントが自律的に動作することを信頼できる場合に使用してください。

### Checkpoint システム

N ラウンドごとに人間のレビューのために一時停止します：

```bash
export RL_CHECKPOINT_ROUNDS=5
ralph-lisa auto "task"
```

### Watcher の動作

- **Fire-and-forget トリガー**: 高速なターン切り替え
- **30秒のクールダウン**: 作業中の再トリガーを防止
- **クラッシュ時の自動再起動**: セッション単位で保護
- **Heartbeat ファイル**: `.dual-agent/.watcher_heartbeat` で生存確認
- **設定可能なログ閾値**: `RL_LOG_MAX_MB`（デフォルト 5、最小 1）

## Tag システム

すべての提出の最初の行には tag が必要です：

| Ralph の tag | Lisa の tag | 共通 |
|------------|-----------|------|
| `[PLAN]` | `[PASS]` | `[CHALLENGE]` |
| `[RESEARCH]` | `[NEEDS_WORK]` | `[DISCUSS]` |
| `[CODE]` | | `[QUESTION]` |
| `[FIX]` | | `[CONSENSUS]` |

### Tag の詳細

- **`[PLAN]`**: ラウンド 1 で必須。コーディング前にアプローチを概説します。
- **`[RESEARCH]`**: リファレンス実装、プロトコル、外部 API を扱う場合、コーディング前に必須。検証済みのエビデンス（file:line、コマンド出力）を含める必要があります。
- **`[CODE]`**: コードの実装。Test Results セクションを含める必要があります。
- **`[FIX]`**: フィードバックに基づくバグ修正または改訂。Test Results セクションを含める必要があります。
- **`[PASS]`**: Lisa が提出を承認します。
- **`[NEEDS_WORK]`**: Lisa が変更を要求します。少なくとも1つの理由を含める必要があります。
- **`[CHALLENGE]`**: 相手エージェントの提案に異議を唱え、反論を提示します。
- **`[DISCUSS]`**: 一般的な議論や確認事項。
- **`[QUESTION]`**: 確認のための質問。
- **`[CONSENSUS]`**: 現在の項目を閉じることへの合意を確認します。

## 提出ルール

### ラウンド 1 は必ず [PLAN]

Ralph の最初の提出は `[PLAN]` でなければなりません。これにより、コードが書かれる前に Lisa がタスクの理解を確認できます。

### Test Results の必須化

`[CODE]` と `[FIX]` の提出には Test Results セクションを含める必要があります：

```markdown
### Test Results
- Test command: npm test
- Result: 150/150 passed
- New tests: 2 added (auth.test.ts, login.test.ts)
```

### コーディング前のリサーチ

タスクがリファレンス実装、プロトコル、外部 API を含む場合、検証済みのエビデンスと共に `[RESEARCH]` を先に提出してください：

```markdown
[RESEARCH] API integration research

- Endpoint: POST /api/v2/auth (docs:line 45)
- Auth: Bearer token in header (verified via curl)
- Response: { token, expires_in } (tested locally)
```

### 無言の受諾の禁止

`[NEEDS_WORK]` への対応時：
- **同意する場合**: Lisa が正しい理由を説明し、`[FIX]` を提出
- **異議がある場合**: `[CHALLENGE]` で反論を提示
- 説明なしに `[FIX]` だけを提出しては**いけません**

## Consensus プロトコル

Lisa の判定は**助言であり、権威的なものではありません**。Ralph は受け入れ、異議申し立て、または確認を求めることができます。

次のステップに進む前に、両エージェントが明示的に `[CONSENSUS]` を提出する必要があります。フローは以下の通りです：

1. Lisa が `[PASS]` を提出（Ralph が同意すれば閉じることが可能）
2. Ralph が `[CONSENSUS]` を提出 — 項目が閉じられる

### Deadlock の回避

5 ラウンド consensus に達しない場合：
- **`[OVERRIDE]`**: 文書化された不一致のまま続行
- **`[HANDOFF]`**: 人間の判断にエスカレーション

無限ループもスタック状態もありません。

## Policy レイヤー

policy レイヤーは提出の品質を検証します。

### インライン検査

`submit-ralph` / `submit-lisa` 実行時に自動的に適用されます：

```bash
# warn モード（デフォルト）— 警告を表示するがブロックしない
export RL_POLICY_MODE=warn

# block モード — 準拠していない提出を拒否
export RL_POLICY_MODE=block

# 無効化
export RL_POLICY_MODE=off
```

### スタンドアロン検査

スクリプトやフック用 — `RL_POLICY_MODE` に関係なく、違反時は常にゼロ以外で終了します：

```bash
ralph-lisa policy check ralph           # Ralph の最新の提出を検査
ralph-lisa policy check lisa            # Lisa の最新の提出を検査
ralph-lisa policy check-consensus       # 両エージェントが [CONSENSUS] を提出したか？
ralph-lisa policy check-next-step       # 包括的検査: consensus + すべての policy 検査
```

### Policy ルール

- Ralph の `[CODE]`/`[FIX]` には「Test Results」セクションが必要
- Ralph の `[RESEARCH]` には実質的な内容が必要
- Lisa の `[PASS]`/`[NEEDS_WORK]` には少なくとも1つの理由が必要

## セッション中の制御

### タスク方針の更新

再起動せずに方針を変更：

```bash
ralph-lisa update-task "switch to REST instead of GraphQL"
```

task.md に追記されます（履歴は保持）。タスクコンテキストは提出内容や watcher のトリガーメッセージに自動注入されます。

### 新しいステップに入る

consensus 後、新しいフェーズに進みます：

```bash
ralph-lisa step "phase-2"              # consensus が必要
ralph-lisa step --force "phase-2"      # consensus 検査をスキップ
```

### ターンの強制変更

スタック状態の手動 override：

```bash
ralph-lisa force-turn ralph
ralph-lisa force-turn lisa
```

### アーカイブとクリーン

```bash
ralph-lisa archive [name]              # 現在のセッションをアーカイブ
ralph-lisa clean                       # セッション状態をクリーン
```

## 環境変数

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `RL_POLICY_MODE` | `warn` | policy 検査モード: `off`、`warn`、`block` |
| `RL_CHECKPOINT_ROUNDS` | `0`（無効） | N ラウンドごとに人間のレビューのために一時停止 |
| `RL_LOG_MAX_MB` | `5` | ペインログの切り詰め閾値（MB、最小 1） |

## ヒントとベストプラクティス

### Git の規律

小さなコミット、明確なメッセージ、頻繁なコミット。問題が起きたとき（必ず起きます）、唯一のセーフティネットは既知の良好な状態に `git reset` できることです。

### エージェントのクラッシュ

エージェントのクラッシュにはまだ自動回復機能がありません。エージェントがクラッシュした場合（長いコンテキストやシステムリソースの枯渇が原因の可能性あり）、手動で再起動する必要があります。tmux セッションを監視し、必要に応じて再起動してください。

### コンテキスト管理

長いセッションはコンテキストウィンドウを消費します。`ralph-lisa step` を使って大きなタスクをステップに分割してください。個々のタスクは焦点を絞り、最初からやり直すのではなく `update-task` でリダイレクトしてください。

### RLL の使いどころ

**適している場面**: マルチステップの実装、アーキテクチャ上の判断、ユーザーやセキュリティに影響するコード、曖昧な要件。

**過剰な場面**: 1行の修正、十分にテストされたリファクタリング、個人スクリプト、緊急のホットフィックス。

### 人間の裁定者

2つの AI は悪い設計でも喜んで合意します。Ralph-Lisa Loop は構造化された AI 支援開発であり、自律的な開発ではありません。人間の裁定者は省略できません。
