import { describe, expect, it } from 'vitest'
import { newAppStateCollection, restoreAppStateCollection } from './appstate.js'

import { buildGenesisPatch, keyId, lookup, master } from './appstate.testkit.js'

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
