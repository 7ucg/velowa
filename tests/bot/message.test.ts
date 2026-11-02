import { describe, expect, it } from 'vitest'
import type { Client } from '../../src/client/client.js'
import { serialize } from '../../src/bot/message.js'

const ME = '4915600000000:23@s.whatsapp.net'
const BOB = '4915611111111@s.whatsapp.net'
const GROUP = '120363000000000000@g.us'

function fakeClient() {
	const calls: { method: string; args: unknown[] }[] = []
	const rec =
		(method: string, result: unknown = 'ID1') =>
		(...args: unknown[]) => {
			calls.push({ method, args })
			return Promise.resolve(result)
		}
	const client = {
		me: { id: ME, lid: '1111@lid' },
		send: rec('send'),
		react: rec('react'),
		revoke: rec('revoke'),
		markRead: rec('markRead', undefined),
		forwardMessage: rec('forwardMessage'),
		downloadMedia: rec('downloadMedia', Buffer.from('bytes')),
	} as unknown as Client
	return { client, calls }
}

describe('serialize', () => {
	it('does NOT unwrap a deviceSentMessage that someone else sent us', () => {
		const { client } = fakeClient()
		const m = serialize(client, {
			id: 'M2',
			from: BOB, // not one of our devices: the wrapper is only a claim inside the payload
			message: { deviceSentMessage: { destinationJid: GROUP, message: { conversation: '.restart' } } },
		})
		expect(m.fromMe).toBe(false)
		expect(m.chat).toBe(BOB)
		expect(m.sender).toBe(BOB)
		expect(m.text).toBe('')
	})

	it('ignores a malformed or nested deviceSentMessage from our own device', () => {
		const { client } = fakeClient()
		const bad = serialize(client, {
			id: 'M3',
			from: '1111@lid',
			message: { deviceSentMessage: { destinationJid: 'not a jid', message: { conversation: 'x' } } },
		})
		expect(bad.chat).toBe('1111@lid')
		expect(bad.text).toBe('')
		const nested = serialize(client, {
			id: 'M4',
			from: '1111@lid',
			message: {
				deviceSentMessage: {
					destinationJid: BOB,
					message: { deviceSentMessage: { destinationJid: GROUP, message: { conversation: 'deep' } } },
				},
			},
		})
		expect(nested.chat).toBe(BOB) // unwrapped once, never twice
		expect(nested.text).toBe('')
	})

	it('unwraps a message typed on the phone to someone else (deviceSentMessage)', async () => {
		const { client, calls } = fakeClient()
		const m = serialize(client, {
			id: 'M1',
			from: '1111@lid', // our own account
			message: { deviceSentMessage: { destinationJid: BOB, message: { conversation: '.ping' } } },
		})
		expect(m.text).toBe('.ping')
		expect(m.chat).toBe(BOB)
		expect(m.fromMe).toBe(true)
		expect(m.key.fromMe).toBe(true)
		expect(m.isGroup).toBe(false)
		await m.reply('pong')
		expect(calls[0]?.method).toBe('send')
		expect(calls[0]?.args.slice(0, 2)).toEqual([BOB, { text: 'pong' }])
	})

	it('reads a private text message', () => {
		const { client } = fakeClient()
		const m = serialize(client, {
			id: 'A1',
			from: BOB,
			pushName: 'Bob',
			timestamp: 1700000000,
			message: { conversation: 'hello' },
		})
		expect(m).toMatchObject({
			id: 'A1',
			chat: BOB,
			sender: BOB,
			pushName: 'Bob',
			fromMe: false,
			isGroup: false,
			type: 'conversation',
			text: 'hello',
			isMedia: false,
			mentionedJids: [],
		})
		expect(m.quoted).toBeUndefined()
	})

	it('sees through wrappers and reads a group message with a quote and mentions', () => {
		const { client } = fakeClient()
		const m = serialize(client, {
			id: 'G1',
			from: GROUP,
			participant: `${BOB.replace('@', ':7@')}`,
			message: {
				ephemeralMessage: {
					message: {
						extendedTextMessage: {
							text: '@4915600000000 look',
							contextInfo: {
								mentionedJid: [ME],
								stanzaId: 'Q1',
								participant: ME,
								quotedMessage: { imageMessage: { caption: 'cat', mimetype: 'image/jpeg' } },
							},
						},
					},
				},
			},
		})
		expect(m.isGroup).toBe(true)
		expect(m.sender).toBe(BOB) // device part removed
		expect(m.type).toBe('extendedTextMessage')
		expect(m.text).toBe('@4915600000000 look')
		expect(m.mentionedJids).toEqual([ME])
		expect(m.quoted).toMatchObject({
			id: 'Q1',
			chat: GROUP,
			fromMe: true,
			type: 'imageMessage',
			text: 'cat',
			mimetype: 'image/jpeg',
		})
		expect(m.quoted!.key).toEqual({
			remoteJid: GROUP,
			id: 'Q1',
			fromMe: true,
			participant: '4915600000000@s.whatsapp.net',
		})
	})

	it('reads the choice of a tapped button or list row as text', () => {
		const { client } = fakeClient()
		const button = serialize(client, {
			id: 'B',
			from: BOB,
			message: { buttonsResponseMessage: { selectedButtonId: 'yes' } },
		})
		const row = serialize(client, {
			id: 'L',
			from: BOB,
			message: { listResponseMessage: { singleSelectReply: { selectedRowId: 'row-3' } } },
		})
		expect([button.text, row.text]).toEqual(['yes', 'row-3'])
	})

	it('recognises our own messages and media', () => {
		const { client } = fakeClient()
		const m = serialize(client, {
			id: 'O1',
			from: GROUP,
			participant: ME,
			message: { videoMessage: { caption: 'clip', mimetype: 'video/mp4' } },
		})
		expect(m.fromMe).toBe(true)
		expect(m.isMedia).toBe(true)
		expect(m.mimetype).toBe('video/mp4')
	})

	it('answers in the chat, quoting the message', async () => {
		const { client, calls } = fakeClient()
		const m = serialize(client, { id: 'R1', from: BOB, message: { conversation: 'hi' } })
		await m.reply('pong')
		await m.reply({ image: new Uint8Array([1]) }, { expiration: 60 })
		await m.react('👍')
		await m.delete()
		await m.markRead()
		await m.forward(GROUP)
		const dl = await m.download()
		expect(calls[0]).toMatchObject({ method: 'send' })
		expect(calls[0]!.args[0]).toBe(BOB)
		expect(calls[0]!.args[1]).toEqual({ text: 'pong' })
		expect((calls[0]!.args[2] as { quoted: { key: { id: string } } }).quoted.key.id).toBe('R1')
		expect(calls[1]!.args[2]).toMatchObject({ expiration: 60 })
		expect(calls.map((c) => c.method)).toEqual([
			'send',
			'send',
			'react',
			'revoke',
			'markRead',
			'forwardMessage',
			'downloadMedia',
		])
		expect(calls[2]!.args).toEqual([{ remoteJid: BOB, id: 'R1', fromMe: false }, '👍'])
		expect(dl.toString()).toBe('bytes')
	})
})
