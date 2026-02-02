#!/bin/bash
# Ralph Lisa Dual-Agent Loop - I/O Script
# Handles communication between Ralph and Lisa with turn-based control
#
# State files:
#   turn.txt   - Whose turn: "ralph" or "lisa"
#   work.md    - Ralph's submissions
#   review.md  - Lisa's submissions
#   history.md - Full history
#
# Tags: [PLAN] [CODE] [FIX] [PASS] [NEEDS_WORK] [DISCUSS] [QUESTION] [CONSENSUS]

set -euo pipefail

STATE_DIR=".dual-agent"
CMD="${1:-}"
shift || true

# Valid tags
VALID_TAGS="PLAN|CODE|FIX|PASS|NEEDS_WORK|DISCUSS|QUESTION|CONSENSUS"

check_session() {
  if [[ ! -d "$STATE_DIR" ]]; then
    echo "Error: Session not initialized. Run: io.sh init \"task description\""
    exit 1
  fi
}

# Get whose turn it is
get_turn() {
  cat "$STATE_DIR/turn.txt" 2>/dev/null || echo "ralph"
}

# Set whose turn it is
set_turn() {
  echo "$1" > "$STATE_DIR/turn.txt"
}

# Extract tag from content
extract_tag() {
  local content="$1"
  local first_line=$(echo "$content" | head -1)
  if [[ "$first_line" =~ ^\[($VALID_TAGS)\] ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    echo ""
  fi
}

# Extract summary from content (first line after tag)
extract_summary() {
  local content="$1"
  local first_line=$(echo "$content" | head -1)
  # Remove tag and get the rest of first line
  echo "$first_line" | sed -E "s/^\[($VALID_TAGS)\]\s*//"
}

# Append to history with tag and summary
append_history() {
  local role="$1"
  local content="$2"
  local tag=$(extract_tag "$content")
  local summary=$(extract_summary "$content")
  local round=$(cat "$STATE_DIR/round.txt" 2>/dev/null || echo "?")
  local step=$(cat "$STATE_DIR/step.txt" 2>/dev/null || echo "?")
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  cat >> "$STATE_DIR/history.md" << EOF

---

## [$role] [$tag] Round $round | Step: $step
**Time**: $timestamp
**Summary**: $summary

$content

EOF
}

# Update last action file for status display
update_last_action() {
  local role="$1"
  local content="$2"
  local tag=$(extract_tag "$content")
  local summary=$(extract_summary "$content")
  local timestamp=$(date '+%H:%M:%S')

  echo "[$tag] $summary (by $role, $timestamp)" > "$STATE_DIR/last_action.txt"
}

case "$CMD" in
  init)
    TASK="${1:-}"
    if [[ -z "$TASK" ]]; then
      echo "Usage: io.sh init \"task description\""
      exit 1
    fi

    if [[ -d "$STATE_DIR" ]]; then
      echo "Warning: Existing session will be overwritten"
    fi

    rm -rf "$STATE_DIR"
    mkdir -p "$STATE_DIR"

    # Create base files
    cat > "$STATE_DIR/task.md" << EOF
# Task

$TASK

---
Created: $(date '+%Y-%m-%d %H:%M:%S')
EOF

    echo "1" > "$STATE_DIR/round.txt"
    echo "planning" > "$STATE_DIR/step.txt"
    echo "ralph" > "$STATE_DIR/turn.txt"
    echo "(No action yet)" > "$STATE_DIR/last_action.txt"

    cat > "$STATE_DIR/plan.md" << EOF
# Plan

(To be drafted by Ralph and reviewed by Lisa)
EOF

    echo -e "# Ralph Work\n\n(Waiting for Ralph to submit)" > "$STATE_DIR/work.md"
    echo -e "# Lisa Review\n\n(Waiting for Lisa to respond)" > "$STATE_DIR/review.md"

    cat > "$STATE_DIR/history.md" << EOF
# Collaboration History

**Task**: $TASK
**Started**: $(date '+%Y-%m-%d %H:%M:%S')
EOF

    echo "========================================"
    echo "Session Initialized"
    echo "========================================"
    echo "Task: $TASK"
    echo "Turn: ralph"
    echo ""
    echo "Ralph should start with: io.sh submit-ralph \"[PLAN] summary...\""
    echo "========================================"
    ;;

  whose-turn)
    check_session
    TURN=$(get_turn)
    echo "$TURN"
    ;;

  submit-ralph)
    check_session
    CONTENT="${1:-}"

    if [[ -z "$CONTENT" ]]; then
      echo "Usage: io.sh submit-ralph \"[TAG] summary\n\ndetails...\""
      echo ""
      echo "Valid tags: PLAN, CODE, FIX, DISCUSS, QUESTION, CONSENSUS"
      exit 1
    fi

    # Check turn
    TURN=$(get_turn)
    if [[ "$TURN" != "ralph" ]]; then
      echo "Error: It's Lisa's turn. Wait for her response."
      echo "Run: io.sh whose-turn"
      exit 1
    fi

    # Validate tag
    TAG=$(extract_tag "$CONTENT")
    if [[ -z "$TAG" ]]; then
      echo "Error: Content must start with a valid tag."
      echo "Format: [TAG] One line summary"
      echo ""
      echo "Valid tags: PLAN, CODE, FIX, DISCUSS, QUESTION, CONSENSUS"
      exit 1
    fi

    ROUND=$(cat "$STATE_DIR/round.txt" 2>/dev/null || echo "?")
    STEP=$(cat "$STATE_DIR/step.txt" 2>/dev/null || echo "?")
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    SUMMARY=$(extract_summary "$CONTENT")

    # Write to work.md
    cat > "$STATE_DIR/work.md" << EOF
