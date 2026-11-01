/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import {
	buttonsMessage,
	buttonsResponse,
	interactiveResponse,
	listMessage,
	listResponse,
	parseButtonReply,
	templateButtonReply,
	templateMessage,
} from './buttons.js'

describe('buttons', () => {
	it('builds reply buttons with the biz node and limits them to 3', () => {
		const b = buttonsMessage({ text: 'Pick', footer: 'f', buttons: [{ id: 'a', text: 'A' }] }, 100)
		const inner = (b.message['viewOnceMessage'] as { message: Record<string, any> }).message[
			'buttonsMessage'
		]
		expect(inner).toMatchObject({
			contentText: 'Pick',
			footerText: 'f',
			headerType: 'EMPTY',
			buttons: [{ buttonId: 'a', buttonText: { displayText: 'A' }, type: 'RESPONSE' }],
		})
		expect(b.opts.extraNodes?.[0]).toMatchObject({ tag: 'biz', attrs: { privacy_mode_ts: '100' } })
		expect(() =>
			buttonsMessage({ text: 'x', buttons: ['1', '2', '3', '4'].map((i) => ({ id: i, text: i })) }),
		).toThrow()
	})

	it('builds a list and a template', () => {
		const l = listMessage({
			title: 'T',
			text: 'body',
			buttonText: 'Open',
			sections: [{ title: 'S', rows: [{ id: 'r1', title: 'One', description: 'd' }] }],
		})
		expect(JSON.stringify(l.message)).toContain('"rowId":"r1"')
		expect(l.opts.extraNodes?.[0]?.content).toEqual(
			expect.arrayContaining([{ tag: 'list', attrs: { v: '2', type: 'product_list' } }]),
		)
		const t = templateMessage(
			{
				text: 'hi',
				buttons: [
					{ type: 'reply', text: 'Yes', id: 'y' },
					{ type: 'url', text: 'Site', url: 'https://example.com' },
					{ type: 'call', text: 'Call', phone: '+49123' },
				],
			},
			5,
		)
		const tm = (t.message['viewOnceMessage'] as { message: Record<string, any> }).message[
			'templateMessage'
		]
		expect(tm.hydratedTemplate.hydratedButtons.map((b: { index: number }) => b.index)).toEqual([
			0, 1, 2,
		])
		expect(tm.hydratedTemplate.hydratedButtons[1].urlButton.url).toBe('https://example.com')
	})

	it('builds and parses every kind of reply', () => {
		expect(parseButtonReply(buttonsResponse('a', 'A'))).toEqual({
			kind: 'button',
			id: 'a',
			text: 'A',
		})
		expect(parseButtonReply(listResponse('r1', 'One'))).toEqual({
			kind: 'list',
			id: 'r1',
			text: 'One',
		})
		expect(parseButtonReply(templateButtonReply('y', 'Yes', 2))).toEqual({
			kind: 'template',
			id: 'y',
			text: 'Yes',
		})
		const nf = parseButtonReply(interactiveResponse('quick_reply', { id: 'q', display_text: 'Q' }))
		expect(nf).toMatchObject({
			kind: 'native-flow',
			id: 'q',
			text: 'Q',
			flow: { name: 'quick_reply' },
		})
		expect(parseButtonReply({ conversation: 'hi' })).toBeUndefined()
	})
})
