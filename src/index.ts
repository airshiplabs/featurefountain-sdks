import {
  clampFrameHeight,
  defaultTheme,
  embedPathname,
  handshakeMessage,
  isEmbedMessageSource,
  sessionMessage,
  minFrameHeight,
  parseHostMessage,
  parseServiceOrigin,
  protocolVersion,
  themeFromAttributes,
  themeMessage,
  unsupportedProtocol,
  withEmbedFlag,
  type Theme,
} from "./protocol.js";

const tagName = "feature-fountain";
const timeoutMs = 10_000;
const submittedStatus = "Request submitted.";
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
  const origin = parseServiceOrigin(
    element.getAttribute("api-base") ?? "https://featurefountain.ai",
  );
  if (!projectIdPattern.test(projectId) || origin === null)
    throw new Error("Check the project ID and API origin configuration.");
  return { projectId, origin };
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
    url.pathname !== embedPathname(config.projectId) ||
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
  static observedAttributes = [
    "accent",
    "color-scheme",
    "label",
    "heading",
    "submit-label",
    "close-label",
  ];

  private readonly root = this.attachShadow({ mode: "open" });
  private readonly button: HTMLButtonElement;
  private readonly dialog: HTMLDialogElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly heading: HTMLHeadingElement;
  private readonly status: HTMLElement;
  private readonly error: HTMLElement;
  private readonly retry: HTMLButtonElement;
  private config?: Configuration;
  private frame?: HTMLIFrameElement;
  private request?: AbortController;
  private frameTimeout?: ReturnType<typeof setTimeout>;
  private ready = false;
  private initialized = false;
  private theme: Theme = defaultTheme;
  private protocolReady = false;
  private themeQueued = false;
  private pendingHeight?: number;
  private readonly seenProtocols = new Set<number>();

  constructor() {
    super();
    this.root.innerHTML = `
      <style>
        :host {
          display: inline-block;
          --ff-accent: ${defaultTheme.accent};
          --ff-text: #17232c;
          --ff-surface: #fff;
          --ff-header-border: #dde5e7;
          --ff-dialog-border: #b8c8cc;
          --ff-close-bg: #f4f7f8;
          --ff-muted: #4d6168;
          --ff-backdrop: rgb(10 25 35 / .55);
          font-family: system-ui, sans-serif;
          color: var(--ff-text);
          color-scheme: light;
        }
        :host([color-scheme="dark"]) {
          --ff-text: #e7eef0;
          --ff-surface: #121a1e;
          --ff-header-border: #2a3a40;
          --ff-dialog-border: #2a3a40;
          --ff-close-bg: #1c2830;
          --ff-muted: #a8b6bb;
          --ff-backdrop: #02060c99;
          color-scheme: dark;
        }
        *, *::before, *::after { box-sizing: border-box; }
        button { font: inherit; cursor: pointer; }
        button:focus-visible { outline: 3px solid #cb710b; outline-offset: 3px; }
        button:disabled { cursor: not-allowed; opacity: .6; }
        #open, #retry {
          border: 1px solid var(--ff-accent);
          border-radius: 8px;
          padding: .65rem 1rem;
          background: var(--ff-accent);
          color: white;
        }
        #open:hover, #retry:hover { filter: brightness(0.88); }
        dialog {
          width: 640px;
          max-width: calc(100vw - 32px);
          max-height: calc(100dvh - 32px);
          padding: 0;
          border: 1px solid var(--ff-dialog-border);
          border-radius: 12px;
          background: var(--ff-surface);
          color: inherit;
          overflow: auto;
        }
        dialog::backdrop { background: var(--ff-backdrop); }
        .contents { display: flex; flex-direction: column; min-height: 0; }
        header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px;
          border-bottom: 1px solid var(--ff-header-border);
        }
        h2 { margin: 0; font-size: 1.15rem; }
        #close {
          border: 1px solid var(--ff-dialog-border);
          border-radius: 8px;
          padding: .4rem .7rem;
          background: var(--ff-close-bg);
          color: var(--ff-text);
        }
        iframe {
          display: block;
          width: 100%;
          height: 320px;
          min-height: ${minFrameHeight}px;
          border: 0;
          background: var(--ff-surface);
          overflow: hidden;
        }
        [role=status], [role=alert] { margin: 16px; line-height: 1.5; }
        [role=status] { color: var(--ff-muted); }
        #retry { align-self: flex-start; margin: 0 16px 16px; }
        [hidden] { display: none !important; }
        .focus-guard { position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0; }
      </style>
      <button id="open" type="button">Request Feature</button>
      <p id="configuration-error" role="alert" hidden></p>
      <dialog aria-labelledby="heading">
        <div class="contents">
          <header><h2 id="heading">Request a feature</h2><button id="close" type="button">Close</button></header>
          <p role="status" hidden></p>
          <p id="error" role="alert" hidden></p>
          <button id="retry" type="button" hidden>Try again</button>
        </div>
      </dialog>`;
    this.button = this.root.querySelector<HTMLButtonElement>("#open")!;
    this.dialog = this.root.querySelector<HTMLDialogElement>("dialog")!;
    this.closeButton = this.root.querySelector<HTMLButtonElement>("#close")!;
    this.heading = this.root.querySelector<HTMLHeadingElement>("h2")!;
    this.status = this.root.querySelector<HTMLElement>("[role=status]")!;
    this.error = this.root.querySelector<HTMLElement>("#error")!;
    this.retry = this.root.querySelector<HTMLButtonElement>("#retry")!;
    this.button.addEventListener("click", () => {
      if (this.status.textContent === submittedStatus) {
        this.status.textContent = "";
        this.status.hidden = true;
      }
      this.dialog.showModal();
      if (!this.frame && !this.request) void this.loadSession();
    });
    this.closeButton.addEventListener("click", () => this.dialog.close());
    this.closeButton.addEventListener("keydown", this.reverseTab);
    this.dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.dialog.close();
    });
    this.dialog.addEventListener("click", (event) => {
      if (event.target === this.dialog) this.dialog.close();
    });
    this.dialog.addEventListener("close", () => this.button.focus());
    this.retry.addEventListener("click", () => void this.loadSession());
  }

  connectedCallback(): void {
    window.addEventListener("message", this.receiveMessage);
    this.applyTheme();
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

  attributeChangedCallback(): void {
    if (!this.isConnected) return;
    this.applyTheme();
    this.postTheme();
  }

  private applyTheme(): void {
    this.theme = themeFromAttributes((name) => this.getAttribute(name));
    this.button.textContent = this.theme.labels.trigger;
    this.heading.textContent = this.theme.labels.title;
    this.closeButton.textContent = this.theme.labels.close;
    if (this.frame) this.frame.title = this.theme.labels.title;
    this.style.setProperty("--ff-accent", this.theme.accent);
  }

  private readonly receiveMessage = (event: MessageEvent): void => {
    if (
      !this.config ||
      !isEmbedMessageSource(
        event.origin,
        event.source,
        this.config.origin,
        this.frame?.contentWindow ?? null,
      )
    )
      return;
    const unsupported = unsupportedProtocol(event.data);
    if (unsupported !== null) {
      this.noteUnsupportedProtocol(unsupported);
      return;
    }
    const message = parseHostMessage(event.data);
    if (!message) return;
    if (message.kind === "ready") {
      this.markReady();
      this.protocolReady = true;
      this.postToFrame(handshakeMessage());
      this.postTheme();
      this.flushPendingHeight();
      return;
    }
    if (message.kind === "close-request") {
      this.dialog.close();
      return;
    }
    if (message.kind === "resize") {
      if (!this.protocolReady) {
        this.pendingHeight = message.height;
        return;
      }
      this.applyFrameHeight(message.height);
      return;
    }
    if (message.kind === "submitted") {
      this.status.textContent = submittedStatus;
      this.status.hidden = false;
      return;
    }
    if (message.kind === "refresh-request") void this.renewSession();
  };

  private applyFrameHeight(height: number): void {
    if (!this.frame) return;
    this.frame.style.height = `${clampFrameHeight(height)}px`;
  }

  private flushPendingHeight(): void {
    if (this.pendingHeight === undefined) return;
    const height = this.pendingHeight;
    this.pendingHeight = undefined;
    this.applyFrameHeight(height);
  }

  private markReady(): void {
    this.ready = true;
    clearTimeout(this.frameTimeout);
    this.status.hidden = true;
  }

  private noteUnsupportedProtocol(version: number): void {
    if (this.seenProtocols.has(version)) return;
    this.seenProtocols.add(version);
    console.debug(
      `FeatureFountain ignored embed protocol ${version}; this SDK speaks protocol ${protocolVersion}.`,
    );
  }

  private postToFrame(message: object): void {
    if (!this.config || !this.frame?.contentWindow) return;
    this.frame.contentWindow.postMessage(message, this.config.origin);
  }

  private postTheme(): void {
    if (!this.protocolReady || this.themeQueued) return;
    this.themeQueued = true;
    queueMicrotask(() => {
      this.themeQueued = false;
      if (!this.protocolReady) return;
      this.postToFrame(themeMessage(this.theme));
    });
  }

  private reverseTab = (event: KeyboardEvent): void => {
    if (event.key === "Tab" && event.shiftKey && this.frame) {
      event.preventDefault();
      const frame = this.frame;
      window.requestAnimationFrame(() => {
        if (this.dialog.open && this.frame === frame)
          frame.contentWindow?.focus();
      });
    }
  };

  private async fetchEmbedSession(signal: AbortSignal): Promise<EmbedSession> {
    if (!this.config) throw new Error("Session request failed.");
    const response = await fetch(
      `${this.config.origin}/api/v1/projects/${encodeURIComponent(this.config.projectId)}/embed-sessions`,
      {
        method: "POST",
        credentials: "omit",
        redirect: "error",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal,
      },
    );
    if (!response.ok) throw new Error("Session request failed.");
    return embedSession(await response.json(), this.config);
  }

  private async renewSession(): Promise<void> {
    if (!this.config || !this.protocolReady || !this.frame || this.request)
      return;
    const controller = new AbortController();
    this.request = controller;
    const requestTimeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const session = await this.fetchEmbedSession(controller.signal);
      if (
        !this.isConnected ||
        controller.signal.aborted ||
        !this.protocolReady ||
        !this.frame
      )
        return;
      this.postToFrame(sessionMessage(session.token, session.expiresAt));
    } catch (error) {
      if (!this.isConnected) return;
      const detail =
        error instanceof Error ? error.message : "Session request failed.";
      console.error(
        `FeatureFountain could not renew the embed session: ${detail}`,
      );
    } finally {
      clearTimeout(requestTimeout);
      if (this.request === controller) this.request = undefined;
    }
  }

  private async loadSession(): Promise<void> {
    if (!this.config || this.request) return;
    this.error.hidden = true;
    this.retry.hidden = true;
    this.status.textContent = "Loading feature request form…";
    this.status.hidden = false;
    const controller = new AbortController();
    this.request = controller;
    const requestTimeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const session = await this.fetchEmbedSession(controller.signal);
      if (!this.isConnected || controller.signal.aborted || this.frame) return;
      this.frame = document.createElement("iframe");
      this.frame.title = this.theme.labels.title;
      this.frame.referrerPolicy = "no-referrer";
      this.frame.setAttribute("scrolling", "no");
      this.frame.setAttribute(
        "sandbox",
        "allow-scripts allow-forms allow-same-origin",
      );
      this.frame.src = withEmbedFlag(session.embedUrl, this.config.projectId);
      this.dialog.querySelector(".contents")!.append(this.frame);
      this.installFocusGuard();
      this.frameTimeout = setTimeout(() => {
        this.frame?.remove();
        this.frame = undefined;
        this.ready = false;
        this.protocolReady = false;
        this.themeQueued = false;
        this.pendingHeight = undefined;
        this.showError();
      }, timeoutMs);
    } catch {
      if (this.isConnected) this.showError();
    } finally {
      clearTimeout(requestTimeout);
      this.request = undefined;
    }
  }

  private installFocusGuard(): void {
    if (this.dialog.querySelector(".focus-guard")) return;
    const guard = this.ownerDocument.createElement("span");
    guard.className = "focus-guard";
    guard.tabIndex = 0;
    guard.addEventListener("focus", () => this.closeButton.focus());
    this.dialog.append(guard);
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
