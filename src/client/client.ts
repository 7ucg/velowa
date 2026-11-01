import { randomBytes } from 'node:crypto'
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
import { AntiBan } from './antiban.js'
import type { AntiBanConfig } from './antiban.js'
import { Sender, generateMessageId } from './sender.js'
import type { SendOptions } from './sender.js'
import { AppStateSync, interpret } from './features/appstate-sync.js'
import * as act from './features/chat-actions.js'
import type { RangeMessage } from './features/chat-actions.js'
import type { AppStateEvent, ChatUpdate, ContactUpdate } from './features/appstate-sync.js'
import * as contacts from './features/contacts.js'
import * as extras from './features/extras.js'
import * as interactiveMsg from './features/interactive.js'
import { parsePresence, parseReceipt } from './features/events.js'
import type { PresenceEvent, ReceiptEvent } from './features/events.js'
import * as business from './features/business.js'
import { Communities } from './features/communities.js'
import { LidMap } from './lid-map.js'
import { companionFinish, companionHello, generatePairingCode } from './features/pairing-code.js'
import {
	Groups,
	memberLabelMessage,
	parseGroupNotification,
	setGroupProperty,
} from './features/groups.js'
import { loadHistory } from './features/history.js'
import type { HistoryChunk } from './features/history.js'
import { mexFor } from './features/mex.js'
import { fetchLinkPreview, linkPreviewMessage } from './features/link-preview.js'
import { Newsletters, parseChannelStatus } from './features/newsletters.js'
import type { ChannelStatusEvent } from './features/newsletters.js'
import { Usernames } from './features/username.js'
import type { GroupNotification } from './features/groups.js'
import * as media from './features/media.js'
import type { MediaOptions, MediaType } from './features/media.js'
import * as msg from './features/messages.js'
import { MediaSession } from './call-media.js'
import {
	GroupSession,
	buildGroupEncRekey,
	buildGroupOffer,
	ensureVoipWasm,
	parseGroupEncRekey,
} from '../voip-wasm.js'
import { encodeNode } from '../codec/index.js'
import * as callSig from './features/calls.js'
import * as buttons from './features/buttons.js'
import { richResponse } from './features/rich-response.js'
import type { RichResponseOptions } from './features/rich-response.js'
import * as report from './features/report.js'
import * as payments from './features/payments.js'
import { encodeWam } from '../wam/index.js'
import type { WamEvent } from '../wam/index.js'
import { protoType } from './proto.js'
import type { ChatState, MessageKey, ReceiptType, TextOptions } from './features/messages.js'

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
}

