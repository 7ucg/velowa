import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { initAuthCreds } from '../../src/auth/creds.js'
import { FileSignalStorage } from '../../src/auth/file-signal-storage.js'
import type { BinaryNode } from '../../src/codec/index.js'
import {
	MemorySignalStorage,
	createSignalCipher,
	newIdentityKeyPair,
	newPreKeys,
	newSignedPreKey,
} from '../../src/crypto/signal.js'
import { LidMap } from '../../src/client/lid-map.js'
import { ProtocolLogger } from '../../src/logging/protocol-logger.js'
import { protoType } from '../../src/client/proto.js'
import { Receiver, unpadRandomMax16 } from '../../src/client/receiver.js'
import { Sender } from '../../src/client/sender.js'

// Test kit: a fake server plus remote devices with real keys, so outgoing stanzas can be decrypted end to end.
export const kids = (n: BinaryNode, tag?: string) =>
	Array.isArray(n.content) ? n.content.filter((c) => !tag || c.tag === tag) : []
const be = (n: number, len: number) => {
	const b = Buffer.alloc(len)
	b.writeUIntBE(n, 0, len)
	return b
}

/** A remote device with its own keys; answers pre-key fetches and decrypts what we send it. */
export async function remoteDevice(jid: string, regId: number) {
	const identity = newIdentityKeyPair()
	const storage = new MemorySignalStorage(identity, regId)
	const signed = newSignedPreKey(identity.privateKey, 1)
	const [pre] = newPreKeys(100, 1)
	await storage.storeSignedPreKey(signed.id, signed.record)
	await storage.storePreKey(pre!.id, pre!.record)
	const userNode: BinaryNode = {
		tag: 'user',
		attrs: { jid },
		content: [
			{ tag: 'registration', attrs: {}, content: be(regId, 4) },
			{ tag: 'identity', attrs: {}, content: identity.publicKey },
			{
				tag: 'key',
				attrs: {},
				content: [
					{ tag: 'id', attrs: {}, content: be(pre!.id, 3) },
					{ tag: 'value', attrs: {}, content: pre!.publicKey },
				],
			},
			{
				tag: 'skey',
				attrs: {},
				content: [
					{ tag: 'id', attrs: {}, content: be(signed.id, 3) },
					{ tag: 'value', attrs: {}, content: signed.publicKey },
					{ tag: 'signature', attrs: {}, content: signed.signature },
				],
			},
		],
	}
	return { jid, cipher: createSignalCipher(storage), userNode }
}

export async function world(opts: { ackError?: string; emptyUsyncFor?: string[] } = {}) {
	const creds = initAuthCreds()
	creds.me = { id: '4915600000000:23@s.whatsapp.net', lid: '111111111111:23@lid' }
	creds.account = new Uint8Array([7, 7, 7])
	const dir = mkdtempSync(join(tmpdir(), 'velowa-send-'))
	const storage = new FileSignalStorage(
		join(dir, 'signal'),
		creds.signedIdentityKey,
		creds.registrationId,
	)
	const phone = await remoteDevice('4915600000000@s.whatsapp.net', 1)
	const bob0 = await remoteDevice('4915611111111@s.whatsapp.net', 2)
	const bob1 = await remoteDevice('4915611111111:1@s.whatsapp.net', 3)
	const remotes = [phone, bob0, bob1]
	const stanzas: BinaryNode[] = []
	// eslint-disable-next-line prefer-const -- assigned after the closure that references it
	let receiver!: Receiver
	const reply = (
		id: string,
		node: Omit<BinaryNode, 'attrs'> & { attrs?: Record<string, string> },
	) =>
		queueMicrotask(() =>
			receiver.handle({ ...node, attrs: { id, from: 's.whatsapp.net', ...node.attrs } }),
		)
	const lids = new LidMap()
	receiver = new Receiver({
		creds,
		saveCreds() {},
		lids,
		storage,
		cipher: createSignalCipher(storage),
		logger: new ProtocolLogger({ enabled: false }),
		send(n) {
			const id = n.attrs['id'] ?? ''
			if (n.tag === 'message') {
				stanzas.push(n)
				return reply(id, {
					tag: 'ack',
					attrs: { class: 'message', ...(opts.ackError && { error: opts.ackError }) },
				})
			}
			const ns = n.attrs['xmlns']
			if (ns === 'usync') {
				const requested = kids(kids(kids(n, 'usync')[0]!, 'list')[0]!, 'user').map(
					(u) => u.attrs['jid']!,
				)
				const users = requested.map((jid) => {
					if (opts.emptyUsyncFor?.includes(jid))
						return { tag: 'user', attrs: { jid }, content: [] } as BinaryNode
					const mine = jid.startsWith('4915600000000')
					const devs = mine
						? [{ id: '0' }, { id: '23', 'key-index': '2' }]
						: [{ id: '0' }, { id: '1', 'key-index': '1' }]
					return {
						tag: 'user',
						attrs: { jid },
						content: [
							{
								tag: 'devices',
								attrs: {},
								content: [
									{
										tag: 'device-list',
										attrs: {},
										content: devs.map((a) => ({ tag: 'device', attrs: a })),
									},
								],
							},
						],
					} as BinaryNode
				})
				return reply(id, {
					tag: 'iq',
					attrs: { type: 'result' },
					content: [
						{ tag: 'usync', attrs: {}, content: [{ tag: 'list', attrs: {}, content: users }] },
					],
				})
			}
			if (ns === 'encrypt') {
				const wanted = kids(kids(n, 'key')[0]!, 'user').map((u) => u.attrs['jid']!)
				// The real server always knows the LID<->PN pairing it issued, whichever form a prekey fetch
				// names; `remotes` below is keyed by PN, so translate back using whatever this test told `lids`.
				const toPn = (j: string) => {
					if (!j.endsWith('@lid')) return j
					const [lidUser, device] = j.replace('@lid', '').split(':')
					const pnUser = lids.pnUser(lidUser!)
					if (!pnUser) return j
					return device ? `${pnUser}:${device}@s.whatsapp.net` : `${pnUser}@s.whatsapp.net`
				}
				const found = remotes
					.filter((r) => wanted.map(toPn).includes(r.jid))
					.map((r) => ({ ...r.userNode, attrs: { jid: wanted.find((w) => toPn(w) === r.jid)! } }))
				return reply(id, {
					tag: 'iq',
					attrs: { type: 'result' },
					content: [{ tag: 'list', attrs: {}, content: found }],
				})
			}
			if (ns === 'w:g2') {
				const parts = [bob0, bob1].map(
					(r) => ({ tag: 'participant', attrs: { jid: r.jid.replace(/:\d+/, '') } }) as BinaryNode,
				)
				return reply(id, {
					tag: 'iq',
					attrs: { type: 'result' },
					content: [{ tag: 'group', attrs: { addressing_mode: 'pn' }, content: [parts[0]!] }],
				})
			}
		},
	})
	const sender = new Sender({
		creds,
		storage,
		lids,
		cipher: createSignalCipher(storage),
		receiver,
		logger: new ProtocolLogger({ enabled: false }),
		senderKeyMemoryPath: join(dir, 'sk.json'),
	})
	return { sender, stanzas, phone, bob0, bob1, creds, lids }
}

export const decodeMsg = (plain: Uint8Array) =>
	protoType('Message').toObject(protoType('Message').decode(unpadRandomMax16(plain)), {
		defaults: false,
	}) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
