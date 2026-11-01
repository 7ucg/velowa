// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { BinaryNode } from '../../../codec/index.js'
import { generateMessageId } from '../../sender.js'
import { Groups, parseGroup } from '../group/groups.js'
import type { GroupMetadata, RequestFn } from '../group/groups.js'

const kids = (n: BinaryNode | undefined, tag?: string): BinaryNode[] =>
	n && Array.isArray(n.content) ? n.content.filter((c) => tag === undefined || c.tag === tag) : []

export interface LinkedGroup {
	id: string
	subject: string
	creation?: number
	owner?: string
	size?: number
}

/**
 * Communities are `w:g2` groups with a `<parent>` marker and linked sub-groups. Everything that works
 * on a plain group (members, settings, invite codes) works on a community JID via `client.groups`;
 * this class only adds what is different.
 */
export class Communities {
	readonly #groups: Groups
	constructor(private readonly request: RequestFn) {
		this.#groups = new Groups(request)
	}

	#query(jid: string, type: 'get' | 'set', content: BinaryNode[]) {
		return this.request({ tag: 'iq', attrs: { type, xmlns: 'w:g2', to: jid }, content })
	}

	metadata = (jid: string): Promise<GroupMetadata> => this.#groups.metadata(jid)

	/** Create a community; it starts with an announcement and a general sub-group. */
	async create(subject: string, description = ''): Promise<GroupMetadata> {
		const res = await this.#query('@g.us', 'set', [
			{
				tag: 'create',
				attrs: { subject },
				content: [
					{
						tag: 'description',
						attrs: { id: generateMessageId('0@s.whatsapp.net').slice(0, 12) },
						content: [{ tag: 'body', attrs: {}, content: Buffer.from(description, 'utf8') }],
					},
					{ tag: 'parent', attrs: { default_membership_approval_mode: 'request_required' } },
					{ tag: 'allow_non_admin_sub_group_creation', attrs: {} },
					{ tag: 'create_general_chat', attrs: {} },
				],
			},
		])
		return parseGroup(res)
	}

	/** Create a new group inside a community. */
	async createGroup(
		subject: string,
		participants: string[],
		communityJid: string,
	): Promise<GroupMetadata> {
		const res = await this.#query('@g.us', 'set', [
			{
				tag: 'create',
				attrs: { subject, key: generateMessageId('0@s.whatsapp.net') },
				content: [
					...participants.map((jid) => ({ tag: 'participant', attrs: { jid } })),
					{ tag: 'linked_parent', attrs: { jid: communityJid } },
				],
			},
		])
		return parseGroup(res)
	}

	async leave(id: string): Promise<void> {
		await this.#query('@g.us', 'set', [
			{ tag: 'leave', attrs: {}, content: [{ tag: 'community', attrs: { id } }] },
		])
	}

	async linkGroup(groupJid: string, communityJid: string): Promise<void> {
		await this.#query(communityJid, 'set', [
			{
				tag: 'links',
				attrs: {},
				content: [
					{
						tag: 'link',
						attrs: { link_type: 'sub_group' },
						content: [{ tag: 'group', attrs: { jid: groupJid } }],
					},
				],
			},
		])
	}

	async unlinkGroup(
		groupJid: string,
		communityJid: string,
		removeOrphanedMembers = false,
	): Promise<void> {
		await this.#query(communityJid, 'set', [
			{
				tag: 'unlink',
				attrs: { unlink_type: 'sub_group' },
				content: [
					{
						tag: 'group',
						attrs: removeOrphanedMembers
							? { jid: groupJid, remove_orphaned_members: 'true' }
							: { jid: groupJid },
					},
				],
			},
		])
	}

	/** The sub-groups of a community (pass a sub-group JID to find its community first). */
	async linkedGroups(jid: string): Promise<{ communityJid: string; linkedGroups: LinkedGroup[] }> {
		const meta = await this.#groups.metadata(jid)
		const communityJid = meta.linkedParent ?? jid
		const res = await this.#query(communityJid, 'get', [{ tag: 'sub_groups', attrs: {} }])
		const linkedGroups = kids(kids(res, 'sub_groups')[0], 'group').flatMap<LinkedGroup>((g) =>
			g.attrs['id']
				? [
						{
							id: g.attrs['id'].includes('@') ? g.attrs['id'] : `${g.attrs['id']}@g.us`,
							subject: g.attrs['subject'] ?? '',
							...(g.attrs['creation'] && { creation: Number(g.attrs['creation']) }),
							...(g.attrs['creator'] && { owner: g.attrs['creator'] }),
							...(g.attrs['size'] && { size: Number(g.attrs['size']) }),
						},
					]
				: [],
		)
		return { communityJid, linkedGroups }
	}

	/** Join a community by invite code; returns the community JID. */
	async acceptInvite(code: string): Promise<string | undefined> {
		return kids(
			await this.#query('@g.us', 'set', [{ tag: 'invite', attrs: { code } }]),
			'community',
		)[0]?.attrs['jid']
	}

	/** Deactivate (delete) a community. Its sub-groups stay as normal groups. */
	async deactivate(jid: string): Promise<void> {
		await this.#query(jid, 'set', [{ tag: 'delete_parent', attrs: {} }])
	}
}
