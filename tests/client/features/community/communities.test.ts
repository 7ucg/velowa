import { describe, expect, it } from 'vitest'
import type { BinaryNode } from '../../../../src/codec/index.js'
import { Communities } from '../../../../src/client/features/community/communities.js'

const kids = (n: BinaryNode, tag?: string) =>
	Array.isArray(n.content) ? n.content.filter((c) => !tag || c.tag === tag) : []
const community: BinaryNode = {
	tag: 'group',
	attrs: { id: '1203631111', subject: 'Comm' },
	content: [{ tag: 'parent', attrs: {} }],
}

describe('Communities', () => {
	it('creates a community with description, approval mode and general chat', async () => {
		const sent: BinaryNode[] = []
		const c = new Communities(
			async (n) => (sent.push(n), { tag: 'iq', attrs: {}, content: [community] }),
		)
		const meta = await c.create('Comm', 'Info')
		expect(meta.isCommunity).toBe(true)
		const create = kids(sent[0]!)[0]!
		expect(kids(create).map((k) => k.tag)).toEqual([
			'description',
			'parent',
			'allow_non_admin_sub_group_creation',
			'create_general_chat',
		])
		expect(kids(create, 'parent')[0]!.attrs).toEqual({
			default_membership_approval_mode: 'request_required',
		})
	})

	it('creates a linked group, links and unlinks', async () => {
		const sent: BinaryNode[] = []
		const c = new Communities(
			async (n) => (
				sent.push(n),
				{
					tag: 'iq',
					attrs: {},
					content: [{ tag: 'group', attrs: { id: '1203632222', subject: 'Sub' } }],
				}
			),
		)
		await c.createGroup('Sub', ['a@lid'], '1203631111@g.us')
		expect(kids(kids(sent[0]!)[0]!, 'linked_parent')[0]!.attrs).toEqual({ jid: '1203631111@g.us' })
		await c.linkGroup('x@g.us', '1203631111@g.us')
		await c.unlinkGroup('x@g.us', '1203631111@g.us', true)
		expect(sent[1]!.attrs['to']).toBe('1203631111@g.us')
		expect(kids(kids(kids(sent[1]!)[0]!)[0]!)[0]!.attrs).toEqual({ jid: 'x@g.us' })
		expect(kids(kids(sent[2]!)[0]!)[0]!.attrs).toEqual({
			jid: 'x@g.us',
			remove_orphaned_members: 'true',
		})
	})

	it('finds the community of a sub-group and lists its sub-groups', async () => {
		const sent: BinaryNode[] = []
		const c = new Communities(async (n) => {
			sent.push(n)
			if (kids(n)[0]!.tag === 'query')
				return {
					tag: 'iq',
					attrs: {},
					content: [
						{
							tag: 'group',
							attrs: { id: '1203632222', subject: 'Sub' },
							content: [{ tag: 'linked_parent', attrs: { jid: '1203631111@g.us' } }],
						},
					],
				}
			return {
				tag: 'iq',
				attrs: {},
				content: [
					{
						tag: 'sub_groups',
						attrs: {},
						content: [{ tag: 'group', attrs: { id: '1203632222', subject: 'Sub', size: '5' } }],
					},
				],
			}
		})
		const r = await c.linkedGroups('1203632222@g.us')
		expect(r.communityJid).toBe('1203631111@g.us')
		expect(r.linkedGroups).toEqual([{ id: '1203632222@g.us', subject: 'Sub', size: 5 }])
		expect(sent[1]!.attrs['to']).toBe('1203631111@g.us')
	})

	it('accepts invites and deactivates', async () => {
		const sent: BinaryNode[] = []
		const c = new Communities(
			async (n) => (
				sent.push(n),
				{ tag: 'iq', attrs: {}, content: [{ tag: 'community', attrs: { jid: 'c@g.us' } }] }
			),
		)
		expect(await c.acceptInvite('CODE')).toBe('c@g.us')
		await c.deactivate('c@g.us')
		expect(kids(sent[1]!)[0]!.tag).toBe('delete_parent')
	})
})

describe('Communities: more actions', () => {
	function fake() {
		const sent: BinaryNode[] = []
		const gql: { id: string; variables: unknown; path?: string }[] = []
		const c = new Communities(
			async (n) => (sent.push(n), { tag: 'iq', attrs: { type: 'result' }, content: [] }),
			(async (id: string, variables: unknown, path?: string) => (
				gql.push({ id, variables, ...(path && { path }) }),
				path === 'xwa2_group_query_by_id'
					? { participant_count: 42, sub_group_suggestions: { edges: [{ node: { id: 'x' } }, {}] } }
					: {}
			)) as never,
		)
		return { c, sent, gql }
	}

	it('sets and removes the picture, and refuses a picture that is not a JPEG', async () => {
		const { c, sent } = fake()
		await c.setPicture('c@g.us', Uint8Array.from([0xff, 0xd8, 1, 2]))
		await c.removePicture('c@g.us')
		expect(kids(sent[0]!)[0]).toMatchObject({ tag: 'picture', attrs: { type: 'image' } })
		expect(kids(sent[1]!)).toEqual([{ tag: 'picture', attrs: { type: 'delete' } }])
		await expect(c.setPicture('c@g.us', Uint8Array.from([1, 2, 3]))).rejects.toThrow(/JPEG/)
	})

	it('counts members, suggests sub-groups and hands the community over', async () => {
		const { c, gql } = fake()
		expect(await c.participantCount('c@g.us')).toBe(42)
		expect(await c.subgroupSuggestions('c@g.us')).toEqual([{ id: 'x' }])
		await c.transferOwnership('c@g.us', '7@lid')
		expect(gql[2]!.variables).toEqual({
			group_id: 'c@g.us',
			role_updates: [{ user_jid: '7@lid', new_role: 'SUPERADMIN_MEMBER' }],
		})
		expect(gql[2]!.path).toBe('xwa2_community_update_owner')
	})

	it('answers the group questions on a community JID', async () => {
		const { c, sent } = fake()
		await c.setSubject('c@g.us', 'New name')
		await c.revokeInviteV4('c@g.us', '8@lid')
		expect(sent.every((n) => n.attrs['to'] === 'c@g.us' && n.attrs['xmlns'] === 'w:g2')).toBe(true)
	})
})
