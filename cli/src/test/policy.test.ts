import { describe, it } from "node:test";
import * as assert from "node:assert";
import { checkRalph, checkLisa } from "../policy.js";

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
    assert.strictEqual(violations.length, 1);
    assert.strictEqual(violations[0].rule, "research-content");
  });

  it("passes RESEARCH with 2+ English fields", () => {
    const violations = checkRalph(
      "RESEARCH",
      "[RESEARCH] Done\n\nReference implementation: file.ts\nKey types: MyType\nVerification: tested"
    );
    assert.strictEqual(violations.length, 0);
  });

  it("passes RESEARCH with exactly 2 fields", () => {
    const violations = checkRalph(
      "RESEARCH",
      "[RESEARCH] Done\n\nReference: file.ts\nVerification: curl tested"
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

  it("warns RESEARCH with only 1 field", () => {
    const violations = checkRalph(
      "RESEARCH",
      "[RESEARCH] Done\n\nReference: file.ts"
    );
    assert.strictEqual(violations.length, 1);
  });

  it("passes RESEARCH with substantial content (>3 lines) even without fields", () => {
    const violations = checkRalph(
      "RESEARCH",
      "[RESEARCH] API analysis\n\nLine 1\nLine 2\nLine 3\nLine 4"
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
