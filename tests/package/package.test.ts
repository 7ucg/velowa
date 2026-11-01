import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The rules for the package, kept as tests. velowa is used from git (clone, build, `npm install ../velowa`) and is not
// published on npm; `npm pack` is still how publint and attw look at what the folder exports. The first group needs only
// package.json; the second needs `npm run build:js` first and reads dist/ and the file list `npm pack` would make.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
	version: string
	private?: boolean
	license?: string
	files?: string[]
	main?: string
	module?: string
	types?: string
	exports?: Record<string, Record<string, unknown> | string>
	bin?: Record<string, string>
	scripts: Record<string, string>
	dependencies?: Record<string, string>
	optionalDependencies?: Record<string, string>
	engines?: { node?: string }
	publishConfig?: unknown
	repository?: { url?: string }
}

/** Libraries the code in dist/ imports at run time. Adding one is a decision for every user: do it here on purpose. */
const RUNTIME_DEPENDENCIES = ['opusscript', 'protobufjs', 'ws']
/** Used only by the pairing helper, which prints the raw code without it. */
const OPTIONAL_DEPENDENCIES = ['qrcode-terminal']

describe('what the package declares', () => {
	it('runs nothing on the user’s machine when it is installed', () => {
		// `npm install` in a checkout must stay quick and must not need Rust: the build is the explicit `npm run build`.
		for (const hook of [
			'preinstall',
			'install',
			'postinstall',
			'prepare',
			'preprepare',
			'postprepare',
		])
			expect(pkg.scripts[hook], `scripts.${hook}`).toBeUndefined()
	})

	it('lists only the built files, the licences and the readme, and cannot be published by accident', () => {
		expect(pkg.files).toEqual(['dist', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'README.md'])
		expect(pkg.private).toBe(true) // git only: `npm publish` refuses a private package
		expect(pkg.license).toBe('SEE LICENSE IN LICENSE') // the licence in LICENSE is MIT with a mandatory credit clause
		expect(pkg.version).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/)
	})

	it('has exactly the runtime dependencies that were chosen', () => {
		expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual(RUNTIME_DEPENDENCIES)
		expect(Object.keys(pkg.optionalDependencies ?? {}).sort()).toEqual(OPTIONAL_DEPENDENCIES)
	})

	it('resolves for ESM and CommonJS with types, and says which Node it needs', () => {
		expect(pkg.exports?.['.']).toMatchObject({
			import: { types: './dist/index.d.ts', default: './dist/index.js' },
			require: { types: './dist/index.d.cts', default: './dist/index.cjs' },
		})
		expect(pkg.main).toBe('./dist/index.cjs')
		expect(pkg.module).toBe('./dist/index.js')
		expect(pkg.types).toBe('./dist/index.d.ts')
		expect(pkg.engines?.node).toMatch(/>=\s*18/)
	})

	it('puts its command line tools under dist/cli', () => {
		for (const target of Object.values(pkg.bin ?? {}))
			expect(target).toMatch(/^\.\/dist\/cli\/[a-z]+\.js$/)
		expect(Object.keys(pkg.bin ?? {})).toEqual(['velowa-pair', 'velowa-logs'])
	})

	it('has no publish settings or gate', () => {
		expect(pkg.publishConfig).toBeUndefined()
		expect(pkg.scripts['prepublishOnly']).toBeUndefined()
	})

	it('keeps a changelog section for what is not released yet', () => {
		expect(readFileSync(join(root, 'CHANGELOG.md'), 'utf8')).toMatch(/^## Unreleased$/m)
	})
})

const built = existsSync(join(root, 'dist/index.js')) && existsSync(join(root, 'dist/index.cjs'))

