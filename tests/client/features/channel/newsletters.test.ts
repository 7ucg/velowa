import { describe, expect, it } from 'vitest'
import type { BinaryNode } from '../../../../src/codec/index.js'
import { MexError, mexFor, mexQuery } from '../../../../src/client/features/mex.js'
import {
	NEWSLETTER_QUERY,
	Newsletters,
	parseChannelStatus,
	parseNewsletter,
	parseNewsletterLiveUpdate,
} from '../../../../src/client/features/channel/newsletters.js'

const mexReply = (obj: unknown): BinaryNode => ({
	tag: 'iq',
	attrs: { type: 'result' },
	content: [{ tag: 'result', attrs: {}, content: Buffer.from(JSON.stringify(obj)) }],
})

describe('w:mex', () => {
	it('sends variables as JSON and returns the data path', async () => {
		const sent: BinaryNode[] = []
		const out = await mexQuery(
			async (n) => (sent.push(n), mexReply({ data: { xwa2_x: { ok: 1 } } })),
			'id1',
			'Q1',
			{ a: 1 },
			'xwa2_x',
		)
		expect(out).toEqual({ ok: 1 })
		expect(sent[0]!.attrs).toEqual({ id: 'id1', type: 'get', to: 's.whatsapp.net', xmlns: 'w:mex' })
		const q = (sent[0]!.content as BinaryNode[])[0]!
		expect(q.attrs).toEqual({ query_id: 'Q1' })
		expect(JSON.parse(Buffer.from(q.content as Uint8Array).toString())).toEqual({
			variables: { a: 1 },
		})
	})

	it('turns GraphQL errors and malformed answers into MexError', async () => {
		await expect(
			mexQuery(
				async () =>
					mexReply({ errors: [{ message: 'stale id', extensions: { error_code: 404 } }] }),
				'i',
				'Q',
				{},
			),
		).rejects.toMatchObject({ name: 'MexError', code: 404 })
		await expect(
			mexQuery(async () => mexReply({ data: {} }), 'i', 'Q', {}, 'missing'),
		).rejects.toBeInstanceOf(MexError)
		await expect(
			mexQuery(async () => ({ tag: 'iq', attrs: {} }), 'i', 'Q', {}),
		).rejects.toBeInstanceOf(MexError)
	})
})

describe('newsletters', () => {
	const raw = {
		id: '1203630000@newsletter',
		thread_metadata: {
			name: { text: 'News' },
			description: { text: 'Beschreibung' },
			invite: 'ABC',
			creation_time: '1700000000',
			subscribers_count: '42',
			verification: 'VERIFIED',
			picture: { direct_path: '/v/x' },
			state: 'active',
		},
		viewer_metadata: { mute: 'ON', role: 'subscriber' },
	}

	it('flattens the nested metadata', () => {
		expect(parseNewsletter({ result: raw })).toEqual({
			id: '1203630000@newsletter',
			name: 'News',
			description: 'Beschreibung',
			invite: 'ABC',
			creationTime: 1700000000,
			subscribers: 42,
			verification: 'VERIFIED',
			pictureDirectPath: '/v/x',
			muted: true,
			role: 'SUBSCRIBER',
			state: 'ACTIVE',
		})
		expect(parseNewsletter({ id: 'x@newsletter' })).toMatchObject({
			role: 'GUEST',
			state: 'UNKNOWN',
		})
		expect(() => parseNewsletter(null)).toThrow()
	})

	it('maps operations to the right query ids, variables and data paths', async () => {
		const calls: { id: string; vars: unknown; path?: string | undefined }[] = []
		const n = new Newsletters(
			async (id, vars, path) =>
				(calls.push({ id, vars, path }),
				id === NEWSLETTER_QUERY.METADATA ? raw : { ok: true }) as never,
			async () => ({ tag: 'iq', attrs: {} }),
			() => 'mid',
		)
		await n.metadata('invite', 'ABC')
		await n.follow('j@newsletter')
		await n.update('j@newsletter', { name: 'Neu' })
		expect(calls[0]).toMatchObject({
			id: NEWSLETTER_QUERY.METADATA,
			path: 'xwa2_newsletter',
			vars: { input: { key: 'ABC', type: 'INVITE' } },
		})
		expect(calls[1]).toMatchObject({
			id: NEWSLETTER_QUERY.FOLLOW,
			path: 'xwa2_newsletter_join_v2',
			vars: { newsletter_id: 'j@newsletter' },
		})
		expect(calls[2]!.vars).toEqual({
			newsletter_id: 'j@newsletter',
			updates: { name: 'Neu', settings: null },
		})
	})

	it('reacts and fetches posts with the expected stanzas', async () => {
		const sent: BinaryNode[] = []
		const n = new Newsletters(
			mexFor(
				async () => mexReply({}),
				() => 'x',
			),
			async (s) => (sent.push(s), { tag: 'iq', attrs: {} }),
			() => 'mid',
		)
		await n.react('j@newsletter', '77', '👍')
		await n.react('j@newsletter', '77', '')
		await n.fetchMessages('j@newsletter', 10, { since: 5 })
		expect(sent[0]).toMatchObject({
			tag: 'message',
			attrs: { to: 'j@newsletter', type: 'reaction', server_id: '77', id: 'mid' },
			content: [{ tag: 'reaction', attrs: { code: '👍' } }],
		})
		expect(sent[1]!.attrs['edit']).toBe('7')
		expect(sent[2]).toMatchObject({
			attrs: { xmlns: 'newsletter', to: 'j@newsletter', type: 'get' },
			content: [{ tag: 'message_updates', attrs: { count: '10', since: '5' } }],
		})
	})
})

