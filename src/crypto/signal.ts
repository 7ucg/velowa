// Decision (Phase 3): `SignalCipher` and the `SignalStorage` / bundle types are exposed as generated.
// The class is already the object-shaped API the brief asks for; the only hand-written TS here is
// an in-memory SignalStorage (useful for tests and ephemeral bots) and the loader hookup.
//
// Storage stays in TS: Rust is stateless per call and awaits the consumer's storage, which keeps
// credential persistence pluggable. Reasoning on durability is in rust/wasm-bridge/src/signal.rs.
import { ensureWasm } from '../wasm-init.js'
import {
	SignalCipher,
	generateIdentityKeyPair,
	generatePreKeys,
	generateSignedPreKey,
} from '../wasm/velowa_wasm_bridge.js'
import type {
	DecryptedMessage,
	EncryptedMessage,
	PreKeyBundleInput,
	SignalStorage,
} from '../wasm/velowa_wasm_bridge.js'

export { SignalCipher }
export type { DecryptedMessage, EncryptedMessage, PreKeyBundleInput, SignalStorage }

export interface IdentityKeys {
	publicKey: Uint8Array
	privateKey: Uint8Array
}

export interface GeneratedSignedPreKey {
	id: number
	record: Uint8Array
	publicKey: Uint8Array
	signature: Uint8Array
}

export interface GeneratedPreKey {
	id: number
	record: Uint8Array
	publicKey: Uint8Array
}

export function newIdentityKeyPair(): IdentityKeys {
	ensureWasm()
	return generateIdentityKeyPair() as IdentityKeys
}

export function newSignedPreKey(identityPrivate: Uint8Array, id: number): GeneratedSignedPreKey {
	ensureWasm()
	return generateSignedPreKey(identityPrivate, id) as GeneratedSignedPreKey
}

export function newPreKeys(start: number, count: number): GeneratedPreKey[] {
	ensureWasm()
	return generatePreKeys(start, count) as GeneratedPreKey[]
}

export function createSignalCipher(storage: SignalStorage): SignalCipher {
	ensureWasm()
	return new SignalCipher(storage)
}

/** Volatile storage: fine for tests and throwaway sessions, never for a real account. */
export class MemorySignalStorage implements SignalStorage {
	readonly #sessions = new Map<string, Uint8Array>()
	readonly #identities = new Map<string, Uint8Array>()
	readonly #preKeys = new Map<number, Uint8Array>()
	readonly #signedPreKeys = new Map<number, Uint8Array>()
	readonly #senderKeys = new Map<string, Uint8Array>()

	constructor(
		private readonly identity: IdentityKeys,
		private readonly registrationId: number,
	) {}

	getIdentityKeyPair() {
		return Promise.resolve(this.identity)
	}
	getLocalRegistrationId() {
		return Promise.resolve(this.registrationId)
	}
	loadIdentity(name: string, device: number) {
		return Promise.resolve(this.#identities.get(`${name}.${device}`))
	}
	saveIdentity(name: string, device: number, key: Uint8Array) {
		this.#identities.set(`${name}.${device}`, key)
		return Promise.resolve()
	}
	loadSession(name: string, device: number) {
		return Promise.resolve(this.#sessions.get(`${name}.${device}`))
	}
	storeSession(name: string, device: number, record: Uint8Array) {
		this.#sessions.set(`${name}.${device}`, record.slice())
		return Promise.resolve()
	}
	loadPreKey(id: number) {
		return Promise.resolve(this.#preKeys.get(id))
	}
	storePreKey(id: number, record: Uint8Array) {
		this.#preKeys.set(id, record)
		return Promise.resolve()
	}
	removePreKey(id: number) {
		this.#preKeys.delete(id)
		return Promise.resolve()
	}
	loadSignedPreKey(id: number) {
		return Promise.resolve(this.#signedPreKeys.get(id))
	}
	storeSignedPreKey(id: number, record: Uint8Array) {
		this.#signedPreKeys.set(id, record)
		return Promise.resolve()
	}
	loadSenderKey(key: string) {
		return Promise.resolve(this.#senderKeys.get(key))
	}
	storeSenderKey(key: string, record: Uint8Array) {
		this.#senderKeys.set(key, record.slice())
		return Promise.resolve()
	}
}
