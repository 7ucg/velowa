import { createCipheriv, createHmac, hkdfSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { newAppStateCollection, restoreAppStateCollection } from './appstate.js'

// Independent oracle: the app-state wire crypto re-implemented from the WA Web algorithm with
// node:crypto, so a patch built here is not just echoing the Rust encoder.

const varint = (n: number) => {
	const out: number[] = []
	while (n >= 0x80) {
		out.push((n & 0x7f) | 0x80)
		n = Math.floor(n / 128)
	}
	out.push(n)
	return Buffer.from(out)
}
const ld = (field: number, body: Uint8Array) =>
	Buffer.concat([varint((field << 3) | 2), varint(body.length), body])
const vf = (field: number, n: number) => Buffer.concat([varint(field << 3), varint(n)])

const hkdf = (ikm: Uint8Array, info: string, len: number) =>
	Buffer.from(hkdfSync('sha256', ikm, Buffer.alloc(0), info, len))

function expand(master: Uint8Array) {
	const k = hkdf(master, 'WhatsApp Mutation Keys', 160)
	return {
		index: k.subarray(0, 32),
		valueEnc: k.subarray(32, 64),
		valueMac: k.subarray(64, 96),
		snapshotMac: k.subarray(96, 128),
		patchMac: k.subarray(128, 160),
	}
}

const versionBytes = (v: number) => {
	const b = Buffer.alloc(8)
	b.writeUInt32BE(v, 4)
	return b
}

function ltHashAdd(base: Buffer, items: Buffer[]) {
	const out = Buffer.from(base)
	for (const item of items) {
		const d = hkdf(item, 'WhatsApp Patch Integrity', 128)
		for (let i = 0; i < 128; i += 2)
			out.writeUInt16LE((out.readUInt16LE(i) + d.readUInt16LE(i)) & 0xffff, i)
	}
	return out
}

function buildGenesisPatch(
	master: Buffer,
	keyId: Buffer,
	name: string,
	index: string[],
	timestamp: number,
) {
	const keys = expand(master)
	const indexJson = Buffer.from(JSON.stringify(index))
	const action = Buffer.concat([
		ld(1, indexJson),
		ld(2, Buffer.concat([vf(1, timestamp), ld(2, vf(1, 1))])),
		vf(4, 2),
	])
	const cipher = createCipheriv('aes-256-cbc', keys.valueEnc, Buffer.alloc(16))
	const withIv = Buffer.concat([Buffer.alloc(16), cipher.update(action), cipher.final()])
	const aad = Buffer.concat([
		Buffer.from([1]),
		keyId,
		withIv,
		Buffer.from([0, 0, 0, 0, 0, 0, 0, keyId.length + 1]),
	])
	const valueMac = createHmac('sha512', keys.valueMac).update(aad).digest().subarray(0, 32)
	const blob = Buffer.concat([withIv, valueMac])
	const indexMac = createHmac('sha256', keys.index).update(indexJson).digest()

	const lt = ltHashAdd(Buffer.alloc(128), [valueMac])
	const snapshotMac = createHmac('sha256', keys.snapshotMac)
		.update(lt)
		.update(versionBytes(1))
		.update(name)
		.digest()
	const patchMac = createHmac('sha256', keys.patchMac)
		.update(snapshotMac)
		.update(valueMac)
		.update(versionBytes(1))
		.update(name)
		.digest()

	const record = Buffer.concat([ld(1, ld(1, indexMac)), ld(2, ld(1, blob)), ld(3, ld(1, keyId))])
	const patch = Buffer.concat([
		ld(1, vf(1, 1)),
		ld(2, Buffer.concat([vf(1, 0), ld(2, record)])),
		ld(4, snapshotMac),
		ld(5, patchMac),
		ld(6, ld(1, keyId)),
	])
	return { patch: new Uint8Array(patch), valueMac, indexMac, lt }
}

const master = Buffer.alloc(32, 7)
const keyId = Buffer.from([0, 1, 2, 3, 4, 5])
const lookup = (id: Uint8Array) =>
	Buffer.from(id).equals(keyId) ? new Uint8Array(master) : undefined

describe('AppStateCollection', () => {
	it('applies an independently built genesis patch and reproduces the LTHash', () => {
		const { patch, valueMac, indexMac, lt } = buildGenesisPatch(
			master,
			keyId,
			'regular',
			['star', 'chat@s.whatsapp.net'],
			1700000000,
		)
		const c = newAppStateCollection('regular')
		const res = c.applyPatch(patch, lookup, () => undefined)
		expect(c.version).toBe(1)
		expect(Buffer.from(c.hash).equals(lt)).toBe(true)
		expect(res.mutations).toHaveLength(1)
		expect(res.mutations[0]!.index).toEqual(['star', 'chat@s.whatsapp.net'])
		expect(res.mutations[0]!.operation).toBe('set')
		expect(res.mutations[0]!.value!.length).toBeGreaterThan(0)
		expect(Buffer.from(res.addedMacs[0]!.indexMac).equals(indexMac)).toBe(true)
		expect(Buffer.from(res.addedMacs[0]!.valueMac).equals(valueMac)).toBe(true)
	})

	it('round-trips persisted state', () => {
		const { patch } = buildGenesisPatch(master, keyId, 'regular', ['x'], 1)
		const c = newAppStateCollection('regular')
		c.applyPatch(patch, lookup, () => undefined)
		const restored = restoreAppStateCollection('regular', c.serializeState())
		expect(restored.version).toBe(1)
		expect(Buffer.from(restored.hash).equals(Buffer.from(c.hash))).toBe(true)
	})

	it('is transactional: a tampered patch is rejected and leaves the state untouched', () => {
		const { patch } = buildGenesisPatch(master, keyId, 'regular', ['x'], 1)
		const bad = patch.slice()
		bad[bad.length - 40] ^= 1 // inside the snapshot/patch MAC area
		const c = newAppStateCollection('regular')
		expect(() => c.applyPatch(bad, lookup, () => undefined)).toThrow()
		expect(c.version).toBe(0)
		expect(Buffer.from(c.hash).equals(Buffer.alloc(128))).toBe(true)
	})

	it('rejects a patch when the sync key is unknown', () => {
		const { patch } = buildGenesisPatch(master, keyId, 'regular', ['x'], 1)
		const c = newAppStateCollection('regular')
		expect(() =>
			c.applyPatch(
				patch,
				() => undefined,
				() => undefined,
			),
		).toThrow(/key/)
	})

	it('rejects a patch under the wrong collection name (MACs bind the name)', () => {
		const { patch } = buildGenesisPatch(master, keyId, 'regular', ['x'], 1)
		const c = newAppStateCollection('critical_block')
		expect(() => c.applyPatch(patch, lookup, () => undefined)).toThrow()
	})

	it('refuses a patch without a top-level key id (aggregate MACs would be skipped)', () => {
		const { patch } = buildGenesisPatch(master, keyId, 'regular', ['x'], 1)
		// Drop the trailing keyId field (tag 0x32 = field 6, length-delimited, 2 + len bytes).
		const stripped = patch.slice(0, patch.length - (2 + 2 + keyId.length))
		const c = newAppStateCollection('regular')
		expect(() => c.applyPatch(stripped, lookup, () => undefined)).toThrow()
		expect(c.version).toBe(0)
	})

	it('refuses a non-genesis patch on an empty collection', () => {
		const c = newAppStateCollection('regular')
		const { patch } = buildGenesisPatch(master, keyId, 'regular', ['x'], 1)
		// version field is the first message: 0x0a 0x02 0x08 0x01 -> bump to 5
		const bumped = patch.slice()
		bumped[3] = 5
		expect(() => c.applyPatch(bumped, lookup, () => undefined)).toThrow(/baseline/)
	})
})
