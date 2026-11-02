// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'
import { encodeProto, protoType } from '../../proto.js'
import type { MessageKey } from './messages.js'

// Comments (threaded replies under a post in a Community Announcement Group) and encrypted reactions are
// "secret add-ons": the body is a normal Message, encrypted with a key derived from the parent post's
// messageSecret, the post id, the post's author and the commenter. The server never sees the text.

export type AddonUseCase = 'Enc Comment' | 'Enc Reaction'

export interface AddonContext {
	parentMsgId: string
	parentSenderJid: string
	modifierJid: string
	secret: Uint8Array
	useCase: AddonUseCase
}

const keyFor = (c: AddonContext): Buffer =>
	Buffer.from(
		hkdfSync(
			'sha256',
			c.secret,
			Buffer.alloc(32),
			Buffer.concat([
				Buffer.from(c.parentMsgId),
				Buffer.from(c.parentSenderJid),
				Buffer.from(c.modifierJid),
				Buffer.from(c.useCase),
			]),
			32,
		),
	)

/** Encrypt a message as an add-on of the post. The AAD is empty for comments and reactions. */
export function encryptAddon(
	body: Record<string, unknown>,
	c: AddonContext,
): { encPayload: Uint8Array; encIv: Uint8Array } {
	const iv = randomBytes(12)
	const cipher = createCipheriv('aes-256-gcm', keyFor(c), iv)
	const plain = encodeProto('Message', body)
	const out = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()])
	return { encPayload: new Uint8Array(out), encIv: new Uint8Array(iv) }
}

export function decryptAddon(
	enc: { encPayload: Uint8Array; encIv: Uint8Array },
	c: AddonContext,
): Record<string, unknown> {
	if (enc.encPayload.length < 17) throw new Error('add-on too short')
	const body = Buffer.from(enc.encPayload)
	const d = createDecipheriv('aes-256-gcm', keyFor(c), enc.encIv)
	d.setAuthTag(body.subarray(body.length - 16))
	const plain = Buffer.concat([d.update(body.subarray(0, body.length - 16)), d.final()])
	const T = protoType('Message')
	return T.toObject(T.decode(plain), { bytes: Buffer, longs: Number }) as Record<string, unknown>
}

/**
 * The message that comments on `parent` with a text. `parentSenderJid` is the post's author, `commenterJid` the
 * commenter (WhatsApp Web uses the LID form). The comment gets its own secret, so it can be reacted to.
 */
export function commentMessage(
	parent: MessageKey,
	text: string,
	ctx: Omit<AddonContext, 'useCase' | 'parentMsgId'>,
): Record<string, unknown> {
	const enc = encryptAddon(
		{ extendedTextMessage: { text } },
		{ ...ctx, parentMsgId: parent.id, useCase: 'Enc Comment' },
	)
	return {
		encCommentMessage: {
			targetMessageKey: {
				remoteJid: parent.remoteJid,
				fromMe: !!parent.fromMe,
				id: parent.id,
				participant: parent.participant ?? ctx.parentSenderJid,
			},
			...enc,
		},
		messageContextInfo: { messageSecret: randomBytes(32) },
	}
}
