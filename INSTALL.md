# Install FeatureFountain in a host app

This guide is for coding agents integrating the browser widget. The custom element tag is **`feature-fountain`**. The npm package is **`@featurefountain/browser`**.

## 1. Detect the host stack

Inspect the repository (for example `package.json`, framework config, and HTML entry points) and pick an integration path:

| Stack                                           | Prefer                                 |
| ----------------------------------------------- | -------------------------------------- |
| Plain HTML, or a site with no JS bundler        | CDN script tag                         |
| React, Next.js, Vue, Svelte, or any bundled app | npm package `@featurefountain/browser` |

Use the **script tag** when the host only serves static HTML or you cannot add an npm dependency. Use **npm** when the app already bundles JavaScript modules.

The widget registers `<feature-fountain>` once. Loading the script or module again does not break an existing registration.

## 2. Install the package (npm path only)

From the host app root, using the project's package manager:

```sh
npm install @featurefountain/browser
```

```sh
pnpm add @featurefountain/browser
```

```sh
yarn add @featurefountain/browser
```

Then import the package **in browser-only code** (it requires `HTMLElement` and `customElements`):

```js
import "@featurefountain/browser";
```

Importing registers `<feature-fountain>`. Set element attributes **before** attaching the element to the document.

### CDN script tag (no npm)

Add to the host HTML (layout, template, or `index.html`):

```html
<script src="https://featurefountain.ai/widget/v1.js" defer></script>
```

Place the element where the button should appear:

```html
<feature-fountain
  project-id="YOUR_PUBLIC_PROJECT_UUID"
  api-base="https://featurefountain.ai"
></feature-fountain>
```

## 3. Place `<feature-fountain>` in the UI

Put the element where end users should open the request form (footer, settings page, help menu, and so on). The shadow UI exposes a **Request Feature** button that opens a **Request a feature** dialog with a hosted iframe form.

### Plain HTML

```html
<script src="https://featurefountain.ai/widget/v1.js" defer></script>
<feature-fountain
  project-id="YOUR_PUBLIC_PROJECT_UUID"
  api-base="https://featurefountain.ai"
></feature-fountain>
```

### React (Vite, CRA, etc.)

Create a client-only wrapper. Do not import `@featurefountain/browser` in Server Components or during SSR.

```tsx
import { useEffect } from "react";

export function FeatureFountainButton({
  projectId,
  apiBase = "https://featurefountain.ai",
}: {
  projectId: string;
  apiBase?: string;
}) {
  useEffect(() => {
    void import("@featurefountain/browser");
  }, []);

  return <feature-fountain project-id={projectId} api-base={apiBase} />;
}
```

For TypeScript JSX, extend intrinsic elements (once per project):

```ts
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "feature-fountain": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "project-id": string;
          "api-base"?: string;
        },
        HTMLElement
      >;
    }
  }
}
```

Alternatively, import types from `@featurefountain/browser` after install; the package augments `HTMLElementTagNameMap` with `"feature-fountain"`.

### Next.js App Router

Put the widget in a Client Component (`"use client"`). Import `@featurefountain/browser` inside `useEffect` or use `next/dynamic` with `{ ssr: false }` for a small wrapper module that only runs in the browser.

### Next.js Pages Router

Use `dynamic(() => import("./FeatureFountainButton"), { ssr: false })` for a component that imports `@featurefountain/browser` and renders `<feature-fountain>`.

### Vue 3

Register is automatic after side-effect import in a client entry or component `onMounted`:

```vue
<script setup>
import { onMounted } from "vue";

onMounted(() => {
  import("@featurefountain/browser");
});
</script>

<template>
  <feature-fountain
    project-id="YOUR_PUBLIC_PROJECT_UUID"
    api-base="https://featurefountain.ai"
  />
</template>
```

Add `"feature-fountain"` to `compilerOptions.isCustomElement` in `vite.config` if the compiler warns on unknown tags.

### Svelte

Import in `onMount` or a `+layout`/`+page` that runs only in the browser:

