// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { BinaryNode } from '../../../codec/index.js'
import { parseProduct, type Product } from '../contact/business.js'
import type { RequestFn } from '../group/groups.js'
import type { MexFn } from '../mex.js'

// Running a business account: products, catalog and collections, broadcast lists.

const IDS = {
	CREATE_CATALOG: '29232780583035464',
	CREATE_COLLECTION: '29361942130088470',
	UPDATE_COLLECTION: '24486970300891371',
	DELETE_COLLECTIONS: '29970196299234260',
	APPEAL_PRODUCT: '29276343172013990',
	APPEAL_COLLECTION: '9971242039605207',
}

export interface ProductInput {
	name?: string
	description?: string
	retailerId?: string
	/** Images that are already on WhatsApp's servers (their URL); uploading new ones is not done here. */
	images?: { url: string }[]
	price?: number
	currency?: string
	/** A two-letter country code, or `undefined` with the key present to mark the product exempt. */
	originCountryCode?: string
	isHidden?: boolean
}

const text = (tag: string, v: string): BinaryNode => ({ tag, attrs: {}, content: Buffer.from(v) })
const kids = (n: BinaryNode | undefined, tag: string): BinaryNode[] =>
	n && Array.isArray(n.content) ? n.content.filter((c) => c.tag === tag) : []

/** The `<product>` node of a product: only the fields that are given. */
export function productNode(id: string | undefined, p: ProductInput): BinaryNode {
	const attrs: Record<string, string> = {}
	const content: BinaryNode[] = []
	if (id !== undefined) content.push(text('id', id))
	if (p.name !== undefined) content.push(text('name', p.name))
	if (p.description !== undefined) content.push(text('description', p.description))
	if (p.retailerId !== undefined) content.push(text('retailer_id', p.retailerId))
	if (p.images?.length)
		content.push({
			tag: 'media',
			attrs: {},
			content: p.images.map((img) => ({
				tag: 'image',
				attrs: {},
				content: [text('url', img.url)],
			})),
		})
	if (p.price !== undefined) content.push(text('price', String(p.price)))
	if (p.currency !== undefined) content.push(text('currency', p.currency))
	if ('originCountryCode' in p) {
		if (p.originCountryCode === undefined) attrs['compliance_category'] = 'COUNTRY_ORIGIN_EXEMPT'
		else
			content.push({
				tag: 'compliance_info',
				attrs: {},
				content: [text('country_code_origin', p.originCountryCode)],
			})
	}
	if (p.isHidden !== undefined) attrs['is_hidden'] = String(p.isHidden)
	return { tag: 'product', attrs, content }
}

/** What the cover photo upload answers with and the profile change needs back. */
export interface CoverPhotoUpload {
	id: string
	token: string
	timestamp: number
}

export interface BroadcastQuota {
	messagesLeft: number
	totalLimit: number
	isHeavySender: boolean
	startTs: number
	endTs: number
	resetTs: number
}

export class Business {
	constructor(
		private readonly request: RequestFn,
		private readonly mex: MexFn,
	) {}

