#!/bin/bash
# Ralph-Lisa Loop - Auto Mode (Experimental)
#
# Fully automated turn-based collaboration using tmux.
# A watcher process monitors turn changes and triggers the appropriate agent.
#
# Usage: ./auto.sh [--full-auto] "task description"
#
# Options:
#   --full-auto    Skip all permission prompts (claude --dangerously-skip-permissions + codex --full-auto)
#
# Requirements: tmux, fswatch (macOS) or inotifywait (Linux)
#
# WARNING: Experimental feature. Relies on model following instructions.
# For production use, prefer manual mode with ./start.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse --full-auto flag
FULL_AUTO=false
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --full-auto) FULL_AUTO=true ;;
    *) ARGS+=("$arg") ;;
  esac
done
set -- "${ARGS[@]+"${ARGS[@]}"}"

PROJECT_DIR="${1:+$(cd "${1}" && pwd)}"
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
TASK="${2:-${1:-}}"

# If first arg is a directory, use it as PROJECT_DIR
if [[ -n "${1:-}" ]] && [[ ! -d "${1:-}" ]]; then
  PROJECT_DIR="$(pwd)"
  TASK="${1:-}"
fi

# Build agent commands based on --full-auto
if [[ "$FULL_AUTO" == true ]]; then
  CLAUDE_CMD="claude --dangerously-skip-permissions"
  CODEX_CMD="codex --full-auto"
else
  CLAUDE_CMD="claude"
  CODEX_CMD="codex"
fi

SESSION_NAME="ralph-lisa-auto"
STATE_DIR="$PROJECT_DIR/.dual-agent"

echo "========================================"
echo "Ralph-Lisa Loop - Auto Mode"
echo "========================================"
echo "Project: $PROJECT_DIR"
if [[ "$FULL_AUTO" == true ]]; then
  echo "Mode: FULL AUTO (no permission prompts)"
fi
echo ""

# Check prerequisites
if ! command -v tmux &> /dev/null; then
  echo "Error: tmux is required for auto mode."
  echo "Install: brew install tmux (macOS) or apt install tmux (Linux)"
  exit 1
fi

if ! command -v claude &> /dev/null; then
  echo "Error: 'claude' command not found."
  exit 1
fi

if ! command -v codex &> /dev/null; then
  echo "Error: 'codex' command not found."
  exit 1
fi

# Check file watcher
if command -v fswatch &> /dev/null; then
  WATCHER="fswatch"
elif command -v inotifywait &> /dev/null; then
  WATCHER="inotifywait"
else
  echo "Error: File watcher required."
  echo "Install: brew install fswatch (macOS) or apt install inotify-tools (Linux)"
  exit 1
fi

# Check if initialized
if [[ ! -f "$PROJECT_DIR/CLAUDE.md" ]] || ! grep -q "RALPH-LISA-LOOP" "$PROJECT_DIR/CLAUDE.md" 2>/dev/null; then
  echo "Error: Not initialized. Run init.sh first."
  exit 1
fi

# Initialize task
if [[ -n "$TASK" ]]; then
  echo "Task: $TASK"
  "$PROJECT_DIR/io.sh" init "$TASK"
  echo ""
fi

# Kill existing session
tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true

# Create watcher script
WATCHER_SCRIPT="$STATE_DIR/watcher.sh"
mkdir -p "$STATE_DIR"

cat > "$WATCHER_SCRIPT" << 'WATCHEREOF'
#!/bin/bash
# Turn watcher - triggers agents on turn change

STATE_DIR=".dual-agent"
LAST_TURN=""

trigger_agent() {
  local turn="$1"
  if [[ "$turn" == "ralph" ]]; then
    tmux send-keys -t ralph-lisa-auto:0.0 -l "go" 2>/dev/null || true
    sleep 0.3
    tmux send-keys -t ralph-lisa-auto:0.0 Enter 2>/dev/null || true
  elif [[ "$turn" == "lisa" ]]; then
    # Codex needs text and Enter sent separately
    tmux send-keys -t ralph-lisa-auto:0.1 -l "go" 2>/dev/null || true
    sleep 0.3
    tmux send-keys -t ralph-lisa-auto:0.1 Enter 2>/dev/null || true
  fi
}

check_and_trigger() {
  if [[ -f "$STATE_DIR/turn.txt" ]]; then
    CURRENT_TURN=$(cat "$STATE_DIR/turn.txt" 2>/dev/null || echo "")
    if [[ -n "$CURRENT_TURN" && "$CURRENT_TURN" != "$LAST_TURN" ]]; then
      echo "[Watcher] Turn changed: $LAST_TURN -> $CURRENT_TURN"
      LAST_TURN="$CURRENT_TURN"
      sleep 1  # Give agent time to settle
      trigger_agent "$CURRENT_TURN"
    fi
  fi
}

echo "[Watcher] Starting... (Ctrl+C to stop)"
echo "[Watcher] Monitoring $STATE_DIR/turn.txt"

# Initial trigger
sleep 2
check_and_trigger

# Watch for changes
if command -v fswatch &> /dev/null; then
  fswatch -o "$STATE_DIR/turn.txt" 2>/dev/null | while read; do
    check_and_trigger
  done
elif command -v inotifywait &> /dev/null; then
  while inotifywait -e modify "$STATE_DIR/turn.txt" 2>/dev/null; do
    check_and_trigger
  done
else
  # Fallback: polling
  while true; do
    check_and_trigger
    sleep 2
  done
fi
WATCHEREOF

chmod +x "$WATCHER_SCRIPT"

# Create tmux session with 2 panes
# Layout: Ralph (left) | Lisa (right), Watcher in background
echo "Starting tmux session..."

tmux new-session -d -s "$SESSION_NAME" -n "main" -c "$PROJECT_DIR"

# Split horizontally → pane 0=Ralph(left), pane 1=Lisa(right)
tmux split-window -h -t "$SESSION_NAME" -c "$PROJECT_DIR"

# Start agents
tmux send-keys -t "$SESSION_NAME:0.0" "echo '=== Ralph (Claude Code) ===' && $CLAUDE_CMD" Enter
tmux send-keys -t "$SESSION_NAME:0.1" "echo '=== Lisa (Codex) ===' && $CODEX_CMD" Enter

# Select Ralph pane
tmux select-pane -t "$SESSION_NAME:0.0"

# Start watcher in background (logs to .dual-agent/watcher.log)
WATCHER_LOG="$STATE_DIR/watcher.log"
nohup "$WATCHER_SCRIPT" > "$WATCHER_LOG" 2>&1 &

echo ""
echo "========================================"
echo "Auto Mode Started!"
echo "========================================"
echo ""
echo "Layout:"
echo "  ┌─────────────┬─────────────┐"
echo "  │   Ralph     │    Lisa     │"
echo "  │  (Claude)   │   (Codex)   │"
echo "  └─────────────┴─────────────┘"
echo "  Watcher runs in background (log: $WATCHER_LOG)"
echo ""
echo "The watcher will automatically trigger agents on turn changes."
echo ""
echo "Controls:"
echo "  Ctrl+B, Arrow  - Switch panes"
echo "  Ctrl+B, D      - Detach (agents keep running)"
echo "  Ctrl+C         - Stop current agent"
echo ""
echo "Attaching to session..."
echo "========================================"

tmux attach-session -t "$SESSION_NAME"
