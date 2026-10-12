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

## Links

- [featurefountain.ai](https://featurefountain.ai)
- [Documentation](https://featurefountain.ai/docs)

Free during early access.

## Widget configuration

| Name         | Kind                  | Required | Description                                                                                                                                                                               |
| ------------ | --------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project-id` | attribute             | Yes      | Public FeatureFountain project UUID.                                                                                                                                                      |
| `api-base`   | attribute             | No       | FeatureFountain service origin. Default: `https://featurefountain.ai`.                                                                                                                    |
| `metadata`   | attribute or property | No       | Optional flat JSON of app context (version, plan, user id). Shown to reporters and sent with the request; never include secrets. Up to 20 keys, 4 KB total. Property overrides attribute. |

Example: `metadata='{"version":"2.4.1","plan":"pro"}'` or `element.metadata = { version: "2.4.1" }`.

## What the widget sends

The widget does not read host page contents, cookies, or storage. When the hosted form opens, it may receive a `featurefountain:context` message with:

- **Page URL** — `origin` + `pathname` only (query string and hash are stripped before send).
- **Viewport** — host window size (for example `1440x900`).
- **Metadata** — only what your app sets on `<feature-fountain>`.

Reporters see these values in the form and can turn them off before submit. See [INSTALL.md](INSTALL.md) for limits and framework examples.

## Contact

support@airshiplabs.com

## Development

This repository ships `@featurefountain/browser`. Use Node 24 and pnpm 11.24.0.

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

The build outputs `dist/index.js`, `dist/index.d.ts`, and `dist/widget.js`. For a local host page, see `examples/index.html`.

## License

MIT
