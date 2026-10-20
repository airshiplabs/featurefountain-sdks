import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  clampFrameHeight,
  defaultTheme,
  embedPathname,
  handshakeMessage,
  isEmbedMessageSource,
  labelMax,
  maxFrameHeight,
  minFrameHeight,
  parseHostMessage,
  parseServiceOrigin,
  themeFromAttributes,
  themeMessage,
  unsupportedProtocol,
  withEmbedFlag,
} from "../src/protocol.js";

const vectors = JSON.parse(
  readFileSync(
    new URL("./fixtures/embed-protocol.vectors.json", import.meta.url),
    "utf8",
  ),
) as {
  source: string;
  protocol: number;
  minFrameHeight: number;
  maxFrameHeight: number;
  parentToForm: {
    handshake: ReturnType<typeof handshakeMessage>;
    theme: ReturnType<typeof themeMessage>;
  };
  formToParent: { message: unknown; parsed: unknown }[];
  legacy: { message: unknown; parsed: unknown }[];
  ignored: unknown[];
  delivery: {
    name: string;
    origin: string;
    source: string;
    expectedOrigin: string;
    frame: string;
    accept: boolean;
  }[];
};

test("json vectors match protocol 1 parent and form messages", () => {
  expect(vectors.protocol).toBe(1);
  expect(vectors.source).toBe("featurefountain");
  expect(vectors.minFrameHeight).toBe(minFrameHeight);
  expect(vectors.maxFrameHeight).toBe(maxFrameHeight);
  expect(minFrameHeight).toBe(100);
  expect(labelMax).toBe(60);
  expect(handshakeMessage()).toEqual(vectors.parentToForm.handshake);
  expect(themeMessage(defaultTheme)).toEqual(vectors.parentToForm.theme);
  for (const vector of [...vectors.formToParent, ...vectors.legacy]) {
    expect(
      parseHostMessage(vector.message),
      JSON.stringify(vector.message),
    ).toEqual(vector.parsed);
  }
});

test("json vectors reject extra keys, protocol 2, and bad heights", () => {
  for (const message of vectors.ignored) {
    expect(parseHostMessage(message), JSON.stringify(message)).toBeNull();
  }
  expect(
    unsupportedProtocol({
      source: "featurefountain",
      protocol: 2,
      type: "close-request",
    }),
  ).toBe(2);
  expect(
    unsupportedProtocol({
      source: "featurefountain",
      protocol: 1,
      type: "ready",
    }),
  ).toBeNull();
  expect(unsupportedProtocol({ type: "featurefountain:close" })).toBeNull();
});

test("json vectors reject the wrong window and opaque origins", () => {
  const windows: Record<string, object> = { frame: {}, sibling: {} };
  for (const vector of vectors.delivery) {
    expect(
      isEmbedMessageSource(
        vector.origin,
        windows[vector.source],
        vector.expectedOrigin,
        windows[vector.frame],
      ),
      vector.name,
    ).toBe(vector.accept);
  }
  expect(parseHostMessage(null)).toBeNull();
  expect(parseHostMessage([])).toBeNull();
  expect(parseHostMessage("ready")).toBeNull();
  expect(parseHostMessage(Object.create(null))).toBeNull();
});

test("short resize heights stay on the wire and clamp to 100 when applied", () => {
  expect(
    parseHostMessage({
      source: "featurefountain",
      protocol: 1,
      type: "resize",
      height: 1,
    }),
  ).toEqual({ kind: "resize", height: 1 });
  expect(clampFrameHeight(1)).toBe(100);
  expect(clampFrameHeight(99)).toBe(100);
  expect(clampFrameHeight(100)).toBe(minFrameHeight);
  expect(clampFrameHeight(480)).toBe(480);
});

test("theme stays out of the embed url and the project id is encoded", () => {
  const theme = themeFromAttributes((name) => {
    const values: Record<string, string> = {
      accent: "#A1B2C3",
      "color-scheme": "dark",
      label: " Found a request ",
      heading: "Tell us",
      "close-label": "Dismiss",
      "submit-label": "Send",
    };
    return values[name] ?? null;
  });
  expect(themeMessage(theme)).toEqual({
    source: "featurefountain",
    protocol: 1,
    type: "theme",
    accent: "#a1b2c3",
    colorScheme: "dark",
    labels: {
      trigger: "Found a request",
      title: "Tell us",
      close: "Dismiss",
      submit: "Send",
    },
  });
  const projectId = "00000000-0000-4000-8000-000000000301";
  const href = withEmbedFlag(
    `https://featurefountain.ai/embed/${projectId}?token=public-token`,
    projectId,
  );
  expect(href).toBe(
    `https://featurefountain.ai${embedPathname(projectId)}?token=public-token&embed=1`,
  );
  expect(href).not.toContain("accent");
  expect(href).not.toContain("theme");
  expect(
    withEmbedFlag("https://featurefountain.ai/embed/a%20b?token=t", "a b"),
  ).toBe("https://featurefountain.ai/embed/a%20b?token=t&embed=1");
  expect(embedPathname("a b")).toBe("/embed/a%20b");
});

test("invalid theme attributes fall back to defaults", () => {
  expect(
    themeFromAttributes((name) => {
      const values: Record<string, string> = {
        accent: "red",
        "color-scheme": "blue",
        label: "",
        heading: "line\nbreak",
        "submit-label": "x".repeat(61),
      };
      return values[name] ?? null;
    }),
  ).toEqual(defaultTheme);
});

test("service origin is https except loopback http", () => {
  expect(parseServiceOrigin("https://featurefountain.ai")).toBe(
    "https://featurefountain.ai",
  );
  expect(parseServiceOrigin("https://featurefountain.ai/")).toBe(
    "https://featurefountain.ai",
  );
  expect(parseServiceOrigin("http://localhost:3000")).toBe(
    "http://localhost:3000",
  );
  expect(parseServiceOrigin("http://127.0.0.1:3000")).toBe(
    "http://127.0.0.1:3000",
  );
  expect(parseServiceOrigin("http://[::1]:3000")).toBe("http://[::1]:3000");
  for (const rejected of [
    "http://service.example",
    "https://user:secret@service.example",
    "https://service.example/path",
    "https://service.example?query=value",
    "https://service.example#fragment",
    "javascript:alert(1)",
    "https://*.example",
    "https://%2A.example",
    "http://localhost.attacker.example",
  ]) {
    expect(parseServiceOrigin(rejected), rejected).toBeNull();
  }
});
