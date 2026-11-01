# Benchmarks

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
