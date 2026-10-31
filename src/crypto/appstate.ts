// Decision (Phase 4): `AppStateCollection` and its callback/result types are exposed as generated.
// It is already a stateful object (version/hash getters, transactional apply*), and mutation values
// stay encoded SyncActionValue bytes that TS decodes with the full WAProto schema.
import { ensureWasm } from '../wasm-init.js'
import { AppStateCollection } from '../wasm/velowa_wasm_bridge.js'
import type {
	AppStateKeyLookup,
	AppStateMac,
	AppStateMutation,
	AppStateResult,
	PreviousValueMacLookup,
} from '../wasm/velowa_wasm_bridge.js'

export type {
	AppStateKeyLookup,
	AppStateMac,
	AppStateMutation,
	AppStateResult,
	PreviousValueMacLookup,
}
export { AppStateCollection }

/** A never-synced collection (`regular`, `regular_low`, `regular_high`, `critical_block`, `critical_unblock_to_primary`). */
export function newAppStateCollection(name: string): AppStateCollection {
	ensureWasm()
	return new AppStateCollection(name)
}

/** Restore a collection from `AppStateCollection.serializeState()` bytes. */
export function restoreAppStateCollection(name: string, state: Uint8Array): AppStateCollection {
	ensureWasm()
	return AppStateCollection.fromState(name, state)
}
