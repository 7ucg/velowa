import type { BinaryNode } from '../../../codec/index.js'
import type { RequestFn } from '../group/groups.js'

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
