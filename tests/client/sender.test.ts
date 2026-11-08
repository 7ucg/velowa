import { describe, expect, it } from 'vitest'
import { newIdentityKeyPair } from '../../src/crypto/signal.js'
import { unpadRandomMax16 } from '../../src/client/receiver.js'
import { generateMessageId, padRandomMax16, participantHash } from '../../src/client/sender.js'
import { decodeMsg, kids, signedDeviceIdentity, world } from '../helpers/world.testkit.js'

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

	it('can leave out our own devices, or the recipient linked devices', async () => {
		const to = '4915611111111@s.whatsapp.net'
		const jids = async (devices: 'recipient' | 'primary' | 'no-linked') => {
			const { sender, stanzas } = await world()
			await sender.sendMessage(to, { extendedTextMessage: { text: 'x' } }, { devices })
			const st = stanzas[0]!
			return {
				fanout: st.attrs['device_fanout'],
				jids: kids(kids(st, 'participants')[0]!, 'to')
					.map((p) => p.attrs['jid'])
					.sort(),
			}
		}
		expect(await jids('recipient')).toEqual({
			fanout: 'false',
			jids: ['4915611111111:1@s.whatsapp.net', '4915611111111@s.whatsapp.net'],
		})
		expect(await jids('primary')).toEqual({ fanout: 'false', jids: [to] })
		expect(await jids('no-linked')).toEqual({
			fanout: 'false',
			jids: ['4915600000000@s.whatsapp.net', to],
		})
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

	it('distributes the sender key again after the device was linked again (new device number)', async () => {
		const { sender, stanzas, bob0, creds } = await world()
		const group = '120363000000000001@g.us'
		await sender.sendText(group, 'first')
		await sender.sendText(group, 'second')
		expect(kids(stanzas[1]!, 'participants')).toHaveLength(0) // same key, nobody new: skmsg only

		// the account is linked again and gets a new device number: its sender key is a new one
		creds.me = { id: '4915600000000:30@s.whatsapp.net', lid: '111111111111:30@lid' }
		await sender.sendText(group, 'third')
		const parts = kids(kids(stanzas[2]!, 'participants')[0] ?? { tag: 'x', attrs: {} }, 'to')
		expect(parts.map((p) => p.attrs['jid'])).toContain(bob0.jid)
	})
})

