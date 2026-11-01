/* eslint-disable @typescript-eslint/no-explicit-any -- protobufjs toObject results are untyped in tests */
import { createHmac } from 'node:crypto'
import protobuf from 'protobufjs'
import { describe, expect, it } from 'vitest'
import { initAuthCreds } from '../../src/auth/creds.js'
import { newIdentityKeyPair, xeddsaSign } from '../../src/crypto/signal.js'
import {
	DEFAULT_CONFIG,
	handlePairSuccess,
	loginPayload,
	qrString,
	registrationPayload,
} from '../../src/client/pairing.js'

const root = new protobuf.Root()
root.loadSync(new URL('../../proto/WAProto.proto', import.meta.url).pathname)
const T = (n: string) => root.lookupType(`proto.${n}`)

describe('client payloads', () => {
	it('encodes a registration payload carrying our pairing keys', () => {
		const creds = initAuthCreds()
		const decoded = T('ClientPayload').toObject(
			T('ClientPayload').decode(registrationPayload(creds, DEFAULT_CONFIG)),
			{
				bytes: Buffer,
				defaults: false,
			},
		) as any
		expect(decoded.devicePairingData.eIdent).toEqual(Buffer.from(creds.signedIdentityKey.publicKey))
		expect(decoded.devicePairingData.eSkeySig).toEqual(Buffer.from(creds.signedPreKey.signature))
		expect(decoded.devicePairingData.eRegid.readUInt32BE(0)).toBe(creds.registrationId)
		expect(decoded.userAgent.appVersion.tertiary).toBe(DEFAULT_CONFIG.version[2])
	})

	it('encodes a login payload from the paired id', () => {
		const creds = { ...initAuthCreds(), me: { id: '4915112345678:12@s.whatsapp.net' } }
		const d = T('ClientPayload').toObject(
			T('ClientPayload').decode(loginPayload(creds, DEFAULT_CONFIG)),
		) as any
		expect(Number(d.username)).toBe(4915112345678)
		expect(d.device).toBe(12)
		expect(d.passive).toBe(true)
	})

	it('builds the QR string as ref,noise,identity,adv', () => {
		const c = initAuthCreds()
		const parts = qrString('REF123', c).split(',')
		expect(parts).toHaveLength(4)
		expect(parts[0]).toBe('REF123')
		expect(Buffer.from(parts[1]!, 'base64')).toEqual(Buffer.from(c.noiseKey.publicKey))
		expect(parts[3]).toBe(c.advSecretKey)
	})
})

describe('pair-success', () => {
	function stanza(creds = initAuthCreds(), tamper = false) {
		const accountKey = newIdentityKeyPair()
		const deviceIdentity = T('ADVDeviceIdentity')
			.encode(T('ADVDeviceIdentity').fromObject({ rawId: 1, timestamp: 1, keyIndex: 3 }))
			.finish()
		const accountSignature = xeddsaSign(
			accountKey.privateKey,
			Buffer.concat([Buffer.from([6, 0]), deviceIdentity, creds.signedIdentityKey.publicKey]),
		)
		const details = T('ADVSignedDeviceIdentity')
			.encode(
				T('ADVSignedDeviceIdentity').fromObject({
					details: deviceIdentity,
					accountSignatureKey: accountKey.publicKey,
					accountSignature,
				}),
			)
			.finish()
		const hmac = createHmac('sha256', Buffer.from(creds.advSecretKey, 'base64'))
			.update(details)
			.digest()
		if (tamper) hmac[0] ^= 1
		const content = T('ADVSignedDeviceIdentityHMAC')
			.encode(T('ADVSignedDeviceIdentityHMAC').fromObject({ details, hmac }))
			.finish()
		return {
			creds,
			node: {
				tag: 'iq',
				attrs: { id: 'abc', type: 'set', from: 's.whatsapp.net' },
				content: [
					{
						tag: 'pair-success',
						attrs: {},
						content: [
							{ tag: 'device-identity', attrs: {}, content },
							{ tag: 'platform', attrs: { name: 'smba' } },
							{ tag: 'device', attrs: { jid: '4915112345678:5@s.whatsapp.net', lid: '123:5@lid' } },
						],
					},
				],
			},
		}
	}

	it('verifies, signs the device identity and replies', () => {
		const { creds, node } = stanza()
		const { reply, update } = handlePairSuccess(node, creds)
		expect(update.me).toEqual({ id: '4915112345678:5@s.whatsapp.net', lid: '123:5@lid' })
		expect(update.platform).toBe('smba')
		expect(reply.attrs['id']).toBe('abc')
		const sign = (reply.content as any[])[0]
		expect(sign.tag).toBe('pair-device-sign')
		expect(sign.content[0].attrs['key-index']).toBe('3')
		const sent = T('ADVSignedDeviceIdentity').toObject(
			T('ADVSignedDeviceIdentity').decode(sign.content[0].content),
			{ bytes: Buffer },
		) as any
		expect(sent.deviceSignature.length).toBe(64)
		expect(sent.accountSignatureKey).toBeUndefined()
	})

	it('rejects a bad HMAC and a wrong identity key', () => {
		const bad = stanza(undefined, true)
		expect(() => handlePairSuccess(bad.node, bad.creds)).toThrow(/HMAC/)
		const good = stanza()
		const other = { ...good.creds, signedIdentityKey: newIdentityKeyPair() }
		expect(() => handlePairSuccess(good.node, other)).toThrow()
	})
})
