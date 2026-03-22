[English](../en/testing.md) | [日本語](../ja/testing.md) | [中文](../zh-CN/testing.md)
<!-- Translated from: docs/en/testing.md -->

# テストガイド

Ralph-Lisa Loop には、CLI の動作を検証するためのユニットテスト、スモークテスト、policy テストが含まれています。

## テストアーキテクチャ

| レイヤー | ファイル | カバレッジ | コマンド |
|---------|---------|-----------|---------|
| ユニットテスト | `cli/src/test/cli.test.ts` | 各 CLI コマンド、policy チェック、状態管理 | `npm test` |
| Policy テスト | `cli/src/test/policy.test.ts` | 提出バリデーションルール（Test Results、file:line、tag） | `npm test` |
| Watcher テスト | `cli/src/test/watcher.test.ts` | Watcher 状態マシンシミュレーション（エスカレーション、送信上限、consensus） | `npm test` |
| 状態テスト | `cli/src/test/state.test.ts` | 状態ディレクトリの解決、プロジェクトルートの検出 | `npm test` |
| **スモークテスト** | `cli/src/test/smoke.test.ts` | エンドツーエンドの複数ステップ CLI ワークフロー | `npm run test:smoke` |

## テストの実行

```bash
# 全テスト（ユニット + スモーク）
cd cli
npm test

# スモークテストのみ
npm run test:smoke

# クリーンな環境で実行（CI 推奨）
env -u RL_STATE_DIR -u TMUX -u TMUX_PANE npm test
```

## テストレポート

スモークテスト結果は `.dual-agent/test-reports/` にタイムスタンプ付きレポートファイルとして自動保存されます。

```bash
# 最新レポートを表示
ralph-lisa test-report

# 全レポートを一覧
ralph-lisa test-report --list
```

各レポートには環境情報（Node.js バージョン、OS、現在の step/round）とテスト出力の最後 50 行が含まれます。

## スモークテストシナリオ

スモークテストは完全な複数ステップのワークフローを検証します。各シナリオは隔離された一時ディレクトリを使用します。

### シナリオ 1: 完全な開発サイクル
**フロー**: `init → [PLAN] → [PASS] → [CODE] → [PASS] → [CONSENSUS]`

検証項目：
- 各提出後に Ralph と Lisa の間でターンが正しく切り替わる
- 履歴がすべての提出を記録する
- 完全な Plan→Code→Review→Consensus サイクルがエラーなく完了する

### シナリオ 2: レビューフィードバックループ
**フロー**: `[CODE] → [NEEDS_WORK] → [FIX] → [PASS] → [CONSENSUS]`

検証項目：
- NEEDS_WORK が正しく FIX フローをトリガーする
- 複数イテレーションにわたって履歴の時系列整合性が維持される
- ラウンドカウンターが正しく進む

### シナリオ 3: Policy ブロックモード
**フロー**: `[CODE] Test Results なし → ブロック → [CODE] Test Results あり → OK`

検証項目：
- ブロックモード（`RL_POLICY_MODE=block`）が非準拠の提出を拒否する
- ブロックされた提出ではターンが進まない
- 準拠した再提出が成功する

### シナリオ 4: Deadlock 検出とリカバリ
**フロー**: `5× [NEEDS_WORK] → deadlock.txt → scope-update → リカバリ`

検証項目：
- 連続 NEEDS_WORK ラウンドが閾値に達した後に deadlock がトリガーされる
- `deadlock.txt` が正しいカウントで作成される
- `scope-update` が deadlock フラグをクリアしカウンターをリセットする
- リカバリ後に作業を継続できる

### シナリオ 5: ステップ遷移時の状態リセット
**フロー**: `[CONSENSUS] + [CONSENSUS] → step "phase-2" → リセットの検証`

検証項目：
- ラウンドが 1 にリセットされる
- ステップ名が更新される
- ターンが ralph にリセットされる
- work.md と review.md から古い tag がクリアされる

### シナリオ 6: 履歴の時系列順序
**フロー**: `[PLAN] → [NEEDS_WORK] → [FIX] → [PASS]`

検証項目：
- すべての提出が提出順に history.md に表示される
- tag の並べ替えや重複がない

### シナリオ 7: Consensus 時の通知
**フロー**: `[CONSENSUS] + [CONSENSUS] → witness ファイルの確認`

検証項目：
- consensus に達した時に `RL_NOTIFY_CMD` が発火する
- 通知メッセージに "complete" または "consensus" が含まれる
- `RL_NOTIFY_CMD` が未設定の場合は通知されない

### シナリオ 8: Recap コンテキストリカバリ
**フロー**: `複数の提出 → ステップ遷移 → recap`

検証項目：
- `ralph-lisa recap` が現在のステップ名を表示する
- 最近のアクションが recap の出力に含まれる

## スモークテスト実行記録

スモークテスト実行後、追跡可能性のために結果を記録してください：

```
Date: YYYY-MM-DD
Version: 0.3.12
Environment: macOS / Linux
Node.js: v22.x

Smoke Results:
  ✓ シナリオ 1: 完全な開発サイクル
  ✓ シナリオ 2: レビューフィードバックループ
  ✓ シナリオ 3: Policy ブロックモード
  ✓ シナリオ 4: Deadlock 検出とリカバリ
  ✓ シナリオ 5: ステップ遷移時の状態リセット
  ✓ シナリオ 6: 履歴の時系列順序
  ✓ シナリオ 7: Consensus 時の通知
  ✓ シナリオ 8: Recap コンテキストリカバリ

Total: 8/8 passed
Issues found:（なし / 問題があればリスト）
```

## テストに影響する環境変数

| 変数 | テストへの影響 |
|------|--------------|
| `RL_POLICY_MODE` | ほとんどのテストで `off` に設定; policy 強制テストでは `block` |
| `RL_DEADLOCK_THRESHOLD` | deadlock テストでは速度のため `5` に設定（デフォルトは `8`） |
| `RL_NOTIFY_CMD` | 通知テストで `cat >> witness-file` に設定 |
| `RL_STATE_DIR` | テスト中は削除して実際のプロジェクト状態の解決を防止 |
| `TMUX` | tmux セッションの干渉を防ぐため削除 |

## テストの拡張

### 新しいスモークシナリオの追加

1. `cli/src/test/smoke.test.ts` に新しい `describe` ブロックを追加
2. `createSuiteDir("name")` で隔離
3. `makeRun(TMP)` と `makeReadState(TMP)` ヘルパーを使用
4. パターンに従う: init → 提出 → アサーション

### 異なる技術スタックのテスト

RLL のスモークテストは CLI フレームワーク自体を検証します。プロジェクト固有のテストは `[PLAN]` フェーズで決定してください：

- プロジェクトにどのテストツールが必要か？（pytest、jest、flutter test など）
- インストール済みか？（`ralph-lisa doctor` で前提条件を確認可能）
- どのスモークシナリオがクリティカルパスをカバーするか？
- `RL_RALPH_GATE` + `RL_GATE_COMMANDS` で自動提出前チェックを設定
