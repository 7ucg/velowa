// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { createHmac, hkdfSync } from 'node:crypto'
import type { BinaryNode } from '../codec/index.js'

/** Which protobuf fields of a `Message` enter the reporting token (`m` = keep the whole sub-message). */
interface Field {
	f: number
	m?: boolean
	s?: Field[]
}
const IMG: Field = { f: 17, s: [{ f: 21 }, { f: 22 }] }
const FIELDS: Field[] = [
	{ f: 1 },
	{ f: 3, s: [{ f: 2 }, { f: 3 }, { f: 8 }, { f: 11 }, IMG, { f: 25 }] },
	{ f: 4, s: [{ f: 1 }, { f: 16 }, IMG] },
	{ f: 5, s: [{ f: 3 }, { f: 4 }, { f: 5 }, { f: 16 }, IMG] },
	{ f: 6, s: [{ f: 1 }, IMG, { f: 30 }] },
	{ f: 7, s: [{ f: 2 }, { f: 7 }, { f: 10 }, IMG, { f: 20 }] },
	{ f: 8, s: [{ f: 2 }, { f: 7 }, { f: 9 }, IMG, { f: 21 }] },
	{ f: 9, s: [{ f: 2 }, { f: 6 }, { f: 7 }, { f: 13 }, IMG, { f: 20 }] },
	{ f: 12, s: [{ f: 1 }, { f: 2 }, { f: 14, m: true }, { f: 15 }] },
	{ f: 18, s: [{ f: 6 }, { f: 16 }, IMG] },
	{ f: 26, s: [{ f: 4 }, { f: 5 }, { f: 8 }, { f: 13 }, IMG] },
	{
		f: 28,
		s: [{ f: 1 }, { f: 2 }, { f: 4 }, { f: 5 }, { f: 6 }, { f: 7, s: [{ f: 21 }, { f: 22 }] }],
	},
	{ f: 37, s: [{ f: 1, m: true }] },
	{
		f: 49,
		s: [
			{ f: 2 },
			{ f: 3, s: [{ f: 1 }, { f: 2 }] },
			{ f: 5, s: [{ f: 21 }, { f: 22 }] },
			{ f: 8, s: [{ f: 1 }, { f: 2 }] },
		],
	},
	{ f: 53, s: [{ f: 1, m: true }] },
	{ f: 55, s: [{ f: 1, m: true }] },
	{ f: 58, s: [{ f: 1, m: true }] },
	{ f: 59, s: [{ f: 1, m: true }] },
	{
		f: 60,
		s: [
			{ f: 2 },
			{ f: 3, s: [{ f: 1 }, { f: 2 }] },
			{ f: 5, s: [{ f: 21 }, { f: 22 }] },
			{ f: 8, s: [{ f: 1 }, { f: 2 }] },
		],
	},
	{
		f: 64,
		s: [
			{ f: 2 },
			{ f: 3, s: [{ f: 1 }, { f: 2 }] },
			{ f: 5, s: [{ f: 21 }, { f: 22 }] },
			{ f: 8, s: [{ f: 1 }, { f: 2 }] },
		],
	},
	{ f: 66, s: [{ f: 2 }, { f: 6 }, { f: 7 }, { f: 13 }, IMG, { f: 20 }] },
	{ f: 74, s: [{ f: 1, m: true }] },
	{ f: 87, s: [{ f: 1, m: true }] },
	{ f: 88, s: [{ f: 1 }, { f: 2, s: [{ f: 1 }] }, { f: 3, s: [{ f: 21 }, { f: 22 }] }] },
	{ f: 92, s: [{ f: 1, m: true }] },
	{ f: 93, s: [{ f: 1, m: true }] },
	{ f: 94, s: [{ f: 1, m: true }] },
]

interface Cfg {
	m: boolean | undefined
	children: Map<number, Cfg> | undefined
}
const compile = (fields: Field[]): Map<number, Cfg> =>
	new Map(fields.map((f) => [f.f, { m: f.m, children: f.s ? compile(f.s) : undefined }]))
