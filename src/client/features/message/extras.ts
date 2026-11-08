// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto'
import { protoType } from '../../proto.js'
import type { SendOptions } from '../../sender.js'
import type { MessageKey } from './messages.js'

/** `MessageKey` as the wire shape most of these builders' `key`/`targetMessageKey` fields want. */
const wireKey = (key: MessageKey) => ({
	remoteJid: key.remoteJid,
	fromMe: key.fromMe ?? false,
	id: key.id,
	...(key.participant && { participant: key.participant }),
})

/** A poll. Voters' answers are end-to-end encrypted with the poll's `messageSecret` (added automatically on send). */
export function poll(
	name: string,
	values: string[],
	selectableCount = 1,
	o: PollOptions = {},
): { message: Record<string, unknown>; opts: SendOptions } {
	if (!name.trim()) throw new Error('poll needs a question')
	if (values.length < 2 || values.length > 12) throw new Error('a poll needs 2 to 12 options')
	if (new Set(values).size !== values.length) throw new Error('poll options must be unique')
	if (selectableCount < 0 || selectableCount > values.length) {
		throw new Error(`selectableCount must be between 0 and ${values.length}`)
	}
	const quiz = o.correctAnswer !== undefined
	if (quiz && !values.includes(o.correctAnswer!))
		throw new Error('correctAnswer must be one of the options')
	if (quiz && selectableCount !== 1) throw new Error('a quiz has exactly one selectable answer')
	if (o.optionImageHashes && o.optionImageHashes.length !== values.length)
		throw new Error('optionImageHashes needs one hash per option')
	const image = !!o.optionImageHashes
	const option = (optionName: string) => ({
		optionName,
		...(o.optionImageHashes && { optionHash: o.optionImageHashes[values.indexOf(optionName)] }),
	})
	const creation = {
		name,
		selectableOptionsCount: selectableCount,
		options: values.map(option),
		...(image && { pollContentType: 'IMAGE' }),
		pollType: quiz ? 'QUIZ' : 'POLL',
		...(quiz && { correctAnswer: option(o.correctAnswer!) }),
	}
	// Quizzes and image polls use the V5 field (what the phone sends); plain single-choice polls the V3 field,
	// multiple choice the original one (as WhatsApp Web does).
	const field =
		quiz || image
			? 'pollCreationMessageV5'
			: selectableCount === 1
				? 'pollCreationMessageV3'
				: 'pollCreationMessage'
	return {
		message: { messageContextInfo: { messageSecret: randomBytes(32) }, [field]: creation },
		// `contenttype` is only read for channel posts; chats ignore it.
		opts: {
			extraNodes: [
				{
					tag: 'meta',
					attrs: {
						polltype: quiz ? 'quiz_creation' : 'creation',
						contenttype: image ? 'image' : 'text',
					},
				},
			],
		},
	}
}

export interface PollOptions {
	/** Turns the poll into a quiz: this option is the right answer. */
	correctAnswer?: string
	/** Image polls: hex SHA-256 of each option's (already uploaded) image, in option order. */
	optionImageHashes?: string[]
}

/** A question post (the audience answers in a box). `inner` is a text or image message. */
export function question(inner: Record<string, unknown>): {
	message: Record<string, unknown>
	opts: SendOptions
} {
	return {
		message: { questionMessage: { message: inner } },
		opts: { extraNodes: [{ tag: 'meta', attrs: { questiontype: 'question' } }] },
	}
}

/**
 * The song itself must already be in the video's audio track; the music card (title, cover) comes from `catalog`.
 */
export interface MusicInfo {
	title: string
	author: string
	songId: string
	artistAttribution?: string
	isExplicit?: boolean
	/** Where the shared snippet starts, in milliseconds. */
	startTimeMs?: number
	/**
	 * Catalog data of the song (`musicContentMediaId`, `artworkDirectPath`, `artworkSha256`, `artworkEncSha256`,
	 * `countryBlocklist`, ...). Only WhatsApp's music catalog hands these out; copy them from a received music
	 * post (`annotations[0].embeddedContent.embeddedMusic`) to re-post the same song.
	 */
	catalog?: Record<string, unknown>
}

