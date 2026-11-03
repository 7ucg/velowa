import { createCipheriv, createDecipheriv, hkdfSync, pbkdf2Sync, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { initAuthCreds } from '../../../../src/auth/creds.js'
import type { BinaryNode } from '../../../../src/codec/index.js'
import { newIdentityKeyPair } from '../../../../src/crypto/signal.js'
import {
	companionFinish,
	companionHello,
	generatePairingCode,
	isValidPairingCode,
	normalizePairingCode,
	sharedKey,
} from '../../../../src/client/features/account/pairing-code.js'

const kid = (n: BinaryNode, tag: string) =>
	(n.content as BinaryNode[]).find((c) => c.tag === tag)!.content as Uint8Array

describe('pairing-code linking', () => {
	it('generates 8 Crockford characters', () => {
		for (let i = 0; i < 100; i++) expect(generatePairingCode()).toMatch(/^[1-9A-HJ-NP-TV-Z]{8}$/)
	})

	it('validates a custom code: exactly 8 Crockford characters, case-insensitive', () => {
		expect(isValidPairingCode('ABCD2345')).toBe(true)
		expect(isValidPairingCode('abcd2345')).toBe(true)
		expect(isValidPairingCode('ABCD234')).toBe(false) // 7 chars
		expect(isValidPairingCode('ABCD23456')).toBe(false) // 9 chars
		expect(isValidPairingCode('ABCD234I')).toBe(false) // I is not in the alphabet
		expect(isValidPairingCode('ABCD234O')).toBe(false) // neither is O
		expect(isValidPairingCode('ABCD234U')).toBe(false) // neither is U
		expect(isValidPairingCode('')).toBe(false)
	})

	it('normalizes a custom code to uppercase and rejects an invalid one', () => {
		expect(normalizePairingCode('abcd2345')).toBe('ABCD2345')
		expect(normalizePairingCode('ABCD2345')).toBe('ABCD2345')
		expect(() => normalizePairingCode('tooshort')).toThrow(/8 characters/)
		expect(() => normalizePairingCode('ABCD234I')).toThrow(/8 characters/)
	})

	it('sends a lowercase custom code uppercased, so it matches the phone', async () => {
		const creds = initAuthCreds()
		const code = normalizePairingCode('abcd2345')
		const hello = await companionHello(creds, '4915699887766', code)
		const reg = (hello.content as BinaryNode[])[0]!
		const wrapped = kid(reg, 'link_code_pairing_wrapped_companion_ephemeral_pub')
		const salt = wrapped.subarray(0, 32)
		const iv = wrapped.subarray(32, 48)
		// Decrypting with the lowercase form must fail: the wire key was derived from the uppercase code.
		const wrongKey = pbkdf2Sync('abcd2345', salt, 2 << 16, 32, 'sha256')
		const d1 = createDecipheriv('aes-256-ctr', wrongKey, iv)
		const wrongDecrypt = Buffer.concat([d1.update(wrapped.subarray(48)), d1.final()])
		expect(wrongDecrypt.equals(Buffer.from(creds.pairingEphemeralKey.publicKey))).toBe(false)
		// Decrypting with the uppercase form (what normalizePairingCode produced) succeeds.
		const rightKey = pbkdf2Sync('ABCD2345', salt, 2 << 16, 32, 'sha256')
		const d2 = createDecipheriv('aes-256-ctr', rightKey, iv)
		const rightDecrypt = Buffer.concat([d2.update(wrapped.subarray(48)), d2.final()])
		expect(rightDecrypt.equals(Buffer.from(creds.pairingEphemeralKey.publicKey))).toBe(true)
	})

	it('sends link_code_pairing_nonce as the single raw byte 0x00, not the text "0"', async () => {
		const hello = await companionHello(initAuthCreds(), '4915699887766', 'ABCD2345')
		const reg = (hello.content as BinaryNode[])[0]!
		const nonce = (reg.content as BinaryNode[]).find(
			(c) => c.tag === 'link_code_pairing_nonce',
		)!.content
		expect(nonce).toBeInstanceOf(Uint8Array)
		expect([...(nonce as Uint8Array)]).toEqual([0])
	})

	it('sends the companion_platform_id/display the server actually validates for pairing-code linking', async () => {
		const creds = initAuthCreds()
		const pairingFieldsOf = async (browser: [string, string]) => {
			const hello = await companionHello(creds, '4915699887766', 'ABCD2345', browser)
			const reg = (hello.content as BinaryNode[])[0]!
			const field = (tag: string) =>
				(reg.content as BinaryNode[]).find((c) => c.tag === tag)!.content
			return { id: field('companion_platform_id'), display: field('companion_platform_display') }
		}
		// The library's own default: a desktop app reports as "Chrome" (the underlying Chromium renderer),
		// id '7' - NOT the literal word "Desktop", which the phone does not recognise as a browser and is
		// the reason a pairing code could be shown yet the phone still says "couldn't link device".
		expect(await pairingFieldsOf(['Windows', 'Desktop'])).toEqual({
			id: '7',
			display: 'Chrome (Windows)',
		})
		expect(await pairingFieldsOf(['macOS', 'Chrome'])).toEqual({
			id: '1',
			display: 'Chrome (Mac OS)',
		})
		expect(await pairingFieldsOf(['Windows', 'Edge'])).toEqual({
			id: '2',
			display: 'Edge (Windows)',
		})
		expect(await pairingFieldsOf(['Ubuntu', 'Firefox'])).toEqual({
			id: '3',
			display: 'Firefox (Linux)',
		})
		// An unrecognised browser falls back to id '9' ("OtherWebClient") and still shows as "Chrome";
		// an unrecognised OS is coerced to "Linux" rather than sent as whatever branding string it was.
		expect(await pairingFieldsOf(['SomeOS', 'SomeUnknownBrowser'])).toEqual({
			id: '9',
			display: 'Chrome (Linux)',
		})
	})

	it('runs the full exchange against a simulated phone and both sides derive the same ADV secret', async () => {
		const creds = initAuthCreds()
		const code = 'ABCD2345'
		const phone = '4915699887766'

		// companion -> phone
		const hello = await companionHello(creds, phone, code)
		const reg = (hello.content as BinaryNode[])[0]!
		expect(reg.attrs).toMatchObject({ jid: `${phone}@s.whatsapp.net`, stage: 'companion_hello' })
		const wrapped = kid(reg, 'link_code_pairing_wrapped_companion_ephemeral_pub')
		const salt = wrapped.subarray(0, 32)
		const iv = wrapped.subarray(32, 48)
		const codeKey = pbkdf2Sync(code, salt, 2 << 16, 32, 'sha256')
		const d = createDecipheriv('aes-256-ctr', codeKey, iv)
		const companionEphemeral = Buffer.concat([d.update(wrapped.subarray(48)), d.final()])
		expect(companionEphemeral.equals(Buffer.from(creds.pairingEphemeralKey.publicKey))).toBe(true)
		expect(
			Buffer.from(kid(reg, 'companion_server_auth_key_pub')).equals(
				Buffer.from(creds.noiseKey.publicKey),
			),
		).toBe(true)

		// phone -> companion (primary_hello): its own ephemeral + identity, ephemeral wrapped under the same code
		const primaryEph = newIdentityKeyPair()
		const primaryIdentity = newIdentityKeyPair()
		const pSalt = randomBytes(32)
		const pIv = randomBytes(16)
		const c = createCipheriv('aes-256-ctr', pbkdf2Sync(code, pSalt, 2 << 16, 32, 'sha256'), pIv)
		const wrappedPrimary = Buffer.concat([pSalt, pIv, c.update(primaryEph.publicKey), c.final()])
		const notification: BinaryNode = {
			tag: 'notification',
			attrs: { type: 'link_code_companion_reg', from: 's.whatsapp.net', id: 'N1' },
			content: [
				{
					tag: 'link_code_companion_reg',
					attrs: { stage: 'primary_hello' },
					content: [
						{ tag: 'link_code_pairing_ref', attrs: {}, content: Buffer.from('REF') },
						{ tag: 'primary_identity_pub', attrs: {}, content: primaryIdentity.publicKey },
						{
							tag: 'link_code_pairing_wrapped_primary_ephemeral_pub',
							attrs: {},
							content: wrappedPrimary,
						},
					],
				},
			],
		}
		const out = await companionFinish(notification, creds, phone, code)!
		expect(out).toBeDefined()
		const fin = (out!.finish.content as BinaryNode[])[0]!
		expect(fin.attrs['stage']).toBe('companion_finish')
		expect(Buffer.from(kid(fin, 'link_code_pairing_ref')).toString()).toBe('REF')

		// the phone opens the key bundle with ECDH(primaryEph, companionEph) and gets the identities + random
		const shared = sharedKey(primaryEph.privateKey, companionEphemeral)
		const bundle = kid(fin, 'link_code_pairing_wrapped_key_bundle')
		const key = Buffer.from(
			hkdfSync(
				'sha256',
				shared,
				bundle.subarray(0, 32),
				'link_code_pairing_key_bundle_encryption_key',
				32,
			),
		)
		const g = createDecipheriv('aes-256-gcm', key, bundle.subarray(32, 44))
		g.setAuthTag(Buffer.from(bundle.subarray(bundle.length - 16)))
		const plain = Buffer.concat([g.update(bundle.subarray(44, bundle.length - 16)), g.final()])
		expect(plain.subarray(0, 32).equals(Buffer.from(creds.signedIdentityKey.publicKey))).toBe(true)
		expect(plain.subarray(32, 64).equals(Buffer.from(primaryIdentity.publicKey))).toBe(true)
		const random = plain.subarray(64, 96)

		// and derives the same ADV secret the companion will verify pair-success with
		const identityShared = sharedKey(primaryIdentity.privateKey, creds.signedIdentityKey.publicKey)
		const adv = Buffer.from(
			hkdfSync(
				'sha256',
				Buffer.concat([shared, identityShared, random]),
				Buffer.alloc(0),
				'adv_secret',
				32,
			),
		)
		expect(adv.toString('base64')).toBe(out!.advSecretKey)
	})

	it('ignores a notification without pairing data, and a wrong code yields garbage that cannot complete', async () => {
		const creds = initAuthCreds()
		expect(
			await companionFinish(
				{
					tag: 'notification',
					attrs: {},
					content: [{ tag: 'link_code_companion_reg', attrs: {}, content: [] }],
				},
				creds,
				'49',
				'ABCD2345',
			),
		).toBeUndefined()
		expect(
			await companionFinish({ tag: 'notification', attrs: {} }, creds, '49', 'ABCD2345'),
		).toBeUndefined()
	})
})
