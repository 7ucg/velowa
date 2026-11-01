import type { BinaryNode } from '../../codec/index.js'
import type { RequestFn } from './groups.js'

export class MexError extends Error {
	constructor(
		message: string,
		readonly code: number,
		readonly detail?: unknown,
	) {
		super(message)
		this.name = 'MexError'
	}
}

/**
 * WhatsApp's GraphQL-over-stanza channel (`w:mex`): `{ variables }` goes in as JSON, the answer comes back
 * as JSON under `data[dataPath]`. Query ids are tied to the WhatsApp Web build and may go stale.
 */
export async function mexQuery<T = unknown>(
	request: RequestFn,
	id: string,
	queryId: string,
	variables: unknown,
	dataPath?: string,
): Promise<T> {
	const res = await request({
		tag: 'iq',
		attrs: { id, type: 'get', to: 's.whatsapp.net', xmlns: 'w:mex' },
		content: [
			{
				tag: 'query',
				attrs: { query_id: queryId },
				content: Buffer.from(JSON.stringify({ variables }), 'utf8'),
			},
		],
	})
	const result = Array.isArray(res.content)
		? res.content.find((c) => c.tag === 'result')
		: undefined
	const raw = result?.content
	if (!raw) throw new MexError('empty w:mex response', 400, res)
	const text = typeof raw === 'string' ? raw : Buffer.from(raw as Uint8Array).toString('utf8')
	const data = JSON.parse(text) as {
		data?: Record<string, unknown>
		errors?: { message?: string; extensions?: { error_code?: number } }[]
	}
	if (data.errors?.length) {
		const first = data.errors[0]!
		throw new MexError(
			`GraphQL server error: ${data.errors.map((e) => e.message ?? 'unknown').join(', ')}`,
			first.extensions?.error_code ?? 400,
			first,
		)
	}
	const out = dataPath ? data.data?.[dataPath] : data.data
	if (out === undefined)
		throw new MexError(`unexpected w:mex response${dataPath ? ` (no ${dataPath})` : ''}`, 400, data)
	return out as T
}

export type MexFn = <T = unknown>(
	queryId: string,
	variables: unknown,
	dataPath?: string,
) => Promise<T>

export const mexFor =
	(request: RequestFn, nextId: () => string): MexFn =>
	(queryId, variables, dataPath) =>
		mexQuery(request, nextId(), queryId, variables, dataPath)

export const nodeText = (n: BinaryNode | undefined): string | undefined =>
	!n
		? undefined
		: typeof n.content === 'string'
			? n.content
			: n.content instanceof Uint8Array
				? Buffer.from(n.content).toString('utf8')
				: undefined
