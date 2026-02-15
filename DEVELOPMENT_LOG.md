# Development Log: v3.1 Upgrade

Ralph (lead developer) and Lisa (code reviewer) — dual-agent collaboration.
Every step was submitted, reviewed, and required mutual consensus before proceeding.

## Session Overview

| Metric | Value |
|--------|-------|
| Date | 2026-02-15 |
| Duration | ~6 hours |
| Steps | 7 implementation + 1 planning |
| Total submissions | 38 rounds |
| Tests | 89 passed, 0 failed |
| First-pass approval rate | 5/8 steps |
| Rework rounds | 3 (plan, Step 1, Step 5) |

## Test Progression

```
Planning   ────  49 tests (baseline)
Step 1     ────  60 tests (+11: --file, --stdin, compact history)
Step 2     ────  64 tests (+4: files_changed)
Step 3     ────  70 tests (+6: recap)
Step 4     ────  77 tests (+7: review-history, --round N)
Step 5     ────  84 tests (+7: consensus gate, spoofing regression)
Step 6     ────  85 tests (+1: English field tests)
Step 7     ────  89 tests (+4: file:line policy)
```

---

## Planning Phase

> Commit: `fcdf9fe` (changes planned here, implemented in Step 1)

Ralph submitted a 7-step implementation plan based on `NEXT_VERSION_PROPOSAL.md`.

**Lisa returned NEEDS_WORK** with 3 issues:
1. Step execution order contradicted the rationale section
2. Step 4 file ownership was incomplete (missing `cmdRead` changes)
3. `--round N` test cases were underspecified

Ralph agreed with all 3, submitted [FIX]. Lisa approved. Consensus reached.

---

## Step 1: `--file` and `--stdin` safe submission

> Commit: `fcdf9fe` Add --file and --stdin flags for safe submission

**What**: `resolveContent()` helper supporting `--file <path>` and `--stdin` input modes. Compact history entries for external sources to prevent context bloat.

**Lisa returned NEEDS_WORK** with 2 issues:
1. `--file` mode wrote full body to history.md — should store summary only (agreed contract was compact history for external sources)
2. `--stdin` was implemented but had zero test coverage

Ralph agreed, added `{ content, external }` return type, compact history logic, and 3 stdin tests. Lisa approved. Consensus reached.

| Round | Role | Tag | Summary |
|-------|------|-----|---------|
| R1 | Ralph | CODE | Initial --file/--stdin implementation |
| R1 | Lisa | NEEDS_WORK | History compaction missing, stdin untested |
| R2 | Ralph | FIX | Compact history + stdin tests (60/60 pass) |
| R2 | Lisa | PASS | Accepted |
| R3 | Both | CONSENSUS | Step 1 complete |

---

## Step 2: Auto-attach `files_changed`

> Commit: `d6e7de3` Auto-attach files_changed to CODE/FIX submissions

**What**: `getFilesChanged()` runs `git diff --name-only` and prepends a Files Changed section to work.md for CODE/FIX tags. Gives Lisa a factual list of what to review.

**Lisa approved on first review.** 4 tests: CODE attach, FIX attach, PLAN skip, empty diff.

| Round | Role | Tag | Summary |
|-------|------|-----|---------|
| R1 | Ralph | CODE | files_changed implementation (64/64 pass) |
| R1 | Lisa | PASS | Accepted |
| R2 | Both | CONSENSUS | Step 2 complete |

---

## Step 3: `recap` context recovery

> Commit: `ed881ce` Add recap command for context recovery after compaction

**What**: New `ralph-lisa recap` command parses history.md to show current step, round, turn, last 3 actions, and unresolved NEEDS_WORK items. Designed for context recovery after conversation compaction.

**Lisa approved on first review.** 6 tests: basic info, recent actions, last-3 limit, unresolved NEEDS_WORK, resolved NEEDS_WORK, empty step.

| Round | Role | Tag | Summary |
|-------|------|-----|---------|
| R1 | Ralph | CODE | recap command (70/70 pass) |
| R1 | Lisa | PASS | Accepted |
| R2 | Both | CONSENSUS | Step 3 complete |

---

## Step 4: Review history retention

> Commit: `aa52018` Keep last 3 reviews in review.md and add --round N lookup

