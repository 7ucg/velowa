import { describe, expect, it } from 'vitest'
import type { BinaryNode } from '../../../../src/codec/index.js'
import {
	botListRequest,
	fetchBotProfile,
	listBots,
	parseBotList,
} from '../../../../src/client/features/contact/bots.js'

const answer: BinaryNode = {
	tag: 'iq',
	attrs: { type: 'result' },
	content: [
		{
			tag: 'bot',
			attrs: { v: '3' },
			content: [
				{ tag: 'default', attrs: { jid: '1@bot', persona_id: 'p-default' } },
				{
					tag: 'section',
					attrs: { name: 'Featured', type: 'featured', display_type: 'hscroll' },
					content: [
						{
							tag: 'bot',
							attrs: { jid: '2@bot', persona_id: 'p2', card_title: 'Chef', count: '3' },
						},
						{ tag: 'bot', attrs: { jid: 'broken@bot' } },
					],
				},
			],
		},
	],
}

describe('bot directory', () => {
	it('asks version 2 of the directory', () => {
		expect(botListRequest()).toEqual({
			tag: 'iq',
			attrs: { type: 'get', xmlns: 'bot', to: 's.whatsapp.net' },
			content: [{ tag: 'bot', attrs: { v: '2' } }],
		})
	})

	it('reads sections and puts the default bot first when no section has it', () => {
		const d = parseBotList(answer)
		expect(d.version).toBe('3')
		expect(d.sections).toEqual([
			{
				name: 'Featured',
				type: 'featured',
				displayType: 'hscroll',
				bots: [{ jid: '2@bot', personaId: 'p2', cardTitle: 'Chef', count: 3 }],
			},
		])
		expect(d.bots.map((b) => b.jid)).toEqual(['1@bot', '2@bot'])
		expect(d.defaultBot).toEqual({ jid: '1@bot', personaId: 'p-default' })
	})

	it('dedupes a bot repeated across sections (the server does this)', () => {
		const repeated: BinaryNode = {
			tag: 'iq',
			attrs: { type: 'result' },
			content: [
				{
					tag: 'bot',
					attrs: { v: '3' },
					content: [
						{
							tag: 'section',
							attrs: { name: 'Featured', type: 'featured' },
							content: [{ tag: 'bot', attrs: { jid: '2@bot', persona_id: 'p2' } }],
						},
						{
							tag: 'section',
							attrs: { name: 'Cooking', type: 'category' },
							content: [{ tag: 'bot', attrs: { jid: '2@bot', persona_id: 'p2' } }],
						},
					],
				},
			],
		}
		const d = parseBotList(repeated)
		expect(d.bots.map((b) => b.jid)).toEqual(['2@bot'])
		// the raw sections are untouched - only the flattened convenience list is deduped
		expect(d.sections.map((s) => s.bots.length)).toEqual([1, 1])
	})

	it('goes through the request function', async () => {
		const sent: BinaryNode[] = []
		const d = await listBots(async (n) => (sent.push(n), answer))
		expect(sent[0]!.attrs['xmlns']).toBe('bot')
		expect(d.bots).toHaveLength(2)
		expect(() => parseBotList({ tag: 'iq', attrs: {} })).toThrow()
	})
})

describe('fetchBotProfile', () => {
	const t = (tag: string, v: string): BinaryNode => ({ tag, attrs: {}, content: Buffer.from(v) })

	it('reads one bot’s name, prompts and commands', async () => {
		const sent: BinaryNode[] = []
		const profileAnswer: BinaryNode = {
			tag: 'iq',
			attrs: { type: 'result' },
			content: [
				{
					tag: 'usync',
					attrs: {},
					content: [
						{
							tag: 'list',
							attrs: {},
							content: [
								{
									tag: 'user',
									attrs: { jid: '1@bot' },
									content: [
										{
											tag: 'bot',
											attrs: {},
											content: [
												{
													tag: 'profile',
													attrs: { persona_id: 'p-default' },
													content: [
														t('name', 'Helper'),
														t('description', 'Helps with stuff'),
														t('category', 'utility'),
														{ tag: 'default', attrs: {} },
														{
															tag: 'prompts',
															attrs: {},
															content: [
																{
																	tag: 'prompt',
																	attrs: {},
																	content: [t('emoji', '☀️'), t('text', 'weather')],
																},
															],
														},
														{
															tag: 'commands',
															attrs: {},
															content: [
																t('description', 'Available commands'),
																{
																	tag: 'command',
																	attrs: {},
																	content: [t('name', '/help'), t('description', 'show help')],
																},
															],
														},
													],
												},
											],
										},
									],
								},
							],
						},
					],
				},
			],
		}
		const profile = await fetchBotProfile(
			async (n) => (sent.push(n), profileAnswer),
			'sid1',
			'1@bot',
			'p-default',
		)
		expect(profile).toEqual({
			jid: '1@bot',
			personaId: 'p-default',
			name: 'Helper',
			description: 'Helps with stuff',
			category: 'utility',
			isDefault: true,
			prompts: ['☀️ weather'],
			commands: [{ name: '/help', description: 'show help' }],
			commandsDescription: 'Available commands',
		})
	})

	it('returns undefined when the server answers with no profile', async () => {
		const empty: BinaryNode = {
			tag: 'iq',
			attrs: { type: 'result' },
			content: [{ tag: 'usync', attrs: {}, content: [{ tag: 'list', attrs: {}, content: [] }] }],
		}
		const profile = await fetchBotProfile(async () => empty, 'sid1', '1@bot', 'p-default')
		expect(profile).toBeUndefined()
	})
})
