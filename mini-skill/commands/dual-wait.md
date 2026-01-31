---
description: "Wait for partner's response"
argument-hint: "<work.md|review.md> [timeout_seconds]"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/io.sh:*)"]
---

# Wait for Response

Polls for file changes and displays content when updated.

**Ralph waits for Lisa**:
```bash
/dual-wait review.md
```

**Lisa waits for Ralph**:
```bash
/dual-wait work.md
```

```!
"${CLAUDE_PLUGIN_ROOT}/io.sh" wait $ARGUMENTS
```

## Parameters

- `work.md`: Ralph's work file
- `review.md`: Lisa's feedback file
- `timeout`: Seconds before timeout (default: 300)
