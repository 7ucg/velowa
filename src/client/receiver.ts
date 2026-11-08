// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { AuthCreds } from '../auth/creds.js'
import type { BinaryNode } from '../codec/index.js'
import { newPreKeys } from '../crypto/signal.js'
import type { RemovableSignalStorage, SignalCipher } from '../crypto/signal.js'
import { jidDecode, signalAddress, signalAddressString } from '../jid.js'
import type { ProtocolLogger } from '../logging/protocol-logger.js'
import { callAck } from './features/call/call-events.js'
import { decryptAddon } from './features/message/comment.js'
import { decryptEventResponse } from './features/message/event-message.js'
import { decryptPollVote, pollOptionHash } from './features/message/extras.js'
import type { LidMap } from './lid-map.js'
import { MessageSecrets, decryptMsmsg, extractMetaAiText } from './meta-ai.js'
import { protoType } from './proto.js'

const S_WHATSAPP_NET = 's.whatsapp.net'
const MIN_PREKEY_COUNT = 5
const UPLOAD_PREKEY_COUNT = 30
const MAX_RETRIES = 5
const REQUEST_TIMEOUT_MS = 20_000

export interface ReceiverDeps {
	creds: AuthCreds
	saveCreds(): void
	storage: RemovableSignalStorage
	/** Phone-number <-> LID mapping: sessions are keyed by the LID address once it is known. */
	lids: LidMap
	cipher: SignalCipher
	logger: ProtocolLogger
	send(node: BinaryNode): void
	/** Called with every successfully decoded message (plain JSON-able object). */
	onMessage?(m: DecodedMessage): void
	/** Called with every notification (after it was acked). */
	onNotification?(n: BinaryNode): void
	/** Called with every incoming call stanza (after it was acked). */
	onCall?(n: BinaryNode): void
	/** Called with every channel `<status>` stanza (after it was acked). */
	onChannelStatus?(n: BinaryNode): void
	/** Called with every receipt (after it was acked). */
	onReceipt?(n: BinaryNode): void
	/** A message could not be read and the sender's retries ran out: it can be asked for again from the phone. */
	onUndecryptable?(key: {
		remoteJid: string
		id: string
		fromMe: false
		participant?: string
	}): void
	/**
	 * A message arrived with no content for this device: a view-once photo or video (`<unavailable type="view_once"/>`)
	 * is only ever shown on the phone, so there is nothing to decrypt and nothing to ask for again.
	 */
	onUnavailable?(m: {
		id: string
		from: string
		participant?: string
		timestamp?: number
		pushName?: string
		/** The stanza's `<unavailable type>`, e.g. `view_once`. */
		reason: string
		/** The stanza's own `type` (`media`, `text`, ...). */
		kind?: string
	}): void
	/** The phone answered a request for a message we could not read (a "placeholder"): the message, as WebMessageInfo bytes. */
	onResentMessage?(webMessageInfo: Uint8Array): void
	/** The phone announced a history chunk (`historySyncNotification`). */
	onHistory?(n: {
		ref: {
			url?: string
			directPath?: string
			mediaKey: Uint8Array
			fileSha256?: Uint8Array
			fileEncSha256?: Uint8Array
			fileLength?: number
		}
		syncType?: string
		chunkOrder?: number
		progress?: number
		inline?: Uint8Array
	}): void
	/** Sync keys shared by the primary phone (`appStateSyncKeyShare`). */
	onAppStateKeys?(keys: { keyId: Uint8Array; keyData: Uint8Array }[]): void
}

export interface DecodedMessage {
	id: string
	from: string
	participant?: string
	timestamp?: number
	pushName?: string
	/** The server's `reporting_tag` and the sender's token (for reports); present on end-to-end encrypted messages. */
	reporting?: { tag?: Uint8Array; token?: Uint8Array; version?: number }
	message: Record<string, unknown>
}

/** Decoded protobuf JSON of unknown shape (poll votes, secrets, ...). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>

const children = (n: BinaryNode, tag?: string): BinaryNode[] =>
	Array.isArray(n.content) ? n.content.filter((c) => tag === undefined || c.tag === tag) : []

/**
 * Record the phone-number <-> LID pairing a stanza's own attributes name, if any: WhatsApp puts the acting
 * address's other form on most `<message>` / `<notification>` / `<receipt>` stanzas as an attribute - whichever
 * one it is not addressed by. A LID-addressed one (`addressing_mode="lid"`, or `participant`/`from` already end
 * in `@lid`) carries `participant_pn` / `sender_pn` / `peer_recipient_pn`; a legacy PN-addressed one carries
 * `participant_lid` / `sender_lid` / `peer_recipient_lid` instead. Exported standalone so it is testable without
 * a live `Receiver`.
 */
export function noteLidFromAttrs(attrs: Record<string, string>, lids: LidMap): void {
	const acting = attrs['participant'] ?? attrs['from']
	if (!acting) return
	const isLid = attrs['addressing_mode'] === 'lid' || acting.endsWith('@lid')
	const alt = isLid
		? (attrs['participant_pn'] ?? attrs['sender_pn'] ?? attrs['peer_recipient_pn'])
		: (attrs['participant_lid'] ?? attrs['sender_lid'] ?? attrs['peer_recipient_lid'])
	if (alt) lids.set(acting, alt)
}

