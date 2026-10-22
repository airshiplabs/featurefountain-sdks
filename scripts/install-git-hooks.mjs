#!/usr/bin/env node
/**
 * Copies scripts/git-hooks/pre-commit into this repo's git hooks directory.
 * No-ops when this package is installed as a dependency or outside a checkout.
 */

import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MARKER = "featurefountain:file-token-limit";
const root = fileURLToPath(new URL("..", import.meta.url));
const source = path.join(root, "scripts/git-hooks/pre-commit");

function git(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function readHook(target) {
  try {
    return readFileSync(target, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") return "";
    throw error;
  }
}

function ownsHook(contents) {
  return contents.includes("exec node scripts/check-file-token-limit.mjs");
}

let topLevel;
try {
  topLevel = git(["rev-parse", "--show-toplevel"]);
} catch {
  process.exit(0);
}

if (path.resolve(topLevel) !== path.resolve(root)) process.exit(0);

// Install into this checkout's .git/hooks. Ignore core.hooksPath so a shared
// hook directory outside the repo is left alone.
const gitDir = git(["rev-parse", "--git-dir"]);
const hooksDir = path.resolve(root, gitDir, "hooks");
mkdirSync(hooksDir, { recursive: true });
const target = path.join(hooksDir, "pre-commit");
const existing = readHook(target);

if (existing.includes(MARKER) && !ownsHook(existing)) process.exit(0);

if (existing && !existing.includes(MARKER)) {
  const newline = existing.indexOf("\n");
  const hasShebang = existing.startsWith("#!") && newline !== -1;
  const shebang = hasShebang ? existing.slice(0, newline + 1) : "#!/bin/sh\n";
  const body = hasShebang ? existing.slice(newline + 1) : existing;
  const chained = [
    shebang.trimEnd(),
    `# ${MARKER}`,
    "repo=$(git rev-parse --show-toplevel) || exit 1",
    '( cd "$repo" && node scripts/check-file-token-limit.mjs ) || exit 1',
    body,
  ].join("\n");
  writeFileSync(target, chained.endsWith("\n") ? chained : `${chained}\n`);
  chmodSync(target, 0o755);
  process.exit(0);
}

copyFileSync(source, target);
chmodSync(target, 0o755);
