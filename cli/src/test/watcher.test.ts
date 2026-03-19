/**
 * Watcher state machine tests.
 *
 * The watcher is a bash script generated at runtime, so we can't unit-test it
 * directly. Instead we test the state machine logic by simulating the key
 * decision points in TypeScript:
 *
 * 1. LAST_TURN only updates on successful trigger (ack semantics)
 * 2. Failure backoff: 10 → degraded (30s), 30 → ALERT
 * 3. Interactive prompt pause/resume with dual-condition gate
 * 4. v5: Per-round send cap (T1), delivery/monitor decoupling (T2),
 *    capture-pane idle detection (T3), pipe-pane cross-reference rebuild (T4)
 */

import { describe, it } from "node:test";
import * as assert from "node:assert";

// ─── State machine simulation ────────────────────

interface WatcherState {
  seenTurn: string;
  ackedTurn: string;
  seenRound: string;
  ackedRound: string;
  failCount: number;
  lastAckTime: number;
  deliveryPending: boolean;
  pendingTarget: string;
  consensusAtRound: string;
  panePromptHits: number;
  panePaused: boolean;
  panePauseSize: number;
  // v5: per-round send cap
  sendCountThisRound: number;
  maxSendsPerRound: number;
}

function newState(): WatcherState {
  return {
    seenTurn: "",
    ackedTurn: "",
    seenRound: "",
    ackedRound: "",
    failCount: 0,
    lastAckTime: 0,
    deliveryPending: false,
    pendingTarget: "",
    consensusAtRound: "",
    panePromptHits: 0,
    panePaused: false,
    panePauseSize: 0,
    sendCountThisRound: 0,
    maxSendsPerRound: 2,
  };
}

/**
 * Simulate check_and_trigger logic (matches bash watcher v5).
 * Round-based change detection: uses round number (monotonically increasing)
 * to detect turn changes, fixing double-flip deadlock (step39).
 * v5: includes per-round send cap (step41).
 * triggerResult: true = trigger succeeded, false = failed.
 * nowTime: simulated current epoch time for cooldown testing.
 * consensusReached: simulated consensus detection result.
 * Returns the action taken.
 */
function checkAndTrigger(
  state: WatcherState,
  currentTurn: string,
  triggerResult: boolean,
  nowTime: number = 0,
  currentRound: string = "",
  consensusReached: boolean = false
): "ack" | "retry" | "degraded" | "alert" | "noop" | "cooldown" | "consensus" | "send_cap" {
  // 1. Detect new round (step39: round-based detection)
  let roundChanged = false;
  if (currentRound && currentRound !== state.seenRound) {
    roundChanged = true;
    state.seenTurn = currentTurn;
    state.seenRound = currentRound;
    state.failCount = 0;
    state.lastAckTime = 0;
    state.deliveryPending = true;
    state.pendingTarget = currentTurn;
    // v5 (P0-2): Reset send cap for new round
    state.sendCountThisRound = 0;
  } else if (currentTurn && currentTurn !== state.seenTurn) {
    // Fallback: turn changed without round change (e.g., force-turn)
    roundChanged = true;
    state.seenTurn = currentTurn;
    state.failCount = 0;
    state.lastAckTime = 0;
    state.deliveryPending = true;
    state.pendingTarget = currentTurn;
    // v5 (P0-2): Reset send cap for new turn
    state.sendCountThisRound = 0;
  }

  // 2. Cooldown: only applies when round has NOT changed (step39)
  if (!roundChanged && state.lastAckTime > 0 && nowTime > 0) {
    const elapsed = nowTime - state.lastAckTime;
    if (elapsed < 30) {
      return "cooldown";
    }
  }

  // 3. Consensus suppression with round boundary tracking (step39)
  // step46: only suppress if delivery is NOT pending — agent needs to confirm consensus
  if (consensusReached && !state.deliveryPending) {
    if (!state.consensusAtRound) {
      state.consensusAtRound = currentRound;
    }
    if (currentRound === state.consensusAtRound) {
      return "consensus";
    }
    state.consensusAtRound = "";
  } else {
    state.consensusAtRound = "";
  }

  // 4. Need to deliver? (step39: round-based + DELIVERY_PENDING)
  if (state.deliveryPending || (state.seenRound && state.seenRound !== state.ackedRound)) {
    // v5 (P0-2): Check send cap before attempting delivery
    if (state.sendCountThisRound >= state.maxSendsPerRound) {
      return "send_cap";
    }

    let mode: "retry" | "degraded" | "alert" = "retry";
    if (state.failCount >= 30) {
      mode = "alert";
    } else if (state.failCount >= 10) {
      mode = "degraded";
    }

    const deliverTarget = state.pendingTarget || state.seenTurn;
    if (triggerResult) {
      state.ackedTurn = state.seenTurn;
      state.ackedRound = state.seenRound;
      state.deliveryPending = false;
      state.pendingTarget = "";
      state.failCount = 0;
      state.lastAckTime = nowTime;
      // v5: send_go_to_pane increments sendCountThisRound on success
      state.sendCountThisRound++;
      return "ack";
    } else {
      state.failCount++;
      // v5 (P0-1): In v5, trigger failure is only for send-keys failure (rare),
      // not for verification failure. But still count against send cap.
      state.sendCountThisRound++;
      return mode;
    }
  }

  // Legacy fallback: seenTurn != ackedTurn (for force-turn without round change)
  if (state.seenTurn && state.seenTurn !== state.ackedTurn) {
    if (triggerResult) {
      state.ackedTurn = state.seenTurn;
      state.failCount = 0;
      state.lastAckTime = nowTime;
      return "ack";
    } else {
      state.failCount++;
      return "retry";
    }
  }

  return "noop";
}

/**
 * Simulate send_go_to_pane retry-exhaustion logic (v3).
 * Returns true if message was delivered, false if retries exhausted.
 */
function simulateSendGo(
  agentAlive: boolean,
  interactivePrompt: boolean,
  enterRegistered: boolean[],  // per-attempt: did Enter register?
  maxRetries: number = 3
): boolean {
  if (!agentAlive) return false;
  if (interactivePrompt) return false;

  let attempt = 0;
  for (let i = 0; i < maxRetries; i++) {
    if (enterRegistered[i] !== false) {
      // Enter registered (message submitted)
      return true;
    }
    attempt++;
  }

  // All retries exhausted — message never submitted
  return attempt < maxRetries;
}

/**
 * Simulate interactive prompt pause/resume logic.
 * Returns whether send_go should proceed.
 */
function handleInteractivePrompt(
  state: WatcherState,
  promptDetected: boolean,
  outputChanged: boolean,
  currentLogSize: number
): boolean {
  if (state.panePaused) {
    // Resume requires BOTH: output changed AND prompt gone
    if (outputChanged && currentLogSize !== state.panePauseSize && !promptDetected) {
      state.panePaused = false;
      state.panePromptHits = 0;
      return true; // resumed, proceed
    }
    return false; // still paused
  }

  if (promptDetected) {
    state.panePromptHits++;
    if (state.panePromptHits >= 3) {
      state.panePaused = true;
      state.panePauseSize = currentLogSize;
    }
    return false; // don't send
  }

  state.panePromptHits = 0;
  return true; // proceed
}

// ─── Tests ───────────────────────────────────────

