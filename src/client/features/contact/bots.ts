// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { BinaryNode } from '../../../codec/index.js'
import type { RequestFn } from '../group/groups.js'
import { botProfileProtocol, usync } from './contacts.js'

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

// ---- one bot's own profile ---------------------------------------------------------------------

export interface BotProfile {
	jid: string
	personaId?: string
	name?: string
	attributes?: string
	description?: string
	category?: string
	isDefault: boolean
	/** `${emoji} ${text}` suggested conversation starters, as the directory shows them. */
	prompts: string[]
	commands: { name: string; description: string }[]
	commandsDescription?: string
}

const text = (n: BinaryNode | undefined): string | undefined =>
	!n
		? undefined
		: typeof n.content === 'string'
			? n.content
			: n.content instanceof Uint8Array
				? Buffer.from(n.content).toString('utf8')
				: undefined

/** What one AI bot can do: its name/description/category, suggested prompts and slash commands. */
export async function fetchBotProfile(
	request: RequestFn,
	sid: string,
	jid: string,
	personaId: string,
): Promise<BotProfile | undefined> {
	const [entry] = await usync(
		request,
		sid,
		'interactive',
		[botProfileProtocol],
		[{ jid, personaId }],
	)
	const profile = kids(entry?.nodes['bot'], 'profile')[0]
	if (!profile) return undefined
	const commandsNode = kids(profile, 'commands')[0]
	const promptsNode = kids(profile, 'prompts')[0]
	return {
		jid: entry!.id,
		...(profile.attrs['persona_id'] && { personaId: profile.attrs['persona_id'] }),
		...(text(kids(profile, 'name')[0]) !== undefined && { name: text(kids(profile, 'name')[0]) }),
		...(text(kids(profile, 'attributes')[0]) !== undefined && {
			attributes: text(kids(profile, 'attributes')[0]),
		}),
		...(text(kids(profile, 'description')[0]) !== undefined && {
			description: text(kids(profile, 'description')[0]),
		}),
		...(text(kids(profile, 'category')[0]) !== undefined && {
			category: text(kids(profile, 'category')[0]),
		}),
		isDefault: kids(profile, 'default').length > 0,
		commands: kids(commandsNode, 'command').map((c) => ({
			name: text(kids(c, 'name')[0]) ?? '',
			description: text(kids(c, 'description')[0]) ?? '',
		})),
		prompts: kids(promptsNode, 'prompt').map((p) =>
			[text(kids(p, 'emoji')[0]), text(kids(p, 'text')[0])].filter(Boolean).join(' '),
		),
		...(text(kids(commandsNode, 'description')[0]) !== undefined && {
			commandsDescription: text(kids(commandsNode, 'description')[0]),
		}),
	}
}
