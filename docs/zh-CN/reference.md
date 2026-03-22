[English](../en/reference.md) | [日本語](../ja/reference.md) | [中文](../zh-CN/reference.md)
<!-- Translated from: docs/en/reference.md -->

# 命令参考

## 项目配置

| 命令 | 说明 |
|------|------|
| `ralph-lisa init [dir]` | 初始化项目（完整模式——创建角色文件 + 会话状态） |
| `ralph-lisa init --minimal [dir]` | 最小化初始化（仅会话状态，不创建项目文件） |
| `ralph-lisa uninit` | 从项目中移除 RLL |
| `ralph-lisa start "task"` | 设置任务并启动两个 agent（手动模式） |
| `ralph-lisa start --full-auto "task"` | 启动时无需权限确认 |
| `ralph-lisa auto "task"` | 使用 tmux 的自动模式 |
| `ralph-lisa auto --full-auto "task"` | 无需权限确认的自动模式 |
| `ralph-lisa stop` | 优雅关闭（停止 watcher、退出 agent、拆除 tmux） |
| `ralph-lisa stop --force` | 立即强制终止所有进程 |
| `ralph-lisa stop --no-archive` | 停止但不归档日志 |

## 回合控制

| 命令 | 说明 |
|------|------|
| `ralph-lisa whose-turn` | 检查当前是谁的回合 |
| `ralph-lisa check-turn` | `whose-turn` 的别名 |
| `ralph-lisa submit-ralph --file f.md` | Ralph 从文件提交（推荐） |
| `ralph-lisa submit-lisa --file f.md` | Lisa 从文件提交（推荐） |
| `ralph-lisa submit-ralph --stdin` | Ralph 通过 stdin 管道提交 |
| `ralph-lisa submit-lisa --stdin` | Lisa 通过 stdin 管道提交 |
| `ralph-lisa submit-ralph "[TAG] ..."` | Ralph 内联提交（已弃用） |
| `ralph-lisa submit-lisa "[TAG] ..."` | Lisa 内联提交（已弃用） |
| `ralph-lisa force-turn <agent>` | 手动设置回合为 `ralph` 或 `lisa` |

## 信息查询

| 命令 | 说明 |
|------|------|
| `ralph-lisa status` | 显示当前状态（任务、轮次、回合、最后操作） |
| `ralph-lisa read work.md` | 阅读 Ralph 的最新提交 |
| `ralph-lisa read review.md` | 阅读 Lisa 的最新审查 |
| `ralph-lisa read-review` | `read review.md` 的别名 |
| `ralph-lisa read review --round N` | 阅读第 N 轮的审查 |
| `ralph-lisa history` | 显示完整会话历史 |
| `ralph-lisa recap` | 上下文恢复摘要 |
| `ralph-lisa logs` | 列出会话日志 |
| `ralph-lisa logs cat [name]` | 查看指定的会话日志 |

## 流程控制

| 命令 | 说明 |
|------|------|
| `ralph-lisa step "phase-name"` | 进入新阶段（需要 consensus） |
| `ralph-lisa step --force "phase-name"` | 进入新阶段（跳过 consensus 检查） |
| `ralph-lisa update-task "new direction"` | 会话中途更新任务方向 |
| `ralph-lisa archive [name]` | 归档当前会话 |
| `ralph-lisa clean` | 清理会话状态 |

## Policy

| 命令 | 说明 |
|------|------|
| `ralph-lisa policy check <ralph\|lisa>` | 检查 agent 的最新提交（硬性门控） |
| `ralph-lisa policy check-consensus` | 检查双方是否都提交了 `[CONSENSUS]` |
| `ralph-lisa policy check-next-step` | 综合阶段前检查（consensus + policy） |

独立 policy 命令无论 `RL_POLICY_MODE` 设置如何，违规时始终以非零退出码退出。

## 诊断

| 命令 | 说明 |
|------|------|
| `ralph-lisa doctor` | 检查所有依赖项并报告状态 |
| `ralph-lisa doctor --strict` | 缺少依赖时退出码为 1（适用于 CI） |

## 测试

| 命令 | 说明 |
|------|------|
| `npm test` | 运行全部测试（单元 + 冒烟） |
| `npm run test:smoke` | 仅运行冒烟测试 |
| `ralph-lisa test-report` | 查看最新测试报告 |
| `ralph-lisa test-report --list` | 列出所有测试报告 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `RL_POLICY_MODE` | `warn` | Policy 检查模式：`off`、`warn`、`block` |
| `RL_CHECKPOINT_ROUNDS` | `0`（禁用） | 自动模式下每 N 轮暂停以进行人工审查 |
| `RL_LOG_MAX_MB` | `5` | 面板日志截断阈值，单位 MB（最小 1） |
| `RL_ESCALATION_L1` | `300` | Watcher L1 提醒延迟秒数（默认 5 分钟） |
| `RL_ESCALATION_L2` | `900` | Watcher L2 /check-turn 延迟秒数（默认 15 分钟） |
| `RL_ESCALATION_L3` | `1800` | Watcher L3 卡住通知延迟秒数（默认 30 分钟） |
| `RL_RALPH_GATE` | `false` | 启用提交前 gate 检查 |
| `RL_GATE_COMMANDS` | （空） | Gate 命令，pipe 分隔（如 `npm run lint\|npm test`） |
| `RL_GATE_MODE` | `warn` | Gate 失败模式：`warn` 或 `block` |