describe("Watcher: ack semantics (seenTurn vs ackedTurn)", () => {
  it("updates ackedTurn only on successful trigger", () => {
    const s = newState();
    const action = checkAndTrigger(s, "ralph", true, 0, "1");
    assert.strictEqual(action, "ack");
    assert.strictEqual(s.ackedTurn, "ralph");
    assert.strictEqual(s.seenTurn, "ralph");
  });

  it("does NOT update ackedTurn on failed trigger", () => {
    const s = newState();
    const action = checkAndTrigger(s, "ralph", false, 0, "1");
    assert.strictEqual(action, "retry");
    assert.strictEqual(s.seenTurn, "ralph"); // seen
    assert.strictEqual(s.ackedTurn, ""); // NOT acked
    assert.strictEqual(s.failCount, 1);
  });

  it("retries on next cycle after failure (same turn)", () => {
    const s = newState();
    checkAndTrigger(s, "ralph", false, 0, "1"); // fail
    assert.strictEqual(s.ackedTurn, "");
    assert.strictEqual(s.failCount, 1);

    // Same turn+round, seen != acked, so it retries
    const action = checkAndTrigger(s, "ralph", true, 0, "1");
    assert.strictEqual(action, "ack");
    assert.strictEqual(s.ackedTurn, "ralph");
    assert.strictEqual(s.failCount, 0);
  });

  it("resets failCount on new turn change", () => {
    const s = newState();
    s.seenTurn = "ralph";
    s.ackedTurn = "ralph";
    s.seenRound = "1";
    s.ackedRound = "1";
    s.failCount = 5;
    const action = checkAndTrigger(s, "lisa", true, 0, "2");
    assert.strictEqual(action, "ack");
    assert.strictEqual(s.failCount, 0);
    assert.strictEqual(s.ackedTurn, "lisa");
  });

  it("noop when turn unchanged and already acked", () => {
    const s = newState();
    s.seenTurn = "ralph";
    s.ackedTurn = "ralph";
    s.seenRound = "1";
    s.ackedRound = "1";
    const action = checkAndTrigger(s, "ralph", true, 0, "1");
    assert.strictEqual(action, "noop");
  });
});

describe("Watcher: failure backoff", () => {
  it("enters degraded mode after 10 failures (with high send cap)", () => {
    const s = newState();
    s.maxSendsPerRound = 50; // raise cap to test backoff in isolation
    // 10 consecutive failures
    for (let i = 0; i < 10; i++) {
      checkAndTrigger(s, "ralph", false, 0, "1");
    }
    assert.strictEqual(s.failCount, 10);
    // Next failure should be degraded
    const action = checkAndTrigger(s, "ralph", false, 0, "1");
    assert.strictEqual(action, "degraded");
    assert.strictEqual(s.failCount, 11);
  });

  it("enters alert mode after 30 failures (with high send cap)", () => {
    const s = newState();
    s.maxSendsPerRound = 50;
    for (let i = 0; i < 30; i++) {
      checkAndTrigger(s, "ralph", false, 0, "1");
    }
    assert.strictEqual(s.failCount, 30);
    const action = checkAndTrigger(s, "ralph", false, 0, "1");
    assert.strictEqual(action, "alert");
    assert.strictEqual(s.failCount, 31);
  });

  it("recovers from degraded on success (with high send cap)", () => {
    const s = newState();
    s.maxSendsPerRound = 50;
    for (let i = 0; i < 15; i++) {
      checkAndTrigger(s, "ralph", false, 0, "1");
    }
    assert.ok(s.failCount >= 10);
    const action = checkAndTrigger(s, "ralph", true, 0, "1");
    assert.strictEqual(action, "ack");
    assert.strictEqual(s.failCount, 0);
    assert.strictEqual(s.ackedTurn, "ralph");
  });

  it("with default send cap, hits send_cap before degraded", () => {
    const s = newState();
    // Default maxSendsPerRound=2, so after 2 failures → send_cap
    checkAndTrigger(s, "ralph", false, 0, "1");
    assert.strictEqual(s.failCount, 1);
    checkAndTrigger(s, "ralph", false, 0, "1");
    assert.strictEqual(s.failCount, 2);
    const action = checkAndTrigger(s, "ralph", false, 0, "1");
    assert.strictEqual(action, "send_cap");
    assert.strictEqual(s.failCount, 2); // no further increment
  });
});

describe("Watcher: interactive prompt pause/resume", () => {
  it("pauses after 3 consecutive prompt detections", () => {
    const s = newState();
    handleInteractivePrompt(s, true, false, 100);
    assert.strictEqual(s.panePromptHits, 1);
    assert.strictEqual(s.panePaused, false);

    handleInteractivePrompt(s, true, false, 100);
    assert.strictEqual(s.panePromptHits, 2);

    handleInteractivePrompt(s, true, false, 100);
    assert.strictEqual(s.panePromptHits, 3);
    assert.strictEqual(s.panePaused, true);
    assert.strictEqual(s.panePauseSize, 100);
  });

  it("does not resume with only output change (prompt still present)", () => {
    const s = newState();
    s.panePaused = true;
    s.panePauseSize = 100;
    // Output changed but prompt still there
    const proceed = handleInteractivePrompt(s, true, true, 200);
    assert.strictEqual(proceed, false);
    assert.strictEqual(s.panePaused, true);
  });

  it("does not resume with only prompt gone (no output change)", () => {
    const s = newState();
    s.panePaused = true;
    s.panePauseSize = 100;
    // Prompt gone but output unchanged
    const proceed = handleInteractivePrompt(s, false, false, 100);
    assert.strictEqual(proceed, false);
    assert.strictEqual(s.panePaused, true);
  });

  it("resumes when BOTH output changed AND prompt gone", () => {
    const s = newState();
    s.panePaused = true;
    s.panePauseSize = 100;
    const proceed = handleInteractivePrompt(s, false, true, 200);
    assert.strictEqual(proceed, true);
    assert.strictEqual(s.panePaused, false);
    assert.strictEqual(s.panePromptHits, 0);
  });

  it("resets prompt hits when no prompt detected", () => {
    const s = newState();
    handleInteractivePrompt(s, true, false, 100);
    handleInteractivePrompt(s, true, false, 100);
    assert.strictEqual(s.panePromptHits, 2);
    // No prompt this time
    handleInteractivePrompt(s, false, false, 100);
    assert.strictEqual(s.panePromptHits, 0);
  });
});

describe("Watcher: send_go_to_pane retry exhaustion (RLL-001)", () => {
  it("returns false when all retries fail (Enter never registers)", () => {
    const result = simulateSendGo(true, false, [false, false, false]);
    assert.strictEqual(result, false);
  });

  it("returns true when first attempt succeeds", () => {
    const result = simulateSendGo(true, false, [true, false, false]);
    assert.strictEqual(result, true);
  });

  it("returns true when second attempt succeeds", () => {
    const result = simulateSendGo(true, false, [false, true, false]);
    assert.strictEqual(result, true);
  });

  it("returns false when agent is dead", () => {
    const result = simulateSendGo(false, false, [true, true, true]);
    assert.strictEqual(result, false);
  });

  it("returns false when interactive prompt detected", () => {
    const result = simulateSendGo(true, true, [true, true, true]);
    assert.strictEqual(result, false);
  });
});

describe("Watcher: cooldown does not block new turns (RLL-001)", () => {
  it("cooldown suppresses re-delivery for same turn", () => {
    const s = newState();
    // Ack ralph at t=100, round 1
    const action1 = checkAndTrigger(s, "ralph", true, 100, "1");
    assert.strictEqual(action1, "ack");
    assert.strictEqual(s.lastAckTime, 100);

    // Same turn+round at t=110 (within 30s) → cooldown
    const action2 = checkAndTrigger(s, "ralph", true, 110, "1");
    assert.strictEqual(action2, "cooldown");
  });

  it("new turn within 30s is NOT suppressed by cooldown", () => {
    const s = newState();
    // Ack ralph at t=100, round 1
    checkAndTrigger(s, "ralph", true, 100, "1");
    assert.strictEqual(s.lastAckTime, 100);

    // New turn (lisa) at t=110, round 2 — within 30s of last ack
    // Round change resets lastAckTime to 0, so cooldown does not apply
    const action = checkAndTrigger(s, "lisa", true, 110, "2");
    assert.strictEqual(action, "ack");
    assert.strictEqual(s.ackedTurn, "lisa");
    assert.strictEqual(s.lastAckTime, 110);
  });

  it("cooldown expires after 30s for failed re-delivery", () => {
    const s = newState();
    // Ack ralph at t=100, round 1
    checkAndTrigger(s, "ralph", true, 100, "1");

    // Force unacked state (simulate edge case: ack succeeded but need re-trigger)
    s.ackedRound = "";

    // At t=110 (within 30s, same round) → cooldown
    const action1 = checkAndTrigger(s, "ralph", true, 110, "1");
    assert.strictEqual(action1, "cooldown");

    // At t=135 (past 30s) → delivers
    const action2 = checkAndTrigger(s, "ralph", true, 135, "1");
    assert.strictEqual(action2, "ack");
  });
});

