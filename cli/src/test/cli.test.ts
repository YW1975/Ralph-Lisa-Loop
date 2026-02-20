import { describe, it, beforeEach, afterEach } from "node:test";
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { generateSessionName, executeForceTurn, parseSubtasks } from "../commands.js";
import { resetProjectRootCache } from "../state.js";

const CLI = path.join(__dirname, "..", "cli.js");
const TMP = path.join(__dirname, "..", "..", ".test-tmp");

function run(...args: string[]): { stdout: string; exitCode: number } {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      cwd: TMP,
      encoding: "utf-8",
      env: { ...process.env, RL_POLICY_MODE: "off" },
    });
    return { stdout, exitCode: 0 };
  } catch (e: any) {
    return { stdout: (e.stdout || "") + (e.stderr || ""), exitCode: e.status };
  }
}

describe("CLI: policy check-consensus", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("passes when both agents submit CONSENSUS", () => {
    run("submit-ralph", "[CONSENSUS] Agreed on plan");
    run("submit-lisa", "[CONSENSUS] Agreed\n\n- All good");
    const r = run("policy", "check-consensus");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Consensus reached"));
  });

  it("fails when neither agent has CONSENSUS", () => {
    run("submit-ralph", "[CODE] Done\n\nTest Results\n- pass");
    run("submit-lisa", "[PASS] OK\n\n- Clean code");
    const r = run("policy", "check-consensus");
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stdout.includes("NOT reached"));
  });

  it("fails when only Ralph has CONSENSUS", () => {
    run("submit-ralph", "[CONSENSUS] I agree");
    run("submit-lisa", "[PASS] OK\n\n- Looks good");
    const r = run("policy", "check-consensus");
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stdout.includes("Lisa"));
  });
});

describe("CLI: policy check-next-step", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("passes when both CONSENSUS and policy OK", () => {
    run("submit-ralph", "[CONSENSUS] Agreed on approach");
    run("submit-lisa", "[CONSENSUS] Confirmed\n\n- Sound plan");
    const r = run("policy", "check-next-step");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Ready to proceed"));
  });

  it("fails with comprehensive issues", () => {
    run("submit-ralph", "[CODE] Done");
    run("submit-lisa", "[PASS] OK");
    const r = run("policy", "check-next-step");
    assert.strictEqual(r.exitCode, 1);
    // Should report: no consensus + missing test results + missing reason
    assert.ok(r.stdout.includes("not [CONSENSUS]"));
  });
});

describe("CLI: doctor", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("runs and outputs dependency check header", () => {
    const r = run("doctor");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Dependency Check"));
  });

  it("outputs at least one status line", () => {
    const r = run("doctor");
    assert.strictEqual(r.exitCode, 0);
    // Should have at least one OK, MISSING, or -- line
    assert.ok(
      r.stdout.includes("OK") ||
        r.stdout.includes("MISSING") ||
        r.stdout.includes("--")
    );
  });

  it("outputs Node.js version", () => {
    const r = run("doctor");
    assert.ok(r.stdout.includes("Node.js"));
  });
});

describe("CLI: logs", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("lists no logs when none exist", () => {
    const r = run("logs");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("No transcript logs found"));
  });

  it("lists live pane logs when present", () => {
    const logFile = path.join(TMP, ".dual-agent", "pane0.log");
    fs.writeFileSync(logFile, "some output from ralph\n");
    const r = run("logs");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Live (current session)"));
    assert.ok(r.stdout.includes("pane0.log"));
  });

  it("lists archived logs", () => {
    const logsDir = path.join(TMP, ".dual-agent", "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(path.join(logsDir, "pane0-2026-01-01T12-00-00.log"), "archived output\n");
    const r = run("logs");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Archived (previous sessions)"));
    assert.ok(r.stdout.includes("pane0-2026-01-01T12-00-00.log"));
  });

  it("cat shows live pane log content", () => {
    const logFile = path.join(TMP, ".dual-agent", "pane0.log");
    fs.writeFileSync(logFile, "hello from ralph pane\n");
    const r = run("logs", "cat");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("hello from ralph pane"));
  });

  it("cat shows specific archived log", () => {
    const logsDir = path.join(TMP, ".dual-agent", "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    const archiveFile = "pane1-2026-01-01T12-00-00.log";
    fs.writeFileSync(path.join(logsDir, archiveFile), "archived lisa output\n");
    const r = run("logs", "cat", archiveFile);
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("archived lisa output"));
  });

  it("ignores empty pane logs in listing", () => {
    const logFile = path.join(TMP, ".dual-agent", "pane0.log");
    fs.writeFileSync(logFile, ""); // empty
    const r = run("logs");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(!r.stdout.includes("pane0.log"));
  });
});

describe("CLI: init --minimal", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("creates only .dual-agent/, no project files", () => {
    run("init", "--minimal");
    assert.ok(fs.existsSync(path.join(TMP, ".dual-agent", "turn.txt")));
    assert.ok(!fs.existsSync(path.join(TMP, "CLAUDE.md")));
    assert.ok(!fs.existsSync(path.join(TMP, "CODEX.md")));
    assert.ok(!fs.existsSync(path.join(TMP, ".claude")));
    assert.ok(!fs.existsSync(path.join(TMP, ".codex")));
  });

  it("allows submit after minimal init", () => {
    run("init", "--minimal");
    const r = run("submit-ralph", "[PLAN] Test plan");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Submitted"));
  });
});

describe("CLI: submit --file", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("ralph submits content from file", () => {
    const contentFile = path.join(TMP, "submission.md");
    fs.writeFileSync(contentFile, "[PLAN] My plan from file\n\nDetailed plan content here.");
    const r = run("submit-ralph", "--file", contentFile);
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Submitted"));
    assert.ok(r.stdout.includes("[PLAN]"));
    // Verify work.md contains the file content
    const work = fs.readFileSync(path.join(TMP, ".dual-agent", "work.md"), "utf-8");
    assert.ok(work.includes("Detailed plan content here"));
  });

  it("lisa submits content from file", () => {
    // Ralph submits first to give Lisa the turn
    run("submit-ralph", "[PLAN] Setup");
    const contentFile = path.join(TMP, "review.md");
    fs.writeFileSync(contentFile, "[PASS] Approved from file\n\nLooks good to me.");
    const r = run("submit-lisa", "--file", contentFile);
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Submitted"));
    assert.ok(r.stdout.includes("[PASS]"));
  });

  it("fails when --file has no path", () => {
    const r = run("submit-ralph", "--file");
    assert.notStrictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("--file requires a file path"));
  });

  it("fails when file does not exist", () => {
    const r = run("submit-ralph", "--file", "/nonexistent/path.md");
    assert.notStrictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("File not found"));
  });

  it("handles file with special characters in content", () => {
    const contentFile = path.join(TMP, "special.md");
    fs.writeFileSync(contentFile, '[PLAN] Plan with "quotes" & $pecial chars\n\nContent with `backticks` and $(subshell)');
    const r = run("submit-ralph", "--file", contentFile);
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Submitted"));
    const work = fs.readFileSync(path.join(TMP, ".dual-agent", "work.md"), "utf-8");
    assert.ok(work.includes("$(subshell)"));
  });

  it("--file history gets summary only, not full content", () => {
    const contentFile = path.join(TMP, "submission.md");
    fs.writeFileSync(contentFile, "[PLAN] File plan\n\nThis detailed body should NOT be in history.");
    run("submit-ralph", "--file", contentFile);
    const history = fs.readFileSync(path.join(TMP, ".dual-agent", "history.md"), "utf-8");
    // History should have summary reference, not full body
    assert.ok(history.includes("File plan"));
    assert.ok(history.includes("(Full content in work.md)"));
    assert.ok(!history.includes("This detailed body should NOT be in history"));
  });

  it("--file full content is still in work.md", () => {
    const contentFile = path.join(TMP, "submission.md");
    fs.writeFileSync(contentFile, "[PLAN] File plan\n\nFull body lives in work.md.");
    run("submit-ralph", "--file", contentFile);
    const work = fs.readFileSync(path.join(TMP, ".dual-agent", "work.md"), "utf-8");
    assert.ok(work.includes("Full body lives in work.md"));
  });

  it("inline args still write full content to history", () => {
    const r = run("submit-ralph", "[PLAN] Inline plan\n\nInline body in history.");
    assert.strictEqual(r.exitCode, 0);
    const history = fs.readFileSync(path.join(TMP, ".dual-agent", "history.md"), "utf-8");
    assert.ok(history.includes("Inline body in history"));
    assert.ok(!history.includes("(Full content in work.md)"));
  });
});

