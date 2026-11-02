// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { BinaryNode } from '../../../codec/index.js'
import type { RequestFn } from '../group/groups.js'
import type { MexFn } from '../mex.js'

// Privacy and "about" settings beyond the basic categories, text status, profile pictures, who is online, reminders.
// Most of these are GraphQL calls with fixed ids; the few that are plain stanzas are built below.

/** The settings WhatsApp Web asks for. */
const DEFAULT_FEATURES = [
	'LAST',
	'ONLINE',
	'PROFILE',
	'ABOUT',
	'READRECEIPTS',
	'GROUPADD',
	'STATUS',
	'CALLADD',
	'MESSAGES',
]

const IDS = {
	GET_SETTINGS: '25637004609323493',
	SET_SETTING: '26887749497493182',
	UPDATE_CONTACT_LIST: '26375158178762799',
	GET_CONTACT_LIST: '26806428515612550',
	UPDATE_TEXT_STATUS: '9152604461510864',
	GET_TEXT_STATUS_LIST: '24072923595647473',
	UPDATE_USER_STATUS: '7452341274886724',
	FETCH_USER_PICTURE: '24983561624604407',
	PROFILE_PICTURE: '24714239711610700',
	MIGRATE_BLOCKLIST_LID: '25028600226770432',
	ONLINE_STATUS: '24599444653063564',
	ONLINE_STATUS_LAST_SEEN: '24653084284365540',
	SUGGESTED_CONTACTS: '31663643799945793',
	REMINDER_CREATE: '32149118614673399',
	REMINDER_DELETE: '25462476600019778',
}

const kids = (n: BinaryNode | undefined, tag?: string): BinaryNode[] =>
	n && Array.isArray(n.content) ? n.content.filter((c) => tag === undefined || c.tag === tag) : []

const iq = (xmlns: string, type: 'get' | 'set', content?: BinaryNode[]): BinaryNode => ({
	tag: 'iq',
	attrs: { to: 's.whatsapp.net', xmlns, type },
	...(content && { content }),
})

/** Default "disappearing messages" timer for new chats, in seconds (0 = off). */
export const defaultDisappearingNode = (seconds: number): BinaryNode =>
	iq('disappearing_mode', 'set', [
		{ tag: 'disappearing_mode', attrs: { duration: String(seconds) } },
	])

export type BlockingAction = string

export class Privacy {
	constructor(
		private readonly request: RequestFn,
		private readonly mex: MexFn,
	) {}

	// ---- settings by feature name (the GraphQL form: LAST_SEEN, ONLINE, PROFILE_PHOTO, STATUS, GROUPS, READ_RECEIPTS, ...) ----

	/** All privacy settings of an account (yours: `client.me.id`). `features` narrows the answer. */
	settings = (jid: string, features: string[] = DEFAULT_FEATURES): Promise<unknown> =>
		this.mex(
			IDS.GET_SETTINGS,
			{ input: { query_input: [{ jid, privacy_features: features }] } },
			'xwa2_fetch_wa_users',
		)

	/** Change one setting: `set('LAST_SEEN', 'CONTACTS')`. */
	set = (feature: string, setting: string): Promise<unknown> =>
		this.mex(IDS.SET_SETTING, { feature, setting }, 'xwa2_privacy_feature_update')

	/** The allow / block list behind a setting ("my contacts except..."): for `category` such as `LAST`, and `type` such as `CONTACT_BLACKLIST`. */
	contactList = (jid: string, category: string, type: string, dhash = ''): Promise<unknown> =>
		this.mex(
			IDS.GET_CONTACT_LIST,
			{
				input: {
					query_input: [{ jid, privacy_contact_list_type: { dhash, category, type } }],
				},
			},
			'xwa2_fetch_wa_users',
		)

	setContactList = (feature: string, setting: string, jids: string[]): Promise<unknown> =>
		this.mex(
			IDS.UPDATE_CONTACT_LIST,
			{ feature, setting, contacts: jids.map((jid) => ({ jid })) },
			'xwa2_privacy_contact_list_update',
		)

	/** Default disappearing-messages timer for new chats, in seconds (0 = off). */
	async setDefaultDisappearing(seconds: number): Promise<void> {
		await this.request(defaultDisappearingNode(seconds))
	}

	// ---- blocking and push settings (plain stanzas) ----

