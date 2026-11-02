import { describe, expect, it } from 'vitest'
import type { BinaryNode } from '../../../../src/codec/index.js'
import { Account, removeDeviceNode } from '../../../../src/client/features/account/account.js'

function fake() {
	const sent: BinaryNode[] = []
	const calls: { id: string; variables: unknown; path?: string }[] = []
	const account = new Account(
		async (n) => (sent.push(n), { tag: 'iq', attrs: { type: 'result' } }),
		(async (id: string, variables: unknown, path?: string) => (
			calls.push({ id, variables, ...(path && { path }) }),
			[]
		)) as never,
	)
	return { account, sent, calls }
}

describe('account', () => {
	it('builds the stanza that unlinks a device', () => {
		expect(removeDeviceNode('4915600000000:24@s.whatsapp.net')).toEqual({
			tag: 'iq',
			attrs: { to: 's.whatsapp.net', xmlns: 'md', type: 'set' },
			content: [
				{
					tag: 'remove-companion-device',
					attrs: { jid: '4915600000000:24@s.whatsapp.net', reason: 'user_initiated' },
				},
			],
		})
	})

	it('removes a linked device', async () => {
		const { account, sent } = fake()
		await account.removeDevice('1:7@s.whatsapp.net', 'security')
		expect(sent[0]!.content).toEqual([
			{ tag: 'remove-companion-device', attrs: { jid: '1:7@s.whatsapp.net', reason: 'security' } },
		])
	})

	it('manages trusted devices through GraphQL', async () => {
		const { account, calls } = fake()
		await account.trustedDevices()
		await account.trustDevice('d1', 'Laptop')
		await account.untrustDevice('d1')
		await account.deleteTrustedDevice('d1')
		expect(calls.map((c) => c.path)).toEqual([
			'xwa2_get_trusted_devices',
			'xwa2_add_trusted_device',
			'xwa2_untrust_trusted_device',
			'xwa2_delete_trusted_device',
		])
		expect(calls[1]).toMatchObject({ variables: { device_id: 'd1', device_name: 'Laptop' } })
		expect(calls[2]).toMatchObject({ variables: { device_id: 'd1', reason: 'USER_INITIATED' } })
	})

	it('sets, removes and shows linked profiles', async () => {
		const { account, calls } = fake()
		await account.setLinkedProfiles([
			{ type: 'INSTAGRAM', username: 'me' },
			{ type: 'FACEBOOK', vid: '123' },
		])
		await account.removeLinkedProfiles(['INSTAGRAM'])
		await account.showLinkedProfiles([{ type: 'FACEBOOK', showOnProfile: false }])
		expect(calls[0]!.variables).toEqual({
			profiles: [
				{ type: 'INSTAGRAM', username: 'me' },
				{ type: 'FACEBOOK', vid: '123' },
			],
		})
		expect(calls[1]!.variables).toEqual({ profiles: [{ type: 'INSTAGRAM' }] })
		expect(calls[2]!.variables).toEqual({
			profiles: [{ type: 'FACEBOOK', show_on_profile: false }],
		})
	})
})
