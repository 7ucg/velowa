import type { BinaryNode } from '../../codec/index.js'
import type { SendOptions } from '../sender.js'
import { bizNode } from './interactive.js'

type Msg = Record<string, unknown>
type Built = { message: Msg; opts: SendOptions }

const quality = { tag: 'quality_control', attrs: { source_type: 'third_party' } } as const
const bizAttrs = (now: number) => ({
	actual_actors: '2',
	host_storage: '2',
	privacy_mode_ts: String(now),
})

// ---- classic buttons --------------------------------------------------------------------------

export interface QuickButton {
	id: string
	text: string
}

export interface ButtonsOptions {
	text: string
	footer?: string
	/** Up to 3 quick-reply buttons. */
	buttons: QuickButton[]
	/** A title shown above the text. */
	title?: string
}

/** Up to three reply buttons under a message (`buttonsMessage`). The tap comes back as a `buttonsResponseMessage`. */
export function buttonsMessage(o: ButtonsOptions, now = Math.floor(Date.now() / 1000)): Built {
	if (!o.buttons.length) throw new Error('at least one button')
	if (o.buttons.length > 3)
		throw new Error('at most 3 buttons (use a list or native buttons for more)')
	return {
		message: {
			viewOnceMessage: {
				message: {
					messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
					buttonsMessage: {
						contentText: o.text,
						...(o.footer && { footerText: o.footer }),
						...(o.title ? { text: o.title, headerType: 'TEXT' } : { headerType: 'EMPTY' }),
						buttons: o.buttons.map((b) => ({
							buttonId: b.id,
							buttonText: { displayText: b.text },
							type: 'RESPONSE',
						})),
					},
				},
			},
		},
		opts: {
			extraNodes: [
				{
					tag: 'biz',
					attrs: bizAttrs(now),
					content: [
						{
							tag: 'interactive',
							attrs: { type: 'native_flow', v: '1' },
							content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
						},
						quality,
					],
				},
			],
		},
	}
}

// ---- list -------------------------------------------------------------------------------------

export interface ListOptions {
	title: string
	text: string
	/** Label of the button that opens the list. */
	buttonText: string
	footer?: string
	sections: { title: string; rows: { id: string; title: string; description?: string }[] }[]
}

/** A "choose from a list" message (`listMessage`). The pick comes back as a `listResponseMessage`. */
export function listMessage(o: ListOptions, now = Math.floor(Date.now() / 1000)): Built {
	if (!o.sections.length || o.sections.some((s) => !s.rows.length))
		throw new Error('every section needs rows')
	if (o.sections.reduce((n, s) => n + s.rows.length, 0) > 10)
		throw new Error('at most 10 rows in total')
	return {
		message: {
			viewOnceMessage: {
				message: {
					messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
					listMessage: {
						title: o.title,
						description: o.text,
						buttonText: o.buttonText,
						listType: 'SINGLE_SELECT',
						...(o.footer && { footerText: o.footer }),
						sections: o.sections.map((s) => ({
							title: s.title,
							rows: s.rows.map((r) => ({
								title: r.title,
								rowId: r.id,
								...(r.description && { description: r.description }),
							})),
						})),
					},
				},
			},
		},
		opts: {
			extraNodes: [
				{
					tag: 'biz',
					attrs: bizAttrs(now),
					content: [{ tag: 'list', attrs: { v: '2', type: 'product_list' } }, quality],
				},
			],
		},
	}
}

// ---- hydrated template ------------------------------------------------------------------------

export type TemplateButton =
	| { type: 'reply'; text: string; id: string }
	| { type: 'url'; text: string; url: string }
	| { type: 'call'; text: string; phone: string }

export interface TemplateOptions {
	text: string
	footer?: string
	title?: string
	buttons: TemplateButton[]
	templateId?: string
}

