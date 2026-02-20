import { describe, it, beforeEach, afterEach } from "node:test";
import * as assert from "node:assert";
import { checkRalph, checkLisa, runPolicyCheck, checkNeedsWorkResponse } from "../policy.js";

describe("checkRalph", () => {
  it("warns when CODE missing Test Results and file:line", () => {
    const violations = checkRalph("CODE", "[CODE] Done\n\nImplemented it.");
    assert.strictEqual(violations.length, 2);
    assert.ok(violations.some((v) => v.rule === "test-results"));
    assert.ok(violations.some((v) => v.rule === "file-line-ref"));
  });

  it("passes when CODE includes Test Results and file:line", () => {
    const violations = checkRalph(
      "CODE",
      "[CODE] Done\n\nchanges in commands.ts:42\n\nTest Results\n- Passed"
    );
    assert.strictEqual(violations.length, 0);
  });

  it("warns when CODE has Test Results but no file:line", () => {
    const violations = checkRalph(
      "CODE",
      "[CODE] Done\n\nTest Results\n- Passed"
    );
    assert.strictEqual(violations.length, 1);
    assert.strictEqual(violations[0].rule, "file-line-ref");
  });

  it("warns when CODE has file:line but no Test Results", () => {
    const violations = checkRalph(
      "CODE",
      "[CODE] Done\n\nChanged commands.ts:42"
    );
    assert.strictEqual(violations.length, 1);
    assert.strictEqual(violations[0].rule, "test-results");
  });

  it("warns when FIX missing Test Results", () => {
    const violations = checkRalph("FIX", "[FIX] Fixed\n\nChanged code.");
    assert.ok(violations.some((v) => v.rule === "test-results"));
  });

  it("no warnings for PLAN", () => {
    const violations = checkRalph("PLAN", "[PLAN] Plan\n\nDetails");
    assert.strictEqual(violations.length, 0);
  });

  it("warns when RESEARCH has no substance", () => {
    const violations = checkRalph("RESEARCH", "[RESEARCH] Done");
    assert.ok(violations.length >= 1);
    assert.ok(violations.some((v) => v.rule === "research-content"));
    assert.ok(violations.some((v) => v.rule === "research-verification"));
  });

  it("passes RESEARCH with 2+ English fields and verification marker", () => {
    const violations = checkRalph(
      "RESEARCH",
      "[RESEARCH] Done\n\nReference implementation: file.ts\nKey types: MyType\nVerified: tested against running instance"
    );
    assert.strictEqual(violations.length, 0);
  });

  it("passes RESEARCH with exactly 2 fields and Evidence marker", () => {
    const violations = checkRalph(
      "RESEARCH",
      "[RESEARCH] Done\n\nReference: file.ts\nVerification: curl tested\nEvidence: HTTP 200 response with correct shape"
    );
    assert.strictEqual(violations.length, 0);
  });

  it("passes RESEARCH with data format + verification fields", () => {
    const violations = checkRalph(
      "RESEARCH",
      "[RESEARCH] Done\n\nData structure: { id: string }\nVerified: works"
    );
    assert.strictEqual(violations.length, 0);
  });

  it("warns RESEARCH with only 1 field and no verification marker", () => {
    const violations = checkRalph(
      "RESEARCH",
      "[RESEARCH] Done\n\nReference: file.ts"
    );
    assert.ok(violations.length >= 1);
    assert.ok(violations.some((v) => v.rule === "research-content") || violations.some((v) => v.rule === "research-verification"));
  });

  it("passes RESEARCH with substantial content and verification marker", () => {
    const violations = checkRalph(
      "RESEARCH",
      "[RESEARCH] API analysis\n\nLine 1\nLine 2\nLine 3\nEvidence: checked source code"
    );
    assert.strictEqual(violations.length, 0);
  });

  it("file:line not required for PLAN or RESEARCH", () => {
    const planV = checkRalph("PLAN", "[PLAN] Plan\n\nNo file refs here");
    assert.strictEqual(planV.length, 0);
  });
});

