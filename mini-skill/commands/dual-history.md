---
description: "View full collaboration history"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/io.sh:*)"]
---

# View History

Displays cumulative history of all rounds.

```!
"${CLAUDE_PLUGIN_ROOT}/io.sh" history
```

## Notes

- `work.md` / `review.md` only contain current round
- `history.md` contains all rounds (append-only)