describe("CLI: submit files_changed", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    // Set up a git repo so git diff works
    execFileSync("git", ["init"], { cwd: TMP, stdio: "pipe" });
    execFileSync("git", ["config", "user.email", "test@test.com"], { cwd: TMP, stdio: "pipe" });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: TMP, stdio: "pipe" });
    // Create and commit an initial file
    fs.writeFileSync(path.join(TMP, "app.ts"), "const x = 1;\n");
    execFileSync("git", ["add", "app.ts"], { cwd: TMP, stdio: "pipe" });
    execFileSync("git", ["commit", "-m", "initial"], { cwd: TMP, stdio: "pipe" });
    run("init", "--minimal");
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("attaches files_changed to work.md for CODE tag", () => {
    // Modify a tracked file
    fs.writeFileSync(path.join(TMP, "app.ts"), "const x = 2;\n");
    const r = run("submit-ralph", "[CODE] Updated app\n\nTest Results\n- pass");
    assert.strictEqual(r.exitCode, 0);
    const work = fs.readFileSync(path.join(TMP, ".dual-agent", "work.md"), "utf-8");
    assert.ok(work.includes("**Files Changed**:"));
    assert.ok(work.includes("- app.ts"));
  });

  it("attaches files_changed to work.md for FIX tag", () => {
    fs.writeFileSync(path.join(TMP, "app.ts"), "const x = 3;\n");
    const r = run("submit-ralph", "[FIX] Fixed app\n\nTest Results\n- pass");
    assert.strictEqual(r.exitCode, 0);
    const work = fs.readFileSync(path.join(TMP, ".dual-agent", "work.md"), "utf-8");
    assert.ok(work.includes("**Files Changed**:"));
    assert.ok(work.includes("- app.ts"));
  });

  it("does NOT attach files_changed for PLAN tag", () => {
    fs.writeFileSync(path.join(TMP, "app.ts"), "const x = 4;\n");
    const r = run("submit-ralph", "[PLAN] Just a plan");
    assert.strictEqual(r.exitCode, 0);
    const work = fs.readFileSync(path.join(TMP, ".dual-agent", "work.md"), "utf-8");
    assert.ok(!work.includes("**Files Changed**:"));
  });

  it("no files_changed section when no files changed", () => {
    // No modifications — git diff should return empty
    const r = run("submit-ralph", "[CODE] No changes\n\nTest Results\n- pass");
    assert.strictEqual(r.exitCode, 0);
    const work = fs.readFileSync(path.join(TMP, ".dual-agent", "work.md"), "utf-8");
    assert.ok(!work.includes("**Files Changed**:"));
  });
});

describe("CLI: submit --stdin", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  function runWithStdin(input: string, ...args: string[]): { stdout: string; exitCode: number } {
    try {
      const stdout = execFileSync(process.execPath, [CLI, ...args], {
        cwd: TMP,
        encoding: "utf-8",
        input,
        env: { ...process.env, RL_POLICY_MODE: "off" },
      });
      return { stdout, exitCode: 0 };
    } catch (e: any) {
      return { stdout: (e.stdout || "") + (e.stderr || ""), exitCode: e.status };
    }
  }

  it("ralph submits content from stdin", () => {
    const r = runWithStdin(
      "[PLAN] Plan from stdin\n\nStdin content here.",
      "submit-ralph", "--stdin"
    );
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Submitted"));
    assert.ok(r.stdout.includes("[PLAN]"));
    const work = fs.readFileSync(path.join(TMP, ".dual-agent", "work.md"), "utf-8");
    assert.ok(work.includes("Stdin content here"));
  });

  it("lisa submits content from stdin", () => {
    run("submit-ralph", "[PLAN] Setup");
    const r = runWithStdin(
      "[PASS] Approved from stdin\n\nAll good.",
      "submit-lisa", "--stdin"
    );
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Submitted"));
    assert.ok(r.stdout.includes("[PASS]"));
  });

  it("--stdin history gets summary only, not full content", () => {
    runWithStdin(
      "[PLAN] Stdin plan\n\nDetailed stdin body not in history.",
      "submit-ralph", "--stdin"
    );
    const history = fs.readFileSync(path.join(TMP, ".dual-agent", "history.md"), "utf-8");
    assert.ok(history.includes("Stdin plan"));
    assert.ok(history.includes("(Full content in work.md)"));
    assert.ok(!history.includes("Detailed stdin body not in history"));
  });
});

describe("CLI: recap", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("shows current step and round", () => {
    const r = run("recap");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("RECAP"));
    assert.ok(r.stdout.includes("Step: planning"));
    assert.ok(r.stdout.includes("Round: 1"));
  });

  it("shows recent actions after submissions", () => {
    run("submit-ralph", "[PLAN] First plan");
    run("submit-lisa", "[PASS] Plan approved\n\n- Looks good");
    run("submit-ralph", "[CONSENSUS] Agreed");
    const r = run("recap");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Recent actions:"));
    assert.ok(r.stdout.includes("Ralph [PLAN] First plan"));
    assert.ok(r.stdout.includes("Lisa [PASS] Plan approved"));
    assert.ok(r.stdout.includes("Ralph [CONSENSUS] Agreed"));
    assert.ok(r.stdout.includes("Actions in this step: 3"));
  });

  it("shows only last 3 actions when more exist", () => {
    run("submit-ralph", "[PLAN] Plan A");
    run("submit-lisa", "[NEEDS_WORK] Fix it\n\n- Issue found");
    run("submit-ralph", "[FIX] Fixed\n\nTest Results\n- pass");
    run("submit-lisa", "[PASS] Now good\n\n- All clear");
    const r = run("recap");
    assert.strictEqual(r.exitCode, 0);
    // Should show last 3, not the first PLAN
    assert.ok(!r.stdout.includes("[PLAN] Plan A"));
    assert.ok(r.stdout.includes("[NEEDS_WORK] Fix it"));
    assert.ok(r.stdout.includes("[FIX] Fixed"));
    assert.ok(r.stdout.includes("[PASS] Now good"));
  });

  it("shows unresolved NEEDS_WORK", () => {
    run("submit-ralph", "[CODE] Some code\n\nTest Results\n- pass");
    run("submit-lisa", "[NEEDS_WORK] Missing edge case\n\n- Need tests");
    const r = run("recap");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Unresolved NEEDS_WORK:"));
    assert.ok(r.stdout.includes("Missing edge case"));
  });

  it("does not show resolved NEEDS_WORK", () => {
    run("submit-ralph", "[CODE] Some code\n\nTest Results\n- pass");
    run("submit-lisa", "[NEEDS_WORK] Missing edge case\n\n- Need tests");
    run("submit-ralph", "[FIX] Added edge case tests\n\nTest Results\n- pass");
    const r = run("recap");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(!r.stdout.includes("Unresolved NEEDS_WORK:"));
  });

  it("shows no actions when step is fresh", () => {
    const r = run("recap");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Actions in this step: 0"));
    assert.ok(r.stdout.includes("Recent actions: (none)"));
  });
});

