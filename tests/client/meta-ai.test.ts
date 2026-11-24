import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { extractMetaAiText, MessageSecrets } from '../../src/client/meta-ai.js'

describe('MessageSecrets', () => {
	it('evicts the oldest secret bytes once the total bound is exceeded, not just per-chat', () => {
		const secrets = new MessageSecrets()
		const total = 5000
		for (let i = 0; i < total; i++) {
			secrets.set(`id-${i}`, new Uint8Array([i % 256]), `chat-${i}`, 'author@s.whatsapp.net')
		}
		expect(secrets.has('id-0')).toBe(true)
		expect(secrets.byId('id-0')).toBeDefined()
		expect(secrets.originOf('id-0')).toBeDefined()

		secrets.set('id-overflow', new Uint8Array([1]), 'chat-overflow', 'author@s.whatsapp.net')

		// The secret bytes are freed, but the id is never "unseen" again.
		expect(secrets.byId('id-0')).toBeUndefined()
		expect(secrets.has('id-0')).toBe(true)
		expect(secrets.has('id-overflow')).toBe(true)
		expect(secrets.has('id-1')).toBe(true)
	})

	it('never lets an evicted id be rebound to a different secret/author, even via a direct set() call', () => {
		const secrets = new MessageSecrets()
		for (let i = 0; i < 5000; i++) {
			secrets.set(`id-${i}`, new Uint8Array([1]), `chat-${i}`, 'real-author@s.whatsapp.net')
		}
		secrets.set('id-overflow', new Uint8Array([1]), 'chat-overflow', 'real-author@s.whatsapp.net')
		expect(secrets.byId('id-0')).toBeUndefined()
		expect(secrets.originOf('id-0')?.author).toBe('real-author@s.whatsapp.net')

		// `has()` stays true for the evicted id, so a caller gating on it (as receiver.ts does) never
		// calls set() again for it - but even if something did, the original author must not be lost.
		secrets.set('id-0', new Uint8Array([9]), 'attacker-chat', 'attacker@s.whatsapp.net')
		expect(secrets.originOf('id-0')?.author).toBe('real-author@s.whatsapp.net')
	})
})

describe('extractMetaAiText', () => {
	const unifiedResponse = (payload: Record<string, unknown>, gzip: boolean) => {
		const json = JSON.stringify(payload)
		const bytes = gzip ? gzipSync(Buffer.from(json)) : Buffer.from(json)
		return { [gzip ? 'gzipData' : 'data']: bytes.toString('base64') }
	}
	const sections = (text: string) => ({ sections: [{ view_model: { primitive: { text } } }] })

	it('reads plain text, an extended-text/conversation body, and submessages', () => {
		expect(extractMetaAiText({ conversation: 'hi' })).toBe('hi')
		expect(extractMetaAiText({ extendedTextMessage: { text: 'hi' } })).toBe('hi')
		expect(
			extractMetaAiText({
				richResponseMessage: { submessages: [{ messageText: 'a' }, { messageText: 'b' }] },
			}),
		).toBe('a\nb')
	})

	it("reads a rich response's unifiedResponse.data (plain, not gzipped)", () => {
		expect(
			extractMetaAiText({
				richResponseMessage: { unifiedResponse: unifiedResponse(sections('hello'), false) },
			}),
		).toBe('hello')
	})

	it("reads a rich response's unifiedResponse.gzipData, falling back to it when data is absent", () => {
		expect(
			extractMetaAiText({
				richResponseMessage: { unifiedResponse: unifiedResponse(sections('zipped'), true) },
			}),
		).toBe('zipped')
	})

	it('returns undefined for an empty or unrecognized message', () => {
		expect(extractMetaAiText(undefined)).toBeUndefined()
		expect(extractMetaAiText({})).toBeUndefined()
		expect(extractMetaAiText({ richResponseMessage: {} })).toBeUndefined()
	})
})
