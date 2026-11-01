// Live check against OTHER chats: a second account, a test group and a test channel.
// Sends a handful of messages there (and edits/deletes some of them again); it does not change members or settings.
//
//   npm run build && node examples/example-others.js
//
// Targets can be overridden: OTHER_NUMBER=+57... OTHER_USERNAME=@name TEST_GROUP=...@g.us TEST_CHANNEL=...@newsletter
import { Client, ProtocolLogger } from '../dist/index.js'

const OTHER_NUMBER = process.env.OTHER_NUMBER ?? '+57 318 7684442'
const OTHER_USERNAME = process.env.OTHER_USERNAME ?? '@9oged'
const GROUP = process.env.TEST_GROUP ?? '120363409361773452@g.us'
const CHANNEL = process.env.TEST_CHANNEL ?? '120363402116894088@newsletter'

const logger = new ProtocolLogger({ dir: 'logs', label: 'example-others' })
console.log('protocol log:', logger.sessionDir)
const client = new Client({ authDir: 'auth', logger })
const receipts = []
const incoming = []
const groupEvents = []
client.on('receipt', (r) => receipts.push(r))
client.on('message', (m) => incoming.push(m))
client.on('group.update', (g) => groupEvents.push(g))
client.on('qr', () => { console.error('not linked: run `npm run pair` first'); process.exit(2) })

const results = []
async function step(name, fn) {
	const t0 = Date.now()
	try {
		const out = await fn()
		results.push({ name, ok: true })
		console.log(`  ok    ${name}${out !== undefined ? '  ' + String(out).slice(0, 110) : ''}`)
		return out
	} catch (e) {
		results.push({ name, ok: false, error: e?.message ?? String(e) })
		console.log(`  FAIL  ${name}: ${e?.message ?? e}  (${Date.now() - t0} ms)`)
	}
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64')

await client.connect()
await Promise.race([client.ready(), sleep(60_000).then(() => { throw new Error('login timed out') })])
console.log(`logged in as ${client.me.id}\n`)

console.log('second account')
const lookup = await step('onWhatsApp(number)', async () => {
	const r = await client.onWhatsApp(OTHER_NUMBER)
	if (!r?.[0]?.exists) throw new Error('number is not on WhatsApp: ' + JSON.stringify(r))
	return JSON.stringify(r[0])
})
const byName = await step('find by username', async () => JSON.stringify(await client.findUserByUsername(OTHER_USERNAME)))
const other = lookup ? JSON.parse(lookup).jid : undefined
if (byName && other) {
	const lids = await client.lidsFor(other)
	const same = JSON.parse(byName)?.jid === other || lids.some((l) => l.lid === JSON.parse(byName)?.jid)
	console.log('       username and number refer to the same account:', same)
}
if (other) {
	await step('about', async () => JSON.stringify(await client.fetchStatus(other)))
	await step('profile picture', async () => (await client.profilePictureUrl(other)) ?? '(none or hidden)')
	await step('LID of the account', async () => JSON.stringify(await client.lidsFor(other)))
	const hello = await step('send text', () => client.sendText(other, 'velowa test: hello from the new client'))
	await step('reply (quoted)', () => client.sendText(other, 'velowa test: a reply', { quoted: { key: { remoteJid: other, id: hello, fromMe: true }, message: { extendedTextMessage: { text: 'velowa test: hello from the new client' } } } }))
	await step('react', () => client.react({ remoteJid: other, id: hello, fromMe: true }, '👍'))
	const typo = await step('send text to edit', () => client.sendText(other, 'velowa test: typpo'))
	await step('edit', () => client.edit({ remoteJid: other, id: typo, fromMe: true }, 'velowa test: typo fixed'))
	const gone = await step('send text to delete', () => client.sendText(other, 'velowa test: this one gets deleted'))
	await step('delete for everyone', () => client.revoke({ remoteJid: other, id: gone, fromMe: true }))
	await step('send image', () => client.sendImage(other, PNG, { caption: 'velowa test image', mimetype: 'image/png', width: 1, height: 1 }))
	await step('typing indicator', () => client.sendChatState(other, 'composing').then(() => sleep(1500)).then(() => client.sendChatState(other, 'paused')))
	await step('subscribe presence', () => client.subscribePresence(other))
}

console.log('\ngroup')
await step('group metadata', async () => {
	const g = await client.groups.metadata(GROUP)
	return `"${g.subject}", ${g.participants.length} members, mode ${g.addressingMode}, announce=${g.announce}, restrict=${g.restrict}`
})
await step('group invite code (read only)', async () => (await client.groups.inviteCode(GROUP)) ? 'available' : 'none')
const g1 = await step('send text to group', () => client.sendText(GROUP, 'velowa test: hello group'))
await step('react in group', () => client.react({ remoteJid: GROUP, id: g1, fromMe: true }, '🔥'))
const g2 = await step('send text to edit', () => client.sendText(GROUP, 'velowa test: gruop typo'))
await step('edit in group', () => client.edit({ remoteJid: GROUP, id: g2, fromMe: true }, 'velowa test: group typo fixed'))
const g3 = await step('send text to delete', () => client.sendText(GROUP, 'velowa test: delete me'))
await step('delete in group', () => client.revoke({ remoteJid: GROUP, id: g3, fromMe: true }))
await step('poll in group', () => client.sendPoll(GROUP, 'velowa test poll', ['one', 'two']))
await step('image in group', () => client.sendImage(GROUP, PNG, { caption: 'group image', mimetype: 'image/png', width: 1, height: 1 }))

console.log('\nchannel')
await step('channel metadata', async () => {
	const c = await client.newsletters.metadata('jid', CHANNEL)
	return `"${c.name}", role ${c.role}, ${c.subscribers ?? '?'} subscribers`
})
await step('post to channel', () => client.sendText(CHANNEL, 'velowa test: channel post'))

console.log('\nwaiting 15 s for delivery/read receipts and replies ...')
await sleep(15_000)
console.log(`  receipts: ${receipts.length} (${[...new Set(receipts.map((r) => r.type))].join(', ') || '-'}); incoming messages: ${incoming.length}; group events: ${groupEvents.length}`)
for (const m of incoming.slice(0, 5)) console.log(`  <- ${m.participant ?? m.from}: ${JSON.stringify(m.message).slice(0, 100)}`)

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} steps ok`)
for (const f of failed) console.log(`  - ${f.name}: ${f.error}`)
client.close('example finished')
setTimeout(() => process.exit(failed.length ? 1 : 0), 500)
