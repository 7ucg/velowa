# Changelog

## Unreleased
- Phase 0: TypeScript scaffold, vendored `wacore-{derive,binary,libsignal,noise,appstate}` building for native and wasm32, own `waproto`, CI skeleton.
- Phase 1: WABinary binding (`encodeNode`/`decodeNode`) and TS codec.
- Phase 2: Noise XX handshake, transport cipher and frame codec.
- Phase 3: Signal sessions and sender keys over TS-owned storage; key generation.
- Phase 4: app-state `AppStateCollection` (LTHash, MAC validation, mutation decryption).
