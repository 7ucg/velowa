import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { BinaryNode } from '../codec/index.js'

export interface ProtocolLoggerOptions {
	/** Master switch. Default true. When false every method is a no-op. */
	enabled?: boolean
	/** Base directory; one sub-directory per session is created inside. Default `./logs`. */
	dir?: string
	/** Label prepended to the session directory name. */
	label?: string
}

export type Direction = 'send' | 'recv'

/**
 * Records everything a connection does, unfiltered, from the first byte until disconnect or
 * server stop: raw wire frames, decoded stanzas, HTTP requests, socket lifecycle and free-form
 * protocol events. Every entry is appended synchronously, so nothing is lost if the process dies.
 *
 * Files in `<dir>/<session>/`:
 *   - `events.jsonl`  every entry in order (the complete timeline)
 *   - `frames.jsonl`  raw WebSocket payloads (hex) in both directions, before decrypt / after encrypt
 *   - `nodes.jsonl`   decoded stanzas (JSON) in both directions
 *   - `nodes.xml.log` the same stanzas as readable XML
 *   - `http.jsonl`    HTTP requests and responses (headers + body)
 *
 * Logs contain account data (identifiers, later message content). Keep them private.
 */
export class ProtocolLogger {
	readonly enabled: boolean
	readonly sessionDir: string | undefined
	#seq = 0
	#closed = false

	constructor(options: ProtocolLoggerOptions = {}) {
		this.enabled = options.enabled ?? true
		if (!this.enabled) return
		const stamp = new Date().toISOString().replace(/[:.]/g, '-')
		this.sessionDir = join(options.dir ?? 'logs', `${options.label ?? 'session'}-${stamp}`)
		mkdirSync(this.sessionDir, { recursive: true })
		this.event('logger.start', { pid: process.pid, node: process.version, argv: process.argv })
	}

	/** Free-form protocol/lifecycle event. */
	event(kind: string, data?: unknown): void {
		this.#write('events.jsonl', { kind, data })
	}

	/** Raw bytes on the wire (WebSocket message payload). */
	frame(direction: Direction, bytes: Uint8Array, note?: string): void {
		if (!this.enabled) return
		const entry = { direction, length: bytes.length, hex: Buffer.from(bytes).toString('hex'), note }
		this.#write('frames.jsonl', entry)
		this.#write('events.jsonl', {
			kind: `frame.${direction}`,
			data: { length: bytes.length, note },
		})
	}

	/** A decoded stanza. */
	node(direction: Direction, node: BinaryNode): void {
		if (!this.enabled) return
		this.#write('nodes.jsonl', { direction, node: toJson(node) })
		this.#append(
			'nodes.xml.log',
			`${new Date().toISOString()} ${direction === 'send' ? '>>' : '<<'}\n${toXml(node)}\n\n`,
		)
		this.#write('events.jsonl', {
			kind: `node.${direction}`,
			data: { tag: node.tag, attrs: node.attrs },
		})
	}

	/** HTTP exchange. */
	http(entry: Record<string, unknown>): void {
		this.#write('http.jsonl', entry)
		this.#write('events.jsonl', {
			kind: 'http',
			data: { method: entry.method, url: entry.url, status: entry.status },
		})
	}

	/** Final entry; call on disconnect / server stop. Idempotent. */
	close(reason: string, detail?: unknown): void {
		if (!this.enabled || this.#closed) return
		this.event('logger.end', { reason, detail })
		this.#closed = true
	}

	#write(file: string, entry: Record<string, unknown>): void {
		if (!this.enabled) return
		this.#append(
			file,
			JSON.stringify({ seq: this.#seq++, t: new Date().toISOString(), ...entry }, jsonReplacer) +
				'\n',
		)
	}

	#append(file: string, line: string): void {
		if (!this.enabled || !this.sessionDir) return
		try {
			appendFileSync(join(this.sessionDir, file), line)
		} catch {
			// Logging must never take the connection down.
		}
	}
}

function jsonReplacer(_key: string, value: unknown): unknown {
	if (value instanceof Uint8Array) return { $bytes: Buffer.from(value).toString('hex') }
	if (value instanceof Error)
		return { name: value.name, message: value.message, stack: value.stack }
	if (typeof value === 'bigint') return value.toString()
	return value
}

export function toJson(node: BinaryNode): unknown {
	const content = node.content
	return {
		tag: node.tag,
		attrs: node.attrs,
		content:
			content === undefined
				? undefined
				: typeof content === 'string'
					? content
					: content instanceof Uint8Array
						? { $bytes: Buffer.from(content).toString('hex'), utf8: printable(content) }
						: content.map(toJson),
	}
}

function printable(bytes: Uint8Array): string | undefined {
	const s = Buffer.from(bytes).toString('utf8')
	return /^[\x20-\x7e\n\r\t]*$/.test(s) ? s : undefined
}

export function toXml(node: BinaryNode, indent = ''): string {
	const attrs = Object.entries(node.attrs)
		.map(([k, v]) => ` ${k}="${v}"`)
		.join('')
	const c = node.content
	if (c === undefined) return `${indent}<${node.tag}${attrs}/>`
	if (typeof c === 'string') return `${indent}<${node.tag}${attrs}>${c}</${node.tag}>`
	if (c instanceof Uint8Array) {
		const text = printable(c)
		return `${indent}<${node.tag}${attrs}>${text !== undefined && text.length > 0 ? text : `{${c.length} bytes: ${Buffer.from(c).toString('hex')}}`}</${node.tag}>`
	}
	return `${indent}<${node.tag}${attrs}>\n${c.map((n) => toXml(n, indent + '  ')).join('\n')}\n${indent}</${node.tag}>`
}
