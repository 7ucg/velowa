import { randomBytes } from 'node:crypto'
import type { BinaryNode } from '../../codec/index.js'
import type { MediaSession } from '../call-media.js'
import type { LocalAudioOptions } from '../local-audio.js'
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

/** A group-call hang-up with the call length, like the app sends it. */
export const buildTerminateTimed = (
	callId: string,
	creator: string,
	ms: number,
	id: string,
): BinaryNode =>
	wrap(`${callId}@call`, id, {
		tag: 'terminate',
		attrs: {
			'call-id': callId,
			'call-creator': creator,
			duration: String(ms),
			audio_duration: String(ms),
		},
	})

/** Group calls, creator side (as WhatsApp Web sends them): keep-alive, mute state, transport hint, call length. */
export const buildHeartbeat = (callId: string, creator: string, id: string): BinaryNode =>
	wrap(`${callId}@call`, id, {
		tag: 'heartbeat',
		attrs: { 'call-id': callId, 'call-creator': creator },
	})

export const buildMuteState = (
	callId: string,
	creator: string,
	muted: boolean,
	id: string,
): BinaryNode =>
	wrap(`${callId}@call`, id, {
		tag: 'mute_v2',
		attrs: { 'call-id': callId, 'call-creator': creator, 'mute-state': muted ? '1' : '0' },
	})

/** Latency to one relay (the 6-byte address from the roster update), reported once per relay block. */
export const buildRelayLatency = (
	callId: string,
	creator: string,
	transactionId: string,
	relayName: string,
	rttMs: number,
	address: Uint8Array,
	id: string,
): BinaryNode =>
	wrap(`${callId}@call`, id, {
		tag: 'relaylatency',
		attrs: { 'call-id': callId, 'call-creator': creator, 'transaction-id': transactionId },
		content: [
			{
				tag: 'te',
				// bit 25 marks a measured value, the low bits are the round trip in milliseconds
				attrs: {
					latency: String(0x2000000 + Math.max(0, Math.round(rttMs))),
					relay_name: relayName,
				},
				content: address,
			},
		],
	})

/** Tell one participant device which network we are on (`transport-message-type` 4, wifi/udp). */
export const buildTransportHint = (
	callId: string,
	to: string,
	creator: string,
	id: string,
): BinaryNode =>
	wrap(to, id, {
		tag: 'transport',
		attrs: { 'call-id': callId, 'call-creator': creator, 'transport-message-type': '4' },
		content: [{ tag: 'net', attrs: { medium: '2', protocol: '0' } }],
	})

