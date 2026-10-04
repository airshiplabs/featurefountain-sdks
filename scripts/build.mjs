import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const tsc = (...args) =>
  execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL("node_modules/typescript/bin/tsc", root)),
      "src/index.ts",
      "--ignoreConfig",
      "--target",
      "ES2022",
      ...args,
    ],
    { cwd: fileURLToPath(root), stdio: "inherit" },
  );

await mkdir(new URL("dist/", root), { recursive: true });
tsc(
  "--module",
  "ES2022",
  "--declaration",
  "--strict",
  "--skipLibCheck",
  "--outDir",
  "dist",
);
const browserDir = await mkdtemp(join(tmpdir(), "featurefountain-widget-"));
try {
  tsc("--module", "CommonJS", "--skipLibCheck", "--outDir", browserDir);
  const browser = await readFile(join(browserDir, "index.js"), "utf8");
  await writeFile(
    new URL("dist/widget.js", root),
    `(function () {\nconst exports = {};\n${browser}\n})();\n`,
  );
} finally {
  await rm(browserDir, { recursive: true, force: true });
}
