/**
 * Smoke tests — end-to-end CLI workflow verification.
 * Each test exercises a complete multi-step workflow.
 * Each suite uses an isolated temp directory to prevent parallel conflicts.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

const CLI = path.join(__dirname, "..", "cli.js");
const { TMUX: _stripTmux, RL_STATE_DIR: _stripRlStateDir, ...TEST_ENV } = process.env;

// Each suite creates its own isolated temp directory
function createSuiteDir(name: string): string {
  const dir = path.join(__dirname, "..", "..", `.smoke-${name}-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function makeRun(tmpDir: string) {
  return function run(...args: string[]): { stdout: string; exitCode: number } {
    try {
      const stdout = execFileSync(process.execPath, [CLI, ...args], {
        cwd: tmpDir, encoding: "utf-8",
        env: { ...TEST_ENV, RL_POLICY_MODE: "off" },
      });
      return { stdout, exitCode: 0 };
    } catch (e: any) {
      return { stdout: (e.stdout || "") + (e.stderr || ""), exitCode: e.status };
    }
  };
}

function makeRunWithPolicy(tmpDir: string) {
  return function runWithPolicy(mode: string, ...args: string[]): { stdout: string; exitCode: number } {
    try {
      const stdout = execFileSync(process.execPath, [CLI, ...args], {
        cwd: tmpDir, encoding: "utf-8",
        env: { ...TEST_ENV, RL_POLICY_MODE: mode },
      });
      return { stdout, exitCode: 0 };
    } catch (e: any) {
      return { stdout: (e.stdout || "") + (e.stderr || ""), exitCode: e.status };
    }
  };
}

function makeReadState(tmpDir: string) {
  return function readState(file: string): string {
    return fs.readFileSync(path.join(tmpDir, ".dual-agent", file), "utf-8").trim();
  };
}

// ─── Test 1: Complete Plan → Code → Pass → Consensus flow ───

describe("Smoke: complete plan-code-pass-consensus flow", () => {
  let TMP: string;
  let run: ReturnType<typeof makeRun>;
  let readState: ReturnType<typeof makeReadState>;

  beforeEach(() => { TMP = createSuiteDir("t1"); run = makeRun(TMP); readState = makeReadState(TMP); run("init", "--minimal"); });
  afterEach(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

  it("completes a full development cycle", () => {
    // Round 1: Ralph plans
    assert.strictEqual(readState("turn.txt"), "ralph");
    run("submit-ralph", "[PLAN] Build login\\n\\nTest Plan: npm test");
    assert.strictEqual(readState("turn.txt"), "lisa");

    // Lisa approves plan
    run("submit-lisa", "[PASS] Plan looks good\\n\\n- Approach is sound at commands.ts:1");
    assert.strictEqual(readState("turn.txt"), "ralph");

    // Ralph submits code
    run("submit-ralph", "[CODE] Login implementation\\n\\ncommands.ts:42\\n\\nTest Results\\n- Exit code: 0\\n- 5/5 passed");
    assert.strictEqual(readState("turn.txt"), "lisa");

    // Lisa approves code
    run("submit-lisa", "[PASS] Code looks good\\n\\n- Clean at commands.ts:42");
    assert.strictEqual(readState("turn.txt"), "ralph");

    // Ralph confirms consensus
    run("submit-ralph", "[CONSENSUS] Agreed");

    // Verify history has full cycle
    const history = readState("history.md");
    assert.ok(history.includes("[PLAN]"));
    assert.ok(history.includes("[CODE]"));
    assert.ok(history.includes("[PASS]"));
    assert.ok(history.includes("[CONSENSUS]"));
  });
});

// ─── Test 2: NEEDS_WORK → FIX iteration ───

describe("Smoke: NEEDS_WORK → FIX iteration", () => {
  let TMP: string;
  let run: ReturnType<typeof makeRun>;
  let readState: ReturnType<typeof makeReadState>;

  beforeEach(() => { TMP = createSuiteDir("t2"); run = makeRun(TMP); readState = makeReadState(TMP); run("init", "--minimal"); });
  afterEach(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

  it("handles review feedback loop correctly", () => {
    run("submit-ralph", "[CODE] Login impl\\n\\ncommands.ts:42\\n\\nTest Results\\n- Exit code: 0\\n- 5/5 passed");
    run("submit-lisa", "[NEEDS_WORK] Missing validation\\n\\n- No input check at commands.ts:50");
    run("submit-ralph", "[FIX] Added validation\\n\\ncommands.ts:50\\n\\nTest Results\\n- Exit code: 0\\n- 6/6 passed");
    run("submit-lisa", "[PASS] Validation added\\n\\n- Check at commands.ts:50");
    run("submit-ralph", "[CONSENSUS] Agreed");

    const history = readState("history.md");
    assert.ok(history.includes("[CODE]"));
    assert.ok(history.includes("[NEEDS_WORK]"));
    assert.ok(history.includes("[FIX]"));
    assert.ok(history.includes("[PASS]"));
    assert.ok(history.includes("[CONSENSUS]"));
  });
});

// ─── Test 3: Policy block mode end-to-end ───

describe("Smoke: policy block mode enforcement", () => {
  let TMP: string;
  let run: ReturnType<typeof makeRun>;
  let runWithPolicy: ReturnType<typeof makeRunWithPolicy>;
  let readState: ReturnType<typeof makeReadState>;

  beforeEach(() => { TMP = createSuiteDir("t3"); run = makeRun(TMP); runWithPolicy = makeRunWithPolicy(TMP); readState = makeReadState(TMP); run("init", "--minimal"); });
  afterEach(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

  it("blocks non-compliant submission then allows compliant one", () => {
    const r1 = runWithPolicy("block", "submit-ralph", "[CODE] No tests\\n\\ncommands.ts:1");
    assert.notStrictEqual(r1.exitCode, 0, "should block CODE without Test Results");

    assert.strictEqual(readState("turn.txt"), "ralph");

    const r2 = runWithPolicy("block", "submit-ralph", "[CODE] With tests\\n\\ncommands.ts:1\\n\\nTest Results\\n- Exit code: 0\\n- 10/10 passed");
    assert.strictEqual(r2.exitCode, 0, "should allow CODE with proper Test Results");
    assert.strictEqual(readState("turn.txt"), "lisa");
  });
});

// ─── Test 4: Deadlock trigger and recovery ───

describe("Smoke: deadlock trigger and scope-update recovery", () => {
  let TMP: string;
  let run: ReturnType<typeof makeRun>;
  let readState: ReturnType<typeof makeReadState>;

  function runDL(...args: string[]): { stdout: string; exitCode: number } {
    try {
      const stdout = execFileSync(process.execPath, [CLI, ...args], {
        cwd: TMP, encoding: "utf-8",
        env: { ...TEST_ENV, RL_POLICY_MODE: "off", RL_DEADLOCK_THRESHOLD: "5" },
      });
      return { stdout, exitCode: 0 };
    } catch (e: any) {
      return { stdout: (e.stdout || "") + (e.stderr || ""), exitCode: e.status };
    }
  }

  beforeEach(() => { TMP = createSuiteDir("t4"); run = makeRun(TMP); readState = makeReadState(TMP); run("init", "--minimal"); });
  afterEach(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

  it("triggers deadlock after threshold and recovers via scope-update", () => {
    for (let i = 0; i < 5; i++) {
      runDL("submit-ralph", `[FIX] Fix attempt ${i}\\n\\ncommands.ts:${i}\\n\\nTest Results\\n- Exit code: 0\\n- 1/1 passed`);
      runDL("submit-lisa", `[NEEDS_WORK] Still broken ${i}\\n\\n- Issue at commands.ts:${i}`);
    }

    const deadlockPath = path.join(TMP, ".dual-agent", "deadlock.txt");
    assert.ok(fs.existsSync(deadlockPath), "deadlock.txt must exist");
    assert.strictEqual(readState("needs_work_count.txt"), "5");

    run("scope-update", "New approach: use existing auth library");

    assert.ok(!fs.existsSync(deadlockPath), "deadlock.txt must be cleared");
    assert.strictEqual(readState("needs_work_count.txt"), "0");

    run("submit-ralph", "[PLAN] New approach\\n\\nTest Plan: npm test");
    assert.strictEqual(readState("turn.txt"), "lisa");
  });
});

// ─── Test 5: Step transition + full state reset ───

describe("Smoke: step transition resets state correctly", () => {
  let TMP: string;
  let run: ReturnType<typeof makeRun>;
  let readState: ReturnType<typeof makeReadState>;

  beforeEach(() => { TMP = createSuiteDir("t5"); run = makeRun(TMP); readState = makeReadState(TMP); run("init", "--minimal"); });
  afterEach(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

  it("resets round, turn, and file state on step transition", () => {
    run("submit-ralph", "[CONSENSUS] Agreed on plan");
    run("submit-lisa", "[CONSENSUS] Confirmed\\n\\n- All good at commands.ts:1");

    run("step", "phase-2-implementation");

    assert.strictEqual(readState("round.txt"), "1");
    assert.strictEqual(readState("step.txt"), "phase-2-implementation");
    assert.strictEqual(readState("turn.txt"), "ralph");

    const work = readState("work.md");
    const review = readState("review.md");
    assert.ok(!work.includes("[CONSENSUS]"), "work.md should not have old CONSENSUS tag");
    assert.ok(!review.includes("[CONSENSUS]"), "review.md should not have old CONSENSUS tag");
  });
});

// ─── Test 6: History accumulation correctness ───

describe("Smoke: history accumulation across multiple rounds", () => {
  let TMP: string;
  let run: ReturnType<typeof makeRun>;
  let readState: ReturnType<typeof makeReadState>;

  beforeEach(() => { TMP = createSuiteDir("t6"); run = makeRun(TMP); readState = makeReadState(TMP); run("init", "--minimal"); });
  afterEach(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

  it("records all submissions in chronological order", () => {
    run("submit-ralph", "[PLAN] Step 1 plan\\n\\nTest Plan: jest");
    run("submit-lisa", "[NEEDS_WORK] Revise plan\\n\\n- Missing scope at commands.ts:1");
    run("submit-ralph", "[FIX] Revised plan\\n\\ncommands.ts:1\\n\\nTest Results\\n- Exit code: 0\\n- 1/1 passed");
    run("submit-lisa", "[PASS] Plan approved\\n\\n- Good scope at commands.ts:1");

    const history = readState("history.md");
    const planIdx = history.indexOf("[PLAN]");
    const nwIdx = history.indexOf("[NEEDS_WORK]");
    const fixIdx = history.indexOf("[FIX]");
    const passIdx = history.indexOf("[PASS]");

    assert.ok(planIdx < nwIdx, "PLAN before NEEDS_WORK");
    assert.ok(nwIdx < fixIdx, "NEEDS_WORK before FIX");
    assert.ok(fixIdx < passIdx, "FIX before PASS");
  });
});

// ─── Test 7: Notify on consensus (witness file) ───

describe("Smoke: notify fires on consensus completion", () => {
  let TMP: string;
  let run: ReturnType<typeof makeRun>;
  let witnessFile: string;

  beforeEach(() => {
    TMP = createSuiteDir("t7");
    run = makeRun(TMP);
    witnessFile = path.join(TMP, ".notify-witness");
    run("init", "--minimal");
  });
  afterEach(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

  it("sends notification when step completes", () => {
    run("submit-ralph", "[CONSENSUS] Done");

    try {
      execFileSync(process.execPath, [CLI, "submit-lisa", "[CONSENSUS] Confirmed\\n\\n- All at commands.ts:1"], {
        cwd: TMP, encoding: "utf-8",
        env: { ...TEST_ENV, RL_POLICY_MODE: "off", RL_NOTIFY_CMD: `cat >> "${witnessFile}"` },
      });
    } catch {}

    execFileSync("sleep", ["0.5"]);
    assert.ok(fs.existsSync(witnessFile), "witness file must exist after consensus");
    const content = fs.readFileSync(witnessFile, "utf-8");
    assert.ok(content.includes("complete") || content.includes("consensus"));
  });
});

// ─── Test 8: Recap context recovery ───

describe("Smoke: recap shows correct context after multiple rounds", () => {
  let TMP: string;
  let run: ReturnType<typeof makeRun>;

  beforeEach(() => { TMP = createSuiteDir("t8"); run = makeRun(TMP); run("init", "--minimal"); });
  afterEach(() => { fs.rmSync(TMP, { recursive: true, force: true }); });

  it("shows current step, round, and recent actions", () => {
    run("submit-ralph", "[PLAN] Initial plan\\n\\nTest Plan: npm test");
    run("submit-lisa", "[PASS] Good plan\\n\\n- At commands.ts:1");
    run("submit-ralph", "[CONSENSUS] Agreed");
    run("step", "--force", "phase-2");
    run("submit-ralph", "[CODE] Implementation\\n\\ncommands.ts:42\\n\\nTest Results\\n- Exit code: 0\\n- 10/10 passed");

    const r = run("recap");
    assert.ok(r.stdout.includes("phase-2"), "recap should show current step");
    assert.ok(r.stdout.includes("[CODE]") || r.stdout.includes("Implementation"), "recap should show recent action");
  });
});
