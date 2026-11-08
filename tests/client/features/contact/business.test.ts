import { describe, expect, it } from 'vitest'
import type { BinaryNode } from '../../../../src/codec/index.js'
import {
	getBusinessProfile,
	getCatalog,
	getCollections,
	getOrder,
	updateBusinessProfile,
} from '../../../../src/client/features/contact/business.js'

const t = (tag: string, v: string): BinaryNode => ({ tag, attrs: {}, content: Buffer.from(v) })
const kids = (n: BinaryNode, tag?: string) =>
	Array.isArray(n.content) ? n.content.filter((c) => !tag || c.tag === tag) : []

describe('business', () => {
	it('reads a business profile with hours and the verified name', async () => {
		const sent: BinaryNode[] = []
		const profile: BinaryNode = {
			tag: 'iq',
			attrs: {},
			content: [
				{
					tag: 'business_profile',
					attrs: {},
					content: [
						{
							tag: 'profile',
							attrs: { jid: 'b@s.whatsapp.net', catalog_exists: 'true', cart_enabled: 'false' },
							content: [
								t('address', 'Hauptstr. 1'),
								t('description', 'Bäckerei'),
								t('website', 'https://example.org'),
								t('email', 'a@b.de'),
								{ tag: 'categories', attrs: {}, content: [t('category', 'Bakery')] },
								{
									tag: 'business_hours',
									attrs: { timezone: 'Europe/Berlin' },
									content: [
										{
											tag: 'business_hours_config',
											attrs: {
												day_of_week: 'mon',
												mode: 'specific_hours',
												open_time: '480',
												close_time: '1020',
											},
										},
									],
								},
							],
						},
					],
				},
			],
		}
		const name: BinaryNode = {
			tag: 'iq',
			attrs: {},
			content: [
				{
					tag: 'verified_name',
					attrs: {},
					content: [
						{
							tag: 'certificate',
							attrs: {},
							content: [{ tag: 'details', attrs: { verified_name: 'Bäckerei GmbH' } }],
						},
					],
				},
			],
		}
		const p = await getBusinessProfile(
			async (n) => (sent.push(n), kids(n)[0]!.tag === 'verified_name' ? name : profile),
			'b@s.whatsapp.net',
		)
		expect(p).toMatchObject({
			jid: 'b@s.whatsapp.net',
			address: 'Hauptstr. 1',
			description: 'Bäckerei',
			website: ['https://example.org'],
			email: 'a@b.de',
			category: 'Bakery',
			catalogExists: true,
			cartEnabled: false,
			verifiedName: 'Bäckerei GmbH',
		})
		expect(p!.businessHours).toEqual({
			timezone: 'Europe/Berlin',
			config: [{ dayOfWeek: 'mon', mode: 'specific_hours', openTime: '480', closeTime: '1020' }],
		})
		expect(sent).toHaveLength(2)
		expect(
			await getBusinessProfile(async () => ({ tag: 'iq', attrs: {} }), 'x@s.whatsapp.net'),
		).toBeNull()
	})

	it('updates only the given fields as a delta', async () => {
		const sent: BinaryNode[] = []
		await updateBusinessProfile(async (n) => (sent.push(n), { tag: 'iq', attrs: {} }), {
			description: 'neu',
			websites: ['https://a'],
			hours: {
				timezone: 'UTC',
				days: [
					{ day: 'mon', mode: 'open_24h' },
					{
						day: 'tue',
						mode: 'specific_hours',
						openTimeInMinutes: '60',
						closeTimeInMinutes: '120',
					},
				],
			},
		})
		const bp = kids(sent[0]!)[0]!
		expect(bp.attrs).toEqual({ v: '3', mutation_type: 'delta' })
		expect(kids(bp).map((c) => c.tag)).toEqual(['description', 'website', 'business_hours'])
		expect(kids(kids(bp, 'business_hours')[0]!).map((c) => c.attrs)).toEqual([
			{ day_of_week: 'mon', mode: 'open_24h' },
			{ day_of_week: 'tue', mode: 'specific_hours', open_time: '60', close_time: '120' },
		])
		await expect(updateBusinessProfile(async () => ({ tag: 'iq', attrs: {} }), {})).rejects.toThrow(
			/nothing/,
		)
	})

	it('reads catalog and collections', async () => {
		const prod = {
			tag: 'product',
			attrs: { is_hidden: 'false' },
			content: [
				t('id', 'P1'),
				t('name', 'Brot'),
				t('price', '250'),
				t('currency', 'EUR'),
				{
					tag: 'media',
					attrs: {},
					content: [
						{ tag: 'image', attrs: {}, content: [t('request_image_url', 'https://img/1')] },
					],
				},
			],
		} as BinaryNode
		const cat = await getCatalog(
			async () => ({
				tag: 'iq',
				attrs: {},
				content: [
					{
						tag: 'product_catalog',
						attrs: {},
						content: [prod, { tag: 'paging', attrs: {}, content: [t('after', 'CUR2')] }],
					},
				],
			}),
			'b@s.whatsapp.net',
			5,
			'CUR1',
		)
		expect(cat.products[0]).toEqual({
			id: 'P1',
			name: 'Brot',
			price: 250,
			currency: 'EUR',
			isHidden: false,
			imageUrls: ['https://img/1'],
		})
		expect(cat.nextPageCursor).toBe('CUR2')
		const cols = await getCollections(
			async () => ({
				tag: 'iq',
				attrs: {},
				content: [
					{
						tag: 'collections',
						attrs: {},
						content: [
							{
								tag: 'collection',
								attrs: {},
								content: [t('id', 'C1'), t('name', 'Backwaren'), prod],
							},
						],
					},
				],
			}),
			'b@s.whatsapp.net',
		)
		expect(cols).toEqual([
			{ id: 'C1', name: 'Backwaren', products: [expect.objectContaining({ id: 'P1' })] },
		])
	})

	it('reads an order’s products and totals, and asks the right query/variables', async () => {
		const calls: { queryId: string; variables: unknown; dataPath?: string }[] = []
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double, shape checked below
		const mex = async (queryId: string, variables: unknown, dataPath?: string): Promise<any> => {
			calls.push({ queryId, variables, dataPath })
			return {
				order: {
					creation_time_stamp: '1700000000',
					price_details: { currency: 'EUR', subtotal_amount: '12500', total_amount: '13500' },
					products: [
						{
							id: 'P1',
							name: 'Brot',
							currency: 'EUR',
							price: '2500',
							quantity: '5',
							media: { images: [{ id: 'I1', request_image_url: 'https://x/1.jpg' }] },
							variant_info: { variant_properties: [{ name: 'Size', value: 'Large' }] },
						},
					],
				},
			}
		}
		const order = await getOrder(mex, 'b@s.whatsapp.net', 'O1', 'tok123')
		expect(calls).toEqual([
			{
				queryId: '26593811266898374',
				variables: {
					request: {
						order: {
							id: 'O1',
							jid: 'b@s.whatsapp.net',
							token: { sensitive_string_value: 'tok123' },
							image_dimensions: { width: 100, height: 100 },
						},
					},
				},
				dataPath: 'xwa_checkout_get_order_info',
			},
		])
		expect(order).toEqual({
			products: [
				{
					id: 'P1',
					name: 'Brot',
					price: { amount1000: 2500, currency: 'EUR' },
					quantity: 5,
					imageUrls: ['https://x/1.jpg'],
					variantProperties: [{ name: 'Size', value: 'Large' }],
				},
			],
			priceDetails: {
				subtotal: { amount1000: 12500, currency: 'EUR' },
				total: { amount1000: 13500, currency: 'EUR' },
			},
			creationTimestamp: 1700000000,
		})
	})

	it('throws when the order query comes back without an order', async () => {
		await expect(getOrder(async () => ({}), 'b@s.whatsapp.net', 'O1', 'tok')).rejects.toThrow(
			/no order/,
		)
	})
})
