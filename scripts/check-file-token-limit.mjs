#!/usr/bin/env node
/**
 * Blocks commits of staged files over 5,000 tokens.
 * Tokens are bytes / 4, so a staged blob fails when it is over 20,000 bytes.
 *
 * The ignore list lives in this file. Extend it for generated output, lockfiles,
 * vendored code, and binaries. Do not add hand-written source, tests, or docs.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const TOKEN_LIMIT = 5_000;
export const BYTES_PER_TOKEN = 4;
export const BYTE_LIMIT = TOKEN_LIMIT * BYTES_PER_TOKEN;

const IGNORE_LIST_PATH = "scripts/check-file-token-limit.mjs";

/**
 * Staged paths agents do not author. Patterns use forward slashes and match
 * anywhere in the path. Keep hand-written source off this list.
 */
export const IGNORE_PATH_PATTERNS = [
  // Package-manager and language lockfiles.
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|bun\.lock|bun\.lockb|Gemfile\.lock|composer\.lock|poetry\.lock|Pipfile\.lock|Cargo\.lock|go\.sum|Podfile\.lock|Package\.resolved|packages\.lock\.json|uv\.lock|pixi\.lock|flake\.lock|deno\.lock|pubspec\.lock)$/,

  // Build output, dependencies, and vendored trees.
  /(^|\/)(dist|build|out|\.next|coverage|node_modules|vendor|vendored|third_party|third-party)(\/|$)/,

  // Generated and codegen output, including migration snapshot metadata.
  /(^|\/)(generated|__generated__)(\/|$)/,
  /\.(generated|gen)\.[^/]+$/,
  /(^|\/)migrations\/meta(\/|$)/,
  /(^|\/)drizzle\/meta(\/|$)/,

  // Minified bundles.
  /\.min\.[^/]+$/,

  // Test snapshots and visual baselines.
  /\.snap$/,
  /(^|\/)__snapshots__(\/|$)/,
  /(^|\/)__image_snapshots__(\/|$)/,
  /-baseline\.[^/]+$/,

  // Images, fonts, audio, video, archives, and other binary assets.
  /\.(png|jpe?g|gif|webp|ico|bmp|avif|svg|pdf|woff2?|ttf|otf|eot|mp3|wav|ogg|flac|m4a|aac|mp4|webm|mov|avi|mkv|zip|tar|gz|tgz|bz2|7z|rar|wasm|so|dylib|dll|exe|bin|class|jar)$/i,
];

const SPLIT_INSTRUCTIONS = [
  "Split the file by responsibility into smaller files, each under 5,000 tokens (20,000 bytes).",
  "Code: move each component, class or group of related functions into its own module; move types, constants, schemas and helpers into sibling files; if callers import from the old path, turn it into a folder with an index file that re-exports, so imports don't change. Update imports, then run the typecheck, lint and tests.",
  "Tests: split by describe block or feature into several test files, and move shared fixtures/helpers into a support file.",
  "Docs and Markdown: split by top-level section into separate files and link them from a short index.",
  "Data or config: split into several files loaded together, or move large data out of source.",
  "Re-stage the new files and commit again. Don't bypass with --no-verify.",
  `If the file really is generated or not authored by an agent, add its path to the ignore list in ${IGNORE_LIST_PATH} instead of splitting it.`,
];

export function estimateTokens(bytes) {
  return Math.ceil(bytes / BYTES_PER_TOKEN);
}

