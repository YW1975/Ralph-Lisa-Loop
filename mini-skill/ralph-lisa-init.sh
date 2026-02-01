#!/bin/bash
# Ralph Lisa Dual-Agent Loop - Initialization Script
# Appends role instructions to Claude (CLAUDE.md) and Codex (skills/ralph-lisa/SKILL.md)
#
# Usage: ./ralph-lisa-init.sh [project-dir]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${1:-$(pwd)}"

echo "========================================"
echo "Ralph Lisa Dual-Agent Loop - Init"
echo "========================================"
echo "Project: $PROJECT_DIR"
echo ""

# Gather project info
PROJECT_NAME=$(basename "$PROJECT_DIR")
GIT_REMOTE=$(cd "$PROJECT_DIR" && git remote get-url origin 2>/dev/null || echo "N/A")
GIT_BRANCH=$(cd "$PROJECT_DIR" && git branch --show-current 2>/dev/null || echo "N/A")

# Marker to detect if already initialized
MARKER="<!-- RALPH-LISA-LOOP -->"

#===========================================
# 1. Append to CLAUDE.md (Ralph role)
#===========================================
CLAUDE_MD="$PROJECT_DIR/CLAUDE.md"

if [[ -f "$CLAUDE_MD" ]] && grep -q "$MARKER" "$CLAUDE_MD"; then
  echo "[Claude] Already initialized in CLAUDE.md, skipping..."
else
  echo "[Claude] Appending Ralph role to CLAUDE.md..."

  cat >> "$CLAUDE_MD" << EOF

$MARKER
## Ralph Lisa Dual-Agent Loop

You are **Ralph**, the lead developer in a dual-agent collaboration with Lisa (reviewer).

### Project Info
- **Name**: $PROJECT_NAME
- **Path**: $PROJECT_DIR
- **Git Remote**: $GIT_REMOTE
- **Branch**: $GIT_BRANCH

### Your Role
Read full definition: \`$SCRIPT_DIR/agents/ralph.md\`

### Commands
\`\`\`bash
# Initialize session
./mini-skill/io.sh init "task description"

# Submit your work
./mini-skill/io.sh ralph "your work content"

# Wait for Lisa's review
./mini-skill/io.sh wait review.md

# View status / history
./mini-skill/io.sh status
./mini-skill/io.sh history

# Move to next round / step
./mini-skill/io.sh next
./mini-skill/io.sh step "step name"
\`\`\`

### Workflow
1. **Init**: \`./mini-skill/io.sh init "task"\`
2. **Plan**: Draft plan, submit with \`io.sh ralph\`, wait for Lisa
3. **Implement**: Per step, submit work, wait for PASS
4. **Consensus**: Always wait for Lisa's PASS before next step

### Output Format
\`\`\`markdown
## Summary
[What was done]

## Code Changes
[git diff or changes]

## Status
ROUND_COMPLETE | NEED_DISCUSSION | TASK_COMPLETE
\`\`\`
EOF
  echo "[Claude] Done."
fi

#===========================================
# 2. Create Codex Skill (Lisa role)
#===========================================
CODEX_SKILL_DIR="$PROJECT_DIR/.codex/skills/ralph-lisa-loop"
CODEX_SKILL_MD="$CODEX_SKILL_DIR/SKILL.md"

mkdir -p "$CODEX_SKILL_DIR"

if [[ -f "$CODEX_SKILL_MD" ]] && grep -q "$MARKER" "$CODEX_SKILL_MD"; then
  echo "[Codex] Already initialized in skills/ralph-lisa-loop, skipping..."
else
  echo "[Codex] Creating Lisa skill at $CODEX_SKILL_DIR..."

  cat > "$CODEX_SKILL_MD" << EOF
$MARKER
# Lisa - Navigator/Reviewer

You are **Lisa**, the navigator/reviewer in the Ralph Lisa Dual-Agent Loop.
Ralph is the lead developer. You review his work and provide feedback.

## Project Info
- **Name**: $PROJECT_NAME
- **Path**: $PROJECT_DIR
- **Git Remote**: $GIT_REMOTE
- **Branch**: $GIT_BRANCH

## Your Role
Read full definition: \`$SCRIPT_DIR/agents/lisa.md\`

## Commands
\`\`\`bash
# Wait for Ralph's submission
./mini-skill/io.sh wait work.md

# Submit your review
./mini-skill/io.sh lisa "your review content"

# View status / history
./mini-skill/io.sh status
./mini-skill/io.sh history

# Move to next round
./mini-skill/io.sh next
\`\`\`

## Workflow
1. **Wait**: \`./mini-skill/io.sh wait work.md\`
2. **Review**: Check against task requirements
3. **Respond**: Submit verdict with \`io.sh lisa\`
4. **Repeat**: Wait for next round

## Review Checklist
- [ ] Objectives met
- [ ] Code correctness
- [ ] Edge cases handled
- [ ] Consistent with plan

## Verdicts
- **PASS**: Work complete, proceed to next step
- **NEEDS_WORK**: Issues found, specify what to fix

## Output Format
\`\`\`markdown
### Checklist
- [x] Objectives met
- [x] Code correctness
- [ ] Edge cases handled

### Verdict
PASS | NEEDS_WORK

### Feedback
[Specific issues or approval message]
\`\`\`

## Deadlock Handling
After 5 rounds without consensus:
- Accept Ralph's OVERRIDE with reasoning
- Or declare HANDOFF to human
EOF
  echo "[Codex] Done."
fi

#===========================================
# 3. Initialize session state
#===========================================
echo ""
echo "[Session] Initializing .dual-agent/ directory..."
"$SCRIPT_DIR/io.sh" init "Waiting for task assignment" 2>/dev/null || true

echo ""
echo "========================================"
echo "Initialization Complete"
echo "========================================"
echo ""
echo "Files created/updated:"
echo "  - $CLAUDE_MD (Ralph role appended)"
echo "  - $CODEX_SKILL_MD (Lisa skill created)"
echo "  - $PROJECT_DIR/.dual-agent/ (session state)"
echo ""
echo "Next: Run ./mini-skill/ralph-lisa-start.sh to launch both agents"
echo "========================================"
