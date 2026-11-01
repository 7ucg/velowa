// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { hkdfSync } from 'node:crypto'
import type { BinaryNode } from '../../../codec/index.js'
import { encodeProto } from '../../proto.js'
import { reportableContent } from '../../reporting.js'

/** Entry points (`spam_flow`) the app sends most often. Any other value from WhatsApp's list also works. */
export const REPORT_FLOWS = {
	/** Report from the open chat. */
	chat: 'chat',
	/** "Report" in a message's menu. */
	message: 'message_menu',
	/** Report contact from the chat's overflow menu. */
	overflowMenu: 'overflow_menu_report',
	/** Report from the contact info screen. */
	accountInfo: 'account_info_report',
	/** "Report spam" banner on an unknown chat. */
	spamBanner: '1_1_spam_banner_report',
	/** Safety card in a chat from an unknown number. */
	safetyCard: 'chat_fmx_card_safety_tools_report',
	/** Report group from the group info screen. */
	groupInfo: 'group_info_report',
	/** Report group from the spam banner. */
	groupBanner: 'group_spam_banner_report',
	/** Report group while leaving. */
	groupLeave: 'group_info_leave_report_upsell',
	/** Report channel from its info screen. */
	channel: 'newsletter_info_report',
	/** Report a status post. */
	statusPost: 'status_post_report',
	/** Report from the media viewer. */
	mediaViewer: 'media_viewer',
} as const

/** Values the app's own check refuses (it throws "Invalid BlockSpamReportOrigin value" before sending). */
const REJECTED_FLOWS = new Set([
	'account_info',
	'account_info_report_as_guest_user',
	'block_dialog',
	'call_log',
	'call_spam_dialog_block',
	'channel_status_report',
	'chat_fmx_card_report_as_guest_user',
	'chat_list_context_menu_block',
	'chat_list_swipe_delete_block_upsell',
	'chat_list_swipe_delete_report_upsell',
	'ent_client',
	'frx',
	'group_chatlist_swipe_leave_report_upsell',
	'group_info',
	'guest_call_participant_report',
	'guest_call_report',
	'overflow_menu',
	'overflow_menu_community_report',
	'payment_transaction_report',
])

/** A message to hand over as evidence. Taken from what this client sent or received (`ReportStore`). */
export interface ReportedMessage {
	id: string
	/** Unix seconds. */
	t: number
	fromMe: boolean
	/** The sender inside a group. */
	participant?: string
	/** The chat the message belongs to. */
	chat: string
	/** Decoded message (as in the `message` event). */
	message: Record<string, unknown>
	/** Our own jid, used for the reporting key of messages we received. */
	meId?: string
	/** What the server attached to a message we received: its `reporting_tag` and the sender's token. */
	reporting?: { tag?: Uint8Array; token?: Uint8Array; version?: number }
}

export interface ReportOptions {
	/** Where the report comes from; see `REPORT_FLOWS`. Defaults per kind. */
	flow?: string
	/** Evidence (up to 210). Without any, the server only gets the chat. */
	messages?: ReportedMessage[]
	/** Whether the chat is in the address book (user) or we are a member (group); sent as `is_known_chat`. */
	isKnownChat?: boolean
	/** 24 characters; WhatsApp's own trace id. Optional. */
	wiTraceId?: string
	/** Group / channel name (required by the server for those). */
	subject?: string
	/** Groups: the user who added us. */
	source?: string
}

export type ReportKind = 'user' | 'group' | 'newsletter' | 'status'

const DEFAULT_FLOW: Record<ReportKind, string> = {
	user: REPORT_FLOWS.chat,
	group: REPORT_FLOWS.groupInfo,
	newsletter: REPORT_FLOWS.channel,
	status: REPORT_FLOWS.statusPost,
}

const MEDIA_TYPES: [string, string][] = [
	['imageMessage', 'image'],
	['videoMessage', 'video'],
	['audioMessage', 'audio'],
	['documentMessage', 'document'],
	['stickerMessage', 'sticker'],
	['locationMessage', 'location'],
	['liveLocationMessage', 'livelocation'],
	['contactMessage', 'vcard'],
	['contactsArrayMessage', 'contact_array'],
	['pollCreationMessage', 'url'],
]

const normalize = (jid: string): string => jid.replace(/:\d+@/, '@')

