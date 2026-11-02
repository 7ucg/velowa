// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
// Decision (Phase 2): the generated wasm-bindgen classes (NoiseXxHandshake, NoiseTransport,
// FrameDecoder) are exposed as-is. Their `.d.ts` already reads like the intended TS API and the
// counters/single-use invariants live in Rust, so a wrapper would add nothing but a second surface.
// Loading is shared with the codec (see ./wasm.ts).
import { ensureWasm } from '../wasm-init.js'
import {
	FrameDecoder,
	NoiseTransport,
	NoiseXxHandshake,
	encodeFrame,
	waConnHeader,
} from '../wasm/velowa_wasm_bridge.js'

export { FrameDecoder, NoiseTransport, NoiseXxHandshake, encodeFrame }

/** Start a Noise XX handshake with the device's static key pair and encoded ClientPayload. */
export function startXxHandshake(
	staticPrivate: Uint8Array,
	staticPublic: Uint8Array,
	clientPayload: Uint8Array,
): NoiseXxHandshake {
	ensureWasm()
	return new NoiseXxHandshake(staticPrivate, staticPublic, clientPayload)
}

/** The 4-byte connection header, sent once in front of the first frame. */
export function connHeader(): Uint8Array {
	ensureWasm()
	return waConnHeader()
}
