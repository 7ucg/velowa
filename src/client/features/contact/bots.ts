// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { BinaryNode } from '../../../codec/index.js'
import type { RequestFn } from '../group/groups.js'

// The bot directory: the AI bots (Meta AI and its siblings) the server offers this account.

export interface BotEntry {
	jid: string
	personaId: string
	cardTitle?: string
	count?: number
}

export interface BotSection {
	name: string
	/** `all`, `category` or `featured`. */
	type: string
	displayType?: string
	bots: BotEntry[]
}

export interface BotDirectory {
	version: string
	defaultBot?: { jid: string; personaId: string }
	sections: BotSection[]
	/** Every bot of every section, the default one first if no section holds it. */
	bots: BotEntry[]
}

const kids = (n: BinaryNode | undefined, tag: string): BinaryNode[] =>
	n && Array.isArray(n.content) ? n.content.filter((c) => c.tag === tag) : []

const entry = (n: BinaryNode): BotEntry | undefined => {
	const jid = n.attrs['jid']
	const personaId = n.attrs['persona_id']
	if (!jid || !personaId) return undefined
	return {
		jid,
		personaId,
		...(n.attrs['card_title'] && { cardTitle: n.attrs['card_title'] }),
		...(n.attrs['count'] && { count: Number(n.attrs['count']) }),
	}
}

export const botListRequest = (): BinaryNode => ({
	tag: 'iq',
	attrs: { type: 'get', xmlns: 'bot', to: 's.whatsapp.net' },
	content: [{ tag: 'bot', attrs: { v: '2' } }],
})

export function parseBotList(res: BinaryNode): BotDirectory {
	const bot = kids(res, 'bot')[0]
	if (!bot) throw new Error('no <bot> in the bot directory answer')
	const sections: BotSection[] = kids(bot, 'section').map((s) => ({
		name: s.attrs['name'] ?? '',
		type: s.attrs['type'] ?? 'all',
		...(s.attrs['display_type'] && { displayType: s.attrs['display_type'] }),
		bots: kids(s, 'bot')
			.map(entry)
			.filter((e): e is BotEntry => !!e),
	}))
	const d = kids(bot, 'default')[0]
	const defaultBot =
		d?.attrs['jid'] && d.attrs['persona_id']
			? { jid: d.attrs['jid'], personaId: d.attrs['persona_id'] }
			: undefined
	// A bot can be repeated across sections (e.g. in both "featured" and its category); the real server does.
	const seen = new Set<string>()
	const bots = sections
		.flatMap((s) => s.bots)
		.filter((b) => (seen.has(b.jid) ? false : seen.add(b.jid)))
	if (defaultBot && !bots.some((b) => b.jid === defaultBot.jid))
		bots.unshift({ jid: defaultBot.jid, personaId: defaultBot.personaId })
	return {
		version: bot.attrs['v'] ?? '2',
		...(defaultBot && { defaultBot }),
		sections,
		bots,
	}
}

export const listBots = async (request: RequestFn): Promise<BotDirectory> =>
	parseBotList(await request(botListRequest()))
