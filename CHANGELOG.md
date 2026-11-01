# Changelog

## Unreleased
- Phase 0: TypeScript scaffold, vendored `wacore-{derive,binary,libsignal,noise,appstate}` building for native and wasm32, own `waproto`, CI skeleton.
- Phase 1: WABinary binding (`encodeNode`/`decodeNode`) and TS codec.
- Phase 2: Noise XX handshake, transport cipher and frame codec.
- Phase 3: Signal sessions and sender keys over TS-owned storage; key generation.
- Phase 4: app-state `AppStateCollection` (LTHash, MAC validation, mutation decryption, outgoing `buildPatch`).
- Phase 5: `Client` (QR pairing verified live, login, auto-reconnect), protocol logger, receiver (pre-keys, acks, receipts, 1:1/group decryption, retries, Meta AI `msmsg`), sender (1:1, groups, channels; send verified live to own number).
- Phase 6: media, replies/mentions/reactions/edit/delete, polls, groups, communities, newsletters, contacts/privacy, app-state sync and chat actions, history sync, calls (events + reject).
- Pairing-code linking, status posting, interactive messages, business profile/catalog, usernames, forwarding, retry resends, poll votes, `client.mex()`.
