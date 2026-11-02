// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { BinaryNode } from '../../../codec/index.js'
import type { RequestFn } from '../group/groups.js'
import type { MexFn } from '../mex.js'

// Query ids from the WhatsApp Web build the reference was verified against (see baron-baileys-v2 Types/Newsletter.js).
// They can go stale when WhatsApp Web changes; a stale id shows up as a MexError.
export const NEWSLETTER_QUERY = {
	CREATE: '25149874324715067',
	UPDATE_METADATA: '27150690864552229',
	METADATA: '26629010453445271',
	SUBSCRIBERS: '27472091235714801',
	FOLLOW: '24404358912487870',
	UNFOLLOW: '9767147403369991',
	MUTE: '25033614912931367',
	UNMUTE: '24551592861177484',
	DELETE: '30062808666639665',
	LABEL_AI_CONTENT: '27909718265289596',
	LABEL_PAID_PARTNERSHIP: '26102375079404865',
	ADMIN_DEMOTE: '9880997548630971',
	ADMIN_INVITE: '9387141988078609',
	ADMIN_INVITE_REVOKE: '9656078347839416',
	ADMIN_INVITE_ACCEPT: '9580828702035549',
	ADMIN_COUNT: '27579307995002556',
	ADMIN_CAPABILITIES: '9801384413216421',
	ADMIN_INFO: '26278439461859188',
	ADMIN_METADATA: '26882701001369256',
	ADMIN_PROFILE_UPDATE: '25959584293627630',
	CHANGE_OWNER: '24737692515842078',
	BLOCK_USER: '25106066249006236',
	INSIGHTS: '24672564052397921',
	USER_REPORTS: '27149305681394065',
	ENFORCEMENTS: '27835373536068060',
	CREATE_REPORT_APPEAL: '27792557363683798',
	UPDATE_VERIFICATION: '27133493439664458',
	CREATE_VERIFIED: '27777918425146464',
	UPDATE_USER_SETTING: '31938993655691868',
	POLL_VOTER_LIST: '9407762219322536',
	REACTION_SENDERS: '29575462448733991',
	QUESTION_RESPONSE_STATE: '24896618076668076',
	LINK_PREVIEW_CHECK: '9101130456653613',
	DEHYDRATED: '26944199458535748',
	SEARCH: '25909596625362196',
	DIRECTORY_LIST: '26125047313831973',
	DIRECTORY_SEARCH: '26301059626252132',
	DIRECTORY_CATEGORY_PREVIEW: '35266481849605779',
	RECOMMENDED: '25806748772361516',
	SIMILAR: '26217043484590756',
	FOLLOWING: '26856957210673444',
} as const

export interface NewsletterMetadata {
	id: string
	name?: string
	description?: string
	invite?: string
	creationTime?: number
	subscribers?: number
	verification?: string
	pictureDirectPath?: string
	muted?: boolean
	role: 'OWNER' | 'ADMIN' | 'SUBSCRIBER' | 'GUEST'
	state: 'ACTIVE' | 'SUSPENDED' | 'GEO_SUSPENDED' | 'UNKNOWN'
}

type Raw = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const ROLES = ['OWNER', 'ADMIN', 'SUBSCRIBER'] as const
const STATES = ['ACTIVE', 'SUSPENDED', 'GEO_SUSPENDED'] as const

/** Flatten the nested `thread_metadata` / `viewer_metadata` shape of a newsletter answer. */
export function parseNewsletter(raw: unknown): NewsletterMetadata {
	const r = ((raw as Raw)?.['result'] ?? raw) as Raw
	if (!r || typeof r['id'] !== 'string') throw new Error('not a newsletter answer')
	const t: Raw = r['thread_metadata'] ?? {}
	const v: Raw = r['viewer_metadata'] ?? {}
	const upper = (x: unknown) => String(x ?? '').toUpperCase()
	const num = (x: unknown) => (x === undefined || x === null ? undefined : parseInt(String(x), 10))
	return {
		id: r['id'],
		...(t['name']?.text !== undefined && { name: t['name'].text }),
		...(t['description']?.text !== undefined && { description: t['description'].text }),
		...(t['invite'] && { invite: t['invite'] }),
		...(num(t['creation_time']) !== undefined && { creationTime: num(t['creation_time'])! }),
		...(num(t['subscribers_count']) !== undefined && { subscribers: num(t['subscribers_count'])! }),
		...(t['verification'] && { verification: t['verification'] }),
		...(t['picture']?.direct_path && { pictureDirectPath: t['picture'].direct_path }),
		...(v['mute'] !== undefined && { muted: upper(v['mute']) === 'ON' }),
		role: (ROLES as readonly string[]).includes(upper(v['role']))
			? (upper(v['role']) as NewsletterMetadata['role'])
			: 'GUEST',
		state: (STATES as readonly string[]).includes(upper(t['state'] ?? r['state']))
			? (upper(t['state'] ?? r['state']) as NewsletterMetadata['state'])
			: 'UNKNOWN',
	}
}

