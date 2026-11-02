#!/usr/bin/env node
// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
// Builds the two WebAssembly crates with wasm-pack. The .wasm files are committed (dist/), and a Rust build writes
// the absolute paths of the machine it ran on into them (panic locations). So every path that could name a person
// or a folder is remapped to a neutral one here.
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const cargoHome = process.env.CARGO_HOME ?? join(homedir(), '.cargo')
const rustup = process.env.RUSTUP_HOME ?? join(homedir(), '.rustup')
const sysroot = execFileSync('rustc', ['--print', 'sysroot'], { encoding: 'utf8', cwd: root }).trim()

// Longest paths first: the first matching prefix wins.
const remaps = [
	[sysroot, '/rustc'],
	[rustup, '/rustup'],
	[cargoHome, '/cargo'],
	[root, '/velowa'],
	[homedir(), '/home'],
]
const flags = [
	'--cfg',
	'getrandom_backend="wasm_js"',
	...remaps.flatMap(([from, to]) => [`--remap-path-prefix=${from}=${to}`]),
]

for (const [crate, out] of [
	['rust/wasm-bridge', 'src/wasm'],
	['rust/wasm-voip', 'src/wasm-voip'],
]) {
	execFileSync(
		'wasm-pack',
		['build', crate, '--target', 'web', '--out-dir', `../../${out}`],
		{
			cwd: root,
			stdio: 'inherit',
			// wasm-pack replaces the config's rustflags when this is set, so the cfg is repeated above.
			env: { ...process.env, CARGO_ENCODED_RUSTFLAGS: flags.join('\x1f') },
		},
	)
}
