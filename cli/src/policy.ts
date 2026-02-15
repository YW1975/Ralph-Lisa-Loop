/**
 * Policy layer for Ralph-Lisa Loop.
 * Checks submissions for required content (warn or block mode).
 *
 * Modes (RL_POLICY_MODE env):
 *   off   - no checks (default)
 *   warn  - print warnings, don't block
 *   block - print warnings AND exit(1) if violations found
 */

export type PolicyMode = "off" | "warn" | "block";

export interface PolicyViolation {
  rule: string;
  message: string;
}

export function getPolicyMode(): PolicyMode {
  const mode = process.env.RL_POLICY_MODE || "off";
  if (mode === "warn" || mode === "block" || mode === "off") return mode;
  return "off";
}

/**
 * Check Ralph's submission for policy violations.
 */
export function checkRalph(
  tag: string,
  content: string
): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  // [CODE] or [FIX] must include Test Results
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

  // [PASS] or [NEEDS_WORK] must include at least 1 reason
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
  }

  return violations;
}

/**
 * Run policy checks and handle output/exit based on mode.
 * Returns true if submission should proceed, false if blocked.
 */
export function runPolicyCheck(
  role: "ralph" | "lisa",
  tag: string,
  content: string
): boolean {
  const mode = getPolicyMode();
  if (mode === "off") return true;

  const violations =
    role === "ralph" ? checkRalph(tag, content) : checkLisa(tag, content);

  if (violations.length === 0) return true;

  console.error("");
  console.error("⚠️  Policy warnings:");
  for (const v of violations) {
    console.error(`  - ${v.message}`);
  }
  console.error("");

  if (mode === "block") {
    console.error("Policy mode is 'block'. Submission rejected.");
    return false;
  }

  // warn mode: print but continue
  return true;
}
