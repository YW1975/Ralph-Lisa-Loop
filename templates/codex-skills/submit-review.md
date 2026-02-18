# Submit Review

Submit your review and pass the turn to Ralph.

## Recommended: File-based submission (avoids shell escaping issues)

1. Write your review to `.dual-agent/submit.md` (or any file)
2. Run:

```bash
ralph-lisa submit-lisa --file .dual-agent/submit.md
```

## Alternative: Inline (short, simple content only)

```bash
ralph-lisa submit-lisa "[TAG] summary

detailed content..."
```

**Warning**: Inline mode may fail with special characters (`[]`, backticks, `$`, nested quotes). Use `--file` for anything beyond simple text.

## Required Format

Your content MUST start with a tag and one-line summary:

```
[TAG] One line summary

Detailed content here...
```

## Valid Tags for Lisa

| Tag | When to Use |
|-----|-------------|
| `[PASS]` | Work approved, can proceed (must include at least 1 reason) |
| `[NEEDS_WORK]` | Issues found, needs changes (must include at least 1 reason) |
| `[CHALLENGE]` | Disagreeing with Ralph's argument, providing counter-argument |
| `[DISCUSS]` | General discussion or clarification |
| `[QUESTION]` | Asking for clarification |
| `[CONSENSUS]` | Confirming agreement |

## After Submission

The turn automatically passes to Ralph. You must STOP and wait.
