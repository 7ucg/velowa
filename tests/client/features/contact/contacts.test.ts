import { describe, expect, it } from 'vitest'
import type { BinaryNode } from '../../../../src/codec/index.js'
import * as c from '../../../../src/client/features/contact/contacts.js'
import { IqError } from '../../../../src/client/receiver.js'

const iqError = (code: string): BinaryNode => ({
	tag: 'iq',
	attrs: { type: 'error' },
	content: [{ tag: 'error', attrs: { code } }],
})

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
				throw new IqError(iqError(code))
			}
			expect(await c.profilePictureUrl(r, 'a@s.whatsapp.net')).toBeUndefined()
		}
		await expect(
			c.profilePictureUrl(async () => {
				throw new IqError(iqError('500'))
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

	it('always sends the legacy status IQ, and the mex mutation only when an emoji/expiry is given', async () => {
		const f = fake({ tag: 'iq', attrs: {} })
		const mexCalls: unknown[][] = []
		const mex = (async (...a: unknown[]) => (mexCalls.push(a), {})) as never

		await c.updateStatus(f.request, 'hi', {}, mex)
		expect(f.sent).toHaveLength(1)
		expect(mexCalls).toHaveLength(0)

		await c.updateStatus(f.request, 'hi', { emoji: '🎉', ephemeralDurationSec: 86400 }, mex)
		expect(f.sent).toHaveLength(2)
		expect(mexCalls).toEqual([
			[
				'9152604461510864',
				{ input: { text: 'hi', emoji: { content: '🎉' }, ephemeral_duration_sec: 86400 } },
			],
		])
	})

	it('throws rather than silently drop an emoji/expiry with no mex function given', async () => {
		const f = fake({ tag: 'iq', attrs: {} })
		await expect(c.updateStatus(f.request, 'hi', { emoji: '🎉' })).rejects.toThrow(/mex function/)
	})

	it('reads the usernames of contacts and leaves out those without one', async () => {
		const f = fake(
			usyncReply([
				{
					tag: 'user',
					attrs: { jid: '1@s.whatsapp.net' },
					content: [{ tag: 'username', attrs: {}, content: 'anna' }],
				},
				{
					tag: 'user',
					attrs: { jid: '2@s.whatsapp.net' },
					content: [{ tag: 'username', attrs: {} }],
				},
			]),
		)
		expect(
			await c.contactUsernames(f.request, 's1', ['1@s.whatsapp.net', '2@s.whatsapp.net']),
		).toEqual([{ jid: '1@s.whatsapp.net', username: 'anna' }])
		const query = kids(kids(f.sent[0]!, 'usync')[0]!, 'query')[0]!
		expect(kids(query).map((n) => n.tag)).toEqual(['username'])
	})

	it('reads the status privacy lists, default first', async () => {
		const f = fake({
			tag: 'iq',
			attrs: { type: 'result' },
			content: [
				{
					tag: 'privacy',
					attrs: {},
					content: [
						{
							tag: 'list',
							attrs: { type: 'whitelist' },
							content: [{ tag: 'user', attrs: { jid: '1@s.whatsapp.net' } }],
						},
						{
							tag: 'list',
							attrs: { type: 'contacts', default: 'true' },
							content: [],
						},
					],
				},
			],
		})
		expect(await c.fetchStatusPrivacy(f.request)).toEqual([
			{ type: 'contacts', isDefault: true, list: [] },
			{ type: 'whitelist', isDefault: false, list: ['1@s.whatsapp.net'] },
		])
	})

	it('falls back to the contacts default on an empty answer or a 404, but propagates any other error', async () => {
		const empty = fake({ tag: 'iq', attrs: { type: 'result' }, content: [] })
		expect(await c.fetchStatusPrivacy(empty.request)).toEqual([
			{ type: 'contacts', isDefault: true, list: [] },
		])
		const notFound = {
			request: async (): Promise<BinaryNode> => Promise.reject(new IqError(iqError('404'))),
		}
		expect(await c.fetchStatusPrivacy(notFound.request)).toEqual([
			{ type: 'contacts', isDefault: true, list: [] },
		])
		const serverError = {
			request: async (): Promise<BinaryNode> => Promise.reject(new IqError(iqError('500'))),
		}
		await expect(c.fetchStatusPrivacy(serverError.request)).rejects.toThrow('500')
	})

	it('resolves a business message link, with and without its pushname/business block', async () => {
		const f = fake({
			tag: 'iq',
			attrs: { type: 'result' },
			content: [
				{
					tag: 'qr',
					attrs: { jid: '1@s.whatsapp.net', notify: 'Anna' },
					content: [
						{ tag: 'message', attrs: {}, content: 'hi there' },
						{
							tag: 'business',
							attrs: { is_signed: 'true', verified_name: 'Anna Shop', verified_level: 'green' },
						},
					],
				},
			],
		})
		expect(await c.resolveBusinessMessageLink(f.request, 'https://wa.me/message/ABCD')).toEqual({
			jid: '1@s.whatsapp.net',
			pushName: 'Anna',
			message: 'hi there',
			isSigned: true,
			verifiedName: 'Anna Shop',
			verifiedLevel: 'green',
		})
		expect(kids(f.sent[0]!, 'qr')[0]!.attrs['code']).toBe('ABCD')
	})

	it('resolves a contact QR link and strips the known URL prefixes', async () => {
		const f = fake({
			tag: 'iq',
			attrs: { type: 'result' },
			content: [{ tag: 'qr', attrs: { jid: '2@s.whatsapp.net', type: 'contact' } }],
		})
		expect(await c.resolveContactQRLink(f.request, 'https://api.whatsapp.com/qr/XYZ')).toEqual({
			jid: '2@s.whatsapp.net',
			type: 'contact',
		})
		expect(kids(f.sent[0]!, 'qr')[0]!.attrs['code']).toBe('XYZ')
	})

	it('reads and revokes our own contact QR link', async () => {
		const f = fake({
			tag: 'iq',
			attrs: { type: 'result' },
			content: [{ tag: 'qr', attrs: { code: 'MYCODE' } }],
		})
		expect(await c.getContactQRLink(f.request)).toBe('MYCODE')
		expect(kids(f.sent[0]!, 'qr')[0]!.attrs['action']).toBe('get')
		await c.getContactQRLink(f.request, true)
		expect(kids(f.sent[1]!, 'qr')[0]!.attrs['action']).toBe('revoke')
	})
})
