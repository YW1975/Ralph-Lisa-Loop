[English](../en/faq.md) | [日本語](../ja/faq.md) | [中文](../zh-CN/faq.md)
<!-- Translated from: docs/en/faq.md -->

# よくある質問

## インストール

### npm install が権限エラーで失敗する

`--prefix` フラグを付けてインストールするか、Node バージョンマネージャー（nvm、fnm）を使用してください：

```bash
# 方法 1: prefix を使用
npm i -g ralph-lisa-loop --prefix ~/.npm-global

# 方法 2: nvm を使用（推奨）
nvm install 18
nvm use 18
npm i -g ralph-lisa-loop
```

### どの Node.js バージョンが必要ですか？

Node.js 18 以上です。以下で確認できます：

```bash
node --version
```

### tmux と fswatch はどうインストールしますか？

**macOS:**
```bash
brew install tmux fswatch
```

**Linux (Debian/Ubuntu):**
```bash
apt install tmux inotify-tools
```

これらは auto モードでのみ必要です。手動モードではこれらなしで動作します。

### `ralph-lisa doctor` が不足を報告する

`doctor` はすべての依存関係を確認します。出力には、何が不足しているかとインストール方法が正確に示されます。CI 環境では `--strict` を使用してください：

```bash
ralph-lisa doctor           # 人間が読みやすいレポート
ralph-lisa doctor --strict  # 不足があれば終了コード 1 で終了
```

### `ralph-lisa auto` が "Error: tmux is required" と表示される

先に tmux をインストールしてください：

```bash
brew install tmux    # macOS
apt install tmux     # Linux
```

### `ralph-lisa auto` が "Error: File watcher required" と表示される

fswatch（macOS）または inotify-tools（Linux）をインストールしてください：

```bash
brew install fswatch          # macOS
apt install inotify-tools     # Linux
```

## 使い方

### 手動モードと auto モードの違いは何ですか？

**手動モード**（`ralph-lisa start`）：各エージェントを別々のターミナルで自分で起動し、各ターンを手動でトリガーします。完全な制御が可能で、学習に最適です。

**auto モード**（`ralph-lisa auto`）：tmux がターミナルを管理し、ファイル watcher がターン変更時にエージェントを自動的にトリガーします。ハンズオフで運用できます。

### Claude Code と Codex の両方が必要ですか？

はい。Ralph には Claude Code が、Lisa には Codex CLI が必要です。書き込みとレビューに異なるモデルを使用することで、それぞれが相手のモデルが見落とす障害パターンを捕捉します。Claude Code は長いコンテキストでエラーハンドリングを省略することがあり、一方で Codex は抽象化を過剰に設計しがちですがエッジケースを捕捉します。

### Lisa に別のモデルを使用できますか？

ロールファイル（CODEX.md）は Codex CLI 向けに設計されていますが、ファイルの読み書きとシェルコマンドの実行ができるエージェントであれば Lisa のロールを担うことができます。CODEX.md のロールプロンプトを適応させる必要があります。

### ミニマルセットアップとフルセットアップの違いは何ですか？

**フルセットアップ**（`ralph-lisa init`）は、ロールファイル（CLAUDE.md、CODEX.md）、コマンド/スキルディレクトリ、セッション状態を作成します。

**ミニマルセットアップ**（`ralph-lisa init --minimal`）は `.dual-agent/` セッション状態ディレクトリのみを作成します。Claude Code プラグインと Codex グローバル設定がすでにロール定義を提供している場合に使用してください。

### セッション中にタスクを変更するにはどうすればよいですか？

```bash
ralph-lisa update-task "new direction here"
```

task.md に追記され（履歴は保持）、更新されたコンテキストが今後の提出に自動注入されます。

## トラブルシューティング

### tmux エラー / "session not found"

tmux セッションが存在するか確認してください：

```bash
tmux ls
```

セッションが終了していた場合は、`ralph-lisa auto` で再起動してください。

### エージェントがクラッシュしてループが停止する

まだ自動回復機能はありません。エージェントがクラッシュした場合（長いコンテキストやリソースの枯渇が原因の可能性あり）：

1. tmux ペインのエラー出力を確認する
2. クラッシュしたエージェントを手動で再起動する
3. ターン状態が正しくない場合は `ralph-lisa force-turn <agent>` を使用する

### 状態の不整合 / 間違ったターンが表示される

実際の状態を確認してください：

```bash
ralph-lisa status
```

ターンが間違っている場合は、強制的に変更してください：

```bash
ralph-lisa force-turn ralph    # または lisa
```

### Watcher がトリガーされない / 遅い

1. fswatch（macOS）または inotify-tools（Linux）がインストールされていることを確認する
2. heartbeat ファイルを確認する: `ls -la .dual-agent/.watcher_heartbeat`
3. watcher のログを確認する: `ralph-lisa logs`

