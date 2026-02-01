#!/bin/bash
# Ralph Lisa Dual-Agent Loop - Start Script
#
# Launches Claude (Ralph) and Codex (Lisa) in two terminal windows.
# Optionally initializes a new task.
#
# Usage: ./ralph-lisa-start.sh [task-description]
#
# Supports: macOS Terminal, iTerm2, tmux

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TASK="${1:-}"

echo "========================================"
echo "Ralph Lisa Dual-Agent Loop - Start"
echo "========================================"
echo "Project: $PROJECT_DIR"
echo ""

# Check prerequisites
if ! command -v claude &> /dev/null; then
  echo "Error: 'claude' command not found. Install Claude Code first."
  exit 1
fi

if ! command -v codex &> /dev/null; then
  echo "Error: 'codex' command not found. Install Codex CLI first."
  exit 1
fi

# Check if initialized
if [[ ! -f "$PROJECT_DIR/CLAUDE.md" ]] || ! grep -q "RALPH-LISA-LOOP" "$PROJECT_DIR/CLAUDE.md" 2>/dev/null; then
  echo "Error: Not initialized. Run ralph-lisa-init.sh first."
  exit 1
fi

# Initialize task if provided
if [[ -n "$TASK" ]]; then
  # Warn if session exists
  if [[ -d "$PROJECT_DIR/.dual-agent" ]] && [[ -f "$PROJECT_DIR/.dual-agent/task.md" ]]; then
    EXISTING_TASK=$(sed -n '3p' "$PROJECT_DIR/.dual-agent/task.md" 2>/dev/null || echo "unknown")
    echo "Warning: Existing session will be overwritten."
    echo "Current task: $EXISTING_TASK"
    echo ""
    echo "Run './mini-skill/io.sh archive' first to save current session."
    echo ""
    read -p "Continue and overwrite? [y/N] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "Aborted. Use without task argument to resume existing session."
      exit 0
    fi
  fi
  echo "Task: $TASK"
  "$PROJECT_DIR/mini-skill/io.sh" init "$TASK"
  echo ""
fi

#===========================================
# Detect terminal and launch
#===========================================

# Commands to run in each terminal
RALPH_CMD="cd '$PROJECT_DIR' && echo '=== Ralph (Claude Code) ===' && echo 'Role: Lead Developer' && echo 'Run: ./mini-skill/io.sh status' && echo '' && claude"
LISA_CMD="cd '$PROJECT_DIR' && echo '=== Lisa (Codex) ===' && echo 'Role: Code Reviewer' && echo 'Run: ./mini-skill/io.sh status' && echo '' && codex"

launch_macos_terminal() {
  echo "Launching with macOS Terminal..."

  # Terminal 1: Ralph (Claude)
  osascript << EOF
tell application "Terminal"
  activate
  set ralphWindow to do script "$RALPH_CMD"
  set custom title of front window to "Ralph (Claude)"
end tell
EOF

  sleep 1

  # Terminal 2: Lisa (Codex)
  osascript << EOF
tell application "Terminal"
  activate
  do script "$LISA_CMD"
  set custom title of front window to "Lisa (Codex)"
end tell
EOF
}

launch_iterm2() {
  echo "Launching with iTerm2..."

  osascript << EOF
tell application "iTerm"
  activate

  -- Create new window for Ralph
  set ralphWindow to (create window with default profile)
  tell current session of ralphWindow
    write text "$RALPH_CMD"
    set name to "Ralph (Claude)"
  end tell

  -- Create new tab for Lisa
  tell current window
    set lisaTab to (create tab with default profile)
    tell current session of lisaTab
      write text "$LISA_CMD"
      set name to "Lisa (Codex)"
    end tell
  end tell
end tell
EOF
}

launch_tmux() {
  echo "Launching with tmux..."

  SESSION_NAME="ralph-lisa"

  # Kill existing session if any
  tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true

  # Create new session with Ralph
  tmux new-session -d -s "$SESSION_NAME" -n "Ralph" "bash -c '$RALPH_CMD; exec bash'"

  # Create Lisa pane (split vertically)
  tmux split-window -h -t "$SESSION_NAME" "bash -c '$LISA_CMD; exec bash'"

  # Attach to session
  tmux attach-session -t "$SESSION_NAME"
}

launch_generic() {
  echo "No supported terminal detected."
  echo ""
  echo "Please manually open two terminals and run:"
  echo ""
  echo "Terminal 1 (Ralph/Claude):"
  echo "  cd $PROJECT_DIR && claude"
  echo ""
  echo "Terminal 2 (Lisa/Codex):"
  echo "  cd $PROJECT_DIR && codex"
  echo ""
}

# Detect and launch
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  if pgrep -x "iTerm2" > /dev/null || [[ -d "/Applications/iTerm.app" ]]; then
    launch_iterm2
  else
    launch_macos_terminal
  fi
elif command -v tmux &> /dev/null; then
  launch_tmux
else
  launch_generic
fi

echo ""
echo "========================================"
echo "Both agents launched!"
echo "========================================"
echo ""
echo "Ralph (Claude): Lead Developer"
echo "  - Plans, codes, writes tests"
echo "  - Uses /notify-lisa to submit work"
echo ""
echo "Lisa (Codex): Code Reviewer"
echo "  - Reviews code, provides feedback"
echo "  - Uses /notify-ralph to send verdict"
echo ""
echo "Communication: .dual-agent/"
echo "  - work.md:   Ralph → Lisa"
echo "  - review.md: Lisa → Ralph"
echo ""
echo "Remember: Consensus required before /next-round"
echo "========================================"
