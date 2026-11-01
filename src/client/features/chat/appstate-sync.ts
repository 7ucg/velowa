// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import {
	mkdirSync,
	readFileSync,
	readdirSync,
	renameSync,
	writeFileSync,
	existsSync,
} from 'node:fs'
import { join } from 'node:path'
import type { BinaryNode } from '../../../codec/index.js'
import {
	AppStateCollection,
	newAppStateCollection,
	restoreAppStateCollection,
} from '../../../crypto/appstate.js'
import type { AppStateMutation, OutgoingMutation } from '../../../crypto/appstate.js'
import type { ProtocolLogger } from '../../../logging/protocol-logger.js'
import { encodeProto, protoType } from '../../proto.js'
import { downloadMedia } from '../message/media.js'
import type { MediaRef } from '../message/media.js'

export const APP_STATE_COLLECTIONS = [
	'critical_block',
	'critical_unblock_low',
	'regular_high',
	'regular_low',
	'regular',
] as const
export type CollectionName = (typeof APP_STATE_COLLECTIONS)[number]

const MAX_ATTEMPTS = 3
/** Upper bound on request rounds per `sync()` call: a server that keeps saying "more patches" cannot hold us forever. */
const MAX_ROUNDS = 200

const KNOWN: ReadonlySet<string> = new Set(APP_STATE_COLLECTIONS)
/** Collection names come from the network and end up in file names: only the five real ones are allowed. */
function assertKnown(name: string): void {
	if (!KNOWN.has(name)) throw new Error(`unknown app-state collection "${name}"`)
}

/** One decoded app-state change (a chat was muted, a contact renamed, ...). */
export interface AppStateEvent {
	collection: string
	/** Index components, e.g. `['mute', '49151...@s.whatsapp.net']`. */
	index: string[]
	/** `mute`, `pin_v1`, `archive`, `contact`, `setting_pushName`, ... (the first index component). */
	action: string
	operation: 'set' | 'remove'
	/** The decoded SyncActionValue as JSON (undefined for removals). */
	value?: Record<string, unknown>
	timestamp?: number
}

export interface SyncDeps {
	dir: string
	request(node: BinaryNode): Promise<BinaryNode>
	logger: ProtocolLogger
	onEvent(e: AppStateEvent): void
	/** Keys the patches need but we do not have: ask the phone for them (it answers with an `appStateSyncKeyShare`). */
	onMissingKeys?(keyIds: Uint8Array[]): void
	/** Download hook (injectable for tests). */
	download?: typeof downloadMedia
}

const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64')

/**
 * App-state (syncd) orchestration. The sync keys are shared by the primary phone as
 * `appStateSyncKeyShare`; collections are fetched as snapshots/patches, verified and decrypted
 * by `AppStateCollection`, and every change is surfaced as an `AppStateEvent`.
 */
export class AppStateSync {
	readonly #keys = new Map<string, Uint8Array>()
	readonly #collections = new Map<string, AppStateCollection>()
	readonly #macs = new Map<string, Map<string, string>>()
	#latestKeyId: string | undefined
	#running: Promise<void> = Promise.resolve()

	constructor(private readonly d: SyncDeps) {
		mkdirSync(join(d.dir, 'keys'), { recursive: true, mode: 0o700 })
		for (const f of readdirSync(join(d.dir, 'keys'))) {
			if (f === '.latest') continue
			this.#keys.set(decodeURIComponent(f), new Uint8Array(readFileSync(join(d.dir, 'keys', f))))
		}
		const latest = join(d.dir, 'keys', '.latest')
		if (existsSync(latest)) this.#latestKeyId = readFileSync(latest, 'utf8')
	}

	get keyCount(): number {
		return this.#keys.size
	}

