// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { BinaryNode } from '../../../codec/index.js'
import type { RequestFn } from '../group/groups.js'
import type { MexFn } from '../mex.js'

// What the server says about this account and about how it is configured.

const IDS = {
	REACHOUT_TIMELOCK: '23983697327930364',
	NEW_CHAT_CAP: '27910975521856601',
}

export interface AbProps {
	/** `config_code` -> `config_value` of every experiment flag the server sent. */
	props: Record<string, string>
	/** The hash and refresh id to ask with next time (the server answers with changes only). */
	hash?: string
	refreshId?: string
	/** Seconds until the flags should be fetched again. */
	refresh?: number
}

const kids = (n: BinaryNode | undefined, tag: string): BinaryNode[] =>
	n && Array.isArray(n.content) ? n.content.filter((c) => c.tag === tag) : []

export const abPropsRequest = (o: { hash?: string; refreshId?: string } = {}): BinaryNode => ({
	tag: 'iq',
	attrs: { to: 's.whatsapp.net', type: 'get', xmlns: 'abt' },
	content: [
		{
			tag: 'props',
			attrs: {
				protocol: '1',
				...(o.hash && { hash: o.hash }),
				...(o.refreshId && { refresh_id: o.refreshId }),
			},
		},
	],
})

export function parseAbProps(res: BinaryNode): AbProps {
	const p = kids(res, 'props')[0]
	const props: Record<string, string> = {}
	for (const n of kids(p, 'prop'))
		if (n.attrs['config_code'] !== undefined)
			props[n.attrs['config_code']] = n.attrs['config_value'] ?? ''
	return {
		props,
		...(p?.attrs['hash'] && { hash: p.attrs['hash'] }),
		...(p?.attrs['refresh_id'] && { refreshId: p.attrs['refresh_id'] }),
		...(p?.attrs['refresh'] && { refresh: Number(p.attrs['refresh']) }),
	}
}

/** The stanza that switches the account between receiving everything (active) and the background (passive). */
export const passiveNode = (active: boolean): BinaryNode => ({
	tag: 'iq',
	attrs: { to: 's.whatsapp.net', type: 'set', xmlns: 'passive' },
	content: [{ tag: active ? 'active' : 'passive', attrs: {} }],
})

export class ServerInfo {
	constructor(
		private readonly request: RequestFn,
		private readonly mex: MexFn,
	) {}

	/** The server's experiment flags (A/B props). Pass the last `hash` and `refreshId` to get changes only. */
	async abProps(o: { hash?: string; refreshId?: string } = {}): Promise<AbProps> {
		return parseAbProps(await this.request(abPropsRequest(o)))
	}

	/** Whether the account is restricted from starting chats with people who do not know it ("reachout timelock"). */
	reachoutTimelock = (): Promise<unknown> =>
		this.mex(IDS.REACHOUT_TIMELOCK, {}, 'xwa2_fetch_account_reachout_timelock')

	/** How many new chats the account may start in the current period. */
	newChatCap = (): Promise<unknown> =>
		this.mex(
			IDS.NEW_CHAT_CAP,
			{ input: { type: 'INDIVIDUAL_NEW_CHAT_THREAD' } },
			'xwa2_message_capping_info',
		)

	/** Go active (get every notification) or passive (background; fewer stanzas). */
	setPassive = async (passive: boolean): Promise<void> => {
		await this.request(passiveNode(!passive))
	}
}
