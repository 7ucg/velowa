import { join } from 'node:path'
import { initAuthCreds, loadAuthCreds, saveAuthCreds } from '../auth/creds.js'
import type { AuthCreds } from '../auth/creds.js'
import { FileSignalStorage } from '../auth/file-signal-storage.js'
import type { BinaryNode } from '../codec/index.js'
import { createSignalCipher } from '../crypto/signal.js'
import { TypedEmitter } from '../events/emitter.js'
import { ProtocolLogger } from '../logging/protocol-logger.js'
import { Connection, loggedFetch } from './connection.js'
import {
	DEFAULT_CONFIG,
	handlePairSuccess,
	loginPayload,
	qrString,
	registrationPayload,
} from './pairing.js'
import type { ClientConfig } from './pairing.js'
import { Receiver } from './receiver.js'
import type { DecodedMessage } from './receiver.js'
import { Sender } from './sender.js'
import { AppStateSync, interpret } from './features/appstate-sync.js'
import type { AppStateEvent, ChatUpdate, ContactUpdate } from './features/appstate-sync.js'
import { Groups, parseGroupNotification } from './features/groups.js'
import type { GroupNotification } from './features/groups.js'
import * as media from './features/media.js'
import type { MediaOptions, MediaType } from './features/media.js'
import * as msg from './features/messages.js'
import type { ChatState, MessageKey, ReceiptType, TextOptions } from './features/messages.js'

export interface ClientOptions {
	/** Directory for credentials and Signal state. Default `./auth`. */
	authDir?: string
	/** Protocol logger; by default a new one that records everything under `./logs`. */
	logger?: ProtocolLogger
	/** Override the WhatsApp Web client version / browser identity. */
	config?: Partial<ClientConfig>
	/** Reconnect automatically after a drop (default true). */
	autoReconnect?: boolean
}

/** Everything a consumer can listen for. Payloads are plain data. */
export type ClientEvents = {
	/** A QR code to scan (Linked devices > Link a device). Refreshed until it is scanned. */
	qr: { qr: string }
	/** Pairing finished; the connection restarts with the new identity. */
	paired: { id: string; lid?: string }
	/** Logged in, pre-keys in place, ready to send and receive. */
	open: { id: string }
	/** Socket closed. */
	close: { code?: number; reason: string; willReconnect: boolean }
	/** A decrypted incoming message. */
	message: DecodedMessage
	/** Raw app-state change from the phone (mute, pin, archive, contact, settings, labels, ...). */
	'app-state': AppStateEvent
	/** A chat was muted / archived / pinned / read / deleted on another device. */
	'chat.update': ChatUpdate
	/** A contact's saved name changed. */
	'contact.update': ContactUpdate
	/** A group changed (members, subject, settings). */
	'group.update': GroupNotification
	/** Any server notification, parsed or not (account_sync, devices, picture, ...). */
	notification: { type: string; node: BinaryNode }
}

/**
 * The public entry point: connect, pair by QR, stay logged in, send and receive.
 *
 * ```ts
 * const client = new Client({ authDir: 'auth' })
 * client.on('qr', ({ qr }) => showQr(qr))
 * client.on('message', (m) => console.log(m.message))
 * await client.connect()
 * await client.sendText('4915...@s.whatsapp.net', 'hi')
 * ```
 */
export class Client {
	readonly logger: ProtocolLogger
	readonly #events = new TypedEmitter<ClientEvents>()
	readonly #credsPath: string
	readonly #signalDir: string
	readonly #options: ClientOptions
	#creds: AuthCreds
	#config: ClientConfig
	#conn: Connection | undefined
	#receiver: Receiver | undefined
	#sender: Sender | undefined
	#qrTimer: NodeJS.Timeout | undefined
	#keepAlive: NodeJS.Timeout | undefined
	#stopped = false
	#isOpen = false
	#mediaConn: media.MediaConn | undefined
	#appState: AppStateSync | undefined
	#ready: Promise<void> = Promise.resolve()

