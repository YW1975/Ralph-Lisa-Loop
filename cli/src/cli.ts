#!/usr/bin/env node

/**
 * ralph-lisa CLI - Turn-based dual-agent collaboration.
 * Replaces io.sh with Node/TS implementation.
 *
 * Usage: ralph-lisa <command> [args...]
 */

import {
  cmdInit,
  cmdInitProject,
  cmdUninit,
  cmdWhoseTurn,
  cmdSubmitRalph,
  cmdSubmitLisa,
  cmdStatus,
  cmdRead,
  cmdStep,
  cmdHistory,
  cmdArchive,
  cmdClean,
  cmdStart,
  cmdAuto,
  cmdPolicy,
} from "./commands.js";

const args = process.argv.slice(2);
const cmd = args[0] || "";
const rest = args.slice(1);

switch (cmd) {
  case "init":
    // If first arg after init looks like a path, use cmdInitProject
    // If it looks like a task description, also use cmdInitProject (with no path)
    cmdInitProject(rest);
    break;

  case "uninit":
    cmdUninit();
    break;

  case "whose-turn":
    cmdWhoseTurn();
    break;

  case "submit-ralph":
    cmdSubmitRalph(rest);
    break;

  case "submit-lisa":
    cmdSubmitLisa(rest);
    break;

  case "status":
    cmdStatus();
    break;

  case "read":
    cmdRead(rest);
    break;

  case "step":
    cmdStep(rest);
    break;

  case "history":
    cmdHistory();
    break;

  case "archive":
    cmdArchive(rest);
    break;

  case "clean":
    cmdClean();
    break;

  case "start":
    cmdStart(rest);
    break;

  case "auto":
    cmdAuto(rest);
    break;

  case "policy":
    cmdPolicy(rest);
    break;

  case "help":
  case "--help":
  case "-h":
  case "":
    showHelp();
    break;

  case "--version":
  case "-v":
    showVersion();
    break;

  default:
    console.error(`Unknown command: ${cmd}`);
    console.error('Run "ralph-lisa --help" for usage.');
    process.exit(1);
}

function showHelp(): void {
  console.log("Ralph Lisa Dual-Agent Loop - CLI");
  console.log("");
  console.log("Project Setup:");
  console.log("  ralph-lisa init [dir]              Initialize project");
  console.log("  ralph-lisa uninit                  Remove from project");
  console.log('  ralph-lisa start "task"             Launch both agents');
  console.log('  ralph-lisa auto "task"              Auto mode (tmux)');
  console.log("");
  console.log("Turn Control:");
  console.log("  ralph-lisa whose-turn               Check whose turn");
  console.log('  ralph-lisa submit-ralph "[TAG]..."   Ralph submits');
  console.log('  ralph-lisa submit-lisa "[TAG]..."    Lisa submits');
  console.log("");
  console.log("Tags:");
  console.log(
    "  Ralph: [PLAN] [RESEARCH] [CODE] [FIX] [CHALLENGE] [DISCUSS] [QUESTION] [CONSENSUS]"
  );
  console.log(
    "  Lisa:  [PASS] [NEEDS_WORK] [CHALLENGE] [DISCUSS] [QUESTION] [CONSENSUS]"
  );
  console.log("");
  console.log("Information:");
  console.log("  ralph-lisa status                   Show current status");
  console.log("  ralph-lisa read <file>              Read work.md/review.md");
  console.log("  ralph-lisa history                  Show full history");
  console.log("");
  console.log("Flow Control:");
  console.log('  ralph-lisa step "name"              Enter new step');
  console.log("  ralph-lisa archive [name]           Archive session");
  console.log("  ralph-lisa clean                    Clean session");
  console.log("");
  console.log("Policy:");
  console.log(
    "  ralph-lisa policy check <ralph|lisa> Check submission policy"
  );
  console.log("  RL_POLICY_MODE=warn|block|off       Set policy mode");
}

function showVersion(): void {
  try {
    const pkg = require("../package.json");
    console.log(`ralph-lisa-loop v${pkg.version}`);
  } catch {
    console.log("ralph-lisa-loop v3.0.0");
  }
}
