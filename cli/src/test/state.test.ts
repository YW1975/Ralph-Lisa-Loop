import { describe, it } from "node:test";
import * as assert from "node:assert";
import { extractTag, extractSummary, VALID_TAGS } from "../state.js";

describe("extractTag", () => {
  it("extracts known tags", () => {
    assert.strictEqual(extractTag("[PLAN] My plan"), "PLAN");
    assert.strictEqual(extractTag("[CODE] Implementation done"), "CODE");
    assert.strictEqual(extractTag("[RESEARCH] Results"), "RESEARCH");
    assert.strictEqual(extractTag("[CHALLENGE] I disagree"), "CHALLENGE");
    assert.strictEqual(extractTag("[PASS] Looks good"), "PASS");
    assert.strictEqual(extractTag("[NEEDS_WORK] Fix this"), "NEEDS_WORK");
    assert.strictEqual(extractTag("[DISCUSS] Let's talk"), "DISCUSS");
    assert.strictEqual(extractTag("[QUESTION] What about?"), "QUESTION");
    assert.strictEqual(extractTag("[CONSENSUS] Agreed"), "CONSENSUS");
    assert.strictEqual(extractTag("[FIX] Fixed the bug"), "FIX");
  });

  it("returns empty for invalid tags", () => {
    assert.strictEqual(extractTag("No tag here"), "");
    assert.strictEqual(extractTag("[INVALID] Nope"), "");
    assert.strictEqual(extractTag(""), "");
  });
});

describe("extractSummary", () => {
  it("extracts summary after tag", () => {
    assert.strictEqual(extractSummary("[PLAN] My plan"), "My plan");
    assert.strictEqual(
      extractSummary("[CODE] Implementation done"),
      "Implementation done"
    );
  });

  it("returns full line if no tag", () => {
    assert.strictEqual(extractSummary("No tag here"), "No tag here");
  });
});

describe("VALID_TAGS", () => {
  it("contains all expected tags", () => {
    const tags = VALID_TAGS.split("|");
    assert.ok(tags.includes("PLAN"));
    assert.ok(tags.includes("RESEARCH"));
    assert.ok(tags.includes("CODE"));
    assert.ok(tags.includes("FIX"));
    assert.ok(tags.includes("PASS"));
    assert.ok(tags.includes("NEEDS_WORK"));
    assert.ok(tags.includes("CHALLENGE"));
    assert.ok(tags.includes("DISCUSS"));
    assert.ok(tags.includes("QUESTION"));
    assert.ok(tags.includes("CONSENSUS"));
    assert.strictEqual(tags.length, 10);
  });
});