/** Channels ("newsletters"): lookup, follow, post metadata, reactions. */
export class Newsletters {
	constructor(
		private readonly mex: MexFn,
		private readonly request: RequestFn,
		private readonly nextId: () => string,
	) {}

	/**
	 * Mark one of our posts as AI-generated content (`serverId` is the number from the send ack). The app only shows
	 * this label on image and video posts, not on text posts.
	 */
	labelAiContent = (jid: string, serverId: string | number, messageType = 'MESSAGE') =>
		this.mex(
			NEWSLETTER_QUERY.LABEL_AI_CONTENT,
			{ newsletter_id: jid, server_id: String(serverId), message_type: messageType },
			'xwa2_newsletter_label_ai_content',
		)

	/** Mark one of our posts as a paid partnership. */
	labelPaidPartnership = (jid: string, serverId: string | number, messageType = 'MESSAGE') =>
		this.mex(
			NEWSLETTER_QUERY.LABEL_PAID_PARTNERSHIP,
			{ newsletter_id: jid, server_id: String(serverId), message_type: messageType },
			'xwa2_newsletter_label_paid_partnership',
		)

	create = async (name: string, description?: string) =>
		parseNewsletter(
			await this.mex(
				NEWSLETTER_QUERY.CREATE,
				{ input: { name, description: description ?? null } },
				'xwa2_newsletter_create',
			),
		)

	/** Look up by `jid` (`1203...@newsletter`) or by `invite` code. */
	metadata = async (type: 'jid' | 'invite', key: string) =>
		parseNewsletter(
			await this.mex(
				NEWSLETTER_QUERY.METADATA,
				{
					fetch_creation_time: true,
					fetch_full_image: true,
					fetch_viewer_metadata: true,
					input: { key, type: type.toUpperCase() },
				},
				'xwa2_newsletter',
			),
		)

	follow = (jid: string) =>
		this.mex(NEWSLETTER_QUERY.FOLLOW, { newsletter_id: jid }, 'xwa2_newsletter_join_v2')
	unfollow = (jid: string) =>
		this.mex(NEWSLETTER_QUERY.UNFOLLOW, { newsletter_id: jid }, 'xwa2_newsletter_leave_v2')
	mute = (jid: string) =>
		this.mex(NEWSLETTER_QUERY.MUTE, { newsletter_id: jid }, 'xwa2_newsletter_mute_v2')
	unmute = (jid: string) =>
		this.mex(NEWSLETTER_QUERY.UNMUTE, { newsletter_id: jid }, 'xwa2_newsletter_unmute_v2')
	delete = (jid: string) =>
		this.mex(NEWSLETTER_QUERY.DELETE, { newsletter_id: jid }, 'xwa2_newsletter_delete_v2')
	subscribers = (jid: string) =>
		this.mex(NEWSLETTER_QUERY.SUBSCRIBERS, { newsletter_id: jid }, 'xwa2_newsletter_followers')

	/** Change the name, the description, the `topic` (category) or the `picture` (base64 JPEG; `''` removes it). */
	update = (
		jid: string,
		updates: { name?: string; description?: string; topic?: string; picture?: string },
	) =>
		this.mex(
			NEWSLETTER_QUERY.UPDATE_METADATA,
			{ newsletter_id: jid, updates: { ...updates, settings: null } },
			'xwa2_newsletter_update',
		)

	/** Set the channel's picture (JPEG bytes) or take it away. */
	setPicture = (jid: string, jpeg: Uint8Array) => {
		if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('channel pictures must be JPEG')
		return this.update(jid, { picture: Buffer.from(jpeg).toString('base64') })
	}
	removePicture = (jid: string) => this.update(jid, { picture: '' })
	setCategory = (jid: string, topic: string) => this.update(jid, { topic })

