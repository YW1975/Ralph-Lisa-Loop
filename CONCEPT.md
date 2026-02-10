# Ralph-Lisa Loop: The Concept

## Why Dual-Agent?

### The Single-Agent Problem

When one AI agent both writes code and judges completion, you get:

1. **Self-validation bias**: "I think I'm done" without external check
2. **Tunnel vision**: Missing edge cases the same model overlooks
3. **No friction**: Bad ideas sail through unchallenged
4. **Context drift**: Model forgets requirements mid-task

### The Human Code Review Model

Software engineering solved this decades ago:

```
Developer writes → Reviewer reviews → Iterate → Merge
```

Ralph-Lisa Loop applies the same principle to AI agents.

## Core Principles

### 1. Turn Control

Only one agent works at a time. This prevents:
- Race conditions in file modifications
- Conflicting decisions
- Infinite loops of mutual editing

```
Ralph: whose-turn → "ralph" → work → submit → STOP
Lisa:  whose-turn → "lisa"  → review → submit → STOP
```

### 2. Evidence-Based Verdicts

Lisa doesn't just say "looks good." She must reference:
- Does code match the plan?
- Does it meet requirements?
- Are edge cases handled?
- Are tests adequate?

### 3. Advisory, Not Authoritative

Lisa's `[PASS]` or `[NEEDS_WORK]` is a professional opinion, not a command. Ralph can:
- Accept and proceed
- Disagree and explain why
- Request clarification

This prevents rubber-stamping and encourages genuine dialogue.

### 4. Consensus Required

Neither agent can unilaterally advance to the next phase. Both must explicitly agree via `[CONSENSUS]` tags.

### 5. Human Escalation

After 5 rounds without resolution:
- `[OVERRIDE]`: Proceed with documented disagreement
- `[HANDOFF]`: Escalate to human decision

No infinite loops. No stuck states.

## Ralph-Lisa vs Ralph Wiggum Loop

| Aspect | Ralph Wiggum Loop (RWL) | Ralph-Lisa Loop (R&L) |
|--------|------------------------|----------------------|
| Agents | 1 (self-loop) | 2 (developer + reviewer) |
| Validation | `<promise>` tag | Lisa's verdict + consensus |
| Review | None | Mandatory every round |
| Bias | High (self-grading) | Low (external review) |
| Best for | Simple, well-defined tasks | Complex, ambiguous tasks |

## When to Use Ralph-Lisa Loop

**Good fit**:
- Multi-step implementations
- Architectural decisions
- Code that affects users/security
- Ambiguous requirements
- Learning/training scenarios

**Overkill**:
- One-line fixes
- Well-tested refactoring
- Personal scripts
- Time-critical hotfixes

## V3: npm CLI + Policy + Zero Intrusion

### Install Once, Use Everywhere

```bash
npm i -g ralph-lisa-loop
ralph-lisa init          # Initialize project
ralph-lisa uninit        # Clean removal
```

### Policy Layer

Configurable submission quality checks:

| Mode | Behavior |
|------|----------|
| `off` | No checks (default) |
| `warn` | Print warnings, don't block |
| `block` | Reject non-compliant submissions |

```bash
export RL_POLICY_MODE=warn
ralph-lisa submit-ralph "[CODE] ..."  # Warns if missing Test Results
```

### Zero Intrusion (Plugin Architecture)

- **Claude Code**: Plugin with skills + hooks + agents (no project-level files)
- **Codex**: Global `~/.codex/` config + skills (no project-level files)
- **Project**: Only `.dual-agent/` runtime state (can be .gitignored)

## The Philosophy

> "Two heads are better than one, even if both heads are AI."

The goal isn't to slow things down. It's to catch errors early, challenge assumptions, and produce better code through structured dialogue.

Ralph-Lisa Loop trades speed for reliability. Use it when correctness matters more than velocity.