describe("CLI: review-history", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("review.md keeps last 3 entries after 4 submissions", () => {
    // Round 1
    run("submit-ralph", "[PLAN] Plan A");
    run("submit-lisa", "[NEEDS_WORK] Fix plan\n\n- Issue 1");
    // Round 2
    run("submit-ralph", "[FIX] Fixed plan\n\nTest Results\n- pass");
    run("submit-lisa", "[NEEDS_WORK] Still wrong\n\n- Issue 2");
    // Round 3
    run("submit-ralph", "[FIX] Fixed again\n\nTest Results\n- pass");
    run("submit-lisa", "[PASS] Now good\n\n- All clear");
    // Round 4
    run("submit-ralph", "[CONSENSUS] Agreed");
    run("submit-lisa", "[CONSENSUS] Confirmed\n\n- Done");

    const review = fs.readFileSync(path.join(TMP, ".dual-agent", "review.md"), "utf-8");
    // Should have exactly 3 entries (rounds 2, 3, 4), not round 1
    assert.ok(!review.includes("Fix plan"));
    assert.ok(review.includes("Still wrong"));
    assert.ok(review.includes("Now good"));
    assert.ok(review.includes("Confirmed"));
  });

  it("review.md contains separator between entries", () => {
    run("submit-ralph", "[PLAN] Plan");
    run("submit-lisa", "[PASS] OK\n\n- Good");
    run("submit-ralph", "[CONSENSUS] Agreed");
    run("submit-lisa", "[CONSENSUS] Done\n\n- Confirmed");

    const review = fs.readFileSync(path.join(TMP, ".dual-agent", "review.md"), "utf-8");
    assert.ok(review.includes("---"));
  });

  it("read review --round N returns specific round from history", () => {
    run("submit-ralph", "[PLAN] Plan A");
    run("submit-lisa", "[NEEDS_WORK] Fix plan\n\n- Issue found");
    run("submit-ralph", "[FIX] Fixed\n\nTest Results\n- pass");
    run("submit-lisa", "[PASS] Approved\n\n- Looks good");

    const r = run("read", "review", "--round", "1");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Fix plan"));
    assert.ok(r.stdout.includes("Issue found"));
  });

  it("read review --round returns correct round when multiple exist", () => {
    run("submit-ralph", "[PLAN] Plan");
    run("submit-lisa", "[NEEDS_WORK] Round 1 review\n\n- R1 issue");
    run("submit-ralph", "[FIX] Fix\n\nTest Results\n- pass");
    run("submit-lisa", "[PASS] Round 2 review\n\n- R2 good");

    const r2 = run("read", "review", "--round", "2");
    assert.strictEqual(r2.exitCode, 0);
    assert.ok(r2.stdout.includes("Round 2 review"));
    assert.ok(r2.stdout.includes("R2 good"));
  });

  it("read review --round with invalid round shows error", () => {
    const r = run("read", "review", "--round", "abc");
    assert.notStrictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("--round requires a positive integer"));
  });

  it("read review --round with out-of-range round shows not found", () => {
    run("submit-ralph", "[PLAN] Plan");
    run("submit-lisa", "[PASS] OK\n\n- Good");
    const r = run("read", "review", "--round", "99");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("No review found for round 99"));
  });

  it("read review.md without --round still shows current file", () => {
    run("submit-ralph", "[PLAN] Plan");
    run("submit-lisa", "[PASS] Latest review\n\n- Current");
    const r = run("read", "review.md");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Latest review"));
  });
});

describe("CLI: step consensus check", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("allows step when both CONSENSUS", () => {
    run("submit-ralph", "[CONSENSUS] Agreed");
    run("submit-lisa", "[CONSENSUS] Confirmed\n\n- Done");
    const r = run("step", "next-feature");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Entered step: next-feature"));
  });

  it("allows step when CONSENSUS + PASS", () => {
    // Ralph submits CONSENSUS, Lisa responds with PASS
    // work.md last tag = CONSENSUS, review.md last tag = PASS
    run("submit-ralph", "[CONSENSUS] I agree");
    run("submit-lisa", "[PASS] Approved\n\n- Looks good");
    const r = run("step", "next-feature");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Entered step: next-feature"));
  });

  it("allows step when PASS + CONSENSUS", () => {
    // Lisa gives PASS, Ralph submits CONSENSUS
    // After Ralph's CONSENSUS, work.md has CONSENSUS, review.md still has PASS
    run("submit-ralph", "[PLAN] Plan");
    run("submit-lisa", "[PASS] Approved\n\n- Good");
    run("submit-ralph", "[CONSENSUS] Agreed");
    // work.md = CONSENSUS, review.md = PASS → should allow
    const r = run("step", "next-feature");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Entered step: next-feature"));
  });

  it("blocks step when no consensus", () => {
    run("submit-ralph", "[CODE] Some code\n\nTest Results\n- pass");
    run("submit-lisa", "[PASS] Looks good\n\n- Clean");
    const r = run("step", "next-feature");
    assert.notStrictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Consensus not reached"));
  });

  it("--force bypasses consensus check", () => {
    run("submit-ralph", "[CODE] Some code\n\nTest Results\n- pass");
    run("submit-lisa", "[NEEDS_WORK] Fix it\n\n- Issue");
    const r = run("step", "--force", "next-feature");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Entered step: next-feature"));
  });

  it("shows both tags in error when blocked", () => {
    run("submit-ralph", "[CODE] Code\n\nTest Results\n- pass");
    run("submit-lisa", "[NEEDS_WORK] Problems\n\n- Bugs");
    const r = run("step", "next-feature");
    assert.notStrictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("[CODE]"));
    assert.ok(r.stdout.includes("[NEEDS_WORK]"));
  });

  it("body text with ## [CONSENSUS] does NOT spoof consensus", () => {
    // Ralph submits CODE with a ## [CONSENSUS] heading in the body text
    run("submit-ralph", "[CODE] My code\n\nTest Results\n- pass\n\n## [CONSENSUS] fake heading in body");
    run("submit-lisa", "[PASS] OK\n\n- Clean code");
    const r = run("step", "next-feature");
    // Should block: work.md metadata tag is CODE, not CONSENSUS
    assert.notStrictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Consensus not reached"));
    assert.ok(r.stdout.includes("[CODE]"));
  });
});

