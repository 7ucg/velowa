import { describe, expect, it } from 'vitest'
import { Events, WwwClient, WwwError } from '../../../../src/client/features/event/events.js'

function setup(statuses: number[] = [200]) {
	const mexCalls: { id: string; vars: unknown; path?: string }[] = []
	const posts: { url: string; body: Record<string, unknown> }[] = []
	let n = 0
	const mex = (async (id: string, vars: unknown, path?: string) => {
		mexCalls.push({ id, vars, ...(path && { path }) })
		return path?.includes('nonce_for') ? { access_token: `tok${++n}` } : { nonce: 'nn' }
	}) as never
	let i = 0
	const www = new WwwClient(mex, async (url, init) => {
		posts.push({ url, body: JSON.parse(init.body) })
		const status = statuses[Math.min(i++, statuses.length - 1)]!
		return {
			ok: status === 200,
			status,
			json: async () => ({ data: { xwa2_get_event: { id: 'e1' }, xwa2_list_events: [] } }),
		}
	})
	return { www, mexCalls, posts, events: new Events(www) }
}

describe('events', () => {
	it('gets a token through nonce and exchange, then posts the query', async () => {
		const { events, mexCalls, posts } = setup()
		expect(await events.get('e1')).toEqual({ id: 'e1' })
		expect(mexCalls.map((c) => c.path)).toEqual([
			'xwa2_ent_get_canonical_ent_device_nonce',
			'xwa2_www_exchange_nonce_for_access_token',
		])
		expect(mexCalls[1]!.vars).toEqual({ nonce: 'nn' })
		expect(posts[0]).toMatchObject({
			url: 'https://graph.whatsapp.com/graphql',
			body: {
				access_token: 'tok1',
				doc_id: '26814174831581200',
				variables: { event_id: 'e1' },
				lang: 'en',
			},
		})
	})

	it('keeps the token for the next query', async () => {
		const { events, mexCalls } = setup()
		await events.get('e1')
		await events.list()
		expect(mexCalls).toHaveLength(2)
	})

	it('asks for a new token once when the server refuses the old one', async () => {
		const { events, posts } = setup([401, 200])
		await events.get('e1')
		expect(posts.map((p) => p.body['access_token'])).toEqual(['tok1', 'tok2'])
	})

	it('throws a WwwError on an HTTP failure', async () => {
		const { events } = setup([500])
		await expect(events.get('e1')).rejects.toBeInstanceOf(WwwError)
	})

	it('sends the right variables for rsvp and invitations', async () => {
		const { events, posts } = setup()
		await events.get('e1').catch(() => {})
		await events.rsvp('e1', 'GOING').catch(() => {})
		await events.invite('e1', ['a@s.whatsapp.net']).catch(() => {})
		expect(posts[1]!.body['variables']).toEqual({ event_id: 'e1', rsvp: 'GOING' })
		expect(posts[2]!.body['variables']).toEqual({ event_id: 'e1', jids: ['a@s.whatsapp.net'] })
	})
})

describe('events safety', () => {
	it('pins the event id after the caller’s updates', async () => {
		const { events, posts } = setup()
		await events.update('e1', { event_id: 'other', name: 'x' }).catch(() => {})
		expect(posts[0]!.body['variables']).toEqual({ event_id: 'e1', name: 'x' })
	})

	it('asks for a new token after invalidate()', async () => {
		const { events, www, mexCalls } = setup()
		await events.get('e1')
		www.invalidate()
		await events.get('e1')
		expect(mexCalls).toHaveLength(4)
	})
})