/** Everything a consumer can listen for. Payloads are plain data. */
export type ClientEvents = {
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
	call: extras.CallEvent
	/** A channel status (or a reaction / edit / revoke of one) pushed by the server. */
	'channel.status': ChannelStatusEvent
	/** A chunk of chat history announced by the phone after linking (chats, messages, push names). */
	history: HistoryChunk
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
	participants: unknown
}

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
	#pairing: { phone: string; code: string } | undefined
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

	/** Send a raw stanza (an `iq`) and wait for its answer: the escape hatch for anything not wrapped yet. */
	request = async (node: BinaryNode): Promise<BinaryNode> =>
		(await this.#live()).receiver.request(node)

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

	/** Resolve once the phone has shared the app-state keys (needed for chat actions); false on timeout. */
	async waitForAppState(timeoutMs = 30_000): Promise<boolean> {
		const t0 = Date.now()
		while (Date.now() - t0 < timeoutMs) {
			if ((this.#appState?.keyCount ?? 0) > 0) return true
			await new Promise((r) => setTimeout(r, 500))
		}
		return false
	}

	/** Group management: `client.groups.create(...)`, `.updateParticipants(...)`, `.metadata(...)`, ... */
	readonly groups: Groups = new Groups(async (node) => (await this.#live()).receiver.request(node))

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
	readonly communities: Communities = new Communities(async (node) =>
		(await this.#live()).receiver.request(node),
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
		} = {},
	): Promise<callSig.CallState> {
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
					...(o.videoFrames && { video: { frames: o.videoFrames } }),
					...(o.recordVideoTo && { recordVideoTo: o.recordVideoTo }),
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
	#groupCallTraffic(c: extras.CallEvent, node: BinaryNode): void {
		const st = this.#calls.get(c.callId)
		const action = Array.isArray(node.content) ? node.content[0] : undefined
		if (!st?.groupSession || !action) return
		if (c.status === 'group_update') {
			try {
				const summary = st.groupSession.applyUpdate(encodeNode(action)) as GroupSummary
				if (summary.applied === 'applied') {
					if (st.groupEngine) st.groupSession.pushToEngine(st.groupEngine, performance.now())
					void this.#startGroupMedia(st, summary, {}).catch((e: unknown) =>
						this.logger.event('call.group-error', e),
					)
				}
			} catch (e) {
				this.logger.event('call.group-update-failed', e)
			}
		} else if (c.status === 'enc_rekey' && st.direction === 'incoming') {
			void this.#installEpoch(st, action).catch((e: unknown) =>
				this.logger.event('call.epoch-failed', e),
			)
		}
	}

	/** Decrypt a shared key delivered to us and give it to the engine. */
	async #installEpoch(st: callSig.CallState, action: BinaryNode): Promise<void> {
		const { receiver } = await this.#live()
		const r = parseGroupEncRekey(encodeNode(action)) as {
			transaction_id: number
			enc_type: string
			ciphertext: number[]
		}
		const raw = await receiver.decryptCallKey(st.creator, r.enc_type, Uint8Array.from(r.ciphertext))
		if (!raw) throw new Error('the epoch envelope holds no key')
		st.groupEngine?.applyGroupEpoch(r.transaction_id, raw)
		st.epochTx = r.transaction_id
	}

	#trackCall(c: extras.CallEvent, node?: BinaryNode): void {
		if (node && (c.status === 'group_update' || c.status === 'enc_rekey'))
			this.#groupCallTraffic(c, node)
		const userOf = (jid: string): string => jid.split('@')[0]!.replace(/[:.]\d+$/, '')
		const st = this.#calls.get(c.callId)
		if (st) {
			// Only the other side of this very call may move it: a stanza from anyone else (or from a different
			// account that guessed the call id) is ignored.
			const allowed = st.group ? c.from === st.group : userOf(c.from) === userOf(st.peer)
			if (!allowed) {
				this.logger.event('call.ignored-stanza', {
					callId: c.callId,
					from: c.from,
					status: c.status,
				})
				return
			}
			if (c.status === 'preaccept' || c.status === 'ringing') st.status = 'ringing'
			else if (c.status === 'accept') {
				st.status = 'connected'
				// The answering device's LID decides the keys we receive with.
				st.media?.rekeyRecv(c.from)
			} else if (c.status === 'reject' || c.status === 'terminate') this.#finishCall(st, c.status)
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
			...(c.isGroup && { group: c.from }),
			...(node && { offer: node, offerFrom: c.from }),
		})
		this.#pruneCalls()
	}

	/** Mark a call over: stop its media, forget its key. */
	#finishCall(st: callSig.CallState, reason: string): void {
		st.status = 'ended'
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
		} = {},
	): Promise<callSig.CallState> {
		const c = this.#calls.get(callId)
		if (!c || c.direction !== 'incoming' || !c.offer) throw new Error(`no incoming call ${callId}`)
		if (c.group) throw new Error('group calls are not supported yet')
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
			...(o.videoFrames && { video: { frames: o.videoFrames } }),
			...(o.recordVideoTo && { recordVideoTo: o.recordVideoTo }),
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
			audioIn?: Int16Array
			recordTo?: string
		} = {},
	): Promise<callSig.CallState> {
		const { sender, receiver } = await this.#live()
		const own = this.#creds.me?.lid
		if (!own) throw new Error('no own LID yet; wait for the login to finish')
		ensureVoipWasm()
		const ownUser = own.replace(/:\d+@/, '@')
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
		const devices = await sender.getDevices(users)
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
		}
		this.#calls.set(callId, state)
		try {
			const ack = await receiver.sendCallAndWait(offer)
			const summary = session.applyAck(encodeNode(ack)) as GroupSummary
			await this.#startGroupMedia(state, summary, o)
		} catch (e) {
			this.#finishCall(state, 'failed')
			throw e
		}
		return state
	}

	/** Build the group engine once the server gave us a relay, then deliver the shared key where it is owed. */
	async #startGroupMedia(
		state: callSig.CallState,
		summary: GroupSummary,
		o: { audioIn?: Int16Array; recordTo?: string },
	): Promise<void> {
		const session = state.groupSession!
		if (!summary.relay_endpoint) throw new Error('the group call has no relay yet')
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
			})
			state.media = media
			media.start()
		}
		await this.#groupEpoch(state, summary)
	}

	/** If the server asked for a shared key (and we are the creator), send it to every connected device. */
	async #groupEpoch(state: callSig.CallState, summary: GroupSummary): Promise<void> {
		if (!summary.rekey_requested && !summary.rekey_owed) return
		if (state.direction !== 'outgoing' || !summary.transaction_id) return
		if (state.epochTx !== undefined && state.epochTx >= summary.transaction_id) return
		const { sender, receiver } = await this.#live()
		const raw = new Uint8Array(randomBytes(32))
		const keys = summary.epoch_recipients.length
			? await sender.encryptForDevices(summary.epoch_recipients, { call: { callKey: raw } })
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

	/** Hang up a call we placed or answered (also cancels one that is still ringing). */
	async endCall(callId: string): Promise<void> {
		const c = this.#calls.get(callId)
		if (!c) throw new Error(`unknown call ${callId}`)
		const { receiver } = await this.#live()
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
		receiver.sendNode(extras.rejectCall(callId, callCreator, receiver.nextId()))
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
				const c = extras.parseCall(node)
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
	}
}
