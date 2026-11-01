import type { BinaryNode } from '../../codec/index.js'
import type { RequestFn } from './groups.js'
import type { MexFn } from './mex.js'

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

	update = (jid: string, updates: { name?: string; description?: string }) =>
		this.mex(
			NEWSLETTER_QUERY.UPDATE_METADATA,
			{ newsletter_id: jid, updates: { ...updates, settings: null } },
			'xwa2_newsletter_update',
		)

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
