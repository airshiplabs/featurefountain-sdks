import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";

const script = fileURLToPath(
  new URL("../scripts/check-file-token-limit.mjs", import.meta.url),
);
const dirs: string[] = [];

function git(cwd: string, args: string[]) {
  execFileSync("git", args, { cwd, stdio: "pipe" });
}

function initRepo() {
  const cwd = mkdtempSync(join(tmpdir(), "file-token-limit-"));
  dirs.push(cwd);
  git(cwd, ["init"]);
  git(cwd, ["config", "user.email", "token-limit@example.com"]);
  git(cwd, ["config", "user.name", "Token Limit Test"]);
  git(cwd, ["config", "commit.gpgsign", "false"]);
  writeFileSync(join(cwd, "README.md"), "seed\n");
  git(cwd, ["add", "README.md"]);
  git(cwd, ["commit", "-m", "seed"]);
  return cwd;
}

function check(cwd: string) {
  try {
    const stdout = execFileSync(process.execPath, [script], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, output: stdout };
  } catch (error) {
    const failed = error as {
      status: number | null;
      stdout: string;
      stderr: string;
    };
    return {
      status: failed.status,
      output: `${failed.stdout ?? ""}${failed.stderr ?? ""}`,
    };
  }
}

afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

test("staged file over 20,000 bytes fails with split instructions", () => {
  const cwd = initRepo();
  writeFileSync(join(cwd, "src big.ts"), "a".repeat(20_001));
  git(cwd, ["add", "src big.ts"]);

  const result = check(cwd);

  expect(result.status).toBe(1);
  expect(result.output).toContain("src big.ts");
  expect(result.output).toContain("20,001 bytes");
  expect(result.output).toContain("5,001 tokens");
  expect(result.output).toContain("limit 5,000 tokens / 20,000 bytes");
  expect(result.output).toContain(
    "Split the file by responsibility into smaller files",
  );
  expect(result.output).toContain("turn it into a folder with an index file");
  expect(result.output).toContain("split by describe block or feature");
  expect(result.output).toContain("split by top-level section");
  expect(result.output).toContain("Don't bypass with --no-verify");
  expect(result.output).toContain("scripts/check-file-token-limit.mjs");
});

test("staged file at the 20,000 byte limit passes", () => {
  const cwd = initRepo();
  writeFileSync(join(cwd, "fits.ts"), "a".repeat(20_000));
  git(cwd, ["add", "fits.ts"]);

  expect(check(cwd).status).toBe(0);
});

test("ignored lockfile over the limit passes", () => {
  const cwd = initRepo();
  writeFileSync(join(cwd, "pnpm-lock.yaml"), "a".repeat(50_000));
  git(cwd, ["add", "pnpm-lock.yaml"]);

  expect(check(cwd).status).toBe(0);
});

test("deletion of a large file passes", () => {
  const cwd = initRepo();
  writeFileSync(join(cwd, "gone.ts"), "a".repeat(25_000));
  git(cwd, ["add", "gone.ts"]);
  git(cwd, ["commit", "-m", "add large file"]);
  git(cwd, ["rm", "gone.ts"]);

  expect(check(cwd).status).toBe(0);
});

test("measures the staged blob, not the working tree", () => {
  const cwd = initRepo();
  const file = join(cwd, "partial.ts");
  writeFileSync(file, "a".repeat(100));
  git(cwd, ["add", "partial.ts"]);
  git(cwd, ["commit", "-m", "small"]);
  const staged = execFileSync("git", ["hash-object", "-w", "--stdin"], {
    cwd,
    input: "a".repeat(20_001),
    encoding: "utf8",
  }).trim();
  git(cwd, ["update-index", "--cacheinfo", `100644,${staged},partial.ts`]);
  writeFileSync(file, "still small\n");

  const result = check(cwd);
  expect(result.status).toBe(1);
  expect(result.output).toContain("partial.ts");
  expect(result.output).toContain("20,001 bytes");
});

test("linguist-generated and -diff attributes are ignored", () => {
  const cwd = initRepo();
  writeFileSync(
    join(cwd, ".gitattributes"),
    "*.gen.ts linguist-generated\nvendored.md linguist-vendored\nnotes.md -diff\n",
  );
  writeFileSync(join(cwd, "client.gen.ts"), "a".repeat(21_000));
  writeFileSync(join(cwd, "vendored.md"), "a".repeat(21_000));
  writeFileSync(join(cwd, "notes.md"), "a".repeat(21_000));
  git(cwd, [
    "add",
    ".gitattributes",
    "client.gen.ts",
    "vendored.md",
    "notes.md",
  ]);

  expect(check(cwd).status).toBe(0);
});

test("binary content over the limit passes", () => {
  const cwd = initRepo();
  writeFileSync(
    join(cwd, "asset.dat"),
    Buffer.from([0, ...Buffer.alloc(21_000, 1)]),
  );
  git(cwd, ["add", "asset.dat"]);

  expect(check(cwd).status).toBe(0);
});
