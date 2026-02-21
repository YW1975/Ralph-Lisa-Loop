/**
 * CLI commands for Ralph-Lisa Loop.
 * Direct port of io.sh logic to Node/TS.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { execSync } from "node:child_process";
import {
  STATE_DIR,
  ARCHIVE_DIR,
  stateDir,
  findProjectRoot,
  resolveStateDir,
  getTmuxStateDir,
  checkSession,
  readFile,
  writeFile,
  getTurn,
  setTurn,
  getRound,
  setRound,
  getStep,
  setStep,
  extractTag,
  extractSummary,
  timestamp,
  appendHistory,
  updateLastAction,
} from "./state.js";
import { runPolicyCheck, checkRalph, checkLisa, checkNeedsWorkResponse } from "./policy.js";

function line(ch = "=", len = 40): string {
  return ch.repeat(len);
}

/**
 * Generate a project-specific tmux session name to avoid conflicts
 * when running multiple projects simultaneously.
 * Format: rll-{sanitized-dirname}-{short-hash}
 * tmux session names cannot contain '.' or ':'.
 */
export function generateSessionName(projectDir: string): string {
  const dirName = path.basename(projectDir);
  const hash = crypto.createHash("md5").update(projectDir).digest("hex").slice(0, 6);
  // Sanitize: keep alphanumeric and hyphens only, truncate to 20 chars
  const sanitized = dirName.replace(/[^a-zA-Z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 20);
  return `rll-${sanitized || "project"}-${hash}`;
}

/**
 * Resolve submission content from args, --file, or --stdin.
 * Returns content and whether it came from an external source (file/stdin).
 * External sources get compact history entries to reduce context bloat.
 */
function resolveContent(args: string[]): { content: string; external: boolean } {
  const fileIdx = args.indexOf("--file");
  if (fileIdx !== -1) {
    const filePath = args[fileIdx + 1];
    if (!filePath) {
      console.error("Error: --file requires a file path");
      process.exit(1);
    }
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }
    return { content: fs.readFileSync(filePath, "utf-8").trim(), external: true };
  }

  if (args.includes("--stdin")) {
    try {
      return { content: fs.readFileSync(0, "utf-8").trim(), external: true };
    } catch {
      console.error("Error: Failed to read from stdin");
      process.exit(1);
    }
  }

  // Replace literal \n sequences with real newlines (IMP-3: inline format fix)
  return { content: args.join(" ").replace(/\\n/g, "\n"), external: false };
}

/**
 * Get list of changed files via git diff.
 * Returns empty array if not in a git repo or git fails.
 */
