import { describe, expect, it } from 'vitest'
import type { BinaryNode } from '../../codec/index.js'
import { Groups, parseGroup } from './groups.js'

const groupNode: BinaryNode = {
	tag: 'group',
	attrs: {
		id: '120363000000000001',
		subject: 'Testgruppe',
		s_o: '49150@s.whatsapp.net',
		s_t: '1700000000',
		creation: '1690000000',
		creator: '49150@s.whatsapp.net',
		addressing_mode: 'lid',
	},
	content: [
		{
			tag: 'description',
			attrs: { id: 'D1' },
			content: [{ tag: 'body', attrs: {}, content: 'Beschreibung' }],
		},
		{ tag: 'locked', attrs: {} },
		{ tag: 'ephemeral', attrs: { expiration: '604800' } },
		{ tag: 'member_add_mode', attrs: {}, content: 'all_member_add' },
		{
			tag: 'participant',
			attrs: { jid: '1@lid', type: 'superadmin', phone_number: '49150@s.whatsapp.net' },
		},
		{ tag: 'participant', attrs: { jid: '49151@s.whatsapp.net', lid: '2@lid' } },
		{ tag: 'participant', attrs: { jid: '3@lid', type: 'admin' } },
	],
}

describe('parseGroup', () => {
	it('reads settings, description, ephemeral and participants', () => {
		const m = parseGroup({ tag: 'iq', attrs: {}, content: [groupNode] })
		expect(m).toMatchObject({
			id: '120363000000000001@g.us',
			subject: 'Testgruppe',
			desc: 'Beschreibung',
			descId: 'D1',
			restrict: true,
			announce: false,
			memberAddAll: true,
			ephemeralDuration: 604800,
			addressingMode: 'lid',
			size: 3,
			creation: 1690000000,
		})
		expect(m.participants).toEqual([
			{ id: '1@lid', phoneNumber: '49150@s.whatsapp.net', admin: 'superadmin' },
			{ id: '49151@s.whatsapp.net', lid: '2@lid', admin: null },
			{ id: '3@lid', admin: 'admin' },
		])
	})

	it('throws without a group node', () => {
		expect(() => parseGroup({ tag: 'iq', attrs: {} })).toThrow()
	})
})

describe('Groups requests', () => {
	function harness(reply: BinaryNode = { tag: 'iq', attrs: { type: 'result' } }) {
		const sent: BinaryNode[] = []
		const groups = new Groups(async (n) => (sent.push(n), reply))
		return { groups, sent }
	}
	const content = (n: BinaryNode) => n.content as BinaryNode[]

	it('creates a group', async () => {
		const { groups, sent } = harness({ tag: 'iq', attrs: {}, content: [groupNode] })
		const m = await groups.create(
			'Neu',
			['a@s.whatsapp.net', 'b@s.whatsapp.net'],
			'4915600000000:1@s.whatsapp.net',
		)
		expect(m.subject).toBe('Testgruppe')
		expect(sent[0]!.attrs).toEqual({ type: 'set', xmlns: 'w:g2', to: '@g.us' })
		const create = content(sent[0]!)[0]!
		expect(create.tag).toBe('create')
		expect(create.attrs['subject']).toBe('Neu')
		expect(create.attrs['key']).toMatch(/^3EB0/)
		expect(content(create).map((p) => p.attrs['jid'])).toEqual([
			'a@s.whatsapp.net',
			'b@s.whatsapp.net',
		])
	})

	it('updates participants and reports per-member status', async () => {
		const { groups, sent } = harness({
			tag: 'iq',
			attrs: {},
			content: [
				{
					tag: 'promote',
					attrs: {},
					content: [
						{ tag: 'participant', attrs: { jid: 'a@lid' } },
						{ tag: 'participant', attrs: { jid: 'b@lid', error: '403' } },
					],
				},
			],
		})
		const res = await groups.updateParticipants('g@g.us', ['a@lid', 'b@lid'], 'promote')
		expect(res).toEqual([
			{ jid: 'a@lid', status: '200' },
			{ jid: 'b@lid', status: '403' },
		])
		expect(sent[0]!.attrs['to']).toBe('g@g.us')
		expect(content(sent[0]!)[0]!.tag).toBe('promote')
	})

	it('sets description with prev id, and deletes it when empty', async () => {
		const sent: BinaryNode[] = []
		const groups = new Groups(async (n) => {
			sent.push(n)
			return n.attrs['type'] === 'get'
				? { tag: 'iq', attrs: {}, content: [groupNode] }
				: { tag: 'iq', attrs: {} }
		})
		await groups.setDescription('g@g.us', 'neu')
		const set = content(sent[1]!)[0]!
		expect(set.attrs['prev']).toBe('D1')
		expect(set.attrs['id']).toMatch(/^3EB0/)
		expect(Buffer.from(content(set)[0]!.content as Uint8Array).toString()).toBe('neu')
		await groups.setDescription('g@g.us', '')
		expect(content(sent[3]!)[0]!.attrs).toEqual({ delete: 'true', prev: 'D1' })
	})

	it('builds settings, invite, ephemeral and join-approval requests', async () => {
		const { groups, sent } = harness({
			tag: 'iq',
			attrs: {},
			content: [
				{ tag: 'invite', attrs: { code: 'ABC' } },
				{ tag: 'group', attrs: { jid: 'x@g.us' } },
			],
		})
		expect(await groups.inviteCode('g@g.us')).toBe('ABC')
		expect(await groups.acceptInvite('ABC')).toBe('x@g.us')
		await groups.setEphemeral('g@g.us', 0)
		await groups.setEphemeral('g@g.us', 86400)
		await groups.setting('g@g.us', 'announcement')
		await groups.setMemberAddMode('g@g.us', 'all_member_add')
		await groups.setJoinApproval('g@g.us', 'on')
		const tags = sent.map((n) => content(n)[0]!.tag)
		expect(tags).toEqual([
			'invite',
			'invite',
			'not_ephemeral',
			'ephemeral',
			'announcement',
			'member_add_mode',
			'membership_approval_mode',
		])
		expect(content(sent[3]!)[0]!.attrs).toEqual({ expiration: '86400' })
	})

	it('lists all groups', async () => {
		const { groups } = harness({
			tag: 'iq',
			attrs: {},
			content: [{ tag: 'groups', attrs: {}, content: [groupNode] }],
		})
		const all = await groups.fetchAll()
		expect(Object.keys(all)).toEqual(['120363000000000001@g.us'])
	})
})

describe('parseGroupNotification', () => {
	it('emits one event per change', async () => {
		const { parseGroupNotification } = await import('./groups.js')
		const events = parseGroupNotification({
			tag: 'notification',
			attrs: { from: 'g@g.us', type: 'w:gp2', participant: 'admin@lid', t: '1700000000' },
			content: [
				{ tag: 'add', attrs: {}, content: [{ tag: 'participant', attrs: { jid: 'a@lid' } }] },
				{ tag: 'subject', attrs: { subject: 'Neuer Name' } },
				{ tag: 'announcement', attrs: {} },
			],
		})
		expect(events.map((e) => e.action)).toEqual(['add', 'subject', 'announcement'])
		expect(events[0]).toMatchObject({
			group: 'g@g.us',
			actor: 'admin@lid',
			timestamp: 1700000000,
			participants: ['a@lid'],
		})
		expect(events[1]!.subject).toBe('Neuer Name')
	})
})
