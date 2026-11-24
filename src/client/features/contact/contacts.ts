// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { BinaryNode } from '../../../codec/index.js'
import { IqError } from '../../receiver.js'
import type { RequestFn } from '../group/groups.js'
import type { MexFn } from '../mex.js'

const kids = (n: BinaryNode | undefined, tag?: string): BinaryNode[] =>
	n && Array.isArray(n.content) ? n.content.filter((c) => tag === undefined || c.tag === tag) : []
const textOf = (n: BinaryNode | undefined): string | undefined =>
	!n
		? undefined
		: typeof n.content === 'string'
			? n.content
			: n.content instanceof Uint8Array
				? Buffer.from(n.content).toString('utf8')
				: undefined

// ---- usync ------------------------------------------------------------------------------------

export interface UsyncUser {
	/** Address by JID ... */
	jid?: string
	/** ... or by phone number (`+4915...`) for contact lookups. */
	phone?: string
	/** ... or by username (`9oged`, without the @), with the owner's PIN if they set one. */
	username?: string
	pin?: string
	/** The AI bot's persona id (from the bot directory, `BotEntry.personaId`), for `botProfileProtocol`. */
	personaId?: string
}

export interface UsyncProtocol {
	name: string
	query: BinaryNode
	user?(u: UsyncUser): BinaryNode | null
}

export const contactProtocol: UsyncProtocol = {
	name: 'contact',
	query: { tag: 'contact', attrs: {} },
	user: (u) =>
		u.phone
			? { tag: 'contact', attrs: {}, content: u.phone }
			: u.username
				? { tag: 'contact', attrs: { username: u.username, ...(u.pin && { pin: u.pin }) } }
				: { tag: 'contact', attrs: {} },
}
export const statusProtocol: UsyncProtocol = { name: 'status', query: { tag: 'status', attrs: {} } }
export const usernameProtocol: UsyncProtocol = {
	name: 'username',
	query: { tag: 'username', attrs: {} },
}
export const lidProtocol: UsyncProtocol = { name: 'lid', query: { tag: 'lid', attrs: {} } }
export const disappearingProtocol: UsyncProtocol = {
	name: 'disappearing_mode',
	query: { tag: 'disappearing_mode', attrs: {} },
}
export const botProfileProtocol: UsyncProtocol = {
	name: 'bot',
	query: { tag: 'bot', attrs: {}, content: [{ tag: 'profile', attrs: { v: '1' } }] },
	user: (u) => ({
		tag: 'bot',
		attrs: {},
		content: [{ tag: 'profile', attrs: { persona_id: u.personaId ?? '' } }],
	}),
}

export interface UsyncEntry {
	/** The JID the server answered for. */
	id: string
	/** Raw protocol answers by name. */
	nodes: Record<string, BinaryNode>
}

/** Run a usync query and return one entry per user node in the answer. */
export async function usync(
	request: RequestFn,
	sid: string,
	context: 'interactive' | 'message' | 'background',
	protocols: UsyncProtocol[],
	users: UsyncUser[],
): Promise<UsyncEntry[]> {
	const res = await request({
		tag: 'iq',
		attrs: { to: 's.whatsapp.net', type: 'get', xmlns: 'usync' },
		content: [
			{
				tag: 'usync',
				attrs: { context, mode: 'query', sid, last: 'true', index: '0' },
				content: [
					{ tag: 'query', attrs: {}, content: protocols.map((p) => p.query) },
					{
						tag: 'list',
						attrs: {},
						content: users.map((u) => ({
							tag: 'user',
							attrs: u.jid ? { jid: u.jid } : ({} as Record<string, string>),
							content: protocols
								.map((p) => p.user?.(u) ?? null)
								.filter((n): n is BinaryNode => n !== null),
						})),
					},
				],
			},
		],
	})
	const list = kids(kids(kids(res, 'usync')[0] ?? res, 'list')[0], 'user')
	return list.map((u) => ({
		id: u.attrs['jid'] ?? '',
		nodes: Object.fromEntries(kids(u).map((c) => [c.tag, c])),
	}))
}

// ---- high level -------------------------------------------------------------------------------

export interface WhatsAppLookup {
	jid: string
	exists: boolean
}

export interface StatusInfo {
	jid: string
	status: string | null
	setAt: Date
}

/** Profile status ("About") of users. */
export async function fetchStatus(
	request: RequestFn,
	sid: string,
	jids: string[],
): Promise<StatusInfo[]> {
	const entries = await usync(
		request,
		sid,
		'interactive',
		[statusProtocol],
		jids.map((jid) => ({ jid })),
	)
	return entries.flatMap((e) => {
		const n = e.nodes['status']
		if (!n) return []
		const status = textOf(n)
		return [
			{
				jid: e.id,
				status: status ? status : null,
				setAt: new Date(Number(n.attrs['t'] ?? 0) * 1000),
			},
		]
	})
}

