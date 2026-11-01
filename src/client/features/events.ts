import type { BinaryNode } from '../../codec/index.js'

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
export function parseReceipt(node: BinaryNode): ReceiptEvent {
	const ids = [node.attrs['id'] ?? '']
	for (const list of kids(node, 'list'))
		for (const item of kids(list, 'item')) if (item.attrs['id']) ids.push(item.attrs['id'])
	return {
		chat: node.attrs['from'] ?? '',
		...(node.attrs['participant'] && { participant: node.attrs['participant'] }),
		ids: ids.filter(Boolean),
		type: node.attrs['type'] ?? 'delivery',
		...(node.attrs['t'] && { timestamp: Number(node.attrs['t']) }),
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
		const type = node.attrs['type'] === 'unavailable' ? 'unavailable' : 'available'
		return {
			...base,
			state: type,
			...(node.attrs['last'] &&
				/^\d+$/.test(node.attrs['last']) && { lastSeen: Number(node.attrs['last']) }),
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