	async blockingStatus(): Promise<string | undefined> {
		const res = await this.request(
			iq('w:comms:chat', 'get', [
				{ tag: 'query', attrs: {}, content: [{ tag: 'blocking_status', attrs: {} }] },
			]),
		)
		return (kids(res, 'blocking')[0] ?? kids(kids(res, 'query')[0], 'blocking')[0])?.attrs['status']
	}

	async setBlocking(action: BlockingAction): Promise<string | undefined> {
		const res = await this.request(
			iq('w:comms:chat', 'set', [{ tag: 'blocking', attrs: { action } }]),
		)
		return kids(res, 'blocking')[0]?.attrs['status']
	}

	/** The server's "opt out" list. Returned as the raw answer. */
	optOutList = (): Promise<BinaryNode> => this.request(iq('optoutlist', 'get'))

	async pushConfig(): Promise<Record<string, string> | undefined> {
		const res = await this.request(
			iq('urn:xmpp:whatsapp:push', 'get', [{ tag: 'settings', attrs: {} }]),
		)
		return kids(res, 'settings')[0]?.attrs
	}

	async setPushConfig(config: Record<string, string>): Promise<void> {
		await this.request(iq('urn:xmpp:whatsapp:push', 'set', [{ tag: 'config', attrs: config }]))
	}

	/** Notices the user has to be shown (terms, disclosures) since `since`. */
	async disclosures(since = 0): Promise<Record<string, string>[]> {
		const res = await this.request(
			iq('tos', 'get', [{ tag: 'get_user_disclosures', attrs: { t: String(since) } }]),
		)
		return kids(res, 'notice').map((n) => ({ ...n.attrs }))
	}

	// ---- text status ("About" with an emoji) and profile ----

	setTextStatus = (text: string, emoji?: string): Promise<unknown> =>
		this.mex(
			IDS.UPDATE_TEXT_STATUS,
			{ text_status_input: { text, ...(emoji && { emoji: { content: emoji } }) } },
			'xwa2_text_status_update',
		)

	textStatusList = (jids: string[], lastUpdateTime: number | null = null): Promise<unknown> =>
		this.mex(
			IDS.GET_TEXT_STATUS_LIST,
			{ input: jids.map((jid) => ({ jid, last_update_time: lastUpdateTime })) },
			'xwa2_text_status_list',
		)

	setUserStatus = (status: string): Promise<unknown> =>
		this.mex(IDS.UPDATE_USER_STATUS, { status }, 'xwa2_update_user_status')

	pictureInfo = (jid: string): Promise<unknown> =>
		this.mex(IDS.FETCH_USER_PICTURE, { jid }, 'xwa2_fetch_user_picture_info')

	/** Set the profile picture through GraphQL (base64 image). The plain way is `client.updateProfilePicture`. */
	setPictureBase64 = (imageBase64: string, type = 'image'): Promise<unknown> =>
		this.mex(
			IDS.PROFILE_PICTURE,
			{ input: { image: imageBase64, type } },
			'xwa2_profile_picture_mutation',
		)

	// ---- contacts ----

	/** Whether these accounts are online right now. */
	onlineStatus = (jids: string[]): Promise<unknown> =>
		this.mex(IDS.ONLINE_STATUS, { jids }, 'xwa2_query_online_status')

	onlineStatusLastSeen = (jids: string[]): Promise<unknown> =>
		this.mex(IDS.ONLINE_STATUS_LAST_SEEN, { jids }, 'xwa2_query_online_status_last_seen')

	suggestedContacts = (limit = 20): Promise<unknown> =>
		this.mex(IDS.SUGGESTED_CONTACTS, { limit }, 'xwa2_suggested_contacts_v2')

	/** Move the block list to LIDs (the server's account-id format). */
	migrateBlocklistToLid = (jids: string[], dhash = '', dirtyAck = true): Promise<unknown> =>
		this.mex(
			IDS.MIGRATE_BLOCKLIST_LID,
			{ input: { blocklist: jids.map((jid) => ({ jid })), dhash, dirty_ack: dirtyAck } },
			'xwa2_migrate_blocklist_lid',
		)

	// ---- reminders ----

	createReminder = (title: string, body: string, scheduledTime: number): Promise<unknown> =>
		this.mex(
			IDS.REMINDER_CREATE,
			{ input: { title, body, scheduled_time: scheduledTime } },
			'xwa2_reminder_set',
		)

	deleteReminder = (reminderId: string): Promise<unknown> =>
		this.mex(IDS.REMINDER_DELETE, { reminder_id: reminderId }, 'xwa2_reminder_delete')
}
