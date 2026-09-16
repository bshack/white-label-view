# white-label-view source instructions

These instructions are more specific than the repository-root agent guide for files under `src/`.

## View 6 public contract

- Observable models bind through the standards-based `addEventListener()` / `removeEventListener()` contract.
- Treat incremental adoption of existing server-rendered DOM as a first-class browser use case. A View may adopt an attached `element`, bind lifecycle/model behavior to it, and use `update(element, data)` without requiring a client template when in-place updates fully handle rendering.
- Keep ownership narrow in embedded/server-rendered applications. A View owns its root and lifecycle, not unrelated host-rendered siblings or page chrome. `destroy()` removes the owned root; do not invent hidden hydration or host-DOM retention semantics.
- Run an attached root's `update()` hook before requiring a template. If `update()` returns `false`, normal template rendering remains the fallback when a template exists.
- Keep browser and server rendering entry points distinct. The server entry point must remain DOM-free.
- JSX is optional and must remain framework-independent; do not add React, Preact, or a third-party template-engine dependency to the package.
- Ordinary JSX child text and ordinary attribute values are HTML-escaped. Invalid intrinsic tag/attribute names and intrinsic `on*` event-handler attributes are rejected.
- Trusted JSX/raw output must be recognized through runtime-owned identity. Do not replace this with forgeable marker-property checks.
- `raw()` and direct trusted HTML strings are explicit trust boundaries. Never describe HTML escaping as a URL, CSS, or general sanitization policy; callers still validate context-sensitive values.
- Preserve delegated browser-event ownership, model subscription cleanup, child ownership, batching, and lifecycle teardown.
- Browser template output still resolves to one root element. Server template output still resolves to a trusted string or White Label JSX output.
- Do not add framework-, CMS-, commerce-, or backend-specific adapters when the existing DOM/template/lifecycle contracts are sufficient. Integration belongs at the application boundary.

## Verification

Run the full lint, type, runtime, 100% per-file coverage, audit, packed-package, npm/Yarn/pnpm, minimum-Node, and template-engine compatibility checks before treating a source change as release-ready. Keep adopted-markup/update-only regression coverage strict.