```svelte
<script>
  import { onMount } from "svelte";

  onMount(() => {
    import("@featurefountain/browser");
  });
</script>

<feature-fountain
  project-id="YOUR_PUBLIC_PROJECT_UUID"
  api-base="https://featurefountain.ai"
/>
```

## 4. Attributes (full API)

The element supports **only** these HTML attributes (see `src/index.ts` in this repository):

| Attribute      | Required | Description                                                                                      |
| -------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `project-id`   | Yes      | Public project UUID. Must match RFC 4122 form (version nibble `1`–`8`, variant `8`/`9`/`a`/`b`). |
| `api-base`     | No       | FeatureFountain service origin. Default: `https://featurefountain.ai`.                           |
| `label`        | No       | Trigger text. Default `Request Feature`. 1–60 characters.                                        |
| `heading`      | No       | Dialog title. Default `Request a feature`.                                                       |
| `close-label`  | No       | The SDK Close button. Default `Close`. The dialog has one Close control.                         |
| `submit-label` | No       | Submit label sent to the hosted form. Default `Submit request`.                                  |
| `accent`       | No       | `#rrggbb` hex. Default `#1c5060`. Applied to the trigger and sent to the form.                   |
| `color-scheme` | No       | `light` or `dark`. Default `light`.                                                              |

`api-base` rules enforced in the widget:

- Must be a bare origin URL (`https://host` or `http://host`), with optional trailing slash only. No path, query, fragment, userinfo, or wildcards.
- Production hosts must use **HTTPS**.
- **HTTP** is allowed only on loopback: `localhost`, `127.x.x.x`, or `[::1]` (for local FeatureFountain dev).
- Invalid `project-id` or `api-base` disables the button and shows a configuration alert in the page.

Never put GitHub tokens, private project identifiers, or service secrets in the host page. Session creation uses:

`POST {api-base}/api/v1/projects/{project-id}/embed-sessions` with body `{}`, `credentials: "omit"`, and `Content-Type: application/json`.

The iframe loads `{api-base}/embed/{encodeURIComponent(project-id)}?token=...&embed=1` with `sandbox="allow-scripts allow-forms allow-same-origin"`, `referrerpolicy="no-referrer"`, and `scrolling="no"`. The SDK adds `embed=1` after it checks the session. `embed=1` plus the handshake tells the hosted form to hide its own close button. A 0.1.0 embed without those signals stays in legacy mode.

Theme values are sent in a `theme` message after the form sends `ready`. They are not placed in the embed URL. Plan limits are enforced by the hosted form, not by this package.

Protocol 1 messages are plain objects. Messages with extra keys are rejected. The form sends `ready`, `resize` (`height` integer 1–4096), `close-request`, and `submitted`. The SDK raises the iframe to at least 100px. A `resize` before `ready` waits until the handshake is sent. After `ready`, the SDK sends `handshake` (`embed: true`) and then `theme` (`accent`, `colorScheme`, `labels`). The handshake `protocol` number is the highest version the page speaks. Higher versions are ignored. See [README](README.md) for the JSON shapes. Types and `parseHostMessage` are exported from `@featurefountain/browser/protocol`.

Legacy 0.1.0 messages still work: `featurefountain:ready`, `featurefountain:close`, and `featurefountain:refresh`. They are removed in 0.3.0. The refresh reply is still `{ "type": "featurefountain:session", "token", "expiresAt" }`.

There are no other public attributes, properties, or JavaScript APIs on the element.

## 5. Environment variables (host app)

The widget reads **attributes**, not process env, at runtime. Map env to attributes in your framework's usual way:

| Convention         | Example                                                                               |
| ------------------ | ------------------------------------------------------------------------------------- |
| Vite               | `VITE_FEATUREFOUNTAIN_PROJECT_ID` → `import.meta.env.VITE_FEATUREFOUNTAIN_PROJECT_ID` |
| Next.js (public)   | `NEXT_PUBLIC_FEATUREFOUNTAIN_PROJECT_ID`                                              |
| Create React App   | `REACT_APP_FEATUREFOUNTAIN_PROJECT_ID`                                                |
| Generic Node/build | `FEATUREFOUNTAIN_PROJECT_ID` injected at build time                                   |

