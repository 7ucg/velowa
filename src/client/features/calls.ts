import { randomBytes } from 'node:crypto'
import type { BinaryNode } from '../../codec/index.js'
import type { MediaSession } from '../call-media.js'
import type { GroupSession } from '../../voip-wasm.js'
import type { CallEngine } from '../../voip-wasm.js'

// Call signaling (`<call>` stanzas). Builders follow wacore's stanza/call.rs; child order and attributes matter:
// the server answers 439 for an offer whose children are out of order.

/** Capability blob (ver=1) a client announces in an offer / accept; byte 5 bit 0x80 is the MLow codec. */
export const CAPABILITY_OFFER = Uint8Array.from([0x01, 0x05, 0xf7, 0x09, 0xe0, 0xbb, 0x13])
export const CAPABILITY_VIDEO_OFFER = Uint8Array.from([0x01, 0x05, 0xf7, 0x09, 0xe0, 0xbb, 0x53])
export const CAPABILITY_PREACCEPT = Uint8Array.from([0x01, 0x05, 0xf7, 0x09, 0xe0, 0xbb, 0x07])
/** The same blobs with the MLow bit cleared: we only speak standard Opus on the signaling level. */
const noMlow = (b: Uint8Array): Uint8Array => Uint8Array.from(b, (v, i) => (i === 5 ? v & 0x7f : v))
export const CAPABILITY_STANDARD_OPUS_OFFER = noMlow(CAPABILITY_OFFER)
export const CAPABILITY_STANDARD_OPUS_VIDEO_OFFER = noMlow(CAPABILITY_VIDEO_OFFER)
export const CAPABILITY_STANDARD_OPUS_PREACCEPT = noMlow(CAPABILITY_PREACCEPT)

/** WhatsApp Web's call ids: "00" and 15 random bytes in lowercase hex (32 characters). */
export const newCallId = (): string => '00' + randomBytes(15).toString('hex')

const wrap = (to: string, id: string | undefined, action: BinaryNode): BinaryNode => ({
	tag: 'call',
	attrs: { to, ...(id && { id }) },
	content: [action],
})

const audio = (rate: string): BinaryNode => ({ tag: 'audio', attrs: { enc: 'opus', rate } })
const encopt: BinaryNode = { tag: 'encopt', attrs: { keygen: '2' } }
const capabilityNode = (blob: Uint8Array): BinaryNode => ({
	tag: 'capability',
	attrs: { ver: '1' },
	content: blob,
})
const videoOffer: BinaryNode = {
	tag: 'video',
	attrs: {
		enc: 'h.264',
		dec: 'H264',
		screen_width: '0',
		screen_height: '0',
		device_orientation: '0',
	},
}

export interface OfferDeviceKey {
	jid: string
	type: 'msg' | 'pkmsg'
	ciphertext: Uint8Array
}

export interface OfferOptions {
	callId: string
	/** The callee (user JID, LID form). */
	to: string
	/** Our own device JID (LID form): the call creator and the send-side SRTP participant. */
	creator: string
	keys: OfferDeviceKey[]
	/** The callee has more than one device even if only one key survived: keep the addressed shape. */
	multiDevice?: boolean
	video?: boolean
	/** Announce standard Opus instead of MLow. */
	opus?: boolean
	/** Signaling rates in preference order. */
	audioRates?: string[]
	/** Stanza id; the relay for the media path comes back in the ack to this id. */
	id: string
	privacyToken?: Uint8Array
	deviceIdentity?: Uint8Array
}

const enc = (k: OfferDeviceKey): BinaryNode => ({
	tag: 'enc',
	attrs: { v: '2', type: k.type, count: '0' },
	content: k.ciphertext,
})

