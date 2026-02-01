---
name: init-session
description: Initialize a new collaboration session
for: ralph
---

# Initialize Session

Create a new collaboration session with a task description.

## Warning

This will overwrite any existing session. Use `/archive` first to save current work.

## Usage

Call this skill at the start of a new task.

## Execution

```bash
./mini-skill/io.sh init "task description"
```

## Example

```bash
./mini-skill/io.sh init "Implement user authentication with JWT tokens"
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

## After Initialization

1. Draft your plan
2. Use `/notify-lisa` to submit the plan
3. Wait for Lisa's review
4. Reach consensus before proceeding
