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

Rust bindings for all four subsystems exist and are tested offline (WABinary, Noise XX + framing,
Signal sessions/sender keys, app-state). The client spine (connect, pair, reconnect, send/receive)
and feature breadth are **not written yet**, and nothing has been verified against a live WhatsApp
server. See `TODO.md` for exactly what is and is not proven.

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

Design departures from Baileys and the reasoning behind each binding are in
[`docs/design-decisions.md`](docs/design-decisions.md).
