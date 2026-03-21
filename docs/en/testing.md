[English](../en/testing.md) | [日本語](../ja/testing.md) | [中文](../zh-CN/testing.md)

# Testing Guide

Ralph-Lisa Loop includes unit tests, smoke tests, and policy tests to verify CLI behavior.

## Test Architecture

| Layer | Files | What It Covers | Command |
|-------|-------|---------------|---------|
| Unit tests | `cli/src/test/cli.test.ts` | Individual CLI commands, policy checks, state management | `npm test` |
| Policy tests | `cli/src/test/policy.test.ts` | Submission validation rules (Test Results, file:line, tags) | `npm test` |
| Watcher tests | `cli/src/test/watcher.test.ts` | Watcher state machine simulation (escalation, send cap, consensus) | `npm test` |
| State tests | `cli/src/test/state.test.ts` | State directory resolution, project root detection | `npm test` |
| **Smoke tests** | `cli/src/test/smoke.test.ts` | End-to-end multi-step CLI workflows | `npm run test:smoke` |

## Running Tests

```bash
# All tests (unit + smoke)
cd cli
npm test

# Smoke tests only
npm run test:smoke

# With clean environment (recommended for CI)
env -u RL_STATE_DIR -u TMUX -u TMUX_PANE npm test
```

## Smoke Test Scenarios

Smoke tests verify complete multi-step workflows. Each scenario uses an isolated temp directory.

### Scenario 1: Complete Development Cycle
**Flow**: `init → [PLAN] → [PASS] → [CODE] → [PASS] → [CONSENSUS]`

Verifies:
- Turn switches correctly between Ralph and Lisa after each submission
- History records all submissions
- Full Plan→Code→Review→Consensus cycle completes without errors

### Scenario 2: Review Feedback Loop
**Flow**: `[CODE] → [NEEDS_WORK] → [FIX] → [PASS] → [CONSENSUS]`

Verifies:
- NEEDS_WORK correctly triggers FIX flow
- History maintains chronological integrity across iterations
- Round counter advances correctly

### Scenario 3: Policy Block Mode
**Flow**: `[CODE] without Test Results → BLOCKED → [CODE] with Test Results → OK`

Verifies:
- Block mode (`RL_POLICY_MODE=block`) rejects non-compliant submissions
- Turn does not advance on blocked submissions
- Compliant resubmission succeeds

### Scenario 4: Deadlock Detection and Recovery
**Flow**: `5× [NEEDS_WORK] → deadlock.txt → scope-update → recovery`

Verifies:
- Deadlock triggers after threshold consecutive NEEDS_WORK rounds
- `deadlock.txt` created with correct count
- `scope-update` clears deadlock flag and resets counter
- Work can continue after recovery

### Scenario 5: Step Transition State Reset
**Flow**: `[CONSENSUS] + [CONSENSUS] → step "phase-2" → verify reset`

Verifies:
- Round resets to 1
- Step name updates
- Turn resets to ralph
- work.md and review.md cleared of old tags

### Scenario 6: History Chronological Order
**Flow**: `[PLAN] → [NEEDS_WORK] → [FIX] → [PASS]`

Verifies:
- All submissions appear in history.md in submission order
- No tag reordering or duplication

### Scenario 7: Notification on Consensus
**Flow**: `[CONSENSUS] + [CONSENSUS] → witness file check`

Verifies:
- `RL_NOTIFY_CMD` fires when consensus is reached
- Notification message contains "complete" or "consensus"
- No notification when `RL_NOTIFY_CMD` is unset

### Scenario 8: Recap Context Recovery
**Flow**: `Multiple submissions → step transition → recap`

Verifies:
- `ralph-lisa recap` shows current step name
- Recent actions are included in recap output

## Smoke Test Execution Record

After running smoke tests, record results for traceability:

```
Date: YYYY-MM-DD
Version: 0.3.12
Environment: macOS / Linux
Node.js: v22.x

Smoke Results:
  ✓ Scenario 1: Complete development cycle
  ✓ Scenario 2: Review feedback loop
  ✓ Scenario 3: Policy block mode
  ✓ Scenario 4: Deadlock detection and recovery
  ✓ Scenario 5: Step transition state reset
  ✓ Scenario 6: History chronological order
  ✓ Scenario 7: Notification on consensus
  ✓ Scenario 8: Recap context recovery

Total: 8/8 passed
Issues found: (none / list any)
```

## Environment Variables Affecting Tests

| Variable | Effect on Tests |
|----------|----------------|
| `RL_POLICY_MODE` | Set to `off` in most tests; `block` in policy enforcement tests |
| `RL_DEADLOCK_THRESHOLD` | Set to `5` in deadlock tests for speed (default is `8`) |
| `RL_NOTIFY_CMD` | Set to `cat >> witness-file` in notify tests |
| `RL_STATE_DIR` | Stripped in tests to prevent resolving real project state |
| `TMUX` | Stripped to prevent tmux session interference |

## Extending Tests

### Adding a New Smoke Scenario

1. Add a new `describe` block in `cli/src/test/smoke.test.ts`
2. Use `createSuiteDir("name")` for isolation
3. Use `makeRun(TMP)` and `makeReadState(TMP)` helpers
4. Follow the pattern: init → submissions → assertions

### Testing Different Tech Stacks

RLL smoke tests verify the CLI framework itself. For project-specific testing, define your test commands during the `[PLAN]` phase:

- What test tools does the project need? (pytest, jest, flutter test, etc.)
- Are they installed? (`ralph-lisa doctor` can help check prerequisites)
- What smoke scenarios cover the critical paths?
- Configure gate commands via `RL_RALPH_GATE` + `RL_GATE_COMMANDS` for automatic pre-submission checks
