import { describe, expect, it } from 'vitest'
import { buildGroupInviteOffer, ensureVoipWasm } from '../../src/voip-wasm.js'

describe('buildGroupInviteOffer', () => {
	it('builds an offer carrying the current roster, addressed to the new target devices', () => {
		ensureVoipWasm()
		const node = buildGroupInviteOffer(
			JSON.stringify({
				call_id: '00'.padEnd(32, 'a'),
				id: 'I1',
				to: '222222222222@lid',
				creator: '111111111111:23@lid',
				target_devices: ['222222222222@lid', '222222222222:1@lid'],
				participants: [
					{ jid: '111111111111@lid', devices: [{ jid: '111111111111:23@lid' }] },
					{ jid: '333333333333@lid', devices: [{ jid: '333333333333@lid' }] },
				],
				video: false,
			}),
		) as { tag: string; attrs: Record<string, string>; content: unknown[] }
		expect(node.tag).toBe('call')
		expect(node.attrs['to']).toBe('222222222222@lid')
		const offer = (
			node.content as { tag: string; attrs: Record<string, string>; content: unknown[] }[]
		).find((c) => c.tag === 'offer')!
		expect(offer.attrs['call-id']).toBe('00'.padEnd(32, 'a'))
		const destination = (offer.content as { tag: string; content: unknown[] }[]).find(
			(c) => c.tag === 'destination',
		)!
		const toJids = (destination.content as { attrs: Record<string, string> }[]).map(
			(c) => c.attrs['jid'],
		)
		expect(toJids).toEqual(['222222222222@lid', '222222222222:1@lid'])
		const groupInfo = (offer.content as { tag: string; content: unknown[] }[]).find(
			(c) => c.tag === 'group_info',
		)!
		const users = (groupInfo.content as { tag: string; attrs: Record<string, string> }[]).filter(
			(c) => c.tag === 'user',
		)
		expect(users.map((u) => u.attrs['jid'])).toEqual(['111111111111@lid', '333333333333@lid'])
	})

	it('refuses with no target devices, or an empty roster', () => {
		ensureVoipWasm()
		const base = {
			call_id: '00'.padEnd(32, 'a'),
			id: 'I1',
			to: '222222222222@lid',
			creator: '111111111111:23@lid',
			video: false,
		}
		expect(() =>
			buildGroupInviteOffer(
				JSON.stringify({
					...base,
					target_devices: [],
					participants: [{ jid: 'a@lid', devices: [] }],
				}),
			),
		).toThrow()
		expect(() =>
			buildGroupInviteOffer(
				JSON.stringify({ ...base, target_devices: ['222222222222@lid'], participants: [] }),
			),
		).toThrow()
	})
})
