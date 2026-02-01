# Ralph Lisa Dual-Agent Loop

Minimal dual-agent collaboration framework for Ralph (developer) and Lisa (reviewer). Scripts handle I/O only; workflow rules are in agent prompts.

## Quick Start (Automated)

### 1. Initialize Project

```bash
cd your-project
./path/to/mini-skill/ralph-lisa-init.sh
```

This will:
- Append Ralph role to `CLAUDE.md` (for Claude Code)
- Create Lisa skill at `.codex/skills/ralph-lisa-loop/SKILL.md` (for Codex)
- Initialize `.dual-agent/` session directory

### 2. Start Both Agents

```bash
./path/to/mini-skill/ralph-lisa-start.sh "Implement feature X"
```

This will:
- Open Terminal 1: Claude Code (Ralph)
- Open Terminal 2: Codex with Lisa skill
- Initialize the task

Supports: macOS Terminal, iTerm2, tmux

---

## Manual Quick Start

### Terminal 1 (Ralph - Lead Developer)

```bash
# 1. Initialize
/dual-init "Implement user login feature"

# 2. Draft plan
/dual-ralph "## Plan\n1. Create login form\n2. Implement validation\n3. Add error handling"

# 3. Wait for Lisa's feedback
/dual-wait review.md

# 4. View status
/dual-status

# 5. Move to next step (after Lisa's PASS)
/dual-next step "Create login form"
```

### Terminal 2 (Lisa - Navigator/Reviewer)

```bash
# 1. Wait for Ralph's submission
/dual-wait work.md

# 2. Review and respond
/dual-lisa "### Verdict: PASS\n### Feedback: Plan looks good, proceed"

# 3. Wait for next round
/dual-wait work.md
```

## Commands

| Command | Purpose | Who |
|---------|---------|-----|
| `/dual-init "task"` | Initialize session | Ralph |
| `/dual-ralph "content"` | Submit work | Ralph |
| `/dual-lisa "content"` | Submit review | Lisa |
| `/dual-wait <file>` | Wait for partner | Both |
| `/dual-status` | View status | Both |
| `/dual-history` | View full history | Both |
| `/dual-next` | Increment round | Both |
| `/dual-next step "name"` | Switch step | Ralph |
| `/dual-archive [name]` | Archive session | Both |

## File Structure

```
.dual-agent/                    # Runtime state
├── task.md                     # Task description
├── plan.md                     # Agreed plan
├── round.txt                   # Current round
├── step.txt                    # Current step
├── work.md                     # Ralph's current output
├── review.md                   # Lisa's current feedback
└── history.md                  # Cumulative history

mini-skill/                     # Skill definition
├── io.sh                       # Single I/O script
├── skill.json                  # Metadata
├── agents/
│   ├── ralph.md                # Ralph role definition
│   └── lisa.md                 # Lisa role definition
└── commands/
    └── *.md                    # Command definitions
```

## Core Rules (defined in agents/*.md)

1. **Consensus First**: Every step requires mutual agreement before proceeding
2. **Plan Before Execute**: Complex tasks require plan consensus before implementation
3. **Deadlock Handling**: After 5 rounds, declare OVERRIDE or HANDOFF

## Direct io.sh Usage

```bash
# Initialize
./io.sh init "task description"

# Write (role-specific)
./io.sh ralph "content"
./io.sh lisa "content"

# Read
./io.sh read work.md
./io.sh read review.md

# Wait for changes
./io.sh wait review.md 300

# Status
./io.sh status
./io.sh history

# Round/Step management
./io.sh next
./io.sh step "step name"

# Archive/Clean
./io.sh archive my-feature
./io.sh clean
```

## Design Philosophy

```
┌─────────────────────────────────────────────────┐
│               Skill / Commands                   │
│  dual-init, dual-ralph, dual-lisa, dual-wait   │
│  Define command interface                        │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│               Agent Prompts                      │
│  agents/ralph.md, agents/lisa.md                │
│  Define roles, workflow, consensus rules         │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│                  I/O Layer                       │
│  io.sh: write/read/wait/status/next/step        │
│  Pure file operations, no business logic         │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│                 State Files                      │
│  .dual-agent/work.md, review.md, history.md     │
└─────────────────────────────────────────────────┘
```

**Workflow control is in agent prompts, scripts only transfer files.**

## Communication Flow

```
┌─────────────────┐              ┌─────────────────┐
│  Claude (Ralph) │              │  Codex (Lisa)   │
├─────────────────┤              ├─────────────────┤
│ io.sh ralph     │──▶ work.md ──│ io.sh wait      │
│ io.sh wait      │◀── review.md─│ io.sh lisa      │
└─────────────────┘              └─────────────────┘
         │                              │
         └──────── .dual-agent/ ────────┘
                  (shared directory)
```

## Important Notes

- **Before new task**: Run `/dual-archive` or `io.sh clean` to avoid overwriting
- **Wait timeout**: Default 300s, pass custom value: `/dual-wait work.md 600`
- **Max rounds**: Not enforced by script; follow 5-round rule in agent prompts
- **Plan consensus**: Use `plan.md` to record agreed plan before implementation
