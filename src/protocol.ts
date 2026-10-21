/** Wire protocol shared by the SDK and the hosted form. Version 1. */

export const protocolVersion = 1;
export const messageSource = "featurefountain";
export const minFrameHeight = 100;
export const maxFrameHeight = 4096;
export const labelMax = 60;

export interface ThemeLabels {
  trigger: string;
  title: string;
  close: string;
  submit: string;
}

export interface Theme {
  accent: string;
  colorScheme: "light" | "dark";
  labels: ThemeLabels;
}

export const defaultTheme: Theme = {
  accent: "#1c5060",
  colorScheme: "light",
  labels: {
    trigger: "Request Feature",
    title: "Request a feature",
    close: "Close",
    submit: "Submit request",
  },
};

export type HostMessage =
  | { kind: "ready" }
  | { kind: "resize"; height: number }
  | { kind: "close-request" }
  | { kind: "submitted" };

const accentPattern = /^#[0-9a-f]{6}$/i;

function plainRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (Object.getPrototypeOf(value) !== Object.prototype) return null;
  return value as Record<string, unknown>;
}

export const minWireHeight = 1;

function validHeight(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minWireHeight &&
    value <= maxFrameHeight
  );
}

/** Iframe pixel height. The wire accepts 1–4096; the shell never goes under 100. */
export function clampFrameHeight(height: number): number {
  return Math.max(minFrameHeight, height);
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function label(value: string | null, fallback: string): string {
  if (value === null) return fallback;
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > labelMax ||
    hasControlCharacter(trimmed)
  )
    return fallback;
  return trimmed;
}

/** Theme from host attributes. Invalid optional values fall back to defaults. */
export function themeFromAttributes(
  read: (name: string) => string | null,
): Theme {
  const accent = read("accent");
  const scheme = read("color-scheme");
  return {
    accent:
      accent !== null && accentPattern.test(accent.trim())
        ? accent.trim().toLowerCase()
        : defaultTheme.accent,
    colorScheme:
      scheme === "light" || scheme === "dark"
        ? scheme
        : defaultTheme.colorScheme,
    labels: {
      trigger: label(read("label"), defaultTheme.labels.trigger),
      title: label(read("heading"), defaultTheme.labels.title),
      close: label(read("close-label"), defaultTheme.labels.close),
      submit: label(read("submit-label"), defaultTheme.labels.submit),
    },
  };
}

/** Path segment for the embed document. The project id is encoded. */
export function embedPathname(projectId: string): string {
  return `/embed/${encodeURIComponent(projectId)}`;
}

/**
 * Session URL plus `embed=1`. Theme is never placed here.
 * The path comes from `embedPathname`, the only project-id encoder.
 */
export function withEmbedFlag(sessionHref: string, projectId: string): string {
  const url = new URL(sessionHref);
  const flagged = new URL(`${url.origin}${embedPathname(projectId)}`);
  flagged.search = url.search;
  flagged.searchParams.append("embed", "1");
  return flagged.href;
}

/**
 * HTTPS service origin. HTTP is allowed only for loopback
 * (`localhost`, `127.x.x.x`, or `[::1]`). Anything else returns null.
 */
export function parseServiceOrigin(value: string): string | null {
  if (!/^https?:\/\/[^/?#@\\\s]+\/?$/i.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const loopback =
    url.hostname === "localhost" ||
    url.hostname === "[::1]" ||
    /^127\.\d+\.\d+\.\d+$/.test(url.hostname);
  if (
    /\*|%2a/i.test(url.hostname) ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
  )
    return null;
  return url.origin;
}

export function handshakeMessage(): {
  source: typeof messageSource;
  protocol: typeof protocolVersion;
  type: "handshake";
  embed: true;
} {
  return {
    source: messageSource,
    protocol: protocolVersion,
    type: "handshake",
    embed: true,
  };
}

export function themeMessage(theme: Theme): {
  source: typeof messageSource;
  protocol: typeof protocolVersion;
  type: "theme";
  accent: string;
  colorScheme: Theme["colorScheme"];
  labels: ThemeLabels;
} {
  return {
    source: messageSource,
    protocol: protocolVersion,
    type: "theme",
    accent: theme.accent,
    colorScheme: theme.colorScheme,
    labels: { ...theme.labels },
  };
}

/**
 * Accept a message only from the iframe window and the configured service origin.
 * `null` origins (opaque documents) are rejected.
 */
export function isEmbedMessageSource(
  origin: string,
  source: unknown,
  expectedOrigin: string,
  frame: unknown,
): boolean {
  return (
    typeof frame === "object" &&
    frame !== null &&
    source === frame &&
    origin === expectedOrigin &&
    expectedOrigin.length > 0 &&
    expectedOrigin !== "null"
  );
}

/**
 * Integer protocol number on a FeatureFountain message that this SDK does not speak.
 * Protocol 1 and unrelated objects return null. Callers ignore the message.
 */
export function unsupportedProtocol(data: unknown): number | null {
  const message = plainRecord(data);
  if (!message || message.source !== messageSource) return null;
  const version = message.protocol;
  if (typeof version !== "number" || !Number.isInteger(version)) return null;
  if (version === protocolVersion || version < 1) return null;
  return version;
}

/** Parse a hosted-form message. Messages with extra keys are rejected. Unknown versions and unknown types are ignored. */
export function parseHostMessage(data: unknown): HostMessage | null {
  const message = plainRecord(data);
  if (!message) return null;
  const keys = Object.keys(message);
  if (message.source !== messageSource || message.protocol !== protocolVersion)
    return null;
  if (
    message.type === "ready" ||
    message.type === "close-request" ||
    message.type === "submitted"
  ) {
    return keys.length === 3 ? { kind: message.type } : null;
  }
  if (
    message.type === "resize" &&
    keys.length === 4 &&
    validHeight(message.height)
  ) {
    return { kind: "resize", height: message.height };
  }
  return null;
}
