import { describe, it } from "node:test";
import * as assert from "node:assert";
import { checkRalph, checkLisa } from "../policy.js";

describe("checkRalph", () => {
  it("warns when CODE missing Test Results", () => {
    const violations = checkRalph("CODE", "[CODE] Done\n\nImplemented it.");
    assert.strictEqual(violations.length, 1);
    assert.strictEqual(violations[0].rule, "test-results");
  });

  it("passes when CODE includes Test Results", () => {
    const violations = checkRalph(
      "CODE",
      "[CODE] Done\n\nTest Results\n- Passed"
    );
    assert.strictEqual(violations.length, 0);
  });

  it("warns when FIX missing Test Results", () => {
    const violations = checkRalph("FIX", "[FIX] Fixed\n\nChanged code.");
    assert.strictEqual(violations.length, 1);
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
  it("warns when PASS has no reason", () => {
    const violations = checkLisa("PASS", "[PASS] Looks good");
    assert.strictEqual(violations.length, 1);
    assert.strictEqual(violations[0].rule, "reason-required");
  });

  it("passes when PASS has reason", () => {
    const violations = checkLisa(
      "PASS",
      "[PASS] Looks good\n\n- Clean code\n- Tests pass"
    );
    assert.strictEqual(violations.length, 0);
  });

  it("warns when NEEDS_WORK has no reason", () => {
    const violations = checkLisa("NEEDS_WORK", "[NEEDS_WORK] Fix it");
    assert.strictEqual(violations.length, 1);
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
