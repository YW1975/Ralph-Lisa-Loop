# Ralph-Lisa Dual-Agent Collaboration Plan

## Overview

Two-phase plan to achieve reliable dual-agent collaboration between Claude Code (Ralph) and Codex (Lisa).

---

## Current State

**mini-skill approach**: Script-based turn control with manual triggering.

```
.dual-agent/
├── turn.txt      # "ralph" or "lisa"
├── work.md       # Ralph's submissions
├── review.md     # Lisa's submissions
└── history.md    # Full history
```

**Problems**:
1. Agents don't auto-check turn - need user prompt
2. No automatic continuation after partner responds
3. Consensus/phase summaries not enforced
4. Context loss after window overflow

---

## Phase 1: Stable Manual Workflow

**Goal**: Reliable manual workflow with proper conventions before automation.

### 1.1 Workflow Convention

```
┌─────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT CYCLE                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ PLANNING │───►│ IMPLEMENT│───►│  REVIEW  │              │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘              │
│       │               │               │                     │
│       ▼               ▼               ▼                     │
│  [CONSENSUS]    [CONSENSUS]     [CONSENSUS]                │
│       │               │               │                     │
│       ▼               ▼               ▼                     │
│  Write to         Write to        Write to                 │
│  plan.md          history.md      history.md               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Documentation Requirements

**Every phase transition MUST include**:

1. **Phase Summary** in `history.md`:
   ```markdown
   ## Phase Summary: [phase-name]

   ### Completed
   - Item 1
   - Item 2

   ### Decisions Made
   - Decision 1: [rationale]

   ### Open Issues
   - Issue 1: [status]

   ### Test Results
   - Coverage: X%
   - Passing: Y/Z

   ### Next Phase Entry Criteria
   - Criteria 1
   ```

2. **Plan Updates** in `plan.md`:
   - Any changes to original plan
   - New constraints discovered
   - Scope adjustments

### 1.3 Consensus Protocol

```
Ralph submits [PLAN/CODE/FIX]
    │
    ▼
Lisa reviews
    │
    ├── [PASS] ──────────► Both submit [CONSENSUS]
    │                           │
    │                           ▼
    │                      Write Phase Summary
    │                           │
    │                           ▼
    │                      /next-step allowed
    │
    ├── [NEEDS_WORK] ────► Ralph addresses feedback
    │                           │
    │                           ▼
    │                      Re-submit [FIX]
    │
    └── [DISCUSS] ───────► Back-and-forth
                                │
                           Max 5 rounds
                                │
                                ▼
                          [OVERRIDE] or [HANDOFF]
```

### 1.4 File Structure Update

```
.dual-agent/
├── turn.txt           # Current turn
├── round.txt          # Round counter
├── step.txt           # Current phase name
├── plan.md            # Living plan document (updated on consensus)
├── work.md            # Ralph's latest submission
├── review.md          # Lisa's latest submission
├── history.md         # Full history with phase summaries
└── consensus/         # Consensus records
    └── [phase]-[date].md
```

### 1.5 Updated Role Instructions

**Ralph additions**:
```markdown
## Documentation Rules

1. BEFORE /next-step: Write phase summary to history.md
2. ON CONSENSUS: Update plan.md if any changes
3. AFTER CONTEXT RESET: First read plan.md and history.md

## Context Recovery
If you don't remember previous work:
1. ./mini-skill/io.sh read plan.md
2. ./mini-skill/io.sh history | tail -100
3. Resume from last phase summary
```

**Lisa additions**:
```markdown
## Documentation Rules

1. VERIFY phase summary before approving /next-step
2. CHECK plan.md alignment on every review
3. REQUIRE consensus record before phase transition

## Review Checklist Addition
- [ ] Phase summary written (if phase ending)
- [ ] Plan.md updated (if changes made)
- [ ] history.md has decision rationale
```

### 1.6 Commands Update

Add to `io.sh`:

```bash
# Write phase summary
io.sh phase-summary "phase-name" "summary content"

# Record consensus
io.sh consensus "topic" "decision"

