import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The code in README.md and examples/ is type-checked against the built package, so an example that names a method or
// an option that does not exist fails here, not in a reader's editor. Needs `npm run build:js` first (it reads dist/).

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const built = existsSync(join(root, 'dist/index.d.ts'))
const tsc = join(root, 'node_modules/.bin/tsc')

function check(dir: string): string {
	try {
		execFileSync(tsc, ['-p', dir], { encoding: 'utf8', stdio: 'pipe' })
		return ''
	} catch (e) {
		return String((e as { stdout?: string }).stdout ?? e)
	}
}

const compilerOptions = {
	target: 'ES2022',
	module: 'ESNext',
	moduleResolution: 'Bundler',
	noEmit: true,
	skipLibCheck: true,
	types: ['node'],
	typeRoots: [join(root, 'node_modules/@types')],
	baseUrl: '.',
	paths: { velowa: [join(root, 'dist/index.d.ts')] },
}

// names the README snippets use without defining them
const prelude: Record<string, string> = {
	client: "import('velowa').Client",
	jid: 'string',
	otherJid: 'string',
	groupJid: 'string',
	channelJid: 'string',
	userLid: 'string',
	userJid: 'string',
	callId: 'string',
	communityJid: 'string',
	newOwnerJid: 'string',
	eventId: 'string',
	productId: 'string',
	url: 'string',
	bytes: 'Uint8Array',
	webpBytes: 'Uint8Array',
	jpegBytes: 'Uint8Array',
	videoWithSongTrack: 'Uint8Array',
	imageA: 'Uint8Array',
	imageB: 'Uint8Array',
	jpegThumbnail: 'Uint8Array',
	waveform: 'Uint8Array',
	id: 'string',
	m: "import('velowa').Message",
	raw: "import('velowa').ClientEvents['message']",
	fs: "typeof import('node:fs')",
	MemoryStore: "typeof import('velowa').MemoryStore",
	call: "import('velowa').Client['calls'] extends ReadonlyMap<string, infer C> ? C : never",
	gc: "import('velowa').Client['calls'] extends ReadonlyMap<string, infer C> ? C : never",
	link: '{ url: string }',
	g: '{ id: string }',
	ch: '{ id: string }',
}

describe.skipIf(!built)('documentation code', () => {
	it('every TypeScript example in README.md type-checks', () => {
		const work = join(root, 'node_modules/.cache/readme-check')
		rmSync(work, { recursive: true, force: true })
		mkdirSync(work, { recursive: true })
		const blocks = [
			...readFileSync(join(root, 'README.md'), 'utf8').matchAll(/```ts\n([\s\S]*?)```/g),
		].map((m) => m[1]!)
		expect(blocks.length).toBeGreaterThan(10)
		blocks.forEach((code, i) => {
			const defines = (name: string) =>
				new RegExp(
					`\\b(const|let|var|function|class)\\s+${name}\\b|import[^;\\n]*\\b${name}\\b`,
				).test(code)
			const decls = Object.entries(prelude)
				.filter(([name]) => !defines(name) && new RegExp(`\\b${name}\\b`).test(code))
				.map(([name, type]) => `declare const ${name}: ${type}`)
			writeFileSync(
				join(work, `block${String(i + 1).padStart(2, '0')}.ts`),
				`${decls.join('\n')}\nexport {}\n${code}\n`,
			)
		})
		writeFileSync(
			join(work, 'tsconfig.json'),
			JSON.stringify({ compilerOptions: { ...compilerOptions, strict: true }, include: ['*.ts'] }),
		)
		expect(check(work)).toBe('')
	}, 120_000)

	it('every example in examples/ type-checks', () => {
		const work = join(root, 'node_modules/.cache/examples-check')
		mkdirSync(work, { recursive: true })
		writeFileSync(
			join(work, 'tsconfig.json'),
			JSON.stringify({
				compilerOptions: { ...compilerOptions, allowJs: true, checkJs: true, strict: false },
				include: [join(root, 'examples/**/*.js')],
			}),
		)
		expect(check(work)).toBe('')
	}, 120_000)

	it('the examples name no personal numbers or fixed group ids', () => {
		const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'examples'], {
			cwd: root,
			encoding: 'utf8',
		})
			.split('\n')
			.filter((f) => f.endsWith('.js'))
		expect(files.length).toBeGreaterThan(5)
		for (const f of files)
			expect(readFileSync(join(root, f), 'utf8'), f).not.toMatch(/\b49\d{9,11}\b|\b1203\d{12,}@/)
	})
})
