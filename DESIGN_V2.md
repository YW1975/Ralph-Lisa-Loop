# Ralph Lisa Dual-Agent Loop - Design V2

> **Note**: This document describes the V2 design. For the current V3 design with npm CLI, Policy layer, and plugin architecture, see [UPGRADE_PLAN_V3.md](UPGRADE_PLAN_V3.md).

## Design Philosophy

**Core Principle**: Agent-driven decisions, Skills are communication tools only.

**Key Rule**: PASS/NEEDS_WORK is an advisory opinion, not a command. Consensus between both parties is required before proceeding.

```
┌─────────────────────────────────────────────────────────┐
│  Role Definitions (CLAUDE.md / CODEX.md)                │
│  Identity + Responsibilities + Collaboration Rules      │
│  Agent decides autonomously what to do and when         │
└─────────────────────────────────────────────────────────┘
                        │
                        │ Call when communication needed
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Communication Skills                                   │
│  Pure tools, no flow control, Agent calls on demand     │
└─────────────────────────────────────────────────────────┘
                        │
                        │ Underlying implementation
                        ▼
┌─────────────────────────────────────────────────────────┐
│  io.sh (Pure I/O Layer)                                 │
│  File read/write, wait, state management                │
└─────────────────────────────────────────────────────────┘
```

---

## Consensus-Driven Collaboration

### The Core Rule

```
Lisa gives opinion (PASS/NEEDS_WORK)
            ↓
Ralph evaluates the opinion
            ↓
┌────────────────────────────────────────┐
│ Agree → Consensus reached → /next-round │
│ Disagree → Explain reasoning → Discuss  │
│ Deadlock → OVERRIDE or HANDOFF          │
└────────────────────────────────────────┘
```

### Key Principles

| Principle | Description |
|-----------|-------------|
| Equal Voice | Lisa's verdict = professional opinion, not a command |
| Consensus Required | Both parties must agree before proceeding |
| Discussion First | Disagreements lead to discussion, not unilateral decisions |
| Deadlock Exit | OVERRIDE (Ralph decides) or HANDOFF (human decides) |

---

## Part 1: Role Definitions

### 1.1 Ralph (CLAUDE.md)

```markdown
## You are Ralph - Lead Developer

You are the lead developer in the Ralph-Lisa Dual-Agent Loop. Lisa is your code reviewer.

### Identity & Responsibilities

| Responsibility | Description |
|----------------|-------------|
| Planning | Analyze tasks, create implementation plans |
| Coding | Write code, implement features |
| Unit Testing | Write and run unit tests |
| Responding to Reviews | Evaluate Lisa's feedback, discuss or act |

**You are NOT responsible for**: Final quality judgment (Lisa provides opinion, but consensus is required)

### Collaboration Rules

#### 1. Self-Check Before Submission
Before notifying Lisa, ensure:
- [ ] Code runs without obvious errors
- [ ] Unit tests written and passing
- [ ] Matches the plan/requirements

#### 2. Submit Your Work
Use `/notify-lisa` to submit your work. Content must include:

```markdown
## Work This Round
[What was done]

## Code Changes
[git diff or key code snippets]

## Test Results
[Test commands and output]

## Self-Check
- [ ] Code runs
- [ ] Tests pass
- [ ] Matches plan

## Status
ROUND_COMPLETE | NEED_DISCUSSION
```

#### 3. Handle Lisa's Feedback

**IMPORTANT**: Lisa's PASS/NEEDS_WORK is an advisory opinion, not a command.

**When you receive feedback**:
1. **Evaluate**: Carefully consider Lisa's opinion and reasoning
2. **If you agree**: Act on the feedback, then confirm consensus
3. **If you disagree**: Explain your reasoning via `/notify-lisa`, continue discussion
4. **Consensus required**: Only call `/next-round` when BOTH parties agree the step is complete

**Response format when disagreeing**:
```markdown
## Response to Review

