// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { BinaryNode } from '../../../codec/index.js'

export interface ReceiptEvent {
	/** Chat the receipt belongs to (the group for group receipts). */
	chat: string
	/** Who produced it (group member / other device), when given. */
	participant?: string
	/** Message ids covered. */
	ids: string[]
	/** `delivery` (no type attribute), `read`, `played`, `sender`, `retry`, `inactive`, ... */
	type: string
	timestamp?: number
}

const kids = (n: BinaryNode, tag?: string): BinaryNode[] =>
	Array.isArray(n.content) ? n.content.filter((c) => tag === undefined || c.tag === tag) : []

/** Parse a `<receipt>` (including the batched `<list><item id/></list>` form). */
const digits = (v: string | undefined): number | undefined =>
	v && /^\d{1,12}$/.test(v) ? Number(v) : undefined

export function parseReceipt(node: BinaryNode): ReceiptEvent {
	const ids = [node.attrs['id'] ?? '']
	for (const list of kids(node, 'list'))
		for (const item of kids(list, 'item')) if (item.attrs['id']) ids.push(item.attrs['id'])
	const type = node.attrs['type'] ?? 'delivery'
	const error = kids(node, 'error')[0]
	// A delivery receipt carrying this error means the LID peer couldn't take the message at all - it was
	// only ever sent, never delivered, no matter what the <receipt> tag itself claims.
	const downgraded =
		type === 'delivery' &&
		error?.attrs['reason'] === 'lid' &&
		error.attrs['type'] === 'feature-incapable'
			? 'sent'
			: type
	return {
		chat: node.attrs['from'] ?? '',
		...(node.attrs['participant'] && { participant: node.attrs['participant'] }),
		ids: ids.filter(Boolean),
		type: downgraded,
		...(digits(node.attrs['t']) !== undefined && { timestamp: digits(node.attrs['t'])! }),
	}
}

export interface PresenceEvent {
	/** Chat or user the presence is about. */
	chat: string
	/** Who in a group, when given. */
	participant?: string
	state: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused'
	/** Last seen (unix seconds) for `unavailable`, when the contact shares it. */
	lastSeen?: number
}

/** Parse `<presence>` (online/offline) and `<chatstate>` (typing/recording). */
export function parsePresence(node: BinaryNode): PresenceEvent | undefined {
	const chat = node.attrs['from'] ?? ''
	const participant = node.attrs['participant']
	const base = { chat, ...(participant && { participant }) }
	if (node.tag === 'presence') {
		const t = node.attrs['type']
		// Only the two defined states count; an unknown variant must not be reported as "online".
		if (t !== undefined && t !== 'available' && t !== 'unavailable') return undefined
		return {
			...base,
			state: t ?? 'available',
			...(digits(node.attrs['last']) !== undefined && { lastSeen: digits(node.attrs['last'])! }),
		}
	}
	if (node.tag === 'chatstate') {
		const c = kids(node)[0]
		if (!c) return undefined
		if (c.tag === 'composing')
			return { ...base, state: c.attrs['media'] === 'audio' ? 'recording' : 'composing' }
		if (c.tag === 'paused') return { ...base, state: 'paused' }
	}
	return undefined
}
