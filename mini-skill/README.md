# Ralph Lisa Dual-Agent Loop

Turn-based dual-agent collaboration framework with enforced handoff.

## Key Features

- **Turn Control**: Agents must check `whose-turn` before any action
- **Auto Handoff**: `submit-ralph/lisa` automatically passes turn
- **Tag System**: Every submission requires `[TAG]` and summary
- **Consensus Required**: Both parties must agree before proceeding

## Quick Start

### 1. Initialize

```bash
cd your-project
/path/to/mini-skill/ralph-lisa-init.sh
```

### 2. Start Agents

```bash
/path/to/mini-skill/ralph-lisa-start.sh "your task"
```

Or manually:
```bash
# Terminal 1 (Ralph)
# - CLAUDE.md auto-loaded as instructions
# - .claude/commands/ auto-loaded as slash commands (/check-turn, etc.)
claude

# Terminal 2 (Lisa)
# - .codex/config.toml provides instructions and skills config
codex
```

## Turn-Based Workflow

```
Ralph checks: ./mini-skill/io.sh whose-turn
  → "ralph" → Work
  → "lisa"  → STOP

Ralph submits: ./mini-skill/io.sh submit-ralph "[PLAN] summary..."
  → Auto passes turn to Lisa
  → Ralph STOPS

Lisa checks: ./mini-skill/io.sh whose-turn
  → "lisa"  → Review
  → "ralph" → STOP

Lisa submits: ./mini-skill/io.sh submit-lisa "[PASS] summary..."
  → Auto passes turn to Ralph
  → Lisa STOPS

...repeat...
```

## Tags

### Ralph's Tags
| Tag | Use |
|-----|-----|
| `[PLAN]` | Submitting a plan |
| `[CODE]` | Submitting code |
| `[FIX]` | Submitting fixes |
| `[DISCUSS]` | Disagreeing with Lisa |
| `[QUESTION]` | Asking clarification |
| `[CONSENSUS]` | Confirming agreement |

### Lisa's Tags
| Tag | Use |
|-----|-----|
| `[PASS]` | Work approved |
| `[NEEDS_WORK]` | Issues found |
| `[DISCUSS]` | Responding to Ralph |
| `[QUESTION]` | Asking clarification |
| `[CONSENSUS]` | Confirming agreement |

## Commands

### io.sh Commands
```bash
./mini-skill/io.sh whose-turn              # Check whose turn
./mini-skill/io.sh submit-ralph "[TAG]..." # Ralph submits
./mini-skill/io.sh submit-lisa "[TAG]..."  # Lisa submits
./mini-skill/io.sh status                  # View status
./mini-skill/io.sh read work.md            # Read Ralph's work
./mini-skill/io.sh read review.md          # Read Lisa's review
./mini-skill/io.sh step "name"             # Enter new step
./mini-skill/io.sh history                 # View full history
./mini-skill/io.sh archive [name]          # Archive session
```

### Claude Slash Commands
```
/check-turn          Check whose turn
/submit-work "..."   Submit and pass turn
/view-status         View status
/read-review         Read Lisa's review
/next-step "name"    Enter new step
```

## File Structure

```
project/
├── CLAUDE.md                          # Ralph's role (auto-read by Claude)
├── CODEX.md                           # Lisa's role (--instructions flag)
├── .claude/
│   └── commands/                      # Claude slash commands
│       ├── check-turn.md
│       ├── submit-work.md
│       └── ...
├── .codex/
│   ├── config.toml                    # Skills config (path = ".codex/skills")
│   └── skills/
│       └── ralph-lisa-loop/
│           └── SKILL.md               # Lisa's skill definition
├── mini-skill/
│   └── io.sh                          # I/O and turn control
└── .dual-agent/
    ├── turn.txt                       # Whose turn: "ralph" or "lisa"
    ├── work.md                        # Ralph's submissions
    ├── review.md                      # Lisa's submissions
    ├── last_action.txt                # Last action summary
    └── history.md                     # Full history
```

## Status Display

```
$ ./mini-skill/io.sh status

========================================
Ralph Lisa Dual-Agent Loop
========================================
Task: Implement login feature
Round: 3 | Step: implement

>>> Turn: lisa <<<
Last: [CODE] Implemented login form (by Ralph, 14:23:05)
========================================
```

## Important Rules

1. **Always check turn first** - Never skip `whose-turn`
2. **Use tags** - Every submission needs `[TAG] summary`
3. **Stop after submit** - Turn auto-passes, you must wait
4. **Consensus required** - Both agree before `/next-step`
5. **Deadlock escape** - After 5 rounds: OVERRIDE or HANDOFF
