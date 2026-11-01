import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { encodeProto } from '../proto.js'
import { encryptMedia } from './media.js'
import { loadHistory, parseHistory } from './history.js'

const sample = () =>
	encodeProto('HistorySync', {
		syncType: 'INITIAL_BOOTSTRAP',
		progress: 40,
		chunkOrder: 2,
		conversations: [
			{
				id: '4915611111111@s.whatsapp.net',
				name: 'Max',
				unreadCount: 3,
				conversationTimestamp: 1700000000,
				archived: true,
				pinned: 2,
				messages: [
					{
						message: {
							key: { remoteJid: '4915611111111@s.whatsapp.net', fromMe: false, id: 'M1' },
							message: { conversation: 'hallo' },
							messageTimestamp: 1699999999,
							pushName: 'Max',
						},
					},
					{
						message: {
							key: { fromMe: true, id: 'M2' },
							message: { conversation: 'servus' },
							messageTimestamp: 1700000000,
						},
					},
					{ message: {} }, // without a key: skipped
				],
			},
			{ id: '120363@g.us', messages: [] },
		],
		pushnames: [{ id: '4915611111111@s.whatsapp.net', pushname: 'Max' }],
		phoneNumberToLidMappings: [{ lidJid: '9@lid', pnJid: '4915611111111@s.whatsapp.net' }],
	})

describe('history sync', () => {
	it('parses chats, messages, push names and LID mappings from a compressed blob', () => {
		const h = parseHistory(deflateSync(sample()))
		expect(h).toMatchObject({ syncType: 'INITIAL_BOOTSTRAP', progress: 40, chunkOrder: 2 })
		expect(h.chats).toHaveLength(2)
		expect(h.chats[0]).toMatchObject({
			id: '4915611111111@s.whatsapp.net',
			name: 'Max',
			unreadCount: 3,
			archived: true,
			pinned: true,
			conversationTimestamp: 1700000000,
		})
		expect(h.chats[0]!.messages).toHaveLength(2)
		expect(h.chats[0]!.messages[0]).toMatchObject({
			key: { id: 'M1', fromMe: false },
			timestamp: 1699999999,
			pushName: 'Max',
			message: { conversation: 'hallo' },
		})
		expect(h.chats[0]!.messages[1]!.key.remoteJid).toBe('4915611111111@s.whatsapp.net') // falls back to the chat id
		expect(h.pushNames).toEqual([{ id: '4915611111111@s.whatsapp.net', name: 'Max' }])
		expect(h.lidMappings).toEqual([{ lid: '9@lid', pn: '4915611111111@s.whatsapp.net' }])
	})

	it('downloads, decrypts and parses a chunk announced by the phone', async () => {
		const enc = encryptMedia(deflateSync(sample()), 'md-msg-hist')
		const chunk = await loadHistory(
			{
				ref: {
					directPath: '/v/hist',
					mediaKey: enc.mediaKey,
					fileSha256: enc.fileSha256,
					fileEncSha256: enc.fileEncSha256,
					fileLength: enc.fileLength,
				},
				progress: 7,
			},
			async (ref, type) => {
				expect(type).toBe('md-msg-hist')
				expect(ref.directPath).toBe('/v/hist')
				const { decryptMedia } = await import('./media.js')
				return decryptMedia(enc.encrypted, ref.mediaKey, type, {})
			},
		)
		expect(chunk.chats).toHaveLength(2)
		expect(chunk.progress).toBe(40) // the blob's own value wins over the notification's
	})

	it('uses the inline payload without any download', async () => {
		const chunk = await loadHistory(
			{ ref: { mediaKey: new Uint8Array(32) }, inline: deflateSync(sample()) },
			async () => {
				throw new Error('must not download')
			},
		)
		expect(chunk.chats[0]!.id).toBe('4915611111111@s.whatsapp.net')
	})

	it('rejects a decompression bomb', () => {
		expect(() => parseHistory(new Uint8Array([1, 2, 3]))).toThrow()
	})
})