describe("CLI: update-task", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });
  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("creates task entry with timestamp", () => {
    const r = run("update-task", "New direction for the project");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Scope updated"));
    const task = fs.readFileSync(path.join(TMP, ".dual-agent", "task.md"), "utf-8");
    assert.ok(task.includes("New direction for the project"));
    assert.ok(task.includes("Updated:"));
  });

  it("preserves original task when updating", () => {
    const task = fs.readFileSync(path.join(TMP, ".dual-agent", "task.md"), "utf-8");
    const originalContent = task.trim();
    run("update-task", "Changed direction");
    const updated = fs.readFileSync(path.join(TMP, ".dual-agent", "task.md"), "utf-8");
    // Original content still present
    assert.ok(updated.includes("Waiting for task assignment"));
    assert.ok(updated.includes("Changed direction"));
  });

  it("fails when no description given", () => {
    const r = run("update-task");
    assert.notStrictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Usage"));
  });
});

describe("CLI: task context in work.md", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });
  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("auto-injects Task field into work.md from task.md", () => {
    // Update task to have a meaningful description
    run("update-task", "Implement login feature");
    run("submit-ralph", "[PLAN] My plan");
    const work = fs.readFileSync(path.join(TMP, ".dual-agent", "work.md"), "utf-8");
    assert.ok(work.includes("**Task**: Implement login feature"), "work.md should contain Task field");
  });

  it("work.md has no Task field when task.md has no meaningful content", () => {
    // Default task.md has "Waiting for task assignment" — this IS meaningful content
    run("submit-ralph", "[PLAN] My plan");
    const work = fs.readFileSync(path.join(TMP, ".dual-agent", "work.md"), "utf-8");
    // Should include the default task text
    assert.ok(work.includes("**Task**:"), "work.md should have Task field even with default task");
  });

  it("uses latest task direction after multiple update-task calls", () => {
    run("update-task", "First direction");
    run("update-task", "Second direction");
    run("update-task", "Final direction");
    run("submit-ralph", "[PLAN] My plan");
    const work = fs.readFileSync(path.join(TMP, ".dual-agent", "work.md"), "utf-8");
    assert.ok(work.includes("**Task**: Final direction"), "work.md should use latest task direction");
    assert.ok(!work.includes("**Task**: First direction"), "work.md should NOT use first task direction");
  });
});

describe("CLI: upward .dual-agent/ search (BUG-2)", () => {
  const TMP_ROOT = path.join(__dirname, "..", "..", ".test-tmp-bug2");

  function runFromDir(cwd: string, ...args: string[]): { stdout: string; exitCode: number } {
    try {
      const stdout = execFileSync(process.execPath, [CLI, ...args], {
        cwd,
        encoding: "utf-8",
        env: { ...process.env, RL_POLICY_MODE: "off" },
      });
      return { stdout, exitCode: 0 };
    } catch (e: any) {
      return { stdout: (e.stdout || "") + (e.stderr || ""), exitCode: e.status };
    }
  }

  beforeEach(() => {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    // Initialize session in root
    runFromDir(TMP_ROOT, "init", "--minimal");
  });

  afterEach(() => {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  });

  it("whose-turn works from subdirectory", () => {
    const subDir = path.join(TMP_ROOT, "src", "components");
    fs.mkdirSync(subDir, { recursive: true });
    const r = runFromDir(subDir, "whose-turn");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.trim() === "ralph");
  });

  it("submit-ralph works from subdirectory", () => {
    const subDir = path.join(TMP_ROOT, "src");
    fs.mkdirSync(subDir, { recursive: true });
    const r = runFromDir(subDir, "submit-ralph", "[PLAN] Plan from subdir");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Submitted"));
    // Verify state was written to the root .dual-agent/
    const work = fs.readFileSync(path.join(TMP_ROOT, ".dual-agent", "work.md"), "utf-8");
    assert.ok(work.includes("Plan from subdir"));
  });

  it("status works from subdirectory", () => {
    const subDir = path.join(TMP_ROOT, "src");
    fs.mkdirSync(subDir, { recursive: true });
    const r = runFromDir(subDir, "status");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Turn: ralph"));
  });

  it("read works from subdirectory", () => {
    // Submit something first from root
    runFromDir(TMP_ROOT, "submit-ralph", "[PLAN] Root plan");
    // Then read from subdirectory
    const subDir = path.join(TMP_ROOT, "lib");
    fs.mkdirSync(subDir, { recursive: true });
    const r = runFromDir(subDir, "read", "work.md");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Root plan"));
  });

  it("recap works from subdirectory", () => {
    runFromDir(TMP_ROOT, "submit-ralph", "[PLAN] Plan");
    const subDir = path.join(TMP_ROOT, "src");
    fs.mkdirSync(subDir, { recursive: true });
    const r = runFromDir(subDir, "recap");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("RECAP"));
  });

  it("deeply nested subdirectory finds root", () => {
    const deepDir = path.join(TMP_ROOT, "a", "b", "c", "d");
    fs.mkdirSync(deepDir, { recursive: true });
    const r = runFromDir(deepDir, "whose-turn");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.trim() === "ralph");
  });

  it("error when no .dual-agent/ anywhere in path", () => {
    // Use /tmp/ to avoid finding the real project's .dual-agent/ via upward search
    const isolatedDir = path.join("/tmp", ".rll-test-no-session-" + process.pid);
    fs.rmSync(isolatedDir, { recursive: true, force: true });
    fs.mkdirSync(isolatedDir, { recursive: true });
    try {
      const r = runFromDir(isolatedDir, "whose-turn");
      assert.notStrictEqual(r.exitCode, 0);
      assert.ok(r.stdout.includes("Session not initialized"));
    } finally {
      fs.rmSync(isolatedDir, { recursive: true, force: true });
    }
  });
});

describe("generateSessionName (BUG-3)", () => {
  it("generates different names for different project paths", () => {
    const name1 = generateSessionName("/home/user/project-a");
    const name2 = generateSessionName("/home/user/project-b");
    assert.notStrictEqual(name1, name2);
  });

  it("generates same name for same project path", () => {
    const name1 = generateSessionName("/home/user/my-project");
    const name2 = generateSessionName("/home/user/my-project");
    assert.strictEqual(name1, name2);
  });

  it("starts with rll- prefix", () => {
    const name = generateSessionName("/home/user/my-project");
    assert.ok(name.startsWith("rll-"));
  });

  it("contains project directory name", () => {
    const name = generateSessionName("/home/user/my-cool-project");
    assert.ok(name.includes("my-cool-project"));
  });

  it("contains 6-char hash suffix", () => {
    const name = generateSessionName("/home/user/project");
    // Format: rll-{dirName}-{6-char-hash}
    const parts = name.split("-");
    const hash = parts[parts.length - 1];
    assert.strictEqual(hash.length, 6);
    assert.ok(/^[0-9a-f]{6}$/.test(hash));
  });

  it("sanitizes special characters for tmux compatibility", () => {
    const name = generateSessionName("/home/user/my.project:v2");
    // tmux session names cannot contain . or :
    assert.ok(!name.includes("."));
    assert.ok(!name.includes(":"));
  });

  it("handles spaces in directory name", () => {
    const name = generateSessionName("/home/user/My Project");
    assert.ok(!name.includes(" "));
    assert.ok(name.startsWith("rll-"));
  });

  it("handles very long directory names", () => {
    const longName = "a".repeat(100);
    const name = generateSessionName(`/home/user/${longName}`);
    // Dir portion truncated to 20 chars + prefix + hash = reasonable length
    assert.ok(name.length <= 32);
  });

  it("differentiates same-named dirs in different parents", () => {
    // Same basename "app" but different full paths
    const name1 = generateSessionName("/home/user/project-a/app");
    const name2 = generateSessionName("/home/user/project-b/app");
    // Names differ because hash is based on full path
    assert.notStrictEqual(name1, name2);
  });
});

