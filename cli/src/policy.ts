/**
 * Policy layer for Ralph-Lisa Loop.
 * Checks submissions for required content (warn or block mode).
 *
 * Modes (RL_POLICY_MODE env):
 *   warn  - print warnings, don't block (default)
 *   block - print warnings AND exit(1) if violations found
 *   off   - no checks
 */

export type PolicyMode = "off" | "warn" | "block";

export interface PolicyViolation {
  rule: string;
  message: string;
}

export function getPolicyMode(): PolicyMode {
  const mode = process.env.RL_POLICY_MODE || "warn";
  if (mode === "warn" || mode === "block" || mode === "off") return mode;
  return "warn";
}

/**
 * Check Ralph's submission for policy violations.
 */
export function checkRalph(
  tag: string,
  content: string
): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  // [CODE] or [FIX] must include Test Results and file:line references
  if (tag === "CODE" || tag === "FIX") {
    if (
      !content.includes("Test Results") &&
      !content.includes("test results") &&
      !content.includes("Test results")
    ) {
      violations.push({
        rule: "test-results",
        message: `[${tag}] submission missing "Test Results" section.`,
      });
    }
    if (!/\w+\.\w+:\d+/.test(content)) {
      violations.push({
        rule: "file-line-ref",
        message: `[${tag}] submission must include at least one file:line reference (e.g., commands.ts:42).`,
      });
    }
    // New tests count check (Proposal §3.6)
    // Warn if "New tests: 0" without valid justification
    const lc = content.toLowerCase();
    const hasNewTests = /new tests?:\s*[1-9]/i.test(content);
    const hasZeroTests = /new tests?:\s*0/i.test(content);
    if (hasZeroTests && !hasNewTests) {
      // Check for valid justification keywords
      const hasJustification = /\b(ui.only|layout.only|config.only|no.testable.logic|template.only|documentation)\b/i.test(content);
      if (!hasJustification) {
        violations.push({
          rule: "new-tests-required",
          message: `[${tag}] reports 0 new tests without valid justification. Add unit tests or explain why (e.g., "config-only change").`,
        });
      }
    }
  }

  // [RESEARCH] must have substance
  if (tag === "RESEARCH") {
    const fieldGroups: string[][] = [
      ["reference", "reference implementation"],
      ["key type", "key types"],
      ["data format", "data structure"],
      ["verification", "verified"],
    ];
    const lc = content.toLowerCase();
    const matchedFields = fieldGroups.filter((variants) =>
      variants.some((v) => lc.includes(v.toLowerCase()))
    ).length;
    const hasSubstantialContent = content.split("\n").length > 3;

    if (matchedFields < 2 && !hasSubstantialContent) {
      violations.push({
        rule: "research-content",
        message:
          "[RESEARCH] submission needs at least 2 fields (reference/key types/data structure/verification) or equivalent summary with evidence.",
      });
    }
  }

  return violations;
}

/**
 * Check Lisa's submission for policy violations.
 */
export function checkLisa(
  tag: string,
  content: string
): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  // [PASS] or [NEEDS_WORK] must include at least 1 reason and file:line references
  if (tag === "PASS" || tag === "NEEDS_WORK") {
    // Content after the first line (tag+summary) should have substance
    const lines = content.split("\n");
    const bodyLines = lines.slice(1).filter((l) => l.trim().length > 0);
    if (bodyLines.length === 0) {
      violations.push({
        rule: "reason-required",
        message: `[${tag}] submission must include at least 1 reason.`,
      });
    }
    if (!/\w+\.\w+:\d+/.test(content)) {
      violations.push({
        rule: "file-line-ref",
        message: `[${tag}] submission must include at least one file:line reference (e.g., commands.ts:42).`,
      });
    }
  }

  return violations;
}

/**
 * NEEDS_WORK response enforcement (Proposal §3.2).
 * When Lisa's last review was [NEEDS_WORK], Ralph must respond with
 * [FIX], [CHALLENGE], [DISCUSS], or [QUESTION] — not unrelated [CODE]/[RESEARCH]/[PLAN].
 */
const NEEDS_WORK_ALLOWED_TAGS = new Set(["FIX", "CHALLENGE", "DISCUSS", "QUESTION"]);
const NEEDS_WORK_BLOCKED_TAGS = new Set(["CODE", "RESEARCH", "PLAN", "CONSENSUS"]);

export function checkNeedsWorkResponse(
  ralphTag: string,
  lastLisaTag: string
): PolicyViolation[] {
  if (lastLisaTag !== "NEEDS_WORK") return [];
  if (NEEDS_WORK_ALLOWED_TAGS.has(ralphTag)) return [];
  if (NEEDS_WORK_BLOCKED_TAGS.has(ralphTag)) {
    return [{
      rule: "needs-work-response",
      message: `[${ralphTag}] submitted after Lisa's [NEEDS_WORK]. You must respond with [FIX], [CHALLENGE], [DISCUSS], or [QUESTION] first. If the task scope changed, run: ralph-lisa scope-update "new scope"`,
    }];
  }
  return [];
}

/**
 * Run policy checks based on mode.
 * Returns { proceed, violations } so callers can format output clearly (IMP-4).
 */
export function runPolicyCheck(
  role: "ralph" | "lisa",
  tag: string,
  content: string
): { proceed: boolean; violations: PolicyViolation[] } {
  const mode = getPolicyMode();
  if (mode === "off") return { proceed: true, violations: [] };

  const violations =
    role === "ralph" ? checkRalph(tag, content) : checkLisa(tag, content);

  if (violations.length === 0) return { proceed: true, violations: [] };

  if (mode === "block") {
    return { proceed: false, violations };
  }

  // warn mode: proceed but pass violations to caller
  return { proceed: true, violations };
}
