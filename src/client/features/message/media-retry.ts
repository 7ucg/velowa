// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'
import type { BinaryNode } from '../../../codec/index.js'
import { encodeProto, protoType } from '../../proto.js'
import type { MessageKey } from './messages.js'

// Expired media: the file is gone from WhatsApp's servers, but the phone that sent it may still have it.
// We send a "server-error" receipt (the same the app sends when a download fails) and the phone uploads the
// file again; the answer is a `mediaretry` notification with the new `directPath`.

const retryKey = (mediaKey: Uint8Array): Buffer =>
	Buffer.from(
		hkdfSync('sha256', mediaKey, Buffer.alloc(0), 'WhatsApp Media Retry Notification', 32),
	)

/** The receipt that asks for a new upload. `meId` is our own JID (the receipt goes to ourselves). */
export function mediaRetryRequest(key: MessageKey, mediaKey: Uint8Array, meId: string): BinaryNode {
	const iv = randomBytes(12)
	const c = createCipheriv('aes-256-gcm', retryKey(mediaKey), iv)
	c.setAAD(Buffer.from(key.id))
	const body = Buffer.concat([
		c.update(encodeProto('ServerErrorReceipt', { stanzaId: key.id })),
		c.final(),
		c.getAuthTag(),
	])
	const bare = meId.replace(/:\d+@/, '@')
	return {
		tag: 'receipt',
		attrs: { id: key.id, to: bare, type: 'server-error' },
		content: [
			{
				tag: 'encrypt',
				attrs: {},
				content: [
					{ tag: 'enc_p', attrs: {}, content: body },
					{ tag: 'enc_iv', attrs: {}, content: iv },
				],
			},
			{
				tag: 'rmr',
				attrs: {
					jid: key.remoteJid,
					from_me: String(!!key.fromMe),
					...(key.participant && { participant: key.participant }),
				},
			},
		],
	}
}

export interface MediaRetryEvent {
	key: MessageKey
	error?: { code: number }
	media?: { ciphertext: Uint8Array; iv: Uint8Array }
}

const bytes = (n: BinaryNode | undefined): Uint8Array | undefined =>
	n && n.content instanceof Uint8Array ? n.content : undefined

/** Read a `mediaretry` notification. */
export function decodeMediaRetryNode(node: BinaryNode): MediaRetryEvent | undefined {
	const kids = Array.isArray(node.content) ? node.content : []
	const rmr = kids.find((c) => c.tag === 'rmr')
	if (!rmr) return undefined
	const event: MediaRetryEvent = {
		key: {
			id: node.attrs['id'] ?? '',
			remoteJid: rmr.attrs['jid'] ?? '',
			fromMe: rmr.attrs['from_me'] === 'true',
			...(rmr.attrs['participant'] && { participant: rmr.attrs['participant'] }),
		},
	}
	const error = kids.find((c) => c.tag === 'error')
	if (error) return { ...event, error: { code: Number(error.attrs['code'] ?? 0) } }
	const enc = kids.find((c) => c.tag === 'encrypt')
	const sub = Array.isArray(enc?.content) ? enc.content : []
	const ciphertext = bytes(sub.find((c) => c.tag === 'enc_p'))
	const iv = bytes(sub.find((c) => c.tag === 'enc_iv'))
	return ciphertext && iv
		? { ...event, media: { ciphertext, iv } }
		: { ...event, error: { code: 404 } }
}

export interface MediaRetryResult {
	/** `SUCCESS`, `NOT_FOUND`, `DECRYPTION_ERROR` or `GENERAL_ERROR`. */
	result: string
	directPath?: string
}

export function decryptMediaRetry(
	media: { ciphertext: Uint8Array; iv: Uint8Array },
	mediaKey: Uint8Array,
	msgId: string,
): MediaRetryResult {
	const buf = Buffer.from(media.ciphertext)
	const d = createDecipheriv('aes-256-gcm', retryKey(mediaKey), media.iv)
	d.setAAD(Buffer.from(msgId))
	d.setAuthTag(buf.subarray(buf.length - 16))
	const plain = Buffer.concat([d.update(buf.subarray(0, buf.length - 16)), d.final()])
	const t = protoType('MediaRetryNotification')
	const n = t.toObject(t.decode(plain), { enums: String }) as {
		result?: string
		directPath?: string
	}
	return { result: n.result ?? 'GENERAL_ERROR', ...(n.directPath && { directPath: n.directPath }) }
}