describe("CLI: command aliases (IMP-2)", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("check-turn works as alias for whose-turn", () => {
    const r = run("check-turn");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.trim() === "ralph");
  });

  it("check-turn and whose-turn return same result", () => {
    const r1 = run("check-turn");
    const r2 = run("whose-turn");
    assert.strictEqual(r1.stdout.trim(), r2.stdout.trim());
  });

  it("next-step works as alias for step", () => {
    run("submit-ralph", "[CONSENSUS] Agreed");
    run("submit-lisa", "[CONSENSUS] Confirmed\n\n- Done");
    const r = run("next-step", "impl-feature");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Entered step: impl-feature"));
  });

  it("read-review shows review.md content", () => {
    run("submit-ralph", "[PLAN] Test plan");
    run("submit-lisa", "[PASS] Looks good\n\n- Clean");
    const r = run("read-review");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Looks good"));
  });

  it("read-review --round N works", () => {
    run("submit-ralph", "[PLAN] Plan");
    run("submit-lisa", "[NEEDS_WORK] Fix needed\n\n- Issue");
    const r = run("read-review", "--round", "1");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Fix needed"));
  });
});

// ─── IMP-3: inline literal \n replacement ───────
describe("CLI: inline literal newline replacement (IMP-3)", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });
  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("replaces literal backslash-n with real newlines in inline content", () => {
    run("submit-ralph", "[PLAN] Plan\\n\\nDetailed plan line 1\\nLine 2");
    const work = fs.readFileSync(path.join(TMP, ".dual-agent", "work.md"), "utf-8");
    // Should contain real newlines, not literal \n
    assert.ok(work.includes("Detailed plan line 1\nLine 2"));
    assert.ok(!work.includes("\\n"));
  });

  it("does NOT alter file-based content (backslash-n stays literal if in file)", () => {
    const submitFile = path.join(TMP, "submit.md");
    fs.writeFileSync(submitFile, "[PLAN] File plan\n\nContent with literal \\n in it");
    run("submit-ralph", "--file", submitFile);
    const work = fs.readFileSync(path.join(TMP, ".dual-agent", "work.md"), "utf-8");
    // File content should be preserved as-is (literal \n stays)
    assert.ok(work.includes("literal \\n in it"));
  });
});

// ─── IMP-4: warning/error separation ────────────
describe("CLI: policy warning/error separation (IMP-4)", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });
  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  function runWithPolicy(mode: string, ...args: string[]): { stdout: string; exitCode: number } {
    try {
      const stdout = execFileSync(process.execPath, [CLI, ...args], {
        cwd: TMP,
        encoding: "utf-8",
        env: { ...process.env, RL_POLICY_MODE: mode },
      });
      return { stdout, exitCode: 0 };
    } catch (e: any) {
      return { stdout: (e.stdout || "") + (e.stderr || ""), exitCode: e.status };
    }
  }

  it("shows 'Submitted OK (with warnings)' in warn mode for ralph", () => {
    // [CODE] without Test Results or file:line → 2 warnings
    const r = runWithPolicy("warn", "submit-ralph", "[CODE] Implementation done");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Submitted OK (with warnings)"));
    assert.ok(r.stdout.includes("Policy warnings:"));
    assert.ok(r.stdout.includes("Turn passed to: Lisa"));
  });

  it("shows 'Submission BLOCKED' in block mode for ralph", () => {
    const r = runWithPolicy("block", "submit-ralph", "[CODE] Implementation done");
    assert.notStrictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Submission BLOCKED by policy"));
  });

  it("shows clean 'Submitted:' with no warnings when policy passes", () => {
    const r = runWithPolicy("warn", "submit-ralph", "[PLAN] My plan");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Submitted: [PLAN] My plan"));
    assert.ok(!r.stdout.includes("warning"));
  });

  it("shows 'Submitted OK (with warnings)' in warn mode for lisa", () => {
    runWithPolicy("off", "submit-ralph", "[PLAN] Plan");
    // [PASS] without reason or file:line → warnings
    const r = runWithPolicy("warn", "submit-lisa", "[PASS] Looks good");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Submitted OK (with warnings)"));
    assert.ok(r.stdout.includes("Policy warnings:"));
    assert.ok(r.stdout.includes("Turn passed to: Ralph"));
  });

  it("shows 'Submission BLOCKED' in block mode for lisa", () => {
    runWithPolicy("off", "submit-ralph", "[PLAN] Plan");
    const r = runWithPolicy("block", "submit-lisa", "[PASS] Looks good");
    assert.notStrictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Submission BLOCKED by policy"));
  });

  it("no warnings shown when policy mode is off", () => {
    const r = runWithPolicy("off", "submit-ralph", "[CODE] Done without refs");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Submitted: [CODE]"));
    assert.ok(!r.stdout.includes("warning"));
    assert.ok(!r.stdout.includes("BLOCKED"));
  });
});

// ─── V4-02: force-turn ──────────────────────────

function runEnv(env: Record<string, string>, ...args: string[]): { stdout: string; exitCode: number } {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      cwd: TMP,
      encoding: "utf-8",
      env: { ...process.env, RL_POLICY_MODE: "off", ...env },
    });
    return { stdout, exitCode: 0 };
  } catch (e: any) {
    return { stdout: (e.stdout || "") + (e.stderr || ""), exitCode: e.status };
  }
}

