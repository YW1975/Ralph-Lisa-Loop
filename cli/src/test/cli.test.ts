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
