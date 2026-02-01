---
name: view-history
description: View full collaboration history
for: both
---

# View History

View the complete history of the collaboration.

## Usage

Call this skill to see all past submissions and responses in chronological order.

## Execution

```bash
./mini-skill/io.sh history
```

## Output

```markdown
# Collaboration History

**Task**: [task description]
**Started**: [timestamp]

---

## [Ralph] Round 1 | Step: planning
**Time**: [timestamp]

[Ralph's submission content]

---

## [Lisa] Round 1 | Step: planning
**Time**: [timestamp]

[Lisa's response content]

---

# Step: implement

Started: [timestamp]

---

## [Ralph] Round 1 | Step: implement
...
```

## When to Use

- To review past discussions
- To understand how decisions were made
- To reference earlier context
