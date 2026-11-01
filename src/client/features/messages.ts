import type { BinaryNode } from '../../codec/index.js'
import { jidDecode } from '../../jid.js'
import type { SendOptions } from '../sender.js'

/** Identifies a message in a chat (WhatsApp's "message key"). */
export interface MessageKey {
	remoteJid: string
	id: string
	fromMe?: boolean
	/** Author inside a group (set for messages from others in groups). */
	participant?: string
}

/** A message being replied to. `message` is the quoted message's WAProto content. */
export interface Quoted {
	key: MessageKey
	message: Record<string, unknown>
}

export interface TextOptions {
	quoted?: Quoted
	/** JIDs to @mention; the text must contain `@<number>` for each. */
	mentions?: string[]
	/** Disappearing-message timer in seconds for this message (use the chat's current setting). */
	expiration?: number
	/** Mark the message as a question (channels show it with an answer box). */
	isQuestion?: boolean
}

const normalizedUser = (jid: string): string => {
	const { user, server } = jidDecode(jid)
	return `${user}@${server}`
}

/** The single content field of a Message (e.g. `extendedTextMessage`), without wrapper fields. */
function contentOf(message: Record<string, unknown>): Record<string, unknown> {
	for (const k of Object.keys(message)) {
		if (k === 'messageContextInfo') continue
		const inner = message[k]
		if (inner && typeof inner === 'object') {
			const { contextInfo: _drop, ...rest } = inner as Record<string, unknown>
			void _drop
			return { [k]: rest }
		}
	}
	return {}
}

/** Add reply / mention context to a message's single content field. */
export function withContext(
	message: Record<string, unknown>,
	chat: string,
	opts: TextOptions,
	meId: string,
): Record<string, unknown> {
	if (!opts.quoted && !opts.mentions?.length && !opts.expiration && !opts.isQuestion) return message
	const field = Object.keys(message).find((k) => k !== 'messageContextInfo')
	if (!field) return message
	const body = { ...(message[field] as Record<string, unknown>) }
	const ctx: Record<string, unknown> = {
		...(body['contextInfo'] as Record<string, unknown> | undefined),
	}
	if (opts.quoted) {
		const { key } = opts.quoted
		ctx['participant'] = normalizedUser(key.fromMe ? meId : (key.participant ?? key.remoteJid))
		ctx['stanzaId'] = key.id
		ctx['quotedMessage'] = contentOf(opts.quoted.message)
		if (key.remoteJid !== chat) ctx['remoteJid'] = key.remoteJid
	}
	if (opts.mentions?.length) ctx['mentionedJid'] = opts.mentions
	if (opts.expiration) ctx['expiration'] = opts.expiration
	if (opts.isQuestion) ctx['isQuestion'] = true
	body['contextInfo'] = ctx
	return { ...message, [field]: body }
}

export function textMessage(text: string): Record<string, unknown> {
	return { extendedTextMessage: { text } }
}

const wireKey = (key: MessageKey) => ({
	remoteJid: key.remoteJid,
	fromMe: key.fromMe ?? false,
	id: key.id,
	...(key.participant && { participant: key.participant }),
})

/** React to a message; an empty `emoji` removes the reaction. */
export function reaction(
	key: MessageKey,
	emoji: string,
): { message: Record<string, unknown>; opts: SendOptions } {
	return {
		message: { reactionMessage: { key: wireKey(key), text: emoji, senderTimestampMs: Date.now() } },
		opts: { encAttrs: { 'decrypt-fail': 'hide' } },
	}
}

/** Replace the text of one of our own messages. */
export function edit(
	key: MessageKey,
	newText: string,
): { message: Record<string, unknown>; opts: SendOptions } {
	return {
		message: {
			protocolMessage: {
				key: wireKey({ ...key, fromMe: true }),
				editedMessage: textMessage(newText),
				timestampMs: Date.now(),
				type: 'MESSAGE_EDIT',
			},
		},
		opts: { stanzaAttrs: { edit: '1' } },
	}
}

/** Delete for everyone. Deleting someone else's group message (as admin) uses edit="8". */
export function revoke(key: MessageKey): { message: Record<string, unknown>; opts: SendOptions } {
	const adminDelete = key.remoteJid.endsWith('@g.us') && !key.fromMe
	return {
		message: { protocolMessage: { key: wireKey(key), type: 'REVOKE' } },
		opts: { stanzaAttrs: { edit: adminDelete ? '8' : '7' } },
	}
}

// ---- receipts ---------------------------------------------------------------------------------

export type ReceiptType = 'read' | 'read-self' | 'played' | 'sender'

/** Group message keys (not from us) by chat+author and build one receipt per group. */
export function buildReceipts(
	keys: MessageKey[],
	type: ReceiptType | undefined,
	nowSeconds: number,
): BinaryNode[] {
	const groups = new Map<string, { jid: string; participant: string | undefined; ids: string[] }>()
	for (const k of keys) {
		if (k.fromMe) continue
		const gk = `${k.remoteJid}:${k.participant ?? ''}`
		const g = groups.get(gk) ?? { jid: k.remoteJid, participant: k.participant, ids: [] }
		g.ids.push(k.id)
		groups.set(gk, g)
	}
	return [...groups.values()].map(({ jid, participant, ids }) => {
		const attrs: Record<string, string> = { id: ids[0]!, to: jid }
		if (participant) attrs['participant'] = participant
		if (type === 'read' || type === 'read-self') attrs['t'] = String(nowSeconds)
		if (type) attrs['type'] = type
		const node: BinaryNode = { tag: 'receipt', attrs }
		if (ids.length > 1) {
			node.content = [
				{
					tag: 'list',
					attrs: {},
					content: ids.slice(1).map((id) => ({ tag: 'item', attrs: { id } })),
				},
			]
		}
		return node
	})
}

// ---- presence ---------------------------------------------------------------------------------

export type ChatState = 'composing' | 'paused' | 'recording'

/** "typing…" / "recording audio…" / stopped, in a chat. */
export function chatState(from: string, to: string, state: ChatState): BinaryNode {
	return {
		tag: 'chatstate',
		attrs: { from, to },
		content: [
			{
				tag: state === 'recording' ? 'composing' : state,
				attrs: state === 'recording' ? { media: 'audio' } : {},
			},
		],
	}
}

/** Global online / offline presence; needs the account's display name. */
export function presence(name: string, type: 'available' | 'unavailable'): BinaryNode {
	return { tag: 'presence', attrs: { name: name.replace(/@/g, ''), type } }
}

/** Ask to be told when `jid` goes online/offline. */
export function presenceSubscribe(jid: string, id: string): BinaryNode {
	return { tag: 'presence', attrs: { to: jid, id, type: 'subscribe' } }
}

/** Mark a received message as forwarded (shows the "Forwarded" label; `score` > 4 shows "Forwarded many times"). */
export function forward(message: Record<string, unknown>, score = 1): Record<string, unknown> {
	const field = Object.keys(message).find((k) => k !== 'messageContextInfo')
	if (!field) throw new Error('empty message')
	const body = { ...(message[field] as Record<string, unknown>) }
	const ctx = { ...(body['contextInfo'] as Record<string, unknown> | undefined) }
	// A forward does not keep the original thread: drop quote data and the original's secret.
	delete ctx['quotedMessage']
	delete ctx['stanzaId']
	delete ctx['participant']
	body['contextInfo'] = { ...ctx, isForwarded: true, forwardingScore: Math.max(1, score) }
	const { messageContextInfo: _drop, ...rest } = message
	void _drop
	return { ...rest, [field]: body }
}
