# white-label-view source instructions

These instructions are more specific than the repository-root agent guide for files under `src/`.

## View 7 public contract

- Observable models bind through the standards-based `addEventListener()` / `removeEventListener()` contract.
- Treat incremental adoption of existing server-rendered DOM as a first-class browser use case. A View may adopt an attached `element`, bind lifecycle/model behavior to it, and use `update(element, data)` without requiring a client template when in-place updates fully handle rendering.
- Keep ownership narrow in embedded/server-rendered applications. A View owns its root and lifecycle, not unrelated host-rendered siblings or page chrome. `destroy()` removes the owned root; do not invent hidden hydration or host-DOM retention semantics.
- Run an attached root's `update()` hook before requiring a template. If `update()` returns `false`, normal template rendering remains the fallback when a template exists.
- Keep browser and server rendering entry points distinct. The server entry point must remain DOM-free.
- First-party templates use `white-label-view/html` tagged template literals. Do not reintroduce a first-party JSX runtime, JSX compiler contract, framework dependency, or bundled third-party template engine.
- `html`` ` escapes ordinary text and quoted-attribute interpolations and rejects ambiguous interpolation contexts rather than guessing how to serialize them.
- `attributes()` owns conditional/boolean attribute serialization. Keep attribute-name validation strict, reject inline `on*` handlers and `srcdoc`, and do not silently coerce object/function values.
- `unsafeHTML()` and direct trusted HTML strings are explicit trust boundaries. Never describe HTML escaping as a URL, JavaScript, CSS, or general sanitization policy; callers still validate context-sensitive values.
- `HTMLMarkup` interoperability across duplicate installed copies uses the global symbol registry. The brand is an interoperability marker, not the security boundary; `unsafeHTML()` remains the explicit trust boundary.
- Preserve delegated browser-event ownership, model subscription cleanup, child ownership, batching, and lifecycle teardown.
- Browser template output still resolves to one root element. Server template output still resolves to a trusted string or White Label `HTMLMarkup`.
- Third-party engines, including KitaJS HTML for JSX, remain application-owned integrations tested only against the synchronous View output contract.
- Do not add framework-, CMS-, commerce-, or backend-specific adapters when the existing DOM/template/lifecycle contracts are sufficient. Integration belongs at the application boundary.

## Verification

Run the full lint, type, runtime, 100% per-file coverage, audit, packed-package, npm/Yarn/pnpm, minimum-Node, and template-engine compatibility checks before treating a source change as release-ready. Keep tagged-template security cases and adopted-markup/update-only regression coverage strict.
