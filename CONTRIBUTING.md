# Contributing to velowa

The rules for changing the code, for what goes into git, and for what `npm install velowa` puts on a user's machine.
Most of them are checked by tests or by CI, so a broken rule fails loudly.

## Before you commit

```bash
npm run lint     # tsc + eslint over src and tests
npm test         # vitest; the docs and package tests need `npm run build:js` first and skip themselves without it
```

Touched something users see (a method, an option, an event)? Then also update the matching example or README section,
add a line under `## Unreleased` in `CHANGELOG.md`, and run `npm run build:js && npm run check:docs`: that type-checks the
code in the README and in `examples/` against the built package.

## Git rules

**Commits**

- One change per commit, subject in the imperative, at most about 70 characters, and the body says *why* when it is not obvious.
  Good: `Group calls: redial the relay when the server moves the call`.
- Tests and docs for a change go in the same commit as the change.
- Do not rewrite history on `main` (no force-push). Tags `vX.Y.Z` are never moved.
- Line endings are LF everywhere (`.gitattributes`); `.wasm`, images and media are binary.

**What is in git and what is not**

| In git | Never in git (it is in `.gitignore`) |
| --- | --- |
| `src/`, `tests/`, `rust/`, `docs/`, `examples/`, `proto/` | `dist/`, `src/wasm/`, `src/wasm-voip/`, `target/`: build output |
| `package.json`, `package-lock.json`, `Cargo.lock` | `node_modules/` |
| `tsup.config.ts`, `tsconfig.json`, `eslint.config.js`, `.prettierrc` | `auth/`: **the logged-in account** |
| `.github/workflows/`, `.gitattributes`, `CONTRIBUTING.md` | `logs/`: protocol logs contain message content and ids |

- **Secrets and account data never go into git:** not `auth/`, not `logs/`, not a phone number or group id in code or tests.
  The examples read them from environment variables; a test fails if one appears.
- Build output is not committed. A fresh checkout builds it: `npm install && npm run build` (needs Rust 1.94 and wasm-pack).
- The Rust crates named `wacore-*` are one-time copies of `whatsapp-rust`, owned here. Change them like any other code,
  and note where they differ from upstream in `rust/wacore-voip/VENDORED.md`.
- Run only one process per account while testing: two connections on the same `auth/` fight each other.

## What `npm install velowa` does

A user installs **a finished build**, never the repository.

| Rule | Why | Enforced by |
| --- | --- | --- |
| The package contains only `dist/`, `LICENSE`, `README.md` and `package.json` (about 1.5 MB, 14 files) | nothing a user does not need, and nothing private | `files` in `package.json`, `tests/package` |
| No `preinstall`, `install`, `postinstall` or `prepare` script | installing must not run code on the user's machine, and must not need Rust or a compiler | `tests/package` |
| No source maps, tests, credentials, logs or keys inside | they leak paths and secrets and add size | `tests/package` |
| `dist/` imports only declared dependencies; the library needs none of the optional ones | `npm install` must be enough | `tests/package` |
| ESM and CommonJS both resolve, with types for each | `import` and `require` users | `publint`, `attw` (`npm run check:package`) |
| Needs Node 18 or newer | the `engines` field | `package.json` |
| Command line tools: `velowa-pair`, `velowa-logs` | linking an account and looking after logs without writing code | `bin` in `package.json` |

Installing straight from git (`npm install github:7ucg/velowa`) is **not supported**: `dist/` and the WebAssembly are
build outputs that git does not hold. Use the registry, or clone and build.

**Runtime dependencies** are `opusscript`, `protobufjs` and `ws` (`qrcode-terminal` is optional, for the pairing helper).
Adding one changes what every user installs, so it needs a reason in the commit and an entry in
`tests/package/package.test.ts`. Prefer Node's own modules.

**A new file the code reads at run time** (a `.wasm`, a schema) has to be copied next to the bundle:
add it to `scripts/copy-assets.mjs` and to the list in `tests/package/package.test.ts`, and load it relative to the
bundle (see `src/client/proto.ts`).

## Releasing

1. Everything merged and green: `npm run lint && npm test && npm run build && npm run check:package && npm run check:docs`.
2. Move the `## Unreleased` entries in `CHANGELOG.md` under a heading for the new version.
3. `npm version <patch|minor|major>` (updates `package.json`, commits, and tags `vX.Y.Z`); `git push --follow-tags`.
4. Create a GitHub release for the tag. The **release workflow** (`.github/workflows/release.yml`) builds from scratch,
   runs the whole gate, checks that the tag equals the version in `package.json`, and publishes with provenance. It needs the
   repository secret `NPM_TOKEN` (an npm automation token).
5. Publishing by hand also works: `npm publish` first runs the same gate (`prepublishOnly`) and refuses to publish if it fails.

While the version is `0.x` the API can still change between releases; every change is in `CHANGELOG.md`.

## Security

Found a way to read or send as an account you do not own, or to make a bot read files or reach internal addresses?
Do not open a public issue; write to the maintainer privately first.
