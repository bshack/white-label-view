# Security policy

## Supported versions

Security fixes are applied to the current supported release line and default branch unless release notes state otherwise.

## Reporting a vulnerability

Do not open a public issue containing exploit instructions, credentials, private data, or details that would make an unresolved vulnerability easier to abuse.

Use GitHub private vulnerability reporting when available. Otherwise contact the repository owner privately through an established GitHub contact channel.

Include the affected version or commit, impact, prerequisites, minimal reproduction steps, and any suggested mitigation. Do not access data that is not yours, degrade services, or test systems without authorization.

## Package-specific boundaries

`white-label-view` escapes ordinary JSX child text and attribute values, but caller-supplied HTML strings and `raw()` are trusted-input boundaries. Consumers remain responsible for sanitizing or otherwise establishing trust before passing untrusted markup through those paths.