describe('Sender: channel polls and rich posts', () => {
	it('keeps rich text as is and passes the poll meta node through on polls', async () => {
		const { sender, stanzas } = await world()
		await sender.sendMessage('1203630000@newsletter', {
			extendedTextMessage: { text: 'link', matchedText: 'https://x' },
		})
		expect(
			decodeMsg(
				Uint8Array.from([...(kids(stanzas[0]!, 'plaintext')[0]!.content as Uint8Array), 1]),
			)['extendedTextMessage'].matchedText,
		).toBe('https://x')
		await sender.sendMessage(
			'1203630000@newsletter',
			{
				pollCreationMessageV3: {
					name: 'q',
					options: [{ optionName: 'a' }, { optionName: 'b' }],
					selectableOptionsCount: 1,
				},
			},
			{ type: 'poll', extraNodes: [{ tag: 'meta', attrs: { polltype: 'creation' } }] },
		)
		expect(stanzas[1]!.attrs['type']).toBe('poll')
		expect(kids(stanzas[1]!, 'meta')[0]!.attrs).toEqual({ polltype: 'creation' }) // the server answers 479 without it
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

	it('throttles the aggregate resend rate per chat, independent of the per-message cap', async () => {
		const { sender, bob1 } = await world()
		const ids: string[] = []
		for (let i = 0; i < 21; i++)
			ids.push(await sender.sendText('4915611111111@s.whatsapp.net', `m${i}`))
		const retryFor = (id: string): BinaryNode => ({
			tag: 'receipt',
			attrs: { from: bob1.jid, id, type: 'retry' },
			content: [{ tag: 'retry', attrs: { count: '1' } }],
		})
		const results: boolean[] = []
		for (const id of ids) results.push(await sender.handleRetryReceipt(retryFor(id)))
		expect(results.filter(Boolean)).toHaveLength(20) // the burst
		expect(results.at(-1)).toBe(false) // the 21st, same chat, is throttled
	})

	it('does not let one chat throttle another', async () => {
		const { sender, bob1, phone } = await world()
		const ids: string[] = []
		for (let i = 0; i < 21; i++)
			ids.push(await sender.sendText('4915611111111@s.whatsapp.net', `m${i}`))
		const otherId = await sender.sendText('4915600000000@s.whatsapp.net', 'to myself')
		for (const id of ids)
			await sender.handleRetryReceipt({
				tag: 'receipt',
				attrs: { from: bob1.jid, id, type: 'retry' },
				content: [{ tag: 'retry', attrs: { count: '1' } }],
			})
		expect(
			await sender.handleRetryReceipt({
				tag: 'receipt',
				attrs: { from: phone.jid, id: otherId, type: 'retry' },
				content: [{ tag: 'retry', attrs: { count: '1' } }],
			}),
		).toBe(true)
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

describe('Sender: LID addressing', () => {
	it('fetches keys for the LID of a known account but keeps the phone-number JIDs in the stanza', async () => {
		const { sender, stanzas, phone, lids, creds } = await world()
		lids.set(creds.me!.id, creds.me!.lid!)
		await sender.sendText('4915600000000@s.whatsapp.net', 'note to self')
		const to = kids(kids(stanzas[0]!, 'participants')[0]!, 'to')[0]!
		expect(to.attrs['jid']).toBe('4915600000000@s.whatsapp.net') // stanza keeps the JID the server gave us
		const enc = kids(to, 'enc')[0]!
		const out = decodeMsg(
			(await phone.cipher.decrypt('whoever', 1, 'pkmsg', enc.content as Uint8Array)).plaintext,
		)
		expect(out['deviceSentMessage'].message.extendedTextMessage.text).toBe('note to self')
		// the session is stored under the LID address
		expect(sender.addr('4915600000000@s.whatsapp.net')).toEqual({
			name: '111111111111_1',
			device: 0,
		})
		expect(sender.addr('4915600000000:5@s.whatsapp.net')).toEqual({
			name: '111111111111_1',
			device: 5,
		})
		expect(sender.addr('4915611111111@s.whatsapp.net')).toEqual({
			name: '4915611111111',
			device: 0,
		})
	})

	it('retries by phone number when usync answers nothing for a known LID, and still addresses the LID', async () => {
		const bobLid = '222222222222@lid'
		const { sender, stanzas, lids } = await world({ emptyUsyncFor: [bobLid] })
		// Learned earlier (a usync lookup, or an incoming stanza's participant_pn - see noteLidFromAttrs).
		lids.set('4915611111111@s.whatsapp.net', bobLid)
		const id = await sender.sendText(bobLid, 'hi')
		expect(id).toMatch(/^3EB0[0-9A-F]{18}$/)
		const st = stanzas[0]!
		expect(st.attrs['to']).toBe(bobLid) // the envelope still addresses the JID the caller gave
		const to = kids(kids(st, 'participants')[0]!, 'to')
			.map((t) => t.attrs['jid'])
			.sort()
		// bob's devices: discovered under the fallback (phone number) form, despite the LID usync being empty.
		// Our own device: re-addressed as LID, same as any other LID-addressed conversation (not a fallback thing).
		expect(to).toEqual(
			['111111111111@lid', '4915611111111:1@s.whatsapp.net', '4915611111111@s.whatsapp.net'].sort(),
		)
	})

	it('still fails when usync answers nothing and no other form of the address is known', async () => {
		const unknownLid = '333333333333@lid'
		const { sender } = await world({ emptyUsyncFor: [unknownLid] })
		await expect(sender.sendText(unknownLid, 'hi')).rejects.toThrow(/no devices found/)
	})
})

describe('Sender: device-identity verification', () => {
	it('sends normally to a device with a validly-signed device-identity', async () => {
		const account = newIdentityKeyPair()
		const { sender, stanzas, extra } = await world({
			extraRemote: {
				jid: 'mallory@s.whatsapp.net',
				regId: 42,
				deviceIdentity: (identity) => signedDeviceIdentity(account, identity),
			},
		})
		await sender.sendText('mallory@s.whatsapp.net', 'hi')
		const to = kids(kids(stanzas[0]!, 'participants')[0]!, 'to')
		expect(to.map((t) => t.attrs['jid'])).toContain(extra!.jid)
	})

	it('refuses to establish a session over a tampered device-identity', async () => {
		const account = newIdentityKeyPair()
		const { sender } = await world({
			extraRemote: {
				jid: 'mallory@s.whatsapp.net',
				regId: 42,
				deviceIdentity: (identity) => signedDeviceIdentity(account, identity, true),
			},
		})
		await expect(sender.sendText('mallory@s.whatsapp.net', 'hi')).rejects.toThrow()
	})
})

describe('Sender: key-index-list verification', () => {
	const bobBare = '4915611111111@s.whatsapp.net'

	it('filters out a companion device whose key-index the verified list no longer accepts', async () => {
		const { sender } = await world({
			bob0DeviceIdentity: (identity) => signedDeviceIdentity(identity, identity),
			// bob1's hardcoded key-index ('1') is neither in validIndexes nor newer than currentIndex.
			keyIndexListForBob: { currentIndex: 5, validIndexes: [] },
		})
		// First send establishes sessions, verifying bob0's device-identity and anchoring bob's trust.
		await sender.sendText(bobBare, 'first')
		const devices = await sender.getDevices([bobBare])
		expect(devices.map((d) => d.jid)).toEqual([bobBare]) // bob0 (id 0) kept, bob1 (id 1) filtered out
	})

	it('keeps a companion device whose key-index the verified list still accepts', async () => {
		const { sender, bob1 } = await world({
			bob0DeviceIdentity: (identity) => signedDeviceIdentity(identity, identity),
			keyIndexListForBob: { currentIndex: 1, validIndexes: [1] },
		})
		await sender.sendText(bobBare, 'first')
		const devices = await sender.getDevices([bobBare])
		expect(devices.map((d) => d.jid).sort()).toEqual([bobBare, bob1.jid].sort())
	})

	it('fails closed (rejects every companion device) when a list is sent but does not verify', async () => {
		const { sender, bob1 } = await world({
			bob0DeviceIdentity: (identity) => signedDeviceIdentity(identity, identity),
			// Would otherwise accept bob1's key-index ('1') - but the signature is tampered.
			keyIndexListForBob: { currentIndex: 1, validIndexes: [1], invalid: true },
		})
		await sender.sendText(bobBare, 'first')
		const devices = await sender.getDevices([bobBare])
		expect(devices.map((d) => d.jid)).toEqual([bobBare]) // bob0 kept, bob1 rejected - not silently let through
		expect(devices.map((d) => d.jid)).not.toContain(bob1.jid)
	})

	it('does not filter at all before any trust anchor has been established', async () => {
		const { sender, bob1 } = await world({
			keyIndexListForBob: { currentIndex: 5, validIndexes: [] },
		})
		// No bob0DeviceIdentity this time: assertSessions never verifies an anchor for bob, so getDevices
		// has nothing to check the list against and must not reject bob1 on that basis alone.
		const devices = await sender.getDevices([bobBare])
		expect(devices.map((d) => d.jid)).toContain(bob1.jid)
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
		const post = decodeMsg(Uint8Array.from([...body, 1]))
		expect(post['conversation']).toBe('hello channel') // not extendedTextMessage: the phone would call it unsupported
		expect(post['extendedTextMessage']).toBeUndefined()
		expect(post['messageContextInfo']).toBeUndefined()
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
