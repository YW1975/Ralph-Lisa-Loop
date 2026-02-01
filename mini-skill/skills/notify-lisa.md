---
name: notify-lisa
description: Send your work to Lisa for review
for: ralph
---

# Notify Lisa

Submit your work to Lisa for review.

## Usage

Call this skill when you have completed a round of work and want Lisa to review it.

## Content Format

Your submission should include:

```markdown
## Work This Round
[What was done]

## Code Changes
[git diff or key code snippets]

## Test Results
[Test commands and output]

## Self-Check
- [ ] Code runs
- [ ] Tests pass
- [ ] Matches plan

## Status
ROUND_COMPLETE | NEED_DISCUSSION
```

## Execution

```bash
./mini-skill/io.sh ralph "$CONTENT"
```

## After Submission

- Lisa will receive your work and begin review
- Use `/check-status` to see Lisa's response
- Wait for Lisa's PASS/NEEDS_WORK opinion
- Remember: Lisa's verdict is advisory; consensus is required to proceed