describe('post labels', () => {
	it('sends the AI-content and paid-partnership mutations', async () => {
		const calls: unknown[][] = []
		const n = new Newsletters(
			(async (...a: unknown[]) => (calls.push(a), {})) as never,
			(async () => ({ tag: 'iq', attrs: {} })) as never,
			() => 'id',
		)
		await n.labelAiContent('1@newsletter', 418)
		await n.labelPaidPartnership('1@newsletter', '418')
		expect(calls).toEqual([
			[
				'27909718265289596',
				{ newsletter_id: '1@newsletter', server_id: '418', message_type: 'MESSAGE' },
				'xwa2_newsletter_label_ai_content',
			],
			[
				'26102375079404865',
				{ newsletter_id: '1@newsletter', server_id: '418', message_type: 'MESSAGE' },
				'xwa2_newsletter_label_paid_partnership',
			],
		])
	})
})

describe('channel status', () => {
	const decode = (b: Uint8Array) => ({ len: b.length })
	it('parses a reaction and a media status', () => {
		expect(
			parseChannelStatus(
				{
					tag: 'status',
					attrs: {
						from: '1@newsletter',
						type: 'reaction',
						id: 'A',
						t: '10',
						is_sender: 'true',
						server_id: '174',
					},
					content: [{ tag: 'reaction', attrs: { code: '💚' } }],
				},
				decode,
			),
		).toEqual({
			channel: '1@newsletter',
			id: 'A',
			serverId: 174,
			timestamp: 10,
			fromMe: true,
			type: 'reaction',
			reaction: '💚',
		})
		const m = parseChannelStatus(
			{
				tag: 'status',
				attrs: { from: '1@newsletter', type: 'media', id: 'B' },
				content: [{ tag: 'plaintext', attrs: { mediatype: 'image' }, content: new Uint8Array(3) }],
			},
			decode,
		)
		expect(m).toMatchObject({
			type: 'media',
			mediaType: 'image',
			message: { len: 3 },
			fromMe: false,
		})
		expect(
			parseChannelStatus({ tag: 'status', attrs: { from: 'x@g.us', id: 'C' } }, decode),
		).toBeUndefined()
	})
})

