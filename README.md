# Ralph-Lisa Loop

Turn-based dual-agent collaboration: Ralph codes, Lisa reviews, consensus required.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## The Problem

Single-agent coding is like grading your own exam. The same model writes code AND decides if it's done. No external validation. No second opinion.

## The Solution

**Ralph-Lisa Loop** enforces a strict turn-based workflow:

```
Ralph writes → Lisa reviews → Consensus → Next step
     ↑                                        |
     └────────────────────────────────────────┘
```

- **Ralph** (Claude Code): Lead developer - plans, codes, tests
- **Lisa** (Codex): Code reviewer - reviews, provides feedback
- **Turn Control**: Only one agent works at a time
- **Consensus Required**: Both must agree before proceeding

## Quick Start

### 1. Clone and Initialize

```bash
# Clone the repo
git clone https://github.com/YW1975/Ralph-Lisa-Loop.git

# Go to your project
cd your-project

# Initialize Ralph-Lisa Loop
/path/to/Ralph-Lisa-Loop/init.sh
```

### 2. Start Collaboration

```bash
# Manual mode (recommended)
/path/to/Ralph-Lisa-Loop/start.sh "implement login feature"

# Or auto mode (experimental)
/path/to/Ralph-Lisa-Loop/auto.sh "implement login feature"
```

### 3. Work Flow

**Terminal 1 - Ralph (Claude Code)**:
```bash
./io.sh whose-turn                    # Check turn
# ... do work ...
./io.sh submit-ralph "[PLAN] Login feature design

1. Create login form component
2. Add validation
3. Connect to API"
```

**Terminal 2 - Lisa (Codex)**:
```bash
./io.sh whose-turn                    # Check turn
./io.sh read work.md                  # Read Ralph's work
./io.sh submit-lisa "[PASS] Plan looks good

- Clear structure
- Good separation of concerns"
```

## Features

### Turn Control
Agents must check `whose-turn` before any action. Submissions automatically pass the turn.

### Tag System
Every submission requires a tag:

| Ralph Tags | Lisa Tags |
|------------|-----------|
| `[PLAN]` | `[PASS]` |
| `[CODE]` | `[NEEDS_WORK]` |
| `[FIX]` | `[DISCUSS]` |
| `[DISCUSS]` | `[QUESTION]` |
| `[QUESTION]` | `[CONSENSUS]` |
| `[CONSENSUS]` | |

### Consensus Protocol
Lisa's verdict is advisory. Ralph can agree or disagree. Both must reach consensus before `/next-step`.

### Deadlock Escape
After 5 rounds without consensus: `[OVERRIDE]` (proceed anyway) or `[HANDOFF]` (escalate to human).

## Commands

```bash
# Turn control
./io.sh whose-turn                    # Check whose turn
./io.sh submit-ralph "[TAG] ..."      # Ralph submits
./io.sh submit-lisa "[TAG] ..."       # Lisa submits

# Information
./io.sh status                        # Current status
./io.sh read work.md                  # Ralph's latest
./io.sh read review.md                # Lisa's latest
./io.sh history                       # Full history

# Flow control
./io.sh step "phase-name"             # Enter new phase
./io.sh archive [name]                # Archive session
./io.sh init "task"                   # New session
```

## Project Structure After Init

```
your-project/
├── CLAUDE.md              # Ralph's role (auto-loaded by Claude Code)
├── CODEX.md               # Lisa's role (loaded via .codex/config.toml)
├── io.sh                  # Turn control script
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

- [Claude Code](https://claude.ai/code) - for Ralph
- [Codex CLI](https://github.com/openai/codex) - for Lisa
- Bash shell

For auto mode:
- tmux
- fswatch (macOS) or inotify-tools (Linux)

## Ecosystem

Part of the [TigerHill](https://github.com/Click-Intelligence-LLC/TigerHill) project family.

## See Also

- [CONCEPT.md](CONCEPT.md) - Why dual-agent collaboration works
- [DUAL_AGENT_PLAN.md](DUAL_AGENT_PLAN.md) - Future automation roadmap

## License

[MIT](LICENSE)