describe("checkLisa", () => {
  it("warns when PASS has no reason and no file:line", () => {
    const violations = checkLisa("PASS", "[PASS] Looks good");
    assert.strictEqual(violations.length, 2);
    assert.ok(violations.some((v) => v.rule === "reason-required"));
    assert.ok(violations.some((v) => v.rule === "file-line-ref"));
  });

  it("passes when PASS has reason and file:line", () => {
    const violations = checkLisa(
      "PASS",
      "[PASS] Looks good\n\n- Clean code at commands.ts:42\n- Tests pass"
    );
    assert.strictEqual(violations.length, 0);
  });

  it("warns when PASS has reason but no file:line", () => {
    const violations = checkLisa(
      "PASS",
      "[PASS] Looks good\n\n- Clean code\n- Tests pass"
    );
    assert.strictEqual(violations.length, 1);
    assert.strictEqual(violations[0].rule, "file-line-ref");
  });

  it("warns when NEEDS_WORK has no reason", () => {
    const violations = checkLisa("NEEDS_WORK", "[NEEDS_WORK] Fix it");
    assert.ok(violations.some((v) => v.rule === "reason-required"));
  });

  it("passes NEEDS_WORK with reason and file:line", () => {
    const violations = checkLisa(
      "NEEDS_WORK",
      "[NEEDS_WORK] Fix it\n\n- Bug at policy.ts:30"
    );
    assert.strictEqual(violations.length, 0);
  });

  it("no warnings for DISCUSS", () => {
    const violations = checkLisa("DISCUSS", "[DISCUSS] About this");
    assert.strictEqual(violations.length, 0);
  });

  it("no file:line required for CONSENSUS", () => {
    const violations = checkLisa("CONSENSUS", "[CONSENSUS] Agreed");
    assert.strictEqual(violations.length, 0);
  });
});

describe("runPolicyCheck (IMP-4)", () => {
  const origMode = process.env.RL_POLICY_MODE;

  afterEach(() => {
    if (origMode !== undefined) {
      process.env.RL_POLICY_MODE = origMode;
    } else {
      delete process.env.RL_POLICY_MODE;
    }
  });

  it("returns proceed=true, violations=[] when mode is off", () => {
    process.env.RL_POLICY_MODE = "off";
    const result = runPolicyCheck("ralph", "CODE", "[CODE] Done");
    assert.strictEqual(result.proceed, true);
    assert.strictEqual(result.violations.length, 0);
  });

  it("returns proceed=true, violations=[] when no violations in warn mode", () => {
    process.env.RL_POLICY_MODE = "warn";
    const result = runPolicyCheck("ralph", "PLAN", "[PLAN] Plan");
    assert.strictEqual(result.proceed, true);
    assert.strictEqual(result.violations.length, 0);
  });

  it("returns proceed=true with violations in warn mode", () => {
    process.env.RL_POLICY_MODE = "warn";
    const result = runPolicyCheck("ralph", "CODE", "[CODE] Done");
    assert.strictEqual(result.proceed, true);
    assert.ok(result.violations.length > 0);
  });

  it("returns proceed=false with violations in block mode", () => {
    process.env.RL_POLICY_MODE = "block";
    const result = runPolicyCheck("ralph", "CODE", "[CODE] Done");
    assert.strictEqual(result.proceed, false);
    assert.ok(result.violations.length > 0);
  });

  it("returns proceed=true, violations=[] when no violations in block mode", () => {
    process.env.RL_POLICY_MODE = "block";
    const result = runPolicyCheck("ralph", "PLAN", "[PLAN] Plan details");
    assert.strictEqual(result.proceed, true);
    assert.strictEqual(result.violations.length, 0);
  });
});

