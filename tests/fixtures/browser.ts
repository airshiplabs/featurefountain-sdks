import { test as base, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export { expect };
const exec = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));
const projectId = "00000000-0000-4000-8000-000000000301";
let build: Promise<unknown> | undefined;

async function listen(server: Server): Promise<string> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Expected allocated TCP port");
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

interface WidgetSite {
  hostOrigin: string;
  formOrigin: string;
  projectId: string;
}

function attribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export const test = base.extend<{ hostOrigin: string; widgetSite: WidgetSite }>(
  {
    hostOrigin: async ({ widgetSite }, use) => use(widgetSite.hostOrigin),
    widgetSite: async ({ page }, use) => {
      await page.clock.install({ time: new Date("2026-09-04T12:00:00Z") });
      await (build ??= exec("pnpm", ["build"], { cwd: root }));
      let hostOrigin = "";
      let formOrigin = "";
      const formServer = createServer((request, response) => {
        if (request.method === "OPTIONS") {
          response
            .writeHead(204, {
              "Access-Control-Allow-Origin": hostOrigin,
              "Access-Control-Allow-Methods": "POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
            })
            .end();
          return;
        }
        if (request.method === "POST") {
          response.writeHead(201, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": hostOrigin,
          });
          response.end(
            JSON.stringify({
              embedUrl: `${formOrigin}/embed/${projectId}?token=public-test-token`,
              expiresAt: "2026-09-04T12:10:00Z",
            }),
          );
          return;
        }
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(
          `<!doctype html><html lang="en"><head><title>Feature request form</title></head><body><form><label for="title">Title</label><input id="title" autofocus><label for="description">Description</label><textarea id="description"></textarea><button>Submit request</button></form><output id="session"></output><script>addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();parent.postMessage({type:'featurefountain:close'},${JSON.stringify(hostOrigin)});}});addEventListener('message',event=>{if(event.origin===${JSON.stringify(hostOrigin)}&&event.source===parent){document.querySelector('#session').textContent=JSON.stringify(event.data);}});document.querySelector('#title').focus();parent.postMessage({type:'featurefountain:ready'},${JSON.stringify(hostOrigin)});</script></body></html>`,
        );
      });
      const hostServer = createServer(async (request, response) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        if (
          url.pathname === "/widget.js" ||
          url.pathname === "/widget-copy.js"
        ) {
          response.setHeader("Content-Type", "application/javascript");
          response.end(
            await readFile(new URL("../../dist/index.js", import.meta.url)),
          );
          return;
        }
        if (url.pathname === "/browser.js") {
          response.setHeader("Content-Type", "application/javascript");
          response.end(
            await readFile(new URL("../../dist/widget.js", import.meta.url)),
          );
          return;
        }
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(
          `<!doctype html><html lang="en"><head><title>Independent host</title></head><body><feature-fountain project-id="${attribute(url.searchParams.get("project-id") ?? projectId)}" api-base="${attribute(url.searchParams.get("api-base") ?? formOrigin)}"></feature-fountain><script type="module" src="/widget.js"></script></body></html>`,
        );
      });
      try {
        formOrigin = await listen(formServer);
        hostOrigin = await listen(hostServer);
        await use({ hostOrigin, formOrigin, projectId });
      } finally {
        await close(hostServer);
        await close(formServer);
      }
    },
  },
);
