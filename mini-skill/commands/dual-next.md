---
description: "Move to next round or step"
argument-hint: "[step \"step name\"]"
allowed-tools: ["Bash(${CLAUDE_PLUGIN_ROOT}/io.sh:*)"]
---

# Next Round / Step

**Increment round** (within same step):
```!
"${CLAUDE_PLUGIN_ROOT}/io.sh" next
```

**Enter new step** (resets round to 1):
```!
"${CLAUDE_PLUGIN_ROOT}/io.sh" step "$ARGUMENTS"
```

## Usage

- **Continue discussion**: `/dual-next` → round +1
- **Move to next step**: `/dual-next step "implement login"` → new step, round=1

## Important

Only use after reaching consensus with your partner.
