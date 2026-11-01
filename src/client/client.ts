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

	async sendText(to: string, text: string): Promise<string> {
		await this.#ready
		if (!this.#sender) throw new Error('not connected')
		return this.#sender.sendText(to, text)
	}

	async sendMessage(to: string, message: Record<string, unknown>): Promise<string> {
		await this.#ready
		if (!this.#sender) throw new Error('not connected')
		return this.#sender.sendMessage(to, message)
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
		})
		this.#receiver = receiver
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