/**
 * Checkpoint runtime state (RLL-003).
 * Models the full watcher checkpoint behavior including reminder cadence
 * and ack lifecycle across loop iterations.
 *
 * The bash watcher uses .checkpoint_ack FILE as persistent source of truth
 * (crash-safe). The file is kept during the checkpoint round and only
 * cleaned up when the round advances past the checkpoint.
 */
interface CheckpointState {
  checkpointRounds: number;
  remindTime: number;       // epoch of last reminder (0 = never)
}

function newCheckpointState(rounds: number): CheckpointState {
  return { checkpointRounds: rounds, remindTime: 0 };
}

/**
 * Simulate checkpoint check in check_and_trigger (matches bash watcher v3).
 * ackFilePresent: whether .checkpoint_ack file exists on disk.
 * nowTime: simulated epoch time.
 * Returns: "pause" (blocked, reminder emitted), "pause_silent" (blocked, no reminder yet),
 *          "proceed" (acked or not a checkpoint round), "no_checkpoint" (disabled/not applicable),
 *          "cleanup" (not at checkpoint round, stale ack file should be removed).
 */
function checkCheckpoint(
  state: CheckpointState,
  round: number,
  ackFilePresent: boolean,
  nowTime: number
): "pause" | "pause_silent" | "proceed" | "no_checkpoint" | "cleanup" {
  if (state.checkpointRounds <= 0) return "no_checkpoint";
  if (round <= 1) return "no_checkpoint";

  const isCheckpointRound = (round - 1) % state.checkpointRounds === 0;

  if (isCheckpointRound) {
    // At checkpoint round — file is source of truth (crash-safe)
    if (ackFilePresent) {
      // Acked — proceed (keep file until round advances)
      return "proceed";
    }
    // Not acked — pause with periodic 30s reminder
    if (state.remindTime === 0 || nowTime - state.remindTime >= 30) {
      state.remindTime = nowTime;
      return "pause"; // reminder emitted
    }
    return "pause_silent"; // blocked but no new reminder
  }

  // Not at checkpoint round — clean up stale ack if present
  if (ackFilePresent) return "cleanup";
  return "no_checkpoint";
}

describe("Watcher: checkpoint round detection (RLL-003)", () => {
  it("pauses at checkpoint round when not acked", () => {
    const s = newCheckpointState(3);
    // round=4 → (4-1)%3==0 → pause
    assert.strictEqual(checkCheckpoint(s, 4, false, 100), "pause");
  });

  it("proceeds at checkpoint round when ack file present", () => {
    const s = newCheckpointState(3);
    assert.strictEqual(checkCheckpoint(s, 4, true, 100), "proceed");
  });

  it("does not checkpoint at non-checkpoint rounds", () => {
    const s = newCheckpointState(3);
    assert.strictEqual(checkCheckpoint(s, 2, false, 100), "no_checkpoint");
    assert.strictEqual(checkCheckpoint(s, 3, false, 100), "no_checkpoint");
    assert.strictEqual(checkCheckpoint(s, 5, false, 100), "no_checkpoint");
  });

  it("does not checkpoint at round 1", () => {
    const s = newCheckpointState(3);
    assert.strictEqual(checkCheckpoint(s, 1, false, 100), "no_checkpoint");
  });

  it("does not checkpoint when disabled (0)", () => {
    const s = newCheckpointState(0);
    assert.strictEqual(checkCheckpoint(s, 4, false, 100), "no_checkpoint");
  });

  it("checkpoints every N rounds correctly", () => {
    const s = newCheckpointState(2);
    // N=2: checkpoints at round 3, 5, 7...
    assert.strictEqual(checkCheckpoint(s, 3, false, 100), "pause");
    assert.strictEqual(checkCheckpoint(s, 5, false, 200), "pause");
    assert.strictEqual(checkCheckpoint(s, 7, false, 300), "pause");
    // Not at round 2, 4, 6
    assert.strictEqual(checkCheckpoint(s, 2, false, 100), "no_checkpoint");
    assert.strictEqual(checkCheckpoint(s, 4, false, 100), "no_checkpoint");
    assert.strictEqual(checkCheckpoint(s, 6, false, 100), "no_checkpoint");
  });
});

describe("Watcher: checkpoint reminder cadence (RLL-003)", () => {
  it("emits reminder on first pause", () => {
    const s = newCheckpointState(3);
    assert.strictEqual(checkCheckpoint(s, 4, false, 100), "pause");
    assert.strictEqual(s.remindTime, 100);
  });

  it("suppresses reminder within 30s", () => {
    const s = newCheckpointState(3);
    checkCheckpoint(s, 4, false, 100); // first reminder at t=100
    assert.strictEqual(checkCheckpoint(s, 4, false, 110), "pause_silent"); // t=110 < 30s
    assert.strictEqual(s.remindTime, 100); // unchanged
  });

  it("re-emits reminder after 30s", () => {
    const s = newCheckpointState(3);
    checkCheckpoint(s, 4, false, 100); // first at t=100
    assert.strictEqual(checkCheckpoint(s, 4, false, 130), "pause"); // t=130 >= 30s
    assert.strictEqual(s.remindTime, 130); // updated
  });

  it("re-emits multiple times at 30s intervals", () => {
    const s = newCheckpointState(3);
    assert.strictEqual(checkCheckpoint(s, 4, false, 100), "pause");
    assert.strictEqual(checkCheckpoint(s, 4, false, 115), "pause_silent");
    assert.strictEqual(checkCheckpoint(s, 4, false, 130), "pause");
    assert.strictEqual(checkCheckpoint(s, 4, false, 145), "pause_silent");
    assert.strictEqual(checkCheckpoint(s, 4, false, 160), "pause");
  });
});

describe("Watcher: checkpoint ack lifecycle (RLL-003)", () => {
  it("ack file persists — repeated checks at same round still proceed", () => {
    const s = newCheckpointState(3);
    // File present at round 4 — proceeds every time (file is NOT deleted)
    assert.strictEqual(checkCheckpoint(s, 4, true, 100), "proceed");
    assert.strictEqual(checkCheckpoint(s, 4, true, 110), "proceed");
    assert.strictEqual(checkCheckpoint(s, 4, true, 200), "proceed");
  });

  it("ack file cleaned up when round advances past checkpoint", () => {
    const s = newCheckpointState(3);
    // Ack at checkpoint round 4
    assert.strictEqual(checkCheckpoint(s, 4, true, 100), "proceed");
    // Round advances to 5 (non-checkpoint) — stale ack triggers cleanup
    assert.strictEqual(checkCheckpoint(s, 5, true, 200), "cleanup");
    // After cleanup (file removed), normal no_checkpoint
    assert.strictEqual(checkCheckpoint(s, 5, false, 200), "no_checkpoint");
  });

  it("next checkpoint round requires fresh ack", () => {
    const s = newCheckpointState(3);
    // Ack round 4, then round advances
    assert.strictEqual(checkCheckpoint(s, 4, true, 100), "proceed");
    // Next checkpoint: round 7 — no ack file → pauses
    assert.strictEqual(checkCheckpoint(s, 7, false, 200), "pause");
  });

  it("watcher restart at same checkpoint round still proceeds if ack file exists", () => {
    // Simulates crash+restart: in-memory state is fresh but file persists
    const fresh = newCheckpointState(3);
    // File still on disk from before crash — proceeds immediately
    assert.strictEqual(checkCheckpoint(fresh, 4, true, 300), "proceed");
  });
});

// ─── RLL-005: Watcher auto-restart simulations ──

