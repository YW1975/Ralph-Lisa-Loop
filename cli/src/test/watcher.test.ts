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
 */

import { describe, it } from "node:test";
import * as assert from "node:assert";

// ─── State machine simulation ────────────────────

interface WatcherState {
  seenTurn: string;
  ackedTurn: string;
  failCount: number;
  panePromptHits: number;
  panePaused: boolean;
  panePauseSize: number;
}

function newState(): WatcherState {
  return {
    seenTurn: "",
    ackedTurn: "",
    failCount: 0,
    panePromptHits: 0,
    panePaused: false,
    panePauseSize: 0,
  };
}

/**
 * Simulate check_and_trigger logic (matches bash watcher v2).
 * Two-variable approach: seenTurn (observed) vs ackedTurn (delivered).
 * triggerResult: true = trigger succeeded, false = failed.
 * Returns the action taken.
 */
function checkAndTrigger(
  state: WatcherState,
  currentTurn: string,
  triggerResult: boolean
): "ack" | "retry" | "degraded" | "alert" | "noop" {
  // Detect new turn change
  if (currentTurn && currentTurn !== state.seenTurn) {
    state.seenTurn = currentTurn;
    state.failCount = 0;
  }

  // Need to deliver? (seen but not acked)
  if (state.seenTurn && state.seenTurn !== state.ackedTurn) {
    let mode: "retry" | "degraded" | "alert" = "retry";
    if (state.failCount >= 30) {
      mode = "alert";
    } else if (state.failCount >= 10) {
      mode = "degraded";
    }

    if (triggerResult) {
      state.ackedTurn = state.seenTurn;
      state.failCount = 0;
      return "ack";
    } else {
      state.failCount++;
      return mode;
    }
  }

  return "noop";
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
    const action = checkAndTrigger(s, "ralph", true);
    assert.strictEqual(action, "ack");
    assert.strictEqual(s.ackedTurn, "ralph");
    assert.strictEqual(s.seenTurn, "ralph");
  });

  it("does NOT update ackedTurn on failed trigger", () => {
    const s = newState();
    const action = checkAndTrigger(s, "ralph", false);
    assert.strictEqual(action, "retry");
    assert.strictEqual(s.seenTurn, "ralph"); // seen
    assert.strictEqual(s.ackedTurn, ""); // NOT acked
    assert.strictEqual(s.failCount, 1);
  });

  it("retries on next cycle after failure (same turn)", () => {
    const s = newState();
    checkAndTrigger(s, "ralph", false); // fail
    assert.strictEqual(s.ackedTurn, "");
    assert.strictEqual(s.failCount, 1);

    // Same turn, seen != acked, so it retries
    const action = checkAndTrigger(s, "ralph", true);
    assert.strictEqual(action, "ack");
    assert.strictEqual(s.ackedTurn, "ralph");
    assert.strictEqual(s.failCount, 0);
  });

  it("resets failCount on new turn change", () => {
    const s = newState();
    s.seenTurn = "ralph";
    s.ackedTurn = "ralph";
    s.failCount = 5;
    const action = checkAndTrigger(s, "lisa", true);
    assert.strictEqual(action, "ack");
    assert.strictEqual(s.failCount, 0);
    assert.strictEqual(s.ackedTurn, "lisa");
  });

  it("noop when turn unchanged and already acked", () => {
    const s = newState();
    s.seenTurn = "ralph";
    s.ackedTurn = "ralph";
    const action = checkAndTrigger(s, "ralph", true);
    assert.strictEqual(action, "noop");
  });
});

describe("Watcher: failure backoff", () => {
  it("enters degraded mode after 10 failures", () => {
    const s = newState();
    // 10 consecutive failures
    for (let i = 0; i < 10; i++) {
      checkAndTrigger(s, "ralph", false);
    }
    assert.strictEqual(s.failCount, 10);
    // Next failure should be degraded
    const action = checkAndTrigger(s, "ralph", false);
    assert.strictEqual(action, "degraded");
    assert.strictEqual(s.failCount, 11);
  });

  it("enters alert mode after 30 failures", () => {
    const s = newState();
    for (let i = 0; i < 30; i++) {
      checkAndTrigger(s, "ralph", false);
    }
    assert.strictEqual(s.failCount, 30);
    const action = checkAndTrigger(s, "ralph", false);
    assert.strictEqual(action, "alert");
    assert.strictEqual(s.failCount, 31);
  });

  it("recovers from degraded on success", () => {
    const s = newState();
    for (let i = 0; i < 15; i++) {
      checkAndTrigger(s, "ralph", false);
    }
    assert.ok(s.failCount >= 10);
    const action = checkAndTrigger(s, "ralph", true);
    assert.strictEqual(action, "ack");
    assert.strictEqual(s.failCount, 0);
    assert.strictEqual(s.ackedTurn, "ralph");
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
