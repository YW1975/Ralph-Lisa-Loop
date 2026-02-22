# Ralph-Lisa Loop (RLL) Upgrade Proposal

> Based on Step 33 collaboration review: 25 rounds, 7 tasks, 6 bugs found by Lisa, 0 new tests written by Ralph.

## 1. Background

RLL v0.3.10 pairs Ralph (Claude Code, developer) with Lisa (Codex, reviewer) in a turn-based submit-review loop. Step 33 ran the longest session to date — 25 rounds verifying Tasks #8-#15. The process surfaced systemic issues in scope management, rule enforcement, testing discipline, and protocol efficiency.

---

## 2. Problems

### 2.1 Scope Management Failure

**Severity: P0**

`task.md` defined the task as `--remote`, but the user verbally changed scope to "verify Tasks #8-#15." Ralph submitted research for 5 different features (Rounds 2-6). Lisa correctly returned NEEDS_WORK ("off-task for --remote") every time. Ralph ignored all 5 rejections and submitted the next unrelated topic.

**Root causes:**
- No command to update task scope mid-session
- No mechanism for Lisa to detect "scope has changed, not just off-task Ralph"
- Ralph has no obligation to respond to NEEDS_WORK before submitting new work

**Impact:** 6 wasted rounds (12 submissions), ~30 minutes of compute.

### 2.2 NEEDS_WORK Enforcement Gap

**Severity: P0**

CLAUDE.md states: "If NEEDS_WORK, Ralph MUST explain reasoning — either [FIX] or [CHALLENGE]." In practice, Ralph submitted [RESEARCH] on a completely different topic 5 consecutive times after NEEDS_WORK. The system had no enforcement mechanism.

**Root cause:** The rule exists only in prompt text. Neither the CLI (`submit-ralph`) nor the watcher validates that Ralph's response tag matches a NEEDS_WORK follow-up.

### 2.3 Step State Machine Unused

**Severity: P1**

`step.txt` = `planning` for all 50 history entries. `next-step` was never called. "Step" in the external project (e.g., Margay) refers to an **iteration milestone** — step33 is one phase of the project's evolution, which itself contains multiple tasks. The current implementation conflated two meanings:
- **Project iteration** (step33, step34) — a batch of related tasks, maps to git branches
- **Work phase** (planning, research, coding) — overlaps with submission tags

Tags (`[RESEARCH]`, `[CODE]`, `[FIX]`) already convey the current work phase. The step field should serve as the **current task collection identifier**, not a phase tracker.

### 2.4 Single-Task Model

**Severity: P1**

`task.md` holds a single string. Step 33 had 7 independent subtasks. Lisa reviewed each one separately (one-issue-one-conclusion), but the task definition didn't reflect this structure. This forced the Round 7 workaround: Ralph submitted a [DISCUSS] that unilaterally replaced the task scope.

### 2.5 Context Asymmetry

**Severity: P1**

Lisa only reads `task.md` + `work.md`. When the user changes direction in conversation with Ralph, Lisa has no visibility. This caused the Round 2-6 deadlock: Lisa kept enforcing a scope that the user had already abandoned.

### 2.6 Testing Discipline Absent

**Severity: P0**

Ralph submitted 7 features with zero new unit tests. Every submission reported:

```
Test Results:
- npx tsc --noEmit: PASS
- npm test → 150/150 pass
- No automated tests (requires XYZ)
```

The regression number (150/150) was identical across all rounds — Ralph ran the existing suite but added nothing. Lisa found 6 bugs; at least 3 were catchable by simple unit tests:

| Bug | Unit test needed |
|-----|-----------------|
| IPC result shape (`{data}` vs `TMessage[]`) | Mock invoke, `assert Array.isArray(result)` |
| Cross-platform config path | Mock `process.platform`, verify 3 paths |
| LinkedIn dry-run credential gating | No env vars, call createPost, assert no exit(1) |
| Gemini constructor missing additionalDirs | Assert buildConversation output includes field |

Ralph's "requires E2E" excuse was invalid for pure functions and mock-able IPC calls.

### 2.7 CONSENSUS Overhead

**Severity: P2**

Each task closure took 3 rounds: Lisa [PASS] → Ralph [CONSENSUS] → Lisa [CONSENSUS]. In 25 rounds, ~8 were pure consensus handshakes — administrative overhead with no review value.