/**
 * Simulate cleanup guard flag (RLL-005).
 * Returns number of times cleanup body actually executed.
 */
function simulateCleanup(signals: number): number {
  let cleanupDone = 0;
  let executions = 0;
  for (let i = 0; i < signals; i++) {
    if (cleanupDone) continue;
    cleanupDone = 1;
    executions++;
  }
  return executions;
}

/**
 * Simulate session-guarded restart loop (RLL-005).
 * watcherExitCodes: sequence of exit codes from watcher runs.
 * sessionAliveAfter: for each run index, whether tmux session is alive after exit.
 * Returns number of watcher launches.
 */
function simulateRestartLoop(
  watcherExitCodes: number[],
  sessionAliveAfter: boolean[]
): number {
  let launches = 0;
  for (let i = 0; i < watcherExitCodes.length; i++) {
    // Loop condition: session must be alive to enter
    if (i > 0 && !sessionAliveAfter[i - 1]) break;
    launches++;
    // After watcher exits, check session
    if (!sessionAliveAfter[i]) break;
  }
  return launches;
}

describe("Watcher: cleanup guard flag (RLL-005)", () => {
  it("executes cleanup exactly once on single signal", () => {
    assert.strictEqual(simulateCleanup(1), 1);
  });

  it("executes cleanup exactly once on double signal", () => {
    assert.strictEqual(simulateCleanup(2), 1);
  });

  it("executes cleanup exactly once on triple signal", () => {
    assert.strictEqual(simulateCleanup(3), 1);
  });
});

describe("Watcher: session-guarded restart loop (RLL-005)", () => {
  it("restarts after crash when session is alive", () => {
    // Watcher crashes (exit 1), session alive → restarts, then exits clean
    const launches = simulateRestartLoop([1, 0], [true, true]);
    assert.strictEqual(launches, 2);
  });

  it("does NOT restart when session is gone after exit", () => {
    // Watcher exits, session gone → no restart
    const launches = simulateRestartLoop([0, 0], [false, true]);
    assert.strictEqual(launches, 1);
  });

  it("does NOT restart when session disappears mid-crash", () => {
    // Watcher crashes (exit 1), session gone → no restart
    const launches = simulateRestartLoop([1, 0], [false, true]);
    assert.strictEqual(launches, 1);
  });

  it("handles multiple crashes before stable run", () => {
    // 3 crashes then stable exit, session alive throughout
    const launches = simulateRestartLoop([1, 1, 1, 0], [true, true, true, true]);
    assert.strictEqual(launches, 4);
  });

  it("stops after session teardown mid-sequence", () => {
    // 2 crashes (session alive), then session gone on 3rd exit
    const launches = simulateRestartLoop([1, 1, 1], [true, true, false]);
    assert.strictEqual(launches, 3);
  });
});

/**
 * Simulate wrapper singleton management with process-identity validation (RLL-005).
 * processArgs: what `ps -p PID -o args=` returns for the old PID.
 *   - null = process already dead (PID not running)
 *   - string = process args (must contain "tmux has-session" to be a valid wrapper)
 * Returns whether the old PID was killed.
 */
function simulateWrapperKill(
  oldPidExists: boolean,
  processArgs: string | null
): "killed" | "skipped_dead" | "skipped_wrong_process" | "no_pid_file" {
  if (!oldPidExists) return "no_pid_file";
  if (processArgs === null) return "skipped_dead";
  if (!processArgs.includes("tmux has-session")) return "skipped_wrong_process";
  return "killed";
}

describe("Watcher: wrapper singleton management (RLL-005)", () => {
  it("kills old wrapper when process matches", () => {
    assert.strictEqual(
      simulateWrapperKill(true, "bash -c while tmux has-session -t rll ..."),
      "killed"
    );
  });

  it("skips kill when no PID file", () => {
    assert.strictEqual(
      simulateWrapperKill(false, null),
      "no_pid_file"
    );
  });

  it("skips kill when PID is dead (process not running)", () => {
    assert.strictEqual(
      simulateWrapperKill(true, null),
      "skipped_dead"
    );
  });

  it("skips kill when PID was reused by unrelated process", () => {
    assert.strictEqual(
      simulateWrapperKill(true, "/usr/bin/python3 my_app.py"),
      "skipped_wrong_process"
    );
  });

  it("skips kill when PID reused by similar but wrong command", () => {
    assert.strictEqual(
      simulateWrapperKill(true, "bash -c some_other_script.sh"),
      "skipped_wrong_process"
    );
  });
});

// ─── RLL-006: Pane log threshold simulations ─────

/**
 * Simulate truncate_log_if_needed logic (RLL-006).
 * Returns whether truncation would occur, and the computed thresholds.
 */
function shouldTruncate(
  fileSize: number,
  maxMb: number
): { truncate: boolean; maxBytes: number; tailBytes: number } {
  if (maxMb < 1) maxMb = 1; // floor guard
  const maxBytes = maxMb * 1048576;
  const tailBytes = maxMb * 102400; // ~10% of max
  return { truncate: fileSize > maxBytes, maxBytes, tailBytes };
}

describe("Watcher: pane log threshold (RLL-006)", () => {
  it("default 5MB threshold: no truncation under limit", () => {
    const r = shouldTruncate(4 * 1048576, 5); // 4MB
    assert.strictEqual(r.truncate, false);
    assert.strictEqual(r.maxBytes, 5 * 1048576);
  });

  it("default 5MB threshold: truncates over limit", () => {
    const r = shouldTruncate(6 * 1048576, 5); // 6MB
    assert.strictEqual(r.truncate, true);
    assert.strictEqual(r.tailBytes, 5 * 102400); // 500KB retention
  });

  it("custom 10MB threshold via RL_LOG_MAX_MB", () => {
    const r = shouldTruncate(8 * 1048576, 10); // 8MB < 10MB
    assert.strictEqual(r.truncate, false);
    assert.strictEqual(r.maxBytes, 10 * 1048576);
  });

  it("custom 10MB threshold: truncates over limit", () => {
    const r = shouldTruncate(11 * 1048576, 10); // 11MB > 10MB
    assert.strictEqual(r.truncate, true);
    assert.strictEqual(r.tailBytes, 10 * 102400); // 1000KB retention
  });

  it("tail retention scales with max_mb", () => {
    assert.strictEqual(shouldTruncate(0, 1).tailBytes, 102400);   // 1MB → 100KB
    assert.strictEqual(shouldTruncate(0, 5).tailBytes, 512000);   // 5MB → 500KB
    assert.strictEqual(shouldTruncate(0, 10).tailBytes, 1024000); // 10MB → 1000KB
  });

  it("floor guard: zero/negative RL_LOG_MAX_MB clamps to 1MB", () => {
    const r0 = shouldTruncate(2 * 1048576, 0); // 0 → clamped to 1
    assert.strictEqual(r0.maxBytes, 1048576);
    assert.strictEqual(r0.truncate, true); // 2MB > 1MB

    const rNeg = shouldTruncate(500000, -3); // negative → clamped to 1
    assert.strictEqual(rNeg.maxBytes, 1048576);
    assert.strictEqual(rNeg.truncate, false); // 500KB < 1MB
  });
});

// ─── Watcher: control file state machine (Proposal §3.11) ──

/**
 * Simulate the watcher's control.txt polling logic.
 * Returns the action taken and updated watcher state.
 */
interface ControlState {
  paused: boolean;
  messages: Array<{ target: string; text: string }>;
  scopeUpdates: string[];
  unknownCommands: string[];
}

function processControlCommand(cmd: string, state: ControlState): string {
  if (!cmd) return "empty";

  switch (true) {
    case cmd === "pause":
      state.paused = true;
      return "paused";
    case cmd === "resume":
      if (state.paused) {
        state.paused = false;
        return "resumed";
      }
      return "already-running";
    case cmd.startsWith("msg ralph "):
      state.messages.push({ target: "ralph", text: cmd.slice("msg ralph ".length) });
      return "msg-ralph";
    case cmd.startsWith("msg lisa "):
      state.messages.push({ target: "lisa", text: cmd.slice("msg lisa ".length) });
      return "msg-lisa";
    case cmd.startsWith("scope-update "):
      state.scopeUpdates.push(cmd.slice("scope-update ".length));
      return "scope-update";
    default:
      state.unknownCommands.push(cmd);
      return "unknown";
  }
}