	/** Channel settings that are not text (for example who may react, `{ reaction_codes: { value: 'ALL' } }`). */
	updateSettings = (jid: string, settings: Record<string, unknown>) =>
		this.mex(
			NEWSLETTER_QUERY.UPDATE_METADATA,
			{ newsletter_id: jid, updates: { settings } },
			'xwa2_newsletter_update',
		)

	/** Your own settings for a channel (for example muting, reaction notifications). */
	updateUserSetting = (jid: string, setting: Record<string, unknown>) =>
		this.mex(
			NEWSLETTER_QUERY.UPDATE_USER_SETTING,
			{ input: { newsletter_id: jid, ...setting } },
			'xwa2_newsletter_update_user_setting',
		)

	// ---- admins ----

	/** Make someone an admin straight away (a stanza). `inviteAdmin` asks them first. */
	async promoteAdmin(jid: string, userJid: string): Promise<void> {
		await this.request({
			tag: 'iq',
			attrs: { id: this.nextId(), type: 'set', xmlns: 'newsletter', to: jid },
			content: [
				{
					tag: 'admin_promote',
					attrs: {},
					content: [{ tag: 'participant', attrs: { jid: userJid } }],
				},
			],
		})
	}
	demoteAdmin = (jid: string, userJid: string) =>
		this.mex(
			NEWSLETTER_QUERY.ADMIN_DEMOTE,
			{ newsletter_id: jid, user_id: userJid },
			'xwa2_newsletter_admin_demote',
		)
	inviteAdmin = (jid: string, userJid: string) =>
		this.mex(
			NEWSLETTER_QUERY.ADMIN_INVITE,
			{ newsletter_id: jid, user_id: userJid },
			'xwa2_newsletter_admin_invite_create',
		)
	acceptAdminInvite = (jid: string) =>
		this.mex(
			NEWSLETTER_QUERY.ADMIN_INVITE_ACCEPT,
			{ newsletter_id: jid },
			'xwa2_newsletter_admin_invite_accept',
		)
	revokeAdminInvite = (jid: string, userJid: string) =>
		this.mex(
			NEWSLETTER_QUERY.ADMIN_INVITE_REVOKE,
			{ newsletter_id: jid, user_id: userJid },
			'xwa2_newsletter_admin_invite_revoke',
		)
	/** Hand the channel to another admin. */
	changeOwner = (jid: string, newOwnerJid: string) =>
		this.mex(
			NEWSLETTER_QUERY.CHANGE_OWNER,
			{ newsletter_id: jid, user_id: newOwnerJid },
			'xwa2_newsletter_change_owner',
		)
	async adminCount(jid: string): Promise<number | undefined> {
		const r = await this.mex<{ admin_count?: number }>(
			NEWSLETTER_QUERY.ADMIN_COUNT,
			{ newsletter_id: jid },
			'xwa2_newsletter_admin',
		)
		return r?.admin_count
	}
	async adminCapabilities(jid: string): Promise<unknown> {
		const r = await this.mex<{ capabilities?: unknown }>(
			NEWSLETTER_QUERY.ADMIN_CAPABILITIES,
			{ newsletter_id: jid },
			'xwa2_newsletter_admin',
		)
		return r?.capabilities
	}
	adminInfo = (jid: string) =>
		this.mex(NEWSLETTER_QUERY.ADMIN_INFO, { newsletter_id: jid }, 'xwa2_newsletter_admin')
	/** Admin view of a channel: pending invites, admin count, capabilities, your admin profile. */
	adminMetadata = (
		jid: string,
		o: {
			pendingAdmins?: boolean
			adminCount?: boolean
			capabilities?: boolean
			adminProfile?: boolean
			adminSettings?: boolean
		} = {},
	) =>
		this.mex(
			NEWSLETTER_QUERY.ADMIN_METADATA,
			{
				jid,
				include_thread_metadata: false,
				include_messages: false,
				fetch_pending_admin_invites: o.pendingAdmins ?? true,
				fetch_admin_count: o.adminCount ?? true,
				fetch_capabilities: o.capabilities ?? false,
				fetch_admin_profile: o.adminProfile ?? false,
				include_admin_settings: o.adminSettings ?? false,
				include_jarvis_config: false,
			},
			'xwa2_newsletter_admin',
		)
	updateAdminProfile = (jid: string, updates: Record<string, unknown>) =>
		this.mex(
			NEWSLETTER_QUERY.ADMIN_PROFILE_UPDATE,
			{ newsletter_id: jid, updates },
			'xwa2_newsletter_admin_profile_update',
		)
	/** Keep a user from following or reacting. */
	blockUser = (jid: string, userJid: string) =>
		this.mex(
			NEWSLETTER_QUERY.BLOCK_USER,
			{ newsletter_id: jid, user_id: userJid },
			'xwa2_newsletter_block_user',
		)
	/** Statistics of a channel (`period` as the app names it). */
	insights = (jid: string, period?: string) =>
		this.mex(
			NEWSLETTER_QUERY.INSIGHTS,
			{ newsletter_id: jid, ...(period && { period }) },
			'xwa2_newsletter_admin_insights',
		)
	userReports = (jid: string, cursor?: string) =>
		this.mex(
			NEWSLETTER_QUERY.USER_REPORTS,
			{ newsletter_id: jid, ...(cursor && { cursor }) },
			'xwa2_newsletter_user_reports',
		)
	enforcements = (jid: string, locale = 'en') =>
		this.mex(
			NEWSLETTER_QUERY.ENFORCEMENTS,
			{ newsletter_id: jid, locale },
			'xwa2_channel_enforcements',
		)
	appealReport = (jid: string, reason: string) =>
		this.mex(
			NEWSLETTER_QUERY.CREATE_REPORT_APPEAL,
			{ newsletter_id: jid, reason },
			'xwa2_newsletter_create_report_appeal',
		)
	updateVerification = (jid: string, verification: string) =>
		this.mex(
			NEWSLETTER_QUERY.UPDATE_VERIFICATION,
			{ newsletter_id: jid, verification },
			'xwa2_newsletter_update_verification',
		)
	createVerified = (name: string, description?: string) =>
		this.mex(
			NEWSLETTER_QUERY.CREATE_VERIFIED,
			{ input: { name, description: description ?? null } },
			'xwa2_newsletter_create_verified',
		)

