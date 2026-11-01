import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Credit is a condition of using velowa's code: the licence says so, every file of velowa's own code carries the
// notice, every built file carries it, and the code that came from other projects is listed with its own licence.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (f: string) => readFileSync(join(root, f), 'utf8')

const HEADER =
	'// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.'

/** Files written for velowa (not generated, not copied from another project). */
const ownFiles = (): string[] =>
	execFileSync(
		'git',
		['ls-files', 'src', 'examples', 'rust/wasm-bridge/src', 'rust/wasm-voip/src'],
		{ cwd: root, encoding: 'utf8' },
	)
		.split('\n')
		.filter((f) => /\.(ts|js|rs)$/.test(f) && !f.startsWith('src/wasm') && !f.endsWith('.d.ts'))

describe('licence and credit', () => {
	it('the licence asks for credit for any copied part, however small', () => {
		const text = read('LICENSE').replace(/\s+/g, ' ') // the licence is wrapped; match phrases across line breaks
		expect(text).toContain('MIT with mandatory credit')
		expect(text).toMatch(/Credit for every part that is copied/)
		expect(text).toMatch(/however small|large\s+or small/)
		expect(text).toContain('a function')
		expect(text).toContain('a few lines')
		expect(text).toMatch(/No credit, no permission/)
		expect(text).toContain('THIRD_PARTY_NOTICES.md') // other people's code keeps its own licence
		expect(text).toMatch(/Using velowa is not copying/) // a program that merely uses velowa owes no credit per file
	})

	it('every file of velowa’s own code carries the credit notice', () => {
		const files = ownFiles()
		expect(files.length).toBeGreaterThan(60)
		const missing = files.filter((f) => !read(f).split('\n').slice(0, 3).includes(HEADER))
		expect(missing).toEqual([])
	})

	it('no crate points license-file at the licence: wasm-pack would truncate it while building', () => {
		const manifests = execFileSync('git', ['ls-files', 'Cargo.toml', 'rust/*/Cargo.toml'], {
			cwd: root,
			encoding: 'utf8',
		})
			.split('\n')
			.filter(Boolean)
		expect(manifests.length).toBeGreaterThan(5)
		for (const m of manifests) expect(read(m), m).not.toMatch(/^\s*license-file\s*=/m)
	})

	it('code from other projects is listed with its own licence', () => {
		const text = read('THIRD_PARTY_NOTICES.md')
		for (const needle of [
			'whatsapp-rust',
			'João Lucas de Oliveira Lopes',
			'Signal Messenger, LLC',
			'AGPL-3.0-only',
			'rust/wacore-libsignal',
			'Baileys',
			'Rajeh Taher/WhiskeySockets',
			'opusscript',
			'protobufjs',
		])
			expect(text, needle).toContain(needle)
	})

	it('names every libsignal file that carries the Signal notice', () => {
		const text = read('THIRD_PARTY_NOTICES.md')
		const agpl = execFileSync('grep', ['-rl', 'AGPL-3.0-only', 'rust/wacore-libsignal/src'], {
			cwd: root,
			encoding: 'utf8',
		})
			.split('\n')
			.filter(Boolean)
		expect(agpl.length).toBeGreaterThan(0)
		for (const f of agpl) expect(text, f).toContain(f)
	})

	it.skipIf(!existsSync(join(root, 'dist/index.js')))(
		'every built file carries the credit banner',
		() => {
			for (const f of ['dist/index.js', 'dist/index.cjs', 'dist/cli/pair.js', 'dist/cli/logs.js']) {
				const head = read(f).split('\n').slice(0, 8).join('\n')
				expect(head, f).toContain('mandatory credit')
				expect(head, f).toContain('THIRD_PARTY_NOTICES.md')
			}
		},
	)
})