function newControlState(): ControlState {
  return { paused: false, messages: [], scopeUpdates: [], unknownCommands: [] };
}

describe("Watcher: control file commands (Proposal §3.11)", () => {
  it("pause command sets paused state", () => {
    const s = newControlState();
    const r = processControlCommand("pause", s);
    assert.strictEqual(r, "paused");
    assert.strictEqual(s.paused, true);
  });

  it("resume command clears paused state", () => {
    const s = newControlState();
    s.paused = true;
    const r = processControlCommand("resume", s);
    assert.strictEqual(r, "resumed");
    assert.strictEqual(s.paused, false);
  });

  it("resume when not paused returns already-running", () => {
    const s = newControlState();
    const r = processControlCommand("resume", s);
    assert.strictEqual(r, "already-running");
    assert.strictEqual(s.paused, false);
  });

  it("msg ralph sends message to ralph", () => {
    const s = newControlState();
    const r = processControlCommand("msg ralph Check the test results", s);
    assert.strictEqual(r, "msg-ralph");
    assert.strictEqual(s.messages.length, 1);
    assert.strictEqual(s.messages[0].target, "ralph");
    assert.strictEqual(s.messages[0].text, "Check the test results");
  });

  it("msg lisa sends message to lisa", () => {
    const s = newControlState();
    const r = processControlCommand("msg lisa Review the plan again", s);
    assert.strictEqual(r, "msg-lisa");
    assert.strictEqual(s.messages.length, 1);
    assert.strictEqual(s.messages[0].target, "lisa");
    assert.strictEqual(s.messages[0].text, "Review the plan again");
  });

  it("scope-update extracts new scope description", () => {
    const s = newControlState();
    const r = processControlCommand("scope-update Verify Tasks #8-#15", s);
    assert.strictEqual(r, "scope-update");
    assert.strictEqual(s.scopeUpdates.length, 1);
    assert.strictEqual(s.scopeUpdates[0], "Verify Tasks #8-#15");
  });

  it("unknown command is recorded", () => {
    const s = newControlState();
    const r = processControlCommand("restart", s);
    assert.strictEqual(r, "unknown");
    assert.strictEqual(s.unknownCommands.length, 1);
    assert.strictEqual(s.unknownCommands[0], "restart");
  });

  it("empty command returns empty", () => {
    const s = newControlState();
    const r = processControlCommand("", s);
    assert.strictEqual(r, "empty");
  });

  it("pause then resume cycle works correctly", () => {
    const s = newControlState();
    processControlCommand("pause", s);
    assert.strictEqual(s.paused, true);
    // Other commands ignored while paused (watcher only accepts resume)
    processControlCommand("resume", s);
    assert.strictEqual(s.paused, false);
  });

  it("multiple msg commands accumulate", () => {
    const s = newControlState();
    processControlCommand("msg ralph First message", s);
    processControlCommand("msg lisa Second message", s);
    processControlCommand("msg ralph Third message", s);
    assert.strictEqual(s.messages.length, 3);
    assert.strictEqual(s.messages[0].target, "ralph");
    assert.strictEqual(s.messages[1].target, "lisa");
    assert.strictEqual(s.messages[2].target, "ralph");
  });
});

// ─── Step38: Consensus detection simulation ──────

/**
 * Simulates the watcher's check_consensus_reached() function.
 * Extracts last tag from canonical header format: ## [TAG] Round N | Step: ...
 */
function extractLastTagFromContent(content: string): string {
  const re = /^## \[(\w+)\] Round \d+ \| Step: /gm;
  let lastTag = "";
  let match;
  while ((match = re.exec(content)) !== null) {
    lastTag = match[1];
  }
  return lastTag;
}

function checkConsensusReached(workContent: string, reviewContent: string): boolean {
  const workTag = extractLastTagFromContent(workContent);
  const reviewTag = extractLastTagFromContent(reviewContent);
  return (
    (workTag === "CONSENSUS" && reviewTag === "CONSENSUS") ||
    (workTag === "CONSENSUS" && reviewTag === "PASS") ||
    (workTag === "PASS" && reviewTag === "CONSENSUS")
  );
}

describe("Watcher: consensus suppression (step38)", () => {
  it("detects CONSENSUS + CONSENSUS", () => {
    const work = "# Ralph Work\n\n## [CONSENSUS] Round 5 | Step: step37\nAgreed\n";
    const review = "# Lisa Review\n\n## [CONSENSUS] Round 5 | Step: step37\nConfirmed\n";
    assert.ok(checkConsensusReached(work, review));
  });

  it("detects CONSENSUS + PASS", () => {
    const work = "# Ralph Work\n\n## [CONSENSUS] Round 5 | Step: step37\nAgreed\n";
    const review = "# Lisa Review\n\n## [PASS] Round 4 | Step: step37\nApproved\n";
    assert.ok(checkConsensusReached(work, review));
  });

  it("detects PASS + CONSENSUS", () => {
    const work = "# Ralph Work\n\n## [PASS] Round 4 | Step: step37\nApproved\n";
    const review = "# Lisa Review\n\n## [CONSENSUS] Round 5 | Step: step37\nConfirmed\n";
    assert.ok(checkConsensusReached(work, review));
  });

  it("does not suppress on CODE + PASS", () => {
    const work = "# Ralph Work\n\n## [CODE] Round 3 | Step: step37\nSome code\n";
    const review = "# Lisa Review\n\n## [PASS] Round 4 | Step: step37\nApproved\n";
    assert.ok(!checkConsensusReached(work, review));
  });

  it("does not suppress on PLAN + NEEDS_WORK", () => {
    const work = "# Ralph Work\n\n## [PLAN] Round 1 | Step: step37\nPlan\n";
    const review = "# Lisa Review\n\n## [NEEDS_WORK] Round 2 | Step: step37\nFix it\n";
    assert.ok(!checkConsensusReached(work, review));
  });

  it("uses last tag when multiple rounds exist", () => {
    const work = "# Ralph Work\n\n## [CODE] Round 1 | Step: s1\nCode\n\n## [CONSENSUS] Round 3 | Step: s1\nAgreed\n";
    const review = "# Lisa Review\n\n## [NEEDS_WORK] Round 2 | Step: s1\nFix\n\n## [PASS] Round 3 | Step: s1\nOK\n";
    assert.ok(checkConsensusReached(work, review));
  });

  it("does not suppress on empty/reset files", () => {
    const work = "# Ralph Work\n\n(Waiting for Ralph to submit)\n";
    const review = "# Lisa Review\n\n(Waiting for Lisa to respond)\n";
    assert.ok(!checkConsensusReached(work, review));
  });
});

// ─── Step38: Escalation state machine simulation ──────

interface EscalationState {
  notifySentAt: number;
  reminderLevel: number;
  seenTurn: string;
  ackedTurn: string;
}

function newEscalationState(): EscalationState {
  return { notifySentAt: 0, reminderLevel: 0, seenTurn: "", ackedTurn: "" };
}

/**
 * Simulates the escalation decision logic from watcher.sh.
 * Returns the action taken: "none" | "remind" | "slash" | "stuck" | "context_limit"
 *
 * deliverySuccess: whether send_go_to_pane would succeed (default true).
 * When false, L1/L2 attempt delivery but don't advance reminderLevel.
 * L3 never depends on delivery (it's a log-only action), so it always advances.
 *
 * The elif chain checks L3 first (highest elapsed), then L2, then L1.
 * This ensures L3 is always reachable even if L1/L2 delivery keeps failing.
 */