describe("checkNeedsWorkResponse (Proposal §3.2)", () => {
  it("blocks [CODE] after NEEDS_WORK", () => {
    const v = checkNeedsWorkResponse("CODE", "NEEDS_WORK");
    assert.strictEqual(v.length, 1);
    assert.strictEqual(v[0].rule, "needs-work-response");
  });

  it("blocks [RESEARCH] after NEEDS_WORK", () => {
    const v = checkNeedsWorkResponse("RESEARCH", "NEEDS_WORK");
    assert.strictEqual(v.length, 1);
  });

  it("blocks [PLAN] after NEEDS_WORK", () => {
    const v = checkNeedsWorkResponse("PLAN", "NEEDS_WORK");
    assert.strictEqual(v.length, 1);
  });

  it("allows [FIX] after NEEDS_WORK", () => {
    const v = checkNeedsWorkResponse("FIX", "NEEDS_WORK");
    assert.strictEqual(v.length, 0);
  });

  it("allows [CHALLENGE] after NEEDS_WORK", () => {
    const v = checkNeedsWorkResponse("CHALLENGE", "NEEDS_WORK");
    assert.strictEqual(v.length, 0);
  });

  it("allows [DISCUSS] after NEEDS_WORK", () => {
    const v = checkNeedsWorkResponse("DISCUSS", "NEEDS_WORK");
    assert.strictEqual(v.length, 0);
  });

  it("allows [QUESTION] after NEEDS_WORK", () => {
    const v = checkNeedsWorkResponse("QUESTION", "NEEDS_WORK");
    assert.strictEqual(v.length, 0);
  });

  it("blocks [CONSENSUS] after NEEDS_WORK (cannot bypass unresolved feedback)", () => {
    const v = checkNeedsWorkResponse("CONSENSUS", "NEEDS_WORK");
    assert.strictEqual(v.length, 1);
    assert.strictEqual(v[0].rule, "needs-work-response");
  });

  it("no restriction when last Lisa tag is PASS", () => {
    const v = checkNeedsWorkResponse("CODE", "PASS");
    assert.strictEqual(v.length, 0);
  });

  it("no restriction when last Lisa tag is empty", () => {
    const v = checkNeedsWorkResponse("CODE", "");
    assert.strictEqual(v.length, 0);
  });
});

describe("checkRalph new-tests-required (Proposal §3.6)", () => {
  it("warns when New tests: 0 without justification", () => {
    const v = checkRalph(
      "CODE",
      "[CODE] Done\n\nchanges in commands.ts:42\n\nTest Results\n- Regression: pass\n- New tests: 0"
    );
    assert.ok(v.some((x) => x.rule === "new-tests-required"));
  });

  it("passes when New tests: 0 with valid justification", () => {
    const v = checkRalph(
      "CODE",
      "[CODE] Done\n\nchanges in commands.ts:42\n\nTest Results\n- Regression: pass\n- New tests: 0 (config-only change)"
    );
    assert.ok(!v.some((x) => x.rule === "new-tests-required"));
  });

  it("passes when New tests: 3", () => {
    const v = checkRalph(
      "CODE",
      "[CODE] Done\n\nchanges in commands.ts:42\n\nTest Results\n- Regression: pass\n- New tests: 3 added"
    );
    assert.ok(!v.some((x) => x.rule === "new-tests-required"));
  });

  it("no warning for PLAN submissions", () => {
    const v = checkRalph("PLAN", "[PLAN] Plan\n\nNew tests: 0");
    assert.ok(!v.some((x) => x.rule === "new-tests-required"));
  });
});

describe("checkRalph RESEARCH verification markers (Proposal §3.9)", () => {
  it("warns when RESEARCH has no Verified: or Evidence: marker", () => {
    const v = checkRalph(
      "RESEARCH",
      "[RESEARCH] API analysis\n\nReference: file.ts\nKey types: MyType\nData structure: {id: string}\nConfirmed by testing"
    );
    assert.ok(v.some((x) => x.rule === "research-verification"));
  });

  it("passes when RESEARCH has Verified: marker", () => {
    const v = checkRalph(
      "RESEARCH",
      "[RESEARCH] API analysis\n\nReference: file.ts\nKey types: MyType\nVerified: ran curl against endpoint, matches spec"
    );
    assert.ok(!v.some((x) => x.rule === "research-verification"));
  });

  it("passes when RESEARCH has Evidence: marker", () => {
    const v = checkRalph(
      "RESEARCH",
      "[RESEARCH] API analysis\n\nReference: file.ts\nKey types: MyType\nEvidence: output from npm test shows correct shape"
    );
    assert.ok(!v.some((x) => x.rule === "research-verification"));
  });

  it("passes with case-insensitive Verified:", () => {
    const v = checkRalph(
      "RESEARCH",
      "[RESEARCH] Done\n\nReference: file.ts\nverified: works\nData format: json"
    );
    assert.ok(!v.some((x) => x.rule === "research-verification"));
  });

  it("no verification warning for non-RESEARCH tags", () => {
    const v = checkRalph(
      "CODE",
      "[CODE] Done\n\nchanges in commands.ts:42\n\nTest Results\n- pass"
    );
    assert.ok(!v.some((x) => x.rule === "research-verification"));
  });
});
