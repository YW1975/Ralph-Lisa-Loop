[English](../en/testing.md) | [日本語](../ja/testing.md) | [中文](../zh-CN/testing.md)
<!-- Translated from: docs/en/testing.md -->

# 测试指南

Ralph-Lisa Loop 包含单元测试、冒烟测试和 policy 测试，用于验证 CLI 行为。

## 测试架构

| 层级 | 文件 | 覆盖范围 | 命令 |
|------|------|----------|------|
| 单元测试 | `cli/src/test/cli.test.ts` | 各 CLI 命令、policy 检查、状态管理 | `npm test` |
| Policy 测试 | `cli/src/test/policy.test.ts` | 提交验证规则（Test Results、file:line、tag） | `npm test` |
| Watcher 测试 | `cli/src/test/watcher.test.ts` | Watcher 状态机模拟（escalation、发送上限、consensus） | `npm test` |
| 状态测试 | `cli/src/test/state.test.ts` | 状态目录解析、项目根目录检测 | `npm test` |
| **冒烟测试** | `cli/src/test/smoke.test.ts` | 端到端多步骤 CLI 工作流 | `npm run test:smoke` |

## 运行测试

```bash
# 全部测试（单元 + 冒烟）
cd cli
npm test

# 仅冒烟测试
npm run test:smoke

# 使用干净环境（推荐用于 CI）
env -u RL_STATE_DIR -u TMUX -u TMUX_PANE npm test
```

## 测试报告

冒烟测试结果自动保存到 `.dual-agent/test-reports/`，带时间戳的报告文件。

```bash
# 查看最新报告
ralph-lisa test-report

# 列出所有报告
ralph-lisa test-report --list
```

每份报告包含环境信息（Node.js 版本、OS、当前 step/round）和最后 50 行测试输出。

## 冒烟测试场景

冒烟测试验证完整的多步骤工作流。每个场景使用隔离的临时目录。

### 场景 1：完整开发循环
**流程**：`init → [PLAN] → [PASS] → [CODE] → [PASS] → [CONSENSUS]`

验证：
- 每次提交后 Ralph 和 Lisa 之间的回合正确切换
- 历史记录所有提交
- 完整的 Plan→Code→Review→Consensus 循环无错误完成

### 场景 2：审查反馈循环
**流程**：`[CODE] → [NEEDS_WORK] → [FIX] → [PASS] → [CONSENSUS]`

验证：
- NEEDS_WORK 正确触发 FIX 流程
- 历史在多次迭代中保持时间顺序完整性
- 轮次计数器正确递增

### 场景 3：Policy 阻止模式
**流程**：`[CODE] 无 Test Results → 被阻止 → [CODE] 含 Test Results → 通过`

验证：
- 阻止模式（`RL_POLICY_MODE=block`）拒绝不合规的提交
- 被阻止的提交不推进回合
- 合规的重新提交成功

### 场景 4：Deadlock 检测与恢复
**流程**：`5× [NEEDS_WORK] → deadlock.txt → scope-update → 恢复`

验证：
- 连续 NEEDS_WORK 轮次达到阈值后触发 deadlock
- `deadlock.txt` 以正确的计数创建
- `scope-update` 清除 deadlock 标志并重置计数器
- 恢复后可继续工作

### 场景 5：阶段转换状态重置
**流程**：`[CONSENSUS] + [CONSENSUS] → step "phase-2" → 验证重置`

验证：
- 轮次重置为 1
- 阶段名称更新
- 回合重置为 ralph
- work.md 和 review.md 清除旧 tag

### 场景 6：历史时间顺序
**流程**：`[PLAN] → [NEEDS_WORK] → [FIX] → [PASS]`

验证：
- 所有提交按提交顺序出现在 history.md 中
- 无 tag 重排或重复

### 场景 7：Consensus 通知
**流程**：`[CONSENSUS] + [CONSENSUS] → 见证文件检查`

验证：
- 达成 consensus 时 `RL_NOTIFY_CMD` 被触发
- 通知消息包含 "complete" 或 "consensus"
- 未设置 `RL_NOTIFY_CMD` 时不触发通知

### 场景 8：Recap 上下文恢复
**流程**：`多次提交 → 阶段转换 → recap`

验证：
- `ralph-lisa recap` 显示当前阶段名称
- 最近的操作包含在 recap 输出中

## 冒烟测试执行记录

运行冒烟测试后，记录结果以便追溯：

```
Date: YYYY-MM-DD
Version: 0.3.12
Environment: macOS / Linux
Node.js: v22.x

Smoke Results:
  ✓ 场景 1：完整开发循环
  ✓ 场景 2：审查反馈循环
  ✓ 场景 3：Policy 阻止模式
  ✓ 场景 4：Deadlock 检测与恢复
  ✓ 场景 5：阶段转换状态重置
  ✓ 场景 6：历史时间顺序
  ✓ 场景 7：Consensus 通知
  ✓ 场景 8：Recap 上下文恢复

Total: 8/8 passed
Issues found:（无 / 列出问题）
```

## 影响测试的环境变量

| 变量 | 对测试的影响 |
|------|-------------|
| `RL_POLICY_MODE` | 大部分测试设为 `off`；policy 强制测试中设为 `block` |
| `RL_DEADLOCK_THRESHOLD` | deadlock 测试中设为 `5` 以加速（默认为 `8`） |
| `RL_NOTIFY_CMD` | 通知测试中设为 `cat >> witness-file` |
| `RL_STATE_DIR` | 测试中移除，防止解析真实项目状态 |
| `TMUX` | 移除以防止 tmux 会话干扰 |

## 扩展测试

### 添加新的冒烟场景

1. 在 `cli/src/test/smoke.test.ts` 中添加新的 `describe` 块
2. 使用 `createSuiteDir("name")` 进行隔离
3. 使用 `makeRun(TMP)` 和 `makeReadState(TMP)` 辅助函数
4. 遵循模式：init → 提交 → 断言

### 测试不同技术栈

RLL 冒烟测试验证的是 CLI 框架本身。对于项目特定的测试，在 `[PLAN]` 阶段确定测试方案：

- 项目需要哪些测试工具？（pytest、jest、flutter test 等）
- 它们是否已安装？（`ralph-lisa doctor` 可以帮助检查前提条件）
- 哪些冒烟场景覆盖了关键路径？
- 通过 `RL_RALPH_GATE` + `RL_GATE_COMMANDS` 配置自动提交前检查
