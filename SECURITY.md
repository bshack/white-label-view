# Security policy

Security fixes are applied to the current default branch unless a release line is explicitly documented as supported.

Please do not open a public issue containing exploit instructions, credentials, private data, or details that would make an unresolved vulnerability easier to abuse. Use GitHub private vulnerability reporting when available; otherwise contact the repository owner privately through an established GitHub channel.

Include the affected version or commit, impact, prerequisites, and minimal safe reproduction steps. Do not access data that is not yours, degrade services, or test systems without authorization.

For `white-label-view`, direct HTML-string rendering and `unsafeHTML()` are explicit trust boundaries. The first-party `html`` ` tag escapes normal text and quoted-attribute interpolations, rejects unsupported value types, and rejects interpolation inside tag names, unquoted attributes, comments, `<script>` bodies, and `<style>` bodies. `attributes()` validates names, rejects inline `on*` handlers and `srcdoc`, quotes values, and handles recognized boolean attributes by presence.

Tagged `HTMLMarkup` and `attributes()` values are trusted only when they were created by the active package instance. Runtime-owned identity must remain private and unforgeable; public marker properties, global-symbol brands, duck typing, or implicit trust across duplicate installed copies must not be used as the trust check. Strings crossing package-copy or renderer boundaries are explicit caller-owned trust decisions.

HTML escaping is not a URL, JavaScript, CSS, or application-policy sanitizer. Callers must still validate URL-bearing attributes, style values, and other context-sensitive data. Never pass uncontrolled user content through `unsafeHTML()` or a direct trusted HTML-string template without appropriate contextual escaping or sanitization.

Third-party template engines remain responsible for their own escaping behavior. Compatibility testing means their synchronous output satisfies View's runtime contract; it does not mean White Label audits or guarantees the renderer's security model. In particular, follow KitaJS HTML's own `safe`/escaping guidance when using its JSX runtime.