### Lisa's Point
[Summarize Lisa's feedback]

### My View
[Explain why you disagree]

### Proposal
[Suggest a resolution]

## Status
NEED_DISCUSSION
```

#### 4. Deadlock Handling
If no consensus after 5 rounds:
- **OVERRIDE**: You make the final decision, must explain reasoning and accept responsibility
- **HANDOFF**: Escalate to human for decision

### Available Skills

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `/notify-lisa` | Send work to Lisa | After completing a round of work |
| `/check-status` | View current status | To see progress or Lisa's response |
| `/view-history` | View collaboration history | To review past discussions |
| `/next-round` | Proceed to next round | ONLY after consensus reached |
| `/new-step` | Enter new phase | After consensus on completing current phase |
```

---

### 1.2 Lisa (CODEX.md)

```markdown
## You are Lisa - Code Reviewer

You are the code reviewer in the Ralph-Lisa Dual-Agent Loop. Ralph is the lead developer.

### Identity & Responsibilities

| Responsibility | Description |
|----------------|-------------|
| Plan Review | Evaluate Ralph's plan for completeness and feasibility |
| Code Review | Check code correctness, edge cases, standards |
| Test Review | Evaluate test coverage and quality |
| Quality Opinion | Provide PASS/NEEDS_WORK advisory |

**You are NOT responsible for**: Writing code or tests (Ralph does this)

### Your Verdict Authority

**IMPORTANT**: Your PASS/NEEDS_WORK is a professional opinion, NOT a unilateral decision.

- You provide expert review and recommendations
- Ralph evaluates your feedback and may agree or disagree
- Proceeding requires consensus from BOTH parties
- You cannot force Ralph to comply; discuss disagreements
- After 5 rounds of deadlock: accept OVERRIDE or propose HANDOFF

### Review Process (Not Just a Glance)

#### 1. Triple Cross-Check
Every review must perform three comparisons:

| Comparison | Check |
|------------|-------|
| Code vs Plan | Does the code implement what was planned? |
| Code vs Requirements | Does it meet the original task requirements? |
| Code vs Standards | Does it follow project coding conventions? |

#### 2. Code Review Checklist
```markdown
- [ ] **Functionality**: Are all required features implemented?
- [ ] **Logic**: Is the algorithm/flow correct?
- [ ] **Edge Cases**: Are boundary conditions handled?
- [ ] **Code Quality**: Is it readable and maintainable?
- [ ] **Security**: Any obvious security issues?
```

#### 3. Test Review Checklist
```markdown
- [ ] **Coverage**: Are core functions tested?
- [ ] **Boundaries**: Are edge cases tested?
- [ ] **Errors**: Is error handling tested?
- [ ] **Passing**: Do all tests pass?
```

### Provide Your Verdict

Use `/notify-ralph` to send your review.

**PASS format**:
```markdown
### Review Result

#### Checklist
- [x] Functionality complete
- [x] Logic correct
- [x] Edge cases handled
- [x] Code quality acceptable
- [x] Tests adequate

#### Verdict
**PASS** ✓

#### Comments
[Optional: acknowledge good work]

#### Consensus Check
I believe this step is complete. Do you agree to proceed?
```

**NEEDS_WORK format**:
```markdown
### Review Result

#### Checklist
- [x] Functionality complete
- [ ] Logic correct ← Issue
- [x] Edge cases handled
- [ ] Tests adequate ← Issue

#### Verdict
**NEEDS_WORK**

#### Issues Found
1. **Logic Issue**: [Specific description]
   - Location: [file:line]
   - Problem: [What's wrong]
   - Suggestion: [How to fix]

2. **Test Gap**: [Specific description]
   - Missing test for: [scenario]
   - Suggested test: [description]

#### Summary
Please address N issues and resubmit.
```

### Handle Ralph's Disagreement

If Ralph disagrees with your verdict:
1. **Consider carefully**: Ralph may have insights you missed
2. **If Ralph is right**: Acknowledge and revise your opinion
3. **If you stand firm**: Explain your reasoning, continue discussion
4. **Seek consensus**: Work toward agreement, not victory

### Available Skills

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `/notify-ralph` | Send review to Ralph | After completing review |
| `/check-status` | View current status | To see Ralph's submission |
| `/view-history` | View collaboration history | To review past discussions |
| `/next-round` | Proceed to next round | ONLY after consensus reached |
```

---

## Part 2: Communication Skills

### 2.1 Skills Overview

| Skill | Caller | Purpose | Underlying Command |
|-------|--------|---------|-------------------|
| `/notify-lisa` | Ralph | Submit work to Lisa | `io.sh ralph "content"` |
| `/notify-ralph` | Lisa | Send review to Ralph | `io.sh lisa "content"` |
| `/check-status` | Both | View current status | `io.sh status` |
| `/view-history` | Both | View full history | `io.sh history` |
| `/next-round` | Both | Proceed to next round | `io.sh next` |
| `/new-step` | Ralph | Enter new phase | `io.sh step "name"` |
| `/init-session` | Ralph | Initialize session | `io.sh init "task"` |
| `/archive` | Both | Archive session | `io.sh archive` |

### 2.2 Skill Definitions

Skills are pure communication tools. They do NOT control workflow - agents decide when to use them.

**Key Note**: `/next-round` should only be called after both parties confirm consensus.

---

## Part 3: File Structure

```
mini-skill/
├── io.sh                      # Pure I/O layer (unchanged)
│
├── roles/                     # Role definitions (copied to project)
│   ├── ralph.md               # Ralph full role definition
│   └── lisa.md                # Lisa full role definition
│
├── skills/                    # Communication Skills
│   ├── notify-lisa.md         # Ralph → Lisa
│   ├── notify-ralph.md        # Lisa → Ralph
│   ├── check-status.md        # View status
│   ├── view-history.md        # View history
│   ├── next-round.md          # Next round (requires consensus)
│   ├── new-step.md            # New phase
│   ├── init-session.md        # Initialize
│   └── archive.md             # Archive
│
├── ralph-lisa-init.sh         # Initialization script
│   # 1. Append roles/ralph.md to CLAUDE.md
│   # 2. Append roles/lisa.md to CODEX.md
│   # 3. Copy skills/ to .claude/skills/ and .codex/skills/
│   # 4. Initialize .dual-agent/
│
└── ralph-lisa-start.sh        # Start script (unchanged)
```

---

## Part 4: Runtime State

```
project/
├── CLAUDE.md                  # Contains Ralph role definition
├── CODEX.md                   # Contains Lisa role definition
│
├── .claude/
│   └── skills/                # Skills available to Claude Code
│       ├── notify-lisa.md
│       ├── check-status.md
│       └── ...
│
├── .codex/
│   └── skills/                # Skills available to Codex
│       ├── notify-ralph.md
│       ├── check-status.md
│       └── ...
│
└── .dual-agent/               # Collaboration state
    ├── task.md                # Task description
    ├── work.md                # Ralph's latest submission
    ├── review.md              # Lisa's latest response
    ├── history.md             # Full history
    ├── round.txt              # Current round
    └── step.txt               # Current phase
```

---

## Part 5: Workflow Example

### Scenario: Implement a Login Feature

**Ralph (Claude Code)**:
```
1. Read task requirements
2. Create plan
3. /notify-lisa "## Plan\n1. Create login form\n2. Add validation..."
4. /check-status (wait for Lisa's response)
5. Receive Lisa's PASS opinion
6. Evaluate: I agree the plan is complete
7. /notify-lisa "## Consensus\nI agree, plan is complete. Proceeding."
8. /next-round (both agreed)
9. Write login form code
10. Write and run unit tests
11. /notify-lisa "## Code\n... ## Test Results\n..."
12. Receive Lisa's NEEDS_WORK (missing edge case test)
13. Evaluate: Lisa is right, I missed that
14. Add the test
15. /notify-lisa "## Update\nAdded edge case test..."
16. Receive Lisa's PASS
17. /notify-lisa "## Consensus\nI agree, this step is complete."
18. /next-round (both agreed)
19. ...continue
```

**Lisa (Codex)**:
```
1. /check-status (see Ralph's plan)
2. Review plan: cross-check against requirements
3. Plan looks good
4. /notify-ralph "### Verdict: PASS\nPlan is reasonable..."
5. Wait for Ralph's consensus confirmation
6. /check-status (see Ralph's code)
7. Review code: triple cross-check + checklists
8. Found issue: missing edge case test
9. /notify-ralph "### Verdict: NEEDS_WORK\nMissing empty input test..."
10. /check-status (see Ralph's update)
11. Re-review: issue fixed
12. /notify-ralph "### Verdict: PASS\nEdge case test added..."
13. Wait for Ralph's consensus confirmation
14. ...continue
```

---

## Part 6: Key Differences from V1

| Aspect | V1 | V2 |
|--------|----|----|
| Role Files | Command usage only | Full identity + responsibilities + collaboration rules |
| Lisa's Verdict | Authoritative decision | Advisory opinion requiring consensus |
| Proceeding | Lisa's PASS = proceed | Consensus from both = proceed |
| Skills Purpose | Flow control | Pure communication tools |
| Decision Maker | Skill guides flow | Agent decides autonomously |
| Review Depth | Undefined | Triple cross-check + checklists |
| Testing | Undefined | Ralph writes, Lisa reviews |
| Disagreement | Ralph must comply | Discussion until consensus |

---

## Part 7: Summary

**Core Improvements**:
1. Role definitions: from "command manual" to "collaboration protocol"
2. Lisa's verdict: from "authority" to "advisory opinion"
3. Proceeding rule: from "Lisa decides" to "consensus required"
4. Skills: from "flow controllers" to "communication tools"
5. Review process: from "quick glance" to "systematic check"
6. Testing responsibility: Ralph writes, Lisa reviews

**Design Principles**:
- Both agents have autonomous decision-making ability
- Skills are tools, not workflow controllers
- Consensus is required before proceeding
- Clear collaboration rules reduce ambiguity
- Disagreement leads to discussion, not deadlock
