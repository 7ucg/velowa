// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { rmSync } from 'node:fs'
import {
	sendContent,
	toBytes,
	type MediaSource,
	type MessageContent,
	type SendContentOptions,
} from './features/message/send-content.js'
import { resolveCallFiles, type CallFileOptions } from './features/call/media-files.js'
import type { LocalAudioOptions } from './features/call/local-audio.js'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { initAuthCreds, loadAuthCreds, saveAuthCreds } from '../auth/creds.js'
import type { AuthCreds } from '../auth/creds.js'
import { FileSignalStorage } from '../auth/file-signal-storage.js'
import type { BinaryNode } from '../codec/index.js'
import { createSignalCipher, newSignedPreKey } from '../crypto/signal.js'
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
import { AntiBan } from './antiban.js'
import type { AntiBanConfig } from './antiban.js'
import { Sender, generateMessageId } from './sender.js'
import type { SendOptions } from './sender.js'
import { AppStateSync, interpret } from './features/chat/appstate-sync.js'
import * as act from './features/chat/chat-actions.js'
import type { RangeMessage } from './features/chat/chat-actions.js'
import type { AppStateEvent, ChatUpdate, ContactUpdate } from './features/chat/appstate-sync.js'
import * as contacts from './features/contact/contacts.js'
import * as callEvents from './features/call/call-events.js'
import * as extras from './features/message/extras.js'
import * as interactiveMsg from './features/message/interactive.js'
import { parsePresence, parseReceipt } from './features/message/events.js'
import type { PresenceEvent, ReceiptEvent } from './features/message/events.js'
import * as business from './features/contact/business.js'
import { Communities } from './features/community/communities.js'
import { LidMap } from './lid-map.js'
import {
	companionFinish,
	companionHello,
	generatePairingCode,
} from './features/account/pairing-code.js'
import {
	Groups,
	memberLabelMessage,
	parseGroupNotification,
	setGroupProperty,
} from './features/group/groups.js'
import { loadHistory } from './features/chat/history.js'
import type { HistoryChunk } from './features/chat/history.js'
import { mexFor, type MexFn } from './features/mex.js'
import { fetchLinkPreview, linkPreviewMessage } from './features/message/link-preview.js'
import { Newsletters, parseChannelStatus } from './features/channel/newsletters.js'
import type { ChannelStatusEvent } from './features/channel/newsletters.js'
import { Usernames } from './features/contact/username.js'
import { Account, removeDeviceNode } from './features/account/account.js'
import {
	decodeMediaRetryNode,
	decryptMediaRetry,
	mediaRetryRequest,
	type MediaRetryResult,
} from './features/message/media-retry.js'
import { TcTokens } from './features/contact/tctoken.js'
import { commentMessage } from './features/message/comment.js'
import {
	eventMessage,
	eventResponse,
	type EventOptions,
	type EventResponseType,
} from './features/message/event-message.js'
import {
	createStickerPackZip,
	newPackId,
	type StickerInput,
} from './features/message/sticker-pack.js'
import { listBots, type BotDirectory } from './features/contact/bots.js'
import {
	rotateSignedPreKeyNode,
	SIGNED_PRE_KEY_INTERVAL_MS,
	SIGNED_PRE_KEY_RETENTION,
} from './features/contact/prekey-rotation.js'
import { ServerInfo } from './features/account/server.js'
import { Business } from './features/business/manage.js'
import { Events, WwwClient } from './features/event/events.js'
import { Privacy } from './features/contact/privacy.js'
import type { GroupNotification } from './features/group/groups.js'
import * as media from './features/message/media.js'
import type { MediaOptions, MediaType } from './features/message/media.js'
import * as msg from './features/message/messages.js'
import { MediaSession } from './features/call/call-media.js'
import {
	GroupSession,
	buildGroupEncRekey,
	buildGroupOffer,
	ensureVoipWasm,
	parseGroupEncRekey,
} from '../voip-wasm.js'
import { encodeNode } from '../codec/index.js'
import * as callSig from './features/call/calls.js'
import * as buttons from './features/message/buttons.js'
import { richResponse } from './features/message/rich-response.js'
import type { RichResponseOptions } from './features/message/rich-response.js'
import * as report from './features/report/report.js'
import * as payments from './features/payment/payments.js'
import { encodeWam } from '../wam/index.js'
import type { WamEvent } from '../wam/index.js'
import { protoType } from './proto.js'
import type {
	ChatState,
	MessageKey,
	ReceiptType,
	TextOptions,
} from './features/message/messages.js'

/** The text a message carries (or its type), used to spot identical messages. */
function signatureOf(m: Record<string, unknown>): string {
	const field = Object.keys(m).find((k) => k !== 'messageContextInfo') ?? ''
	const body = m[field]
	if (typeof body === 'string') return `${field}:${body}`
	const b = (body ?? {}) as Record<string, unknown>
	const text = b['text'] ?? b['caption'] ?? b['name']
	return `${field}:${typeof text === 'string' ? text : ''}`
}

export interface ClientOptions {
	/** Directory for credentials and Signal state. Default `./auth`. */
	authDir?: string
	/** Protocol logger; by default a new one that records everything under `./logs`. */
	logger?: ProtocolLogger
	/** Override the WhatsApp Web client version / browser identity. */
	config?: Partial<ClientConfig>
	/** Link with a pairing code instead of a QR: the phone number (digits, with country code) of the account. */
	pairWithPhoneNumber?: string
	/** Reconnect automatically after a drop (default true). */
	autoReconnect?: boolean
	/**
	 * Throttle outgoing messages like a person would (rate caps, random gaps, a pause before new chats, a limit on
	 * identical texts). `true` for the defaults, or your own limits. Off by default.
	 */
	antiban?: boolean | Partial<AntiBanConfig>
	/**
	 * Heal by itself (default true): a message that stays unreadable after the sender's retries is asked for again
	 * from the phone (arrives as `message.resent`), and `downloadMedia` with a key asks the phone to upload expired
	 * media again. Turn it off to handle `message.undecryptable` yourself.
	 */
	autoRecover?: boolean
}

/**
 * The connection in one event: where it is (`state`) and what just happened. `qr` and `pairingCode` appear while
 * the account is being linked, `newLogin` once it was, `reason` / `code` / `willReconnect` / `loggedOut` on a close.
 */
export interface ConnectionUpdate {
	state: 'connecting' | 'open' | 'close'
	qr?: string
	pairingCode?: string
	newLogin?: boolean
	/** `close` only. */
	reason?: string
	code?: number
	willReconnect?: boolean
	/** The account was logged out on the phone: delete the auth folder and link again. */
	loggedOut?: boolean
}

