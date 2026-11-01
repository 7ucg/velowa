import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { AuthCreds } from '../auth/creds.js'
import type { BinaryNode } from '../codec/index.js'
import type { SignalCipher, SignalStorage } from '../crypto/signal.js'
import { jidDecode, signalAddress, signalAddressString } from '../jid.js'
import type { ProtocolLogger } from '../logging/protocol-logger.js'
import { encodeProto } from './proto.js'
import type { Receiver } from './receiver.js'

const S_WHATSAPP_NET = 's.whatsapp.net'

const children = (n: BinaryNode, tag?: string): BinaryNode[] =>
	Array.isArray(n.content) ? n.content.filter((c) => tag === undefined || c.tag === tag) : []

/** Random 1-16 byte padding (each pad byte equals the pad length), as every Signal plaintext carries. */
export function padRandomMax16(data: Uint8Array): Uint8Array {
	const n = (randomBytes(1)[0]! & 0x0f) + 1
	return Buffer.concat([data, Buffer.alloc(n, n)])
}

/** Message id in WhatsApp Web's v2 shape: `3EB0` + 18 hex chars of a hash over time, our user and randomness. */
export function generateMessageId(meId: string): string {
	const data = Buffer.alloc(8 + 20 + 16)
	data.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000)))
	const user = jidDecode(meId).user
	data.write(user, 8)
	data.write('@c.us', 8 + user.length)
	randomBytes(16).copy(data, 28)
	return '3EB0' + createHash('sha256').update(data).digest('hex').toUpperCase().slice(0, 18)
}

/** Participant hash the server uses to detect a stale device list: `2:` + 6 base64 chars of sha256(sorted jids). */
export function participantHash(jids: string[]): string {
	const sorted = [...jids].sort()
	return '2:' + createHash('sha256').update(sorted.join('')).digest('base64').slice(0, 6)
}

export interface DeviceTarget {
	jid: string
	user: string
	device: number
}

export interface SenderDeps {
	creds: AuthCreds
	storage: SignalStorage
	cipher: SignalCipher
	receiver: Receiver
	logger: ProtocolLogger
	/** Where the per-group "already distributed our sender key to" memory lives (JSON). */
	senderKeyMemoryPath?: string
}

/**
 * Outgoing messages: device discovery (usync), pre-key bundle fetch, per-device Double-Ratchet
 * encryption for 1:1 chats, sender-key fan-out for groups. Resolves once the server acked.
 */
export class Sender {
	readonly #memory: Record<string, string[]>

	constructor(private readonly d: SenderDeps) {
		this.#memory =
			d.senderKeyMemoryPath && existsSync(d.senderKeyMemoryPath)
				? JSON.parse(readFileSync(d.senderKeyMemoryPath, 'utf8'))
				: {}
	}

	/** Send plain text to a user or group JID. Returns the message id. */
	async sendText(to: string, text: string): Promise<string> {
		return this.sendMessage(to, { conversation: text })
	}

	/** Send an arbitrary WAProto `Message` (plain object form). */
	async sendMessage(to: string, message: Record<string, unknown>): Promise<string> {
		const { creds } = this.d
		if (!creds.me) throw new Error('not paired')
		const id = generateMessageId(creds.me.id)
		const stanza = to.endsWith('@g.us')
			? await this.#groupStanza(id, to, message)
			: await this.#directStanza(id, to, message)
		this.d.logger.event('send.message', { id, to })
		await this.d.receiver.sendAndWaitAck(stanza)
		this.d.logger.event('send.acked', { id, to })
		return id
	}

	// ---- devices -------------------------------------------------------------------------------

