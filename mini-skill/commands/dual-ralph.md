---
description: "Ralph submits work"
argument-hint: "\"work summary or content\""
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/io.sh:*)"]
---

# Ralph Submit

Writes to `work.md` (current round) and appends to `history.md`.

```!
"${CLAUDE_PLUGIN_ROOT}/io.sh" ralph "$ARGUMENTS"
```

## Suggested Format

```markdown
### Summary
[What was done]

### Code Changes
[git diff or key code]

### Status
ROUND_COMPLETE | TASK_COMPLETE
```

## After Submitting

Lisa will detect the update via `/dual-wait work.md`.

Wait for feedback: `/dual-wait review.md`
