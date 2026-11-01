import { defineConfig } from 'tsup'

// One source, two module formats: `dist/index.js` (ESM) and `dist/index.cjs` (CommonJS), with matching type
// files (`index.d.ts`, `index.d.cts`). Dependencies stay external; the generated WASM glue is bundled, and the
// `.wasm` files and the proto schema are copied next to the bundles by `scripts/copy-assets.mjs`.
const common = {
	target: 'node18',
	platform: 'node',
	sourcemap: false,
	// optional dependencies are not bundled either (tsup only skips `dependencies` by itself)
	external: ['qrcode-terminal'],
	// every built file carries the credit notice (the leading `!` keeps bundlers from stripping it)
	banner: {
		js: '/*!\n * velowa - https://github.com/7ucg/velowa - (c) 2026 Baron\n * velowa License (MIT with mandatory credit): copying any part of this code, however small, requires credit. See LICENSE.\n * Parts from other projects keep their own licences: see THIRD_PARTY_NOTICES.md.\n */',
	},
} as const

export default defineConfig([
	{
		...common,
		// ESM: the library and the pairing helper share their chunks, so both find the assets in `dist/`
		entry: {
			index: 'src/index.ts',
			'cli/pair': 'src/cli/pair.ts',
			'cli/logs': 'src/cli/logs.ts',
		},
		format: ['esm'],
		dts: { entry: { index: 'src/index.ts' } },
		clean: false,
		outExtension: () => ({ js: '.js' }),
	},
	{
		...common,
		entry: { index: 'src/index.ts' },
		format: ['cjs'],
		dts: true,
		shims: true, // `import.meta.url` keeps working in the CommonJS build
		clean: false,
		outExtension: () => ({ js: '.cjs' }),
	},
])
