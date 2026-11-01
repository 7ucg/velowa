import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LidMap } from '../../src/client/lid-map.js'

describe('LidMap', () => {
	it('maps phone-number JIDs (any device) to their LID, in either argument order, and ignores other pairs', () => {
		const m = new LidMap()
		expect(m.set('4915@s.whatsapp.net', '99:3@lid')).toBe(true)
		expect(m.set('99@lid', '4915:7@s.whatsapp.net')).toBe(false) // already known
		expect(m.resolve('4915@s.whatsapp.net')).toBe('99@lid')
		expect(m.resolve('4915:7@s.whatsapp.net')).toBe('99:7@lid')
		expect(m.resolve('48@s.whatsapp.net')).toBe('48@s.whatsapp.net')
		expect(m.resolve('99@lid')).toBe('99@lid')
		expect(m.resolve('120363@g.us')).toBe('120363@g.us')
		expect(m.set('a@g.us', 'b@lid')).toBe(false)
		expect(m.pnUser('99')).toBe('4915')
	})

	it('persists across instances', () => {
		const path = join(mkdtempSync(join(tmpdir(), 'velowa-lid-')), 'lid-map.json')
		new LidMap(path).set('4915@s.whatsapp.net', '99@lid')
		expect(new LidMap(path).resolve('4915@s.whatsapp.net')).toBe('99@lid')
	})
})