# Context recovery
io.sh recover   # Shows plan + recent history
```

---

## Phase 2: Full Automation

**Goal**: Agents automatically continue without user intervention.

### 2.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AUTOMATION LAYER                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │   Claude Code    │         │      Codex       │         │
│  │    (Ralph)       │         │     (Lisa)       │         │
│  ├──────────────────┤         ├──────────────────┤         │
│  │   stop-hook.sh   │◄───────►│  stop-hook.sh    │         │
│  │   (built-in)     │  Files  │  (patched)       │         │
│  └────────┬─────────┘         └────────┬─────────┘         │
│           │                            │                    │
│           ▼                            ▼                    │
│  ┌─────────────────────────────────────────────────┐       │
│  │              .dual-agent/                        │       │
│  │  turn.txt | work.md | review.md | history.md    │       │
│  └─────────────────────────────────────────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Claude Code Stop Hook (Ralph)

Adapt existing `hooks/stop-hook.sh`:

```bash
#!/bin/bash
# Ralph stop-hook for dual-agent mode

HOOK_INPUT=$(cat)
STATE_DIR=".dual-agent"

# No session - exit normally
[[ ! -f "$STATE_DIR/turn.txt" ]] && exit 0

# Get current state
TURN=$(cat "$STATE_DIR/turn.txt")
ROUND=$(cat "$STATE_DIR/round.txt" 2>/dev/null || echo "1")

# Extract Ralph's output from transcript
TRANSCRIPT=$(echo "$HOOK_INPUT" | jq -r '.transcript_path')
LAST_OUTPUT=$(jq -r '[.[] | select(.role=="assistant")] | last |
  .message.content | map(select(.type=="text")) | map(.text) | join("\n")' "$TRANSCRIPT")

# Check for completion tags
if echo "$LAST_OUTPUT" | grep -q '\[CONSENSUS\].*COMPLETE'; then
  echo "Task complete!"
  exit 0
fi

# If Ralph just submitted, wait for Lisa
if [[ "$TURN" == "lisa" ]]; then
  echo "Waiting for Lisa review..."

  # Poll for Lisa's response (with timeout)
  TIMEOUT=300
  INTERVAL=5
  ELAPSED=0
  LISA_ROUND=$(cat "$STATE_DIR/lisa_round.txt" 2>/dev/null || echo "0")

  while [[ $ELAPSED -lt $TIMEOUT ]]; do
    NEW_ROUND=$(cat "$STATE_DIR/lisa_round.txt" 2>/dev/null || echo "0")
    if [[ "$NEW_ROUND" -gt "$LISA_ROUND" ]]; then
      break
    fi
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
  done

  if [[ $ELAPSED -ge $TIMEOUT ]]; then
    echo "Lisa timeout - manual intervention needed"
    exit 0
  fi
fi

# Continue loop - inject Lisa's feedback
LISA_REVIEW=$(cat "$STATE_DIR/review.md" 2>/dev/null || echo "No review yet")

jq -n \
  --arg review "$LISA_REVIEW" \
  --arg round "$ROUND" \
  '{
    "decision": "block",
    "reason": ("Continue with Lisa feedback:\n\n" + $review),
    "systemMessage": ("Round " + $round + " | Check turn, read review, continue work")
  }'
```

### 2.3 Codex Patch (Lisa)

**Option A: Fork and patch** (Recommended for long-term)

Add hook system to Codex CLI:

```typescript
// codex/src/hooks.ts
interface StopHook {
  onStop(context: HookContext): Promise<HookResult>;
}

interface HookResult {
  decision: 'allow' | 'block';
  reason?: string;
  systemMessage?: string;
}

// In main loop, before exit:
const hookResult = await runStopHooks(context);
if (hookResult.decision === 'block') {
  // Inject reason as next prompt
  await continueWithPrompt(hookResult.reason, hookResult.systemMessage);
}
```

**Option B: Wrapper script** (Quick implementation)

```bash
#!/bin/bash
# lisa-loop.sh - Codex wrapper with stop-hook behavior

