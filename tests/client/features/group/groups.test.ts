import { describe, expect, it } from 'vitest'
import type { BinaryNode } from '../../../../src/codec/index.js'
import { Groups, parseGroup } from '../../../../src/client/features/group/groups.js'

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
		const { parseGroupNotification } =
			await import('../../../../src/client/features/group/groups.js')
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

	it('decodes the typed fields of settings-change notifications', async () => {
		const { parseGroupNotification } =
			await import('../../../../src/client/features/group/groups.js')
		const events = parseGroupNotification({
			tag: 'notification',
			attrs: { from: 'g@g.us', type: 'w:gp2' },
			content: [
				{
					tag: 'subject',
					attrs: {
						subject: 'Neuer Name',
						s_o: 'renamer@lid',
						s_o_pn: '4915600000000@s.whatsapp.net',
						s_o_username: 'renamer',
						s_t: '1700000001',
					},
				},
				{ tag: 'locked', attrs: { threshold: '7' } },
				{ tag: 'ephemeral', attrs: { expiration: '604800', trigger: '1700000000' } },
				{ tag: 'not_ephemeral', attrs: {} },
				{ tag: 'growth_locked', attrs: { expiration: '86400', type: 'admin' } },
				{
					tag: 'membership_approval_request',
					attrs: { request_method: 'invite_link', parent_group_jid: 'c@g.us' },
				},
			],
		})
		expect(events[0]).toMatchObject({
			action: 'subject',
			subjectOwner: 'renamer@lid',
			subjectOwnerPn: '4915600000000@s.whatsapp.net',
			subjectOwnerUsername: 'renamer',
			subjectTime: 1700000001,
		})
		expect(events[1]).toMatchObject({ action: 'locked', threshold: '7' })
		expect(events[2]).toMatchObject({
			action: 'ephemeral',
			expiration: 604800,
			trigger: 1700000000,
		})
		expect(events[3]).toMatchObject({ action: 'ephemeral', expiration: 0 })
		expect(events[3]!.trigger).toBeUndefined()
		expect(events[4]).toMatchObject({
			action: 'growth_locked',
			expiration: 86400,
			lockType: 'admin',
		})
		expect(events[5]).toMatchObject({
			action: 'membership_approval_request',
			requestMethod: 'invite_link',
			parentGroupJid: 'c@g.us',
		})
	})
})

describe('group permissions and member tag', () => {
	it('builds the member-label message (30 chars max) and the history-share property call', async () => {
		const { memberLabelMessage, setGroupProperty, GROUP_SET_PROPERTY_QUERY } =
			await import('../../../../src/client/features/group/groups.js')
		const m = memberLabelMessage('x'.repeat(40), 1700000000) as {
			protocolMessage: { type: string; memberLabel: { label: string; labelTimestamp: number } }
		}
		expect(m.protocolMessage.type).toBe('GROUP_MEMBER_LABEL_CHANGE')
		expect(m.protocolMessage.memberLabel.label).toHaveLength(30)
		const calls: unknown[][] = []
		await setGroupProperty(
			(async (...a: unknown[]) => (calls.push(a), {})) as never,
			'g@g.us',
			'member_share_group_history_mode',
			'ALL_MEMBER_SHARE',
		)
		expect(calls[0]).toEqual([
			GROUP_SET_PROPERTY_QUERY,
			{ group_id: 'g@g.us', update: { member_share_group_history_mode: 'ALL_MEMBER_SHARE' } },
			'xwa2_group_update_property',
		])
	})
})

