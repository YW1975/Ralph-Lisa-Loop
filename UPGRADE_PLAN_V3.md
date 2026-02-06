# Ralph-Lisa Loop 升级方案 V3

## 背景

2026-02-05 复盘发现的问题：花费一天一夜调试 ACP 流式输出 Bug，根因是没有认真参考 AionUi 的实现。

## 问题总结

| # | 问题 | 根因 |
|---|------|------|
| 1 | 缺少调研阶段 | 流程没有要求先研究参考实现 |
| 2 | 测试责任模糊 | 规范存在但没有强调，提交时不要求测试结果 |
| 3 | Ralph-Lisa 协作不平等 | Ralph 倾向直接接受 Lisa 反馈，缺乏真正讨论 |
| 4 | 规范已写但未落地 | 设计文档有，但执行时被跳过 |
| 5 | 项目侵入性高 | init.sh 往每个项目注入 ~12 个文件，无卸载机制 |

## 设计原则

### io.sh 职责边界 (已确认)

```
io.sh 只负责交互层：
✅ 传递消息 (submit-ralph, submit-lisa)
✅ 管理回合 (whose-turn)
✅ 记录历史 (history.md)
✅ 基本格式校验 (标签存在性)

io.sh 不负责业务判断：
❌ 判断是否达成共识
❌ 判断是否可以进入下一步
❌ 校验测试是否通过
❌ 校验参考实现引用
```

### 规范落地方式

1. **角色 Prompt**: 规范内化到 Ralph/Lisa 的角色定义
2. **Policy 层**: 独立的规则检查器，可选启用，不改 io.sh

### 标签语义表

> **[RESEARCH] 和 [CHALLENGE] 都是提交标签**，与 [PLAN]、[CODE]、[FIX] 同级，作为提交内容的首行标签使用。不是"阶段"或"段落标记"。

| 标签 | 角色 | 含义 | 使用场景 |
|------|------|------|---------|
| `[PLAN]` | Ralph | 提交计划 | 任务开始、方案设计 |
| `[RESEARCH]` | Ralph | 提交调研结果 | 涉及参考实现/协议/外部 API 时，编码前提交 |
| `[CODE]` | Ralph | 提交代码实现 | 编码完成 |
| `[FIX]` | Ralph | 提交修复 | 响应 Lisa 的 NEEDS_WORK |
| `[CHALLENGE]` | Ralph/Lisa | 明确反驳对方 | 不同意对方建议，提出反对理由 |
| `[DISCUSS]` | Ralph/Lisa | 一般讨论/澄清 | 需要更多信息、想法交流 |
| `[QUESTION]` | Ralph/Lisa | 提问 | 需要澄清 |
| `[CONSENSUS]` | Ralph/Lisa | 确认共识 | 双方同意，准备进入下一步 |
| `[PASS]` | Lisa | 审查通过 | 工作符合要求 |
| `[NEEDS_WORK]` | Lisa | 需要修改 | 发现问题 |

---

## 升级目标

### V3 版本目标

1. 增加 [RESEARCH] 提交标签
2. 明确测试要求
3. 改善 Ralph-Lisa 协作动态（[CHALLENGE] 标签）
4. 引入 Policy 层 (warn 模式)
5. 发布 npm 包，减少项目侵入性
6. 利用 Claude Code plugin / Codex 全局 skills 实现零侵入

> **V3 是多阶段路线图**：Phase 1 为最小可执行落地，Phase 2/3 逐步推进 npm 与插件化。

### 不在本版本范围

- 用户介入机制 (P2, 待讨论)
- Policy block 模式 (Phase 3)
- Gemini CLI 替代 Codex (待评估)

---

## 具体改动

### 0. 标签更新

**新增标签:**

| 标签 | 含义 | 使用场景 |
|------|------|---------|
| `[CHALLENGE]` | 明确反驳 | 不同意对方建议，提出反对理由 |
| `[RESEARCH]` | 调研结果 | 涉及参考实现/协议/外部 API 时 |

- 目的：`[CHALLENGE]` 显式鼓励 Ralph 反驳 Lisa；`[RESEARCH]` 强制编码前调研
- `[DISCUSS]` 继续保留，与 `[CHALLENGE]` 并存（有不同语义）
- `io.sh`（或未来的 `ralph-lisa` CLI）扩展 `VALID_TAGS`，接受 `[CHALLENGE]` 和 `[RESEARCH]`

### 1. ralph.md 更新

**新增 [RESEARCH] 标签使用说明:**

