// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import WebSocket from 'ws'
import type { AuthCreds } from '../auth/creds.js'
import { decodeNode, encodeNode } from '../codec/index.js'
import type { BinaryNode } from '../codec/index.js'
import {
	FrameDecoder,
	NoiseTransport,
	connHeader,
	encodeFrame,
	startXxHandshake,
} from '../crypto/noise.js'
import type { NoiseXxHandshake } from '../crypto/noise.js'
import { ensureWasm } from '../wasm-init.js'
import type { ProtocolLogger } from '../logging/protocol-logger.js'

export const WA_WS_URL = 'wss://web.whatsapp.com/ws/chat'
export const WA_ORIGIN = 'https://web.whatsapp.com'
const USER_AGENT =
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export interface ConnectionEvents {
	onNode(node: BinaryNode): void
	onOpen(): void
	onClose(info: { code?: number; reason: string; error?: unknown }): void
}

/** Logged HTTP GET (everything: request headers, status, response headers, body). */
export async function loggedFetch(
	logger: ProtocolLogger,
	url: string,
	headers: Record<string, string> = {},
) {
	const started = Date.now()
	try {
		const res = await fetch(url, {
			headers: { 'user-agent': USER_AGENT, 'sec-fetch-site': 'none', ...headers },
		})
		const body = await res.text()
		logger.http({
			method: 'GET',
			url,
			requestHeaders: { 'user-agent': USER_AGENT, 'sec-fetch-site': 'none', ...headers },
			status: res.status,
			responseHeaders: Object.fromEntries(res.headers.entries()),
			body,
			ms: Date.now() - started,
		})
		return { status: res.status, body }
	} catch (error) {
		logger.http({ method: 'GET', url, error, ms: Date.now() - started })
		throw error
	}
}

/**
 * One WebSocket connection: Noise XX handshake, then encrypted stanzas. Everything on the wire is
 * handed to the logger, in both directions, until the socket closes.
 */
export class Connection {
	#ws: WebSocket | undefined
	#state: 'idle' | 'handshake' | 'open' | 'closed' = 'idle'
	#hs: NoiseXxHandshake | undefined
	#transport: NoiseTransport | undefined
	readonly #decoder: FrameDecoder
	#firstFrameSent = false

	constructor(
		private readonly logger: ProtocolLogger,
		private readonly creds: AuthCreds,
		private readonly clientPayload: Uint8Array,
		private readonly events: ConnectionEvents,
		private readonly url = WA_WS_URL,
	) {
		ensureWasm()
		this.#decoder = new FrameDecoder()
	}

	get state() {
		return this.#state
	}

	connect(): void {
		const headers = { Origin: WA_ORIGIN, 'User-Agent': USER_AGENT }
		this.logger.event('ws.connect', { url: this.url, headers })
		const ws = new WebSocket(this.url, { headers, handshakeTimeout: 20_000 })
		this.#ws = ws
		this.#state = 'handshake'

		ws.on('upgrade', (res) =>
			this.logger.event('ws.upgrade', {
				status: res.statusCode,
				statusMessage: res.statusMessage,
				headers: res.headers,
			}),
		)
		ws.on('unexpected-response', (_req, res) => {
			this.logger.event('ws.unexpected-response', { status: res.statusCode, headers: res.headers })
		})
		ws.on('ping', (d) => this.logger.event('ws.ping', { hex: d.toString('hex') }))
		ws.on('pong', (d) => this.logger.event('ws.pong', { hex: d.toString('hex') }))
		ws.on('error', (error) => {
			this.logger.event('ws.error', error)
			this.#finish('error', undefined, error)
		})
		ws.on('close', (code, reason) => this.#finish(reason.toString() || 'closed', code))
		ws.on('open', () => {
			this.logger.event('ws.open')
			try {
				this.#hs = startXxHandshake(
					this.creds.noiseKey.privateKey,
					this.creds.noiseKey.publicKey,
					this.clientPayload,
				)
				const hello = this.#hs.buildClientHello()
				this.logger.event('noise.client-hello', { length: hello.length })
				this.#sendRaw(encodeFrame(hello, connHeader()), 'client-hello (with conn header)')
				this.#firstFrameSent = true
			} catch (error) {
				this.logger.event('noise.error', error)
				this.#finish('handshake-start-failed', undefined, error)
			}
		})
		ws.on('message', (data) => {
			const bytes = new Uint8Array(Buffer.isBuffer(data) ? data : Buffer.concat(data as Buffer[]))
			this.logger.frame('recv', bytes)
			this.#decoder.feed(bytes)
			try {
				for (let frame = this.#decoder.nextFrame(); frame; frame = this.#decoder.nextFrame())
					this.#onFrame(frame)
			} catch (error) {
				this.logger.event('frame.error', error)
				this.#finish('protocol-error', undefined, error)
			}
		})
	}

	#onFrame(frame: Uint8Array): void {
		if (this.#state === 'handshake') {
			const hs = this.#hs!
			const finish = hs.readServerHelloAndBuildClientFinish(frame)
			this.logger.event('noise.server-hello-verified', { clientFinishLength: finish.length })
			this.#sendRaw(encodeFrame(finish, undefined), 'client-finish')
			this.#transport = hs.finish()
			this.#hs = undefined
			this.#state = 'open'
			this.logger.event('noise.handshake-complete')
			this.events.onOpen()
			return
		}
		const plain = this.#transport!.decrypt(frame)
		this.logger.frame('recv', plain, 'decrypted stanza (WABinary payload)')
		const node = decodeNode(plain)
		this.logger.node('recv', node)
		this.events.onNode(node)
	}

	/** Encrypt and send a stanza. */
	send(node: BinaryNode): void {
		if (this.#state !== 'open') throw new Error(`cannot send in state ${this.#state}`)
		this.logger.node('send', node)
		const plain = encodeNode(node)
		this.logger.frame('send', plain, 'plaintext stanza before encryption (WABinary payload)')
		const cipher = this.#transport!.encrypt(plain)
		this.#sendRaw(encodeFrame(cipher, undefined), `stanza <${node.tag}>`)
	}

	close(reason = 'client-close'): void {
		this.logger.event('ws.close-requested', { reason })
		this.#ws?.close(1000, reason)
	}

	#sendRaw(bytes: Uint8Array, note: string): void {
		this.logger.frame('send', bytes, note)
		this.#ws?.send(bytes)
	}

	#finish(reason: string, code?: number, error?: unknown): void {
		if (this.#state === 'closed') return
		this.#state = 'closed'
		this.logger.event('connection.closed', {
			reason,
			code,
			error,
			firstFrameSent: this.#firstFrameSent,
		})
		this.events.onClose({
			...(code !== undefined && { code }),
			reason,
			...(error !== undefined && { error }),
		})
	}
}
