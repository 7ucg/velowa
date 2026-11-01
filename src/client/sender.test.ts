import { describe, expect, it } from 'vitest'
import { unpadRandomMax16 } from './receiver.js'
import { generateMessageId, padRandomMax16, participantHash } from './sender.js'
import { decodeMsg, kids, world } from './world.testkit.js'

describe('Sender: 1:1', () => {
	it('fans out to every device, wrapping our own devices in deviceSentMessage', async () => {
		const { sender, stanzas, phone, bob0, bob1 } = await world()
		const id = await sender.sendText('4915611111111@s.whatsapp.net', 'hello bob')
		expect(id).toMatch(/^3EB0[0-9A-F]{18}$/)
		const st = stanzas[0]!
		expect(st.attrs['to']).toBe('4915611111111@s.whatsapp.net')
		expect(st.attrs['type']).toBe('text')
		expect(st.attrs['id']).toBe(id)
		const parts = kids(kids(st, 'participants')[0]!, 'to')
		expect(parts.map((p) => p.attrs['jid']).sort()).toEqual(
			[
				'4915600000000@s.whatsapp.net',
				'4915611111111:1@s.whatsapp.net',
				'4915611111111@s.whatsapp.net',
			].sort(),
		)
		expect(st.attrs['phash']).toBeUndefined() // Baileys does not put phash on the stanza
		expect(kids(st, 'reporting')).toHaveLength(1)
		expect(kids(kids(st, 'reporting')[0]!, 'reporting_token')[0]!.attrs['v']).toBe('2')
		expect(kids(st, 'bot')[0]!.attrs).toEqual({ biz_bot: '1' })
		expect(kids(st, 'device-identity')).toHaveLength(1) // first contact => pkmsg => identity attached

		for (const dev of [bob0, bob1]) {
			const enc = kids(
				parts.find((p) => p.attrs['jid'] === dev.jid)!,
				'enc',
			)[0]!
			expect(enc.attrs['type']).toBe('pkmsg')
			const res = await dev.cipher.decrypt('4915600000000', 23, 'pkmsg', enc.content as Uint8Array)
			expect(decodeMsg(res.plaintext)['extendedTextMessage'].text).toBe('hello bob')
		}
		const phoneEnc = kids(
			parts.find((p) => p.attrs['jid'] === phone.jid)!,
			'enc',
		)[0]!
		const own = decodeMsg(
			(await phone.cipher.decrypt('4915600000000', 23, 'pkmsg', phoneEnc.content as Uint8Array))
				.plaintext,
		)
		expect(own['deviceSentMessage'].destinationJid).toBe('4915611111111@s.whatsapp.net')
		expect(own['deviceSentMessage'].message.extendedTextMessage.text).toBe('hello bob')
		expect(own['messageContextInfo'].messageSecret).toHaveLength(32)
	})

	it('keeps sending pkmsg until the peer answers, and every message decrypts in order', async () => {
		const { sender, stanzas, bob0 } = await world()
		await sender.sendText('4915611111111@s.whatsapp.net', 'one')
		await sender.sendText('4915611111111@s.whatsapp.net', 'two')
		const texts: string[] = []
		for (const st of stanzas) {
			const to = kids(kids(st, 'participants')[0]!, 'to').find((p) => p.attrs['jid'] === bob0.jid)!
			const enc = kids(to, 'enc')[0]!
			expect(enc.attrs['type']).toBe('pkmsg') // no reply from bob yet => still the pre-key form
			const res = await bob0.cipher.decrypt('4915600000000', 23, 'pkmsg', enc.content as Uint8Array)
			texts.push(decodeMsg(res.plaintext)['extendedTextMessage'].text)
		}
		expect(texts).toEqual(['one', 'two'])
	})

	it('sends to our own number: only our other devices, wrapped as deviceSentMessage', async () => {
		const { sender, stanzas, phone } = await world()
		await sender.sendText('4915600000000@s.whatsapp.net', 'note to self')
		const parts = kids(kids(stanzas[0]!, 'participants')[0]!, 'to')
		expect(parts.map((p) => p.attrs['jid'])).toEqual(['4915600000000@s.whatsapp.net'])
		const enc = kids(parts[0]!, 'enc')[0]!
		const msg = decodeMsg(
			(await phone.cipher.decrypt('4915600000000', 23, 'pkmsg', enc.content as Uint8Array))
				.plaintext,
		)
		expect(msg['deviceSentMessage'].message.extendedTextMessage.text).toBe('note to self')
	})

	it('rejects when the server answers with an ack error', async () => {
		const { sender } = await world({ ackError: '479' })
		await expect(sender.sendText('4915611111111@s.whatsapp.net', 'x')).rejects.toThrow(/479/)
	})
})

