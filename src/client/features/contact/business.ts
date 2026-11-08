// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { BinaryNode } from '../../../codec/index.js'
import type { RequestFn } from '../group/groups.js'
import type { MexFn } from '../mex.js'

const kids = (n: BinaryNode | undefined, tag?: string): BinaryNode[] =>
	n && Array.isArray(n.content) ? n.content.filter((c) => tag === undefined || c.tag === tag) : []
const text = (n: BinaryNode | undefined): string | undefined =>
	!n
		? undefined
		: typeof n.content === 'string'
			? n.content
			: n.content instanceof Uint8Array
				? Buffer.from(n.content).toString('utf8')
				: undefined
const childText = (n: BinaryNode | undefined, tag: string) => text(kids(n, tag)[0])
const bool = (v: string | undefined): boolean | undefined =>
	v === undefined ? undefined : v === 'true'

export interface BusinessProfile {
	jid?: string
	address?: string
	description: string
	website: string[]
	email?: string
	category?: string
	businessHours?: {
		timezone?: string
		config: { dayOfWeek?: string; mode?: string; openTime?: string; closeTime?: string }[]
	}
	catalogExists: boolean
	cartEnabled?: boolean
	verifiedName?: string
}

/** Public business profile of an account (null when it is not a business). */
export async function getBusinessProfile(
	request: RequestFn,
	jid: string,
): Promise<BusinessProfile | null> {
	const [profileRes, nameRes] = await Promise.all([
		request({
			tag: 'iq',
			attrs: { to: 's.whatsapp.net', xmlns: 'w:biz', type: 'get' },
			content: [
				{
					tag: 'business_profile',
					attrs: { v: '116' },
					content: [{ tag: 'profile', attrs: { jid } }],
				},
			],
		}),
		request({
			tag: 'iq',
			attrs: { to: 's.whatsapp.net', xmlns: 'w:biz', type: 'get' },
			content: [{ tag: 'verified_name', attrs: { jid } }],
		}).catch(() => undefined),
	])
	const p = kids(kids(profileRes, 'business_profile')[0], 'profile')[0]
	if (!p) return null
	const hours = kids(p, 'business_hours')[0]
	const cert = kids(kids(nameRes ?? { tag: 'iq', attrs: {} }, 'verified_name')[0], 'certificate')[0]
	const verifiedName = cert
		? (kids(cert, 'details')[0]?.attrs['verified_name'] ?? text(kids(cert, 'details')[0]))
		: undefined
	const site = childText(p, 'website')
	return {
		...(p.attrs['jid'] && { jid: p.attrs['jid'] }),
		...(childText(p, 'address') !== undefined && { address: childText(p, 'address')! }),
		description: childText(p, 'description') ?? '',
		website: site ? [site] : [],
		...(childText(p, 'email') !== undefined && { email: childText(p, 'email')! }),
		...(text(kids(kids(p, 'categories')[0], 'category')[0]) !== undefined && {
			category: text(kids(kids(p, 'categories')[0], 'category')[0])!,
		}),
		...(hours && {
			businessHours: {
				...(hours.attrs['timezone'] && { timezone: hours.attrs['timezone'] }),
				config: kids(hours, 'business_hours_config').map((c) => ({
					...(c.attrs['day_of_week'] && { dayOfWeek: c.attrs['day_of_week'] }),
					...(c.attrs['mode'] && { mode: c.attrs['mode'] }),
					...(c.attrs['open_time'] && { openTime: c.attrs['open_time'] }),
					...(c.attrs['close_time'] && { closeTime: c.attrs['close_time'] }),
				})),
			},
		}),
		catalogExists: p.attrs['catalog_exists'] === 'true',
		...(bool(p.attrs['cart_enabled']) !== undefined && {
			cartEnabled: bool(p.attrs['cart_enabled'])!,
		}),
		...(verifiedName && { verifiedName }),
	}
}

