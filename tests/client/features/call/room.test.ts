import { describe, expect, it } from 'vitest'
import type { CallEvent } from '../../../../src/client/features/call/call-events.js'
import { Room, type RoomHost, type RoomOptions } from '../../../../src/client/features/call/room.js'

function setup(o: RoomOptions = {}) {
	const calls: string[] = []
	let push: (e: CallEvent) => void = () => undefined
	const host: RoomHost = {
		on: (_e, l) => ((push = l), () => undefined),
		setApprovalRequired: async (_id, on) => void calls.push(`approval:${on}`),
		answerWaitingRoom: async (_id, user, admit = true) =>
			void calls.push(`${admit ? 'admit' : 'deny'}:${user}`),
		endCall: async () => void calls.push('end'),
	}
	const room = new Room(
		host,
		{
			url: 'https://call.whatsapp.com/video/T',
			token: 'T',
			callId: 'C1',
			media: 'video',
			owner: '48@lid',
		},
		o,
	)
	const seen: string[] = []
	for (const k of ['request', 'admitted', 'denied', 'joined', 'left', 'closed'] as const)
		room.on(k, (p) => seen.push(`${k}:${'jid' in p ? p.jid : p.reason}`))
	const wait = (jid: string, guest = true, state = 'waiting_room_joined'): CallEvent => ({
		status: 'waiting_room_update',
		callId: 'C1',
		from: 'C1@call',
		waitingRoom: [{ jid, name: 'Gast', guest, state }],
	})
	const roster = (jid: string, state: string, guest = true): CallEvent => ({
		status: 'group_update',
		callId: 'C1',
		from: 'C1@call',
		roster: [
			{ jid: '48:24@lid', guest: false, state: 'connected' },
			{ jid, guest, state },
		],
	})
	const send = async (e: CallEvent) => {
		push(e)
		await new Promise((r) => setTimeout(r, 5))
	}
	return { room, calls, seen, send, wait, roster }
}

describe('Room', () => {
	it('lets everybody in by default and tells who joined and left', async () => {
		const { room, calls, seen, send, wait, roster } = setup()
		await send(wait('9@lid'))
		expect(calls).toEqual(['admit:9@lid'])
		await send(roster('9@lid', 'connected'))
		expect(room.inside.map((p) => p.jid)).toEqual(['9@lid'])
		expect(room.inside[0]!.guest).toBe(true)
		await send(roster('9@lid', 'terminated'))
		expect(room.inside).toEqual([])
		expect(seen).toEqual(['request:9@lid', 'admitted:9@lid', 'joined:9@lid', 'left:9@lid'])
	})

	it('asks once per person, ignores the owner and states other than waiting', async () => {
		const { calls, send, wait } = setup()
		await send(wait('9@lid'))
		await send(wait('9@lid'))
		await send(wait('48:24@lid'))
		await send(wait('7@lid', true, 'waiting_room_left'))
		expect(calls).toEqual(['admit:9@lid'])
	})

	it('can admit only guests and turn others away', async () => {
		const { calls, seen, send, wait } = setup({ admit: 'guests' })
		await send(wait('9@lid', true))
		await send(wait('5@lid', false))
		expect(calls).toEqual(['admit:9@lid', 'deny:5@lid'])
		expect(seen).toContain('denied:5@lid')
	})

	it('does nothing by itself with the rule none, and admit / deny work by hand', async () => {
		const { room, calls, send, wait } = setup({ admit: 'none' })
		await send(wait('9@lid'))
		await send(wait('8@lid'))
		expect(calls).toEqual([])
		expect(room.waiting.map((p) => p.jid)).toEqual(['9@lid', '8@lid'])
		await room.admit('9@lid')
		await room.deny('8@lid')
		expect(calls).toEqual(['admit:9@lid', 'deny:8@lid'])
		expect(room.waiting).toEqual([])
	})

	it('decides per request with a function, and stops at maxGuests', async () => {
		const { calls, send, wait, roster } = setup({
			admit: async (p) => p.name === 'Gast',
			maxGuests: 1,
		})
		await send(wait('9@lid'))
		await send(roster('9@lid', 'connected'))
		await send(wait('8@lid')) // the room is full
		expect(calls).toEqual(['admit:9@lid', 'deny:8@lid'])
	})

	it('closes when the call ends and ignores other calls', async () => {
		const { room, seen, send } = setup()
		await send({ status: 'terminate', callId: 'OTHER', from: 'OTHER@call' })
		expect(room.closed).toBe(false)
		await send({ status: 'terminate', callId: 'C1', from: 'C1@call' })
		expect(room.closed).toBe(true)
		expect(seen).toEqual(['closed:terminated'])
	})

	it('ends the call on close() and sets approval', async () => {
		const { room, calls } = setup()
		await room.setApprovalRequired(false)
		await room.close('bye')
		await room.close('again')
		expect(calls).toEqual(['approval:false', 'end'])
	})
})
