export type FeatureFountainMetadataValue = string | number | boolean;

export type FeatureFountainMetadata = Record<
  string,
  FeatureFountainMetadataValue
>;

const MAX_METADATA_KEYS = 20;
const MAX_KEY_LENGTH = 40;
const MAX_VALUE_LENGTH = 200;
const MAX_METADATA_BYTES = 4096;

function warnDropped(key: string, reason: string): void {
  console.warn(
    `FeatureFountain: dropped metadata key "${key}" because ${reason}.`,
  );
}

function isPlainMetadataObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/** Normalize app metadata before it is sent in widget context. */
export function sanitizeMetadata(
  input: unknown,
): FeatureFountainMetadata | undefined {
  if (input === undefined || input === null) return undefined;
  if (!isPlainMetadataObject(input)) {
    console.warn(
      "FeatureFountain: metadata must be a flat object; ignoring the value.",
    );
    return undefined;
  }

  const result: FeatureFountainMetadata = {};

  for (const [key, value] of Object.entries(input)) {
    if (Object.keys(result).length >= MAX_METADATA_KEYS) {
      warnDropped(key, "only 20 keys are allowed");
      continue;
    }
    if (key.length > MAX_KEY_LENGTH) {
      warnDropped(key, "key names must be 40 characters or fewer");
      continue;
    }
    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      warnDropped(key, "values must be strings, numbers, or booleans");
      continue;
    }
    if (typeof value === "string" && value.length > MAX_VALUE_LENGTH) {
      warnDropped(key, "string values must be 200 characters or fewer");
      continue;
    }

    const candidate = { ...result, [key]: value };
    if (JSON.stringify(candidate).length > MAX_METADATA_BYTES) {
      warnDropped(key, "metadata must fit within 4096 bytes as JSON");
      continue;
    }
    result[key] = value;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function parseMetadataAttribute(
  raw: string | null,
): FeatureFountainMetadata | undefined {
  if (!raw) return undefined;
  try {
    return sanitizeMetadata(JSON.parse(raw));
  } catch {
    console.warn("FeatureFountain: metadata attribute must be valid JSON.");
    return undefined;
  }
}
