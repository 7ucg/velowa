import { describe, expect, it } from 'vitest'
import { decodeMsg, kids, world } from '../../../helpers/world.testkit.js'
import {
	MAX_DOWNLOAD_BYTES,
	safeMediaUrls,
	decryptMedia,
	downloadMedia,
	encryptMedia,
	mediaKeys,
	mediaMessage,
	mediaOf,
	parseMediaConn,
	uploadMedia,
	uploadToken,
} from '../../../../src/client/features/message/media.js'

const plain = Buffer.from('hello media '.repeat(100))

describe('media crypto', () => {
	it('encrypts and decrypts, verifying MAC and hashes', () => {
		const enc = encryptMedia(plain, 'image')
		expect(enc.fileLength).toBe(plain.length)
		expect(enc.encrypted.length % 16).toBe(10) // padded blocks + 10-byte MAC
		const out = decryptMedia(enc.encrypted, enc.mediaKey, 'image', {
			fileSha256: enc.fileSha256,
			fileEncSha256: enc.fileEncSha256,
		})
		expect(out.equals(plain)).toBe(true)
	})

	it('rejects tampering, the wrong key and the wrong media type', () => {
		const enc = encryptMedia(plain, 'video')
		const bad = Buffer.from(enc.encrypted)
		bad[3] ^= 1
		expect(() => decryptMedia(bad, enc.mediaKey, 'video')).toThrow(/MAC/)
		expect(() => decryptMedia(enc.encrypted, Buffer.alloc(32, 1), 'video')).toThrow()
		expect(() => decryptMedia(enc.encrypted, enc.mediaKey, 'document')).toThrow() // different HKDF label
		expect(() =>
			decryptMedia(enc.encrypted, enc.mediaKey, 'video', { fileSha256: Buffer.alloc(32) }),
		).toThrow(/hash/)
	})

	it('derives distinct keys per type but shares image and sticker', () => {
		const k = Buffer.alloc(32, 7)
		expect(mediaKeys(k, 'image').cipherKey.equals(mediaKeys(k, 'sticker').cipherKey)).toBe(true)
		expect(mediaKeys(k, 'image').cipherKey.equals(mediaKeys(k, 'video').cipherKey)).toBe(false)
	})
})

describe('upload / download', () => {
	const conn = parseMediaConn({
		tag: 'iq',
		attrs: {},
		content: [
			{
				tag: 'media_conn',
				attrs: { auth: 'AUTH+/=', ttl: '300' },
				content: [
					{ tag: 'host', attrs: { hostname: 'a.example' } },
					{ tag: 'host', attrs: { hostname: 'b.example' } },
				],
			},
		],
	})

	it('parses media_conn and builds URL-safe tokens', () => {
		expect(conn.hosts).toEqual(['a.example', 'b.example'])
		expect(conn.ttl).toBe(300)
		expect(uploadToken(Buffer.from([0xfb, 0xff, 0xfe]))).toBe('-__-')
	})

	it('falls through to the next host and returns url + directPath', async () => {
		const enc = encryptMedia(plain, 'image')
		const calls: string[] = []
		const fakeFetch = (async (url: string, init: RequestInit) => {
			calls.push(url)
			expect((init.body as Uint8Array).length).toBe(enc.encrypted.length)
			if (url.includes('a.example')) return new Response('nope', { status: 500 })
			return new Response(JSON.stringify({ url: 'https://mmg/x', direct_path: '/v/t62/x' }))
		}) as unknown as typeof fetch
		const up = await uploadMedia(conn, 'image', enc, fakeFetch)
		expect(up).toEqual({ url: 'https://mmg/x', directPath: '/v/t62/x' })
		expect(calls).toHaveLength(2)
		expect(calls[1]).toContain(
			`/mms/image/${uploadToken(enc.fileEncSha256)}?auth=AUTH%2B%2F%3D&token=`,
		)
	})

	it('fails when every host fails', async () => {
		const fakeFetch = (async () => new Response('{}', { status: 403 })) as unknown as typeof fetch
		await expect(
			uploadMedia(conn, 'image', encryptMedia(plain, 'image'), fakeFetch),
		).rejects.toThrow(/all hosts/)
	})

	it('downloads via directPath, falls back to url, and verifies', async () => {
		const enc = encryptMedia(plain, 'document')
		const fakeFetch = (async (url: string) =>
			url.startsWith('https://mmg.whatsapp.net/v/')
				? new Response('gone', { status: 404 })
				: new Response(new Uint8Array(enc.encrypted))) as unknown as typeof fetch
		const out = await downloadMedia(
			{
				directPath: '/v/t62/x',
				url: 'https://media.whatsapp.net/alt',
				mediaKey: enc.mediaKey,
				fileSha256: enc.fileSha256,
				fileEncSha256: enc.fileEncSha256,
			},
			'document',
			fakeFetch,
		)
		expect(out.equals(plain)).toBe(true)
		await expect(downloadMedia({ mediaKey: enc.mediaKey }, 'document', fakeFetch)).rejects.toThrow(
			/neither/,
		)
	})
})