	// ---- posts ----

	/** Pin a post for `seconds` (default one day). `serverId` is the post's number. */
	async pinMessage(jid: string, serverId: string | number, seconds = 86_400): Promise<void> {
		await this.request({
			tag: 'iq',
			attrs: { id: this.nextId(), type: 'set', xmlns: 'newsletter', to: jid },
			content: [{ tag: 'pin', attrs: { server_id: String(serverId), duration: String(seconds) } }],
		})
	}
	async unpinMessage(jid: string, serverId: string | number): Promise<void> {
		await this.request({
			tag: 'iq',
			attrs: { id: this.nextId(), type: 'set', xmlns: 'newsletter', to: jid },
			content: [{ tag: 'unpin', attrs: { server_id: String(serverId) } }],
		})
	}
	/** Delete one of the channel's posts. */
	async revokeMessage(jid: string, serverId: string | number): Promise<void> {
		await this.request({
			tag: 'message',
			attrs: { to: jid, type: 'text', edit: '7', server_id: String(serverId), id: this.nextId() },
			content: [],
		})
	}
	/** Tell the channel these posts were viewed (the view counter). */
	async sendViewReceipt(jid: string, serverIds: (string | number)[]): Promise<void> {
		await this.request({
			tag: 'receipt',
			attrs: { to: jid, id: this.nextId(), type: 'view' },
			content: [
				{
					tag: 'list',
					attrs: {},
					content: serverIds.map((id) => ({ tag: 'item', attrs: { server_id: String(id) } })),
				},
			],
		})
	}
	/** View and reaction counters of one post (the raw answer). */
	viewStats = (jid: string, serverId: string | number): Promise<BinaryNode> =>
		this.request({
			tag: 'iq',
			attrs: { id: this.nextId(), type: 'get', xmlns: 'newsletter', to: jid },
			content: [{ tag: 'message_updates', attrs: { count: '1', server_id: String(serverId) } }],
		})
	/** Subscribe to live updates of a channel; answers how long the subscription lasts. */
	async liveUpdates(jid: string): Promise<{ duration: string } | null> {
		const res = await this.request({
			tag: 'iq',
			attrs: { id: this.nextId(), type: 'set', xmlns: 'newsletter', to: jid },
			content: [{ tag: 'live_updates', attrs: {}, content: [] }],
		})
		const d = (Array.isArray(res.content) ? res.content : []).find((c) => c.tag === 'live_updates')
			?.attrs['duration']
		return d ? { duration: d } : null
	}
	/** The number of one of the recent posts, by its message id (looks at the last `limit`). */
	async serverIdOf(jid: string, messageId: string, limit = 50): Promise<number | null> {
		const res = await this.fetchMessages(jid, limit)
		const updates =
			(Array.isArray(res.content) ? res.content : []).find((c) => c.tag === 'message_updates') ??
			res
		for (const m of Array.isArray(updates.content) ? updates.content : []) {
			if (
				m.tag === 'message' &&
				(m.attrs['message_id'] === messageId || m.attrs['id'] === messageId)
			)
				return m.attrs['server_id'] ? Number(m.attrs['server_id']) : null
		}
		return null
	}
	pollVoters = (jid: string, serverId: string, o: { voteHash?: string; limit?: number } = {}) =>
		this.mex(
			NEWSLETTER_QUERY.POLL_VOTER_LIST,
			{
				input: {
					newsletter_id: jid,
					server_id: serverId,
					limit: o.limit ?? 20,
					...(o.voteHash && { vote_hash: o.voteHash }),
				},
			},
			'voter_list',
		)
	reactionSenders = (jid: string, serverId: string) =>
		this.mex(
			NEWSLETTER_QUERY.REACTION_SENDERS,
			{ input: { id: jid, server_id: serverId } },
			'xwa2_newsletters_reaction_sender_list',
		)
	/** Mark a question post as answered / open (the answers box). */
	setQuestionState = (jid: string, serverId: string, state: string) =>
		this.mex(
			NEWSLETTER_QUERY.QUESTION_RESPONSE_STATE,
			{ newsletter_id: jid, server_id: serverId, state },
			'xwa2_newsletter_question_response_state_update',
		)
	/** Whether a link may get a preview in a channel post. */
	linkPreviewCheck = (url: string) =>
		this.mex(
			NEWSLETTER_QUERY.LINK_PREVIEW_CHECK,
			{ input: { url } },
			'xwa2_newsletter_link_preview',
		)

