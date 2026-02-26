# Ralph-Lisa Loop

<p align="center">
  <img src="rll_cat.png" alt="Ralph-Lisa Loop" width="256" />
</p>

**One writes. One reviews. You architect.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/ralph-lisa-loop.svg)](https://www.npmjs.com/package/ralph-lisa-loop)

[English](#) | [日本語](docs/ja/guide.md) | [中文](docs/zh-CN/guide.md)

---

## Why?

AI can generate code. But it cannot distrust itself.

A single agent writes code AND decides if it's done — like grading your own exam. Different agents fail in characteristically different ways: Claude Code skips error handling when context grows long; Codex over-engineers abstractions but catches edge cases Claude misses. Pairing them means each catches what the other misses.

## How It Works

```
Ralph writes → Lisa reviews → Consensus → Next step
     ↑                                        |
     └────────────────────────────────────────┘
```

- **Ralph** (Claude Code): Lead developer — researches, plans, codes, tests
- **Lisa** (Codex): Code reviewer — reviews diffs, checks edge cases
- **You**: Tech lead — architecture, scope, tiebreaking

> An agent never reviews its own output.

## Quick Start

```bash
npm i -g ralph-lisa-loop
cd your-project
ralph-lisa init
ralph-lisa start "implement login feature"
```

See the [User Guide](docs/en/guide.md) for the full walkthrough.

## Real-World Results

Used to fork [AionUI](https://github.com/iOfficeAI/AionUi) (~3k stars, Electron + React app) into an independent production product:

| Metric | Value |
|--------|-------|
| Project | AionUI fork → [Margay](https://github.com/YW1975/Margay) |
| Commits | 30 |
| Manual code | 0 lines |
| Review rounds | 40 |
| Status | In production use as internal AI assistant |

## Documentation

- **[User Guide](docs/en/guide.md)** — Setup, workflows, configuration
- **[Command Reference](docs/en/reference.md)** — All CLI commands
- **[FAQ](docs/en/faq.md)** — Common questions and troubleshooting
- **[Changelog](docs/en/changelog.md)** — Version history
- **[Design Philosophy](CONCEPT.md)** — Why dual-agent collaboration works

## Requirements

[Node.js](https://nodejs.org/) >= 18, [Claude Code](https://claude.ai/code), [Codex CLI](https://github.com/openai/codex). Auto mode also requires tmux. See the [User Guide](docs/en/guide.md#prerequisites) for details.

## Ecosystem

Part of the [TigerHill](https://github.com/Click-Intelligence-LLC/TigerHill) project family.

## Acknowledgments

The iterative loop concept builds on Geoffrey Huntley's [Ralph Wiggum technique](https://ghuntley.com/ralph/). Ralph-Lisa Loop adds structured dual-agent review discipline on top — enforcing role separation between generation and critique.

## License

[MIT](LICENSE)
