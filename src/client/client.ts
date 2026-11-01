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
	blockUser = (jid: string) => contacts.updateBlockStatus(this.#q, jid, 'block')
	unblockUser = (jid: string) => contacts.updateBlockStatus(this.#q, jid, 'unblock')
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
			onMessage: (m) => this.#events.emit('message', m),
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
			onSent: (id, to, m) => receiver.rememberOwn(id, to, m),
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
