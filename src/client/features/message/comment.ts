// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'
import { encodeProto, protoType } from '../../proto.js'
import type { MessageKey } from './messages.js'

// Comments (threaded replies under a post in a Community Announcement Group) and encrypted reactions are
// "secret add-ons": the body is a normal Message, encrypted with a key derived from the parent post's
// messageSecret, the post id, the post's author and the commenter. The server never sees the text.

export type AddonUseCase =
	'Enc Comment' | 'Enc Reaction' | 'Event Edit' | 'Message Edit' | 'Poll Edit' | 'Poll Add Option'

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

// ---- secretEncryptedMessage (event/message/poll edits, poll-add-option) ------------------------

/**
 * `secretEncryptedMessage`: the newer generic secret-encrypted envelope for editing a message, an event or a
 * poll, or adding an option to an existing poll - same add-on mechanism as comments/reactions above (empty
 * AAD, HKDF over the parent's own `messageSecret`), just a different use-case literal and a shared field name
 * on the wire. `MESSAGE_SCHEDULE` is a distinct mechanism (`ConditionalRevealMessage`'s own reveal key) and
 * is not covered here.
 */
export type SecretEncType = 'EVENT_EDIT' | 'MESSAGE_EDIT' | 'POLL_EDIT' | 'POLL_ADD_OPTION'

const SECRET_ENC_USE_CASE: Record<SecretEncType, AddonUseCase> = {
	EVENT_EDIT: 'Event Edit',
	MESSAGE_EDIT: 'Message Edit',
	POLL_EDIT: 'Poll Edit',
	POLL_ADD_OPTION: 'Poll Add Option',
}

/**
 * Build a `secretEncryptedMessage` envelope of `kind`, targeting `parent` (the message, event or poll being
 * edited, or the poll gaining an option). `inner` is the replacement content - e.g. `textMessage(newText)` for
 * a `MESSAGE_EDIT`, or `{ pollOption: [{ optionName }] }` for a `POLL_ADD_OPTION`. `ctx.secret` must be the
 * *parent's* existing `messageContextInfo.messageSecret`, not a new one.
 */
export function secretEncryptedMessage(
	kind: SecretEncType,
	parent: MessageKey,
	inner: Record<string, unknown>,
	ctx: Omit<AddonContext, 'useCase' | 'parentMsgId'>,
): Record<string, unknown> {
	const enc = encryptAddon(inner, {
		...ctx,
		parentMsgId: parent.id,
		useCase: SECRET_ENC_USE_CASE[kind],
	})
	return {
		secretEncryptedMessage: {
			targetMessageKey: {
				remoteJid: parent.remoteJid,
				fromMe: !!parent.fromMe,
				id: parent.id,
				participant: parent.participant ?? ctx.parentSenderJid,
			},
			secretEncType: kind,
			...enc,
		},
	}
}

/** Decrypt a `secretEncryptedMessage` envelope of `kind` to its inner `Message` (see `secretEncryptedMessage`). */
export const decryptSecretEncrypted = (
	enc: { encPayload: Uint8Array; encIv: Uint8Array },
	kind: SecretEncType,
	ctx: Omit<AddonContext, 'useCase'>,
): Record<string, unknown> => decryptAddon(enc, { ...ctx, useCase: SECRET_ENC_USE_CASE[kind] })
