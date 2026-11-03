#!/usr/bin/env node
// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
// Dev tool: link velowa by QR code (if needed), then stay connected, log everything and take commands.
//   node dist/cli/pair.js [--log=false] [--log-dir=logs] [--auth=auth] [--phone=4915...  (pairing code instead of QR)]
//     [--code=ABCD2345  (use this pairing code instead of a random one; needs --phone. Visible to anything that
//       can list this machine's processes - on a shared machine prefer the VELOWA_PAIRING_CODE env var instead.)]
// Commands on stdin: type `help` (send, react, edit, delete, image, poll, groups, archive, privacy, ...)
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { createInterface } from 'node:readline'
import { Client } from '../client/client.js'
import { ProtocolLogger } from '../logging/protocol-logger.js'

const arg = (name: string, fallback: string) =>
	process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback

const logEnabled = arg('log', 'true') !== 'false'
const logger = new ProtocolLogger({
	enabled: logEnabled,
	dir: arg('log-dir', 'logs'),
	label: 'pair',
})
console.log(
	logEnabled ? `Logging everything to ${logger.sessionDir}` : 'Logging disabled (--log=false)',
)

const phone = arg('phone', '')
// The env var first: an argv value is visible to anything that can list this machine's processes.
const code = process.env['VELOWA_PAIRING_CODE'] || arg('code', '')
const client = new Client({
	authDir: arg('auth', 'auth'),
	logger,
	...(phone && { pairWithPhoneNumber: phone }),
	...(code && { customPairingCode: code }),
})
client.on('pairing-code', ({ code }) =>
	console.log(
		`\nPairing code: ${code.slice(0, 4)}-${code.slice(4)}\nOn the phone: WhatsApp > Linked devices > Link a device > Link with phone number instead\n`,
	),
)
client.on('qr', ({ qr }) => {
	console.log('\nScan with WhatsApp > Linked devices > Link a device:\n')
	// qrcode-terminal is an optional dependency: without it the raw code is printed (paste it into any QR generator)
	import('qrcode-terminal').then(
		(m) => (m.default ?? m).generate(qr, { small: true }),
		() => console.log(qr),
	)
})
client.on('paired', ({ id }) => console.log(`Paired as ${id}`))
client.on('open', ({ id }) =>
	console.log(`Logged in as ${id}. Type help for commands (Ctrl+C to stop).`),
)
client.on('close', (c) =>
	console.log(
		`Connection closed (code=${c.code ?? '-'}, reason=${c.reason})${c.willReconnect ? ', reconnecting ...' : ''}`,
	),
)
client.on('message', (m) =>
	console.log(
		`Message ${m.id} from ${m.participant ?? m.from}:`,
		JSON.stringify(m.message).slice(0, 300),
	),
)

// ---- more events, printed compactly (everything is in the log anyway) ----
const show = (name: string) => (e: unknown) =>
	console.log(`[${name}]`, JSON.stringify(e).slice(0, 240))
for (const ev of [
	'receipt',
	'presence',
	'group.update',
	'chat.update',
	'contact.update',
	'call',
] as const) {
	client.on(ev, show(ev))
}
client.on('history', (h) =>
	console.log(
		`[history] ${h.syncType} chunk ${h.chunkOrder ?? '-'} ${h.progress ?? '-'}%: ${h.chats.length} chats, ${h.chats.reduce((a, c) => a + c.messages.length, 0)} messages`,
	),
)

// ---- commands -----------------------------------------------------------------------------------
const tokens = (line: string): string[] =>
	[...line.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2] ?? '')
