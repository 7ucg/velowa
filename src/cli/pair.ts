// Dev tool: link velowa as a companion device by QR code, logging the entire session.
//   node dist/cli/pair.js [--log=false] [--log-dir=logs] [--auth=auth/creds.json]
import qrcode from 'qrcode-terminal'
import { initAuthCreds, loadAuthCreds, saveAuthCreds } from '../auth/creds.js'
import type { AuthCreds } from '../auth/creds.js'
import type { BinaryNode } from '../codec/index.js'
import { FileSignalStorage } from '../auth/file-signal-storage.js'
import { Connection, loggedFetch } from '../client/connection.js'
import { Receiver } from '../client/receiver.js'
import { createSignalCipher } from '../crypto/signal.js'
import {
	DEFAULT_CONFIG,
	handlePairSuccess,
	loginPayload,
	qrString,
	registrationPayload,
} from '../client/pairing.js'
import type { ClientConfig } from '../client/pairing.js'
import { ProtocolLogger } from '../logging/protocol-logger.js'

const arg = (name: string, fallback: string) =>
	process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback

const logEnabled = arg('log', 'true') !== 'false'
const authPath = arg('auth', 'auth/creds.json')
const logger = new ProtocolLogger({
	enabled: logEnabled,
	dir: arg('log-dir', 'logs'),
	label: 'pair',
})
console.log(
	logEnabled ? `Logging everything to ${logger.sessionDir}` : 'Logging disabled (--log=false)',
)

let creds: AuthCreds = loadAuthCreds(authPath) ?? initAuthCreds()
saveAuthCreds(authPath, creds)
let config: ClientConfig = DEFAULT_CONFIG
let qrTimer: NodeJS.Timeout | undefined
let keepAlive: NodeJS.Timeout | undefined
let shuttingDown = false
let receiver: Receiver | undefined

const child = (n: BinaryNode, tag: string) =>
	Array.isArray(n.content) ? n.content.find((c) => c.tag === tag) : undefined

async function resolveVersion(): Promise<ClientConfig> {
	try {
		const { body } = await loggedFetch(logger, 'https://web.whatsapp.com/sw.js')
		const rev = body.match(/\\?"client_revision\\?":\s*(\d+)/)?.[1]
		if (rev) {
			logger.event('version.resolved', { revision: rev })
			return { ...DEFAULT_CONFIG, version: [2, 3000, Number(rev)] }
		}
		logger.event('version.fallback', { reason: 'no client_revision in sw.js' })
	} catch (error) {
		logger.event('version.fallback', { reason: 'fetch failed', error })
	}
	return DEFAULT_CONFIG
}

function start(): void {
	const paired = Boolean(creds.me)
	const payload = paired ? loginPayload(creds, config) : registrationPayload(creds, config)
	logger.event('client.start', {
		mode: paired ? 'login' : 'register',
		version: config.version,
		me: creds.me,
	})
	console.log(paired ? `Logging in as ${creds.me!.id} ...` : 'Connecting for pairing ...')

	const conn: Connection = new Connection(logger, creds, payload, {
		onOpen: () => console.log('Noise handshake complete.'),
		onNode: (node) => handle(conn, node),
		onClose: ({ code, reason, error }) => {
			clearTimeout(qrTimer)
			clearInterval(keepAlive)
			receiver = undefined
			console.log(
				`Connection closed (code=${code ?? '-'}, reason=${reason})`,
				error ? String(error) : '',
			)
			if (shuttingDown) return
			if (creds.me && reason !== 'logged-out') {
				// After a successful pairing the server closes the stream and expects a login.
				logger.event('client.reconnect', { reason })
				console.log('Reconnecting with the paired identity ...')
				setTimeout(start, 1000)
			} else {
				logger.close('disconnect', { code, reason })
				process.exit(0)
			}
		},
	})
	conn.connect()
}