/** The usernames some contacts have set (`@name`), by JID. Contacts without one are left out. */
export async function contactUsernames(
	request: RequestFn,
	sid: string,
	jids: string[],
): Promise<{ jid: string; username: string }[]> {
	const entries = await usync(
		request,
		sid,
		'interactive',
		[usernameProtocol],
		jids.map((jid) => ({ jid })),
	)
	return entries.flatMap((e) => {
		const username = textOf(e.nodes['username'])
		return username ? [{ jid: e.id, username }] : []
	})
}

/** Which of these phone numbers (`4915...` or `+4915...`) are on WhatsApp? */
export async function onWhatsApp(
	request: RequestFn,
	sid: string,
	numbers: string[],
): Promise<WhatsAppLookup[]> {
	const phones = numbers
		.filter((n) => !n.endsWith('@lid'))
		.map((n) => `+${n.replace('+', '').split('@')[0]!.split(':')[0]}`)
	if (!phones.length) return []
	const entries = await usync(
		request,
		sid,
		'interactive',
		[contactProtocol],
		phones.map((phone) => ({ phone })),
	)
	return entries.flatMap((e) => {
		const c = e.nodes['contact']
		return c ? [{ jid: e.id, exists: c.attrs['type'] === 'in' }] : []
	})
}

/** Map phone-number JIDs to their LIDs. */
export async function lidsFor(
	request: RequestFn,
	sid: string,
	jids: string[],
): Promise<{ pn: string; lid: string }[]> {
	const entries = await usync(
		request,
		sid,
		'background',
		[lidProtocol],
		jids.filter((j) => !j.endsWith('@lid')).map((jid) => ({ jid })),
	)
	return entries.flatMap((e) =>
		e.nodes['lid']?.attrs['val'] ? [{ pn: e.id, lid: e.nodes['lid'].attrs['val']! }] : [],
	)
}

/** URL of a profile picture (`preview` = small, `image` = full size). */
export async function profilePictureUrl(
	request: RequestFn,
	jid: string,
	type: 'preview' | 'image' = 'preview',
): Promise<string | undefined> {
	try {
		const res = await request({
			tag: 'iq',
			attrs: {
				target: jid.replace(/:\d+@/, '@'),
				to: 's.whatsapp.net',
				type: 'get',
				xmlns: 'w:profile:picture',
			},
			content: [{ tag: 'picture', attrs: { type, query: 'url' } }],
		})
		return kids(res, 'picture')[0]?.attrs['url']
	} catch (e) {
		// 404 item-not-found (no picture) and 401/403 (hidden by the contact's privacy) are normal answers.
		if (e instanceof IqError && ['404', '401', '403'].includes(e.code ?? '')) return undefined
		throw e
	}
}

const UPDATE_TEXT_STATUS_QUERY = '9152604461510864'

export interface StatusOptions {
	/** An emoji shown above the About text (newer clients only). */
	emoji?: string
	/** Seconds until this status reverts to the previous one, or 0/undefined for a permanent one. */
	ephemeralDurationSec?: number
}

/** Set our "About" text, and optionally an emoji/an expiry newer clients show above it. The emoji/expiry
 * go through a `w:mex` mutation that is account-gated - on an account without it the mutation itself
 * answers with an error, but the legacy IQ below is what actually updates the About text contacts see,
 * so that one always goes out regardless. */
export async function updateStatus(
	request: RequestFn,
	text: string,
	o: StatusOptions = {},
	mex?: MexFn,
): Promise<void> {
	if (o.emoji || o.ephemeralDurationSec) {
		if (!mex) throw new Error('updateStatus: an emoji or an expiry needs the mex function')
		await mex(UPDATE_TEXT_STATUS_QUERY, {
			input: {
				text,
				...(o.emoji && { emoji: { content: o.emoji } }),
				ephemeral_duration_sec: o.ephemeralDurationSec ?? 0,
			},
		})
	}
	await request({
		tag: 'iq',
		attrs: { to: 's.whatsapp.net', type: 'set', xmlns: 'status' },
		content: [{ tag: 'status', attrs: {}, content: Buffer.from(text, 'utf8') }],
	})
}

export async function fetchBlocklist(request: RequestFn): Promise<string[]> {
	const res = await request({
		tag: 'iq',
		attrs: { xmlns: 'blocklist', to: 's.whatsapp.net', type: 'get' },
	})
	return kids(kids(res, 'list')[0], 'item')
		.map((i) => i.attrs['jid'] ?? '')
		.filter(Boolean)
}

export interface BlockOptions {
	/** The contact's LID; the server wants blocks addressed by LID once one exists. */
	lid?: string
	/** Where the block comes from (`entry_point`); the app sends its screen name. */
	entryPoint?: string
	/** Why (business chats): `spam`, `scam_or_fraud`, `no_longer_needed`, `no_sign_up`, `offensive_messages`, `other`. */
	reason?: string
	reasonDescription?: string
}

