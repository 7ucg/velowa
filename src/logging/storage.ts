// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { createReadStream, createWriteStream } from 'node:fs'
import {
	lstatSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	renameSync,
	rmSync,
	rmdirSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'

// How protocol logs are kept on disk.
//
//   <dir>/<YYYY-MM-DD>/<HH-MM-SS>-<label>/     one directory per run, grouped by day
//     session.json                             who/when/why, sizes (written at start and again at close)
//     events.jsonl frames.jsonl nodes.jsonl nodes.xml.log http.jsonl      (big files rotate to name.0001.ext)
//   <dir>/latest, <dir>/latest-<label>         links to the newest run
//
// Old runs are compressed after a day and deleted by age and total size. Only directories that are
// recognisably runs of this logger are ever touched, and a run with a `.keep` file is never deleted.

export interface RetentionOptions {
	/** Delete runs older than this many days. Default 30; 0 turns the rule off. */
	maxAgeDays?: number
	/** Delete the oldest runs until the logs take at most this many megabytes. Default 1024; 0 turns it off. */
	maxTotalMB?: number
	/** Keep at most this many runs. Default unlimited. */
	maxSessions?: number
}

export interface SessionInfo {
	/** Absolute path of the run's directory. */
	path: string
	/** `<day>/<time>-<label>` (or the flat name of an old run). */
	name: string
	label: string
	startedAt: Date
	endedAt?: Date
	reason?: string
	bytes: number
	pinned: boolean
	compressed: boolean
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const LEGACY = /^(.+)-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/

export const KEEP_FILE = '.keep'
export const SESSION_FILE = 'session.json'

/** Total size of the files directly inside a run (runs are flat). */
function dirBytes(path: string): number {
	let total = 0
	for (const f of readdirSync(path, { withFileTypes: true })) {
		if (f.isFile()) total += lstatSync(join(path, f.name)).size
	}
	return total
}

function readMeta(path: string): Record<string, unknown> | undefined {
	try {
		return JSON.parse(readFileSync(join(path, SESSION_FILE), 'utf8')) as Record<string, unknown>
	} catch {
		return undefined
	}
}

function describe(path: string, name: string): SessionInfo | undefined {
	const files = readdirSync(path)
	const meta = readMeta(path)
	const legacy = LEGACY.exec(name.split('/').pop()!)
	if (!meta && !(legacy && files.some((f) => f.startsWith('events.jsonl')))) return undefined
	const started =
		typeof meta?.['startedAt'] === 'string'
			? new Date(meta['startedAt'])
			: new Date(`${legacy![2]}T${legacy![3]}:${legacy![4]}:${legacy![5]}.${legacy![6]}Z`)
	if (Number.isNaN(started.getTime())) return undefined
	return {
		path,
		name,
		label:
			typeof meta?.['label'] === 'string'
				? meta['label']
				: (legacy?.[1] ?? name.split('-').slice(1).join('-')),
		startedAt: started,
		...(typeof meta?.['endedAt'] === 'string' && { endedAt: new Date(meta['endedAt']) }),
		...(typeof meta?.['reason'] === 'string' && { reason: meta['reason'] }),
		bytes: dirBytes(path),
		pinned: files.includes(KEEP_FILE),
		compressed: files.some((f) => f.endsWith('.gz')),
	}
}

/** Every run under `dir` (grouped by day, or flat from older versions), oldest first. Symlinks are ignored. */
export function listSessions(dir: string): SessionInfo[] {
	const out: SessionInfo[] = []
	let entries
	try {
		entries = readdirSync(dir, { withFileTypes: true })
	} catch {
		return out
	}
	for (const e of entries) {
		if (!e.isDirectory()) continue
		const path = join(dir, e.name)
		if (DAY.test(e.name)) {
			for (const s of readdirSync(path, { withFileTypes: true })) {
				if (!s.isDirectory()) continue
				const info = describe(join(path, s.name), `${e.name}/${s.name}`)
				if (info) out.push(info)
			}
		} else {
			const info = describe(path, e.name)
			if (info) out.push(info)
		}
	}
	return out.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
}

/** Local `YYYY-MM-DD` and `HH-MM-SS` of a moment: the folder names. */
export function dayAndTime(at: Date): { day: string; time: string } {
	const p = (n: number, w = 2) => String(n).padStart(w, '0')
	return {
		day: `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}`,
		time: `${p(at.getHours())}-${p(at.getMinutes())}-${p(at.getSeconds())}`,
	}
}

/** Move runs from the old flat layout into their day folders. Returns how many moved. */
export function migrateFlatSessions(dir: string): number {
	let moved = 0
	for (const s of listSessions(dir)) {
		if (s.name.includes('/')) continue
		const { day, time } = dayAndTime(s.startedAt)
		const target = join(dir, day, `${time}-${s.label}`)
		try {
			mkdirSync(join(dir, day), { recursive: true, mode: 0o700 })
			renameSync(s.path, target)
			// An old run has no session.json; without one it would no longer be recognised in its new place.
			if (!readMeta(target)) {
				const newest = Math.max(
					...readdirSync(target).map((f) => lstatSync(join(target, f)).mtimeMs),
				)
				writeFileSync(
					join(target, SESSION_FILE),
					JSON.stringify(
						{
							version: 1,
							label: s.label,
							startedAt: s.startedAt.toISOString(),
							endedAt: new Date(newest).toISOString(),
							migrated: true,
						},
						null,
						2,
					) + '\n',
					{ mode: 0o600 },
				)
			}
			moved++
		} catch {
			/* leave it where it is */
		}
	}
	return moved
}

/** gzip every large text log of a finished run (`x.jsonl` becomes `x.jsonl.gz`). */
export async function compressSession(path: string): Promise<number> {
	let saved = 0
	for (const f of readdirSync(path)) {
		if (f.endsWith('.gz') || f === SESSION_FILE || f === KEEP_FILE) continue
		if (!/\.(jsonl|log)$/.test(f)) continue
		const from = join(path, f)
		const before = lstatSync(from).size
		if (before < 4096) continue
		const to = `${from}.gz`
		try {
			await pipeline(
				createReadStream(from),
				createGzip({ level: 9 }),
				createWriteStream(to, { mode: 0o600 }),
			)
			saved += before - lstatSync(to).size
			unlinkSync(from)
		} catch {
			try {
				unlinkSync(to)
			} catch {
				/* nothing half-written to remove */
			}
		}
	}
	if (saved > 0) {
		const meta = readMeta(path)
		if (meta) {
			try {
				writeFileSync(
					join(path, SESSION_FILE),
					JSON.stringify({ ...meta, compressed: true }, null, 2) + '\n',
				)
			} catch {
				/* the files are what matter */
			}
		}
	}
	return saved
}

/** Delete runs by age, count and total size. Returns the runs removed. `keep` are paths that must stay. */
export function pruneSessions(
	dir: string,
	retention: RetentionOptions = {},
	keep: string[] = [],
): SessionInfo[] {
	const maxAge = (retention.maxAgeDays ?? 30) * 86_400_000
	const maxBytes = (retention.maxTotalMB ?? 1024) * 1024 * 1024
	const maxSessions = retention.maxSessions ?? 0
	const all = listSessions(dir)
	const removable = (s: SessionInfo) => !s.pinned && !keep.includes(s.path)
	const gone: SessionInfo[] = []
	const remove = (s: SessionInfo) => {
		try {
			rmSync(s.path, { recursive: true, force: true })
			gone.push(s)
		} catch {
			/* in use or already gone */
		}
	}
	const now = Date.now()
	let rest = all
	if (maxAge > 0)
		rest = rest.filter((s) => {
			if (!removable(s) || now - s.startedAt.getTime() <= maxAge) return true
			remove(s)
			return false
		})
	if (maxSessions > 0) {
		for (const s of [...rest]) {
			if (rest.length <= maxSessions) break
			if (!removable(s)) continue
			remove(s)
			rest = rest.filter((r) => r !== s)
		}
	}
	if (maxBytes > 0) {
		let total = rest.reduce((n, s) => n + s.bytes, 0)
		for (const s of rest) {
			if (total <= maxBytes) break
			if (!removable(s)) continue
			remove(s)
			total -= s.bytes
		}
	}
	// day folders that are empty now
	try {
		for (const e of readdirSync(dir, { withFileTypes: true }))
			if (e.isDirectory() && DAY.test(e.name)) {
				try {
					rmdirSync(join(dir, e.name))
				} catch {
					/* not empty */
				}
			}
	} catch {
		/* no log directory */
	}
	return gone
}

/** Compress runs older than `compressAfterHours` and apply the retention rules. Safe to run in the background. */
export async function housekeeping(
	dir: string,
	o: { retention?: RetentionOptions | false; compressAfterHours?: number; current?: string } = {},
): Promise<{ compressed: number; removed: number }> {
	const keep = o.current ? [o.current] : []
	let compressed = 0
	const hours = o.compressAfterHours ?? 24
	if (hours > 0) {
		for (const s of listSessions(dir)) {
			if (s.compressed || keep.includes(s.path)) continue
			if (Date.now() - s.startedAt.getTime() < hours * 3_600_000) continue
			// a run that never wrote its end may still be going; give it a week
			const meta = readMeta(s.path)
			if (
				meta &&
				meta['endedAt'] === undefined &&
				Date.now() - s.startedAt.getTime() < 7 * 86_400_000
			)
				continue
			if ((await compressSession(s.path)) > 0) compressed++
		}
	}
	const removed = o.retention === false ? 0 : pruneSessions(dir, o.retention ?? {}, keep).length
	return { compressed, removed }
}