/**
 * Apply a `lidMigrationMappingSyncMessage`'s payload (`LIDMigrationMappingSyncPayload`): the account's
 * primary pushes these to its own companions as the authoritative phone-number <-> LID pairing, ahead of
 * (and more completely than) anything `noteLidFromAttrs` can pick up from ordinary traffic. The caller
 * must only do this for a message from one of our own devices - a peer could otherwise feed us a forged
 * pairing and misdirect our own sends. Exported standalone so it is testable without a live `Receiver`.
 */
export function applyLidMigrationMapping(encodedPayload: Uint8Array, lids: LidMap): void {
	let mappings: { pn?: string; assignedLid?: string; latestLid?: string }[]
	try {
		const t = protoType('LIDMigrationMappingSyncPayload')
		const decoded = t.toObject(t.decode(encodedPayload), { longs: String, defaults: true }) as {
			pnToLidMappings?: { pn?: string; assignedLid?: string; latestLid?: string }[]
		}
		mappings = decoded.pnToLidMappings ?? []
	} catch {
		return
	}
	for (const m of mappings) {
		const lid = m.latestLid && m.latestLid !== '0' ? m.latestLid : m.assignedLid
		if (!m.pn || m.pn === '0' || !lid || lid === '0') continue
		lids.set(`${lid}@lid`, `${m.pn}@s.whatsapp.net`)
	}
}

const be = (n: number, len: number): Buffer => {
	const b = Buffer.alloc(len)
	b.writeUIntBE(n, 0, len)
	return b
}

/** Remove the random 1-16 byte padding WhatsApp appends to every Signal plaintext. */
export function unpadRandomMax16(data: Uint8Array): Uint8Array {
	if (data.length === 0) throw new Error('unpad given empty bytes')
	const pad = data[data.length - 1]!
	if (pad < 1 || pad > 16 || pad > data.length) throw new Error(`invalid padding length ${pad}`)
	return data.subarray(0, data.length - pad)
}

/** `<ack>` for a received message / receipt / notification (WA Web's sendAck). */
export function buildAck(node: BinaryNode, meId?: string): BinaryNode {
	const attrs: Record<string, string> = {
		id: node.attrs['id'] ?? '',
		to: node.attrs['from'] ?? '',
		class: node.tag,
	}
	if (node.attrs['participant']) attrs['participant'] = node.attrs['participant']
	if (node.attrs['recipient']) attrs['recipient'] = node.attrs['recipient']
	if (node.attrs['type']) attrs['type'] = node.attrs['type']
	if (node.tag === 'message' && meId) attrs['from'] = meId
	return { tag: 'ack', attrs }
}

/**
 * Handles everything the server pushes after login that needs an answer: acks, receipts,
 * pre-key upkeep, and decryption of incoming messages (1:1 and group). Stanzas are processed
 * strictly one after another, because Double-Ratchet state is order dependent.
 */
export class Receiver {
	readonly #pending = new Map<string, { resolve(n: BinaryNode): void; reject(e: Error): void }>()
	readonly #acks = new Map<string, { resolve(n: BinaryNode): void; reject(e: Error): void }>()
	/** Acks of our own `<call>` stanzas (class=call), by stanza id. */
	readonly #callAcks = new Map<string, { resolve(n: BinaryNode): void; reject(e: Error): void }>()
	readonly #retryCounts = new Map<string, number>()
	readonly #secrets = new MessageSecrets()
	/** poll id -> options and who created it (from our own state or the creation message's author). */
	readonly #polls = new Map<string, { options: string[]; creator: string }>()
	/** ids of messages we sent: nothing a peer sends may overwrite their secret or poll data. */
	readonly #ownIds = new Set<string>()
	#queue: Promise<void> = Promise.resolve()
	#idCounter = 0

	constructor(private readonly d: ReceiverDeps) {}

