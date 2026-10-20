import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const localPath = fileURLToPath(
  new URL("../tests/fixtures/embed-protocol.vectors.json", import.meta.url),
);
const remotePath = "packages/embed-protocol/vectors.json";
const ref = "devin--hosted-form-embed-close-hide";
const apiPath = `repos/airshiplabs/shipyard/contents/${remotePath}?ref=${ref}`;

let remote;
try {
  remote = execFileSync(
    "gh",
    [
      "api",
      "--method",
      "GET",
      "-H",
      "Accept: application/vnd.github.raw",
      apiPath,
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(
    `Could not read airshiplabs/shipyard ${remotePath} at ${ref}.\n${detail}`,
  );
  process.exit(1);
}

const local = readFileSync(localPath);
if (!local.equals(remote)) {
  console.error(
    `tests/fixtures/embed-protocol.vectors.json is not a byte-identical copy of airshiplabs/shipyard ${remotePath} at ${ref}.`,
  );
  process.exit(1);
}
