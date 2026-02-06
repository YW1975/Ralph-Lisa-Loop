# V3 开发计划（对齐 UPGRADE_PLAN_V3）

## 前提与约束

- 以 `UPGRADE_PLAN_V3.md` 为唯一规范（不增删、不变更语义）。
- 开发过程中如发现文档错误/歧义：立即停止实施，整理证据并请求修改授权。
- 所有改动需有最小验证（测试/手工验证）并在提交信息里标明结果。

---

## 总体节奏（严格按 V3）

| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 1 | 最小落地（流程/模板/标签） | ✅ 完成 (`4d099b5`) |
| Phase 2 | npm CLI + Policy warn（替代 io.sh） | ✅ 完成 (`ea66dab`) |
| Phase 3 | 插件化 + 零侵入 + Policy block | ✅ 完成 (`ea66dab`) |

---

## Phase 1：模板与流程规范 ✅

提交: `4d099b5 V3 Phase 1`

### 完成内容

1. **角色模板更新** — ralph.md 加入 [RESEARCH]、[CHALLENGE]、Test Results；lisa.md 加入 checklist、advisory、[CHALLENGE]
2. **io.sh 标签扩展** — VALID_TAGS 包含 [RESEARCH] 和 [CHALLENGE]
3. **提交模板更新** — submit-work.md、submit-review.md 加入新标签
4. **README 更新** — 标签表、流程说明

### 验证结果
- `./io.sh submit-ralph "[RESEARCH] ..."` ✅
- `./io.sh submit-lisa "[CHALLENGE] ..."` ✅
- 模板关键约束无冲突 ✅

---

## Phase 2：npm CLI + Policy warn ✅

提交: `ea66dab V3 Phase 2+3`

### 完成内容

1. **CLI 实现** (cli/ 目录)
   - npm 包 `ralph-lisa-loop`，CLI 命令 `ralph-lisa`
   - Node/TS 重写，零外部依赖（仅 Node stdlib: fs, path, process.argv）
   - 14 个命令: init, uninit, start, auto, submit-ralph, submit-lisa, whose-turn, status, read, step, history, archive, clean, policy
   - uninit: 删除 init 生成的所有文件，清理 CLAUDE.md 标记区块

2. **Policy warn 模式** (cli/src/policy.ts)
   - Ralph [CODE]/[FIX]: 检查 Test Results 段落
   - Ralph [RESEARCH]: 检查实质内容（至少 2 个字段或等价摘要）
   - Lisa [PASS]/[NEEDS_WORK]: 检查至少 1 条理由
   - `RL_POLICY_MODE=warn` 仅提示，不阻断

3. **全面替换**
   - 所有模板 `./io.sh` → `ralph-lisa`

### 验证结果
- 单元测试: 15/15 pass ✅
- E2E: init → submit-ralph → submit-lisa → status → history → uninit ✅
- Policy warn: 缺 Test Results → warn ✅
- Policy warn: [RESEARCH] 无字段 → warn ✅
- Policy warn: Lisa 无理由 → warn ✅
- 全局安装: npm i -g 从 tarball ✅

---

## Phase 3：插件化 + 零侵入 + Policy block ✅

提交: `ea66dab V3 Phase 2+3`

### 完成内容

1. **Claude Code plugin** (plugin/ 目录)
   - `.claude-plugin/plugin.json` 插件清单
   - 5 个 skills: submit-work, check-turn, view-status, read-review, next-step
   - hooks/hooks.json: SessionStart 注入 Ralph 角色上下文
   - agents/ralph.md: Ralph 角色定义

2. **Codex 全局配置** (codex-global/ 目录)
   - config.toml: 全局 skills 启用
   - skills/ralph-lisa-loop/SKILL.md: 完整 Lisa 角色 + 命令说明

3. **Policy block 模式**
   - `RL_POLICY_MODE=block` 阻断不合规提交 (exit code 1)

### 验证结果
- Policy block: CODE 缺 Test Results → rejected (exit 1) ✅
- Policy block: 合规提交 → 通过 ✅
- Plugin 结构完整 ✅
- Codex 配置完整 ✅

---

## 统一工作流（全阶段适用）

1. 实现前：核对 V3 文档 -> 按 Phase 范围执行
2. 实现后：最小测试 -> 记录结果
3. 提交时：必须包含 Test Results / 说明跳过原因
4. 发现文档错误：停工 -> 汇总证据 -> 请求修改授权

---

## 风险与处理

- V3 文档歧义 -> 立即停工，向你确认
- CLI 与旧 io.sh 并存误读 -> 按 V3 "全面替换"执行
- Policy 过度判断 -> 仅做存在性检查（Phase 2）
