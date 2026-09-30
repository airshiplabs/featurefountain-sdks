import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    browserName: "chromium",
    locale: "en-US",
    timezoneId: "UTC",
    trace: "retain-on-failure",
  },
});