```markdown
## 调研 (涉及参考实现、协议、外部 API 时必须)

在编码前，先提交调研结果：

[RESEARCH] 调研完成

参考实现: 文件路径:行号
关键类型: 类型名 (文件:行号)
数据格式: 实际验证的结构
验证方式: 如何确认假设正确
```

**新增 [CHALLENGE] 标签:**

```markdown
| `[CHALLENGE]` | 不同意 Lisa 的建议，提出反驳 |
```

**明确测试要求:**

```markdown
## 提交要求

[CODE] 或 [FIX] 提交必须包含：

### Test Results
- 测试命令: `npm test` / `pytest` / ...
- 结果: 通过 / 失败 (原因)
- 如果跳过测试，必须说明理由
```

> Phase 1 为流程规范（文本约束），非硬性阻断。Phase 2 由 Policy warn 提示。

**回应 Lisa 的规则:**

```markdown
## 回应 Lisa 的 [NEEDS_WORK]

收到 [NEEDS_WORK] 时，必须说明理由：
- 如果同意: 说明为什么 Lisa 是对的
- 如果不同意: 用 [CHALLENGE] 提出反驳

禁止无理由直接 [FIX]。
```

### 2. lisa.md 更新

**Review Checklist 更新:**

```markdown
### Review Checklist
- [ ] Functionality complete
- [ ] Logic correct
- [ ] Edge cases handled
- [ ] Tests adequate
- [ ] **Test Results 包含在提交中** (新增)
- [ ] **调研充分 (如果涉及参考实现/协议)** (新增)
```

**强化 Advisory 表述:**

```markdown
## Your Verdict is Advisory

你的 [PASS] 或 [NEEDS_WORK] 是专业建议，不是命令。

- Ralph 可以同意或反驳
- 如果 Ralph 用 [CHALLENGE] 反驳，你必须认真考虑
- 共识需要双方真正同意，不是 Ralph 单方面接受

**不健康模式 (避免):**
Lisa: [NEEDS_WORK] ...
Ralph: [FIX] 好的，改了  <- 这是单向审批，不是协作

**健康模式:**
Lisa: [NEEDS_WORK] ...
Ralph: [FIX] 同意，因为... / [CHALLENGE] 不同意，因为...
```

### 3. policy.sh (Phase 2 执行)

> **本节描述的内容属于 Phase 2，Phase 1 不实现 policy。**

**位置:** npm 包内（`ralph-lisa policy check`），不再是独立脚本

**功能:**

```bash
# 检查 Ralph 提交
ralph-lisa policy check ralph
# 返回: 缺少 Test Results / 缺少 Research (如果涉及协议)

# 检查 Lisa 提交
ralph-lisa policy check lisa
# 返回: 缺少具体问题或通过理由

# 检查共识
ralph-lisa policy check-consensus
# 返回: 最近一轮是否双方都 [CONSENSUS]

# 检查是否可进入下一步
ralph-lisa policy check-next-step
# 返回: 综合检查结果
```

**模式配置:**

```bash
export RL_POLICY_MODE=warn  # off | warn | block
```

**warn 模式行为:**
- 打印提示信息
- 不阻断流程
- 记录到日志

**规则细化 (最小可行):**
- Ralph 提交必须包含 `Test Results` 段落
- 涉及协议/参考实现/外部 API 时，必须包含 `RESEARCH` 段落
- Lisa 提交必须给出 **至少 1 条理由** (PASS/NEEDS_WORK 均需要)

> Policy **不判断**是否“涉及协议/参考实现”，只做存在性检查；是否需要 [RESEARCH] 由 Ralph 声明 + Lisa 审查。

**集成点 (Phase 2 执行):**
- `/submit-work` -> `ralph-lisa policy check ralph` (提示缺失项)
- `/submit-review` -> `ralph-lisa policy check lisa`
- `/next-step` -> `ralph-lisa policy check-next-step` (综合检查)

### 4. 分发架构: npm 包 + 插件

#### 4.1 npm 包 (`ralph-lisa-loop`)

```bash
# 安装
npm i -g ralph-lisa-loop

# 核心命令 (替代 io.sh)
ralph-lisa init [project-dir]     # 初始化项目
ralph-lisa uninit [project-dir]   # 清理项目文件
ralph-lisa start "task"           # 启动双 agent
ralph-lisa auto "task"            # 自动模式

# io.sh 功能 (子命令)
ralph-lisa whose-turn
ralph-lisa submit-ralph "[TAG] ..."
ralph-lisa submit-lisa "[TAG] ..."
ralph-lisa status
ralph-lisa read work.md
ralph-lisa history
ralph-lisa step "name"
```

实现方式：**Node/TS 重写，最小依赖（不使用 CLI 框架）**。

