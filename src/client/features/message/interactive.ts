import type { BinaryNode } from '../../../codec/index.js'
import type { SendOptions } from '../../sender.js'

/** One button of a native-flow ("interactive") message. `params` is serialised into `buttonParamsJson`. */
export interface NativeButton {
	name: string
	params: Record<string, unknown>
}

export const quickReply = (displayText: string, id: string): NativeButton => ({
	name: 'quick_reply',
	params: { display_text: displayText, id },
})
export const urlButton = (displayText: string, url: string, merchantUrl = url): NativeButton => ({
	name: 'cta_url',
	params: { display_text: displayText, url, merchant_url: merchantUrl },
})
export const callButton = (displayText: string, phoneNumber: string): NativeButton => ({
	name: 'cta_call',
	params: { display_text: displayText, phone_number: phoneNumber },
})
export const copyButton = (displayText: string, copyCode: string): NativeButton => ({
	name: 'cta_copy',
	params: { display_text: displayText, copy_code: copyCode },
})

export interface ListSection {
	title: string
	rows: { id: string; title: string; description?: string }[]
}
/** A "choose from a list" button. */
export const singleSelect = (buttonTitle: string, sections: ListSection[]): NativeButton => ({
	name: 'single_select',
	params: {
		title: buttonTitle,
		sections: sections.map((s) => ({
			title: s.title,
			highlight_label: '',
			rows: s.rows.map((r) => ({
				header: '',
				title: r.title,
				description: r.description ?? '',
				id: r.id,
			})),
		})),
	},
})

export interface InteractiveOptions {
	body: string
	footer?: string
	header?: { title?: string; subtitle?: string }
	buttons: NativeButton[]
}

/** Button names that need their own `native_flow` name in the `<biz>` node instead of the generic "mixed". */
const SPECIAL_FLOWS = new Set([
	'mpm',
	'cta_catalog',
	'send_location',
	'call_permission_request',
	'wa_payment_transaction_details',
	'automated_greeting_message_view_catalog',
])

/** The `<biz>` node WhatsApp expects around a native-flow message. */
export function bizNode(
	buttons: NativeButton[],
	nowSeconds = Math.floor(Date.now() / 1000),
): BinaryNode {
	const first = buttons[0]?.name
	if (first === 'review_and_pay' || first === 'payment_info') {
		return {
			tag: 'biz',
			attrs: { native_flow_name: first === 'review_and_pay' ? 'order_details' : first },
		}
	}
	const flow =
		first && SPECIAL_FLOWS.has(first) ? { v: '2', name: first } : { v: '9', name: 'mixed' }
	return {
		tag: 'biz',
		attrs: { actual_actors: '2', host_storage: '2', privacy_mode_ts: String(nowSeconds) },
		content: [
			{
				tag: 'interactive',
				attrs: { type: 'native_flow', v: '1' },
				content: [{ tag: 'native_flow', attrs: flow }],
			},
			{ tag: 'quality_control', attrs: { source_type: 'third_party' } },
		],
	}
}

/**
 * A message with buttons / a list. Sent wrapped in `viewOnceMessage` (as WhatsApp requires for button messages)
 * together with the `<biz>` node. Interactive messages are only rendered for chats with regular accounts.
 */
export function interactive(o: InteractiveOptions): {
	message: Record<string, unknown>
	opts: SendOptions
} {
	if (!o.buttons.length) throw new Error('an interactive message needs at least one button')
	if (o.buttons.length > 10) throw new Error('at most 10 buttons')
	const interactiveMessage = {
		body: { text: o.body },
		...(o.footer && { footer: { text: o.footer } }),
		...(o.header && {
			header: {
				title: o.header.title ?? '',
				subtitle: o.header.subtitle ?? '',
				hasMediaAttachment: false,
			},
		}),
		nativeFlowMessage: {
			buttons: o.buttons.map((b) => ({ name: b.name, buttonParamsJson: JSON.stringify(b.params) })),
			messageParamsJson: '',
			messageVersion: 1,
		},
	}
	return {
		message: {
			viewOnceMessage: {
				message: {
					messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
					interactiveMessage,
				},
			},
		},
		opts: { extraNodes: [bizNode(o.buttons)] },
	}
}
