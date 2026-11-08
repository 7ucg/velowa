import { describe, expect, it } from 'vitest'
import {
	numericSecurityCode,
	securityCodeIdentifier,
} from '../../../../src/client/features/account/security-code.js'

const key = (v: number): Uint8Array => new Uint8Array(32).fill(v)

describe('numericSecurityCode', () => {
	// WhatsApp Web's own vectors (WAWebIdentityVerificationApi), ported from whatsapp-rust's
	// identity_verification.rs - these must keep matching the real app's numeric code exactly.
	it('matches the official WhatsApp Web numeric vectors', () => {
		const cases: ['V3' | 'V4', string, string, string][] = [
			[
				'V3',
				'15551234567',
				'442079460001',
				'694840143725290095540559872187863669591573112226601946543520',
			],
			[
				'V4',
				'100000000000001',
				'100000000000002',
				'158788750905376650263214847873716600833018264479947487142264',
			],
			['V3', '99999', '88888', '226217473565740873258669996370854715234157686617816285659630'],
		]
		for (const [version, local, remote, expected] of cases) {
			expect(numericSecurityCode(version, local, [key(2), key(1)], remote, [key(3)])).toBe(expected)
			// Order of inputs and device suffixes (handled by the caller, not this function) don't matter.
			expect(numericSecurityCode(version, remote, [key(3)], local, [key(1), key(2)])).toBe(expected)
			expect(numericSecurityCode(version, local, [key(1)], remote, [key(3)])).not.toBe(expected)
			expect(numericSecurityCode(version, local, [key(2), key(1)], remote, [key(4)])).not.toBe(
				expected,
			)
		}
	})

	it('rejects missing keys and non-numeric identifiers', () => {
		expect(() => numericSecurityCode('V3', '15551234567', [], '442079460001', [key(3)])).toThrow(
			/at least one/,
		)
		expect(() => securityCodeIdentifier('V3', '')).toThrow(/numeric/)
		expect(() => securityCodeIdentifier('V3', '+15551234567')).toThrow(/numeric/)
	})

	it('normalizes a phone number to the WA Web prefix+suffix convention', () => {
		const cases: [string, string][] = [
			['15551234567', '1234567'],
			['442079460001', '44460001'],
			['9991234567', '999234567'],
			['12345', '12345'],
			['1234', '1234@c.us'],
			['99999', '99999@c.us'],
		]
		for (const [input, expected] of cases)
			expect(securityCodeIdentifier('V3', input)).toBe(expected)
	})

	it('uses a LID’s bare digits for V4', () => {
		expect(securityCodeIdentifier('V4', '100000000000001')).toBe('100000000000001')
	})
})
