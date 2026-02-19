# V4 Development Plan (v0.4.0)

> Based on: rll-evaluation.md, rll-improvement-proposals.md, NEXT_VERSION_PROPOSAL.md
> Date: 2026-02-18

---

## What's Done (v0.3.0 ~ v0.3.8)

### From rll-evaluation.md (6 issues, all fixed)

| Issue | Description | Commit |
|-------|-------------|--------|
| RLL-001 (P0) | Watcher infinite retry → fire-and-forget ack | `a569137` |
| RLL-002 (P0) | Task context not reaching Lisa → update-task + auto-inject | `6c7b653` |
| RLL-003 (P0) | Direction drift → Goal Guardian + Round 1 [PLAN] mandate + checkpoint | `18597f5`, `6d22158` |
| RLL-004 (P1) | Factual claims without evidence → Lisa checklist update | `18597f5` |
| RLL-005 (P1) | Watcher crash no restart → auto-restart + heartbeat | `a569137` |
| RLL-006 (P2) | 1MB log threshold → 5MB configurable | `a569137` |

### From rll-improvement-proposals.md (6 of 8 fixed)

| Issue | Description | Commit |
|-------|-------------|--------|
| BUG-1 (P0) | Shell escaping → file-based submit (--file) as primary | `e20b3c0` |
| BUG-2 (P0) | Session state loss → upward .dual-agent/ search + cache | `e20b3c0` |
| BUG-3 (P1) | Multi-project conflict → project-specific tmux session names | `e20b3c0` |
| IMP-2 (P1) | CLI/Skill name mismatch → aliases: check-turn, next-step, read-review | `e20b3c0` |
| IMP-3 (P2) | Review literal \n → real newlines | `e20b3c0` |
| IMP-4 (P2) | Warning/error confusion → structured output with clear status | `e20b3c0` |

### From NEXT_VERSION_PROPOSAL.md (7 of 15 done)

| # | Description | Commit |
|---|-------------|--------|
| 1 | Templates/docs → English | `12281c1` |
| 2 | `ralph-lisa recap` command | `ed881ce` |
| 3 | `submit --file` / `--stdin` | `fcdf9fe` |
| 4 | Auto-attach `files_changed` | `d6e7de3` |
| 5 | Lisa review behavior spec | `12281c1` |
| 6 | review.md keep last 3 | `aa52018` |
| 7 | `step` command consensus check | `aa77e21` |

---

## What's Left (prioritized)

### P1 — v0.4.0 Scope

| ID | Feature | Source | Effort | Description |
|----|---------|--------|--------|-------------|
| V4-01 | Ralph auto gate | Proposal #8 | Medium | Submit `[CODE]`/`[FIX]` auto-runs test/lint before submission. Config: `RL_RALPH_GATE`, `RL_GATE_COMMANDS`, `RL_GATE_MODE=warn\|block`. Gate results stay on Ralph side — not passed to Lisa (prevents anchoring). |
| V4-02 | `force-turn` command | Proposal #10 | Small | `ralph-lisa force-turn <agent>` — manual turn override when Lisa is stuck/unresponsive. Requires interactive confirmation, logs to history.md. Disabled in full-auto mode (no self-approve). |
| V4-11 | Remote access (ttyd) | New | Medium | `ralph-lisa remote` — launch ttyd to expose tmux session via browser. Mobile/tablet can view and operate RLL over LAN/WAN. Supports `--port`, `--auth user:pass`, `--stop`. |

### P1 — Stretch Goals (if time permits)

| ID | Feature | Source | Effort | Description |
|----|---------|--------|--------|-------------|
| V4-04 | `decisions.md` knowledge file | Proposal #11 | Medium | Auto-append decision summary on `[CONSENSUS]`. Inject recent decisions as context when new step starts. Maintain "Patterns & Conventions" section at top. |
| V4-05 | Pane log recording | Proposal #9 | Medium | Wrap agent pane with `script -q`. Archive to `logs/step-{n}.log` on step transition. ANSI cleanup with `col -b`. |

### P2 — Future Versions

| ID | Feature | Source | Effort |
|----|---------|--------|--------|
| V4-06 | Circuit breaker | Proposal #13 | Large |
| V4-07 | Per-step branch isolation | Proposal #14 | Large |
| V4-08 | i18n switch (`--lang zh/ja`) | Proposal #12 | Medium |
| V4-09 | Token usage display | IMP-5 | Medium |
| V4-10 | PR comment → checklist mapping | Proposal #15 | Large |