	constructor(options: ClientOptions = {}) {
		this.#options = options
		const dir = options.authDir ?? 'auth'
		this.#credsPath = join(dir, 'creds.json')
		this.#signalDir = join(dir, 'signal')
		this.logger = options.logger ?? new ProtocolLogger({ label: 'client' })
		this.#creds = loadAuthCreds(this.#credsPath) ?? initAuthCreds()
		saveAuthCreds(this.#credsPath, this.#creds)
		this.#config = { ...DEFAULT_CONFIG, ...options.config }
	}

	on = <K extends keyof ClientEvents>(event: K, listener: (p: ClientEvents[K]) => void) =>
		this.#events.on(event, listener)
	events = <K extends keyof ClientEvents>(event: K, signal?: AbortSignal) =>
		this.#events.events(event, signal)

	/** The paired identity, once linked. */
	get me() {
		return this.#creds.me
	}

	/** Connect (and pair if this device is not linked yet). Resolves when the socket is started. */
	async connect(): Promise<void> {
		this.#stopped = false
		if (!this.#options.config?.version) this.#config = await this.#resolveVersion()
		this.#start()
	}

	/** Resolves once logged in and ready. */
	ready(): Promise<void> {
		if (this.#isOpen) return Promise.resolve()
		return new Promise((resolve) => {
			const off = this.on('open', () => (off(), resolve()))
		})
	}

	async #live(): Promise<{ sender: Sender; receiver: Receiver; meId: string }> {
		await this.#ready
		if (!this.#sender || !this.#receiver || !this.#creds.me) throw new Error('not connected')
		return { sender: this.#sender, receiver: this.#receiver, meId: this.#creds.me.id }
	}

	/** Send text, optionally as a reply (`quoted`) and/or with @mentions. Returns the message id. */
	async sendText(to: string, text: string, opts: TextOptions = {}): Promise<string> {
		const { sender, meId } = await this.#live()
		return sender.sendMessage(to, msg.withContext(msg.textMessage(text), to, opts, meId))
	}

	/** Send a raw WAProto `Message` object. */
	async sendMessage(to: string, message: Record<string, unknown>): Promise<string> {
		const { sender } = await this.#live()
		return sender.sendMessage(to, message)
	}

	/** React to a message with an emoji (empty string removes the reaction). */
	async react(key: MessageKey, emoji: string): Promise<string> {
		const { sender } = await this.#live()
		const r = msg.reaction(key, emoji)
		return sender.sendMessage(key.remoteJid, r.message, r.opts)
	}

	/** Edit the text of one of our own messages. */
	async edit(key: MessageKey, newText: string): Promise<string> {
		const { sender } = await this.#live()
		const r = msg.edit(key, newText)
		return sender.sendMessage(key.remoteJid, r.message, r.opts)
	}

	/** Delete a message for everyone. */
	async revoke(key: MessageKey): Promise<string> {
		const { sender } = await this.#live()
		const r = msg.revoke(key)
		return sender.sendMessage(key.remoteJid, r.message, r.opts)
	}

	async #getMediaConn(): Promise<media.MediaConn> {
		const { receiver } = await this.#live()
		const c = this.#mediaConn
		if (c && Date.now() - c.fetchedAt < c.ttl * 1000) return c
		return (this.#mediaConn = media.parseMediaConn(
			await receiver.request(media.mediaConnRequest()),
		))
	}

	/** Encrypt, upload and send an image / video / audio / document / sticker. */
	async sendMedia(
		to: string,
		type: MediaType,
		data: Uint8Array,
		opts: MediaOptions & TextOptions = {},
	): Promise<string> {
		const { sender, meId } = await this.#live()
		const enc = media.encryptMedia(data, type)
		const uploaded = await media.uploadMedia(await this.#getMediaConn(), type, enc)
		const built = media.mediaMessage(type, enc, uploaded, opts)
		const message = msg.withContext(built.message, to, opts, meId)
		return sender.sendMessage(to, message, { encAttrs: { mediatype: built.mediaType } })
	}

	sendImage = (to: string, data: Uint8Array, opts: MediaOptions & TextOptions = {}) =>
		this.sendMedia(to, 'image', data, opts)
	sendVideo = (to: string, data: Uint8Array, opts: MediaOptions & TextOptions = {}) =>
		this.sendMedia(to, 'video', data, opts)
	sendAudio = (to: string, data: Uint8Array, opts: MediaOptions & TextOptions = {}) =>
		this.sendMedia(to, 'audio', data, opts)
	sendDocument = (to: string, data: Uint8Array, opts: MediaOptions & TextOptions = {}) =>
		this.sendMedia(to, 'document', data, opts)
	sendSticker = (to: string, data: Uint8Array, opts: MediaOptions & TextOptions = {}) =>
		this.sendMedia(to, 'sticker', data, opts)

	/** Download and decrypt the media of a received message (`event.message`). */
	async downloadMedia(message: Record<string, unknown>): Promise<Buffer> {
		const m = media.mediaOf(message)
		if (!m) throw new Error('message carries no downloadable media')
		return media.downloadMedia(m.ref, m.type)
	}

	/** Mark messages as read (`read-self` keeps read receipts private). */
	async markRead(keys: MessageKey[], type: ReceiptType = 'read'): Promise<void> {
		const { receiver } = await this.#live()
		for (const node of msg.buildReceipts(keys, type, Math.floor(Date.now() / 1000)))
			receiver.sendNode(node)
	}

	/** Show "typing…" / "recording…" / stop in a chat. */
	async sendChatState(to: string, state: ChatState): Promise<void> {
		const { receiver, meId } = await this.#live()
		const me = to.endsWith('@lid') && this.#creds.me?.lid ? this.#creds.me.lid : meId
		receiver.sendNode(msg.chatState(me, to, state))
	}

	/** Go online/offline. Needs the account's display name (`setName`). */
	async sendPresence(type: 'available' | 'unavailable'): Promise<void> {
		const { receiver } = await this.#live()
		const name = this.#creds.me?.name
		if (!name) throw new Error('set a display name first: client.setName(...)')
		receiver.sendNode(msg.presence(name, type))
	}

	/** Group management: `client.groups.create(...)`, `.updateParticipants(...)`, `.metadata(...)`, ... */
	readonly groups: Groups = new Groups(async (node) => (await this.#live()).receiver.request(node))

	/** Remember the account's display name (used for presence). */
	setName(name: string): void {
		if (!this.#creds.me) throw new Error('not paired')
		this.#creds.me.name = name
		saveAuthCreds(this.#credsPath, this.#creds)
	}

	/** Get presence updates for a contact. */
	async subscribePresence(jid: string): Promise<void> {
		const { receiver } = await this.#live()
		receiver.sendNode(msg.presenceSubscribe(jid, receiver.nextId()))
	}

	/** Close the connection and stop reconnecting. */
	close(reason = 'client-close'): void {
		this.#stopped = true
		this.#teardown()
		this.#conn?.close(reason)
		this.logger.close(reason)
	}

	// ---- internals -----------------------------------------------------------------------------

	async #resolveVersion(): Promise<ClientConfig> {
		try {
			const { body } = await loggedFetch(this.logger, 'https://web.whatsapp.com/sw.js')
			const rev = body.match(/\\?"client_revision\\?":\s*(\d+)/)?.[1]
			if (rev) {
				this.logger.event('version.resolved', { revision: rev })
				return { ...this.#config, version: [2, 3000, Number(rev)] }
			}
			this.logger.event('version.fallback', { reason: 'no client_revision in sw.js' })
		} catch (error) {
			this.logger.event('version.fallback', { reason: 'fetch failed', error })
		}
		return this.#config
	}

	#teardown(): void {
		clearTimeout(this.#qrTimer)
		clearInterval(this.#keepAlive)
		this.#receiver = undefined
		this.#sender = undefined
		this.#appState = undefined
		this.#isOpen = false
	}

	#start(): void {
		const paired = Boolean(this.#creds.me)
		const payload = paired
			? loginPayload(this.#creds, this.#config)
			: registrationPayload(this.#creds, this.#config)
		this.logger.event('client.start', {
			mode: paired ? 'login' : 'register',
			version: this.#config.version,
			me: this.#creds.me,
		})
		const conn: Connection = new Connection(this.logger, this.#creds, payload, {
			onOpen: () => {},
			onNode: (node) => this.#handle(conn, node),
			onClose: ({ code, reason }) => {
				this.#teardown()
				const willReconnect =
					!this.#stopped &&
					(this.#options.autoReconnect ?? true) &&
					Boolean(this.#creds.me) &&
					reason !== 'logged-out'
				this.#events.emit('close', { ...(code !== undefined && { code }), reason, willReconnect })
				if (willReconnect) setTimeout(() => !this.#stopped && this.#start(), 1000)
				else this.logger.close('disconnect', { code, reason })
			},
		})
		this.#conn = conn
		conn.connect()
	}

	#handle(conn: Connection, node: BinaryNode): void {
		if (this.#receiver?.handle(node)) return
		const child = (tag: string) =>
			Array.isArray(node.content) ? node.content.find((c) => c.tag === tag) : undefined

		const dirty = node.tag === 'ib' ? child('dirty') : undefined
		if (dirty) {
			if (dirty.attrs['type'] === 'account_sync') void this.#appState?.sync()
			// Tell the server we handled the dirty bit so it does not repeat it.
			conn.send({
				tag: 'iq',
				attrs: {
					to: 's.whatsapp.net',
					type: 'set',
					xmlns: 'urn:xmpp:whatsapp:dirty',
					id: this.#receiver?.nextId() ?? 'dirty',
				},
				content: [
					{
						tag: 'clean',
						attrs: {
							type: dirty.attrs['type'] ?? '',
							...(dirty.attrs['timestamp'] && { timestamp: dirty.attrs['timestamp'] }),
						},
					},
				],
			})
			return
		}
		const pairDevice = node.tag === 'iq' && child('pair-device')
		if (pairDevice) {
			conn.send({
				tag: 'iq',
				attrs: { to: 's.whatsapp.net', type: 'result', id: node.attrs['id'] ?? '' },
			})
			const refs = (pairDevice.content as BinaryNode[]).filter((c) => c.tag === 'ref')
			let ms = 60_000
			const next = () => {
				const ref = refs.shift()
				if (!ref) {
					this.logger.event('qr.exhausted')
					conn.close('qr-timeout')
					return
				}
				const qr = qrString(Buffer.from(ref.content as Uint8Array).toString('utf8'), this.#creds)
				this.logger.event('qr.generated', { qr })
				this.#events.emit('qr', { qr })
				this.#qrTimer = setTimeout(next, ms)
				ms = 20_000
			}
			next()
			return
		}
		if (node.tag === 'iq' && child('pair-success')) {
			clearTimeout(this.#qrTimer)
			try {
				const { reply, update } = handlePairSuccess(node, this.#creds)
				this.#creds = { ...this.#creds, ...update }
				saveAuthCreds(this.#credsPath, this.#creds)
				this.logger.event('pair.success', { me: this.#creds.me, platform: this.#creds.platform })
				this.#events.emit('paired', {
					id: this.#creds.me!.id,
					...(this.#creds.me!.lid && { lid: this.#creds.me!.lid }),
				})
				conn.send(reply)
			} catch (error) {
				this.logger.event('pair.error', error)
				conn.close('pair-verification-failed')
			}
			return
		}
		if (node.tag === 'success') {
			this.#ready = this.#onLoggedIn(conn)
			return
		}
		if (
			node.tag === 'iq' &&
			node.attrs['type'] === 'get' &&
			node.attrs['xmlns'] === 'urn:xmpp:ping'
		) {
			conn.send({
				tag: 'iq',
				attrs: { to: 's.whatsapp.net', type: 'result', id: node.attrs['id'] ?? '' },
			})
		}
	}

	#onAppState(e: AppStateEvent): void {
		this.#events.emit('app-state', e)
		const i = interpret(e)
		if (i.chat) this.#events.emit('chat.update', i.chat)
		if (i.contact) this.#events.emit('contact.update', i.contact)
		if (i.pushName && this.#creds.me && this.#creds.me.name !== i.pushName) {
			this.#creds.me.name = i.pushName
			saveAuthCreds(this.#credsPath, this.#creds)
		}
	}

	async #onLoggedIn(conn: Connection): Promise<void> {
		const creds = this.#creds
		const storage = new FileSignalStorage(
			this.#signalDir,
			creds.signedIdentityKey,
			creds.registrationId,
		)
		await storage.storeSignedPreKey(creds.signedPreKey.keyId, creds.signedPreKey.record)
		const cipher = createSignalCipher(storage)
		const receiver = new Receiver({
			creds,
			saveCreds: () => saveAuthCreds(this.#credsPath, creds),
			storage,
			cipher,
			logger: this.logger,
			send: (n) => conn.send(n),
			onMessage: (m) => this.#events.emit('message', m),
			onAppStateKeys: (keys) => {
				this.#appState?.addKeys(keys)
				void this.#appState?.sync()
			},
			onNotification: (node) => {
				const type = node.attrs['type'] ?? ''
				this.#events.emit('notification', { type, node })
				if (type === 'w:gp2')
					for (const n of parseGroupNotification(node)) this.#events.emit('group.update', n)
				if (type === 'server_sync') {
					const names = (Array.isArray(node.content) ? node.content : [])
						.filter((c) => c.tag === 'collection')
						.map((c) => c.attrs['name'] ?? '')
						.filter(Boolean)
					void this.#appState?.sync(names)
				}
			},
		})
		this.#receiver = receiver
		this.#appState = new AppStateSync({
			dir: join(this.#signalDir, '..', 'app-state'),
			request: (n) => receiver.request(n),
			logger: this.logger,
			onEvent: (e) => this.#onAppState(e),
		})
		this.#sender = new Sender({
			creds,
			storage,
			cipher,
			receiver,
			logger: this.logger,
			senderKeyMemoryPath: join(this.#signalDir, 'sender-key-memory.json'),
		})
		try {
			await receiver.request({
				tag: 'iq',
				attrs: { to: 's.whatsapp.net', type: 'set', xmlns: 'passive' },
				content: [{ tag: 'active', attrs: {} }],
			})
			await receiver.ensurePreKeys()
			if (this.#appState.keyCount > 0) void this.#appState.sync()
		} catch (error) {
			this.logger.event('login.setup-failed', error)
		}
		this.#keepAlive = setInterval(() => {
			if (conn.state === 'open')
				conn.send({
					tag: 'iq',
					attrs: { id: receiver.nextId(), to: 's.whatsapp.net', type: 'get', xmlns: 'w:p' },
				})
		}, 30_000)
		this.#isOpen = true
		this.#events.emit('open', { id: creds.me!.id })
	}
}
