import type { BinaryNode } from '../../../codec/index.js'

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
	/** `<video state>` of an in-call video change: 1 on, 3/11 upgrade request, 4 accept, 5 reject, 6 stopped. */
	videoState?: number
	/** `<user_action>` raise-hand: true raised, false lowered. */
	handRaised?: boolean
	/** The group a call was placed in (`group-jid`). */
	group?: string
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
		...((info.attrs['type'] === 'group' ||
			info.attrs['group-jid'] ||
			(Array.isArray(info.content) && info.content.some((c) => c.tag === 'group_info'))) && {
			isGroup: true,
		}),
		...(info.attrs['group-jid'] && { group: info.attrs['group-jid'] }),
		...(info.tag === 'video' &&
			/^\d{1,2}$/.test(info.attrs['state'] ?? '') && { videoState: Number(info.attrs['state']) }),
		...(info.tag === 'user_action' &&
			info.attrs['action'] === 'raise_hand' && {
				handRaised:
					(Array.isArray(info.content) ? info.content : []).find((k) => k.tag === 'raise_hand')
						?.attrs['raise-hand-state'] === '1',
			}),
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
