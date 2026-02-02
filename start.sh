#!/bin/bash
# Ralph-Lisa Loop - Start Script
#
# Launches Claude (Ralph) and Codex (Lisa) in two terminals.
# Codex reads .codex/config.toml for instructions and skills.
#
# Usage: ./start.sh [task-description]
#
# Supports: macOS Terminal, iTerm2, tmux

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${1:+$(cd "${1}" && pwd)}"
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
TASK="${2:-${1:-}}"

# If first arg is a directory, use it as PROJECT_DIR
# Otherwise treat it as the task description
if [[ -n "${1:-}" ]] && [[ ! -d "${1:-}" ]]; then
  PROJECT_DIR="$(pwd)"
  TASK="${1:-}"
fi

echo "========================================"
echo "Ralph-Lisa Loop - Start"
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
  echo "Error: Not initialized. Run init.sh first."
  exit 1
fi

# Initialize task if provided
if [[ -n "$TASK" ]]; then
  if [[ -d "$PROJECT_DIR/.dual-agent" ]] && [[ -f "$PROJECT_DIR/.dual-agent/task.md" ]]; then
    EXISTING_TASK=$(sed -n '3p' "$PROJECT_DIR/.dual-agent/task.md" 2>/dev/null || echo "unknown")
    echo "Warning: Existing session will be overwritten."
    echo "Current task: $EXISTING_TASK"
    echo ""
    read -p "Continue and overwrite? [y/N] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "Aborted."
      exit 0
    fi
  fi
  echo "Task: $TASK"
  "$PROJECT_DIR/io.sh" init "$TASK"
  echo ""
fi

#===========================================
# Launch commands
#===========================================

# Ralph (Claude Code)
# - CLAUDE.md auto-read as project instructions
# - .claude/commands/ auto-loaded as slash commands
RALPH_CMD="cd '$PROJECT_DIR' && echo '=== Ralph (Claude Code) ===' && echo 'Commands: /check-turn, /submit-work, /view-status' && echo 'First: /check-turn' && echo '' && claude"

# Lisa (Codex)
# - .codex/config.toml provides: instructions (CODEX.md) and skills path
LISA_CMD="cd '$PROJECT_DIR' && echo '=== Lisa (Codex) ===' && echo 'First: ./io.sh whose-turn' && echo '' && codex"

launch_macos_terminal() {
  echo "Launching with macOS Terminal..."

  osascript << EOF
tell application "Terminal"
  activate
  do script "$RALPH_CMD"
  set custom title of front window to "Ralph (Claude)"
end tell
EOF

  sleep 1

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
  set ralphWindow to (create window with default profile)
  tell current session of ralphWindow
    write text "$RALPH_CMD"
    set name to "Ralph (Claude)"
  end tell
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
  tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true
  tmux new-session -d -s "$SESSION_NAME" -n "Ralph" "bash -c '$RALPH_CMD; exec bash'"
  tmux split-window -h -t "$SESSION_NAME" "bash -c '$LISA_CMD; exec bash'"
  tmux attach-session -t "$SESSION_NAME"
}

launch_generic() {
  echo "Please manually open two terminals:"
  echo ""
  echo "Terminal 1 (Ralph):"
  echo "  cd $PROJECT_DIR && claude"
  echo ""
  echo "Terminal 2 (Lisa):"
  echo "  cd $PROJECT_DIR && codex"
}

# Detect and launch
if [[ "$OSTYPE" == "darwin"* ]]; then
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
echo "Turn-based workflow:"
echo "  1. Check turn: ./io.sh whose-turn"
echo "  2. Submit: ./io.sh submit-ralph/lisa \"[TAG]...\""
echo "  3. Turn auto-passes to partner"
echo "  4. STOP and wait"
echo ""
echo "Current turn: $(cat "$PROJECT_DIR/.dual-agent/turn.txt" 2>/dev/null || echo 'ralph')"
echo "========================================"
