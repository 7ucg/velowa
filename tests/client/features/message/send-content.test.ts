import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import type { Client } from '../../../../src/client/client.js'
import { sendContent, toBytes } from '../../../../src/client/features/message/send-content.js'

function fake() {
	const calls: { method: string; args: unknown[] }[] = []
	const rec =
		(method: string) =>
		(...args: unknown[]) => {
			calls.push({ method, args })
			return Promise.resolve(`id-${method}`)
		}
	const client = Object.fromEntries(
		[
			'sendText',
			'sendMedia',
			'react',
			'revoke',
			'edit',
			'forwardMessage',
			'sendPoll',
			'sendLocation',
			'sendMessage',
			'sendButtons',
			'sendList',
		].map((m) => [m, rec(m)]),
	) as unknown as Client
	return { client, calls }
}
const JID = '4915611111111@s.whatsapp.net'

describe('client.send content', () => {
	it('sends text with mentions and a quote', async () => {
		const { client, calls } = fake()
		const quoted = { key: { remoteJid: JID, id: 'Q' }, message: { conversation: 'old' } }
		expect(
			await sendContent(
				client,
				JID,
				{ text: 'hi @4915', mentions: ['4915@s.whatsapp.net'] },
				{ quoted },
			),
		).toBe('id-sendText')
		expect(calls[0]!.args).toEqual([JID, 'hi @4915', { quoted, mentions: ['4915@s.whatsapp.net'] }])
	})

	it('maps each kind of media', async () => {
		const { client, calls } = fake()
		const bytes = new Uint8Array([1, 2, 3])
		await sendContent(client, JID, { image: bytes, caption: 'c' })
		await sendContent(client, JID, { audio: bytes, voiceNote: true })
		await sendContent(client, JID, { video: bytes, gif: true, viewOnce: true })
		await sendContent(client, JID, {
			document: bytes,
			mimetype: 'application/pdf',
			fileName: 'a.pdf',
		})
		await sendContent(client, JID, { sticker: bytes })
		expect(calls.map((c) => c.args[1])).toEqual(['image', 'audio', 'video', 'document', 'sticker'])
		expect(calls[0]!.args[3]).toMatchObject({ caption: 'c' })
		expect(calls[1]!.args[3]).toMatchObject({ ptt: true })
		expect(calls[2]!.args[3]).toMatchObject({ gifPlayback: true, viewOnce: true })
		expect(calls[3]!.args[3]).toMatchObject({ mimetype: 'application/pdf', fileName: 'a.pdf' })
	})

	it('maps the other kinds to their methods', async () => {
		const { client, calls } = fake()
		const key = { remoteJid: JID, id: 'K', fromMe: true }
		await sendContent(client, JID, { react: { key, emoji: '🔥' } })
		await sendContent(client, JID, { edit: key, text: 'fixed' })
		await sendContent(client, JID, { revoke: key })
		await sendContent(client, JID, { poll: { name: 'P?', values: ['a', 'b'] } })
		await sendContent(client, JID, { location: { latitude: 1, longitude: 2, name: 'x' } })
		await sendContent(client, JID, { forward: { conversation: 'x' } })
		await sendContent(client, JID, { text: 'pick', buttons: [{ id: '1', text: 'one' }] })
		await sendContent(client, JID, {
			text: 'menu',
			title: 'T',
			buttonText: 'open',
			sections: [{ title: 's', rows: [{ id: 'r', title: 'row' }] }],
		})
		await sendContent(client, JID, {
			contacts: { contacts: [{ name: 'Bob', vcard: 'BEGIN:VCARD' }] },
		})
		expect(calls.map((c) => c.method)).toEqual([
			'react',
			'edit',
			'revoke',
			'sendPoll',
			'sendLocation',
			'forwardMessage',
			'sendButtons',
			'sendList',
			'sendMessage',
		])
		expect(calls[3]!.args).toEqual([JID, 'P?', ['a', 'b'], 1])
		expect(calls[8]!.args[1]).toEqual({
			contactMessage: { displayName: 'Bob', vcard: 'BEGIN:VCARD' },
		})
	})

	it('refuses content it does not know', async () => {
		const { client } = fake()
		await expect(sendContent(client, JID, { nothing: 1 } as never)).rejects.toThrow(/not supported/)
	})
})

describe('media sources', () => {
	it('reads bytes, a local file by path and a stream', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'velowa-src-'))
		const file = join(dir, 'a.bin')
		writeFileSync(file, Buffer.from('file'))
		expect(Buffer.from(await toBytes(new Uint8Array([104, 105]))).toString()).toBe('hi')
		expect(Buffer.from(await toBytes({ path: file })).toString()).toBe('file')
		expect(
			Buffer.from(
				await toBytes({ stream: Readable.from([Buffer.from('ab'), Buffer.from('cd')]) }),
			).toString(),
		).toBe('abcd')
	})

	it('never turns a url into a local file read', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'velowa-src-'))
		const file = join(dir, 'secret.txt')
		writeFileSync(file, 'secret')
		for (const url of [file, `file://${file}`, '/etc/passwd', '../secret', 'ftp://example.com/x'])
			await expect(toBytes({ url })).rejects.toThrow(/http\(s\)/)
	})

	it('does not fetch from a private address', async () => {
		await expect(toBytes({ url: 'http://127.0.0.1:9/x' })).rejects.toThrow()
	})
})
