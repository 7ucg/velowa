// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'
import { protoType } from '../../proto.js'
import type { MessageKey } from './messages.js'

// Event messages: an invitation card in a chat or group (name, time, place, optional call link) that guests answer
// with Going, Not going or Maybe. The answers are encrypted with a secret that travels in the card itself, the same
// way poll votes are.

export interface EventOptions {
	name: string
	description?: string
	/** Start and end: a `Date` or unix seconds. */
	startTime?: Date | number
	endTime?: Date | number
	/** A call link (`https://call.whatsapp.com/...`) guests can join. */
	joinLink?: string
	location?: {
		name?: string
		address?: string
		degreesLatitude?: number
		degreesLongitude?: number
	}
	isCanceled?: boolean
	extraGuestsAllowed?: boolean
	isScheduledCall?: boolean
}

const seconds = (t: Date | number | undefined): number | undefined =>
	t === undefined ? undefined : Math.floor(t instanceof Date ? t.getTime() / 1000 : t)

/** The event card. Its `messageSecret` is what RSVPs are encrypted with: keep it with the message. */
export function eventMessage(o: EventOptions): Record<string, unknown> {
	if (!o.name.trim()) throw new Error('an event needs a name')
	return {
		eventMessage: {
			name: o.name,
			...(o.description !== undefined && { description: o.description }),
			...(o.startTime !== undefined && { startTime: seconds(o.startTime) }),
			...(o.endTime !== undefined && { endTime: seconds(o.endTime) }),
			...(o.joinLink && { joinLink: o.joinLink }),
			...(o.location && { location: o.location }),
			isCanceled: o.isCanceled ?? false,
			...(o.extraGuestsAllowed !== undefined && { extraGuestsAllowed: o.extraGuestsAllowed }),
			isScheduleCall: o.isScheduledCall ?? false,
		},
		messageContextInfo: { messageSecret: randomBytes(32) },
	}
}

export type EventResponseType = 'GOING' | 'NOT_GOING' | 'MAYBE'

export interface EventSecretContext {
	eventMsgId: string
	eventCreatorJid: string
	responderJid: string
	secret: Uint8Array
}

const keyFor = (c: EventSecretContext): Buffer =>
	Buffer.from(
		hkdfSync(
			'sha256',
			c.secret,
			Buffer.alloc(32),
			Buffer.concat([
				Buffer.from(c.eventMsgId),
				Buffer.from(c.eventCreatorJid),
				Buffer.from(c.responderJid),
				Buffer.from('Event Response'),
			]),
			32,
		),
	)

const aadFor = (c: EventSecretContext): Buffer =>
	Buffer.from(`${c.eventMsgId}\u0000${c.responderJid}`)

/** Encrypt an RSVP: AES-256-GCM, the tag appended to the payload. */
export function encryptEventResponse(
	response: { response: EventResponseType; extraGuestCount?: number },
	c: EventSecretContext,
	now = Date.now(),
): { encPayload: Uint8Array; encIv: Uint8Array } {
	const T = protoType('Message.EventResponseMessage')
	const plain = T.encode(
		T.fromObject({
			response: response.response,
			timestampMs: now,
			...(response.extraGuestCount !== undefined && { extraGuestCount: response.extraGuestCount }),
		}),
	).finish()
	const iv = randomBytes(12)
	const cipher = createCipheriv('aes-256-gcm', keyFor(c), iv)
	cipher.setAAD(aadFor(c))
	const body = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()])
	return { encPayload: new Uint8Array(body), encIv: new Uint8Array(iv) }
}

export interface DecryptedEventResponse {
	response: EventResponseType | 'UNKNOWN'
	timestampMs?: number
	extraGuestCount?: number
}

export function decryptEventResponse(
	enc: { encPayload: Uint8Array; encIv: Uint8Array },
	c: EventSecretContext,
): DecryptedEventResponse {
	if (enc.encPayload.length < 17) throw new Error('event response too short')
	const d = createDecipheriv('aes-256-gcm', keyFor(c), enc.encIv)
	d.setAAD(aadFor(c))
	const body = Buffer.from(enc.encPayload)
	d.setAuthTag(body.subarray(body.length - 16))
	const plain = Buffer.concat([d.update(body.subarray(0, body.length - 16)), d.final()])
	const T = protoType('Message.EventResponseMessage')
	const o = T.toObject(T.decode(plain), { enums: String, longs: Number }) as DecryptedEventResponse
	return { ...o, response: o.response ?? 'UNKNOWN' }
}

/** The message that carries an RSVP to the event card `key`. */
export function eventResponse(
	key: MessageKey,
	response: { response: EventResponseType; extraGuestCount?: number },
	c: EventSecretContext,
): Record<string, unknown> {
	const enc = encryptEventResponse(response, c)
	return {
		encEventResponseMessage: {
			eventCreationMessageKey: {
				remoteJid: key.remoteJid,
				fromMe: !!key.fromMe,
				id: key.id,
				...(key.participant && { participant: key.participant }),
			},
			...enc,
		},
	}
}