	/** All devices (excluding this one) of the given users, via usync. */
	async getDevices(userJids: string[]): Promise<DeviceTarget[]> {
		const { creds, receiver } = this.d
		const me = jidDecode(creds.me!.id)
		const meLidUser = creds.me?.lid ? jidDecode(creds.me.lid).user : undefined
		const res = await receiver.request({
			tag: 'iq',
			attrs: { to: S_WHATSAPP_NET, type: 'get', xmlns: 'usync' },
			content: [
				{
					tag: 'usync',
					attrs: {
						context: 'message',
						mode: 'query',
						sid: receiver.nextId(),
						last: 'true',
						index: '0',
					},
					content: [
						{
							tag: 'query',
							attrs: {},
							content: [
								{ tag: 'devices', attrs: { version: '2' } },
								{ tag: 'lid', attrs: {} },
							],
						},
						{
							tag: 'list',
							attrs: {},
							content: userJids.map((jid) => ({ tag: 'user', attrs: { jid } })),
						},
					],
				},
			],
		})
		const list = children(children(children(res, 'usync')[0] ?? res, 'list')[0] ?? res, 'user')
		const out: DeviceTarget[] = []
		for (const user of list) {
			const jid = user.attrs['jid'] ?? ''
			const { user: u, server } = jidDecode(jid)
			const deviceList = children(
				children(children(user, 'devices')[0] ?? user, 'device-list')[0] ?? user,
				'device',
			)
			for (const dev of deviceList) {
				const device = Number(dev.attrs['id'])
				// Non-zero devices must carry a key-index, otherwise the server rejects the fan-out.
				if (device !== 0 && !dev.attrs['key-index']) continue
				const isThisDevice = (u === me.user || u === meLidUser) && device === me.device
				if (isThisDevice) continue
				out.push({
					jid: device === 0 ? `${u}@${server}` : `${u}:${device}@${server}`,
					user: u,
					device,
				})
			}
		}
		this.d.logger.event('send.devices', { users: userJids, devices: out.map((o) => o.jid) })
		return out
	}

	/** Make sure a Signal session exists for each device, fetching pre-key bundles for the missing ones. */
	async assertSessions(jids: string[]): Promise<void> {
		const missing: string[] = []
		for (const jid of new Set(jids)) {
			const a = signalAddress(jid)
			if (!(await this.d.cipher.hasSession(a.name, a.device))) missing.push(jid)
		}
		if (!missing.length) return
		const res = await this.d.receiver.request({
			tag: 'iq',
			attrs: { xmlns: 'encrypt', type: 'get', to: S_WHATSAPP_NET },
			content: [
				{ tag: 'key', attrs: {}, content: missing.map((jid) => ({ tag: 'user', attrs: { jid } })) },
			],
		})
		for (const user of children(children(res, 'list')[0] ?? res, 'user')) {
			const jid = user.attrs['jid'] ?? ''
			if (children(user, 'error').length) {
				this.d.logger.event('send.prekey-error', { jid, error: children(user, 'error')[0]?.attrs })
				continue
			}
			const bundle = parseBundle(user)
			const a = signalAddress(jid)
			await this.d.cipher.processPreKeyBundle(a.name, a.device, bundle)
			this.d.logger.event('send.session-created', { jid })
		}
	}

	// ---- 1:1 -----------------------------------------------------------------------------------