# Ralph Work

## [$TAG] Round $ROUND | Step: $STEP
**Updated**: $TIMESTAMP
**Summary**: $SUMMARY

$CONTENT
EOF

    # Append to history
    append_history "Ralph" "$CONTENT"

    # Update last action
    update_last_action "Ralph" "$CONTENT"

    # Switch turn to Lisa
    set_turn "lisa"

    echo "========================================"
    echo "Submitted: [$TAG] $SUMMARY"
    echo "Turn passed to: Lisa"
    echo "========================================"
    echo ""
    echo "Now wait for Lisa. Check with: io.sh whose-turn"
    ;;

  submit-lisa)
    check_session
    CONTENT="${1:-}"

    if [[ -z "$CONTENT" ]]; then
      echo "Usage: io.sh submit-lisa \"[TAG] summary\n\ndetails...\""
      echo ""
      echo "Valid tags: PASS, NEEDS_WORK, DISCUSS, QUESTION, CONSENSUS"
      exit 1
    fi

    # Check turn
    TURN=$(get_turn)
    if [[ "$TURN" != "lisa" ]]; then
      echo "Error: It's Ralph's turn. Wait for his submission."
      echo "Run: io.sh whose-turn"
      exit 1
    fi

    # Validate tag
    TAG=$(extract_tag "$CONTENT")
    if [[ -z "$TAG" ]]; then
      echo "Error: Content must start with a valid tag."
      echo "Format: [TAG] One line summary"
      echo ""
      echo "Valid tags: PASS, NEEDS_WORK, DISCUSS, QUESTION, CONSENSUS"
      exit 1
    fi

    ROUND=$(cat "$STATE_DIR/round.txt" 2>/dev/null || echo "?")
    STEP=$(cat "$STATE_DIR/step.txt" 2>/dev/null || echo "?")
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    SUMMARY=$(extract_summary "$CONTENT")

    # Write to review.md
    cat > "$STATE_DIR/review.md" << EOF
# Lisa Review

## [$TAG] Round $ROUND | Step: $STEP
**Updated**: $TIMESTAMP
**Summary**: $SUMMARY

