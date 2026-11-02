import { describe, expect, it } from 'vitest'
import type { BinaryNode } from '../../../../src/codec/index.js'
import {
	Privacy,
	defaultDisappearingNode,
} from '../../../../src/client/features/contact/privacy.js'

function fake(reply: BinaryNode = { tag: 'iq', attrs: { type: 'result' } }) {
	const sent: BinaryNode[] = []
	const calls: { id: string; variables: unknown; path?: string }[] = []
	const privacy = new Privacy(
		async (n) => (sent.push(n), reply),
		(async (id: string, variables: unknown, path?: string) => (
			calls.push({ id, variables, ...(path && { path }) }),
			{}
		)) as never,
	)
	return { privacy, sent, calls }
}

describe('privacy', () => {
	it('reads and changes settings by feature name', async () => {
		const { privacy, calls } = fake()
		await privacy.settings('1@s.whatsapp.net', ['LAST_SEEN'])
		await privacy.set('LAST_SEEN', 'CONTACTS')
		await privacy.contactList('1@s.whatsapp.net', 'GROUPS', 'CONTACT_BLACKLIST')
		await privacy.setContactList('GROUPS', 'CONTACT_BLACKLIST', ['2@s.whatsapp.net'])
		expect(calls.map((c) => c.path)).toEqual([
			'xwa2_fetch_wa_users',
			'xwa2_privacy_feature_update',
			'xwa2_fetch_wa_users',
			'xwa2_privacy_contact_list_update',
		])
		expect(calls[0]!.variables).toEqual({
			input: {
				query_input: [{ jid: '1@s.whatsapp.net', privacy_features: ['LAST_SEEN'] }],
			},
		})
		expect(calls[3]!.variables).toEqual({
			feature: 'GROUPS',
			setting: 'CONTACT_BLACKLIST',
			contacts: [{ jid: '2@s.whatsapp.net' }],
		})
	})

	it('sets the default disappearing timer with the stanza the app sends', async () => {
		const { privacy, sent } = fake()
		expect(defaultDisappearingNode(86400).attrs).toEqual({
			to: 's.whatsapp.net',
			xmlns: 'disappearing_mode',
			type: 'set',
		})
		await privacy.setDefaultDisappearing(604800)
		expect(sent[0]!.content).toEqual([{ tag: 'disappearing_mode', attrs: { duration: '604800' } }])
	})

	it('reads the blocking status from either place the server puts it', async () => {
		const a = fake({
			tag: 'iq',
			attrs: {},
			content: [{ tag: 'blocking', attrs: { status: 'on' } }],
		})
		const b = fake({
			tag: 'iq',
			attrs: {},
			content: [
				{ tag: 'query', attrs: {}, content: [{ tag: 'blocking', attrs: { status: 'off' } }] },
			],
		})
		expect(await a.privacy.blockingStatus()).toBe('on')
		expect(await b.privacy.blockingStatus()).toBe('off')
		await a.privacy.setBlocking('enable')
		expect(a.sent[1]!.content).toEqual([{ tag: 'blocking', attrs: { action: 'enable' } }])
	})

	it('reads push settings and disclosures', async () => {
		const push = fake({
			tag: 'iq',
			attrs: {},
			content: [{ tag: 'settings', attrs: { sound: '1' } }],
		})
		expect(await push.privacy.pushConfig()).toEqual({ sound: '1' })
		const tos = fake({
			tag: 'iq',
			attrs: {},
			content: [
				{ tag: 'notice', attrs: { id: 'n1' } },
				{ tag: 'notice', attrs: { id: 'n2' } },
			],
		})
		expect(await tos.privacy.disclosures(5)).toEqual([{ id: 'n1' }, { id: 'n2' }])
		expect(tos.sent[0]!.content).toEqual([{ tag: 'get_user_disclosures', attrs: { t: '5' } }])
	})

	it('text status, profile data, online status, reminders', async () => {
		const { privacy, calls } = fake()
		await privacy.setTextStatus('busy', '🔥')
		await privacy.setTextStatus('plain')
		await privacy.textStatusList(['1@s.whatsapp.net'])
		await privacy.setUserStatus('hello')
		await privacy.pictureInfo('1@s.whatsapp.net')
		await privacy.onlineStatus(['1@s.whatsapp.net'])
		await privacy.suggestedContacts()
		await privacy.createReminder('Pay', 'rent', 1893456000)
		await privacy.deleteReminder('r1')
		expect(calls[0]!.variables).toEqual({
			text_status_input: { text: 'busy', emoji: { content: '🔥' } },
		})
		expect(calls[1]!.variables).toEqual({ text_status_input: { text: 'plain' } })
		expect(calls[2]!.variables).toEqual({
			input: [{ jid: '1@s.whatsapp.net', last_update_time: null }],
		})
		expect(calls.slice(3).map((c) => c.path)).toEqual([
			'xwa2_update_user_status',
			'xwa2_fetch_user_picture_info',
			'xwa2_query_online_status',
			'xwa2_suggested_contacts_v2',
			'xwa2_reminder_set',
			'xwa2_reminder_delete',
		])
	})
})