### 2.8 CODEX.md Outdated

**Severity: P0 (deploy issue)**

The project `CODEX.md` is an older version missing key features present in the npm package template (`templates/roles/lisa.md`):

| Feature | Template | Deployed CODEX.md |
|---------|----------|-------------------|
| Goal Guardian (direction check) | Yes | No |
| Review Behavior Spec (MUST/SHOULD/JUDGMENT) | Yes | No |
| `--file` submission mode | Yes | No (uses deprecated inline) |
| `file:line` citation requirement | Yes | No |
| Factual claims verification | Yes | No |
| `ralph-lisa recap` command | Yes | No |

### 2.9 Factual Claims Unverified

**Severity: P3**

Round 25: Ralph stated TigerHill_005_bak "has no .git directory — it's a snapshot." Lisa ran `ls .git` and found it was a real git repo with commits. Ralph inferred instead of verifying.

### 2.10 Multi-Working-Directory State Desync

**Severity: P0**

In practice, Ralph and Lisa often work in different subdirectories of the same project. For example:

```
Ralph: /Users/x/Margay/src          → cwd here
Lisa:  /Users/x/Margay/packages/api → cwd here
```

The CLI locates `.dual-agent/` by walking upward from `cwd` (`findProjectRoot()`). When both agents are under the same project root, this usually works. But in observed sessions:

- One agent `cd`'d into a sibling project directory, finding a **different** `.dual-agent/`
- Turn state, review files, and history diverged silently — Ralph submitted to one state dir, Lisa read from another
- The watcher triggered the wrong agent because `turn.txt` files were out of sync

**Root cause:** State directory discovery is implicit (directory traversal) with no authoritative anchor. There is no mechanism to verify both agents are reading/writing the same state.

### 2.11 ttyd Remote Access: iPad Read-Only

**Severity: P2**

RLL auto mode runs in a tmux session. ttyd maps the terminal to a web URL, allowing iPad/mobile to monitor the collaboration in real time. However, iPad can only **view** the tmux panes — keyboard input is not functional. This means the user cannot:

- Intervene when a deadlock occurs
- Manually type commands to either pane
- Pause/resume the watcher
- Send ad-hoc instructions to Ralph or Lisa

The user is forced to switch to a laptop/desktop to interact. This defeats the purpose of mobile monitoring — you can see the problem happening but cannot act on it.

---

## 3. Proposed Changes

### 3.1 Scope Management

**New command: `ralph-lisa scope-update`**

```bash
ralph-lisa scope-update "Verify Tasks #8-#15 implementations"
```

- Updates `task.md` with new scope
- Appends scope change record to `history.md`
- Lisa reads updated scope on next turn

**Lisa auto-suggestion:** After 2 consecutive off-task NEEDS_WORK rounds, Lisa's review must include:
> "If the task scope has changed, ask Ralph to run `ralph-lisa scope-update` before resubmitting."

### 3.2 NEEDS_WORK Response Enforcement

**Watcher-level gate in `watcher.sh`:**

When Ralph submits after a Lisa NEEDS_WORK round:
- Accept: `[FIX]`, `[CHALLENGE]`, `[DISCUSS]`, `[QUESTION]`
- Reject with warning: `[CODE]`, `[RESEARCH]`, `[PLAN]` (unrelated to the NEEDS_WORK)

**Deadlock breaker:** 3 consecutive rounds with the same NEEDS_WORK category → auto-set `[DEADLOCK]` flag, pause watcher, notify user for intervention.

### 3.3 Step = Task Collection Identifier

Redefine step as the **current task collection name** — an iteration milestone of the external project (e.g., Margay step33). Phase tracking is removed; tags already serve that purpose.

```bash
ralph-lisa next-step "step34" --task "Remote access improvements"
```

- `step.txt` stores the collection ID (e.g., `step34`)
- Phase tracking removed — `[RESEARCH]`/`[CODE]`/`[FIX]` tags are sufficient
- Step transitions only happen on user/Ralph explicit command after all subtasks reach CONSENSUS

### 3.4 Multi-Subtask task.md

`task.md` becomes the structured manifest for the current step, listing all subtasks:

```markdown
# Step 33: Feature Verification Batch

## Subtasks
- [ ] #8 Playwright MCP
- [ ] #9 Default workspace directory
- [ ] #10 Additional dirs in conversation
- [ ] #11 Context menu + copy messages
- [ ] #13 Google Auth fallback
- [ ] #14 Assistant Builder Phase 1
- [ ] #15 Social Media Ops v2 Phase 1
```

- `task.md` header identifies which step the current work belongs to
- Lisa validates submissions against the relevant subtask, not the top-level description
- CONSENSUS marks individual subtasks as complete: `- [x] #8 Playwright MCP`
- All subtasks complete → step-level CONSENSUS → eligible for `next-step`

### 3.5 Context File

**New file: `.dual-agent/context.md`**

Ralph writes key user directives that Lisa cannot see from task.md alone:

```bash
ralph-lisa add-context "User requested: verify all features before committing, skip --remote for now"
```

- Lisa reads `context.md` at the start of each review (added to MUST requirements)
- Supplements task.md with runtime decisions

### 3.6 Unit Testing Requirement

**Ralph's submission format change:**

```markdown
### Test Results
- Regression: npm test → 150/150 pass (no breakage)
- New tests: 3 added
  - resolveConfigDir.test.ts: platform path resolution (3 cases)
  - linkedin-dry-run.test.ts: preview without credentials
  - ipc-shape.test.ts: getConversationMessages returns TMessage[]
```

