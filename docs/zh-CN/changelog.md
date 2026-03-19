[English](../en/changelog.md) | [日本語](../ja/changelog.md) | [中文](../zh-CN/changelog.md)
<!-- Translated from: docs/en/changelog.md -->

# 更新日志

## v0.3.x

### v0.3.12 新增功能

- **Watcher v5**：消息发送与响应验证解耦——修复了 watcher 向工作中的 agent 发送 14+ 条重复消息的洪水 bug。每轮发送上限（最多 2 次），基于 capture-pane 的空闲检测（不依赖 pipe-pane），pipe-pane 交叉验证自愈，被动 post-send 监控。
- **强制测试执行**：`[PLAN]` 必须包含测试计划（测试命令 + 覆盖范围）。`[CODE]`/`[FIX]` 的 Test Results 必须包含退出码或通过/失败数量。接受显式 `Skipped:` + 理由。Lisa 必须在 review 时复测。
- **Escalation 时间调整**：默认从 2m/5m/10m 延长为 5m/15m/30m。可通过 `RL_ESCALATION_L1`、`RL_ESCALATION_L2`、`RL_ESCALATION_L3` 环境变量自定义。
- **UX 措辞优化**：所有角色模板和命令文件中的 "STOP immediately" / "MUST STOP" 替换为 "等待反馈"。
- **Subagent 建议**：角色模板新增建议——对耗时任务使用 subagent 避免阻塞协作循环。

### v0.3.11 新增功能

- **`ralph-lisa stop` 命令**：优雅关闭 auto 模式——停止 watcher，向 agent 面板发送 `/exit`，拆除 tmux 会话。支持 `--force` 立即强制终止，`--no-archive` 跳过日志归档。
- **Watcher v4**：基于轮次的变更检测，修复了双方 agent 互相等待的死锁问题。使用单调递增的轮次号替代轮次值，确保长时间投递期间的双翻转（A→B→A）始终被检测到。
- **新轮次绕过冷却**：冷却计时器不再抑制新轮次的通知——仅限同轮次的重复投递被节流。
- **带轮次边界的共识抑制**：共识检测现在追踪检测时的轮次，防止 `next-step` 后过期的共识阻塞通知。
- **崩溃恢复**：Watcher 状态（SEEN_ROUND、ACKED_ROUND、DELIVERY_PENDING）持久化到 `.watcher_state` 文件。异常退出时保留状态，wrapper 重启时重放。优雅 `stop` 时清除文件。
- **升级状态机**：多级卡住检测（L1 提醒 2分钟、L2 斜杠命令 5分钟、L3 用户通知 10分钟）。上下文限制检测直接跳到 L3。投递失败不提升升级级别。

### 错误修复（v0.3.11）

- 修复 Watcher 死锁：长时间投递期间轮次值比较遗漏双翻转，导致两个 agent 同时等待对方。
- 修复轮次变更后共识抑制仍阻塞通知的问题。
- 修复 30 秒窗口内冷却计时器抑制合法新轮次通知的问题。
- 崩溃恢复：异常退出时不再删除 watcher 状态（仅在优雅停止时删除）。

### v0.3 新增功能

- **`update-task` 命令**：无需重启即可在会话中途更改任务方向。追加到 task.md 以保留历史记录。任务上下文会自动注入到提交内容和 watcher 触发消息中。
- **第 1 轮强制 `[PLAN]`**：Ralph 的第一次提交必须是 `[PLAN]`，让 Lisa 有机会在编码开始前验证理解是否正确。
- **Goal Guardian**：Lisa 现在在每次审查前都会阅读 task.md，并检查方向是否偏离。尽早发现目标偏差的优先级高于代码级审查。
- **事实验证**：Lisa 在声称某些内容"缺失"或"未实现"时，必须提供 `file:line` 证据。
- **Policy 层**：可配置的提交质量检查，支持 `warn`/`block` 模式。
- **Watcher v3**：即发即忘触发、30 秒冷却时间、checkpoint 系统（`RL_CHECKPOINT_ROUNDS`）、崩溃自动重启、可配置日志阈值（`RL_LOG_MAX_MB`）、心跳文件。
- **Deadlock 检测**：连续 8 轮 `[NEEDS_WORK]` 后，watcher 自动暂停，用户通过 `scope-update` 或 `force-turn` 介入。
- **最小化初始化**：`ralph-lisa init --minimal` 仅创建会话状态（零项目文件）。
- **`doctor` 命令**：使用 `ralph-lisa doctor` 验证所有依赖项。

### 错误修复（v0.3）

- 修复了生成的 `watcher.sh` 中的 case 模式转义问题——JS 模板字面量默默吞掉了 case 模式中的反斜杠，导致 watcher 在自动模式下每次启动时都崩溃循环。
- 修复了 `check-next-step` 的 consensus 逻辑，使其与 `step` 命令行为一致。
- 修复了测试隔离问题：在测试子进程中屏蔽 tmux 环境变量。
- 增强了 watcher 的 send-keys 传递机制，以兼容 TUI agent。

### 未能解决的问题

分享失败与分享成果同样重要：

- **Agent 崩溃尚无自动恢复机制。** 一旦 agent 崩溃（可能由于上下文过长或系统资源耗尽），循环就会停止，你必须手动重启。目前尚无自愈能力。
- **Agent 之间的状态不同步。** 早期版本中 Lisa 曾失控——她自己写代码而不是审查，导致状态混乱。现在已大幅改善，但教训依然深刻。
- **没有领域判断力，循环就毫无用处。** 两个 AI 会愉快地就一个糟糕的设计达成一致。这不是自主开发——这是结构化的 AI 辅助开发。人类仲裁者不是可选的。
- **Git 纪律不可妥协。** 小提交、清晰的信息、频繁提交。当出问题时（一定会出问题的），你唯一的安全网是能够 `git reset` 到已知的良好状态。