Optional override for local service:

- `FEATUREFOUNTAIN_API_BASE` / `NEXT_PUBLIC_FEATUREFOUNTAIN_API_BASE` / `VITE_FEATUREFOUNTAIN_API_BASE` → `api-base` attribute (default `https://featurefountain.ai`).

Read `.env.example` or existing env patterns in the host repo and match those names when possible. Do not commit real UUIDs if the team treats them as sensitive configuration.

## 6. Content-Security-Policy

If the host sends CSP headers, allow at minimum:

| Directive     | CDN script tag                                           | npm bundle                                                               |
| ------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `script-src`  | `https://featurefountain.ai` (and existing host scripts) | Host origin / bundler output (no extra host unless you load the CDN too) |
| `connect-src` | `https://featurefountain.ai`                             | Same as `api-base` origin (production: `https://featurefountain.ai`)     |
| `frame-src`   | `https://featurefountain.ai`                             | Same as `api-base` origin                                                |

`connect-src` must allow `POST` to `/api/v1/projects/{uuid}/embed-sessions`. `frame-src` must allow the embed path on the same origin.

## 7. Human-only setup (FeatureFountain dashboard)

A developer with GitHub access must complete these steps once per app. An agent cannot do them without that human.

1. Sign in with GitHub at [featurefountain.ai](https://featurefountain.ai) using an account that can edit the target GitHub Project.
2. Register the application in FeatureFountain.
3. Add **allowed origins** for every host URL that will embed the widget, including local dev (for example `http://127.0.0.1:3000` and `http://localhost:3000` if both are used). Origins must match exactly; `localhost` and `127.0.0.1` are different origins.
4. Choose the private **GitHub Project** destination for submissions.
5. Enable submissions for the project.
6. Copy the **public project ID** (UUID) from the dashboard into the host app's `project-id` attribute or env mapping.

End users of the host app do not need GitHub accounts.

## 8. Verify the integration

1. Build or serve the host app from an origin listed in FeatureFountain allowed origins.
2. Open the page, click **Request Feature**, and submit a short test request in the dialog.
3. In the connected GitHub Project, confirm a new **draft** item appears.

If the button is disabled with a configuration alert, fix `project-id` and `api-base` first. If the dialog shows a load error with **Try again**, check network access to `api-base` and CSP.

## 9. Troubleshooting

| Symptom                                                  | Likely cause                                          | What to do                                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Configuration alert; button disabled                     | Invalid UUID or malformed `api-base`                  | Use dashboard UUID; set `api-base` to `https://featurefountain.ai` or valid loopback HTTP URL |
| `POST .../embed-sessions` fails (4xx) from browser       | Host origin not in allowed origins                    | Add the exact browser origin (scheme + host + port) in FeatureFountain settings               |
| Session fails; generic load error                        | Submissions disabled, wrong project, or service error | Confirm submissions enabled; retry; check FeatureFountain project status                      |
| Works on `localhost` but not `127.0.0.1` (or vice versa) | Only one origin allowed                               | Add both origins if both are used                                                             |
| Widget missing in SSR HTML                               | Imported on server                                    | Move import to client-only path (`useEffect`, dynamic `ssr: false`, etc.)                     |
| CSP console errors                                       | Missing `script-src`, `connect-src`, or `frame-src`   | Add directives in section 6                                                                   |
| Form times out after ~10s                                | Network block or embed never signals ready            | Check firewall, CSP, and ad blockers; use **Try again**                                       |

Local FeatureFountain service: set `api-base` to the loopback service URL (for example `http://127.0.0.1:3000`) and allow that dev host origin in project settings. See `examples/index.html` in this repository.

## 10. Reference

- Product: [featurefountain.ai](https://featurefountain.ai)
- Docs: [featurefountain.ai/docs](https://featurefountain.ai/docs)
- Support: support@airshiplabs.com
- Package: `@featurefountain/browser` on npm
- CDN: `https://featurefountain.ai/widget/v1.js`

Free during early access.
