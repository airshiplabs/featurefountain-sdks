import { expect, test } from "vitest";
import {
  buildPageUrl,
  buildViewport,
  buildWidgetContext,
} from "../src/context.js";

test("buildPageUrl strips query and fragment", () => {
  const location = {
    origin: "https://app.example.com",
    pathname: "/reports/monthly",
  } as Location;
  expect(buildPageUrl(location)).toBe(
    "https://app.example.com/reports/monthly",
  );
});

test("buildWidgetContext includes optional metadata", () => {
  const window = {
    location: { origin: "https://app.example.com", pathname: "/home" },
    innerWidth: 1440,
    innerHeight: 900,
  } as Window;
  expect(buildWidgetContext(window, { version: "2.4.1", plan: "pro" })).toEqual(
    {
      pageUrl: "https://app.example.com/home",
      viewport: "1440x900",
      metadata: { version: "2.4.1", plan: "pro" },
    },
  );
});

test("buildViewport rejects impossible sizes", () => {
  expect(buildViewport({ innerWidth: 0, innerHeight: 900 } as Window)).toBe(
    undefined,
  );
});