const COMPILED = compile(FIELDS)
const EMPTY = new Map<number, Cfg>()

function readVarint(buf: Uint8Array, offset: number): { value: number; bytes: number } | undefined {
	let value = 0
	let bytes = 0
	let shift = 0
	while (offset + bytes < buf.length) {
		const cur = buf[offset + bytes]!
		value |= (cur & 0x7f) << shift
		bytes++
		if ((cur & 0x80) === 0) return { value, bytes }
		shift += 7
		if (shift > 35) return undefined
	}
	return undefined
}

function writeVarint(value: number): Buffer {
	const parts: number[] = []
	let rest = value >>> 0
	while (rest > 0x7f) {
		parts.push((rest & 0x7f) | 0x80)
		rest >>>= 7
	}
	parts.push(rest)
	return Buffer.from(parts)
}

/** Keep only the whitelisted fields (recursively), ordered by field number; undefined on malformed input. */
function extract(data: Uint8Array, cfg: Map<number, Cfg>): Buffer | undefined {
	const out: { num: number; bytes: Buffer }[] = []
	let i = 0
	while (i < data.length) {
		const tag = readVarint(data, i)
		if (!tag) return undefined
		const num = tag.value >> 3
		const wire = tag.value & 7
		const start = i
		i += tag.bytes
		const field = cfg.get(num)
		const keepOrSkip = (end: number): boolean => {
			if (end > data.length) return false
			if (field) out.push({ num, bytes: Buffer.from(data.subarray(start, end)) })
			i = end
			return true
		}
		if (wire === 0) {
			const v = readVarint(data, i)
			if (!v || !keepOrSkip(i + v.bytes)) return undefined
		} else if (wire === 1) {
			if (!keepOrSkip(i + 8)) return undefined
		} else if (wire === 5) {
			if (!keepOrSkip(i + 4)) return undefined
		} else if (wire === 2) {
			const len = readVarint(data, i)
			if (!len) return undefined
			const valStart = i + len.bytes
			const valEnd = valStart + len.value
			if (valEnd > data.length) return undefined
			if (!field) {
				i = valEnd
			} else if (field.m || field.children) {
				const sub = extract(data.subarray(valStart, valEnd), field.children ?? EMPTY)
				if (!sub) return undefined
				if (sub.length > 0)
					out.push({
						num,
						bytes: Buffer.concat([writeVarint(tag.value), writeVarint(sub.length), sub]),
					})
				i = valEnd
			} else {
				out.push({ num, bytes: Buffer.from(data.subarray(start, valEnd)) })
				i = valEnd
			}
		} else {
			return undefined
		}
	}
	out.sort((a, b) => a.num - b.num)
	return Buffer.concat(out.map((f) => f.bytes))
}

/** The message fields the reporting token covers (what `reportingNode` hashes), or undefined if none. */
export function reportableContent(encodedMessage: Uint8Array): Buffer | undefined {
	const c = extract(encodedMessage, COMPILED)
	return c && c.length > 0 ? c : undefined
}

/**
 * The `<reporting>` node WhatsApp Web attaches to messages that carry a `messageContextInfo.messageSecret`:
 * `reporting_token = HMAC-SHA256(key, whitelisted message fields)[0..16]` with
 * `key = HKDF(messageSecret, info = id || from || to || "Report Token")`.
 */
export function reportingNode(
	encodedMessage: Uint8Array,
	messageSecret: Uint8Array,
	key: { id: string; from: string; to: string },
): BinaryNode | undefined {
	const info = Buffer.concat([
		Buffer.from(key.id),
		Buffer.from(key.from),
		Buffer.from(key.to),
		Buffer.from('Report Token'),
	])
	const secret = Buffer.from(hkdfSync('sha256', messageSecret, Buffer.alloc(0), info, 32))
	const content = extract(encodedMessage, COMPILED)
	if (!content || content.length === 0) return undefined
	const token = createHmac('sha256', secret).update(content).digest().subarray(0, 16)
	return {
		tag: 'reporting',
		attrs: {},
		content: [{ tag: 'reporting_token', attrs: { v: '2' }, content: token }],
	}
}