STATE_DIR=".dual-agent"

while true; do
  # Check turn
  TURN=$(cat "$STATE_DIR/turn.txt" 2>/dev/null || echo "ralph")

  if [[ "$TURN" != "lisa" ]]; then
    echo "Waiting for Ralph..."
    sleep 5
    continue
  fi

  # Read Ralph's work
  WORK=$(cat "$STATE_DIR/work.md")

  # Build prompt
  PROMPT="Review Ralph's submission and provide feedback:

$WORK

Use tags: [PASS], [NEEDS_WORK], [DISCUSS], [QUESTION], [CONSENSUS]"

  # Call Codex non-interactively
  REVIEW=$(codex --non-interactive --prompt "$PROMPT")

  # Write review
  echo "$REVIEW" > "$STATE_DIR/review.md"

  # Update turn
  echo "ralph" > "$STATE_DIR/turn.txt"

  # Check for completion
  if echo "$REVIEW" | grep -q '\[CONSENSUS\].*COMPLETE'; then
    echo "Task complete!"
    break
  fi
done
```

### 2.4 Safety Mechanisms

1. **Max Rounds**: Hard limit (default 20) before forced stop
2. **Deadlock Detection**: 5 rounds same topic → require human intervention
3. **Cost Control**: Track API calls, pause at threshold
4. **Checkpoint**: Save full state every 5 rounds for recovery
5. **Manual Override**: `touch .dual-agent/STOP` halts loop

### 2.5 Implementation Steps

```
Phase 2 Implementation:

Week 1: Claude Code stop-hook
  - [ ] Adapt existing hook for dual-agent mode
  - [ ] Add turn polling with timeout
  - [ ] Test with manual Lisa responses

Week 2: Codex wrapper (Option B)
  - [ ] Implement lisa-loop.sh wrapper
  - [ ] Add non-interactive Codex invocation
  - [ ] Test end-to-end loop

Week 3: Integration & Safety
  - [ ] Add safety mechanisms
  - [ ] Implement checkpointing
  - [ ] Add monitoring/logging

Week 4+: Codex patch (Option A)
  - [ ] Fork Codex repository
  - [ ] Implement hook system
  - [ ] Submit PR or maintain fork
```

---

## Migration Path

```
Current State
     │
     ▼
Phase 1: Stable Manual ◄─── You are here
     │
     │  (2-4 weeks usage, validate conventions)
     │
     ▼
Phase 2a: Claude hook + Codex wrapper
     │
     │  (2-4 weeks, validate automation)
     │
     ▼
Phase 2b: Full Codex patch (optional)
```

---

## Open Questions for Discussion

1. **Codex non-interactive mode**: Does `codex` CLI support non-interactive invocation with prompt input? Need to verify.

2. **Hook execution context**: Does Codex have plugin/extension system we can leverage instead of patching?

3. **State persistence**: Should we use SQLite instead of flat files for better atomicity?

4. **Multi-project**: Should state be per-project or global?

5. **Recovery**: How to handle mid-loop crashes? Auto-resume or manual restart?

---

## Appendix: Command Reference

### Phase 1 Commands

```bash
# Turn control
./mini-skill/io.sh whose-turn
./mini-skill/io.sh submit-ralph "[TAG] summary..."
./mini-skill/io.sh submit-lisa "[TAG] summary..."

# Status
./mini-skill/io.sh status
./mini-skill/io.sh history

# Documentation
./mini-skill/io.sh phase-summary "name" "content"  # NEW
./mini-skill/io.sh consensus "topic" "decision"    # NEW
./mini-skill/io.sh recover                         # NEW

# Phase control
./mini-skill/io.sh step "phase-name"
./mini-skill/io.sh archive [name]
```

### Phase 2 Commands

```bash
# Auto mode
./mini-skill/ralph-lisa-auto.sh "task"  # Launches both with hooks

# Manual override
touch .dual-agent/STOP                   # Halt loop
touch .dual-agent/CONTINUE               # Resume loop
./mini-skill/io.sh checkpoint            # Force save state
```