/** `<call to id><offer call-id call-creator>`: privacy, audio, [video], net, capability, destination|enc, encopt, device-identity. */
export function buildOffer(o: OfferOptions): BinaryNode {
	const children: BinaryNode[] = []
	if (o.privacyToken) children.push({ tag: 'privacy', attrs: {}, content: o.privacyToken })
	for (const rate of o.audioRates ?? ['16000']) children.push(audio(rate))
	if (o.video) children.push(videoOffer)
	children.push({ tag: 'net', attrs: { medium: '3' } })
	children.push(
		capabilityNode(o.video ? CAPABILITY_STANDARD_OPUS_VIDEO_OFFER : CAPABILITY_STANDARD_OPUS_OFFER),
	)
	if (o.keys.length > 1 || o.multiDevice) {
		children.push({
			tag: 'destination',
			attrs: {},
			content: o.keys.map((k) => ({ tag: 'to', attrs: { jid: k.jid }, content: [enc(k)] })),
		})
	} else if (o.keys[0]) {
		children.push(enc(o.keys[0]))
	}
	children.push(encopt)
	if (o.deviceIdentity)
		children.push({ tag: 'device-identity', attrs: {}, content: o.deviceIdentity })
	return wrap(o.to, o.id, {
		tag: 'offer',
		attrs: { 'call-id': o.callId, 'call-creator': o.creator },
		content: children,
	})
}

/** End a call (either side). One stanza per device the call rang on. */
export const buildTerminate = (
	callId: string,
	to: string,
	creator: string,
	id: string,
	reason?: string,
): BinaryNode =>
	wrap(to, id, {
		tag: 'terminate',
		attrs: { 'call-id': callId, 'call-creator': creator, ...(reason && { reason }) },
	})

/** Decline an incoming call. */
export const buildReject = (callId: string, to: string, creator: string, id: string): BinaryNode =>
	wrap(to, id, {
		tag: 'reject',
		attrs: { 'call-id': callId, 'call-creator': creator, count: '0' },
	})

const VOIP_SETTINGS_OPUS_16K = new TextEncoder().encode(
	'{"encode":{"use_mlow_codec_v1":"false"},"options":{"enable_48khz_rtp_clock":"false"}}',
)

/** Answer a call (standard Opus): audio, [video], net, encopt, capability, voip_settings. */
export function buildAccept(
	callId: string,
	to: string,
	creator: string,
	id: string,
	video = false,
): BinaryNode {
	return wrap(to, id, {
		tag: 'accept',
		attrs: { 'call-id': callId, 'call-creator': creator },
		content: [
			audio('16000'),
			...(video ? [{ tag: 'video', attrs: { dec: 'H264', device_orientation: '0' } }] : []),
			{ tag: 'net', attrs: { medium: '2' } },
			encopt,
			...(video ? [] : [capabilityNode(CAPABILITY_STANDARD_OPUS_OFFER)]),
			{ tag: 'voip_settings', attrs: { uncompressed: '1' }, content: VOIP_SETTINGS_OPUS_16K },
		],
	})
}

/** The callee device is ringing / ready. */
export const buildPreaccept = (
	callId: string,
	to: string,
	creator: string,
	id: string,
	video = false,
): BinaryNode =>
	wrap(to, id, {
		tag: 'preaccept',
		attrs: { 'call-id': callId, 'call-creator': creator },
		content: [
			audio('16000'),
			...(video
				? [
						{
							tag: 'video',
							attrs: {
								dec: 'H264',
								device_orientation: '0',
								screen_width: '0',
								screen_height: '0',
							},
						},
					]
				: []),
			{ tag: 'encopt', attrs: { keygen: '2' } },
			capabilityNode(video ? CAPABILITY_STANDARD_OPUS_OFFER : CAPABILITY_STANDARD_OPUS_PREACCEPT),
		],
	})

export interface CallState {
	callId: string
	/** The other side (user JID). */
	peer: string
	/** The call creator as it appears in the stanzas. */
	creator: string
	direction: 'outgoing' | 'incoming'
	video: boolean
	group?: string
	/** Devices the call rang on / came from; terminate goes to each. */
	devices: string[]
	status: 'calling' | 'ringing' | 'connected' | 'ended'
	startedAt: number
	/** The 32-byte call key (end-to-end media key). */
	callKey?: Uint8Array
	/** The offer stanza as received (incoming calls): its `<enc>` holds the call key. */
	offer?: BinaryNode
	/** The `<call>` wrapper id of the offer, and the device it came from. */
	offerFrom?: string
	/** The server's `<relay>` block from the offer ack (outgoing) or the offer (incoming). */
	relay?: BinaryNode
	/** Group calls: the users (LIDs, no device) who belong in this call; the shared key goes to nobody else. */
	members?: Set<string>
	/** Group calls: the roster the server holds, and the engine the roster feeds. */
	groupSession?: GroupSession
	groupEngine?: CallEngine
	/** The newest shared-epoch transaction we installed. */
	epochTx?: number
	/** The media path (relay socket + engine) once the call has a relay. */
	media?: MediaSession
}