/** Everything a consumer can listen for. Payloads are plain data. */
export type ClientEvents = {
	/** Connection state changes, QR codes and pairing codes in one place (the individual events below still fire). */
	connection: ConnectionUpdate
	/** A QR code to scan (Linked devices > Link a device). Refreshed until it is scanned. */
	qr: { qr: string }
	/** The 8-character code to type into WhatsApp > Linked devices > Link with phone number (pairing-code mode). */
	'pairing-code': { code: string }
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
	/** Delivery / read / played receipts for messages we sent. */
	receipt: ReceiptEvent
	/** Online/offline and typing indicators (after `subscribePresence`, or in open chats). */
	presence: PresenceEvent
	/** An incoming (or ended) call. Decline with `rejectCall`. */
	call: callEvents.CallEvent
	/** A channel status (or a reaction / edit / revoke of one) pushed by the server. */
	'channel.status': ChannelStatusEvent
	/** A chunk of chat history announced by the phone after linking (chats, messages, push names). */
	history: HistoryChunk
	/** A message could not be decrypted and the sender's retries ran out (before any automatic request to the phone). */
	'message.undecryptable': { key: MessageKey }
	/** A message the phone sent again after `requestPlaceholderResend` (the key, the content and the time). */
	'message.resent': { key: MessageKey; message: Record<string, unknown>; timestamp?: number }
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
export interface GroupSummary {
	applied: string
	transaction_id: number
	media: string
	rekey_requested: boolean
	rekey_owed: boolean
	has_relay: boolean
	relay_endpoint?: [string, number]
	epoch_recipients: string[]
	members: string[]
	participants: unknown
}

export class Client {
	readonly logger: ProtocolLogger
	readonly #events = new TypedEmitter<ClientEvents>()
	readonly #credsPath: string
	readonly #signalDir: string
	readonly #tcTokens: TcTokens
	readonly #autoRecover: boolean
	#recoverTimes: number[] = []
	#signalStorage: FileSignalStorage | undefined
	#rotating: Promise<number> | undefined
	#serverOffsetMs = 0
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
	#pairing: { phone: string; code: string } | undefined
	#ready: Promise<void> = Promise.resolve()

	constructor(options: ClientOptions = {}) {
		this.#options = options
		const dir = options.authDir ?? 'auth'
		this.#credsPath = join(dir, 'creds.json')
		this.#signalDir = join(dir, 'signal')
		this.#autoRecover = options.autoRecover !== false
		this.#tcTokens = new TcTokens(join(dir, 'signal', 'tctokens.json'))
		this.logger = options.logger ?? new ProtocolLogger({ label: 'client' })
		this.#creds = loadAuthCreds(this.#credsPath) ?? initAuthCreds()
		saveAuthCreds(this.#credsPath, this.#creds)
		this.#config = { ...DEFAULT_CONFIG, ...options.config }
		if (options.antiban) this.antiban = new AntiBan(options.antiban === true ? {} : options.antiban)
	}

	/** The outgoing-message limiter, when the `antiban` option is on. */
	readonly antiban?: AntiBan

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
		if (this.antiban?.config.typing && !to.endsWith('@newsletter')) {
			await this.sendChatState(to, 'composing').catch(() => undefined)
			await new Promise((r) => setTimeout(r, this.antiban!.typingMs(text)))
			await this.sendChatState(to, 'paused').catch(() => undefined)
		}
		let body = msg.textMessage(text)
		if (opts.linkPreview) {
			const p =
				opts.linkPreview === true
					? await fetchLinkPreview(text).catch(() => undefined)
					: opts.linkPreview
			if (p) body = linkPreviewMessage(text, p)
		}
		return sender.sendMessage(to, msg.withContext(body, to, opts, meId))
	}

	/** Forward a received message (its WAProto content) to another chat. */
	async forwardMessage(to: string, message: Record<string, unknown>, score = 1): Promise<string> {
		return this.sendMessage(to, msg.forward(message, score))
	}

	/**
	 * Send anything with one call: `client.send(jid, { text: 'hi' })`, `{ image }`, `{ video }`, `{ audio, voiceNote }`,
	 * `{ document, mimetype }`, `{ sticker }`, `{ poll }`, `{ location }`, `{ contacts }`, `{ react }`, `{ edit, text }`,
	 * `{ revoke }`, `{ forward }`, `{ text, buttons }`, `{ text, sections, buttonText }`. Media can be bytes, a file
	 * path or URL (`{ url }`) or a stream. Returns the message id.
	 */
	send = (to: string, content: MessageContent, options?: SendContentOptions): Promise<string> =>
		sendContent(this, to, content, options)

	/** Send a raw stanza (an `iq`) and wait for its answer: the escape hatch for anything not wrapped yet. */
	request = async (node: BinaryNode): Promise<BinaryNode> =>
		(await this.#live()).receiver.request(node)

	/** Send a raw stanza as-is, with no `id` added and no answer awaited (for stanzas such as `chatstate` and `ib`). */
	sendNode = async (node: BinaryNode): Promise<void> => {
		;(await this.#live()).receiver.sendNode(node)
	}

	/** Run any WhatsApp Web GraphQL (`w:mex`) query by id, e.g. the ones listed in baron-baileys-v2. */
	mex = <T = unknown>(queryId: string, variables: unknown, dataPath?: string): Promise<T> =>
		mexFor(
			async (n) => (await this.#live()).receiver.request(n),
			() => `mex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
		)<T>(queryId, variables, dataPath)

	/** Send a raw WAProto `Message` object. */
	async sendMessage(
		to: string,
		message: Record<string, unknown>,
		opts: SendOptions = {},
	): Promise<string> {
		const { sender } = await this.#live()
		return sender.sendMessage(to, message, opts)
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
		// Channels are not end-to-end encrypted: the file goes up as is and the message has no media key.
		const channel = to.endsWith('@newsletter')
		const enc = channel ? media.rawMedia(data) : media.encryptMedia(data, type)
		const uploaded = await media.uploadMedia(await this.#getMediaConn(), type, enc, fetch, channel)
		const built = media.mediaMessage(type, enc, uploaded, opts)
		if (channel) media.stripMediaKeys(built.message)
		if (opts.fields) {
			const key = Object.keys(built.message)[0]!
			built.message[key] = { ...(built.message[key] as object), ...opts.fields }
		}
		// Videos get no server-made preview: the phone uploads its own thumbnail and points the message at it.
		if (channel && type === 'video' && !uploaded.thumbnail && opts.jpegThumbnail) {
			const raw = media.rawMedia(opts.jpegThumbnail)
			const t = await media.uploadMedia(
				await this.#getMediaConn(),
				'image',
				raw,
				fetch,
				true,
				media.NEWSLETTER_THUMBNAIL_PATH,
			)
			uploaded.thumbnail = { directPath: t.directPath, sha256: raw.fileSha256 }
		}
		if (uploaded.thumbnail && (type === 'image' || type === 'video')) {
			const body = built.message[Object.keys(built.message)[0]!] as Record<string, unknown>
			body['thumbnailDirectPath'] = uploaded.thumbnail.directPath
			body['thumbnailSha256'] = uploaded.thumbnail.sha256
		}
		let message = msg.withContext(built.message, to, opts, meId)
		if (opts.association)
			message = {
				...message,
				messageContextInfo: {
					...(message['messageContextInfo'] as object | undefined),
					messageAssociation: opts.association,
				},
			}
		const field = Object.keys(message).find((k) => k !== 'messageContextInfo')!
		const authorLid = (this.#creds.me?.lid ?? '').replace(/[:.]\d+@/, '@')
		const gsSource =
			type === 'audio'
				? 'AUDIO'
				: opts.contextInfo?.['statusSourceType'] === 'MUSIC_STANDALONE'
					? 'MUSIC_STANDALONE'
					: type === 'video'
						? 'VIDEO'
						: 'IMAGE'
		const extraContext = {
			...opts.contextInfo,
			...(opts.groupStatus && {
				...extras.groupStatusContext(
					authorLid,
					gsSource,
					(opts.contextInfo?.['statusAttributions'] as unknown[] | undefined) ?? [],
				),
			}),
			...(channel && { mediaDomainInfo: { mediaKeyDomain: 'MEDIA_KEY_DOMAIN_NON_E2EE' } }),
		}
		if (Object.keys(extraContext).length) {
			const body = message[field] as Record<string, unknown>
			message = {
				...message,
				[field]: { ...body, contextInfo: { ...(body['contextInfo'] as object), ...extraContext } },
			}
		}
		const wire = opts.viewOnce ? extras.viewOnce(message) : message
		const gs = opts.groupStatus ? extras.groupStatus(wire) : undefined
		const q = opts.isQuestion ? extras.question(wire) : undefined
		// Channel media carries its kind on the plaintext node, not on the stanza.
		let serverId: string | undefined
		const id = await sender.sendMessage(to, gs ? gs.message : q ? q.message : wire, {
			// Group statuses go out like text: no mediatype on the enc node.
			...(!gs && { encAttrs: { mediatype: built.mediaType } }),
			extraNodes: [
				...(gs?.opts.extraNodes ?? []),
				...(q?.opts.extraNodes ?? []),
				...(opts.extraNodes ?? []),
			],
			onAck: (ack) => (serverId = ack.attrs['server_id']),
		})
		if (channel && serverId && opts.labels?.aiContent)
			await this.newsletters.labelAiContent(to, serverId)
		if (channel && serverId && opts.labels?.paidPartnership)
			await this.newsletters.labelPaidPartnership(to, serverId)
		return id
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
	async downloadMedia(
		message: Record<string, unknown>,
		opts: { key?: MessageKey } = {},
	): Promise<Buffer> {
		const m = media.mediaOf(message)
		if (!m) throw new Error('message carries no downloadable media')
		try {
			return await media.downloadMedia(m.ref, m.type)
		} catch (e) {
			// 404 / 410: the file expired on the server. With the message key the phone can upload it again.
			const text = `${(e as Error).message} ${((e as Error).cause as Error | undefined)?.message ?? ''}`
			if (!this.#autoRecover || !opts.key || !/HTTP (404|410)\b/.test(text)) throw e
			const fresh = await this.updateMediaMessage(opts.key, message)
			const again = media.mediaOf(fresh)!
			return media.downloadMedia(again.ref, again.type)
		}
	}

	async #peerDataOperation(request: Record<string, unknown>): Promise<string> {
		const { sender } = await this.#live()
		return sender.sendPeerMessage({
			protocolMessage: {
				type: 'PEER_DATA_OPERATION_REQUEST_MESSAGE',
				peerDataOperationRequestMessage: request,
			},
		})
	}

	/**
	 * Send a sticker pack: WebP stickers (512x512, up to 60), a WebP cover and a JPEG thumbnail. The recipient
	 * can add the whole pack to their stickers.
	 */
	async sendStickerPack(
		to: string,
		pack: {
			name: string
			publisher: string
			stickers: StickerInput[]
			/** WebP cover (the pack's tray icon). */
			cover: Uint8Array
			/** JPEG preview shown in the chat. */
			thumbnail: Uint8Array
			packId?: string
			description?: string
			caption?: string
		},
	): Promise<string> {
		const { sender } = await this.#live()
		const packId = pack.packId ?? newPackId()
		const zip = createStickerPackZip(packId, pack.stickers, pack.cover)
		const mediaKey = randomBytes(32)
		const encZip = media.encryptMedia(zip.zip, 'sticker-pack', mediaKey)
		const encThumb = media.encryptMedia(pack.thumbnail, 'sticker-pack-thumbnail', mediaKey)
		const conn = await this.#getMediaConn()
		const [zipUp, thumbUp] = await Promise.all([
			media.uploadMedia(conn, 'document', encZip, fetch, false, '/mms/sticker-pack'),
			media.uploadMedia(conn, 'document', encThumb, fetch, false, '/mms/thumbnail-sticker-pack'),
		])
		return sender.sendMessage(to, {
			stickerPackMessage: {
				stickerPackId: packId,
				name: pack.name,
				publisher: pack.publisher,
				stickers: zip.stickers,
				fileLength: encZip.fileLength,
				fileSha256: encZip.fileSha256,
				fileEncSha256: encZip.fileEncSha256,
				mediaKey,
				directPath: zipUp.directPath,
				mediaKeyTimestamp: Math.floor(Date.now() / 1000),
				...(pack.caption !== undefined && { caption: pack.caption }),
				...(pack.description !== undefined && { packDescription: pack.description }),
				thumbnailDirectPath: thumbUp.directPath,
				thumbnailSha256: encThumb.fileSha256,
				thumbnailEncSha256: encThumb.fileEncSha256,
				stickerPackSize: zip.zip.length,
				trayIconFileName: zip.trayIconFileName,
			},
		})
	}

	/**
	 * Send an event card (invitation with name, time, place and an optional call link) to a chat or group.
	 * Guests answer it; their answers arrive as messages with an `eventResponse` field.
	 */
	async sendEvent(to: string, o: EventOptions): Promise<string> {
		const { sender } = await this.#live()
		return sender.sendMessage(to, eventMessage(o))
	}

	/**
	 * Comment on a post in a Community Announcement Group (an announcement under a community). `parent` is the post's
	 * key; it must have been received here (its secret is needed). Comments arrive as `addon` on the message.
	 */
	async sendComment(parent: MessageKey, text: string): Promise<string> {
		const { sender, receiver } = await this.#live()
		const secret = receiver.secretOf(parent.id)
		if (!secret) throw new Error('the secret of this post is unknown (it was not received here)')
		const me = this.#creds.me
		if (!me) throw new Error('not paired')
		const strip = (j: string) => j.replace(/:\d+@/, '@')
		const author = parent.participant ?? (parent.fromMe ? me.id : parent.remoteJid)
		return sender.sendMessage(
			parent.remoteJid,
			commentMessage(parent, text, {
				parentSenderJid: strip(author),
				modifierJid: strip(me.lid ?? me.id),
				secret,
			}),
		)
	}

	/**
	 * Answer an event card: going, not going or maybe. `key` is the card's key and `creator` who sent it
	 * (the card must have been seen by this client, because its secret is needed).
	 */
	async respondToEvent(
		key: MessageKey,
		creator: string,
		response: EventResponseType,
		extraGuestCount?: number,
	): Promise<string> {
		const { sender, receiver } = await this.#live()
		const secret = receiver.secretOf(key.id)
		if (!secret)
			throw new Error('the secret of this event is unknown (the card was not received here)')
		const me = this.#creds.me?.id
		if (!me) throw new Error('not paired')
		const strip = (j: string) => j.replace(/:\d+@/, '@')
		return sender.sendMessage(
			key.remoteJid,
			eventResponse(
				key,
				{ response, ...(extraGuestCount !== undefined && { extraGuestCount }) },
				{
					eventMsgId: key.id,
					eventCreatorJid: strip(creator),
					responderJid: strip(
						creator.endsWith('@lid') && this.#creds.me?.lid ? this.#creds.me.lid : me,
					),
					secret,
				},
			),
			{ encAttrs: { 'decrypt-fail': 'hide' } },
		)
	}

	/**
	 * Ask the phone for older messages of a chat, starting before `oldest` (the oldest message you have).
	 * The answer arrives as a `history` event.
	 */
	fetchMessageHistory = (count: number, oldest: MessageKey, oldestTimestampMs: number) =>
		this.#peerDataOperation({
			peerDataOperationRequestType: 'HISTORY_SYNC_ON_DEMAND',
			historySyncOnDemandRequest: {
				chatJid: oldest.remoteJid,
				oldestMsgFromMe: !!oldest.fromMe,
				oldestMsgId: oldest.id,
				oldestMsgTimestampMs: oldestTimestampMs,
				onDemandMsgCount: count,
			},
		})

	/**
	 * Ask the phone to send a message again that arrived undecryptable ("Waiting for this message").
	 * The answer arrives as a `message.resent` event.
	 */
	requestPlaceholderResend = (key: MessageKey) =>
		this.#peerDataOperation({
			peerDataOperationRequestType: 'PLACEHOLDER_MESSAGE_RESEND',
			placeholderMessageResendRequest: [{ messageKey: key }],
		})

	/**
	 * Ask the phone that sent a media message to upload it again (the file expired on WhatsApp's servers).
	 * Returns the message with the new `directPath`, ready for `downloadMedia`.
	 */
	async updateMediaMessage(
		key: MessageKey,
		message: Record<string, unknown>,
		timeoutMs = 30_000,
	): Promise<Record<string, unknown>> {
		const m = media.mediaOf(message)
		if (!m) throw new Error('message carries no media')
		const me = this.#creds.me
		if (!me) throw new Error('not paired')
		const ownUsers = new Set(
			[me.id, me.lid].filter((x): x is string => !!x).map((x) => x.split(/[:@]/)[0]!),
		)
		// Only an answer from the server or from our own account counts, about this very message, and a result
		// only counts when it decrypts with this message's media key: anything else is ignored, not trusted.
		const answer = new Promise<MediaRetryResult>((resolve, reject) => {
			const timer = setTimeout(() => (off(), reject(new Error('media retry timed out'))), timeoutMs)
			const off = this.on('notification', ({ type, node }) => {
				if (type !== 'mediaretry' || node.attrs['id'] !== key.id) return
				const from = node.attrs['from'] ?? ''
				if (from !== 's.whatsapp.net' && !ownUsers.has(from.split(/[:@]/)[0]!)) return
				const ev = decodeMediaRetryNode(node)
				if (
					!ev ||
					ev.key.remoteJid !== key.remoteJid ||
					!!ev.key.fromMe !== !!key.fromMe ||
					(ev.key.participant ?? '') !== (key.participant ?? '')
				)
					return
				if (ev.error) {
					clearTimeout(timer)
					off()
					reject(new Error(`media re-upload failed (${ev.error.code})`))
					return
				}
				if (!ev.media) return
				try {
					const r = decryptMediaRetry(ev.media, m.ref.mediaKey, key.id)
					clearTimeout(timer)
					off()
					resolve(r)
				} catch {
					/* not encrypted with this media key: not ours, keep waiting */
				}
			})
		})
		answer.catch(() => undefined)
		await this.#q(mediaRetryRequest(key, m.ref.mediaKey, me.lid ?? me.id))
		const r = await answer
		if (r.result !== 'SUCCESS' || !r.directPath)
			throw new Error(`media re-upload failed on the phone (${r.result})`)
		const field = Object.keys(message).find((k) => {
			const v = message[k]
			return typeof v === 'object' && v !== null && 'mediaKey' in v
		})!
		return {
			...message,
			[field]: {
				...(message[field] as object),
				directPath: r.directPath,
				url: `https://${media.MEDIA_HOST}${r.directPath}`,
			},
		}
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
		// WhatsApp Web, whatsapp-rust and Baileys announce the session before going online; without it the
		// server seems not to treat the device as active (typing indicators do not reach the other side).
		if (type === 'available') receiver.sendNode(msg.unifiedSession(this.serverTime()))
		receiver.sendNode(msg.presence(name, type))
	}

	/** Resolve once the phone has shared the app-state keys (needed for chat actions); false on timeout. */
	async waitForAppState(timeoutMs = 30_000): Promise<boolean> {
		const t0 = Date.now()
		while (Date.now() - t0 < timeoutMs) {
			if ((this.#appState?.keyCount ?? 0) > 0) return true
			await new Promise((r) => setTimeout(r, 500))
		}
		return false
	}

	/**
	 * Fetch the app-state collections again (chats, contacts, settings synced from the phone). With `fromScratch`
	 * the local copy is dropped first and the full state is downloaded; use it when chat actions stop sticking.
	 */
	async resyncAppState(
		collections?: readonly string[],
		o: { fromScratch?: boolean } = {},
	): Promise<void> {
		if (!this.#appState) throw new Error('not connected')
		if (o.fromScratch) this.#appState.reset(collections)
		await this.#appState.sync(collections)
	}

	/**
	 * Set the cover photo of a business profile: uploads the JPEG (unencrypted, to the profile-picture service) and
	 * points the profile at it. Returns the photo's id, which \`business.removeCoverPhoto\` takes.
	 */
	async setBusinessCoverPhoto(jpeg: Uint8Array): Promise<string> {
		const raw = media.rawMedia(jpeg)
		const conn = await this.#getMediaConn()
		const token = media.uploadToken(raw.fileSha256)
		let last: unknown
		for (const host of conn.hosts) {
			try {
				const res = await fetch(
					`https://${host}/pps/biz-cover-photo/${token}?auth=${encodeURIComponent(conn.auth)}&token=${token}`,
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/octet-stream',
							Origin: 'https://web.whatsapp.com',
						},
						body: new Uint8Array(raw.encrypted),
					},
				)
				const j = (await res.json().catch(() => undefined)) as
					{ fbid?: string | number; meta_hmac?: string; ts?: number | string } | undefined
				if (res.ok && j?.fbid !== undefined && j.meta_hmac && j.ts !== undefined) {
					const id = String(j.fbid)
					await this.business.setCoverPhoto({ id, token: j.meta_hmac, timestamp: Number(j.ts) })
					return id
				}
				last = new Error(`cover photo upload to ${host} failed (HTTP ${res.status})`)
			} catch (e) {
				last = e
			}
		}
		throw new Error('cover photo upload failed on all hosts', { cause: last })
	}

	/**
	 * Make a new signed pre-key and tell the server (WhatsApp Web does this about every four weeks, and so does
	 * this client after connecting). The old key stays on disk, so messages already on the way still decrypt.
	 * Returns the new key id.
	 */
	rotateSignedPreKey(): Promise<number> {
		// One rotation at a time: two overlapping ones would pick the same id and overwrite each other's key.
		this.#rotating ??= this.#rotateSignedPreKey().finally(() => (this.#rotating = undefined))
		return this.#rotating
	}

	async #rotateSignedPreKey(): Promise<number> {
		const { receiver } = await this.#live()
		const storage = this.#signalStorage
		if (!storage) throw new Error('not connected')
		const creds = this.#creds
		// The next id nobody holds a key for (ids wrap at 24 bits; an id that still has a record is skipped).
		let id = creds.signedPreKey.keyId
		for (let tries = 0; ; tries++) {
			id = id >= 0xffffff ? 1 : id + 1
			if (!(await storage.loadSignedPreKey(id))) break
			if (tries > 100) throw new Error('no free signed pre-key id')
		}
		const spk = newSignedPreKey(creds.signedIdentityKey.privateKey, id)
		await storage.storeSignedPreKey(id, spk.record)
		await receiver.request(rotateSignedPreKeyNode(id, spk.publicKey, spk.signature))
		const chain = [creds.signedPreKey.keyId, ...(creds.retiredSignedPreKeys ?? [])]
		creds.signedPreKey = {
			keyId: id,
			record: spk.record,
			publicKey: spk.publicKey,
			signature: spk.signature,
		}
		creds.signedPreKeyAt = Date.now()
		creds.retiredSignedPreKeys = chain.slice(0, SIGNED_PRE_KEY_RETENTION - 1)
		saveAuthCreds(this.#credsPath, creds)
		// The keys that fell out of the window: their private keys are destroyed now.
		for (const stale of chain.slice(SIGNED_PRE_KEY_RETENTION - 1))
			await storage.removeSignedPreKey(stale)
		return id
	}

	/** Server-side information: experiment flags, reachout timelock, the new-chat limit, passive mode. */
	readonly server: ServerInfo = new ServerInfo(
		(n) => this.#q(n),
		(queryId, variables, dataPath) => this.#mexCall(queryId, variables, dataPath),
	)

	/** The server's clock in unix seconds (our clock corrected by the offset seen at login). */
	serverTime = (): number => Math.floor((Date.now() + this.#serverOffsetMs) / 1000)

	/** The AI bots WhatsApp offers this account (Meta AI and others), by section. */
	listBots = async (): Promise<BotDirectory> => listBots((n) => this.#q(n))

	/** Group management: `client.groups.create(...)`, `.updateParticipants(...)`, `.metadata(...)`, ... */
	readonly groups: Groups = new Groups(
		async (node) => (await this.#live()).receiver.request(node),
		(queryId, variables, dataPath) => this.#mexCall(queryId, variables, dataPath),
	)

	async #push(p: act.PlannedMutation): Promise<void> {
		await this.#live()
		if (!this.#appState) throw new Error('not connected')
		await this.#appState.push(p.collection, [act.toOutgoing(p)])
	}

	/** Archive / unarchive a chat on all devices. */
	archiveChat = (jid: string, archived = true, last?: RangeMessage[]) =>
		this.#push(act.archive(jid, archived, last))
	/** Mute until the given unix-millisecond time (`-1` = forever), or `null` to unmute. */
	muteChat = (jid: string, untilMs: number | null) => this.#push(act.mute(jid, untilMs))
	pinChat = (jid: string, pinned = true) => this.#push(act.pin(jid, pinned))
	/** Lock a chat behind the phone's screen lock (or unlock it). */
	lockChat = (jid: string, locked = true) => this.#push(act.lockChat(jid, locked))
	/** The list of favourite chats: pass every JID that should be a favourite (an empty list clears it). */
	setFavorites = (jids: string[]) => this.#push(act.favorites(jids))
	/** Hide a contact's statuses (or show them again). */
	muteContactStatus = (jid: string, muted = true) => this.#push(act.muteStatus(jid, muted))
	/** Business quick replies ("/shortcut"): create or change one, or delete it with the timestamp it was made with. */
	setQuickReply = (q: Parameters<typeof act.quickReply>[0]) => this.#push(act.quickReply(q))
	/** Order of the labels in the list (numeric label ids). */
	reorderLabels = (ids: number[]) => this.#push(act.reorderLabels(ids))
	/** Settings of the whole account kept in app state: previews off, relay all calls, private processing. */
	setLinkPreviewsDisabled = (disabled = true) => this.#push(act.disableLinkPreviews(disabled))
	setRelayAllCalls = (enabled = true) => this.#push(act.relayAllCalls(enabled))
	setPrivateProcessing = (enabled = true) => this.#push(act.privateProcessing(enabled))
	/** Mark a chat read / unread on all devices. */
	markChatRead = (jid: string, read = true, last?: RangeMessage[]) =>
		this.#push(act.markRead(jid, read, last))
	starMessage = (key: MessageKey, starred = true) => this.#push(act.star(key, starred))
	deleteChat = (jid: string, last?: RangeMessage[]) => this.#push(act.deleteChat(jid, last))
	clearChat = (jid: string, last?: RangeMessage[]) => this.#push(act.clearChat(jid, last))
	deleteMessageForMe = (key: MessageKey, timestamp: number, deleteMedia = false) =>
		this.#push(act.deleteMessageForMe(key, timestamp, deleteMedia))
	/** Save a contact in the phone's address book, or remove it with `null`. */
	saveContact = (jid: string, c: { fullName?: string; firstName?: string } | null) =>
		this.#push(act.contact(jid, c))
	/** Change the account's display name (push name). */
	async updateProfileName(name: string): Promise<void> {
		await this.#push(act.pushName(name))
		this.setName(name)
	}
	addLabel = (l: Parameters<typeof act.addLabel>[0]) => this.#push(act.addLabel(l))
	labelChat = (jid: string, labelId: string, labeled = true) =>
		this.#push(act.labelChat(jid, labelId, labeled))
	labelMessage = (jid: string, labelId: string, messageId: string, labeled = true) =>
		this.#push(act.labelMessage(jid, labelId, messageId, labeled))
	/** Default disappearing-messages timer for a 1:1 chat, in seconds (0 = off). */
	setChatEphemeral = (jid: string, seconds: number) => this.#push(act.chatEphemeral(jid, seconds))

	/** Communities: create, link sub-groups, deactivate (members/settings: use `groups` with the community JID). */
	readonly communities: Communities = new Communities(
		async (node) => (await this.#live()).receiver.request(node),
		(queryId, variables, dataPath) => this.#mexCall(queryId, variables, dataPath),
		this.groups,
	)

	/** Channels: `client.newsletters.metadata('invite', code)`, `.follow(jid)`, ... (posting: `sendText(jid, ...)`). */
	readonly newsletters: Newsletters = new Newsletters(
		(queryId, variables, dataPath) =>
			mexFor(
				async (n) => (await this.#live()).receiver.request(n),
				() => `mex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
			)(queryId, variables, dataPath),
		async (n) => (await this.#live()).receiver.request(n),
		() => `nl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
	)

	/** Usernames: `client.usernames.check('name')`, `.set(...)`, `.mine()`. */
	readonly usernames: Usernames = new Usernames((queryId, variables, dataPath) =>
		mexFor(
			async (n) => (await this.#live()).receiver.request(n),
			() => `mex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
		)(queryId, variables, dataPath),
	)

	#mexCall: MexFn = (queryId, variables, dataPath) =>
		mexFor(
			async (n) => (await this.#live()).receiver.request(n),
			() => `mex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
		)(queryId, variables, dataPath)

	/** The account: `client.account.trustedDevices()`, `.removeDevice(jid)`, linked profiles. See also `logout()`. */
	readonly account: Account = new Account(
		(n) => this.#q(n),
		(queryId, variables, dataPath) => this.#mexCall(queryId, variables, dataPath),
	)

	/** More privacy: settings by feature, allow / block lists, text status, who is online, reminders, push settings. */
	readonly privacy: Privacy = new Privacy(
		(n) => this.#q(n),
		(queryId, variables, dataPath) => this.#mexCall(queryId, variables, dataPath),
	)

	/** Run a business: products, catalog and collections, broadcast lists and their quota. */
	readonly business: Business = new Business(
		(n) => this.#q(n),
		(queryId, variables, dataPath) => this.#mexCall(queryId, variables, dataPath),
	)

	/** Calendar events (Termine): create, list, update, RSVP, invite, invite link. Uses WhatsApp's HTTP GraphQL. */
	readonly #www = new WwwClient((queryId, variables, dataPath) =>
		this.#mexCall(queryId, variables, dataPath),
	)
	readonly calendar: Events = new Events(this.#www)

	#q = async (node: BinaryNode) => (await this.#live()).receiver.request(node)
	#sid = async () => (await this.#live()).receiver.nextId()

	/** Which phone numbers are registered on WhatsApp? */
	async onWhatsApp(...numbers: string[]) {
		return contacts.onWhatsApp(this.#q, await this.#sid(), numbers)
	}
	/** Look up an account by username (`@name`). */
	async findUserByUsername(username: string, pin?: string) {
		return contacts.findUserByUsername(this.#q, await this.#sid(), username, pin)
	}
	/** Profile "About" text of users. */
	async fetchStatus(...jids: string[]) {
		return contacts.fetchStatus(this.#q, await this.#sid(), jids)
	}
	/** The usernames some contacts have set. */
	async contactUsernames(...jids: string[]) {
		return contacts.contactUsernames(this.#q, await this.#sid(), jids)
	}
	/** LIDs for phone-number JIDs. */
	async lidsFor(...jids: string[]) {
		return contacts.lidsFor(this.#q, await this.#sid(), jids)
	}
	profilePictureUrl = (jid: string, type: 'preview' | 'image' = 'preview') =>
		contacts.profilePictureUrl(this.#q, jid, type)
	/** Set our own "About" text. */
	updateProfileStatus = (text: string) => contacts.updateStatus(this.#q, text)
	fetchBlocklist = () => contacts.fetchBlocklist(this.#q)
	/** Block a contact; `entryPoint` / `reason` are what the app reports with it (see `contacts.BlockOptions`). */
	async blockUser(jid: string, o: contacts.BlockOptions = {}): Promise<void> {
		return contacts.updateBlockStatus(this.#q, jid, 'block', await this.#withLid(jid, o))
	}
	async unblockUser(jid: string): Promise<void> {
		return contacts.updateBlockStatus(this.#q, jid, 'unblock', await this.#withLid(jid, {}))
	}
	async #withLid(jid: string, o: contacts.BlockOptions): Promise<contacts.BlockOptions> {
		if (o.lid || jid.endsWith('@lid')) return o
		const found = await this.lidsFor(jid).catch(() => [])
		const lid = found.find((x) => x.pn === jid)?.lid
		return lid ? { ...o, lid } : o
	}
	fetchPrivacySettings = () => contacts.fetchPrivacySettings(this.#q)
	updatePrivacy = (name: contacts.PrivacyCategory, value: contacts.PrivacyValue) =>
		contacts.updatePrivacy(this.#q, name, value)

	/** Post a text status/story visible to `recipients` (the audience must be given explicitly). */
	async sendStatusText(
		text: string,
		recipients: string[],
		privacy: 'contacts' | 'allowlist' | 'denylist' = 'contacts',
	): Promise<string> {
		const { sender } = await this.#live()
		return sender.sendMessage('status@broadcast', msg.textMessage(text), {
			statusRecipients: recipients,
			statusPrivacy: privacy,
		})
	}

	/** Public business profile of an account (null if it is not a business). */
	getBusinessProfile = (jid: string) => business.getBusinessProfile(this.#q, jid)
	/** Edit our own business profile (WhatsApp Business accounts only). */
	updateBusinessProfile = (u: business.BusinessProfileUpdate) =>
		business.updateBusinessProfile(this.#q, u)
	getCatalog = (jid?: string, limit = 10, cursor?: string) =>
		business.getCatalog(
			this.#q,
			jid ?? this.#creds.me?.id.replace(/:\d+@/, '@') ?? '',
			limit,
			cursor,
		)
	getCollections = (jid?: string, limit = 51) =>
		business.getCollections(this.#q, jid ?? this.#creds.me?.id.replace(/:\d+@/, '@') ?? '', limit)

	/** Buttons / list message (native flow). Build buttons with `quickReply`, `urlButton`, `singleSelect`, ... from the package. */
	async sendInteractive(to: string, o: interactiveMsg.InteractiveOptions): Promise<string> {
		const { sender } = await this.#live()
		const m = interactiveMsg.interactive(o)
		return sender.sendMessage(to, m.message, m.opts)
	}

	/** Who may see our statuses (the "Status privacy" screen). */
	setStatusPrivacy = (audience: act.StatusAudience, jids: string[] = []) =>
		this.#push(act.statusPrivacy(audience, jids))

	/** Group permission "Add other members": everyone or only admins. */
	setGroupMemberAddMode = (jid: string, mode: 'admin_add' | 'all_member_add') =>
		this.groups.setMemberAddMode(jid, mode)
	/** Group permission "Send message history" (members may send past messages to new members). */
	setGroupShareHistory = (jid: string, mode: 'all_member_share' | 'admin_share') =>
		setGroupProperty(this.mex, jid, 'member_share_group_history_mode', mode.toUpperCase())
	/** Our "member tag" in a group (shown next to the name; empty string removes it). */
	async setMemberLabel(groupJid: string, label: string): Promise<string> {
		const { sender } = await this.#live()
		return sender.sendMessage(groupJid, memberLabelMessage(label), {
			extraNodes: [{ tag: 'meta', attrs: { tag_reason: 'user_update', appdata: 'member_tag' } }],
		})
	}

	/** Send a poll (2-12 options). Votes arrive encrypted as `pollUpdateMessage`. */
	/** Resolve with the next received message for which `match` is true, or `undefined` after `timeoutMs`. */
	waitForMessage(
		match: (m: DecodedMessage) => boolean = () => true,
		timeoutMs = 30_000,
	): Promise<DecodedMessage | undefined> {
		return new Promise((resolve) => {
			const timer = setTimeout(() => (off(), resolve(undefined)), timeoutMs)
			const off = this.on('message', (m) => {
				if (!match(m)) return
				clearTimeout(timer)
				off()
				resolve(m)
			})
		})
	}

	/** Pin a message in its chat for `seconds` (default 24 hours; 7 days = 604800, 30 days = 2592000). */
	async pinMessage(key: MessageKey, seconds = 86_400): Promise<string> {
		return this.sendMessage(
			key.remoteJid,
			{
				pinInChatMessage: { key, type: 'PIN_FOR_ALL', senderTimestampMs: Date.now() },
				messageContextInfo: {
					messageSecret: randomBytes(32),
					messageAddOnDurationInSecs: seconds,
					messageAddOnExpiryType: 'STATIC',
				},
			},
			{ encAttrs: { 'decrypt-fail': 'hide' }, stanzaAttrs: { edit: '2' } },
		)
	}

	async unpinMessage(key: MessageKey): Promise<string> {
		return this.sendMessage(
			key.remoteJid,
			{
				pinInChatMessage: { key, type: 'UNPIN_FOR_ALL', senderTimestampMs: Date.now() },
				messageContextInfo: {
					messageSecret: randomBytes(32),
					messageAddOnDurationInSecs: 0,
					messageAddOnExpiryType: 'STATIC',
				},
			},
			{ encAttrs: { 'decrypt-fail': 'hide' }, stanzaAttrs: { edit: '2' } },
		)
	}

	/**
	 * Send an album: two to ten pictures and videos that WhatsApp shows as one block. Every item is a picture
	 * (`image`) or a video (`video`) with an optional `caption`. Returns the id of the album message.
	 */
	async sendAlbum(
		to: string,
		items: { image?: MediaSource; video?: MediaSource; caption?: string; mimetype?: string }[],
		o: { delayMs?: number } = {},
	): Promise<string> {
		if (items.length < 2 || items.length > 10) throw new Error('an album has 2 to 10 items')
		for (const i of items)
			if (!i.image === !i.video) throw new Error('each album item is an image or a video')
		const { sender } = await this.#live()
		const albumId = await sender.sendMessage(to, {
			albumMessage: {
				expectedImageCount: items.filter((i) => i.image).length,
				expectedVideoCount: items.filter((i) => i.video).length,
			},
		})
		for (const item of items) {
			const kind = item.image ? 'image' : 'video'
			await this.sendMedia(to, kind, await toBytes((item.image ?? item.video)!), {
				...(item.caption && { caption: item.caption }),
				...(item.mimetype && { mimetype: item.mimetype }),
				association: {
					associationType: 'MEDIA_ALBUM',
					parentMessageKey: { remoteJid: to, fromMe: true, id: albumId },
				},
			})
			await new Promise((r) => setTimeout(r, o.delayMs ?? 500))
		}
		return albumId
	}

	async sendPoll(to: string, name: string, values: string[], selectableCount = 1): Promise<string> {
		const { sender } = await this.#live()
		const p = extras.poll(name, values, selectableCount)
		return sender.sendMessage(to, p.message, p.opts)
	}
	/**
	 * Post to a channel and optionally label the post ("AI content", "paid partnership").
	 * Returns the message id and the post's server number.
	 */
	async postToChannel(
		channel: string,
		message: Record<string, unknown> | string,
		labels: { aiContent?: boolean; paidPartnership?: boolean } = {},
		opts: SendOptions = {},
	): Promise<{ id: string; serverId?: string }> {
		const { sender } = await this.#live()
		let serverId: string | undefined
		const id = await sender.sendMessage(
			channel,
			typeof message === 'string' ? msg.textMessage(message) : message,
			{ ...opts, onAck: (ack) => (serverId = ack.attrs['server_id']) },
		)
		if (serverId && labels.aiContent) await this.newsletters.labelAiContent(channel, serverId)
		if (serverId && labels.paidPartnership)
			await this.newsletters.labelPaidPartnership(channel, serverId)
		return { id, ...(serverId && { serverId }) }
	}
	/**
	 * Post a text status to a group. Pictures, videos and voice notes: `sendImage(group, data, { groupStatus: true })`,
	 * `sendVideo`, `sendAudio(..., { ptt: true, groupStatus: true })`.
	 */
	async sendGroupStatusText(
		group: string,
		text: string,
		o: { backgroundArgb?: number; textArgb?: number; font?: string } = {},
	): Promise<string> {
		const { sender } = await this.#live()
		const lid = (this.#creds.me?.lid ?? '').replace(/[:.]\d+@/, '@')
		const gs = extras.groupStatus({
			extendedTextMessage: {
				text,
				textArgb: o.textArgb ?? 0xffffffff,
				backgroundArgb: o.backgroundArgb ?? 0xff1e88e5,
				font: o.font ?? 'SYSTEM',
				previewType: 'NONE',
				contextInfo: extras.groupStatusContext(lid, 'TEXT'),
			},
		})
		return sender.sendMessage(group, gs.message, gs.opts)
	}
	// ---- calls ---------------------------------------------------------------------------------

	readonly #calls = new Map<string, callSig.CallState>()

	/** Calls this client knows about (placed or received), by call id. */
	get calls(): ReadonlyMap<string, callSig.CallState> {
		return this.#calls
	}

	/**
	 * Place a voice (or video) call and let the callee's devices ring. Resolves with the call once the server accepted
	 * the offer; follow it through the `call` events (`preaccept` = ringing, `accept`, `reject`, `terminate`).
	 * Media is not connected here: without it the callee can answer but hears nothing, and the call ends.
	 */
	async startCall(
		to: string,
		o: {
			video?: boolean
			audioIn?: Int16Array
			recordTo?: string
			/** Video calls: H.264 access units to send, looped (see `splitAnnexB`). */
			videoFrames?: Uint8Array[]
			recordVideoTo?: string
			/** Use this machine's microphone and speaker. */
			localAudio?: LocalAudioOptions
			videoFps?: number
		} & CallFileOptions = {},
	): Promise<callSig.CallState> {
		o = await resolveCallFiles(o)
		const { sender, receiver } = await this.#live()
		const own = this.#creds.me?.lid
		if (!own) throw new Error('no own LID yet; wait for the login to finish')
		// The call key is bound to LIDs, so a phone-number callee is resolved first.
		let peer = to.replace(/:\d+@/, '@')
		if (!peer.endsWith('@lid')) {
			const found = (await this.lidsFor(peer)).find((x) => x.pn === peer)
			if (!found) throw new Error(`no LID known for ${peer}`)
			peer = found.lid
		}
		const devices = await sender.getDevices([peer])
		const ring = devices.map((d) => d.jid)
		if (!ring.length) throw new Error(`no devices found for ${peer}`)
		const callKey = new Uint8Array(randomBytes(32))
		const keys = await sender.encryptForDevices(ring, { call: { callKey } })
		if (!keys.length) throw new Error('could not encrypt the call key for any device')
		const callId = callSig.newCallId()
		const id = receiver.nextId()
		const offer = callSig.buildOffer({
			callId,
			to: peer,
			creator: own,
			keys: keys.map((k) => ({ jid: k.jid, type: k.type, ciphertext: k.ciphertext })),
			multiDevice: ring.length > 1,
			video: !!o.video,
			opus: true,
			id,
			...(keys.some((k) => k.type === 'pkmsg') &&
				this.#creds.account && { deviceIdentity: this.#creds.account }),
		})
		const state: callSig.CallState = {
			callId,
			peer,
			creator: own,
			direction: 'outgoing',
			video: !!o.video,
			devices: ring,
			status: 'calling',
			startedAt: Date.now(),
			callKey,
		}
		this.#calls.set(callId, state)
		try {
			const ack = await receiver.sendCallAndWait(offer)
			const relay = (Array.isArray(ack.content) ? ack.content : []).find((c) => c.tag === 'relay')
			if (relay) {
				state.relay = relay
				// The media path: allocate on the relay now, so audio flows the moment the callee picks up.
				const media = new MediaSession({
					callId,
					direction: 'outgoing',
					selfLid: own,
					peerLid: peer,
					callKey,
					relay,
					codec: 'opus',
					enableVideo: !!o.video,
					...(o.audioIn && { audioIn: o.audioIn }),
					...(o.recordTo && { recordTo: o.recordTo }),
					...(o.videoFrames && {
						video: { frames: o.videoFrames, ...(o.videoFps && { fps: o.videoFps }) },
					}),
					...(o.recordVideoTo && { recordVideoTo: o.recordVideoTo }),
					...(o.localAudio && { localAudio: o.localAudio }),
				})
				state.media = media
				media.on('closed', () => void 0)
				media.start()
			}
		} catch (e) {
			state.status = 'ended'
			throw e
		}
		return state
	}

	/** The roster and key traffic of a group call (`group_update`, `enc_rekey`) from the call's creator. */
	#groupCallTraffic(c: callEvents.CallEvent, node: BinaryNode): void {
		const st = this.#calls.get(c.callId)
		const action = Array.isArray(node.content) ? node.content[0] : undefined
		if (!st?.groupSession || !action) return
		if (c.status === 'group_update') {
			this.#reportRelayLatency(st, action)
			try {
				const summary = st.groupSession.applyUpdate(encodeNode(action)) as GroupSummary
				if (summary.applied === 'applied') {
					for (const m of summary.members) st.members?.add(m)
					if (st.waiting) {
						// Let in: the waiting-room heartbeat becomes the call's own.
						st.waiting = false
						if (st.heartbeat) clearInterval(st.heartbeat)
						delete st.heartbeat
						this.#startHeartbeat(st)
					}
					if (st.groupEngine) {
						const r = st.groupSession.pushToEngine(st.groupEngine, performance.now())
						this.logger.event('call.group-push', { transaction: summary.transaction_id, result: r })
					}
					void this.#startGroupMedia(st, summary, {}).catch((e: unknown) =>
						this.logger.event('call.group-error', e),
					)
				}
			} catch (e) {
				this.logger.event('call.group-update-failed', e)
			}
		} else if (c.status === 'enc_rekey') {
			void this.#installEpoch(st, action, c.from).catch((e: unknown) =>
				this.logger.event('call.epoch-failed', e),
			)
		}
	}

	/** Decrypt a shared key delivered to us and give it to the engine. */
	async #installEpoch(st: callSig.CallState, action: BinaryNode, from: string): Promise<void> {
		const { receiver } = await this.#live()
		const r = parseGroupEncRekey(encodeNode(action)) as {
			transaction_id: number
			enc_type: string
			ciphertext: number[]
		}
		// The envelope is a Signal message from the device that sent the stanza, not from the call creator.
		const raw = await receiver.decryptCallKey(from, r.enc_type, Uint8Array.from(r.ciphertext))
		if (!raw) throw new Error('the epoch envelope holds no key')
		if (!st.groupEngine) {
			// Answered a call whose relay has not arrived yet: keep the key for the engine.
			st.pendingEpoch = { transaction: r.transaction_id, key: raw }
			this.logger.event('call.group-epoch', {
				transaction: r.transaction_id,
				from,
				applied: 'pending',
			})
			return
		}
		const applied = st.groupEngine.applyGroupEpoch(r.transaction_id, raw)
		this.logger.event('call.group-epoch', { transaction: r.transaction_id, from, applied })
		st.epochTx = r.transaction_id
	}

	#trackCall(c: callEvents.CallEvent, node?: BinaryNode): void {
		const userOf = (jid: string): string => jid.split('@')[0]!.replace(/[:.]\d+$/, '')
		const st = this.#calls.get(c.callId)
		if (st) {
			// Only the other side of this very call may move it: a stanza from anyone else (or from a different
			// account that guessed the call id) is ignored. In a group call that means the call service
			// (`<call-id>@call`) or one of the people in the call.
			const fromService = c.from === `${c.callId}@call`
			const fromMember = !!st.members?.has(userOf(c.from) + '@lid')
			const allowed = st.groupSession
				? fromService || fromMember
				: st.group
					? // a group invitation we have not answered yet: the call service or the person who started it
						fromService || userOf(c.from) === userOf(st.creator)
					: userOf(c.from) === userOf(st.peer)
			if (!allowed) {
				this.logger.event('call.ignored-stanza', {
					callId: c.callId,
					from: c.from,
					status: c.status,
				})
				return
			}
			// Roster updates only from the service; shared keys only from people in the call.
			if (node && st.groupSession) {
				if (c.status === 'group_update' && fromService) this.#groupCallTraffic(c, node)
				if (c.status === 'enc_rekey' && fromMember) this.#groupCallTraffic(c, node)
			}
			if (c.status === 'video' && c.videoState !== undefined) this.#onVideoState(st, c)
			if (c.status === 'accept' && !st.groupSession) st.peerDevice = c.from
			if (c.status === 'preaccept' || c.status === 'ringing') st.status = 'ringing'
			else if (c.status === 'accept') {
				st.status = 'connected'
				// The answering device's LID decides the keys we receive with (1:1 calls; groups share one epoch).
				if (!st.groupSession) st.media?.rekeyRecv(c.from)
			} else if (c.status === 'reject' || c.status === 'terminate') {
				// In a group call one person hanging up is not the end of the call; only the service ends it.
				if (st.groupSession && !fromService) return
				this.#finishCall(st, c.status)
			}
			return
		}
		if (c.status !== 'offer') return
		// The creator named in the offer has to be the account the stanza really came from (groups: the group).
		const creator = c.creator ?? c.from
		if (!c.isGroup && userOf(creator) !== userOf(c.from)) {
			this.logger.event('call.ignored-offer', { callId: c.callId, from: c.from, creator })
			return
		}
		this.#calls.set(c.callId, {
			callId: c.callId,
			peer: creator.replace(/:\d+@/, '@'),
			creator,
			direction: 'incoming',
			video: !!c.isVideo,
			devices: [creator],
			status: 'ringing',
			startedAt: Date.now(),
			...(c.isGroup && { group: c.group ?? c.from }),
			...(c.lightweight && { lightweight: true }),
			...(node && { offer: node, offerFrom: c.from }),
		})
		this.#pruneCalls()
	}

	/** Mark a call over: stop its media, forget its key. */
	#finishCall(st: callSig.CallState, reason: string): void {
		st.status = 'ended'
		if (st.heartbeat) clearInterval(st.heartbeat)
		delete st.heartbeat
		st.media?.close(reason)
		delete st.media
		st.callKey?.fill(0)
		delete st.callKey
		this.#pruneCalls()
	}

	/** Keep the call table small: at most 200 entries, ended calls go first. */
	#pruneCalls(): void {
		if (this.#calls.size <= 200) return
		for (const [id, c] of this.#calls) {
			if (c.status === 'ended') this.#calls.delete(id)
			if (this.#calls.size <= 200) return
		}
		while (this.#calls.size > 200) this.#calls.delete(this.#calls.keys().next().value!)
	}

	/**
	 * Answer an incoming call: decrypt the call key from the offer, tell the caller we are ringing and answering, and
	 * connect the media. `audioIn` is spoken into the call, `recordTo` saves what the caller says (16 kHz mono WAV).
	 */
	async acceptCall(
		callId: string,
		o: {
			audioIn?: Int16Array
			recordTo?: string
			videoFrames?: Uint8Array[]
			recordVideoTo?: string
			/** Use this machine's microphone and speaker. */
			localAudio?: LocalAudioOptions
			videoFps?: number
		} & CallFileOptions = {},
	): Promise<callSig.CallState> {
		o = await resolveCallFiles(o)
		const c = this.#calls.get(callId)
		if (!c || c.direction !== 'incoming' || !c.offer) throw new Error(`no incoming call ${callId}`)
		// The server refuses to let a silent call be answered (preaccept gets error 403 and the service ends it).
		if (c.lightweight)
			throw new Error(
				`call ${callId} is a silent group call (a voice chat invitation): it rings nobody and cannot be answered`,
			)
		if (c.group) return this.#acceptGroupCall(c, o)
		const { receiver } = await this.#live()
		const own = this.#creds.me
		if (!own?.lid) throw new Error('no own LID yet')
		const inner = (Array.isArray(c.offer.content) ? c.offer.content[0] : undefined) as BinaryNode
		const kids = Array.isArray(inner?.content) ? inner.content : []
		// Our copy of the call key: a bare <enc>, or the one addressed to this device inside <destination>.
		const ours = (n: BinaryNode) => [own.lid, own.id].includes(n.attrs['jid'] ?? '')
		let enc = kids.find((k) => k.tag === 'enc')
		if (!enc) {
			const dest = kids.find((k) => k.tag === 'destination')
			const to = (Array.isArray(dest?.content) ? dest.content : []).find(ours)
			enc = (Array.isArray(to?.content) ? to.content : []).find((k) => k.tag === 'enc')
		}
		if (!enc || !(enc.content instanceof Uint8Array))
			throw new Error('the offer carries no call key for this device')
		const relay = kids.find((k) => k.tag === 'relay')
		if (!relay) throw new Error('the offer carries no relay')
		const target = c.offerFrom ?? c.creator
		// Ringing first, before the (possibly slow) decrypt, as the app does.
		receiver.sendNode(callSig.buildPreaccept(callId, target, c.creator, receiver.nextId(), c.video))
		const callKey = await receiver.decryptCallKey(
			c.creator,
			enc.attrs['type'] ?? 'msg',
			enc.content,
		)
		if (!callKey) throw new Error('could not read the call key')
		c.callKey = callKey
		const media = new MediaSession({
			callId,
			direction: 'incoming',
			selfLid: own.lid,
			peerLid: c.creator,
			callKey,
			relay,
			codec: 'opus',
			enableVideo: c.video,
			...(o.audioIn && { audioIn: o.audioIn }),
			...(o.recordTo && { recordTo: o.recordTo }),
			...(o.videoFrames && {
				video: { frames: o.videoFrames, ...(o.videoFps && { fps: o.videoFps }) },
			}),
			...(o.recordVideoTo && { recordVideoTo: o.recordVideoTo }),
			...(o.localAudio && { localAudio: o.localAudio }),
		})
		c.media = media
		media.start()
		receiver.sendNode(callSig.buildAccept(callId, target, c.creator, receiver.nextId(), c.video))
		c.status = 'connected'
		return c
	}

	/** Create a call link (a "room") that others can join: `https://call.whatsapp.com/{voice|video}/{token}`. */
	async createCallLink(media: callSig.CallLinkMedia = 'audio'): Promise<callSig.CallLink> {
		const { receiver } = await this.#live()
		const ack = await receiver.sendCallAndWait(callSig.buildLinkCreate(media, receiver.nextId()))
		return callSig.parseLinkCreateAck(ack)
	}

	/** Who made a call link and whether joiners have to be let in. `link` is the token or the whole URL. */
	async queryCallLink(
		link: string,
		media: callSig.CallLinkMedia = 'audio',
	): Promise<callSig.CallLinkPreview> {
		const token = callSig.parseCallLinkToken(link)
		const { receiver } = await this.#live()
		const ack = await receiver.sendCallAndWait(
			callSig.buildLinkQuery(token, media, receiver.nextId()),
		)
		return callSig.parseLinkQueryAck(ack)
	}

	/**
	 * Start a group call: an ad-hoc call with at least two other people, or one bound to an existing group
	 * (`o.group`, at least one other member). Everyone's devices ring. The shared media key is generated here and sent
	 * to every device that connects.
	 */
	async startGroupCall(
		targets: string[],
		o: {
			group?: string
			video?: boolean
		} & callSig.GroupMediaOptions &
			CallFileOptions = {},
	): Promise<callSig.CallState> {
		o = await resolveCallFiles(o)
		const { sender, receiver } = await this.#live()
		const own = this.#creds.me?.lid
		if (!own) throw new Error('no own LID yet; wait for the login to finish')
		ensureVoipWasm()
		const ownUser = own.replace(/:\d+@/, '@')
		// A call bound to a group has to name everyone in it; the server refuses a partial roster (error 412).
		if (o.group && !targets.length)
			targets = (await this.groups.metadata(o.group)).participants.map((p) => p.id)
		const users: string[] = []
		for (const t of targets) {
			let u = t.replace(/:\d+@/, '@')
			if (!u.endsWith('@lid')) {
				const found = (await this.lidsFor(u)).find((x) => x.pn === u)
				if (!found) throw new Error(`no LID known for ${u}`)
				u = found.lid
			}
			if (u !== ownUser && !users.includes(u)) users.push(u)
		}
		// Cloud-API "hosted" devices (id 99) are not part of a call roster.
		const isHosted = (jid: string) => /:99@/.test(jid)
		const devices = (await sender.getDevices(users)).filter((d) => !isHosted(d.jid))
		// The roster lists every device of the other participants, but only the calling device of ours (as the app does).
		const participants = [
			{
				jid: ownUser,
				devices: [{ jid: own, capability: [...callSig.CAPABILITY_STANDARD_OPUS_OFFER] }],
			},
			...users.map((u) => ({
				jid: u,
				devices: devices
					.filter((d) => d.jid.replace(/:\d+@/, '@') === u)
					.map((d) => ({ jid: d.jid })),
			})),
		]
		if (participants.slice(1).some((p) => !p.devices.length))
			throw new Error('a participant has no devices')
		const callId = callSig.newCallId()
		const id = receiver.nextId()
		const offer = buildGroupOffer(
			JSON.stringify({
				call_id: callId,
				id,
				creator: own,
				...(o.group && { group_jid: o.group }),
				participants,
				audio_rate: 16000,
				video: !!o.video,
			}),
		) as BinaryNode
		const session = new GroupSession(callId, own, own)
		const state: callSig.CallState = {
			callId,
			peer: o.group ?? users[0]!,
			creator: own,
			direction: 'outgoing',
			video: !!o.video,
			...(o.group && { group: o.group }),
			devices: devices.map((d) => d.jid),
			status: 'calling',
			startedAt: Date.now(),
			groupSession: session,
			members: new Set([ownUser, ...users]),
		}
		this.#calls.set(callId, state)
		try {
			const ack = await receiver.sendCallAndWait(offer)
			const summary = session.applyAck(encodeNode(ack)) as GroupSummary
			this.#startHeartbeat(state)
			await this.#startGroupMedia(state, summary, o)
		} catch (e) {
			// The offer is out: end it, or it keeps ringing everyone it reached.
			try {
				receiver.sendNode(callSig.buildTerminate(callId, `${callId}@call`, own, receiver.nextId()))
			} catch {
				/* connection gone: the server ends it on its own */
			}
			this.#finishCall(state, 'failed')
			throw e
		}
		return state
	}

	/** Build the group engine once the server gave us a relay, then deliver the shared key where it is owed. */
	async #startGroupMedia(
		state: callSig.CallState,
		summary: GroupSummary,
		o: callSig.GroupMediaOptions,
	): Promise<void> {
		const session = state.groupSession!
		// An invitation we answered gets its relay with a later roster update.
		if (!summary.relay_endpoint && (state.direction === 'incoming' || state.awaitsRelay)) return
		if (!summary.relay_endpoint) throw new Error('the group call has no relay yet')
		o = { ...state.mediaOptions, ...o }
		if (!state.groupEngine) {
			const engine = session.createEngine(state.direction === 'incoming', true, state.video)
			state.groupEngine = engine
			const media = new MediaSession({
				callId: state.callId,
				direction: state.direction,
				selfLid: state.creator,
				peerLid: state.creator,
				callKey: new Uint8Array(32),
				group: {
					engine,
					relay: { ip: summary.relay_endpoint[0], port: summary.relay_endpoint[1] },
				},
				codec: 'opus',
				enableVideo: state.video,
				...(o.audioIn && { audioIn: o.audioIn }),
				...(o.recordTo && { recordTo: o.recordTo }),
				...(o.videoFrames && {
					video: { frames: o.videoFrames, ...(o.videoFps && { fps: o.videoFps }) },
				}),
				...(o.recordVideoTo && { recordVideoTo: o.recordVideoTo }),
				...(o.localAudio && { localAudio: o.localAudio }),
			})
			state.media = media
			media.on('connected', () => {
				if (state.status !== 'ended') state.status = 'connected'
			})
			media.start()
			if (state.pendingEpoch) {
				const { transaction, key } = state.pendingEpoch
				delete state.pendingEpoch
				const applied = engine.applyGroupEpoch(transaction, key)
				state.epochTx = transaction
				this.logger.event('call.group-epoch', { transaction, applied })
				key.fill(0)
			}
		}
		await this.#groupEpoch(state, summary)
		this.#hintTransport(state, summary)
	}

	/**
	 * Tell the call service how far each relay of a roster update is from us (once per relay block). The service
	 * picks the call's relay from everyone's reports, and drops a participant that never reported.
	 */
	#reportRelayLatency(st: callSig.CallState, holder: BinaryNode): void {
		const relay = (Array.isArray(holder.content) ? holder.content : []).find(
			(k) => k.tag === 'relay',
		)
		const tx = relay?.attrs['transaction-id']
		if (!relay || !tx || st.latencyTx === tx) return
		st.latencyTx = tx
		const seen = new Set<string>()
		const reports: { name: string; rtt: number; address: Uint8Array }[] = []
		for (const te of Array.isArray(relay.content) ? relay.content : []) {
			const name = te.attrs['relay_name']
			if (te.tag !== 'te2' || !name || seen.has(name)) continue
			if (!(te.content instanceof Uint8Array) || te.content.length !== 6) continue
			seen.add(name)
			reports.push({ name, rtt: Number(te.attrs['c2r_rtt'] ?? 0) || 0, address: te.content })
		}
		void this.#live()
			.then(({ receiver }) => {
				for (const r of reports)
					receiver.sendNode(
						callSig.buildRelayLatency(
							st.callId,
							st.creator,
							tx,
							r.name,
							r.rtt,
							r.address,
							receiver.nextId(),
						),
					)
			})
			.catch((e: unknown) => this.logger.event('call.latency-failed', e))
	}

	/** A pending call-link join pings the waiting room every 10 s until it is let in. */
	#startWaitingHeartbeat(st: callSig.CallState): void {
		const beat = () => {
			void this.#live()
				.then(({ receiver }) =>
					receiver.sendNode(
						callSig.buildWaitingRoomHeartbeat(st.callId, st.creator, receiver.nextId()),
					),
				)
				.catch((e: unknown) => this.logger.event('call.heartbeat-failed', e))
		}
		beat()
		st.heartbeat = setInterval(beat, 10_000)
		st.heartbeat.unref()
	}

	/**
	 * Join a call link ("room"). When the creator wants to approve joiners the call waits in the waiting room
	 * (`status` `ringing`, `waiting` true) and goes on once the creator lets us in.
	 */
	async joinCallLink(
		link: string,
		media: callSig.CallLinkMedia = 'audio',
		o: callSig.GroupMediaOptions & CallFileOptions = {},
	): Promise<callSig.CallState> {
		o = await resolveCallFiles(o)
		const token = callSig.parseCallLinkToken(link)
		const { receiver } = await this.#live()
		const own = this.#creds.me?.lid
		if (!own) throw new Error('no own LID yet; wait for the login to finish')
		ensureVoipWasm()
		const ack = await receiver.sendCallAndWait(
			callSig.buildLinkJoin(token, media, receiver.nextId()),
		)
		const join = callSig.parseLinkJoinAck(ack, token)
		const user = (j: string) => j.replace(/:\d+@/, '@')
		const session = new GroupSession(join.callId, join.creator, own)
		const state: callSig.CallState = {
			callId: join.callId,
			peer: user(join.creator),
			creator: join.creator,
			direction: 'outgoing',
			video: join.media === 'video',
			devices: [],
			status: join.admitted ? 'connected' : 'ringing',
			startedAt: Date.now(),
			groupSession: session,
			members: new Set([user(join.creator), user(own)]),
			mediaOptions: callSig.pickMediaOptions(o),
			...(join.inWaitingRoom && { waiting: true }),
			awaitsRelay: true,
		}
		this.#calls.set(join.callId, state)
		try {
			if (join.admitted) {
				// The ack's roster has the transaction of the first update, which carries the relay and the rekey
				// request: applying it here would make that update look stale. The update is the first snapshot.
				this.#startHeartbeat(state)
			} else this.#startWaitingHeartbeat(state)
		} catch (e) {
			try {
				receiver.sendNode(
					callSig.buildTerminate(
						join.callId,
						`${join.callId}@call`,
						join.creator,
						receiver.nextId(),
					),
				)
			} catch {
				/* connection gone */
			}
			this.#finishCall(state, 'failed')
			throw e
		}
		return state
	}

	/** Where in-call video changes go: the call service in a group call, otherwise the other side's device. */
	#videoTarget(c: callSig.CallState): string {
		if (c.groupSession) return `${c.callId}@call`
		return c.peerDevice ?? c.offerFrom ?? c.creator
	}

	/** The other side changed its video: answer a request later with `acceptVideoUpgrade`, follow an accept. */
	#onVideoState(st: callSig.CallState, c: callEvents.CallEvent): void {
		const state = c.videoState
		if (state === callSig.VIDEO_STATE.request || state === 3) {
			st.videoRequest = true
		} else if (state === callSig.VIDEO_STATE.accept) {
			st.media?.releaseVideo()
		} else if (state === callSig.VIDEO_STATE.enabled) {
			// Their camera is on: make sure incoming video is decoded.
			if (st.media) st.media.acceptVideo()
		} else if (state === callSig.VIDEO_STATE.reject) {
			st.media?.stopVideo()
		}
	}

	/** Turn our camera on in a running call: asks the other side and sends once they accept. */
	async enableCamera(
		callId: string,
		o: { videoFrames?: Uint8Array[]; videoFps?: number } & CallFileOptions = {},
	): Promise<void> {
		const c = this.#calls.get(callId)
		if (!c?.media) throw new Error(`no running call ${callId}`)
		o = await resolveCallFiles(o)
		if (!o.videoFrames?.length) throw new Error('enableCamera needs videoFrames or videoFile')
		const { receiver } = await this.#live()
		if (!c.media.startVideo(o.videoFrames, o.videoFps ?? 15, true))
			throw new Error('the call cannot carry video')
		c.video = true
		receiver.sendNode(
			callSig.buildVideoState(
				callId,
				this.#videoTarget(c),
				c.creator,
				receiver.nextId(),
				callSig.VIDEO_STATE.request,
				{ dec: 'H264', orientation: 0 },
			),
		)
	}

	/** Turn our camera off; the call goes on with sound. */
	async disableCamera(callId: string): Promise<void> {
		const c = this.#calls.get(callId)
		if (!c?.media) throw new Error(`no running call ${callId}`)
		const { receiver } = await this.#live()
		c.media.stopVideo()
		receiver.sendNode(
			callSig.buildVideoState(
				callId,
				this.#videoTarget(c),
				c.creator,
				receiver.nextId(),
				callSig.VIDEO_STATE.stopped,
			),
		)
	}

	/** The other side asked to turn video on (see `call` events with `videoState` 11): accept, optionally sending our own picture. */
	async acceptVideoUpgrade(
		callId: string,
		o: { videoFrames?: Uint8Array[]; videoFps?: number } & CallFileOptions = {},
	): Promise<void> {
		const c = this.#calls.get(callId)
		if (!c?.media || !c.videoRequest) throw new Error(`no video request on call ${callId}`)
		o = await resolveCallFiles(o)
		const { receiver } = await this.#live()
		c.videoRequest = false
		c.video = true
		const to = this.#videoTarget(c)
		if (o.videoFrames?.length) c.media.startVideo(o.videoFrames, o.videoFps ?? 15)
		else c.media.acceptVideo()
		receiver.sendNode(
			callSig.buildVideoState(
				callId,
				to,
				c.creator,
				receiver.nextId(),
				callSig.VIDEO_STATE.accept,
				{
					dec: 'H264,AV1',
					orientation: 0,
				},
			),
		)
		if (o.videoFrames?.length)
			receiver.sendNode(
				callSig.buildVideoState(
					callId,
					to,
					c.creator,
					receiver.nextId(),
					callSig.VIDEO_STATE.enabled,
					{
						dec: 'H264',
						orientation: 0,
					},
				),
			)
	}

	/** Refuse the other side's request to turn video on. */
	async rejectVideoUpgrade(callId: string): Promise<void> {
		const c = this.#calls.get(callId)
		if (!c || !c.videoRequest) throw new Error(`no video request on call ${callId}`)
		const { receiver } = await this.#live()
		c.videoRequest = false
		receiver.sendNode(
			callSig.buildVideoState(
				callId,
				this.#videoTarget(c),
				c.creator,
				receiver.nextId(),
				callSig.VIDEO_STATE.reject,
			),
		)
	}

	/** Raise (or lower) the hand in a group call. */
	async raiseHand(callId: string, raised = true): Promise<void> {
		const c = this.#calls.get(callId)
		if (!c?.groupSession) throw new Error(`${callId} is not a running group call`)
		const { receiver } = await this.#live()
		receiver.sendNode(callSig.buildRaiseHand(callId, c.creator, raised, receiver.nextId()))
	}

	/**
	 * Tell the group call that we start or stop sharing a screen. This is the signal only: the picture itself is
	 * not sent. Others report it as \`screenShare\` on the call event.
	 */
	async setScreenShare(callId: string, started: boolean, shareId?: number): Promise<void> {
		const c = this.#calls.get(callId)
		if (!c?.groupSession) throw new Error(`${callId} is not a running group call`)
		const { receiver } = await this.#live()
		receiver.sendNode(
			callSig.buildScreenShare(callId, c.creator, started, shareId, receiver.nextId()),
		)
	}

	/** React with an emoji in a group call (the empty string takes it back). */
	async sendReaction(callId: string, emoji: string): Promise<void> {
		const c = this.#calls.get(callId)
		if (!c?.groupSession || !c.media) throw new Error(`${callId} is not a running group call`)
		if (Buffer.byteLength(emoji, 'utf8') > 32) throw new Error('a reaction is a single emoji')
		c.media.react(emoji)
	}

	/** Creator of a call link: require approval for joiners (or not). */
	async setApprovalRequired(callId: string, enabled: boolean): Promise<void> {
		const c = this.#calls.get(callId)
		if (!c) throw new Error(`unknown call ${callId}`)
		const { receiver } = await this.#live()
		await receiver.sendCallAndWait(
			callSig.buildWaitingRoomToggle(callId, c.creator, enabled, receiver.nextId()),
		)
	}

	/** Creator of a call link: let a waiting person in, or turn them away. */
	async answerWaitingRoom(callId: string, user: string, admit = true): Promise<void> {
		const c = this.#calls.get(callId)
		if (!c) throw new Error(`unknown call ${callId}`)
		const { receiver } = await this.#live()
		await receiver.sendCallAndWait(
			callSig.buildWaitingRoomAdmit(callId, c.creator, user, receiver.nextId(), !admit),
		)
	}

	/** The creator pings the call service every 10 s; without it the server drops the call. */
	#startHeartbeat(st: callSig.CallState): void {
		if (st.direction !== 'outgoing' || st.heartbeat) return
		const beat = () => {
			void this.#live()
				.then(({ receiver }) =>
					receiver.sendNode(callSig.buildHeartbeat(st.callId, st.creator, receiver.nextId())),
				)
				.catch((e: unknown) => this.logger.event('call.heartbeat-failed', e))
		}
		beat()
		st.heartbeat = setInterval(beat, 10_000)
		st.heartbeat.unref()
	}

	/** Once a device is in the call, tell it our network (once) and announce that we are unmuted. */
	#hintTransport(st: callSig.CallState, summary: GroupSummary): void {
		if (st.direction !== 'outgoing') return
		const fresh = summary.epoch_recipients.filter(
			(j) => st.members?.has(j.replace(/:\d+@/, '@')) && !st.hinted?.has(j),
		)
		if (!fresh.length) return
		const hinted = (st.hinted ??= new Set())
		void this.#live()
			.then(({ receiver }) => {
				for (const j of fresh) {
					hinted.add(j)
					receiver.sendNode(callSig.buildTransportHint(st.callId, j, st.creator, receiver.nextId()))
				}
				receiver.sendNode(callSig.buildMuteState(st.callId, st.creator, false, receiver.nextId()))
			})
			.catch((e: unknown) => this.logger.event('call.transport-failed', e))
	}

	/** If the server asked for a shared key (and we are the creator), send it to every connected device. */
	async #groupEpoch(state: callSig.CallState, summary: GroupSummary): Promise<void> {
		if (!summary.rekey_requested && !summary.rekey_owed) return
		if (state.direction !== 'outgoing' || !summary.transaction_id) return
		if (state.epochTx !== undefined && state.epochTx >= summary.transaction_id) return
		const { sender, receiver } = await this.#live()
		const raw = new Uint8Array(randomBytes(32))
		// Only people who belong in this call get the key, whatever the roster claims.
		const recipients = summary.epoch_recipients.filter((j) =>
			state.members?.has(j.replace(/:\d+@/, '@')),
		)
		const keys = recipients.length
			? await sender.encryptForDevices(recipients, { call: { callKey: raw } })
			: []
		for (const k of keys) {
			receiver.sendNode(
				buildGroupEncRekey(
					JSON.stringify({
						call_id: state.callId,
						id: receiver.nextId(),
						to: k.jid,
						creator: state.creator,
						transaction_id: summary.transaction_id,
						enc_type: k.type,
						ciphertext: [...k.ciphertext],
						...(k.type === 'pkmsg' &&
							this.#creds.account && { device_identity: [...this.#creds.account] }),
					}),
				) as BinaryNode,
			)
		}
		state.groupEngine?.applyGroupEpoch(summary.transaction_id, raw)
		state.epochTx = summary.transaction_id
		raw.fill(0)
	}

	/** Answer an invitation into a group call: join at the call service, the relay and the shared key follow. */
	async #acceptGroupCall(
		c: callSig.CallState,
		o: callSig.GroupMediaOptions,
	): Promise<callSig.CallState> {
		const { receiver } = await this.#live()
		const own = this.#creds.me?.lid
		if (!own) throw new Error('no own LID yet')
		ensureVoipWasm()
		const inner = (Array.isArray(c.offer!.content) ? c.offer!.content[0] : undefined) as BinaryNode
		const session = new GroupSession(c.callId, c.creator, own)
		const summary = session.applyInvite(encodeNode(inner)) as GroupSummary
		c.groupSession = session
		c.members = new Set([c.creator.replace(/:\d+@/, '@'), ...summary.members])
		c.mediaOptions = callSig.pickMediaOptions(o)
		const service = `${c.callId}@call`
		// One step at a time: the service wants the preparation acknowledged before the answer.
		await receiver.sendCallAndWait(
			callSig.buildPreaccept(c.callId, service, c.creator, receiver.nextId(), c.video),
		)
		// The answer is not acknowledged on its own: the roster update that follows carries the relay.
		receiver.sendNode(
			callSig.buildAccept(c.callId, service, c.creator, receiver.nextId(), c.video, true),
		)
		c.status = 'connected'
		// The invitation may already carry the relay; otherwise the roster update after our accept does.
		await this.#startGroupMedia(c, summary, o)
		return c
	}

	/** Hang up a call we placed or answered (also cancels one that is still ringing). */
	async endCall(callId: string): Promise<void> {
		const c = this.#calls.get(callId)
		if (!c) throw new Error(`unknown call ${callId}`)
		const { receiver } = await this.#live()
		// A group call is ended once, at the call service; a 1:1 call at each device it rang on.
		if (c.groupSession) {
			const ms = Math.max(0, Date.now() - c.startedAt)
			receiver.sendNode(callSig.buildTerminateTimed(callId, c.creator, ms, receiver.nextId()))
			receiver.sendNode(callSig.buildGroupDuration(callId, c.creator, ms, receiver.nextId()))
		} else
			for (const device of c.devices)
				receiver.sendNode(callSig.buildTerminate(callId, device, c.creator, receiver.nextId()))
		this.#finishCall(c, 'hangup')
	}

	// ---- buttons, lists, templates, rich answers ----------------------------------------------

	/** Up to three reply buttons under a text (`buttonsMessage`). The tap arrives as a `message` event; see `parseButtonReply`. */
	async sendButtons(to: string, o: buttons.ButtonsOptions): Promise<string> {
		const { sender } = await this.#live()
		const m = buttons.buttonsMessage(o)
		return sender.sendMessage(to, m.message, m.opts)
	}
	/** A "choose from a list" message (`listMessage`). */
	async sendList(to: string, o: buttons.ListOptions): Promise<string> {
		const { sender } = await this.#live()
		const m = buttons.listMessage(o)
		return sender.sendMessage(to, m.message, m.opts)
	}
	/** Template buttons: quick replies, a link and a phone number (`templateMessage`). */
	async sendTemplate(to: string, o: buttons.TemplateOptions): Promise<string> {
		const { sender } = await this.#live()
		const m = buttons.templateMessage(o)
		return sender.sendMessage(to, m.message, m.opts)
	}
	/** Answer a buttons message; the tapped button's id and text come from the received message. */
	replyToButtons = (to: string, id: string, displayText: string) =>
		this.sendMessage(to, buttons.buttonsResponse(id, displayText))
	replyToList = (to: string, rowId: string, title: string, description?: string) =>
		this.sendMessage(to, buttons.listResponse(rowId, title, description))
	replyToTemplate = (to: string, id: string, displayText: string, index = 0) =>
		this.sendMessage(to, buttons.templateButtonReply(id, displayText, index))
	replyToNativeFlow = (to: string, name: string, params: Record<string, unknown>, bodyText = '') =>
		this.sendMessage(to, buttons.interactiveResponse(name, params, bodyText))
	/** A Meta AI style answer with text, code, table, LaTeX, map and images. */
	async sendRichResponse(to: string, o: RichResponseOptions): Promise<string> {
		const { sender } = await this.#live()
		const m = richResponse(o)
		return sender.sendMessage(to, m.message, m.opts)
	}

	/**
	 * Raw HTML as a Meta AI answer (experimental on WhatsApp's side). Rendered as markup and not sanitised: pass only
	 * HTML you wrote, never received or generated text. Calling this method is the opt-in.
	 */
	sendHtml = (to: string, html: string) => this.sendRichResponse(to, { html, allowRawHtml: true })

	// ---- reports ----------------------------------------------------------------------------

	readonly #reports = new report.ReportStore()

	async #sendReport(
		kind: report.ReportKind,
		jid: string,
		o: report.ReportOptions,
	): Promise<{ reportId?: string }> {
		const { receiver } = await this.#live()
		const res = await receiver.request(report.buildReport(kind, jid, receiver.nextId(), o))
		const id = report.reportId(res)
		return id ? { reportId: id } : {}
	}

	/**
	 * Report a user to WhatsApp, as "Report" in the contact menu does. The latest 5 messages of the chat go along as
	 * evidence unless you pass `messages` or `withMessages: false`. `block: true` blocks the contact afterwards
	 * ("Block contact and delete chat" additionally with `deleteChat: true`).
	 */
	async reportUser(
		jid: string,
		o: report.ReportOptions & {
			block?: boolean
			deleteChat?: boolean
			withMessages?: boolean
		} = {},
	): Promise<{ reportId?: string; blocked: boolean }> {
		const messages = o.messages ?? (o.withMessages === false ? [] : this.#reports.recent(jid, 5))
		const sent = await this.#sendReport('user', jid, { ...o, messages })
		if (o.block) await this.blockUser(jid, { entryPoint: o.flow ?? 'overflow_menu_block' })
		if (o.block && o.deleteChat) await this.deleteChat(jid)
		return { ...sent, blocked: !!o.block }
	}
	/**
	 * Report a group. `leave: true` leaves it afterwards ("Exit group and report"). The group name is looked up when
	 * you do not give `subject`.
	 */
	async reportGroup(
		group: string,
		o: report.ReportOptions & { leave?: boolean; withMessages?: boolean } = {},
	): Promise<{ reportId?: string; left: boolean }> {
		const subject = o.subject ?? (await this.groups.metadata(group)).subject
		const messages = o.messages ?? (o.withMessages === false ? [] : this.#reports.recent(group, 5))
		const sent = await this.#sendReport('group', group, { ...o, subject, messages })
		if (o.leave) await this.groups.leave(group)
		return { ...sent, left: !!o.leave }
	}
	/** Report a channel (`unfollow: true` leaves it afterwards). */
	async reportChannel(
		channel: string,
		o: report.ReportOptions & { unfollow?: boolean; withMessages?: boolean } = {},
	): Promise<{ reportId?: string }> {
		const subject = o.subject ?? (await this.newsletters.metadata('jid', channel)).name ?? ''
		const messages =
			o.messages ?? (o.withMessages === false ? [] : this.#reports.recent(channel, 5))
		const sent = await this.#sendReport('newsletter', channel, { ...o, subject, messages })
		if (o.unfollow) await this.newsletters.unfollow(channel)
		return sent
	}
	/** Tell a group's admins about a message (it shows in their "reported messages"). */
	async reportToAdmins(group: string, messageId: string): Promise<void> {
		const { receiver } = await this.#live()
		await receiver.request(report.reportToAdmins(group, receiver.nextId(), messageId))
	}
	/** Group setting: may members report messages to the admins? */
	async setMemberReportsAllowed(group: string, allow: boolean): Promise<void> {
		const { receiver } = await this.#live()
		await receiver.request(report.setMemberReports(group, receiver.nextId(), allow))
	}

	/** Ask a contact to pay (`amount1000` is thousandths of the currency unit). */
	requestPayment = (to: string, p: payments.PaymentRequestInput) =>
		this.sendMessage(to, payments.requestPayment(to, p))
	/** Answer a payment request with a payment note. */
	sendPaymentNote = (
		to: string,
		request: MessageKey,
		o?: { note?: string; transactionData?: string },
	) => this.sendMessage(to, payments.sendPayment(request, o))
	declinePaymentRequest = (to: string, request: MessageKey) =>
		this.sendMessage(to, payments.declinePaymentRequest(request))
	cancelPaymentRequest = (to: string, request: MessageKey) =>
		this.sendMessage(to, payments.cancelPaymentRequest(request))
	/** Payments account settings (passkey, recovery check, UPI onboarding). */
	readonly payments: payments.Payments = new payments.Payments((q, v, p) => this.mex(q, v, p))

	#wamSeq = 0
	/** Report usage-statistics events (WAM) the way WhatsApp Web does. `name`s are in `WAM_EVENTS`. */
	async sendWam(events: WamEvent[]): Promise<void> {
		const { receiver } = await this.#live()
		const buffer = encodeWam(events, this.#wamSeq)
		this.#wamSeq = (this.#wamSeq + 1) & 0xffff
		await receiver.request({
			tag: 'iq',
			attrs: { to: 's.whatsapp.net', type: 'set', xmlns: 'w:stats' },
			content: [
				{ tag: 'add', attrs: { t: String(Math.round(Date.now() / 1000)) }, content: buffer },
			],
		})
	}
	/** Send a quiz: a single-choice poll with a right answer (`correctAnswer` must be one of `values`). */
	async sendQuiz(
		to: string,
		name: string,
		values: string[],
		correctAnswer: string,
	): Promise<string> {
		const { sender } = await this.#live()
		const p = extras.poll(name, values, 1, { correctAnswer })
		return sender.sendMessage(to, p.message, p.opts)
	}
	/**
	 * Channel poll or quiz whose options are images (`images[i]` belongs to `values[i]`). Like the phone, every option
	 * image goes out first as its own post pointing at the poll's id, then the poll itself.
	 */
	async sendImagePoll(
		to: string,
		name: string,
		values: string[],
		images: Uint8Array[],
		o: { correctAnswer?: string } = {},
	): Promise<string> {
		if (images.length !== values.length) throw new Error('one image per option')
		const { sender, meId } = await this.#live()
		const conn = await this.#getMediaConn()
		const parentId = generateMessageId(meId)
		const hashes: string[] = []
		for (const [i, img] of images.entries()) {
			const raw = media.rawMedia(img)
			const uploaded = await media.uploadMedia(conn, 'image', raw, fetch, true)
			hashes.push(media.pollOptionHash(values[i]!, raw.fileSha256))
			await sender.sendMessage(
				to,
				{
					pollCreationOptionImageMessage: {
						message: {
							imageMessage: {
								url: uploaded.url,
								directPath: uploaded.directPath,
								fileSha256: raw.fileSha256,
								fileLength: raw.fileLength,
								mimetype: 'image/jpeg',
								caption: values[i],
								...(uploaded.thumbnail && {
									thumbnailDirectPath: uploaded.thumbnail.directPath,
									thumbnailSha256: uploaded.thumbnail.sha256,
								}),
								contextInfo: { mediaDomainInfo: { mediaKeyDomain: 'MEDIA_KEY_DOMAIN_NON_E2EE' } },
							},
						},
					},
					messageContextInfo: {
						messageAssociation: {
							associationType: 'MEDIA_POLL',
							parentMessageKey: { remoteJid: to, fromMe: true, id: parentId },
						},
					},
				},
				{ encAttrs: { mediatype: 'image' } },
			)
		}
		const p = extras.poll(name, values, 1, { ...o, optionImageHashes: hashes })
		return sender.sendMessage(to, p.message, { ...p.opts, messageId: parentId })
	}
	/** Send a question (the audience answers in a box). */
	async sendQuestion(to: string, text: string): Promise<string> {
		const { sender } = await this.#live()
		const q = extras.question({
			extendedTextMessage: { text, previewType: 'NONE', contextInfo: { isQuestion: true } },
		})
		return sender.sendMessage(to, q.message, q.opts)
	}
	sendQuestionImage = (to: string, data: Uint8Array, question: string, opts: MediaOptions = {}) =>
		this.sendMedia(to, 'image', data, { ...opts, caption: question, isQuestion: true })
	/** Send a video with a song attached (the app's "music" post; the video is what plays). */
	sendMusic = (to: string, video: Uint8Array, music: extras.MusicInfo, opts: MediaOptions = {}) => {
		const parts = extras.musicParts(music)
		return this.sendMedia(to, 'video', video, {
			...opts,
			contextInfo: { ...opts.contextInfo, ...parts.contextInfo },
			fields: { ...opts.fields, ...parts.fields },
			// Only channels carry the song marker; in a group it is rejected.
			...(to.endsWith('@newsletter') && {
				extraNodes: [{ tag: 'meta', attrs: { contenttype: 'song' } }],
			}),
		})
	}
	async sendLocation(
		to: string,
		latitude: number,
		longitude: number,
		o: { name?: string; address?: string } = {},
	) {
		return this.sendMessage(to, extras.location(latitude, longitude, o))
	}
	async sendContact(to: string, name: string, phoneE164: string) {
		return this.sendMessage(to, extras.contactCard(name, extras.vcardFor(name, phoneE164)))
	}
	/** Decline an incoming call (`call.callId`, `call.creator ?? call.from`). */
	async rejectCall(callId: string, callCreator: string): Promise<void> {
		const { receiver } = await this.#live()
		receiver.sendNode(callEvents.rejectCall(callId, callCreator, receiver.nextId()))
	}
	/** Set our own profile picture (square JPEG), or a group's when `jid` is given. */
	updateProfilePicture = (jpeg: Uint8Array, jid?: string) =>
		contacts.updateProfilePicture(this.#q, jpeg, jid)
	removeProfilePicture = (jid?: string) => contacts.removeProfilePicture(this.#q, jid)

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

	/**
	 * Log this device out of the account: tell WhatsApp to unlink it, then close. The phone shows the device gone from
	 * "Linked devices". `deleteAuth` also erases the saved login (credentials, Signal keys, app-state) from `authDir`;
	 * without it the files stay, but they no longer work.
	 */
	async logout(o: { deleteAuth?: boolean } = {}): Promise<void> {
		const me = this.#creds.me?.id
		if (me) {
			const { receiver } = await this.#live()
			// the server may close the socket before it answers
			await receiver.request(removeDeviceNode(me)).catch(() => undefined)
		}
		this.close('logged-out')
		if (o.deleteAuth) {
			rmSync(this.#credsPath, { force: true })
			rmSync(this.#signalDir, { recursive: true, force: true })
			rmSync(join(this.#signalDir, '..', 'app-state'), { recursive: true, force: true })
		}
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
		this.#www.invalidate()
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
				this.#events.emit('connection', {
					state: willReconnect ? 'connecting' : 'close',
					reason,
					...(code !== undefined && { code }),
					willReconnect,
					loggedOut: reason === 'logged-out',
				})
				if (willReconnect) setTimeout(() => !this.#stopped && this.#start(), 1000)
				else this.logger.close('disconnect', { code, reason })
			},
		})
		this.#conn = conn
		this.#events.emit('connection', { state: 'connecting' })
		conn.connect()
	}

	#handle(conn: Connection, node: BinaryNode): void {
		if (this.#receiver?.handle(node)) return
		const child = (tag: string) =>
			Array.isArray(node.content) ? node.content.find((c) => c.tag === tag) : undefined

		if (node.tag === 'presence' || node.tag === 'chatstate') {
			const p = parsePresence(node)
			if (p) this.#events.emit('presence', p)
			return
		}
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
			const phone = this.#options.pairWithPhoneNumber
			if (phone) {
				// Pairing-code mode: no QR; ask the phone for a code instead.
				if (!this.#pairing) {
					const code = generatePairingCode()
					this.#pairing = { phone, code }
					void companionHello(this.#creds, phone, code)
						.then((hello) => {
							conn.send({
								...hello,
								attrs: { ...hello.attrs, id: `pc-${Date.now().toString(36)}` },
							})
							this.logger.event('pairing-code.requested', { phone })
							this.#events.emit('pairing-code', { code })
							this.#events.emit('connection', { state: 'connecting', pairingCode: code })
						})
						.catch((error) => this.logger.event('pairing-code.error', error))
				}
				return
			}
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
				this.#events.emit('connection', { state: 'connecting', qr })
				this.#qrTimer = setTimeout(next, ms)
				ms = 20_000
			}
			next()
			return
		}
		if (
			node.tag === 'notification' &&
			node.attrs['type'] === 'link_code_companion_reg' &&
			this.#pairing
		) {
			conn.send({
				tag: 'ack',
				attrs: {
					id: node.attrs['id'] ?? '',
					to: node.attrs['from'] ?? '',
					class: 'notification',
					type: 'link_code_companion_reg',
				},
			})
			const p = this.#pairing
			void companionFinish(node, this.#creds, p.phone, p.code)
				.then((r) => {
					if (!r) return this.logger.event('pairing-code.empty-notification')
					this.#creds.advSecretKey = r.advSecretKey
					saveAuthCreds(this.#credsPath, this.#creds)
					conn.send({
						...r.finish,
						attrs: { ...r.finish.attrs, id: `pf-${Date.now().toString(36)}` },
					})
					this.logger.event('pairing-code.finish-sent')
				})
				.catch((error) => this.logger.event('pairing-code.error', error))
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
				this.#events.emit('connection', { state: 'connecting', newLogin: true })
				conn.send(reply)
			} catch (error) {
				this.logger.event('pair.error', error)
				conn.close('pair-verification-failed')
			}
			return
		}
		if (node.tag === 'success') {
			const t = Number(node.attrs['t'])
			if (t > 1_000_000_000) this.#serverOffsetMs = t * 1000 - Date.now()
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
		this.#signalStorage = storage
		const cipher = createSignalCipher(storage)
		const lids = new LidMap(join(this.#signalDir, 'lid-map.json'))
		if (creds.me?.lid) lids.set(creds.me.id, creds.me.lid)
		const receiver = new Receiver({
			creds,
			saveCreds: () => saveAuthCreds(this.#credsPath, creds),
			storage,
			lids,
			cipher,
			logger: this.logger,
			send: (n) => conn.send(n),
			onMessage: (m) => {
				this.#reports.add({
					id: m.id,
					t: m.timestamp ?? Math.floor(Date.now() / 1000),
					fromMe: false,
					chat: m.from,
					...(m.participant && { participant: m.participant }),
					message: m.message,
					...(m.reporting && { reporting: m.reporting }),
					// The key is derived with our JID in the same addressing as the sender's.
					...(this.#creds.me && {
						meId: (m.from.endsWith('@g.us')
							? m.from
							: (m.participant ?? m.from).endsWith('@lid') && this.#creds.me.lid
								? this.#creds.me.lid
								: this.#creds.me.id
						).replace(/:\d+@/, '@'),
					}),
				})
				this.#events.emit('message', m)
			},
			onHistory: (n) => {
				void loadHistory(n)
					.then((chunk) => {
						this.logger.event('history.chunk', {
							syncType: chunk.syncType,
							progress: chunk.progress,
							chats: chunk.chats.length,
							messages: chunk.chats.reduce((a, c) => a + c.messages.length, 0),
						})
						for (const m of chunk.lidMappings) lids.set(m.pn, m.lid)
						this.#events.emit('history', chunk)
					})
					.catch((error) => this.logger.event('history.error', error))
			},
			onChannelStatus: (node) => {
				const T = protoType('Message')
				const e = parseChannelStatus(node, (b) =>
					T.toObject(T.decode(b), { longs: String, enums: String }),
				)
				if (e) this.#events.emit('channel.status', e)
			},
			onCall: (node) => {
				const c = callEvents.parseCall(node)
				if (c) this.#trackCall(c, node)
				if (c) this.#events.emit('call', c)
			},
			onReceipt: (node) => {
				// Receipts are keyed by (chat, id): a bare id is not unique across chats.
				if (node.attrs['from']) this.#events.emit('receipt', parseReceipt(node))
				if (node.attrs['type'] === 'retry' && node.attrs['from'])
					void this.#sender
						?.handleRetryReceipt(node)
						.catch((e) => this.logger.event('retry.error', e))
			},
			onUndecryptable: (key) => {
				this.#events.emit('message.undecryptable', { key })
				if (!this.#autoRecover) return
				// At most 10 requests a minute: a burst of broken messages must not flood the phone.
				const now = Date.now()
				this.#recoverTimes = this.#recoverTimes.filter((t) => now - t < 60_000)
				if (this.#recoverTimes.length >= 10) return
				this.#recoverTimes.push(now)
				void this.requestPlaceholderResend(key).catch((e) =>
					this.logger.event('recover.resend-failed', e),
				)
			},
			onResentMessage: (bytes) => {
				const t = protoType('WebMessageInfo')
				const w = t.toObject(t.decode(bytes), { bytes: Buffer, longs: Number }) as {
					key?: MessageKey
					message?: Record<string, unknown>
					messageTimestamp?: number
				}
				if (w.key && w.message)
					this.#events.emit('message.resent', {
						key: w.key,
						message: w.message,
						...(w.messageTimestamp !== undefined && { timestamp: Number(w.messageTimestamp) }),
					})
			},
			onAppStateKeys: (keys) => {
				this.#appState?.addKeys(keys)
				void this.#appState?.sync()
			},
			onNotification: (node) => {
				const type = node.attrs['type'] ?? ''
				this.#events.emit('notification', { type, node })
				if (type === 'privacy_token') {
					const from = node.attrs['sender_lid'] ?? node.attrs['from'] ?? ''
					this.#tcTokens.storeFrom(node, from.replace(/:\d+@/, '@'))
				}
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
			onMissingKeys: (ids) => {
				void this.#sender
					?.sendPeerMessage({
						protocolMessage: {
							type: 'APP_STATE_SYNC_KEY_REQUEST',
							appStateSyncKeyRequest: { keyIds: ids.map((keyId) => ({ keyId })) },
						},
					})
					.catch((e) => this.logger.event('appstate.key-request-failed', e))
			},
		})
		this.#sender = new Sender({
			creds,
			storage,
			lids,
			cipher,
			receiver,
			logger: this.logger,
			senderKeyMemoryPath: join(this.#signalDir, 'sender-key-memory.json'),
			tc: this.#tcTokens,
			onSent: (id, to, m) => {
				receiver.rememberOwn(id, to, m)
				this.#reports.add({
					id,
					t: Math.floor(Date.now() / 1000),
					fromMe: true,
					chat: to,
					message: m,
				})
			},
			...(this.antiban && {
				gate: (to, m) => this.antiban!.gate(to, AntiBan.signature(signatureOf(m))),
			}),
		})
		try {
			await receiver.request({
				tag: 'iq',
				attrs: { to: 's.whatsapp.net', type: 'set', xmlns: 'passive' },
				content: [{ tag: 'active', attrs: {} }],
			})
			await receiver.ensurePreKeys()
			// Always try: with no key yet this only discovers which keys to ask the phone for.
			void this.#appState.sync()
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
		// A key of unknown age (a creds file from before the timestamp existed) counts as due.
		if (!creds.signedPreKeyAt || Date.now() - creds.signedPreKeyAt >= SIGNED_PRE_KEY_INTERVAL_MS)
			void this.rotateSignedPreKey().catch((e) => this.logger.event('prekey.rotate-failed', e))
		this.#events.emit('connection', { state: 'open' })
	}
}