function getFilesChanged(): string[] {
  try {
    const output = execSync("git diff --name-only HEAD 2>/dev/null || git diff --name-only", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (!output) return [];
    return output.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * V4-01: Ralph Auto Gate — run test/lint commands before CODE/FIX submission.
 * Config via env vars only (config file deferred to future version):
 *   RL_RALPH_GATE=true          — enable gate (default: false)
 *   RL_GATE_COMMANDS=cmd1|cmd2  — pipe-separated commands
 *   RL_GATE_MODE=warn|block     — warn (default) or block on failure
 * Gate results are NOT written to work.md (prevents Lisa anchoring).
 */
export function runGate(tag: string): void {
  if (tag !== "CODE" && tag !== "FIX") return;
  if (process.env.RL_RALPH_GATE !== "true") return;

  const commands = (process.env.RL_GATE_COMMANDS || "").split("|").filter(Boolean);
  if (commands.length === 0) return;

  const mode = process.env.RL_GATE_MODE === "block" ? "block" : "warn";
  const failures: Array<{ cmd: string; error: string }> = [];

  console.log("Running gate checks...");
  for (const cmd of commands) {
    try {
      execSync(cmd, { stdio: "pipe", timeout: 120000 });
      console.log(`  PASS  ${cmd}`);
    } catch (e: any) {
      const stderr = e.stderr ? e.stderr.toString().trim().split("\n").slice(-3).join("\n") : "exit code " + e.status;
      failures.push({ cmd, error: stderr });
      console.log(`  FAIL  ${cmd}`);
    }
  }

  if (failures.length === 0) {
    console.log("Gate: all checks passed.");
    console.log("");
    return;
  }

  console.log("");
  console.log(line());
  if (mode === "block") {
    console.error("Gate BLOCKED submission:");
    for (const f of failures) {
      console.error(`  - ${f.cmd}: ${f.error}`);
    }
    console.error(line());
    process.exit(1);
  } else {
    console.log("Gate warnings (submission proceeds):");
    for (const f of failures) {
      console.log(`  - ${f.cmd}: ${f.error}`);
    }
    console.log(line());
    console.log("");
  }
}

// ─── init ────────────────────────────────────────

export function cmdInit(args: string[]): void {
  const task = args.join(" ");
  if (!task) {
    console.error('Usage: ralph-lisa init "task description"');
    process.exit(1);
  }

  // Always create in CWD — init is a creation command, not a discovery command
  const dir = stateDir(process.cwd());
  if (fs.existsSync(dir)) {
    console.log("Warning: Existing session will be overwritten");
  }
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  const ts = timestamp();

  writeFile(
    path.join(dir, "task.md"),
    `# Task\n\n${task}\n\n---\nCreated: ${ts}\n`
  );
  writeFile(path.join(dir, "round.txt"), "1");
  writeFile(path.join(dir, "step.txt"), "planning");
  writeFile(path.join(dir, "turn.txt"), "ralph");
  writeFile(path.join(dir, "last_action.txt"), "(No action yet)");
  writeFile(
    path.join(dir, "plan.md"),
    "# Plan\n\n(To be drafted by Ralph and reviewed by Lisa)\n"
  );
  writeFile(
    path.join(dir, "work.md"),
    "# Ralph Work\n\n(Waiting for Ralph to submit)\n"
  );
  writeFile(
    path.join(dir, "review.md"),
    "# Lisa Review\n\n(Waiting for Lisa to respond)\n"
  );
  writeFile(
    path.join(dir, "history.md"),
    `# Collaboration History\n\n**Task**: ${task}\n**Started**: ${ts}\n`
  );

  console.log(line());
  console.log("Session Initialized");
  console.log(line());
  console.log(`Task: ${task}`);
  console.log("Turn: ralph");
  console.log("");
  console.log(
    "Ralph should start with: ralph-lisa submit-ralph --file .dual-agent/submit.md"
  );
  console.log(line());
}

// ─── whose-turn ──────────────────────────────────

export function cmdWhoseTurn(): void {
  checkSession();
  console.log(getTurn());
}

// ─── submit-ralph ────────────────────────────────

export function cmdSubmitRalph(args: string[]): void {
  checkSession();
  const { content, external } = resolveContent(args);
  if (!content) {
    console.error(
      "Usage: ralph-lisa submit-ralph --file <path>  (recommended)"
    );
    console.error("       echo content | ralph-lisa submit-ralph --stdin");
    console.error(
      '       ralph-lisa submit-ralph "[TAG] ..."     (deprecated, shell escaping issues)'
    );
    console.error("");
    console.error(
      "Valid tags: PLAN, RESEARCH, CODE, FIX, CHALLENGE, DISCUSS, QUESTION, CONSENSUS"
    );
    process.exit(1);
  }

  const turn = getTurn();
  if (turn !== "ralph") {
    console.error("Error: It's Lisa's turn. Wait for her response.");
    console.error("Run: ralph-lisa whose-turn");
    process.exit(1);
  }

  const tag = extractTag(content);
  if (!tag) {
    console.error("Error: Content must start with a valid tag.");
    console.error("Format: [TAG] One line summary");
    console.error("");
    console.error(
      "Valid tags: PLAN, RESEARCH, CODE, FIX, CHALLENGE, DISCUSS, QUESTION, CONSENSUS"
    );
    process.exit(1);
  }

  // Policy check (IMP-4: clear status/warning separation)
  const { proceed, violations } = runPolicyCheck("ralph", tag, content);
  if (!proceed) {
    console.error(line());
    console.error("Submission BLOCKED by policy:");
    for (const v of violations) {
      console.error(`  - ${v.message}`);
    }
    console.error(line());
    process.exit(1);
  }

  // NEEDS_WORK response enforcement (Proposal §3.2)
  const dir = stateDir();
  const reviewContent = readFile(path.join(dir, "review.md"));
  const lastLisaTag = extractLastTag(reviewContent);
  const { getPolicyMode } = require("./policy.js");
  const nwMode = getPolicyMode();
  if (nwMode !== "off") {
    const nwViolations = checkNeedsWorkResponse(tag, lastLisaTag);
    if (nwViolations.length > 0) {
      if (nwMode === "block") {
        console.error(line());
        console.error("Submission BLOCKED — must respond to NEEDS_WORK:");
        for (const v of nwViolations) {
          console.error(`  - ${v.message}`);
        }
        console.error(line());
        process.exit(1);
      } else {
        console.log(line());
        console.log("Warning — submitting after NEEDS_WORK without addressing it:");
        for (const v of nwViolations) {
          console.log(`  - ${v.message}`);
        }
        console.log(line());
        console.log("");
      }
      violations.push(...nwViolations);
    }
  }

  // V4-01: Auto gate — run test/lint before CODE/FIX submission
  runGate(tag);

  const round = getRound();
  const step = getStep();
  const ts = timestamp();
  const summary = extractSummary(content);

  // Auto-inject task context so Lisa always sees the task goal
  // Use last meaningful line (update-task appends new directions at the end)
  const taskFile = readFile(path.join(dir, "task.md"));
  const taskLines = taskFile.split("\n").filter((l) => l.trim() && !l.startsWith("#") && !l.startsWith("---") && !l.startsWith("Created:") && !l.startsWith("Updated:"));
  const taskContext = taskLines[taskLines.length - 1] || "";

  // Auto-attach files_changed for CODE/FIX submissions
  let filesChangedSection = "";
  if (tag === "CODE" || tag === "FIX") {
    const files = getFilesChanged();
    if (files.length > 0) {
      filesChangedSection = `**Files Changed**:\n${files.map((f) => `- ${f}`).join("\n")}\n\n`;
    }
  }

  // Auto-inject context.md so Lisa sees runtime directives (Proposal §3.5)
  let contextSection = "";
  const contextPath = path.join(dir, "context.md");
  if (fs.existsSync(contextPath)) {
    const ctxContent = readFile(contextPath);
    if (ctxContent && !ctxContent.includes("(visible to Lisa).\n\n\n")) {
      // Only inject if context has actual entries (not just the header)
      const ctxLines = ctxContent.split("\n").filter((l) => l.startsWith("- ["));
      if (ctxLines.length > 0) {
        contextSection = `**Context**: ${ctxLines.join("; ")}\n`;
      }
    }
  }

  const taskLine = taskContext ? `**Task**: ${taskContext}\n` : "";
  writeFile(
    path.join(dir, "work.md"),
    `# Ralph Work\n\n## [${tag}] Round ${round} | Step: ${step}\n${taskLine}${contextSection}**Updated**: ${ts}\n**Summary**: ${summary}\n${filesChangedSection ? "\n" + filesChangedSection : "\n"}${content}\n`
  );

  // External sources (--file/--stdin) get compact history to reduce context bloat
  const historyContent = external
    ? `[${tag}] ${summary}\n\n(Full content in work.md)`
    : content;
  appendHistory("Ralph", historyContent);
  updateLastAction("Ralph", content);
  setTurn("lisa");

  // CONSENSUS actions (Proposal §3.7 + §3.6)
  if (tag === "CONSENSUS") {
    // Clean .dual-agent/tests/ on Ralph CONSENSUS (covers single-round closure:
    // Lisa [PASS] + Ralph [CONSENSUS] — Lisa never submits [CONSENSUS] in this path)
    const testsDir = path.join(dir, "tests");
    if (fs.existsSync(testsDir)) {
      fs.rmSync(testsDir, { recursive: true, force: true });
      console.log("Cleaned .dual-agent/tests/ (topic closed)");
    }

    // Subtask reminder (explicit, not auto-mark)
    const taskContent = readFile(path.join(dir, "task.md"));
    const incomplete = parseSubtasks(taskContent).filter((s) => !s.done);
    if (incomplete.length > 0) {
      console.log("");
      console.log("Hint: If a subtask was completed, run: ralph-lisa subtask done <N>");
      for (const s of incomplete) {
        console.log(`  - [ ] #${s.index} ${s.text}`);
      }
    }
  }

  console.log(line());
  if (violations.length > 0) {
    console.log(`Submitted OK (with warnings): [${tag}] ${summary}`);
    console.log("");
    console.log("Policy warnings:");
    for (const v of violations) {
      console.log(`  - ${v.message}`);
    }
    console.log("");
  } else {
    console.log(`Submitted: [${tag}] ${summary}`);
  }
  console.log("Turn passed to: Lisa");
  console.log(line());
  console.log("");
  console.log("Now wait for Lisa. Check with: ralph-lisa whose-turn");
}

// ─── submit-lisa ─────────────────────────────────

export function cmdSubmitLisa(args: string[]): void {
  checkSession();
  const { content, external } = resolveContent(args);
  if (!content) {
    console.error(
      "Usage: ralph-lisa submit-lisa --file <path>  (recommended)"
    );
    console.error("       echo content | ralph-lisa submit-lisa --stdin");
    console.error(
      '       ralph-lisa submit-lisa "[TAG] ..."     (deprecated, shell escaping issues)'
    );
    console.error("");
    console.error(
      "Valid tags: PASS, NEEDS_WORK, CHALLENGE, DISCUSS, QUESTION, CONSENSUS"
    );
    process.exit(1);
  }

  const turn = getTurn();
  if (turn !== "lisa") {
    console.error("Error: It's Ralph's turn. Wait for his submission.");
    console.error("Run: ralph-lisa whose-turn");
    process.exit(1);
  }

  const tag = extractTag(content);
  if (!tag) {
    console.error("Error: Content must start with a valid tag.");
    console.error("Format: [TAG] One line summary");
    console.error("");
    console.error(
      "Valid tags: PASS, NEEDS_WORK, CHALLENGE, DISCUSS, QUESTION, CONSENSUS"
    );
    process.exit(1);
  }

  // Policy check (IMP-4: clear status/warning separation)
  const { proceed, violations } = runPolicyCheck("lisa", tag, content);
  if (!proceed) {
    console.error(line());
    console.error("Submission BLOCKED by policy:");
    for (const v of violations) {
      console.error(`  - ${v.message}`);
    }
    console.error(line());
    process.exit(1);
  }

  const round = getRound();
  const step = getStep();
  const ts = timestamp();
  const summary = extractSummary(content);
  const dir = stateDir();

  // Append new review entry, keep last 3
  const reviewPath = path.join(dir, "review.md");
  const newEntry = `## [${tag}] Round ${round} | Step: ${step}\n**Updated**: ${ts}\n**Summary**: ${summary}\n\n${content}`;
  const existing = readFile(reviewPath);
  // Split existing entries by separator, filter out header/empty
  const REVIEW_SEP = "\n\n---\n\n";
  let entries: string[] = [];
  if (existing && !existing.startsWith("# Lisa Review\n\n(Waiting")) {
    // Remove the "# Lisa Review" header if present
    const body = existing.replace(/^# Lisa Review\n\n/, "");
    entries = body.split(REVIEW_SEP).filter((e) => e.trim());
  }
  entries.push(newEntry);
  // Keep only last 3
  if (entries.length > 3) {
    entries = entries.slice(-3);
  }
  writeFile(reviewPath, `# Lisa Review\n\n${entries.join(REVIEW_SEP)}\n`);

  // External sources (--file/--stdin) get compact history to reduce context bloat
  const historyContent = external
    ? `[${tag}] ${summary}\n\n(Full content in review.md)`
    : content;
  appendHistory("Lisa", historyContent);
  updateLastAction("Lisa", content);
  setTurn("ralph");

  // Deadlock counter: track consecutive NEEDS_WORK rounds (Proposal §3.2)
  const nwCountPath = path.join(dir, "needs_work_count.txt");
  if (tag === "NEEDS_WORK") {
    const currentCount = parseInt(readFile(nwCountPath) || "0", 10);
    const newCount = currentCount + 1;
    writeFile(nwCountPath, String(newCount));
    if (newCount >= 3) {
      // Trigger deadlock — write flag for watcher to detect
      const deadlockPath = path.join(dir, "deadlock.txt");
      writeFile(deadlockPath, `DEADLOCK at round ${round}: ${newCount} consecutive NEEDS_WORK rounds\nTimestamp: ${ts}\nAction: Watcher will pause. User intervention required.`);
      console.log("");
      console.log(line("!", 40));
      console.log(`DEADLOCK: ${newCount} consecutive NEEDS_WORK rounds.`);
      console.log("Watcher will pause for user intervention.");
      console.log("To resolve: ralph-lisa scope-update or ralph-lisa force-turn");
      console.log(line("!", 40));
    }
  } else {
    // Reset counter on non-NEEDS_WORK review
    writeFile(nwCountPath, "0");
    const deadlockPath = path.join(dir, "deadlock.txt");
    try { fs.unlinkSync(deadlockPath); } catch {}
  }

  // Clean .dual-agent/tests/ on CONSENSUS (Proposal §3.6 — evidence preserved until closure)
  if (tag === "CONSENSUS") {
    const testsDir = path.join(dir, "tests");
    if (fs.existsSync(testsDir)) {
      fs.rmSync(testsDir, { recursive: true, force: true });
      console.log("Cleaned .dual-agent/tests/ (topic closed)");
    }
  }

  // Increment round
  const nextRound = (parseInt(round, 10) || 0) + 1;
  setRound(nextRound);

  console.log(line());
  if (violations.length > 0) {
    console.log(`Submitted OK (with warnings): [${tag}] ${summary}`);
    console.log("");
    console.log("Policy warnings:");
    for (const v of violations) {
      console.log(`  - ${v.message}`);
    }
    console.log("");
  } else {
    console.log(`Submitted: [${tag}] ${summary}`);
  }
  console.log("Turn passed to: Ralph");
  console.log(`Round: ${round} -> ${nextRound}`);
  console.log(line());
  console.log("");
  console.log("Now wait for Ralph. Check with: ralph-lisa whose-turn");
}

// ─── status ──────────────────────────────────────

export function cmdStatus(): void {
  const dir = stateDir();
  if (!fs.existsSync(dir)) {
    console.log("Status: Not initialized");
    return;
  }

  const turn = getTurn();
  const round = getRound();
  const step = getStep();
  const last = readFile(path.join(dir, "last_action.txt")) || "None";
  const taskFile = readFile(path.join(dir, "task.md"));
  const taskLine = taskFile.split("\n")[2] || "Unknown";

  console.log(line());
  console.log("Ralph Lisa Dual-Agent Loop");
  console.log(line());
  console.log(`Task: ${taskLine}`);
  console.log(`Round: ${round} | Step: ${step}`);
  console.log("");
  console.log(`>>> Turn: ${turn} <<<`);
  console.log(`Last: ${last}`);
  console.log(line());
}

// ─── read ────────────────────────────────────────

export function cmdRead(args: string[]): void {
  checkSession();
  const file = args[0];
  if (!file) {
    console.error("Usage: ralph-lisa read <file>");
    console.error("  work.md      - Ralph's work");
    console.error("  review.md    - Lisa's feedback (last 3)");
    console.error("  review --round N  - Lisa's review from round N (from history)");
    process.exit(1);
  }

  // Handle: ralph-lisa read review --round N
  const roundIdx = args.indexOf("--round");
  if ((file === "review" || file === "review.md") && roundIdx !== -1) {
    const roundStr = args[roundIdx + 1];
    const roundNum = parseInt(roundStr, 10);
    if (!roundStr || isNaN(roundNum) || roundNum < 1) {
      console.error("Error: --round requires a positive integer");
      process.exit(1);
    }
    const review = extractReviewByRound(roundNum);
    if (review) {
      console.log(review);
    } else {
      console.log(`No review found for round ${roundNum}`);
    }
    return;
  }

  const filePath = path.join(stateDir(), file);
  if (fs.existsSync(filePath)) {
    console.log(fs.readFileSync(filePath, "utf-8"));
  } else {
    console.log(`(File ${file} does not exist)`);
  }
}

/**
 * Extract Lisa's review for a specific round from history.md.
 */
function extractReviewByRound(round: number): string | null {
  const dir = stateDir();
  const history = readFile(path.join(dir, "history.md"));
  if (!history) return null;

  // Find Lisa's entry for the given round
  const entryRe = new RegExp(
    `## \\[Lisa\\] \\[\\w+\\] Round ${round} \\| Step: .+`,
    "m"
  );
  const match = entryRe.exec(history);
  if (!match) return null;

  // Extract from this header to the next entry separator (--- or end)
  const start = match.index;
  const rest = history.slice(start);
  const nextSep = rest.indexOf("\n---\n");
  const entry = nextSep !== -1 ? rest.slice(0, nextSep) : rest;
  return entry.trim();
}

// ─── recap ───────────────────────────────────────

export function cmdRecap(): void {
  checkSession();
  const dir = stateDir();
  const step = getStep();
  const round = getRound();
  const turn = getTurn();
  const history = readFile(path.join(dir, "history.md"));

  if (!history) {
    console.log("No history to recap.");
    return;
  }

  // Find the current step section in history
  const stepHeaderRe = new RegExp(
    `^# Step: ${step.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
    "m"
  );
  const stepMatch = stepHeaderRe.exec(history);
  const stepSection = stepMatch
    ? history.slice(stepMatch.index)
    : history; // If no step header found, use full history

  // Extract all action entries from the current step section
  const entryRe =
    /^## \[(Ralph|Lisa)\] \[(\w+)\] Round (\d+) \| Step: .+\n\*\*Time\*\*: .+\n\*\*Summary\*\*: (.+)/gm;
  const entries: Array<{
    role: string;
    tag: string;
    round: string;
    summary: string;
  }> = [];
  let match;
  while ((match = entryRe.exec(stepSection)) !== null) {
    entries.push({
      role: match[1],
      tag: match[2],
      round: match[3],
      summary: match[4],
    });
  }

  // Find unresolved NEEDS_WORK items (NEEDS_WORK from Lisa not followed by FIX/CHALLENGE from Ralph)
  const unresolvedNeedsWork: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.role === "Lisa" && e.tag === "NEEDS_WORK") {
      // Check if Ralph responded with FIX or CHALLENGE after this
      const resolved = entries
        .slice(i + 1)
        .some(
          (later) =>
            later.role === "Ralph" &&
            (later.tag === "FIX" || later.tag === "CHALLENGE")
        );
      if (!resolved) {
        unresolvedNeedsWork.push(e.summary);
      }
    }
  }

  // Output recap
  console.log(line());
  console.log("RECAP — Context Recovery");
  console.log(line());
  console.log(`Step: ${step}`);
  console.log(`Round: ${round} | Turn: ${turn}`);
  console.log(`Actions in this step: ${entries.length}`);
  console.log("");

  // Last 3 actions
  const recent = entries.slice(-3);
  if (recent.length > 0) {
    console.log("Recent actions:");
    for (const e of recent) {
      console.log(`  R${e.round} ${e.role} [${e.tag}] ${e.summary}`);
    }
  } else {
    console.log("Recent actions: (none)");
  }

  // Unresolved NEEDS_WORK
  if (unresolvedNeedsWork.length > 0) {
    console.log("");
    console.log("Unresolved NEEDS_WORK:");
    for (const nw of unresolvedNeedsWork) {
      console.log(`  - ${nw}`);
    }
  }

  console.log(line());
}

/**
 * Extract the last tag from a work.md or review.md file content.
 * Only matches the canonical metadata header format: ## [TAG] Round N | Step: ...
 * Does NOT match arbitrary ## [TAG] headings in body text.
 */
function extractLastTag(fileContent: string): string {
  const re = /^## \[(\w+)\] Round \d+ \| Step: /gm;
  let lastTag = "";
  let match;
  while ((match = re.exec(fileContent)) !== null) {
    lastTag = match[1];
  }
  return lastTag;
}

// ─── step ────────────────────────────────────────

export function cmdStep(args: string[]): void {
  checkSession();

  // Parse flags
  const forceIdx = args.indexOf("--force");
  const force = forceIdx !== -1;
  const taskIdx = args.indexOf("--task");
  let taskDesc = "";
  const skipIndices = new Set<number>();
  if (forceIdx !== -1) skipIndices.add(forceIdx);
  if (taskIdx !== -1) {
    skipIndices.add(taskIdx);
    if (taskIdx + 1 < args.length) {
      taskDesc = args[taskIdx + 1];
      skipIndices.add(taskIdx + 1);
    }
  }
  const filteredArgs = args.filter((_, i) => !skipIndices.has(i));

  const stepName = filteredArgs.join(" ");
  if (!stepName) {
    console.error('Usage: ralph-lisa step "step name"');
    console.error('       ralph-lisa step "step name" --task "first task"');
    console.error("       ralph-lisa step --force \"step name\"  (skip consensus check)");
    process.exit(1);
  }

  const dir = stateDir();

  // Check consensus before allowing step transition
  if (!force) {
    const workContent = readFile(path.join(dir, "work.md"));
    const reviewContent = readFile(path.join(dir, "review.md"));

    const workTag = extractLastTag(workContent);
    const reviewTag = extractLastTag(reviewContent);

    const consensusReached =
      (workTag === "CONSENSUS" && reviewTag === "CONSENSUS") ||
      (workTag === "CONSENSUS" && reviewTag === "PASS") ||
      (workTag === "PASS" && reviewTag === "CONSENSUS");

    if (!consensusReached) {
      console.error("Error: Consensus not reached. Cannot proceed to next step.");
      console.error(`  Ralph's last tag: [${workTag || "none"}]`);
      console.error(`  Lisa's last tag:  [${reviewTag || "none"}]`);
      console.error("");
      console.error("Required: both [CONSENSUS], or [PASS]+[CONSENSUS] combination.");
      console.error('Use --force to skip this check: ralph-lisa step --force "step name"');
      process.exit(1);
    }

    // Check subtask completion before step transition (Proposal §3.4)
    const taskContent = readFile(path.join(dir, "task.md"));
    const incomplete = parseSubtasks(taskContent).filter((s) => !s.done);
    if (incomplete.length > 0) {
      console.error("Error: Incomplete subtasks remain. Cannot proceed to next step.");
      for (const s of incomplete) {
        console.error(`  - [ ] #${s.index} ${s.text}`);
      }
      console.error("");
      console.error("Complete all subtasks first, or use --force to skip this check.");
      process.exit(1);
    }
  }

  setStep(stepName);
  setRound(1);

  const ts = timestamp();

  // Initialize task.md for new step (Proposal §3.3 + §3.4)
  let taskContent = `# ${stepName}\n\n## Subtasks\n`;
  if (taskDesc) {
    taskContent += `- [ ] #1 ${taskDesc}\n`;
  }
  taskContent += `\n---\nCreated: ${ts}\n`;
  writeFile(path.join(dir, "task.md"), taskContent);

  const entry = `\n---\n\n# Step: ${stepName}\n\nStarted: ${ts}\n\n`;
  fs.appendFileSync(path.join(dir, "history.md"), entry, "utf-8");

  console.log(`Entered step: ${stepName} (round reset to 1)`);
  if (taskDesc) {
    console.log(`  Subtask #1: ${taskDesc}`);
  }
}

// ─── subtask helpers ─────────────────────────────

interface Subtask {
  index: number;
  text: string;
  done: boolean;
  line: string;  // original line text
}

export function parseSubtasks(taskContent: string): Subtask[] {
  const subtasks: Subtask[] = [];
  const lines = taskContent.split("\n");
  for (const line of lines) {
    const doneMatch = line.match(/^- \[x\] #(\d+)\s+(.*)/i);
    if (doneMatch) {
      subtasks.push({ index: parseInt(doneMatch[1], 10), text: doneMatch[2], done: true, line });
      continue;
    }
    const todoMatch = line.match(/^- \[ \] #(\d+)\s+(.*)/);
    if (todoMatch) {
      subtasks.push({ index: parseInt(todoMatch[1], 10), text: todoMatch[2], done: false, line });
    }
  }
  return subtasks;
}

// ─── subtask ─────────────────────────────────────

export function cmdSubtask(args: string[]): void {
  checkSession();
  const subcmd = args[0] || "";
  const rest = args.slice(1);

  switch (subcmd) {
    case "add": {
      const desc = rest.join(" ");
      if (!desc) {
        console.error('Usage: ralph-lisa subtask add "task description"');
        process.exit(1);
      }
      const dir = stateDir();
      const taskPath = path.join(dir, "task.md");
      const content = readFile(taskPath);
      const existing = parseSubtasks(content);
      const nextIndex = existing.length > 0 ? Math.max(...existing.map((s) => s.index)) + 1 : 1;
      const newLine = `- [ ] #${nextIndex} ${desc}`;

      // Insert before the --- separator if present, otherwise append
      const lines = content.split("\n");
      const sepIdx = lines.findIndex((l) => l.startsWith("---"));
      if (sepIdx !== -1) {
        lines.splice(sepIdx, 0, newLine);
      } else {
        lines.push(newLine);
      }
      writeFile(taskPath, lines.join("\n"));
      console.log(`Added subtask #${nextIndex}: ${desc}`);
      break;
    }
    case "done": {
      const num = parseInt(rest[0], 10);
      if (isNaN(num)) {
        console.error("Usage: ralph-lisa subtask done <number>");
        process.exit(1);
      }
      const dir = stateDir();
      const taskPath = path.join(dir, "task.md");
      const content = readFile(taskPath);
      const subtasks = parseSubtasks(content);
      const target = subtasks.find((s) => s.index === num);
      if (!target) {
        console.error(`Error: Subtask #${num} not found.`);
        process.exit(1);
      }
      if (target.done) {
        console.log(`Subtask #${num} already completed.`);
        break;
      }
      const updated = content.replace(target.line, target.line.replace("- [ ]", "- [x]"));
      writeFile(taskPath, updated);
      appendHistory("System", `[SUBTASK] Completed #${num}: ${target.text}`);
      console.log(`Completed subtask #${num}: ${target.text}`);
      break;
    }
    case "list": {
      const dir = stateDir();
      const content = readFile(path.join(dir, "task.md"));
      const subtasks = parseSubtasks(content);
      if (subtasks.length === 0) {
        console.log("No subtasks defined.");
        break;
      }
      for (const s of subtasks) {
        const mark = s.done ? "x" : " ";
        console.log(`  [${mark}] #${s.index} ${s.text}`);
      }
      const done = subtasks.filter((s) => s.done).length;
      console.log(`\n${done}/${subtasks.length} completed`);
      break;
    }
    default:
      console.error("Usage: ralph-lisa subtask <add|done|list> [args]");
      console.error('  subtask add "description"   Add a new subtask');
      console.error("  subtask done <number>       Mark subtask as complete");
      console.error("  subtask list                List all subtasks");
      process.exit(1);
  }
}

// ─── history ─────────────────────────────────────

export function cmdHistory(): void {
  checkSession();
  const filePath = path.join(stateDir(), "history.md");
  if (fs.existsSync(filePath)) {
    console.log(fs.readFileSync(filePath, "utf-8"));
  }
}

// ─── archive ─────────────────────────────────────

export function cmdArchive(args: string[]): void {
  checkSession();
  const name = args[0] || new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  // Place archive next to .dual-agent/ (in project root, not CWD)
  const root = findProjectRoot() || process.cwd();
  const archiveDir = path.join(root, ARCHIVE_DIR);
  const dest = path.join(archiveDir, name);
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(stateDir(), dest, { recursive: true });
  console.log(`Archived: ${ARCHIVE_DIR}/${name}/`);
}

// ─── clean ───────────────────────────────────────

export function cmdClean(): void {
  const dir = stateDir();
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log("Session cleaned");
  }
}

// ─── scope-update / update-task ──────────────────

export function cmdUpdateTask(args: string[]): void {
  checkSession();
  const newTask = args.join(" ");
  if (!newTask) {
    console.error('Usage: ralph-lisa scope-update "new scope description"');
    console.error('       ralph-lisa update-task "new scope description"  (alias)');
    process.exit(1);
  }

  const dir = stateDir();
  const taskPath = path.join(dir, "task.md");
  const ts = timestamp();

  // Append new direction with timestamp (preserves history)
  fs.appendFileSync(
    taskPath,
    `\n---\nUpdated: ${ts}\n\n${newTask}\n`,
    "utf-8"
  );

  // Log scope change to history (Proposal §3.1)
  appendHistory("System", `[SCOPE] Task scope updated: ${newTask}`);
  updateLastAction("System", `[SCOPE] ${newTask}`);

  // Clear deadlock flag — scope change resolves deadlocks (Proposal §3.2)
  const deadlockPath = path.join(dir, "deadlock.txt");
  try { fs.unlinkSync(deadlockPath); } catch {}
  const nwCountPath = path.join(dir, "needs_work_count.txt");
  writeFile(nwCountPath, "0");

  console.log(`Scope updated: ${newTask}`);
  console.log(`(Appended to ${taskPath}, logged to history.md)`);
}

// ─── force-turn ─────────────────────────────────

export function cmdForceTurn(args: string[], confirmed = false): void {
  checkSession();
  const agent = args[0];
  if (agent !== "ralph" && agent !== "lisa") {
    console.error("Usage: ralph-lisa force-turn <ralph|lisa>");
    process.exit(1);
  }

  const dir = stateDir();

  // Block in full-auto mode (watcher running = auto mode)
  const watcherPid = path.join(dir, "watcher.pid");
  if (fs.existsSync(watcherPid)) {
    const pid = readFile(watcherPid).trim();
    try {
      process.kill(Number(pid), 0); // check if alive
      console.error("Error: force-turn is disabled in auto mode (watcher is running).");
      console.error("Stop auto mode first, or manually edit turn.txt.");
      process.exit(1);
    } catch {
      // watcher not running, PID stale — allow
    }
  }

  if (!confirmed) {
    const readline = require("node:readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`Force turn to ${agent}? This skips normal review flow. (y/N) `, (answer: string) => {
      rl.close();
      if (answer.trim().toLowerCase() === "y") {
        executeForceTurn(agent, dir);
      } else {
        console.log("Aborted.");
      }
    });
    return;
  }

  executeForceTurn(agent, dir);
}

export function executeForceTurn(agent: string, dir: string): void {
  setTurn(agent);
  const ts = timestamp();
  appendHistory("System", `[FORCE] Turn manually assigned to ${agent} by user`);
  updateLastAction("System", `[FORCE] Turn assigned to ${agent}`);
  console.log(`Turn forced to: ${agent}`);
  console.log("(Logged to history.md)");
}

// ─── uninit ──────────────────────────────────────

const MARKER = "RALPH-LISA-LOOP";

export function cmdUninit(): void {
  const projectDir = process.cwd();

  // Remove .dual-agent/
  const dualAgentDir = path.join(projectDir, STATE_DIR);
  if (fs.existsSync(dualAgentDir)) {
    fs.rmSync(dualAgentDir, { recursive: true, force: true });
    console.log("Removed: .dual-agent/");
  }

  // Clean CODEX.md marker block (same logic as CLAUDE.md — preserve pre-existing content)
  const codexMd = path.join(projectDir, "CODEX.md");
  if (fs.existsSync(codexMd)) {
    const content = fs.readFileSync(codexMd, "utf-8");
    if (content.includes(MARKER)) {
      const markerIdx = content.indexOf(`<!-- ${MARKER} -->`);
      if (markerIdx >= 0) {
        const before = content.slice(0, markerIdx).trimEnd();
        if (before) {
          fs.writeFileSync(codexMd, before + "\n", "utf-8");
          console.log("Cleaned: CODEX.md (removed Ralph-Lisa-Loop section)");
        } else {
          fs.unlinkSync(codexMd);
          console.log(
            "Removed: CODEX.md (was entirely Ralph-Lisa-Loop content)"
          );
        }
      }
    }
  }

  // Clean CLAUDE.md marker block
  const claudeMd = path.join(projectDir, "CLAUDE.md");
  if (fs.existsSync(claudeMd)) {
    const content = fs.readFileSync(claudeMd, "utf-8");
    if (content.includes(MARKER)) {
      // Remove everything from <!-- RALPH-LISA-LOOP --> to end of file
      // or to next <!-- end --> marker
      const markerIdx = content.indexOf(`<!-- ${MARKER} -->`);
      if (markerIdx >= 0) {
        const before = content.slice(0, markerIdx).trimEnd();
        if (before) {
          fs.writeFileSync(claudeMd, before + "\n", "utf-8");
          console.log("Cleaned: CLAUDE.md (removed Ralph-Lisa-Loop section)");
        } else {
          fs.unlinkSync(claudeMd);
          console.log(
            "Removed: CLAUDE.md (was entirely Ralph-Lisa-Loop content)"
          );
        }
      }
    }
  }

  // Remove .claude/commands/ (only our files)
  const claudeCmdDir = path.join(projectDir, ".claude", "commands");
  const ourCommands = [
    "check-turn.md",
    "next-step.md",
    "read-review.md",
    "submit-work.md",
    "view-status.md",
  ];
  if (fs.existsSync(claudeCmdDir)) {
    for (const cmd of ourCommands) {
      const cmdPath = path.join(claudeCmdDir, cmd);
      if (fs.existsSync(cmdPath)) {
        fs.unlinkSync(cmdPath);
      }
    }
    // Remove directory if empty
    try {
      const remaining = fs.readdirSync(claudeCmdDir);
      if (remaining.length === 0) {
        fs.rmdirSync(claudeCmdDir);
        // Also remove .claude/ if empty
        const claudeDir = path.join(projectDir, ".claude");
        const claudeRemaining = fs.readdirSync(claudeDir);
        if (claudeRemaining.length === 0) {
          fs.rmdirSync(claudeDir);
        }
      }
    } catch {
      // ignore
    }
    console.log("Cleaned: .claude/commands/");
  }

  // Remove only our skill from .codex/ (preserve other content)
  const codexSkillDir = path.join(
    projectDir,
    ".codex",
    "skills",
    "ralph-lisa-loop"
  );
  if (fs.existsSync(codexSkillDir)) {
    fs.rmSync(codexSkillDir, { recursive: true, force: true });
    console.log("Removed: .codex/skills/ralph-lisa-loop/");
    // Clean up empty parent dirs
    try {
      const skillsDir = path.join(projectDir, ".codex", "skills");
      if (fs.readdirSync(skillsDir).length === 0) {
        fs.rmdirSync(skillsDir);
      }
    } catch {
      // ignore
    }
  }
  // Remove .codex/config.toml only if it has our marker
  const codexConfig = path.join(projectDir, ".codex", "config.toml");
  if (fs.existsSync(codexConfig)) {
    const configContent = fs.readFileSync(codexConfig, "utf-8");
    if (configContent.includes(MARKER)) {
      fs.unlinkSync(codexConfig);
      console.log("Removed: .codex/config.toml");
    }
  }
  // Remove .codex/ if empty
  try {
    const codexDir = path.join(projectDir, ".codex");
    if (fs.existsSync(codexDir) && fs.readdirSync(codexDir).length === 0) {
      fs.rmdirSync(codexDir);
      console.log("Removed: .codex/ (empty)");
    }
  } catch {
    // ignore
  }

  // Remove io.sh if it exists
  const ioSh = path.join(projectDir, "io.sh");
  if (fs.existsSync(ioSh)) {
    fs.unlinkSync(ioSh);
    console.log("Removed: io.sh");
  }

  console.log("");
  console.log("Ralph-Lisa Loop removed from this project.");
}

// ─── init (project setup) ────────────────────────

export function cmdInitProject(args: string[]): void {
  // Parse --minimal flag
  const minimal = args.includes("--minimal");
  const filteredArgs = args.filter((a) => a !== "--minimal");

  const projectDir = filteredArgs[0] || process.cwd();
  const resolvedDir = path.resolve(projectDir);

  if (!fs.existsSync(resolvedDir)) {
    console.error(`Error: Directory does not exist: ${resolvedDir}`);
    process.exit(1);
  }

  console.log(line());
  console.log(`Ralph-Lisa Loop - Init${minimal ? " (minimal)" : ""}`);
  console.log(line());
  console.log(`Project: ${resolvedDir}`);
  console.log("");

  if (minimal) {
    // Minimal mode: only create .dual-agent/ session state.
    // Use this when Claude Code plugin + Codex global config are installed.
    console.log("[Session] Initializing .dual-agent/ (minimal mode)...");
    const origCwd = process.cwd();
    process.chdir(resolvedDir);
    cmdInit(["Waiting for task assignment"]);
    process.chdir(origCwd);

    console.log("");
    console.log(line());
    console.log("Minimal Init Complete");
    console.log(line());
    console.log("");
    console.log("Files created:");
    console.log("  - .dual-agent/ (session state only)");
    console.log("");
    console.log("No project-level role/command files written.");
    console.log("Requires: Claude Code plugin + Codex global config.");
    console.log(line());
    return;
  }

  // Find templates directory (shipped inside npm package)
  const templatesDir = findTemplatesDir();

  // 1. Append/update Ralph role in CLAUDE.md
  const claudeMd = path.join(resolvedDir, "CLAUDE.md");
  const ralphRole = readFile(path.join(templatesDir, "roles", "ralph.md"));
  if (fs.existsSync(claudeMd) && readFile(claudeMd).includes(MARKER)) {
    // Marker present — we own this content, update to latest template
    console.log("[Claude] Updating Ralph role in CLAUDE.md...");
    const existing = fs.readFileSync(claudeMd, "utf-8");
    const markerTag = `<!-- ${MARKER} -->`;
    const markerIdx = existing.indexOf(markerTag);
    const before = markerIdx > 0 ? existing.slice(0, markerIdx) : "";
    fs.writeFileSync(claudeMd, before + ralphRole, "utf-8");
    console.log("[Claude] Updated.");
  } else {
    console.log("[Claude] Appending Ralph role to CLAUDE.md...");
    if (fs.existsSync(claudeMd)) {
      fs.appendFileSync(claudeMd, "\n\n", "utf-8");
    }
    fs.appendFileSync(claudeMd, ralphRole, "utf-8");
    console.log("[Claude] Done.");
  }

  // 2. Create/update CODEX.md with Lisa role
  const codexMd = path.join(resolvedDir, "CODEX.md");
  const lisaRole = readFile(path.join(templatesDir, "roles", "lisa.md"));
  if (fs.existsSync(codexMd) && readFile(codexMd).includes(MARKER)) {
    // Marker present — we own this content, update to latest template
    console.log("[Codex] Updating Lisa role in CODEX.md...");
    const existing = fs.readFileSync(codexMd, "utf-8");
    const markerTag = `<!-- ${MARKER} -->`;
    const markerIdx = existing.indexOf(markerTag);
    const before = markerIdx > 0 ? existing.slice(0, markerIdx) : "";
    fs.writeFileSync(codexMd, before + lisaRole, "utf-8");
    console.log("[Codex] Updated.");
  } else {
    console.log("[Codex] Creating CODEX.md with Lisa role...");
    if (fs.existsSync(codexMd)) {
      fs.appendFileSync(codexMd, "\n\n", "utf-8");
    }
    fs.appendFileSync(codexMd, lisaRole, "utf-8");
    console.log("[Codex] Done.");
  }

  // 3. Copy Claude commands
  console.log("[Claude] Copying commands to .claude/commands/...");
  const claudeCmdDir = path.join(resolvedDir, ".claude", "commands");
  fs.mkdirSync(claudeCmdDir, { recursive: true });
  const cmdSrc = path.join(templatesDir, "claude-commands");
  if (fs.existsSync(cmdSrc)) {
    for (const f of fs.readdirSync(cmdSrc)) {
      if (f.endsWith(".md")) {
        fs.copyFileSync(path.join(cmdSrc, f), path.join(claudeCmdDir, f));
      }
    }
  }
  console.log("[Claude] Commands copied.");

  // 4. Copy Codex skills
  console.log(
    "[Codex] Setting up skills in .codex/skills/ralph-lisa-loop/..."
  );
  const codexSkillDir = path.join(
    resolvedDir,
    ".codex",
    "skills",
    "ralph-lisa-loop"
  );
  fs.mkdirSync(codexSkillDir, { recursive: true });

  const skillContent = `---
name: ralph-lisa-loop
description: Lisa review commands for Ralph-Lisa dual-agent collaboration
---

# Ralph-Lisa Loop - Lisa Skills

This skill provides Lisa's review commands for the Ralph-Lisa collaboration.

## Available Commands

### Check Turn
\`\`\`bash
ralph-lisa whose-turn
\`\`\`
Check if it's your turn before taking action.

### Submit Review
\`\`\`bash
ralph-lisa submit-lisa "[TAG] summary

detailed content..."
\`\`\`
Submit your review. Valid tags: PASS, NEEDS_WORK, CHALLENGE, DISCUSS, QUESTION, CONSENSUS

### View Status
\`\`\`bash
ralph-lisa status
\`\`\`
View current task, turn, and last action.

### Read Ralph's Work
\`\`\`bash
ralph-lisa read work.md
\`\`\`
Read Ralph's latest submission.
`;
  writeFile(path.join(codexSkillDir, "SKILL.md"), skillContent);

  // Create .codex/config.toml (with marker for safe uninit)
  // Codex reads AGENTS.md by default; fallback to CODEX.md for our setup
  const codexConfig = `# ${MARKER} - managed by ralph-lisa-loop
project_doc_fallback_filenames = ["CODEX.md"]

[skills]
enabled = true
path = ".codex/skills"
`;
  writeFile(path.join(resolvedDir, ".codex", "config.toml"), codexConfig);
  console.log(`[Codex] Skill created at ${codexSkillDir}/`);
  console.log(
    `[Codex] Config created at ${path.join(resolvedDir, ".codex", "config.toml")}`
  );

  // 5. Initialize session state
  console.log("[Session] Initializing .dual-agent/...");
  const origCwd = process.cwd();
  process.chdir(resolvedDir);
  cmdInit(["Waiting for task assignment"]);
  process.chdir(origCwd);

  console.log("");
  console.log(line());
  console.log("Initialization Complete");
  console.log(line());
  console.log("");
  console.log("Files created/updated:");
  console.log("  - CLAUDE.md (Ralph role)");
  console.log("  - CODEX.md (Lisa role)");
  console.log("  - .claude/commands/ (Claude slash commands)");
  console.log("  - .codex/skills/ (Codex skills)");
  console.log("  - .dual-agent/");
  console.log("");
  console.log("Start agents:");
  console.log("  Terminal 1: claude");
  console.log("  Terminal 2: codex");
  console.log("");
  console.log('Or run: ralph-lisa start "your task"');
  console.log(line());
}

function findTemplatesDir(): string {
  // Look for templates relative to the CLI package
  const candidates = [
    // When installed via npm (templates shipped in package)
    path.join(__dirname, "..", "templates"),
    // When running from repo
    path.join(__dirname, "..", "..", "templates"),
    // Repo root
    path.join(__dirname, "..", "..", "..", "templates"),
  ];

  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "roles", "ralph.md"))) {
      return c;
    }
  }

  console.error(
    "Error: Templates directory not found. Reinstall ralph-lisa-loop."
  );
  process.exit(1);
}