	/** Store keys received from the phone (`appStateSyncKeyShare.keys`). */
	addKeys(keys: { keyId: Uint8Array; keyData: Uint8Array }[]): void {
		for (const k of keys) {
			const id = b64(k.keyId)
			this.#keys.set(id, k.keyData)
			this.#write(join(this.d.dir, 'keys', encodeURIComponent(id)), k.keyData)
			this.#latestKeyId = id
		}
		if (this.#latestKeyId) this.#write(join(this.d.dir, 'keys', '.latest'), this.#latestKeyId)
		this.d.logger.event('appstate.keys-added', { count: keys.length })
	}

	/**
	 * Send changes to the other devices: bring the collection up to date, build + sign the patch,
	 * push it and only then adopt the new state (a rejected patch leaves everything untouched).
	 */
	async push(collection: string, mutations: OutgoingMutation[]): Promise<void> {
		const run = async () => {
			const keyId = this.#latestKeyId
			const keyData = keyId ? this.#keys.get(keyId) : undefined
			if (!keyId || !keyData)
				throw new Error('no app-state sync key yet: the phone shares it after linking')
			await this.#sync([collection])
			const c = this.#collection(collection)
			const macs = this.#macsOf(collection)
			const built = c.buildPatch(
				new Uint8Array(Buffer.from(keyId, 'base64')),
				keyData,
				mutations,
				(indexMac) => {
					const v = macs.get(b64(indexMac))
					return v ? new Uint8Array(Buffer.from(v, 'base64')) : undefined
				},
			)
			try {
				await this.d.request({
					tag: 'iq',
					attrs: { to: 's.whatsapp.net', type: 'set', xmlns: 'w:sync:app:state' },
					content: [
						{
							tag: 'sync',
							attrs: {},
							content: [
								{
									tag: 'collection',
									attrs: {
										name: collection,
										version: String(built.version - 1),
										return_snapshot: 'false',
									},
									content: [{ tag: 'patch', attrs: {}, content: built.patch }],
								},
							],
						},
					],
				})
			} catch (error) {
				c.discardPending()
				throw error
			}
			c.commitPending()
			for (const m of built.addedMacs) macs.set(b64(m.indexMac), b64(m.valueMac))
			for (const r of built.removedIndexMacs) macs.delete(b64(r))
			this.#persist(collection)
			for (const m of mutations) {
				this.d.onEvent(
					toEvent(collection, {
						index: JSON.parse(m.index) as string[],
						operation: m.operation,
						value: m.value,
					}),
				)
			}
			this.d.logger.event('appstate.pushed', {
				collection,
				version: built.version,
				mutations: mutations.length,
			})
		}
		const result = this.#running.then(run)
		this.#running = result.catch(() => undefined)
		return result
	}

	/** Sync the given collections (serialised: concurrent calls queue up). */
	sync(names: readonly string[] = APP_STATE_COLLECTIONS): Promise<void> {
		this.#running = this.#running
			.then(() => this.#sync(names))
			.catch((e) => this.d.logger.event('appstate.sync-error', e))
		return this.#running
	}

	#collection(name: string): AppStateCollection {
		assertKnown(name)
		let c = this.#collections.get(name)
		if (!c) {
			const p = join(this.d.dir, `${name}.state`)
			c = existsSync(p)
				? restoreAppStateCollection(name, new Uint8Array(readFileSync(p)))
				: newAppStateCollection(name)
			this.#collections.set(name, c)
		}
		return c
	}

	#macsOf(name: string): Map<string, string> {
		assertKnown(name)
		let m = this.#macs.get(name)
		if (!m) {
			const p = join(this.d.dir, `${name}.macs.json`)
			m = new Map(
				existsSync(p)
					? (Object.entries(JSON.parse(readFileSync(p, 'utf8'))) as [string, string][])
					: [],
			)
			this.#macs.set(name, m)
		}
		return m
	}

	#persist(name: string): void {
		assertKnown(name)
		this.#write(join(this.d.dir, `${name}.state`), this.#collection(name).serializeState())
		this.#write(
			join(this.d.dir, `${name}.macs.json`),
			JSON.stringify(Object.fromEntries(this.#macsOf(name))),
		)
	}

