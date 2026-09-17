# Security policy

Security fixes are applied to the current default branch unless a release line is explicitly documented as supported.

Please do not open a public issue containing exploit instructions, credentials, private data, or details that would make an unresolved vulnerability easier to abuse. Use GitHub private vulnerability reporting when available; otherwise contact the repository owner privately through an established GitHub channel.

Include the affected version or commit, impact, prerequisites, and minimal safe reproduction steps. Do not access data that is not yours, degrade services, or test systems without authorization.

For `white-label-view`, direct HTML-string rendering and `unsafeHTML()` are explicit trust boundaries. The first-party `html`` ` tag escapes normal text and quoted-attribute interpolations, rejects unsupported value types, and rejects interpolation inside tag names, unquoted attributes, comments, `<script>` bodies, and `<style>` bodies. Dynamic interpolation in quoted `on*` event-handler attributes and `srcdoc` is also rejected. `attributes()` validates names, rejects inline `on*` handlers and `srcdoc`, quotes values, and handles recognized boolean attributes by presence.

Tagged markup and attribute objects are trusted only when created by the same installed runtime instance. Runtime-owned identity must not be replaced with global symbols, public marker properties, or duck typing. Mutable manually supplied template-string arrays are revalidated when their literals change so a cached context plan cannot be reused against different markup.

Raw-text parsing is intentionally conservative. Only an appropriate `</script>` or `</style>` end tag with an HTML end-tag delimiter returns interpolation to ordinary text context. Ambiguous legacy script escaped/double-escaped content remains in script context and therefore rejects interpolation rather than guessing about browser tokenizer state.

HTML escaping is not a URL, JavaScript, CSS, or application-policy sanitizer. Callers must still validate URL-bearing attributes, style values, and other context-sensitive data. Never pass uncontrolled user content through `unsafeHTML()` or a direct trusted HTML-string template without appropriate contextual escaping or sanitization.

Third-party template engines remain responsible for their own escaping behavior. Compatibility testing means their synchronous output satisfies View's runtime contract; it does not mean White Label audits or guarantees the renderer's security model. In particular, follow KitaJS HTML's own `safe`/escaping guidance when using its JSX runtime.
