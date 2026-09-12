# Security policy

Security fixes are applied to the current default branch unless a release line is explicitly documented as supported.

Please do not open a public issue containing exploit instructions, credentials, private data, or details that would make an unresolved vulnerability easier to abuse. Use GitHub private vulnerability reporting when available; otherwise contact the repository owner privately through an established GitHub channel.

Include the affected version or commit, impact, prerequisites, and minimal safe reproduction steps. Do not access data that is not yours, degrade services, or test systems without authorization.

For `white-label-view`, treat trusted HTML string rendering and the JSX `raw()` helper as explicit trust boundaries. Ordinary JSX expressions escape strings; callers remain responsible for sanitizing any content intentionally passed through a trusted-markup path.