**What**: Changed review.md from overwrite to append (keeping last 3 entries with `---` separators). Added `ralph-lisa read review --round N` to retrieve any round's review from history.md via `extractReviewByRound()`.

**Lisa approved on first review.** 7 tests: keep-last-3, separator format, --round happy path, multi-round lookup, invalid round, out-of-range round, plain read fallback.

| Round | Role | Tag | Summary |
|-------|------|-----|---------|
| R1 | Ralph | CODE | review-history + --round N (77/77 pass) |
| R1 | Lisa | PASS | Accepted |
| R2 | Both | CONSENSUS | Step 4 complete |

---

## Step 5: Step consensus gate

> Commit: `aa77e21` Add consensus gate to step transitions

**What**: `cmdStep` now checks that work.md and review.md both show consensus (CONSENSUS+CONSENSUS or PASS+CONSENSUS) before allowing step transitions. `--force` flag bypasses the check.

**Lisa returned NEEDS_WORK** with 2 issues:
1. **Consensus bypass via body text spoofing** (security): `extractLastTag()` matched any `## [CONSENSUS]` in file content, not just metadata headers. A CODE submission with `## [CONSENSUS]` in its body could fool the gate.
2. **PASS+CONSENSUS test gap**: Test labeled "allows step when PASS+CONSENSUS" actually ended with both sides submitting CONSENSUS, so the PASS+CONSENSUS rule path was never exercised.

Ralph agreed, tightened regex to `^## \[(\w+)\] Round \d+ \| Step: ` (canonical headers only), fixed tests, added spoofing regression test. Lisa approved. Consensus reached.

| Round | Role | Tag | Summary |
|-------|------|-----|---------|
| R1 | Ralph | CODE | Consensus gate implementation |
| R1 | Lisa | NEEDS_WORK | Body text spoofing vulnerability, test gap |
| R2 | Ralph | FIX | Strict header parsing + regression test (84/84 pass) |
| R2 | Lisa | PASS | Accepted |
| R3 | Both | CONSENSUS | Step 5 complete |

---

## Step 6: English-only templates + Lisa behavior spec

> Commit: `12281c1` Convert templates and policy to English, add Lisa behavior spec

**What**: Rewrote `ralph.md` and `lisa.md` fully in English. Added Lisa's Review Behavior Spec with three tiers:
- **MUST**: Read actual code, cite file:line, view full context, check research
- **SHOULD**: Check test quality, verify test results, look for regressions
- **YOUR JUDGMENT**: Run tests yourself, review depth, accept/reject decisions

Removed Chinese from policy.ts field groups and error messages. Updated policy tests to English.

**Lisa approved on first review.**

| Round | Role | Tag | Summary |
|-------|------|-----|---------|
| R1 | Ralph | CODE | Templates + behavior spec (85/85 pass) |
| R1 | Lisa | PASS | Accepted |
| R2 | Both | CONSENSUS | Step 6 complete |

---

## Step 7: Policy strengthen

> Commit: `78871c1` Strengthen policy: default warn mode and file:line requirement

**What**: Changed default `RL_POLICY_MODE` from `off` to `warn`. Added `file:line` reference requirement (`/\w+\.\w+:\d+/`) for Ralph CODE/FIX and Lisa PASS/NEEDS_WORK submissions.

**Lisa approved on first review.** Comprehensive policy test rewrite covering combined and partial violations for both roles.

| Round | Role | Tag | Summary |
|-------|------|-----|---------|
| R1 | Ralph | CODE | Policy default + file:line rules (89/89 pass) |
| R1 | Lisa | PASS | Accepted |
| R2 | Both | CONSENSUS | Step 7 complete. All P0 items done. |

---

## NEEDS_WORK Analysis

Three rework incidents across 8 steps. All resolved by Ralph agreeing with Lisa's feedback (zero [CHALLENGE] used).

| Step | Issue | Category |
|------|-------|----------|
| Planning | Ordering contradiction, incomplete scope, underspecified tests | Plan clarity |
| Step 1 | History stored full content instead of summary, stdin untested | Spec compliance |
| Step 5 | Consensus gate bypass via body text, test coverage gap | Security + test quality |

The Step 5 spoofing vulnerability is the most significant find — a CODE submission containing `## [CONSENSUS]` in markdown body text could have bypassed the step transition gate. Caught by Lisa during review, fixed with strict header-only regex matching.
