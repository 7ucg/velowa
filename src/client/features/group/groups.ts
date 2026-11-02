// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { BinaryNode } from '../../../codec/index.js'
import { generateMessageId } from '../../sender.js'
import type { MexFn } from '../mex.js'

export type RequestFn = (node: BinaryNode) => Promise<BinaryNode>

export interface GroupParticipant {
	id: string
	phoneNumber?: string
	lid?: string
	/** `superadmin` (creator), `admin`, or null for regular members. */
	admin: 'admin' | 'superadmin' | null
}

export interface GroupMetadata {
	id: string
	subject: string
	subjectOwner?: string
	subjectTime?: number
	creation?: number
	owner?: string
	desc?: string
	descId?: string
	size: number
	addressingMode: 'lid' | 'pn'
	/** Only admins may edit group info. */
	restrict: boolean
	/** Only admins may send messages. */
	announce: boolean
	isCommunity: boolean
	isCommunityAnnounce: boolean
	linkedParent?: string
	joinApprovalMode: boolean
	/** `all_member_add` when every member may add participants. */
	memberAddAll: boolean
	ephemeralDuration?: number
	participants: GroupParticipant[]
}

export type ParticipantAction = 'add' | 'remove' | 'promote' | 'demote'
export type GroupSetting = 'announcement' | 'not_announcement' | 'locked' | 'unlocked'

const kids = (n: BinaryNode | undefined, tag?: string): BinaryNode[] =>
	n && Array.isArray(n.content) ? n.content.filter((c) => tag === undefined || c.tag === tag) : []
const text = (n: BinaryNode | undefined): string | undefined => {
	if (!n) return undefined
	if (typeof n.content === 'string') return n.content
	return n.content instanceof Uint8Array ? Buffer.from(n.content).toString('utf8') : undefined
}
const num = (v: string | undefined): number | undefined =>
	v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : undefined

/** Parse a `<group>` node (or a result wrapping one) into metadata. */
export function parseGroup(nodeOrResult: BinaryNode): GroupMetadata {
	const group = nodeOrResult.tag === 'group' ? nodeOrResult : kids(nodeOrResult, 'group')[0]
	if (!group) throw new Error('no <group> in response')
	const a = group.attrs
	const id = (a['id'] ?? '').includes('@') ? a['id']! : `${a['id']}@g.us`
	const descNode = kids(group, 'description')[0]
	const eph = kids(group, 'ephemeral')[0]?.attrs['expiration']
	const participants = kids(group, 'participant').map<GroupParticipant>((p) => {
		const jid = p.attrs['jid'] ?? ''
		return {
			id: jid,
			...(jid.endsWith('@lid') &&
				p.attrs['phone_number'] && { phoneNumber: p.attrs['phone_number'] }),
			...(jid.endsWith('@s.whatsapp.net') && p.attrs['lid'] && { lid: p.attrs['lid'] }),
			admin:
				p.attrs['type'] === 'admin' || p.attrs['type'] === 'superadmin' ? p.attrs['type'] : null,
		}
	})
	return {
		id,
		subject: a['subject'] ?? '',
		...(a['s_o'] && { subjectOwner: a['s_o'] }),
		...(num(a['s_t']) !== undefined && { subjectTime: num(a['s_t'])! }),
		...(num(a['creation']) !== undefined && { creation: num(a['creation'])! }),
		...(a['creator'] && { owner: a['creator'] }),
		...(descNode &&
			text(kids(descNode, 'body')[0]) !== undefined && { desc: text(kids(descNode, 'body')[0])! }),
		...(descNode?.attrs['id'] && { descId: descNode.attrs['id'] }),
		size: num(a['size']) ?? participants.length,
		addressingMode: a['addressing_mode'] === 'lid' ? 'lid' : 'pn',
		restrict: kids(group, 'locked').length > 0,
		announce: kids(group, 'announcement').length > 0,
		isCommunity: kids(group, 'parent').length > 0,
		isCommunityAnnounce: kids(group, 'default_sub_group').length > 0,
		...(kids(group, 'linked_parent')[0]?.attrs['jid'] && {
			linkedParent: kids(group, 'linked_parent')[0]!.attrs['jid']!,
		}),
		joinApprovalMode: kids(group, 'membership_approval_mode').length > 0,
		memberAddAll: text(kids(group, 'member_add_mode')[0]) === 'all_member_add',
		...(eph && { ephemeralDuration: Number(eph) }),
		participants,
	}
}

