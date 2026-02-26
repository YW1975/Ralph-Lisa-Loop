[English](../en/changelog.md) | [日本語](../ja/changelog.md) | [中文](../zh-CN/changelog.md)
<!-- Translated from: docs/en/changelog.md -->

# 更新日志

## v0.3.x

### v0.3 新增功能

- **`update-task` 命令**：无需重启即可在会话中途更改任务方向。追加到 task.md 以保留历史记录。任务上下文会自动注入到提交内容和 watcher 触发消息中。
- **第 1 轮强制 `[PLAN]`**：Ralph 的第一次提交必须是 `[PLAN]`，让 Lisa 有机会在编码开始前验证理解是否正确。
- **Goal Guardian**：Lisa 现在在每次审查前都会阅读 task.md，并检查方向是否偏离。尽早发现目标偏差的优先级高于代码级审查。
- **事实验证**：Lisa 在声称某些内容"缺失"或"未实现"时，必须提供 `file:line` 证据。
- **Policy 层**：可配置的提交质量检查，支持 `warn`/`block` 模式。
- **Watcher v3**：即发即忘触发、30 秒冷却时间、checkpoint 系统（`RL_CHECKPOINT_ROUNDS`）、崩溃自动重启、可配置日志阈值（`RL_LOG_MAX_MB`）、心跳文件。
- **Deadlock 逃逸**：5 轮内未达成 consensus 时，agent 可以使用 `[OVERRIDE]` 或 `[HANDOFF]`。
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
