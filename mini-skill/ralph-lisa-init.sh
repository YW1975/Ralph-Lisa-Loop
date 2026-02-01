#!/bin/bash
# Ralph Lisa Dual-Agent Loop - Initialization Script
#
# This script:
# 1. Appends Ralph role to CLAUDE.md
# 2. Creates/updates CODEX.md with Lisa role
# 3. Copies Claude commands to .claude/commands/
# 4. Copies Codex skills to .codex/skills/
# 5. Copies io.sh to project
# 6. Initializes .dual-agent/ session
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
  if [[ -f "$CLAUDE_MD" ]]; then
    echo "" >> "$CLAUDE_MD"
    echo "" >> "$CLAUDE_MD"
  fi
  cat "$SCRIPT_DIR/roles/ralph.md" >> "$CLAUDE_MD"
  echo "[Claude] Done."
fi

#===========================================
# 2. Create/update CODEX.md with Lisa role
#===========================================
CODEX_MD="$PROJECT_DIR/CODEX.md"

if [[ -f "$CODEX_MD" ]] && grep -q "$MARKER" "$CODEX_MD"; then
  echo "[Codex] Lisa role already in CODEX.md, skipping..."
else
  echo "[Codex] Creating CODEX.md with Lisa role..."
  if [[ -f "$CODEX_MD" ]]; then
    echo "" >> "$CODEX_MD"
    echo "" >> "$CODEX_MD"
  fi
  cat "$SCRIPT_DIR/roles/lisa.md" >> "$CODEX_MD"
  echo "[Codex] Done."
fi

#===========================================
# 3. Copy Claude commands
#===========================================
echo "[Claude] Copying commands to .claude/commands/..."
CLAUDE_CMD_DIR="$PROJECT_DIR/.claude/commands"
mkdir -p "$CLAUDE_CMD_DIR"
cp "$SCRIPT_DIR/claude-commands/"*.md "$CLAUDE_CMD_DIR/" 2>/dev/null || true
echo "[Claude] Commands copied."

#===========================================
# 4. Copy Codex skills
#===========================================
echo "[Codex] Copying skills to .codex/skills/..."
CODEX_SKILL_DIR="$PROJECT_DIR/.codex/skills"
mkdir -p "$CODEX_SKILL_DIR"
cp "$SCRIPT_DIR/codex-skills/"*.md "$CODEX_SKILL_DIR/" 2>/dev/null || true
echo "[Codex] Skills copied."

#===========================================
# 5. Copy io.sh to project
#===========================================
echo "[I/O] Copying io.sh to project..."
mkdir -p "$PROJECT_DIR/mini-skill"
cp "$SCRIPT_DIR/io.sh" "$PROJECT_DIR/mini-skill/" 2>/dev/null || true
chmod +x "$PROJECT_DIR/mini-skill/io.sh"
echo "[I/O] Done."

#===========================================
# 6. Initialize session state
#===========================================
echo "[Session] Initializing .dual-agent/..."
"$PROJECT_DIR/mini-skill/io.sh" init "Waiting for task assignment" 2>/dev/null || true

echo ""
echo "========================================"
echo "Initialization Complete"
echo "========================================"
echo ""
echo "Files created/updated:"
echo "  - CLAUDE.md (Ralph role)"
echo "  - CODEX.md (Lisa role)"
echo "  - .claude/commands/ (Claude slash commands)"
echo "  - .codex/skills/ (Codex skills)"
echo "  - mini-skill/io.sh"
echo "  - .dual-agent/"
echo ""
echo "Start agents:"
echo "  Terminal 1: claude"
echo "  Terminal 2: codex -i CODEX.md --skills-path .codex/skills"
echo ""
echo "Or run: ralph-lisa-start.sh \"your task\""
echo "========================================"