// ─── start ───────────────────────────────────────

export function cmdStart(args: string[]): void {
  const projectDir = process.cwd();
  const fullAuto = args.includes("--full-auto");
  const filteredArgs = args.filter((a) => a !== "--full-auto");
  const task = filteredArgs.join(" ");

  const claudeCmd = fullAuto ? "claude --dangerously-skip-permissions" : "claude";
  const codexCmd = fullAuto ? "codex --full-auto" : "codex";

  console.log(line());
  console.log("Ralph-Lisa Loop - Start");
  console.log(line());
  console.log(`Project: ${projectDir}`);
  if (fullAuto) console.log("Mode: FULL AUTO (no permission prompts)");
  console.log("");

  // Check prerequisites
  const { execSync } = require("node:child_process");

  try {
    execSync("which claude", { stdio: "pipe" });
  } catch {
    console.error("Error: 'claude' command not found. Install Claude Code first.");
    process.exit(1);
  }

  try {
    execSync("which codex", { stdio: "pipe" });
  } catch {
    console.error("Error: 'codex' command not found. Install Codex CLI first.");
    process.exit(1);
  }

  // Check if initialized (full init has CLAUDE.md marker, minimal has .dual-agent/)
  const claudeMd = path.join(projectDir, "CLAUDE.md");
  const hasFullInit = fs.existsSync(claudeMd) && readFile(claudeMd).includes(MARKER);
  const hasSession = fs.existsSync(path.join(projectDir, STATE_DIR));
  if (!hasFullInit && !hasSession) {
    console.error("Error: Not initialized. Run 'ralph-lisa init' first.");
    process.exit(1);
  }

  // Initialize task if provided
  if (task) {
    console.log(`Task: ${task}`);
    cmdInit(task.split(" "));
    console.log("");
  }

  // Detect terminal and launch
  const platform = process.platform;
  const ralphCmd = `cd '${projectDir}' && echo '=== Ralph (Claude Code) ===' && echo 'Commands: /check-turn, /submit-work, /view-status' && echo 'First: /check-turn' && echo '' && ${claudeCmd}`;
  const lisaCmd = `cd '${projectDir}' && echo '=== Lisa (Codex) ===' && echo 'First: ralph-lisa whose-turn' && echo '' && ${codexCmd}`;

  if (platform === "darwin") {
    try {
      // Try iTerm2 first
      execSync("pgrep -x iTerm2", { stdio: "pipe" });
      console.log("Launching with iTerm2...");
      execSync(
        `osascript -e 'tell application "iTerm"
  activate
  set ralphWindow to (create window with default profile)
  tell current session of ralphWindow
    write text "${ralphCmd.replace(/"/g, '\\"')}"
    set name to "Ralph (Claude)"
  end tell
  tell current window
    set lisaTab to (create tab with default profile)
    tell current session of lisaTab
      write text "${lisaCmd.replace(/"/g, '\\"')}"
      set name to "Lisa (Codex)"
    end tell
  end tell
end tell'`,
        { stdio: "pipe" }
      );
    } catch {
      // Fall back to Terminal.app
      console.log("Launching with macOS Terminal...");
      try {
        execSync(
          `osascript -e 'tell application "Terminal"
  activate
  do script "${ralphCmd.replace(/"/g, '\\"')}"
end tell'`,
          { stdio: "pipe" }
        );
        execSync("sleep 1");
        execSync(
          `osascript -e 'tell application "Terminal"
  activate
  do script "${lisaCmd.replace(/"/g, '\\"')}"
end tell'`,
          { stdio: "pipe" }
        );
      } catch {
        launchGeneric(projectDir);
        return;
      }
    }
  } else {
    // Try tmux
    try {
      execSync("which tmux", { stdio: "pipe" });
      console.log("Launching with tmux...");
      const sessionName = generateSessionName(projectDir);
      execSync(`tmux kill-session -t "${sessionName}" 2>/dev/null || true`);
      execSync(
        `tmux new-session -d -s "${sessionName}" -n "Ralph" "bash -c '${ralphCmd}; exec bash'"`
      );
      execSync(
        `tmux split-window -h -t "${sessionName}" "bash -c '${lisaCmd}; exec bash'"`
      );
      execSync(`tmux attach-session -t "${sessionName}"`, { stdio: "inherit" });
    } catch {
      launchGeneric(projectDir);
      return;
    }
  }

  console.log("");
  console.log(line());
  console.log("Both agents launched!");
  console.log(line());
  const currentTurn = readFile(
    path.join(projectDir, STATE_DIR, "turn.txt")
  ) || "ralph";
  console.log(`Current turn: ${currentTurn}`);
  console.log(line());
}

