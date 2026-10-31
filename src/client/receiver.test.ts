import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { initAuthCreds } from '../auth/creds.js'
import { FileSignalStorage } from '../auth/file-signal-storage.js'
import type { BinaryNode } from '../codec/index.js'
import {
	MemorySignalStorage,
	createSignalCipher,
	newIdentityKeyPair,
	newPreKeys,
} from '../crypto/signal.js'
import { ProtocolLogger } from '../logging/protocol-logger.js'
import { encodeProto } from './proto.js'
import { Receiver, buildAck, unpadRandomMax16 } from './receiver.js'
import type { DecodedMessage } from './receiver.js'

const pad = (b: Uint8Array) => {
	const n = 7
	return Uint8Array.from([...b, ...new Array(n).fill(n)])
}

async function setup() {
	const creds = initAuthCreds()
	creds.me = { id: '4915600000000:23@s.whatsapp.net' }
	creds.account = new Uint8Array([1, 2, 3])
	const storage = new FileSignalStorage(
		mkdtempSync(join(tmpdir(), 'velowa-sig-')),
		creds.signedIdentityKey,
		creds.registrationId,
	)
	await storage.storeSignedPreKey(creds.signedPreKey.keyId, creds.signedPreKey.record)
	const [pre] = newPreKeys(creds.nextPreKeyId, 1)
	await storage.storePreKey(pre!.id, pre!.record)
	creds.nextPreKeyId += 1
	const sent: BinaryNode[] = []
	const messages: DecodedMessage[] = []
	const receiver = new Receiver({
		creds,
		saveCreds() {},
		storage,
		cipher: createSignalCipher(storage),
		logger: new ProtocolLogger({ enabled: false }),
		send: (n) => sent.push(n),
		onMessage: (m) => messages.push(m),
	})
	// Alice: an independent device that builds a session to us from our bundle.
	const aliceId = newIdentityKeyPair()
	const aliceStorage = new MemorySignalStorage(aliceId, 777)
	const alice = createSignalCipher(aliceStorage)
	await alice.processPreKeyBundle('bob', 1, {
		registrationId: creds.registrationId,
		deviceId: 1,
		preKeyId: pre!.id,
		preKeyPublic: pre!.publicKey,
		signedPreKeyId: creds.signedPreKey.keyId,
		signedPreKeyPublic: creds.signedPreKey.publicKey,
		signedPreKeySignature: creds.signedPreKey.signature,
		identityKey: creds.signedIdentityKey.publicKey,
	})
	return { creds, storage, receiver, sent, messages, alice, preId: pre!.id }
}

const text = (conversation: string, extra: object = {}) =>
	encodeProto('Message', { conversation, ...extra })

describe('Receiver: 1:1 messages', () => {
	it('decrypts a pkmsg, removes the used pre-key, sends receipt and ack', async () => {
		const { receiver, sent, messages, alice, storage, preId, creds } = await setup()
		const enc = await alice.encrypt('bob', 1, pad(text('hello')))
		expect(enc.type).toBe('pkmsg')
		receiver.handle({
			tag: 'message',
			attrs: {
				from: 'alice:2@s.whatsapp.net',
				id: 'M1',
				type: 'text',
				t: '1700000000',
				notify: 'Alice',
			},
			content: [{ tag: 'enc', attrs: { v: '2', type: enc.type }, content: enc.ciphertext }],
		})
		await receiver.idle()
		expect(messages).toHaveLength(1)
		expect(messages[0]!.message['conversation']).toBe('hello')
		expect(messages[0]!.pushName).toBe('Alice')
		expect(await storage.loadPreKey(preId)).toBeUndefined()
		expect(sent.map((n) => n.tag)).toEqual(['receipt', 'ack'])
		expect(sent[0]!.attrs).toEqual({ id: 'M1', to: 'alice:2@s.whatsapp.net' })
		expect(sent[1]!.attrs).toEqual({
			id: 'M1',
			to: 'alice:2@s.whatsapp.net',
			class: 'message',
			type: 'text',
			from: creds.me!.id,
		})
	})

	it('decrypts follow-up messages on the established session', async () => {
		const { receiver, messages, alice } = await setup()
		for (const [i, body] of ['one', 'two'].entries()) {
			const enc = await alice.encrypt('bob', 1, pad(text(body)))
			receiver.handle({
				tag: 'message',
				attrs: { from: 'alice:2@s.whatsapp.net', id: `M${i}`, type: 'text' },
				content: [{ tag: 'enc', attrs: { v: '2', type: enc.type }, content: enc.ciphertext }],
			})
		}
		await receiver.idle()
		expect(messages.map((m) => m.message['conversation'])).toEqual(['one', 'two'])
	})
})

describe('Receiver: group messages', () => {
	it('installs the sender key from the pkmsg even when the skmsg is listed first', async () => {
		const { receiver, sent, messages, alice } = await setup()
		const group = '120363000000000000@g.us'
		const author = 'alice:2@s.whatsapp.net'
		const skdm = await alice.createSenderKeyDistribution(group, 'alice.2')
		const pk = await alice.encrypt(
			'bob',
			1,
			pad(
				text('', {
					senderKeyDistributionMessage: {
						groupId: group,
						axolotlSenderKeyDistributionMessage: skdm,
					},
				}),
			),
		)
		const sk = await alice.groupEncrypt(group, 'alice.2', pad(text('group hi')))
		receiver.handle({
			tag: 'message',
			attrs: { from: group, participant: author, id: 'G1', type: 'text' },
			content: [
				{ tag: 'enc', attrs: { v: '2', type: 'skmsg' }, content: sk },
				{ tag: 'enc', attrs: { v: '2', type: pk.type }, content: pk.ciphertext },
			],
		})
		await receiver.idle()
		expect(messages.map((m) => m.message['conversation'])).toEqual(['', 'group hi'])
		expect(sent.find((n) => n.tag === 'receipt')!.attrs).toEqual({
			id: 'G1',
			to: group,
			participant: author,
		})
		expect(sent.at(-1)!.attrs['participant']).toBe(author)
	})
})

