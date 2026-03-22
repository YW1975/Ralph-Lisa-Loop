[English](../en/guide.md) | [日本語](../ja/guide.md) | [中文](../zh-CN/guide.md)

# User Guide

Ralph-Lisa Loop enforces a strict separation between code generation and code review. One agent writes, another reviews, they alternate in a turn-based loop. You make the architectural decisions.

## Prerequisites

| Dependency | Required For | Install |
|------------|-------------|---------|
| [Node.js](https://nodejs.org/) >= 18 | CLI | See nodejs.org |
| [Claude Code](https://claude.ai/code) | Ralph (developer) | `npm i -g @anthropic-ai/claude-code` |
| [Codex CLI](https://github.com/openai/codex) | Lisa (reviewer) | `npm i -g @openai/codex` |
| tmux | Auto mode | `brew install tmux` (macOS) / `apt install tmux` (Linux) |
| fswatch / inotify-tools | Faster turn detection | `brew install fswatch` (macOS) / `apt install inotify-tools` (Linux) |

tmux and fswatch/inotify-tools are only needed for auto mode. Manual mode works with just Node.js, Claude Code, and Codex.

Run `ralph-lisa doctor` to verify your setup:

```bash
ralph-lisa doctor
```

Use `--strict` to get a non-zero exit code if anything is missing (useful for CI):

```bash
ralph-lisa doctor --strict
```

## Installation

```bash
npm i -g ralph-lisa-loop
```

## Project Setup

### Full Init

```bash
cd your-project
ralph-lisa init
```

This creates role files and session state:

```
your-project/
├── CLAUDE.md              # Ralph's role (auto-loaded by Claude Code)
├── CODEX.md               # Lisa's role (loaded via .codex/config.toml)
├── .claude/
│   └── commands/          # Claude slash commands
├── .codex/
│   ├── config.toml        # Codex configuration
│   └── skills/            # Codex skills
└── .dual-agent/           # Session state
    ├── turn.txt           # Current turn
    ├── task.md            # Task goal (updated via update-task)
    ├── work.md            # Ralph's submissions
    ├── review.md          # Lisa's submissions
    └── history.md         # Full history
```

### Minimal Init (Zero Intrusion)

```bash
ralph-lisa init --minimal
```

Creates only `.dual-agent/` session state — no project-level files (no CLAUDE.md, CODEX.md, or command files). Requires:

- Claude Code plugin installed (provides Ralph role via hooks)
- Codex global config at `~/.codex/` (provides Lisa role)

Both `start` and `auto` commands work with either init mode.

### Removing from a Project

```bash
ralph-lisa uninit
```

## Your First Session

### Step 1: Start a Task

```bash
ralph-lisa start "implement login feature"
```

This writes the task to `.dual-agent/task.md` and sets the turn to Ralph.

### Step 2: Ralph Works (Terminal 1)

```bash
ralph-lisa whose-turn                    # → "ralph"
# ... do your work ...
# Write your submission to .dual-agent/submit.md
ralph-lisa submit-ralph --file .dual-agent/submit.md
```

Round 1 must be a `[PLAN]` submission — this gives Lisa a chance to verify task understanding before coding begins.

### Step 3: Lisa Reviews (Terminal 2)

```bash
ralph-lisa whose-turn                    # → "lisa"
ralph-lisa read work.md                  # Read Ralph's submission
# ... write review to .dual-agent/submit.md ...
ralph-lisa submit-lisa --file .dual-agent/submit.md
```

### Step 4: Iterate Until Consensus

Ralph reads Lisa's review and responds:

```bash
ralph-lisa read review.md                # Read Lisa's feedback
# Respond with [FIX], [CHALLENGE], [DISCUSS], etc.
ralph-lisa submit-ralph --file .dual-agent/submit.md
```

The loop continues until both agents reach `[CONSENSUS]`.

### Step 5: Next Step

After consensus, move to the next phase:

```bash
ralph-lisa step "phase-2-implementation"
```

## Launch Modes

### Manual Mode (`start`)

```bash
ralph-lisa start "implement login feature"
```

Opens two terminal windows — one for Ralph (Claude Code) and one for Lisa (Codex). You manually trigger each agent by typing in their terminal.

### Auto Mode (`auto`)

```bash
ralph-lisa auto "implement login feature"
```

Creates a tmux session with two panes and starts a background watcher (v5). The watcher monitors `.dual-agent/turn.txt` and automatically triggers the agent whose turn it is.

### Full-Auto Mode

```bash
ralph-lisa auto --full-auto "implement login feature"
```

| | `auto` | `auto --full-auto` |
|--|--------|-------------------|
| Ralph (Claude) | `claude` | `claude --dangerously-skip-permissions` |
| Lisa (Codex) | `codex` | `codex --full-auto` |
| Permission prompts | Every file/command needs approval | Skipped — agents act freely |

Use `--full-auto` when you trust both agents on the current task. Without it, permission prompts may cause the watcher to misidentify paused agents as stuck.

`start` also supports `--full-auto` with the same behavior (no watcher).

### Resume Without Task (Breakpoint Continue)

```bash
ralph-lisa auto                    # No task argument
```

When launched without a task, the session resumes from the previous state — preserving turn, round, history, and all session files. This is useful for resuming after a crash or reconnecting to an interrupted session.

### Checkpoint System

Pause for human review every N rounds:

```bash
export RL_CHECKPOINT_ROUNDS=5
ralph-lisa auto "task"
```

### Watcher v5 Behavior

- **Send cap**: Max 2 trigger messages per round (prevents message flooding)
- **Capture-pane monitoring**: Detects agent activity via terminal content diff (not pipe-pane log)
- **Pipe-pane self-heal**: Cross-references pane activity with log growth — rebuilds pipe automatically if dead
- **Configurable escalation**: L1 reminder at 5min, L2 `/check-turn` at 15min, L3 user notification at 30min (customizable via `RL_ESCALATION_L1/L2/L3`)
- **30-second cooldown** between triggers to prevent re-triggering during work
- **Auto-restart** on crash (session-guarded)
- **Heartbeat file** at `.dual-agent/.watcher_heartbeat` for liveness checks
- **Configurable log threshold**: `RL_LOG_MAX_MB` (default 5, min 1)

### Long-Running Tasks

For time-consuming operations (large-scale code search, batch test runs, CI waits), agents are encouraged to use subagents or background tasks to work in parallel, summarizing results before submitting. This avoids blocking the collaboration loop.

## Tag System

Every submission requires a tag on the first line:

| Ralph Tags | Lisa Tags | Shared |
|------------|-----------|--------|
| `[PLAN]` | `[PASS]` | `[CHALLENGE]` |
| `[RESEARCH]` | `[NEEDS_WORK]` | `[DISCUSS]` |
| `[CODE]` | | `[QUESTION]` |
| `[FIX]` | | `[CONSENSUS]` |

### Tag Details

- **`[PLAN]`**: Required for Round 1. Outlines approach before coding. Must include a test plan (test command + coverage scope).
- **`[RESEARCH]`**: Required before coding when involving reference implementations, protocols, or external APIs. Must include verified evidence (file:line, command output).
- **`[CODE]`**: Code implementation. Must include Test Results section.
- **`[FIX]`**: Bug fix or revision based on feedback. Must include Test Results section.
- **`[PASS]`**: Lisa approves the submission.
- **`[NEEDS_WORK]`**: Lisa requests changes. Must include at least one reason.
- **`[CHALLENGE]`**: Disagree with the other agent's suggestion, providing a counter-argument.
- **`[DISCUSS]`**: General discussion or clarification.
- **`[QUESTION]`**: Ask for clarification.
- **`[CONSENSUS]`**: Confirm agreement to close the current item.

## Submission Rules

### Round 1 Must Be [PLAN]

Ralph's first submission must be `[PLAN]`. This gives Lisa a chance to verify task understanding before any code is written. The plan must include a **test plan** specifying:
- Test command (e.g., `pytest -x`, `npm test`, `go test ./...`)
- Expected test coverage scope
- If no test framework exists, the verification approach

### Test Results Required (Mandatory Execution)

`[CODE]` and `[FIX]` submissions must include a Test Results section with **actual execution evidence** — not fabricated results:

```markdown
### Test Results
- Test command: npm test
- Exit code: 0
- Result: 150/150 passed
- New tests: 2 added (auth.test.ts, login.test.ts)
```

The policy layer enforces that Test Results contain an exit code or pass/fail count. If tests are skipped, an explicit `Skipped:` line with justification is required:

```markdown
### Test Results
- Skipped: config-only change, no testable logic
```

**Lisa is required to re-run the test command** and verify results during review. Suspicious or fabricated results will be rejected.

### Research Before Coding

When the task involves reference implementations, protocols, or external APIs, submit `[RESEARCH]` first with verified evidence:

```markdown
[RESEARCH] API integration research

- Endpoint: POST /api/v2/auth (docs:line 45)
- Auth: Bearer token in header (verified via curl)
- Response: { token, expires_in } (tested locally)
```

### No Silent Acceptance

When responding to `[NEEDS_WORK]`:
- **If you agree**: Explain WHY Lisa is right, then submit `[FIX]`
- **If you disagree**: Use `[CHALLENGE]` to provide a counter-argument
- **Never** submit a bare `[FIX]` without explanation

## Consensus Protocol

Lisa's verdict is **advisory, not authoritative**. Ralph can accept, challenge, or request clarification.

The step transition requires one of these closure combinations:
- `[CONSENSUS]` + `[CONSENSUS]` — both agents agree
- `[PASS]` + `[CONSENSUS]` — Lisa passes, Ralph confirms
- `[CONSENSUS]` + `[PASS]` — Ralph confirms, Lisa passes

Typical flow:
1. Lisa submits `[PASS]`
2. Ralph submits `[CONSENSUS]` — item is closed

### Deadlock Escape

After 8 consecutive `[NEEDS_WORK]` rounds (Lisa keeps requesting changes), the watcher automatically pauses and flags a deadlock. Options:
- **`ralph-lisa scope-update`**: Redefine the task scope to break the cycle
- **`ralph-lisa force-turn`**: Manually override the turn
- **Manual intervention**: The user decides how to proceed (accept, reject, or redirect)

No infinite loops. No stuck states.

## Policy Layer

The policy layer validates submission quality.

### Inline Checks

Applied automatically during `submit-ralph` / `submit-lisa`:

```bash
# Warn mode (default) — prints warnings, doesn't block
export RL_POLICY_MODE=warn

# Block mode — rejects non-compliant submissions
export RL_POLICY_MODE=block

# Disable
export RL_POLICY_MODE=off
```

### Standalone Checks

For scripts and hooks — always exit non-zero on violations, regardless of `RL_POLICY_MODE`:

```bash
ralph-lisa policy check ralph           # Check Ralph's latest submission
ralph-lisa policy check lisa            # Check Lisa's latest submission
ralph-lisa policy check-consensus       # Both agents submitted [CONSENSUS]?
ralph-lisa policy check-next-step       # Comprehensive: consensus + all policy checks
```

### Policy Rules

- Ralph's `[PLAN]` must include a test plan
- Ralph's `[CODE]`/`[FIX]` must include a "Test Results" section with exit code or pass/fail count (or explicit `Skipped:`)
- Ralph's `[RESEARCH]` must have substantive content with `Verified:` or `Evidence:` markers
- Lisa's `[PASS]`/`[NEEDS_WORK]` must include at least 1 reason and file:line reference
- After `[NEEDS_WORK]`, Ralph must respond with `[FIX]`/`[CHALLENGE]`/`[DISCUSS]`/`[QUESTION]` (not `[CODE]`/`[PLAN]`)

## Testing

RLL includes unit tests and smoke tests. See the [Testing Guide](testing.md) for details.

```bash
# Run all tests
cd cli && npm test

# Smoke tests only
npm run test:smoke

# View latest test report
ralph-lisa test-report
```

## Mid-Session Controls

### Update Task Direction

Change direction without restarting:

```bash
ralph-lisa update-task "switch to REST instead of GraphQL"
```

Appends to task.md (preserving history). Task context is auto-injected into submissions and watcher trigger messages.

### Enter New Step

After consensus, move to a new phase:

```bash
ralph-lisa step "phase-2"              # Requires consensus
ralph-lisa step --force "phase-2"      # Skip consensus check
```

### Force Turn

Manual override for stuck states:

```bash
ralph-lisa force-turn ralph
ralph-lisa force-turn lisa
```

### Archive and Clean

```bash
ralph-lisa archive [name]              # Archive current session
ralph-lisa clean                       # Clean session state
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RL_POLICY_MODE` | `warn` | Policy check mode: `off`, `warn`, `block` |
| `RL_CHECKPOINT_ROUNDS` | `0` (disabled) | Pause for human review every N rounds |
| `RL_LOG_MAX_MB` | `5` | Pane log truncation threshold in MB (min 1) |
| `RL_ESCALATION_L1` | `300` | Watcher L1 REMINDER delay in seconds (default 5 min) |
| `RL_ESCALATION_L2` | `900` | Watcher L2 /check-turn delay in seconds (default 15 min) |
| `RL_ESCALATION_L3` | `1800` | Watcher L3 STUCK notification delay in seconds (default 30 min) |
| `RL_RALPH_GATE` | `false` | Enable pre-submission gate checks (lint, test) |
| `RL_GATE_COMMANDS` | (empty) | Pipe-separated commands for gate (e.g., `npm run lint\|npm test`) |
| `RL_GATE_MODE` | `warn` | Gate failure mode: `warn` or `block` |

## Tips and Best Practices

### Git Discipline

Small commits, clear messages, commit often. When things go wrong (and they will), your only safety net is being able to `git reset` to a known good state.

### Agent Crashes

Agent crashes have no auto-recovery yet. If an agent crashes (possibly from long context or system resource exhaustion), you must manually restart. Monitor the tmux session and restart as needed.

### Context Management

Long sessions fill the context window. Break large tasks into steps using `ralph-lisa step`. Keep individual tasks focused and use `update-task` to redirect rather than starting over.

### When to Use RLL

**Good fit**: Multi-step implementations, architectural decisions, code affecting users/security, ambiguous requirements.

**Overkill**: One-line fixes, well-tested refactoring, personal scripts, time-critical hotfixes.

### The Human Arbiter

Two AIs will happily agree on a bad design. Ralph-Lisa Loop is structured AI-assisted development, not autonomous development. The human arbiter is not optional.
