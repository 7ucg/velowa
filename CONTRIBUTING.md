# Contributing to velowa

The rules for changing the code, for what goes into git, and for how velowa is built and used. velowa is distributed
through git only; it is not published on npm.
Most of them are checked by tests, so a broken rule fails loudly. There are no CI workflows on GitHub: run the checks yourself.

## Before you commit

```bash
npm run lint     # tsc + eslint over src and tests
npm test         # vitest; the docs and package tests need `npm run build:js` first and skip themselves without it
```

Touched something users see (a method, an option, an event)? Then also update the matching example or README section,
add a line under `## Unreleased` in `CHANGELOG.md`, and run `npm run build:js && npm run check:docs`: that type-checks the
code in the README and in `examples/` against the built package.

## Git rules

### Commits

- One change per commit, subject in the imperative, at most about 70 characters, and the body says *why* when it is not obvious.
  Good: `Group calls: redial the relay when the server moves the call`.
- Tests and docs for a change go in the same commit as the change.
- Do not rewrite history on `main` (no force-push). Tags `vX.Y.Z` are never moved.
- Line endings are LF everywhere (`.gitattributes`); `.wasm`, images and media are binary.

### What is in git and what is not

| In git | Never in git (it is in `.gitignore`) |
| --- | --- |
| `src/`, `tests/`, `rust/`, `docs/`, `examples/`, `proto/` | `dist/`, `src/wasm/`, `src/wasm-voip/`, `target/`: build output |
| `package.json`, `package-lock.json`, `Cargo.lock` | `node_modules/` |
| `tsup.config.ts`, `tsconfig.json`, `eslint.config.js`, `.prettierrc` | `auth/`: **the logged-in account** |
| `.gitattributes`, `CONTRIBUTING.md` | `logs/`: protocol logs contain message content and ids |

- **Secrets and account data never go into git:** not `auth/`, not `logs/`, not a phone number or group id in code or tests.
  The examples read them from environment variables; a test fails if one appears.
- `dist/` (the build, WebAssembly included) is committed on purpose, so `npm install github:7ucg/velowa` works without Rust. Only a release commit changes it: do not commit `dist/` in ordinary changes. A fresh checkout can rebuild it: `npm install && npm run build` (needs Rust 1.94 and wasm-pack). Build the WebAssembly only through `npm run build` (`scripts/build-wasm.mjs`): it replaces your home, cargo and project folders in the `.wasm` with neutral ones, and a test fails if a path of the build machine is left in `dist/`.
- The Rust crates named `wacore-*` are one-time copies of `whatsapp-rust`, owned here. Change them like any other code,
  and note where they differ from upstream in `rust/wacore-voip/VENDORED.md`.
- Run only one process per account while testing: two connections on the same `auth/` fight each other.

## How velowa is used (git only)

Users install straight from the repository (`npm install github:7ucg/velowa#v1.0.0`); the finished build in `dist/` is part of it. So:

| Rule | Why | Enforced by |
| --- | --- | --- |
| `package.json` has `"private": true` and no publish settings | the package cannot be pushed to npm by accident | `tests/package` |
| No `preinstall`, `install`, `postinstall` or `prepare` script | `npm install github:7ucg/velowa` must stay fast and must not need Rust: the committed `dist/` is what gets installed | `tests/package` |
| `dist/` is committed: both bundles, the types, both WebAssembly files and the proto | a git install has nothing else to load | `tests/package` |
| `dist/` imports only declared dependencies; the library needs none of the optional ones | an install of the folder must be enough | `tests/package` |
| ESM and CommonJS both resolve, with types for each | `import` and `require` users | `publint`, `attw` (`npm run check:package`) |
| No source maps, tests, credentials, logs or keys in what `npm pack` would list | they leak paths and secrets | `tests/package` |
| Needs Node 18 or newer | the `engines` field | `package.json` |
| Command line tools: `velowa-pair`, `velowa-logs` | linking an account and looking after logs without writing code | `bin` in `package.json` |

`dist/` is the one build output that is committed: npm installs a git dependency as it is, and the rules above (no install scripts) mean nothing is built on the user's machine.

**Runtime dependencies** are `opusscript`, `protobufjs` and `ws` (`qrcode-terminal` is optional, for the pairing helper).
Adding one changes what every user installs, so it needs a reason in the commit and an entry in
`tests/package/package.test.ts`. Prefer Node's own modules.

**A new file the code reads at run time** (a `.wasm`, a schema) has to be copied next to the bundle:
add it to `scripts/copy-assets.mjs` and to the list in `tests/package/package.test.ts`, and load it relative to the
bundle (see `src/client/proto.ts`).

## Releasing

A release is a git tag; nothing is published anywhere else.

1. Everything merged and green: `npm run lint && npm test && npm run build && npm run check:package && npm run check:docs`.
2. Move the `## Unreleased` entries in `CHANGELOG.md` under a heading for the new version.
3. Commit the fresh build: `git add -A dist && git commit -m "Build for release"` (this is the only kind of commit that touches `dist/`).
4. `npm version <patch|minor|major>` (updates `package.json`, commits, and tags `vX.Y.Z`); `git push --follow-tags`.
5. Check the install from a clean folder: `npm install github:7ucg/velowa#vX.Y.Z` and `node -e "require('velowa')"`.

From 1.0.0 on, breaking changes to the public API need a new major version; every change is in `CHANGELOG.md`.

## Licenses and credit

- velowa is under the **velowa License (MIT with mandatory credit)**, see `LICENSE`: anyone who copies any part of the code,
  however small, must credit velowa. By contributing you agree that your contribution is under the same license.
- **Every file of velowa's own code starts with the one-line credit notice** (below the shebang if there is one). A new
  `.ts`, `.js` or `.rs` file under `src/`, `examples/`, `rust/wasm-bridge/src` or `rust/wasm-voip/src` needs it; a test
  (`tests/package/license.test.ts`) fails without it:

  ```text
  // velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
  ```

- **When you bring in code written by someone else, even a few lines, the same rule applies to us:** keep the author's
  notice with the code, check that its license allows it, and add it to `THIRD_PARTY_NOTICES.md` with the original license
  text. Code with a copyleft license (GPL, AGPL, ...) needs a decision from the maintainer first: see the libsignal section of
  that file.
- The built files carry a banner with the credit notice (`tsup.config.ts`).
- Never point `license-file` in a `Cargo.toml` at `LICENSE`: `wasm-pack` empties that file while building (a test guards it).

## Security

Found a way to read or send as an account you do not own, or to make a bot read files or reach internal addresses?
Do not open a public issue; write to the maintainer privately first.
