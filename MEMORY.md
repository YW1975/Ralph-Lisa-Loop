# Purpur 项目经验记录

## 复盘总结 (2026-02-05)

### 起因
花费一天一夜调试 ACP 流式输出 Bug，根因是没有认真参考 AionUi 的实现。

### 发现的问题

| # | 问题 | 优先级 | 状态 |
|---|------|--------|------|
| 1 | 缺少调研阶段 | P0 | ✅ V3 Phase 1 ([RESEARCH] 标签) |
| 2 | 测试责任模糊 | P1 | ✅ V3 Phase 1 (Test Results 要求) |
| 3 | Ralph-Lisa 协作不平等 | P1 | ✅ V3 Phase 1 ([CHALLENGE] 标签) |
| 4 | 基础记忆能力缺失 | P1 | 待实施 |
| 5 | 项目级 Skill 侵入性 | P2 | ✅ V3 Phase 3 (plugin + 零侵入) |
| 6 | 用户介入机制 | P2 | 待与 Codex 讨论 |
| 7 | 回退/决策记录/复盘机制 | P2 | 待实施 |

### 核心改进方向
1. **流程增强**: ✅ 增加 [RESEARCH] 标签，强制调研参考实现
2. **质量保障**: ✅ 明确测试要求，Policy warn/block 检查
3. **协作优化**: ✅ Ralph-Lisa 平等讨论，[CHALLENGE] 机制
4. **基础设施**: 待实施 — 记忆/文档跟随能力
5. **易用性**: ✅ npm 全局 CLI + Claude Code plugin + Codex 全局 skills
6. **落地方式**: ✅ 角色定义/流程约束 + Policy 层（io.sh 保持纯通信层）

---

## V3 实施记录 (2026-02-06 ~ 2026-02-07)

### Phase 1: 模板与标签规范 ✅

提交: `4d099b5 V3 Phase 1`

改动:
- templates/roles/ralph.md — 加入 [RESEARCH]、[CHALLENGE]、Test Results、回应规则
- templates/roles/lisa.md — 加入 [CHALLENGE]、更新 checklist、advisory 语义
- io.sh — VALID_TAGS 扩展
- templates/claude-commands/submit-work.md — 新标签
- templates/codex-skills/submit-review.md — 新标签 + 路径修复
- README.md — 标签表更新

### Phase 2: npm CLI + Policy warn ✅

提交: `ea66dab V3 Phase 2+3`

改动:
- cli/ — ralph-lisa-loop npm 包 (Node/TS, 零外部依赖)
  - 14 个 CLI 命令: init, uninit, start, auto, submit-ralph, submit-lisa, whose-turn, status, read, step, history, archive, clean, policy
  - Policy warn/block 模式 (RL_POLICY_MODE 环境变量)
  - 15 个单元测试 (state + policy)
- 所有模板 `./io.sh` → `ralph-lisa`

### Phase 3: 插件化 + 零侵入 ✅

提交: `ea66dab V3 Phase 2+3` (同上)

改动:
- plugin/ — Claude Code plugin (skills + hooks + agents)
- codex-global/ — Codex 全局配置模板 (config.toml + skills)
- Policy block 模式已实现

---

## 2026-02-05 复盘：ACP 流式输出 Bug

### 问题概述
花费一天一夜调试 Jarvis Desktop 的 Gemini 流式响应问题，最终发现是 AcpAgent.ts 解析 ACP 数据格式错误。

### 根本原因
- AcpAgent.ts 注释写着 "Based on AionUI's AcpConnection"
- 但实际编码时没有认真参考 AionUi 的实现
- 错误地假设数据路径是 `params.content`，实际应该是 `params.update.content.text`

### AionUi 正确实现位置
- 类型定义: `AionUi/src/types/acpTypes.ts:478-488` (AgentMessageChunkUpdate)
- 解析逻辑: `AionUi/src/agent/acp/AcpAdapter.ts:47-49, 138-143`
- 连接处理: `AionUi/src/agent/acp/AcpConnection.ts:416`

### Ralph-Lisa 流程盲点
1. 计划阶段没有要求先调研参考实现
2. 编码时没有对照 AionUi 的类型定义
3. Review 只检查代码逻辑，没有验证数据格式假设是否正确
4. 没有早期集成测试验证实际数据

### 待改进项
- [x] 增加 [RESEARCH] 调研标签 ✅ V3 Phase 1
- [x] 调研需引用具体文件和行号 ✅ V3 Phase 1 (ralph.md 模板)
- [x] Lisa 审查时检查调研是否充分 ✅ V3 Phase 1 (lisa.md checklist)
- [x] Policy 检查 [RESEARCH] 内容充分性 ✅ V3 Phase 2

### 教训
> 花 30 分钟认真读参考代码，能省下一天一夜调试。
> 流程检查的是"代码写得对不对"，无法检查"理解是否正确"。

---

## 2026-02-05 复盘：Ralph-Lisa 协作动态问题

### 观察到的问题
Ralph 对 Lisa 的反馈几乎都是直接接受，缺乏真正的讨论和辩论。