const key = (chat: string, id: string, fromMe = false) => ({ remoteJid: chat, id, fromMe })
type Cmd = { usage: string; run(a: string[]): Promise<unknown> }
const commands: Record<string, Cmd> = {
	send: { usage: 'send <jid> <text...>', run: (a) => client.sendText(a[0]!, a.slice(1).join(' ')) },
	reply: {
		usage: 'reply <jid> <msgId> <text...>   (quotes a message from them)',
		run: (a) =>
			client.sendText(a[0]!, a.slice(2).join(' '), {
				quoted: { key: key(a[0]!, a[1]!), message: { conversation: '' } },
			}),
	},
	react: {
		usage: 'react <jid> <msgId> <emoji|"">  [me]',
		run: (a) => client.react(key(a[0]!, a[1]!, a[3] === 'me'), a[2] ?? ''),
	},
	edit: {
		usage: 'edit <jid> <msgId> <new text...>',
		run: (a) => client.edit(key(a[0]!, a[1]!, true), a.slice(2).join(' ')),
	},
	delete: {
		usage: 'delete <jid> <msgId> [me]   (for everyone; "me" = it is my message)',
		run: (a) => client.revoke(key(a[0]!, a[1]!, a[2] === 'me')),
	},
	read: { usage: 'read <jid> <msgId>', run: (a) => client.markRead([key(a[0]!, a[1]!)]) },
	typing: {
		usage: 'typing <jid> [composing|paused|recording]',
		run: (a) => client.sendChatState(a[0]!, (a[1] ?? 'composing') as 'composing'),
	},
	online: {
		usage: 'online [available|unavailable]   (needs a display name: name <text>)',
		run: (a) => client.sendPresence((a[0] ?? 'available') as 'available'),
	},
	name: {
		usage: 'name <display name...>',
		run: async (a) => client.updateProfileName(a.join(' ')),
	},
	watch: { usage: 'watch <jid>   (presence updates)', run: (a) => client.subscribePresence(a[0]!) },
	image: {
		usage: 'image <jid> <file> [caption...]',
		run: async (a) =>
			client.sendImage(a[0]!, await readFile(a[1]!), {
				caption: a.slice(2).join(' ') || (undefined as never),
			}),
	},
	video: {
		usage: 'video <jid> <file> [caption...]',
		run: async (a) =>
			client.sendVideo(a[0]!, await readFile(a[1]!), {
				caption: a.slice(2).join(' ') || (undefined as never),
			}),
	},
	audio: {
		usage: 'audio <jid> <file> [voice]',
		run: async (a) => client.sendAudio(a[0]!, await readFile(a[1]!), { ptt: a[2] === 'voice' }),
	},
	doc: {
		usage: 'doc <jid> <file> [mimetype]',
		run: async (a) =>
			client.sendDocument(a[0]!, await readFile(a[1]!), {
				fileName: basename(a[1]!),
				mimetype: a[2] as never,
			}),
	},
	sticker: {
		usage: 'sticker <jid> <file.webp>',
		run: async (a) => client.sendSticker(a[0]!, await readFile(a[1]!)),
	},
	poll: {
		usage: 'poll <jid> "question" "opt1" "opt2" ...',
		run: (a) => client.sendPoll(a[0]!, a[1]!, a.slice(2)),
	},
	location: {
		usage: 'location <jid> <lat> <lon> [name...]',
		run: (a) =>
			client.sendLocation(a[0]!, Number(a[1]), Number(a[2]), {
				name: a.slice(3).join(' ') || (undefined as never),
			}),
	},
	onwa: { usage: 'onwa <number...>', run: (a) => client.onWhatsApp(...a) },
	about: { usage: 'about <jid...>', run: (a) => client.fetchStatus(...a) },
	pic: {
		usage: 'pic <jid> [image]',
		run: (a) => client.profilePictureUrl(a[0]!, (a[1] ?? 'preview') as 'preview'),
	},
	block: { usage: 'block <jid>', run: (a) => client.blockUser(a[0]!) },
	unblock: { usage: 'unblock <jid>', run: (a) => client.unblockUser(a[0]!) },
	blocklist: { usage: 'blocklist', run: () => client.fetchBlocklist() },
	privacy: {
		usage: 'privacy [category value]',
		run: (a) =>
			a.length === 2
				? client.updatePrivacy(a[0] as never, a[1] as never)
				: client.fetchPrivacySettings(),
	},
	groups: {
		usage: 'groups',
		run: async () =>
			Object.values(await client.groups.fetchAll()).map(
				(g) => `${g.id}  ${g.subject}  (${g.size})`,
			),
	},
	group: { usage: 'group <jid>', run: (a) => client.groups.metadata(a[0]!) },
	'group-create': {
		usage: 'group-create "subject" <jid...>',
		run: (a) => client.groups.create(a[0]!, a.slice(1), client.me?.id),
	},
	'group-add': {
		usage: 'group-add <group> <jid...>',
		run: (a) => client.groups.updateParticipants(a[0]!, a.slice(1), 'add'),
	},
	'group-remove': {
		usage: 'group-remove <group> <jid...>',
		run: (a) => client.groups.updateParticipants(a[0]!, a.slice(1), 'remove'),
	},
	'group-promote': {
		usage: 'group-promote <group> <jid...>',
		run: (a) => client.groups.updateParticipants(a[0]!, a.slice(1), 'promote'),
	},
	'group-demote': {
		usage: 'group-demote <group> <jid...>',
		run: (a) => client.groups.updateParticipants(a[0]!, a.slice(1), 'demote'),
	},
	'group-subject': {
		usage: 'group-subject <group> <text...>',
		run: (a) => client.groups.setSubject(a[0]!, a.slice(1).join(' ')),
	},
	'group-invite': { usage: 'group-invite <group>', run: (a) => client.groups.inviteCode(a[0]!) },
	'group-leave': { usage: 'group-leave <group>', run: (a) => client.groups.leave(a[0]!) },
	archive: { usage: 'archive <jid> [off]', run: (a) => client.archiveChat(a[0]!, a[1] !== 'off') },
	mute: {
		usage: 'mute <jid> <hours|off>',
		run: (a) =>
			client.muteChat(a[0]!, a[1] === 'off' ? null : Date.now() + Number(a[1]) * 3_600_000),
	},
	pin: { usage: 'pin <jid> [off]', run: (a) => client.pinChat(a[0]!, a[1] !== 'off') },
	star: {
		usage: 'star <jid> <msgId> [me] [off]',
		run: (a) => client.starMessage(key(a[0]!, a[1]!, a.includes('me')), !a.includes('off')),
	},
	channel: {
		usage: 'channel <invite-code>',
		run: (a) => client.newsletters.metadata('invite', a[0]!),
	},
	'channel-follow': { usage: 'channel-follow <jid>', run: (a) => client.newsletters.follow(a[0]!) },
	help: {
		usage: 'help',
		run: async () =>
			Object.values(commands)
				.map((c) => c.usage)
				.join('\n'),
	},
}

createInterface({ input: process.stdin }).on('line', (line) => {
	const [name, ...args] = tokens(line.trim())
	if (!name) return
	const cmd = commands[name]
	if (!cmd) return console.log(`unknown command "${name}" - type help`)
	cmd.run(args).then(
		(r) =>
			console.log(r === undefined ? 'ok' : typeof r === 'string' ? r : JSON.stringify(r, null, 1)),
		(e: unknown) => console.error(`${name} failed:`, e instanceof Error ? e.message : e),
	)
})

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
	process.on(sig, () => {
		client.close(`signal ${sig}`)
		process.exit(0)
	})
}
process.on('uncaughtException', (error) => {
	logger.event('process.uncaughtException', error)
	logger.close('uncaughtException', error)
	console.error(error)
	process.exit(1)
})
process.on('unhandledRejection', (error) => logger.event('process.unhandledRejection', error))
process.on('exit', (code) => logger.close(`process exit ${code}`))

await client.connect()