describe('Receiver: failures', () => {
	it('sends a retry receipt (keys from the 2nd attempt) and still acks', async () => {
		const { receiver, sent, messages } = await setup()
		const stanza: BinaryNode = {
			tag: 'message',
			attrs: { from: 'carol:1@s.whatsapp.net', id: 'X1', type: 'text', t: '1700000001' },
			content: [
				{ tag: 'enc', attrs: { v: '2', type: 'msg' }, content: new Uint8Array(40).fill(9) },
			],
		}
		receiver.handle(stanza)
		receiver.handle(stanza)
		await receiver.idle()
		expect(messages).toHaveLength(0)
		const retries = sent.filter((n) => n.tag === 'receipt')
		expect(retries).toHaveLength(2)
		expect(retries[0]!.attrs['type']).toBe('retry')
		const first = (retries[0]!.content as BinaryNode[]).map((c) => c.tag)
		const second = (retries[1]!.content as BinaryNode[]).map((c) => c.tag)
		expect(first).toEqual(['retry', 'registration'])
		expect(second).toEqual(['retry', 'registration', 'keys'])
		expect(sent.filter((n) => n.tag === 'ack')).toHaveLength(2)
		expect(sent.some((n) => n.tag === 'receipt' && n.attrs['type'] === undefined)).toBe(false)
	})
})

describe('Receiver: unsupported envelopes', () => {
	it('acks an msmsg without asking for a retry', async () => {
		const { receiver, sent, messages } = await setup()
		receiver.handle({
			tag: 'message',
			attrs: { from: 'g@g.us', participant: 'bot@bot', id: 'B1', type: 'reaction' },
			content: [{ tag: 'enc', attrs: { v: '2', type: 'msmsg' }, content: new Uint8Array(20) }],
		})
		await receiver.idle()
		expect(messages).toHaveLength(0)
		expect(sent.map((n) => n.tag)).toEqual(['ack'])
	})
})

describe('Receiver: pre-keys', () => {
	it('uploads a batch when the server count is low and persists the id counter', async () => {
		const creds = initAuthCreds()
		const storage = new FileSignalStorage(
			mkdtempSync(join(tmpdir(), 'velowa-sig-')),
			creds.signedIdentityKey,
			creds.registrationId,
		)
		const sent: BinaryNode[] = []
		const receiver: Receiver = new Receiver({
			creds,
			saveCreds() {},
			storage,
			cipher: createSignalCipher(storage),
			logger: new ProtocolLogger({ enabled: false }),
			send: (n) => {
				sent.push(n)
				const content =
					n.attrs['type'] === 'get' ? [{ tag: 'count', attrs: { value: '0' } }] : undefined
				queueMicrotask(() =>
					receiver.handle({
						tag: 'iq',
						attrs: { id: n.attrs['id']!, type: 'result', from: 's.whatsapp.net' },
						...(content && { content }),
					}),
				)
			},
		})
		await receiver.ensurePreKeys()
		const upload = sent.find((n) => n.attrs['type'] === 'set')!
		expect(upload.attrs['xmlns']).toBe('encrypt')
		const parts = upload.content as BinaryNode[]
		expect(parts.map((p) => p.tag)).toEqual(['registration', 'type', 'identity', 'list', 'skey'])
		const list = parts[3]!.content as BinaryNode[]
		expect(list).toHaveLength(30)
		expect(Array.from((list[0]!.content as BinaryNode[])[0]!.content as Uint8Array)).toEqual([
			0, 0, 1,
		])
		expect(creds.nextPreKeyId).toBe(31)
		expect(await storage.loadPreKey(30)).toBeDefined()
	})

	it('does not upload when the server still has enough', async () => {
		const creds = initAuthCreds()
		const storage = new FileSignalStorage(
			mkdtempSync(join(tmpdir(), 'velowa-sig-')),
			creds.signedIdentityKey,
			creds.registrationId,
		)
		const sent: BinaryNode[] = []
		const receiver: Receiver = new Receiver({
			creds,
			saveCreds() {},
			storage,
			cipher: createSignalCipher(storage),
			logger: new ProtocolLogger({ enabled: false }),
			send: (n) => {
				sent.push(n)
				queueMicrotask(() =>
					receiver.handle({
						tag: 'iq',
						attrs: { id: n.attrs['id']!, type: 'result' },
						content: [{ tag: 'count', attrs: { value: '50' } }],
					}),
				)
			},
		})
		await receiver.ensurePreKeys()
		expect(sent).toHaveLength(1)
		expect(creds.nextPreKeyId).toBe(1)
	})
})

describe('helpers', () => {
	it('unpads and rejects bad padding', () => {
		expect(Array.from(unpadRandomMax16(Uint8Array.from([1, 2, 3, 2, 2])))).toEqual([1, 2, 3])
		expect(() => unpadRandomMax16(Uint8Array.from([1, 2, 0]))).toThrow()
		expect(() => unpadRandomMax16(Uint8Array.from([1, 99]))).toThrow()
		expect(() => unpadRandomMax16(new Uint8Array())).toThrow()
	})

	it('builds acks like WA Web', () => {
		const ack = buildAck({
			tag: 'receipt',
			attrs: { id: 'r', from: 'g@g.us', participant: 'p@lid', type: 'read' },
		})
		expect(ack).toEqual({
			tag: 'ack',
			attrs: { id: 'r', to: 'g@g.us', class: 'receipt', participant: 'p@lid', type: 'read' },
		})
	})
})
