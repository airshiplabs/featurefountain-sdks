# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.2.0] - 2026-10-21

### Added

- SDK-owned dialog shell with one Close button, overlay, Escape, focus trap, and backdrop click. Close works when the iframe never loads.
- Embed protocol 1: `ready`, `handshake`, `theme`, `resize`, `close-request`, and `submitted`, plus optional theme attributes. The wire accepts resize heights from 1 to 4096. The shell clamps the iframe to at least 100px and holds `resize` until the handshake is sent.
- `@featurefountain/browser/protocol` exports the message types and parser.
- 0.2.0 replaces 0.1.0 embeds. There is no compatibility with the old `featurefountain:ready`, `featurefountain:close`, `featurefountain:refresh`, or `featurefountain:session` messages.
- After the handshake, `refresh-request` fetches a new embed session and the SDK replies with `session` (`token` and an ISO 8601 `expiresAt`) to the endpoint origin.

## [0.1.0] - 2026-09-29

### Added

- Initial public release of `@featurefountain/browser` with the
  `<feature-fountain>` element, ESM imports, TypeScript declarations, and a
  standalone browser script.
- Hosted feature-request form, keyboard controls, focus restoration,
  origin-checked messaging, and lifecycle cleanup. GitHub credentials and
  private destinations stay on the service, and the package has no runtime
  dependencies.