export interface BusinessProfileUpdate {
	address?: string
	email?: string
	description?: string
	websites?: string[]
	hours?: {
		timezone: string
		days: {
			day: string
			mode: 'open_24h' | 'appointment_only' | 'specific_hours' | 'closed'
			openTimeInMinutes?: string
			closeTimeInMinutes?: string
		}[]
	}
}

/** Change fields of our own business profile (delta update: only what is given). */
export async function updateBusinessProfile(
	request: RequestFn,
	u: BusinessProfileUpdate,
): Promise<BinaryNode> {
	const content: BinaryNode[] = []
	for (const key of ['address', 'email', 'description'] as const) {
		if (u[key] !== undefined) content.push({ tag: key, attrs: {}, content: u[key]! })
	}
	for (const w of u.websites ?? []) content.push({ tag: 'website', attrs: {}, content: w })
	if (u.hours) {
		content.push({
			tag: 'business_hours',
			attrs: { timezone: u.hours.timezone },
			content: u.hours.days.map((d) => ({
				tag: 'business_hours_config',
				attrs: {
					day_of_week: d.day,
					mode: d.mode,
					...(d.mode === 'specific_hours' && {
						open_time: d.openTimeInMinutes ?? '0',
						close_time: d.closeTimeInMinutes ?? '0',
					}),
				},
			})),
		})
	}
	if (!content.length) throw new Error('nothing to update')
	return request({
		tag: 'iq',
		attrs: { to: 's.whatsapp.net', type: 'set', xmlns: 'w:biz' },
		content: [{ tag: 'business_profile', attrs: { v: '3', mutation_type: 'delta' }, content }],
	})
}

export interface Product {
	id?: string
	name?: string
	retailerId?: string
	url?: string
	description?: string
	price?: number
	currency?: string
	isHidden: boolean
	imageUrls: string[]
}

export function parseProduct(n: BinaryNode): Product {
	const media = kids(n, 'media')[0]
	const price = childText(n, 'price')
	return {
		...(childText(n, 'id') !== undefined && { id: childText(n, 'id')! }),
		...(childText(n, 'name') !== undefined && { name: childText(n, 'name')! }),
		...(childText(n, 'retailer_id') !== undefined && { retailerId: childText(n, 'retailer_id')! }),
		...(childText(n, 'url') !== undefined && { url: childText(n, 'url')! }),
		...(childText(n, 'description') !== undefined && { description: childText(n, 'description')! }),
		...(price !== undefined && !Number.isNaN(+price) && { price: +price }),
		...(childText(n, 'currency') !== undefined && { currency: childText(n, 'currency')! }),
		isHidden: n.attrs['is_hidden'] === 'true',
		imageUrls: kids(media, 'image')
			.map((i) => childText(i, 'request_image_url') ?? '')
			.filter(Boolean),
	}
}

const sized = (tag: string, v: string): BinaryNode => ({ tag, attrs: {}, content: Buffer.from(v) })

/** A business' product catalog, paged with `cursor`. */
export async function getCatalog(
	request: RequestFn,
	jid: string,
	limit = 10,
	cursor?: string,
): Promise<{ products: Product[]; nextPageCursor?: string }> {
	const res = await request({
		tag: 'iq',
		attrs: { to: 's.whatsapp.net', type: 'get', xmlns: 'w:biz:catalog' },
		content: [
			{
				tag: 'product_catalog',
				attrs: { jid, allow_shop_source: 'true' },
				content: [
					sized('limit', String(limit)),
					sized('width', '100'),
					sized('height', '100'),
					...(cursor ? [{ tag: 'after', attrs: {}, content: cursor }] : []),
				],
			},
		],
	})
	const cat = kids(res, 'product_catalog')[0]
	const after = childText(kids(cat, 'paging')[0], 'after')
	return {
		products: kids(cat, 'product').map(parseProduct),
		...(after && { nextPageCursor: after }),
	}
}

