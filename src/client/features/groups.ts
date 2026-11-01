import type { BinaryNode } from '../../codec/index.js'
import { generateMessageId } from '../sender.js'

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
export class Groups {
	constructor(private readonly request: RequestFn) {}

	#query(jid: string, type: 'get' | 'set', content: BinaryNode[]): Promise<BinaryNode> {
		return this.request({ tag: 'iq', attrs: { type, xmlns: 'w:g2', to: jid }, content })
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

/** "Send message history" permission and similar properties, via `w:mex` (`member_share_group_history_mode`, ...). */
export const setGroupProperty = (
	mex: <T>(queryId: string, variables: unknown, path?: string) => Promise<T>,
	jid: string,
	property: string,
	value: unknown,
) =>
	mex(GROUP_SET_PROPERTY_QUERY, { group_id: jid, [property]: value }, 'xwa2_group_update_property')

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
