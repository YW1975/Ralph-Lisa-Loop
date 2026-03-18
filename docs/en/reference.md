[English](../en/reference.md) | [日本語](../ja/reference.md) | [中文](../zh-CN/reference.md)

# Command Reference

## Project Setup

| Command | Description |
|---------|-------------|
| `ralph-lisa init [dir]` | Initialize project (full — creates role files + session state) |
| `ralph-lisa init --minimal [dir]` | Minimal init (session state only, no project files) |
| `ralph-lisa uninit` | Remove RLL from project |
| `ralph-lisa start "task"` | Set task and launch both agents (manual mode) |
| `ralph-lisa start --full-auto "task"` | Launch without permission prompts |
| `ralph-lisa auto "task"` | Auto mode with tmux |
| `ralph-lisa auto --full-auto "task"` | Auto mode without permission prompts |
| `ralph-lisa stop` | Graceful shutdown (stop watcher, exit agents, teardown tmux) |
| `ralph-lisa stop --force` | Force kill all processes immediately |
| `ralph-lisa stop --no-archive` | Stop without archiving pane logs |

## Turn Control

| Command | Description |
|---------|-------------|
| `ralph-lisa whose-turn` | Check whose turn it is |
| `ralph-lisa check-turn` | Alias for `whose-turn` |
| `ralph-lisa submit-ralph --file f.md` | Ralph submits from file (recommended) |
| `ralph-lisa submit-lisa --file f.md` | Lisa submits from file (recommended) |
| `ralph-lisa submit-ralph --stdin` | Ralph submits via stdin pipe |
| `ralph-lisa submit-lisa --stdin` | Lisa submits via stdin pipe |
| `ralph-lisa submit-ralph "[TAG] ..."` | Ralph submits inline (deprecated) |
| `ralph-lisa submit-lisa "[TAG] ..."` | Lisa submits inline (deprecated) |
| `ralph-lisa force-turn <agent>` | Manually set turn to `ralph` or `lisa` |

## Information

| Command | Description |
|---------|-------------|
| `ralph-lisa status` | Show current status (task, round, turn, last action) |
| `ralph-lisa read work.md` | Read Ralph's latest submission |
| `ralph-lisa read review.md` | Read Lisa's latest review |
| `ralph-lisa read-review` | Alias for `read review.md` |
| `ralph-lisa read review --round N` | Read review from round N |
| `ralph-lisa history` | Show full session history |
| `ralph-lisa recap` | Context recovery summary |
| `ralph-lisa logs` | List transcript logs |
| `ralph-lisa logs cat [name]` | View a specific transcript log |

## Flow Control

| Command | Description |
|---------|-------------|
| `ralph-lisa step "phase-name"` | Enter new step (requires consensus) |
| `ralph-lisa step --force "phase-name"` | Enter new step (skip consensus check) |
| `ralph-lisa update-task "new direction"` | Update task direction mid-session |
| `ralph-lisa archive [name]` | Archive current session |
| `ralph-lisa clean` | Clean session state |

## Policy

| Command | Description |
|---------|-------------|
| `ralph-lisa policy check <ralph\|lisa>` | Check agent's latest submission (hard gate) |
| `ralph-lisa policy check-consensus` | Check if both agents submitted `[CONSENSUS]` |
| `ralph-lisa policy check-next-step` | Comprehensive pre-step check (consensus + policy) |

Standalone policy commands always exit non-zero on violations, regardless of `RL_POLICY_MODE`.

## Diagnostics

| Command | Description |
|---------|-------------|
| `ralph-lisa doctor` | Check all dependencies and report status |
| `ralph-lisa doctor --strict` | Exit 1 if any dependency is missing (for CI) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RL_POLICY_MODE` | `warn` | Policy check mode: `off`, `warn`, `block` |
| `RL_CHECKPOINT_ROUNDS` | `0` (disabled) | Pause for human review every N rounds in auto mode |
| `RL_LOG_MAX_MB` | `5` | Pane log truncation threshold in MB (min 1) |
