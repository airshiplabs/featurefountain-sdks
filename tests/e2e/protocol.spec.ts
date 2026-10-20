import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures/browser";

function protocolDocument(host: string): string {
  const target = JSON.stringify(host);
  return `<!doctype html><html><body>
    <label for="title">Title</label><input id="title">
    <button id="hosted-close">Close</button>
    <button id="close">Done</button>
    <button id="send">Send</button>
    <pre id="seen"></pre>
    <script>
      const seen = [];
      const target = ${target};
      addEventListener("message", (event) => {
        if (event.origin !== target || event.source !== parent) return;
        seen.push(event.data);
        document.querySelector("#seen").textContent = JSON.stringify(seen);
        if (event.data && event.data.type === "handshake" && event.data.embed === true) {
          document.body.dataset.initialized = "true";
          document.querySelector("#hosted-close").hidden = true;
          parent.postMessage({ source: "featurefountain", protocol: 1, type: "resize", height: 480 }, target);
        }
      });
      parent.postMessage({ source: "featurefountain", protocol: 1, type: "ready" }, target);
      document.querySelector("#close").onclick = () =>
        parent.postMessage({ source: "featurefountain", protocol: 1, type: "close-request" }, target);
      document.querySelector("#send").onclick = () =>
        parent.postMessage({ source: "featurefountain", protocol: 1, type: "submitted" }, target);
    </script>
  </body></html>`;
}

async function seen(page: Page): Promise<unknown[]> {
  const text = await page.frameLocator("iframe").locator("#seen").textContent();
  return JSON.parse(text || "[]") as unknown[];
}

test("protocol handshake themes, resizes, and adds embed=1", async ({
  page,
  widgetSite,
}) => {
  const embedRequest = page.waitForRequest((request) =>
    request.url().startsWith(`${widgetSite.formOrigin}/embed/`),
  );
  await page.route(`${widgetSite.formOrigin}/embed/**`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: protocolDocument(widgetSite.hostOrigin),
    }),
  );
  await page.goto(widgetSite.hostOrigin);
  await page.locator("feature-fountain").evaluate((widget) => {
    widget.setAttribute("accent", "#A1B2C3");
    widget.setAttribute("color-scheme", "dark");
    widget.setAttribute("label", "Found a request");
    widget.setAttribute("heading", "Tell us");
    widget.setAttribute("close-label", "Dismiss");
    widget.setAttribute("submit-label", "Send it");
  });
  await page
    .getByRole("button", { name: "Found a request", exact: true })
    .click();
  await expect(page.frameLocator("iframe").locator("body")).toHaveAttribute(
    "data-initialized",
    "true",
  );
  await expect(
    page.frameLocator("iframe").locator("#hosted-close"),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Dismiss", exact: true }),
  ).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Tell us" })).toBeVisible();
  const url = new URL((await embedRequest).url());
  expect(url.pathname).toBe(
    `/embed/${encodeURIComponent(widgetSite.projectId)}`,
  );
  expect(url.searchParams.get("embed")).toBe("1");
  expect(url.searchParams.get("token")).toBe("public-test-token");
  expect(url.href).not.toContain("accent");
  expect(url.href).not.toContain("color-scheme");
  await expect
    .poll(() => seen(page))
    .toEqual([
      {
        source: "featurefountain",
        protocol: 1,
        type: "handshake",
        embed: true,
      },
      {
        source: "featurefountain",
        protocol: 1,
        type: "theme",
        accent: "#a1b2c3",
        colorScheme: "dark",
        labels: {
          trigger: "Found a request",
          title: "Tell us",
          close: "Dismiss",
          submit: "Send it",
        },
      },
    ]);
  await expect(page.locator("iframe").first()).toHaveJSProperty(
    "style.height",
    "480px",
  );
  const surface = await page.locator("feature-fountain").evaluate((widget) => {
    const dialog = widget.shadowRoot?.querySelector("dialog");
    return dialog ? getComputedStyle(dialog).backgroundColor : "";
  });
  expect(surface).toBe("rgb(18, 26, 30)");
});

test("theme updates in one turn collapse into a single message", async ({
  page,
  widgetSite,
}) => {
  await page.route(`${widgetSite.formOrigin}/embed/**`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: protocolDocument(widgetSite.hostOrigin),
    }),
  );
  await page.goto(widgetSite.hostOrigin);
  await page.locator("feature-fountain").evaluate((widget) => {
    widget.setAttribute("accent", "red");
  });
  await page
    .getByRole("button", { name: "Request Feature", exact: true })
    .click();
  await expect(page.frameLocator("iframe").locator("body")).toHaveAttribute(
    "data-initialized",
    "true",
  );
  await expect
    .poll(() => seen(page).then((messages) => messages[1]))
    .toMatchObject({
      type: "theme",
      accent: "#1c5060",
      colorScheme: "light",
    });
  await page.locator("feature-fountain").evaluate((widget) => {
    widget.setAttribute("accent", "#112233");
    widget.setAttribute("color-scheme", "dark");
    widget.setAttribute("label", "Ask");
  });
  await expect
    .poll(() => seen(page).then((messages) => messages.length))
    .toBe(3);
  const messages = await seen(page);
  expect(messages[2]).toMatchObject({
    type: "theme",
    accent: "#112233",
    colorScheme: "dark",
    labels: { trigger: "Ask" },
  });
});

