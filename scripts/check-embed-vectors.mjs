import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const fixture = readFileSync(
  new URL("../tests/fixtures/embed-protocol.json", import.meta.url),
);
const expected = readFileSync(
  new URL("../tests/fixtures/embed-protocol.json.sha256", import.meta.url),
  "utf8",
)
  .trim()
  .split(/\s+/)[0]
  .toLowerCase();
const actual = createHash("sha256").update(fixture).digest("hex");

if (actual !== expected) {
  console.error(
    `tests/fixtures/embed-protocol.json sha256 ${actual} does not match pinned ${expected}`,
  );
  process.exit(1);
}

console.log(`embed protocol vectors match pinned sha256 ${actual}`);
