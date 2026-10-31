import { describe, expect, it } from 'vitest'
import { initAuthCreds } from '../auth/creds.js'
import { ProtocolLogger } from '../logging/protocol-logger.js'
import { Connection } from './connection.js'

describe('Connection', () => {
	it('can be constructed before anything else has loaded the wasm module', () => {
		// Regression: FrameDecoder was created in a field initializer ahead of ensureWasm().
		const conn = new Connection(
			new ProtocolLogger({ enabled: false }),
			initAuthCreds(),
			new Uint8Array(),
			{
				onNode() {},
				onOpen() {},
				onClose() {},
			},
		)
		expect(conn.state).toBe('idle')
	})
})