/** Group management over the `w:g2` namespace. */
const GROUP_QUERY = {
	INFO: '27508847222068472',
	INFO_INCLUDE_BOTS: '27795062750123057',
	IS_INTERNAL: '34119218944390847',
	INFO_BY_CODE: '24576337542042464',
	BATCH: '26440064815661176',
	INVITE_LINK: '29247029834912157',
	PARTICIPATING: '26664341543184776',
	SUGGESTED: '26012055225051916',
	LINKED: '25629003043401452',
	SUBGROUPS: '9935467776504344',
	ADD_PARTICIPANTS: '32627550323510250',
	RESET_INVITE_LINK: '24812851838367452',
	CREATE: '32341779532133480',
	ALLOW_NON_ADMIN_CREATION: '32024438593867696',
	PRE_REG_ADD_REQUESTS: '25018599251091280',
	SUGGESTED_CONTACTS: '27208468032086900',
} as const

export class Groups {
	constructor(
		private readonly request: RequestFn,
		private readonly mex?: MexFn,
	) {}

	#mexCall<T = unknown>(id: string, variables: unknown, path: string): Promise<T> {
		if (!this.mex) return Promise.reject(new Error('this Groups object has no GraphQL access'))
		return this.mex<T>(id, variables, path)
	}

	#query(jid: string, type: 'get' | 'set', content: BinaryNode[]): Promise<BinaryNode> {
		return this.request({ tag: 'iq', attrs: { type, xmlns: 'w:g2', to: jid }, content })
	}

	/** People who left (or were removed from) a group, with the reason and the time (unix seconds). */
	async pastParticipants(
		jid: string,
	): Promise<{ jid: string; reason?: string; leftAt?: number }[]> {
		const res = await this.#query(jid, 'get', [{ tag: 'past_participants', attrs: {} }])
		return kids(kids(res, 'past_participants')[0], 'past_participant').map((p) => ({
			jid: p.attrs['jid'] ?? '',
			...(p.attrs['reason'] && { reason: p.attrs['reason'] }),
			...(p.attrs['t'] && { leftAt: Number(p.attrs['t']) }),
		}))
	}

	/** Take back a request to join. */
	async cancelMembershipRequest(jid: string, participantJid: string): Promise<void> {
		await this.#query(jid, 'set', [
			{
				tag: 'cancel_membership_requests',
				attrs: {},
				content: [{ tag: 'participant', attrs: { jid: participantJid } }],
			},
		])
	}

	/** Accept the group's current rules / notice ("OK" on the group-changed banner). */
	async acknowledge(jid: string): Promise<void> {
		await this.#query(jid, 'set', [{ tag: 'ack', attrs: {} }])
	}

	/** Messages that members reported to the admins, with who reported them. */
	async reportedMessages(
		jid: string,
	): Promise<{ messageId: string; reporters: { jid: string; at?: number }[] }[]> {
		const res = await this.#query(jid, 'get', [{ tag: 'reports', attrs: {} }])
		return kids(kids(res, 'reports')[0], 'report').map((r) => ({
			messageId: r.attrs['message_id'] ?? '',
			reporters: kids(r, 'reporter').map((x) => ({
				jid: x.attrs['jid'] ?? '',
				...(x.attrs['timestamp'] && { at: Number(x.attrs['timestamp']) }),
			})),
		}))
	}

	/** Join a group by the invite that was sent to you as a message (`groupInviteMessage`); `admin` is who sent it. */
	async acceptInviteV4(invite: {
		groupJid: string
		inviteCode: string
		inviteExpiration: number | string
		admin: string
	}): Promise<void> {
		await this.#query(invite.groupJid, 'set', [
			{
				tag: 'accept',
				attrs: {
					code: invite.inviteCode,
					expiration: String(invite.inviteExpiration),
					admin: invite.admin,
				},
			},
		])
	}

	/** Withdraw an invite that you sent to someone (they can no longer use the message). */
	async revokeInviteV4(jid: string, invitedJid: string): Promise<void> {
		await this.#query(jid, 'set', [
			{ tag: 'revoke', attrs: {}, content: [{ tag: 'participant', attrs: { jid: invitedJid } }] },
		])
	}

	/** Members of a community's linked groups. */
	async linkedParticipants(jid: string): Promise<{ jid: string; phoneNumber?: string }[]> {
		const res = await this.#query(jid, 'get', [{ tag: 'linked_groups_participants', attrs: {} }])
		return kids(kids(res, 'linked_groups_participants')[0], 'participant').map((p) => ({
			jid: p.attrs['jid'] ?? '',
			...((p.attrs['phone_number'] ?? p.attrs['pn']) && {
				phoneNumber: (p.attrs['phone_number'] ?? p.attrs['pn'])!,
			}),
		}))
	}

	/** Sub-groups of a community. */
	async linkedSubgroups(communityJid: string): Promise<{ jid: string; linkType?: string }[]> {
		const res = await this.#query(communityJid, 'get', [
			{ tag: 'links', attrs: { link_type: 'sub_group' } },
		])
		return kids(kids(res, 'links')[0], 'link').flatMap((l) => {
			const jid = kids(l, 'group')[0]?.attrs['jid']
			return jid ? [{ jid, ...(l.attrs['link_type'] && { linkType: l.attrs['link_type'] }) }] : []
		})
	}

	/** Join a sub-group of a community you are in. `approvalRequested` is true when an admin has to let you in. */
	async joinLinked(
		parentJid: string,
		linkedGroupJid: string,
		type?: string,
	): Promise<{ approvalRequested: boolean }> {
		const res = await this.#query(parentJid, 'set', [
			{ tag: 'join_linked_group', attrs: { jid: linkedGroupJid, ...(type && { type }) } },
		])
		return { approvalRequested: kids(res, 'membership_approval_request').length > 0 }
	}

	// ---- the GraphQL forms (they answer with more than the stanza forms) ----

	/** Full group info as GraphQL gives it. */
	info = (jid: string): Promise<unknown> =>
		this.#mexCall(
			GROUP_QUERY.INFO,
			{ id: jid, query_context: 'INTERACTIVE', include_username: false },
			'xwa2_group_query_by_id',
		)

	infoWithBots = (jid: string): Promise<unknown> =>
		this.#mexCall(
			GROUP_QUERY.INFO_INCLUDE_BOTS,
			{ id: jid, query_context: 'INTERACTIVE', include_username: false },
			'xwa2_group_query_by_id',
		)

	async isInternal(jid: string): Promise<boolean> {
		const r = await this.#mexCall<{ properties?: { internal?: boolean } }>(
			GROUP_QUERY.IS_INTERNAL,
			{ id: jid },
			'xwa2_group_query_by_id',
		)
		return r?.properties?.internal === true
	}

	/** What a group is, by its invite code, before you join. */
	infoByCode = (code: string): Promise<unknown> =>
		this.#mexCall(
			GROUP_QUERY.INFO_BY_CODE,
			{ group_input: { invite_code: code } },
			'xwa2_group_query_by_id',
		)

	/** Several groups in one call. */
	batch = (jids: string[]): Promise<unknown> =>
		this.#mexCall(
			GROUP_QUERY.BATCH,
			{ groups_input: jids.map((group_id) => ({ group_id })) },
			'xwa2_group_query_batch',
		)

	inviteLink = (jid: string): Promise<unknown> =>
		this.#mexCall(
			GROUP_QUERY.INVITE_LINK,
			{ group_input: { group_id: jid } },
			'xwa2_group_query_by_id',
		)

	participating = (): Promise<unknown> =>
		this.#mexCall(GROUP_QUERY.PARTICIPATING, {}, 'xwa2_group_query_participating')

	/** Groups WhatsApp suggests adding to a community. */
	suggested = (communityJid: string): Promise<unknown> =>
		this.#mexCall(
			GROUP_QUERY.SUGGESTED,
			{ group_input: { group_id: communityJid } },
			'xwa2_group_query_by_id',
		)

	linkedInfo = (jid: string): Promise<unknown> =>
		this.#mexCall(GROUP_QUERY.LINKED, { group_input: { group_id: jid } }, 'xwa2_group_query_by_id')

	subgroups = (communityJid: string): Promise<unknown> =>
		this.#mexCall(
			GROUP_QUERY.SUBGROUPS,
			{ group_id: communityJid, query_context: 'INTERACTIVE' },
			'xwa2_group_query_by_id',
		)

	createViaGraphql = (subject: string, participantJids: string[]): Promise<unknown> =>
		this.#mexCall(
			GROUP_QUERY.CREATE,
			{ input: { subject, participants: participantJids.map((jid) => ({ jid })) } },
			'xwa2_group_create',
		)

	addParticipantsViaGraphql = (jid: string, participantJids: string[]): Promise<unknown> =>
		this.#mexCall(
			GROUP_QUERY.ADD_PARTICIPANTS,
			{ group_id: jid, participants: participantJids.map((p) => ({ user_jid: p })) },
			'xwa2_group_add_participants',
		)

	resetInviteLink = (jid: string): Promise<unknown> =>
		this.#mexCall(GROUP_QUERY.RESET_INVITE_LINK, { group_jid: jid }, 'xwa2_group_reset_invite_link')

	/** Let members who are not admins create sub-groups in a community. */
	allowNonAdminSubgroupCreation = (communityJid: string, allow: boolean): Promise<unknown> =>
		this.#mexCall(
			GROUP_QUERY.ALLOW_NON_ADMIN_CREATION,
			{ group_jid: communityJid, allow_non_admin_sub_group_creation: allow },
			'xwa2_group_allow_non_admin_creation',
		)

	preRegisteredAddRequests = (jid: string): Promise<unknown> =>
		this.#mexCall(
			GROUP_QUERY.PRE_REG_ADD_REQUESTS,
			{ group_jid: jid },
			'xwa2_group_pre_reg_add_requests',
		)

	suggestedContacts = (jid: string): Promise<unknown> =>
		this.#mexCall(
			GROUP_QUERY.SUGGESTED_CONTACTS,
			{ group_jid: jid },
			'xwa2_group_suggested_contacts',
		)

	/** Profile pictures of several groups (or users) at once: `type` `preview` is the small one, `image` the full size. */
	async pictures(
		jids: string[],
		type: 'preview' | 'image' = 'preview',
	): Promise<{ jid: string; type?: string; directPath?: string; url?: string }[]> {
		const res = await this.#query('s.whatsapp.net', 'get', [
			{
				tag: 'pictures',
				attrs: {},
				content: jids.map((id) => ({ tag: 'picture', attrs: { id, type } })),
			},
		])
		return kids(res, 'picture').map((p) => ({
			jid: p.attrs['id'] ?? p.attrs['jid'] ?? '',
			...(p.attrs['type'] && { type: p.attrs['type'] }),
			...(p.attrs['direct_path'] && { directPath: p.attrs['direct_path'] }),
			...(p.attrs['url'] && { url: p.attrs['url'] }),
		}))
	}

	/** Full metadata of one group. */
	async metadata(jid: string): Promise<GroupMetadata> {
		return parseGroup(
			await this.#query(jid, 'get', [{ tag: 'query', attrs: { request: 'interactive' } }]),
		)
	}

	/** Every group we are in, keyed by JID. */
	async fetchAll(): Promise<Record<string, GroupMetadata>> {
		const res = await this.#query('@g.us', 'get', [
			{
				tag: 'participating',
				attrs: {},
				content: [
					{ tag: 'participants', attrs: {} },
					{ tag: 'description', attrs: {} },
				],
			},
		])
		const out: Record<string, GroupMetadata> = {}
		for (const g of kids(kids(res, 'groups')[0], 'group')) {
			const m = parseGroup(g)
			out[m.id] = m
		}
		return out
	}

	async create(subject: string, participants: string[], meId = ''): Promise<GroupMetadata> {
		const res = await this.#query('@g.us', 'set', [
			{
				tag: 'create',
				attrs: { subject, key: generateMessageId(meId || '0@s.whatsapp.net') },
				content: participants.map((jid) => ({ tag: 'participant', attrs: { jid } })),
			},
		])
		return parseGroup(res)
	}

	async leave(id: string): Promise<void> {
		await this.#query('@g.us', 'set', [
			{ tag: 'leave', attrs: {}, content: [{ tag: 'group', attrs: { id } }] },
		])
	}

	async setSubject(jid: string, subject: string): Promise<void> {
		await this.#query(jid, 'set', [
			{ tag: 'subject', attrs: {}, content: Buffer.from(subject, 'utf8') },
		])
	}

	/** Set or (with an empty string) delete the description. */
	async setDescription(jid: string, description: string): Promise<void> {
		const prev = (await this.metadata(jid)).descId
		await this.#query(jid, 'set', [
			{
				tag: 'description',
				attrs: {
					...(description ? { id: generateMessageId('0@s.whatsapp.net') } : { delete: 'true' }),
					...(prev && { prev }),
				},
				...(description && {
					content: [{ tag: 'body', attrs: {}, content: Buffer.from(description, 'utf8') }],
				}),
			},
		])
	}

	/** Add / remove / promote / demote members. Returns the per-member status (`200` = ok). */
	async updateParticipants(
		jid: string,
		participants: string[],
		action: ParticipantAction,
	): Promise<{ jid: string; status: string }[]> {
		const res = await this.#query(jid, 'set', [
			{
				tag: action,
				attrs: {},
				content: participants.map((p) => ({ tag: 'participant', attrs: { jid: p } })),
			},
		])
		return kids(kids(res, action)[0], 'participant').map((p) => ({
			jid: p.attrs['jid'] ?? '',
			status: p.attrs['error'] ?? '200',
		}))
	}

	/** Add Meta AI (or another bot) to a group so it can be mentioned there. */
	addBot(jid: string, botUser = '867051314767696'): Promise<{ jid: string; status: string }[]> {
		return this.updateParticipants(jid, [`${botUser}@bot`], 'add')
	}

	async inviteCode(jid: string): Promise<string | undefined> {
		return kids(await this.#query(jid, 'get', [{ tag: 'invite', attrs: {} }]), 'invite')[0]?.attrs[
			'code'
		]
	}

	async revokeInvite(jid: string): Promise<string | undefined> {
		return kids(await this.#query(jid, 'set', [{ tag: 'invite', attrs: {} }]), 'invite')[0]?.attrs[
			'code'
		]
	}

	/** Join a group by invite code; returns the group JID. */
	async acceptInvite(code: string): Promise<string | undefined> {
		return kids(await this.#query('@g.us', 'set', [{ tag: 'invite', attrs: { code } }]), 'group')[0]
			?.attrs['jid']
	}

	async inviteInfo(code: string): Promise<GroupMetadata> {
		return parseGroup(await this.#query('@g.us', 'get', [{ tag: 'invite', attrs: { code } }]))
	}

	/** Disappearing messages: seconds (86400, 604800, 7776000) or 0 to turn off. */
	async setEphemeral(jid: string, seconds: number): Promise<void> {
		await this.#query(jid, 'set', [
			seconds
				? { tag: 'ephemeral', attrs: { expiration: String(seconds) } }
				: { tag: 'not_ephemeral', attrs: {} },
		])
	}

	/** `announcement` = only admins send; `locked` = only admins edit info. */
	async setting(jid: string, setting: GroupSetting): Promise<void> {
		await this.#query(jid, 'set', [{ tag: setting, attrs: {} }])
	}

	async setMemberAddMode(jid: string, mode: 'admin_add' | 'all_member_add'): Promise<void> {
		await this.#query(jid, 'set', [{ tag: 'member_add_mode', attrs: {}, content: mode }])
	}

	async setJoinApproval(jid: string, mode: 'on' | 'off'): Promise<void> {
		await this.#query(jid, 'set', [
			{
				tag: 'membership_approval_mode',
				attrs: {},
				content: [{ tag: 'group_join', attrs: { state: mode } }],
			},
		])
	}

	async joinRequests(jid: string): Promise<Record<string, string>[]> {
		const res = await this.#query(jid, 'get', [{ tag: 'membership_approval_requests', attrs: {} }])
		return kids(kids(res, 'membership_approval_requests')[0], 'membership_approval_request').map(
			(r) => r.attrs,
		)
	}

	async updateJoinRequests(
		jid: string,
		participants: string[],
		action: 'approve' | 'reject',
	): Promise<{ jid: string; status: string }[]> {
		const res = await this.#query(jid, 'set', [
			{
				tag: 'membership_requests_action',
				attrs: {},
				content: [
					{
						tag: action,
						attrs: {},
						content: participants.map((p) => ({ tag: 'participant', attrs: { jid: p } })),
					},
				],
			},
		])
		const node = kids(kids(res, 'membership_requests_action')[0], action)[0]
		return kids(node, 'participant').map((p) => ({
			jid: p.attrs['jid'] ?? '',
			status: p.attrs['error'] ?? '200',
		}))
	}
}

