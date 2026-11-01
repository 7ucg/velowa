#!/usr/bin/env node
// One-off migration for creds paired before the full ADVSignedDeviceIdentity was stored:
// restores `account` (incl. accountSignatureKey) from the pair-success stanza in a session log.
//   node scripts/recover-account.mjs <logs/pair-.../nodes.jsonl> [auth/creds.json]
import { readFileSync, writeFileSync } from 'node:fs'
import protobuf from 'protobufjs'

const [logFile, credsFile = 'auth/creds.json'] = process.argv.slice(2)
if (!logFile) throw new Error('usage: recover-account.mjs <nodes.jsonl> [creds.json]')
const root = new protobuf.Root()
root.loadSync(new URL('../proto/WAProto.proto', import.meta.url).pathname)
const T = (n) => root.lookupType(`proto.${n}`)

const entry = readFileSync(logFile, 'utf8').trim().split('\n').map(JSON.parse)
	.find((e) => e.direction === 'recv' && e.node.tag === 'iq' && JSON.stringify(e.node).includes('pair-success'))
if (!entry) throw new Error('no pair-success stanza in that log')
const ps = entry.node.content.find((c) => c.tag === 'pair-success')
const di = ps.content.find((c) => c.tag === 'device-identity').content.$bytes
const hmac = T('ADVSignedDeviceIdentityHMAC').decode(Buffer.from(di, 'hex'))
const account = T('ADVSignedDeviceIdentity').decode(hmac.details)
const creds = JSON.parse(readFileSync(credsFile, 'utf8'))
const raw = creds.account.$bytes ? Buffer.from(creds.account.$bytes, 'base64') : Buffer.from(creds.account.data)
const stored = T('ADVSignedDeviceIdentity').decode(raw)
if (Buffer.compare(stored.accountSignature, account.accountSignature) !== 0) throw new Error('log belongs to a different pairing')
const full = T('ADVSignedDeviceIdentity').encode(T('ADVSignedDeviceIdentity').fromObject({
	details: account.details,
	accountSignatureKey: account.accountSignatureKey,
	accountSignature: account.accountSignature,
	deviceSignature: stored.deviceSignature
})).finish()
creds.account = { $bytes: Buffer.from(full).toString('base64') }
writeFileSync(credsFile, JSON.stringify(creds, null, 2), { mode: 0o600 })
console.log('account restored, accountSignatureKey bytes:', account.accountSignatureKey.length)
