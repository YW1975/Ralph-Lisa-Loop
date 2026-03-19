[English](../en/faq.md) | [日本語](../ja/faq.md) | [中文](../zh-CN/faq.md)

# Frequently Asked Questions

## Installation

### npm install fails with permission errors

Try installing with the `--prefix` flag or use a Node version manager (nvm, fnm):

```bash
# Option 1: Use a prefix
npm i -g ralph-lisa-loop --prefix ~/.npm-global

# Option 2: Use nvm (recommended)
nvm install 18
nvm use 18
npm i -g ralph-lisa-loop
```

### Which Node.js version do I need?

Node.js 18 or higher. Check with:

```bash
node --version
```

### How do I install tmux and fswatch?

**macOS:**
```bash
brew install tmux fswatch
```

**Linux (Debian/Ubuntu):**
```bash
apt install tmux inotify-tools
```

These are only needed for auto mode. Manual mode works without them.

### `ralph-lisa doctor` reports something missing

`doctor` checks for all dependencies. The output tells you exactly what's missing and how to install it. Use `--strict` for CI environments:

```bash
ralph-lisa doctor           # Human-readable report
ralph-lisa doctor --strict  # Exit 1 if anything missing
```

### `ralph-lisa auto` says "Error: tmux is required"

Install tmux first:

```bash
brew install tmux    # macOS
apt install tmux     # Linux
```

### `ralph-lisa auto` says "Error: File watcher required"

Install fswatch (macOS) or inotify-tools (Linux):

```bash
brew install fswatch          # macOS
apt install inotify-tools     # Linux
```

## Usage

### What is the difference between manual mode and auto mode?

**Manual mode** (`ralph-lisa start`): You run each agent yourself in separate terminals and manually trigger each turn. Full control, best for learning.

**Auto mode** (`ralph-lisa auto`): tmux manages the terminals and a file watcher automatically triggers agents when the turn changes. Hands-off operation.

### Do I need both Claude Code and Codex?

Yes. Ralph requires Claude Code, Lisa requires Codex CLI. Using different models for writing and reviewing means each catches failure modes the other misses — Claude Code may skip error handling in long contexts, while Codex over-engineers abstractions but catches edge cases.

### Can I use a different model for Lisa?

The role files (CODEX.md) are designed for Codex CLI, but any agent that can read/write files and run shell commands could fill the Lisa role. You would need to adapt the role prompt in CODEX.md.

### What is minimal init vs full init?

**Full init** (`ralph-lisa init`) creates role files (CLAUDE.md, CODEX.md), command/skill directories, and session state.

**Minimal init** (`ralph-lisa init --minimal`) creates only the `.dual-agent/` session state directory. Use this when you have the Claude Code plugin and Codex global config already providing the role definitions.

### How do I change the task mid-session?

```bash
ralph-lisa update-task "new direction here"
```

This appends to task.md (preserving history) and auto-injects the updated context into future submissions.

## Troubleshooting

### tmux errors / "session not found"

Check if the tmux session exists:

```bash
tmux ls
```

If the session was killed, restart with `ralph-lisa auto`.

### Agent crashes and the loop stops

There is no auto-recovery yet. When an agent crashes (possibly from long context or resource exhaustion):

1. Check the tmux pane for error output
2. Restart the crashed agent manually
3. Use `ralph-lisa force-turn <agent>` if the turn state is incorrect

### State desync / wrong turn displayed

Check the actual state:

```bash
ralph-lisa status
```

If the turn is wrong, force it:

```bash
ralph-lisa force-turn ralph    # or lisa
```

### Watcher not triggering / slow

1. Verify fswatch (macOS) or inotify-tools (Linux) is installed
2. Check the heartbeat file: `ls -la .dual-agent/.watcher_heartbeat`
3. Check watcher logs: `ralph-lisa logs`

Without fswatch/inotify-tools, the watcher falls back to polling which is slower.

### Submissions rejected in block mode

If `RL_POLICY_MODE=block` and your submission is rejected:

```bash
# Check what's wrong
ralph-lisa policy check ralph    # or lisa

# Common issues:
# - [PLAN] missing test plan (test command + coverage scope)
# - [CODE]/[FIX] missing "Test Results" section
# - [CODE]/[FIX] Test Results missing exit code or pass/fail count
#   (add "Exit code: 0" or "42/42 passed", or "Skipped: reason")
# - [RESEARCH] has no substantive content or missing Verified:/Evidence: markers
# - [PASS]/[NEEDS_WORK] missing reasons or file:line references
# - Submitting [CODE]/[PLAN] after [NEEDS_WORK] (must use [FIX]/[CHALLENGE] first)
```

## Platform Support

### Does it work on Windows?

Not directly. Auto mode requires tmux, which is not available on native Windows.

**Workarounds:**
- **WSL2** (recommended): Install WSL2 with Ubuntu, then install Node.js, tmux, and inotify-tools inside WSL
- **Manual mode**: The basic CLI may partially work on Windows for manual mode (no tmux needed), but this is untested

Future plans include integration with [Margay](https://github.com/YW1975/Margay) via ACP protocol, which would provide native cross-platform support through an Electron app.

### Does it work on Linux?

Yes. Use `inotify-tools` instead of `fswatch` for file watching:

```bash
apt install tmux inotify-tools
```

## Cost and Tokens

### How much does a session cost?

Depends on task complexity and number of rounds. Rough estimates:

| Component | Per-round cost |
|-----------|---------------|
| Ralph (Claude Code) | ~$0.15–0.50 |
| Lisa (Codex) | ~$0.05–0.20 |
| **Round total** | **~$0.20–0.70** |

A typical session of 10–15 rounds costs roughly $3–10. Worst case (25+ rounds with deadlock retries) can reach $15–20.

### How do I minimize token usage?

- **Keep tasks focused.** Break large work into steps using `ralph-lisa step`.
- **Use `update-task`** to redirect rather than starting over.
- **Set checkpoint rounds** (`RL_CHECKPOINT_ROUNDS=5`) to review progress and intervene before costs escalate.
- **Use manual mode** when you want tighter control over what each agent does.

## Architecture

### How is this different from Ralph Wiggum Loop?

| Aspect | Ralph Wiggum Loop | Ralph-Lisa Loop |
|--------|------------------|-----------------|
| Agents | 1 (self-loop) | 2 (developer + reviewer) |
| Validation | `<promise>` tag | Lisa's verdict + consensus |
| Review | None | Mandatory every round |
| Bias | High (self-grading) | Low (external review) |
| Best for | Simple, well-defined tasks | Complex, ambiguous tasks |

The two tools don't conflict and can coexist in the same project.

### Why not just use Claude Code alone?

A single agent writes code AND decides if it's done — like grading your own exam. It suffers from:

1. **Self-validation bias**: No external check
2. **Tunnel vision**: Missing edge cases it consistently overlooks
3. **No friction**: Bad ideas pass unchallenged
4. **Context drift**: Forgetting requirements mid-task

Ralph-Lisa Loop applies the same solution software engineering discovered decades ago: code review.

### Can two agents get stuck in an infinite loop?

No. After 8 consecutive `[NEEDS_WORK]` rounds, the watcher automatically pauses and flags a deadlock. You can resolve it with:

- **`ralph-lisa scope-update`**: Redefine the task to break the cycle
- **`ralph-lisa force-turn`**: Manually override the turn
- **Manual intervention**: Decide how to proceed as the human arbiter

Additionally, `RL_CHECKPOINT_ROUNDS` lets you pause for human review at regular intervals.
