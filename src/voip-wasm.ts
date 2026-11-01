import { readFileSync } from 'node:fs'
import { initSync } from './wasm-voip/velowa_wasm_voip.js'

let ready = false

/** Instantiate the call-engine WASM once. Separate from the main module so apps that never call do not load it. */
export function ensureVoipWasm(): void {
	if (ready) return
	initSync({
		module: readFileSync(new URL('./wasm-voip/velowa_wasm_voip_bg.wasm', import.meta.url)),
	})
	ready = true
}

export {
	CallEngine,
	GroupSession,
	buildGroupEncRekey,
	buildGroupOffer,
	parseGroupEncRekey,
	RelayChannel,
	deriveCallParticipantSsrc,
	parseRelayFromNode,
} from './wasm-voip/velowa_wasm_voip.js'