describe('Sender: groups', () => {
	it('distributes the sender key once, then sends only the skmsg', async () => {
		const { sender, stanzas, bob0, creds } = await world()
		const group = '120363000000000001@g.us'
		await sender.sendText(group, 'first')
		await sender.sendText(group, 'second')
		const [s1, s2] = stanzas
		expect(s1!.attrs['addressing_mode']).toBe('pn')
		expect(kids(s1!, 'participants')).toHaveLength(1)
		expect(kids(s2!, 'participants')).toHaveLength(0)
		// bob installs the distribution from the pkmsg, then decrypts both skmsgs
		const to = kids(kids(s1!, 'participants')[0]!, 'to').find((p) => p.attrs['jid'] === bob0.jid)!
		const enc = kids(to, 'enc')[0]!
		const dist = await bob0.cipher.decrypt(
			'4915600000000',
			23,
			enc.attrs['type'] as 'pkmsg',
			enc.content as Uint8Array,
		)
		const skdm = decodeMsg(dist.plaintext)['senderKeyDistributionMessage']
		expect(skdm.groupId).toBe(group)
		await bob0.cipher.processSenderKeyDistribution(
			group,
			'4915600000000.23',
			new Uint8Array(skdm.axolotlSenderKeyDistributionMessage),
		)
		for (const [st, text] of [
			[s1!, 'first'],
			[s2!, 'second'],
		] as const) {
			const sk = kids(st, 'enc')[0]!
			expect(sk.attrs['type']).toBe('skmsg')
			const plain = await bob0.cipher.groupDecrypt(
				group,
				'4915600000000.23',
				sk.content as Uint8Array,
			)
			expect(decodeMsg(plain)['extendedTextMessage'].text).toBe(text)
		}
		void creds
	})
})