function launchGeneric(projectDir: string): void {
  console.log("Please manually open two terminals:");
  console.log("");
  console.log("Terminal 1 (Ralph):");
  console.log(`  cd ${projectDir} && claude`);
  console.log("");
  console.log("Terminal 2 (Lisa):");
  console.log(`  cd ${projectDir} && codex`);
}

// ─── auto ────────────────────────────────────────

export function cmdAuto(args: string[]): void {
  const projectDir = process.cwd();
  const fullAuto = args.includes("--full-auto");
  const filteredArgs = args.filter((a) => a !== "--full-auto");
  const task = filteredArgs.join(" ");

  const claudeCmd = fullAuto ? "claude --dangerously-skip-permissions" : "claude";
  const codexCmd = fullAuto ? "codex --full-auto" : "codex";

  console.log(line());
  console.log("Ralph-Lisa Loop - Auto Mode");
  console.log(line());
  console.log(`Project: ${projectDir}`);
  if (fullAuto) console.log("Mode: FULL AUTO (no permission prompts)");
  console.log("");

  const { execSync } = require("node:child_process");

  // Check prerequisites
  try {
    execSync("which tmux", { stdio: "pipe" });
  } catch {
    console.error("Error: tmux is required for auto mode.");
    console.error(
      "Install: brew install tmux (macOS) or apt install tmux (Linux)"
    );
    process.exit(1);
  }

  try {
    execSync("which claude", { stdio: "pipe" });
  } catch {
    console.error("Error: 'claude' (Claude Code CLI) not found in PATH.");
    console.error("");
    console.error("Install: npm install -g @anthropic-ai/claude-code");
    process.exit(1);
  }

  try {
    execSync("which codex", { stdio: "pipe" });
  } catch {
    console.error("Error: 'codex' (OpenAI Codex CLI) not found in PATH.");
    console.error("");
    console.error("Install: npm install -g @openai/codex");
    process.exit(1);
  }

  // Check file watcher (optional - falls back to polling)
  let watcher = "";
  try {
    execSync("which fswatch", { stdio: "pipe" });
    watcher = "fswatch";
  } catch {
    try {
      execSync("which inotifywait", { stdio: "pipe" });
      watcher = "inotifywait";
    } catch {
      console.log(
        "Note: No file watcher found (fswatch/inotifywait). Using polling mode."
      );
      console.log(
        "  Install for faster turn detection: brew install fswatch (macOS) or apt install inotify-tools (Linux)"
      );
      console.log("");
    }
  }

  // Check if initialized (full init has CLAUDE.md marker, minimal has .dual-agent/)
  const claudeMd = path.join(projectDir, "CLAUDE.md");
  const hasFullInit = fs.existsSync(claudeMd) && readFile(claudeMd).includes(MARKER);
  const hasSession = fs.existsSync(path.join(projectDir, STATE_DIR));
  if (!hasFullInit && !hasSession) {
    console.error("Error: Not initialized. Run 'ralph-lisa init' first.");
    process.exit(1);
  }

  // Initialize task
  if (task) {
    console.log(`Task: ${task}`);
    cmdInit(task.split(" "));
    console.log("");
  }

  const sessionName = generateSessionName(projectDir);
  const dir = stateDir(projectDir);
  fs.mkdirSync(dir, { recursive: true });

  // Archive pane logs from previous runs (for transcript preservation)
  const logsDir = path.join(dir, "logs");
  fs.mkdirSync(logsDir, { recursive: true });
  for (const f of ["pane0.log", "pane1.log"]) {
    const src = path.join(dir, f);
    if (fs.existsSync(src) && fs.statSync(src).size > 0) {
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      fs.renameSync(src, path.join(logsDir, `${f.replace(".log", "")}-${ts}.log`));
    } else {
      try { fs.unlinkSync(src); } catch {}
    }
  }
  // Clean event accelerator flag
  try { fs.unlinkSync(path.join(dir, ".turn_changed")); } catch {}

  // Create watcher script
  const watcherScript = path.join(dir, "watcher.sh");
  let watcherContent = `#!/bin/bash
# Turn watcher v3 - fire-and-forget agent triggering
# Architecture: polling main loop + optional event acceleration
# v3: Removed output stability wait + delivery verification (RLL-001)

STATE_DIR=".dual-agent"
SESSION="${sessionName}"
SCRIPT_PATH="\$(cd "\$(dirname "\$0")" && pwd)/watcher.sh"
SEEN_TURN=""
ACKED_TURN=""
FAIL_COUNT=0
ACCEL_PID=""
LAST_ACK_TIME=0
CHECKPOINT_ROUNDS=\${RL_CHECKPOINT_ROUNDS:-0}
CHECKPOINT_REMIND_TIME=0
DEADLOCK_REMIND_TIME=0
CLEANUP_DONE=0

PANE0_LOG="\${STATE_DIR}/pane0.log"
PANE1_LOG="\${STATE_DIR}/pane1.log"
PID_FILE="\${STATE_DIR}/watcher.pid"

# Interactive prompt patterns (do NOT send "go" if matched)
INTERACTIVE_RE='[Pp]assword[: ]|[Pp]assphrase|[Uu]sername[: ]|[Tt]oken[: ]|[Ll]ogin[: ]|\\(y/[Nn]\\)|\\(Y/[Nn]\\)|\\[y/[Nn]\\]|\\[Y/[Nn]\\]|Are you sure|Continue\\?|[Pp]ress [Ee]nter|MFA|2FA|one-time|OTP'

# Pause state per pane: 0=active, consecutive hit count
PANE0_PROMPT_HITS=0
PANE1_PROMPT_HITS=0
PANE0_PAUSED=0
PANE1_PAUSED=0
PANE0_PAUSE_SIZE=0
PANE1_PAUSE_SIZE=0

# ─── PID singleton ───────────────────────────────

if [[ -f "\$PID_FILE" ]]; then
  old_pid=\$(cat "\$PID_FILE" 2>/dev/null)
  if [[ -n "\$old_pid" ]] && kill -0 "\$old_pid" 2>/dev/null; then
    old_args=\$(ps -p "\$old_pid" -o args= 2>/dev/null || echo "")
    if echo "\$old_args" | grep -qF "\$SCRIPT_PATH"; then
      echo "[Watcher] Killing old watcher (PID \$old_pid)"
      kill "\$old_pid" 2>/dev/null || true
      sleep 1
    fi
  fi
fi

echo \$\$ > "\$PID_FILE"

# ─── Cleanup trap ────────────────────────────────

cleanup() {
  if (( CLEANUP_DONE )); then return; fi
  CLEANUP_DONE=1
  echo "[Watcher] Shutting down..."
  # Stop pipe-pane capture
  tmux pipe-pane -t "\${SESSION}:0.0" 2>/dev/null || true
  tmux pipe-pane -t "\${SESSION}:0.1" 2>/dev/null || true
  # Kill event accelerator
  if [[ -n "\$ACCEL_PID" ]] && kill -0 "\$ACCEL_PID" 2>/dev/null; then
    kill "\$ACCEL_PID" 2>/dev/null || true
  fi
  # Clean up PID and flag files
  rm -f "\$PID_FILE" "\${STATE_DIR}/.turn_changed"
  # Archive pane logs (not delete) so transcripts are preserved
  local logs_dir="\${STATE_DIR}/logs"
  mkdir -p "\$logs_dir"
  local archive_ts
  archive_ts=\$(date "+%Y-%m-%dT%H-%M-%S")
  for lf in "\$PANE0_LOG" "\$PANE1_LOG"; do
    if [[ -f "\$lf" && -s "\$lf" ]]; then
      local base
      base=\$(basename "\$lf" .log)
      mv "\$lf" "\${logs_dir}/\${base}-\${archive_ts}.log" 2>/dev/null || true
    fi
  done
  exit 0
}
trap cleanup EXIT INT TERM

# ─── Set up pipe-pane ────────────────────────────

touch "\$PANE0_LOG" "\$PANE1_LOG"
tmux pipe-pane -o -t "\${SESSION}:0.0" "cat >> \\"\$PANE0_LOG\\"" 2>/dev/null || true
tmux pipe-pane -o -t "\${SESSION}:0.1" "cat >> \\"\$PANE1_LOG\\"" 2>/dev/null || true

# ─── Helper functions ────────────────────────────

check_session_alive() {
  if ! tmux has-session -t "\${SESSION}" 2>/dev/null; then
    echo "[Watcher] ERROR: tmux session '\${SESSION}' no longer exists. Exiting."
    exit 1
  fi
}

# Returns 0 if agent appears dead (pane shows bare shell 3 consecutive times)
check_agent_alive() {
  local pane="\$1"
  local agent_name="\$2"
  local dead_count=0
  local i
  for i in 1 2 3; do
    local pane_cmd
    pane_cmd=\$(tmux list-panes -t "\${SESSION}" -F '#{pane_index} #{pane_current_command}' 2>/dev/null | grep "^\${pane##*.} " | awk '{print \$2}')
    if [[ "\$pane_cmd" == "bash" || "\$pane_cmd" == "zsh" || "\$pane_cmd" == "sh" || "\$pane_cmd" == "fish" ]]; then
      dead_count=\$((dead_count + 1))
    else
      return 0  # Agent alive
    fi
    [[ \$i -lt 3 ]] && sleep 2
  done
  if (( dead_count >= 3 )); then
    echo "[Watcher] ALERT: \$agent_name appears to have exited (pane shows shell 3 consecutive times)"
    return 1  # Agent dead
  fi
  return 0
}

# Returns 0 if pane output has been stable for at least N seconds
check_output_stable() {
  local log_file="\$1"
  local stable_seconds="\${2:-5}"

  if [[ ! -f "\$log_file" ]]; then
    return 0
  fi

  local mtime_epoch now_epoch elapsed
  if [[ "\$(uname)" == "Darwin" ]]; then
    mtime_epoch=\$(stat -f %m "\$log_file" 2>/dev/null || echo 0)
  else
    mtime_epoch=\$(stat -c %Y "\$log_file" 2>/dev/null || echo 0)
  fi
  now_epoch=\$(date +%s)
  elapsed=\$(( now_epoch - mtime_epoch ))

  if (( elapsed >= stable_seconds )); then
    return 0  # Stable
  fi
  return 1  # Still producing output
}

# Returns 0 if interactive prompt detected (do NOT send go)
check_for_interactive_prompt() {
  local pane="\$1"
  local pane_content
  pane_content=\$(tmux capture-pane -t "\${SESSION}:\${pane}" -p 2>/dev/null | tail -5)
  if echo "\$pane_content" | grep -Eq "\$INTERACTIVE_RE"; then
    return 0  # IS interactive
  fi
  return 1  # Not interactive
}

# Truncate log file safely: unbind pipe → truncate → rebind
truncate_log_if_needed() {
  local pane="\$1"
  local log_file="\$2"
  local max_mb=\${RL_LOG_MAX_MB:-5}
  if (( max_mb < 1 )); then max_mb=1; fi
  local max_bytes=$(( max_mb * 1048576 ))
  local tail_bytes=$(( max_mb * 102400 ))  # ~10% of max

  if [[ ! -f "\$log_file" ]]; then return; fi
  local size
  size=\$(wc -c < "\$log_file" 2>/dev/null | tr -d ' ')
  if (( size > max_bytes )); then
    echo "[Watcher] Truncating \$log_file (\${size} bytes > \${max_mb}MB)"
    tmux pipe-pane -t "\${SESSION}:\${pane}" 2>/dev/null || true
    tail -c \$tail_bytes "\$log_file" > "\${log_file}.tmp" && mv "\${log_file}.tmp" "\$log_file"
    tmux pipe-pane -o -t "\${SESSION}:\${pane}" "cat >> \\"\$log_file\\"" 2>/dev/null || true
  fi
}

# ─── send_go_to_pane ─────────────────────────────

send_go_to_pane() {
  local pane="\$1"
  local agent_name="\$2"
  local log_file="\$3"
  local go_msg="\${4:-go}"
  local max_retries=3
  local attempt=0

  # 1. Agent alive?
  if ! check_agent_alive "\$pane" "\$agent_name"; then
    echo "[Watcher] Skipping \$agent_name - agent not running"
    return 1
  fi

  # 2. Interactive prompt?
  if check_for_interactive_prompt "\$pane"; then
    echo "[Watcher] Skipping \$agent_name - interactive prompt detected"
    return 1
  fi

  # 3. Send trigger message + Enter with retry
  # tmux send-keys is synchronous — no need to verify delivery via log growth
  # Use first 20 chars as detection marker (long messages wrap in narrow panes)
  local detect_marker="\${go_msg:0:20}"
  while (( attempt < max_retries )); do
    tmux send-keys -t "\${SESSION}:\${pane}" -l "\$go_msg" 2>/dev/null || true
    sleep 1
    tmux send-keys -t "\${SESSION}:\${pane}" Enter 2>/dev/null || true
    sleep 3

    # Check if message is stuck in input line (not submitted)
    local pane_content
    pane_content=\$(tmux capture-pane -t "\${SESSION}:\${pane}" -p 2>/dev/null | tail -5)
    if echo "\$pane_content" | grep -qF "\$detect_marker"; then
      attempt=\$((attempt + 1))
      echo "[Watcher] Retry \$attempt: Enter not registered for \$agent_name"
      tmux send-keys -t "\${SESSION}:\${pane}" C-u 2>/dev/null || true
      sleep 1
    else
      break
    fi
  done

  # Check if retries exhausted (message never submitted)
  if (( attempt >= max_retries )); then
    echo "[Watcher] FAILED: Could not deliver message to \$agent_name after \$max_retries retries"
    return 1
  fi

  echo "[Watcher] OK: Message sent to \$agent_name (fire-and-forget)"
  return 0
}

# ─── trigger_agent ───────────────────────────────

trigger_agent() {
  local turn="\$1"

  # Read task context for trigger messages (last meaningful line = latest direction)
  local task_ctx=""
  if [[ -f "\$STATE_DIR/task.md" ]]; then
    # Extract last meaningful line (skip header, separators, timestamps)
    # Consistent with cmdSubmitRalph which also uses last meaningful line
    task_ctx=\$(grep -v '^#\\|^---\\|^Created:\\|^Updated:\\|^$' "\$STATE_DIR/task.md" 2>/dev/null | tail -1)
  fi

  if [[ "\$turn" == "ralph" ]]; then
    # Check pause state
    if (( PANE0_PAUSED )); then
      local cur_size
      cur_size=\$(wc -c < "\$PANE0_LOG" 2>/dev/null | tr -d ' ' || echo 0)
      if (( cur_size != PANE0_PAUSE_SIZE )) && ! check_for_interactive_prompt "0.0"; then
        echo "[Watcher] Ralph pane resumed (output changed + prompt gone)"
        PANE0_PAUSED=0
        PANE0_PROMPT_HITS=0
      else
        echo "[Watcher] Ralph pane still paused (waiting for user)"
        return 1
      fi
    fi
    local ralph_msg="Your turn."
    if [[ -n "\$task_ctx" ]]; then
      ralph_msg="Your turn. Task: \${task_ctx}."
    fi
    ralph_msg="\${ralph_msg} Lisa's feedback is ready — run: ralph-lisa read review.md"
    send_go_to_pane "0.0" "Ralph" "\$PANE0_LOG" "\$ralph_msg"
    local rc=\$?
    if (( rc != 0 )); then
      # Track interactive prompt hits for pause
      if check_for_interactive_prompt "0.0"; then
        PANE0_PROMPT_HITS=\$((PANE0_PROMPT_HITS + 1))
        if (( PANE0_PROMPT_HITS >= 3 )); then
          PANE0_PAUSED=1
          PANE0_PAUSE_SIZE=\$(wc -c < "\$PANE0_LOG" 2>/dev/null | tr -d ' ' || echo 0)
          echo "[Watcher] PAUSED: Ralph pane waiting for user input (hit \$PANE0_PROMPT_HITS times)"
        fi
      fi
    else
      PANE0_PROMPT_HITS=0
    fi
    return \$rc
  elif [[ "\$turn" == "lisa" ]]; then
    if (( PANE1_PAUSED )); then
      local cur_size
      cur_size=\$(wc -c < "\$PANE1_LOG" 2>/dev/null | tr -d ' ' || echo 0)
      if (( cur_size != PANE1_PAUSE_SIZE )) && ! check_for_interactive_prompt "0.1"; then
        echo "[Watcher] Lisa pane resumed (output changed + prompt gone)"
        PANE1_PAUSED=0
        PANE1_PROMPT_HITS=0
      else
        echo "[Watcher] Lisa pane still paused (waiting for user)"
        return 1
      fi
    fi
    local lisa_msg="Your turn."
    if [[ -n "\$task_ctx" ]]; then
      lisa_msg="Your turn. Task: \${task_ctx}."
    fi
    lisa_msg="\${lisa_msg} Ralph's work is ready — run: ralph-lisa read work.md"
    send_go_to_pane "0.1" "Lisa" "\$PANE1_LOG" "\$lisa_msg"
    local rc=\$?
    if (( rc != 0 )); then
      if check_for_interactive_prompt "0.1"; then
        PANE1_PROMPT_HITS=\$((PANE1_PROMPT_HITS + 1))
        if (( PANE1_PROMPT_HITS >= 3 )); then
          PANE1_PAUSED=1
          PANE1_PAUSE_SIZE=\$(wc -c < "\$PANE1_LOG" 2>/dev/null | tr -d ' ' || echo 0)
          echo "[Watcher] PAUSED: Lisa pane waiting for user input (hit \$PANE1_PROMPT_HITS times)"
        fi
      fi
    else
      PANE1_PROMPT_HITS=0
    fi
    return \$rc
  fi
  return 1
}

# ─── check_and_trigger (state machine) ───────────

check_and_trigger() {
  check_session_alive

  # Heartbeat: write epoch so external tools can check watcher liveness
  echo \$(date +%s) > "\${STATE_DIR}/.watcher_heartbeat"

  # Truncate logs if too large
  truncate_log_if_needed "0.0" "\$PANE0_LOG"
  truncate_log_if_needed "0.1" "\$PANE1_LOG"

  # Control file polling (Proposal §3.11): process commands from control.txt
  if [[ -f "\$STATE_DIR/control.txt" ]]; then
    local ctrl_cmd
    ctrl_cmd=\$(cat "\$STATE_DIR/control.txt" 2>/dev/null)
    rm -f "\$STATE_DIR/control.txt"
    if [[ -n "\$ctrl_cmd" ]]; then
      echo "[Watcher] Control command: \$ctrl_cmd"
      case "\$ctrl_cmd" in
        pause)
          echo "[Watcher] PAUSED by control file. Write 'resume' to control.txt to continue."
          while true; do
            sleep 2
            if [[ -f "\$STATE_DIR/control.txt" ]]; then
              local resume_cmd
              resume_cmd=\$(cat "\$STATE_DIR/control.txt" 2>/dev/null)
              rm -f "\$STATE_DIR/control.txt"
              if [[ "\$resume_cmd" == "resume" ]]; then
                echo "[Watcher] RESUMED by control file."
                break
              else
                echo "[Watcher] Ignoring '\$resume_cmd' while paused (only 'resume' accepted)"
              fi
            fi
          done
          ;;
        resume)
          echo "[Watcher] Already running — resume ignored."
          ;;
        "msg ralph "*)
          local ralph_msg="\${ctrl_cmd#msg ralph }"
          echo "[Watcher] Sending message to Ralph: \$ralph_msg"
          send_go_to_pane "0.0" "Ralph" "\$PANE0_LOG" "\$ralph_msg"
          ;;
        "msg lisa "*)
          local lisa_msg="\${ctrl_cmd#msg lisa }"
          echo "[Watcher] Sending message to Lisa: \$lisa_msg"
          send_go_to_pane "0.1" "Lisa" "\$PANE1_LOG" "\$lisa_msg"
          ;;
        "scope-update "*)
          local new_scope="\${ctrl_cmd#scope-update }"
          echo "[Watcher] Updating scope: \$new_scope"
          ralph-lisa scope-update "\$new_scope" 2>&1 || true
          ;;
        *)
          echo "[Watcher] Unknown control command: \$ctrl_cmd"
          ;;
      esac
    fi
  fi

  # Deadlock detection (Proposal §3.2): pause if deadlock.txt exists
  if [[ -f "\$STATE_DIR/deadlock.txt" ]]; then
    local now_epoch
    now_epoch=\$(date +%s)
    if (( DEADLOCK_REMIND_TIME == 0 )) || (( now_epoch - DEADLOCK_REMIND_TIME >= 30 )); then
      echo "[Watcher] DEADLOCK detected — pausing. See: \$STATE_DIR/deadlock.txt"
      echo "[Watcher] To resolve: ralph-lisa scope-update or ralph-lisa force-turn"
      echo "[Watcher] Or remove: rm \$STATE_DIR/deadlock.txt"
      DEADLOCK_REMIND_TIME=\$now_epoch
    fi
    return
  fi

  if [[ -f "\$STATE_DIR/turn.txt" ]]; then
    CURRENT_TURN=\$(cat "\$STATE_DIR/turn.txt" 2>/dev/null || echo "")

    # Detect new turn change (reset fail count + cooldown)
    if [[ -n "\$CURRENT_TURN" && "\$CURRENT_TURN" != "\$SEEN_TURN" ]]; then
      echo "[Watcher] Turn changed: \$SEEN_TURN -> \$CURRENT_TURN"
      SEEN_TURN="\$CURRENT_TURN"
      FAIL_COUNT=0
      LAST_ACK_TIME=0

      # Write round separator to pane logs for transcript tracking
      local round_ts
      round_ts=\$(date "+%Y-%m-%d %H:%M:%S")
      local round_marker="\\n\\n===== [Turn -> \$CURRENT_TURN] \$round_ts =====\\n\\n"
      echo -e "\$round_marker" >> "\$PANE0_LOG" 2>/dev/null || true
      echo -e "\$round_marker" >> "\$PANE1_LOG" 2>/dev/null || true
    fi

    # Cooldown: skip delivery if last ack was < 30s ago (prevents re-triggering during normal work)
    # Placed AFTER turn-change detection so new turns are never suppressed
    if (( LAST_ACK_TIME > 0 )); then
      local now_epoch
      now_epoch=\$(date +%s)
      local elapsed=\$(( now_epoch - LAST_ACK_TIME ))
      if (( elapsed < 30 )); then
        return
      fi
    fi

    # Checkpoint: pause for user review at configured round intervals
    if (( CHECKPOINT_ROUNDS > 0 )); then
      local round
      round=\$(cat "\$STATE_DIR/round.txt" 2>/dev/null || echo 1)
      if (( round > 1 )) && (( (round - 1) % CHECKPOINT_ROUNDS == 0 )); then
        # At checkpoint round — file is source of truth (crash-safe)
        if [[ -f "\${STATE_DIR}/.checkpoint_ack" ]]; then
          # Acked — proceed (keep file until round advances past checkpoint)
          :
        else
          # Not acked — pause with periodic 30s reminder
          local now_epoch
          now_epoch=\$(date +%s)
          if (( CHECKPOINT_REMIND_TIME == 0 )) || (( now_epoch - CHECKPOINT_REMIND_TIME >= 30 )); then
            echo "[Watcher] CHECKPOINT: Round \$round. Review direction before continuing."
            echo "[Watcher] To continue: touch \${STATE_DIR}/.checkpoint_ack"
            CHECKPOINT_REMIND_TIME=\$now_epoch
          fi
          return
        fi
      else
        # Not at checkpoint round — clean up stale ack from previous checkpoint
        rm -f "\${STATE_DIR}/.checkpoint_ack"
      fi
    fi

    # Need to deliver? (seen but not yet acked)
    if [[ -n "\$SEEN_TURN" && "\$SEEN_TURN" != "\$ACKED_TURN" ]]; then
      # Backoff on repeated failures
      if (( FAIL_COUNT >= 30 )); then
        echo "[Watcher] ALERT: \$FAIL_COUNT consecutive failures. Manual intervention needed."
        sleep 30
      elif (( FAIL_COUNT >= 10 )); then
        echo "[Watcher] DEGRADED: \$FAIL_COUNT consecutive failures, slowing down..."
        sleep 30
      fi

      if trigger_agent "\$SEEN_TURN"; then
        ACKED_TURN="\$SEEN_TURN"
        FAIL_COUNT=0
        LAST_ACK_TIME=\$(date +%s)
        echo "[Watcher] Turn acknowledged: \$SEEN_TURN (cooldown 30s)"
      else
        FAIL_COUNT=\$((FAIL_COUNT + 1))
        echo "[Watcher] Trigger failed (fail_count=\$FAIL_COUNT), will retry next cycle"
      fi
    fi
  fi
}

# ─── Main ────────────────────────────────────────

echo "[Watcher] Starting v3... (Ctrl+C to stop)"
echo "[Watcher] Monitoring \$STATE_DIR/turn.txt"
echo "[Watcher] Pane logs: \$PANE0_LOG, \$PANE1_LOG"
if (( CHECKPOINT_ROUNDS > 0 )); then
  echo "[Watcher] Checkpoint every \$CHECKPOINT_ROUNDS rounds (RL_CHECKPOINT_ROUNDS)"
fi
echo "[Watcher] PID: \$\$"

sleep 5
check_and_trigger

`;

  // Event accelerator (optional background subprocess)
  if (watcher === "fswatch") {
    watcherContent += `# Event accelerator: fswatch touches flag file to wake main loop faster
fswatch -o "\$STATE_DIR/turn.txt" 2>/dev/null | while read; do
  touch "\${STATE_DIR}/.turn_changed"
done &
ACCEL_PID=\$!
echo "[Watcher] Event accelerator started (fswatch, PID \$ACCEL_PID)"

`;
  } else if (watcher === "inotifywait") {
    watcherContent += `# Event accelerator: inotifywait touches flag file to wake main loop faster
while inotifywait -e modify "\$STATE_DIR/turn.txt" 2>/dev/null; do
  touch "\${STATE_DIR}/.turn_changed"
done &
ACCEL_PID=\$!
echo "[Watcher] Event accelerator started (inotifywait, PID \$ACCEL_PID)"

`;
  }

  // Main polling loop (always runs, event accelerator just speeds it up)
  watcherContent += `# Main loop: polling + optional event acceleration
while true; do
  check_and_trigger
  # If event accelerator touched the flag, skip sleep
  if [[ -f "\${STATE_DIR}/.turn_changed" ]]; then
    rm -f "\${STATE_DIR}/.turn_changed"
  else
    sleep 2
  fi
done
`;

  writeFile(watcherScript, watcherContent);
  fs.chmodSync(watcherScript, 0o755);

  // Launch tmux session
  // Layout: Ralph (left) | Lisa (right), Watcher runs in background
  execSync(`tmux kill-session -t "${sessionName}" 2>/dev/null || true`);

  // Pane 0: Ralph (left), Pane 1: Lisa (right)
  execSync(
    `tmux new-session -d -s "${sessionName}" -n "main" -c "${projectDir}"`
  );

  // Set authoritative state directory in tmux env (Proposal §3.10)
  // Both agents resolve to this regardless of their working directory
  execSync(
    `tmux set-environment -t "${sessionName}" RL_STATE_DIR "${dir}"`
  );

  execSync(
    `tmux split-window -h -t "${sessionName}" -c "${projectDir}"`
  );

  // Pane 0 = Ralph (left), Pane 1 = Lisa (right)
  execSync(
    `tmux send-keys -t "${sessionName}:0.0" "echo '=== Ralph (Claude Code) ===' && ${claudeCmd}" Enter`
  );
  execSync(
    `tmux send-keys -t "${sessionName}:0.1" "echo '=== Lisa (Codex) ===' && ${codexCmd}" Enter`
  );
  execSync(`tmux select-pane -t "${sessionName}:0.0"`);

  // Kill old wrapper process if present (prevents duplication on repeated cmdAuto)
  const wrapperPidFile = path.join(dir, "watcher_wrapper.pid");
  if (fs.existsSync(wrapperPidFile)) {
    const oldWrapperPid = readFile(wrapperPidFile).trim();
    if (oldWrapperPid) {
      try {
        // Validate process identity before killing (avoid PID reuse hazard)
        const oldArgs = execSync(
          `ps -p ${oldWrapperPid} -o args= 2>/dev/null || true`
        ).toString().trim();
        if (oldArgs && oldArgs.includes("tmux has-session")) {
          execSync(`kill ${oldWrapperPid} 2>/dev/null || true`);
          try { execSync(`sleep 0.5`); } catch { /* ignore */ }
        }
      } catch {
        // ignore — process already dead or PID invalid
      }
    }
    fs.unlinkSync(wrapperPidFile);
  }

  // Watcher runs in background with session-guarded restart loop
  const watcherLog = path.join(dir, "watcher.log");
  execSync(
    `bash -c 'nohup bash -c '"'"'while tmux has-session -t "${sessionName}" 2>/dev/null; do bash "${watcherScript}"; EXIT_CODE=$?; if ! tmux has-session -t "${sessionName}" 2>/dev/null; then echo "[Watcher] Session gone, not restarting." >> "${watcherLog}"; break; fi; echo "[Watcher] Exited ($EXIT_CODE), restarting in 5s..." >> "${watcherLog}"; sleep 5; done'"'"' > "${watcherLog}" 2>&1 & echo $! > "${wrapperPidFile}"'`
  );

  console.log("");
  console.log(line());
  console.log("Auto Mode Started!");
  console.log(line());
  console.log("");
  console.log("Layout:");
  console.log("  +-----------+-----------+");
  console.log("  |   Ralph   |   Lisa    |");
  console.log("  |  (Claude) |  (Codex)  |");
  console.log("  +-----------+-----------+");
  console.log("  Watcher runs in background (log: .dual-agent/watcher.log)");
  console.log("  Pane output captured: .dual-agent/pane0.log, .dual-agent/pane1.log");
  console.log("");
  console.log("Attaching to session...");
  console.log(line());

  execSync(`tmux attach-session -t "${sessionName}"`, { stdio: "inherit" });
}

