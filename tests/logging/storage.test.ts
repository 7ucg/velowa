import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	utimesSync,
	writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { ProtocolLogger } from '../../src/logging/protocol-logger.js'
import {
	compressSession,
	housekeeping,
	listSessions,
	migrateFlatSessions,
	pruneSessions,
} from '../../src/logging/storage.js'

const tmp = () => mkdtempSync(join(tmpdir(), 'velowa-logs-'))
const DAY = 86_400_000

/** A finished run with `bytes` of events, started `ageDays` ago, in the day-folder layout. */
function run(dir: string, label: string, ageDays: number, bytes = 10_000, keep = false) {
	const at = new Date(Date.now() - ageDays * DAY)
	const day = at.toISOString().slice(0, 10)
	const path = join(dir, day, `${at.toISOString().slice(11, 19).replace(/:/g, '-')}-${label}`)
	mkdirSync(path, { recursive: true })
	writeFileSync(
		join(path, 'session.json'),
		JSON.stringify({
			label,
			startedAt: at.toISOString(),
			endedAt: at.toISOString(),
			reason: 'done',
		}),
	)
	writeFileSync(join(path, 'events.jsonl'), 'x'.repeat(bytes))
	if (keep) writeFileSync(join(path, '.keep'), '')
	return path
}

describe('log layout', () => {
	it('groups a run by day, writes session.json and links the latest run', () => {
		const dir = tmp()
		const log = new ProtocolLogger({ dir, label: 'my run!', retention: false })
		log.event('hello')
		log.close('test')
		const rel = log.sessionDir!.slice(dir.length + 1)
		expect(rel).toMatch(/^\d{4}-\d{2}-\d{2}\/\d{2}-\d{2}-\d{2}-my_run_$/)
		const meta = JSON.parse(readFileSync(join(log.sessionDir!, 'session.json'), 'utf8'))
		expect(meta).toMatchObject({ version: 1, label: 'my_run_', reason: 'test' })
		expect(meta.endedAt).toBeDefined()
		expect(meta.files['events.jsonl'].lines).toBe(3) // start, hello, end
		expect(existsSync(join(dir, 'latest', 'session.json'))).toBe(true)
		expect(existsSync(join(dir, 'latest-my_run_', 'events.jsonl'))).toBe(true)
		expect(listSessions(dir).map((s) => s.label)).toEqual(['my_run_'])
	})

	it('continues a file that grows past the limit in name.0001.ext, losing nothing', () => {
		const dir = tmp()
		const log = new ProtocolLogger({ dir, rotateMB: 0.001, retention: false }) // about 1 KB
		for (let i = 0; i < 20; i++) log.http({ method: 'GET', url: `https://x/${i}`, status: 200 })
		log.close('test')
		const files = readdirSync(log.sessionDir!).filter((f) => f.startsWith('http'))
		expect(files).toContain('http.jsonl')
		expect(files.some((f) => /^http\.0001\.jsonl$/.test(f))).toBe(true)
		const lines = files.flatMap((f) =>
			readFileSync(join(log.sessionDir!, f), 'utf8').trim().split('\n'),
		)
		expect(lines).toHaveLength(20)
	})

	it('keeps a run with keep: true', () => {
		const dir = tmp()
		const log = new ProtocolLogger({ dir, keep: true, retention: false })
		log.close('x')
		expect(listSessions(dir)[0]!.pinned).toBe(true)
	})
})

describe('log housekeeping', () => {
	it('deletes by age but never a pinned run, an unrelated folder, or the current run', () => {
		const dir = tmp()
		const old = run(dir, 'old', 40)
		const pinned = run(dir, 'pinned', 40, 10_000, true)
		const fresh = run(dir, 'fresh', 1)
		mkdirSync(join(dir, 'my-notes'))
		writeFileSync(join(dir, 'my-notes', 'todo.txt'), 'keep me')
		const removed = pruneSessions(dir, { maxAgeDays: 30 }, [fresh])
		expect(removed.map((s) => s.label)).toEqual(['old'])
		expect(existsSync(old)).toBe(false)
		expect(existsSync(pinned)).toBe(true)
		expect(existsSync(fresh)).toBe(true)
		expect(existsSync(join(dir, 'my-notes', 'todo.txt'))).toBe(true)
	})

	it('deletes the oldest runs until the total size fits', () => {
		const dir = tmp()
		run(dir, 'a', 5, 600_000)
		run(dir, 'b', 4, 600_000)
		run(dir, 'c', 3, 600_000)
		const removed = pruneSessions(dir, { maxAgeDays: 0, maxTotalMB: 1.5 })
		expect(removed.map((s) => s.label)).toEqual(['a'])
		expect(listSessions(dir).map((s) => s.label)).toEqual(['b', 'c'])
	})

	it('removes the day folder when its last run goes', () => {
		const dir = tmp()
		run(dir, 'old', 60)
		pruneSessions(dir, { maxAgeDays: 30 })
		expect(readdirSync(dir)).toEqual([])
	})

	it('compresses a finished run and keeps its content', async () => {
		const dir = tmp()
		const path = run(dir, 'big', 3, 200_000)
		const saved = await compressSession(path)
		expect(saved).toBeGreaterThan(150_000)
		expect(existsSync(join(path, 'events.jsonl'))).toBe(false)
		expect(gunzipSync(readFileSync(join(path, 'events.jsonl.gz'))).length).toBe(200_000)
		expect(listSessions(dir)[0]!.compressed).toBe(true)
	})

	it('leaves a run alone that is still going, and runs both steps in the background', async () => {
		const dir = tmp()
		const live = new ProtocolLogger({ dir, label: 'live', retention: false })
		live.event('busy')
		const done = run(dir, 'done', 3, 50_000)
		const res = await housekeeping(dir, {
			retention: { maxAgeDays: 0, maxTotalMB: 0 },
			current: live.sessionDir!,
		})
		expect(res.compressed).toBe(1)
		expect(existsSync(join(done, 'events.jsonl.gz'))).toBe(true)
		expect(existsSync(join(live.sessionDir!, 'events.jsonl'))).toBe(true)
	})

	it('moves runs of the old flat layout into day folders', () => {
		const dir = tmp()
		const old = join(dir, 'call-group-2026-11-01T10-23-00-921Z')
		mkdirSync(old)
		writeFileSync(join(old, 'events.jsonl'), '{}\n')
		utimesSync(old, new Date(), new Date())
		expect(listSessions(dir)[0]).toMatchObject({
			label: 'call-group',
			name: 'call-group-2026-11-01T10-23-00-921Z',
		})
		expect(migrateFlatSessions(dir)).toBe(1)
		const s = listSessions(dir)[0]!
		expect(s.name).toMatch(/^\d{4}-\d{2}-\d{2}\/\d{2}-\d{2}-\d{2}-call-group$/)
		expect(existsSync(old)).toBe(false)
	})
})
