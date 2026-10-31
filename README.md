# velowa

A WhatsApp Web multi-device client library, written fresh in TypeScript. Its crypto- and
binary-parsing-heavy subsystems — libsignal, WABinary encode/decode, the Noise handshake, app-state
crypto — are ported once from [`whatsapp-rust`](https://github.com/jlucaso1/whatsapp-rust)'s `wacore`
crates and compiled to WebAssembly; everything else is new, properly-typed TypeScript, designed for
this project rather than ported from anywhere.

**This repo is a skeleton.** For the full brief — what's decided, what's intentionally left to your
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

Pre-Phase-0. Nothing built yet. See `TODO.md`.
