// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { decodeNode as wasmDecode, encodeNode as wasmEncode } from '../wasm/velowa_wasm_bridge.js'
import { ensureWasm } from '../wasm-init.js'
import type { BinaryNode } from '../wasm/velowa_wasm_bridge.js'

export type { BinaryNode }

// Why the wasm-bindgen types are exposed as-is: the generated `BinaryNode`
// interface is exactly the shape we want consumers to see, so a hand-written
// mirror would only be a second copy to keep in sync. The wrapper exists for
// the one thing the generated glue does not do for Node: synchronous loading
// from disk (no fetch of a file URL, no bundler).
/** Encode a node into a frame payload (plain format byte + node bytes). */
export function encodeNode(node: BinaryNode): Uint8Array {
	ensureWasm()
	return wasmEncode(node)
}

/** Decode a frame payload (format byte + node bytes; zlib-compressed payloads are inflated). */
export function decodeNode(payload: Uint8Array): BinaryNode {
	ensureWasm()
	return wasmDecode(payload)
}