fswatch/inotify-tools がない場合、watcher はポーリングにフォールバックするため遅くなります。

### block モードで提出が拒否される

`RL_POLICY_MODE=block` で提出が拒否された場合：

```bash
# 問題を確認する
ralph-lisa policy check ralph    # または lisa

# よくある問題:
# - [PLAN] にテスト計画がない（テストコマンド＋カバレッジ範囲）
# - [CODE]/[FIX] に "Test Results" セクションがない
# - [CODE]/[FIX] Test Results に終了コードまたは合格/不合格数がない
#   （"Exit code: 0" や "42/42 passed"、または "Skipped: 理由" を追加）
# - [RESEARCH] に実質的な内容がない、または Verified:/Evidence: マーカーがない
# - [PASS]/[NEEDS_WORK] に理由や file:line 参照がない
# - [NEEDS_WORK] 後に [CODE]/[PLAN] を提出した（先に [FIX]/[CHALLENGE] が必要）
```

## プラットフォームサポート

### Windows で動作しますか？

直接は動作しません。auto モードには tmux が必要ですが、ネイティブ Windows では利用できません。

**回避策:**
- **WSL2**（推奨）：Ubuntu の WSL2 をインストールし、その中に Node.js、tmux、inotify-tools をインストール
- **手動モード**：基本的な CLI は手動モード（tmux 不要）で Windows 上で部分的に動作する可能性がありますが、未テストです

将来的には [Margay](https://github.com/YW1975/Margay) との ACP プロトコル経由の統合が予定されており、Electron アプリによるネイティブのクロスプラットフォームサポートを提供します。

### Linux で動作しますか？

はい。ファイル監視には `fswatch` の代わりに `inotify-tools` を使用してください：

```bash
apt install tmux inotify-tools
```

## コストとトークン

### セッションの費用はどのくらいですか？

タスクの複雑さとラウンド数に依存します。大まかな見積もり：

| コンポーネント | ラウンドあたりのコスト |
|---------------|---------------------|
| Ralph（Claude Code） | 約 $0.15 - $0.50 |
| Lisa（Codex） | 約 $0.05 - $0.20 |
| **ラウンド合計** | **約 $0.20 - $0.70** |

通常の 10 - 15 ラウンドのセッションで約 $3 - $10 です。最悪の場合（deadlock のリトライを含む 25 ラウンド以上）で $15 - $20 に達することがあります。

### トークン使用量を最小限にするには？

- **タスクを焦点を絞る。** `ralph-lisa step` を使って大きな作業をステップに分割してください。
- **`update-task` を使用する。** 最初からやり直すのではなくリダイレクトしてください。
- **checkpoint ラウンドを設定する。**（`RL_CHECKPOINT_ROUNDS=5`）コストが膨らむ前に進捗を確認し介入できます。
- **手動モードを使用する。** 各エージェントの動作をより厳密に制御したい場合に。

## アーキテクチャ

### Ralph Wiggum Loop との違いは何ですか？

| 観点 | Ralph Wiggum Loop | Ralph-Lisa Loop |
|------|------------------|-----------------|
| エージェント | 1（セルフループ） | 2（開発者 + レビュアー） |
| 検証 | `<promise>` tag | Lisa の判定 + consensus |
| レビュー | なし | 毎ラウンド必須 |
| バイアス | 高（自己採点） | 低（外部レビュー） |
| 適する用途 | シンプルで明確なタスク | 複雑で曖昧なタスク |

2つのツールは競合せず、同じプロジェクトで共存できます。

### なぜ Claude Code だけを使わないのですか？

単一のエージェントがコードを書き、かつ完了を判断するのは、自分の試験を自分で採点するようなものです。以下の問題があります：

1. **自己検証バイアス**: 外部チェックがない
2. **トンネルビジョン**: 一貫して見落とすエッジケース
3. **摩擦の欠如**: 悪いアイデアが異議なく通過する
4. **コンテキストドリフト**: タスク途中で要件を忘れる

Ralph-Lisa Loop は、ソフトウェアエンジニアリングが数十年前に発見したのと同じ解決策、つまりコードレビューを適用します。

### 2つのエージェントが無限ループに陥ることはありますか？

ありません。5 ラウンド連続 `[NEEDS_WORK]` の後、watcher は自動的に一時停止し deadlock をフラグします。解決方法：

- **`ralph-lisa scope-update`**: タスクスコープを再定義してサイクルを打破
- **`ralph-lisa force-turn`**: ターンを手動でオーバーライド
- **手動介入**: 人間のアービターとして続行方法を決定

さらに、`RL_CHECKPOINT_ROUNDS` で定期的に人間のレビューのために一時停止できます。
