# FeatureFountain widget

A browser custom element that opens FeatureFountain's hosted feature request form. Configure a public project ID and service origin. The widget contains no GitHub credentials or private destination details.

## Build from source

Use Node 22.18.0 or a newer Node 22 release, and pnpm 11.24.0. From this repository:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

The build produces `dist/index.js` and `dist/index.d.ts` for module imports, plus the standalone browser script `dist/widget.js`. It needs no environment file, service credentials, or application repository.

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

For an application that imports JavaScript modules, copy and import `dist/index.js` instead. You can also install a built source checkout with `pnpm add /absolute/path/to/featurefountain-widget`, then import the package:

```js
import "@airshiplabs/featurefountain-widget";
```

Importing the module registers `<feature-fountain>`. Repeated script or module loads preserve the existing registration. Set attributes before attaching the element to the page.

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

`pnpm pack` includes only the compiled `dist` files, this README, the MIT license, and package metadata. Tests check a fresh checkout and inspect its archive for private configuration. Registry publication is optional.
