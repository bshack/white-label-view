# Security policy

Security fixes are applied to the current default branch unless a release line is explicitly documented as supported.

Please do not open a public issue containing exploit instructions, credentials, private data, or details that would make an unresolved vulnerability easier to abuse. Use GitHub private vulnerability reporting when available; otherwise contact the repository owner privately through an established GitHub channel.

Include the affected version or commit, impact, prerequisites, and minimal safe reproduction steps. Do not access data that is not yours, degrade services, or test systems without authorization.

For `white-label-view`, direct HTML-string rendering and `unsafeHTML()` are explicit trust boundaries. The first-party `html` tag escapes text and quoted-attribute interpolations and rejects unsupported value types. It models the browser's HTML tokenizer to decide where each interpolation lands and rejects interpolation in tag names, attribute names, unquoted attribute values, comments, declarations such as DOCTYPE, the content of `<script>`, `<style>`, `<xmp>`, `<iframe>`, `<noembed>`, `<noframes>`, `<noscript>`, and `<plaintext>`, and quoted `on*` event-handler and `srcdoc` values. `<textarea>` and `<title>` accept escaped text only. Nested markup must end in ordinary text. `attributes()` validates names, rejects inline `on*` handlers and `srcdoc`, quotes values, and handles recognized boolean attributes by presence. The full table is in [`README.md`](README.md#where-interpolation-is-allowed).

Tagged markup and attribute objects are trusted only when created by the same installed runtime instance. Runtime-owned identity must not be replaced with global symbols, public marker properties, or duck typing. Mutable manually supplied template-string arrays are revalidated when their literals change so a cached context plan cannot be reused against different markup.

Context tracking is intentionally conservative. Raw-text content ends only at the matching end tag followed by whitespace, `/`, or `>`. When the tag cannot determine how a browser will tokenize the rest of a template, for example `<script>` or `<style>` inside SVG/MathML, raw-text elements after an SVG/MathML integration point or breakout tag, `<noscript>` content that parses differently with scripting disabled, or double-escaped script content, it rejects every later interpolation rather than guessing.

HTML escaping is not a URL, JavaScript, CSS, or application-policy sanitizer. Callers must still validate URL-bearing attributes, style values, and other context-sensitive data. Never pass uncontrolled user content through `unsafeHTML()` or a direct trusted HTML-string template without appropriate contextual escaping or sanitization.

Third-party template engines remain responsible for their own escaping behavior. Compatibility testing means their synchronous output satisfies View's runtime contract; it does not mean White Label audits or guarantees any renderer's security model. Follow the selected renderer's own escaping and trusted-markup guidance.
