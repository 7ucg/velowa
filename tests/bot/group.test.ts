import { describe, expect, it, vi } from 'vitest'
import type { Client } from '../../src/client/client.js'
import { GroupCache, isGroupAdmin } from '../../src/bot/group.js'

const meta = {
	id: '1@g.us',
	subject: 'Team',
	size: 3,
	announce: false,
	participants: [
		{ id: '10@lid', phoneNumber: '4915600000001@s.whatsapp.net', admin: 'superadmin' as const },
		{ id: '20@lid', phoneNumber: '4915600000002@s.whatsapp.net', admin: 'admin' as const },
		{ id: '30@lid', phoneNumber: '4915600000003@s.whatsapp.net', admin: null },
	],
}

describe('group info', () => {
	it('lists the admins in every form and answers for phone numbers and LIDs', async () => {
		const metadata = vi.fn().mockResolvedValue(meta)
		const cache = new GroupCache({ groups: { metadata } } as unknown as Client)
		const g = await cache.get('1@g.us')
		expect(g.admins).toHaveLength(4)
		expect(isGroupAdmin(g, '20@lid')).toBe(true)
		expect(isGroupAdmin(g, '4915600000001:5@s.whatsapp.net')).toBe(true)
		expect(isGroupAdmin(g, '30@lid')).toBe(false)
		expect(isGroupAdmin(g, '4915600000003@s.whatsapp.net')).toBe(false)
		expect(isGroupAdmin(undefined, '20@lid')).toBe(false)
	})

	it('asks once for a busy group and again after forget()', async () => {
		const metadata = vi.fn().mockResolvedValue(meta)
		const cache = new GroupCache({ groups: { metadata } } as unknown as Client)
		await Promise.all([cache.get('1@g.us'), cache.get('1@g.us'), cache.get('1@g.us')])
		await cache.get('1@g.us')
		expect(metadata).toHaveBeenCalledTimes(1)
		cache.forget('1@g.us')
		await cache.get('1@g.us')
		expect(metadata).toHaveBeenCalledTimes(2)
	})

	it('does not keep a failed lookup', async () => {
		const metadata = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValue(meta)
		const cache = new GroupCache({ groups: { metadata } } as unknown as Client)
		await expect(cache.get('1@g.us')).rejects.toThrow('timeout')
		await expect(cache.get('1@g.us')).resolves.toMatchObject({ subject: 'Team' })
	})
})
