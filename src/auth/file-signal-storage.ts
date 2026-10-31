import {
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
	fsyncSync,
	openSync,
	closeSync,
} from 'node:fs'
import { join } from 'node:path'
import type { IdentityKeys, SignalStorage } from '../crypto/signal.js'

/**
 * Durable SignalStorage on the local file system: one file per record, written to a temp file,
 * fsynced and renamed into place, so a crash leaves either the old or the new record, never half.
 * Every promise resolves only after the data is on disk (the durability rule for session state).
 */
export class FileSignalStorage implements SignalStorage {
	constructor(
		private readonly dir: string,
		private readonly identity: IdentityKeys,
		private readonly registrationId: number,
	) {
		for (const sub of ['sessions', 'identities', 'prekeys', 'signed-prekeys', 'sender-keys'])
			mkdirSync(join(dir, sub), { recursive: true, mode: 0o700 })
	}

	#path(kind: string, id: string): string {
		return join(this.dir, kind, encodeURIComponent(id))
	}

	#read(kind: string, id: string): Uint8Array | undefined {
		try {
			return new Uint8Array(readFileSync(this.#path(kind, id)))
		} catch (e) {
			if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined
			throw e
		}
	}

	#write(kind: string, id: string, data: Uint8Array): void {
		const target = this.#path(kind, id)
		const tmp = `${target}.tmp`
		writeFileSync(tmp, data, { mode: 0o600 })
		const fd = openSync(tmp, 'r')
		try {
			fsyncSync(fd)
		} finally {
			closeSync(fd)
		}
		renameSync(tmp, target)
	}

	getIdentityKeyPair() {
		return Promise.resolve(this.identity)
	}
	getLocalRegistrationId() {
		return Promise.resolve(this.registrationId)
	}
	loadIdentity(name: string, device: number) {
		return Promise.resolve(this.#read('identities', `${name}.${device}`))
	}
	saveIdentity(name: string, device: number, key: Uint8Array) {
		this.#write('identities', `${name}.${device}`, key)
		return Promise.resolve()
	}
	loadSession(name: string, device: number) {
		return Promise.resolve(this.#read('sessions', `${name}.${device}`))
	}
	storeSession(name: string, device: number, record: Uint8Array) {
		this.#write('sessions', `${name}.${device}`, record)
		return Promise.resolve()
	}
	loadPreKey(id: number) {
		return Promise.resolve(this.#read('prekeys', String(id)))
	}
	storePreKey(id: number, record: Uint8Array) {
		this.#write('prekeys', String(id), record)
		return Promise.resolve()
	}
	removePreKey(id: number) {
		rmSync(this.#path('prekeys', String(id)), { force: true })
		return Promise.resolve()
	}
	loadSignedPreKey(id: number) {
		return Promise.resolve(this.#read('signed-prekeys', String(id)))
	}
	storeSignedPreKey(id: number, record: Uint8Array) {
		this.#write('signed-prekeys', String(id), record)
		return Promise.resolve()
	}
	loadSenderKey(key: string) {
		return Promise.resolve(this.#read('sender-keys', key))
	}
	storeSenderKey(key: string, record: Uint8Array) {
		this.#write('sender-keys', key, record)
		return Promise.resolve()
	}
}
