import { readFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
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
				{
					tag: 'enc',
					attrs: { v: '2', type: 'msg' },
					content: new Uint8Array([0, 1, 2, 250, 255]),
				},
				{ tag: 'text', attrs: {}, content: 'hello wörld' },
			],
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
			attrs: {
				from: '4915112345678:7@s.whatsapp.net',
				to: '123456789-1600000000@g.us',
				id: '3EB0A1B2C3',
			},
		}
		const first = encodeNode(node)
		const second = encodeNode(decodeNode(first))
		expect(Array.from(second)).toEqual(Array.from(first))
	})

	it('rejects malformed input with a thrown Error', () => {
		expect(() => decodeNode(new Uint8Array([]))).toThrow()
		expect(() => decodeNode(new Uint8Array([0, 0xff, 0xff]))).toThrow()
		expect(() => encodeNode({ tag: 'x', attrs: { a: 1 as unknown as string } })).toThrow(
			/must be a string/,
		)
	})

	// Not a live capture (none available yet, see TODO Phase 1): hand-derived from the
	// public WABinary spec and node's independent zlib, so they do not just echo our own encoder.
	it('matches the spec bytes for <message>receipt</message>', () => {
		// 0 = plain format byte, 248 = LIST_8, 2 = tag + content, 19 = token "message", 7 = token "receipt"
		const spec = Uint8Array.from([0, 248, 2, 19, 7])
		expect(Array.from(encodeNode({ tag: 'message', attrs: {}, content: 'receipt' }))).toEqual(
			Array.from(spec),
		)
		expect(decodeNode(spec).tag).toBe('message')
	})

	it('inflates a zlib-compressed frame produced by node zlib', () => {
		const inner = encodeNode({ tag: 'message', attrs: {}, content: 'receipt' }).subarray(1)
		const frame = Uint8Array.from([2, ...deflateSync(inner)])
		expect(decodeNode(frame).tag).toBe('message')
	})
})

// Real frames captured from the live WhatsApp Web endpoint (decrypted stanzas, server -> client).
// Only frames without personal identifiers are committed.
interface LiveCapture {
	tag: string
	hex: string
}
const live = JSON.parse(
	readFileSync(new URL('./fixtures/live-captures.json', import.meta.url), 'utf8'),
) as LiveCapture[]

describe('live captures', () => {
	it('decodes every captured frame', () => {
		expect(live.length).toBeGreaterThan(5)
		for (const c of live) expect(decodeNode(Buffer.from(c.hex, 'hex')).tag).toBe(c.tag)
	})

	it('round-trips every captured frame to an identical node', () => {
		for (const c of live) {
			const node = decodeNode(Buffer.from(c.hex, 'hex'))
			expect(decodeNode(encodeNode(node))).toEqual(node)
		}
	})

	// Byte equality is deliberately not asserted: the server and our encoder pick different but
	// equivalent forms (bare server JID as JID_PAIR `fa 00 03` vs token `03`; "515" as raw string vs
	// nibble-packed). Both decode to the same node, which is what the round trip above checks.

	it('decodes the real pair-device iq and stream:error', () => {
		const pair = live.find((c) => c.tag === 'iq' && c.hex.length > 1000)!
		const node = decodeNode(Buffer.from(pair.hex, 'hex'))
		const pd = (node.content as BinaryNode[])[0]!
		expect(pd.tag).toBe('pair-device')
		expect((pd.content as BinaryNode[]).filter((n) => n.tag === 'ref')).toHaveLength(6)
		const err = decodeNode(Buffer.from(live.find((c) => c.tag === 'stream:error')!.hex, 'hex'))
		expect(err.attrs).toEqual({ code: '515' })
	})
})
