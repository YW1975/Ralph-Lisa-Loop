#!/bin/bash
# Ralph Lisa Dual-Agent Loop - Initialization Script
#
# This script:
# 1. Appends Ralph role to CLAUDE.md
# 2. Appends Lisa role to CODEX.md
# 3. Copies communication skills to .claude/skills/ and .codex/skills/
# 4. Initializes .dual-agent/ session directory
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

# Marker to detect if already initialized
MARKER="RALPH-LISA-LOOP"

#===========================================
# 1. Append Ralph role to CLAUDE.md
#===========================================
CLAUDE_MD="$PROJECT_DIR/CLAUDE.md"

if [[ -f "$CLAUDE_MD" ]] && grep -q "$MARKER" "$CLAUDE_MD"; then
  echo "[Claude] Ralph role already in CLAUDE.md, skipping..."
else
  echo "[Claude] Appending Ralph role to CLAUDE.md..."

  # Add newlines if file exists and doesn't end with newline
  if [[ -f "$CLAUDE_MD" ]]; then
    echo "" >> "$CLAUDE_MD"
    echo "" >> "$CLAUDE_MD"
  fi

  cat "$SCRIPT_DIR/roles/ralph.md" >> "$CLAUDE_MD"
  echo "[Claude] Done."
fi

#===========================================
# 2. Append Lisa role to CODEX.md
#===========================================
CODEX_MD="$PROJECT_DIR/CODEX.md"

if [[ -f "$CODEX_MD" ]] && grep -q "$MARKER" "$CODEX_MD"; then
  echo "[Codex] Lisa role already in CODEX.md, skipping..."
else
  echo "[Codex] Appending Lisa role to CODEX.md..."

  # Add newlines if file exists and doesn't end with newline
  if [[ -f "$CODEX_MD" ]]; then
    echo "" >> "$CODEX_MD"
    echo "" >> "$CODEX_MD"
  fi

  cat "$SCRIPT_DIR/roles/lisa.md" >> "$CODEX_MD"
  echo "[Codex] Done."
fi

#===========================================
# 3. Copy skills to project
#===========================================
echo "[Skills] Copying communication skills..."

# Skills for Claude Code
CLAUDE_SKILLS_DIR="$PROJECT_DIR/.claude/skills"
mkdir -p "$CLAUDE_SKILLS_DIR"
cp "$SCRIPT_DIR/skills/"*.md "$CLAUDE_SKILLS_DIR/"
echo "[Skills] Copied to $CLAUDE_SKILLS_DIR/"

# Skills for Codex
CODEX_SKILLS_DIR="$PROJECT_DIR/.codex/skills"
mkdir -p "$CODEX_SKILLS_DIR"
cp "$SCRIPT_DIR/skills/"*.md "$CODEX_SKILLS_DIR/"
echo "[Skills] Copied to $CODEX_SKILLS_DIR/"

#===========================================
# 4. Copy io.sh to project
#===========================================
echo "[I/O] Copying io.sh to project..."
mkdir -p "$PROJECT_DIR/mini-skill"
cp "$SCRIPT_DIR/io.sh" "$PROJECT_DIR/mini-skill/"
chmod +x "$PROJECT_DIR/mini-skill/io.sh"
echo "[I/O] Done."

#===========================================
# 5. Initialize session state
#===========================================
echo "[Session] Initializing .dual-agent/ directory..."
"$PROJECT_DIR/mini-skill/io.sh" init "Waiting for task assignment" 2>/dev/null || true

echo ""
echo "========================================"
echo "Initialization Complete"
echo "========================================"
echo ""
echo "Files created/updated:"
echo "  - CLAUDE.md (Ralph role appended)"
echo "  - CODEX.md (Lisa role appended)"
echo "  - .claude/skills/ (communication skills)"
echo "  - .codex/skills/ (communication skills)"
echo "  - mini-skill/io.sh (I/O script)"
echo "  - .dual-agent/ (session state)"
echo ""
echo "Next steps:"
echo "  Terminal 1 (Ralph): claude"
echo "  Terminal 2 (Lisa):  codex"
echo ""
echo "Or run: ./mini-skill/ralph-lisa-start.sh \"your task\""
echo "========================================"