	async #directStanza(
		id: string,
		to: string,
		message: Record<string, unknown>,
	): Promise<BinaryNode> {
		const { creds } = this.d
		const meUser = jidDecode(creds.me!.id).user
		const ownBare = `${meUser}@${S_WHATSAPP_NET}`
		const devices = await this.getDevices([ownBare, to])
		const toUser = jidDecode(to).user
		const mine = devices.filter(
			(d) => d.user === meUser || d.user === (creds.me?.lid ? jidDecode(creds.me.lid).user : '#'),
		)
		const others = devices.filter((d) => !mine.includes(d))
		if (!others.length) throw new Error(`no devices found for ${to} (user ${toUser})`)
		await this.assertSessions([...mine, ...others].map((d) => d.jid))

		const dsm = { deviceSentMessage: { destinationJid: to, message } }
		const participants: BinaryNode[] = []
		let needsIdentity = false
		for (const [targets, msg] of [
			[mine, dsm],
			[others, message],
		] as const) {
			const plain = padRandomMax16(encodeProto('Message', msg))
			for (const t of targets) {
				const a = signalAddress(t.jid)
				const enc = await this.d.cipher.encrypt(a.name, a.device, plain)
				if (enc.type === 'pkmsg') needsIdentity = true
				participants.push({
					tag: 'to',
					attrs: { jid: t.jid },
					content: [{ tag: 'enc', attrs: { v: '2', type: enc.type }, content: enc.ciphertext }],
				})
			}
		}
		const content: BinaryNode[] = [{ tag: 'participants', attrs: {}, content: participants }]
		if (needsIdentity && creds.account)
			content.push({ tag: 'device-identity', attrs: {}, content: creds.account })
		return {
			tag: 'message',
			attrs: {
				id,
				to,
				type: messageType(message),
				phash: participantHash([...mine, ...others].map((d) => d.jid)),
			},
			content,
		}
	}

	// ---- groups --------------------------------------------------------------------------------

	/** Participant JIDs and addressing mode of a group. */
	async groupParticipants(
		group: string,
	): Promise<{ participants: string[]; addressingMode: string }> {
		const res = await this.d.receiver.request({
			tag: 'iq',
			attrs: { type: 'get', xmlns: 'w:g2', to: group },
			content: [{ tag: 'query', attrs: { request: 'interactive' } }],
		})
		const g = children(res, 'group')[0]
		if (!g) throw new Error(`no group metadata for ${group}`)
		return {
			participants: children(g, 'participant')
				.map((p) => p.attrs['jid'] ?? '')
				.filter(Boolean),
			addressingMode: g.attrs['addressing_mode'] ?? 'lid',
		}
	}

	async #groupStanza(
		id: string,
		group: string,
		message: Record<string, unknown>,
	): Promise<BinaryNode> {
		const { creds } = this.d
		const { participants, addressingMode } = await this.groupParticipants(group)
		const devices = await this.getDevices(participants)
		const senderId = addressingMode === 'lid' && creds.me?.lid ? creds.me.lid : creds.me!.id
		const senderKeyId = signalAddressString(senderId)

		const skdm = await this.d.cipher.createSenderKeyDistribution(group, senderKeyId)
		const skmsg = await this.d.cipher.groupEncrypt(
			group,
			senderKeyId,
			padRandomMax16(encodeProto('Message', message)),
		)

		const known = new Set(this.#memory[group] ?? [])
		const fresh = devices.filter((d) => !known.has(d.jid))
		const nodes: BinaryNode[] = []
		let needsIdentity = false
		if (fresh.length) {
			await this.assertSessions(fresh.map((d) => d.jid))
			const dist = padRandomMax16(
				encodeProto('Message', {
					senderKeyDistributionMessage: {
						groupId: group,
						axolotlSenderKeyDistributionMessage: skdm,
					},
				}),
			)
			for (const t of fresh) {
				const a = signalAddress(t.jid)
				const enc = await this.d.cipher.encrypt(a.name, a.device, dist)
				if (enc.type === 'pkmsg') needsIdentity = true
				nodes.push({
					tag: 'to',
					attrs: { jid: t.jid },
					content: [{ tag: 'enc', attrs: { v: '2', type: enc.type }, content: enc.ciphertext }],
				})
				known.add(t.jid)
			}
			this.#memory[group] = [...known]
			this.#saveMemory()
		}
		const content: BinaryNode[] = [{ tag: 'enc', attrs: { v: '2', type: 'skmsg' }, content: skmsg }]
		if (nodes.length) content.unshift({ tag: 'participants', attrs: {}, content: nodes })
		if (needsIdentity && creds.account)
			content.push({ tag: 'device-identity', attrs: {}, content: creds.account })
		return {
			tag: 'message',
			attrs: { id, to: group, type: messageType(message), addressing_mode: addressingMode },
			content,
		}
	}

	#saveMemory(): void {
		const path = this.d.senderKeyMemoryPath
		if (!path) return
		mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
		writeFileSync(`${path}.tmp`, JSON.stringify(this.#memory), { mode: 0o600 })
		renameSync(`${path}.tmp`, path)
	}
}

function messageType(message: Record<string, unknown>): string {
	if (message['reactionMessage']) return 'reaction'
	if (
		['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].some(
			(k) => message[k],
		)
	)
		return 'media'
	return 'text'
}

function parseBundle(user: BinaryNode) {
	const bytes = (n: BinaryNode | undefined, tag: string): Uint8Array | undefined => {
		const c = n && children(n, tag)[0]?.content
		return c instanceof Uint8Array ? c : undefined
	}
	const uint = (b: Uint8Array | undefined): number =>
		b ? b.reduce((acc, x) => acc * 256 + x, 0) : NaN
	const skey = children(user, 'skey')[0]
	const key = children(user, 'key')[0]
	const identityKey = bytes(user, 'identity')
	const signedPreKeyPublic = bytes(skey, 'value')
	const signedPreKeySignature = bytes(skey, 'signature')
	if (!identityKey || !signedPreKeyPublic || !signedPreKeySignature)
		throw new Error('incomplete pre-key bundle')
	const { device } = jidDecode(user.attrs['jid'] ?? '')
	return {
		registrationId: uint(bytes(user, 'registration')),
		deviceId: device,
		...(key && { preKeyId: uint(bytes(key, 'id')), preKeyPublic: bytes(key, 'value')! }),
		signedPreKeyId: uint(bytes(skey, 'id')),
		signedPreKeyPublic,
		signedPreKeySignature,
		identityKey,
	}
}