	#write(path: string, data: Uint8Array | string): void {
		writeFileSync(`${path}.tmp`, data, { mode: 0o600 })
		renameSync(`${path}.tmp`, path)
	}

	readonly #missing = new Map<string, Uint8Array>()
	readonly #requestedAt = new Map<string, number>()

	#lookupKey = (id: Uint8Array): Uint8Array | undefined => {
		const k = this.#keys.get(b64(id))
		if (!k) this.#missing.set(b64(id), new Uint8Array(id))
		return k
	}

	/** Ask for missing keys, at most once a minute per key. */
	#requestMissing(): void {
		const now = Date.now()
		const ids = [...this.#missing.entries()].filter(
			([k]) => now - (this.#requestedAt.get(k) ?? 0) > 60_000,
		)
		this.#missing.clear()
		if (!ids.length || !this.d.onMissingKeys) return
		for (const [k] of ids) this.#requestedAt.set(k, now)
		this.d.logger.event('appstate.keys-requested', { count: ids.length })
		this.d.onMissingKeys(ids.map(([, v]) => v))
	}

	async #sync(names: readonly string[]): Promise<void> {
		try {
			await this.#syncInner(names)
		} finally {
			this.#requestMissing()
		}
	}

	async #syncInner(names: readonly string[]): Promise<void> {
		const todo = new Set(names)
		const attempts = new Map<string, number>()
		const forceSnapshot = new Set<string>()
		let rounds = 0
		while (todo.size) {
			if (++rounds > MAX_ROUNDS) {
				this.d.logger.event('appstate.sync-aborted', {
					reason: 'too many rounds',
					pending: [...todo],
				})
				return
			}
			const nodes: BinaryNode[] = []
			for (const name of todo) {
				const version = this.#collection(name).version
				this.d.logger.event('appstate.sync', {
					name,
					version,
					snapshot: forceSnapshot.has(name) || !version,
				})
				nodes.push({
					tag: 'collection',
					attrs: {
						name,
						version: String(version),
						return_snapshot: String(forceSnapshot.delete(name) || !version),
					},
				})
			}
			const res = await this.d.request({
				tag: 'iq',
				attrs: { to: 's.whatsapp.net', xmlns: 'w:sync:app:state', type: 'set' },
				content: [{ tag: 'sync', attrs: {}, content: nodes }],
			})
			const syncNode = Array.isArray(res.content)
				? res.content.find((c) => c.tag === 'sync')
				: undefined
			const answered = new Set<string>()
			for (const node of Array.isArray(syncNode?.content) ? syncNode.content : []) {
				if (node.tag !== 'collection') continue
				const name = node.attrs['name'] ?? ''
				// Only collections we asked for: the name is later used in file names.
				if (!todo.has(name)) {
					this.d.logger.event('appstate.unrequested-collection', { name: name.slice(0, 64) })
					continue
				}
				answered.add(name)
				try {
					const before = this.#collection(name).version
					const more = await this.#applyCollection(name, node)
					// "More patches" without any progress would loop forever.
					const progressed = this.#collection(name).version > before
					if (!more || !progressed) todo.delete(name)
				} catch (error) {
					const n = (attempts.get(name) ?? 0) + 1
					attempts.set(name, n)
					this.d.logger.event('appstate.collection-error', { name, attempt: n, error })
					const missingKey = String((error as Error).message).includes('key')
					if (n >= MAX_ATTEMPTS) todo.delete(name)
					else forceSnapshot.add(name)
					if (missingKey && n >= 1 && this.#keys.size === 0) todo.delete(name) // nothing to retry with yet
				}
			}
			for (const name of todo) if (!answered.has(name)) todo.delete(name)
		}
	}

	/** Apply one `<collection>` answer. Returns true when the server has more patches for it. */
	async #applyCollection(name: string, node: BinaryNode): Promise<boolean> {
		const c = this.#collection(name)
		const macs = this.#macsOf(name)
		const kids = (n: BinaryNode, tag: string) =>
			Array.isArray(n.content) ? n.content.filter((x) => x.tag === tag) : []
		const events: AppStateMutation[] = []
		const download = this.d.download ?? downloadMedia

		const snapshotNode = kids(node, 'snapshot')[0]
		if (snapshotNode?.content instanceof Uint8Array) {
			const ref = protoType('ExternalBlobReference').toObject(
				protoType('ExternalBlobReference').decode(snapshotNode.content),
				{ bytes: Uint8Array },
			) as {
				mediaKey: Uint8Array
				directPath: string
				fileSha256?: Uint8Array
				fileEncSha256?: Uint8Array
			}
			const data = await download(ref as MediaRef, 'md-app-state')
			const res = c.applySnapshot(new Uint8Array(data), this.#lookupKey)
			macs.clear()
			for (const m of res.addedMacs) macs.set(b64(m.indexMac), b64(m.valueMac))
			events.push(...res.mutations)
			this.d.logger.event('appstate.snapshot-applied', {
				name,
				version: c.version,
				mutations: res.mutations.length,
			})
		}

		const patchesNode = kids(node, 'patches')[0] ?? node
		for (const p of kids(patchesNode, 'patch')) {
			if (!(p.content instanceof Uint8Array)) continue
			const bytes = this.#withVersion(
				await this.#withExternalMutations(p.content, download),
				c.version + 1,
			)
			const res = c.applyPatch(bytes, this.#lookupKey, (indexMac) => {
				const v = macs.get(b64(indexMac))
				return v ? new Uint8Array(Buffer.from(v, 'base64')) : undefined
			})
			for (const m of res.addedMacs) macs.set(b64(m.indexMac), b64(m.valueMac))
			for (const r of res.removedIndexMacs) macs.delete(b64(r))
			events.push(...res.mutations)
			this.d.logger.event('appstate.patch-applied', {
				name,
				version: c.version,
				mutations: res.mutations.length,
			})
		}
		this.#persist(name)
		for (const m of events) this.d.onEvent(toEvent(name, m))
		return node.attrs['has_more_patches'] === 'true'
	}

	/**
	 * Patches the server relays may carry no `version`; it is then the next one after ours (the patches of a
	 * collection are consecutive). Same rule as the reference implementation.
	 */
	#withVersion(patch: Uint8Array, next: number): Uint8Array {
		const T = protoType('SyncdPatch')
		const obj = T.toObject(T.decode(patch), { bytes: Uint8Array, longs: Number }) as {
			version?: { version?: number }
		}
		if (obj.version?.version) return patch
		return encodeProto('SyncdPatch', { ...obj, version: { version: next } })
	}

	/** A patch can reference its mutations as an external blob; inline them before verification. */
	async #withExternalMutations(
		patch: Uint8Array,
		download: typeof downloadMedia,
	): Promise<Uint8Array> {
		const T = protoType('SyncdPatch')
		const decoded = T.decode(patch)
		const obj = T.toObject(decoded, { bytes: Uint8Array }) as {
			externalMutations?: MediaRef
			version?: unknown
		}
		if (!obj.externalMutations) return patch
		const blob = await download(obj.externalMutations, 'md-app-state')
		const muts = protoType('SyncdMutations').toObject(protoType('SyncdMutations').decode(blob), {
			bytes: Uint8Array,
		}) as {
			mutations?: unknown[]
		}
		const full = { ...obj, mutations: muts.mutations ?? [] } as Record<string, unknown>
		delete full['externalMutations']
		return encodeProto('SyncdPatch', full)
	}
}

