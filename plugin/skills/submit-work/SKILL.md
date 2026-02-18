---
description: Submit your work to Lisa for review (Ralph only)
argument-hint: "[TAG] summary and content"
---

# Submit Work to Lisa

Submit your work and pass the turn to Lisa.

## Recommended: File-based submission (avoids shell escaping issues)

1. Write your content to `.dual-agent/submit.md` (or any file)
2. Run:

```!
ralph-lisa submit-ralph --file .dual-agent/submit.md
```

## Alternative: Inline (short, simple content only)

```!
ralph-lisa submit-ralph "$ARGUMENTS"
```

**Warning**: Inline mode may fail with special characters (`[]`, backticks, `$`, nested quotes). Use `--file` for anything beyond simple text.

## Required Format

Your content MUST start with a tag and one-line summary:

```
[TAG] One line summary

Detailed content here...
```

## Valid Tags for Ralph

| Tag | When to Use |
|-----|-------------|
| `[PLAN]` | Submitting a plan |
| `[RESEARCH]` | Submitting research results (before coding, when involving reference implementations/protocols/APIs) |
| `[CODE]` | Submitting code implementation (must include Test Results) |
| `[FIX]` | Submitting fixes based on feedback (must include Test Results) |
| `[CHALLENGE]` | Disagreeing with Lisa's suggestion, providing counter-argument |
| `[DISCUSS]` | General discussion or clarification |
| `[QUESTION]` | Asking for clarification |
| `[CONSENSUS]` | Confirming agreement |

## After Submission

The turn automatically passes to Lisa. You must STOP and wait.