// ─── policy ──────────────────────────────────────

export function cmdPolicy(args: string[]): void {
  const sub = args[0];

  if (sub === "check-consensus") {
    cmdPolicyCheckConsensus();
    return;
  }

  if (sub === "check-next-step") {
    cmdPolicyCheckNextStep();
    return;
  }

  if (sub !== "check") {
    console.error("Usage:");
    console.error("  ralph-lisa policy check <ralph|lisa>");
    console.error("  ralph-lisa policy check-consensus");
    console.error("  ralph-lisa policy check-next-step");
    process.exit(1);
  }
  const role = args[1] as "ralph" | "lisa";
  if (role !== "ralph" && role !== "lisa") {
    console.error("Usage: ralph-lisa policy check <ralph|lisa>");
    process.exit(1);
  }

  checkSession();
  const dir = stateDir();
  const file = role === "ralph" ? "work.md" : "review.md";
  const raw = readFile(path.join(dir, file));
  if (!raw) {
    console.log("No submission to check.");
    return;
  }

  const content = extractSubmissionContent(raw);
  if (!content) {
    console.log("No submission content found.");
    return;
  }

  const tag = extractTag(content);
  if (!tag) {
    console.log("No valid tag found in submission.");
    return;
  }

  const violations =
    role === "ralph" ? checkRalph(tag, content) : checkLisa(tag, content);

  if (violations.length === 0) {
    console.log("Policy check passed.");
    return;
  }

  console.error("");
  console.error("⚠️  Policy violations:");
  for (const v of violations) {
    console.error(`  - ${v.message}`);
  }
  console.error("");

  // Standalone policy check always exits non-zero on violations,
  // regardless of RL_POLICY_MODE. This is a hard gate for use in
  // scripts/hooks. RL_POLICY_MODE only affects inline checks during submit.
  process.exit(1);
}

