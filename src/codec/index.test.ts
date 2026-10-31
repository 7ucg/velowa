import { describe, expect, it } from 'vitest'
import { decodeNode, encodeNode } from './index.js'
import type { BinaryNode } from './index.js'

describe('WABinary codec (wasm)', () => {
	it('round-trips nested nodes with string, bytes and child content, preserving attr order', () => {
		const node: BinaryNode = {
			tag: 'iq',
			attrs: { id: 'ABC123', to: '12345678901@s.whatsapp.net', type: 'get', xmlns: 'usync' },
			content: [
				{ tag: 'usync', attrs: { mode: 'query' }, content: [{ tag: 'user', attrs: {} }] },
				{ tag: 'enc', attrs: { v: '2', type: 'msg' }, content: new Uint8Array([0, 1, 2, 250, 255]) },
				{ tag: 'text', attrs: {}, content: 'hello wörld' }
			]
		}
		const bytes = encodeNode(node)
		expect(bytes[0]).toBe(0) // plain format byte
		// The wire format does not distinguish string from byte content, so text
		// content comes back as its UTF-8 bytes.
		const expected = structuredClone(node)
		;(expected.content as BinaryNode[])[2]!.content = new TextEncoder().encode('hello wörld')
		expect(decodeNode(bytes)).toEqual(expected)
		expect(Object.keys(decodeNode(bytes).attrs)).toEqual(Object.keys(node.attrs))
	})

	it('re-encodes a decoded node to identical bytes (JIDs stay JIDs)', () => {
		const node: BinaryNode = {
			tag: 'message',
			attrs: { from: '4915112345678:7@s.whatsapp.net', to: '123456789-1600000000@g.us', id: '3EB0A1B2C3' }
		}
		const first = encodeNode(node)
		const second = encodeNode(decodeNode(first))
		expect(Array.from(second)).toEqual(Array.from(first))
	})

	it('rejects malformed input with a thrown Error', () => {
		expect(() => decodeNode(new Uint8Array([]))).toThrow()
		expect(() => decodeNode(new Uint8Array([0, 0xff, 0xff]))).toThrow()
		expect(() => encodeNode({ tag: 'x', attrs: { a: 1 as unknown as string } })).toThrow(/must be a string/)
	})
})