export async function updateBlockStatus(
	request: RequestFn,
	jid: string,
	action: 'block' | 'unblock',
	o: BlockOptions = {},
): Promise<void> {
	const addr = o.lid ?? jid
	await request({
		tag: 'iq',
		attrs: { xmlns: 'blocklist', to: 's.whatsapp.net', type: 'set' },
		content: [
			{
				tag: 'item',
				// The server only wants the PN next to the LID on a block; an unblock with it never gets an answer.
				attrs: {
					action,
					jid: addr,
					...(action === 'block' && o.lid && !jid.endsWith('@lid') && { pn_jid: jid }),
				},
				content:
					action === 'block' && (o.reason || o.reasonDescription)
						? [
								{
									tag: 'biz_opt_out',
									attrs: {
										...(o.reason && { reason: o.reason }),
										...(o.reasonDescription && { reason_description: o.reasonDescription }),
										...(o.entryPoint && { entry_point: o.entryPoint }),
									},
								},
							]
						: undefined,
			},
			...(action === 'block' && o.entryPoint
				? [{ tag: 'entry_point', attrs: { source: o.entryPoint } }]
				: []),
		],
	})
}

// ---- privacy ----------------------------------------------------------------------------------

export type PrivacyCategory =
	| 'last'
	| 'online'
	| 'profile'
	| 'status'
	| 'groupadd'
	| 'readreceipts'
	| 'calladd'
	| 'messages'
	| 'stickers'
	| 'about'
export type PrivacyValue = 'all' | 'contacts' | 'contact_blacklist' | 'none' | 'match_last_seen'

/** All privacy settings as `{ category: value }`. */
export async function fetchPrivacySettings(request: RequestFn): Promise<Record<string, string>> {
	const res = await request({
		tag: 'iq',
		attrs: { xmlns: 'privacy', to: 's.whatsapp.net', type: 'get' },
		content: [{ tag: 'privacy', attrs: {} }],
	})
	const out: Record<string, string> = {}
	for (const c of kids(kids(res, 'privacy')[0], 'category'))
		if (c.attrs['name']) out[c.attrs['name']] = c.attrs['value'] ?? ''
	return out
}

export interface StatusPrivacy {
	type: 'contacts' | 'blacklist' | 'whitelist' | string
	isDefault: boolean
	/** Who's on the list, for `blacklist`/`whitelist`. */
	list: string[]
}

/** Who sees our text/picture/video status updates - a separate IQ from the account's general privacy
 * settings (`fetchPrivacySettings`), with its own `status` namespace. The first entry is the one the
 * server itself marked `default="true"`; WhatsApp's own fallback ("contacts") is only synthesized here
 * when the server genuinely has nothing stored yet (item-not-found, or an empty answer) - any other
 * failure propagates, and a response with lists but none marked default is returned as the server sent
 * it rather than guessing which one is the default. */
export async function fetchStatusPrivacy(request: RequestFn): Promise<StatusPrivacy[]> {
	const DEFAULT: StatusPrivacy[] = [{ type: 'contacts', isDefault: true, list: [] }]
	let res: BinaryNode
	try {
		res = await request({
			tag: 'iq',
			attrs: { xmlns: 'status', to: 's.whatsapp.net', type: 'get' },
			content: [{ tag: 'privacy', attrs: {} }],
		})
	} catch (e) {
		if (e instanceof IqError && e.code === '404') return DEFAULT
		throw e
	}
	const lists = kids(kids(res, 'privacy')[0], 'list').map((list) => ({
		type: list.attrs['type'] ?? '',
		isDefault: list.attrs['default'] === 'true' || list.attrs['default'] === '1',
		list: kids(list, 'user')
			.map((u) => u.attrs['jid'])
			.filter((jid): jid is string => !!jid),
	}))
	if (!lists.length) return DEFAULT
	const def = lists.findIndex((l) => l.isDefault)
	if (def > 0) [lists[0], lists[def]] = [lists[def]!, lists[0]!]
	return lists
}

export async function updatePrivacy(
	request: RequestFn,
	name: PrivacyCategory,
	value: PrivacyValue,
): Promise<void> {
	await request({
		tag: 'iq',
		attrs: { xmlns: 'privacy', to: 's.whatsapp.net', type: 'set' },
		content: [
			{ tag: 'privacy', attrs: {}, content: [{ tag: 'category', attrs: { name, value } }] },
		],
	})
}

/**
 * Set a profile picture for ourselves (no `jid`) or a group. WhatsApp wants a square JPEG (640x640 is
 * what the apps send); no image library is bundled, so resize beforehand.
 */
