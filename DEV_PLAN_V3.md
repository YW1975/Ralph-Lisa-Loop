# V3 开发计划（对齐 UPGRADE_PLAN_V3）

## 前提与约束

- 以 `UPGRADE_PLAN_V3.md` 为唯一规范（不增删、不变更语义）。
- 开发过程中如发现文档错误/歧义：立即停止实施，整理证据并请求修改授权。
- 所有改动需有最小验证（测试/手工验证）并在提交信息里标明结果。

---

## 总体节奏（严格按 V3）

- Phase 1 = 最小落地（流程/模板/标签）
- Phase 2 = npm CLI + Policy warn（替代 io.sh）
- Phase 3 = 插件化 + 零侵入 + Policy block

---

## Phase 1：模板与流程规范（不改 io.sh 逻辑，仅扩展标签）

目标：落地标签语义、测试要求、协作流程；确保 io.sh 可用且接受新标签。

### 1. 角色模板更新（文档层）

- 更新 `templates/roles/ralph.md`
  - 增加 [RESEARCH] 与 [CHALLENGE] 说明
  - 明确 [CODE]/[FIX] 必含 Test Results
- 更新 `templates/roles/lisa.md`
  - checklist 增加 Test Results / Research 检查
  - 明确 [CHALLENGE] 处理方式与 Advisory 语义

验证：手工检查模板中是否包含上述关键约束，且无冲突描述。

### 2. io.sh 标签扩展（最小改动）

- 更新 VALID_TAGS 允许 [RESEARCH] & [CHALLENGE]
- 不加入任何业务判断（遵循 V3 “io.sh 只负责通信层”）

验证（手工）：
- `./io.sh submit-ralph "[RESEARCH] ..."` 可执行
- `./io.sh submit-lisa "[CHALLENGE] ..."` 可执行

### 3. 提交模板更新

- `templates/claude-commands/submit-work.md`
- `templates/codex-skills/submit-review.md`

验证：模板示例包含新标签，提交规范与角色模板一致。

### 4. README 更新

- 更新流程描述、标签说明、测试要求

验证：README 与模板语义一致。

### 5. 可选自动化检查（建议）

- 添加一个简单脚本，校验关键关键词是否存在（非阻断）

---

## Phase 2：npm CLI + Policy warn（全面替换 io.sh）

目标：用 `ralph-lisa` 全面替代 `./io.sh`；Policy 仅存在性检查。

### 0. 技术选型（已确认）

- Node/TS 重写
- 最小依赖，不使用 CLI 框架（`process.argv` + Node 标准库）
- 不做 bash wrapper

### 1. CLI 结构与命令

- 创建 `ralph-lisa-loop` npm 包
- CLI 命令：
  - `init` / `uninit` / `start` / `auto`
  - `submit-ralph` / `submit-lisa` / `whose-turn` / `status` / `history` / `step`
- 逻辑移植：
  - io.sh 功能迁移到 Node CLI（单一实现）
- 全面替换：
  - 模板与命令全部改用 `ralph-lisa`，不考虑旧项目兼容

`uninit` 行为：
- 删除 init 生成的项目文件
- 清理 `CLAUDE.md` 中的标记区块（如有）

验证（最小流程）：
- `npm i -g ralph-lisa-loop`
- `ralph-lisa init`
- `ralph-lisa submit-ralph "[PLAN] ..."`
- 历史记录仍写入 `history.md`

### 2. Policy warn 模式（存在性检查）

- Ralph 提交必须包含 Test Results 段落
- 当首行标签为 [RESEARCH] 时：
  - 必须有实质内容（非空）
  - 至少包含 2 个字段（参考实现 / 关键类型 / 数据结构 / 验证方式）
  - 或提供同等信息量的调研摘要 + 证据（文件路径/链接）
- Lisa 提交必须有至少 1 条理由（PASS/NEEDS_WORK 均要求）
- Policy 仅 warn，不阻断

验证：
- 缺 Test Results -> warn
- [RESEARCH] 无内容字段 -> warn
- Lisa 无理由 -> warn

---

## Phase 3：插件化 + 零侵入 + Policy block

目标：移除项目级文件，改为全局配置 + 插件，Policy 支持 block。

### 1. Claude Code plugin

- 打包技能与角色
- hooks 注入角色上下文
- 不再依赖项目级 CLAUDE.md

验证：插件安装后可直接使用 /submit-work 等命令。

### 2. Codex 全局配置

- `~/.codex/config.toml` + skills

验证：Codex 能加载角色与流程。

### 3. Policy block 模式

- `RL_POLICY_MODE=block` 阻断提交

验证：触发规则时流程被阻断。

---

## 统一工作流（全阶段适用）

1. 实现前：核对 V3 文档 -> 按 Phase 范围执行
2. 实现后：最小测试 -> 记录结果
3. 提交时：必须包含 Test Results / 说明跳过原因
4. 发现文档错误：停工 -> 汇总证据 -> 请求修改授权

---

## 风险与处理

- V3 文档歧义 -> 立即停工，向你确认
- CLI 与旧 io.sh 并存误读 -> 按 V3 “全面替换”执行
- Policy 过度判断 -> 仅做存在性检查（Phase 2）
