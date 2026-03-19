---
description: Check whose turn it is in Ralph-Lisa collaboration
---

# Check Turn

Check whose turn it is before taking any action.

```!
ralph-lisa whose-turn
```

## Rules

- If output is `ralph`: You can proceed with your work
- If output is `lisa`: Wait for Lisa's feedback — do not take further action until your turn

**NEVER skip this check. When it's not your turn, do not submit work. You may use subagents for preparatory tasks (research, environment checks). If triggered by the user but it's not your turn, suggest checking watcher status: `cat .dual-agent/.watcher_heartbeat` and `ralph-lisa status`.**
