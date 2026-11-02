// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
// A bot written as one switch over the command (the "cases" style).
//
//   OWNERS=4915...,4916... node examples/cases-bot.js        (first run: scan the QR code)
//
// OWNERS are the phone numbers (country code, digits only) that count as owners; the rest of the bot works without.
import qrcode from 'qrcode-terminal'
import {
	Client,
	GroupCache,
	isGroupAdmin,
	jidNormalizedUser,
	ProtocolLogger,
	serialize,
} from 'velowa'

const PREFIXES = ['!', '.']
const OWNERS = (process.env.OWNERS ?? '')
	.split(',')
	.map((n) => n.trim())
	.filter(Boolean)

const client = new Client({ authDir: 'auth', logger: new ProtocolLogger({ enabled: false }) })
const groups = new GroupCache(client)

client.on('connection', (u) => {
	if (u.qr) qrcode.generate(u.qr, { small: true })
	if (u.pairingCode) console.log('pairing code:', u.pairingCode)
	if (u.state === 'open') console.log('online as', client.me?.id)
	if (u.state === 'close')
		console.log('closed:', u.reason, u.loggedOut ? '(logged out: delete auth/ and link again)' : '')
})

client.on('message', async (raw) => {
	const m = serialize(client, raw)
	if (m.fromMe || m.chat === 'status@broadcast' || m.chat.endsWith('@newsletter')) return
	if (m.timestamp && Date.now() / 1000 - m.timestamp > 120) return // old messages from a reconnect

	const prefix = PREFIXES.find((p) => m.text.startsWith(p))
	if (!prefix) return
	const [word, ...args] = m.text.slice(prefix.length).trim().split(/\s+/)
	const command = word.toLowerCase()
	const text = args.join(' ')

	const isOwner = OWNERS.includes(jidNormalizedUser(m.sender).split('@')[0])
	const group = m.isGroup ? await groups.get(m.chat) : undefined
	const isAdmin = isGroupAdmin(group, m.sender)

	try {
		switch (command) {
			case 'ping':
				await m.reply('pong')
				break

			case 'say':
				if (!text) return m.reply(`usage: ${prefix}say <text>`)
				await m.reply(text)
				break

			case 'whoami':
				await m.reply(
					`you are ${m.pushName} (${m.sender})${isOwner ? ', owner' : ''}${isAdmin ? ', group admin' : ''}`,
				)
				break

			case 'poll': {
				const [name, ...values] = text.split('|').map((s) => s.trim())
				if (!name || values.length < 2)
					return m.reply(`usage: ${prefix}poll question | option 1 | option 2`)
				await client.send(m.chat, { poll: { name, values } })
				break
			}

			case 'react':
				await m.react('🔥')
				break

			case 'quoted':
				await m.reply(
					m.quoted
						? `${m.quoted.sender} wrote: ${m.quoted.text || `[${m.quoted.type}]`}`
						: 'reply to a message first',
				)
				break

			case 'save': {
				// media of the message itself or of the one it answers
				const target = m.isMedia ? m : m.quoted?.mimetype ? m.quoted : undefined
				if (!target) return m.reply('send or quote an image / video / audio / document')
				const data = await target.download()
				await m.reply(`got ${data.length} bytes (${target.mimetype})`)
				break
			}

			case 'admins':
				if (!group) return m.reply('groups only')
				await m.reply(
					`${group.subject}: ${group.admins.length} admin entries, ${group.size} members`,
				)
				break

			case 'delete':
				if (!m.quoted) return m.reply('quote the message to delete')
				if (!isOwner && !isAdmin) return m.reply('admins only')
				await client.revoke(m.quoted.key)
				break

			case 'menu':
				await client.send(m.chat, {
					text: 'What do you want?',
					buttons: [
						{ id: `${prefix}ping`, text: 'ping' },
						{ id: `${prefix}whoami`, text: 'who am I' },
					],
				})
				break

			default:
				break // not one of ours
		}
	} catch (error) {
		console.error(`${command} failed:`, error)
		await m.reply('that went wrong').catch(() => undefined)
	}
})

await client.connect()
