import { test, expect } from "../fixtures/browser";

test("keyboard_user_opens_and_dismisses_hosted_form", async ({
  page,
  hostOrigin,
}) => {
  await page.goto(hostOrigin);
  const button = page.getByRole("button", {
    name: "Request Feature",
    exact: true,
  });
  await expect(button).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Request a feature", exact: true }),
  ).toBeVisible();
  const form = page.frameLocator('iframe[title="Feature request form"]');
  await expect(form.getByLabel("Title", { exact: true })).toBeFocused();
  await page.keyboard.type("Keyboard shortcuts");
  await expect(form.getByLabel("Title", { exact: true })).toHaveValue(
    "Keyboard shortcuts",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Request a feature", exact: true }),
  ).not.toBeVisible();
  await expect(button).toBeFocused();
});

for (const apiBase of [
  "http://service.example",
  "https://user:secret@service.example",
  "https://service.example/path",
  "https://service.example?query=value",
  "https://service.example#fragment",
  "javascript:alert(1)",
  "https://*.example",
  "https://%2A.example",
  "https://＊.example",
  "http://localhost.attacker.example",
]) {
  test(`rejects unsupported API base ${apiBase}`, async ({
    page,
    hostOrigin,
  }) => {
    await page.goto(`${hostOrigin}/?api-base=${encodeURIComponent(apiBase)}`);
    await expect(page.getByRole("alert")).toContainText(
      /configuration|api|https|origin/i,
    );
    await expect(page.locator("iframe")).toHaveCount(0);
  });
}

for (const projectId of [
  "",
  "not-a-uuid",
  "../../private",
  "00000000-0000-4000-8000-00000000030",
]) {
  test(`rejects invalid project identifier ${JSON.stringify(projectId)}`, async ({
    page,
    hostOrigin,
  }) => {
    await page.goto(
      `${hostOrigin}/?project-id=${encodeURIComponent(projectId)}`,
    );
    await expect(page.getByRole("alert")).toContainText(
      /configuration|project/i,
    );
    await expect(page.locator("iframe")).toHaveCount(0);
  });
}

