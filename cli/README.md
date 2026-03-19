# Ralph-Lisa Loop

<p align="center">
  <img src="https://raw.githubusercontent.com/YW1975/Ralph-Lisa-Loop/main/rll_cat.png" alt="Ralph-Lisa Loop" width="256" />
</p>

Turn-based dual-agent collaboration: Ralph codes, Lisa reviews, consensus required.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/YW1975/Ralph-Lisa-Loop/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/ralph-lisa-loop.svg)](https://www.npmjs.com/package/ralph-lisa-loop)

## Quick Start

```bash
npm i -g ralph-lisa-loop
cd your-project
ralph-lisa init
ralph-lisa start "implement login feature"
```

## How It Works

```
Ralph writes → Lisa reviews → Consensus → Next step
     ↑                                        |
     └────────────────────────────────────────┘
```

- **Ralph** (Claude Code): Lead developer — researches, plans, codes, tests
- **Lisa** (Codex): Code reviewer — reviews diffs, checks edge cases
- **You**: Tech lead — architecture, scope, tiebreaking

## Key Features

- **Turn Control** — Only one agent works at a time; submissions pass the turn automatically
- **Tag System** — `[PLAN]`, `[CODE]`, `[FIX]`, `[PASS]`, `[NEEDS_WORK]`, `[CHALLENGE]`, `[CONSENSUS]`
- **Consensus Protocol** — Both agents must agree before proceeding; advisory verdicts, not commands
- **Policy Layer** — Configurable `warn`/`block` mode for submission quality checks
- **Auto Mode** — tmux-based automation with file watcher for hands-off operation
- **Round 1 Mandatory Plan** — Ralph must submit `[PLAN]` first for Lisa to verify understanding
- **Goal Guardian** — Lisa checks for direction drift before every review
- **Mid-Session Task Update** — Change direction without restarting
- **Deadlock Detection** — After 5 consecutive `[NEEDS_WORK]` rounds, watcher auto-pauses for user intervention
- **Minimal Init** — Zero-intrusion mode with plugin/global config architecture

## Essential Commands

```bash
# Setup
ralph-lisa init [dir]                    # Initialize project
ralph-lisa start "task"                  # Launch both agents
ralph-lisa auto "task"                   # Auto mode (tmux)

# Turn control
ralph-lisa whose-turn                    # Check whose turn
ralph-lisa submit-ralph --file f.md      # Ralph submits
ralph-lisa submit-lisa --file f.md       # Lisa submits

# Information
ralph-lisa status                        # Current status
ralph-lisa read work.md                  # Ralph's latest
ralph-lisa read review.md                # Lisa's latest
ralph-lisa history                       # Full history

# Flow control
ralph-lisa step "phase-name"             # Enter new step
ralph-lisa update-task "new direction"   # Change task mid-session

# Diagnostics
ralph-lisa doctor                        # Check dependencies
```

## Requirements

- [Node.js](https://nodejs.org/) >= 18
- [Claude Code](https://claude.ai/code) — for Ralph
- [Codex CLI](https://github.com/openai/codex) — for Lisa
- tmux — for auto mode (`brew install tmux` / `apt install tmux`)

## Documentation

Full documentation on GitHub:

- **[User Guide](https://github.com/YW1975/Ralph-Lisa-Loop/blob/main/docs/en/guide.md)** — Setup, workflows, configuration
- **[Command Reference](https://github.com/YW1975/Ralph-Lisa-Loop/blob/main/docs/en/reference.md)** — All CLI commands
- **[FAQ](https://github.com/YW1975/Ralph-Lisa-Loop/blob/main/docs/en/faq.md)** — Common questions and troubleshooting
- **[Changelog](https://github.com/YW1975/Ralph-Lisa-Loop/blob/main/docs/en/changelog.md)** — Version history
- **[Design Philosophy](https://github.com/YW1975/Ralph-Lisa-Loop/blob/main/CONCEPT.md)** — Why dual-agent works

Other languages: [日本語](https://github.com/YW1975/Ralph-Lisa-Loop/blob/main/docs/ja/guide.md) | [中文](https://github.com/YW1975/Ralph-Lisa-Loop/blob/main/docs/zh-CN/guide.md)

## License

[MIT](https://github.com/YW1975/Ralph-Lisa-Loop/blob/main/LICENSE)
