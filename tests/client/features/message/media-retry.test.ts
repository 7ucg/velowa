import { createCipheriv, hkdfSync, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
	decodeMediaRetryNode,
	decryptMediaRetry,
	mediaRetryRequest,
} from '../../../../src/client/features/message/media-retry.js'
import { encodeProto } from '../../../../src/client/proto.js'

const mediaKey = randomBytes(32)
const key = { remoteJid: '1@s.whatsapp.net', id: 'ABC', fromMe: false }

function answer(result: string, directPath?: string) {
	const k = Buffer.from(
		hkdfSync('sha256', mediaKey, Buffer.alloc(0), 'WhatsApp Media Retry Notification', 32),
	)
	const iv = randomBytes(12)
	const c = createCipheriv('aes-256-gcm', k, iv)
	c.setAAD(Buffer.from('ABC'))
	const body = Buffer.concat([
		c.update(encodeProto('MediaRetryNotification', { stanzaId: 'ABC', result, directPath })),
		c.final(),
		c.getAuthTag(),
	])
	return {
		tag: 'notification',
		attrs: { id: 'ABC', type: 'mediaretry' },
		content: [
			{ tag: 'rmr', attrs: { jid: key.remoteJid, from_me: 'false' } },
			{
				tag: 'encrypt',
				attrs: {},
				content: [
					{ tag: 'enc_p', attrs: {}, content: body },
					{ tag: 'enc_iv', attrs: {}, content: iv },
				],
			},
		],
	}
}

describe('media retry', () => {
	it('builds the server-error receipt to our own account', () => {
		const n = mediaRetryRequest(key, mediaKey, '49123:7@lid')
		expect(n.attrs).toEqual({ id: 'ABC', to: '49123@lid', type: 'server-error' })
		const kids = n.content as { tag: string; attrs: Record<string, string> }[]
		expect(kids.map((k) => k.tag)).toEqual(['encrypt', 'rmr'])
		expect(kids[1]!.attrs).toEqual({ jid: '1@s.whatsapp.net', from_me: 'false' })
	})

	it('decodes and decrypts the answer with the new path', () => {
		const ev = decodeMediaRetryNode(answer('SUCCESS', '/v/t62/new.enc'))!
		expect(ev.key).toEqual({ id: 'ABC', remoteJid: '1@s.whatsapp.net', fromMe: false })
		expect(decryptMediaRetry(ev.media!, mediaKey, 'ABC')).toEqual({
			result: 'SUCCESS',
			directPath: '/v/t62/new.enc',
		})
	})

	it('reports a failure of the phone and a wrong key', () => {
		const ev = decodeMediaRetryNode(answer('NOT_FOUND'))!
		expect(decryptMediaRetry(ev.media!, mediaKey, 'ABC').result).toBe('NOT_FOUND')
		expect(() => decryptMediaRetry(ev.media!, randomBytes(32), 'ABC')).toThrow()
	})

	it('reads an error node', () => {
		const ev = decodeMediaRetryNode({
			tag: 'notification',
			attrs: { id: 'ABC', type: 'mediaretry' },
			content: [
				{ tag: 'rmr', attrs: { jid: 'x', from_me: 'true' } },
				{ tag: 'error', attrs: { code: '2' } },
			],
		})
		expect(ev?.error).toEqual({ code: 2 })
	})
})
