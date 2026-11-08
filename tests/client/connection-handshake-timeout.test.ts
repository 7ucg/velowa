// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { WebSocketServer } from 'ws'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { initAuthCreds } from '../../src/auth/creds.js'
import { ProtocolLogger } from '../../src/logging/protocol-logger.js'
import { Connection } from '../../src/client/connection.js'

let wss: WebSocketServer | undefined
afterEach(async () => {
	await new Promise<void>((r) => (wss ? wss.close(() => r()) : r()))
	wss = undefined
})

describe('Connection: Noise handshake timeout', () => {
	it('closes the connection if ServerHello never arrives, instead of hanging forever', async () => {
		// A real local WS server that completes the WebSocket upgrade but never answers with anything -
		// the scenario the ws constructor's own handshakeTimeout does NOT cover (that one only guards the
		// upgrade itself, already complete once "open" fires). The timeout itself is injected short so the
		// test doesn't need to wait out the real 20s default.
		wss = new WebSocketServer({ port: 0 })
		wss.on('connection', () => {})
		const { port } = wss.address() as { port: number }

		const onClose = vi.fn()
		const conn = new Connection(
			new ProtocolLogger({ enabled: false }),
			initAuthCreds(),
			new Uint8Array(),
			{ onNode() {}, onOpen() {}, onClose },
			`ws://localhost:${port}`,
			undefined,
			50,
		)
		conn.connect()
		await vi.waitFor(() => expect(conn.state).toBe('closed'), { timeout: 2000, interval: 10 })

		expect(onClose).toHaveBeenCalledWith(expect.objectContaining({ reason: 'handshake-timeout' }))
	})

	it('never fires once the handshake completes in time (sanity: the timer is cleared)', async () => {
		wss = new WebSocketServer({ port: 0 })
		const { port } = wss.address() as { port: number }
		const onClose = vi.fn()
		const conn = new Connection(
			new ProtocolLogger({ enabled: false }),
			initAuthCreds(),
			new Uint8Array(),
			{ onNode() {}, onOpen() {}, onClose },
			`ws://localhost:${port}`,
			undefined,
			50,
		)
		// The server never completes a real Noise handshake either, but closing the socket cleanly before
		// the short timeout fires is enough to prove the timer doesn't also fire afterwards.
		wss.on('connection', (ws) => ws.close())
		conn.connect()
		await vi.waitFor(() => expect(conn.state).toBe('closed'), { timeout: 2000, interval: 10 })
		await new Promise((r) => setTimeout(r, 100))
		expect(onClose).toHaveBeenCalledTimes(1)
		expect(onClose).not.toHaveBeenCalledWith(
			expect.objectContaining({ reason: 'handshake-timeout' }),
		)
	})
})
