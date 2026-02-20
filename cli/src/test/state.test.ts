import { describe, it, beforeEach, afterEach } from "node:test";
import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { extractTag, extractSummary, VALID_TAGS, findProjectRoot, resetProjectRootCache, stateDir, resolveStateDir, STATE_DIR } from "../state.js";

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

describe("findProjectRoot", () => {
  const TMP = path.join(__dirname, "..", "..", ".test-tmp-state");

  beforeEach(() => {
    resetProjectRootCache();
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    resetProjectRootCache();
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("finds .dual-agent/ in startDir", () => {
    fs.mkdirSync(path.join(TMP, STATE_DIR), { recursive: true });
    const root = findProjectRoot(TMP);
    assert.strictEqual(root, path.resolve(TMP));
  });

  it("finds .dual-agent/ in parent directory", () => {
    fs.mkdirSync(path.join(TMP, STATE_DIR), { recursive: true });
    const subDir = path.join(TMP, "src", "components");
    fs.mkdirSync(subDir, { recursive: true });
    const root = findProjectRoot(subDir);
    assert.strictEqual(root, path.resolve(TMP));
  });

  it("finds .dual-agent/ two levels up", () => {
    fs.mkdirSync(path.join(TMP, STATE_DIR), { recursive: true });
    const deepDir = path.join(TMP, "a", "b", "c");
    fs.mkdirSync(deepDir, { recursive: true });
    const root = findProjectRoot(deepDir);
    assert.strictEqual(root, path.resolve(TMP));
  });

  it("returns null when no .dual-agent/ found", () => {
    // Use /tmp/ to avoid finding the real project's .dual-agent/ via upward search
    const isolated = path.join("/tmp", ".rll-test-no-session-" + process.pid);
    fs.mkdirSync(isolated, { recursive: true });
    try {
      resetProjectRootCache();
      const root = findProjectRoot(isolated);
      assert.strictEqual(root, null);
    } finally {
      fs.rmSync(isolated, { recursive: true, force: true });
    }
  });

  it("finds nearest .dual-agent/ when nested", () => {
    // Parent has .dual-agent/
    fs.mkdirSync(path.join(TMP, STATE_DIR), { recursive: true });
    // Child also has .dual-agent/
    const childProject = path.join(TMP, "child-project");
    fs.mkdirSync(path.join(childProject, STATE_DIR), { recursive: true });
    const subDir = path.join(childProject, "src");
    fs.mkdirSync(subDir, { recursive: true });

    // From child/src, should find child's .dual-agent/, not parent's
    resetProjectRootCache();
    const root = findProjectRoot(subDir);
    assert.strictEqual(root, path.resolve(childProject));
  });

  it("caches result across calls with same startDir", () => {
    fs.mkdirSync(path.join(TMP, STATE_DIR), { recursive: true });
    const root1 = findProjectRoot(TMP);
    const root2 = findProjectRoot(TMP);
    assert.strictEqual(root1, root2);
    assert.strictEqual(root1, path.resolve(TMP));
  });

  it("returns correct root for different startDirs without reset", () => {
    // Lisa's repro: two independent project roots, no resetProjectRootCache() between calls
    const projA = path.join(TMP, "a");
    const projB = path.join(TMP, "b");
    fs.mkdirSync(path.join(projA, STATE_DIR), { recursive: true });
    fs.mkdirSync(path.join(projB, STATE_DIR), { recursive: true });
    const subA = path.join(projA, "sub");
    const subB = path.join(projB, "sub");
    fs.mkdirSync(subA, { recursive: true });
    fs.mkdirSync(subB, { recursive: true });

    const rootA = findProjectRoot(subA);
    assert.strictEqual(rootA, path.resolve(projA));
    // Second call with different startDir — must NOT return cached A
    const rootB = findProjectRoot(subB);
    assert.strictEqual(rootB, path.resolve(projB));
  });

  it("invalidates cache when .dual-agent/ removed", () => {
    // Use /tmp/ to avoid finding the real project's .dual-agent/ after removal
    const isolated = path.join("/tmp", ".rll-test-cache-invalidate-" + process.pid);
    fs.mkdirSync(path.join(isolated, STATE_DIR), { recursive: true });
    try {
      resetProjectRootCache();
      const root1 = findProjectRoot(isolated);
      assert.strictEqual(root1, path.resolve(isolated));

      // Remove .dual-agent/ — cache should invalidate
      fs.rmSync(path.join(isolated, STATE_DIR), { recursive: true });
      resetProjectRootCache();
      const root2 = findProjectRoot(isolated);
      assert.strictEqual(root2, null);
    } finally {
      fs.rmSync(isolated, { recursive: true, force: true });
    }
  });
});

describe("stateDir", () => {
  const TMP = path.join(__dirname, "..", "..", ".test-tmp-state2");

  beforeEach(() => {
    resetProjectRootCache();
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    resetProjectRootCache();
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("returns explicit projectDir path when given", () => {
    const result = stateDir("/some/explicit/path");
    assert.strictEqual(result, path.join("/some/explicit/path", STATE_DIR));
  });

  it("uses upward search when no projectDir given", () => {
    // Create .dual-agent/ in TMP
    fs.mkdirSync(path.join(TMP, STATE_DIR), { recursive: true });
    // Temporarily change CWD to a subdirectory
    const origCwd = process.cwd();
    const subDir = path.join(TMP, "sub");
    fs.mkdirSync(subDir, { recursive: true });
    process.chdir(subDir);
    try {
      const result = stateDir();
      assert.strictEqual(result, path.join(path.resolve(TMP), STATE_DIR));
    } finally {
      process.chdir(origCwd);
    }
  });
});

describe("resolveStateDir (Proposal §3.10)", () => {
  const TMP = path.join(__dirname, "..", "..", ".test-tmp-resolve");
  let origEnv: string | undefined;

  beforeEach(() => {
    resetProjectRootCache();
    origEnv = process.env.RL_STATE_DIR;
    delete process.env.RL_STATE_DIR;
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    resetProjectRootCache();
    if (origEnv !== undefined) {
      process.env.RL_STATE_DIR = origEnv;
    } else {
      delete process.env.RL_STATE_DIR;
    }
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  it("uses RL_STATE_DIR env var when set (priority 2)", () => {
    const envPath = path.join(TMP, "from-env", ".dual-agent");
    process.env.RL_STATE_DIR = envPath;
    const result = resolveStateDir();
    assert.strictEqual(result.dir, envPath);
    assert.strictEqual(result.source, "env");
  });

  it("falls back to auto-detect when no env vars set (priority 3)", () => {
    // Create .dual-agent/ in TMP
    fs.mkdirSync(path.join(TMP, STATE_DIR), { recursive: true });
    const origCwd = process.cwd();
    process.chdir(TMP);
    try {
      const result = resolveStateDir();
      assert.strictEqual(result.dir, path.join(path.resolve(TMP), STATE_DIR));
      assert.strictEqual(result.source, "auto-detect");
    } finally {
      process.chdir(origCwd);
    }
  });

  it("env var takes precedence over auto-detect", () => {
    // Set up both: env var AND .dual-agent/ in cwd
    fs.mkdirSync(path.join(TMP, STATE_DIR), { recursive: true });
    const envPath = path.join(TMP, "override", ".dual-agent");
    process.env.RL_STATE_DIR = envPath;
    const origCwd = process.cwd();
    process.chdir(TMP);
    try {
      const result = resolveStateDir();
      assert.strictEqual(result.dir, envPath);
      assert.strictEqual(result.source, "env");
    } finally {
      process.chdir(origCwd);
    }
  });

  it("two calls from different cwds with env var set return same result", () => {
    const envPath = path.join(TMP, "shared", ".dual-agent");
    process.env.RL_STATE_DIR = envPath;

    // Create two subdirs
    const dirA = path.join(TMP, "projectA", "src");
    const dirB = path.join(TMP, "projectB", "lib");
    fs.mkdirSync(dirA, { recursive: true });
    fs.mkdirSync(dirB, { recursive: true });

    const origCwd = process.cwd();
    try {
      process.chdir(dirA);
      const resultA = resolveStateDir();
      process.chdir(dirB);
      const resultB = resolveStateDir();
      assert.strictEqual(resultA.dir, resultB.dir);
      assert.strictEqual(resultA.dir, envPath);
    } finally {
      process.chdir(origCwd);
    }
  });
});