	/** Route an incoming stanza. Returns true when it was handled here. */
	handle(node: BinaryNode): boolean {
		if (node.tag === 'iq' && (node.attrs['type'] === 'result' || node.attrs['type'] === 'error')) {
			const p = this.#pending.get(node.attrs['id'] ?? '')
			if (p) {
				this.#pending.delete(node.attrs['id']!)
				if (node.attrs['type'] === 'error')
					p.reject(new Error(`iq error: ${JSON.stringify(node.content)}`))
				else p.resolve(node)
				return true
			}
			return false
		}
		if (node.tag === 'ack' && node.attrs['class'] === 'call') {
			const p = this.#callAcks.get(node.attrs['id'] ?? '')
			if (p) {
				this.#callAcks.delete(node.attrs['id']!)
				// 207 = served, with some entries failing (a group offer where one person cannot be reached).
				const failed = node.attrs['error'] && node.attrs['error'] !== '207'
				if (failed) p.reject(new Error(`call rejected by server (error ${node.attrs['error']})`))
				else p.resolve(node)
				return true
			}
			return false
		}
		if (node.tag === 'ack' && node.attrs['class'] === 'message') {
			const p = this.#acks.get(node.attrs['id'] ?? '')
			if (p) {
				this.#acks.delete(node.attrs['id']!)
				if (node.attrs['error'])
					p.reject(new Error(`message rejected by server (error ${node.attrs['error']})`))
				else p.resolve(node)
				return true
			}
			return false
		}
		if (node.tag === 'status') {
			// Channel status: acked with class=status and the stanza's own type.
			const type = node.attrs['edit'] ? 'revoke' : (node.attrs['type'] ?? 'text')
			this.#sendSafe({
				tag: 'ack',
				attrs: { id: node.attrs['id'] ?? '', to: node.attrs['from'] ?? '', class: 'status', type },
			})
			this.d.onChannelStatus?.(node)
			return true
		}
		if (node.tag === 'call') {
			this.#sendSafe(callAck(node))
			this.d.onCall?.(node)
			return true
		}
		if (node.tag === 'message' || node.tag === 'receipt' || node.tag === 'notification') {
			this.#queue = this.#queue
				.then(() => this.#process(node))
				.catch((e) => this.d.logger.event('receiver.error', e))
			return true
		}
		return false
	}

	/** Remember what we sent: its secret (replies, votes) and, for polls, the option texts. */
	rememberOwn(id: string, chat: string, message: Loose): void {
		this.#ownIds.add(id)
		if (this.#ownIds.size > 2000) this.#ownIds.delete(this.#ownIds.values().next().value!)
		const secret = message['messageContextInfo']?.messageSecret
		if (secret) this.#secrets.set(id, secret, chat)
		this.#notePoll(id, message, this.d.creds.me?.id ?? '', true)
	}

	/** Polls are identified by who created them *and* the id: two different peers may use the same id. */
	#pollKey(creator: string, id: string): string {
		try {
			return `${jidDecode(creator).user}|${id}`
		} catch {
			return `${creator}|${id}`
		}
	}

	#notePoll(id: string, message: Loose, creator: string, own = false): void {
		if (!own && this.#ownIds.has(id)) return // a peer reusing the id of one of our messages must not rewrite it
		const pollKey = this.#pollKey(creator, id)
		if (this.#polls.has(pollKey)) return // first write wins
		const poll =
			message['pollCreationMessage'] ??
			message['pollCreationMessageV2'] ??
			message['pollCreationMessageV3']
		if (poll?.options) {
			this.#polls.set(pollKey, {
				options: poll.options.map((o: { optionName: string }) => o.optionName),
				creator,
			})
			if (this.#polls.size > 500) this.#polls.delete(this.#polls.keys().next().value!)
		}
	}

	/** Send a stanza as-is (fire and forget). */
	sendNode(node: BinaryNode): void {
		this.d.send(node)
	}

	/** Wait for everything queued so far (used by tests). */
	idle(): Promise<void> {
		return this.#queue
	}

	nextId(): string {
		return `velowa-${Date.now().toString(36)}-${this.#idCounter++}`
	}

	/** Send an iq and await its result/error. */
	request(node: BinaryNode): Promise<BinaryNode> {
		const id = node.attrs['id'] ?? this.nextId()
		const withId: BinaryNode = { ...node, attrs: { ...node.attrs, id } }
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.#pending.delete(id)
				reject(new Error(`request ${id} timed out`))
			}, REQUEST_TIMEOUT_MS)
			this.#pending.set(id, {
				resolve: (n) => (clearTimeout(timer), resolve(n)),
				reject: (e) => (clearTimeout(timer), reject(e)),
			})
			try {
				this.d.send(withId)
			} catch (e) {
				clearTimeout(timer)
				this.#pending.delete(id)
				reject(e as Error)
			}
		})
	}

	/** Send a message stanza and resolve with the server's `<ack class="message">`. */
	/** Send a `<call>` stanza and wait for the server's `<ack class=call>` to it (the offer's carries the relay). */
	sendCallAndWait(node: BinaryNode, timeoutMs = 20_000): Promise<BinaryNode> {
		const id = node.attrs['id'] ?? ''
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.#callAcks.delete(id)
				reject(new Error(`no server ack for call stanza ${id}`))
			}, timeoutMs)
			this.#callAcks.set(id, {
				resolve: (n) => (clearTimeout(timer), resolve(n)),
				reject: (e) => (clearTimeout(timer), reject(e)),
			})
			try {
				this.d.send(node)
			} catch (e) {
				clearTimeout(timer)
				this.#callAcks.delete(id)
				reject(e as Error)
			}
		})
	}

	sendAndWaitAck(node: BinaryNode): Promise<BinaryNode> {
		const id = node.attrs['id'] ?? ''
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.#acks.delete(id)
				reject(new Error(`no server ack for message ${id}`))
			}, REQUEST_TIMEOUT_MS)
			this.#acks.set(id, {
				resolve: (n) => (clearTimeout(timer), resolve(n)),
				reject: (e) => (clearTimeout(timer), reject(e)),
			})
			try {
				this.d.send(node)
			} catch (e) {
				clearTimeout(timer)
				this.#acks.delete(id)
				reject(e as Error)
			}
		})
	}

	// ---- pre-keys ----------------------------------------------------------------------------

	/** Ask the server how many one-time pre-keys it still holds; top up when low. */
	async ensurePreKeys(): Promise<void> {
		const res = await this.request({
			tag: 'iq',
			attrs: { xmlns: 'encrypt', type: 'get', to: S_WHATSAPP_NET },
			content: [{ tag: 'count', attrs: {} }],
		})
		const count = Number(children(res, 'count')[0]?.attrs['value'] ?? 0)
		this.d.logger.event('prekeys.server-count', { count })
		if (count < MIN_PREKEY_COUNT) await this.uploadPreKeys(UPLOAD_PREKEY_COUNT)
	}

	/**
	 * Ask the server for its own record of our uploaded key bundle (`<iq xmlns="encrypt"><digest/></iq>`,
	 * `WAWebHandleDigestKey`): a 404 means it has none at all (the record was lost server-side, or never
	 * made it through), so the bundle is re-uploaded. Any other outcome - a mismatched registration id, a
	 * malformed response, a transient server error - is only logged: WA Web itself never re-uploads for
	 * those, trusting the ordinary low-prekey-count path (`ensurePreKeys`) to refresh things eventually.
	 */
	async validateDigestKey(): Promise<void> {
		let res: BinaryNode
		try {
			res = await this.request({
				tag: 'iq',
				attrs: { xmlns: 'encrypt', type: 'get', to: S_WHATSAPP_NET },
				content: [{ tag: 'digest', attrs: {} }],
			})
		} catch (e) {
			if (/"code":"404"/.test((e as Error).message)) {
				this.d.logger.event('prekeys.digest-missing', {})
				await this.uploadPreKeys(UPLOAD_PREKEY_COUNT)
			} else {
				this.d.logger.event('prekeys.digest-check-failed', e)
			}
			return
		}
		const digest = children(res, 'digest')[0]
		const regBytes = digest && children(digest, 'registration')[0]?.content
		const regId =
			regBytes instanceof Uint8Array ? regBytes.reduce((acc, b) => acc * 256 + b, 0) : undefined
		if (regId !== undefined && regId !== this.d.creds.registrationId)
			this.d.logger.event('prekeys.digest-reg-id-mismatch', {
				server: regId,
				local: this.d.creds.registrationId,
			})
	}

	async uploadPreKeys(count: number): Promise<void> {
		const keys = await this.#generatePreKeys(count)
		const { creds } = this.d
		const node: BinaryNode = {
			tag: 'iq',
			attrs: { xmlns: 'encrypt', type: 'set', to: S_WHATSAPP_NET },
			content: [
				{ tag: 'registration', attrs: {}, content: be(creds.registrationId, 4) },
				{ tag: 'type', attrs: {}, content: Buffer.from([5]) },
				{ tag: 'identity', attrs: {}, content: creds.signedIdentityKey.publicKey },
				{ tag: 'list', attrs: {}, content: keys.map(xmppPreKey) },
				xmppSignedPreKey(creds),
			],
		}
		await this.request(node)
		this.d.logger.event('prekeys.uploaded', { count, firstId: keys[0]?.id })
	}

	async #generatePreKeys(count: number) {
		const { creds, storage } = this.d
		const keys = newPreKeys(creds.nextPreKeyId, count)
		for (const k of keys) await storage.storePreKey(k.id, k.record)
		// Persist the counter only after the keys exist on disk: ids are never reused.
		creds.nextPreKeyId += count
		this.d.saveCreds()
		return keys
	}

	/**
	 * `<notification type="encrypt"><identity/></notification>`: the peer's primary device was re-registered
	 * (e.g. WhatsApp reinstalled) and got a new identity key. Drop our stored session for it (under the PN
	 * and LID forms, whichever we know) so the next send rebuilds it via a fresh, ADV-verified prekey fetch
	 * instead of silently encrypting to - or failing to decrypt from - the old identity. A companion device's
	 * own identity change does not affect this (only the primary's matters), and neither does our own (that
	 * would break our other devices' sessions with us).
	 */
	async #handleIdentityChange(node: BinaryNode): Promise<void> {
		const from = node.attrs['from']
		if (!from) return
		let decoded: { user: string; device: number; server: string }
		try {
			decoded = jidDecode(from)
		} catch {
			return
		}
		if (decoded.device !== 0) return
		const { creds, storage, lids, logger } = this.d
		const pnUser = decoded.server === 'lid' ? lids.pnUser(decoded.user) : decoded.user
		const lidUser = decoded.server === 'lid' ? decoded.user : lids.lidUser(decoded.user)
		const targets = new Set([decoded.user, pnUser, lidUser].filter((u): u is string => !!u))
		// Check every resolved target, not just the stanza's own address: the PN/LID pairing a target was
		// resolved through comes from `noteLidFromAttrs`, which trusts the server's own cross-reference
		// attributes but is not itself authenticated against this specific notification, so a forged or
		// stale pairing must never be able to make this delete our own session instead of a peer's.
		const isMe = [...targets].some(
			(u) =>
				(creds.me && jidDecode(creds.me.id).user === u) ||
				(creds.me?.lid && jidDecode(creds.me.lid).user === u),
		)
		if (isMe) return
		for (const user of targets) await storage.removeSession(user, 0)
		logger.event('identity.changed', { from })
	}

	// ---- incoming stanzas -----------------------------------------------------------------------

	async #process(node: BinaryNode): Promise<void> {
		const meId = this.d.creds.me?.id
		// Free: most message/notification/receipt stanzas carry the acting address's other form as an attribute
		// (`participant_pn` etc. on a LID-addressed one, `participant_lid` etc. on a legacy PN-addressed one) -
		// otherwise the only way this map ever grows is a usync lookup or a shared group's participant list, so a
		// 1:1 chat that has never gone through either (new, or itself still PN-addressed) stays unresolvable and a
		// later send to it by LID can find no devices at all. See `noteLidFromAttrs`.
		noteLidFromAttrs(node.attrs, this.d.lids)
		if (node.tag === 'notification') {
			if (node.attrs['type'] === 'encrypt') {
				const count = children(node, 'count')[0]
				if (count && Number(count.attrs['value']) < MIN_PREKEY_COUNT) {
					await this.uploadPreKeys(UPLOAD_PREKEY_COUNT).catch((e) =>
						this.d.logger.event('prekeys.upload-failed', e),
					)
				}
				if (children(node, 'identity')[0]) await this.#handleIdentityChange(node)
			}
			this.#sendSafe(buildAck(node, meId))
			this.d.onNotification?.(node)
			return
		}
		if (node.tag === 'receipt') {
			this.#sendSafe(buildAck(node, meId))
			this.d.onReceipt?.(node)
			return
		}
		await this.#processMessage(node)
	}

	async #processMessage(node: BinaryNode): Promise<void> {
		const { logger } = this.d
		const from = node.attrs['from'] ?? ''
		const id = node.attrs['id'] ?? ''
		const participant = node.attrs['participant']
		const author = participant ?? from
		// Channel posts (and a few server messages) arrive as <plaintext>, treated like a decrypted envelope.
		const plaintexts = children(node, 'plaintext').filter((e) => e.content instanceof Uint8Array)
		const encs = children(node, 'enc').filter((e) => e.content instanceof Uint8Array)
		const isGroupEnc = (e: BinaryNode) =>
			e.attrs['type'] === 'skmsg' || e.attrs['type'] === 'frskmsg'
		// Unicast first: a pkmsg may carry the sender-key distribution the skmsg needs.
		const ordered = [
			...plaintexts.map((p) => ({ ...p, attrs: { ...p.attrs, type: 'plaintext' } })),
			...encs.filter((e) => !isGroupEnc(e)),
			...encs.filter(isGroupEnc),
		]

		let decrypted = 0
		let retryable = 0
		const failures: string[] = []
		for (const enc of ordered) {
			const type = enc.attrs['type'] ?? ''
			// A retry can re-key Signal envelopes, but never a Meta AI msmsg (its key is the original message's secret).
			if (type !== 'msmsg' && type !== 'plaintext') retryable++
			try {
				const data = enc.content as Uint8Array
				const plain =
					type === 'plaintext'
						? data
						: type === 'msmsg'
							? this.#decryptMsmsg(node, author, data)
							: await this.#decryptEnc(from, author, type, data)
				const msg = await this.#decodeAndApply(node, plain, author, id, from, type === 'msmsg')
				decrypted++
				logger.event('message.decrypted', { id, from, participant, type, message: msg.json })
				const decoded: DecodedMessage = { id, from, message: msg.json }
				if (participant) decoded.participant = participant
				const ts = Number(node.attrs['t'])
				if (ts) decoded.timestamp = ts
				if (node.attrs['notify']) decoded.pushName = node.attrs['notify']
				const rep = children(node, 'reporting')[0]
				if (rep) {
					const tag = children(rep, 'reporting_tag')[0]?.content
					const tok = children(rep, 'reporting_token')[0]
					decoded.reporting = {
						...(tag instanceof Uint8Array && { tag }),
						...(tok?.content instanceof Uint8Array && { token: tok.content }),
						...(tok?.attrs['v'] && { version: Number(tok.attrs['v']) }),
					}
				}
				this.d.onMessage?.(decoded)
			} catch (error) {
				failures.push(`${type}: ${(error as Error).message}`)
				logger.event('message.decrypt-failed', { id, from, participant, type, error })
			}
		}

		const unavailable = children(node, 'unavailable')[0]
		if (unavailable && ordered.length === 0 && id && from) {
			const ts = Number(node.attrs['t'])
			this.d.onUnavailable?.({
				id,
				from,
				...(participant && { participant }),
				...(ts && { timestamp: ts }),
				...(node.attrs['notify'] && { pushName: node.attrs['notify'] }),
				reason: (unavailable.attrs['type'] ?? 'unknown').slice(0, 32),
				...(node.attrs['type'] && { kind: node.attrs['type'] }),
			})
		}
		if (failures.length > 0 && decrypted === 0 && retryable > 0) await this.#sendRetry(node)
		else if (decrypted > 0 && node.attrs['type'] !== 'peer_msg' && !from.endsWith('@newsletter')) {
			const attrs: Record<string, string> = { id, to: from }
			if (participant) attrs['participant'] = participant
			this.#sendSafe({ tag: 'receipt', attrs })
		}
		this.#sendSafe(buildAck(node, this.d.creds.me?.id))
	}

	/**
	 * The call key from an offer's `<enc>` (a Signal message from the caller's device carrying `Message.call.callKey`).
	 * Returns undefined when the envelope holds no call key.
	 */
	async decryptCallKey(
		author: string,
		type: string,
		data: Uint8Array,
	): Promise<Uint8Array | undefined> {
		const plain = await this.#decryptEnc(author, author, type, data)
		const msg = protoType('Message').toObject(protoType('Message').decode(plain), {
			bytes: Buffer,
		}) as {
			call?: { callKey?: Uint8Array }
		}
		const key = msg.call?.callKey
		return key && key.length >= 32 ? key : undefined
	}

	async #decryptEnc(
		from: string,
		author: string,
		type: string,
		data: Uint8Array,
	): Promise<Uint8Array> {
		if (type === 'skmsg' || type === 'frskmsg') {
			return unpadRandomMax16(
				await this.d.cipher.groupDecrypt(from, signalAddressString(author), data),
			)
		}
		if (type !== 'pkmsg' && type !== 'msg') throw new Error(`unsupported enc type "${type}"`)
		const { name, device } = signalAddress(this.d.lids.resolve(author))
		const res = await this.d.cipher.decrypt(name, device, type, data)
		// The session is durable by now (decrypt awaited the store); only then drop the pre-key.
		if (res.preKeyId !== undefined) await this.d.storage.removePreKey(res.preKeyId)
		return unpadRandomMax16(res.plaintext)
	}

	#pollVote(raw: Loose, voter: string, chat: string) {
		const upd = raw['pollUpdateMessage']
		const key = upd?.pollCreationMessageKey
		const vote = upd?.vote
		if (!key?.id || !vote?.encPayload || !vote?.encIv) return undefined
		const claimedCreator = key.fromMe
			? (this.d.creds.me?.id ?? '')
			: (key.participant ?? key.remoteJid ?? chat)
		const poll = this.#polls.get(this.#pollKey(claimedCreator, key.id))
		// Exactly this poll's secret: the chat-wide "recent secrets" fallback is for Meta AI replies only.
		const exact = this.#secrets.byId(key.id)
		const secrets = exact ? [exact] : []
		if (!secrets.length) return { pollId: key.id, error: 'poll secret unknown' }
		// The creator comes from what we remembered about the poll, not from fields of the incoming vote.
		const creator = poll?.creator ?? claimedCreator
		let lastError = 'poll vote did not decrypt'
		for (const secret of secrets) {
			try {
				const hashes = decryptPollVote(
					{ encPayload: new Uint8Array(vote.encPayload), encIv: new Uint8Array(vote.encIv) },
					{ pollCreatorJid: creator, pollMsgId: key.id, pollSecret: secret, voterJid: voter },
				)
				const names = poll
					? hashes
							.map((h) => poll.options.find((n) => pollOptionHash(n) === h))
							.filter((n): n is string => !!n)
					: undefined
				return { pollId: key.id, selected: hashes, ...(names && { options: names }) }
			} catch (e) {
				lastError = (e as Error).message
			}
		}
		return { pollId: key.id, error: lastError }
	}

	/** The secret of a message we sent or received (events and polls are answered with it). */
	secretOf(id: string): Uint8Array | undefined {
		return this.#secrets.byId(id)
	}

	/** Comments and encrypted reactions: decrypted with the parent post's secret, or an error saying why not. */
	#addon(raw: Loose, who: string, chat: string) {
		for (const [field, useCase] of [
			['encCommentMessage', 'Enc Comment'],
			['encReactionMessage', 'Enc Reaction'],
		] as const) {
			const enc = raw[field]
			const key = enc?.targetMessageKey
			if (!key?.id || !enc?.encPayload || !enc?.encIv) continue
			const parentSender = key.fromMe
				? (this.d.creds.me?.id ?? '')
				: (key.participant ?? key.remoteJid ?? chat)
			const secret = this.#secrets.byId(key.id)
			if (!secret) return { kind: useCase, targetId: key.id, error: 'parent secret unknown' }
			const strip = (j: string) => j.replace(/:\d+@/, '@')
			try {
				const message = decryptAddon(
					{ encPayload: new Uint8Array(enc.encPayload), encIv: new Uint8Array(enc.encIv) },
					{
						parentMsgId: key.id,
						parentSenderJid: strip(parentSender),
						modifierJid: strip(who),
						secret,
						useCase,
					},
				)
				return { kind: useCase, targetId: key.id, message }
			} catch (e) {
				return { kind: useCase, targetId: key.id, error: (e as Error).message }
			}
		}
		return undefined
	}

	#eventResponse(raw: Loose, responder: string, chat: string) {
		const enc = raw['encEventResponseMessage']
		const key = enc?.eventCreationMessageKey
		if (!key?.id || !enc?.encPayload || !enc?.encIv) return undefined
		const creator = key.fromMe
			? (this.d.creds.me?.id ?? '')
			: (key.participant ?? key.remoteJid ?? chat)
		const secret = this.#secrets.byId(key.id)
		if (!secret) return { eventId: key.id, error: 'event secret unknown' }
		try {
			const r = decryptEventResponse(
				{ encPayload: new Uint8Array(enc.encPayload), encIv: new Uint8Array(enc.encIv) },
				{ eventMsgId: key.id, eventCreatorJid: creator, responderJid: responder, secret },
			)
			return { eventId: key.id, ...r }
		} catch (e) {
			return { eventId: key.id, error: (e as Error).message }
		}
	}

	/** A peer-category stanza (the phone talking to its linked devices) from our own account. */
	#isOwnPeer(node: BinaryNode, author: string): boolean {
		return node.attrs['category'] === 'peer' && this.#isOwnAccount(author)
	}

	/** Is this JID (any device) one of our own account's, by phone number or LID? */
	#isOwnAccount(jid: string): boolean {
		const me = this.d.creds.me
		if (!me) return false
		try {
			const a = jidDecode(jid)
			const same = (other: string) => {
				const b = jidDecode(other)
				return a.user === b.user && a.domainType === b.domainType
			}
			return same(me.id) || (me.lid !== undefined && same(me.lid))
		} catch {
			return false
		}
	}

	/** Meta AI reply: decrypt with the secret of the message it answers (see meta-ai.ts). */
	#decryptMsmsg(node: BinaryNode, author: string, data: Uint8Array): Uint8Array {
		const { creds } = this.d
		const meta = children(node, 'meta')[0]?.attrs ?? {}
		const bot = children(node, 'bot')[0]?.attrs ?? {}
		const botEditTargetId = bot['edit_target_id'] || undefined
		const candidates = this.#secrets.candidates(
			[botEditTargetId, meta['target_id'], node.attrs['id']],
			node.attrs['from'] ?? '',
		)
		if (candidates.length === 0)
			throw new Error('msmsg: no messageSecret known for the original message')
		const m = protoType('MessageSecretMessage').toObject(
			protoType('MessageSecretMessage').decode(data),
			{
				bytes: Buffer,
			},
		) as { encIv?: Buffer; encPayload?: Buffer }
		if (!m.encIv || !m.encPayload) throw new Error('msmsg: missing encIv/encPayload')
		let last: unknown
		for (const secret of candidates) {
			try {
				return decryptMsmsg(
					secret,
					{
						// In a 1:1 chat with the bot the stanza has no participant: the bot is `from`.
						botJid: author,
						meId: creds.me?.id ?? '',
						meLid: creds.me?.lid,
						targetSenderJid: meta['target_sender_jid'],
						botEditTargetId,
						metaTargetId: meta['target_id'],
						stanzaId: node.attrs['id'],
					},
					m.encIv,
					m.encPayload,
				)
			} catch (e) {
				last = e
			}
		}
		throw last instanceof Error ? last : new Error('msmsg decryption failed')
	}

	async #decodeAndApply(
		node: BinaryNode,
		plain: Uint8Array,
		author: string,
		id: string,
		chat: string,
		lenient: boolean,
	) {
		const T = protoType('Message')
		let decoded = T.decode(plain)
		if (lenient) {
			// msmsg bodies may or may not carry Signal padding: prefer the padded reading if it has content.
			try {
				const unpadded = T.decode(unpadRandomMax16(plain))
				if (Object.keys(unpadded.toJSON()).some((k) => k !== 'messageContextInfo'))
					decoded = unpadded
			} catch {
				/* not padded */
			}
		}
		const asJson = T.toObject(decoded, { longs: String, bytes: String, enums: String }) as Record<
			string,
			unknown
		>
		const raw = T.toObject(decoded, { bytes: Buffer }) as {
			senderKeyDistributionMessage?: {
				groupId?: string
				axolotlSenderKeyDistributionMessage?: Buffer
			}
			messageContextInfo?: { messageSecret?: Buffer }
			protocolMessage?: {
				peerDataOperationRequestResponseMessage?: {
					peerDataOperationResult?: {
						placeholderMessageResendResponse?: { webMessageInfoBytes?: Buffer }
					}[]
				}
				historySyncNotification?: Record<string, unknown>
				appStateSyncKeyShare?: {
					keys?: { keyId?: { keyId?: Buffer }; keyData?: { keyData?: Buffer } }[]
				}
				lidMigrationMappingSyncMessage?: { encodedMappingPayload?: Buffer }
			}
		}
		const secret = raw.messageContextInfo?.messageSecret
		if (secret && !this.#ownIds.has(id) && !this.#secrets.has(id))
			this.#secrets.set(id, secret, chat)
		const shared = raw.protocolMessage?.appStateSyncKeyShare?.keys
		if (shared?.length && this.d.onAppStateKeys && !this.#isOwnPeer(node, author)) {
			// Whoever holds these keys can forge our chat/contact state, so only our own account may hand them out.
			this.d.logger.event('appstate.key-share-rejected', { author, count: shared.length })
		} else if (shared?.length && this.d.onAppStateKeys) {
			const keys = shared.flatMap((k) =>
				k.keyId?.keyId && k.keyData?.keyData
					? [{ keyId: new Uint8Array(k.keyId.keyId), keyData: new Uint8Array(k.keyData.keyData) }]
					: [],
			)
			if (keys.length) this.d.onAppStateKeys(keys)
		}
		const migrationPayload =
			raw.protocolMessage?.lidMigrationMappingSyncMessage?.encodedMappingPayload
		if (migrationPayload) {
			// Self-only: a peer sending this could otherwise poison our LID/PN mapping and misdirect our sends.
			if (this.#isOwnPeer(node, author)) {
				applyLidMigrationMapping(new Uint8Array(migrationPayload), this.d.lids)
			} else {
				this.d.logger.event('lid-migration.rejected', { author })
			}
		}
		const pdo =
			raw.protocolMessage?.peerDataOperationRequestResponseMessage?.peerDataOperationResult
		if (pdo?.length && this.d.onResentMessage) {
			if (!this.#isOwnPeer(node, author)) {
				this.d.logger.event('resend.rejected', { author })
			} else {
				for (const r of pdo) {
					const bytes = r.placeholderMessageResendResponse?.webMessageInfoBytes
					if (bytes) this.d.onResentMessage(new Uint8Array(bytes))
				}
			}
		}
		const hist = raw.protocolMessage?.historySyncNotification
		if (hist && this.d.onHistory && this.#isOwnPeer(node, author)) {
			const b = (x: unknown) => (x instanceof Uint8Array ? new Uint8Array(x) : undefined)
			const mk = b(hist['mediaKey'])
			if (mk || hist['initialHistBootstrapInlinePayload']) {
				const inline = b(hist['initialHistBootstrapInlinePayload'])
				this.d.onHistory({
					ref: {
						...(typeof hist['directPath'] === 'string' && { directPath: hist['directPath'] }),
						mediaKey: mk ?? new Uint8Array(32),
						...(b(hist['fileSha256']) && { fileSha256: b(hist['fileSha256'])! }),
						...(b(hist['fileEncSha256']) && { fileEncSha256: b(hist['fileEncSha256'])! }),
						...(hist['fileLength'] !== undefined && { fileLength: Number(hist['fileLength']) }),
					},
					...(typeof hist['syncType'] === 'number' || typeof hist['syncType'] === 'string'
						? { syncType: String(hist['syncType']) }
						: {}),
					...(hist['chunkOrder'] !== undefined && { chunkOrder: Number(hist['chunkOrder']) }),
					...(hist['progress'] !== undefined && { progress: Number(hist['progress']) }),
					...(inline && { inline }),
				})
				// The phone waits for this before it sends the next chunk.
				this.#sendSafe({
					tag: 'receipt',
					attrs: { id: node.attrs['id'] ?? '', to: node.attrs['from'] ?? '', type: 'hist_sync' },
				})
			}
		} else if (hist) {
			this.d.logger.event('history.rejected', { author })
		}
		const skdm = raw.senderKeyDistributionMessage
		if (skdm?.axolotlSenderKeyDistributionMessage && skdm.groupId) {
			await this.d.cipher.processSenderKeyDistribution(
				skdm.groupId,
				signalAddressString(author),
				new Uint8Array(skdm.axolotlSenderKeyDistributionMessage),
			)
			this.d.logger.event('sender-key.installed', { group: skdm.groupId, author })
		}
		this.#notePoll(id, asJson as Loose, author)
		const vote = this.#pollVote(raw, author, chat)
		if (vote) asJson['pollVote'] = vote
		const addon = this.#addon(raw, author, chat)
		if (addon) asJson['addon'] = addon
		const rsvp = this.#eventResponse(raw, author, chat)
		if (rsvp) asJson['eventResponse'] = rsvp
		const text = lenient ? extractMetaAiText(asJson) : undefined
		return { json: text !== undefined ? { ...asJson, metaAiText: text } : asJson }
	}

	/** Ask the sender to re-encrypt for us; from the 2nd attempt on, include our key bundle. */
	async #sendRetry(node: BinaryNode): Promise<void> {
		const { creds, logger } = this.d
		const id = node.attrs['id'] ?? ''
		const key = `${id}:${node.attrs['participant'] ?? ''}`
		const count = (this.#retryCounts.get(key) ?? 0) + 1
		if (count > MAX_RETRIES) {
			logger.event('retry.giving-up', { id })
			const from = node.attrs['from'] ?? ''
			const participant = node.attrs['participant']
			if (id && from)
				this.d.onUndecryptable?.({
					remoteJid: from,
					id,
					fromMe: false,
					...(participant && { participant }),
				})
			return
		}
		this.#retryCounts.set(key, count)
		const attrs: Record<string, string> = { id, type: 'retry', to: node.attrs['from'] ?? '' }
		if (node.attrs['recipient']) attrs['recipient'] = node.attrs['recipient']
		if (node.attrs['participant']) attrs['participant'] = node.attrs['participant']
		const content: BinaryNode[] = [
			{
				tag: 'retry',
				attrs: { count: String(count), id, t: node.attrs['t'] ?? '', v: '1', error: '1' },
			},
			{ tag: 'registration', attrs: {}, content: be(creds.registrationId, 4) },
		]
		if (count > 1 && creds.account) {
			const [pre] = await this.#generatePreKeys(1)
			content.push({
				tag: 'keys',
				attrs: {},
				content: [
					{ tag: 'type', attrs: {}, content: Buffer.from([5]) },
					{ tag: 'identity', attrs: {}, content: creds.signedIdentityKey.publicKey },
					xmppPreKey(pre!),
					xmppSignedPreKey(creds),
					{ tag: 'device-identity', attrs: {}, content: creds.account },
				],
			})
		}
		this.#sendSafe({ tag: 'receipt', attrs, content })
		logger.event('retry.sent', { id, count, withKeys: count > 1 })
	}

	#sendSafe(node: BinaryNode): void {
		try {
			this.d.send(node)
		} catch (error) {
			this.d.logger.event('send.failed', { tag: node.tag, error })
		}
	}
}

const xmppPreKey = (k: { id: number; publicKey: Uint8Array }): BinaryNode => ({
	tag: 'key',
	attrs: {},
	content: [
		{ tag: 'id', attrs: {}, content: be(k.id, 3) },
		{ tag: 'value', attrs: {}, content: k.publicKey },
	],
})

const xmppSignedPreKey = (creds: AuthCreds): BinaryNode => ({
	tag: 'skey',
	attrs: {},
	content: [
		{ tag: 'id', attrs: {}, content: be(creds.signedPreKey.keyId, 3) },
		{ tag: 'value', attrs: {}, content: creds.signedPreKey.publicKey },
		{ tag: 'signature', attrs: {}, content: creds.signedPreKey.signature },
	],
})