describe.skipIf(!built)('what is in the package', () => {
	const packed = (): string[] => {
		// --ignore-scripts: do not rebuild (prepack runs the whole wasm build); this lists the files as they are now
		const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
			cwd: root,
			encoding: 'utf8',
		})
		const [info] = JSON.parse(out) as { files: { path: string; size: number }[]; size: number }[]
		files = info!.files
		size = info!.size
		return info!.files.map((f) => f.path)
	}
	let files: { path: string; size: number }[] = []
	let size = 0

	it('lists only dist/, the licences, the readme and package.json', () => {
		const paths = packed()
		for (const p of paths)
			expect(p, p).toMatch(/^(dist\/|LICENSE$|THIRD_PARTY_NOTICES\.md$|README\.md$|package\.json$)/)
		expect(paths).toEqual(
			expect.arrayContaining([
				'LICENSE',
				'THIRD_PARTY_NOTICES.md',
				'dist/index.js',
				'dist/index.cjs',
				'dist/index.d.ts',
				'dist/index.d.cts',
				'dist/wasm/velowa_wasm_bridge_bg.wasm',
				'dist/wasm-voip/velowa_wasm_voip_bg.wasm',
				'dist/proto/WAProto.proto',
			]),
		)
	})

	it('holds no source maps, tests, credentials, logs or keys', () => {
		const paths = packed()
		for (const p of paths)
			expect(p, p).not.toMatch(
				/\.map$|\.test\.|testkit|creds\.json|(^|\/)\.env|(^|\/)auth\/|(^|\/)logs\/|\.pem$|\.key$|id_rsa|\.npmrc/,
			)
	})

	it('stays small', () => {
		packed()
		expect(size).toBeLessThan(3 * 1024 * 1024) // 1.5 MB today; a jump should be on purpose
		expect(files.length).toBeLessThan(40)
	})

	it('has every file the manifest points to', () => {
		const targets = new Set<string>([
			pkg.main!,
			pkg.module!,
			pkg.types!,
			...Object.values(pkg.bin ?? {}),
		])
		const walk = (v: unknown): void => {
			if (typeof v === 'string') targets.add(v)
			else if (v && typeof v === 'object') Object.values(v).forEach(walk)
		}
		walk(pkg.exports)
		for (const t of targets)
			if (t.startsWith('./dist/')) expect(existsSync(join(root, t)), t).toBe(true)
	})

	it('has command line tools that can be run directly', () => {
		for (const t of Object.values(pkg.bin ?? {})) {
			const file = join(root, t)
			expect(readFileSync(file, 'utf8').startsWith('#!/usr/bin/env node\n'), t).toBe(true)
			if (process.platform !== 'win32')
				expect(statSync(file).mode & 0o111, `${t} is executable`).toBeGreaterThan(0)
		}
	})

	it('imports only packages it declares', () => {
		const declared = new Set([...RUNTIME_DEPENDENCIES, ...OPTIONAL_DEPENDENCIES])
		const builtin = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)])
		const seen = new Set<string>()
		const entries = ['dist/index.js', 'dist/index.cjs', 'dist/cli/pair.js', 'dist/cli/logs.js']
		const chunks = ['dist'].flatMap(() =>
			files.map((f) => f.path).filter((p) => /^dist\/[^/]+\.js$/.test(p)),
		)
		for (const rel of new Set([...entries, ...chunks])) {
			const code = readFileSync(join(root, rel), 'utf8')
			for (const m of code.matchAll(
				/(?:from\s*|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g,
			)) {
				const spec = m[1]!
				// only things that can be a package name (bundled code also holds strings that merely look like imports)
				if (
					spec.startsWith('.') ||
					builtin.has(spec) ||
					!/^(@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*(\/[\w./-]*)?$/.test(spec)
				)
					continue
				seen.add(spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]!)
			}
		}
		for (const name of seen)
			expect(declared.has(name), `${name} is imported but not declared`).toBe(true)
		// and the library itself needs none of the optional ones
		const lib =
			readFileSync(join(root, 'dist/index.js'), 'utf8') +
			readFileSync(join(root, 'dist/index.cjs'), 'utf8')
		for (const name of OPTIONAL_DEPENDENCIES) expect(lib).not.toContain(name)
	})
})
