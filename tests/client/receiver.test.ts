import { createCipheriv, createHash, createHmac, hkdfSync } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { initAuthCreds } from '../../src/auth/creds.js'
import { FileSignalStorage } from '../../src/auth/file-signal-storage.js'
import type { BinaryNode } from '../../src/codec/index.js'
import {
	MemorySignalStorage,
	createSignalCipher,
	newIdentityKeyPair,
	newPreKeys,
} from '../../src/crypto/signal.js'
import { LidMap } from '../../src/client/lid-map.js'
import { ProtocolLogger } from '../../src/logging/protocol-logger.js'
import { encodeProto } from '../../src/client/proto.js'
import {
	Receiver,
	buildAck,
	noteLidFromAttrs,
	unpadRandomMax16,
} from '../../src/client/receiver.js'
import type { DecodedMessage } from '../../src/client/receiver.js'

const pad = (b: Uint8Array) => {
	const n = 7
	return Uint8Array.from([...b, ...new Array(n).fill(n)])
}

async function setup() {
	const creds = initAuthCreds()
	creds.me = { id: '4915600000000:23@s.whatsapp.net', lid: '48699911223344:23@lid' }
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
	const undecryptable: { remoteJid: string; id: string; participant?: string }[] = []
	const receiver = new Receiver({
		creds,
		saveCreds() {},
		lids: new LidMap(),
		storage,
		cipher: createSignalCipher(storage),
		logger: new ProtocolLogger({ enabled: false }),
		send: (n) => sent.push(n),
		onMessage: (m) => messages.push(m),
		onUndecryptable: (k) => undecryptable.push(k),
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
	return { creds, storage, receiver, sent, messages, undecryptable, alice, preId: pre!.id }
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

describe('Receiver: giving up', () => {
	it('reports a message once the sender retries ran out, so it can be asked for from the phone', async () => {
		const { receiver, undecryptable } = await setup()
		const stanza: BinaryNode = {
			tag: 'message',
			attrs: {
				from: '120363000000000001@g.us',
				participant: 'carol:1@s.whatsapp.net',
				id: 'GIVEUP1',
				type: 'text',
				t: '1700000001',
			},
			content: [
				{ tag: 'enc', attrs: { v: '2', type: 'msg' }, content: new Uint8Array(40).fill(9) },
			],
		}
		for (let i = 0; i < 5; i++) receiver.handle(stanza)
		await receiver.idle()
		expect(undecryptable).toHaveLength(0) // the retries are still being sent
		receiver.handle(stanza)
		await receiver.idle()
		expect(undecryptable).toEqual([
			{
				remoteJid: '120363000000000001@g.us',
				id: 'GIVEUP1',
				fromMe: false,
				participant: 'carol:1@s.whatsapp.net',
			},
		])
	})
})

describe('Receiver: Meta AI msmsg', () => {
	function encryptMsmsg(
		secret: Buffer,
		botJid: string,
		ctx: { id: string; target: string },
		plain: Uint8Array,
	) {
		const k1 = Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), 'Bot Message', 32))
		const id = Buffer.from(ctx.id)
		const bot = Buffer.from(botJid)
		const key = Buffer.from(
			hkdfSync(
				'sha256',
				k1,
				Buffer.alloc(0),
				Buffer.concat([id, Buffer.from(ctx.target), bot]),
				32,
			),
		)
		const iv = Buffer.alloc(12, 3)
		const c = createCipheriv('aes-256-gcm', key, iv)
		c.setAAD(Buffer.concat([id, Buffer.from([0]), bot]))
		const payload = Buffer.concat([c.update(plain), c.final(), c.getAuthTag()])
		return encodeProto('MessageSecretMessage', { version: 2, encIv: iv, encPayload: payload })
	}

	it('decrypts a bot reply using the secret of the message it answers (1:1 chat: bot is `from`)', async () => {
		const { receiver, sent, messages, alice, creds } = await setup()
		const secret = Buffer.alloc(32, 5)
		// 1) the original message (carrying messageContextInfo.messageSecret) arrives and is remembered
		const orig = await alice.encrypt(
			'bob',
			1,
			pad(text('@meta ai hi', { messageContextInfo: { messageSecret: secret } })),
		)
		receiver.handle({
			tag: 'message',
			attrs: { from: 'alice:2@s.whatsapp.net', id: 'ORIG1', type: 'text' },
			content: [{ tag: 'enc', attrs: { v: '2', type: orig.type }, content: orig.ciphertext }],
		})
		// 2) the bot answers
		const bot = '867051314767696@bot'
		const target = creds.me!.lid!
		const answer = encryptMsmsg(
			secret,
			bot,
			{ id: 'BOTMSG1', target: target.replace(/:\d+@/, '@') },
			text('42'),
		)
		receiver.handle({
			tag: 'message',
			attrs: { from: bot, id: 'BOTMSG1', type: 'text' },
			content: [
				{ tag: 'meta', attrs: { target_id: 'ORIG1' } },
				{ tag: 'bot', attrs: { edit: 'full', edit_target_id: '' } },
				{ tag: 'enc', attrs: { v: '2', type: 'msmsg' }, content: answer },
			],
		})
		await receiver.idle()
		expect(messages.map((m) => m.message['conversation'])).toEqual(['@meta ai hi', '42'])
		expect(messages[1]!.message['metaAiText']).toBe('42')
		expect(sent.filter((n) => n.tag === 'receipt' && n.attrs['type'] === 'retry')).toHaveLength(0)
	})

	it('acks an msmsg whose original secret is unknown, without a retry', async () => {
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

	it('still retries a failed Signal envelope that sits next to an msmsg child', async () => {
		const { receiver, sent } = await setup()
		receiver.handle({
			tag: 'message',
			attrs: { from: 'carol:1@s.whatsapp.net', id: 'M9', type: 'text', t: '1' },
			content: [
				{ tag: 'enc', attrs: { v: '2', type: 'msmsg' }, content: new Uint8Array(20) },
				{ tag: 'enc', attrs: { v: '2', type: 'msg' }, content: new Uint8Array(40).fill(9) },
			],
		})
		await receiver.idle()
		expect(sent.some((n) => n.tag === 'receipt' && n.attrs['type'] === 'retry')).toBe(true)
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
			lids: new LidMap(),
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
			lids: new LidMap(),
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

	it('learns the PN from a LID-addressed stanza carrying a *_pn cross-reference', () => {
		const lids = new LidMap()
		noteLidFromAttrs(
			{
				from: '34111111111111@lid',
				addressing_mode: 'lid',
				sender_pn: '34600000000@s.whatsapp.net',
			},
			lids,
		)
		expect(lids.pnUser('34111111111111')).toBe('34600000000')
	})

	it('learns the LID from a legacy PN-addressed stanza carrying a *_lid cross-reference', () => {
		const lids = new LidMap()
		noteLidFromAttrs(
			{ participant: '34600000000@s.whatsapp.net', participant_lid: '34111111111111@lid' },
			lids,
		)
		expect(lids.lidUser('34600000000')).toBe('34111111111111')
	})

	it('prefers participant over from, and is a no-op without either', () => {
		const lids = new LidMap()
		noteLidFromAttrs(
			{
				from: 'g@g.us',
				participant: '34111111111111@lid',
				participant_pn: '34600000000@s.whatsapp.net',
			},
			lids,
		)
		expect(lids.pnUser('34111111111111')).toBe('34600000000')

		const empty = new LidMap()
		noteLidFromAttrs({ id: 'x' }, empty)
		expect(empty.pnUser('34111111111111')).toBeUndefined()
	})

	it('is a no-op when no alt cross-reference attribute is present', () => {
		const lids = new LidMap()
		noteLidFromAttrs({ from: '34111111111111@lid', addressing_mode: 'lid' }, lids)
		expect(lids.pnUser('34111111111111')).toBeUndefined()
	})
})

describe('Receiver: app-state key shares', () => {
	async function shareFrom(authorJid: string, category: string | undefined = 'peer') {
		const keys: { keyId: Uint8Array; keyData: Uint8Array }[][] = []
		const w = await setup()
		const share = text('', {
			protocolMessage: {
				type: 'APP_STATE_SYNC_KEY_SHARE',
				appStateSyncKeyShare: {
					keys: [{ keyId: { keyId: Buffer.from([1]) }, keyData: { keyData: Buffer.alloc(32, 5) } }],
				},
			},
		})
		const enc = await w.alice.encrypt('bob', 1, pad(share))
		const withHook = new Receiver({
			creds: w.creds,
			saveCreds() {},
			lids: new LidMap(),
			storage: w.storage,
			cipher: createSignalCipher(w.storage),
			logger: new ProtocolLogger({ enabled: false }),
			send: () => {},
			onAppStateKeys: (k) => keys.push(k),
		})
		withHook.handle({
			tag: 'message',
			attrs: { from: authorJid, id: 'K1', type: 'text', ...(category && { category }) },
			content: [{ tag: 'enc', attrs: { v: '2', type: enc.type }, content: enc.ciphertext }],
		})
		await withHook.idle()
		return keys
	}

	it('accepts keys from our own account (phone, by LID or number)', async () => {
		expect(await shareFrom('48699911223344@lid')).toHaveLength(1)
	})

	it('drops keys that do not arrive as a peer message, even from our own account', async () => {
		expect(await shareFrom('48699911223344@lid', '')).toHaveLength(0)
	})

	it('does not treat the same digits in another address family as ours', async () => {
		expect(await shareFrom('48699911223344@s.whatsapp.net')).toHaveLength(0)
	})

	it('drops keys shared by anyone else', async () => {
		expect(await shareFrom('4915699999999@s.whatsapp.net')).toHaveLength(0)
	})
})

describe('Receiver: channel posts', () => {
	it('decodes <plaintext> posts without padding and without a delivery receipt', async () => {
		const { receiver, sent, messages } = await setup()
		receiver.handle({
			tag: 'message',
			attrs: { from: '1203630000@newsletter', id: 'N1', type: 'text', server_id: '77' },
			content: [{ tag: 'plaintext', attrs: {}, content: text('post') }],
		})
		await receiver.idle()
		expect(messages[0]!.message['conversation']).toBe('post')
		expect(sent.map((n) => n.tag)).toEqual(['ack'])
	})

	it('does not ask for a retry when a plaintext post is malformed', async () => {
		const { receiver, sent } = await setup()
		receiver.handle({
			tag: 'message',
			attrs: { from: '1203630000@newsletter', id: 'N2', type: 'text' },
			content: [{ tag: 'plaintext', attrs: {}, content: new Uint8Array([0xff, 0xff, 0xff]) }],
		})
		await receiver.idle()
		expect(sent.some((n) => n.attrs['type'] === 'retry')).toBe(false)
	})
})

describe('Receiver: poll votes', () => {
	// Independent oracle: the HMAC form of the key derivation, written out as the reference does it.
	function encryptVote(
		secret: Buffer,
		pollId: string,
		creator: string,
		voter: string,
		hashes: Buffer[],
	) {
		const sign = Buffer.concat([
			Buffer.from(pollId),
			Buffer.from(creator),
			Buffer.from(voter),
			Buffer.from('Poll Vote'),
			Buffer.from([1]),
		])
		const key0 = createHmac('sha256', Buffer.alloc(32)).update(secret).digest()
		const key = createHmac('sha256', key0).update(sign).digest()
		const iv = Buffer.alloc(12, 4)
		const c = createCipheriv('aes-256-gcm', key, iv)
		c.setAAD(Buffer.from(`${pollId}\0${voter}`))
		const plain = Buffer.concat(
			hashes.map((h) => Buffer.concat([Buffer.from([0x0a, h.length]), h])),
		)
		return { encPayload: Buffer.concat([c.update(plain), c.final(), c.getAuthTag()]), encIv: iv }
	}

	it('decrypts a vote on a poll we sent and maps hashes to option names', async () => {
		const { receiver, messages, alice } = await setup()
		const secret = Buffer.alloc(32, 8)
		const pollId = '3EB0POLL1'
		receiver.rememberOwn(pollId, 'alice:2@s.whatsapp.net', {
			messageContextInfo: { messageSecret: secret },
			pollCreationMessageV3: {
				name: 'Pizza?',
				options: [{ optionName: 'Ja' }, { optionName: 'Nein' }],
			},
		})
		const voter = 'alice:2@s.whatsapp.net'
		const vote = encryptVote(secret, pollId, '4915600000000:23@s.whatsapp.net', voter, [
			createHash('sha256').update('Nein').digest(),
		])
		const enc = await alice.encrypt(
			'bob',
			1,
			pad(
				text('', {
					pollUpdateMessage: {
						pollCreationMessageKey: { id: pollId, fromMe: true, remoteJid: voter },
						vote,
						senderTimestampMs: Date.now(),
					},
				}),
			),
		)
		receiver.handle({
			tag: 'message',
			attrs: { from: voter, id: 'V1', type: 'poll' },
			content: [{ tag: 'enc', attrs: { v: '2', type: enc.type }, content: enc.ciphertext }],
		})
		await receiver.idle()
		expect(messages[0]!.message['pollVote']).toEqual({
			pollId,
			selected: [createHash('sha256').update('Nein').digest('hex')],
			options: ['Nein'],
		})
	})

	it('reports a vote whose poll secret is unknown instead of failing the message', async () => {
		const { receiver, messages, alice } = await setup()
		const enc = await alice.encrypt(
			'bob',
			1,
			pad(
				text('', {
					pollUpdateMessage: {
						pollCreationMessageKey: { id: 'UNKNOWN', remoteJid: 'x' },
						vote: { encPayload: Buffer.alloc(40), encIv: Buffer.alloc(12) },
					},
				}),
			),
		)
		receiver.handle({
			tag: 'message',
			attrs: { from: 'alice:2@s.whatsapp.net', id: 'V2', type: 'poll' },
			content: [{ tag: 'enc', attrs: { v: '2', type: enc.type }, content: enc.ciphertext }],
		})
		await receiver.idle()
		expect(messages[0]!.message['pollVote']).toMatchObject({
			pollId: 'UNKNOWN',
			error: expect.stringContaining('unknown'),
		})
	})
})

describe('Receiver: poll data cannot be poisoned by peers', () => {
	it('a peer reusing the id of our poll changes neither its secret nor its options', async () => {
		const { receiver, messages, alice } = await setup()
		const secret = Buffer.alloc(32, 8)
		const pollId = '3EB0POLLX'
		receiver.rememberOwn(pollId, 'alice:2@s.whatsapp.net', {
			messageContextInfo: { messageSecret: secret },
			pollCreationMessageV3: {
				name: 'Echt?',
				options: [{ optionName: 'Ja' }, { optionName: 'Nein' }],
			},
		})
		// Mallory sends a message that reuses our poll's id, with a different secret and fake options
		const fake = await alice.encrypt(
			'bob',
			1,
			pad(
				text('', {
					messageContextInfo: { messageSecret: Buffer.alloc(32, 1) },
					pollCreationMessage: {
						name: 'Fake',
						options: [{ optionName: 'X' }, { optionName: 'Y' }],
					},
				}),
			),
		)
		receiver.handle({
			tag: 'message',
			attrs: { from: 'alice:2@s.whatsapp.net', id: pollId, type: 'text' },
			content: [{ tag: 'enc', attrs: { v: '2', type: fake.type }, content: fake.ciphertext }],
		})
		await receiver.idle()
		expect(messages).toHaveLength(1)

		const voter = 'alice:2@s.whatsapp.net'
		const sign = Buffer.concat([
			Buffer.from(pollId),
			Buffer.from('4915600000000:23@s.whatsapp.net'),
			Buffer.from(voter),
			Buffer.from('Poll Vote'),
			Buffer.from([1]),
		])
		const key = createHmac('sha256', createHmac('sha256', Buffer.alloc(32)).update(secret).digest())
			.update(sign)
			.digest()
		const iv = Buffer.alloc(12, 6)
		const c = createCipheriv('aes-256-gcm', key, iv)
		c.setAAD(Buffer.from(`${pollId}\0${voter}`))
		const h = createHash('sha256').update('Ja').digest()
		const encPayload = Buffer.concat([
			c.update(Buffer.concat([Buffer.from([0x0a, h.length]), h])),
			c.final(),
			c.getAuthTag(),
		])
		const enc = await alice.encrypt(
			'bob',
			1,
			pad(
				text('', {
					pollUpdateMessage: {
						pollCreationMessageKey: { id: pollId, fromMe: true, remoteJid: voter },
						vote: { encPayload, encIv: iv },
					},
				}),
			),
		)
		receiver.handle({
			tag: 'message',
			attrs: { from: voter, id: 'V9', type: 'poll' },
			content: [{ tag: 'enc', attrs: { v: '2', type: enc.type }, content: enc.ciphertext }],
		})
		await receiver.idle()
		expect(messages[1]!.message['pollVote']).toMatchObject({ pollId, options: ['Ja'] })
	})
})

describe('Receiver: two peers using the same poll id', () => {
	it("keeps each peer's poll separate and does not let the second overwrite the first", async () => {
		const { receiver, messages, alice } = await setup()
		const id = 'SAMEID'
		const send = async (from: string, name: string, secret: number, options: string[]) => {
			const enc = await alice.encrypt(
				'bob',
				1,
				pad(
					text('', {
						messageContextInfo: { messageSecret: Buffer.alloc(32, secret) },
						pollCreationMessageV3: { name, options: options.map((optionName) => ({ optionName })) },
					}),
				),
			)
			receiver.handle({
				tag: 'message',
				attrs: { from, id, type: 'poll' },
				content: [{ tag: 'enc', attrs: { v: '2', type: enc.type }, content: enc.ciphertext }],
			})
		}
		await send('alice:2@s.whatsapp.net', 'A', 1, ['a1', 'a2'])
		await send('alice:2@s.whatsapp.net', 'M', 2, ['m1', 'm2']) // same sender, same id, different content: the first one stays
		await receiver.idle()
		expect(messages).toHaveLength(2)
		// the secret of the first message with that id stays; the second does not replace it
		const secret = Buffer.alloc(32, 1)
		const voter = 'alice:2@s.whatsapp.net' // the only sender with a session in this fixture
		const sign = Buffer.concat([
			Buffer.from(id),
			Buffer.from('alice:2@s.whatsapp.net'),
			Buffer.from(voter),
			Buffer.from('Poll Vote'),
			Buffer.from([1]),
		])
		const key = createHmac('sha256', createHmac('sha256', Buffer.alloc(32)).update(secret).digest())
			.update(sign)
			.digest()
		const iv = Buffer.alloc(12, 2)
		const c = createCipheriv('aes-256-gcm', key, iv)
		c.setAAD(Buffer.from(`${id}\0${voter}`))
		const h = createHash('sha256').update('a2').digest()
		const encPayload = Buffer.concat([
			c.update(Buffer.concat([Buffer.from([0x0a, h.length]), h])),
			c.final(),
			c.getAuthTag(),
		])
		const enc = await alice.encrypt(
			'bob',
			1,
			pad(
				text('', {
					pollUpdateMessage: {
						pollCreationMessageKey: {
							id,
							participant: 'alice:2@s.whatsapp.net',
							remoteJid: 'g@g.us',
						},
						vote: { encPayload, encIv: iv },
					},
				}),
			),
		)
		receiver.handle({
			tag: 'message',
			attrs: { from: voter, id: 'VV', type: 'poll' },
			content: [{ tag: 'enc', attrs: { v: '2', type: enc.type }, content: enc.ciphertext }],
		})
		await receiver.idle()
		expect(messages[2]!.message['pollVote']).toMatchObject({ pollId: id, options: ['a2'] })
	})
})