/** The older "template" buttons: quick replies, a link and a phone number, up to 4 (`templateMessage`). */
export function templateMessage(o: TemplateOptions, now = Math.floor(Date.now() / 1000)): Built {
	if (!o.buttons.length || o.buttons.length > 4) throw new Error('1 to 4 template buttons')
	const hydrated = {
		hydratedContentText: o.text,
		...(o.footer && { hydratedFooterText: o.footer }),
		...(o.title && { hydratedTitleText: o.title }),
		templateId: o.templateId ?? String(now),
		hydratedButtons: o.buttons.map((b, index) => ({
			index,
			...(b.type === 'reply' && { quickReplyButton: { displayText: b.text, id: b.id } }),
			...(b.type === 'url' && { urlButton: { displayText: b.text, url: b.url } }),
			...(b.type === 'call' && { callButton: { displayText: b.text, phoneNumber: b.phone } }),
		})),
	}
	return {
		message: {
			viewOnceMessage: {
				message: {
					messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
					templateMessage: { fourRowTemplate: hydrated, hydratedTemplate: hydrated },
				},
			},
		},
		opts: { extraNodes: [{ tag: 'biz', attrs: bizAttrs(now) } as BinaryNode] },
	}
}

// ---- replies ----------------------------------------------------------------------------------

export const buttonsResponse = (id: string, displayText: string): Msg => ({
	buttonsResponseMessage: {
		selectedButtonId: id,
		selectedDisplayText: displayText,
		type: 'DISPLAY_TEXT',
	},
})
export const listResponse = (rowId: string, title: string, description?: string): Msg => ({
	listResponseMessage: {
		title,
		listType: 'SINGLE_SELECT',
		singleSelectReply: { selectedRowId: rowId },
		...(description && { description }),
	},
})
export const templateButtonReply = (id: string, displayText: string, index = 0): Msg => ({
	templateButtonReplyMessage: {
		selectedId: id,
		selectedDisplayText: displayText,
		selectedIndex: index,
	},
})
/** Answer a native-flow button (`name` is the button's name, e.g. `quick_reply`). */
export const interactiveResponse = (
	name: string,
	params: Record<string, unknown>,
	bodyText = '',
): Msg => ({
	interactiveResponseMessage: {
		body: { text: bodyText, format: 'DEFAULT' },
		nativeFlowResponseMessage: { name, paramsJson: JSON.stringify(params), version: 3 },
	},
})

export interface ButtonReply {
	kind: 'button' | 'list' | 'template' | 'native-flow'
	/** Id of the tapped button / row. */
	id: string
	/** What the user saw. */
	text: string
	/** Native flow: the button's name and parameters. */
	flow?: { name: string; params: unknown }
}

/**
 * Normalise the answer to a button / list / template / native-flow message from a received message
 * (`event.message`). Returns undefined for anything else.
 */
export function parseButtonReply(message: Msg): ButtonReply | undefined {
	const m = message as Record<string, Record<string, unknown> | undefined>
	const b = m['buttonsResponseMessage']
	if (b)
		return {
			kind: 'button',
			id: String(b['selectedButtonId'] ?? ''),
			text: String(b['selectedDisplayText'] ?? ''),
		}
	const l = m['listResponseMessage']
	if (l)
		return {
			kind: 'list',
			id: String(
				(l['singleSelectReply'] as { selectedRowId?: string } | undefined)?.selectedRowId ?? '',
			),
			text: String(l['title'] ?? ''),
		}
	const t = m['templateButtonReplyMessage']
	if (t)
		return {
			kind: 'template',
			id: String(t['selectedId'] ?? ''),
			text: String(t['selectedDisplayText'] ?? ''),
		}
	const i = m['interactiveResponseMessage']
	const nf = i?.['nativeFlowResponseMessage'] as { name?: string; paramsJson?: string } | undefined
	if (nf) {
		let params: unknown = {}
		try {
			params = JSON.parse(nf.paramsJson || '{}')
		} catch {
			/* keep the empty object for broken JSON */
		}
		const p = params as { id?: string; selected_id?: string; display_text?: string }
		return {
			kind: 'native-flow',
			id: String(p.id ?? p.selected_id ?? ''),
			text: String(p.display_text ?? (i?.['body'] as { text?: string } | undefined)?.text ?? ''),
			flow: { name: nf.name ?? '', params },
		}
	}
	return undefined
}

export { bizNode }
