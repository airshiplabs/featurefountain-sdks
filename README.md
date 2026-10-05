# FeatureFountain SDKs

SDKs for embedding FeatureFountain in host applications. This repository currently contains the `@featurefountain/browser` browser package; SDKs for other platforms will live here as they are added.

The browser custom element opens FeatureFountain's hosted feature request form. Configure a public project ID and service origin. The widget contains no GitHub credentials or private destination details.

## Build from source

Use Node 24 and pnpm 11.24.0. From this repository:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

The build produces `dist/index.js` and `dist/index.d.ts` for module imports, plus the standalone browser script `dist/widget.js`. It needs no environment file, service credentials, or application repository.

GitHub Actions runs typecheck, lint, format check, build, package tests, browser tests, and packing on pull requests and pushes to `main`. The workflow uses Node 24, pnpm 11.24.0, and a frozen lockfile. Its browser fixtures need no database or provider secrets. Failed runs retain browser traces for seven days.

## Add the button

Copy `dist/widget.js` to your site's public files, then add:

```html
<script src="/vendor/featurefountain/widget.js" defer></script>
<feature-fountain
  project-id="REPLACE_WITH_PUBLIC_PROJECT_UUID"
  api-base="https://featurefountain.ai"
></feature-fountain>
```

Replace the project ID with the ID from your FeatureFountain dashboard. Configure a private destination, allow your site's exact origin, and enable submissions there.

For an application that imports JavaScript modules, install the package:

```sh
npm install @featurefountain/browser
```

Then import it in your browser entry point:

```js
import "@featurefountain/browser";
```

Importing the module registers `<feature-fountain>`. Repeated script or module loads preserve the existing registration. Set attributes before attaching the element to the page.

Import the module only in a browser: it requires `HTMLElement` and `customElements`. In a server-rendered application, load it after client mount or through a component with server rendering disabled.

| Attribute    | Value                                                                                                                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project-id` | Required public project UUID.                                                                                                                                                                                   |
| `api-base`   | Service origin. Defaults to `https://featurefountain.ai`. HTTPS is required, except HTTP loopback hosts for local development. Credentials, path prefixes, queries, fragments, and wildcard hosts are rejected. |

Never put GitHub tokens, private Project identifiers, or service secrets in the page.

## Local example

Build the widget, then replace the project UUID in `examples/index.html`. That example uses `http://127.0.0.1:3000` for the local FeatureFountain service.

Serve this repository with a static HTTP server:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/examples/`. Allow `http://127.0.0.1:8000` in the project's settings. Use the same hostname consistently: `localhost` and `127.0.0.1` are different origins.

## Form behavior

The button opens a labeled native dialog. Close or Escape dismisses it and restores focus to the button. Closing and reopening preserves the current form while the element remains on the page.

Session and frame loading each stop after ten seconds and show a retry action. Session requests omit credentials. Expired sessions refresh through messages without reloading the form. Messages require the configured service origin, the current iframe window, and the documented message shape.

The hosted form owns submission results. A successful result means the service confirmed delivery. An uncertain result permits a status check with the original request key and token. Keep that form open to retain its text and recovery information. Reloading the host page or removing the element loses its in-memory state.

## Package contents

`pnpm pack` rebuilds the package and includes only the compiled `dist` files, this README, the MIT license, and package metadata. Tests check a fresh checkout and inspect its archive for private configuration. The package is published publicly to npm under the `@featurefountain` scope.

## Release

Airship Labs maintains `@featurefountain/browser`. Publish from a reviewed commit with a new, unused version in `package.json`, using an npm account with permission to publish in the `@featurefountain` scope. Install dependencies first, then run:

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm test:e2e
npm pack --dry-run
npm publish --access public
```

Packing and publishing rebuild the distribution through `prepack`. Inspect the archive contents before publishing; it should contain only the six public files described above. Never include service environment files or credentials.