async function onLoggedIn(conn: Connection): Promise<void> {
	const storage = new FileSignalStorage(
		arg('signal-dir', 'auth/signal'),
		creds.signedIdentityKey,
		creds.registrationId,
	)
	await storage.storeSignedPreKey(creds.signedPreKey.keyId, creds.signedPreKey.record)
	const r = new Receiver({
		creds,
		saveCreds: () => saveAuthCreds(authPath, creds),
		storage,
		cipher: createSignalCipher(storage),
		logger,
		send: (n) => conn.send(n),
		onMessage: (m) =>
			console.log(
				`Message ${m.id} from ${m.participant ?? m.from}:`,
				JSON.stringify(m.message).slice(0, 300),
			),
	})
	receiver = r
	try {
		await r.request({
			tag: 'iq',
			attrs: { to: 's.whatsapp.net', type: 'set', xmlns: 'passive' },
			content: [{ tag: 'active', attrs: {} }],
		})
		await r.ensurePreKeys()
		console.log('Pre-keys are in place; incoming messages are decrypted, acked and logged.')
	} catch (error) {
		logger.event('login.setup-failed', error)
		console.error('Login setup failed:', error)
	}
	keepAlive = setInterval(() => {
		if (conn.state === 'open')
			conn.send({
				tag: 'iq',
				attrs: { id: r.nextId(), to: 's.whatsapp.net', type: 'get', xmlns: 'w:p' },
			})
	}, 30_000)
}

function handle(conn: Connection, node: BinaryNode): void {
	if (receiver?.handle(node)) return
	const pairDevice = node.tag === 'iq' && child(node, 'pair-device')
	if (pairDevice) {
		conn.send({
			tag: 'iq',
			attrs: { to: 's.whatsapp.net', type: 'result', id: node.attrs['id'] ?? '' },
		})
		const refs = (pairDevice.content as BinaryNode[]).filter((c) => c.tag === 'ref')
		let ms = 60_000
		const next = () => {
			const ref = refs.shift()
			if (!ref) {
				logger.event('qr.exhausted')
				console.log('QR codes exhausted; restart to get new ones.')
				conn.close('qr-timeout')
				return
			}
			const qr = qrString(Buffer.from(ref.content as Uint8Array).toString('utf8'), creds)
			logger.event('qr.generated', { qr })
			console.log('\nScan with WhatsApp > Linked devices > Link a device:\n')
			qrcode.generate(qr, { small: true })
			qrTimer = setTimeout(next, ms)
			ms = 20_000
		}
		next()
		return
	}
	if (node.tag === 'iq' && child(node, 'pair-success')) {
		clearTimeout(qrTimer)
		try {
			const { reply, update } = handlePairSuccess(node, creds)
			creds = { ...creds, ...update }
			saveAuthCreds(authPath, creds)
			logger.event('pair.success', { me: creds.me, platform: creds.platform })
			console.log(`Paired as ${creds.me?.id}`)
			conn.send(reply)
		} catch (error) {
			logger.event('pair.error', error)
			console.error('Pairing verification failed:', error)
			conn.close('pair-verification-failed')
		}
		return
	}
	if (node.tag === 'success') {
		console.log('Logged in. Session stays open and is logged until disconnect (Ctrl+C to stop).')
		void onLoggedIn(conn)
		return
	}
	if (
		node.tag === 'iq' &&
		node.attrs['type'] === 'get' &&
		node.attrs['xmlns'] === 'urn:xmpp:ping'
	) {
		conn.send({
			tag: 'iq',
			attrs: { to: 's.whatsapp.net', type: 'result', id: node.attrs['id'] ?? '' },
		})
		return
	}
	if (node.tag === 'stream:error' || node.tag === 'failure') {
		console.log(`Server sent <${node.tag}>`, node.attrs, '(see log for full detail)')
	}
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
	process.on(sig, () => {
		shuttingDown = true
		logger.close(`signal ${sig}`)
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

config = await resolveVersion()
start()