/** The evidence node of one message: the plain protobuf, a reporting token and the key that checks it. */
export function reportedMessageNode(m: ReportedMessage, kind: ReportKind): BinaryNode {
	const plain = encodeProto('Message', m.message)
	const secret = (m.message['messageContextInfo'] as { messageSecret?: Uint8Array } | undefined)
		?.messageSecret
	const content = reportableContent(plain)
	const evidence: BinaryNode[] = []
	// Only messages the server tagged on delivery can be proven: the report carries the sender's token and the key
	// derived from the message secret. For our own messages the server has no tag, and a token it cannot match gets
	// no answer at all, so they go as plain content.
	if (!m.fromMe && m.reporting?.tag && m.reporting.token && secret && content) {
		const key = Buffer.from(
			hkdfSync(
				'sha256',
				secret,
				Buffer.alloc(0),
				Buffer.concat([
					Buffer.from(m.id),
					Buffer.from(m.participant ?? m.chat),
					// receiver: the group in a group, our own JID in a chat (set when the message is stored)
					Buffer.from(m.chat.endsWith('@g.us') ? m.chat : (m.meId ?? m.chat)),
					Buffer.from('Report Token'),
				]),
				32,
			),
		)
		evidence.push(
			{
				tag: 'reporting',
				attrs: {},
				content: [{ tag: 'reporting_tag', attrs: {}, content: m.reporting.tag }],
			},
			{
				tag: 'content_validation',
				attrs: { type: 'e2e_proto_message' },
				content: [
					{
						tag: 'reporting_token',
						attrs: { v: String(m.reporting.version ?? 2) },
						content: m.reporting.token,
					},
					{ tag: 'reporting_token_key', attrs: {}, content: key },
				],
			},
		)
	}
	const mediatype = MEDIA_TYPES.find(([k]) => m.message[k])?.[1]
	const who: Record<string, string> = m.fromMe
		? { to: m.chat }
		: { from: kind === 'group' ? m.chat : (m.participant ?? m.chat) }
	return {
		tag: 'message',
		attrs: {
			...who,
			t: String(m.t),
			id: m.id,
			...(kind === 'group' && !m.fromMe && m.participant ? { participant: m.participant } : {}),
		},
		content: [
			{
				tag: 'raw',
				attrs: { v: '2', ...(mediatype && { mediatype }) },
				content: plain,
			},
			...evidence,
		],
	}
}

/**
 * One report as the app sends it: `iq set xmlns=spam` with a single `spam_list` (the reasons in the app are only the
 * entry point, `spam_flow`). Blocking, leaving a group or deleting the chat are separate actions.
 */
export function buildReport(
	kind: ReportKind,
	jid: string,
	id: string,
	o: ReportOptions = {},
): BinaryNode {
	const flow = o.flow ?? DEFAULT_FLOW[kind]
	if (REJECTED_FLOWS.has(flow))
		throw new Error(`report flow "${flow}" is refused by the app itself`)
	if (o.wiTraceId !== undefined && o.wiTraceId.length !== 24)
		throw new Error('wiTraceId must be exactly 24 characters')
	const messages = (o.messages ?? []).slice(-210)
	if ((kind === 'group' || kind === 'newsletter') && o.subject === undefined)
		throw new Error(
			`a ${kind} report needs the ${kind === 'group' ? 'group' : 'channel'} name as subject`,
		)
	return {
		tag: 'iq',
		attrs: { id, to: 's.whatsapp.net', type: 'set', xmlns: 'spam' },
		content: [
			{
				tag: 'spam_list',
				attrs: {
					jid: normalize(jid),
					spam_flow: flow,
					...(o.wiTraceId && { wi_trace_id: o.wiTraceId }),
					...(o.isKnownChat !== undefined && { is_known_chat: String(o.isKnownChat) }),
					...(o.subject !== undefined && { subject: o.subject }),
					...(o.source && { source: normalize(o.source) }),
				},
				content: messages.map((m) => reportedMessageNode(m, kind)),
			},
		],
	}
}

/** Pull the report id out of the server's answer. */
export function reportId(res: BinaryNode): string | undefined {
	const r = Array.isArray(res.content) ? res.content.find((c) => c.tag === 'report') : undefined
	return r?.attrs['id']
}

/** Tell the group admins about a message (no WhatsApp report, just the admins' "reported messages" list). */
export function reportToAdmins(group: string, id: string, messageId: string): BinaryNode {
	return {
		tag: 'iq',
		attrs: { id, to: group, type: 'set', xmlns: 'w:g2' },
		content: [
			{
				tag: 'reports',
				attrs: {},
				content: [{ tag: 'report', attrs: { message_id: messageId } }],
			},
		],
	}
}

/** Allow or forbid members to report messages to the admins. */
export function setMemberReports(group: string, id: string, allow: boolean): BinaryNode {
	return {
		tag: 'iq',
		attrs: { id, to: group, type: 'set', xmlns: 'w:g2' },
		content: [{ tag: allow ? 'allow_admin_reports' : 'not_allow_admin_reports', attrs: {} }],
	}
}

/** Remembers recent messages (sent and received) so they can be attached to a report. In memory only. */
export class ReportStore {
	readonly #byChat = new Map<string, ReportedMessage[]>()
	constructor(private readonly perChat = 50) {}

	add(m: ReportedMessage): void {
		const list = this.#byChat.get(m.chat) ?? []
		if (list.some((x) => x.id === m.id)) return
		list.push(m)
		if (list.length > this.perChat) list.shift()
		this.#byChat.set(m.chat, list)
		if (this.#byChat.size > 500) this.#byChat.delete(this.#byChat.keys().next().value!)
	}

	/** The latest messages of a chat; `fromOthers` skips our own. */
	recent(chat: string, n = 5, fromOthers = false): ReportedMessage[] {
		const list = (this.#byChat.get(chat) ?? []).filter((m) => !fromOthers || !m.fromMe)
		return list.slice(-n)
	}
}
