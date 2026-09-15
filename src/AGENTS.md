# white-label-view source instructions

These instructions are more specific than the repository-root agent guide for files under `src/`.

## View 6 public contract

- Observable models bind through the standards-based `addEventListener()` / `removeEventListener()` contract.
- Keep browser and server rendering entry points distinct. The server entry point must remain DOM-free.
- JSX is optional and must remain framework-independent; do not add React, Preact, or a third-party template-engine dependency to the package.
- Ordinary JSX child text and ordinary attribute values are HTML-escaped. Invalid intrinsic tag/attribute names and intrinsic `on*` event-handler attributes are rejected.
- Trusted JSX/raw output must be recognized through runtime-owned identity. Do not replace this with forgeable marker-property checks.
- `raw()` and direct trusted HTML strings are explicit trust boundaries. Never describe HTML escaping as a URL, CSS, or general sanitization policy; callers still validate context-sensitive values.
- Preserve delegated browser-event ownership, model subscription cleanup, child ownership, batching, and lifecycle teardown.
- Browser templates still resolve to one root element. Server templates still resolve to a trusted string or White Label JSX output.

## Verification

Run the full lint, type, runtime, 100% per-file coverage, audit, packed-package, npm/Yarn/pnpm, minimum-Node, and template-engine compatibility checks before treating a source change as release-ready.
