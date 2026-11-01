// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
// Send one message from a script, a cron job or a CI step, then exit.
//
//   node examples/notifier.js 4915... "Backup finished"
//   node examples/notifier.js 1203...@g.us "Deploy failed" --image=screenshot.png
//
// The first argument is a phone number (country code, digits) or a JID (a group, a channel).
import { readFile } from 'node:fs/promises'
import { Client, ProtocolLogger } from 'velowa'

const [target, text, ...rest] = process.argv.slice(2)
if (!target || !text) {
	console.error('usage: node examples/notifier.js <number or jid> "<text>" [--image=file]')
	process.exit(2)
}
const image = rest.find((a) => a.startsWith('--image='))?.slice('--image='.length)

const client = new Client({
	authDir: 'auth',
	logger: new ProtocolLogger({ enabled: false }),
	antiban: true, // a script that sends many messages should not look like one
})
try {
	await client.connect()
	await client.ready()

	let jid = target
	if (!target.includes('@')) {
		const [found] = await client.onWhatsApp(target)
		if (!found?.exists) throw new Error(`${target} is not on WhatsApp`)
		jid = found.jid
	}

	const id = image
		? await client.send(jid, { image: await readFile(image), caption: text })
		: await client.send(jid, { text })
	console.log('sent', id)
} catch (error) {
	console.error('could not send:', error.message)
	process.exitCode = 1
}
client.close('done')
setTimeout(() => process.exit(), 300)
