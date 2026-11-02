// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { BinaryNode } from '../../../codec/index.js'
import { generateMessageId } from '../../sender.js'
import { Groups, parseGroup } from '../group/groups.js'
import type { MexFn } from '../mex.js'
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
	readonly #mex: MexFn | undefined
	constructor(
		private readonly request: RequestFn,
		mex?: MexFn,
		groups?: Groups,
	) {
		this.#groups = groups ?? new Groups(request, mex)
		this.#mex = mex
	}

	#query(jid: string, type: 'get' | 'set', content: BinaryNode[]) {
		return this.request({ tag: 'iq', attrs: { type, xmlns: 'w:g2', to: jid }, content })
	}

	metadata = (jid: string): Promise<GroupMetadata> => this.#groups.metadata(jid)

	/** The same actions as for groups, on a community JID (so they are all in one place). */
	inviteCode = (jid: string) => this.#groups.inviteCode(jid)
	revokeInvite = (jid: string) => this.#groups.revokeInvite(jid)
	inviteInfo = (code: string) => this.#groups.inviteInfo(code)
	setSubject = (jid: string, subject: string) => this.#groups.setSubject(jid, subject)
	setDescription = (jid: string, text: string) => this.#groups.setDescription(jid, text)
	setEphemeral = (jid: string, seconds: number) => this.#groups.setEphemeral(jid, seconds)
	updateParticipants = (
		jid: string,
		participants: string[],
		action: Parameters<Groups['updateParticipants']>[2],
	) => this.#groups.updateParticipants(jid, participants, action)
	setting = (jid: string, setting: Parameters<Groups['setting']>[1]) =>
		this.#groups.setting(jid, setting)
	setMemberAddMode = (jid: string, mode: 'admin_add' | 'all_member_add') =>
		this.#groups.setMemberAddMode(jid, mode)
	setJoinApproval = (jid: string, mode: 'on' | 'off') => this.#groups.setJoinApproval(jid, mode)
	joinRequests = (jid: string) => this.#groups.joinRequests(jid)
	updateJoinRequests = (...a: Parameters<Groups['updateJoinRequests']>) =>
		this.#groups.updateJoinRequests(...a)
	acceptInviteV4 = (...a: Parameters<Groups['acceptInviteV4']>) => this.#groups.acceptInviteV4(...a)
	revokeInviteV4 = (jid: string, invitedJid: string) => this.#groups.revokeInviteV4(jid, invitedJid)

	/** Every community the account is in, by JID. */
	async fetchAll(): Promise<Record<string, GroupMetadata>> {
		const all = await this.#groups.fetchAll()
		return Object.fromEntries(Object.entries(all).filter(([, g]) => g.isCommunity))
	}

	/** Set (JPEG bytes) or remove the community's picture. */
	async setPicture(jid: string, jpeg: Uint8Array): Promise<void> {
		if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('community pictures must be JPEG')
		await this.#query(jid, 'set', [{ tag: 'picture', attrs: { type: 'image' }, content: jpeg }])
	}

	async removePicture(jid: string): Promise<void> {
		await this.#query(jid, 'set', [{ tag: 'picture', attrs: { type: 'delete' } }])
	}

	#gql<T = unknown>(id: string, variables: unknown, path: string): Promise<T> {
		if (!this.#mex)
			return Promise.reject(new Error('this Communities object has no GraphQL access'))
		return this.#mex<T>(id, variables, path)
	}

	/** How many people are in the community. */
	async participantCount(jid: string): Promise<number | undefined> {
		const r = await this.#gql<Record<string, unknown>>(
			'31981537024824320',
			{ group_input: { group_id: jid } },
			'xwa2_group_query_by_id',
		)
		const n = r?.['participant_count'] ?? r?.['participantCount'] ?? r?.['count']
		return typeof n === 'number' ? n : undefined
	}

	async subgroupParticipantCount(subgroupJid: string): Promise<number | undefined> {
		const r = await this.#gql<Record<string, unknown>>(
			'24079399904996141',
			{ group_input: { group_id: subgroupJid } },
			'xwa2_group_query_by_id',
		)
		const n = r?.['participant_count'] ?? r?.['participantCount'] ?? r?.['count']
		return typeof n === 'number' ? n : undefined
	}

	/** Groups WhatsApp suggests adding as sub-groups. */
	async subgroupSuggestions(
		communityJid: string,
		hint = '',
		context = 'INTERACTIVE',
	): Promise<unknown[]> {
		const r = await this.#gql<{ sub_group_suggestions?: { edges?: { node?: unknown }[] } }>(
			'23972005349071865',
			{ group_input: { group_id: communityJid, query_context: context, sub_group_hint: hint } },
			'xwa2_group_query_by_id',
		)
		return (r?.sub_group_suggestions?.edges ?? []).map((e) => e?.node).filter(Boolean)
	}

	/** Sub-groups as GraphQL lists them. */
	subgroups = (jid: string): Promise<unknown> => this.#groups.subgroups(jid)

	/** Hand the community to someone else (you stay an admin). */
	transferOwnership = (communityJid: string, newOwnerJid: string): Promise<unknown> =>
		this.#gql(
			'24781435194845316',
			{
				group_id: communityJid,
				role_updates: [{ user_jid: newOwnerJid, new_role: 'SUPERADMIN_MEMBER' }],
			},
			'xwa2_community_update_owner',
		)

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
