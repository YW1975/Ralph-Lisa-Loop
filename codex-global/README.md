# Codex Global Configuration for Lisa

This directory contains the global Codex configuration for using Codex as "Lisa" (code reviewer) in Ralph-Lisa Loop.

## Installation

```bash
# Copy config (merge if you have existing config)
cp config.toml ~/.codex/config.toml

# Copy skills
cp -r skills/ralph-lisa-loop ~/.codex/skills/ralph-lisa-loop
```

## What This Does

- Configures Codex to use global skills from `~/.codex/skills/`
- The `ralph-lisa-loop` skill teaches Codex the Lisa role
- No per-project files needed (zero intrusion)

## Requirements

- `ralph-lisa` CLI must be installed globally: `npm i -g ralph-lisa-loop`
- Codex CLI must be installed

## Usage

After installation, just run `codex` in any project that has `.dual-agent/` state:

```bash
cd your-project
ralph-lisa init .    # Initialize once
codex                # Codex automatically picks up Lisa role from global skill
```
