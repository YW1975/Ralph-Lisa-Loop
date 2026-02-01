---
name: next-round
description: Proceed to next round (requires consensus)
for: both
---

# Next Round

Increment the round counter and proceed.

## IMPORTANT: Consensus Required

**Only call this skill when BOTH parties have agreed that the current step is complete.**

- Lisa's PASS is an advisory opinion, not automatic approval
- Ralph must confirm agreement before proceeding
- If there's disagreement, continue discussion first

## Usage

Call this skill after consensus is reached:

1. Lisa gives PASS opinion
2. Ralph evaluates and agrees
3. Ralph confirms consensus via `/notify-lisa`
4. Either party calls `/next-round`

## Execution

```bash
./mini-skill/io.sh next
```

## Output

```
Round: N -> N+1
```

## When NOT to Use

- When Lisa gave NEEDS_WORK and issues aren't resolved
- When Ralph disagrees with Lisa's assessment
- When discussion is still ongoing
- When consensus hasn't been explicitly confirmed
