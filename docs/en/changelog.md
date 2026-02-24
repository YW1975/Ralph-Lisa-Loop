[English](../en/changelog.md) | [日本語](../ja/changelog.md) | [中文](../zh-CN/changelog.md)

# Changelog

## v0.3.x

### What's New in v0.3

- **`update-task` command**: Change task direction mid-session without restarting. Appends to task.md so history is preserved. Task context is auto-injected into submissions and watcher trigger messages.
- **Round 1 mandatory `[PLAN]`**: Ralph's first submission must be `[PLAN]`, giving Lisa a chance to verify understanding before coding begins.
- **Goal Guardian**: Lisa now reads task.md before every review and checks for direction drift. Catching misalignment early is prioritized over code-level review.
- **Factual verification**: Lisa must provide `file:line` evidence when claiming something is "missing" or "not implemented".
- **Policy layer**: Configurable submission quality checks with `warn`/`block` modes.
- **Watcher v3**: Fire-and-forget triggering, 30s cooldown, checkpoint system (`RL_CHECKPOINT_ROUNDS`), auto-restart on crash, configurable log threshold (`RL_LOG_MAX_MB`), heartbeat file.
- **Deadlock escape**: After 5 rounds without consensus, agents can use `[OVERRIDE]` or `[HANDOFF]`.
- **Minimal init**: `ralph-lisa init --minimal` creates only session state (zero project files).
- **`doctor` command**: Verify all dependencies with `ralph-lisa doctor`.

### Bug Fixes (v0.3)

- Fixed case pattern escaping in generated `watcher.sh` — JS template literals silently stripped backslashes from case patterns, causing the watcher to crash-loop on every startup in auto mode.
- Fixed `check-next-step` consensus logic to match `step` command behavior.
- Fixed test isolation: neutralize tmux environment variables in test subprocesses.
- Hardened watcher send-keys delivery for TUI agent compatibility.

### What Didn't Work

Sharing the failures matters as much as the results:

- **Agent crashes have no auto-recovery.** Once an agent crashes (possibly from long context or system resource exhaustion), the loop stops and you must manually restart. No self-healing yet.
- **State desync between agents.** Early versions had Lisa going rogue — writing code herself instead of reviewing, causing state confusion. Much improved now, but the lesson stands.
- **Without domain judgment, the loop is useless.** Two AIs will happily agree on a bad design. This is not autonomous development — it is structured AI-assisted development. The human arbiter isn't optional.
- **Git discipline is non-negotiable.** Small commits, clear messages, commit often. When things go wrong (and they will), your only safety net is being able to `git reset` to a known good state.
