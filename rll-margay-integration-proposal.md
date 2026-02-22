# RLL-Margay Integration Proposal: Turn-Based Dual-Agent via ACP

**Author**: Ralph + Lisa (self-reviewed, watcher down)
**Date**: 2026-02-22
**Status**: Draft — pending tech lead review

---

## 1. Problem Statement

RLL auto mode uses `tmux send-keys` to inject text into Claude Code / Codex TUI panes. This is fundamentally unreliable:

- `send-keys` pushes bytes into PTY buffer without synchronizing with app input state
- Claude Code uses React Ink (raw terminal mode) — keystrokes may be dropped during mid-render, mid-output, or input-unfocused states
- Enter key can fail before readline initialization (tmux#1778)
- No primitive to check if the app is ready for input
- Watcher's fire-and-forget delivery has no reliable completion signal

**治标 commit `d5ceb75`** adds output-stable wait + post-send verification + expanded prompt detection, but the root cause remains: tmux send-keys was designed for human interaction, not programmatic automation.

## 2. Proposed Solution

Replace tmux send-keys with **Margay ACP (Agent Communication Protocol)** — JSON-RPC 2.0 over stdin/stdout, purpose-built for programmatic agent communication.

```
┌─────────────────────────────────────────────────────────┐
│                     Margay Main Process                  │
│                                                          │
│  ┌──────────────────┐        ┌──────────────────┐       │
│  │ AcpAgentManager  │        │ AcpAgentManager  │       │
│  │ (Ralph session)  │        │ (Lisa session)   │       │
│  └────────┬─────────┘        └────────┬─────────┘       │
│           │ JSON-RPC stdin/stdout      │                 │
│           ▼                            ▼                 │
│  claude --experimental-acp    codex (ACP mode)           │
│                                                          │
│  ┌──────────────────────────────────────────────┐       │
│  │           TurnCoordinator (new)               │       │
│  │                                                │       │
│  │  - Listens to 'finish' signal from both agents│       │
│  │  - Parses [TAG] from agent output             │       │
│  │  - Routes Ralph's submission → Lisa's prompt  │       │
│  │  - Routes Lisa's review → Ralph's prompt      │       │
│  │  - Tracks round, step, consensus, deadlock    │       │
│  │  - Emits RLL status to UI                     │       │
│  └──────────────────────────────────────────────┘       │
│                                                          │
│  ┌──────────────────┐                                   │
│  │ React UI (new)   │                                   │
│  │ - Split view: Ralph | Lisa                           │
│  │ - Turn indicator                                     │
│  │ - Tag/round/step status bar                          │
│  │ - Consensus/deadlock alerts                          │
│  └──────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
```

## 3. Why ACP Solves the Root Cause

| tmux send-keys | ACP session/prompt |
|---------------|-------------------|
| Bytes → PTY buffer (no sync) | JSON-RPC request → Promise (with response) |
| No way to know if app is ready | `sendPrompt()` returns when agent acknowledges |
| No completion signal | `finish` signal event when agent is done |
| Permission prompts break flow | `session/request_permission` handled in UI |
| Agent crash = silent failure | Process exit event + reconnect logic |
| 10-minute timeout = mystery | 600s timeout with pause/resume during permissions |

## 4. Existing Margay Infrastructure We Reuse

### Already built (zero work):
- **AcpConnection** — subprocess spawn, JSON-RPC transport, message parsing
- **AcpAgentManager** — lifecycle management, IPC bridging, session persistence
- **AcpAdapter** — streaming chunk accumulation, message format conversion
- **Multi-session support** — WorkerManage already supports concurrent conversations
- **Permission system** — AcpPermissionRequest with allow_once/allow_always/deny
- **Session resume** — `acpSessionId` persisted in database, `_meta.claudeCode.options.resume`
- **Claude backend** — `claude --experimental-acp` via npx
- **Codex backend** — codex ACP mode in ACP_BACKENDS_ALL
- **Streaming UI** — React components for message display, tool calls, thinking

### Needs building (new work):
- **TurnCoordinator** — the core RLL logic adapted for ACP
- **SubmissionParser** — extract [TAG], content, test results from agent output
- **RLL UI panel** — split view, status bar, turn indicator
- **RLL conversation type** — database schema for dual-agent state

## 5. Detailed Design

### 5.1 TurnCoordinator

New module at `src/process/task/TurnCoordinator.ts`:

```typescript
interface TurnState {
  turn: 'ralph' | 'lisa';
  round: number;
  step: string;
  needsWorkCount: number;  // Deadlock detection
  consensusRalph: boolean;
  consensusLisa: boolean;
}

interface Submission {
  tag: string;        // [PLAN], [CODE], [FIX], [PASS], [NEEDS_WORK], etc.
  summary: string;    // First line after tag
  content: string;    // Full content
  testResults?: string;
  round: number;
  timestamp: number;
}

class TurnCoordinator {
  private state: TurnState;
  private ralphManager: AcpAgentManager;
  private lisaManager: AcpAgentManager;
  private history: Submission[];

  // Core flow
  async start(task: string): Promise<void>;
  async onRalphFinish(output: string): Promise<void>;
  async onLisaFinish(output: string): Promise<void>;

  // Tag parsing
  parseSubmission(output: string): Submission;

  // Turn transitions
  private async passToLisa(submission: Submission): Promise<void>;
  private async passToRalph(review: Submission): Promise<void>;

  // Consensus & deadlock
  private checkConsensus(): boolean;
  private checkDeadlock(): boolean;
  private async handleDeadlock(): Promise<void>;

  // Status
  getState(): TurnState;
  getHistory(): Submission[];
}
```

**Core flow:**

```
1. TurnCoordinator.start(task)
   → ralphManager.sendMessage({ content: systemPrompt + task })
   → state.turn = 'ralph'

2. Ralph's 'finish' signal fires
   → onRalphFinish(accumulatedOutput)
   → submission = parseSubmission(output)
   → history.push(submission)
   → state.turn = 'lisa', state.round++
   → passToLisa(submission)
     → lisaManager.sendMessage({
         content: `Round ${round}. Ralph submitted [${tag}]:\n\n${content}\n\nReview this.`
       })

3. Lisa's 'finish' signal fires
   → onLisaFinish(accumulatedOutput)
   → review = parseSubmission(output)
   → history.push(review)
   → state.turn = 'ralph'
   → if review.tag === '[PASS]' && submission.tag === '[CONSENSUS]':
       checkConsensus() → emit 'consensus_reached'
   → else:
       passToRalph(review)
         → ralphManager.sendMessage({
             content: `Lisa's review [${tag}]:\n\n${content}\n\nRespond.`
           })

