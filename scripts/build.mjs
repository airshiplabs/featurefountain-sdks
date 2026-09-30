import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = new URL("../", import.meta.url);
await mkdir(new URL("dist/", root), { recursive: true });
execFileSync(
  process.execPath,
  [
    fileURLToPath(new URL("node_modules/typescript/bin/tsc", root)),
    "src/index.ts",
    "--ignoreConfig",
    "--target",
    "ES2022",
    "--module",
    "ES2022",
    "--declaration",
    "--strict",
    "--skipLibCheck",
    "--outDir",
    "dist",
  ],
  { cwd: fileURLToPath(root), stdio: "inherit" },
);
const source = await readFile(new URL("src/index.ts", root), "utf8");
const browser = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
}).outputText;
await writeFile(
  new URL("dist/widget.js", root),
  `(function () {\nconst exports = {};\n${browser}\n})();\n`,
);
