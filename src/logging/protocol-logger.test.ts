import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ProtocolLogger } from './protocol-logger.js'

describe('ProtocolLogger', () => {
	it('records frames, nodes, http and lifecycle in order, flushed immediately', () => {
		const dir = mkdtempSync(join(tmpdir(), 'velowa-log-'))
		const log = new ProtocolLogger({ dir })
		log.frame('send', new Uint8Array([1, 2, 3]), 'hello')
		log.node('recv', {
			tag: 'iq',
			attrs: { id: '1' },
			content: [{ tag: 'ref', attrs: {}, content: new TextEncoder().encode('abc') }],
		})
		log.http({ method: 'GET', url: 'https://x', status: 200, body: 'ok' })
		// read before close(): entries must already be on disk
		const files = readdirSync(log.sessionDir!)
		expect(files).toEqual(
			expect.arrayContaining([
				'events.jsonl',
				'frames.jsonl',
				'nodes.jsonl',
				'nodes.xml.log',
				'http.jsonl',
			]),
		)
		expect(JSON.parse(readFileSync(join(log.sessionDir!, 'frames.jsonl'), 'utf8')).hex).toBe(
			'010203',
		)
		expect(readFileSync(join(log.sessionDir!, 'nodes.xml.log'), 'utf8')).toContain('<ref>abc</ref>')
		log.close('test')
		log.close('again')
		const events = readFileSync(join(log.sessionDir!, 'events.jsonl'), 'utf8')
			.trim()
			.split('\n')
			.map((l) => JSON.parse(l))
		expect(events.map((e) => e.kind)).toEqual([
			'logger.start',
			'frame.send',
			'node.recv',
			'http',
			'logger.end',
		])
		expect(events.map((e) => e.seq)).toEqual([...events.keys()].map((_, i) => events[i].seq))
	})

	it('writes nothing when disabled', () => {
		const dir = mkdtempSync(join(tmpdir(), 'velowa-log-'))
		const log = new ProtocolLogger({ enabled: false, dir })
		log.frame('send', new Uint8Array([1]))
		log.event('x')
		log.http({ url: 'u' })
		expect(log.sessionDir).toBeUndefined()
		expect(existsSync(join(dir))).toBe(true)
		expect(readdirSync(dir)).toEqual([])
	})

	it('escapes wire data in the XML log and restricts file permissions', () => {
		const dir = mkdtempSync(join(tmpdir(), 'velowa-log-'))
		const log = new ProtocolLogger({ dir })
		log.node('recv', { tag: 'x', attrs: { a: '"><forged/>\n' }, content: '<b>' })
		const xml = readFileSync(join(log.sessionDir!, 'nodes.xml.log'), 'utf8')
		expect(xml).not.toContain('<forged/>')
		expect(xml).toContain('&lt;b&gt;')
		expect(statSync(log.sessionDir!).mode & 0o077).toBe(0)
		expect(statSync(join(log.sessionDir!, 'events.jsonl')).mode & 0o077).toBe(0)
	})
})
