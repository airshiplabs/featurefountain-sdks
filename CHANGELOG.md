# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.2.0] - 2026-10-12

### Added

- After the hosted form signals `featurefountain:ready`, the widget sends
  `featurefountain:context` with `pageUrl` (origin and path only), `viewport`
  (host window size), and optional `metadata` from the `<feature-fountain>`
  property or JSON `metadata` attribute. Context is sent again each time the
  dialog reopens with an existing frame.
- `metadata` on `<feature-fountain>` for app context (version, plan, userId, and
  similar). Values are validated in the browser; invalid keys are dropped with a
  console warning that names the key only.

## [0.1.0] - 2026-09-04

### Added

- Initial public release of `@featurefountain/browser` with the `<feature-fountain>`
  element, embed session flow, hosted iframe form, and origin-checked messaging.