test("defaults to the production API origin", async ({ page, hostOrigin }) => {
  await page.goto(hostOrigin);
  await page.evaluate(() => {
    document.querySelector("feature-fountain")?.remove();
    const widget = document.createElement("feature-fountain");
    widget.setAttribute("project-id", "00000000-0000-4000-8000-000000000301");
    document.body.append(widget);
  });
  await page.route(
    "https://featurefountain.ai/api/v1/projects/*/embed-sessions",
    (route) =>
      route.fulfill({ status: 503, json: { error: { code: "unavailable" } } }),
  );
  const request = page.waitForRequest(
    "https://featurefountain.ai/api/v1/projects/00000000-0000-4000-8000-000000000301/embed-sessions",
  );
  await expect(
    page.getByRole("button", { name: "Request Feature", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Request Feature", exact: true })
    .click();
  expect((await request).method()).toBe("POST");
});

test("a second module and browser bundle load preserve the registered element", async ({
  page,
  hostOrigin,
}) => {
  await page.goto(hostOrigin);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addScriptTag({
    type: "module",
    url: `${hostOrigin}/widget-copy.js`,
  });
  await page.addScriptTag({ url: `${hostOrigin}/browser.js` });
  await expect(
    page.getByRole("button", { name: "Request Feature", exact: true }),
  ).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("session requests send empty JSON without host credentials", async ({
  page,
  context,
  widgetSite,
}) => {
  await context.addCookies([
    { name: "host-secret", value: "cookie-canary", url: widgetSite.formOrigin },
  ]);
  await page.goto(widgetSite.hostOrigin);
  const request = page.waitForRequest(
    `${widgetSite.formOrigin}/api/v1/projects/${widgetSite.projectId}/embed-sessions`,
  );
  await expect(
    page.getByRole("button", { name: "Request Feature", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Request Feature", exact: true })
    .click();
  const sent = await request;
  expect(sent.method()).toBe("POST");
  expect(sent.postDataJSON()).toEqual({});
  expect(await sent.headerValue("content-type")).toBe("application/json");
  expect(await sent.headerValue("cookie")).toBeNull();
  expect(await sent.headerValue("authorization")).toBeNull();
  expect(await sent.headerValue("origin")).toBe(widgetSite.hostOrigin);
});

test("the hosted frame has its accessibility and privacy attributes", async ({
  page,
  hostOrigin,
}) => {
  await page.goto(hostOrigin);
  await expect(
    page.getByRole("button", { name: "Request Feature", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Request Feature", exact: true })
    .click();
  const frame = page.locator('iframe[title="Feature request form"]');
  await expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(frame).toHaveAttribute(
    "sandbox",
    "allow-scripts allow-forms allow-same-origin",
  );
  await expect(
    page.getByRole("dialog", { name: "Request a feature", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /close/i })).toBeVisible();
});

test("closing and reopening preserves form text and returns focus", async ({
  page,
  hostOrigin,
}) => {
  await page.goto(hostOrigin);
  const button = page.getByRole("button", {
    name: "Request Feature",
    exact: true,
  });
  await expect(button).toBeVisible();
  await button.click();
  const title = page
    .frameLocator('iframe[title="Feature request form"]')
    .getByLabel("Title", { exact: true });
  await title.fill("Keep these words");
  await page.getByRole("button", { name: /close/i }).click();
  await expect(button).toBeFocused();
  await expect(button).toBeVisible();
  await button.click();
  await expect(title).toHaveValue("Keep these words");
});

for (const invalidMessage of [
  {
    label: "wrong origin",
    origin: "https://attacker.example",
    data: { type: "featurefountain:close" },
    source: "frame",
  },
  {
    label: "wrong window",
    origin: "service",
    data: { type: "featurefountain:close" },
    source: "host",
  },
  {
    label: "missing source",
    origin: "service",
    data: { type: "featurefountain:close" },
    source: "none",
  },
  {
    label: "unknown type",
    origin: "service",
    data: { type: "featurefountain:destroy" },
    source: "frame",
  },
  {
    label: "extra fields",
    origin: "service",
    data: { type: "featurefountain:close", token: "injected" },
    source: "frame",
  },
  {
    label: "non-object data",
    origin: "service",
    data: "featurefountain:close",
    source: "frame",
  },
]) {
  test(`ignores a close message with ${invalidMessage.label}`, async ({
    page,
    widgetSite,
  }) => {
    await page.goto(widgetSite.hostOrigin);
    await expect(
      page.getByRole("button", { name: "Request Feature", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Request Feature", exact: true })
      .click();
    await expect(
      page.frameLocator("iframe").getByLabel("Title", { exact: true }),
    ).toBeVisible();
    await page.evaluate(
      ({ invalidMessage, serviceOrigin }) => {
        const frame = document
          .querySelector("feature-fountain")
          ?.shadowRoot?.querySelector("iframe");
        dispatchEvent(
          new MessageEvent("message", {
            origin:
              invalidMessage.origin === "service"
                ? serviceOrigin
                : invalidMessage.origin,
            source:
              invalidMessage.source === "frame"
                ? frame?.contentWindow
                : invalidMessage.source === "host"
                  ? window
                  : null,
            data: invalidMessage.data,
          }),
        );
      },
      { invalidMessage, serviceOrigin: widgetSite.formOrigin },
    );
    await expect(
      page.getByRole("dialog", { name: "Request a feature", exact: true }),
    ).toBeVisible();
  });
}

test("refresh sends the new session to the existing frame without losing text", async ({
  page,
  widgetSite,
}) => {
  await page.goto(widgetSite.hostOrigin);
  await expect(
    page.getByRole("button", { name: "Request Feature", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Request Feature", exact: true })
    .click();
  const form = page.frameLocator("iframe");
  await form
    .getByLabel("Title", { exact: true })
    .fill("Preserved during refresh");
  await page.route(
    `${widgetSite.formOrigin}/api/v1/projects/*/embed-sessions`,
    (route) =>
      route.fulfill({
        status: 201,
        json: {
          embedUrl: `${widgetSite.formOrigin}/embed/${widgetSite.projectId}?token=refreshed-public-token`,
          expiresAt: "2026-09-04T12:20:00Z",
        },
      }),
  );
  await form
    .locator("body")
    .evaluate(
      (_body, hostOrigin) =>
        parent.postMessage({ type: "featurefountain:refresh" }, hostOrigin),
      widgetSite.hostOrigin,
    );
  await expect(form.locator("#session")).toHaveText(
    JSON.stringify({
      type: "featurefountain:session",
      token: "refreshed-public-token",
      expiresAt: "2026-09-04T12:20:00Z",
    }),
  );
  await expect(form.getByLabel("Title", { exact: true })).toHaveValue(
    "Preserved during refresh",
  );
  await expect(page.locator("iframe")).toHaveAttribute(
    "src",
    `${widgetSite.formOrigin}/embed/${widgetSite.projectId}?token=public-test-token`,
  );
});

test("a session error permits a deliberate retry", async ({
  page,
  widgetSite,
}) => {
  await page.route(
    `${widgetSite.formOrigin}/api/v1/projects/*/embed-sessions`,
    (route) =>
      route.fulfill({
        status: 503,
        json: {
          error: {
            code: "upstream_unavailable",
            message: "private-upstream-canary",
          },
        },
      }),
  );
  await page.goto(widgetSite.hostOrigin);
  await expect(
    page.getByRole("button", { name: "Request Feature", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Request Feature", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("alert")).not.toContainText(
    "private-upstream-canary",
  );
  await page.unroute(
    `${widgetSite.formOrigin}/api/v1/projects/*/embed-sessions`,
  );
  await page.getByRole("button", { name: /retry|try again/i }).click();
  await expect(
    page.frameLocator("iframe").getByLabel("Title", { exact: true }),
  ).toBeVisible();
});

test("a stalled session request ends with a retry action", async ({
  page,
  widgetSite,
}) => {
  await page.route(
    `${widgetSite.formOrigin}/api/v1/projects/*/embed-sessions`,
    () => {},
  );
  await page.goto(widgetSite.hostOrigin);
  const request = page.waitForRequest(
    `${widgetSite.formOrigin}/api/v1/projects/${widgetSite.projectId}/embed-sessions`,
  );
  await expect(
    page.getByRole("button", { name: "Request Feature", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Request Feature", exact: true })
    .click();
  await request;
  await page.clock.fastForward(15_000);
  await expect(page.getByRole("alert")).toContainText(
    /load|connect|timed out/i,
  );
  await expect(
    page.getByRole("button", { name: /retry|try again/i }),
  ).toBeVisible();
});

test("a frame that never becomes ready ends its loading state", async ({
  page,
  widgetSite,
}) => {
  await page.route(`${widgetSite.formOrigin}/embed/**`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Unresponsive frame</title>",
    }),
  );
  await page.goto(widgetSite.hostOrigin);
  await expect(
    page.getByRole("button", { name: "Request Feature", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Request Feature", exact: true })
    .click();
  await expect(page.locator("iframe")).toHaveCount(1);
  await page.clock.fastForward(15_000);
  await expect(page.getByRole("alert")).toContainText(
    /load|connect|timed out/i,
  );
  await expect(
    page.getByRole("button", { name: /retry|try again/i }),
  ).toBeVisible();
});

for (const invalidSession of [
  {
    label: "foreign service",
    embedUrl:
      "https://attacker.example/embed/00000000-0000-4000-8000-000000000301?token=public-token",
    expiresAt: "2026-09-04T12:10:00Z",
  },
  {
    label: "missing token",
    embedUrl: "/embed/00000000-0000-4000-8000-000000000301",
    expiresAt: "2026-09-04T12:10:00Z",
  },
  {
    label: "wrong project",
    embedUrl: "/embed/00000000-0000-4000-8000-000000000999?token=public-token",
    expiresAt: "2026-09-04T12:10:00Z",
  },
  {
    label: "expired time",
    embedUrl: "/embed/00000000-0000-4000-8000-000000000301?token=public-token",
    expiresAt: "2026-09-04T11:50:00Z",
  },
]) {
  test(`rejects a session response with ${invalidSession.label}`, async ({
    page,
    widgetSite,
  }) => {
    await page.route(
      `${widgetSite.formOrigin}/api/v1/projects/*/embed-sessions`,
      (route) =>
        route.fulfill({
          status: 201,
          json: {
            embedUrl: new URL(invalidSession.embedUrl, widgetSite.formOrigin)
              .href,
            expiresAt: invalidSession.expiresAt,
          },
        }),
    );
    await page.goto(widgetSite.hostOrigin);
    await expect(
      page.getByRole("button", { name: "Request Feature", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Request Feature", exact: true })
      .click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);
  });
}

test("the dialog fits a narrow host viewport", async ({ page, hostOrigin }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(hostOrigin);
  await expect(
    page.getByRole("button", { name: "Request Feature", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Request Feature", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Request a feature",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect(box?.y).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? Infinity)).toBeLessThanOrEqual(375);
  expect((box?.y ?? 0) + (box?.height ?? Infinity)).toBeLessThanOrEqual(667);
});
