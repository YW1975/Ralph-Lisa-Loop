[English](../en/faq.md) | [日本語](../ja/faq.md) | [中文](../zh-CN/faq.md)
<!-- Translated from: docs/en/faq.md -->

# 常见问题

## 安装

### npm install 因权限错误失败

尝试使用 `--prefix` 标志安装，或使用 Node 版本管理器（nvm、fnm）：

```bash
# 方式 1：使用 prefix
npm i -g ralph-lisa-loop --prefix ~/.npm-global

# 方式 2：使用 nvm（推荐）
nvm install 18
nvm use 18
npm i -g ralph-lisa-loop
```

### 我需要哪个版本的 Node.js？

Node.js 18 或更高版本。通过以下命令检查：

```bash
node --version
```

### 如何安装 tmux 和 fswatch？

**macOS：**
```bash
brew install tmux fswatch
```

**Linux（Debian/Ubuntu）：**
```bash
apt install tmux inotify-tools
```

这些仅在自动模式下需要。手动模式无需它们即可运行。

### `ralph-lisa doctor` 报告缺少某些内容

`doctor` 会检查所有依赖项。输出会准确告诉你缺少什么以及如何安装。在 CI 环境中使用 `--strict`：

```bash
ralph-lisa doctor           # 人类可读的报告
ralph-lisa doctor --strict  # 缺少依赖时退出码为 1
```

### `ralph-lisa auto` 提示 "Error: tmux is required"

先安装 tmux：

```bash
brew install tmux    # macOS
apt install tmux     # Linux
```

### `ralph-lisa auto` 提示 "Error: File watcher required"

安装 fswatch（macOS）或 inotify-tools（Linux）：

```bash
brew install fswatch          # macOS
apt install inotify-tools     # Linux
```

## 使用方法

### 手动模式和自动模式有什么区别？

**手动模式**（`ralph-lisa start`）：你在不同的终端中自行运行每个 agent，并手动触发每个回合。完全控制，最适合学习。

**自动模式**（`ralph-lisa auto`）：tmux 管理终端，文件 watcher 在回合变更时自动触发 agent。无需手动操作。

### 我需要同时安装 Claude Code 和 Codex 吗？

是的。Ralph 需要 Claude Code，Lisa 需要 Codex CLI。使用不同的模型进行编写和审查意味着每个模型能捕获另一个遗漏的失败模式——Claude Code 可能在长上下文中跳过错误处理，而 Codex 倾向于过度设计抽象但能捕获边界情况。

### 我能为 Lisa 使用其他模型吗？

角色文件（CODEX.md）是为 Codex CLI 设计的，但任何能够读写文件和运行 shell 命令的 agent 都可以担任 Lisa 的角色。你需要修改 CODEX.md 中的角色提示词。

### 最小化初始化和完整初始化有什么区别？

**完整初始化**（`ralph-lisa init`）创建角色文件（CLAUDE.md、CODEX.md）、命令/技能目录和会话状态。

**最小化初始化**（`ralph-lisa init --minimal`）仅创建 `.dual-agent/` 会话状态目录。当你已经通过 Claude Code 插件和 Codex 全局配置提供角色定义时使用。

### 如何在会话中途更改任务？

```bash
ralph-lisa update-task "new direction here"
```

这会追加内容到 task.md（保留历史记录），并将更新后的上下文自动注入到后续提交中。

## 故障排除

### tmux 错误 / "session not found"

检查 tmux 会话是否存在：

```bash
tmux ls
```

如果会话被终止，使用 `ralph-lisa auto` 重新启动。

### Agent 崩溃导致循环停止

目前尚无自动恢复机制。当 agent 崩溃时（可能由于上下文过长或资源耗尽）：

1. 检查 tmux 面板中的错误输出
2. 手动重启崩溃的 agent
3. 如果回合状态不正确，使用 `ralph-lisa force-turn <agent>`

### 状态不同步 / 回合显示错误

检查实际状态：

```bash
ralph-lisa status
```

如果回合不正确，强制设置：

