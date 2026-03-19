[English](../en/guide.md) | [日本語](../ja/guide.md) | [中文](../zh-CN/guide.md)
<!-- Translated from: docs/en/guide.md -->

# 用户指南

Ralph-Lisa Loop 强制将代码生成和代码审查严格分离。一个 agent 负责编写，另一个负责审查，双方在回合制循环中交替进行。架构决策由你来做。

## 前提条件

| 依赖项 | 用途 | 安装方式 |
|--------|------|----------|
| [Node.js](https://nodejs.org/) >= 18 | CLI | 参见 nodejs.org |
| [Claude Code](https://claude.ai/code) | Ralph（开发者） | `npm i -g @anthropic-ai/claude-code` |
| [Codex CLI](https://github.com/openai/codex) | Lisa（审查者） | `npm i -g @openai/codex` |
| tmux | 自动模式 | `brew install tmux`（macOS）/ `apt install tmux`（Linux） |
| fswatch / inotify-tools | 更快的回合检测 | `brew install fswatch`（macOS）/ `apt install inotify-tools`（Linux） |

tmux 和 fswatch/inotify-tools 仅在自动模式下需要。手动模式只需 Node.js、Claude Code 和 Codex 即可运行。

运行 `ralph-lisa doctor` 验证你的环境配置：

```bash
ralph-lisa doctor
```

使用 `--strict` 可在缺少依赖时返回非零退出码（适用于 CI）：

```bash
ralph-lisa doctor --strict
```

## 安装

```bash
npm i -g ralph-lisa-loop
```

## 项目配置

### 完整初始化

```bash
cd your-project
ralph-lisa init
```

这将创建角色文件和会话状态：

```
your-project/
├── CLAUDE.md              # Ralph 的角色（由 Claude Code 自动加载）
├── CODEX.md               # Lisa 的角色（通过 .codex/config.toml 加载）
├── .claude/
│   └── commands/          # Claude 斜杠命令
├── .codex/
│   ├── config.toml        # Codex 配置
│   └── skills/            # Codex 技能
└── .dual-agent/           # 会话状态
    ├── turn.txt           # 当前回合
    ├── task.md            # 任务目标（通过 update-task 更新）
    ├── work.md            # Ralph 的提交内容
    ├── review.md          # Lisa 的提交内容
    └── history.md         # 完整历史记录
```

### 最小化初始化（零侵入）

```bash
ralph-lisa init --minimal
```

仅创建 `.dual-agent/` 会话状态目录——不创建项目级文件（不生成 CLAUDE.md、CODEX.md 或命令文件）。需要：

- 已安装 Claude Code 插件（通过 hooks 提供 Ralph 角色）
- Codex 全局配置位于 `~/.codex/`（提供 Lisa 角色）

`start` 和 `auto` 命令在两种初始化模式下均可使用。

### 从项目中移除

```bash
ralph-lisa uninit
```

## 你的第一个会话

### 第 1 步：启动任务

```bash
ralph-lisa start "implement login feature"
```

这会将任务写入 `.dual-agent/task.md` 并将回合设置为 Ralph。

### 第 2 步：Ralph 工作（终端 1）

```bash
ralph-lisa whose-turn                    # → "ralph"
# ... 进行你的工作 ...
# 将提交内容写入 .dual-agent/submit.md
ralph-lisa submit-ralph --file .dual-agent/submit.md
```

第 1 轮必须是 `[PLAN]` 提交——这让 Lisa 有机会在编码开始前验证对任务的理解。

### 第 3 步：Lisa 审查（终端 2）

```bash
ralph-lisa whose-turn                    # → "lisa"
ralph-lisa read work.md                  # 阅读 Ralph 的提交
# ... 将审查内容写入 .dual-agent/submit.md ...
ralph-lisa submit-lisa --file .dual-agent/submit.md
```

### 第 4 步：迭代直到达成 consensus

Ralph 阅读 Lisa 的审查并回应：

```bash
ralph-lisa read review.md                # 阅读 Lisa 的反馈
# 用 [FIX]、[CHALLENGE]、[DISCUSS] 等回应
ralph-lisa submit-ralph --file .dual-agent/submit.md
```

循环持续进行，直到双方达成 `[CONSENSUS]`。

### 第 5 步：进入下一阶段

达成 consensus 后，进入下一个阶段：

```bash
ralph-lisa step "phase-2-implementation"
```

## 启动模式

### 手动模式（`start`）

```bash
ralph-lisa start "implement login feature"
```

打开两个终端窗口——一个给 Ralph（Claude Code），一个给 Lisa（Codex）。你需要手动在各自的终端中触发 agent。

### 自动模式（`auto`）

```bash
ralph-lisa auto "implement login feature"
```

创建一个包含两个面板的 tmux 会话，并启动后台 watcher（v5）。watcher 监控 `.dual-agent/turn.txt`，自动触发当前回合的 agent。

### 全自动模式

```bash
ralph-lisa auto --full-auto "implement login feature"
```

| | `auto` | `auto --full-auto` |
|--|--------|-------------------|
| Ralph (Claude) | `claude` | `claude --dangerously-skip-permissions` |
| Lisa (Codex) | `codex` | `codex --full-auto` |
| 权限提示 | 每次文件/命令操作需确认 | 跳过——agent 直接执行 |

当你信任两个 agent 时使用 `--full-auto`。不加时，权限提示可能导致 watcher 误判 agent 卡住。

`start` 也支持 `--full-auto`，效果相同（无 watcher）。

### 断点续跑（无 task 启动）

```bash
ralph-lisa auto                    # 不指定 task
```

不指定 task 时，会话从上次状态恢复——保留 turn、round、history 等所有会话文件。适用于崩溃后恢复或重新连接中断的会话。

### Checkpoint 系统

每 N 轮暂停以进行人工审查：

```bash
export RL_CHECKPOINT_ROUNDS=5
ralph-lisa auto "task"
```

### Watcher v5 行为

- **发送上限**：每轮最多 2 次触发消息（防止消息洪水）
- **Capture-pane 监控**：通过终端内容 diff 检测 agent 活动（不依赖 pipe-pane 日志）
- **Pipe-pane 自愈**：交叉对比面板活动和日志增长——pipe 死亡时自动重建
- **可配置的 escalation**：L1 提醒 5 分钟，L2 `/check-turn` 15 分钟，L3 用户通知 30 分钟（可通过 `RL_ESCALATION_L1/L2/L3` 自定义）
- **30 秒冷却时间**，防止工作期间重复触发
- **崩溃自动重启**（会话保护）
- **心跳文件**位于 `.dual-agent/.watcher_heartbeat`，用于存活检查
- **可配置的日志阈值**：`RL_LOG_MAX_MB`（默认 5，最小 1）

### 长时间任务

对于耗时操作（大规模代码搜索、批量测试运行、CI 等待等），建议 agent 使用 subagent 或后台任务并行处理，汇总结果后再提交。避免阻塞协作循环。

## Tag 系统

每次提交的第一行都需要一个 tag：

| Ralph 的 Tag | Lisa 的 Tag | 共用 |
|--------------|-------------|------|
| `[PLAN]` | `[PASS]` | `[CHALLENGE]` |
| `[RESEARCH]` | `[NEEDS_WORK]` | `[DISCUSS]` |
| `[CODE]` | | `[QUESTION]` |
| `[FIX]` | | `[CONSENSUS]` |

### Tag 详解

- **`[PLAN]`**：第 1 轮必须使用。在编码前概述方案。必须包含测试计划（测试命令 + 覆盖范围）。
- **`[RESEARCH]`**：当涉及参考实现、协议或外部 API 时，编码前必须使用。必须包含经过验证的证据（file:line、命令输出）。
- **`[CODE]`**：代码实现。必须包含 Test Results 部分。
- **`[FIX]`**：基于反馈的错误修复或修订。必须包含 Test Results 部分。
- **`[PASS]`**：Lisa 批准提交。
- **`[NEEDS_WORK]`**：Lisa 要求修改。必须包含至少一个原因。
- **`[CHALLENGE]`**：不同意另一方 agent 的建议，提供反驳论点。
- **`[DISCUSS]`**：一般性讨论或澄清。
- **`[QUESTION]`**：请求澄清。
- **`[CONSENSUS]`**：确认同意，关闭当前议题。

## 提交规则

### 第 1 轮必须是 [PLAN]

Ralph 的第一次提交必须是 `[PLAN]`。这让 Lisa 有机会在编写任何代码之前验证对任务的理解。计划必须包含**测试计划**：
- 测试命令（如 `pytest -x`、`npm test`、`go test ./...`）
- 预期测试覆盖范围
- 如果没有测试框架，说明验证方式

### 必须包含 Test Results（强制执行）

`[CODE]` 和 `[FIX]` 提交必须包含 Test Results 部分，且必须是**实际执行的结果**——不可编造：

```markdown
### Test Results
- Test command: npm test
- Exit code: 0
- Result: 150/150 passed
- New tests: 2 added (auth.test.ts, login.test.ts)
```

Policy 层会检查 Test Results 是否包含退出码或通过/失败数量。如果跳过测试，需要显式的 `Skipped:` 行和理由：

```markdown
### Test Results
- Skipped: 纯配置变更，无可测逻辑
```

**Lisa 必须自己运行测试命令**验证结果。可疑或编造的结果会被拒绝。

### 编码前先研究

当任务涉及参考实现、协议或外部 API 时，先提交 `[RESEARCH]` 并附带经过验证的证据：

```markdown
[RESEARCH] API integration research

- Endpoint: POST /api/v2/auth (docs:line 45)
- Auth: Bearer token in header (verified via curl)
- Response: { token, expires_in } (tested locally)
```

### 禁止无说明的接受

当回应 `[NEEDS_WORK]` 时：
- **如果你同意**：解释为什么 Lisa 是对的，然后提交 `[FIX]`
- **如果你不同意**：使用 `[CHALLENGE]` 提供反驳论点
- **绝不**提交没有说明的 `[FIX]`

## Consensus 协议

Lisa 的裁定是**建议性的，而非权威性的**。Ralph 可以接受、质疑或请求澄清。

阶段转换需要以下关闭组合之一：
- `[CONSENSUS]` + `[CONSENSUS]` — 双方同意
- `[PASS]` + `[CONSENSUS]` — Lisa 通过，Ralph 确认
- `[CONSENSUS]` + `[PASS]` — Ralph 确认，Lisa 通过

典型流程：
1. Lisa 提交 `[PASS]`
2. Ralph 提交 `[CONSENSUS]` — 议题关闭

### Deadlock 逃逸

连续 8 轮 `[NEEDS_WORK]`（Lisa 持续要求修改）后，watcher 自动暂停并标记 deadlock。选项：
- **`ralph-lisa scope-update`**：重新定义任务范围打破循环
- **`ralph-lisa force-turn`**：手动覆盖回合
- **人工介入**：用户决定如何继续（接受、拒绝或重新定向）

不会出现无限循环。不会出现卡死状态。

## Policy 层

Policy 层验证提交质量。

### 内联检查

在 `submit-ralph` / `submit-lisa` 时自动应用：

```bash
# 警告模式（默认）— 打印警告，不阻止提交
export RL_POLICY_MODE=warn

# 阻止模式 — 拒绝不合规的提交
export RL_POLICY_MODE=block

# 禁用
export RL_POLICY_MODE=off
```

### 独立检查

用于脚本和 hooks — 无论 `RL_POLICY_MODE` 设置如何，违规时始终以非零退出码退出：

```bash
ralph-lisa policy check ralph           # 检查 Ralph 的最新提交
ralph-lisa policy check lisa            # 检查 Lisa 的最新提交
ralph-lisa policy check-consensus       # 双方是否都提交了 [CONSENSUS]？
ralph-lisa policy check-next-step       # 综合检查：consensus + 所有 policy 检查
```

### Policy 规则

- Ralph 的 `[PLAN]` 必须包含测试计划
- Ralph 的 `[CODE]`/`[FIX]` 必须包含 "Test Results" 部分，且含退出码或通过/失败数量（或显式 `Skipped:`）
- Ralph 的 `[RESEARCH]` 必须有实质性内容，含 `Verified:` 或 `Evidence:` 标记
- Lisa 的 `[PASS]`/`[NEEDS_WORK]` 必须包含至少 1 个原因和 file:line 引用
- `[NEEDS_WORK]` 后 Ralph 必须用 `[FIX]`/`[CHALLENGE]`/`[DISCUSS]`/`[QUESTION]` 回应

## 会话中途控制

### 更新任务方向

无需重启即可改变方向：

```bash
ralph-lisa update-task "switch to REST instead of GraphQL"
```

追加内容到 task.md（保留历史记录）。任务上下文会自动注入到提交内容和 watcher 触发消息中。

### 进入新阶段

达成 consensus 后，进入新阶段：

```bash
ralph-lisa step "phase-2"              # 需要 consensus
ralph-lisa step --force "phase-2"      # 跳过 consensus 检查
```

### 强制切换回合

用于卡死状态的手动 override：

```bash
ralph-lisa force-turn ralph
ralph-lisa force-turn lisa
```

### 归档与清理

```bash
ralph-lisa archive [name]              # 归档当前会话
ralph-lisa clean                       # 清理会话状态
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `RL_POLICY_MODE` | `warn` | Policy 检查模式：`off`、`warn`、`block` |
| `RL_CHECKPOINT_ROUNDS` | `0`（禁用） | 自动模式下每 N 轮暂停以进行人工审查 |
| `RL_LOG_MAX_MB` | `5` | 面板日志截断阈值，单位 MB（最小 1） |
| `RL_ESCALATION_L1` | `300` | Watcher L1 提醒延迟秒数（默认 5 分钟） |
| `RL_ESCALATION_L2` | `900` | Watcher L2 /check-turn 延迟秒数（默认 15 分钟） |
| `RL_ESCALATION_L3` | `1800` | Watcher L3 卡住通知延迟秒数（默认 30 分钟） |
| `RL_RALPH_GATE` | `false` | 启用提交前 gate 检查（lint、测试） |
| `RL_GATE_COMMANDS` | （空） | Gate 命令，pipe 分隔（如 `npm run lint\|npm test`） |
| `RL_GATE_MODE` | `warn` | Gate 失败模式：`warn` 或 `block` |

## 提示与最佳实践

### Git 纪律

小提交、清晰的信息、频繁提交。当出问题时（一定会出问题的），你唯一的安全网是能够 `git reset` 到已知的良好状态。

### Agent 崩溃

Agent 崩溃目前尚无自动恢复机制。如果一个 agent 崩溃（可能由于上下文过长或系统资源耗尽），你必须手动重启。请监控 tmux 会话并根据需要重启。

### 上下文管理

长时间的会话会填满上下文窗口。使用 `ralph-lisa step` 将大型任务分解为多个步骤。保持每个任务的专注性，并使用 `update-task` 来重新定向，而非从头开始。

### 何时使用 RLL

**适合的场景**：多步骤实现、架构决策、影响用户/安全的代码、需求不明确的情况。

**过于大材小用**：单行修复、经过充分测试的重构、个人脚本、紧急热修复。

### 人类仲裁者

两个 AI 会愉快地就一个糟糕的设计达成一致。Ralph-Lisa Loop 是结构化的 AI 辅助开发，而非自主开发。人类仲裁者不是可选的。