	async #edit(
		op: 'product_catalog_add' | 'product_catalog_edit',
		node: BinaryNode,
	): Promise<Product> {
		const res = await this.request({
			tag: 'iq',
			attrs: { to: 's.whatsapp.net', type: 'set', xmlns: 'w:biz:catalog' },
			content: [
				{
					tag: op,
					attrs: { v: '1' },
					content: [node, text('width', '100'), text('height', '100')],
				},
			],
		})
		const product = kids(kids(res, op)[0], 'product')[0]
		if (!product) throw new Error(`${op}: no product in the answer`)
		return parseProduct(product)
	}

	/** Add a product to the catalog. */
	createProduct = (p: ProductInput): Promise<Product> =>
		this.#edit('product_catalog_add', productNode(undefined, { ...p, isHidden: !!p.isHidden }))

	/** Change a product: only the fields you pass are sent. */
	updateProduct = (productId: string, p: ProductInput): Promise<Product> =>
		this.#edit('product_catalog_edit', productNode(productId, p))

	/** Delete products; returns how many the server deleted. */
	async deleteProducts(productIds: string[]): Promise<{ deleted: number }> {
		const res = await this.request({
			tag: 'iq',
			attrs: { to: 's.whatsapp.net', type: 'set', xmlns: 'w:biz:catalog' },
			content: [
				{
					tag: 'product_catalog_delete',
					attrs: { v: '1' },
					content: productIds.map((id) => ({
						tag: 'product',
						attrs: {},
						content: [text('id', id)],
					})),
				},
			],
		})
		return { deleted: +(kids(res, 'product_catalog_delete')[0]?.attrs['deleted_count'] ?? 0) }
	}

	/** Catalog and collection changes go through GraphQL; `input` is the server's input object. */
	createCatalog = (input: unknown): Promise<unknown> =>
		this.mex(IDS.CREATE_CATALOG, { input }, 'xfb_whatsapp_catalog_create')
	createCollection = (input: unknown): Promise<unknown> =>
		this.mex(IDS.CREATE_COLLECTION, { input }, 'xfb_whatsapp_catalog_create_collection')
	updateCollection = (input: unknown): Promise<unknown> =>
		this.mex(IDS.UPDATE_COLLECTION, { input }, 'xfb_whatsapp_catalog_update_collection')
	deleteCollections = (input: unknown): Promise<unknown> =>
		this.mex(IDS.DELETE_COLLECTIONS, { input }, 'xfb_whatsapp_catalog_delete_collections')
	/** Ask WhatsApp to look again at a product or collection it rejected. */
	appealProduct = (input: unknown): Promise<unknown> =>
		this.mex(IDS.APPEAL_PRODUCT, { input }, 'xfb_whatsapp_catalog_appeal_product')
	appealCollection = (input: unknown): Promise<unknown> =>
		this.mex(IDS.APPEAL_COLLECTION, { input }, 'xfb_whatsapp_catalog_appeal_collection')

	async #profileDelta(child: BinaryNode): Promise<void> {
		await this.request({
			tag: 'iq',
			attrs: { to: 's.whatsapp.net', type: 'set', xmlns: 'w:biz' },
			content: [
				{ tag: 'business_profile', attrs: { v: '3', mutation_type: 'delta' }, content: [child] },
			],
		})
	}

	/** Point the profile at an uploaded cover photo (the receipt of \`uploadCoverPhoto\`). */
	setCoverPhoto = (u: CoverPhotoUpload): Promise<void> =>
		this.#profileDelta({
			tag: 'cover_photo',
			attrs: { op: 'update', id: u.id, token: u.token, ts: String(u.timestamp) },
		})

	/** Remove the cover photo with this id (the one \`uploadCoverPhoto\` returned). */
	removeCoverPhoto = (id: string): Promise<void> =>
		this.#profileDelta({ tag: 'cover_photo', attrs: { op: 'delete', id } })

	/** Delete a broadcast list. */
	async deleteBroadcastList(listId: string): Promise<void> {
		await this.request({
			tag: 'iq',
			attrs: { to: 's.whatsapp.net', xmlns: 'w:b', type: 'set' },
			content: [{ tag: 'delete', attrs: {}, content: [{ tag: 'list', attrs: { id: listId } }] }],
		})
	}

	/** How many broadcast messages the business may still send in the current period (null if the server gives no limits). */
	async broadcastQuota(): Promise<BroadcastQuota | null> {
		const res = await this.request({
			tag: 'iq',
			attrs: { xmlns: 'w:biz', to: 's.whatsapp.net', type: 'get' },
			content: [{ tag: 'broadcast_list_quota', attrs: {}, content: [] }],
		})
		const find = (tag: string) =>
			kids(res, tag)[0] ?? kids(kids(res, 'broadcast_list_quota')[0], tag)[0]
		const limits = find('limits')
		const frame = find('timeframe')
		if (!limits) return null
		const num = (n: BinaryNode | undefined, key: string): number => {
			const child = kids(n, key)[0]?.content
			const raw =
				n?.attrs[key] ??
				(typeof child === 'string' ? child : child && Buffer.from(child as Uint8Array).toString())
			return parseInt(raw ?? '0', 10) || 0
		}
		const flag = limits.attrs['is_heavy_sender'] ?? ''
		return {
			messagesLeft: num(limits, 'messages_left'),
			totalLimit: num(limits, 'total_limit'),
			isHeavySender: flag === 'true',
			startTs: num(frame, 'start_ts_s'),
			endTs: num(frame, 'end_ts_s'),
			resetTs: num(frame, 'reset_ts_s'),
		}
	}
}