export interface GroupNotification {
	group: string
	/** Who did it, when known. */
	actor?: string
	timestamp?: number
	/** `add` / `remove` / `promote` / `demote` / `subject` / `description` / `announcement` / `locked` / `ephemeral` / ... */
	action: string
	participants?: string[]
	subject?: string
	description?: string
}

/** Turn a `<notification type="w:gp2">` into one event per change it carries. */
export function parseGroupNotification(node: BinaryNode): GroupNotification[] {
	const out: GroupNotification[] = []
	const base = {
		group: node.attrs['from'] ?? '',
		...(node.attrs['participant'] && { actor: node.attrs['participant'] }),
		...(node.attrs['t'] && { timestamp: Number(node.attrs['t']) }),
	}
	for (const c of kids(node)) {
		const participants = kids(c, 'participant')
			.map((p) => p.attrs['jid'] ?? '')
			.filter(Boolean)
		const n: GroupNotification = {
			...base,
			action: c.tag,
			...(participants.length && { participants }),
		}
		if (c.tag === 'subject' && c.attrs['subject']) n.subject = c.attrs['subject']
		if (c.tag === 'description') n.description = text(kids(c, 'body')[0]) ?? ''
		out.push(n)
	}
	return out
}

// ---- group permissions that are not plain w:g2 settings ---------------------------------------

export const GROUP_SET_PROPERTY_QUERY = '9418211574894172'

/** "Send message history" permission and similar properties, via `w:mex`; enum values are UPPER_CASE (`ADMIN_SHARE`, `ALL_MEMBER_SHARE`). */
export const setGroupProperty = (
	mex: <T>(queryId: string, variables: unknown, path?: string) => Promise<T>,
	jid: string,
	property: string,
	value: unknown,
) =>
	mex(
		GROUP_SET_PROPERTY_QUERY,
		{ group_id: jid, update: { [property]: value } },
		'xwa2_group_update_property',
	)

/** Message that sets our own "member tag" (label) in a group (max 30 characters). */
export function memberLabelMessage(
	label: string,
	nowSeconds = Math.floor(Date.now() / 1000),
): Record<string, unknown> {
	return {
		protocolMessage: {
			type: 'GROUP_MEMBER_LABEL_CHANGE',
			memberLabel: { label: label.slice(0, 30), labelTimestamp: nowSeconds },
		},
	}
}