**Rules:**
- `submit-ralph` auto-runs `npm test` on `[CODE]`/`[FIX]` submissions (warn on failure, don't block)
- "New tests: 0" requires justification (valid: pure UI layout with no testable logic)
- Invalid excuse: "requires E2E" for pure functions, data shape validation, or mock-able IPC
- Lisa's checklist: no new tests + no valid justification = automatic NEEDS_WORK

**Lisa's verification testing (last resort):**
- When Lisa suspects a bug but static analysis is insufficient
- Tests written in `.dual-agent/tests/` (isolated from project test suite)
- Test code + output included in review as evidence
- Auto-cleaned on CONSENSUS

**Unit tests, not E2E:**
- Unit tests: mock dependencies, verify logic — Ralph's responsibility in RLL
- E2E tests: browser/Electron/live API — CI pipeline or manual testing, outside RLL scope

### 3.7 Single-Round CONSENSUS

Change CONSENSUS from 3 rounds to 2:

| Current (3 rounds) | Proposed (2 rounds) |
|---------------------|---------------------|
| Lisa: [PASS] | Lisa: [PASS] (includes closeable marker) |
| Ralph: [CONSENSUS] | Ralph: [CONSENSUS] → subtask marked complete |
| Lisa: [CONSENSUS] | *(skipped — Lisa's PASS already approved)* |

Lisa's `[PASS]` implicitly means "closeable if Ralph agrees." No need for Lisa to re-confirm.

### 3.8 Deploy Latest CODEX.md

Overwrite project `CODEX.md` with the latest template from the npm package:

```bash
cp /opt/homebrew/lib/node_modules/ralph-lisa-loop/templates/roles/lisa.md CODEX.md
```

This immediately adds Goal Guardian, Review Behavior Spec, `--file` submission, and factual claims check.

### 3.9 RESEARCH Verification Template

For `[RESEARCH]` submissions, require verification evidence:

```markdown
[RESEARCH] Topic research completed

## Findings
- Claim: TigerHill_005_bak has a git repository
  Verified: `ls /path/.git` → HEAD, config, objects exist
  Evidence: `git log -1` → 75eb714 2025-11-12

- Claim: web-tree-sitter is bundled in Electron app
  Verified: `grep web-tree-sitter package.json` → "^0.25.10"
  Evidence: electron-builder.yml line 30 includes it
```

No inference-only claims. Every factual statement must cite a command or file:line.

### 3.10 State Directory Anchor (`state-dir` command)

**Problem:** `findProjectRoot()` walks upward from `cwd` to locate `.dual-agent/`. When Ralph and Lisa work in different subdirectories — or accidentally `cd` into a sibling project — they may resolve to different state directories, causing silent desync.

**Solution:** Use the **tmux session environment** as the authoritative anchor. Since both agents run in the same tmux session (created by `auto`), they share the same environment.

**`auto` startup sets the anchor:**

```bash
tmux set-environment -t <session> RL_STATE_DIR /absolute/path/.dual-agent
```

**CLI state resolution priority:**

```
1. tmux show-environment RL_STATE_DIR  ← authoritative (auto mode)
2. $RL_STATE_DIR environment variable  ← manual mode / override
3. findProjectRoot() upward search     ← fallback
```

**New command: `ralph-lisa state-dir`**

```bash
ralph-lisa state-dir                        # Show current state path + source
ralph-lisa state-dir /path/to/.dual-agent   # Manually set (writes tmux env)
```

Display output:

```
tmux env:    /Users/x/Margay/.dual-agent
shell env:   (not set)
auto-detect: /Users/x/Margay/.dual-agent
→ using:     /Users/x/Margay/.dual-agent   [tmux]
```

This eliminates ambiguity: both agents always resolve to the same state directory regardless of their working directory.

### 3.11 ttyd Mobile Input Support

**Problem:** ttyd maps the tmux session to a web URL for remote monitoring. On iPad, the terminal renders correctly but keyboard input does not work — the user can watch the collaboration but cannot intervene.

**Possible approaches:**

1. **Control API endpoint** — Add a lightweight HTTP API (or extend ttyd's write endpoint) that accepts commands:
   ```
   POST /api/command  { "pane": 0, "text": "ralph-lisa scope-update ..." }
   ```
   A simple mobile-friendly web UI with preset action buttons (pause, resume, scope-update, intervene) could call this API.

2. **Watcher control file** — The watcher polls a `.dual-agent/control.txt` file. User writes commands from any device (ssh, web form, Shortcuts app):
   ```bash
   echo "pause" > .dual-agent/control.txt     # Pause watcher
   echo "resume" > .dual-agent/control.txt    # Resume
   echo "msg ralph Check the test results" > .dual-agent/control.txt  # Send to Ralph
   ```
   Watcher reads, executes, and clears the file. No ttyd input needed.

3. **ttyd input fix** — Investigate ttyd's iOS keyboard handling. Known issues with iOS virtual keyboard and xterm.js. May require ttyd configuration (`--writable` flag) or a patched xterm.js build.

**Recommended:** Approach 2 (control file) — simplest, works with any device that can write a file (ssh, web, iOS Shortcuts), no ttyd changes needed.

---

## 4. Implementation Priority

| Phase | Items | Effort | Impact |
|-------|-------|--------|--------|
| **Phase 1 (immediate)** | Deploy CODEX.md template | 1 min | Enables Goal Guardian + Review Spec |
| **Phase 1** | Unit test submission format (CLAUDE.md + ralph template) | Template edit | Catches bugs before Lisa review |
| **Phase 1** | NEEDS_WORK enforcement (watcher.sh) | ~50 lines | Prevents round-wasting |
| **Phase 1** | `state-dir` command + tmux env anchor | CLI + auto.sh | Eliminates multi-dir desync (P0) |
| **Phase 2** | `scope-update` command | CLI feature | Prevents scope deadlocks |
| **Phase 2** | Step as task collection + multi-subtask task.md | CLI + template | Supports real work patterns |
| **Phase 2** | `context.md` for user directives | Convention | Fixes context asymmetry |
| **Phase 2** | ttyd mobile control (control file approach) | watcher.sh + convention | Enables iPad/mobile intervention |
| **Phase 3** | Single-round CONSENSUS | CLI logic | ~30% fewer administrative rounds |
| **Phase 3** | Lisa verification test infra | Convention + cleanup | Stronger bug evidence |
| **Phase 3** | RESEARCH verification template | Template only | Prevents factual errors |

---

## 5. Expected Outcomes

With all changes applied to Step 33's workload:

| Metric | Step 33 Actual | Projected |
|--------|---------------|-----------|
| Total rounds | 25 | ~14 (no scope deadlock, single CONSENSUS) |
| Wasted rounds | 6 (scope mismatch) | 0 |
| Bugs found by Lisa | 6 | ~2-3 (unit tests catch the rest pre-submission) |
| New unit tests | 0 | ~10-15 (covering core logic of 7 features) |
| CONSENSUS rounds | 8 | 4 (single-round) |
