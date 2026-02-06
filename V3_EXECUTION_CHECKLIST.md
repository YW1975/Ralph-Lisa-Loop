# V3 执行 Checklist（含验收点）

## Phase 1：模板与标签规范（最小落地）

目标：统一标签语义、测试要求、协作流程；io.sh 仅扩展标签，不加业务判断。

### 1. 角色模板更新

- [ ] 更新 `templates/roles/ralph.md`
  - [ ] 增加 [RESEARCH] 与 [CHALLENGE] 说明
  - [ ] 明确 [CODE]/[FIX] 必含 Test Results
- [ ] 更新 `templates/roles/lisa.md`
  - [ ] Review checklist 增加 Test Results / Research 检查
  - [ ] 明确 [CHALLENGE] 处理方式与 Advisory 语义

验收：模板内关键规则一致，无冲突描述。

### 2. io.sh 标签扩展

- [ ] VALID_TAGS 加入 [RESEARCH]、[CHALLENGE]

验收：

- [ ] `./io.sh submit-ralph "[RESEARCH] ..."` 可执行
- [ ] `./io.sh submit-lisa "[CHALLENGE] ..."` 可执行

### 3. 提交模板更新

- [ ] `templates/claude-commands/submit-work.md`
- [ ] `templates/codex-skills/submit-review.md`

验收：模板示例使用新标签，语义与角色模板一致。

### 4. README 更新

- [ ] 更新流程描述与标签说明

验收：README 与模板一致。

### 5. 可选自动化验证（建议）

- [ ] 提供一个简单脚本校验关键词存在（非阻断）

---

## Phase 2：npm CLI + Policy warn（全面替换 io.sh）

目标：`ralph-lisa` 全面替代 `./io.sh`，Policy 仅存在性检查。

### 0. 技术选型（已定）

- Node/TS 重写
- 最小依赖，不使用 CLI 框架
- 不做 bash wrapper

### 1. CLI 实现（替代 io.sh）

- [ ] 建 `ralph-lisa-loop` npm 包
- [ ] 命令：`init` / `uninit` / `start` / `auto` / `submit-ralph` / `submit-lisa` / `whose-turn` / `status` / `history` / `step`
- [ ] 全面替换：模板与命令全部改用 `ralph-lisa`，不考虑旧项目兼容
- [ ] `uninit` 删除 init 创建的所有项目文件，并清理 CLAUDE.md 标记区块（如有）

验收：

- [ ] 新项目通过 `ralph-lisa init` 初始化
- [ ] 流程完整跑通，无依赖 `./io.sh`
- [ ] 提交记录仍写入 `history.md`

### 2. Policy warn 模式（存在性检查）

- [ ] Ralph 提交必须包含 Test Results 段落
- [ ] 当首行标签为 [RESEARCH] 时：
  - [ ] 必须有实质内容（非空）
  - [ ] 至少包含 2 个字段（参考实现 / 关键类型 / 数据结构 / 验证方式）
  - [ ] 或提供同等信息量的调研摘要 + 证据（文件路径/链接）
- [ ] Lisa 提交必须有至少 1 条理由（PASS/NEEDS_WORK 均要求）
- [ ] Policy 仅 warn，不阻断

验收：

- [ ] 缺 Test Results -> warn
- [ ] [RESEARCH] 无内容字段 -> warn
- [ ] Lisa 无理由 -> warn

---

## Phase 3：插件化 + 零侵入 + Policy block

目标：全局化 + 零侵入，Policy 可 block。

### 1. Claude Code plugin

- [ ] 插件打包角色 + skills + hooks

验收：无需项目级文件即可工作。

### 2. Codex 全局配置

- [ ] `~/.codex/config.toml` + skills

验收：能加载角色与流程。

### 3. Policy block 模式

- [ ] `RL_POLICY_MODE=block` 阻断提交

验收：触发规则时流程被阻断。

---

## 统一执行规则（全阶段适用）

- [ ] V3 文档为唯一规范
- [ ] 若发现文档错误/歧义：立即停工 -> 汇总证据 -> 向你确认后再改
- [ ] 每步必须记录最小测试结果（通过/失败/跳过理由）