describe('Sender: retry receipts', () => {
	it('re-encrypts a sent message for exactly the device that asked, using its fresh key bundle', async () => {
		const { sender, stanzas, bob1 } = await world()
		const id = await sender.sendText('4915611111111@s.whatsapp.net', 'please resend')
		// bob1 lost its session: it answers with a retry receipt carrying a new bundle
		const bundle = bob1.userNode.content as BinaryNode[]
		const retry: BinaryNode = {
			tag: 'receipt',
			attrs: { from: bob1.jid, id, type: 'retry' },
			content: [
				{ tag: 'retry', attrs: { count: '2', id, v: '1', error: '1' } },
				bundle.find((c) => c.tag === 'registration')!,
				{
					tag: 'keys',
					attrs: {},
					content: [
						{ tag: 'type', attrs: {}, content: Buffer.from([5]) },
						...bundle.filter((c) => c.tag !== 'registration'),
						{ tag: 'device-identity', attrs: {}, content: new Uint8Array([1]) },
					],
				},
			],
		}
		expect(await sender.handleRetryReceipt(retry)).toBe(true)
		const st = stanzas.at(-1)!
		expect(st.attrs).toMatchObject({ id, to: bob1.jid, device_fanout: 'false', type: 'text' })
		const enc = kids(st, 'enc')[0]!
		expect(enc.attrs).toMatchObject({ v: '2', type: 'pkmsg', count: '2' })
		expect(kids(st, 'device-identity')).toHaveLength(1)
		const out = decodeMsg(
			(await bob1.cipher.decrypt('4915600000000', 23, 'pkmsg', enc.content as Uint8Array))
				.plaintext,
		)
		expect(out['extendedTextMessage'].text).toBe('please resend')
	})

	it('refuses retries from someone the message was never sent to (no plaintext leak)', async () => {
		const { sender, stanzas, bob0 } = await world()
		const id = await sender.sendText('4915611111111@s.whatsapp.net', 'secret for bob only')
		const before = stanzas.length
		const mallory = '4915699999999:1@s.whatsapp.net'
		const bundle = bob0.userNode.content as BinaryNode[]
		const ok = await sender.handleRetryReceipt({
			tag: 'receipt',
			attrs: { from: mallory, id, type: 'retry' },
			content: [
				{ tag: 'retry', attrs: { count: '1' } },
				bundle.find((c) => c.tag === 'registration')!,
				{ tag: 'keys', attrs: {}, content: bundle.filter((c) => c.tag !== 'registration') },
			],
		})
		expect(ok).toBe(false)
		expect(stanzas).toHaveLength(before)
	})

	it('requires a group retry to come from that group and name a participant', async () => {
		const { sender, stanzas, bob0 } = await world()
		const group = '120363000000000001@g.us'
		const id = await sender.sendText(group, 'g')
		const n = stanzas.length
		expect(
			await sender.handleRetryReceipt({
				tag: 'receipt',
				attrs: { from: '120363999@g.us', participant: bob0.jid, id, type: 'retry' },
				content: [{ tag: 'retry', attrs: { count: '1' } }],
			}),
		).toBe(false)
		expect(
			await sender.handleRetryReceipt({
				tag: 'receipt',
				attrs: { from: group, id, type: 'retry' },
				content: [{ tag: 'retry', attrs: { count: '1' } }],
			}),
		).toBe(false)
		expect(stanzas).toHaveLength(n)
	})

	it('counts resends itself instead of trusting the receipt', async () => {
		const { sender, bob0 } = await world()
		const id = await sender.sendText('4915611111111@s.whatsapp.net', 'x')
		const r = (): BinaryNode => ({
			tag: 'receipt',
			attrs: { from: bob0.jid, id, type: 'retry' },
			content: [{ tag: 'retry', attrs: { count: '1' } }],
		})
		const results: boolean[] = []
		for (let i = 0; i < 7; i++) results.push(await sender.handleRetryReceipt(r()))
		expect(results.filter(Boolean)).toHaveLength(5)
		expect(results.slice(5)).toEqual([false, false])
	})

	it('ignores retries for messages it never sent and absurd counts', async () => {
		const { sender, bob0 } = await world()
		expect(
			await sender.handleRetryReceipt({
				tag: 'receipt',
				attrs: { from: bob0.jid, id: 'nope', type: 'retry' },
				content: [{ tag: 'retry', attrs: { count: '1' } }],
			}),
		).toBe(false)
		const id = await sender.sendText('4915611111111@s.whatsapp.net', 'x')
		expect(
			await sender.handleRetryReceipt({
				tag: 'receipt',
				attrs: { from: bob0.jid, id, type: 'retry' },
				content: [{ tag: 'retry', attrs: { count: '99' } }],
			}),
		).toBe(true) // the claimed count is only a hint; we cap resends ourselves (see the counting test)
	})

	it('addresses a group member by participant', async () => {
		const { sender, stanzas, bob0 } = await world()
		const group = '120363000000000001@g.us'
		const id = await sender.sendText(group, 'hi group')
		const bundle = bob0.userNode.content as BinaryNode[]
		await sender.handleRetryReceipt({
			tag: 'receipt',
			attrs: { from: group, participant: bob0.jid, id, type: 'retry' },
			content: [
				{ tag: 'retry', attrs: { count: '2' } },
				bundle.find((c) => c.tag === 'registration')!,
				{ tag: 'keys', attrs: {}, content: bundle.filter((c) => c.tag !== 'registration') },
			],
		})
		expect(stanzas.at(-1)!.attrs).toMatchObject({ id, to: group, participant: bob0.jid })
	})
})

describe('Sender: group stanza details and statuses', () => {
	it('adds the reporting token to group messages and multicast to legacy group ids', async () => {
		const { sender, stanzas } = await world()
		await sender.sendText('120363000000000001@g.us', 'x')
		await sender.sendText('4915600000000-1600000000@g.us', 'y')
		expect(kids(stanzas[0]!, 'reporting')).toHaveLength(1)
		expect(kids(stanzas[0]!, 'multicast')).toHaveLength(0)
		expect(kids(stanzas[1]!, 'multicast')).toHaveLength(1)
	})

	it('posts a status to the given audience with status_setting and no addressing_mode', async () => {
		const { sender, stanzas, bob0 } = await world()
		await sender.sendMessage(
			'status@broadcast',
			{ extendedTextMessage: { text: 'story' } },
			{ statusRecipients: ['4915611111111@s.whatsapp.net'], statusPrivacy: 'allowlist' },
		)
		const st = stanzas[0]!
		expect(st.attrs['to']).toBe('status@broadcast')
		expect(st.attrs['addressing_mode']).toBeUndefined()
		expect(kids(st, 'meta')[0]!.attrs).toEqual({
			status_setting: 'allowlist',
			session_scope: 'status',
		})
		expect(kids(st, 'enc')[0]!.attrs['type']).toBe('skmsg')
		expect(
			kids(kids(st, 'participants')[0]!, 'to')
				.map((t) => t.attrs['jid'])
				.sort(),
		).toEqual(['4915611111111:1@s.whatsapp.net', bob0.jid].sort())
	})

	it('refuses a status without an audience', async () => {
		const { sender } = await world()
		await expect(
			sender.sendMessage('status@broadcast', { extendedTextMessage: { text: 's' } }),
		).rejects.toThrow(/statusRecipients/)
	})
})

