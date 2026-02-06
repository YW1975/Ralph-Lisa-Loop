# Ralph-Lisa Loop

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
# ... do work ...
ralph-lisa submit-ralph "[PLAN] Login feature design

1. Create login form component
2. Add validation
3. Connect to API"
```

**Terminal 2 - Lisa (Codex)**:
```bash
ralph-lisa whose-turn                    # Check turn
ralph-lisa read work.md                  # Read Ralph's work
ralph-lisa submit-lisa "[PASS] Plan looks good

- Clear structure
- Good separation of concerns"
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

### Policy Layer
Configurable submission quality checks:

```bash
# Enable warn mode (prints warnings, doesn't block)
export RL_POLICY_MODE=warn

# Enable block mode (rejects non-compliant submissions)
export RL_POLICY_MODE=block

# Disable (default)
export RL_POLICY_MODE=off
```

Policy checks:
- Ralph's [CODE]/[FIX] must include "Test Results" section
- Ralph's [RESEARCH] must have substantive content
- Lisa's [PASS]/[NEEDS_WORK] must include at least 1 reason

### Deadlock Escape
After 5 rounds without consensus: `[OVERRIDE]` (proceed anyway) or `[HANDOFF]` (escalate to human).

## Commands

```bash
# Project setup
ralph-lisa init [dir]                    # Initialize project
ralph-lisa uninit                        # Remove from project
ralph-lisa start "task"                  # Launch both agents
ralph-lisa auto "task"                   # Auto mode (tmux)

# Turn control
ralph-lisa whose-turn                    # Check whose turn
ralph-lisa submit-ralph "[TAG] ..."      # Ralph submits
ralph-lisa submit-lisa "[TAG] ..."       # Lisa submits

# Information
ralph-lisa status                        # Current status
ralph-lisa read work.md                  # Ralph's latest
ralph-lisa read review.md                # Lisa's latest
ralph-lisa history                       # Full history

# Flow control
ralph-lisa step "phase-name"             # Enter new phase
ralph-lisa archive [name]                # Archive session
ralph-lisa clean                         # Clean session

# Policy
ralph-lisa policy check <ralph|lisa>     # Check submission
```

## Project Structure After Init

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
    ├── work.md            # Ralph's submissions
    ├── review.md          # Lisa's submissions
    └── history.md         # Full history
```

## Requirements

- [Node.js](https://nodejs.org/) >= 18
- [Claude Code](https://claude.ai/code) - for Ralph
- [Codex CLI](https://github.com/openai/codex) - for Lisa

For auto mode:
- tmux
- fswatch (macOS) or inotify-tools (Linux)

## Ecosystem

Part of the [TigerHill](https://github.com/Click-Intelligence-LLC/TigerHill) project family.

## See Also

- [CONCEPT.md](CONCEPT.md) - Why dual-agent collaboration works
- [UPGRADE_PLAN_V3.md](UPGRADE_PLAN_V3.md) - V3 design document

## License

[MIT](LICENSE)
