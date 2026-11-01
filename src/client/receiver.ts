import type { AuthCreds } from '../auth/creds.js'
import type { BinaryNode } from '../codec/index.js'
import { newPreKeys } from '../crypto/signal.js'
import type { SignalCipher, SignalStorage } from '../crypto/signal.js'
import { jidDecode, signalAddress, signalAddressString } from '../jid.js'
import type { ProtocolLogger } from '../logging/protocol-logger.js'
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
	storage: SignalStorage
	cipher: SignalCipher
	logger: ProtocolLogger
	send(node: BinaryNode): void
	/** Called with every successfully decoded message (plain JSON-able object). */
	onMessage?(m: DecodedMessage): void
	/** Called with every notification (after it was acked). */
	onNotification?(n: BinaryNode): void
	/** Sync keys shared by the primary phone (`appStateSyncKeyShare`). */
	onAppStateKeys?(keys: { keyId: Uint8Array; keyData: Uint8Array }[]): void
}

export interface DecodedMessage {
	id: string
	from: string
	participant?: string
	timestamp?: number
	pushName?: string
	message: Record<string, unknown>
}

const children = (n: BinaryNode, tag?: string): BinaryNode[] =>
	Array.isArray(n.content) ? n.content.filter((c) => tag === undefined || c.tag === tag) : []

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
	readonly #retryCounts = new Map<string, number>()
	readonly #secrets = new MessageSecrets()
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
		if (node.tag === 'message' || node.tag === 'receipt' || node.tag === 'notification') {
			this.#queue = this.#queue
				.then(() => this.#process(node))
				.catch((e) => this.d.logger.event('receiver.error', e))
			return true
		}
		return false
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

	// ---- incoming stanzas -----------------------------------------------------------------------

	async #process(node: BinaryNode): Promise<void> {
		const meId = this.d.creds.me?.id
		if (node.tag === 'notification') {
			if (node.attrs['type'] === 'encrypt') {
				const count = children(node, 'count')[0]
				if (count && Number(count.attrs['value']) < MIN_PREKEY_COUNT) {
					await this.uploadPreKeys(UPLOAD_PREKEY_COUNT).catch((e) =>
						this.d.logger.event('prekeys.upload-failed', e),
					)
				}
			}
			this.#sendSafe(buildAck(node, meId))
			this.d.onNotification?.(node)
			return
		}
		if (node.tag === 'receipt') {
			this.#sendSafe(buildAck(node, meId))
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
		const encs = children(node, 'enc').filter((e) => e.content instanceof Uint8Array)
		const isGroupEnc = (e: BinaryNode) =>
			e.attrs['type'] === 'skmsg' || e.attrs['type'] === 'frskmsg'
		// Unicast first: a pkmsg may carry the sender-key distribution the skmsg needs.
		const ordered = [...encs.filter((e) => !isGroupEnc(e)), ...encs.filter(isGroupEnc)]

		let decrypted = 0
		let retryable = 0
		const failures: string[] = []
		for (const enc of ordered) {
			const type = enc.attrs['type'] ?? ''
			// A retry can re-key Signal envelopes, but never a Meta AI msmsg (its key is the original message's secret).
			if (type !== 'msmsg') retryable++
			try {
				const data = enc.content as Uint8Array
				const plain =
					type === 'msmsg'
						? this.#decryptMsmsg(node, author, data)
						: await this.#decryptEnc(from, author, type, data)
				const msg = await this.#decodeAndApply(plain, author, id, from, type === 'msmsg')
				decrypted++
				logger.event('message.decrypted', { id, from, participant, type, message: msg.json })
				const decoded: DecodedMessage = { id, from, message: msg.json }
				if (participant) decoded.participant = participant
				const ts = Number(node.attrs['t'])
				if (ts) decoded.timestamp = ts
				if (node.attrs['notify']) decoded.pushName = node.attrs['notify']
				this.d.onMessage?.(decoded)
			} catch (error) {
				failures.push(`${type}: ${(error as Error).message}`)
				logger.event('message.decrypt-failed', { id, from, participant, type, error })
			}
		}

		if (failures.length > 0 && decrypted === 0 && retryable > 0) await this.#sendRetry(node)
		else if (decrypted > 0 && node.attrs['type'] !== 'peer_msg') {
			const attrs: Record<string, string> = { id, to: from }
			if (participant) attrs['participant'] = participant
			this.#sendSafe({ tag: 'receipt', attrs })
		}
		this.#sendSafe(buildAck(node, this.d.creds.me?.id))
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
		const { name, device } = signalAddress(author)
		const res = await this.d.cipher.decrypt(name, device, type, data)
		// The session is durable by now (decrypt awaited the store); only then drop the pre-key.
		if (res.preKeyId !== undefined) await this.d.storage.removePreKey(res.preKeyId)
		return unpadRandomMax16(res.plaintext)
	}

	/** Is this JID (any device) one of our own account's, by phone number or LID? */
	#isOwnAccount(jid: string): boolean {
		const me = this.d.creds.me
		if (!me) return false
		try {
			const user = jidDecode(jid).user
			return (
				user === jidDecode(me.id).user || (me.lid !== undefined && user === jidDecode(me.lid).user)
			)
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
				appStateSyncKeyShare?: {
					keys?: { keyId?: { keyId?: Buffer }; keyData?: { keyData?: Buffer } }[]
				}
			}
		}
		const secret = raw.messageContextInfo?.messageSecret
		if (secret) this.#secrets.set(id, secret, chat)
		const shared = raw.protocolMessage?.appStateSyncKeyShare?.keys
		if (shared?.length && this.d.onAppStateKeys && !this.#isOwnAccount(author)) {
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
		const skdm = raw.senderKeyDistributionMessage
		if (skdm?.axolotlSenderKeyDistributionMessage && skdm.groupId) {
			await this.d.cipher.processSenderKeyDistribution(
				skdm.groupId,
				signalAddressString(author),
				new Uint8Array(skdm.axolotlSenderKeyDistributionMessage),
			)
			this.d.logger.event('sender-key.installed', { group: skdm.groupId, author })
		}
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