/** `contextInfo` and extra video fields for a video that carries a song (what the app's "music" post looks like). */
export function musicParts(m: MusicInfo): {
	contextInfo: Record<string, unknown>
	fields: Record<string, unknown>
} {
	const music = {
		songId: m.songId,
		title: m.title,
		author: m.author,
		artistAttribution: m.artistAttribution,
		isExplicit: m.isExplicit ?? false,
	}
	return {
		contextInfo: {
			forwardingScore: 0,
			featureEligibilities: { canBeReshared: true },
			pairedMediaType: 'NOT_PAIRED_MEDIA',
			statusSourceType: 'MUSIC_STANDALONE',
			statusAttributions: [{ type: 'MUSIC', music }],
		},
		// `annotations` is a field of the video itself, not of its contextInfo.
		fields: {
			accessibilityLabel: 'Music sticker',
			annotations: [
				{
					// The music sticker sits in the middle of the frame.
					polygonVertices: [
						{ x: 0.175, y: 0.3377 },
						{ x: 0.825, y: 0.3377 },
						{ x: 0.825, y: 0.6623 },
						{ x: 0.175, y: 0.6623 },
					],
					shouldSkipConfirmation: true,
					embeddedContent: {
						embeddedMusic: {
							...music,
							...m.catalog,
							musicSongStartTimeInMs: m.startTimeMs ?? 0,
							overlapDurationInMs: 30000,
						},
					},
					embeddedAction: true,
				},
			],
		},
	}
}

/** `contextInfo` every group status carries (who posted it, that it is a group status, a random poster id). */
export function groupStatusContext(
	authorLid: string,
	sourceType: string,
	attributions: unknown[] = [],
): Record<string, unknown> {
	return {
		forwardingScore: 0,
		featureEligibilities: {
			cannotBeRanked: false,
			canBeReshared: false,
			canReceiveMultiReact: true,
		},
		statusSourceType: sourceType,
		statusAttributions: [
			{ type: 'GROUP_STATUS', groupStatus: { authorJid: authorLid } },
			...attributions,
		],
		isGroupStatus: true,
		posterStatusId: randomBytes(32).toString('base64'),
	}
}

/** A group status: the inner message wrapped, plus the `is_group_status` stanza marker. */
export function groupStatus(inner: Record<string, unknown>): {
	message: Record<string, unknown>
	opts: SendOptions
} {
	return {
		message: { groupStatusMessageV2: { message: inner } },
		opts: { extraNodes: [{ tag: 'meta', attrs: { is_group_status: 'true' } }] },
	}
}

/** Wrap a message so it can be opened once (`v2` is what current clients send). */
export const viewOnce = (message: Record<string, unknown>): Record<string, unknown> => ({
	viewOnceMessageV2: { message },
})

export const location = (
	latitude: number,
	longitude: number,
	o: { name?: string; address?: string } = {},
): Record<string, unknown> => ({
	locationMessage: { degreesLatitude: latitude, degreesLongitude: longitude, ...o },
})

/** A shared contact card from a vCard string. */
export const contactCard = (displayName: string, vcard: string): Record<string, unknown> => ({
	contactMessage: { displayName, vcard },
})

/** Minimal vCard for a phone number. */
export function vcardFor(name: string, phoneE164: string): string {
	const digits = phoneE164.replace(/[^\d]/g, '')
	return `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL;type=VOICE;waid=${digits}:+${digits}\nEND:VCARD`
}

// ---- poll votes -------------------------------------------------------------------------------

/** WhatsApp identifies poll options by the SHA-256 of their text. */
export const pollOptionHash = (name: string): string =>
	createHash('sha256').update(name).digest('hex')

/**
 * Decrypt a poll vote (`pollUpdateMessage.vote`): AES-256-GCM with
 * `key = HKDF(pollSecret, salt = 0x00*32, info = pollId || creator || voter || "Poll Vote")`,
 * `aad = pollId || 0x00 || voter`. Returns the selected options as lowercase hex SHA-256 hashes.
 */
