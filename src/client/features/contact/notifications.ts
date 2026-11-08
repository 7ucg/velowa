// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { BinaryNode } from '../../../codec/index.js'

const kids = (n: BinaryNode, tag?: string): BinaryNode[] =>
	Array.isArray(n.content) ? n.content.filter((c) => !tag || c.tag === tag) : []

const textOf = (n: BinaryNode | undefined): string | undefined => {
	if (typeof n?.content === 'string') return n.content
	if (n?.content instanceof Uint8Array) return Buffer.from(n.content).toString('utf8')
	return undefined
}

export interface PictureUpdate {
	jid: string
	author?: string
	removed: boolean
	pictureId?: string
	timestamp?: number
}

/**
 * `<notification type="picture">`: a contact's profile photo changed, or was removed (a `<delete>` child,
 * or none at all).
 */
export function parsePictureNotification(node: BinaryNode): PictureUpdate | undefined {
	const from = node.attrs['from']
	if (!from) return undefined
	const timestamp = node.attrs['t'] ? Number(node.attrs['t']) : undefined
	const set = kids(node, 'set')[0]
	if (set) {
		return {
			jid: set.attrs['jid'] ?? from,
			...(set.attrs['author'] && { author: set.attrs['author'] }),
			removed: false,
			...(set.attrs['id'] && { pictureId: set.attrs['id'] }),
			...(timestamp !== undefined && { timestamp }),
		}
	}
	const del = kids(node, 'delete')[0]
	if (del) {
		return {
			jid: del.attrs['jid'] ?? from,
			...(del.attrs['author'] && { author: del.attrs['author'] }),
			removed: true,
			...(timestamp !== undefined && { timestamp }),
		}
	}
	// A bare notification (no <set>/<delete> child at all) is WhatsApp's own deletion signal.
	if (kids(node).length === 0)
		return { jid: from, removed: true, ...(timestamp !== undefined && { timestamp }) }
	return undefined
}

export interface AboutUpdate {
	jid: string
	status: string
	timestamp?: number
}

/** `<notification type="status">`: a contact's About/status text changed. */
export function parseStatusNotification(node: BinaryNode): AboutUpdate | undefined {
	const from = node.attrs['from']
	const set = kids(node, 'set')[0]
	if (!from || !set) return undefined
	return {
		jid: from,
		status: textOf(set) ?? '',
		...(node.attrs['t'] && { timestamp: Number(node.attrs['t']) }),
	}
}

export interface DisappearingModeChanged {
	jid: string
	duration: number
	settingTimestamp: number
}

/** `<notification type="disappearing_mode">`: a contact changed their default disappearing-message timer. */
export function parseDisappearingModeNotification(
	node: BinaryNode,
): DisappearingModeChanged | undefined {
	const from = node.attrs['from']
	const dm = kids(node, 'disappearing_mode')[0]
	if (!from || !dm?.attrs['t']) return undefined
	return {
		jid: from,
		duration: Number(dm.attrs['duration'] ?? 0),
		settingTimestamp: Number(dm.attrs['t']),
	}
}

export type ContactChange =
	| { action: 'update'; jid: string; timestamp?: number }
	| {
			action: 'number-changed'
			oldJid: string
			newJid: string
			oldLid?: string
			newLid?: string
			timestamp?: number
	  }
	| { action: 'sync-requested'; after?: number; timestamp?: number }

/**
 * `<notification type="contacts">`: a contact's profile changed (`<update jid>`), their phone number
 * changed (`<modify old new old_lid new_lid>`), or the server asks for a full re-sync (`<sync after>`).
 * `<add>`/`<remove>` roster housekeeping carries nothing worth surfacing.
 */
export function parseContactsNotification(node: BinaryNode): ContactChange | undefined {
	const child = kids(node)[0]
	if (!child) return undefined
	const timestamp = node.attrs['t'] ? Number(node.attrs['t']) : undefined
	if (child.tag === 'update') {
		const jid = child.attrs['jid']
		if (!jid) return undefined
		return { action: 'update', jid, ...(timestamp !== undefined && { timestamp }) }
	}
	if (child.tag === 'modify') {
		const oldJid = child.attrs['old']
		const newJid = child.attrs['new']
		if (!oldJid || !newJid) return undefined
		return {
			action: 'number-changed',
			oldJid,
			newJid,
			...(child.attrs['old_lid'] && { oldLid: child.attrs['old_lid'] }),
			...(child.attrs['new_lid'] && { newLid: child.attrs['new_lid'] }),
			...(timestamp !== undefined && { timestamp }),
		}
	}
	if (child.tag === 'sync') {
		return {
			action: 'sync-requested',
			...(child.attrs['after'] && { after: Number(child.attrs['after']) }),
			...(timestamp !== undefined && { timestamp }),
		}
	}
	return undefined
}