describe('newsletter live updates', () => {
	it('parses forwards, reactions and poll votes for each changed message', () => {
		const voteHash = Buffer.alloc(32, 7)
		const result = parseNewsletterLiveUpdate({
			tag: 'notification',
			attrs: { type: 'newsletter', from: '1@newsletter' },
			content: [
				{
					tag: 'live_updates',
					attrs: {},
					content: [
						{
							tag: 'messages',
							attrs: {},
							content: [
								{
									tag: 'message',
									attrs: { server_id: '42' },
									content: [
										{ tag: 'forwards_count', attrs: { count: '12' } },
										{
											tag: 'reactions',
											attrs: {},
											content: [{ tag: 'reaction', attrs: { code: '👍', count: '3' } }],
										},
										{
											tag: 'votes',
											attrs: {},
											content: [{ tag: 'vote', attrs: { count: '7' }, content: voteHash }],
										},
									],
								},
							],
						},
					],
				},
			],
		})
		expect(result).toEqual({
			newsletter: '1@newsletter',
			messages: [
				{
					serverId: 42,
					forwardsCount: 12,
					reactions: [{ code: '👍', count: 3 }],
					votes: [{ optionHash: voteHash.toString('hex'), count: 7 }],
				},
			],
		})
	})

	it('is undefined without from, without live_updates, or with no messages', () => {
		expect(parseNewsletterLiveUpdate({ tag: 'notification', attrs: {} })).toBeUndefined()
		expect(
			parseNewsletterLiveUpdate({ tag: 'notification', attrs: { from: '1@newsletter' } }),
		).toBeUndefined()
	})
})

