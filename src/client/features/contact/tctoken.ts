// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { BinaryNode } from '../../../codec/index.js'
import type { RequestFn } from '../group/groups.js'

// Trusted-contact tokens ("tctoken"). When two people have chatted, each hands the other a token that says "you
// know me". A 1:1 message carries the recipient's token; the server uses it to decide whether the sender is a
// stranger. Tokens are valid for a rolling window of about 28 days, in 7 day buckets.

const BUCKET = 604_800
const BUCKETS = 4

export interface TcEntry {
	/** Base64 of the token we got from the contact (empty when only our own issue time is kept). */
	token: string
	/** When the contact issued it (unix seconds). */
	t?: number
	/** When we last issued ours to them (unix seconds). */
	senderTs?: number
}

export const isTcTokenExpired = (t: number | undefined, now = Date.now() / 1000): boolean => {
	if (!t || Number.isNaN(t)) return true
	const cutoff = (Math.floor(now / BUCKET) - (BUCKETS - 1)) * BUCKET
	return t < cutoff
}

/** True when we have not issued our token in the current 7 day bucket. */
export const shouldIssueTcToken = (
	senderTs: number | undefined,
	now = Date.now() / 1000,
): boolean => senderTs === undefined || Math.floor(now / BUCKET) > Math.floor(senderTs / BUCKET)

/** Regular people only: not the PSA account, bots or groups. */
export const isRegularUser = (jid: string): boolean => {
	const [user = '', server = ''] = jid.split('@')
	if (user === '0' || /^1313555\d{4}$|^131655500\d{2}$/.test(user)) return false
	return server === 's.whatsapp.net' || server === 'lid' || server === 'c.us'
}

const bare = (jid: string): string => jid.replace(/:\d+@/, '@')

export class TcTokens {
	readonly #data = new Map<string, TcEntry>()
	readonly #issuing = new Set<string>()

	constructor(private readonly path?: string) {
		if (path && existsSync(path)) {
			try {
				for (const [k, v] of Object.entries(
					JSON.parse(readFileSync(path, 'utf8')) as Record<string, TcEntry>,
				))
					this.#data.set(k, v)
			} catch {
				/* a damaged file only costs the tokens */
			}
		}
	}

	#save(): void {
		if (!this.path) return
		mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 })
		const tmp = `${this.path}.tmp`
		writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.#data)), { mode: 0o600 })
		renameSync(tmp, this.path)
	}

	/** The token to attach to a message for `jid`, if we hold a fresh one. */
	tokenFor(jid: string): Uint8Array | undefined {
		const e = this.#data.get(bare(jid))
		if (!e?.token) return undefined
		if (isTcTokenExpired(e.t)) {
			this.#data.set(bare(jid), {
				token: '',
				...(e.senderTs !== undefined && { senderTs: e.senderTs }),
			})
			this.#save()
			return undefined
		}
		return new Uint8Array(Buffer.from(e.token, 'base64'))
	}

	/** Keep the tokens of a `<tokens>` node (an iq answer or a `privacy_token` notification). */
	storeFrom(node: BinaryNode, fallbackJid?: string): number {
		const tokens = Array.isArray(node.content)
			? node.content.find((c) => c.tag === 'tokens')
			: undefined
		let stored = 0
		for (const n of Array.isArray(tokens?.content) ? tokens.content : []) {
			if (n.tag !== 'token' || n.attrs['type'] !== 'trusted_contact') continue
			if (!(n.content instanceof Uint8Array)) continue
			const jid = bare(fallbackJid || n.attrs['jid'] || '')
			const t = Number(n.attrs['t'] ?? 0)
			if (!jid || !isRegularUser(jid) || !t) continue
			const old = this.#data.get(jid)
			if (old?.t && old.t > t) continue
			this.#data.set(jid, { ...old, token: Buffer.from(n.content).toString('base64'), t })
			stored++
		}
		if (stored) this.#save()
		return stored
	}

	/**
	 * After a 1:1 message: give the contact our token (once per 7 days). Fire and forget; never throws.
	 * `request` is the iq channel; `storageJid` is the contact's address.
	 */
	issueTo(jid: string, request: RequestFn, now = Date.now() / 1000): void {
		const key = bare(jid)
		if (!isRegularUser(key) || this.#issuing.has(key)) return
		if (!shouldIssueTcToken(this.#data.get(key)?.senderTs, now)) return
		this.#issuing.add(key)
		const t = Math.floor(now)
		void request({
			tag: 'iq',
			attrs: { to: 's.whatsapp.net', type: 'set', xmlns: 'privacy' },
			content: [
				{
					tag: 'tokens',
					attrs: {},
					content: [{ tag: 'token', attrs: { jid: key, t: String(t), type: 'trusted_contact' } }],
				},
			],
		})
			.then((res) => {
				this.storeFrom(res, key)
				const e = this.#data.get(key)
				this.#data.set(key, { token: '', ...e, senderTs: t })
				this.#save()
			})
			.catch(() => undefined)
			.finally(() => this.#issuing.delete(key))
	}
}