4. Repeat from step 2
```

### 5.2 SubmissionParser

Extracts structured data from agent's accumulated output:

```typescript
function parseSubmission(output: string): Submission {
  // 1. Find tag: [PLAN], [CODE], [FIX], [PASS], [NEEDS_WORK], etc.
  const tagMatch = output.match(/\[(PLAN|RESEARCH|CODE|FIX|PASS|NEEDS_WORK|CHALLENGE|DISCUSS|QUESTION|CONSENSUS)\]/);

  // 2. Extract summary (first line after tag)
  // 3. Extract test results section
  // 4. Extract full content

  return { tag, summary, content, testResults, round, timestamp };
}
```

### 5.3 Session Architecture

**Option A: Two separate conversations (recommended)**

```
Conversation 1 (Ralph):
  - conversation_id: "rll-{projectId}-ralph"
  - type: 'acp'
  - backend: 'claude'
  - extra.rllRole: 'ralph'
  - extra.rllPairId: "rll-{projectId}"

Conversation 2 (Lisa):
  - conversation_id: "rll-{projectId}-lisa"
  - type: 'acp'
  - backend: 'codex'  (or 'claude' — configurable)
  - extra.rllRole: 'lisa'
  - extra.rllPairId: "rll-{projectId}"
```

Benefits:
- Each agent has independent session state, AcpConnection, streaming
- Session resume works natively (each has own acpSessionId)
- UI can show two parallel message streams
- No changes to existing AcpAgentManager needed

### 5.4 Agent System Prompts

Instead of CLAUDE.md / CODEX.md files, inject role instructions via the first message:

**Ralph's system context (injected by TurnCoordinator):**
```
You are Ralph, lead developer in a turn-based collaboration with Lisa (code reviewer).

