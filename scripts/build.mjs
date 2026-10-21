import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const tsc = (...args) =>
  execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL("node_modules/typescript/bin/tsc", root)),
      "--ignoreConfig",
      "--target",
      "ES2022",
      "--moduleResolution",
      "bundler",
      "--strict",
      "--skipLibCheck",
      ...args,
      "src/index.ts",
    ],
    { cwd: fileURLToPath(root), stdio: "inherit" },
  );

function browserBundle(protocolSource, indexSource) {
  const protocolBody = protocolSource.replace(/^export /gm, "");
  const importLine = indexSource.match(
    /^import \{[\s\S]*?\} from "\.\/protocol\.js";\n/,
  );
  if (!importLine)
    throw new Error("Widget bundle is missing the protocol import.");
  const indexBody = indexSource.replace(importLine[0], "");
  const bundle = `${protocolBody}\n${indexBody}`;
  if (/\b(?:import|export)\b/.test(bundle))
    throw new Error("Widget bundle still has an import or export.");
  return `(function () {\n${bundle}})();\n`;
}

await mkdir(new URL("dist/", root), { recursive: true });
tsc("--module", "ES2022", "--declaration", "--outDir", "dist");
const protocol = await readFile(new URL("dist/protocol.js", root), "utf8");
const browser = await readFile(new URL("dist/index.js", root), "utf8");
await writeFile(
  new URL("dist/widget.js", root),
  browserBundle(protocol, browser),
);
