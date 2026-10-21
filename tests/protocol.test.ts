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
  sessionMessage,
  themeFromAttributes,
  themeMessage,
  unsupportedProtocol,
  withEmbedFlag,
} from "../src/protocol.js";

type MessageVector = {
  name: string;
  product: string;
  data: Record<string, unknown>;
  kind: string | null;
};

type ParentVector = {
  name: string;
  product: string;
  data: Record<string, unknown>;
  origin: string;
  parentOrigin: string;
  sourceIsParent: boolean;
  framed: boolean;
  hidesClose: boolean;
};

const vectors = JSON.parse(
  readFileSync(
    new URL("./fixtures/embed-protocol.json", import.meta.url),
    "utf8",
  ),
) as { messages: MessageVector[]; parent: ParentVector[] };

function message(name: string): MessageVector {
  const found = vectors.messages.find((item) => item.name === name);
  if (!found) throw new Error(`Missing message vector ${name}`);
  return found;
}

function parent(name: string): ParentVector {
  const found = vectors.parent.find((item) => item.name === name);
  if (!found) throw new Error(`Missing parent vector ${name}`);
  return found;
}

test("featurefountain rows in the shared protocol vectors", () => {
  const formKinds = new Set(["ready", "resize", "close-request", "submitted"]);
  const rows = vectors.messages.filter(
    (item) => item.product === "featurefountain",
  );
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    const parsed = parseHostMessage(row.data);
    if (row.kind === "handshake") {
      expect(row.data, row.name).toEqual(handshakeMessage());
      expect(parsed, row.name).toBeNull();
    } else if (row.kind === "resize") {
      expect(parsed, row.name).toEqual({
        kind: "resize",
        height: row.data.height,
      });
    } else if (row.kind && formKinds.has(row.kind)) {
      expect(parsed, row.name).toEqual({ kind: row.kind });
    } else {
      expect(parsed, row.name).toBeNull();
    }
  }
  const shortest = message("resize min height");
  expect(
    parseHostMessage({ ...shortest.data, source: "featurefountain" }),
  ).toEqual({ kind: "resize", height: 1 });
  expect(clampFrameHeight(1)).toBe(minFrameHeight);
  expect(
    parseHostMessage({
      ...message("extra field").data,
      source: "featurefountain",
    }),
  ).toBeNull();
  expect(
    unsupportedProtocol({
      ...message("protocol 2").data,
      source: "featurefountain",
    }),
  ).toBe(2);
  expect(parseHostMessage({ type: "featurefountain:ready" })).toBeNull();
  expect(parseHostMessage({ type: "featurefountain:close" })).toBeNull();
  expect(parseHostMessage({ type: "featurefountain:refresh" })).toBeNull();
  expect(
    parseHostMessage({
      type: "featurefountain:session",
      token: "token",
      expiresAt: "2030-01-01T00:00:00.000Z",
    }),
  ).toBeNull();
  expect(labelMax).toBe(60);
  expect(maxFrameHeight).toBe(4096);
});

test("session replies are posted to the endpoint origin", () => {
  const source = readFileSync(
    new URL("../src/index.ts", import.meta.url),
    "utf8",
  );
  expect(source).toContain(
    "this.frame.contentWindow.postMessage(message, this.config.origin)",
  );
  expect(source).not.toContain('postMessage(message, "*"');
  expect(source).not.toContain("postMessage(message, '*'");
});

test("refresh-request uses exact keys and session replies with an ISO expiry", () => {
  expect(
    parseHostMessage({
      source: "featurefountain",
      protocol: 1,
      type: "refresh-request",
    }),
  ).toEqual({ kind: "refresh-request" });
  expect(
    parseHostMessage({
      source: "featurefountain",
      protocol: 1,
      type: "refresh-request",
      extra: true,
    }),
  ).toBeNull();
  const reply = sessionMessage("public-token", "2026-09-04T12:10:00Z");
  expect(reply).toEqual({
    source: "featurefountain",
    protocol: 1,
    type: "session",
    token: "public-token",
    expiresAt: "2026-09-04T12:10:00.000Z",
  });
  expect(Object.keys(reply)).toEqual([
    "source",
    "protocol",
    "type",
    "token",
    "expiresAt",
  ]);
});

test("parent vectors reject the wrong window and an opaque origin", () => {
  const frame = {};
  const otherWindow = {};
  const wrong = parent("wrong window");
  expect(wrong.hidesClose).toBe(false);
  expect(
    isEmbedMessageSource(wrong.origin, otherWindow, wrong.parentOrigin, frame),
  ).toBe(false);
  expect(
    isEmbedMessageSource(wrong.origin, frame, wrong.parentOrigin, frame),
  ).toBe(true);
  const opaque = parent("opaque origin");
  expect(opaque.hidesClose).toBe(false);
  expect(
    isEmbedMessageSource(opaque.origin, frame, opaque.parentOrigin, frame),
  ).toBe(false);
  const handshake = parent("featurefountain handshake from parent");
  expect(handshake.hidesClose).toBe(true);
  expect(handshake.data).toEqual(handshakeMessage());
  expect(
    isEmbedMessageSource(
      handshake.origin,
      frame,
      handshake.parentOrigin,
      frame,
    ),
  ).toBe(true);
  const protocol2 = parent("protocol 2 from parent");
  expect(protocol2.hidesClose).toBe(false);
  expect(
    unsupportedProtocol({ ...protocol2.data, source: "featurefountain" }),
  ).toBe(2);
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
