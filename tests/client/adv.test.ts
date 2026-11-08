// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { describe, expect, it } from 'vitest'
import { validateAdvDeviceIdentity } from '../../src/client/adv.js'
import { newIdentityKeyPair, xeddsaSign } from '../../src/crypto/signal.js'
import { protoType as T } from '../../src/client/proto.js'

function signedIdentity(opts: {
	account: { publicKey: Uint8Array; privateKey: Uint8Array }
	device: { publicKey: Uint8Array; privateKey: Uint8Array }
	includeAccountKey?: boolean
}) {
	const { account, device, includeAccountKey = true } = opts
	const details = T('ADVDeviceIdentity')
		.encode(T('ADVDeviceIdentity').fromObject({ rawId: 1, timestamp: 1, keyIndex: 0 }))
		.finish()
	const accountSignature = xeddsaSign(
		account.privateKey,
		Buffer.concat([Buffer.from([6, 0]), details, device.publicKey]),
	)
	const deviceSignature = xeddsaSign(
		device.privateKey,
		Buffer.concat([Buffer.from([6, 1]), details, device.publicKey, account.publicKey]),
	)
	return T('ADVSignedDeviceIdentity')
		.encode(
			T('ADVSignedDeviceIdentity').fromObject({
				details,
				...(includeAccountKey && { accountSignatureKey: account.publicKey }),
				accountSignature,
				deviceSignature,
			}),
		)
		.finish()
}

describe('validateAdvDeviceIdentity', () => {
	it('verifies a self-contained blob (account key embedded)', () => {
		const account = newIdentityKeyPair()
		const device = newIdentityKeyPair()
		const bytes = signedIdentity({ account, device })
		expect(validateAdvDeviceIdentity(bytes, device.publicKey)).toBe('valid')
	})

	it('verifies a trimmed companion blob against a supplied fallback account key', () => {
		const account = newIdentityKeyPair()
		const device = newIdentityKeyPair()
		const bytes = signedIdentity({ account, device, includeAccountKey: false })
		expect(validateAdvDeviceIdentity(bytes, device.publicKey, account.publicKey)).toBe('valid')
	})

	it('is unverifiable (not invalid) when the key is trimmed and no fallback is given', () => {
		const account = newIdentityKeyPair()
		const device = newIdentityKeyPair()
		const bytes = signedIdentity({ account, device, includeAccountKey: false })
		expect(validateAdvDeviceIdentity(bytes, device.publicKey)).toBe('no-account-key')
	})

	it('rejects a relay swapping in a different identity key', () => {
		const account = newIdentityKeyPair()
		const device = newIdentityKeyPair()
		const attacker = newIdentityKeyPair()
		const bytes = signedIdentity({ account, device })
		expect(validateAdvDeviceIdentity(bytes, attacker.publicKey)).toBe('invalid')
	})

	it('rejects an in-blob account key that conflicts with a trusted fallback', () => {
		const account = newIdentityKeyPair()
		const unrelated = newIdentityKeyPair()
		const device = newIdentityKeyPair()
		const bytes = signedIdentity({ account, device })
		expect(validateAdvDeviceIdentity(bytes, device.publicKey, unrelated.publicKey)).toBe('invalid')
	})

	it('rejects garbage and a tampered signature', () => {
		const account = newIdentityKeyPair()
		const device = newIdentityKeyPair()
		expect(validateAdvDeviceIdentity(new Uint8Array([1, 2, 3]), device.publicKey)).toBe('invalid')
		const bytes = Buffer.from(signedIdentity({ account, device }))
		bytes[bytes.length - 1]! ^= 1
		expect(validateAdvDeviceIdentity(bytes, device.publicKey)).toBe('invalid')
	})
})