export function isIgnoredPath(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  return IGNORE_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

function git(cwd, args, options = {}) {
  return execFileSync("git", args, {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });
}

function parseCachedRaw(buffer) {
  const entries = [];
  let index = 0;
  while (index < buffer.length) {
    if (buffer[index] === 0) {
      index += 1;
      continue;
    }
    const headerEnd = buffer.indexOf(0, index);
    if (headerEnd === -1) break;
    const header = buffer.subarray(index, headerEnd).toString("utf8");
    index = headerEnd + 1;
    const fields = header.split(" ");
    const status = fields.at(-1) ?? "";
    const sha = fields.at(-2) ?? "";
    const pathEnd = buffer.indexOf(0, index);
    if (pathEnd === -1) break;
    let filePath = buffer.subarray(index, pathEnd).toString("utf8");
    index = pathEnd + 1;
    if (status.startsWith("R") || status.startsWith("C")) {
      const newEnd = buffer.indexOf(0, index);
      if (newEnd === -1) break;
      filePath = buffer.subarray(index, newEnd).toString("utf8");
      index = newEnd + 1;
    }
    if (sha && filePath) entries.push({ path: filePath, sha, status });
  }
  return entries;
}

function stagedEntries(cwd) {
  const output = git(
    cwd,
    ["diff", "--cached", "-z", "--raw", "--abbrev=40", "--diff-filter=ACMR"],
    { encoding: "buffer" },
  );
  return parseCachedRaw(output);
}

function blobSizes(cwd, shas) {
  const unique = [...new Set(shas)];
  if (unique.length === 0) return new Map();
  const output = git(
    cwd,
    ["cat-file", "--batch-check=%(objectname) %(objectsize)"],
    { input: unique.map((sha) => `${sha}\n`).join(""), encoding: "utf8" },
  );
  const sizes = new Map();
  for (const line of output.trim().split("\n")) {
    if (!line) continue;
    const [sha, size] = line.split(" ");
    sizes.set(sha, Number(size));
  }
  return sizes;
}

function attributeValueIsTrue(value) {
  return value === "set" || value === "true" || value === "yes";
}

function isIgnoredByGitAttributes(cwd, filePath) {
  const output = git(
    cwd,
    [
      "check-attr",
      "-z",
      "linguist-generated",
      "linguist-vendored",
      "diff",
      "--",
      filePath,
    ],
    { encoding: "buffer" },
  );
  const parts = output.toString("utf8").split("\0");
  const values = {};
  for (let index = 0; index + 2 < parts.length; index += 3) {
    values[parts[index + 1]] = parts[index + 2];
  }
  return (
    attributeValueIsTrue(values["linguist-generated"]) ||
    attributeValueIsTrue(values["linguist-vendored"]) ||
    values.diff === "unset"
  );
}

function prefixHasNul(cwd, sha) {
  const result = spawnSync(
    "sh",
    [
      "-c",
      'git cat-file blob "$1" 2>/dev/null | dd bs=8192 count=1 status=none',
      "sh",
      sha,
    ],
    { cwd, maxBuffer: 9_000 },
  );
  if (result.error) throw result.error;
  return (result.stdout ?? Buffer.alloc(0)).includes(0);
}

export function findOffenders(cwd = process.cwd()) {
  const entries = stagedEntries(cwd);
  const sizes = blobSizes(
    cwd,
    entries.map((entry) => entry.sha),
  );
  const offenders = [];
  for (const entry of entries) {
    const bytes = sizes.get(entry.sha);
    if (bytes === undefined || Number.isNaN(bytes)) {
      throw new Error(`Could not read the staged size of ${entry.path}`);
    }
    if (bytes <= BYTE_LIMIT) continue;
    if (isIgnoredPath(entry.path)) continue;
    if (isIgnoredByGitAttributes(cwd, entry.path)) continue;
    if (prefixHasNul(cwd, entry.sha)) continue;
    offenders.push({
      path: entry.path,
      bytes,
      tokens: estimateTokens(bytes),
    });
  }
  return offenders;
}

export function formatFailure(offenders) {
  const lines = offenders.map(
    (file) =>
      `  ${file.path} — ${file.bytes.toLocaleString("en-US")} bytes, about ${file.tokens.toLocaleString("en-US")} tokens (limit ${TOKEN_LIMIT.toLocaleString("en-US")} tokens / ${BYTE_LIMIT.toLocaleString("en-US")} bytes)`,
  );
  const steps = SPLIT_INSTRUCTIONS.map((step) => `- ${step}`).join("\n");
  return [
    "File token limit exceeded. Staged files must stay at or under 5,000 tokens (20,000 bytes, counted as bytes / 4).",
    "",
    ...lines,
    "",
    "Split the file before committing:",
    steps,
    "",
  ].join("\n");
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  try {
    const offenders = findOffenders(process.cwd());
    if (offenders.length > 0) {
      process.stderr.write(formatFailure(offenders));
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`file token limit check failed: ${message}\n`);
    process.exitCode = 1;
  }
}