/**
 * Check if the most recent round has both agents submitting [CONSENSUS].
 */
function cmdPolicyCheckConsensus(): void {
  checkSession();
  const dir = stateDir();

  const workRaw = readFile(path.join(dir, "work.md"));
  const reviewRaw = readFile(path.join(dir, "review.md"));

  const workContent = extractSubmissionContent(workRaw);
  const reviewContent = extractSubmissionContent(reviewRaw);

  const workTag = workContent ? extractTag(workContent) : "";
  const reviewTag = reviewContent ? extractTag(reviewContent) : "";

  const issues: string[] = [];
  if (workTag !== "CONSENSUS") {
    issues.push(
      `Ralph's latest submission is [${workTag || "none"}], not [CONSENSUS].`
    );
  }
  if (reviewTag !== "CONSENSUS") {
    issues.push(
      `Lisa's latest submission is [${reviewTag || "none"}], not [CONSENSUS].`
    );
  }

  if (issues.length === 0) {
    console.log("Consensus reached: both agents submitted [CONSENSUS].");
    return;
  }

  console.error("Consensus NOT reached:");
  for (const issue of issues) {
    console.error(`  - ${issue}`);
  }
  process.exit(1);
}

/**
 * Comprehensive check for proceeding to the next step:
 * 1. Both agents have submitted [CONSENSUS]
 * 2. Ralph's submission passes policy checks
 * 3. Lisa's submission passes policy checks
 */
