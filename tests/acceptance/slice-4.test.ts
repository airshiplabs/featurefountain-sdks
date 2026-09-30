import { afterEach, expect, test } from "vitest";
import { buildCleanCheckout, type CleanPackage } from "../fixtures/package";

let built: CleanPackage | undefined;

afterEach(async () => {
  await built?.close();
  built = undefined;
});

test("clean_checkout_builds_secret_free_public_package", async () => {
  built = await buildCleanCheckout({
    DATABASE_URL:
      "postgresql://private_database_canary.invalid/featurefountain",
    GITHUB_CLIENT_SECRET: "private_github_secret_canary",
    TURNSTILE_SECRET_KEY: "private_challenge_secret_canary",
  });
  expect(built.bundle).toContain("feature-fountain");
  expect(built.bundle).toContain("customElements.define");
  expect(built.files).toEqual(
    expect.arrayContaining([
      "package/dist/index.js",
      "package/dist/widget.js",
      "package/dist/index.d.ts",
      "package/package.json",
      "package/README.md",
      "package/LICENSE",
    ]),
  );
  expect(built.fileList).not.toMatch(
    /package\/(?:\.env|src\/|tests\/|node_modules\/|migrations\/)/,
  );
  expect(built.contents).not.toMatch(
    /private_database_canary|private_github_secret_canary|private_challenge_secret_canary/,
  );
  expect(built.manifest.name).toBe("@featurefountain/browser");
  expect(built.manifest.license).toBe("MIT");
});
