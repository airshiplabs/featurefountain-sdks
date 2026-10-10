# FeatureFountain

Put a feature-request button on your site; submissions land in your GitHub Project (Projects v2) as draft items.

<!-- PLACEHOLDER: Add a screenshot or GIF here when a repo asset exists. -->

## Install

### Script tag

```html
<script src="https://featurefountain.ai/widget/v1.js" defer></script>
<feature-fountain
  project-id="REPLACE_WITH_PUBLIC_PROJECT_UUID"
  api-base="https://featurefountain.ai"
></feature-fountain>
```

Use the public project ID from the FeatureFountain dashboard. Allow your site's exact origin in project settings.

### npm

```sh
npm install @featurefountain/browser
```

```js
import "@featurefountain/browser";
```

The import registers `<feature-fountain>`. Set attributes before attaching the element to the page. Load the module only in the browser (it uses `HTMLElement` and `customElements`).

| Attribute    | Value                                                                                                                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `project-id` | Required public project UUID.                                                                                                                                                                                   |
| `api-base`   | Service origin. Defaults to `https://featurefountain.ai`. HTTPS is required, except HTTP loopback hosts for local development. Credentials, path prefixes, queries, fragments, and wildcard hosts are rejected. |

Do not put GitHub tokens, private project identifiers, or service secrets in the page.

## Requirement

You need a GitHub Project you can edit. Your users do not need GitHub accounts.

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

The build outputs `dist/index.js`, `dist/index.d.ts`, and `dist/widget.js`. For a local host page, see `examples/index.html` and serve the repo with a static HTTP server on `127.0.0.1`.

## License

MIT