	// ---- finding channels ----

	/** Search the channel directory by words. */
	search = (text: string, limit = 20, cursor?: string) =>
		this.directorySearch(text, { limit, ...(cursor && { cursor }) })
	/** The directory by view: `RECOMMENDED`, `NEW`, `POPULAR`, `FEATURED` or `TRENDING`. */
	directoryList = (
		o: {
			view?: string
			limit?: number
			cursor?: string
			categories?: string[]
			countryCodes?: string[]
		} = {},
	) =>
		this.mex(
			NEWSLETTER_QUERY.DIRECTORY_LIST,
			{
				input: {
					view: o.view ?? 'RECOMMENDED',
					filters: { country_codes: o.countryCodes ?? ['US'], categories: o.categories ?? [] },
					limit: o.limit ?? 20,
					...(o.cursor && { start_cursor: o.cursor }),
				},
				fetch_status_metadata: false,
			},
			'xwa2_newsletters_directory_list',
		)
	directorySearch = (
		text: string,
		o: { limit?: number; cursor?: string; categories?: string[] } = {},
	) =>
		this.mex(
			NEWSLETTER_QUERY.DIRECTORY_SEARCH,
			{
				input: {
					search_text: text,
					categories: o.categories ?? [],
					limit: o.limit ?? 20,
					...(o.cursor && { start_cursor: o.cursor }),
				},
				fetch_status_metadata: false,
			},
			'xwa2_newsletters_directory_search',
		)
	directoryCategories = (
		o: { categories?: string[]; countryCode?: string; perCategoryLimit?: number } = {},
	) =>
		this.mex(
			NEWSLETTER_QUERY.DIRECTORY_CATEGORY_PREVIEW,
			{
				input: {
					categories: o.categories ?? [],
					...(o.countryCode && { country_code: o.countryCode }),
					per_category_limit: o.perCategoryLimit ?? 5,
				},
				fetch_status_metadata: false,
			},
			'xwa2_newsletters_directory_category_preview',
		)
	recommended = (limit = 10, countryCodes: string[] = ['US']) =>
		this.mex(
			NEWSLETTER_QUERY.RECOMMENDED,
			{ input: { limit, country_codes: countryCodes }, fetch_status_metadata: false },
			'xwa2_newsletters_recommended',
		)
	similar = (jid: string, limit = 10, countryCodes: string[] = ['US']) =>
		this.mex(
			NEWSLETTER_QUERY.SIMILAR,
			{
				input: { newsletter_id: jid, limit, country_codes: countryCodes },
				fetch_status_metadata: false,
			},
			'xwa2_newsletters_similar',
		)
	/** The channels you follow. */
	following = (cursor?: string, limit = 20) =>
		this.mex(
			NEWSLETTER_QUERY.FOLLOWING,
			{ limit, ...(cursor && { start_cursor: cursor }) },
			'xwa2_newsletter_following',
		)
	/** A channel by invite code or JID, the light way (`type` is `'invite'` or `'jid'`). */
	async dehydrated(
		type: 'invite' | 'jid',
		key: string,
		o: { role?: string; pinned?: boolean } = {},
	) {
		return parseNewsletter(
			await this.mex(
				NEWSLETTER_QUERY.DEHYDRATED,
				{
					input: { key, type: type.toUpperCase(), view_role: o.role ?? 'GUEST' },
					fetch_wamo_sub: false,
					fetch_pinned_messages: o.pinned ?? false,
				},
				'xwa2_newsletter',
			),
		)
	}

