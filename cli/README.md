# Ralph-Lisa Loop

<p align="center">
  <img src="../rll_cat.png" alt="Ralph-Lisa Loop" width="256" />
</p>

Turn-based dual-agent collaboration: Ralph codes, Lisa reviews, consensus required.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/ralph-lisa-loop.svg)](https://www.npmjs.com/package/ralph-lisa-loop)

## The Problem

Single-agent coding is like grading your own exam. The same model writes code AND decides if it's done. No external validation. No second opinion.

## The Solution

**Ralph-Lisa Loop** enforces a strict turn-based workflow:

```
Ralph writes → Lisa reviews → Consensus → Next step
     ↑                                        |
     └────────────────────────────────────────┘
```

- **Ralph** (Claude Code): Lead developer - researches, plans, codes, tests
- **Lisa** (Codex): Code reviewer - reviews, provides feedback
- **Turn Control**: Only one agent works at a time
- **Consensus Required**: Both must agree before proceeding
- **Research First**: When involving reference implementations/protocols/APIs, Ralph must submit [RESEARCH] before coding
- **Test Results Required**: [CODE] and [FIX] submissions must include test results
- **Policy Layer**: Configurable warn/block mode for submission quality checks

## Quick Start

### 1. Install

```bash
npm i -g ralph-lisa-loop
```

### 2. Initialize Project

```bash
cd your-project
ralph-lisa init
```

### 3. Start Collaboration

```bash
# Manual mode (recommended)
ralph-lisa start "implement login feature"

# Or auto mode (experimental, requires tmux)
ralph-lisa auto "implement login feature"
```

### 4. Work Flow

**Terminal 1 - Ralph (Claude Code)**:
```bash
ralph-lisa whose-turn                    # Check turn
# ... do work, write submission to .dual-agent/submit.md ...
ralph-lisa submit-ralph --file .dual-agent/submit.md
```

**Terminal 2 - Lisa (Codex)**:
```bash
ralph-lisa whose-turn                    # Check turn
ralph-lisa read work.md                  # Read Ralph's work
# ... write review to .dual-agent/submit.md ...
ralph-lisa submit-lisa --file .dual-agent/submit.md
```

## Features

### Turn Control
Agents must check `whose-turn` before any action. Submissions automatically pass the turn.

### Tag System
Every submission requires a tag:

| Ralph Tags | Lisa Tags | Shared |
|------------|-----------|--------|
| `[PLAN]` | `[PASS]` | `[CHALLENGE]` |
| `[RESEARCH]` | `[NEEDS_WORK]` | `[DISCUSS]` |
| `[CODE]` | | `[QUESTION]` |
| `[FIX]` | | `[CONSENSUS]` |

- `[RESEARCH]`: Submit research results before coding (when involving reference implementations, protocols, or external APIs)
- `[CHALLENGE]`: Explicitly disagree with the other agent's suggestion, providing counter-argument
- `[CODE]`/`[FIX]`: Must include Test Results section

### Consensus Protocol
Lisa's verdict is advisory. Ralph can agree or use `[CHALLENGE]` to disagree. Both must reach genuine consensus before `/next-step`. Silent acceptance (bare `[FIX]` without reasoning) is not allowed.

### Minimal Init (Zero Intrusion)

When using the Claude Code plugin + Codex global config, you don't need project-level role files:

```bash
ralph-lisa init --minimal
```

This only creates `.dual-agent/` session state. No CLAUDE.md, CODEX.md, or command files are written. Requires:
- Claude Code plugin installed (provides Ralph role via hooks)
- Codex global config at `~/.codex/` (provides Lisa role)

`start` and `auto` commands work with both full and minimal init.

### Policy Layer

**Inline checks** (during `submit-ralph`/`submit-lisa`):

```bash
# Enable warn mode (prints warnings, doesn't block)
export RL_POLICY_MODE=warn

# Enable block mode (rejects non-compliant submissions)
export RL_POLICY_MODE=block

# Disable
export RL_POLICY_MODE=off
```

**Standalone checks** (for scripts/hooks — always exit non-zero on violations, ignoring `RL_POLICY_MODE`):

```bash
ralph-lisa policy check ralph           # Check Ralph's latest submission
ralph-lisa policy check lisa            # Check Lisa's latest submission
ralph-lisa policy check-consensus       # Both agents submitted [CONSENSUS]?
ralph-lisa policy check-next-step       # Comprehensive: consensus + all policy checks
```

Policy rules:
- Ralph's [CODE]/[FIX] must include "Test Results" section
- Ralph's [RESEARCH] must have substantive content
- Lisa's [PASS]/[NEEDS_WORK] must include at least 1 reason

### Mid-Session Task Update
Change direction without restarting:
```bash
ralph-lisa update-task "switch to REST instead of GraphQL"
```
Appends to task.md (preserving history). Task context is auto-injected into work.md submissions and watcher trigger messages so both agents always see the current goal.

### Round 1 Mandatory Plan
Ralph's first submission must be `[PLAN]` — gives Lisa a chance to verify task understanding before coding begins.

### Goal Guardian
Lisa reads task.md before every review and checks for direction drift. Catching misalignment early is prioritized over code-level review.

### Watcher v3
- **Fire-and-forget triggering**: Removed output stability wait and delivery verification for faster turn transitions
- **30s cooldown**: Prevents re-triggering during normal work
- **Checkpoint system**: Set `RL_CHECKPOINT_ROUNDS=N` to pause for human review every N rounds
- **Auto-restart**: Watcher automatically restarts on crash (session-guarded)
- **Configurable log threshold**: `RL_LOG_MAX_MB` (default 5, min 1) with proportional tail retention
- **Heartbeat file**: `.dual-agent/.watcher_heartbeat` for external liveness checks

### Deadlock Escape
After 5 rounds without consensus: `[OVERRIDE]` (proceed anyway) or `[HANDOFF]` (escalate to human).

## Commands

```bash
# Project setup
ralph-lisa init [dir]                    # Initialize project (full)
ralph-lisa init --minimal [dir]          # Minimal init (session only, no project files)
ralph-lisa uninit                        # Remove from project
ralph-lisa start "task"                  # Launch both agents
ralph-lisa start --full-auto "task"      # Launch without permission prompts
ralph-lisa auto "task"                   # Auto mode (tmux)
ralph-lisa auto --full-auto "task"       # Auto mode without permission prompts

# Turn control
ralph-lisa whose-turn                    # Check whose turn
ralph-lisa check-turn                    # Alias for whose-turn
ralph-lisa submit-ralph --file f.md      # Ralph submits (recommended)
ralph-lisa submit-lisa --file f.md       # Lisa submits (recommended)
ralph-lisa submit-ralph --stdin          # Submit via stdin pipe
ralph-lisa submit-lisa --stdin           # Lisa submit via stdin pipe
ralph-lisa submit-ralph "[TAG] ..."      # Inline (deprecated)

# Information
ralph-lisa status                        # Current status
ralph-lisa read work.md                  # Ralph's latest
ralph-lisa read review.md                # Lisa's latest
ralph-lisa read-review                   # Alias for read review.md
ralph-lisa read review --round N         # Read review from round N
ralph-lisa history                       # Full history
ralph-lisa recap                         # Context recovery summary
ralph-lisa logs                          # List transcript logs
ralph-lisa logs cat [name]               # View a specific log

# Flow control
ralph-lisa step "phase-name"             # Enter new phase (requires consensus)
ralph-lisa step --force "phase-name"     # Enter new phase (skip consensus check)
ralph-lisa update-task "new direction"   # Update task direction mid-session
ralph-lisa archive [name]                # Archive session
ralph-lisa clean                         # Clean session

# Policy
ralph-lisa policy check <ralph|lisa>     # Check submission (hard gate)
ralph-lisa policy check-consensus        # Check if both [CONSENSUS]
ralph-lisa policy check-next-step        # Comprehensive pre-step check

# Diagnostics
ralph-lisa doctor                        # Check all dependencies
ralph-lisa doctor --strict               # Exit 1 if any missing (for CI)
```

## Project Structure After Init

**Full init** (`ralph-lisa init`):
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

**Minimal init** (`ralph-lisa init --minimal`):
```
your-project/
└── .dual-agent/           # Session state only (zero project files)
```

## Requirements

- [Node.js](https://nodejs.org/) >= 18
- [Claude Code](https://claude.ai/code) - for Ralph
- [Codex CLI](https://github.com/openai/codex) - for Lisa

For auto mode:
- tmux (required)
- fswatch (macOS) or inotify-tools (Linux) — optional, speeds up turn detection; falls back to polling without them

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RL_POLICY_MODE` | `warn` | Policy check mode: `off`, `warn`, `block` |
| `RL_CHECKPOINT_ROUNDS` | `0` (disabled) | Pause for human review every N rounds |
| `RL_LOG_MAX_MB` | `5` | Pane log truncation threshold in MB (min 1) |

## Ecosystem

Part of the [TigerHill](https://github.com/Click-Intelligence-LLC/TigerHill) project family.

## See Also

- [CONCEPT.md](../CONCEPT.md) - Why dual-agent collaboration works

## License

[MIT](LICENSE)
