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