function cmdPolicyCheckNextStep(): void {
  checkSession();
  const dir = stateDir();

  const workRaw = readFile(path.join(dir, "work.md"));
  const reviewRaw = readFile(path.join(dir, "review.md"));

  const workContent = extractSubmissionContent(workRaw);
  const reviewContent = extractSubmissionContent(reviewRaw);

  const workTag = workContent ? extractTag(workContent) : "";
  const reviewTag = reviewContent ? extractTag(reviewContent) : "";

  const allIssues: string[] = [];

  // 1. Consensus check
  if (workTag !== "CONSENSUS") {
    allIssues.push(
      `Ralph's latest is [${workTag || "none"}], not [CONSENSUS].`
    );
  }
  if (reviewTag !== "CONSENSUS") {
    allIssues.push(
      `Lisa's latest is [${reviewTag || "none"}], not [CONSENSUS].`
    );
  }

  // 2. Policy checks on latest submissions (if content exists)
  if (workContent && workTag) {
    const rv = checkRalph(workTag, workContent);
    for (const v of rv) allIssues.push(`Ralph: ${v.message}`);
  }
  if (reviewContent && reviewTag) {
    const lv = checkLisa(reviewTag, reviewContent);
    for (const v of lv) allIssues.push(`Lisa: ${v.message}`);
  }

  if (allIssues.length === 0) {
    console.log("Ready to proceed: consensus reached and all checks pass.");
    return;
  }

  console.error("Not ready to proceed:");
  for (const issue of allIssues) {
    console.error(`  - ${issue}`);
  }
  process.exit(1);
}

/**
 * Extract the actual submission content from work.md/review.md.
 * The file has metadata headers; the submission content is the part
 * that starts with a [TAG] line.
 */
function extractSubmissionContent(raw: string): string {
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (extractTag(lines[i])) {
      return lines.slice(i).join("\n");
    }
  }
  return "";
}

// ─── logs ────────────────────────────────────────

export function cmdLogs(args: string[]): void {
  const dir = stateDir();
  const logsDir = path.join(dir, "logs");

  // Also include live pane logs
  const liveFiles: string[] = [];
  for (const f of ["pane0.log", "pane1.log"]) {
    const p = path.join(dir, f);
    if (fs.existsSync(p) && fs.statSync(p).size > 0) liveFiles.push(p);
  }

  const archivedFiles: string[] = [];
  if (fs.existsSync(logsDir)) {
    archivedFiles.push(
      ...fs.readdirSync(logsDir)
        .filter((f) => f.endsWith(".log"))
        .sort()
        .map((f) => path.join(logsDir, f))
    );
  }

  const sub = args[0] || "";

  if (sub === "cat" || sub === "view") {
    // ralph-lisa logs cat [filename] — view a specific log or latest
    const target = args[1];
    let file: string | undefined;

    if (target) {
      // Try exact match in logs/ or as pane name
      file = [...archivedFiles, ...liveFiles].find((f) => path.basename(f) === target || f.endsWith(target));
    } else {
      // Default: show live pane logs
      if (liveFiles.length > 0) {
        for (const f of liveFiles) {
          console.log(`\n${"=".repeat(60)}`);
          console.log(`  ${path.basename(f)} (live)`);
          console.log(`${"=".repeat(60)}\n`);
          console.log(fs.readFileSync(f, "utf-8"));
        }
        return;
      }
      console.log("No live pane logs. Use 'ralph-lisa logs cat <filename>' to view archived logs.");
      return;
    }

    if (file && fs.existsSync(file)) {
      console.log(fs.readFileSync(file, "utf-8"));
    } else {
      console.error(`Log not found: ${target}`);
      process.exit(1);
    }
    return;
  }

  // Default: list all logs
  console.log("Transcript Logs");
  console.log("===============\n");

  if (liveFiles.length > 0) {
    console.log("Live (current session):");
    for (const f of liveFiles) {
      const stat = fs.statSync(f);
      const size = stat.size > 1024 ? `${(stat.size / 1024).toFixed(1)}KB` : `${stat.size}B`;
      console.log(`  ${path.basename(f)}  ${size}  ${stat.mtime.toISOString().slice(0, 19)}`);
    }
    console.log("");
  }

  if (archivedFiles.length > 0) {
    console.log("Archived (previous sessions):");
    for (const f of archivedFiles) {
      const stat = fs.statSync(f);
      const size = stat.size > 1024 ? `${(stat.size / 1024).toFixed(1)}KB` : `${stat.size}B`;
      console.log(`  ${path.basename(f)}  ${size}  ${stat.mtime.toISOString().slice(0, 19)}`);
    }
    console.log("");
  }

  if (liveFiles.length === 0 && archivedFiles.length === 0) {
    console.log("No transcript logs found. Logs are created during auto mode sessions.");
  }

  console.log("\nUsage:");
  console.log("  ralph-lisa logs              List all logs");
  console.log("  ralph-lisa logs cat           View live pane logs");
  console.log("  ralph-lisa logs cat <file>    View specific log file");
}

