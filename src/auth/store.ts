// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
/**
 * Pluggable persistence. The library never decides where state lives; consumers pass an AuthStore.
 * All methods return Promises so durable backends (SQLite, Redis) fit; Signal session writes must be
 * durable before the matching ack is sent.
 */
export interface AuthStore {
	get(group: string, id: string): Promise<Uint8Array | undefined>
	/** Atomic batch: `undefined` value deletes the entry. */
	set(
		entries: ReadonlyArray<{ group: string; id: string; value: Uint8Array | undefined }>,
	): Promise<void>
}

export class MemoryAuthStore implements AuthStore {
	readonly #data = new Map<string, Uint8Array>()

	async get(group: string, id: string): Promise<Uint8Array | undefined> {
		return this.#data.get(`${group}\0${id}`)
	}

	async set(
		entries: ReadonlyArray<{ group: string; id: string; value: Uint8Array | undefined }>,
	): Promise<void> {
		for (const { group, id, value } of entries) {
			const key = `${group}\0${id}`
			if (value === undefined) this.#data.delete(key)
			else this.#data.set(key, value)
		}
	}
}
