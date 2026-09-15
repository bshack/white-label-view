# Security policy

Security fixes are applied to the current default branch unless a release line is explicitly documented as supported.

Please do not open a public issue containing exploit instructions, credentials, private data, or details that would make an unresolved vulnerability easier to abuse. Use GitHub private vulnerability reporting when available; otherwise contact the repository owner privately through an established GitHub channel.

Include the affected version or commit, impact, prerequisites, and minimal safe reproduction steps. Do not access data that is not yours, degrade services, or test systems without authorization.

For `white-label-view`, trusted HTML-string rendering and the JSX `raw()` helper are explicit trust boundaries. Ordinary JSX child text and ordinary attribute values are HTML-escaped, runtime-produced JSX/raw values are identified by runtime-owned identity, and invalid intrinsic tag/attribute names plus intrinsic `on*` attributes are rejected. HTML escaping is not a URL, CSS, or application-policy sanitizer: callers must still validate URL-bearing attributes, style values, and other context-sensitive data. Never pass untrusted content through `raw()` or a direct trusted HTML-string template without appropriate contextual escaping or sanitization.