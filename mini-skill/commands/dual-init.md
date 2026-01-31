---
description: "Initialize Ralph Lisa Dual-Agent Loop session"
argument-hint: "\"task description\""
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/io.sh:*)"]
---

# Initialize Session

Creates `.dual-agent/` directory with base files (task.md, plan.md, round.txt, step.txt).

⚠️ **Warning**: Existing session will be overwritten. Run `/dual-archive` first to save.

```!
"${CLAUDE_PLUGIN_ROOT}/io.sh" init "$ARGUMENTS"
```

## Files Created

```
.dual-agent/
├── task.md      # Task description
├── plan.md      # Plan (to be agreed upon)
├── round.txt    # Current round (1)
├── step.txt     # Current step (planning)
├── work.md      # Ralph's output
├── review.md    # Lisa's feedback
└── history.md   # Cumulative history
```

## Next Steps

1. **Ralph**: Read `agents/ralph.md`, draft plan, submit with `/dual-ralph`
2. **Lisa**: Read `agents/lisa.md`, wait with `/dual-wait work.md`