/** The call length (milliseconds) that goes with a hang-up, and the report the app files at `call` after it. */
export const buildGroupDuration = (
	callId: string,
	creator: string,
	ms: number,
	id: string,
): BinaryNode =>
	wrap('call', id, {
		tag: 'group_call_duration',
		attrs: {
			'call-id': callId,
			'call-creator': creator,
			type: 'group',
			audio_duration: String(ms),
		},
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
	/** An invitation into a running group call is answered with the bare form: audio, net, encopt. */
	bare = false,
): BinaryNode {
	if (bare)
		return wrap(to, id, {
			tag: 'accept',
			attrs: { 'call-id': callId, 'call-creator': creator },
			content: [
				audio('16000'),
				...(video ? [{ tag: 'video', attrs: { dec: 'H264', device_orientation: '0' } }] : []),
				{ tag: 'net', attrs: { medium: '2' } },
				encopt,
			],
		})
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

/** What a group call does with its media: audio to send, video to send, and where to record what comes in. */
export interface GroupMediaOptions {
	audioIn?: Int16Array
	recordTo?: string
	/** H.264 access units (Annex-B, with AUD NALs) to send, looped. */
	videoFrames?: Uint8Array[]
	recordVideoTo?: string
	/** Use this machine's microphone and speaker. */
	localAudio?: LocalAudioOptions
	videoFps?: number
}

/** Only the options that are set, in the shape stored on a call. */
export const pickMediaOptions = (o: GroupMediaOptions): GroupMediaOptions => ({
	...(o.audioIn && { audioIn: o.audioIn }),
	...(o.recordTo && { recordTo: o.recordTo }),
	...(o.videoFrames && { videoFrames: o.videoFrames }),
	...(o.recordVideoTo && { recordVideoTo: o.recordVideoTo }),
	...(o.localAudio && { localAudio: o.localAudio }),
	...(o.videoFps && { videoFps: o.videoFps }),
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
	/** Group calls: keep-alive timer, and the devices that already got our transport hint. */
	heartbeat?: NodeJS.Timeout
	hinted?: Set<string>
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
	/** Group calls we answered: media options kept until the relay arrives, and a shared key that came before the engine. */
	/** The newest relay block we reported latencies for. */
	latencyTx?: string
	/** Joined through a call link: the relay comes with the first roster update, not with the join ack. */
	awaitsRelay?: boolean
	/** Joined through a call link and still in the waiting room. */
	waiting?: boolean
	mediaOptions?: GroupMediaOptions
	pendingEpoch?: { transaction: number; key: Uint8Array }
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

/** Waiting-room traffic goes to the call itself (`<callId>@call`), not to the link service. */
const roomRequest = (
	callId: string,
	creator: string,
	id: string,
	tag: string,
	attrs: Record<string, string> = {},
	content?: BinaryNode[],
): BinaryNode =>
	wrap(`${callId}@call`, id, {
		tag,
		attrs: { 'call-id': callId, 'call-creator': creator, ...attrs },
		...(content && { content }),
	})

export const buildWaitingRoomToggle = (
	callId: string,
	creator: string,
	enabled: boolean,
	id: string,
): BinaryNode =>
	roomRequest(callId, creator, id, 'waiting_room_toggle', { enabled: enabled ? '1' : '0' })

/** Keeps a pending join in the waiting room alive (every 10 s). */
export const buildWaitingRoomHeartbeat = (
	callId: string,
	creator: string,
	id: string,
): BinaryNode => roomRequest(callId, creator, id, 'heartbeat', { type: 'waiting_room' })

export const buildWaitingRoomAdmit = (
	callId: string,
	creator: string,
	user: string,
	id: string,
	deny = false,
): BinaryNode =>
	roomRequest(callId, creator, id, deny ? 'waiting_room_deny' : 'waiting_room_admit', {}, [
		{ tag: 'user', attrs: { jid: user } },
	])

/** Join a call link: audio (and video) announcement, network, capability. */
export const buildLinkJoin = (token: string, media: CallLinkMedia, id: string): BinaryNode => {
	if (!TOKEN.test(token)) throw new Error('invalid call-link token')
	return service(id, {
		tag: 'link_join',
		attrs: { token, media },
		content: [
			audio('16000'),
			...(media === 'video'
				? [{ tag: 'video', attrs: { dec: 'H264', device_orientation: '0' } }]
				: []),
			{ tag: 'net', attrs: { medium: '2' } },
			capabilityNode(
				media === 'video' ? CAPABILITY_STANDARD_OPUS_VIDEO_OFFER : CAPABILITY_STANDARD_OPUS_OFFER,
			),
		],
	})
}

export interface LinkJoin {
	callId: string
	creator: string
	media: CallLinkMedia
	/** Not admitted yet: the creator has to let us in. */
	inWaitingRoom: boolean
	/** The ack carried the call's roster and relay (admitted). */
	admitted: boolean
	isAdmin: boolean
}

/** The `<link_join>` ack: either a group snapshot (admitted) or a waiting room. */
export function parseLinkJoinAck(ack: BinaryNode, token: string): LinkJoin {
	const group = child(ack, 'group_info')
	const room = child(ack, 'waiting_room')
	const src = group ?? room
	const callId = src?.attrs['call-id']
	const creator = src?.attrs['call-creator']
	if (!src || !callId || !creator) throw new Error('link_join ack names no call')
	if (room?.attrs['link-token'] && room.attrs['link-token'] !== token)
		throw new Error('the waiting room belongs to another link')
	const media = (group?.attrs['media'] ?? room?.attrs['media']) === 'video' ? 'video' : 'audio'
	return {
		callId,
		creator,
		media,
		inWaitingRoom: !!room && !group,
		admitted: !!group,
		isAdmin: room?.attrs['is_admin'] === '1',
	}
}

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
