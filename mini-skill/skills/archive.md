---
name: archive
description: Archive the current session
for: both
---

# Archive Session

Save the current session to the archive directory.

## Usage

Call this skill to preserve the current collaboration before starting a new task.

## Execution

```bash
./mini-skill/io.sh archive [name]
```

## Examples

```bash
# Archive with auto-generated timestamp name
./mini-skill/io.sh archive

# Archive with custom name
./mini-skill/io.sh archive login-feature
```

## Archive Location

```
.dual-agent-archive/
├── 20260201_120000/     # Timestamp-named archive
│   ├── task.md
│   ├── history.md
│   └── ...
└── login-feature/       # Custom-named archive
    └── ...
```

## When to Use

- Before starting a new task
- When completing a task for record-keeping
- Before making major changes to the session
