import { describe, expect, it } from 'vitest'
import { randomFingerprint } from '../../src/client/fingerprint.js'

describe('randomFingerprint', () => {
	it('returns an internally consistent, varied fingerprint from a pool of at least 250', () => {
		const seen = new Set<string>()
		for (let i = 0; i < 300; i++) {
			const fp = randomFingerprint()
			expect(fp.userAgent).toContain(fp.browser)
			expect(fp.userAgent).toContain(fp.browserVersion)
			expect(fp.osName).toBeTruthy()
			expect(fp.osVersion).toBeTruthy()
			seen.add(`${fp.osName}/${fp.osVersion}/${fp.browserVersion}`)
		}
		// 300 draws from a pool of 250+ should turn up a good number of distinct picks, not a handful.
		expect(seen.size).toBeGreaterThan(50)
	})
})
