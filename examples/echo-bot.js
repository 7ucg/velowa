// The smallest useful bot: link the account, then repeat what people write to it.
//
//   node examples/echo-bot.js
//
// First run: scan the QR code with WhatsApp > Linked devices > Link a device. The login is kept in ./auth,
// so the next start connects straight away.
import qrcode from 'qrcode-terminal'
import { Client, ProtocolLogger, serialize } from 'velowa'

const client = new Client({
	authDir: 'auth',
	logger: new ProtocolLogger({ enabled: false }), // set it to true to record every frame under ./logs
})

client.on('connection', (u) => {
	if (u.qr) qrcode.generate(u.qr, { small: true })
	if (u.state === 'open') console.log('online as', client.me?.id)
	if (u.state === 'close') {
		console.log('closed:', u.reason)
		if (u.loggedOut) console.log('logged out on the phone: delete ./auth and link again')
	}
})

client.on('message', async (raw) => {
	const m = serialize(client, raw) // who wrote it, where, what, and reply()
	if (m.fromMe || !m.text) return
	await m.reply(`you said: ${m.text}`)
})

await client.connect()