**核心逻辑只有一份**，npm 包即 io.sh 的升级版。
不需要向后兼容旧的 `./io.sh` 调用方式（从 Phase 2 的 npm 版本开始）；Phase 1 仍沿用 `io.sh`。

#### 4.2 Claude Code plugin (Ralph 端)

打包为 Claude Code plugin，全局安装后不需要项目级文件：

```
ralph-lisa-plugin/
  .claude-plugin/plugin.json    # 插件清单
  skills/
    submit-work/SKILL.md        # /submit-work 命令
    check-turn/SKILL.md         # /check-turn 命令
    view-status/SKILL.md        # /view-status 命令
    read-review/SKILL.md        # /read-review 命令
    next-step/SKILL.md          # /next-step 命令
  hooks/hooks.json              # SessionStart 注入角色上下文
  agents/ralph.md               # Ralph 角色定义
```

**效果：**
- 不再需要修改项目的 CLAUDE.md
- 不再需要 `.claude/commands/` 项目级文件
- skills 通过 `/ralph-lisa:submit-work` 命名空间调用

#### 4.3 Codex 全局配置 (Lisa 端)

Codex 没有 plugin 系统，使用全局 config + skills：

```
~/.codex/config.toml             # developer_instructions 含 Lisa 角色
~/.codex/skills/ralph-lisa-loop/ # Lisa 的 skills
  SKILL.md
  scripts/
  references/
```

**效果：**
- 不再需要项目的 CODEX.md
- 不再需要 `.codex/` 项目级目录
- **无法做 Policy hook 拦截**（Codex 限制），只能靠角色 prompt 软约束

#### 4.4 零侵入后的项目足迹

```
项目目录：
  .dual-agent/              <- 仅运行时状态（可 .gitignore）

全局安装：
  npm: ralph-lisa CLI       <- 替代 io.sh
  Claude Code plugin        <- 替代 CLAUDE.md + .claude/commands/
  ~/.codex/ 全局配置        <- 替代 CODEX.md + .codex/

项目级文件: 0 个（不算运行时状态）
```

### 5. 文档对齐

**Phase 1 范围:**

| 文件 | 改动 |
|------|------|
| `templates/roles/ralph.md` | 加入 [RESEARCH]、[CHALLENGE]、测试要求、回应规则 |
| `templates/roles/lisa.md` | 更新 checklist、强化 advisory、加入 [CHALLENGE] 标签说明 |
| `io.sh` | VALID_TAGS 加入 [CHALLENGE] 和 [RESEARCH] |
| `templates/claude-commands/submit-work.md` | 加入 [CHALLENGE] 和 [RESEARCH] 标签 |
| `templates/codex-skills/submit-review.md` | 加入 [CHALLENGE] 标签 |
| `README.md` | 更新流程描述 |

**Phase 2 范围:**

| 文件 | 改动 |
|------|------|
| `DESIGN_V2.md` | 同步新的标签和流程 |
| `DUAL_AGENT_PLAN.md` | 标记过期内容，更新状态 |
| `submit-work.md` | 加入 Policy warn 集成 |
| `submit-review.md` | 加入 Policy warn 集成 |

---

## 实施计划

### Phase 1: 角色模板 + 标签更新 ✅

- [x] 更新 `templates/roles/ralph.md`（[RESEARCH]、[CHALLENGE]、测试要求）
- [x] 更新 `templates/roles/lisa.md`（checklist、advisory）
- [x] 更新 `io.sh` 有效标签（加入 [CHALLENGE] 和 [RESEARCH]）
- [x] 更新 `templates/claude-commands/submit-work.md`（加入新标签）
- [x] 更新 `templates/codex-skills/submit-review.md`（加入新标签）
- [x] 更新 `README.md`
- [x] 测试: 手工验证 + 自动化测试

### Phase 2: npm 包 + Policy 层 ✅

- [x] 创建 npm 包 `ralph-lisa-loop` (cli/ 目录)
  - [x] `ralph-lisa` CLI（Node/TS 重写，最小依赖，不使用 CLI 框架）
  - [x] `ralph-lisa init` / `ralph-lisa uninit`
  - [x] `ralph-lisa start` / `ralph-lisa auto`
- [x] 实现 Policy（`ralph-lisa policy check`，warn 模式）
- [x] 模板中 `./io.sh` 替换为 `ralph-lisa`
- [x] 更新 DESIGN_V2.md、DUAL_AGENT_PLAN.md
- [ ] 发布 npm（待用户验收后发布）

### Phase 3: 插件化 + 零侵入 ✅