export async function getCollections(
	request: RequestFn,
	jid: string,
	limit = 51,
): Promise<{ id?: string; name?: string; products: Product[] }[]> {
	const res = await request({
		tag: 'iq',
		attrs: { to: 's.whatsapp.net', type: 'get', xmlns: 'w:biz:catalog', smax_id: '35' },
		content: [
			{
				tag: 'collections',
				attrs: { biz_jid: jid },
				content: [
					sized('collection_limit', String(limit)),
					sized('item_limit', String(limit)),
					sized('width', '100'),
					sized('height', '100'),
				],
			},
		],
	})
	return kids(kids(res, 'collections')[0], 'collection').map((c) => ({
		...(childText(c, 'id') !== undefined && { id: childText(c, 'id')! }),
		...(childText(c, 'name') !== undefined && { name: childText(c, 'name')! }),
		products: kids(c, 'product').map(parseProduct),
	}))
}

// ---- orders -----------------------------------------------------------------------------------

export interface OrderProduct {
	id?: string
	name?: string
	/** Amount in thousandths of the currency unit (as WhatsApp sends it), and its ISO 4217 code. */
	price?: { amount1000: number; currency: string }
	quantity?: number
	imageUrls: string[]
	/** The variant the customer chose (size, colour, ...); empty for a product with no variants. */
	variantProperties: { name?: string; value?: string }[]
}

export interface Order {
	products: OrderProduct[]
	priceDetails?: {
		subtotal?: { amount1000: number; currency: string }
		total?: { amount1000: number; currency: string }
	}
	/** Unix seconds, as sent. */
	creationTimestamp?: number
}

const amount = (
	value: unknown,
	currency: string | undefined,
): { amount1000: number; currency: string } | undefined => {
	const n =
		typeof value === 'number'
			? value
			: typeof value === 'string' && value !== ''
				? Number(value)
				: NaN
	return Number.isFinite(n) && currency ? { amount1000: n, currency } : undefined
}

/**
 * Read a placed order's line items and totals. `orderId` and `token` come from the `orderMessage` the
 * customer's "Review and pay" tap sent (`OrderMessage.orderId`/`.token`); the token is a per-order
 * capability, so an order cannot be read without that message. `jid` is the business it was placed with
 * (`OrderMessage.sellerJid`).
 */
export async function getOrder(
	mex: MexFn,
	jid: string,
	orderId: string,
	token: string,
): Promise<Order> {
	const data = await mex<{
		order?: {
			creation_time_stamp?: string
			price_details?: { currency?: string; subtotal_amount?: unknown; total_amount?: unknown }
			products?: {
				id?: string
				name?: string
				currency?: string
				price?: unknown
				quantity?: string
				media?: { images?: { id?: string; request_image_url?: string }[] }
				variant_info?: { variant_properties?: { name?: string; value?: string }[] }
			}[]
		}
	}>(
		'26593811266898374',
		{
			request: {
				order: {
					id: orderId,
					jid,
					token: { sensitive_string_value: token },
					image_dimensions: { width: 100, height: 100 },
				},
			},
		},
		'xwa_checkout_get_order_info',
	)
	const order = data.order
	if (!order) throw new Error('order query returned no order')
	const details = order.price_details
	return {
		products: (order.products ?? []).map((p) => ({
			...(p.id !== undefined && { id: p.id }),
			...(p.name !== undefined && { name: p.name }),
			...(amount(p.price, p.currency) && { price: amount(p.price, p.currency) }),
			...(p.quantity !== undefined && !Number.isNaN(+p.quantity) && { quantity: +p.quantity }),
			imageUrls: (p.media?.images ?? []).map((i) => i.request_image_url ?? '').filter(Boolean),
			variantProperties: p.variant_info?.variant_properties ?? [],
		})),
		...(details && {
			priceDetails: {
				...(amount(details.subtotal_amount, details.currency) && {
					subtotal: amount(details.subtotal_amount, details.currency),
				}),
				...(amount(details.total_amount, details.currency) && {
					total: amount(details.total_amount, details.currency),
				}),
			},
		}),
		...(order.creation_time_stamp !== undefined && {
			creationTimestamp: Number(order.creation_time_stamp),
		}),
	}
}
