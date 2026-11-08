// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { describe, expect, it } from 'vitest'
import {
	isKeyIndexValid,
	validateAdvDeviceIdentity,
	verifyKeyIndexList,
} from '../../src/client/adv.js'
import { newIdentityKeyPair, xeddsaSign } from '../../src/crypto/signal.js'
import { protoType as T } from '../../src/client/proto.js'

function signedKeyIndexList(
	account: { publicKey: Uint8Array; privateKey: Uint8Array },
	opts: { currentIndex?: number; validIndexes?: number[] } = {},
) {
	const details = T('ADVKeyIndexList')
		.encode(
			T('ADVKeyIndexList').fromObject({
				rawId: 1,
				timestamp: 1000,
				currentIndex: opts.currentIndex ?? 2,
				validIndexes: opts.validIndexes ?? [1, 2],
			}),
		)
		.finish()
	const accountSignature = xeddsaSign(
		account.privateKey,
		Buffer.concat([Buffer.from([6, 2]), details]),
	)
	return T('ADVSignedKeyIndexList')
		.encode(T('ADVSignedKeyIndexList').fromObject({ details, accountSignature }))
		.finish()
}

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

describe('verifyKeyIndexList / isKeyIndexValid', () => {
	it('decodes a validly-signed list', () => {
		const account = newIdentityKeyPair()
		const bytes = signedKeyIndexList(account, { currentIndex: 2, validIndexes: [1, 2] })
		expect(verifyKeyIndexList(bytes, account.publicKey)).toEqual({
			currentIndex: 2,
			validIndexes: [1, 2],
		})
	})

	it('rejects a list signed by someone else', () => {
		const account = newIdentityKeyPair()
		const attacker = newIdentityKeyPair()
		const bytes = signedKeyIndexList(account)
		expect(verifyKeyIndexList(bytes, attacker.publicKey)).toBeUndefined()
	})

	it('rejects garbage and a tampered signature', () => {
		const account = newIdentityKeyPair()
		expect(verifyKeyIndexList(new Uint8Array([1, 2, 3]), account.publicKey)).toBeUndefined()
		const bytes = Buffer.from(signedKeyIndexList(account))
		bytes[bytes.length - 1]! ^= 1
		expect(verifyKeyIndexList(bytes, account.publicKey)).toBeUndefined()
	})

	it('accepts an index in the valid set, or newer than current - rejects anything else', () => {
		const decoded = { currentIndex: 5, validIndexes: [2, 7] }
		expect(isKeyIndexValid(2, decoded)).toBe(true)
		expect(isKeyIndexValid(7, decoded)).toBe(true)
		expect(isKeyIndexValid(10, decoded)).toBe(true) // newer than currentIndex
		expect(isKeyIndexValid(3, decoded)).toBe(false) // neither valid nor newer
		expect(isKeyIndexValid(undefined, decoded)).toBe(false)
	})
})
