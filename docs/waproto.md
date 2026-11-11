# waproto decision: Option A (own crate, generated from baron-baileys-v2's proto)

**Decision (2026-10-31):** `rust/waproto` is our own crate. Its schema comes from
`baron-baileys-v2/WAProto/WAProto.proto` via `scripts/proto-sync.py`; no upstream `waproto` is vendored.

## What the sync script does and why

1. **Trim.** Keeps only top-level types reachable from `ROOTS` (35 of 412): what
   libsignal/noise/appstate reference. Smaller codegen, smaller wasm, no schema surface we don't use.
2. **proto3 -> proto2.** Baileys' file is proto3 but relies on protobufjs leniency (enums whose first
   value is not 0), which `protoc` rejects in proto3. Upstream's schema is proto2, so we convert:
   bare singular fields get `optional` (same presence semantics as upstream), `oneof` members stay bare.
   Consequence: repeated scalars are unpacked (proto2 default), as upstream. Decoders accept both.
3. **Package -> `whatsapp`**, so the vendored crates' `waproto::whatsapp::*` imports work unchanged.
4. Compiles `whatsapp.desc` + `.sha256` (committed; `build.rs` verifies them, consumers need no protoc).

`build.rs` and the pinned `codec` wrappers are adapted from upstream waproto (MIT) and now owned here;
the codec module is cut to the 15 functions the three crates call. Add a root to `ROOTS` and a wrapper
to `codec` when a new type is needed.

## Known differences vs upstream's schema (verify when a test disagrees)

- Baileys' proto drops `[default = ...]` annotations; upstream keeps some (e.g. `ADVEncryptionType`).
- Field sets differ by WhatsApp Web version (Baileys 2.3000.1052536159 vs upstream 2.3000.1045368834).

## Evidence

Native + wasm32 `cargo check` clean; `cargo test` on waproto, libsignal, noise, appstate all pass.
