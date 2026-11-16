// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { BinaryNode } from '../../../codec/index.js'

const kids = (n: BinaryNode, tag: string): BinaryNode | undefined =>
	Array.isArray(n.content) ? n.content.find((c) => c.tag === tag) : undefined

export interface OfflinePreview {
	total: number
	appDataChanges: number
	messages: number
	notifications: number
	receipts: number
}

/** `<ib><offline_preview count appdata message notification receipt/></ib>`: right after connecting,
 * how much the server is about to redeliver from while we were offline. */
export function parseOfflinePreview(node: BinaryNode): OfflinePreview | undefined {
	const p = kids(node, 'offline_preview')
	if (!p) return undefined
	return {
		total: Number(p.attrs['count'] ?? 0),
		appDataChanges: Number(p.attrs['appdata'] ?? 0),
		messages: Number(p.attrs['message'] ?? 0),
		notifications: Number(p.attrs['notification'] ?? 0),
		receipts: Number(p.attrs['receipt'] ?? 0),
	}
}

export interface OfflineCompleted {
	count: number
}

/** `<ib><offline count/></ib>`: the redelivery from `offline_preview` has finished catching up. */
export function parseOfflineCompleted(node: BinaryNode): OfflineCompleted | undefined {
	const o = kids(node, 'offline')
	if (!o) return undefined
	return { count: Number(o.attrs['count'] ?? 0) }
}
