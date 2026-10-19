# Contributing

Thanks for improving `white-label-view`.

## Setup

Use the Node and npm versions documented in `README.md` and `package.json`.

```sh
npm ci --ignore-scripts
npm run lint && npm run coverage && npm run audit
```

`npm run coverage` builds and typechecks the source, runs the consumer type checks and every Node test, and enforces 100% coverage per implementation file. While iterating, `npm run build && node --test test/<file>.test.js` runs one test file. `npm pack --dry-run --ignore-scripts` previews the published files.

The build rewrites the tracked `dist/` directory. Edit `src/*.ts` only, and leave regenerated `dist/` out of a pull request unless the change is a release.

## Pull requests

Keep changes focused and preserve View's documented responsibilities: DOM lifecycle, model-driven rendering, delegated events, batching, child ownership, cleanup, adopted-DOM updates, and first-party tagged HTML templates. Do not introduce a framework dependency, bundled third-party renderer, template adapter layer, compiler-specific runtime contract, or second lifecycle model without an explicit architectural decision.

Add or update tests when behavior changes. Template changes should cover escaping, trusted-markup boundaries, browser/server parity, and invalid output where applicable; changes to interpolation-context tracking belong in `test/html-tokenizer.test.js` or `test/html.test.js`. Do not weaken coverage, lint, type, or security checks to make a change pass. Review the complete diff for generated-file drift, credentials, private data, debugging code, and unrelated formatting changes.

Breaking public API changes require a SemVer major release rather than compatibility shims.

## Accessibility and security

View manages lifecycle, not application markup quality. UI changes should preserve keyboard and focus behavior where applicable. Never pass uncontrolled content to `unsafeHTML()`. Keep interpolation-context checks and `attributes()` validation strict rather than accepting ambiguous markup. Follow `SECURITY.md` for suspected vulnerabilities.
