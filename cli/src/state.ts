/**
 * State management for Ralph-Lisa Loop.
 * Manages .dual-agent/ directory and all state files.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export const STATE_DIR = ".dual-agent";
export const ARCHIVE_DIR = ".dual-agent-archive";

export const VALID_TAGS =
  "PLAN|RESEARCH|CODE|FIX|PASS|NEEDS_WORK|CHALLENGE|DISCUSS|QUESTION|CONSENSUS";

const TAG_RE = new RegExp(`^\\[(${VALID_TAGS})\\]`);

/**
 * Walk up from startDir to find the nearest directory containing .dual-agent/.
 * Similar to how git finds .git/ from any subdirectory.
 * Result is cached per process invocation for efficiency.
 */
/**
 * Cache keyed by resolved startDir to avoid returning wrong root
 * when called with different directories in the same process.
 */
let _cachedStartDir: string | undefined;
let _cachedProjectRoot: string | null | undefined;

export function findProjectRoot(startDir: string = process.cwd()): string | null {
  const resolved = path.resolve(startDir);

  // Cache hit: same startDir as last call
  if (_cachedStartDir === resolved && _cachedProjectRoot !== undefined) {
    if (_cachedProjectRoot === null) return null;
    // Validate cached root still exists
    if (fs.existsSync(path.join(_cachedProjectRoot, STATE_DIR))) {
      return _cachedProjectRoot;
    }
    // Invalidate stale cache
    _cachedStartDir = undefined;
    _cachedProjectRoot = undefined;
  }

  let dir = resolved;
  while (true) {
    if (fs.existsSync(path.join(dir, STATE_DIR))) {
      _cachedStartDir = resolved;
      _cachedProjectRoot = dir;
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  _cachedStartDir = resolved;
  _cachedProjectRoot = null;
  return null;
}

/**
 * Reset the cached project root. Used in tests.
 */
export function resetProjectRootCache(): void {
  _cachedStartDir = undefined;
  _cachedProjectRoot = undefined;
}

/**
 * Get the .dual-agent/ state directory path.
 * When projectDir is explicitly given, uses that path directly.
 * When omitted, searches upward from CWD to find .dual-agent/ (like git).
 */
export function stateDir(projectDir?: string): string {
  if (projectDir !== undefined) {
    return path.join(projectDir, STATE_DIR);
  }
  const root = findProjectRoot();
  return path.join(root || process.cwd(), STATE_DIR);
}

/**
 * Check that a session exists. Searches upward from CWD when no explicit dir given.
 */
export function checkSession(projectDir?: string): void {
  const dir = projectDir !== undefined ? stateDir(projectDir) : stateDir();
  if (!fs.existsSync(dir)) {
    console.error(
      'Error: Session not initialized. Run: ralph-lisa init "task description"'
    );
    process.exit(1);
  }
}

export function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8").trim();
  } catch {
    return "";
  }
}

export function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

export function appendFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, content, "utf-8");
}

export function getTurn(projectDir?: string): string {
  return readFile(path.join(stateDir(projectDir), "turn.txt")) || "ralph";
}

export function setTurn(turn: string, projectDir?: string): void {
  writeFile(path.join(stateDir(projectDir), "turn.txt"), turn);
}

export function getRound(projectDir?: string): string {
  return readFile(path.join(stateDir(projectDir), "round.txt")) || "?";
}

export function setRound(round: number, projectDir?: string): void {
  writeFile(path.join(stateDir(projectDir), "round.txt"), String(round));
}

export function getStep(projectDir?: string): string {
  return readFile(path.join(stateDir(projectDir), "step.txt")) || "?";
}

export function setStep(step: string, projectDir?: string): void {
  writeFile(path.join(stateDir(projectDir), "step.txt"), step);
}

export function extractTag(content: string): string {
  const firstLine = content.split("\n")[0] || "";
  const match = firstLine.match(TAG_RE);
  return match ? match[1] : "";
}

export function extractSummary(content: string): string {
  const firstLine = content.split("\n")[0] || "";
  return firstLine.replace(TAG_RE, "").trim();
}

export function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function timeShort(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function appendHistory(
  role: string,
  content: string,
  projectDir?: string
): void {
  const tag = extractTag(content);
  const summary = extractSummary(content);
  const round = getRound(projectDir);
  const step = getStep(projectDir);
  const ts = timestamp();

  const entry = `
---

## [${role}] [${tag}] Round ${round} | Step: ${step}
**Time**: ${ts}
**Summary**: ${summary}

${content}

`;
  appendFile(path.join(stateDir(projectDir), "history.md"), entry);
}

export function updateLastAction(
  role: string,
  content: string,
  projectDir?: string
): void {
  const tag = extractTag(content);
  const summary = extractSummary(content);
  const ts = timeShort();
  writeFile(
    path.join(stateDir(projectDir), "last_action.txt"),
    `[${tag}] ${summary} (by ${role}, ${ts})`
  );
}
