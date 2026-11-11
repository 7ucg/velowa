# Benchmarks

## WABinary codec: velowa vs baron-baileys-v2 (2026-11-11, re-run)

`node --expose-gc scripts/bench-codec.mjs path/to/baron-baileys-v2` - same setup as the 2026-11-01 run below, 3 runs
averaged. The codec itself (`rust/wacore-binary`, both wasm bindings) hasn't changed since; numbers match within
noise, re-run here to confirm nothing regressed after this session's protocol work (channel status, keepalive,
handshake timeout, stream-error handling).

| payload | operation | velowa | baileys |
| --- | --- | --- | --- |
| message, 12 devices (~3 KB) | encode | 16.4k ops/s (61 us) | 38.1k ops/s (26 us) |
| message, 12 devices (~3 KB) | decode | 13.5k ops/s (74 us) | 1.0k ops/s (1014 us) |
| iq ping (19 B) | encode | 319k ops/s | 512k ops/s |
| iq ping (19 B) | decode | 262k ops/s | 65k ops/s |

Same conclusions as before hold unchanged: decode ~1.9x-13.5x faster in velowa, with baileys' heap still growing
~205 MB over 20k large decodes against a flat velowa heap; encode still 0.4x-0.65x of baileys' throughput, the
known `encodeNode` optimisation target (see below). Still not measured: idle RAM, RAM under message load, handshake
latency and end-to-end messages/second against a real account.

## WABinary codec: velowa vs baron-baileys-v2 (2026-11-01)

`node --expose-gc scripts/bench-codec.mjs` - Node 24.19, Linux x86_64, 20,000 iterations after warm-up, every call awaited
(Baileys' codec functions are async, velowa's are sync). Both sides run the rust `wacore-binary` code, through
different bindings: velowa's own wasm-bindgen crate (`rust/wasm-bridge`) and the `whatsapp-rust-bridge-baron` package.

| payload | operation | velowa | baileys |
| --- | --- | --- | --- |
| message, 12 devices (~3 KB) | encode | 16.9k ops/s (59 us) | 39.4k ops/s (25 us) |
| message, 12 devices (~3 KB) | decode | 13.8k ops/s (72 us) | 1.0k ops/s (995 us) |
| iq ping (19 B) | encode | 334k ops/s | 502k ops/s |
| iq ping (19 B) | decode | 182k ops/s | 97k ops/s |

Both encoders produce identical bytes (2970 B / 19 B).

Reading it honestly:

- **Decode** (the hot receive path) is 1.9x to 13.8x faster in velowa. Baileys additionally grew the heap by
  ~205 MB over the 20k large decodes (8 MB for the small one); velowa's heap stayed flat.
- **Encode** is slower in velowa (0.4x to 0.67x): its binding walks a plain JS object and copies attribute strings
  across the wasm boundary, while the Baileys bridge takes a more direct path. A cheaper `encodeNode` is a known
  optimisation target (batching string crossings, or a typed builder).
- This is the codec only. **Not measured yet**: idle RAM, RAM under message load, handshake latency and end-to-end
  messages/second against a real account; those need a long-running comparison of both clients on the same
  account and are the open part of the Phase 7 benchmark item.
