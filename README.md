# velowa

A WhatsApp Web multi-device client library, written fresh in TypeScript. Its crypto- and
binary-parsing-heavy subsystems — libsignal, WABinary encode/decode, the Noise handshake, app-state
crypto — are ported once from [`whatsapp-rust`](https://github.com/jlucaso1/whatsapp-rust)'s `wacore`
crates and compiled to WebAssembly; everything else is new, properly-typed TypeScript, designed for
this project rather than ported from anywhere.

For the full brief — what's decided, what's intentionally left to your
judgment, the reasoning behind both — read [`prompt.md`](./prompt.md). For the phased task breakdown,
read [`TODO.md`](./TODO.md).

## Layout

```text
rust/
  wacore-binary/      Phase 0: copied once from whatsapp-rust's wacore/binary
  wacore-derive/       Phase 0: copied once from whatsapp-rust's wacore/derive
  wacore-libsignal/    Phase 0: copied once from whatsapp-rust's wacore/libsignal
  wacore-noise/        Phase 0: copied once from whatsapp-rust's wacore/noise
  wacore-appstate/     Phase 0: copied once from whatsapp-rust's wacore/appstate
  wasm-bridge/         New code: well-designed wasm-bindgen crate over the five above
src/                  New code: fresh TypeScript, structure TBD in Phase 0 (not a port of
                       baron-baileys-v2's src/ — see prompt.md)
```

Everything copied from `whatsapp-rust`/`wacore` is a **one-time copy, not a live dependency** — once
it's in this repo, it's owned and maintained here. See `prompt.md` for why, and for why `src/` is a
fresh design rather than a port of `baron-baileys-v2`.

## Status

Working and verified against a real account (see `npm run example`): Noise handshake, QR pairing, login/re-login, pre-key
upload, receiving and decrypting 1:1/group/channel messages and Meta AI replies, sending text, replies, reactions, edit,
delete, polls, location, contacts, buttons, images and documents to the own chat, contacts/privacy/groups queries, app-state
sync (328 changes) and app-state writes (pin/archive), encrypted media download, live protocol logging.

Implemented and covered by unit/loopback tests only (not yet exercised against the live server): sending to other
contacts and groups, media upload/download, reactions/edit/delete, polls, group management, communities, newsletters,
app-state sync and chat actions, history sync, privacy/contacts. Also built: pairing-code linking, status posting, interactive (button/list) messages, business profile/catalog, usernames, forwarding, a generic `client.mex()`. Not implemented: registration, interop, managed accounts, typed mex wrappers beyond the above, link previews/thumbnails, antiban, WAM telemetry, VoIP. See `TODO.md` for the exact status of each item.

## Quick start

```bash
npm install
npm run build        # wasm-pack build + tsc (needs Rust 1.94 and wasm-pack)
npm test
```

```ts
import { encodeNode, decodeNode, createSignalCipher, MemorySignalStorage, newIdentityKeyPair } from 'velowa'

const bytes = encodeNode({ tag: 'iq', attrs: { id: '1', type: 'get' } })
const node = decodeNode(bytes)
```

```ts
import { Client } from 'velowa'

const client = new Client({ authDir: 'auth' })
client.on('qr', ({ qr }) => console.log('scan:', qr))
client.on('message', (m) => console.log(m.from, m.message))
await client.connect()
await client.ready()
await client.sendText('4915...@s.whatsapp.net', 'hi')
await client.groups.fetchAll()
```

A scripted end-to-end check against your own account, no CLI involved (`npm run example`, source in `examples/example.js`): sends text, replies, reactions, edit/delete, poll, location, contact, buttons, image and document to your own chat, reads contacts/privacy/groups, syncs app state and toggles pin/archive on your own chat and reverts it. Last live result: 31 of 31 steps. `examples/example-others.js` does the same against a second account, a group and a channel (26 of 27 live; the one miss was a 404 for a missing profile picture, now returned as `undefined`).

`examples/example-manage.js` exercises group management and status posting on a test group and reverts every change (live: 16 of 16).

A dev console that exercises everything (`help` lists the commands) and logs every frame, stanza and HTTP call:
`npm run pair` (logs go to `logs/`, credentials to `auth/`; both are git-ignored and contain account secrets).

Logs are kept as `logs/<day>/<time>-<label>/` (one folder per run, with a `session.json` that says when it ran and
how big each file got); `logs/latest` and `logs/latest-<label>` point at the newest run. Big files continue in
`name.0001.ext`, runs older than a day are gzipped, and runs older than 30 days (or beyond 1 GB in total) are
deleted when the next logger starts. Change it with `new ProtocolLogger({ rotateMB, retention, compressAfterHours,
keep })`, or look after it by hand: `npm run logs -- list | migrate | compress | prune --dry | keep <run>`.

Design departures from Baileys and the reasoning behind each binding are in
[`docs/design-decisions.md`](docs/design-decisions.md).