### 不健康的模式
```
Lisa: [NEEDS_WORK] 你应该这样改...
Ralph: [FIX] 好的，改了
Lisa: [PASS]
```
这是单向审批，不是平等协作。

### 问题根源
1. **角色不平等**: Lisa 是"审查者"，Ralph 是"被审查者"
2. **隐性权威**: Lisa 的意见被默认为更正确
3. **进度压力**: Ralph 倾向接受以加快进度，而不是讨论
4. **缺乏激励**: 挑战 Lisa = 更多轮次 = 更慢，没有激励机制鼓励辩论

### 待改进项
- [x] Ralph 收到 [NEEDS_WORK] 时必须说明理由 ✅ V3 Phase 1
- [x] 引入 [CHALLENGE] 标签 ✅ V3 Phase 1
- [x] Lisa 的意见标记为 advisory ✅ V3 Phase 1
- [ ] 分歧时由用户仲裁 — 待实施（用户介入机制）

### 教训
> 流程设计把 Lisa 放在"最终裁决者"位置，而不是"平等讨论者"。
> 快速达成共识 ≠ 高质量共识。真正的协作需要有建设性的冲突。

---

## 2026-02-05 复盘：测试责任不清晰

### 待改进项
- [x] 明确测试要求：[CODE]/[FIX] 必含 Test Results ✅ V3 Phase 1
- [x] Lisa 审查时检查测试状态 ✅ V3 Phase 1 (checklist)
- [x] Policy 检查 Test Results 存在性 ✅ V3 Phase 2
- [ ] 涉及外部协议/API 时，必须先做集成验证 — 依赖项目具体情况

### 教训
> 如果 Ralph 在编码后运行过集成测试，应该能立刻发现问题。
> "写完代码就提交"跳过了最关键的验证环节。

---

## 2026-02-05 复盘：项目级 Skill 的侵入性问题

### 最终解决方案 ✅ V3 Phase 2+3

```
Phase 2: npm 全局 CLI
  npm i -g ralph-lisa-loop
  ralph-lisa init / uninit / submit-ralph / ...

Phase 3: 插件 + 零侵入
  Claude Code plugin (plugin/): skills + hooks + agents
  Codex 全局配置 (codex-global/): config.toml + skills
  项目目录零侵入（仅 .dual-agent/ 运行时状态）
```

---

## 2026-02-06 讨论：侵入性问题与分发架构（Claude + Codex 三方讨论）

### 背景
当前 `init.sh` 往目标项目注入 ~12 个文件（CLAUDE.md 追加、CODEX.md、io.sh、.claude/commands/、.codex/skills/、.dual-agent/），没有卸载机制。

### 各家 CLI 插件/扩展能力调研

| 能力 | Claude Code | Codex CLI | Gemini CLI |
|------|------------|-----------|------------|
| 全局角色注入 | `~/.claude/CLAUDE.md` | `developer_instructions` in config.toml | `~/.gemini/GEMINI.md` |
| 全局自定义命令 | `~/.claude/skills/` | `~/.codex/skills/` | `~/.gemini/commands/*.toml` |
| 工具执行钩子 | 12 种事件，可拦截/修改 | **只有 1 种** (notify) | 11 种事件，可拦截/修改 |
| 插件打包分发 | `.claude-plugin/` + 市场 | **无** | `gemini-extension.json` + GitHub |

### 决策：npm 包 + 插件架构

**不考虑向后兼容** — 旧项目重新 `ralph-lisa init` 即可。

**npm + io.sh 不做两套实现** — npm 包就是 io.sh 的升级版，核心逻辑只有一份。

---

## 2026-02-05 讨论：io.sh 职责边界（与 Claude 讨论）

### 结论
`io.sh` (现为 `ralph-lisa` CLI) 是交互层（"邮差"），只负责消息传递、回合管理、历史记录与最小格式校验。
**不应**执行业务流程判断。业务检查由 Policy 层负责。

---

## 2026-02-05 提案：独立 Policy 层（与 Codex 讨论）

### 实施状态 ✅

已在 V3 Phase 2 中实现：
- `ralph-lisa policy check <ralph|lisa>` 命令
- 环境变量 `RL_POLICY_MODE=off|warn|block`
- 集成到 `submit-ralph` / `submit-lisa` 命令中

### 规则
- Ralph [CODE]/[FIX] 必须包含 Test Results 段落
- Ralph [RESEARCH] 必须有实质内容（至少 2 个字段或等价摘要）
- Lisa [PASS]/[NEEDS_WORK] 必须给出至少 1 条理由

---

## 未实施项（后续版本）

| 项目 | 优先级 | 备注 |
|------|--------|------|
| 基础记忆能力 | P1 | 会话记录、决策追溯、文档同步 |
| 用户介入机制 | P2 | /pause, /inject, /decide, /redirect |
| 回退/复盘机制 | P2 | [BACK_TO_RESEARCH], [RETRO] |
| Gemini CLI 替代 Codex | P3 | 有完整 extension 系统 |
| Claude Code plugin 市场分发 | P3 | 待评估 |
