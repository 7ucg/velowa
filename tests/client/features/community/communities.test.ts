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