describe('Newsletters: admins, posts, discovery', () => {
	function fake(answer: BinaryNode = { tag: 'iq', attrs: { type: 'result' } }) {
		const sent: BinaryNode[] = []
		const gql: { id: string; variables: unknown; path?: string }[] = []
		const n = new Newsletters(
			(async (id: string, variables: unknown, path?: string) => (
				gql.push({ id, variables, ...(path && { path }) }),
				path === 'xwa2_newsletter_admin' ? { admin_count: 3, capabilities: ['PIN'] } : {}
			)) as never,
			async (node) => (sent.push(node), answer),
			() => 'ID',
		)
		return { n, sent, gql }
	}
	const body = (n: BinaryNode) => (Array.isArray(n.content) ? n.content : [])

	it('manages admins: a stanza to promote, GraphQL for the rest', async () => {
		const { n, sent, gql } = fake()
		await n.promoteAdmin('c@newsletter', '1@lid')
		await n.demoteAdmin('c@newsletter', '1@lid')
		await n.inviteAdmin('c@newsletter', '2@lid')
		await n.acceptAdminInvite('c@newsletter')
		await n.revokeAdminInvite('c@newsletter', '2@lid')
		await n.changeOwner('c@newsletter', '3@lid')
		expect(sent[0]!.attrs).toMatchObject({ xmlns: 'newsletter', type: 'set', to: 'c@newsletter' })
		expect(body(sent[0]!)[0]).toEqual({
			tag: 'admin_promote',
			attrs: {},
			content: [{ tag: 'participant', attrs: { jid: '1@lid' } }],
		})
		expect(gql.map((c) => c.path)).toEqual([
			'xwa2_newsletter_admin_demote',
			'xwa2_newsletter_admin_invite_create',
			'xwa2_newsletter_admin_invite_accept',
			'xwa2_newsletter_admin_invite_revoke',
			'xwa2_newsletter_change_owner',
		])
		expect(gql[0]!.variables).toEqual({ newsletter_id: 'c@newsletter', user_id: '1@lid' })
	})

	it('reads the admin count and capabilities out of the answer', async () => {
		const { n } = fake()
		expect(await n.adminCount('c@newsletter')).toBe(3)
		expect(await n.adminCapabilities('c@newsletter')).toEqual(['PIN'])
	})

	it('pins, unpins, deletes and counts views of posts with the stanzas the app uses', async () => {
		const { n, sent } = fake()
		await n.pinMessage('c@newsletter', 17, 3600)
		await n.unpinMessage('c@newsletter', 17)
		await n.revokeMessage('c@newsletter', 17)
		await n.sendViewReceipt('c@newsletter', [17, '18'])
		expect(body(sent[0]!)).toEqual([{ tag: 'pin', attrs: { server_id: '17', duration: '3600' } }])
		expect(body(sent[1]!)).toEqual([{ tag: 'unpin', attrs: { server_id: '17' } }])
		expect(sent[2]!.attrs).toMatchObject({
			to: 'c@newsletter',
			type: 'text',
			edit: '7',
			server_id: '17',
		})
		expect(sent[3]!.attrs).toMatchObject({ type: 'view', to: 'c@newsletter' })
		expect(body(body(sent[3]!)[0]!)).toEqual([
			{ tag: 'item', attrs: { server_id: '17' } },
			{ tag: 'item', attrs: { server_id: '18' } },
		])
	})

	it('finds the number of a post by its message id', async () => {
		const { n } = fake({
			tag: 'iq',
			attrs: {},
			content: [
				{
					tag: 'message_updates',
					attrs: {},
					content: [{ tag: 'message', attrs: { message_id: 'M1', server_id: '42' } }],
				},
			],
		})
		expect(await n.serverIdOf('c@newsletter', 'M1')).toBe(42)
		expect(await n.serverIdOf('c@newsletter', 'nope')).toBeNull()
	})

	it('sets a picture only from a JPEG and changes the category', async () => {
		const { n, gql } = fake()
		await n.setPicture('c@newsletter', Uint8Array.from([0xff, 0xd8, 9]))
		await n.setCategory('c@newsletter', 'SPORTS')
		await n.removePicture('c@newsletter')
		expect(() => n.setPicture('c@newsletter', Uint8Array.from([1, 2]))).toThrow(/JPEG/)
		expect(gql[0]!.variables).toEqual({
			newsletter_id: 'c@newsletter',
			updates: { picture: '/9gJ', settings: null },
		})
		expect(gql[1]!.variables).toEqual({
			newsletter_id: 'c@newsletter',
			updates: { topic: 'SPORTS', settings: null },
		})
		expect(gql[2]!.variables).toMatchObject({ updates: { picture: '' } })
	})

	it('searches, lists the directory, recommends and finds similar channels', async () => {
		const { n, gql } = fake()
		await n.search('news', 5)
		await n.directoryList({ categories: ['MUSIC'] })
		await n.directorySearch('rock', { categories: ['MUSIC'] })
		await n.recommended()
		await n.similar('c@newsletter')
		await n.following()
		expect(gql.map((c) => c.path)).toEqual([
			'xwa2_newsletters_directory_search',
			'xwa2_newsletters_directory_list',
			'xwa2_newsletters_directory_search',
			'xwa2_newsletters_recommended',
			'xwa2_newsletters_similar',
			'xwa2_newsletter_following',
		])
		expect(gql[0]!.variables).toEqual({
			input: { search_text: 'news', categories: [], limit: 5 },
			fetch_status_metadata: false,
		})
		expect(gql[1]!.variables).toEqual({
			input: {
				view: 'RECOMMENDED',
				filters: { country_codes: ['US'], categories: ['MUSIC'] },
				limit: 20,
			},
			fetch_status_metadata: false,
		})
		expect(gql[2]!.variables).toEqual({
			input: { search_text: 'rock', categories: ['MUSIC'], limit: 20 },
			fetch_status_metadata: false,
		})
	})

	it('has the poll voters, reaction senders, insights and reports', async () => {
		const { n, gql } = fake()
		await n.pollVoters('c@newsletter', '17')
		await n.reactionSenders('c@newsletter', '17')
		await n.insights('c@newsletter', 'LAST_7_DAYS')
		await n.userReports('c@newsletter')
		expect(gql[0]!.variables).toEqual({
			input: { newsletter_id: 'c@newsletter', server_id: '17', limit: 20 },
		})
		expect(gql[1]!.variables).toEqual({ input: { id: 'c@newsletter', server_id: '17' } })
		expect(gql.slice(2).map((c) => c.path)).toEqual([
			'xwa2_newsletter_admin_insights',
			'xwa2_newsletter_user_reports',
		])
	})
})
