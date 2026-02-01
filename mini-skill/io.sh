#!/bin/bash
# Ralph Lisa Dual-Agent Loop - I/O Script
# Handles file read/write/wait operations for Ralph-Lisa collaboration
#
# Files:
#   work.md    - Ralph's current round output
#   review.md  - Lisa's current round feedback
#   history.md - Cumulative history (append-only)
#
# Role definitions are in CLAUDE.md (Ralph) and CODEX.md (Lisa)

set -euo pipefail

STATE_DIR=".dual-agent"
CMD="${1:-}"
shift || true

check_session() {
  if [[ ! -d "$STATE_DIR" ]]; then
    echo "Error: Session not initialized. Run: io.sh init \"task description\""
    exit 1
  fi
}

# Append to history
append_history() {
  local role="$1"
  local content="$2"
  local round=$(cat "$STATE_DIR/round.txt" 2>/dev/null || echo "?")
  local step=$(cat "$STATE_DIR/step.txt" 2>/dev/null || echo "?")
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  cat >> "$STATE_DIR/history.md" << EOF

---

## [$role] Round $round | Step: $step
**Time**: $timestamp

$content

EOF
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

    cat > "$STATE_DIR/plan.md" << EOF
# Plan

(To be drafted by Ralph and reviewed by Lisa before implementation)
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
    echo ""
    echo "Files:"
    echo "  work.md    - Ralph's output"
    echo "  review.md  - Lisa's feedback"
    echo "  history.md - Cumulative history"
    echo ""
    echo "Role definitions: CLAUDE.md (Ralph), CODEX.md (Lisa)"
    echo "========================================"
    ;;

  ralph)
    check_session
    CONTENT="${1:-}"
    if [[ -z "$CONTENT" ]]; then
      echo "Usage: io.sh ralph \"content\""
      exit 1
    fi

    ROUND=$(cat "$STATE_DIR/round.txt" 2>/dev/null || echo "?")
    STEP=$(cat "$STATE_DIR/step.txt" 2>/dev/null || echo "?")
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

    cat > "$STATE_DIR/work.md" << EOF
# Ralph Work

## Round $ROUND | Step: $STEP
**Updated**: $TIMESTAMP

$CONTENT
EOF

    append_history "Ralph" "$CONTENT"

    echo "Written: work.md (Round $ROUND)"
    echo "Appended: history.md"
    ;;

  lisa)
    check_session
    CONTENT="${1:-}"
    if [[ -z "$CONTENT" ]]; then
      echo "Usage: io.sh lisa \"content\""
      exit 1
    fi

    ROUND=$(cat "$STATE_DIR/round.txt" 2>/dev/null || echo "?")
    STEP=$(cat "$STATE_DIR/step.txt" 2>/dev/null || echo "?")
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

    cat > "$STATE_DIR/review.md" << EOF
# Lisa Review

## Round $ROUND | Step: $STEP
**Updated**: $TIMESTAMP

$CONTENT
EOF

    append_history "Lisa" "$CONTENT"

    echo "Written: review.md (Round $ROUND)"
    echo "Appended: history.md"
    ;;

  read)
    check_session
    FILE="${1:-}"
    if [[ -z "$FILE" ]]; then
      echo "Usage: io.sh read <file>"
      echo "  work.md    - Ralph's work"
      echo "  review.md  - Lisa's feedback"
      echo "  history.md - Full history"
      exit 1
    fi

    if [[ -f "$STATE_DIR/$FILE" ]]; then
      cat "$STATE_DIR/$FILE"
    else
      echo "(File $FILE does not exist)"
    fi
    ;;

  wait)
    check_session
    FILE="${1:-}"
    TIMEOUT="${2:-300}"

    if [[ -z "$FILE" ]]; then
      echo "Usage: io.sh wait <work.md|review.md> [timeout_seconds]"
      echo "  Default timeout: 300s"
      exit 1
    fi

    TARGET="$STATE_DIR/$FILE"

    LAST_MTIME=""
    if [[ -f "$TARGET" ]]; then
      LAST_MTIME=$(stat -f %m "$TARGET" 2>/dev/null || stat -c %Y "$TARGET" 2>/dev/null || echo "0")
    else
      echo "Note: $FILE does not exist yet, waiting for creation..."
    fi

    echo "Waiting for $FILE to change... (timeout: ${TIMEOUT}s)"

    START=$(date +%s)
    while true; do
      ELAPSED=$(($(date +%s) - START))
      if [[ $ELAPSED -ge $TIMEOUT ]]; then
        echo ""
        echo "Timeout (${TIMEOUT}s)"
        exit 1
      fi

      if [[ -f "$TARGET" ]]; then
        CURRENT=$(stat -f %m "$TARGET" 2>/dev/null || stat -c %Y "$TARGET" 2>/dev/null || echo "0")
        if [[ "$CURRENT" != "$LAST_MTIME" ]]; then
          echo ""
          echo "========================================"
          cat "$TARGET"
          echo "========================================"
          exit 0
        fi
      fi

      printf "\rWaiting... %ds / %ds  " "$ELAPSED" "$TIMEOUT"
      sleep 2
    done
    ;;

  status)
    if [[ ! -d "$STATE_DIR" ]]; then
      echo "Status: Not initialized"
      exit 0
    fi

    echo "========================================"
    echo "Ralph Lisa Dual-Agent Loop Status"
    echo "========================================"

    if [[ -f "$STATE_DIR/task.md" ]]; then
      echo "Task: $(sed -n '3p' $STATE_DIR/task.md)"
    fi

    ROUND=$(cat "$STATE_DIR/round.txt" 2>/dev/null || echo "?")
    STEP=$(cat "$STATE_DIR/step.txt" 2>/dev/null || echo "?")
    echo "Round: $ROUND | Step: $STEP"
    echo ""

    echo "--- Ralph (work.md) ---"
    if [[ -f "$STATE_DIR/work.md" ]]; then
      head -20 "$STATE_DIR/work.md"
    fi
    echo ""

    echo "--- Lisa (review.md) ---"
    if [[ -f "$STATE_DIR/review.md" ]]; then
      head -20 "$STATE_DIR/review.md"
    fi
    echo "========================================"
    ;;

  next)
    check_session
    ROUND=$(cat "$STATE_DIR/round.txt" 2>/dev/null || echo "0")
    NEXT=$((ROUND + 1))
    echo "$NEXT" > "$STATE_DIR/round.txt"
    echo "Round: $ROUND -> $NEXT"
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

  history)
    check_session
    if [[ -f "$STATE_DIR/history.md" ]]; then
      cat "$STATE_DIR/history.md"
    fi
    ;;

  *)
    echo "Ralph Lisa Dual-Agent Loop - I/O"
    echo ""
    echo "Commands:"
    echo "  io.sh init \"task\"        Initialize session"
    echo "  io.sh ralph \"content\"    Ralph writes to work.md"
    echo "  io.sh lisa \"content\"     Lisa writes to review.md"
    echo "  io.sh read <file>         Read file"
    echo "  io.sh wait <file> [secs]  Wait for file change"
    echo "  io.sh status              Show current status"
    echo "  io.sh history             Show full history"
    echo "  io.sh next                Increment round"
    echo "  io.sh step \"name\"        Switch to new step"
    echo "  io.sh archive [name]      Archive session"
    echo "  io.sh clean               Clean session"
    echo ""
    echo "Files:"
    echo "  work.md    - Ralph's current round output"
    echo "  review.md  - Lisa's current round feedback"
    echo "  history.md - Cumulative history"
    ;;
esac
