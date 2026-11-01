// Dev tool: link velowa by QR code (if needed), then stay connected, log everything and take commands.
//   node dist/cli/pair.js [--log=false] [--log-dir=logs] [--auth=auth]
// Commands on stdin:   send <jid> <text...>
import { createInterface } from 'node:readline'
import qrcode from 'qrcode-terminal'
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

const client = new Client({ authDir: arg('auth', 'auth'), logger })
client.on('qr', ({ qr }) => {
	console.log('\nScan with WhatsApp > Linked devices > Link a device:\n')
	qrcode.generate(qr, { small: true })
})
client.on('paired', ({ id }) => console.log(`Paired as ${id}`))
client.on('open', ({ id }) =>
	console.log(`Logged in as ${id}. Commands: send <jid> <text>   (Ctrl+C to stop)`),
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

createInterface({ input: process.stdin }).on('line', (line) => {
	const [cmd, jid, ...rest] = line.trim().split(/\s+/)
	if (cmd !== 'send' || !jid || rest.length === 0) return console.log('usage: send <jid> <text...>')
	client.sendText(jid, rest.join(' ')).then(
		(id) => console.log(`sent ${id}`),
		(e: unknown) => console.error('send failed:', e instanceof Error ? e.message : e),
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