describe('Sender: peer messages', () => {
	it('sends a flat enc to our own phone (device 0) as category=peer, wrapped as deviceSentMessage', async () => {
		const { sender, stanzas, phone } = await world()
		await sender.sendPeerMessage({
			protocolMessage: {
				type: 'APP_STATE_SYNC_KEY_REQUEST',
				appStateSyncKeyRequest: { keyIds: [{ keyId: Buffer.from([1, 2]) }] },
			},
		})
		const st = stanzas[0]!
		expect(st.attrs).toMatchObject({
			to: '4915600000000@s.whatsapp.net',
			category: 'peer',
			push_priority: 'high_force',
			type: 'text',
		})
		expect(kids(st, 'participants')).toHaveLength(0)
		expect(kids(st, 'meta')[0]!.attrs).toEqual({ appdata: 'default' })
		const enc = kids(st, 'enc')[0]!
		const out = decodeMsg(
			(await phone.cipher.decrypt('4915600000000', 23, 'pkmsg', enc.content as Uint8Array))
				.plaintext,
		)
		expect(out['deviceSentMessage'].message.protocolMessage.type).toBe(7)
	})
})

describe('Sender: peer message retries', () => {
	it('resends a peer message to the phone that asked, keeping category=peer and the meta node', async () => {
		const { sender, stanzas, phone } = await world()
		const id = await sender.sendPeerMessage({
			protocolMessage: {
				type: 'APP_STATE_SYNC_KEY_REQUEST',
				appStateSyncKeyRequest: { keyIds: [{ keyId: Buffer.from([1]) }] },
			},
		})
		const ok = await sender.handleRetryReceipt({
			tag: 'receipt',
			attrs: { from: phone.jid, id, type: 'retry', category: 'peer' },
			content: [{ tag: 'retry', attrs: { count: '1' } }],
		})
		expect(ok).toBe(true)
		const st = stanzas.at(-1)!
		expect(st.attrs).toMatchObject({
			id,
			category: 'peer',
			push_priority: 'high_force',
			to: phone.jid,
			recipient: '4915600000000@s.whatsapp.net',
		})
		expect(kids(st, 'meta')[0]!.attrs).toEqual({ appdata: 'default' })
		expect(kids(st, 'enc')[0]!.attrs['count']).toBe('1')
	})
})

describe('Sender: channels', () => {
	it('posts plain protobuf in a <plaintext> node and waits for the ack', async () => {
		const { sender, stanzas } = await world()
		await sender.sendText('1203630000@newsletter', 'hello channel')
		const st = stanzas[0]!
		expect(st.attrs['to']).toBe('1203630000@newsletter')
		expect(st.attrs['type']).toBe('text')
		const body = kids(st, 'plaintext')[0]!.content as Uint8Array
		expect(decodeMsg(Uint8Array.from([...body, 1]))['extendedTextMessage'].text).toBe(
			'hello channel',
		)
		expect(kids(st, 'participants')).toHaveLength(0)
	})
})

describe('helpers', () => {
	it('pads to 1-16 bytes and the receiver unpads it', () => {
		for (let i = 0; i < 50; i++) {
			const padded = padRandomMax16(Uint8Array.from([1, 2, 3]))
			expect(padded.length).toBeGreaterThan(3)
			expect(padded.length).toBeLessThanOrEqual(19)
			expect(Array.from(unpadRandomMax16(padded))).toEqual([1, 2, 3])
		}
	})

	it('builds message ids and participant hashes', () => {
		expect(generateMessageId('4915600000000:23@s.whatsapp.net')).toMatch(/^3EB0[0-9A-F]{18}$/)
		expect(participantHash(['b@x', 'a@x'])).toBe(participantHash(['a@x', 'b@x']))
		expect(participantHash(['a@x'])).toMatch(/^2:.{6}$/)
	})
})
