import { readFileSync } from 'node:fs'
import { initSync } from './wasm/velowa_wasm_bridge.js'

let ready = false

/** Synchronously instantiate the WASM module once (Node; browsers use the generated async init). */
export function ensureWasm(): void {
	if (ready) return
	initSync({ module: readFileSync(new URL('./wasm/velowa_wasm_bridge_bg.wasm', import.meta.url)) })
	ready = true
}
