---
description: "Lisa submits review"
argument-hint: "\"PASS|NEEDS_WORK + feedback\""
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/io.sh:*)"]
---

# Lisa Submit Review

Writes to `review.md` (current round) and appends to `history.md`.

```!
"${CLAUDE_PLUGIN_ROOT}/io.sh" lisa "$ARGUMENTS"
```

## Format

```markdown
### Verdict
PASS | NEEDS_WORK

### Checklist
- [x/] Objectives met
- [x/] Code correct

### Feedback
[Specific issues or suggestions]
```

## Verdict Criteria

**PASS**: Objectives complete, code correct, no obvious issues
**NEEDS_WORK**: Incomplete, bugs found, edge cases missing

## After Submitting

Ralph will detect the update via `/dual-wait review.md`.

Wait for next round: `/dual-wait work.md`
