import { describe, expect, it } from 'vitest'
import type { BinaryNode } from '../../codec/index.js'
import {
	bizNode,
	callButton,
	copyButton,
	interactive,
	quickReply,
	singleSelect,
	urlButton,
} from './interactive.js'

describe('interactive messages', () => {
	it('serialises buttons into nativeFlowMessage and wraps in viewOnceMessage', () => {
		const { message, opts } = interactive({
			body: 'Wähle',
			footer: 'Fuß',
			header: { title: 'Titel' },
			buttons: [
				quickReply('Ja', 'yes'),
				urlButton('Web', 'https://x.example'),
				callButton('Anruf', '+49'),
				copyButton('Code', 'ABC'),
			],
		})
		const inner = (
			message['viewOnceMessage'] as {
				message: {
					interactiveMessage: {
						body: unknown
						footer: unknown
						nativeFlowMessage: { buttons: { name: string; buttonParamsJson: string }[] }
					}
				}
			}
		).message.interactiveMessage
		expect(inner.body).toEqual({ text: 'Wähle' })
		expect(inner.footer).toEqual({ text: 'Fuß' })
		expect(inner.nativeFlowMessage.buttons.map((b) => b.name)).toEqual([
			'quick_reply',
			'cta_url',
			'cta_call',
			'cta_copy',
		])
		expect(JSON.parse(inner.nativeFlowMessage.buttons[0]!.buttonParamsJson)).toEqual({
			display_text: 'Ja',
			id: 'yes',
		})
		expect(opts.extraNodes![0]!.tag).toBe('biz')
	})

	it('builds list buttons', () => {
		const b = singleSelect('Menü', [
			{ title: 'Pizza', rows: [{ id: 'm', title: 'Margherita', description: 'klassisch' }] },
		])
		expect(b.name).toBe('single_select')
		expect(b.params).toMatchObject({
			title: 'Menü',
			sections: [
				{
					title: 'Pizza',
					rows: [{ id: 'm', title: 'Margherita', description: 'klassisch', header: '' }],
				},
			],
		})
	})

	it('picks the biz node variant by first button', () => {
		expect(bizNode([quickReply('a', 'b')], 5)).toMatchObject({
			attrs: { privacy_mode_ts: '5' },
			content: [{ content: [{ attrs: { v: '9', name: 'mixed' } }] }, { tag: 'quality_control' }],
		})
		expect(
			(
				(bizNode([{ name: 'cta_catalog', params: {} }], 5).content as BinaryNode[])[0]!
					.content as BinaryNode[]
			)[0]!.attrs,
		).toEqual({ v: '2', name: 'cta_catalog' })
		expect(bizNode([{ name: 'review_and_pay', params: {} }]).attrs).toEqual({
			native_flow_name: 'order_details',
		})
	})

	it('validates the button count', () => {
		expect(() => interactive({ body: 'x', buttons: [] })).toThrow()
		expect(() =>
			interactive({ body: 'x', buttons: Array.from({ length: 11 }, () => quickReply('a', 'b')) }),
		).toThrow()
	})
})