// ---- call links ("rooms") ---------------------------------------------------------------------

export type CallLinkMedia = 'audio' | 'video'

/** `https://call.whatsapp.com/{voice|video}/{token}` */
export const callLinkUrl = (token: string, media: CallLinkMedia): string =>
	`https://call.whatsapp.com/${media === 'video' ? 'video' : 'voice'}/${token}`

const service = (id: string, action: BinaryNode): BinaryNode => ({
	tag: 'call',
	attrs: { to: '@call', id },
	content: [action],
})

export const buildLinkCreate = (media: CallLinkMedia, id: string): BinaryNode =>
	service(id, { tag: 'link_create', attrs: { media } })

/** Call-link tokens are short URL-safe strings (22 characters in practice). */
const TOKEN = /^[A-Za-z0-9_-]{4,64}$/

/**
 * The token of a call link: either the bare token or a `https://call.whatsapp.com/{voice|video}/{token}` URL.
 * Anything else (another host, extra path parts, odd characters) is refused instead of being guessed at.
 */
export function parseCallLinkToken(link: string): string {
	let token = link.trim()
	if (/^[a-z][a-z0-9+.-]*:/i.test(token)) {
		let u: URL
		try {
			u = new URL(token)
		} catch {
			throw new Error('not a call link')
		}
		const segs = u.pathname.split('/').filter(Boolean)
		if (
			u.protocol !== 'https:' ||
			u.hostname !== 'call.whatsapp.com' ||
			segs.length !== 2 ||
			!['voice', 'video'].includes(segs[0]!)
		)
			throw new Error('not a WhatsApp call link')
		token = segs[1]!
	}
	if (!TOKEN.test(token)) throw new Error('invalid call-link token')
	return token
}

export const buildLinkQuery = (token: string, media: CallLinkMedia, id: string): BinaryNode => {
	if (!TOKEN.test(token)) throw new Error('invalid call-link token')
	return service(id, { tag: 'link_query', attrs: { token, media } })
}

export const buildWaitingRoomToggle = (
	callId: string,
	creator: string,
	enabled: boolean,
	id: string,
): BinaryNode =>
	service(id, {
		tag: 'waiting_room_toggle',
		attrs: { 'call-id': callId, 'call-creator': creator, enabled: enabled ? '1' : '0' },
	})

const child = (n: BinaryNode, tag: string): BinaryNode | undefined =>
	Array.isArray(n.content) ? n.content.find((c) => c.tag === tag) : undefined

export interface CallLink {
	token: string
	media: CallLinkMedia
	url: string
}

export interface CallLinkPreview extends CallLink {
	creator: string
	waitingRoomEnabled: boolean
	/** We created the link (admin of its waiting room). */
	isAdmin: boolean
}

/** The `<link_create token media/>` of a create ack. */
export function parseLinkCreateAck(ack: BinaryNode): CallLink {
	const c = child(ack, 'link_create')
	const token = c?.attrs['token']
	if (!token) throw new Error('link_create ack carries no token')
	const media = c.attrs['media'] === 'video' ? 'video' : 'audio'
	return { token, media, url: callLinkUrl(token, media) }
}

/** The preview a `link_query` ack gives: who made the link and whether joiners wait for approval. */
export function parseLinkQueryAck(ack: BinaryNode): CallLinkPreview {
	const c = child(ack, 'link_query')
	const token = c?.attrs['token']
	if (!c || !token) throw new Error('link_query ack carries no link')
	const media = c.attrs['media'] === 'video' ? 'video' : 'audio'
	const waiting = child(c, 'waiting_room')
	return {
		token,
		media,
		url: callLinkUrl(token, media),
		creator: c.attrs['link_creator'] ?? '',
		waitingRoomEnabled: waiting?.attrs['enabled'] === '1',
		isAdmin: waiting?.attrs['is_admin'] === '1',
	}
}