$CONTENT
EOF

    # Append to history
    append_history "Lisa" "$CONTENT"

    # Update last action
    update_last_action "Lisa" "$CONTENT"

    # Switch turn to Ralph
    set_turn "ralph"

    # Increment round
    NEXT_ROUND=$((ROUND + 1))
    echo "$NEXT_ROUND" > "$STATE_DIR/round.txt"

    echo "========================================"
    echo "Submitted: [$TAG] $SUMMARY"
    echo "Turn passed to: Ralph"
    echo "Round: $ROUND -> $NEXT_ROUND"
    echo "========================================"
    echo ""
    echo "Now wait for Ralph. Check with: io.sh whose-turn"
    ;;

  status)
    if [[ ! -d "$STATE_DIR" ]]; then
      echo "Status: Not initialized"
      exit 0
    fi

    TURN=$(get_turn)
    ROUND=$(cat "$STATE_DIR/round.txt" 2>/dev/null || echo "?")
    STEP=$(cat "$STATE_DIR/step.txt" 2>/dev/null || echo "?")
    LAST=$(cat "$STATE_DIR/last_action.txt" 2>/dev/null || echo "None")
    TASK=$(sed -n '3p' "$STATE_DIR/task.md" 2>/dev/null || echo "Unknown")

    echo "========================================"
    echo "Ralph Lisa Dual-Agent Loop"
    echo "========================================"
    echo "Task: $TASK"
    echo "Round: $ROUND | Step: $STEP"
    echo ""
    echo ">>> Turn: $TURN <<<"
    echo "Last: $LAST"
    echo "========================================"
    ;;

  read)
    check_session
    FILE="${1:-}"
    if [[ -z "$FILE" ]]; then
      echo "Usage: io.sh read <file>"
      echo "  work.md    - Ralph's work"
      echo "  review.md  - Lisa's feedback"
      exit 1
    fi

    if [[ -f "$STATE_DIR/$FILE" ]]; then
      cat "$STATE_DIR/$FILE"
    else
      echo "(File $FILE does not exist)"
    fi
    ;;

  step)
    check_session
    STEP_NAME="${1:-}"
    if [[ -z "$STEP_NAME" ]]; then
      echo "Usage: io.sh step \"step name\""
      exit 1
    fi

    echo "$STEP_NAME" > "$STATE_DIR/step.txt"
    echo "1" > "$STATE_DIR/round.txt"

    echo -e "\n---\n\n# Step: $STEP_NAME\n\nStarted: $(date '+%Y-%m-%d %H:%M:%S')\n" >> "$STATE_DIR/history.md"

    echo "Entered step: $STEP_NAME (round reset to 1)"
    ;;

  history)
    check_session
    if [[ -f "$STATE_DIR/history.md" ]]; then
      cat "$STATE_DIR/history.md"
    fi
    ;;

  archive)
    check_session
    NAME="${1:-$(date '+%Y%m%d_%H%M%S')}"
    ARCHIVE_DIR=".dual-agent-archive"
    mkdir -p "$ARCHIVE_DIR"
    cp -r "$STATE_DIR" "$ARCHIVE_DIR/$NAME"
    echo "Archived: $ARCHIVE_DIR/$NAME/"
    ;;

  clean)
    if [[ -d "$STATE_DIR" ]]; then
      rm -rf "$STATE_DIR"
      echo "Session cleaned"
    fi
    ;;

  *)
    echo "Ralph Lisa Dual-Agent Loop - I/O"
    echo ""
    echo "Turn Control:"
    echo "  io.sh whose-turn              Check whose turn"
    echo "  io.sh submit-ralph \"[TAG]...\" Ralph submits (passes turn to Lisa)"
    echo "  io.sh submit-lisa \"[TAG]...\"  Lisa submits (passes turn to Ralph)"
    echo ""
    echo "Tags:"
    echo "  Ralph: [PLAN] [CODE] [FIX] [DISCUSS] [QUESTION] [CONSENSUS]"
    echo "  Lisa:  [PASS] [NEEDS_WORK] [DISCUSS] [QUESTION] [CONSENSUS]"
    echo ""
    echo "Other Commands:"
    echo "  io.sh init \"task\"       Initialize session"
    echo "  io.sh status             Show current status"
    echo "  io.sh read <file>        Read work.md or review.md"
    echo "  io.sh step \"name\"        Enter new step"
    echo "  io.sh history            Show full history"
    echo "  io.sh archive [name]     Archive session"
    echo "  io.sh clean              Clean session"
    ;;
esac