export function decryptPollVote(
	vote: { encPayload: Uint8Array; encIv: Uint8Array },
	ctx: { pollCreatorJid: string; pollMsgId: string; pollSecret: Uint8Array; voterJid: string },
): string[] {
	if (vote.encPayload.length < 17) throw new Error('poll vote too short')
	const info = Buffer.concat([
		Buffer.from(ctx.pollMsgId),
		Buffer.from(ctx.pollCreatorJid),
		Buffer.from(ctx.voterJid),
		Buffer.from('Poll Vote'),
	])
	const key = Buffer.from(hkdfSync('sha256', ctx.pollSecret, Buffer.alloc(32), info, 32))
	const d = createDecipheriv('aes-256-gcm', key, vote.encIv)
	d.setAAD(Buffer.from(`${ctx.pollMsgId}\u0000${ctx.voterJid}`))
	d.setAuthTag(Buffer.from(vote.encPayload.subarray(vote.encPayload.length - 16)))
	const plain = Buffer.concat([
		d.update(vote.encPayload.subarray(0, vote.encPayload.length - 16)),
		d.final(),
	])
	const T = protoType('Message.PollVoteMessage')
	const decoded = T.toObject(T.decode(plain), { bytes: Buffer }) as { selectedOptions?: Buffer[] }
	return (decoded.selectedOptions ?? []).map((b) => Buffer.from(b).toString('hex'))
}

// ---- generic forward-compatible wrapper --------------------------------------------------------

/**
 * Many `Message` fields (`spoilerMessage`, `statusAddYours`, `groupMentionedMessage`,
 * `lottieStickerMessage`, `audioStickerMessage`, `botInvokeMessage`, `botTaskMessage`,
 * `botGroupParticipantMessage`, `botPlatformRegistrationSuccessMessage`, `questionReplyMessage`,
 * `newsletterScheduledMessage`, `newsletterAdminProfileMessage`, `newsletterAdminProfileStatusMessage`,
 * `statusMentionMessage`, ...) share one shape on the wire - `FutureProofMessage { message: Message }` - a
 * forward-compatible envelope so older clients ignore the feature instead of choking on it. There is
 * nothing feature-specific to build for any of them beyond this wrap; `field` is the outer field name.
 */
export const futureProofMessage = (
	field: string,
	message: Record<string, unknown>,
): Record<string, unknown> => ({ [field]: { message } })

// ---- product/invoice/location/event/call requests ----------------------------------------------

export interface ProductSnapshot {
	productId?: string
	title?: string
	description?: string
	currencyCode?: string
	priceAmount1000?: number
	retailerId?: string
	url?: string
	productImageCount?: number
	firstImageId?: string
	salePriceAmount1000?: number
	signedUrl?: string
	productImage?: Record<string, unknown>
}

/** Share a catalog product in a chat. */
export function product(
	snapshot: ProductSnapshot,
	o: {
		businessOwnerJid?: string
		catalog?: { title?: string; description?: string; catalogImage?: Record<string, unknown> }
		body?: string
		footer?: string
	} = {},
): Record<string, unknown> {
	return {
		productMessage: {
			product: snapshot,
			...(o.businessOwnerJid && { businessOwnerJid: o.businessOwnerJid }),
			...(o.catalog && { catalog: o.catalog }),
			...(o.body && { body: o.body }),
			...(o.footer && { footer: o.footer }),
		},
	}
}

export interface InvoiceOptions {
	note?: string
	token?: string
	attachmentType?: 'IMAGE' | 'PDF'
	attachmentMimetype?: string
	attachmentMediaKey?: Uint8Array
	attachmentMediaKeyTimestamp?: number
	attachmentFileSha256?: Uint8Array
	attachmentFileEncSha256?: Uint8Array
	attachmentDirectPath?: string
	attachmentJpegThumbnail?: Uint8Array
}

/** A payment invoice (the attachment, when given, must already be uploaded - see `uploadMedia`). */
export const invoice = (o: InvoiceOptions): Record<string, unknown> => ({ invoiceMessage: o })

/** Ask the recipient to share their phone number. */
export const requestPhoneNumber = (
	contextInfo?: Record<string, unknown>,
): Record<string, unknown> => ({
	requestPhoneNumberMessage: { ...(contextInfo && { contextInfo }) },
})

/** Ask the recipient to share their location once. */
export const requestLocation = (
	contextInfo?: Record<string, unknown>,
): Record<string, unknown> => ({
	requestLocationMessage: { ...(contextInfo && { contextInfo }) },
})

