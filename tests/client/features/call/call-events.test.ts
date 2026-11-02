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

	it('marks a silent (lightweight) group call and says why', () => {
		const node = {
			tag: 'call',
			attrs: { from: '21@lid', id: 'A', t: '1793647914' },
			content: [
				{
					tag: 'offer',
					attrs: {
						'call-creator': '21@lid',
						'call-id': 'C9',
						'group-jid': '1203@g.us',
						lightweight: '1',
						caller_pn: '4949120340056@s.whatsapp.net',
					},
					content: [
						{ tag: 'audio', attrs: { rate: '8000', enc: 'opus' } },
						{ tag: 'silence', attrs: { reason: 'vc_wave_all' } },
					],
				},
			],
		}
		expect(parseCall(node)).toMatchObject({
			status: 'offer',
			isGroup: true,
			group: '1203@g.us',
			lightweight: true,
			silence: 'vc_wave_all',
			callerPn: '4949120340056@s.whatsapp.net',
		})
		// an ordinary offer has none of it, and odd values are dropped
		const plain = {
			...node,
			content: [
				{
					...node.content[0]!,
					attrs: { 'call-creator': '21@lid', 'call-id': 'C9', caller_pn: 'x' },
					content: [{ tag: 'silence', attrs: { reason: 'Bad Reason!' } }],
				},
			],
		}
		const r = parseCall(plain)!
		expect(r.lightweight).toBeUndefined()
		expect(r.silence).toBeUndefined()
		expect(r.callerPn).toBeUndefined()
	})

	it('lists who is in the waiting room of a call link, guests included', () => {
		const update = (users: object[]) => ({
			tag: 'call',
			attrs: { from: 'C1@call', id: '9', t: '1793648782' },
			content: [
				{
					tag: 'waiting_room_update',
					attrs: { 'call-id': 'C1', 'call-creator': '1@lid' },
					content: [
						{ tag: 'waiting_room', attrs: { enabled: '1', is_admin: '1' }, content: users },
					],
				},
			],
		})
		const r = parseCall(
			update([
				{
					tag: 'user',
					attrs: {
						account_kind: 'guest',
						push_name: 'Gast',
						jid: '29554559176938@lid',
						state: 'waiting_room_joined',
					},
				},
				{ tag: 'user', attrs: { jid: 'not a jid', state: 'x' } },
			]),
		)!
		expect(r.waitingRoom).toEqual([
			{ jid: '29554559176938@lid', name: 'Gast', guest: true, state: 'waiting_room_joined' },
		])
		expect(parseCall(update([]))!.waitingRoom).toEqual([])
	})

	it('reads the roster of a group update, with guests and who left', () => {
		const r = parseCall({
			tag: 'call',
			attrs: { from: 'C1@call', id: '3' },
			content: [
				{
					tag: 'group_update',
					attrs: { 'call-id': 'C1', 'call-creator': '1@lid' },
					content: [
						{
							tag: 'group_info',
							attrs: {},
							content: [
								{ tag: 'user', attrs: { jid: '48@lid', state: 'connected', type: 'admin' } },
								{
									tag: 'user',
									attrs: {
										jid: '29@lid',
										state: 'terminated',
										account_kind: 'guest',
										push_name: 'Gast',
									},
								},
							],
						},
					],
				},
			],
		})!
		expect(r.roster).toEqual([
			{ jid: '48@lid', guest: false, state: 'connected' },
			{ jid: '29@lid', name: 'Gast', guest: true, state: 'terminated' },
		])
	})
})
