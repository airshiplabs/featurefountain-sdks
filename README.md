# FeatureFountain

Put a feature-request button on your site; submissions land in your GitHub Project (Projects v2) as draft items.

## Install

Paste this into your coding agent:

```text
Install FeatureFountain by following https://github.com/airshiplabs/featurefountain-sdks/blob/main/INSTALL.md
```

<!-- PLACEHOLDER: Add a screenshot or GIF here when a repo asset exists. -->

## Requirement

You need a GitHub Project you can edit. Your users do not need GitHub accounts.

## Theming

Set these optional attributes on `<feature-fountain>`. Defaults match FeatureFountain branding. The widget sends them to the hosted form after the form reports ready. It does not check your plan. The server decides which theme values to apply.

| Attribute      | Default             | What it changes                                     |
| -------------- | ------------------- | --------------------------------------------------- |
| `label`        | `Request Feature`   | Trigger button text                                 |
| `heading`      | `Request a feature` | Dialog title                                        |
| `close-label`  | `Close`             | The dialog's Close button                           |
| `submit-label` | `Submit request`    | Submit button inside the hosted form                |
| `accent`       | `#1c5060`           | Trigger color and form accent. Use a `#rrggbb` hex  |
| `color-scheme` | `light`             | `light` or `dark` for the dialog shell and the form |

```html
<feature-fountain
  project-id="00000000-0000-4000-8000-000000000000"
  api-base="https://featurefountain.ai"
  color-scheme="dark"
  accent="#112233"
  label="Suggest a feature"
></feature-fountain>
```

Theme values are not put in the embed URL.

## Embed protocol

The dialog shell (overlay, the only Close button, Escape, focus trap, and backdrop click) lives in this SDK. Close works even when the iframe never loads. The iframe URL is the session URL plus `embed=1`. The project id in that path is encoded with `encodeURIComponent`.

`api-base` must be HTTPS. HTTP is allowed only on loopback (`localhost`, `127.0.0.1`, or `[::1]`).

Messages use `postMessage` and are accepted only from the iframe window on the `api-base` origin. A sibling frame on that same origin is ignored. Each message is a plain object. Messages with extra keys are rejected. Unknown protocol numbers are ignored. The SDK writes one `console.debug` line the first time it sees a higher version.

The handshake `protocol` number is the highest version the page speaks. The form should answer with that version or lower.

Parent to form, after the form sends `ready`:

```json
{
  "source": "featurefountain",
  "protocol": 1,
  "type": "handshake",
  "embed": true
}
```

```json
{
  "source": "featurefountain",
  "protocol": 1,
  "type": "theme",
  "accent": "#1c5060",
  "colorScheme": "light",
  "labels": {
    "trigger": "Request Feature",
    "title": "Request a feature",
    "close": "Close",
    "submit": "Submit request"
  }
}
```

Form to parent:

```json
{ "source": "featurefountain", "protocol": 1, "type": "ready" }
```

```json
{ "source": "featurefountain", "protocol": 1, "type": "resize", "height": 480 }
```

`height` is an integer from 1 to 4096. The SDK raises the applied iframe height to at least 100px, matching the CSS minimum. A `resize` that arrives before `ready` is held until the handshake has been sent. The iframe does not scroll itself.

```json
{ "source": "featurefountain", "protocol": 1, "type": "close-request" }
```

```json
{ "source": "featurefountain", "protocol": 1, "type": "submitted" }
```

`submitted` leaves the dialog open and sets the status text to "Request submitted."

Import the types and parser from `@featurefountain/browser/protocol` (`protocolVersion`, `minFrameHeight`, `maxFrameHeight`, `labelMax`, `parseHostMessage`). The JSON vectors live in `tests/fixtures/embed-protocol.vectors.json`. CI checks that file against the SHA-256 in `tests/fixtures/embed-protocol.vectors.sha256`.

Legacy 0.1.0 messages still work. The form sends `{ "type": "featurefountain:ready" }`, `{ "type": "featurefountain:close" }`, and `{ "type": "featurefountain:refresh" }`. Those are removed in 0.3.0. A form that does not receive `embed=1` and `handshake` keeps its own close button.

## Links

- [featurefountain.ai](https://featurefountain.ai)
- [Documentation](https://featurefountain.ai/docs)

Free during early access.

## Contact

support@airshiplabs.com

## Development

This repository ships `@featurefountain/browser`. Use Node 24 and pnpm 11.24.0.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

The build outputs `dist/index.js`, `dist/index.d.ts`, and `dist/widget.js`. For a local host page, see `examples/index.html`.

## License

MIT
