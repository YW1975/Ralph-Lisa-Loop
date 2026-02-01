---
name: new-step
description: Enter a new phase/step (resets round to 1)
for: ralph
---

# New Step

Enter a new phase of work, resetting the round counter.

## IMPORTANT: Consensus Required

Only enter a new step after both parties agree the previous step is complete.

## Usage

Call this skill when moving from one phase to another:
- Planning → Implementation
- Implementation Step 1 → Implementation Step 2
- etc.

## Execution

```bash
./mini-skill/io.sh step "step name"
```

## Example

```bash
./mini-skill/io.sh step "implement login form"
```

## Output

```
Entered step: implement login form (round reset to 1)
```

## History Entry

A new step marker is added to history.md:

```markdown
---

# Step: implement login form

Started: [timestamp]
```