/** Ask for a live-location update, or cancel a running request (`key` is the original request's). */
export function requestLocationUpdate(key: MessageKey, cancel = false): Record<string, unknown> {
	return {
		requestLocationUpdateMessage: {
			key: wireKey(key),
			...(cancel && { updateType: 'CANCEL' }),
			senderTimestampMs: Date.now(),
		},
	}
}

/** A standalone music-sharing card (distinct from `musicParts`, which embeds a song sticker in a video). */
export function musicMessage(
	m: MusicInfo & { songUri?: string; artworkUri?: string },
): Record<string, unknown> {
	return {
		musicMessage: {
			embeddedMusic: {
				songId: m.songId,
				title: m.title,
				author: m.author,
				artistAttribution: m.artistAttribution,
				isExplicit: m.isExplicit ?? false,
				...m.catalog,
			},
			...(m.songUri && { songUri: m.songUri }),
			...(m.artworkUri && { artworkUri: m.artworkUri }),
		},
	}
}

export interface EventInviteOptions {
	eventId: string
	eventTitle: string
	jpegThumbnail?: Uint8Array
	startTime?: Date | number
	caption?: string
	isCanceled?: boolean
	endTime?: Date | number
	callLink?: string
	coverImageHandle?: string
	locationName?: string
	status?:
		'ACTIVE' | 'CANCELED' | 'SUSPENDED' | 'DELETED' | 'LEFT_EVENT' | 'REMOVED_FROM_INVITE_LIST'
}

/** Invite someone to an event (distinct from `eventMessage`, which creates the event card itself). */
export function eventInvite(o: EventInviteOptions): Record<string, unknown> {
	return {
		eventInviteMessage: {
			eventId: o.eventId,
			eventTitle: o.eventTitle,
			...(o.jpegThumbnail && { jpegThumbnail: o.jpegThumbnail }),
			...(o.startTime !== undefined && { startTime: seconds(o.startTime) }),
			...(o.caption && { caption: o.caption }),
			...(o.isCanceled !== undefined && { isCanceled: o.isCanceled }),
			...(o.endTime !== undefined && { endTime: seconds(o.endTime) }),
			...(o.callLink && { callLink: o.callLink }),
			...(o.coverImageHandle && { coverImageHandle: o.coverImageHandle }),
			...(o.locationName && { locationName: o.locationName }),
			...(o.status && { status: o.status }),
		},
	}
}

const seconds = (t: Date | number): number => Math.floor(t instanceof Date ? t.getTime() / 1000 : t)

/** Announce a scheduled call. */
export const scheduledCallCreate = (o: {
	scheduledTimestampMs: number
	callType: 'VOICE' | 'VIDEO'
	title?: string
}): Record<string, unknown> => ({
	scheduledCallCreationMessage: {
		scheduledTimestampMs: o.scheduledTimestampMs,
		callType: o.callType,
		...(o.title && { title: o.title }),
	},
})

/** Cancel a previously announced scheduled call. */
export const scheduledCallCancel = (key: MessageKey): Record<string, unknown> => ({
	scheduledCallEditMessage: { key: wireKey(key), editType: 'CANCEL' },
})

/**
 * Add one option to an existing poll (the plain, non-secret-encrypted form of `pollAddOptionMessage`) - one
 * message per option, like the real app.
 */
export const pollAddOption = (
	pollKey: MessageKey,
	optionName: string,
): Record<string, unknown> => ({
	pollAddOptionMessage: {
		pollCreationMessageKey: wireKey(pollKey),
		addOption: { optionName },
	},
})

/** Reply to a `question()` post. */
export const questionResponse = (key: MessageKey, text: string): Record<string, unknown> => ({
	questionResponseMessage: { key: wireKey(key), text },
})

/** Answer a status's question sticker. */
export const statusQuestionAnswer = (key: MessageKey, text: string): Record<string, unknown> => ({
	statusQuestionAnswerMessage: { key: wireKey(key), text },
})

// ---- newsletters/channels -----------------------------------------------------------------------

/** Invite someone to administer a newsletter/channel. */
export const newsletterAdminInvite = (o: {
	newsletterJid: string
	newsletterName?: string
	jpegThumbnail?: Uint8Array
	caption?: string
	inviteExpiration?: number
}): Record<string, unknown> => ({ newsletterAdminInviteMessage: o })

