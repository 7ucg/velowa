import { describe, expect, it } from 'vitest'
import { callAck, parseCall, rejectCall } from '../../../../src/client/features/call/call-events.js'

describe('call events', () => {
	it('parses call offers (with video) and acks every call stanza', () => {
		const offer = {
			tag: 'call',
			attrs: { from: 'a@lid', id: 'C1', t: '1700000000' },
			content: [
				{
					tag: 'offer',
					attrs: { 'call-id': 'CALL1', 'call-creator': 'a:2@lid' },
					content: [{ tag: 'video', attrs: {} }],
				},
			],
		}
		expect(parseCall(offer)).toEqual({
			status: 'offer',
			callId: 'CALL1',
			from: 'a@lid',
			creator: 'a:2@lid',
			isVideo: true,
			timestamp: 1700000000,
		})
		expect(parseCall({ tag: 'call', attrs: {} })).toBeUndefined()
		expect(callAck(offer)).toEqual({
			tag: 'ack',
			attrs: { id: 'C1', to: 'a@lid', class: 'call', type: 'offer' },
		})
		expect(rejectCall('CALL1', 'a:2@lid', 'R1')).toEqual({
			tag: 'call',
			attrs: { id: 'R1', to: 'a:2@lid' },
			content: [
				{ tag: 'reject', attrs: { 'call-id': 'CALL1', 'call-creator': 'a:2@lid', count: '0' } },
			],
		})
	})

	it('reads a screen share signal', () => {
		const node = {
			tag: 'call',
			attrs: { from: 'g@call', id: '1' },
			content: [
				{
					tag: 'screen_share',
					attrs: {
						'call-id': 'C1',
						'call-creator': '1@lid',
						screenshare_state: '1',
						version: '2',
						screen_share_id: '7',
					},
				},
			],
		}
		expect(parseCall(node)).toMatchObject({ screenShare: { state: 'started', version: 2, id: 7 } })
		node.content[0]!.attrs.screenshare_state = '2'
		expect(parseCall(node)?.screenShare?.state).toBe('stopped')
		node.content[0]!.attrs.screenshare_state = 'x'
		expect(parseCall(node)?.screenShare).toBeUndefined()
	})
})
