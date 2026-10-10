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
