// A tour of what velowa can do, run against your own account: it sends one of everything to your own chat
// ("Saved messages"), reads some account data, changes the state of that chat and puts it back. Each step prints
// ok / FAIL, so it doubles as a check that your setup works end to end.
//
//   node examples/tour.js            (link the account first, e.g. with examples/echo-bot.js)
//   VELOWA_LOG=1 node examples/tour.js    also record the protocol under ./logs
import { Client, ProtocolLogger, quickReply, urlButton } from 'velowa'

const logger = new ProtocolLogger({
	enabled: process.env.VELOWA_LOG === '1',
	dir: 'logs',
	label: 'tour',
})
if (logger.sessionDir) console.log('protocol log:', logger.sessionDir)

const client = new Client({ authDir: 'auth', logger })
const seen = { messages: [], receipts: [], appState: [], history: 0, errors: [] }
client.on('message', (m) => seen.messages.push(m))
client.on('receipt', (r) => seen.receipts.push(r))
client.on('app-state', (e) => seen.appState.push(e))
client.on('history', () => seen.history++)
client.on('close', (c) => c.willReconnect && console.log('connection dropped, reconnecting…'))
client.on('qr', () => {
	console.error(
		'This account is not linked yet. Run examples/echo-bot.js once and scan the QR code.',
	)
	process.exit(2)
})

const results = []
async function step(name, fn) {
	const t0 = Date.now()
	try {
		const out = await fn()
		results.push({ name, ok: true, ms: Date.now() - t0, out })
		console.log(`  ok    ${name}${out !== undefined ? '  ' + String(out).slice(0, 100) : ''}`)
		return out
	} catch (e) {
		results.push({ name, ok: false, ms: Date.now() - t0, error: e?.message ?? String(e) })
		console.log(`  FAIL  ${name}: ${e?.message ?? e}`)
	}
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// 1x1 red PNG
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
	'base64',
)

await client.connect()
await Promise.race([
	client.ready(),
	sleep(60_000).then(() => {
		throw new Error('login timed out')
	}),
])
const me = client.me.id.replace(/:\d+@/, '@')
console.log(`logged in as ${client.me.id}; chatting with myself (${me})\n`)

console.log('messages')
const first = await step('send text', () => client.sendText(me, 'velowa tour: hello'))
await step('send reply (quoted)', () =>
	client.sendText(me, 'a reply', {
		quoted: {
			key: { remoteJid: me, id: first, fromMe: true },
			message: { extendedTextMessage: { text: 'velowa tour: hello' } },
		},
	}),
)
await step('react', () => client.react({ remoteJid: me, id: first, fromMe: true }, '👍'))
const toEdit = await step('send text to edit', () => client.sendText(me, 'typo here'))
await step('edit', () => client.edit({ remoteJid: me, id: toEdit, fromMe: true }, 'fixed text'))
const toDelete = await step('send text to delete', () => client.sendText(me, 'this will disappear'))
await step('delete for everyone', () =>
	client.revoke({ remoteJid: me, id: toDelete, fromMe: true }),
)
await step('poll', () => client.sendPoll(me, 'Does it work?', ['yes', 'no']))
await step('location', () => client.sendLocation(me, 52.52, 13.405, { name: 'Berlin' }))
await step('contact card', () => client.sendContact(me, 'Test Person', '+4930123456'))
await step('interactive buttons', () =>
	client.sendInteractive(me, {
		body: 'pick one',
		buttons: [quickReply('A', 'a'), urlButton('Site', 'https://example.org')],
	}),
)
await step('typing indicator', () =>
	client.sendChatState(me, 'composing').then(() => client.sendChatState(me, 'paused')),
)

console.log('\nmedia')
const imgId = await step('send image', () =>
	client.sendImage(me, PNG, { caption: 'tiny png', mimetype: 'image/png', width: 1, height: 1 }),
)
await step('send document', () =>
	client.sendDocument(me, Buffer.from('hello from velowa\n'), {
		fileName: 'hello.txt',
		mimetype: 'text/plain',
	}),
)

console.log('\nreceive (our own messages come back from the phone / other devices)')
await sleep(6000)
const echo = seen.messages.find(
	(m) => m.message?.deviceSentMessage?.message?.imageMessage || m.message?.imageMessage,
)
await step(
	'received something back',
	async () => `${seen.messages.length} messages, ${seen.receipts.length} receipts`,
)
if (echo) {
	await step('download + decrypt received image', async () => {
		const inner = echo.message.deviceSentMessage?.message ?? echo.message
		const buf = await client.downloadMedia(inner)
		return `${buf.length} bytes`
	})
}

console.log('\ncontacts / account')
await step('onWhatsApp (own number)', async () => JSON.stringify(await client.onWhatsApp(me)))
await step('about / status', async () => JSON.stringify(await client.fetchStatus(me)))
await step('profile picture url', async () => (await client.profilePictureUrl(me)) ?? '(none set)')
await step('privacy settings', async () => JSON.stringify(await client.fetchPrivacySettings()))
await step('blocklist', async () => `${(await client.fetchBlocklist()).length} blocked`)
await step('business profile (expected: not a business)', async () =>
	JSON.stringify(await client.getBusinessProfile(me)),
)
await step('username', async () => (await client.usernames.mine()) ?? '(none)')

console.log('\ngroups')
await step('list groups', async () => {
	const all = await client.groups.fetchAll()
	return `${Object.keys(all).length} groups`
})

console.log('\napp-state (changes the chat state of your own chat and reverts it)')
await step('wait for the phone to share the app-state key', async () => {
	if (!(await client.waitForAppState(40_000)))
		throw new Error('the phone did not answer the key request in 40s')
	return 'key received'
})
await step('archive own chat', () => client.archiveChat(me, true))
await step('unarchive own chat', () => client.archiveChat(me, false))
await step('pin own chat', () => client.pinChat(me, true))
await step('unpin own chat', () => client.pinChat(me, false))
await step('star message', () =>
	client.starMessage({ remoteJid: me, id: first, fromMe: true }, true),
)
await step('unstar message', () =>
	client.starMessage({ remoteJid: me, id: first, fromMe: true }, false),
)
await sleep(2000)
await step(
	'app-state events seen',
	async () =>
		`${seen.appState.length} (${[...new Set(seen.appState.map((e) => e.action))].join(', ')})`,
)

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} steps ok`)
for (const f of failed) console.log(`  - ${f.name}: ${f.error}`)
client.close('tour finished')
setTimeout(() => process.exit(failed.length ? 1 : 0), 500)