test("submitted leaves the dialog open and close-request closes it", async ({
  page,
  widgetSite,
}) => {
  await page.route(`${widgetSite.formOrigin}/embed/**`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: protocolDocument(widgetSite.hostOrigin),
    }),
  );
  await page.goto(widgetSite.hostOrigin);
  const trigger = page.getByRole("button", {
    name: "Request Feature",
    exact: true,
  });
  await trigger.click();
  await expect(page.frameLocator("iframe").locator("body")).toHaveAttribute(
    "data-initialized",
    "true",
  );
  await page
    .frameLocator("iframe")
    .getByRole("button", { name: "Send", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Request submitted.");
  await page
    .frameLocator("iframe")
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("wrong window and protocol 2 cannot close or resize", async ({
  page,
  widgetSite,
}) => {
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  await page.route(`${widgetSite.formOrigin}/embed/**`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: protocolDocument(widgetSite.hostOrigin),
    }),
  );
  await page.goto(widgetSite.hostOrigin);
  await page
    .getByRole("button", { name: "Request Feature", exact: true })
    .click();
  const widgetFrame = page.frameLocator('iframe[title="Request a feature"]');
  await expect(widgetFrame.locator("body")).toHaveAttribute(
    "data-initialized",
    "true",
  );
  await expect(
    page.locator('iframe[title="Request a feature"]'),
  ).toHaveJSProperty("style.height", "480px");
  await page.evaluate((formOrigin) => {
    const sibling = document.createElement("iframe");
    sibling.id = "sibling-frame";
    sibling.src = `${formOrigin}/embed/sibling`;
    document.body.append(sibling);
  }, widgetSite.formOrigin);
  await page.frameLocator("#sibling-frame").locator("body").waitFor();
  await page
    .frameLocator("#sibling-frame")
    .locator("body")
    .evaluate((body, host) => {
      parent.postMessage(
        { source: "featurefountain", protocol: 1, type: "close-request" },
        host,
      );
      parent.postMessage(
        { source: "featurefountain", protocol: 1, type: "resize", height: 200 },
        host,
      );
    }, widgetSite.hostOrigin);
  await widgetFrame.locator("body").evaluate((body, host) => {
    parent.postMessage(
      { source: "featurefountain", protocol: 2, type: "resize", height: 220 },
      host,
    );
    parent.postMessage(
      { source: "featurefountain", protocol: 2, type: "close-request" },
      host,
    );
  }, widgetSite.hostOrigin);
  await expect
    .poll(() => logs.filter((line) => line.includes("protocol 2")).length)
    .toBe(1);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.locator('iframe[title="Request a feature"]'),
  ).toHaveJSProperty("style.height", "480px");
});

test("resize before ready is held and short heights clamp to 100", async ({
  page,
  widgetSite,
}) => {
  await page.route(`${widgetSite.formOrigin}/embed/**`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><title>Quiet form</title><p id="mark">Quiet</p>',
    }),
  );
  await page.goto(widgetSite.hostOrigin);
  await page
    .getByRole("button", { name: "Request Feature", exact: true })
    .click();
  const frame = page.locator('iframe[title="Request a feature"]');
  const body = page
    .frameLocator('iframe[title="Request a feature"]')
    .locator("#mark");
  await body.waitFor();
  await body.evaluate((_body, host: string) => {
    parent.postMessage(
      { source: "featurefountain", protocol: 1, type: "resize", height: 1 },
      host,
    );
  }, widgetSite.hostOrigin);
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  await expect(frame).toHaveJSProperty("style.height", "");
  await body.evaluate((_body, host: string) => {
    parent.postMessage(
      { source: "featurefountain", protocol: 1, type: "ready" },
      host,
    );
  }, widgetSite.hostOrigin);
  await expect(frame).toHaveJSProperty("style.height", "100px");
  await body.evaluate((_body, host: string) => {
    parent.postMessage(
      { source: "featurefountain", protocol: 1, type: "resize", height: 480 },
      host,
    );
  }, widgetSite.hostOrigin);
  await expect(frame).toHaveJSProperty("style.height", "480px");
});

test("the shell closes when the iframe never loads", async ({
  page,
  widgetSite,
}) => {
  await page.route(`${widgetSite.formOrigin}/embed/**`, (route) =>
    route.abort(),
  );
  await page.goto(widgetSite.hostOrigin);
  const trigger = page.getByRole("button", {
    name: "Request Feature",
    exact: true,
  });
  const dialog = page.getByRole("dialog");
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close", exact: true }),
  ).toHaveCount(1);
  await expect(page.locator("iframe")).toHaveCount(1);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