function checkEscalation(
  s: EscalationState,
  nowEpoch: number,
  contextLimitDetected: boolean,
  interactivePrompt: boolean,
  deliverySuccess: boolean = true,
  customThresholds?: { l1: number; l2: number; l3: number }
): string {
  if (s.seenTurn !== s.ackedTurn || s.notifySentAt <= 0) return "none";
  const elapsed = nowEpoch - s.notifySentAt;

  if (contextLimitDetected && s.reminderLevel < 3) {
    s.reminderLevel = 3;
    return "context_limit";
  }
  // step43: configurable escalation timing (default: 5m/15m/30m)
  const L1 = customThresholds?.l1 ?? 300;   // 5 min
  const L2 = customThresholds?.l2 ?? 900;   // 15 min
  const L3 = customThresholds?.l3 ?? 1800;  // 30 min
  // L3 checked first — always reachable by time alone, no delivery dependency
  if (elapsed >= L3 && s.reminderLevel < 3) {
    s.reminderLevel = 3;
    return "stuck";
  }
  if (elapsed >= L2 && s.reminderLevel < 2) {
    if (!interactivePrompt) {
      if (deliverySuccess) s.reminderLevel = 2;
      return "slash";
    }
    return "none"; // skipped due to prompt
  }
  if (elapsed >= L1 && s.reminderLevel < 1) {
    if (deliverySuccess) s.reminderLevel = 1;
    return "remind";
  }
  return "none";
}

describe("Watcher: escalation state machine (step38)", () => {
  it("no escalation before 5 minutes", () => {
    const s = newEscalationState();
    s.seenTurn = "ralph"; s.ackedTurn = "ralph"; s.notifySentAt = 1000;
    assert.strictEqual(checkEscalation(s, 1200, false, false), "none"); // 200s < 300s
  });

  it("L1 REMINDER after 5 minutes", () => {
    const s = newEscalationState();
    s.seenTurn = "ralph"; s.ackedTurn = "ralph"; s.notifySentAt = 1000;
    assert.strictEqual(checkEscalation(s, 1300, false, false), "remind"); // 300s
    assert.strictEqual(s.reminderLevel, 1);
  });

  it("L2 slash after 15 minutes", () => {
    const s = newEscalationState();
    s.seenTurn = "ralph"; s.ackedTurn = "ralph"; s.notifySentAt = 1000;
    s.reminderLevel = 1; // L1 already sent
    assert.strictEqual(checkEscalation(s, 1900, false, false), "slash"); // 900s
    assert.strictEqual(s.reminderLevel, 2);
  });

  it("L2 skipped when interactive prompt detected", () => {
    const s = newEscalationState();
    s.seenTurn = "ralph"; s.ackedTurn = "ralph"; s.notifySentAt = 1000;
    s.reminderLevel = 1;
    assert.strictEqual(checkEscalation(s, 1900, false, true), "none"); // 900s but prompt
    assert.strictEqual(s.reminderLevel, 1); // not advanced
  });

  it("L3 stuck after 30 minutes", () => {
    const s = newEscalationState();
    s.seenTurn = "ralph"; s.ackedTurn = "ralph"; s.notifySentAt = 1000;
    s.reminderLevel = 2;
    assert.strictEqual(checkEscalation(s, 2800, false, false), "stuck"); // 1800s
    assert.strictEqual(s.reminderLevel, 3);
  });

  it("context limit jumps directly to L3", () => {
    const s = newEscalationState();
    s.seenTurn = "lisa"; s.ackedTurn = "lisa"; s.notifySentAt = 1000;
    assert.strictEqual(checkEscalation(s, 1010, true, false), "context_limit");
    assert.strictEqual(s.reminderLevel, 3);
  });

  it("each level fires only once", () => {
    const s = newEscalationState();
    s.seenTurn = "ralph"; s.ackedTurn = "ralph"; s.notifySentAt = 1000;
    checkEscalation(s, 1300, false, false); // L1 at 5min
    assert.strictEqual(checkEscalation(s, 1400, false, false), "none"); // L1 already sent
    checkEscalation(s, 1900, false, false); // L2 at 15min
    assert.strictEqual(checkEscalation(s, 2000, false, false), "none"); // L2 already sent
    checkEscalation(s, 2800, false, false); // L3 at 30min
    assert.strictEqual(checkEscalation(s, 3000, false, false), "none"); // L3 already sent
  });

  it("resets on turn change", () => {
    const s = newEscalationState();
    s.seenTurn = "ralph"; s.ackedTurn = "ralph"; s.notifySentAt = 1000;
    s.reminderLevel = 3; // fully escalated
    // Simulate turn change
    s.seenTurn = "lisa"; s.ackedTurn = ""; s.notifySentAt = 0; s.reminderLevel = 0;
    assert.strictEqual(checkEscalation(s, 2000, false, false), "none"); // not acked yet
    s.ackedTurn = "lisa"; s.notifySentAt = 2000;
    assert.strictEqual(checkEscalation(s, 2300, false, false), "remind"); // fresh L1 at 5min
  });

  it("L1 delivery failure does not advance level", () => {
    const s = newEscalationState();
    s.seenTurn = "ralph"; s.ackedTurn = "ralph"; s.notifySentAt = 1000;
    assert.strictEqual(checkEscalation(s, 1300, false, false, false), "remind");
    assert.strictEqual(s.reminderLevel, 0, "level should not advance on failed delivery");
  });

  it("L2 delivery failure does not advance level", () => {
    const s = newEscalationState();
    s.seenTurn = "ralph"; s.ackedTurn = "ralph"; s.notifySentAt = 1000;
    s.reminderLevel = 1;
    assert.strictEqual(checkEscalation(s, 1900, false, false, false), "slash");
    assert.strictEqual(s.reminderLevel, 1, "level should not advance on failed delivery");
  });

  it("L3 is reachable even when L1 delivery keeps failing", () => {
    const s = newEscalationState();
    s.seenTurn = "ralph"; s.ackedTurn = "ralph"; s.notifySentAt = 1000;
    checkEscalation(s, 1300, false, false, false); // L1 fails
    assert.strictEqual(s.reminderLevel, 0);
    checkEscalation(s, 1500, false, false, false);
    assert.strictEqual(s.reminderLevel, 0);
    // At 30 min, L3 fires because it's checked first
    assert.strictEqual(checkEscalation(s, 2800, false, false, false), "stuck");
    assert.strictEqual(s.reminderLevel, 3, "L3 must be reachable despite L1 failures");
  });

  it("L3 is reachable even when L2 delivery keeps failing", () => {
    const s = newEscalationState();
    s.seenTurn = "lisa"; s.ackedTurn = "lisa"; s.notifySentAt = 1000;
    s.reminderLevel = 1;
    checkEscalation(s, 1900, false, false, false); // L2 fails
    assert.strictEqual(s.reminderLevel, 1);
    assert.strictEqual(checkEscalation(s, 2800, false, false, false), "stuck");
    assert.strictEqual(s.reminderLevel, 3);
  });
});

describe("Watcher: configurable escalation thresholds (step43)", () => {
  it("custom thresholds override defaults", () => {
    const s = newEscalationState();
    s.seenTurn = "ralph"; s.ackedTurn = "ralph"; s.notifySentAt = 1000;
    const custom = { l1: 60, l2: 180, l3: 600 }; // 1m/3m/10m

    // Before L1 (60s)
    assert.strictEqual(checkEscalation(s, 1050, false, false, true, custom), "none");

    // At L1 (60s)
    assert.strictEqual(checkEscalation(s, 1060, false, false, true, custom), "remind");
    assert.strictEqual(s.reminderLevel, 1);

    // At L2 (180s)
    assert.strictEqual(checkEscalation(s, 1180, false, false, true, custom), "slash");
    assert.strictEqual(s.reminderLevel, 2);

    // At L3 (600s)
    assert.strictEqual(checkEscalation(s, 1600, false, false, true, custom), "stuck");
    assert.strictEqual(s.reminderLevel, 3);
  });

  it("default thresholds still work when no custom provided", () => {
    const s = newEscalationState();
    s.seenTurn = "ralph"; s.ackedTurn = "ralph"; s.notifySentAt = 1000;

    // 200s < default L1 (300s) → no escalation
    assert.strictEqual(checkEscalation(s, 1200, false, false), "none");

    // 300s = default L1 → remind
    assert.strictEqual(checkEscalation(s, 1300, false, false), "remind");
  });
});

