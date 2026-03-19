[English](../en/changelog.md) | [日本語](../ja/changelog.md) | [中文](../zh-CN/changelog.md)

# Changelog

## v0.3.x

### What's New in v0.3.12

- **Watcher v5**: Decoupled message delivery from response verification — fixes message flooding bug where watcher sent 14+ duplicate messages to working agents. Per-round send cap (max 2), capture-pane based idle detection (no pipe-pane dependency), pipe-pane cross-reference self-heal, passive post-send monitoring.
- **Mandatory test execution**: `[PLAN]` must include test plan (test command + coverage scope). `[CODE]`/`[FIX]` Test Results must include exit code or pass/fail count. Explicit `Skipped:` with justification accepted. Lisa is required to re-run tests during review.
- **Escalation timing**: Extended defaults from 2m/5m/10m to 5m/15m/30m. Configurable via `RL_ESCALATION_L1`, `RL_ESCALATION_L2`, `RL_ESCALATION_L3` environment variables.
- **UX wording**: Replaced "STOP immediately" / "MUST STOP" with "wait for feedback" across all role templates and command files.
- **Subagent guidance**: Role templates now suggest using subagents for long-running tasks to avoid blocking the collaboration loop.

### What's New in v0.3.11

- **`ralph-lisa stop` command**: Graceful shutdown of auto mode — stops watcher, sends `/exit` to agent panes, tears down tmux session. Supports `--force` for immediate kill and `--no-archive` to skip log archival.
- **Watcher v4**: Round-based change detection fixes mutual deadlock where both agents stop saying they're waiting for each other. Uses monotonically increasing round number instead of turn value, so double-flip (A→B→A during long delivery) is always detected.
- **Cooldown bypass on new rounds**: Cooldown timer no longer suppresses notifications for genuinely new rounds — only same-round re-delivery is throttled.
- **Consensus suppression with round boundary**: Consensus detection now tracks which round it was detected at, preventing stale consensus from blocking notifications after `next-step`.
- **Crash recovery**: Watcher state (SEEN_ROUND, ACKED_ROUND, DELIVERY_PENDING) persisted to `.watcher_state` file. On unexpected exit, state is preserved for wrapper restart replay. Graceful `stop` clears the file.
- **Escalation state machine**: Multi-level stuck-agent detection (L1 REMINDER at 2min, L2 slash command at 5min, L3 user notification at 10min). Context limit detection jumps directly to L3. Delivery failure does not advance escalation level.

### What's New in v0.3

- **`update-task` command**: Change task direction mid-session without restarting. Appends to task.md so history is preserved. Task context is auto-injected into submissions and watcher trigger messages.
- **Round 1 mandatory `[PLAN]`**: Ralph's first submission must be `[PLAN]`, giving Lisa a chance to verify understanding before coding begins.
- **Goal Guardian**: Lisa now reads task.md before every review and checks for direction drift. Catching misalignment early is prioritized over code-level review.
- **Factual verification**: Lisa must provide `file:line` evidence when claiming something is "missing" or "not implemented".
- **Policy layer**: Configurable submission quality checks with `warn`/`block` modes.
- **Watcher v3**: Fire-and-forget triggering, 30s cooldown, checkpoint system (`RL_CHECKPOINT_ROUNDS`), auto-restart on crash, configurable log threshold (`RL_LOG_MAX_MB`), heartbeat file.
- **Deadlock detection**: After 8 consecutive `[NEEDS_WORK]` rounds, watcher auto-pauses for user intervention via `scope-update` or `force-turn`.
- **Minimal init**: `ralph-lisa init --minimal` creates only session state (zero project files).
- **`doctor` command**: Verify all dependencies with `ralph-lisa doctor`.

### Bug Fixes (v0.3.11)

- Fixed watcher deadlock: both agents simultaneously waiting for each other due to turn value comparison missing double-flip during long delivery.
- Fixed consensus suppression blocking notifications after round change.
- Fixed cooldown timer suppressing legitimate new-turn notifications within 30s window.
- Fixed crash recovery: watcher state no longer deleted on unexpected exit (only on graceful stop).

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
