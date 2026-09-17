# Package manager support

`white-label-view` supports npm, Yarn, and pnpm consumers.

## Install

```sh
npm install white-label-view
yarn add white-label-view
pnpm add white-label-view
```

CI packs the real distributable artifact and installs that same artifact with all three package managers before exercising the browser, server, and tagged-HTML entrypoints.

## Repository development

The committed `package-lock.json` remains the repository's canonical dependency lockfile and npm remains the maintenance/audit path used by the primary CI job. Yarn and pnpm compatibility does not require committing `yarn.lock` or `pnpm-lock.yaml`.

Nested project scripts use Node's `--run` support so `npm test`, `yarn test`, and `pnpm test` do not depend on another package manager to invoke child scripts.
