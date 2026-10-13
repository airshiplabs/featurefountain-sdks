import { expect, test, vi } from "vitest";
import { parseMetadataAttribute, sanitizeMetadata } from "../src/metadata.js";

test("sanitizeMetadata accepts flat primitives", () => {
  expect(
    sanitizeMetadata({ version: "2.4.1", plan: "pro", active: true, count: 3 }),
  ).toEqual({ version: "2.4.1", plan: "pro", active: true, count: 3 });
});

test("sanitizeMetadata drops nested values and warns", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(sanitizeMetadata({ good: "ok", bad: { nested: true } })).toEqual({
    good: "ok",
  });
  expect(warn).toHaveBeenCalledWith(
    'FeatureFountain: dropped metadata key "bad" because values must be strings, numbers, or booleans.',
  );
  warn.mockRestore();
});

test("parseMetadataAttribute parses JSON attributes", () => {
  expect(parseMetadataAttribute('{"version":"1.0.0"}')).toEqual({
    version: "1.0.0",
  });
  expect(parseMetadataAttribute("{not-json")).toBeUndefined();
});
