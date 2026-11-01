#!/usr/bin/env node
// WABinary encode/decode throughput and heap growth: velowa (own wasm binding) vs baron-baileys-v2 (its rust bridge).
//   node scripts/bench-codec.mjs [path/to/baron-baileys-v2]
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'

const baileysDir = process.argv[2] ?? join(homedir(), 'Dokumente/GitHub/baron-baileys-v2')
const require = createRequire(join(baileysDir, 'src/x.js'))
const bw = require(join(baileysDir, 'src/WABinary/index.js'))
const { encodeNode, decodeNode } = await import(new URL('../dist/index.js', import.meta.url))

// A realistic mix: a message stanza with participants and encrypted payloads, and a small iq.
const enc = (n) => new Uint8Array(n).fill(7)
const message = {
	tag: 'message',
	attrs: { id: '3EB0AABBCCDDEEFF0011', to: '120363000000000001@g.us', type: 'text', addressing_mode: 'lid' },
	content: [
		{ tag: 'participants', attrs: {}, content: Array.from({ length: 12 }, (_, i) => ({ tag: 'to', attrs: { jid: `4915611111${100 + i}:1@s.whatsapp.net` }, content: [{ tag: 'enc', attrs: { v: '2', type: 'msg' }, content: enc(180) }] })) },
		{ tag: 'enc', attrs: { v: '2', type: 'skmsg' }, content: enc(400) },
		{ tag: 'bot', attrs: { biz_bot: '1' } }
	]
}
const iq = { tag: 'iq', attrs: { to: 's.whatsapp.net', type: 'get', xmlns: 'w:p', id: 'ping-1' } }

// Baileys' codec functions are async (they return promises), so every implementation is awaited the same way.
async function time(label, fn, n) {
	for (let i = 0; i < n / 10; i++) await fn() // warm up
	if (global.gc) global.gc()
	const heap0 = process.memoryUsage().heapUsed
	const t0 = process.hrtime.bigint()
	for (let i = 0; i < n; i++) await fn()
	const ms = Number(process.hrtime.bigint() - t0) / 1e6
	if (global.gc) global.gc()
	const heapMb = (process.memoryUsage().heapUsed - heap0) / 1048576
	console.log(`${label.padEnd(34)} ${(n / (ms / 1000)).toFixed(0).padStart(9)} ops/s   ${(ms / n * 1000).toFixed(1).padStart(7)} µs/op   heap Δ ${heapMb.toFixed(1)} MB`)
}

const N = 20000
for (const [name, node] of [['message (12 devices, ~2.6 KB)', message], ['iq ping', iq]]) {
	console.log(`\n${name}`)
	const vBytes = encodeNode(node)
	await time('velowa   encode', () => encodeNode(node), N)
	await time('velowa   decode', () => decodeNode(vBytes), N)
	const bBytes = await bw.encodeBinaryNode(node)
	await time('baileys  encode', () => bw.encodeBinaryNode(node), N)
	await time('baileys  decode', () => bw.decodeBinaryNode(bBytes), N)
	console.log(`(sizes: velowa ${vBytes.length} B, baileys ${bBytes.length} B)`)
}
const m = process.memoryUsage()
console.log(`\nprocess: rss ${(m.rss / 1048576).toFixed(0)} MB, heapUsed ${(m.heapUsed / 1048576).toFixed(0)} MB, external ${(m.external / 1048576).toFixed(0)} MB`)
