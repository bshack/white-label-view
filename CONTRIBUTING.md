# Contributing

Thanks for improving `white-label-view`.

## Setup

Use the Node and npm versions documented in `README.md` and `package.json`.

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

## Pull requests

Keep changes focused and preserve View's documented responsibilities: DOM lifecycle, model-driven rendering, delegated events, batching, child ownership, cleanup, and the optional first-party JSX runtime. Do not introduce a framework dependency or a second lifecycle model without an explicit architectural decision.

Add or update tests when behavior changes. Do not weaken coverage, lint, type, or security checks to make a change pass. Review the complete diff for generated-file drift, credentials, private data, debugging code, and unrelated formatting changes.

Breaking public API changes require a SemVer major release rather than compatibility shims.

## Accessibility and security

View manages lifecycle, not application markup quality. UI changes should preserve keyboard and focus behavior where applicable. Never pass untrusted content to the JSX `raw()` escape hatch. Follow `SECURITY.md` for suspected vulnerabilities.