import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const { name, version } = JSON.parse(
  await readFile(new URL("package.json", root), "utf8"),
);

await mkdir(new URL("dist/", root), { recursive: true });

const shared = {
  bundle: true,
  target: "es2022",
  legalComments: "inline",
  banner: {
    js: `/*! ${name} v${version} | MIT License | https://github.com/airshiplabs/featurefountain-sdks */`,
  },
};

await build({
  ...shared,
  entryPoints: ["src/index.ts"],
  outfile: fileURLToPath(new URL("dist/index.js", root)),
  format: "esm",
});
await build({
  ...shared,
  entryPoints: ["src/index.ts"],
  outfile: fileURLToPath(new URL("dist/widget.js", root)),
  format: "iife",
});

execFileSync(
  process.execPath,
  [
    fileURLToPath(new URL("node_modules/typescript/bin/tsc", root)),
    "--ignoreConfig",
    "--emitDeclarationOnly",
    "--declaration",
    "--outDir",
    "dist",
    "src/index.ts",
    "src/context.ts",
    "src/metadata.ts",
    "--target",
    "ES2022",
    "--module",
    "ES2022",
    "--moduleResolution",
    "bundler",
    "--strict",
    "--skipLibCheck",
  ],
  { cwd: fileURLToPath(root), stdio: "inherit" },
);
