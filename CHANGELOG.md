# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- SDK-owned dialog shell with one Close button, overlay, Escape, focus trap, and backdrop click. Close works when the iframe never loads.
- Embed protocol 1: `ready`, `handshake`, `theme`, `resize`, `close-request`, and `submitted`, plus optional theme attributes. Resize height is an integer from 100 to 4096.
- `@featurefountain/browser/protocol` exports the message types and parser.
- Legacy `featurefountain:ready`, `featurefountain:close`, and `featurefountain:refresh` messages still work. They are removed in 0.3.0.

## [0.1.0] - 2026-09-29

### Added

- Initial public release of `@featurefountain/browser` with the
  `<feature-fountain>` element, ESM imports, TypeScript declarations, and a
  standalone browser script.
- Hosted feature-request form, keyboard controls, focus restoration,
  origin-checked messaging, and lifecycle cleanup. GitHub credentials and
  private destinations stay on the service, and the package has no runtime
  dependencies.