describe('Groups: more actions', () => {
	const reply = (content: BinaryNode[]): BinaryNode => ({
		tag: 'iq',
		attrs: { type: 'result' },
		content,
	})
	function fake(answer: BinaryNode = { tag: 'iq', attrs: { type: 'result' } }) {
		const sent: BinaryNode[] = []
		const gql: { id: string; variables: unknown; path?: string }[] = []
		const groups = new Groups(
			async (n) => (sent.push(n), answer),
			(async (id: string, variables: unknown, path?: string) => (
				gql.push({ id, variables, ...(path && { path }) }),
				{}
			)) as never,
		)
		return { groups, sent, gql }
	}
	const kidsOf = (n: BinaryNode) => (Array.isArray(n.content) ? n.content : [])

	it('lists past participants with reason and time', async () => {
		const { groups, sent } = fake(
			reply([
				{
					tag: 'past_participants',
					attrs: {},
					content: [
						{
							tag: 'past_participant',
							attrs: { jid: '1@lid', reason: 'removed', t: '1700000000' },
						},
					],
				},
			]),
		)
		expect(await groups.pastParticipants('g@g.us')).toEqual([
			{ jid: '1@lid', reason: 'removed', leftAt: 1700000000 },
		])
		expect(sent[0]!.attrs).toMatchObject({ xmlns: 'w:g2', type: 'get', to: 'g@g.us' })
	})

	it('withdraws a join request, acknowledges, and revokes an invite', async () => {
		const { groups, sent } = fake()
		await groups.cancelMembershipRequest('g@g.us', '2@lid')
		await groups.acknowledge('g@g.us')
		await groups.revokeInviteV4('g@g.us', '3@lid')
		expect(kidsOf(sent[0]!)[0]).toMatchObject({ tag: 'cancel_membership_requests' })
		expect(kidsOf(sent[1]!)).toEqual([{ tag: 'ack', attrs: {} }])
		expect(kidsOf(sent[2]!)[0]).toEqual({
			tag: 'revoke',
			attrs: {},
			content: [{ tag: 'participant', attrs: { jid: '3@lid' } }],
		})
	})

	it('reads who reported which message', async () => {
		const { groups } = fake(
			reply([
				{
					tag: 'reports',
					attrs: {},
					content: [
						{
							tag: 'report',
							attrs: { message_id: 'M1' },
							content: [{ tag: 'reporter', attrs: { jid: '4@lid', timestamp: '1700000001' } }],
						},
					],
				},
			]),
		)
		expect(await groups.reportedMessages('g@g.us')).toEqual([
			{ messageId: 'M1', reporters: [{ jid: '4@lid', at: 1700000001 }] },
		])
	})

	it('accepts an invite message', async () => {
		const { groups, sent } = fake()
		await groups.acceptInviteV4({
			groupJid: 'g@g.us',
			inviteCode: 'CODE',
			inviteExpiration: 1893456000,
			admin: '5@lid',
		})
		expect(sent[0]!.attrs['to']).toBe('g@g.us')
		expect(kidsOf(sent[0]!)).toEqual([
			{ tag: 'accept', attrs: { code: 'CODE', expiration: '1893456000', admin: '5@lid' } },
		])
	})

	it('reads community links, linked members and joins a sub-group', async () => {
		const links = fake(
			reply([
				{
					tag: 'links',
					attrs: {},
					content: [
						{
							tag: 'link',
							attrs: { link_type: 'sub_group' },
							content: [{ tag: 'group', attrs: { jid: 's@g.us' } }],
						},
					],
				},
			]),
		)
		expect(await links.groups.linkedSubgroups('c@g.us')).toEqual([
			{ jid: 's@g.us', linkType: 'sub_group' },
		])
		const members = fake(
			reply([
				{
					tag: 'linked_groups_participants',
					attrs: {},
					content: [{ tag: 'participant', attrs: { jid: '6@lid', pn: '49@s.whatsapp.net' } }],
				},
			]),
		)
		expect(await members.groups.linkedParticipants('c@g.us')).toEqual([
			{ jid: '6@lid', phoneNumber: '49@s.whatsapp.net' },
		])
		const join = fake(reply([{ tag: 'membership_approval_request', attrs: {} }]))
		expect(await join.groups.joinLinked('c@g.us', 's@g.us')).toEqual({ approvalRequested: true })
	})

	it('reads group pictures', async () => {
		const { groups, sent } = fake(
			reply([
				{
					tag: 'picture',
					attrs: { id: 'g@g.us', type: 'preview', url: 'https://x/p.jpg', direct_path: '/p' },
				},
			]),
		)
		expect(await groups.pictures(['g@g.us'])).toEqual([
			{ jid: 'g@g.us', type: 'preview', directPath: '/p', url: 'https://x/p.jpg' },
		])
		expect(kidsOf(sent[0]!)[0]).toMatchObject({ tag: 'pictures' })
	})

	it('has the GraphQL forms, and refuses them without GraphQL access', async () => {
		const { groups, gql } = fake()
		await groups.info('g@g.us')
		await groups.infoByCode('CODE')
		await groups.batch(['a@g.us', 'b@g.us'])
		await groups.allowNonAdminSubgroupCreation('c@g.us', true)
		expect(gql.map((c) => c.path)).toEqual([
			'xwa2_group_query_by_id',
			'xwa2_group_query_by_id',
			'xwa2_group_query_batch',
			'xwa2_group_allow_non_admin_creation',
		])
		expect(gql[0]!.variables).toEqual({
			id: 'g@g.us',
			query_context: 'INTERACTIVE',
			include_username: false,
		})
		expect(gql[1]!.variables).toEqual({ group_input: { invite_code: 'CODE' } })
		expect(gql[2]!.variables).toEqual({
			groups_input: [{ group_id: 'a@g.us' }, { group_id: 'b@g.us' }],
		})
		await expect(new Groups(async () => ({ tag: 'iq', attrs: {} })).info('g@g.us')).rejects.toThrow(
			/GraphQL/,
		)
	})
})
