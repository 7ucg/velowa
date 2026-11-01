// Runtime files the bundles read next to themselves: the two WASM modules and the WhatsApp proto schema.
import { cpSync, mkdirSync } from 'node:fs'

const assets = [
	['src/wasm/velowa_wasm_bridge_bg.wasm', 'dist/wasm/velowa_wasm_bridge_bg.wasm'],
	['src/wasm-voip/velowa_wasm_voip_bg.wasm', 'dist/wasm-voip/velowa_wasm_voip_bg.wasm'],
	['proto/WAProto.proto', 'dist/proto/WAProto.proto'],
]
for (const [from, to] of assets) {
	mkdirSync(to.slice(0, to.lastIndexOf('/')), { recursive: true })
	cpSync(from, to)
}
console.log(`copied ${assets.length} assets`)