	/** React to a channel post by its numeric `serverId`; empty `emoji` removes the reaction. */
	async react(jid: string, serverId: string, emoji: string): Promise<void> {
		await this.request({
			tag: 'message',
			attrs: {
				to: jid,
				...(emoji ? {} : { edit: '7' }),
				type: 'reaction',
				server_id: serverId,
				id: this.nextId(),
			},
			content: [{ tag: 'reaction', attrs: emoji ? { code: emoji } : {} }],
		})
	}

	/** Recent posts (raw `<message_updates>` answer). */
	fetchMessages(
		jid: string,
		count: number,
		opts: { since?: number; after?: string } = {},
	): Promise<BinaryNode> {
		return this.request({
			tag: 'iq',
			attrs: { id: this.nextId(), type: 'get', xmlns: 'newsletter', to: jid },
			content: [
				{
					tag: 'message_updates',
					attrs: {
						count: String(count),
						...(opts.since !== undefined && { since: String(opts.since) }),
						...(opts.after && { after: opts.after }),
					},
				},
			],
		})
	}
}

// ---- channel status ---------------------------------------------------------------------------

export interface ChannelStatusEvent {
	channel: string
	id: string
	serverId?: number
	timestamp?: number
	/** True when this account (on another device) is the sender. */
	fromMe: boolean
	/** `text`, `media` or `reaction`; edits and revokes carry `edit` (`1`, `7`, `8`). */
	type: string
	edit?: string
	/** Decoded WAProto message for `text` / `media`. */
	message?: Record<string, unknown>
	mediaType?: string
	/** Emoji of a `reaction`. */
	reaction?: string
	meta?: Record<string, string>
	viewsCount?: number
	reactions?: { code: string; count: number }[]
}

const childOf = (n: BinaryNode, tag: string): BinaryNode | undefined =>
	Array.isArray(n.content) ? n.content.find((c) => c.tag === tag) : undefined

/** Parse a `<status>` stanza the server pushes for a channel ("channel status"). */
export function parseChannelStatus(
	node: BinaryNode,
	decode: (bytes: Uint8Array) => Record<string, unknown>,
): ChannelStatusEvent | undefined {
	const a = node.attrs
	if (!a['from']?.endsWith('@newsletter') || !a['id']) return undefined
	const type = a['type'] ?? 'text'
	const plain = childOf(node, 'plaintext')
	const meta = childOf(node, 'meta')
	const views = childOf(node, 'views_count')
	const reactions = childOf(node, 'reactions')
	let message: Record<string, unknown> | undefined
	if (plain?.content instanceof Uint8Array && !a['edit']) {
		try {
			message = decode(plain.content)
		} catch {
			/* an undecodable payload is still reported without its message */
		}
	}
	return {
		channel: a['from'],
		id: a['id'],
		...(a['server_id'] && { serverId: Number(a['server_id']) }),
		...(a['t'] && { timestamp: Number(a['t']) }),
		fromMe: a['is_sender'] === 'true',
		type,
		...(a['edit'] && { edit: a['edit'] }),
		...(message && { message }),
		...(plain?.attrs['mediatype'] && { mediaType: plain.attrs['mediatype'] }),
		...(type === 'reaction' && { reaction: childOf(node, 'reaction')?.attrs['code'] ?? '' }),
		...(meta && { meta: meta.attrs }),
		...(views?.attrs['count'] && { viewsCount: Number(views.attrs['count']) }),
		...(Array.isArray(reactions?.content) && {
			reactions: reactions.content
				.filter((r) => r.tag === 'reaction')
				.map((r) => ({ code: r.attrs['code'] ?? '', count: Number(r.attrs['count'] ?? 0) })),
		}),
	}
}
