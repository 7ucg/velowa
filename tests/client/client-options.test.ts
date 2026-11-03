// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Client } from '../../src/client/client.js'

let dir: string
afterEach(() => {
	if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('customPairingCode', () => {
	it('accepts a valid custom code together with pairWithPhoneNumber', () => {
		dir = mkdtempSync(join(tmpdir(), 'velowa-client-'))
		expect(
			() =>
				new Client({
					authDir: dir,
					pairWithPhoneNumber: '4915699887766',
					customPairingCode: 'ABCD2345',
				}),
		).not.toThrow()
	})

	it('rejects a custom code that is not 8 Crockford characters', () => {
		dir = mkdtempSync(join(tmpdir(), 'velowa-client-'))
		expect(
			() =>
				new Client({
					authDir: dir,
					pairWithPhoneNumber: '4915699887766',
					customPairingCode: 'tooshort',
				}),
		).toThrow(/8 characters/)
	})

	it('rejects a custom code without pairWithPhoneNumber', () => {
		dir = mkdtempSync(join(tmpdir(), 'velowa-client-'))
		expect(() => new Client({ authDir: dir, customPairingCode: 'ABCD2345' })).toThrow(
			/needs pairWithPhoneNumber/,
		)
	})
})
