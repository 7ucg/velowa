import { describe, expect, it } from 'vitest'
import type { BinaryNode } from '../../../../src/codec/index.js'
import { Business, productNode } from '../../../../src/client/features/business/manage.js'
import { quickReply, toOutgoing } from '../../../../src/client/features/chat/chat-actions.js'

const t = (tag: string, v: string): BinaryNode => ({ tag, attrs: {}, content: Buffer.from(v) })

function fake(reply: BinaryNode = { tag: 'iq', attrs: {} }) {
	const sent: BinaryNode[] = []
	const mexCalls: unknown[][] = []
	const b = new Business(
		async (n) => (sent.push(n), reply),
		(async (...a: unknown[]) => (mexCalls.push(a), {})) as never,
	)
	return { b, sent, mexCalls }
}

describe('business', () => {
	it('builds a product node with only the given fields', () => {
		expect(productNode('p1', { name: 'Tee', price: 1500, isHidden: false })).toEqual({
			tag: 'product',
			attrs: { is_hidden: 'false' },
			content: [t('id', 'p1'), t('name', 'Tee'), t('price', '1500')],
		})
	})

	it('marks a product exempt from origin rules, or names the country', () => {
		expect(productNode(undefined, { originCountryCode: undefined }).attrs).toEqual({
			compliance_category: 'COUNTRY_ORIGIN_EXEMPT',
		})
		expect(productNode(undefined, { originCountryCode: 'DE' }).content).toEqual([
			{ tag: 'compliance_info', attrs: {}, content: [t('country_code_origin', 'DE')] },
		])
	})

	it('creates a product and parses the answer', async () => {
		const { b, sent } = fake({
			tag: 'iq',
			attrs: {},
			content: [
				{
					tag: 'product_catalog_add',
					attrs: {},
					content: [{ tag: 'product', attrs: {}, content: [t('id', 'p9'), t('name', 'Tee')] }],
				},
			],
		})
		const p = await b.createProduct({ name: 'Tee' })
		expect(p).toMatchObject({ id: 'p9', name: 'Tee' })
		expect(sent[0]!.attrs).toMatchObject({ xmlns: 'w:biz:catalog', type: 'set' })
		const op = (sent[0]!.content as BinaryNode[])[0]!
		expect(op.tag).toBe('product_catalog_add')
		expect((op.content as BinaryNode[]).map((c) => c.tag)).toEqual(['product', 'width', 'height'])
	})

	it('deletes products and reads the count', async () => {
		const { b } = fake({
			tag: 'iq',
			attrs: {},
			content: [{ tag: 'product_catalog_delete', attrs: { deleted_count: '2' } }],
		})
		expect(await b.deleteProducts(['a', 'b'])).toEqual({ deleted: 2 })
	})

	it('sends collection changes as GraphQL', async () => {
		const { b, mexCalls } = fake()
		await b.createCollection({ name: 'x' })
		expect(mexCalls[0]).toEqual([
			'29361942130088470',
			{ input: { name: 'x' } },
			'xfb_whatsapp_catalog_create_collection',
		])
	})

	it('sets and removes the cover photo with a profile delta', async () => {
		const { b, sent } = fake()
		await b.setCoverPhoto({ id: '55', token: 'HMAC', timestamp: 1700000000 })
		await b.removeCoverPhoto('55')
		const profile = (i: number) => (sent[i]!.content as BinaryNode[])[0]!
		expect(sent[0]!.attrs).toMatchObject({ xmlns: 'w:biz', type: 'set' })
		expect(profile(0).attrs).toEqual({ v: '3', mutation_type: 'delta' })
		expect(profile(0).content).toEqual([
			{ tag: 'cover_photo', attrs: { op: 'update', id: '55', token: 'HMAC', ts: '1700000000' } },
		])
		expect(profile(1).content).toEqual([{ tag: 'cover_photo', attrs: { op: 'delete', id: '55' } }])
	})

	it('deletes a broadcast list', async () => {
		const { b, sent } = fake()
		await b.deleteBroadcastList('77')
		expect(sent[0]).toMatchObject({
			attrs: { xmlns: 'w:b', type: 'set' },
			content: [{ tag: 'delete', content: [{ tag: 'list', attrs: { id: '77' } }] }],
		})
	})

	it('reads the broadcast quota', async () => {
		const { b } = fake({
			tag: 'iq',
			attrs: {},
			content: [
				{
					tag: 'limits',
					attrs: { messages_left: '5', total_limit: '10', is_heavy_sender: 'true' },
				},
				{ tag: 'timeframe', attrs: { start_ts_s: '1', end_ts_s: '2', reset_ts_s: '3' } },
			],
		})
		expect(await b.broadcastQuota()).toEqual({
			messagesLeft: 5,
			totalLimit: 10,
			isHeavySender: true,
			startTs: 1,
			endTs: 2,
			resetTs: 3,
		})
	})

	it('returns null without limits', async () => {
		expect(await fake().b.broadcastQuota()).toBeNull()
	})

	it('plans a quick reply as app state', () => {
		const p = quickReply({ shortcut: 'hi', message: 'Hello', timestamp: '1700000000' })
		expect(JSON.parse(p.mutation.index)).toEqual(['quick_reply', '1700000000'])
		expect(p.mutation.valueObject).toMatchObject({
			quickReplyAction: { shortcut: 'hi', message: 'Hello', deleted: false },
		})
		expect(toOutgoing(p).value.length).toBeGreaterThan(0)
	})
})