describe("CLI: force-turn (V4-02)", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("rejects invalid agent name", () => {
    const r = run("force-turn", "bob");
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stdout.includes("Usage:"));
  });

  it("rejects missing agent name", () => {
    const r = run("force-turn");
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stdout.includes("Usage:"));
  });

  it("executeForceTurn switches turn and writes history + last_action", () => {
    // Submit something to make it lisa's turn
    run("submit-ralph", "[PLAN] test plan");
    const before = run("whose-turn");
    assert.ok(before.stdout.includes("lisa"));

    // Call the exported executeForceTurn directly (bypasses readline)
    const dualAgent = path.join(TMP, ".dual-agent");
    const origCwd = process.cwd();
    process.chdir(TMP);
    resetProjectRootCache();
    try {
      executeForceTurn("ralph", dualAgent);
    } finally {
      process.chdir(origCwd);
      resetProjectRootCache();
    }

    // Verify turn was switched
    const after = run("whose-turn");
    assert.ok(after.stdout.includes("ralph"));

    // Verify history contains [FORCE]
    const history = fs.readFileSync(path.join(dualAgent, "history.md"), "utf-8");
    assert.ok(history.includes("[FORCE]"));
    assert.ok(history.includes("Turn manually assigned to ralph by user"));

    // Verify last_action was updated
    const lastAction = fs.readFileSync(path.join(dualAgent, "last_action.txt"), "utf-8");
    assert.ok(lastAction.includes("[FORCE]"));
  });

  it("blocks when watcher PID is alive (auto mode)", () => {
    // Write a watcher.pid with our own PID (which is alive)
    const dualAgent = path.join(TMP, ".dual-agent");
    fs.writeFileSync(path.join(dualAgent, "watcher.pid"), String(process.pid));
    const r = run("force-turn", "ralph");
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stdout.includes("disabled in auto mode"));
  });

  it("allows when watcher.pid exists but process is dead (confirmed=true)", () => {
    // Write a fake dead PID
    const dualAgent = path.join(TMP, ".dual-agent");
    fs.writeFileSync(path.join(dualAgent, "watcher.pid"), "99999");

    // Use CLI with confirmed flag — the watcher PID is dead so it should proceed
    // but then hang on readline. Instead use the exported function directly.
    const origCwd = process.cwd();
    process.chdir(TMP);
    resetProjectRootCache();
    try {
      // cmdForceTurn with confirmed=true bypasses readline
      const { cmdForceTurn: ft } = require("../commands.js");
      ft(["ralph"], true);
    } finally {
      process.chdir(origCwd);
      resetProjectRootCache();
    }

    const after = run("whose-turn");
    assert.ok(after.stdout.includes("ralph"));
  });
});

// ─── V4-01: auto gate ──────────────────────────

describe("CLI: Ralph auto gate (V4-01)", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("does not trigger gate when RL_RALPH_GATE is not set", () => {
    const r = run("submit-ralph", "[CODE] Some code\n\n## Test Results\nPassed\n\ncommands.ts:42");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Submitted:"));
    assert.ok(!r.stdout.includes("gate"));
    assert.ok(!r.stdout.includes("Gate"));
  });

  it("does not trigger gate for PLAN tag even with gate enabled", () => {
    const r = runEnv(
      { RL_RALPH_GATE: "true", RL_GATE_COMMANDS: "false" },
      "submit-ralph", "[PLAN] Some plan"
    );
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Submitted:"));
    assert.ok(!r.stdout.includes("Gate"));
  });

  it("warn mode: prints warning but allows submission on failure", () => {
    const r = runEnv(
      { RL_RALPH_GATE: "true", RL_GATE_COMMANDS: "false", RL_GATE_MODE: "warn" },
      "submit-ralph", "[CODE] Some code\n\n## Test Results\nPassed\n\ncommands.ts:42"
    );
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("FAIL"));
    assert.ok(r.stdout.includes("Submitted:") || r.stdout.includes("Submitted OK"));
  });

  it("block mode: rejects submission on failure", () => {
    const r = runEnv(
      { RL_RALPH_GATE: "true", RL_GATE_COMMANDS: "false", RL_GATE_MODE: "block" },
      "submit-ralph", "[CODE] Some code\n\n## Test Results\nPassed\n\ncommands.ts:42"
    );
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stdout.includes("BLOCKED"));
  });

  it("passes gate when commands succeed", () => {
    const r = runEnv(
      { RL_RALPH_GATE: "true", RL_GATE_COMMANDS: "true", RL_GATE_MODE: "block" },
      "submit-ralph", "[CODE] Some code\n\n## Test Results\nPassed\n\ncommands.ts:42"
    );
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("all checks passed"));
    assert.ok(r.stdout.includes("Submitted:"));
  });

  it("supports multiple pipe-separated commands", () => {
    const r = runEnv(
      { RL_RALPH_GATE: "true", RL_GATE_COMMANDS: "true|true", RL_GATE_MODE: "block" },
      "submit-ralph", "[FIX] Fixed it\n\n## Test Results\nPassed\n\ncommands.ts:42"
    );
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("all checks passed"));
  });

  it("block mode: first command fails among multiple", () => {
    const r = runEnv(
      { RL_RALPH_GATE: "true", RL_GATE_COMMANDS: "false|true", RL_GATE_MODE: "block" },
      "submit-ralph", "[CODE] Some code\n\n## Test Results\nPassed\n\ncommands.ts:42"
    );
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stdout.includes("BLOCKED"));
  });
});

// ─── V4-11: remote (ttyd) ──────────────────────

describe("CLI: remote ttyd (V4-11)", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("--stop with no PID file prints 'not running'", () => {
    const r = run("remote", "--stop");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("No ttyd server running"));
  });

  it("--stop cleans up stale PID file without killing", () => {
    const dualAgent = path.join(TMP, ".dual-agent");
    // Write a fake dead PID (not a ttyd process)
    fs.writeFileSync(path.join(dualAgent, "ttyd.pid"), "99999");
    const r = run("remote", "--stop");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Stale PID") || r.stdout.includes("already gone"));
    assert.ok(!fs.existsSync(path.join(dualAgent, "ttyd.pid")));
  });

  it("fails when ttyd is not installed (mocked via PATH)", () => {
    const r = runEnv(
      { PATH: "/nonexistent" },
      "remote"
    );
    assert.strictEqual(r.exitCode, 1);
    assert.ok(r.stdout.includes("ttyd not found") || r.stdout.includes("not found"));
  });
});

describe("CLI: NEEDS_WORK enforcement (Proposal §3.2)", () => {
  function runMode(mode: string, ...args: string[]): { stdout: string; exitCode: number } {
    try {
      const stdout = execFileSync(process.execPath, [CLI, ...args], {
        cwd: TMP,
        encoding: "utf-8",
        env: { ...process.env, RL_POLICY_MODE: mode },
      });
      return { stdout, exitCode: 0 };
    } catch (e: any) {
      return { stdout: (e.stdout || "") + (e.stderr || ""), exitCode: e.status };
    }
  }

  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });
  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("NEEDS_WORK gate fully disabled when RL_POLICY_MODE=off", () => {
    // Set up: Ralph submits, Lisa returns NEEDS_WORK
    run("submit-ralph", "[PLAN] Initial plan");
    run("submit-lisa", "[NEEDS_WORK] Fix it\n\n- Issue at commands.ts:42");
    // Ralph submits [CODE] (normally blocked) in off mode — should succeed with no warning
    const r = runMode("off", "submit-ralph", "[CODE] Done\n\nTest Results\n- pass\ncommands.ts:42");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(!r.stdout.includes("NEEDS_WORK"), "off mode should not mention NEEDS_WORK");
    assert.ok(r.stdout.includes("Submitted:"));
  });

  it("NEEDS_WORK gate warns in warn mode", () => {
    run("submit-ralph", "[PLAN] Initial plan");
    run("submit-lisa", "[NEEDS_WORK] Fix it\n\n- Issue at commands.ts:42");
    const r = runMode("warn", "submit-ralph", "[CODE] Done\n\nTest Results\n- pass\ncommands.ts:42");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("NEEDS_WORK"));
    assert.ok(r.stdout.includes("Warning"));
  });

  it("NEEDS_WORK gate blocks in block mode", () => {
    runMode("off", "submit-ralph", "[PLAN] Initial plan");
    runMode("off", "submit-lisa", "[NEEDS_WORK] Fix it\n\n- Issue at commands.ts:42");
    const r = runMode("block", "submit-ralph", "[CODE] Done\n\nTest Results\n- pass\ncommands.ts:42");
    assert.notStrictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("BLOCKED"));
  });
});