Rules:
- You receive task descriptions and Lisa's reviews as messages
- Your output must start with a tag: [PLAN], [RESEARCH], [CODE], [FIX], [CHALLENGE], [DISCUSS], [QUESTION], or [CONSENSUS]
- [CODE] and [FIX] must include a "Test Results" section
- When you see [NEEDS_WORK], explain your reasoning before fixing
- Do NOT run ralph-lisa CLI commands — the coordinator handles turn control

Task: {task}
```

**Lisa's system context:**
```
You are Lisa, code reviewer in a turn-based collaboration with Ralph (lead developer).

Rules:
- You receive Ralph's submissions as messages
- Your output must start with a tag: [PASS], [NEEDS_WORK], [CHALLENGE], [DISCUSS], [QUESTION], or [CONSENSUS]
- Use triple cross-check: Code vs Plan, Code vs Requirements, Code vs Standards
- Provide file:line evidence for claims
- Do NOT run ralph-lisa CLI commands — the coordinator handles turn control
```

Key change: agents no longer call `ralph-lisa whose-turn` / `ralph-lisa submit-ralph` — TurnCoordinator manages everything via `sendMessage()`.

### 5.5 UI Design

New React panel in Margay's existing layout system:

```
┌─────────────────────────────────────────────────┐
│  RLL: {task}                    Round 3 / Step 1 │
│  ═══════════════════════════════════════════════ │
│                                                   │
│  ┌──────────────────┬──────────────────┐         │
│  │ Ralph (Claude)   │ Lisa (Codex)     │         │
│  │                  │                  │         │
│  │ [CODE] Impl...   │ ⏳ Reviewing...  │         │
│  │                  │                  │         │
│  │ streaming...     │                  │         │
│  │                  │                  │         │
│  └──────────────────┴──────────────────┘         │
│                                                   │
│  Status: Lisa's turn │ Deadlock: 0/5             │
│  [Pause] [Override] [Update Task]                │
└─────────────────────────────────────────────────┘
```

Components:
- **RllConversationView** — split-panel wrapper
- **RllStatusBar** — turn, round, step, deadlock counter
- **RllControlPanel** — pause, override, update-task, checkpoint

### 5.6 Permission Handling

Current tmux approach: watcher's INTERACTIVE_RE regex tries to detect permission prompts in pane output, frequently misses them.

ACP approach: permissions come as structured `session/request_permission` events with `optionId`, `name`, `kind`. TurnCoordinator can:

1. **Auto-approve in YOLO mode** (existing: `CLAUDE_YOLO_SESSION_MODE = 'bypassPermissions'`)
2. **Route to UI** for human decision (existing: Margay permission dialog)
3. **Apply RLL policy** — auto-approve read/write within project dir, require human approval for external actions

## 6. Implementation Phases

### Phase 1: Core TurnCoordinator (1-2 days)

Files to create:
- `src/process/task/TurnCoordinator.ts` — turn state machine
- `src/process/task/SubmissionParser.ts` — tag extraction
- `src/process/task/RllAgentManager.ts` — wraps two AcpAgentManagers

Files to modify:
- `src/process/WorkerManage.ts` — add `buildRllConversation()` builder
- `src/common/ipcBridge.ts` — add RLL-specific IPC channels

Deliverable: two agents take turns via ACP `session/prompt`, no UI yet.

### Phase 2: RLL Conversation Type + Database (1 day)

Files to modify:
- `src/process/database/` — add 'rll' conversation type
- `src/process/bridge/conversationBridge.ts` — RLL conversation CRUD
- `src/types/` — add TurnState, Submission interfaces

Deliverable: state persistence, session resume across restarts.

### Phase 3: UI Panel (2-3 days)

Files to create:
- `src/renderer/components/RllConversation/` — split view
- `src/renderer/components/RllStatusBar/` — status display
- `src/renderer/components/RllControlPanel/` — action buttons

Files to modify:
- `src/renderer/routes/` — add RLL conversation route
- `src/renderer/components/Sidebar/` — show RLL sessions

Deliverable: full visual experience in Margay.

### Phase 4: Policy & Consensus Logic (1 day)

Port from RLL CLI:
- Tag validation (Ralph's [CODE] must have test results, etc.)
- Consensus checking (both [CONSENSUS] required)
- Deadlock detection (5 consecutive [NEEDS_WORK])
- NEEDS_WORK response enforcement

### Phase 5: Migration & Compatibility (1 day)

- `ralph-lisa auto --margay` flag: launches Margay with RLL mode instead of tmux
- Import existing .dual-agent/ history into Margay conversation
- Backward compatibility: `ralph-lisa auto` (no flag) keeps tmux mode

## 7. What Gets Removed

After Margay integration is stable:

| Component | Status |
|-----------|--------|
| tmux session management | Replaced by AcpAgentManager |
| watcher.sh (embedded bash) | Replaced by TurnCoordinator |
| `tmux send-keys` delivery | Replaced by `session/prompt` |
| INTERACTIVE_RE detection | Replaced by `session/request_permission` |
| pane log capture | Replaced by streaming events |
| fire-and-forget + retry | Replaced by request-response |
| CLAUDE.md / CODEX.md files | Replaced by system prompt injection |
| `.dual-agent/` file-based state | Replaced by database |

The `ralph-lisa` CLI remains for non-Margay users (manual mode, basic auto mode).

## 8. Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Claude ACP `--experimental-acp` is experimental | Already used in Margay production; flag name doesn't imply instability |
| Codex ACP support maturity | Codex already in ACP_BACKENDS_ALL; fallback to CLI mode if needed |
| Session resume reliability | Database persistence + retry on failed resume (existing in Margay) |
| Margay not installed | `ralph-lisa auto` (tmux mode) remains as fallback |

### 8.1 Crash Recovery

**Risk:** An ACP agent process crashes mid-turn (OOM, network loss, backend timeout). Without a recovery plan, the loop stalls indefinitely.

**Existing Margay infrastructure:**
- `AcpConnection.ts:348-455` — process exit handler with generational tracking (prevents stale handlers from corrupting new connections)
- `AcpConnection.ts:431-455` — `handleProcessExit()`: rejects pending requests, captures stderr ring buffer (max 10 lines, 2000 chars), calls onDisconnect
- `AcpAgent (index.ts):259-269` — auto-reconnect in `sendMessage()`: checks connection, calls `this.start()`, returns `retryable=true`
- `AcpAgentManager.ts:376-398` — `kill()` with grace period (500ms treeKill → 1500ms hard kill)

**TurnCoordinator crash runbook:**

| Phase | Trigger | Action | Budget |
|-------|---------|--------|--------|
| **Detect** | AcpConnection `exit` event | `TurnCoordinator.onAgentCrash(role, exitCode, stderr)` | instant |
| **Pause** | `onAgentCrash` sets `state.paused=true` | Stop routing, emit crash event to UI | 0s |
| **Retry** | Auto-restart via `AcpAgentManager.start()` | Resume session using persisted `acpSessionId` | up to 3 attempts, 5s between |
| **Resume** | Successful reconnect | Re-send last prompt (stored in `TurnCoordinator.lastPrompt[role]`) | 10min timeout per `AcpConnection.ts:469` |
| **Fallback** | 3 retries exhausted | Pause loop, notify user: manual restart / switch to tmux mode / abort | human decision |
| **Operator state** | Throughout | UI shows crash indicator, retry count, last successful round | always visible |

**Acceptance criteria:**
- [ ] Agent crash during turn does not lose the current submission
- [ ] Auto-retry succeeds for transient failures (network blip, OOM kill)
- [ ] After 3 failed retries, user gets actionable notification within 5s
- [ ] Session resume preserves conversation context (verified via `acpSessionId`)

### 8.2 Context Window Management

**Risk:** Long sessions (25+ rounds) fill the context window. Without management, agents silently lose earlier context, producing incoherent reviews.

**Existing Margay infrastructure:**
- `storage.ts:120-227` — `TokenUsageData` with `totalTokens`, `contextLimit` per provider
- `modelContextLimits.ts` — per-model context window information
- `codex/types/eventData.ts:204-209` — `total_token_usage` in streaming events
- ACP agents handle their own internal compression (Claude has auto-compression), but TurnCoordinator can't rely on this for cross-agent state

**Context management policy:**

| Threshold | Action |
|-----------|--------|
| < 70% of model limit | Normal operation |
| 70–85% | Warning in UI status bar; inject hint to active agent: "Context filling — consider concluding current subtask" |
| 85–95% | TurnCoordinator auto-summarizes older rounds: keeps last 3 rounds full, compresses earlier to `[TAG] summary` only |
| > 95% | Force new session: persist state to database, create new ACP session with injected context (task, current subtask, last 2 full rounds, compressed history) |

**Implementation notes:**
- Track token usage via AcpConnection streaming metadata (`total_token_usage` for Codex, response metadata for Claude)
- TurnCoordinator already stores `Submission.tag` + `Submission.summary` per round — reuse for cheap context reconstruction
- Full history always persisted in database regardless of context compression

**Acceptance criteria:**
- [ ] Token usage displayed in RLL status bar
- [ ] Warning emitted before 85% threshold
- [ ] Auto-summarization reduces context by ≥50% while preserving last 3 rounds verbatim
- [ ] Forced new session preserves enough context to continue the current subtask without confusion
- [ ] No data loss: complete round history available in database

### 8.3 Cost Model and Controls

**Risk:** Two concurrent AI agents generate significant API costs. Without visibility or limits, a runaway session (deadlock, long debugging) can produce unexpected bills.

**Cost estimates:**

| Component | Cost Driver | Per-round estimate |
|-----------|------------|-------------------|
| Ralph (Claude Opus) | Input + output tokens | ~$0.15–0.50 |
| Lisa (Codex / Claude Sonnet) | Input + output tokens | ~$0.05–0.20 |
| **Round total** | Both agents | **~$0.20–0.70** |
| Typical session (15 rounds) | All rounds | ~$3–10 |
| Worst case (25 rounds + deadlock retries) | Extended session | ~$8–18 |

**Cost controls:**

| Control | Mechanism |
|---------|-----------|
| **Cost display** | Real-time in RLL status bar: "Round 5 \| $2.40 / $20 budget" |
| **Round tracking** | TurnCoordinator accumulates token cost per session from streaming metadata |
| **Per-round limit** | Configurable max input tokens per agent prompt (default: 100K); warn if exceeded |
| **Session budget** | Hard cap (default: $20, configurable); warn at 80%, pause loop at 100% |
| **Model selection** | Lisa's backend configurable per subtask: Haiku for simple reviews, Sonnet for code-heavy (reduces cost 5–10×) |

**Implementation notes:**
- Token costs derived from `total_token_usage` events (already tracked by Margay's `storage.ts:120`)
- Pricing table maintained in TurnCoordinator config (updated when model pricing changes)
- Budget state persisted in database alongside conversation, survives restart

**Acceptance criteria:**
- [ ] Cumulative token cost tracked and displayed in UI
- [ ] Session budget configurable via TurnCoordinator config
- [ ] Budget warning at 80%, hard pause at 100%
- [ ] Per-round cost breakdown available in session history

## 9. Open Questions

1. **Lisa's backend**: Should Lisa always be Codex, or should it be configurable (another Claude instance, Qwen, etc.)?
2. **Workspace sharing**: Both agents need access to the same project directory. ACP `session/new` takes `cwd` — confirm both can share same cwd safely.
3. **Concurrent file access**: If both agents read the same file simultaneously, is there a race condition? (Unlikely since turn-based, but worth verifying.)
4. **Margay version requirement**: What's the minimum Margay version needed for multi-conversation AcpAgentManager?

## 10. Success Criteria

- [ ] Two agents complete a full plan → code → review → consensus cycle via ACP
- [ ] No tmux dependency required
- [ ] Turn transitions happen within 2 seconds (vs current 5-30s with send-keys)
- [ ] Permission prompts handled in UI without blocking the loop
- [ ] Session survives Margay restart (resume from last turn)
- [ ] Existing `ralph-lisa auto` (tmux mode) still works for non-Margay users
