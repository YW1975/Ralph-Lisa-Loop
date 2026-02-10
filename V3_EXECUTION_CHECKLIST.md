# V3 执行 Checklist（含验收点）

## Phase 1：模板与标签规范（最小落地） ✅ 完成

目标：统一标签语义、测试要求、协作流程；io.sh 仅扩展标签，不加业务判断。

### 1. 角色模板更新

- [x] 更新 `templates/roles/ralph.md`
  - [x] 增加 [RESEARCH] 与 [CHALLENGE] 说明
  - [x] 明确 [CODE]/[FIX] 必含 Test Results
- [x] 更新 `templates/roles/lisa.md`
  - [x] Review checklist 增加 Test Results / Research 检查
  - [x] 明确 [CHALLENGE] 处理方式与 Advisory 语义

验收：模板内关键规则一致，无冲突描述。 ✅

### 2. io.sh 标签扩展

- [x] VALID_TAGS 加入 [RESEARCH]、[CHALLENGE]

验收：

- [x] `./io.sh submit-ralph "[RESEARCH] ..."` 可执行
- [x] `./io.sh submit-lisa "[CHALLENGE] ..."` 可执行

### 3. 提交模板更新

- [x] `templates/claude-commands/submit-work.md`
- [x] `templates/codex-skills/submit-review.md`

验收：模板示例使用新标签，语义与角色模板一致。 ✅

### 4. README 更新

- [x] 更新流程描述与标签说明

验收：README 与模板一致。 ✅

### 5. 可选自动化验证（建议）

- [x] 提供一个简单脚本校验关键词存在（非阻断）—— 由 Policy warn 模式替代

---

## Phase 2：npm CLI + Policy warn（全面替换 io.sh） ✅ 完成

目标：`ralph-lisa` 全面替代 `./io.sh`，Policy 仅存在性检查。

### 0. 技术选型（已定）

- Node/TS 重写 ✅
- 最小依赖，不使用 CLI 框架 ✅ (仅 Node stdlib: fs, path, process.argv)
- 不做 bash wrapper ✅

### 1. CLI 实现（替代 io.sh）

- [x] 建 `ralph-lisa-loop` npm 包 (cli/ 目录)
- [x] 命令：`init` / `uninit` / `start` / `auto` / `submit-ralph` / `submit-lisa` / `whose-turn` / `status` / `history` / `step` / `read` / `archive` / `clean` / `policy`
- [x] `init --minimal`: 仅创建 .dual-agent/（零项目文件），配合全局插件使用
- [x] `start --full-auto` / `auto --full-auto`: 跳过权限确认（claude --dangerously-skip-permissions + codex --full-auto）
- [x] 全面替换：模板与命令全部改用 `ralph-lisa`，不考虑旧项目兼容
- [x] `uninit` 通过 RALPH-LISA-LOOP 标记精确识别自有文件，保留用户内容

验收：

- [x] 新项目通过 `ralph-lisa init` 初始化
- [x] 流程完整跑通，无依赖 `./io.sh`
- [x] 提交记录仍写入 `history.md`

### 2. Policy 层

- [x] Ralph 提交必须包含 Test Results 段落
- [x] 当首行标签为 [RESEARCH] 时：
  - [x] 必须有实质内容（非空）
  - [x] 至少包含 2 个字段（参考实现 / 关键类型 / 数据结构 / 验证方式）
  - [x] 或提供同等信息量的调研摘要 + 证据（文件路径/链接）
- [x] Lisa 提交必须有至少 1 条理由（PASS/NEEDS_WORK 均要求）
- [x] `RL_POLICY_MODE=warn` 仅 warn，不阻断（内联检查）
- [x] `policy check-consensus`: 检查双方 [CONSENSUS]
- [x] `policy check-next-step`: 综合检查（共识 + 各方 policy）
- [x] 独立 policy check* 为硬检查（exit 1），不受 RL_POLICY_MODE 控制

验收：

- [x] 缺 Test Results -> warn ✅ (tested)
- [x] [RESEARCH] 无内容字段 -> warn ✅ (tested)
- [x] Lisa 无理由 -> warn ✅ (tested)
- [x] check-consensus: 双方 [CONSENSUS] -> pass; 否则 exit 1 ✅ (E2E tested)
- [x] check-next-step: 综合检查 -> pass/fail ✅ (E2E tested)

### 3. 自动化测试

- [x] Node test runner 测试 (20/20 pass)
  - state.test.ts: extractTag, extractSummary, VALID_TAGS
  - policy.test.ts: checkRalph, checkLisa (含 RESEARCH 字段计数边界)

---

## Phase 3：插件化 + 零侵入 + Policy block ✅ 完成

目标：全局化 + 零侵入，Policy 可 block。

### 1. Claude Code plugin

- [x] 插件打包角色 + skills + hooks (plugin/ 目录)
  - [x] .claude-plugin/plugin.json 清单
  - [x] 5 个 skills: submit-work, check-turn, view-status, read-review, next-step
  - [x] hooks/hooks.json (SessionStart 注入 Ralph 角色)
  - [x] agents/ralph.md (Ralph 角色定义)

验收：无需项目级 CLAUDE.md / .claude/commands/ 即可通过 plugin 提供相同功能。 ✅

### 2. Codex 全局配置

- [x] `~/.codex/config.toml` + skills (codex-global/ 目录)
  - [x] 全局 config.toml 模板
  - [x] ralph-lisa-loop/SKILL.md 包含完整 Lisa 角色

验收：能加载角色与流程。 ✅

### 3. Policy block 模式

- [x] `RL_POLICY_MODE=block` 阻断提交

验收：触发规则时流程被阻断。 ✅ (exit code 1)

---

## 统一执行规则（全阶段适用）

- [x] V3 文档为唯一规范
- [x] 若发现文档错误/歧义：立即停工 -> 汇总证据 -> 向你确认后再改
- [x] 每步必须记录最小测试结果（通过/失败/跳过理由）
