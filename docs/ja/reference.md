[English](../en/reference.md) | [日本語](../ja/reference.md) | [中文](../zh-CN/reference.md)
<!-- Translated from: docs/en/reference.md -->

# コマンドリファレンス

## プロジェクトのセットアップ

| コマンド | 説明 |
|---------|------|
| `ralph-lisa init [dir]` | プロジェクトを初期化（フル — ロールファイル + セッション状態を作成） |
| `ralph-lisa init --minimal [dir]` | ミニマル初期化（セッション状態のみ、プロジェクトファイルなし） |
| `ralph-lisa uninit` | プロジェクトから RLL を削除 |
| `ralph-lisa start "task"` | タスクを設定し両エージェントを起動（手動モード） |
| `ralph-lisa start --full-auto "task"` | 許可プロンプトなしで起動 |
| `ralph-lisa auto "task"` | tmux を使った auto モード |
| `ralph-lisa auto --full-auto "task"` | 許可プロンプトなしの auto モード |
| `ralph-lisa stop` | グレースフルシャットダウン（watcher 停止、agent 終了、tmux 解体） |
| `ralph-lisa stop --force` | 全プロセスを即時強制終了 |
| `ralph-lisa stop --no-archive` | ログアーカイブなしで停止 |

## ターン制御

| コマンド | 説明 |
|---------|------|
| `ralph-lisa whose-turn` | 現在誰のターンかを確認 |
| `ralph-lisa check-turn` | `whose-turn` のエイリアス |
| `ralph-lisa submit-ralph --file f.md` | Ralph がファイルから提出（推奨） |
| `ralph-lisa submit-lisa --file f.md` | Lisa がファイルから提出（推奨） |
| `ralph-lisa submit-ralph --stdin` | Ralph が標準入力パイプ経由で提出 |
| `ralph-lisa submit-lisa --stdin` | Lisa が標準入力パイプ経由で提出 |
| `ralph-lisa submit-ralph "[TAG] ..."` | Ralph がインラインで提出（非推奨） |
| `ralph-lisa submit-lisa "[TAG] ..."` | Lisa がインラインで提出（非推奨） |
| `ralph-lisa force-turn <agent>` | ターンを手動で `ralph` または `lisa` に設定 |

## 情報

| コマンド | 説明 |
|---------|------|
| `ralph-lisa status` | 現在のステータスを表示（タスク、ラウンド、ターン、最後のアクション） |
| `ralph-lisa read work.md` | Ralph の最新の提出内容を読む |
| `ralph-lisa read review.md` | Lisa の最新のレビューを読む |
| `ralph-lisa read-review` | `read review.md` のエイリアス |
| `ralph-lisa read review --round N` | ラウンド N のレビューを読む |
| `ralph-lisa history` | セッションの完全な履歴を表示 |
| `ralph-lisa recap` | コンテキスト回復の要約 |
| `ralph-lisa logs` | トランスクリプトログの一覧 |
| `ralph-lisa logs cat [name]` | 特定のトランスクリプトログを表示 |

## フロー制御

| コマンド | 説明 |
|---------|------|
| `ralph-lisa step "phase-name"` | 新しいステップに入る（consensus が必要） |
| `ralph-lisa step --force "phase-name"` | 新しいステップに入る（consensus 検査をスキップ） |
| `ralph-lisa update-task "new direction"` | セッション中にタスクの方針を更新 |
| `ralph-lisa archive [name]` | 現在のセッションをアーカイブ |
| `ralph-lisa clean` | セッション状態をクリーン |

## Policy

| コマンド | 説明 |
|---------|------|
| `ralph-lisa policy check <ralph\|lisa>` | エージェントの最新の提出を検査（ハードゲート） |
| `ralph-lisa policy check-consensus` | 両エージェントが `[CONSENSUS]` を提出したか確認 |
| `ralph-lisa policy check-next-step` | 包括的なステップ前検査（consensus + policy） |

スタンドアロンの policy コマンドは `RL_POLICY_MODE` に関係なく、違反時は常にゼロ以外で終了します。

## 診断

| コマンド | 説明 |
|---------|------|
| `ralph-lisa doctor` | すべての依存関係を確認しステータスを報告 |
| `ralph-lisa doctor --strict` | 依存関係が不足している場合に終了コード 1 で終了（CI 用） |

## 環境変数

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `RL_POLICY_MODE` | `warn` | policy 検査モード: `off`、`warn`、`block` |
| `RL_CHECKPOINT_ROUNDS` | `0`（無効） | auto モードで N ラウンドごとに人間のレビューのために一時停止 |
| `RL_LOG_MAX_MB` | `5` | ペインログの切り詰め閾値（MB、最小 1） |