// ─── remote (ttyd) ──────────────────────────────

/**
 * Check if a PID belongs to a ttyd process to avoid killing unrelated processes.
 */
function isTtydProcess(pid: number): boolean {
  try {
    // Check if process is alive first
    process.kill(pid, 0);
    // Verify it's actually ttyd by checking command line
    const cmdline = execSync(`ps -p ${pid} -o comm=`, { encoding: "utf-8", stdio: "pipe" }).trim();
    return cmdline.includes("ttyd");
  } catch {
    return false;
  }
}

export function cmdRemote(args: string[]): void {
  checkSession();
  const dir = stateDir();
  const pidFile = path.join(dir, "ttyd.pid");

  // --stop / stop: kill existing ttyd
  if (args.includes("--stop") || args.includes("stop")) {
    if (!fs.existsSync(pidFile)) {
      console.log("No ttyd server running.");
      return;
    }
    const pid = Number(readFile(pidFile));
    if (isTtydProcess(pid)) {
      process.kill(pid, "SIGTERM");
      console.log(`Stopped ttyd (PID ${pid}).`);
    } else {
      console.log(`Stale PID ${pid} (not a ttyd process). Cleaning up.`);
    }
    try { fs.unlinkSync(pidFile); } catch {}
    // Clean up the dedicated remote tmux session
    try { execSync("tmux list-sessions -F '#{session_name}'", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] })
      .trim().split("\n")
      .filter((s: string) => s.endsWith("-remote"))
      .forEach((s: string) => { try { execSync(`tmux kill-session -t ${s}`, { stdio: "pipe" }); } catch {} });
    } catch {}
    return;
  }

  // Check ttyd installed
  try {
    execSync("which ttyd", { stdio: "pipe" });
  } catch {
    console.error("Error: ttyd not found.");
    console.error("Install: brew install ttyd (macOS) / apt install ttyd (Linux)");
    console.error("Or visit: https://github.com/tsl0922/ttyd");
    process.exit(1);
  }

  // Find tmux session: explicit arg > auto-detect > list available
  const knownFlags = ["--port", "--auth", "--stop"];
  const reservedWords = ["stop"];
  const explicitSession = args.find(
    (a) => !a.startsWith("--") && !reservedWords.includes(a) && !knownFlags.includes(args[args.indexOf(a) - 1])
  );

  // Resolve session: explicit arg > auto-detect from cwd > single running rll-* session
  let rllSessions: string[] = [];
  try {
    rllSessions = execSync("tmux list-sessions -F '#{session_name}'", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })
      .trim()
      .split("\n")
      .filter((s: string) => s.startsWith("rll-") && !/-\d+$/.test(s));
  } catch {}

  let sessionName: string;
  if (explicitSession) {
    sessionName = explicitSession;
  } else {
    // Try auto-detect from project dir
    const projectRoot = findProjectRoot() || process.cwd();
    const detected = generateSessionName(projectRoot);
    if (rllSessions.includes(detected)) {
      sessionName = detected;
    } else if (rllSessions.length === 1) {
      // Only one rll-* session running — use it
      sessionName = rllSessions[0];
    } else {
      sessionName = detected; // will fail below with helpful hint
    }
  }

  try {
    execSync(`tmux has-session -t ${sessionName}`, { stdio: "pipe" });
  } catch {
    let hint = "";
    if (rllSessions.length > 0) {
      hint = `\nAvailable sessions:\n${rllSessions.map((s: string) => `  ${s}`).join("\n")}\n\nUsage: ralph-lisa remote <session-name>`;
    }
    console.error(`Error: tmux session '${sessionName}' not found.${hint}`);
    if (!hint) console.error("Start a session first: ralph-lisa auto \"task\"");
    process.exit(1);
  }

  // Parse options
  let port = 7681;
  let authFlag = "";
  const portIdx = args.indexOf("--port");
  if (portIdx !== -1 && args[portIdx + 1]) {
    port = Number(args[portIdx + 1]);
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error("Error: --port must be a valid port number (1-65535).");
      process.exit(1);
    }
  }
  const authIdx = args.indexOf("--auth");
  if (authIdx !== -1 && args[authIdx + 1]) {
    authFlag = `-c ${args[authIdx + 1]}`;
  }

  // Kill existing ttyd if running
  if (fs.existsSync(pidFile)) {
    const oldPid = Number(readFile(pidFile));
    if (isTtydProcess(oldPid)) {
      try { process.kill(oldPid, "SIGTERM"); } catch {}
    }
    try { fs.unlinkSync(pidFile); } catch {}
  }

  // Create a dedicated grouped session for ttyd so browser clients
  // get their own tmux client (independent input/scroll from Mac).
  // Re-use the same grouped session across browser refreshes.
  const remoteSession = `${sessionName}-remote`;
  try {
    execSync(`tmux has-session -t ${remoteSession}`, { stdio: "pipe" });
  } catch {
    execSync(`tmux new-session -d -s ${remoteSession} -t ${sessionName}`, { stdio: "pipe" });
  }

  // Launch ttyd — attach to the dedicated remote session
  const { spawn } = require("node:child_process");
  const ttydArgs = ["-p", String(port)];
  if (authFlag) {
    const [user, pass] = args[authIdx + 1].split(":");
    ttydArgs.push("-c", `${user}:${pass}`);
  }
  ttydArgs.push("tmux", "attach", "-t", remoteSession);

  const child = spawn("ttyd", ttydArgs, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  writeFile(pidFile, String(child.pid));

  // Detect LAN IP
  let lanIp = "localhost";
  try {
    const os = require("node:os");
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === "IPv4" && !net.internal) {
          lanIp = net.address;
          break;
        }
      }
      if (lanIp !== "localhost") break;
    }
  } catch {}

  console.log(line());
  console.log("ttyd server started");
  console.log(line());
  console.log("");
  console.log(`  Local:   http://localhost:${port}`);
  console.log(`  Network: http://${lanIp}:${port}`);
  console.log("");
  console.log(`  Session: ${sessionName}`);
  console.log(`  PID:     ${child.pid}`);
  if (authFlag) {
    console.log("  Auth:    enabled");
  } else {
    console.log("  Auth:    none (use --auth user:pass for LAN access)");
  }
  console.log("");
  console.log("Stop with: ralph-lisa remote --stop");
  console.log(line());
}

// ─── state-dir ───────────────────────────────────

export function cmdStateDir(args: string[]): void {
  const setPath = args[0];

  if (setPath) {
    // Set mode: write to tmux env if in tmux, otherwise show instructions
    const resolvedPath = path.resolve(setPath);
    if (process.env.TMUX) {
      try {
        execSync(`tmux set-environment RL_STATE_DIR "${resolvedPath}"`, { stdio: "pipe" });
        console.log(`State dir set (tmux env): ${resolvedPath}`);
      } catch {
        console.error("Error: Failed to set tmux environment variable.");
        process.exit(1);
      }
    } else {
      console.log(`Not in tmux session. Set manually:`);
      console.log(`  export RL_STATE_DIR="${resolvedPath}"`);
    }
    return;
  }

  // Show mode: display all sources + active
  const tmuxDir = getTmuxStateDir();
  const envDir = process.env.RL_STATE_DIR || null;
  const root = findProjectRoot();
  const autoDir = root ? path.join(root, STATE_DIR) : path.join(process.cwd(), STATE_DIR);
  const resolved = resolveStateDir();

  console.log(`tmux env:    ${tmuxDir || "(not set)"}`);
  console.log(`shell env:   ${envDir || "(not set)"}`);
  console.log(`auto-detect: ${autoDir}`);
  console.log(`→ using:     ${resolved.dir}   [${resolved.source}]`);
}

// ─── add-context ─────────────────────────────────

export function cmdAddContext(args: string[]): void {
  checkSession();
  const text = args.join(" ");
  if (!text) {
    console.error('Usage: ralph-lisa add-context "user directive or context note"');
    process.exit(1);
  }

  const dir = stateDir();
  const contextPath = path.join(dir, "context.md");
  const ts = timestamp();

  if (!fs.existsSync(contextPath)) {
    writeFile(contextPath, `# Context Notes\n\nRuntime directives from Ralph (visible to Lisa).\n\n`);
  }
  fs.appendFileSync(contextPath, `- [${ts}] ${text}\n`, "utf-8");

  console.log(`Context added: ${text}`);
  console.log(`(Written to ${contextPath})`);
}

// ─── doctor ──────────────────────────────────────

export function cmdDoctor(args: string[]): void {
  const strict = args.includes("--strict");
  const { execSync } = require("node:child_process");

  console.log(line());
  console.log("Ralph-Lisa Loop - Dependency Check");
  console.log(line());
  console.log("");

  let allOk = true;
  let hasWatcher = false;

  const checks: Array<{
    name: string;
    cmd: string;
    versionCmd?: string;
    required: boolean;
    installHint: string;
  }> = [
    {
      name: "tmux",
      cmd: "which tmux",
      versionCmd: "tmux -V",
      required: true,
      installHint: "brew install tmux (macOS) / apt install tmux (Linux)",
    },
    {
      name: "claude (Claude Code CLI)",
      cmd: "which claude",
      versionCmd: "claude --version",
      required: true,
      installHint: "npm install -g @anthropic-ai/claude-code",
    },
    {
      name: "codex (OpenAI Codex CLI)",
      cmd: "which codex",
      versionCmd: "codex --version",
      required: true,
      installHint: "npm install -g @openai/codex",
    },
    {
      name: "fswatch (file watcher)",
      cmd: "which fswatch",
      required: false,
      installHint: "brew install fswatch (macOS)",
    },
    {
      name: "inotifywait (file watcher)",
      cmd: "which inotifywait",
      required: false,
      installHint: "apt install inotify-tools (Linux)",
    },
    {
      name: "ttyd (remote access)",
      cmd: "which ttyd",
      versionCmd: "ttyd --version",
      required: false,
      installHint: "brew install ttyd (macOS) / apt install ttyd (Linux)",
    },
  ];

  for (const check of checks) {
    try {
      execSync(check.cmd, { stdio: "pipe" });
      let version = "";
      if (check.versionCmd) {
        try {
          version = execSync(check.versionCmd, {
            stdio: "pipe",
            encoding: "utf-8",
            timeout: 5000,
          })
            .trim()
            .split("\n")[0];
        } catch {}
      }
      console.log(`  OK  ${check.name}${version ? ` (${version})` : ""}`);
      if (check.name.includes("fswatch") || check.name.includes("inotifywait")) {
        hasWatcher = true;
      }
    } catch {
      if (check.required) {
        console.log(`  MISSING  ${check.name}`);
        console.log(`           Install: ${check.installHint}`);
        allOk = false;
      } else {
        console.log(`  --  ${check.name} (optional)`);
      }
    }
  }

  if (!hasWatcher) {
    console.log("");
    console.log(
      "  Note: No file watcher found. Auto mode will use polling (slower)."
    );
    console.log(
      "  Install fswatch or inotify-tools for event-driven turn detection."
    );
  }

  // Node version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1), 10);
  if (majorVersion >= 18) {
    console.log(`  OK  Node.js ${nodeVersion}`);
  } else {
    console.log(`  WARNING  Node.js ${nodeVersion} (requires >= 18)`);
    allOk = false;
  }

  console.log("");
  if (allOk) {
    console.log("All required dependencies satisfied.");
  } else {
    console.log(
      "Some required dependencies missing. Install them and re-run 'ralph-lisa doctor'."
    );
  }
  console.log(line());

  if (strict && !allOk) {
    process.exit(1);
  }
}
