import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { initAuthCreds, loadAuthCreds, saveAuthCreds } from './creds.js'

describe('auth creds persistence', () => {
	it('round-trips bytes, including Buffers, as Uint8Array', () => {
		const path = join(mkdtempSync(join(tmpdir(), 'velowa-creds-')), 'creds.json')
		const creds = initAuthCreds()
		creds.account = Buffer.from([9, 8, 7]) // protobufjs returns Buffers
		saveAuthCreds(path, creds)
		const loaded = loadAuthCreds(path)!
		expect(loaded.account).toBeInstanceOf(Uint8Array)
		expect(Array.from(loaded.account!)).toEqual([9, 8, 7])
		expect(Array.from(loaded.noiseKey.privateKey)).toEqual(Array.from(creds.noiseKey.privateKey))
		expect(loaded.nextPreKeyId).toBe(1)
	})
})
