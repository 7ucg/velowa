/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import {
	richResponse,
	tokenizeCode,
} from '../../../../src/client/features/message/rich-response.js'

describe('rich response', () => {
	it('tokenizes code into coloured tokens', () => {
		const t = tokenizeCode('const x = foo("a", 1) // hi')
		expect(t.find((x) => x.content === 'const')?.type).toBe('KEYWORD')
		expect(t.find((x) => x.content === 'foo')?.type).toBe('METHOD')
		expect(t.find((x) => x.content === '"a"')?.type).toBe('STR')
		expect(t.find((x) => x.content === '1')?.type).toBe('NUMBER')
		expect(t.at(-1)).toEqual({ content: '// hi', type: 'COMMENT' })
		expect(t.map((x) => x.content).join('')).toBe('const x = foo("a", 1) // hi')
	})

	it('wraps the sections as a forwarded bot answer', () => {
		const r = richResponse({
			text: '**hi**',
			code: 'let a = 1',
			table: { rows: [['a', 'b']] },
			latex: 'x^2',
			map: { latitude: 1, longitude: 2 },
			html: '<b>hi</b>',
			allowRawHtml: true,
			imageUrl: 'https://example.com/a.png',
		})
		const rich = (r.message['botForwardedMessage'] as { message: { richResponseMessage: any } })
			.message.richResponseMessage
		const data = JSON.parse(Buffer.from(rich.unifiedResponse.data).toString())
		expect(data.sections.map((s: any) => s.view_model.primitive.__typename)).toEqual([
			'GenAIMarkdownTextUXPrimitive',
			'GenAICodeUXPrimitive',
			'GenAITableUXPrimitive',
			'GenAILatexUXPrimitive',
			'GenAIMapUXPrimitive',
			'FOAHtmlPrimitiveDemoDONOTUSE',
			'GenAIInlineImageUXPrimitive',
		])
		expect(rich.contextInfo.forwardedAiBotMessageInfo.botJid).toMatch(/@bot$/)
		expect(
			(r.message['messageContextInfo'] as { messageSecret: Buffer }).messageSecret,
		).toHaveLength(32)
	})

	it('refuses raw HTML unless it is explicitly allowed, and caps its size', () => {
		expect(() => richResponse({ html: '<b>x</b>' })).toThrow(/allowRawHtml/)
		expect(() => richResponse({ html: 'x'.repeat(65 * 1024), allowRawHtml: true })).toThrow(
			/64 KiB/,
		)
	})
})