// ─── Step39: Round-based detection + double-flip + consensus boundary ──────

describe("Watcher: round-based change detection (step39)", () => {
  it("detects turn change via round number", () => {
    const s = newState();
    const action = checkAndTrigger(s, "ralph", true, 100, "1");
    assert.strictEqual(action, "ack");
    assert.strictEqual(s.seenRound, "1");
    assert.strictEqual(s.ackedRound, "1");
  });

  it("double-flip A→B→A is detected when round changes", () => {
    const s = newState();
    // Round 1: ralph acked
    checkAndTrigger(s, "ralph", true, 100, "1");
    assert.strictEqual(s.ackedTurn, "ralph");
    assert.strictEqual(s.ackedRound, "1");

    // Simulate double-flip: ralph submits (round 2, turn=lisa),
    // then lisa submits quickly (round 3, turn=ralph).
    // Watcher was busy and missed round 2, now sees round 3 with turn=ralph.
    // Same turn value as before, but round changed → must deliver!
    const action = checkAndTrigger(s, "ralph", true, 105, "3");
    assert.strictEqual(action, "ack", "double-flip must be detected via round change");
    assert.strictEqual(s.ackedRound, "3");
    assert.strictEqual(s.ackedTurn, "ralph");
  });

  it("double-flip within cooldown window is NOT suppressed", () => {
    const s = newState();
    // Round 1: ralph acked at t=100
    checkAndTrigger(s, "ralph", true, 100, "1");

    // Double-flip at t=105 (within 30s cooldown) but new round
    const action = checkAndTrigger(s, "ralph", true, 105, "3");
    assert.strictEqual(action, "ack", "new round must bypass cooldown");
  });

  it("DELIVERY_PENDING is set on round change", () => {
    const s = newState();
    checkAndTrigger(s, "ralph", true, 100, "1");
    assert.strictEqual(s.deliveryPending, false);

    // Trigger round change but delivery fails
    const action = checkAndTrigger(s, "lisa", false, 105, "2");
    assert.strictEqual(action, "retry");
    assert.strictEqual(s.deliveryPending, true);
    assert.strictEqual(s.pendingTarget, "lisa");
  });

  it("DELIVERY_PENDING cleared on successful delivery", () => {
    const s = newState();
    checkAndTrigger(s, "ralph", false, 100, "1"); // fail
    assert.strictEqual(s.deliveryPending, true);

    checkAndTrigger(s, "ralph", true, 105, "1"); // success
    assert.strictEqual(s.deliveryPending, false);
    assert.strictEqual(s.pendingTarget, "");
  });

  it("force-turn without round change still detected via turn value", () => {
    const s = newState();
    s.seenTurn = "ralph";
    s.ackedTurn = "ralph";
    s.seenRound = "5";
    s.ackedRound = "5";

    // force-turn changes turn to lisa but round stays at 5
    const action = checkAndTrigger(s, "lisa", true, 200, "5");
    assert.strictEqual(action, "ack");
    assert.strictEqual(s.ackedTurn, "lisa");
  });
});

describe("Watcher: consensus suppression with round boundary (step39)", () => {
  it("consensus suppresses within same round (past cooldown)", () => {
    const s = newState();
    checkAndTrigger(s, "ralph", true, 100, "5");
    // Same round, consensus reached, past cooldown (t=135, >30s after ack)
    const action = checkAndTrigger(s, "ralph", true, 135, "5", true);
    assert.strictEqual(action, "consensus");
  });

  it("consensus does NOT suppress after round change", () => {
    const s = newState();
    // Round 5: ack ralph, then consensus detected past cooldown
    checkAndTrigger(s, "ralph", true, 100, "5");
    checkAndTrigger(s, "ralph", true, 135, "5", true); // sets consensusAtRound="5"
    assert.strictEqual(s.consensusAtRound, "5");

    // Round 6: new round, consensus tags may still exist in files
    // but round boundary means we should deliver
    const action = checkAndTrigger(s, "lisa", true, 140, "6", true);
    assert.strictEqual(action, "ack", "consensus must not suppress after round change");
    assert.strictEqual(s.ackedTurn, "lisa");
  });

  it("consensus state clears when consensus no longer detected", () => {
    const s = newState();
    // Set up consensus at round 5
    checkAndTrigger(s, "ralph", true, 100, "5");
    checkAndTrigger(s, "ralph", true, 135, "5", true);
    assert.strictEqual(s.consensusAtRound, "5");

    // Next check past cooldown: consensus no longer detected (files were reset by next-step)
    s.ackedRound = ""; // force re-delivery
    s.lastAckTime = 0; // clear cooldown
    const action = checkAndTrigger(s, "ralph", true, 170, "5", false);
    assert.strictEqual(s.consensusAtRound, "");
  });

  it("consensus does NOT suppress when delivery is pending (step46 bug fix)", () => {
    const s = newState();
    // Round 5: ralph acked
    checkAndTrigger(s, "ralph", true, 100, "5");
    assert.strictEqual(s.deliveryPending, false);

    // Round 6: lisa's turn, delivery pending (Ralph just submitted CONSENSUS)
    // Consensus tags exist (PASS+CONSENSUS), but Lisa hasn't responded yet
    const action = checkAndTrigger(s, "lisa", true, 105, "6", true);
    // Must deliver to Lisa — NOT suppress
    assert.strictEqual(action, "ack", "must trigger Lisa even when consensus tags exist, because delivery is pending");
    assert.strictEqual(s.ackedTurn, "lisa");
  });

  it("consensus suppresses AFTER delivery completes (step46)", () => {
    const s = newState();
    // Round 5: ralph acked, delivery complete
    checkAndTrigger(s, "ralph", true, 100, "5");
    assert.strictEqual(s.deliveryPending, false);

    // Same round, past cooldown, consensus reached, delivery NOT pending → suppress
    const action = checkAndTrigger(s, "ralph", true, 135, "5", true);
    assert.strictEqual(action, "consensus");
  });
});

describe("Watcher: state persistence (step39)", () => {
  it("state fields are correctly initialized", () => {
    const s = newState();
    assert.strictEqual(s.seenRound, "");
    assert.strictEqual(s.ackedRound, "");
    assert.strictEqual(s.deliveryPending, false);
    assert.strictEqual(s.pendingTarget, "");
    assert.strictEqual(s.consensusAtRound, "");
  });

  it("simulated crash recovery replays pending delivery", () => {
    const s = newState();
    // Simulate state after crash: round changed, delivery pending
    s.seenTurn = "lisa";
    s.seenRound = "3";
    s.ackedTurn = "ralph";
    s.ackedRound = "2";
    s.deliveryPending = true;
    s.pendingTarget = "lisa";

    // On restore, trigger succeeds
    const action = checkAndTrigger(s, "lisa", true, 200, "3");
    assert.strictEqual(action, "ack");
    assert.strictEqual(s.deliveryPending, false);
    assert.strictEqual(s.ackedRound, "3");
  });

  it("simulated crash recovery retries on failure", () => {
    const s = newState();
    s.seenTurn = "lisa";
    s.seenRound = "3";
    s.ackedTurn = "ralph";
    s.ackedRound = "2";
    s.deliveryPending = true;
    s.pendingTarget = "lisa";

    // On restore, trigger fails
    const action = checkAndTrigger(s, "lisa", false, 200, "3");
    assert.strictEqual(action, "retry");
    assert.strictEqual(s.deliveryPending, true);
    assert.strictEqual(s.failCount, 1);
  });
});

// ─── Step41 (v5): Per-round send cap (T1) ──────

