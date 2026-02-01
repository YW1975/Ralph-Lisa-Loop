# Ralph Lisa Dual-Agent Loop

A minimal dual-agent collaboration framework where Ralph (developer) and Lisa (reviewer) work together through consensus-driven workflow.

## Design Philosophy

- **Agent-driven decisions**: Agents decide autonomously what to do and when
- **Skills as tools**: Communication skills are pure tools, not flow controllers
- **Consensus required**: Both parties must agree before proceeding
- **Advisory verdicts**: Lisa's PASS/NEEDS_WORK is an opinion, not a command

## Quick Start

### 1. Initialize Project

```bash
cd your-project
/path/to/mini-skill/ralph-lisa-init.sh
```

This will:
- Append Ralph role to `CLAUDE.md`
- Append Lisa role to `CODEX.md`
- Copy communication skills to `.claude/skills/` and `.codex/skills/`
- Copy `io.sh` to `mini-skill/`
- Initialize `.dual-agent/` session directory

### 2. Start Both Agents

**Terminal 1 (Ralph - Claude Code)**:
```bash
cd your-project
claude
```

**Terminal 2 (Lisa - Codex)**:
```bash
cd your-project
codex
```

Or use the start script:
```bash
/path/to/mini-skill/ralph-lisa-start.sh "your task description"
```

---

## Roles

### Ralph (Lead Developer)

**Responsibilities**:
- Planning, coding, unit testing
- Evaluating Lisa's feedback
- Confirming consensus before proceeding

**Key Rule**: Lisa's PASS/NEEDS_WORK is advisory. You must evaluate it and either agree (then proceed) or disagree (then discuss).

### Lisa (Code Reviewer)

**Responsibilities**:
- Triple cross-check (code vs plan vs requirements)
- Code review checklist
- Test review checklist
- Providing PASS/NEEDS_WORK opinion

**Key Rule**: Your verdict is a professional opinion, not a command. Ralph may agree or disagree. Consensus is required to proceed.

---

## Communication Skills

| Skill | Caller | Purpose |
|-------|--------|---------|
| `/notify-lisa` | Ralph | Send work to Lisa |
| `/notify-ralph` | Lisa | Send review to Ralph |
| `/check-status` | Both | View current status |
| `/view-history` | Both | View full history |
| `/next-round` | Both | Proceed (requires consensus) |
| `/new-step` | Ralph | Enter new phase |
| `/init-session` | Ralph | Initialize session |
| `/archive` | Both | Archive session |

### Direct io.sh Usage

```bash
# Initialize
./mini-skill/io.sh init "task description"

# Submit work (Ralph)
./mini-skill/io.sh ralph "content"

# Submit review (Lisa)
./mini-skill/io.sh lisa "content"

# View status
./mini-skill/io.sh status

# View history
./mini-skill/io.sh history

# Next round (after consensus)
./mini-skill/io.sh next

# New step
./mini-skill/io.sh step "step name"

# Archive
./mini-skill/io.sh archive [name]
```

---

## Consensus Workflow

```
Lisa gives opinion (PASS/NEEDS_WORK)
            │
            ▼
Ralph evaluates the opinion
            │
            ▼
┌────────────────────────────────────────┐
│ Agree → Confirm consensus → /next-round │
│ Disagree → Explain reasoning → Discuss  │
│ Deadlock (5 rounds) → OVERRIDE/HANDOFF  │
└────────────────────────────────────────┘
```

### Key Principles

| Principle | Description |
|-----------|-------------|
| Equal Voice | Lisa's verdict = professional opinion, not a command |
| Consensus Required | Both parties must agree before proceeding |
| Discussion First | Disagreements lead to discussion, not deadlock |
| Deadlock Exit | OVERRIDE (Ralph decides) or HANDOFF (human decides) |

---

## File Structure

```
project/
├── CLAUDE.md              # Ralph role definition
├── CODEX.md               # Lisa role definition
├── .claude/skills/        # Skills for Claude Code
├── .codex/skills/         # Skills for Codex
├── mini-skill/
│   └── io.sh              # I/O script
└── .dual-agent/           # Session state
    ├── task.md            # Task description
    ├── work.md            # Ralph's latest submission
    ├── review.md          # Lisa's latest response
    ├── history.md         # Full history
    ├── round.txt          # Current round
    └── step.txt           # Current phase
```

---

## Prerequisites

- **Claude Code**: Install from https://claude.ai/code
- **Codex CLI**: Install from https://github.com/openai/codex
- **Bash**: For io.sh script execution

---

## Important Notes

- **Consensus is key**: Never call `/next-round` without both parties agreeing
- **Resume session**: To resume existing work, run start script WITHOUT task argument
- **New task overwrites**: Passing task argument to start script will overwrite current session
- **Before new task**: Use `/archive` to save current session
- **Wait timeout**: Default 300s for `io.sh wait`
- **Deadlock rule**: After 5 rounds, use OVERRIDE or HANDOFF
- **Role files**: Roles are in CLAUDE.md/CODEX.md, not in separate skill files

---

## Example Workflow

**Ralph**:
```
1. /init-session "Create login form"
2. Draft plan
3. /notify-lisa "## Plan\n1. Create form\n2. Add validation..."
4. Wait for Lisa's opinion
5. Receive PASS → "I agree, proceeding" → /next-round
6. Write code + tests
7. /notify-lisa "## Code\n... ## Tests\n..."
8. Receive NEEDS_WORK → Evaluate → Fix issues
9. /notify-lisa "## Fixed\n..."
10. Receive PASS → "I agree" → /next-round
```

**Lisa**:
```
1. /check-status (see plan)
2. Review: cross-check against requirements
3. /notify-ralph "### Verdict: PASS\nPlan is good..."
4. Wait for Ralph's code
5. /check-status (see code)
6. Review: triple cross-check + checklists
7. Found issue → /notify-ralph "### Verdict: NEEDS_WORK\n..."
8. Wait for fix
9. /check-status (see fix)
10. Issue resolved → /notify-ralph "### Verdict: PASS\n..."
```
