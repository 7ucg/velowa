import { describe, expect, it } from 'vitest'
import { decodeMsg, kids, world } from '../world.testkit.js'
import {
	buildReceipts,
	chatState,
	edit,
	forward,
	presence,
	reaction,
	revoke,
	textMessage,
	withContext,
} from './messages.js'

const ME = '4915600000000:23@s.whatsapp.net'
const BOB = '4915611111111@s.whatsapp.net'

describe('message builders', () => {
	it('quotes a message and adds mentions inside the content field', () => {
		const m = withContext(
			textMessage('hi @4915611111111'),
			BOB,
			{
				quoted: {
					key: { remoteJid: BOB, id: 'Q1', fromMe: false },
					message: { extendedTextMessage: { text: 'orig', contextInfo: { stanzaId: 'old' } } },
				},
				mentions: [BOB],
			},
			ME,
		)
		const ctx = (m['extendedTextMessage'] as { contextInfo: Record<string, unknown> }).contextInfo
		expect(ctx['stanzaId']).toBe('Q1')
		expect(ctx['participant']).toBe(BOB)
		expect(ctx['quotedMessage']).toEqual({ extendedTextMessage: { text: 'orig' } }) // nested contextInfo stripped
		expect(ctx['mentionedJid']).toEqual([BOB])
		expect(ctx['remoteJid']).toBeUndefined()
	})

	it('quoting our own message uses our user as participant, and a cross-chat quote sets remoteJid', () => {
		const m = withContext(
			textMessage('x'),
			'120363@g.us',
			{
				quoted: {
					key: { remoteJid: BOB, id: 'Q', fromMe: true },
					message: { conversation: 'mine' },
				},
			},
			ME,
		)
		const ctx = (m['extendedTextMessage'] as { contextInfo: Record<string, unknown> }).contextInfo
		expect(ctx['participant']).toBe('4915600000000@s.whatsapp.net')
		expect(ctx['remoteJid']).toBe(BOB)
	})

	it('builds reaction, edit and revoke with the right stanza attributes', () => {
		const key = { remoteJid: BOB, id: 'K1', fromMe: true }
		expect(reaction(key, '👍').opts.encAttrs).toEqual({ 'decrypt-fail': 'hide' })
		expect(edit(key, 'new').opts.stanzaAttrs).toEqual({ edit: '1' })
		expect(revoke(key).opts.stanzaAttrs).toEqual({ edit: '7' })
		expect(
			revoke({ remoteJid: '120363@g.us', id: 'K2', fromMe: false, participant: 'x@lid' }).opts
				.stanzaAttrs,
		).toEqual({ edit: '8' })
		expect(revoke({ remoteJid: '120363@g.us', id: 'K3', fromMe: true }).opts.stanzaAttrs).toEqual({
			edit: '7',
		})
	})

	it('aggregates read receipts per chat and author, skipping our own messages', () => {
		const nodes = buildReceipts(
			[
				{ remoteJid: BOB, id: 'A', fromMe: false },
				{ remoteJid: BOB, id: 'B', fromMe: false },
				{ remoteJid: BOB, id: 'C', fromMe: true },
				{ remoteJid: '120363@g.us', id: 'D', fromMe: false, participant: 'p@lid' },
			],
			'read',
			1700000000,
		)
		expect(nodes).toHaveLength(2)
		expect(nodes[0]!.attrs).toEqual({ id: 'A', to: BOB, t: '1700000000', type: 'read' })
		expect(
			(nodes[0]!.content as { content: { attrs: { id: string } }[] }[])[0]!.content.map(
				(i) => i.attrs.id,
			),
		).toEqual(['B'])
		expect(nodes[1]!.attrs).toEqual({
			id: 'D',
			to: '120363@g.us',
			participant: 'p@lid',
			t: '1700000000',
			type: 'read',
		})
	})

	it('builds presence and chatstate nodes', () => {
		expect(chatState(ME, BOB, 'recording').content).toEqual([
			{ tag: 'composing', attrs: { media: 'audio' } },
		])
		expect(chatState(ME, BOB, 'paused').content).toEqual([{ tag: 'paused', attrs: {} }])
		expect(presence('Rami@x', 'available').attrs).toEqual({ name: 'Ramix', type: 'available' })
	})
})

describe('through the sender (decrypted by the remote device)', () => {
	it('sends a reaction, edit and revoke the way the server expects', async () => {
		const { sender, stanzas, bob0 } = await world()
		const key = { remoteJid: BOB, id: 'K1', fromMe: true }
		for (const f of [reaction(key, '🔥'), edit(key, 'fixed'), revoke(key)]) {
			await sender.sendMessage(BOB, f.message, f.opts)
		}
		const [r, e, d] = stanzas
		expect(r!.attrs['type']).toBe('reaction')
		const enc0 = kids(kids(kids(r!, 'participants')[0]!, 'to')[1]!, 'enc')[0]!
		expect(enc0.attrs['decrypt-fail']).toBe('hide')
		expect(kids(r!, 'reporting')).toHaveLength(0) // no secret / reporting token on reactions
		expect(e!.attrs['edit']).toBe('1')
		expect(d!.attrs['edit']).toBe('7')
		const to = kids(kids(e!, 'participants')[0]!, 'to').find((p) => p.attrs['jid'] === bob0.jid)!
		const enc = kids(to, 'enc')[0]!
		const plain = decodeMsg(
			(await bob0.cipher.decrypt('4915600000000', 23, 'pkmsg', enc.content as Uint8Array))
				.plaintext,
		)
		expect(plain['protocolMessage'].type).toBe(14)
		expect(plain['protocolMessage'].editedMessage.extendedTextMessage.text).toBe('fixed')
	})
})

describe('forward and expiration', () => {
	it('marks forwards, drops the reply thread and the original secret', () => {
		const m = forward(
			{
				messageContextInfo: { messageSecret: Buffer.alloc(32) },
				extendedTextMessage: {
					text: 'hi',
					contextInfo: {
						stanzaId: 'old',
						participant: 'x@lid',
						quotedMessage: { conversation: 'q' },
						mentionedJid: ['a@lid'],
					},
				},
			},
			6,
		)
		expect(m['messageContextInfo']).toBeUndefined()
		expect(
			(m['extendedTextMessage'] as { contextInfo: Record<string, unknown> }).contextInfo,
		).toEqual({ mentionedJid: ['a@lid'], isForwarded: true, forwardingScore: 6 })
		expect(() => forward({})).toThrow()
	})

	it('adds the disappearing-message timer', () => {
		const m = withContext(textMessage('x'), BOB, { expiration: 604800 }, ME)
		expect(
			(m['extendedTextMessage'] as { contextInfo: { expiration: number } }).contextInfo.expiration,
		).toBe(604800)
	})
})
