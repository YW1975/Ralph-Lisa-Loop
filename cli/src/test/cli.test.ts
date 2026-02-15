import { describe, it, beforeEach, afterEach } from "node:test";
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

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
