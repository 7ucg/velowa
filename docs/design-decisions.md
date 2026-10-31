# Design decisions

Where velowa departs from `baron-baileys-v2`/Baileys, and why.

## Bindings
| Subsystem | Surface | Why |
| --- | --- | --- |
| WABinary | `encodeNode(node)` / `decodeNode(bytes)` over a plain `BinaryNode` object | A node is a value TS reads constantly; a wasm handle would cost a boundary call per field. The codec has no state, so free functions are the honest shape. Decoded `content` is never a string: the wire format does not distinguish it from bytes. |
| Noise | `NoiseXxHandshake` -> `NoiseTransport`, `FrameDecoder`, `encodeFrame` | Handshake and GCM counters are real state; holding them in Rust means TS cannot desync them. Server cert verification is always strict; the test bypass is not exported. |
| Signal | `SignalCipher` over a consumer-supplied `SignalStorage` | Rust is stateless between calls; storage stays in TS so persistence is pluggable. Every store write is awaited before `encrypt`/`decrypt` resolves, which satisfies the "durable before the wire" rule. Bytes crossing to storage are copied to JS-owned buffers. |
| App-state | `AppStateCollection` (hash state + transactional `applyPatch`/`applySnapshot`) | Only the math lives in Rust; mutation values come back as encoded `SyncActionValue` so TS decodes them with the full WAProto schema. |

## Differences from Baileys
- Real TypeScript with strict types; generated wasm types are exposed directly where they read well.
- Auth storage is an async interface (`AuthStore`, `SignalStorage`), not `{ creds, keys }`.
- Events are a typed bus (`on` returns an unsubscribe; `events()` is an `AsyncIterable`).
- Trust model for identity keys is TOFU with `identityChanged` surfaced to the caller.

## Vendored Rust
Treated as this project's own code. Fix bugs here; periodically diff (do not merge) against
`jlucaso1/whatsapp-rust`. WAProto: `rust/waproto` is generated from the project proto (see
`docs/waproto.md`); update by running `scripts/proto-sync.py`, rebuilding, and re-running all tests.