/** Invite someone to follow a newsletter/channel. */
export const newsletterFollowerInvite = (o: {
	newsletterJid: string
	newsletterName?: string
	jpegThumbnail?: Uint8Array
	caption?: string
}): Record<string, unknown> => ({ newsletterFollowerInviteMessageV2: o })

// ---- calls (chat-timeline entries, not VoIP signaling itself) -------------------------------------

/** A business-call message in the chat timeline. */
export const bCall = (o: {
	sessionId: string
	mediaType: 'AUDIO' | 'VIDEO'
	masterKey: Uint8Array
	caption?: string
}): Record<string, unknown> => ({ bcallMessage: o })

/** A call-log entry as a chat-timeline message (distinct from `HistoryChunk.callLogRecords`). */
export const callLogMessage = (o: {
	isVideo?: boolean
	callOutcome?: string
	durationSecs?: number
	callType?: 'REGULAR' | 'SCHEDULED_CALL' | 'VOICE_CHAT'
	participants?: { jid: string; callOutcome?: string }[]
}): Record<string, unknown> => ({ callLogMesssage: o })

// ---- payments ------------------------------------------------------------------------------------
// Builds/parses the wire messages only. WhatsApp Pay itself is region-gated (India/Brazil) and needs a
// business partnership with Meta; without that, sending one of these is not a working payment flow.

/** Notify a recipient that a payment was sent. */
export const sendPaymentMessage = (o: {
	noteMessage?: Record<string, unknown>
	requestMessageKey?: MessageKey
	background?: Record<string, unknown>
	transactionData?: string
}): Record<string, unknown> => ({
	sendPaymentMessage: {
		...(o.noteMessage && { noteMessage: o.noteMessage }),
		...(o.requestMessageKey && { requestMessageKey: wireKey(o.requestMessageKey) }),
		...(o.background && { background: o.background }),
		...(o.transactionData && { transactionData: o.transactionData }),
	},
})

/** Ask a recipient to pay. */
export const requestPaymentMessage = (o: {
	noteMessage?: Record<string, unknown>
	currencyCodeIso4217?: string
	amount1000?: number
	requestFrom?: string
	expiryTimestamp?: number
	amount?: Record<string, unknown>
	background?: Record<string, unknown>
}): Record<string, unknown> => ({ requestPaymentMessage: o })

/** A recurring payment reminder. */
export const paymentReminderMessage = (o: {
	reminderId: string
	instanceId?: string
	description?: string
	frequency?: 'WEEKLY' | 'BI_WEEKLY' | 'MONTHLY' | 'QUARTERLY'
	status?: 'ACTIVE' | 'CANCELLED_BY_CREATOR' | 'STOPPED_BY_RECEIVER' | 'EXPIRED' | 'PAID'
	payeeVpa?: string
	payeeJid?: string
	payerJid?: string
	amount?: Record<string, unknown>
}): Record<string, unknown> => ({ paymentReminderMessage: o })

/** Split a bill among several participants. */
export const splitPaymentMessage = (o: {
	splitId: string
	totalAmount: Record<string, unknown>
	description?: string
	requesterJid?: string
	participants?: Record<string, unknown>[]
	createdAtMs?: number
}): Record<string, unknown> => ({ splitPaymentMessage: o })

/** One participant's status in a split-bill changed. */
export const splitPaymentUpdateMessage = (
	splitId: string,
	participantJid: string,
): Record<string, unknown> => ({ splitPaymentUpdateMessage: { splitId, participantJid } })

/** Invite a recipient to set up a payment method. */
export const paymentInviteMessage = (o: {
	serviceType: 'FBPAY' | 'NOVI' | 'UPI' | 'PIX'
	expiryTimestamp?: number
	incentiveEligible?: boolean
	referralId?: string
	inviteType?: 'DEFAULT' | 'MAPPER'
}): Record<string, unknown> => ({ paymentInviteMessage: o })

/** Decline a payment request. */
export const declinePaymentRequestMessage = (key: MessageKey): Record<string, unknown> => ({
	declinePaymentRequestMessage: { key: wireKey(key) },
})

/** Cancel a payment request we sent. */
export const cancelPaymentRequestMessage = (key: MessageKey): Record<string, unknown> => ({
	cancelPaymentRequestMessage: { key: wireKey(key) },
})
