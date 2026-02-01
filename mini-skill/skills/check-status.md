---
name: check-status
description: View current collaboration status
for: both
---

# Check Status

View the current state of the collaboration.

## Usage

Call this skill to see:
- Current task description
- Current round and step
- Ralph's latest submission (work.md)
- Lisa's latest response (review.md)

## Execution

```bash
./mini-skill/io.sh status
```

## Output

```
========================================
Ralph Lisa Dual-Agent Loop Status
========================================
Task: [task description]
Round: N | Step: [step name]

--- Ralph (work.md) ---
[Ralph's latest submission]

--- Lisa (review.md) ---
[Lisa's latest response]
========================================
```

## When to Use

- To see your partner's latest submission
- To check current progress
- To review before responding
