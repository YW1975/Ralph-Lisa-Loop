---
description: "Archive current session"
argument-hint: "[name]"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/io.sh:*)"]
---

# Archive Session

Copies `.dual-agent/` to `.dual-agent-archive/` for preservation.

```!
"${CLAUDE_PLUGIN_ROOT}/io.sh" archive $ARGUMENTS
```

## Archive Location

```
.dual-agent-archive/
├── 20260201_120000/   # Default: timestamp
│   ├── task.md
│   ├── history.md
│   └── ...
└── my-feature/        # Or custom name
    └── ...
```

## Use Cases

- Save completed task records
- Backup before starting new task
