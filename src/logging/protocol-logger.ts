// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import {
	closeSync,
	mkdirSync,
	openSync,
	renameSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
	writeSync,
} from 'node:fs'
import { join, relative } from 'node:path'
import type { BinaryNode } from '../codec/index.js'
import {
	dayAndTime,
	housekeeping,
	KEEP_FILE,
	SESSION_FILE,
	type RetentionOptions,
} from './storage.js'

export interface ProtocolLoggerOptions {
	/** Master switch. Default true. When false every method is a no-op. */
	enabled?: boolean
	/** Base directory; one sub-directory per run is created inside, grouped by day. Default `./logs`. */
	dir?: string
	/** Label added to the run's directory name. */
	label?: string
	/** Start a new part of a log file after this many megabytes (`frames.0001.jsonl`, ...). Default 32; 0 turns it off. */
	rotateMB?: number
	/** Delete old runs by age / total size when a logger starts. `false` keeps everything. Default 30 days and 1 GB. */
	retention?: RetentionOptions | false
	/** Compress runs older than this many hours when a logger starts. Default 24; 0 turns it off. */
	compressAfterHours?: number
	/** Never delete this run (adds a `.keep` file to it). */
	keep?: boolean
}

export type Direction = 'send' | 'recv'

/**
 * Records everything a connection does, unfiltered, from the first byte until disconnect or
 * server stop: raw wire frames, decoded stanzas, HTTP requests, socket lifecycle and free-form
 * protocol events. Every entry is written straight to the file (no buffering in this process), so nothing is
 * lost if the process dies.
 *
 * Layout (see `storage.ts`): `<dir>/<YYYY-MM-DD>/<HH-MM-SS>-<label>/` holds
 *   - `session.json`  label, start/end, reason, sizes and line counts
 *   - `events.jsonl`  every entry in order (the complete timeline)
 *   - `frames.jsonl`  raw WebSocket payloads (hex) in both directions, before decrypt / after encrypt
 *   - `nodes.jsonl`   decoded stanzas (JSON) in both directions
 *   - `nodes.xml.log` the same stanzas as readable XML
 *   - `http.jsonl`    HTTP requests and responses (headers + body)
 * A file that grows past `rotateMB` continues in `name.0001.ext`. `<dir>/latest` and `<dir>/latest-<label>` link
 * to the newest run. When a logger starts, runs older than a day are compressed and old ones are deleted by age and
 * total size (30 days / 1 GB by default; `retention: false` keeps everything, a `.keep` file pins one run).
 *
 * Logs contain account data (identifiers, later message content). Keep them private.
 */
export class ProtocolLogger {
	readonly enabled: boolean
	readonly sessionDir: string | undefined
	readonly #baseDir: string
	readonly #label: string
	readonly #rotateBytes: number
	readonly #startedAt = new Date()
	readonly #files = new Map<string, { fd: number; bytes: number; lines: number; part: number }>()
	readonly #totals = new Map<string, { bytes: number; lines: number }>()
	#seq = 0
	#closed = false

