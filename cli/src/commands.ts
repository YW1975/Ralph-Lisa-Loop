/**
 * CLI commands for Ralph-Lisa Loop.
 * Direct port of io.sh logic to Node/TS.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  STATE_DIR,
  ARCHIVE_DIR,
  stateDir,
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
import { runPolicyCheck, checkRalph, checkLisa } from "./policy.js";

function line(ch = "=", len = 40): string {
  return ch.repeat(len);
}

// ─── init ────────────────────────────────────────

export function cmdInit(args: string[]): void {
  const task = args.join(" ");
  if (!task) {
    console.error('Usage: ralph-lisa init "task description"');
    process.exit(1);
  }

  const dir = stateDir();
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
    'Ralph should start with: ralph-lisa submit-ralph "[PLAN] summary..."'
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
  const content = args.join(" ");
  if (!content) {
    console.error(
      'Usage: ralph-lisa submit-ralph "[TAG] summary\\n\\ndetails..."'
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

  // Policy check
  if (!runPolicyCheck("ralph", tag, content)) {
    process.exit(1);
  }

  const round = getRound();
  const step = getStep();
  const ts = timestamp();
  const summary = extractSummary(content);
  const dir = stateDir();

  writeFile(
    path.join(dir, "work.md"),
    `# Ralph Work\n\n## [${tag}] Round ${round} | Step: ${step}\n**Updated**: ${ts}\n**Summary**: ${summary}\n\n${content}\n`
  );

  appendHistory("Ralph", content);
  updateLastAction("Ralph", content);
  setTurn("lisa");

  console.log(line());
  console.log(`Submitted: [${tag}] ${summary}`);
  console.log("Turn passed to: Lisa");
  console.log(line());
  console.log("");
  console.log("Now wait for Lisa. Check with: ralph-lisa whose-turn");
}

// ─── submit-lisa ─────────────────────────────────

export function cmdSubmitLisa(args: string[]): void {
  checkSession();
  const content = args.join(" ");
  if (!content) {
    console.error(
      'Usage: ralph-lisa submit-lisa "[TAG] summary\\n\\ndetails..."'
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

  // Policy check
  if (!runPolicyCheck("lisa", tag, content)) {
    process.exit(1);
  }

  const round = getRound();
  const step = getStep();
  const ts = timestamp();
  const summary = extractSummary(content);
  const dir = stateDir();

  writeFile(
    path.join(dir, "review.md"),
    `# Lisa Review\n\n## [${tag}] Round ${round} | Step: ${step}\n**Updated**: ${ts}\n**Summary**: ${summary}\n\n${content}\n`
  );

  appendHistory("Lisa", content);
  updateLastAction("Lisa", content);
  setTurn("ralph");

  // Increment round
  const nextRound = (parseInt(round, 10) || 0) + 1;
  setRound(nextRound);

  console.log(line());
  console.log(`Submitted: [${tag}] ${summary}`);
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
    console.error("  work.md    - Ralph's work");
    console.error("  review.md  - Lisa's feedback");
    process.exit(1);
  }

  const filePath = path.join(stateDir(), file);
  if (fs.existsSync(filePath)) {
    console.log(fs.readFileSync(filePath, "utf-8"));
  } else {
    console.log(`(File ${file} does not exist)`);
  }
}

// ─── step ────────────────────────────────────────

export function cmdStep(args: string[]): void {
  checkSession();
  const stepName = args.join(" ");
  if (!stepName) {
    console.error('Usage: ralph-lisa step "step name"');
    process.exit(1);
  }

  setStep(stepName);
  setRound(1);

  const dir = stateDir();
  const ts = timestamp();
  const entry = `\n---\n\n# Step: ${stepName}\n\nStarted: ${ts}\n\n`;
  fs.appendFileSync(path.join(dir, "history.md"), entry, "utf-8");

  console.log(`Entered step: ${stepName} (round reset to 1)`);
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
  const archiveDir = path.join(process.cwd(), ARCHIVE_DIR);
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

  // 1. Append Ralph role to CLAUDE.md
  const claudeMd = path.join(resolvedDir, "CLAUDE.md");
  if (fs.existsSync(claudeMd) && readFile(claudeMd).includes(MARKER)) {
    console.log("[Claude] Ralph role already in CLAUDE.md, skipping...");
  } else {
    console.log("[Claude] Appending Ralph role to CLAUDE.md...");
    const ralphRole = readFile(path.join(templatesDir, "roles", "ralph.md"));
    if (fs.existsSync(claudeMd)) {
      fs.appendFileSync(claudeMd, "\n\n", "utf-8");
    }
    fs.appendFileSync(claudeMd, ralphRole, "utf-8");
    console.log("[Claude] Done.");
  }

  // 2. Create/update CODEX.md with Lisa role
  const codexMd = path.join(resolvedDir, "CODEX.md");
  if (fs.existsSync(codexMd) && readFile(codexMd).includes(MARKER)) {
    console.log("[Codex] Lisa role already in CODEX.md, skipping...");
  } else {
    console.log("[Codex] Creating CODEX.md with Lisa role...");
    const lisaRole = readFile(path.join(templatesDir, "roles", "lisa.md"));
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
      const sessionName = "ralph-lisa";
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
    console.error("Error: 'claude' command not found.");
    process.exit(1);
  }

  try {
    execSync("which codex", { stdio: "pipe" });
  } catch {
    console.error("Error: 'codex' command not found.");
    process.exit(1);
  }

  // Check file watcher
  let watcher = "";
  try {
    execSync("which fswatch", { stdio: "pipe" });
    watcher = "fswatch";
  } catch {
    try {
      execSync("which inotifywait", { stdio: "pipe" });
      watcher = "inotifywait";
    } catch {
      console.error("Error: File watcher required.");
      console.error(
        "Install: brew install fswatch (macOS) or apt install inotify-tools (Linux)"
      );
      process.exit(1);
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

  const sessionName = "ralph-lisa-auto";
  const dir = stateDir(projectDir);
  fs.mkdirSync(dir, { recursive: true });

  // Create watcher script
  const watcherScript = path.join(dir, "watcher.sh");
  let watcherContent = `#!/bin/bash
# Turn watcher - triggers agents on turn change

STATE_DIR=".dual-agent"
LAST_TURN=""

send_go_to_pane() {
  local pane="$1"
  local max_retries=3
  local attempt=0
  while (( attempt < max_retries )); do
    tmux send-keys -t ${sessionName}:\${pane} -l "go" 2>/dev/null || true
    sleep 3
    tmux send-keys -t ${sessionName}:\${pane} Enter 2>/dev/null || true
    sleep 2
    # Check if "go" is still sitting in the input (Enter didn't register)
    local pane_content
    pane_content=$(tmux capture-pane -t ${sessionName}:\${pane} -p 2>/dev/null | tail -3)
    if echo "$pane_content" | grep -Eq "^(> |❯ |› )go$"; then
      attempt=$((attempt + 1))
      echo "[Watcher] Retry $attempt: Enter not registered on pane \${pane}"
      # Clear the stuck "go" text and retry
      tmux send-keys -t ${sessionName}:\${pane} C-u 2>/dev/null || true
      sleep 1
    else
      break
    fi
  done
}

trigger_agent() {
  local turn="$1"
  if [[ "$turn" == "ralph" ]]; then
    send_go_to_pane "0.0"
  elif [[ "$turn" == "lisa" ]]; then
    send_go_to_pane "0.1"
  fi
}

check_and_trigger() {
  if [[ -f "$STATE_DIR/turn.txt" ]]; then
    CURRENT_TURN=$(cat "$STATE_DIR/turn.txt" 2>/dev/null || echo "")
    if [[ -n "$CURRENT_TURN" && "$CURRENT_TURN" != "$LAST_TURN" ]]; then
      echo "[Watcher] Turn changed: $LAST_TURN -> $CURRENT_TURN"
      LAST_TURN="$CURRENT_TURN"
      sleep 5
      trigger_agent "$CURRENT_TURN"
    fi
  fi
}

echo "[Watcher] Starting... (Ctrl+C to stop)"
echo "[Watcher] Monitoring $STATE_DIR/turn.txt"

sleep 2
check_and_trigger

`;

  if (watcher === "fswatch") {
    watcherContent += `fswatch -o "$STATE_DIR/turn.txt" 2>/dev/null | while read; do
  check_and_trigger
done
`;
  } else if (watcher === "inotifywait") {
    watcherContent += `while inotifywait -e modify "$STATE_DIR/turn.txt" 2>/dev/null; do
  check_and_trigger
done
`;
  } else {
    watcherContent += `while true; do
  check_and_trigger
  sleep 2
done
`;
  }

  writeFile(watcherScript, watcherContent);
  fs.chmodSync(watcherScript, 0o755);

  // Launch tmux session
  // Layout: Ralph (left) | Lisa (right), Watcher runs in background
  execSync(`tmux kill-session -t "${sessionName}" 2>/dev/null || true`);

  // Pane 0: Ralph (left), Pane 1: Lisa (right)
  execSync(
    `tmux new-session -d -s "${sessionName}" -n "main" -c "${projectDir}"`
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

  // Watcher runs in background (logs to .dual-agent/watcher.log)
  const watcherLog = path.join(dir, "watcher.log");
  execSync(`bash -c 'nohup "${watcherScript}" > "${watcherLog}" 2>&1 &'`);

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