- [x] 创建 Claude Code plugin（角色 + skills + hooks）(plugin/ 目录)
- [x] 配置 Codex 全局 skills + config (codex-global/ 目录)
- [x] Policy block 模式
- [ ] 评估 Gemini CLI 替代 Codex 的可行性（待后续版本）

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| 新规则增加摩擦 | 先 warn 不 block，逐步调整 |
| 调研要求过重 | 只在"涉及参考实现/协议"时要求 |
| 测试要求过重 | 允许"跳过测试 + 说明理由" |
| npm 全局命令不在 PATH | 安装说明明确要求 npm 全局路径在 PATH |
| Codex 无 hook 做 Policy | 靠角色 prompt 软约束；长期考虑 Gemini 替代 |
| Claude Code plugin 机制变化 | 保留 init 模式作为 fallback |

---

## 成功标准

1. 不再出现"没参考现有实现就编码"的问题
2. 提交中包含测试结果成为常态
3. Ralph 和 Lisa 有真正的讨论，而不是单向接受
4. `npm i -g ralph-lisa-loop` 一行安装即可使用
5. 项目目录零侵入（Phase 3 完成后）

---

## 已确认决策

### 2026-02-05

#### 1. [CHALLENGE] 与 [DISCUSS] 的关系

**决策: 并存**

| 标签 | 含义 | 使用场景 |
|------|------|---------|
| `[DISCUSS]` | 一般讨论/澄清 | 需要更多信息、想法交流 |
| `[CHALLENGE]` | 明确反驳 | 不同意对方建议，提出反对理由 |

#### 2. [RESEARCH] 语义与触发条件

**决策: [RESEARCH] 是提交标签，人工声明 + Lisa 必查**

- `[RESEARCH]` 是提交首行标签，与 [PLAN]、[CODE]、[FIX] 同级
- Ralph 自行判断任务是否涉及参考实现/协议/外部 API
- 如果涉及，Ralph 必须先提交 [RESEARCH]
- Lisa 审查时检查：如果涉及上述场景但没有 [RESEARCH]，返回 [NEEDS_WORK]
- io.sh 的 VALID_TAGS 需同时加入 [CHALLENGE] 和 [RESEARCH]

#### 3. Phase 1 范围

**决策: 模板 + 标签更新，不含 Policy 和 npm 包**

Phase 1 只包含：
- 角色模板更新 (ralph.md, lisa.md)
- io.sh 标签扩展 ([CHALLENGE] 和 [RESEARCH])
- 命令模板更新 (submit-work.md, submit-review.md)
- 文档更新 (README.md)

Phase 1 **不包含**：
- Policy 实现（Phase 2）
- DESIGN_V2.md / DUAL_AGENT_PLAN.md 同步（Phase 2）
- npm 包开发（Phase 2）
- Claude Code plugin / Codex 全局配置（Phase 3）

### 2026-02-06

#### 4. 分发架构

**决策: npm 包 + 插件，不考虑向后兼容**

- 发布 npm 包 `ralph-lisa-loop`，提供 `ralph-lisa` 全局命令
- npm 包是 io.sh 的升级版，核心逻辑只有一份（不做两套实现）
- 不需要向后兼容旧的 `./io.sh` 调用方式（从 Phase 2 的 npm 版本开始）
- 旧项目重新 `ralph-lisa init` 即可

#### 5. 侵入性解决方案

**决策: 利用各家 CLI 原生扩展机制实现零侵入**

- Claude Code 端: plugin 打包（角色 + skills + hooks）
- Codex 端: 全局 `~/.codex/` 配置（skills + developer_instructions）
- Codex 没有 hook 机制，Policy 拦截只能靠软约束
- 长期评估 Gemini CLI 替代 Codex（有完整 extension + hooks）

#### 6. Phase 2 技术选型

**决策: Node/TS 重写，最小依赖（不使用 bash wrapper/CLI 框架）**

- CLI 仅依赖 Node 标准库（`fs`, `path`, `process.argv`）
- 逻辑迁入 Node/TS，避免双实现

---

## 文档与代码一致性原则

> **任何时候，如果代码和文档出现不一致，必须先确认以谁为准，才能继续工作。**

- 设计文档 (UPGRADE_PLAN_V3.md) 是工作的基础
- 实施前必须确保文档已批准
- 实施过程中发现需要偏离文档，必须先更新文档并确认
- 代码提交后，相关文档必须同步更新

---

## 待讨论项 (后续版本)

1. Claude Code plugin 的分发方式（marketplace vs 手动安装）
2. 用户介入机制的具体设计
3. 是否需要版本号管理升级
4. Gemini CLI 替代 Codex 的评估时机