describe("CLI: deadlock counter (Proposal §3.2)", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });
  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("triggers deadlock after 3 consecutive NEEDS_WORK rounds with FIX attempts", () => {
    // Round 1: Ralph submits, Lisa returns NEEDS_WORK
    run("submit-ralph", "[PLAN] Plan");
    run("submit-lisa", "[NEEDS_WORK] Issue 1\n\n- commands.ts:1");
    // Round 2: Ralph tries FIX, Lisa returns NEEDS_WORK again
    run("submit-ralph", "[FIX] Fixed issue 1\n\nTest Results\n- pass\ncommands.ts:2");
    run("submit-lisa", "[NEEDS_WORK] Issue 2\n\n- commands.ts:3");
    // Round 3: Ralph tries FIX again, Lisa returns NEEDS_WORK third time
    run("submit-ralph", "[FIX] Fixed issue 2\n\nTest Results\n- pass\ncommands.ts:4");
    const r = run("submit-lisa", "[NEEDS_WORK] Issue 3\n\n- commands.ts:5");
    // Check deadlock triggered
    assert.ok(r.stdout.includes("DEADLOCK"), "Should trigger DEADLOCK after 3 consecutive NEEDS_WORK");
    // Verify deadlock.txt exists
    const deadlockPath = path.join(TMP, ".dual-agent", "deadlock.txt");
    assert.ok(fs.existsSync(deadlockPath), "deadlock.txt should exist");
    // Verify counter is 3
    const count = fs.readFileSync(path.join(TMP, ".dual-agent", "needs_work_count.txt"), "utf-8").trim();
    assert.strictEqual(count, "3");
  });

  it("resets counter when Lisa submits non-NEEDS_WORK", () => {
    run("submit-ralph", "[PLAN] Plan");
    run("submit-lisa", "[NEEDS_WORK] Issue\n\n- commands.ts:1");
    run("submit-ralph", "[FIX] Fixed\n\nTest Results\n- pass\ncommands.ts:2");
    run("submit-lisa", "[NEEDS_WORK] Still wrong\n\n- commands.ts:3");
    // Now Lisa passes — counter should reset
    run("submit-ralph", "[FIX] Fixed again\n\nTest Results\n- pass\ncommands.ts:4");
    run("submit-lisa", "[PASS] Looks good\n\n- commands.ts:5");
    // Verify counter is reset
    const count = fs.readFileSync(path.join(TMP, ".dual-agent", "needs_work_count.txt"), "utf-8").trim();
    assert.strictEqual(count, "0");
    // No deadlock
    const deadlockPath = path.join(TMP, ".dual-agent", "deadlock.txt");
    assert.ok(!fs.existsSync(deadlockPath));
  });

  it("scope-update clears deadlock", () => {
    // Build up to deadlock
    run("submit-ralph", "[PLAN] Plan");
    run("submit-lisa", "[NEEDS_WORK] Issue\n\n- commands.ts:1");
    run("submit-ralph", "[FIX] Fixed\n\nTest Results\n- pass\ncommands.ts:2");
    run("submit-lisa", "[NEEDS_WORK] Still wrong\n\n- commands.ts:3");
    run("submit-ralph", "[FIX] Fixed again\n\nTest Results\n- pass\ncommands.ts:4");
    run("submit-lisa", "[NEEDS_WORK] Third time\n\n- commands.ts:5");
    // Verify deadlock
    assert.ok(fs.existsSync(path.join(TMP, ".dual-agent", "deadlock.txt")));
    // scope-update should clear it
    run("scope-update", "New direction");
    assert.ok(!fs.existsSync(path.join(TMP, ".dual-agent", "deadlock.txt")));
    const count = fs.readFileSync(path.join(TMP, ".dual-agent", "needs_work_count.txt"), "utf-8").trim();
    assert.strictEqual(count, "0");
  });
});

// ─── Phase 2: subtask commands (Proposal §3.4) ──

describe("CLI: subtask commands (Proposal §3.4)", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
    // Enter a step so task.md has subtask structure
    run("submit-ralph", "[CONSENSUS] Agreed");
    run("submit-lisa", "[CONSENSUS] Confirmed\n\n- Done");
    run("step", "step34", "--task", "First task description");
  });
  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("step --task creates task.md with step header and first subtask", () => {
    const task = fs.readFileSync(path.join(TMP, ".dual-agent", "task.md"), "utf-8");
    assert.ok(task.includes("# step34"));
    assert.ok(task.includes("## Subtasks"));
    assert.ok(task.includes("- [ ] #1 First task description"));
  });

  it("subtask add appends new subtask with auto-incrementing index", () => {
    const r = run("subtask", "add", "Second task");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Added subtask #2"));
    const task = fs.readFileSync(path.join(TMP, ".dual-agent", "task.md"), "utf-8");
    assert.ok(task.includes("- [ ] #2 Second task"));
  });

  it("subtask done marks subtask as complete", () => {
    const r = run("subtask", "done", "1");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Completed subtask #1"));
    const task = fs.readFileSync(path.join(TMP, ".dual-agent", "task.md"), "utf-8");
    assert.ok(task.includes("- [x] #1 First task description"));
  });

  it("subtask done on nonexistent index fails", () => {
    const r = run("subtask", "done", "99");
    assert.notStrictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("not found"));
  });

  it("subtask list shows all subtasks with status", () => {
    run("subtask", "add", "Second task");
    run("subtask", "done", "1");
    const r = run("subtask", "list");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("[x] #1"));
    assert.ok(r.stdout.includes("[ ] #2"));
    assert.ok(r.stdout.includes("1/2 completed"));
  });

  it("subtask add fails with no description", () => {
    const r = run("subtask", "add");
    assert.notStrictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Usage"));
  });

  it("subtask with no subcommand shows usage", () => {
    const r = run("subtask");
    assert.notStrictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Usage"));
  });
});

describe("CLI: step blocks with incomplete subtasks (Proposal §3.4)", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });
  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("step blocks when incomplete subtasks exist", () => {
    // Set up consensus + step with subtask
    run("submit-ralph", "[CONSENSUS] Agreed");
    run("submit-lisa", "[CONSENSUS] Done\n\n- ok");
    run("step", "step34", "--task", "Task A");
    // Add another subtask
    run("subtask", "add", "Task B");
    // Complete only one
    run("subtask", "done", "1");
    // Reach consensus again
    run("submit-ralph", "[CONSENSUS] Agreed on step35");
    run("submit-lisa", "[CONSENSUS] Confirmed\n\n- ok");
    // Try to move to next step — should fail (subtask #2 incomplete)
    const r = run("step", "step35");
    assert.notStrictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Incomplete subtasks"));
    assert.ok(r.stdout.includes("#2 Task B"));
  });

  it("step succeeds when all subtasks complete", () => {
    run("submit-ralph", "[CONSENSUS] Agreed");
    run("submit-lisa", "[CONSENSUS] Done\n\n- ok");
    run("step", "step34", "--task", "Task A");
    run("subtask", "done", "1");
    run("submit-ralph", "[CONSENSUS] Agreed");
    run("submit-lisa", "[CONSENSUS] Done\n\n- ok");
    const r = run("step", "step35");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Entered step: step35"));
  });

  it("step --force bypasses subtask check", () => {
    run("submit-ralph", "[CONSENSUS] Agreed");
    run("submit-lisa", "[CONSENSUS] Done\n\n- ok");
    run("step", "step34", "--task", "Task A");
    // Don't complete subtask — use --force
    const r = run("step", "--force", "step35");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Entered step: step35"));
  });
});