```bash
ralph-lisa force-turn ralph    # 或 lisa
```

### Watcher 未触发 / 响应缓慢

1. 确认 fswatch（macOS）或 inotify-tools（Linux）已安装
2. 检查心跳文件：`ls -la .dual-agent/.watcher_heartbeat`
3. 检查 watcher 日志：`ralph-lisa logs`

如果没有安装 fswatch/inotify-tools，watcher 会回退到轮询方式，速度较慢。

### 在 block 模式下提交被拒绝

如果 `RL_POLICY_MODE=block` 且你的提交被拒绝：

```bash
# 检查问题所在
ralph-lisa policy check ralph    # 或 lisa

# 常见问题：
# - [CODE]/[FIX] 缺少 "Test Results" 部分
# - [RESEARCH] 没有实质性内容
# - [PASS]/[NEEDS_WORK] 缺少原因
```

## 平台支持

### 在 Windows 上能用吗？

不能直接使用。自动模式需要 tmux，而原生 Windows 上没有 tmux。

**变通方案：**
- **WSL2**（推荐）：安装 WSL2 和 Ubuntu，然后在 WSL 内安装 Node.js、tmux 和 inotify-tools
- **手动模式**：基本 CLI 可能在 Windows 上部分支持手动模式（无需 tmux），但这未经测试

未来计划包括通过 ACP 协议集成 [Margay](https://github.com/YW1975/Margay)，这将通过 Electron 应用提供原生跨平台支持。

### 在 Linux 上能用吗？

可以。使用 `inotify-tools` 代替 `fswatch` 进行文件监控：

```bash
apt install tmux inotify-tools
```

## 费用与 Token

### 一次会话花费多少？

取决于任务复杂度和轮次数量。大致估算：

| 组件 | 每轮费用 |
|------|----------|
| Ralph（Claude Code） | ~$0.15–0.50 |
| Lisa（Codex） | ~$0.05–0.20 |
| **每轮合计** | **~$0.20–0.70** |

一个典型的 10–15 轮会话大约花费 $3–10。最坏情况（25+ 轮加上 deadlock 重试）可能达到 $15–20。

### 如何减少 token 使用量？

- **保持任务专注。** 使用 `ralph-lisa step` 将大型工作分解为多个步骤。
- **使用 `update-task`** 来重新定向，而非从头开始。
- **设置 checkpoint 轮次**（`RL_CHECKPOINT_ROUNDS=5`），在费用上升前审查进度并介入。
- **使用手动模式**，当你想更严格地控制每个 agent 的行为时。

## 架构

### 这与 Ralph Wiggum Loop 有什么区别？

| 方面 | Ralph Wiggum Loop | Ralph-Lisa Loop |
|------|-------------------|-----------------|
| Agent 数量 | 1（自循环） | 2（开发者 + 审查者） |
| 验证方式 | `<promise>` tag | Lisa 的裁定 + consensus |
| 审查 | 无 | 每轮强制 |
| 偏差 | 高（自我评分） | 低（外部审查） |
| 适合场景 | 简单、定义明确的任务 | 复杂、需求不明确的任务 |

这两个工具互不冲突，可以在同一项目中共存。

### 为什么不直接用 Claude Code？

单个 agent 既编写代码又决定是否完成——就像自己给自己的考试打分。它存在以下问题：

1. **自我验证偏差**：没有外部检查
2. **隧道视野**：遗漏它一贯忽视的边界情况
3. **缺乏摩擦**：糟糕的想法不受质疑就通过了
4. **上下文漂移**：在任务过程中忘记需求

Ralph-Lisa Loop 应用了软件工程几十年前就发现的同一解决方案：代码审查。

### 两个 agent 会陷入无限循环吗？

不会。Deadlock 逃逸机制在 5 轮内未达成 consensus 时激活：

- **`[OVERRIDE]`**：在记录分歧的情况下继续推进
- **`[HANDOFF]`**：升级为人工决策

此外，`RL_CHECKPOINT_ROUNDS` 允许你在固定间隔暂停以进行人工审查。
