// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { Client } from '../client/client.js'
import {
	getContentType,
	messageText,
	normalizeMessageContent,
} from '../client/features/message/content-type.js'
import type { MessageContent, SendContentOptions } from '../client/features/message/send-content.js'
import type { MessageKey, Quoted } from '../client/features/message/messages.js'
import type { DecodedMessage } from '../client/receiver.js'
import { areJidsSameUser, isJidGroup, jidNormalizedUser } from '../jid.js'

/** The message a received message answers to. */
export interface QuotedMessage {
	id: string
	chat: string
	sender: string
	fromMe: boolean
	/** `conversation`, `imageMessage`, ... */
	type: string | undefined
	text: string
	mimetype?: string
	/** The WAProto content of the quoted message. */
	message: Record<string, unknown>
	/** Use as `reply` target or to `client.react` / `client.revoke` it. */
	key: MessageKey
	download(): Promise<Buffer>
}

/**
 * A received message, ready to use: who wrote it, where, what it says, what it answers to, and the usual
 * answers (`reply`, `react`, `delete`, `download`) bound to the chat it came from.
 */
export interface Message {
	/** The event as `client.on('message')` delivers it. */
	raw: DecodedMessage
	id: string
	/** The chat: a user, a group (`@g.us`) or a channel. */
	chat: string
	/** Who wrote it (inside a group: the member). */
	sender: string
	pushName: string
	fromMe: boolean
	isGroup: boolean
	/** Seconds since 1970, when WhatsApp gave one. */
	timestamp: number | undefined
	/** `conversation`, `extendedTextMessage`, `imageMessage`, `pollCreationMessage`, ... */
	type: string | undefined
	/** The content with wrappers (disappearing, view once, edited) taken off. */
	content: Record<string, unknown> | undefined
	/** Text, caption, or the id of a tapped button / chosen list row. Empty when there is none. */
	text: string
	mimetype: string | undefined
	/** Image, video, audio, document or sticker (something `download()` can fetch). */
	isMedia: boolean
	mentionedJids: string[]
	quoted: QuotedMessage | undefined
	/** `{ key, message }`: what `send(..., { quoted })` wants. */
	key: MessageKey
	asQuoted: Quoted
	reply(content: string | MessageContent, options?: SendContentOptions): Promise<string>
	react(emoji: string): Promise<string>
	/** Delete for everyone (own messages, or any in a group where we are admin). */
	delete(): Promise<string>
	markRead(): Promise<void>
	download(): Promise<Buffer>
	forward(to: string): Promise<string>
}

const MEDIA = [
	'imageMessage',
	'videoMessage',
	'audioMessage',
	'documentMessage',
	'stickerMessage',
	'ptvMessage',
]

const asObject = (v: unknown): Record<string, unknown> | undefined =>
	v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined

/** Is this JID one of ours (phone number or LID, any device)? */
export function isMe(client: Pick<Client, 'me'>, jid: string | undefined): boolean {
	const me = client.me
	return (
		!!jid && !!me && (areJidsSameUser(jid, me.id) || (!!me.lid && areJidsSameUser(jid, me.lid)))
	)
}

/** Turn a received message into a `Message`. */
export function serialize(client: Client, raw: DecodedMessage): Message {
	const chat = raw.from
	const isGroup = isJidGroup(chat)
	const sender = jidNormalizedUser(raw.participant ?? chat)
	const content = normalizeMessageContent(raw.message)
	const type = getContentType(content)
	const inner = asObject(type ? content?.[type] : undefined)
	const context = asObject(inner?.['contextInfo'])
	const fromMe = isMe(client, raw.participant) || !!(raw.message['fromMe'] as boolean | undefined)
	const key: MessageKey = {
		remoteJid: chat,
		id: raw.id,
		fromMe,
		...(raw.participant && { participant: raw.participant }),
	}

	let quoted: QuotedMessage | undefined
	const quotedContent = normalizeMessageContent(asObject(context?.['quotedMessage']))
	if (quotedContent && typeof context?.['stanzaId'] === 'string') {
		const qType = getContentType(quotedContent)
		const qInner = asObject(qType ? quotedContent[qType] : undefined)
		const qSender = jidNormalizedUser((context['participant'] as string | undefined) ?? chat)
		const qKey: MessageKey = {
			remoteJid: chat,
			id: context['stanzaId'],
			fromMe: isMe(client, qSender),
			...(isGroup && { participant: qSender }),
		}
		quoted = {
			id: context['stanzaId'],
			chat,
			sender: qSender,
			fromMe: qKey.fromMe ?? false,
			type: qType,
			text: messageText(quotedContent) ?? '',
			...(typeof qInner?.['mimetype'] === 'string' && { mimetype: qInner['mimetype'] }),
			message: quotedContent,
			key: qKey,
			download: () => client.downloadMedia(quotedContent, { key: qKey }),
		}
	}

	const mentioned = context?.['mentionedJid']
	const message: Message = {
		raw,
		id: raw.id,
		chat,
		sender,
		pushName: raw.pushName ?? '',
		fromMe,
		isGroup,
		timestamp: raw.timestamp,
		type,
		content,
		text: messageText(content) ?? '',
		mimetype: typeof inner?.['mimetype'] === 'string' ? inner['mimetype'] : undefined,
		isMedia: !!type && MEDIA.includes(type),
		mentionedJids: Array.isArray(mentioned)
			? mentioned.filter((j): j is string => typeof j === 'string')
			: [],
		quoted,
		key,
		asQuoted: { key, message: raw.message },
		reply: (content, options) =>
			client.send(chat, typeof content === 'string' ? { text: content } : content, {
				quoted: { key, message: raw.message },
				...options,
			}),
		react: (emoji) => client.react(key, emoji),
		delete: () => client.revoke(key),
		markRead: () => client.markRead([key]),
		download: () => client.downloadMedia(raw.message, { key }),
		forward: (to) => client.forwardMessage(to, raw.message),
	}
	return message
}