describe("Watcher v5: per-round send cap (T1)", () => {
  it("allows first 2 sends within same round", () => {
    const s = newState();
    // First send: ack
    const a1 = checkAndTrigger(s, "ralph", true, 100, "1");
    assert.strictEqual(a1, "ack");
    assert.strictEqual(s.sendCountThisRound, 1);

    // Force re-delivery to test second send
    s.ackedRound = "";
    s.lastAckTime = 0;
    const a2 = checkAndTrigger(s, "ralph", true, 105, "1");
    assert.strictEqual(a2, "ack");
    assert.strictEqual(s.sendCountThisRound, 2);
  });

  it("blocks 3rd send with send_cap", () => {
    const s = newState();
    // 2 sends
    checkAndTrigger(s, "ralph", true, 100, "1");
    s.ackedRound = "";
    s.lastAckTime = 0;
    checkAndTrigger(s, "ralph", true, 105, "1");
    assert.strictEqual(s.sendCountThisRound, 2);

    // 3rd attempt: blocked
    s.ackedRound = "";
    s.lastAckTime = 0;
    const a3 = checkAndTrigger(s, "ralph", true, 110, "1");
    assert.strictEqual(a3, "send_cap");
    assert.strictEqual(s.sendCountThisRound, 2); // not incremented
  });

  it("resets send count on round change", () => {
    const s = newState();
    // Max out sends in round 1
    checkAndTrigger(s, "ralph", true, 100, "1");
    s.ackedRound = "";
    s.lastAckTime = 0;
    checkAndTrigger(s, "ralph", true, 105, "1");
    assert.strictEqual(s.sendCountThisRound, 2);

    // New round resets
    const a = checkAndTrigger(s, "lisa", true, 110, "2");
    assert.strictEqual(a, "ack");
    assert.strictEqual(s.sendCountThisRound, 1); // reset to 0, then incremented
  });

  it("resets send count on force-turn (no round change)", () => {
    const s = newState();
    checkAndTrigger(s, "ralph", true, 100, "1");
    s.ackedRound = "";
    s.lastAckTime = 0;
    checkAndTrigger(s, "ralph", true, 105, "1");
    assert.strictEqual(s.sendCountThisRound, 2);

    // Force-turn: turn changes but round stays same
    s.ackedRound = "1"; // pretend acked to avoid delivery path
    const a = checkAndTrigger(s, "lisa", true, 110, "1");
    assert.strictEqual(a, "ack");
    assert.strictEqual(s.sendCountThisRound, 1); // reset + 1
  });

  it("failed sends also count against cap", () => {
    const s = newState();
    // 2 failed sends
    checkAndTrigger(s, "ralph", false, 100, "1");
    assert.strictEqual(s.sendCountThisRound, 1);
    checkAndTrigger(s, "ralph", false, 105, "1");
    assert.strictEqual(s.sendCountThisRound, 2);

    // 3rd attempt blocked
    const a = checkAndTrigger(s, "ralph", false, 110, "1");
    assert.strictEqual(a, "send_cap");
  });
});

// ─── Step41 (v5): Delivery/monitor decoupling (T2) ──────

/**
 * Simulate v5 send_go_to_pane: returns success if send-keys succeeded
 * (message left input line), regardless of post-send output monitoring.
 * In v4 this would return false when pipe-pane verification failed.
 */
function simulateSendGoV5(
  agentAlive: boolean,
  interactivePrompt: boolean,
  enterRegistered: boolean[],
  maxRetries: number = 3
): { delivered: boolean; sendCount: number } {
  if (!agentAlive) return { delivered: false, sendCount: 0 };
  if (interactivePrompt) return { delivered: false, sendCount: 0 };

  for (let i = 0; i < maxRetries; i++) {
    if (enterRegistered[i] !== false) {
      // v5: send-keys succeeded + message left input = delivered
      // No post-send log verification needed
      return { delivered: true, sendCount: 1 };
    }
  }
  return { delivered: false, sendCount: 0 };
}

/**
 * Simulate v5 monitor_agent_response: passive check, no message injection.
 * Returns whether agent appears active.
 */
function simulateMonitorResponse(
  paneChanged: boolean,
  logGrew: boolean,
  turnChanged: boolean
): { agentActive: boolean; pipeRebuild: boolean } {
  // Cross-reference: pane changed but log didn't grow → pipe dead
  const pipeRebuild = paneChanged && !logGrew;

  // Agent is active if pane changed or turn changed
  const agentActive = paneChanged || turnChanged;

  return { agentActive, pipeRebuild };
}

describe("Watcher v5: delivery/monitor decoupling (T2)", () => {
  it("delivery succeeds even when pipe-pane is dead (v4 bug fixed)", () => {
    // In v4: send-keys OK but log didn't grow → returned false → re-sent
    // In v5: send-keys OK → returned true, monitoring is separate
    const result = simulateSendGoV5(true, false, [true]);
    assert.strictEqual(result.delivered, true);
    assert.strictEqual(result.sendCount, 1);
  });

  it("delivery still fails when send-keys actually fails", () => {
    const result = simulateSendGoV5(true, false, [false, false, false]);
    assert.strictEqual(result.delivered, false);
  });

  it("monitor detects active agent without sending messages", () => {
    const result = simulateMonitorResponse(true, false, false);
    assert.strictEqual(result.agentActive, true);
    // No message was sent — purely observational
  });

  it("monitor detects stalled agent", () => {
    const result = simulateMonitorResponse(false, false, false);
    assert.strictEqual(result.agentActive, false);
  });

  it("monitor resets escalation when agent is active", () => {
    // Simulate: delivery succeeded (ack), then escalation path checks monitor
    const s = newState();
    checkAndTrigger(s, "ralph", true, 100, "1");

    // Simulate escalation check: agent is active via capture-pane
    const monitor = simulateMonitorResponse(true, true, false);
    assert.strictEqual(monitor.agentActive, true);
    // Escalation should reset (tested via state, not checkAndTrigger directly)
  });
});

// ─── Step41 (v5): Capture-pane idle detection (T3) ──────

/**
 * Simulate v5 check_output_stable: uses capture-pane hash diff.
 * hash1/hash2: simulated pane content hashes at two points in time.
 */
function simulateOutputStable(hash1: string, hash2: string): boolean {
  return hash1 === hash2; // stable if unchanged
}

describe("Watcher v5: capture-pane idle detection (T3)", () => {
  it("detects stable output (same hash)", () => {
    assert.strictEqual(simulateOutputStable("abc123", "abc123"), true);
  });

  it("detects active output (different hash)", () => {
    assert.strictEqual(simulateOutputStable("abc123", "def456"), false);
  });

  it("works correctly when pane is empty", () => {
    assert.strictEqual(simulateOutputStable("", ""), true);
  });

  it("detects change from empty to content", () => {
    assert.strictEqual(simulateOutputStable("", "abc123"), false);
  });
});

// ─── Step41 (v5): Pipe-pane cross-reference rebuild (T4) ──────

describe("Watcher v5: pipe-pane cross-reference rebuild (T4)", () => {
  it("detects dead pipe: pane changed but log stale", () => {
    const result = simulateMonitorResponse(true, false, false);
    assert.strictEqual(result.pipeRebuild, true);
    assert.strictEqual(result.agentActive, true);
  });

  it("healthy pipe: pane changed and log grew", () => {
    const result = simulateMonitorResponse(true, true, false);
    assert.strictEqual(result.pipeRebuild, false);
    assert.strictEqual(result.agentActive, true);
  });

  it("idle agent: no pane change, no log growth", () => {
    const result = simulateMonitorResponse(false, false, false);
    assert.strictEqual(result.pipeRebuild, false);
    assert.strictEqual(result.agentActive, false);
  });

  it("no rebuild when pane unchanged (even if log grew)", () => {
    const result = simulateMonitorResponse(false, true, false);
    assert.strictEqual(result.pipeRebuild, false);
  });

  it("turn change signals active agent without pane change", () => {
    const result = simulateMonitorResponse(false, false, true);
    assert.strictEqual(result.agentActive, true);
    assert.strictEqual(result.pipeRebuild, false);
  });
});
