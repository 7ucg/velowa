import { describe, expect, it } from 'vitest'
import { encodeWam } from '../../src/wam/index.js'

describe('WAM encoder', () => {
	it('matches the bytes the reference encoder produces (captured oracle)', () => {
		const out = encodeWam(
			[
				{
					name: 'WebcSocketConnect',
					props: {
						webcSocketConnectDuration: 123,
						webcSocketConnectReason: 0,
						webcSocketHostname: 'web.whatsapp.com',
						webcAuthHandshakeDuration: 300,
					},
				},
				{ name: 'WebcSocketConnect', props: { webcSocketConnectDuration: 70000 } },
			],
			3,
		)
		expect(out.toString('hex')).toBe(
			'57414d0501000300394a15ff31027b11038104107765622e77686174736170702e636f6d46012c01394a15ff560270110100',
		)
	})

	it('rejects unknown events and properties', () => {
		expect(() => encodeWam([{ name: 'Nope' }])).toThrow(/unknown WAM event/)
		expect(() => encodeWam([{ name: 'WebcSocketConnect', props: { nope: 1 } }])).toThrow(
			/unknown property/,
		)
	})
})
