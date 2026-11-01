import { randomBytes, randomUUID } from 'node:crypto'
import type { SendOptions } from '../sender.js'

const KEYWORDS = new Set(
	'break case catch continue debugger default delete do else finally for function if in instanceof new return switch this throw try typeof var void while with true false null undefined NaN Infinity class const let super extends export import yield static constructor of async await get set implements interface package private protected public enum throws transient'.split(
		' ',
	),
)

export interface CodeToken {
	content: string
	type: 'DEFAULT' | 'STR' | 'COMMENT' | 'NUMBER' | 'KEYWORD' | 'METHOD'
}

/** Split source code into the coloured tokens the code block view expects. */
export function tokenizeCode(code: string): CodeToken[] {
	const tokens: CodeToken[] = []
	let i = 0
	const n = code.length
	while (i < n) {
		const c = code[i]!
		const start = i
		if (/\s/.test(c)) {
			while (i < n && /\s/.test(code[i]!)) i++
			tokens.push({ content: code.slice(start, i), type: 'DEFAULT' })
		} else if (c === '"' || c === "'" || c === '`') {
			i++
			while (i < n && code[i] !== c) {
				if (code[i] === '\\') i++
				i++
			}
			i++
			tokens.push({ content: code.slice(start, i), type: 'STR' })
		} else if (c === '/' && code[i + 1] === '/') {
			while (i < n && code[i] !== '\n') i++
			tokens.push({ content: code.slice(start, i), type: 'COMMENT' })
		} else if (c === '/' && code[i + 1] === '*') {
			i += 2
			while (i + 1 < n && !(code[i] === '*' && code[i + 1] === '/')) i++
			i += 2
			tokens.push({ content: code.slice(start, Math.min(i, n)), type: 'COMMENT' })
		} else if (/[0-9]/.test(c)) {
			while (i < n && /[0-9.]/.test(code[i]!)) i++
			tokens.push({ content: code.slice(start, i), type: 'NUMBER' })
		} else if (/[a-zA-Z_$]/.test(c)) {
			while (i < n && /[a-zA-Z0-9_$]/.test(code[i]!)) i++
			const word = code.slice(start, i)
			let j = i
			while (j < n && /\s/.test(code[j]!)) j++
			tokens.push({
				content: word,
				type: KEYWORDS.has(word) ? 'KEYWORD' : code[j] === '(' ? 'METHOD' : 'DEFAULT',
			})
		} else {
			tokens.push({ content: c, type: 'DEFAULT' })
			i++
		}
	}
	const merged: CodeToken[] = []
	for (const t of tokens) {
		const last = merged[merged.length - 1]
		if (last && last.type === 'DEFAULT' && t.type === 'DEFAULT') last.content += t.content
		else merged.push({ ...t })
	}
	return merged
}

export interface RichResponseOptions {
	/** Markdown text. */
	text?: string
	code?: string
	language?: string
	/** Table rows; each row an array of cell texts. */
	table?: { rows: string[][] }
	/** One or more LaTeX expressions. */
	latex?: string | string[]
	map?: {
		latitude: number
		longitude: number
		zoom?: number
		title?: string
		annotations?: unknown[]
	}
	imageUrl?: string
	imageUrls?: string[]
	/** The bot the answer is attributed to (default: Meta AI). */
	botJid?: string
	responseId?: string
}

const section = (primitive: Record<string, unknown>, typename: string) => ({
	view_model: {
		primitive: { ...primitive, __typename: typename },
		__typename: 'GenAISingleLayoutViewModel',
	},
})

/**
 * A "rich response" as the Meta AI chat shows it: markdown text, code with highlighting, tables, LaTeX, a map and
 * images in one bot answer. The sections are JSON inside a `richResponseMessage` forwarded as a bot message.
 */
export function richResponse(o: RichResponseOptions): {
	message: Record<string, unknown>
	opts: SendOptions
} {
	const sections: unknown[] = []
	if (o.text) sections.push(section({ text: o.text }, 'GenAIMarkdownTextUXPrimitive'))
	if (o.code)
		sections.push(
			section(
				{ language: o.language ?? 'javascript', code_blocks: tokenizeCode(o.code) },
				'GenAICodeUXPrimitive',
			),
		)
	if (o.table?.rows)
		sections.push(
			section(
				{ rows: o.table.rows.map((row) => ({ cells: row.map((c) => ({ text: String(c) })) })) },
				'GenAITableUXPrimitive',
			),
		)
	if (o.latex !== undefined) {
		const list = Array.isArray(o.latex) ? o.latex : [o.latex]
		sections.push(
			section({ expressions: list.map((expression) => ({ expression })) }, 'GenAILatexUXPrimitive'),
		)
	}
	if (o.map)
		sections.push(
			section(
				{
					latitude: o.map.latitude,
					longitude: o.map.longitude,
					zoom: o.map.zoom,
					title: o.map.title,
					annotations: o.map.annotations ?? [],
				},
				'GenAIMapUXPrimitive',
			),
		)
	if (o.imageUrl) sections.push(section({ url: o.imageUrl }, 'GenAIInlineImageUXPrimitive'))
	if (o.imageUrls?.length)
		sections.push(
			section({ urls: o.imageUrls.map((url) => ({ url })) }, 'GenAIGridImageUXPrimitive'),
		)
	if (!sections.length) sections.push(section({ text: '' }, 'GenAIMarkdownTextUXPrimitive'))
	const data = { response_id: o.responseId ?? randomUUID(), sections }
	return {
		message: {
			messageContextInfo: {
				deviceListMetadata: {},
				deviceListMetadataVersion: 2,
				messageSecret: randomBytes(32),
			},
			botForwardedMessage: {
				message: {
					richResponseMessage: {
						submessages: [],
						messageType: 1,
						unifiedResponse: { data: Buffer.from(JSON.stringify(data)) },
						contextInfo: {
							forwardingScore: 2,
							isForwarded: true,
							forwardedAiBotMessageInfo: { botJid: o.botJid ?? '259786046210223@bot' },
							botMessageSharingInfo: { botEntryPointOrigin: 1, forwardScore: 2 },
						},
					},
				},
			},
		},
		opts: {},
	}
}
