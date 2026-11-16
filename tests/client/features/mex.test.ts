import { describe, expect, it } from 'vitest'
import type { BinaryNode } from '../../../src/codec/index.js'
import { MexError, mexQuery } from '../../../src/client/features/mex.js'

const fake = (result: string) => ({
	request: async (): Promise<BinaryNode> => ({
		tag: 'iq',
		attrs: { type: 'result' },
		content: [{ tag: 'result', attrs: {}, content: Buffer.from(result, 'utf8') }],
	}),
})

describe('mexQuery', () => {
	it('reads data at dataPath and surfaces GraphQL errors', async () => {
		const f = fake(JSON.stringify({ data: { xyz_thing: { ok: true } } }))
		expect(await mexQuery(f.request, 'id1', 'q1', {}, 'xyz_thing')).toEqual({ ok: true })

		const err = fake(
			JSON.stringify({ errors: [{ message: 'nope', extensions: { error_code: 401 } }] }),
		)
		await expect(mexQuery(err.request, 'id2', 'q1', {})).rejects.toMatchObject({ code: 401 })
	})

	it('throws a clear MexError instead of a bare SyntaxError for a non-JSON (e.g. Argo-encoded) answer', async () => {
		const f = fake('\x00not json at all')
		await expect(mexQuery(f.request, 'id3', 'q1', {})).rejects.toThrow(MexError)
		await expect(mexQuery(f.request, 'id3', 'q1', {})).rejects.toThrow(/not JSON/)
	})
})
