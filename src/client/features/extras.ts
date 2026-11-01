import { randomBytes } from 'node:crypto'
import type { BinaryNode } from '../../codec/index.js'
import type { SendOptions } from '../sender.js'

/** A poll. Voters' answers are end-to-end encrypted with the poll's `messageSecret` (added automatically on send). */
export function poll(
	name: string,
	values: string[],
	selectableCount = 1,
): { message: Record<string, unknown>; opts: SendOptions } {
	if (!name.trim()) throw new Error('poll needs a question')
	if (values.length < 2 || values.length > 12) throw new Error('a poll needs 2 to 12 options')
	if (new Set(values).size !== values.length) throw new Error('poll options must be unique')
	if (selectableCount < 0 || selectableCount > values.length) {
		throw new Error(`selectableCount must be between 0 and ${values.length}`)
	}
	const creation = {
		name,
		selectableOptionsCount: selectableCount,
		options: values.map((optionName) => ({ optionName })),
		pollType: 'POLL',
	}
	return {
		// Single-choice polls use the V3 field, multiple choice the original one (as WhatsApp Web does).
		message: {
			messageContextInfo: { messageSecret: randomBytes(32) },
			...(selectableCount === 1
				? { pollCreationMessageV3: creation }
				: { pollCreationMessage: creation }),
		},
		opts: { extraNodes: [{ tag: 'meta', attrs: { polltype: 'creation' } }] },
	}
}

/** Wrap a message so it can be opened once (`v2` is what current clients send). */
export const viewOnce = (message: Record<string, unknown>): Record<string, unknown> => ({
	viewOnceMessageV2: { message },
})

export const location = (
	latitude: number,
	longitude: number,
	o: { name?: string; address?: string } = {},
): Record<string, unknown> => ({
	locationMessage: { degreesLatitude: latitude, degreesLongitude: longitude, ...o },
})

/** A shared contact card from a vCard string. */
export const contactCard = (displayName: string, vcard: string): Record<string, unknown> => ({
	contactMessage: { displayName, vcard },
})

/** Minimal vCard for a phone number. */
export function vcardFor(name: string, phoneE164: string): string {
	const digits = phoneE164.replace(/[^\d]/g, '')
	return `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL;type=VOICE;waid=${digits}:+${digits}\nEND:VCARD`
}

// ---- calls ------------------------------------------------------------------------------------

export interface CallEvent {
	/** `offer`, `terminate`, `reject`, `accept`, `timeout`, ... (the call stanza's first child). */
	status: string
	callId: string
	/** The chat / device the call stanza came from. */
	from: string
	/** Who started the call. */
	creator?: string
	isVideo?: boolean
	isGroup?: boolean
	timestamp?: number
}

/** Parse an incoming `<call>` stanza. */
export function parseCall(node: BinaryNode): CallEvent | undefined {
	const info = Array.isArray(node.content) ? node.content[0] : undefined
	if (!info) return undefined
	const callId = info.attrs['call-id']
	if (!callId) return undefined
	const hasVideo = Array.isArray(info.content) && info.content.some((c) => c.tag === 'video')
	return {
		status: info.tag,
		callId,
		from: node.attrs['from'] ?? '',
		...(info.attrs['call-creator'] && { creator: info.attrs['call-creator'] }),
		...(info.tag === 'offer' && { isVideo: hasVideo }),
		...(info.attrs['type'] === 'group' && { isGroup: true }),
		...(node.attrs['t'] &&
			/^\d{1,12}$/.test(node.attrs['t']) && { timestamp: Number(node.attrs['t']) }),
	}
}

/** Decline an incoming call. */
export function rejectCall(callId: string, callCreator: string, id: string): BinaryNode {
	return {
		tag: 'call',
		attrs: { id, to: callCreator },
		content: [
			{ tag: 'reject', attrs: { 'call-id': callId, 'call-creator': callCreator, count: '0' } },
		],
	}
}

/** The ack WhatsApp expects for a call stanza (`class="call"`, `type` = the stanza's first child). */
export function callAck(node: BinaryNode): BinaryNode {
	const first = Array.isArray(node.content) ? node.content[0] : undefined
	return {
		tag: 'ack',
		attrs: {
			id: node.attrs['id'] ?? '',
			to: node.attrs['from'] ?? '',
			class: 'call',
			...(first && { type: first.tag }),
		},
	}
}
