// A bot written as plugin files: one file per command, reloaded while the bot runs when you edit one.
//
//   OWNERS=4915... node examples/plugin-bot/index.js
//
// A plugin is a file in ./plugins that exports an object:
//   export default { commands: ['ping'], help: '...', group: true, admin: true, owner: true, run: async (ctx) => ... }
// `ctx` holds client, m (the message), command, args, text, group, isOwner, isAdmin, plugins and reply().
import { readdirSync, watch } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import qrcode from 'qrcode-terminal'
import {
	Client,
	GroupCache,
	isGroupAdmin,
	jidNormalizedUser,
	ProtocolLogger,
	serialize,
} from 'velowa'

const PREFIX = '!'
const OWNERS = (process.env.OWNERS ?? '')
	.split(',')
	.map((n) => n.trim())
	.filter(Boolean)
const DIR = fileURLToPath(new URL('./plugins/', import.meta.url))

const client = new Client({ authDir: 'auth', logger: new ProtocolLogger({ enabled: false }) })
const groups = new GroupCache(client)

let plugins = []
let version = 0
async function loadPlugins() {
	const loaded = []
	for (const file of readdirSync(DIR).filter((f) => f.endsWith('.js') && !f.startsWith('_'))) {
		try {
			const mod = await import(`${pathToFileURL(join(DIR, file)).href}?v=${++version}`) // ?v: read the edited file again
			loaded.push({ name: file, ...mod.default })
		} catch (error) {
			console.error(`plugin ${file} did not load:`, error)
		}
	}
	plugins = loaded
	console.log(`plugins: ${plugins.map((p) => p.commands?.[0] ?? p.name).join(', ')}`)
}
await loadPlugins()
let timer
watch(DIR, () => (clearTimeout(timer), (timer = setTimeout(loadPlugins, 250)))) // hot reload

client.on('connection', (u) => {
	if (u.qr) qrcode.generate(u.qr, { small: true })
	if (u.state === 'open') console.log('online as', client.me?.id)
})

client.on('message', async (raw) => {
	const m = serialize(client, raw)
	if (m.fromMe || (m.timestamp && Date.now() / 1000 - m.timestamp > 120)) return
	if (!m.text.startsWith(PREFIX)) return
	const [word, ...args] = m.text.slice(PREFIX.length).trim().split(/\s+/)
	const command = word.toLowerCase()
	const plugin = plugins.find((p) => p.commands?.includes(command))
	if (!plugin) return

	const group = m.isGroup ? await groups.get(m.chat) : undefined
	const ctx = {
		client,
		m,
		command,
		args,
		text: args.join(' '),
		group,
		plugins,
		isOwner: OWNERS.includes(jidNormalizedUser(m.sender).split('@')[0]),
		isAdmin: isGroupAdmin(group, m.sender),
		reply: (content, options) => m.reply(content, options),
	}
	if (plugin.owner && !ctx.isOwner) return m.reply('owner only')
	if (plugin.group && !m.isGroup) return m.reply('groups only')
	if (plugin.admin && !ctx.isAdmin && !ctx.isOwner) return m.reply('admins only')
	try {
		await plugin.run(ctx)
	} catch (error) {
		console.error(`${command} failed:`, error)
		await m.reply('that went wrong').catch(() => undefined)
	}
})

await client.connect()