	constructor(options: ProtocolLoggerOptions = {}) {
		this.enabled = options.enabled ?? true
		this.#baseDir = options.dir ?? 'logs'
		this.#label = (options.label ?? 'session').replace(/[^A-Za-z0-9._-]/g, '_')
		this.#rotateBytes = (options.rotateMB ?? 32) * 1024 * 1024
		if (!this.enabled) return
		const { day, time } = dayAndTime(this.#startedAt)
		this.sessionDir = join(this.#baseDir, day, `${time}-${this.#label}`)
		mkdirSync(this.sessionDir, { recursive: true, mode: 0o700 })
		this.#writeSession()
		if (options.keep) this.#tryWrite(join(this.sessionDir, KEEP_FILE), '')
		this.#linkLatest()
		this.event('logger.start', { pid: process.pid, node: process.version, argv: process.argv })
		// Old runs: compress and prune in the background; never delay or break the connection.
		const dir = this.#baseDir
		const current = this.sessionDir
		setImmediate(() => {
			housekeeping(dir, {
				retention: options.retention ?? {},
				compressAfterHours: options.compressAfterHours ?? 24,
				current,
			}).catch(() => undefined)
		}).unref()
	}

	/** What `session.json` says about this run so far. */
	#writeSession(end?: { reason: string; detail?: unknown }): void {
		if (!this.sessionDir) return
		const files: Record<string, { bytes: number; lines: number }> = {}
		for (const [name, t] of this.#totals) files[name] = t
		this.#tryWrite(
			join(this.sessionDir, SESSION_FILE),
			JSON.stringify(
				{
					version: 1,
					label: this.#label,
					startedAt: this.#startedAt.toISOString(),
					...(end && { endedAt: new Date().toISOString(), reason: end.reason }),
					pid: process.pid,
					node: process.version,
					argv: process.argv,
					files,
				},
				jsonReplacer,
				2,
			) + '\n',
		)
	}

	/** `<dir>/latest` and `<dir>/latest-<label>` point at this run (best effort: not every system allows links). */
	#linkLatest(): void {
		if (!this.sessionDir) return
		for (const name of ['latest', `latest-${this.#label}`]) {
			const link = join(this.#baseDir, name)
			const tmp = `${link}.${process.pid}.tmp`
			try {
				symlinkSync(relative(this.#baseDir, this.sessionDir), tmp, 'dir')
				renameSync(tmp, link)
			} catch {
				try {
					unlinkSync(tmp)
				} catch {
					/* no link was made */
				}
			}
		}
	}

	#tryWrite(path: string, data: string): void {
		try {
			writeFileSync(path, data, { mode: 0o600 })
		} catch {
			// Logging must never take the connection down.
		}
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
		this.#writeSession({ reason, detail })
		for (const f of this.#files.values()) {
			try {
				closeSync(f.fd)
			} catch {
				/* already closed */
			}
		}
		this.#files.clear()
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
			const data = Buffer.from(line)
			let f = this.#files.get(file)
			if (f && this.#rotateBytes > 0 && f.bytes > 0 && f.bytes + data.length > this.#rotateBytes) {
				closeSync(f.fd)
				f.part++
				const dot = file.lastIndexOf('.')
				const part = `${file.slice(0, dot)}.${String(f.part).padStart(4, '0')}${file.slice(dot)}`
				renameSync(join(this.sessionDir, file), join(this.sessionDir, part))
				f = {
					fd: openSync(join(this.sessionDir, file), 'a', 0o600),
					bytes: 0,
					lines: 0,
					part: f.part,
				}
				this.#files.set(file, f)
			}
			if (!f) {
				f = { fd: openSync(join(this.sessionDir, file), 'a', 0o600), bytes: 0, lines: 0, part: 0 }
				this.#files.set(file, f)
			}
			writeSync(f.fd, data)
			f.bytes += data.length
			f.lines++
			const t = this.#totals.get(file) ?? { bytes: 0, lines: 0 }
			t.bytes += data.length
			t.lines++
			this.#totals.set(file, t)
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
	const tag = escapeXml(node.tag)
	const attrs = Object.entries(node.attrs)
		.map(([k, v]) => ` ${escapeXml(k)}="${escapeXml(v)}"`)
		.join('')
	const c = node.content
	if (c === undefined) return `${indent}<${tag}${attrs}/>`
	if (typeof c === 'string') return `${indent}<${tag}${attrs}>${escapeXml(c)}</${tag}>`
	if (c instanceof Uint8Array) {
		const text = printable(c)
		return `${indent}<${tag}${attrs}>${text !== undefined && text.length > 0 ? escapeXml(text) : `{${c.length} bytes: ${Buffer.from(c).toString('hex')}}`}</${tag}>`
	}
	return `${indent}<${tag}${attrs}>\n${c.map((n) => toXml(n, indent + '  ')).join('\n')}\n${indent}</${tag}>`
}

/** Escape markup and control characters so wire data cannot forge extra log lines or tags. */
function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, (c) => `&#x${c.charCodeAt(0).toString(16)};`)
		.replace(/\n/g, '&#xa;')
}
