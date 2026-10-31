import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { FrameDecoder, connHeader, encodeFrame, startXxHandshake } from './noise.js'

function x25519() {
	const { publicKey, privateKey } = generateKeyPairSync('x25519')
	const pub = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)
	const priv = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32)
	return { pub: new Uint8Array(pub), priv: new Uint8Array(priv) }
}

describe('Noise framing', () => {
	it('has the WA connection header', () => {
		expect(Array.from(connHeader())).toEqual([0x57, 0x41, 6, 3])
	})

	it('prefixes a 3-byte big-endian length and prepends the header once', () => {
		const payload = new Uint8Array([1, 2, 3, 4, 5])
		const frame = encodeFrame(payload, connHeader())
		expect(Array.from(frame)).toEqual([0x57, 0x41, 6, 3, 0, 0, 5, 1, 2, 3, 4, 5])
		expect(Array.from(encodeFrame(payload, undefined))).toEqual([0, 0, 5, 1, 2, 3, 4, 5])
	})

	it('reassembles frames split across socket reads', () => {
		const a = encodeFrame(new Uint8Array([9, 9]), undefined)
		const b = encodeFrame(new Uint8Array([7]), undefined)
		const all = Uint8Array.from([...a, ...b])
		const dec = new FrameDecoder()
		dec.feed(all.subarray(0, 4))
		expect(dec.nextFrame()).toBeUndefined()
		dec.feed(all.subarray(4))
		expect(Array.from(dec.nextFrame()!)).toEqual([9, 9])
		expect(Array.from(dec.nextFrame()!)).toEqual([7])
		expect(dec.nextFrame()).toBeUndefined()
	})
})

describe('NoiseXxHandshake', () => {
	it('produces a client hello and rejects a garbage server hello', () => {
		const k = x25519()
		const hs = startXxHandshake(k.priv, k.pub, new Uint8Array([1, 2, 3]))
		expect(hs.buildClientHello().length).toBeGreaterThan(32)
		expect(() => hs.readServerHelloAndBuildClientFinish(new Uint8Array([1, 2, 3]))).toThrow()
		expect(() => hs.finish()).toThrow() // never completed
	})

	it('rejects a bad static key length', () => {
		expect(() => startXxHandshake(new Uint8Array(5), new Uint8Array(5), new Uint8Array())).toThrow()
	})
})