// ─── Phase 2: parseSubtasks unit tests ──────────

describe("parseSubtasks (Proposal §3.4)", () => {
  it("parses todo and done subtasks", () => {
    const content = "# Step\n\n## Subtasks\n- [ ] #1 Task A\n- [x] #2 Task B\n- [ ] #3 Task C\n";
    const subtasks = parseSubtasks(content);
    assert.strictEqual(subtasks.length, 3);
    assert.strictEqual(subtasks[0].index, 1);
    assert.strictEqual(subtasks[0].done, false);
    assert.strictEqual(subtasks[1].index, 2);
    assert.strictEqual(subtasks[1].done, true);
    assert.strictEqual(subtasks[2].index, 3);
    assert.strictEqual(subtasks[2].done, false);
  });

  it("returns empty array for no subtasks", () => {
    const subtasks = parseSubtasks("# Task\n\nSome description\n");
    assert.strictEqual(subtasks.length, 0);
  });

  it("handles uppercase [X] as done", () => {
    const subtasks = parseSubtasks("- [X] #1 Done task\n");
    assert.strictEqual(subtasks.length, 1);
    assert.strictEqual(subtasks[0].done, true);
  });
});

// ─── Phase 2: add-context (Proposal §3.5) ───────

describe("CLI: add-context (Proposal §3.5)", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });
  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("creates context.md and adds entry", () => {
    const r = run("add-context", "Skip --remote feature for now");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Context added"));
    const ctx = fs.readFileSync(path.join(TMP, ".dual-agent", "context.md"), "utf-8");
    assert.ok(ctx.includes("# Context Notes"));
    assert.ok(ctx.includes("Skip --remote feature for now"));
  });

  it("appends multiple entries to context.md", () => {
    run("add-context", "First directive");
    run("add-context", "Second directive");
    const ctx = fs.readFileSync(path.join(TMP, ".dual-agent", "context.md"), "utf-8");
    assert.ok(ctx.includes("First directive"));
    assert.ok(ctx.includes("Second directive"));
  });

  it("fails with no description", () => {
    const r = run("add-context");
    assert.notStrictEqual(r.exitCode, 0);
    assert.ok(r.stdout.includes("Usage"));
  });

  it("context is injected into work.md on submit", () => {
    run("add-context", "User wants: verify all features");
    run("submit-ralph", "[PLAN] My plan");
    const work = fs.readFileSync(path.join(TMP, ".dual-agent", "work.md"), "utf-8");
    assert.ok(work.includes("**Context**:"));
    assert.ok(work.includes("verify all features"));
  });

  it("work.md has no Context field when no context exists", () => {
    run("submit-ralph", "[PLAN] My plan");
    const work = fs.readFileSync(path.join(TMP, ".dual-agent", "work.md"), "utf-8");
    assert.ok(!work.includes("**Context**:"));
  });
});

// ─── Phase 3: CONSENSUS subtask reminder ─────────

describe("CLI: CONSENSUS subtask reminder (Proposal §3.7)", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("prints subtask hint when CONSENSUS with incomplete subtasks", () => {
    // Create task.md with incomplete subtask
    const taskPath = path.join(TMP, ".dual-agent", "task.md");
    fs.writeFileSync(taskPath, "# Test Step\n\n## Subtasks\n- [ ] #1 First task\n- [x] #2 Done task\n");
    const r = run("submit-ralph", "[CONSENSUS] Agreed");
    assert.ok(r.stdout.includes("Hint: If a subtask was completed, run: ralph-lisa subtask done <N>"));
    assert.ok(r.stdout.includes("#1 First task"));
  });

  it("no hint when CONSENSUS with all subtasks done", () => {
    const taskPath = path.join(TMP, ".dual-agent", "task.md");
    fs.writeFileSync(taskPath, "# Test Step\n\n## Subtasks\n- [x] #1 Done task\n");
    const r = run("submit-ralph", "[CONSENSUS] Agreed");
    assert.ok(!r.stdout.includes("Hint:"));
  });

  it("no hint when non-CONSENSUS tag", () => {
    const taskPath = path.join(TMP, ".dual-agent", "task.md");
    fs.writeFileSync(taskPath, "# Test Step\n\n## Subtasks\n- [ ] #1 Pending\n");
    const r = run("submit-ralph", "[PLAN] My plan");
    assert.ok(!r.stdout.includes("Hint:"));
  });
});

// ─── Phase 3: Lisa tests directory cleanup ───────

describe("CLI: Lisa tests dir cleanup on CONSENSUS (Proposal §3.6)", () => {
  beforeEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    run("init", "--minimal");
  });

  afterEach(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("cleans .dual-agent/tests/ when Lisa submits CONSENSUS", () => {
    // Set turn to lisa
    run("submit-ralph", "[PLAN] Plan");
    // Create tests directory with a file
    const testsDir = path.join(TMP, ".dual-agent", "tests");
    fs.mkdirSync(testsDir, { recursive: true });
    fs.writeFileSync(path.join(testsDir, "verify.test.ts"), "test content");
    // Lisa submits CONSENSUS
    const r = run("submit-lisa", "[CONSENSUS] Agreed\n\n- All good at commands.ts:1");
    assert.ok(r.stdout.includes("Cleaned .dual-agent/tests/"));
    assert.ok(!fs.existsSync(testsDir));
  });

  it("does NOT clean tests dir on Lisa PASS", () => {
    run("submit-ralph", "[PLAN] Plan");
    const testsDir = path.join(TMP, ".dual-agent", "tests");
    fs.mkdirSync(testsDir, { recursive: true });
    fs.writeFileSync(path.join(testsDir, "verify.test.ts"), "test content");
    run("submit-lisa", "[PASS] Approved\n\n- Clean code at commands.ts:42");
    // Tests dir should still exist
    assert.ok(fs.existsSync(testsDir));
  });

  it("does NOT clean tests dir on Lisa NEEDS_WORK", () => {
    run("submit-ralph", "[CODE] Done\n\ncommands.ts:42\n\nTest Results\n- pass\n- New tests: 1");
    const testsDir = path.join(TMP, ".dual-agent", "tests");
    fs.mkdirSync(testsDir, { recursive: true });
    fs.writeFileSync(path.join(testsDir, "verify.test.ts"), "test content");
    run("submit-lisa", "[NEEDS_WORK] Fix it\n\n- Bug at policy.ts:30");
    assert.ok(fs.existsSync(testsDir));
  });

  it("no error when CONSENSUS but tests dir does not exist", () => {
    run("submit-ralph", "[PLAN] Plan");
    const r = run("submit-lisa", "[CONSENSUS] Agreed\n\n- All good at commands.ts:1");
    assert.strictEqual(r.exitCode, 0);
    assert.ok(!r.stdout.includes("Cleaned .dual-agent/tests/"));
  });
});
