import { describe, expect, it } from 'vitest'
import type { BinaryNode } from '../../codec/index.js'
import { MexError, mexFor, mexQuery } from './mex.js'
import { NEWSLETTER_QUERY, Newsletters, parseNewsletter } from './newsletters.js'

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
