// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { jidDecode } from '../jid.js'

/**
 * Phone number <-> LID mapping. WhatsApp is moving accounts to LIDs: an account's devices keep their Signal
 * sessions under the LID address, so a message for a phone-number JID must be encrypted for (and decrypted
 * from) the LID address once that mapping is known. The stanza keeps the JID the server gave us; only the
 * Signal address changes (`resolve`).
 */
export class LidMap {
	readonly #pnToLid = new Map<string, string>()
	readonly #lidToPn = new Map<string, string>()

	constructor(private readonly path?: string) {
		if (path && existsSync(path)) {
			for (const [pn, lid] of Object.entries(
				JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>,
			)) {
				this.#pnToLid.set(pn, lid)
				this.#lidToPn.set(lid, pn)
			}
		}
	}

	/** Remember that these two JIDs (any device) are the same account. Returns true when it was new. */
	set(a: string, b: string): boolean {
		let pn: string
		let lid: string
		try {
			const da = jidDecode(a)
			const db = jidDecode(b)
			if (da.server === 'lid' && db.server === 's.whatsapp.net') [lid, pn] = [da.user, db.user]
			else if (db.server === 'lid' && da.server === 's.whatsapp.net') [lid, pn] = [db.user, da.user]
			else return false
		} catch {
			return false
		}
		if (!pn || !lid || this.#pnToLid.get(pn) === lid) return false
		this.#pnToLid.set(pn, lid)
		this.#lidToPn.set(lid, pn)
		this.#save()
		return true
	}

	lidUser(pnUser: string): string | undefined {
		return this.#pnToLid.get(pnUser)
	}

	pnUser(lidUser: string): string | undefined {
		return this.#lidToPn.get(lidUser)
	}

	/** The JID whose Signal address to use: the LID form for a phone-number JID with a known mapping, else the input. */
	resolve(jid: string): string {
		let d
		try {
			d = jidDecode(jid)
		} catch {
			return jid
		}
		if (d.server !== 's.whatsapp.net') return jid
		const lid = this.#pnToLid.get(d.user)
		if (!lid) return jid
		return d.device ? `${lid}:${d.device}@lid` : `${lid}@lid`
	}

	#save(): void {
		if (!this.path) return
		mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 })
		writeFileSync(`${this.path}.tmp`, JSON.stringify(Object.fromEntries(this.#pnToLid)), {
			mode: 0o600,
		})
		renameSync(`${this.path}.tmp`, this.path)
	}
}
