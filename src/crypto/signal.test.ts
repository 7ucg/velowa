import { describe, expect, it } from 'vitest'
import {
	MemorySignalStorage,
	createSignalCipher,
	newIdentityKeyPair,
	newPreKeys,
	newSignedPreKey,
} from './signal.js'
import type { PreKeyBundleInput } from './signal.js'

const enc = new TextEncoder()
const dec = new TextDecoder()

async function makeDevice(regId: number) {
	const identity = newIdentityKeyPair()
	const storage = new MemorySignalStorage(identity, regId)
	const signed = newSignedPreKey(identity.privateKey, 1)
	const [pre] = newPreKeys(100, 1)
	await storage.storeSignedPreKey(signed.id, signed.record)
	await storage.storePreKey(pre!.id, pre!.record)
	const bundle: PreKeyBundleInput = {
		registrationId: regId,
		deviceId: 1,
		preKeyId: pre!.id,
		preKeyPublic: pre!.publicKey,
		signedPreKeyId: signed.id,
		signedPreKeyPublic: signed.publicKey,
		signedPreKeySignature: signed.signature,
		identityKey: identity.publicKey,
	}
	return { storage, cipher: createSignalCipher(storage), bundle }
}

describe('Signal 1:1 sessions', () => {
	it('establishes a session from a bundle and ratchets in both directions', async () => {
		const alice = await makeDevice(11)
		const bob = await makeDevice(22)

		expect(await alice.cipher.hasSession('bob', 1)).toBe(false)
		await alice.cipher.processPreKeyBundle('bob', 1, bob.bundle)
		expect(await alice.cipher.hasSession('bob', 1)).toBe(true)

		const first = await alice.cipher.encrypt('bob', 1, enc.encode('hi bob'))
		expect(first.type).toBe('pkmsg')
		const got = await bob.cipher.decrypt('alice', 1, first.type, first.ciphertext)
		expect(dec.decode(got.plaintext)).toBe('hi bob')
		expect(got.preKeyId).toBe(100)
		await bob.storage.removePreKey(got.preKeyId!)

		const reply = await bob.cipher.encrypt('alice', 1, enc.encode('hi alice'))
		expect(reply.type).toBe('msg')
		const back = await alice.cipher.decrypt('bob', 1, reply.type, reply.ciphertext)
		expect(dec.decode(back.plaintext)).toBe('hi alice')

		for (let i = 0; i < 5; i++) {
			const m = await alice.cipher.encrypt('bob', 1, enc.encode(`n${i}`))
			expect(m.type).toBe('msg')
			expect(
				dec.decode((await bob.cipher.decrypt('alice', 1, m.type, m.ciphertext)).plaintext),
			).toBe(`n${i}`)
		}
	})

	it('decrypts out-of-order messages and rejects replays', async () => {
		const alice = await makeDevice(1)
		const bob = await makeDevice(2)
		await alice.cipher.processPreKeyBundle('bob', 1, bob.bundle)
		const m1 = await alice.cipher.encrypt('bob', 1, enc.encode('one'))
		await bob.cipher.decrypt('alice', 1, m1.type, m1.ciphertext)
		const m2 = await alice.cipher.encrypt('bob', 1, enc.encode('two'))
		const m3 = await alice.cipher.encrypt('bob', 1, enc.encode('three'))
		expect(
			dec.decode((await bob.cipher.decrypt('alice', 1, m3.type, m3.ciphertext)).plaintext),
		).toBe('three')
		expect(
			dec.decode((await bob.cipher.decrypt('alice', 1, m2.type, m2.ciphertext)).plaintext),
		).toBe('two')
		await expect(bob.cipher.decrypt('alice', 1, m3.type, m3.ciphertext)).rejects.toThrow()
	})

	it('rejects a bundle with a bad signed-prekey signature', async () => {
		const alice = await makeDevice(1)
		const bob = await makeDevice(2)
		const bad = { ...bob.bundle, signedPreKeySignature: new Uint8Array(64) }
		await expect(alice.cipher.processPreKeyBundle('bob', 1, bad)).rejects.toThrow()
	})

	it('surfaces storage failures instead of swallowing them', async () => {
		const alice = await makeDevice(1)
		const bob = await makeDevice(2)
		await alice.cipher.processPreKeyBundle('bob', 1, bob.bundle)
		alice.storage.storeSession = () => Promise.reject(new Error('disk full'))
		await expect(alice.cipher.encrypt('bob', 1, enc.encode('x'))).rejects.toThrow(/disk full/)
	})

	it('fails to decrypt a tampered ciphertext', async () => {
		const alice = await makeDevice(1)
		const bob = await makeDevice(2)
		await alice.cipher.processPreKeyBundle('bob', 1, bob.bundle)
		const m = await alice.cipher.encrypt('bob', 1, enc.encode('x'))
		const bad = m.ciphertext.slice()
		bad[bad.length - 1] ^= 1
		await expect(bob.cipher.decrypt('alice', 1, m.type, bad)).rejects.toThrow()
	})
})

describe('Signal group sender keys', () => {
	it('distributes a sender key and decrypts group messages in order and out of order', async () => {
		const alice = await makeDevice(1)
		const bob = await makeDevice(2)
		const skdm = await alice.cipher.createSenderKeyDistribution('group@g.us', 'alice.1')
		await bob.cipher.processSenderKeyDistribution('group@g.us', 'alice.1', skdm)

		const a = await alice.cipher.groupEncrypt('group@g.us', 'alice.1', enc.encode('first'))
		const b = await alice.cipher.groupEncrypt('group@g.us', 'alice.1', enc.encode('second'))
		expect(dec.decode(await bob.cipher.groupDecrypt('group@g.us', 'alice.1', b))).toBe('second')
		expect(dec.decode(await bob.cipher.groupDecrypt('group@g.us', 'alice.1', a))).toBe('first')
	})

	it('cannot decrypt without the distribution message', async () => {
		const alice = await makeDevice(1)
		const carol = await makeDevice(3)
		await alice.cipher.createSenderKeyDistribution('g', 'alice.1')
		const m = await alice.cipher.groupEncrypt('g', 'alice.1', enc.encode('x'))
		await expect(carol.cipher.groupDecrypt('g', 'alice.1', m)).rejects.toThrow()
	})
})

describe('serialized cipher', () => {
	it('survives many overlapping calls (no re-entrancy error, every message decrypts in order)', async () => {
		const alice = await makeDevice(1)
		const bob = await makeDevice(2)
		await alice.cipher.processPreKeyBundle('bob', 1, bob.bundle)
		const encs = await Promise.all(
			Array.from({ length: 20 }, (_, i) => alice.cipher.encrypt('bob', 1, enc.encode(`m${i}`))),
		)
		const plain = await Promise.all(
			encs.map((m) => bob.cipher.decrypt('alice', 1, m.type, m.ciphertext)),
		)
		expect(plain.map((p) => dec.decode(p.plaintext))).toEqual(
			Array.from({ length: 20 }, (_, i) => `m${i}`),
		)
	})
})