/** Map a decoded mutation onto the public event shape. */
export function toEvent(collection: string, m: AppStateMutation): AppStateEvent {
	let value: Record<string, unknown> | undefined
	let timestamp: number | undefined
	if (m.value) {
		const T = protoType('SyncActionValue')
		value = T.toObject(T.decode(m.value), {
			longs: String,
			bytes: String,
			enums: String,
		}) as Record<string, unknown>
		const t = Number(value['timestamp'])
		if (t) timestamp = t
	}
	return {
		collection,
		index: m.index,
		action: m.index[0] ?? '',
		operation: m.operation,
		...(value && { value }),
		...(timestamp !== undefined && { timestamp }),
	}
}

export interface ChatUpdate {
	id: string
	muteEndTimestamp?: number | null
	archived?: boolean
	pinned?: boolean
	unread?: boolean
	deleted?: boolean
	cleared?: boolean
}
export interface ContactUpdate {
	id: string
	fullName?: string
	firstName?: string
	lid?: string
}

const asNumber = (v: unknown): number | undefined =>
	v === undefined || v === null || v === '' ? undefined : Number(v)

/** Higher-level view of an app-state change, if it is one of the common chat/contact actions. */
export function interpret(e: AppStateEvent): {
	chat?: ChatUpdate
	contact?: ContactUpdate
	pushName?: string
} {
	const id = e.index[1] ?? ''
	const v = (e.value ?? {}) as Record<string, Record<string, unknown> | undefined>
	if (e.operation === 'remove') {
		if (e.action === 'deleteChat') return { chat: { id, deleted: true } }
		if (e.action === 'clearChat') return { chat: { id, cleared: true } }
		return {}
	}
	switch (e.action) {
		case 'mute': {
			const m = v['muteAction']
			const end = asNumber(m?.['muteEndTimestamp'])
			return { chat: { id, muteEndTimestamp: m?.['muted'] ? (end ?? -1) : null } }
		}
		case 'archive':
			return { chat: { id, archived: Boolean(v['archiveChatAction']?.['archived']) } }
		case 'pin_v1':
			return { chat: { id, pinned: Boolean(v['pinAction']?.['pinned']) } }
		case 'markChatAsRead':
			return { chat: { id, unread: !v['markChatAsReadAction']?.['read'] } }
		case 'deleteChat':
			return { chat: { id, deleted: true } }
		case 'clearChat':
			return { chat: { id, cleared: true } }
		case 'contact': {
			const c = v['contactAction']
			return {
				contact: {
					id,
					...(c?.['fullName'] ? { fullName: String(c['fullName']) } : {}),
					...(c?.['firstName'] ? { firstName: String(c['firstName']) } : {}),
					...(c?.['lidJid'] ? { lid: String(c['lidJid']) } : {}),
				},
			}
		}
		case 'setting_pushName': {
			const name = v['pushNameSetting']?.['name']
			return name ? { pushName: String(name) } : {}
		}
		default:
			return {}
	}
}