export async function updateProfilePicture(
	request: RequestFn,
	jpeg: Uint8Array,
	jid?: string,
): Promise<void> {
	if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('profile pictures must be JPEG')
	await request({
		tag: 'iq',
		attrs: {
			to: 's.whatsapp.net',
			type: 'set',
			xmlns: 'w:profile:picture',
			...(jid && { target: jid }),
		},
		content: [{ tag: 'picture', attrs: { type: 'image' }, content: jpeg }],
	})
}

export async function removeProfilePicture(request: RequestFn, jid?: string): Promise<void> {
	await request({
		tag: 'iq',
		attrs: {
			to: 's.whatsapp.net',
			type: 'set',
			xmlns: 'w:profile:picture',
			...(jid && { target: jid }),
		},
	})
}

/** Find the account behind a username (`@name` or `name`). Returns null when nobody has it. */
export async function findUserByUsername(
	request: RequestFn,
	sid: string,
	username: string,
	pin?: string,
): Promise<{ jid: string; exists: boolean } | null> {
	const entries = await usync(
		request,
		sid,
		'interactive',
		[contactProtocol],
		[{ username: username.replace(/^@/, ''), ...(pin && { pin }) }],
	)
	const e = entries[0]
	if (!e || !e.id) return null
	return { jid: e.id, exists: e.nodes['contact']?.attrs['type'] === 'in' }
}

// ---- QR / "click to chat" links ----------------------------------------------------------------

const stripLinkPrefix = (link: string, ...prefixes: string[]): string => {
	for (const p of prefixes) if (link.startsWith(p)) return link.slice(p.length)
	return link
}

export interface BusinessMessageLinkTarget {
	jid: string
	pushName?: string
	/** The pre-filled message text the link opens the chat with, if the link carries one. */
	message?: string
	isSigned?: boolean
	verifiedName?: string
	verifiedLevel?: string
}

/** Resolve a `wa.me/message/<code>` or `api.whatsapp.com/message/<code>` "click to chat" link (the full
 * URL or just the code) to the business account and pre-filled message it opens. */
export async function resolveBusinessMessageLink(
	request: RequestFn,
	link: string,
): Promise<BusinessMessageLinkTarget> {
	const code = stripLinkPrefix(link, 'https://wa.me/message/', 'https://api.whatsapp.com/message/')
	const res = await request({
		tag: 'iq',
		attrs: { type: 'get', xmlns: 'w:qr' },
		content: [{ tag: 'qr', attrs: { code } }],
	})
	const qr = kids(res, 'qr')[0]
	if (!qr) throw new Error('business message link not found')
	const business = kids(qr, 'business')[0]
	const message = kids(qr, 'message')[0]?.content
	return {
		jid: qr.attrs['jid'] ?? '',
		...(qr.attrs['notify'] && { pushName: qr.attrs['notify'] }),
		...(message && {
			message:
				typeof message === 'string' ? message : Buffer.from(message as Uint8Array).toString('utf8'),
		}),
		...(business && {
			isSigned: business.attrs['is_signed'] === 'true',
			verifiedName: business.attrs['verified_name'],
			verifiedLevel: business.attrs['verified_level'],
		}),
	}
}

export interface ContactQRLinkTarget {
	jid: string
	pushName?: string
	type: string
}

/** Resolve a `wa.me/qr/<code>` or `api.whatsapp.com/qr/<code>` contact-share link (the full URL or just
 * the code) to the account it points at. */
export async function resolveContactQRLink(
	request: RequestFn,
	link: string,
): Promise<ContactQRLinkTarget> {
	const code = stripLinkPrefix(link, 'https://wa.me/qr/', 'https://api.whatsapp.com/qr/')
	const res = await request({
		tag: 'iq',
		attrs: { type: 'get', xmlns: 'w:qr' },
		content: [{ tag: 'qr', attrs: { code } }],
	})
	const qr = kids(res, 'qr')[0]
	if (!qr) throw new Error('contact QR link not found')
	return {
		jid: qr.attrs['jid'] ?? '',
		...(qr.attrs['notify'] && { pushName: qr.attrs['notify'] }),
		type: qr.attrs['type'] ?? '',
	}
}

/** Our own `wa.me/qr/<code>` contact-share link, resolvable with `resolveContactQRLink`. `revoke: true`
 * invalidates the previous code and issues a fresh one. */
export async function getContactQRLink(request: RequestFn, revoke = false): Promise<string> {
	const res = await request({
		tag: 'iq',
		attrs: { type: 'set', xmlns: 'w:qr' },
		content: [{ tag: 'qr', attrs: { type: 'contact', action: revoke ? 'revoke' : 'get' } }],
	})
	const qr = kids(res, 'qr')[0]
	if (!qr?.attrs['code']) throw new Error('no contact QR code in response')
	return qr.attrs['code']
}