describe('download safety', () => {
	it('only accepts WhatsApp media hosts and plain paths', () => {
		expect(
			safeMediaUrls({
				mediaKey: new Uint8Array(),
				directPath: '/v/t62.7118-24/a?ccb=11-4&oh=x&oe=1',
			}),
		).toEqual(['https://mmg.whatsapp.net/v/t62.7118-24/a?ccb=11-4&oh=x&oe=1'])
		for (const bad of [
			'//evil.example/x',
			'/..%2f',
			'/a/../b',
			'/a@evil.example',
			'/a\\b',
			'http://x',
			'v/x',
			'/a b',
		]) {
			expect(() => safeMediaUrls({ mediaKey: new Uint8Array(), directPath: bad }), bad).toThrow(
				/unsafe/,
			)
		}
		const okUrl = safeMediaUrls({ mediaKey: new Uint8Array(), url: 'https://mmg.whatsapp.net/x' })
		expect(okUrl).toEqual(['https://mmg.whatsapp.net/x'])
		for (const bad of [
			'http://mmg.whatsapp.net/x',
			'https://evil.example/x',
			'https://mmg.whatsapp.net.evil.example/x',
			'https://u:p@mmg.whatsapp.net/x',
			'https://mmg.whatsapp.net:8443/x',
			'https://127.0.0.1/x',
			'not a url',
		]) {
			expect(safeMediaUrls({ mediaKey: new Uint8Array(), url: bad }), bad).toEqual([])
		}
	})

	it('refuses to fetch an attacker-supplied internal URL at all', async () => {
		let called = false
		const f = (async () => ((called = true), new Response('x'))) as unknown as typeof fetch
		await expect(
			downloadMedia(
				{ mediaKey: new Uint8Array(32), url: 'https://169.254.169.254/latest' },
				'image',
				f,
			),
		).rejects.toThrow(/usable/)
		expect(called).toBe(false)
	})

	it('caps the download by declared size and by an absolute maximum', async () => {
		const enc = encryptMedia(plain, 'image')
		const big = (async () =>
			new Response(new Uint8Array(enc.encrypted.length + 100))) as unknown as typeof fetch
		await expect(
			downloadMedia(
				{ directPath: '/v/x', mediaKey: enc.mediaKey, fileLength: enc.fileLength },
				'image',
				big,
			),
		).rejects.toThrow()
		const ok = (async () => new Response(new Uint8Array(enc.encrypted))) as unknown as typeof fetch
		expect(
			(
				await downloadMedia(
					{ directPath: '/v/x', mediaKey: enc.mediaKey, fileLength: enc.fileLength },
					'image',
					ok,
				)
			).equals(plain),
		).toBe(true)
		expect(MAX_DOWNLOAD_BYTES).toBeGreaterThan(0)
	})
})

describe('media messages', () => {
	it('builds each message kind with the right mediatype hint', () => {
		const enc = encryptMedia(plain, 'image')
		const up = { url: 'https://u', directPath: '/p' }
		expect(
			mediaMessage('image', enc, up, { caption: 'hi', width: 10, height: 20 }).message[
				'imageMessage'
			],
		).toMatchObject({
			caption: 'hi',
			width: 10,
			height: 20,
			directPath: '/p',
			mimetype: 'image/jpeg',
		})
		expect(mediaMessage('video', enc, up, { gifPlayback: true }).mediaType).toBe('gif')
		expect(mediaMessage('audio', enc, up, { ptt: true, seconds: 3 }).mediaType).toBe('ptt')
		expect(mediaMessage('audio', enc, up).mediaType).toBe('audio')
		expect(
			mediaMessage('document', enc, up, { fileName: 'a.pdf' }).message['documentMessage'],
		).toMatchObject({ fileName: 'a.pdf', title: 'a.pdf' })
		expect(mediaMessage('sticker', enc, up).mediaType).toBe('sticker')
	})

	it('finds the media in a received (JSON) message', () => {
		const enc = encryptMedia(plain, 'image')
		const found = mediaOf({
			imageMessage: {
				url: 'u',
				directPath: '/p',
				mediaKey: enc.mediaKey.toString('base64'),
				fileSha256: enc.fileSha256.toString('base64'),
			},
		})
		expect(found?.type).toBe('image')
		expect(Buffer.from(found!.ref.mediaKey).equals(enc.mediaKey)).toBe(true)
		expect(mediaOf({ conversation: 'x' })).toBeUndefined()
	})

	it('goes through the sender with the mediatype on every enc node and decrypts at the remote', async () => {
		const { sender, stanzas, bob0 } = await world()
		const enc = encryptMedia(plain, 'image')
		const built = mediaMessage(
			'image',
			enc,
			{ url: 'https://u', directPath: '/p' },
			{ caption: 'pic' },
		)
		await sender.sendMessage('4915611111111@s.whatsapp.net', built.message, {
			encAttrs: { mediatype: built.mediaType },
		})
		const st = stanzas[0]!
		expect(st.attrs['type']).toBe('media')
		const to = kids(kids(st, 'participants')[0]!, 'to').find((p) => p.attrs['jid'] === bob0.jid)!
		const e = kids(to, 'enc')[0]!
		expect(e.attrs['mediatype']).toBe('image')
		const m = decodeMsg(
			(await bob0.cipher.decrypt('4915600000000', 23, 'pkmsg', e.content as Uint8Array)).plaintext,
		)
		const ref = mediaOf({
			imageMessage: {
				...m['imageMessage'],
				mediaKey: Buffer.from(m['imageMessage'].mediaKey).toString('base64'),
			},
		})!
		expect(Buffer.from(ref.ref.mediaKey).equals(enc.mediaKey)).toBe(true)
	})
})

describe('pollOptionHash', () => {
	it('is sha256-hex(sha256-hex(name) + base64(image hash))', async () => {
		const { createHash } = await import('node:crypto')
		const { pollOptionHash } = await import('../../../../src/client/features/message/media.js')
		const img = createHash('sha256').update('img').digest()
		const inner = createHash('sha256').update('k').digest('hex')
		const expected = createHash('sha256')
			.update(inner + img.toString('base64'))
			.digest('hex')
		expect(pollOptionHash('k', img)).toBe(expected)
	})
})
