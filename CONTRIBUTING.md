# Contributing

Thanks for helping improve `white-label-view`.

## Setup

Use the supported Node/npm versions from `package.json`, then run:

```sh
npm ci --ignore-scripts
npm run build
npm run lint
npm run typecheck
npm test
npm run coverage
npm run audit
npm pack --dry-run
```

## Development rules

- Read `AGENTS.md`, the relevant source, tests, and README sections before changing behavior.
- Edit TypeScript in `src/`; regenerate tracked `dist/` with the existing build rather than hand-editing compiled output.
- Keep changes focused and reuse existing lifecycle/event patterns before adding new abstractions.
- Preserve the package's framework-independent scope. Do not add React, Preact, a CSS framework, state library, or sanitizer as a runtime dependency without an explicit architectural decision.
- Treat HTML-string templates and `raw()` as trusted-input boundaries; ordinary JSX expressions should remain escaped by default.

## Pull requests

A pull request should explain the problem, the intended behavior, and verification performed. Add or update tests for behavior changes and preserve 100% per-file coverage. Review the complete diff for generated drift, temporary files, credentials, private data, and unrelated formatting changes.

For browser-facing behavior, consider keyboard/focus preservation, cleanup, multi-document behavior, reduced motion, and consumer accessibility responsibilities where relevant.

## Security

Do not publish exploit details or secrets in a public issue. Follow `SECURITY.md` for vulnerability reporting.
