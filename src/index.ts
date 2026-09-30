const tagName = "feature-fountain";
const timeoutMs = 10_000;
const projectIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface Configuration {
  projectId: string;
  origin: string;
}

interface EmbedSession {
  embedUrl: string;
  token: string;
  expiresAt: string;
}

function configuration(element: HTMLElement): Configuration {
  const projectId = element.getAttribute("project-id") ?? "";
  const base = element.getAttribute("api-base") ?? "https://featurefountain.ai";
  if (
    !projectIdPattern.test(projectId) ||
    !/^https?:\/\/[^/?#@\\\s]+\/?$/i.test(base)
  )
    throw new Error("Check the project ID and API origin configuration.");
  const url = new URL(base);
  const loopback =
    url.hostname === "localhost" ||
    url.hostname === "[::1]" ||
    /^127\.\d+\.\d+\.\d+$/.test(url.hostname);
  if (
    /\*|%2a/i.test(url.hostname) ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
  )
    throw new Error("Use an HTTPS API origin, or HTTP on a loopback host.");
  return { projectId, origin: url.origin };
}

function embedSession(value: unknown, config: Configuration): EmbedSession {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid embed session.");
  const fields = value as Record<string, unknown>;
  if (
    Object.keys(fields).length !== 2 ||
    typeof fields.embedUrl !== "string" ||
    typeof fields.expiresAt !== "string"
  )
    throw new Error("Invalid embed session.");
  const url = new URL(fields.embedUrl);
  const expiresAt = Date.parse(fields.expiresAt);
  const token = url.searchParams.get("token");
  if (
    url.origin !== config.origin ||
    url.pathname !== `/embed/${config.projectId}` ||
    url.username ||
    url.password ||
    url.hash ||
    !token ||
    url.searchParams.size !== 1 ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now()
  )
    throw new Error("Invalid embed session.");
  return { embedUrl: url.href, token, expiresAt: fields.expiresAt };
}

class FeatureFountain extends HTMLElement {
  private readonly root = this.attachShadow({ mode: "open" });
  private readonly button: HTMLButtonElement;
  private readonly dialog: HTMLDialogElement;
  private readonly status: HTMLElement;
  private readonly error: HTMLElement;
  private readonly retry: HTMLButtonElement;
  private config?: Configuration;
  private frame?: HTMLIFrameElement;
  private request?: AbortController;
  private frameTimeout?: ReturnType<typeof setTimeout>;
  private ready = false;
  private initialized = false;

  constructor() {
    super();
    this.root.innerHTML = `
      <style>
        :host{display:inline-block;font-family:system-ui,sans-serif;color:#17232c}
        button{font:inherit;cursor:pointer;border:1px solid #1c5060;border-radius:8px;padding:.65rem 1rem;background:#1c5060;color:white}
        button:focus-visible{outline:3px solid #cb710b;outline-offset:3px}
        button:disabled{cursor:not-allowed;opacity:.6}
        dialog{box-sizing:border-box;width:640px;height:640px;max-width:calc(100vw - 32px);max-height:calc(100dvh - 32px);padding:0;border:1px solid #b8c8cc;border-radius:12px;background:#fff;color:inherit}
        dialog::backdrop{background:rgb(10 25 35 / .55)}
        .contents{display:flex;flex-direction:column;height:100%;min-height:0}
        header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px;border-bottom:1px solid #dde5e7}
        h2{margin:0;font-size:1.15rem}header button{padding:.4rem .7rem}
        iframe{flex:1;width:100%;min-height:0;border:0}
        [role=status],[role=alert]{margin:16px;line-height:1.5}
        #retry{align-self:flex-start;margin:0 16px 16px}
        [hidden]{display:none!important}
      </style>
      <button id="open" type="button">Request Feature</button>
      <p id="configuration-error" role="alert" hidden></p>
      <dialog aria-labelledby="heading">
        <div class="contents">
          <header><h2 id="heading">Request a feature</h2><button id="close" type="button" aria-label="Close request form">Close</button></header>
          <p role="status" hidden></p>
          <p id="error" role="alert" hidden></p>
          <button id="retry" type="button" hidden>Try again</button>
        </div>
      </dialog>`;
    this.button = this.root.querySelector<HTMLButtonElement>("#open")!;
    this.dialog = this.root.querySelector<HTMLDialogElement>("dialog")!;
    this.status = this.root.querySelector<HTMLElement>("[role=status]")!;
    this.error = this.root.querySelector<HTMLElement>("#error")!;
    this.retry = this.root.querySelector<HTMLButtonElement>("#retry")!;
    this.button.addEventListener("click", () => {
      this.dialog.showModal();
      if (!this.frame && !this.request) void this.loadSession();
    });
    this.root
      .querySelector("#close")!
      .addEventListener("click", () => this.dialog.close());
    this.dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.dialog.close();
    });
    this.dialog.addEventListener("close", () => this.button.focus());
    this.retry.addEventListener("click", () => void this.loadSession());
  }

  connectedCallback(): void {
    window.addEventListener("message", this.receiveMessage);
    if (this.initialized) return;
    this.initialized = true;
    try {
      this.config = configuration(this);
    } catch {
      this.button.disabled = true;
      const error = this.root.querySelector<HTMLElement>(
        "#configuration-error",
      )!;
      error.textContent =
        "Check the project ID and API origin configuration. Use HTTPS, or HTTP on a loopback host.";
      error.hidden = false;
    }
  }

  disconnectedCallback(): void {
    window.removeEventListener("message", this.receiveMessage);
    this.request?.abort();
    clearTimeout(this.frameTimeout);
  }

  private readonly receiveMessage = (event: MessageEvent): void => {
    if (
      !this.config ||
      !this.frame ||
      event.origin !== this.config.origin ||
      event.source !== this.frame.contentWindow
    )
      return;
    const message: unknown = event.data;
    if (
      !message ||
      typeof message !== "object" ||
      Array.isArray(message) ||
      Object.keys(message).length !== 1 ||
      !("type" in message)
    )
      return;
    if (message.type === "featurefountain:ready") {
      this.ready = true;
      clearTimeout(this.frameTimeout);
      this.status.hidden = true;
    } else if (message.type === "featurefountain:close") {
      this.dialog.close();
    } else if (message.type === "featurefountain:refresh" && this.ready) {
      void this.loadSession();
    }
  };

  private async loadSession(): Promise<void> {
    if (!this.config || this.request) return;
    this.error.hidden = true;
    this.retry.hidden = true;
    this.status.textContent = this.ready
      ? "Refreshing form session…"
      : "Loading feature request form…";
    this.status.hidden = false;
    const controller = new AbortController();
    this.request = controller;
    const requestTimeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(
        `${this.config.origin}/api/v1/projects/${this.config.projectId}/embed-sessions`,
        {
          method: "POST",
          credentials: "omit",
          redirect: "error",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new Error("Session request failed.");
      const session = embedSession(await response.json(), this.config);
      if (!this.isConnected || controller.signal.aborted) return;
      if (this.frame && this.ready) {
        this.frame.contentWindow?.postMessage(
          {
            type: "featurefountain:session",
            token: session.token,
            expiresAt: session.expiresAt,
          },
          this.config.origin,
        );
        this.status.hidden = true;
      } else {
        this.frame = document.createElement("iframe");
        this.frame.title = "Feature request form";
        this.frame.referrerPolicy = "no-referrer";
        this.frame.setAttribute(
          "sandbox",
          "allow-scripts allow-forms allow-same-origin",
        );
        this.frame.src = session.embedUrl;
        this.dialog.querySelector(".contents")!.append(this.frame);
        this.frameTimeout = setTimeout(() => {
          this.frame?.remove();
          this.frame = undefined;
          this.showError();
        }, timeoutMs);
      }
    } catch {
      if (this.isConnected) this.showError();
    } finally {
      clearTimeout(requestTimeout);
      this.request = undefined;
    }
  }

  private showError(): void {
    this.status.hidden = true;
    this.error.textContent =
      "The feature request form could not load. Check your connection and try again.";
    this.error.hidden = false;
    this.retry.hidden = false;
  }
}

if (!customElements.get(tagName))
  customElements.define(tagName, FeatureFountain);

declare global {
  interface HTMLElementTagNameMap {
    "feature-fountain": FeatureFountain;
  }
}

export {};
