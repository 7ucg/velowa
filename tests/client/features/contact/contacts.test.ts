import { describe, expect, it } from 'vitest'
import type { BinaryNode } from '../../../../src/codec/index.js'
import * as c from '../../../../src/client/features/contact/contacts.js'

function fake(reply: BinaryNode) {
	const sent: BinaryNode[] = []
	return { request: async (n: BinaryNode) => (sent.push(n), reply), sent }
}
const kids = (n: BinaryNode, tag?: string) =>
	Array.isArray(n.content) ? n.content.filter((x) => !tag || x.tag === tag) : []
const usyncReply = (users: BinaryNode[]): BinaryNode => ({
	tag: 'iq',
	attrs: { type: 'result' },
	content: [{ tag: 'usync', attrs: {}, content: [{ tag: 'list', attrs: {}, content: users }] }],
})

describe('contacts', () => {
	it('onWhatsApp queries by phone number and reads the contact type', async () => {
		const f = fake(
			usyncReply([
				{
					tag: 'user',
					attrs: { jid: '4915611111111@s.whatsapp.net' },
					content: [{ tag: 'contact', attrs: { type: 'in' } }],
				},
				{
					tag: 'user',
					attrs: { jid: '4900000000@s.whatsapp.net' },
					content: [{ tag: 'contact', attrs: { type: 'out' } }],
				},
			]),
		)
		const res = await c.onWhatsApp(f.request, 'sid1', [
			'4915611111111@s.whatsapp.net',
			'+4900000000',
			'1@lid',
		])
		expect(res).toEqual([
			{ jid: '4915611111111@s.whatsapp.net', exists: true },
			{ jid: '4900000000@s.whatsapp.net', exists: false },
		])
		const usyncNode = kids(f.sent[0]!, 'usync')[0]!
		expect(usyncNode.attrs).toMatchObject({
			context: 'interactive',
			mode: 'query',
			sid: 'sid1',
			last: 'true',
			index: '0',
		})
		const users = kids(kids(usyncNode, 'list')[0]!, 'user')
		expect(users.map((u) => u.content)).toEqual([
			[{ tag: 'contact', attrs: {}, content: '+4915611111111' }],
			[{ tag: 'contact', attrs: {}, content: '+4900000000' }],
		])
		expect(users[0]!.attrs).toEqual({}) // phone lookups carry no jid
		expect(await c.onWhatsApp(f.request, 's', ['1@lid'])).toEqual([])
	})

	it('finds a user by username, sending the name (and PIN) in the contact element', async () => {
		const f = fake(
			usyncReply([
				{
					tag: 'user',
					attrs: { jid: '9@lid' },
					content: [{ tag: 'contact', attrs: { type: 'in' } }],
				},
			]),
		)
		expect(await c.findUserByUsername(f.request, 's', '@9oged', '1234')).toEqual({
			jid: '9@lid',
			exists: true,
		})
		const user = kids(kids(kids(f.sent[0]!, 'usync')[0]!, 'list')[0]!, 'user')[0]!
		expect(user.attrs).toEqual({})
		expect(kids(user)[0]).toEqual({ tag: 'contact', attrs: { username: '9oged', pin: '1234' } })
		expect(
			await c.findUserByUsername(async () => ({ tag: 'iq', attrs: {} }), 's', 'nobody'),
		).toBeNull()
	})

	it('reads status text and time', async () => {
		const f = fake(
			usyncReply([
				{
					tag: 'user',
					attrs: { jid: 'a@s.whatsapp.net' },
					content: [{ tag: 'status', attrs: { t: '1700000000' }, content: Buffer.from('Hallo') }],
				},
				{
					tag: 'user',
					attrs: { jid: 'b@s.whatsapp.net' },
					content: [{ tag: 'status', attrs: { t: '0' } }],
				},
			]),
		)
		const res = await c.fetchStatus(f.request, 's', ['a@s.whatsapp.net', 'b@s.whatsapp.net'])
		expect(res[0]).toMatchObject({ jid: 'a@s.whatsapp.net', status: 'Hallo' })
		expect(res[0]!.setAt.getTime()).toBe(1700000000000)
		expect(res[1]!.status).toBeNull()
	})

	it('maps phone numbers to lids', async () => {
		const f = fake(
			usyncReply([
				{
					tag: 'user',
					attrs: { jid: 'a@s.whatsapp.net' },
					content: [{ tag: 'lid', attrs: { val: '9@lid' } }],
				},
			]),
		)
		expect(await c.lidsFor(f.request, 's', ['a@s.whatsapp.net', 'x@lid'])).toEqual([
			{ pn: 'a@s.whatsapp.net', lid: '9@lid' },
		])
		expect(kids(kids(kids(f.sent[0]!, 'usync')[0]!, 'list')[0]!, 'user')).toHaveLength(1)
	})

	it('reports a missing or hidden profile picture as undefined, not as an error', async () => {
		for (const code of ['404', '401', '403']) {
			const r = async () => {
				throw new Error(`iq error: [{"tag":"error","attrs":{"code":"${code}"}}]`)
			}
			expect(await c.profilePictureUrl(r, 'a@s.whatsapp.net')).toBeUndefined()
		}
		await expect(
			c.profilePictureUrl(async () => {
				throw new Error('iq error: [{"tag":"error","attrs":{"code":"500"}}]')
			}, 'a@s.whatsapp.net'),
		).rejects.toThrow(/500/)
	})

	it('profile picture, about, block list and privacy requests', async () => {
		const pic = fake({
			tag: 'iq',
			attrs: {},
			content: [{ tag: 'picture', attrs: { url: 'https://pps.whatsapp.net/x' } }],
		})
		expect(await c.profilePictureUrl(pic.request, '4915:5@s.whatsapp.net', 'image')).toBe(
			'https://pps.whatsapp.net/x',
		)
		expect(pic.sent[0]!.attrs).toMatchObject({
			target: '4915@s.whatsapp.net',
			xmlns: 'w:profile:picture',
		})
		expect(kids(pic.sent[0]!)[0]!.attrs).toEqual({ type: 'image', query: 'url' })

		const bl = fake({
			tag: 'iq',
			attrs: {},
			content: [{ tag: 'list', attrs: {}, content: [{ tag: 'item', attrs: { jid: 'x@lid' } }] }],
		})
		expect(await c.fetchBlocklist(bl.request)).toEqual(['x@lid'])
		await c.updateBlockStatus(bl.request, 'x@lid', 'block')
		expect(kids(bl.sent[1]!)[0]!.attrs).toEqual({ action: 'block', jid: 'x@lid' })

		const pv = fake({
			tag: 'iq',
			attrs: {},
			content: [
				{
					tag: 'privacy',
					attrs: {},
					content: [
						{ tag: 'category', attrs: { name: 'last', value: 'contacts' } },
						{ tag: 'category', attrs: { name: 'readreceipts', value: 'all' } },
					],
				},
			],
		})
		expect(await c.fetchPrivacySettings(pv.request)).toEqual({
			last: 'contacts',
			readreceipts: 'all',
		})
		await c.updatePrivacy(pv.request, 'last', 'none')
		expect(kids(kids(pv.sent[1]!)[0]!)[0]!.attrs).toEqual({ name: 'last', value: 'none' })

		await c.updateStatus(pv.request, 'Beschäftigt')
		expect(Buffer.from(kids(pv.sent[2]!)[0]!.content as Uint8Array).toString()).toBe('Beschäftigt')
	})
})
