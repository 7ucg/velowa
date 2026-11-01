import { createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto'
import type { BinaryNode } from '../../codec/index.js'
import { protoType } from '../proto.js'
import type { SendOptions } from '../sender.js'

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

/** Context for a video that carries a song (what the app's "music" post looks like). */
export function musicContext(m: MusicInfo): Record<string, unknown> {
	const music = {
		songId: m.songId,
		title: m.title,
		author: m.author,
		artistAttribution: m.artistAttribution,
		isExplicit: m.isExplicit ?? false,
	}
	return {
		forwardingScore: 0,
		featureEligibilities: { canBeReshared: true },
		pairedMediaType: 'NOT_PAIRED_MEDIA',
		statusSourceType: 'MUSIC_STANDALONE',
		statusAttributions: [{ type: 'MUSIC', music }],
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

// ---- calls ------------------------------------------------------------------------------------

export interface CallEvent {
	/** `offer`, `terminate`, `reject`, `accept`, `timeout`, ... (the call stanza's first child). */
	status: string
	callId: string
	/** The chat / device the call stanza came from. */
	from: string
	/** Who started the call. */
	creator?: string
	isVideo?: boolean
	isGroup?: boolean
	timestamp?: number
}

/** Parse an incoming `<call>` stanza. */
export function parseCall(node: BinaryNode): CallEvent | undefined {
	const info = Array.isArray(node.content) ? node.content[0] : undefined
	if (!info) return undefined
	const callId = info.attrs['call-id']
	if (!callId) return undefined
	const hasVideo = Array.isArray(info.content) && info.content.some((c) => c.tag === 'video')
	return {
		status: info.tag,
		callId,
		from: node.attrs['from'] ?? '',
		...(info.attrs['call-creator'] && { creator: info.attrs['call-creator'] }),
		...(info.tag === 'offer' && { isVideo: hasVideo }),
		...(info.attrs['type'] === 'group' && { isGroup: true }),
		...(node.attrs['t'] &&
			/^\d{1,12}$/.test(node.attrs['t']) && { timestamp: Number(node.attrs['t']) }),
	}
}

/** Decline an incoming call. */
export function rejectCall(callId: string, callCreator: string, id: string): BinaryNode {
	return {
		tag: 'call',
		attrs: { id, to: callCreator },
		content: [
			{ tag: 'reject', attrs: { 'call-id': callId, 'call-creator': callCreator, count: '0' } },
		],
	}
}

/** The ack WhatsApp expects for a call stanza (`class="call"`, `type` = the stanza's first child). */
export function callAck(node: BinaryNode): BinaryNode {
	const first = Array.isArray(node.content) ? node.content[0] : undefined
	return {
		tag: 'ack',
		attrs: {
			id: node.attrs['id'] ?? '',
			to: node.attrs['from'] ?? '',
			class: 'call',
			...(first && { type: first.tag }),
		},
	}
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