---

## V4-01: Ralph Auto Gate — Design

### Config

```bash
# .dual-agent/config (or env vars)
RL_RALPH_GATE=true
RL_GATE_COMMANDS="npm test|npm run typecheck|npm run lint"
RL_GATE_MODE=warn   # warn | block
```

### Behavior

1. `submit-ralph [CODE]` or `[FIX]` triggers gate check
2. Run each command in `RL_GATE_COMMANDS` (pipe-separated)
3. **warn mode**: gate failure prints warning, Ralph can still submit
4. **block mode**: gate failure blocks submission, Ralph must fix first
5. Gate results are **not** written to work.md or any Lisa-visible metadata
6. Ralph may self-report test results in submission text (normal reviewer behavior — Lisa decides whether to trust)

### Files to Change

- `cli/src/commands.ts` — `cmdSubmitRalph`: add gate execution before write
- `cli/src/state.ts` — read `RL_GATE_*` from config/env
- `cli/src/test/commands.test.ts` — gate pass/fail/skip scenarios

---

## V4-02: Force-Turn — Design

### Usage

```bash
ralph-lisa force-turn ralph    # Manually assign turn to Ralph
ralph-lisa force-turn lisa     # Manually assign turn to Lisa
```

### Behavior

1. Prompt: "Force turn to {agent}? This skips normal review flow. (y/N)"
2. On confirm: write turn.txt, append to history.md: `[FORCE] Turn manually assigned to {agent} by user`
3. On deny: abort
4. **Full-auto mode**: reject with "force-turn is disabled in auto mode"
5. No `--yes` flag — always interactive

### Files to Change

- `cli/src/commands.ts` — new `cmdForceTurn`
- `cli/src/cli.ts` — register `force-turn` command
- `cli/src/test/cli.test.ts` — force-turn scenarios

---

## V4-11: Remote Access (ttyd) — Design

### Usage

```bash
ralph-lisa remote                     # Start ttyd on default port 7681
ralph-lisa remote --port 8080         # Custom port
ralph-lisa remote --auth user:pass    # Basic auth (recommended for non-localhost)
ralph-lisa remote --stop              # Stop ttyd server
```

### Behavior

1. Check ttyd installed (`which ttyd`); if missing, print install instructions and exit
2. Find current project's tmux session via `generateSessionName()`
3. Verify session exists (`tmux has-session -t <name>`)
4. Launch `ttyd -p <port> [-c <user:pass>] tmux attach -t <session>` as background process
5. Save PID to `.dual-agent/ttyd.pid`
6. Print access URL: `http://<local-ip>:<port>` (auto-detect LAN IP)
7. `--stop`: read PID file, kill process, remove PID file

### Security

- Default bind: `0.0.0.0` (LAN accessible)
- `--auth` maps to ttyd's `-c user:pass` flag
- For WAN access: user is responsible for SSH tunnel or reverse proxy (docs only, not implemented)

### Doctor Integration

- `ralph-lisa doctor` adds ttyd check (optional dependency, non-blocking)

### Files to Change

- `cli/src/commands.ts` — new `cmdRemote`
- `cli/src/cli.ts` — register `remote` command
- `cli/src/test/cli.test.ts` — remote start/stop/missing-ttyd scenarios

---

## Known Issue: npm version 3.0.0

`3.0.0` was accidentally published to npm (fixed locally in `63118a7`). Since npm defaults to highest version, `npm i -g ralph-lisa-loop` installs the broken `3.0.0` instead of `0.3.8`.

**Action required**: `npm deprecate ralph-lisa-loop@3.0.0 "accidental publish, use 0.3.x"`

---

## Implementation Order

| Order | ID | Dependencies | Est. Lines |
|-------|----|-------------|------------|
| 0 | npm 3.0.0 deprecate | None | 0 (npm command) |
| 1 | V4-02 force-turn | None | ~60 |
| 2 | V4-01 auto gate | None | ~100 |
| 3 | V4-11 remote (ttyd) | None | ~80 |
| — | V4-04 decisions.md | Stretch | ~80 |
| — | V4-05 pane log | Stretch | ~60 |

Total core: ~240 lines + tests

## Verification

1. `cd cli && npm run build && npm test` — all existing tests pass
2. New tests per feature (gate scenarios, force-turn flow, remote start/stop)
3. Manual: end-to-end test with `ralph-lisa auto "test task"`
4. Manual: `ralph-lisa remote` then open on phone browser
