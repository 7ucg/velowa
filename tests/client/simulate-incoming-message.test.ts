// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Client } from '../../src/client/client.js'
import type { DecodedMessage } from '../../src/client/receiver.js'
import { serialize } from '../../src/bot/message.js'

let dir: string
afterEach(() => {
	if (dir) rmSync(dir, { recursive: true, force: true })
})

function client(): Client {
	dir = mkdtempSync(join(tmpdir(), 'velowa-simulate-'))
	return new Client({ authDir: dir })
}

describe('simulateIncomingMessage', () => {
	it("emits a plain-text message on the client's own `message` event - no network involved", () => {
		const c = client()
		const seen: DecodedMessage[] = []
		c.on('message', (m) => seen.push(m))
		const returned = c.simulateIncomingMessage('alice@s.whatsapp.net', 'hi there')
		expect(seen).toEqual([returned])
		expect(returned).toMatchObject({
			from: 'alice@s.whatsapp.net',
			message: { conversation: 'hi there' },
		})
		expect(returned.id).toMatch(/^3EB0[0-9A-F]{18}$/)
		expect(returned.timestamp).toBeTypeOf('number')
	})

	it('accepts a full message-content object instead of plain text', () => {
		const c = client()
		const returned = c.simulateIncomingMessage('alice@s.whatsapp.net', {
			extendedTextMessage: { text: 'hi' },
		})
		expect(returned.message).toEqual({ extendedTextMessage: { text: 'hi' } })
	})

	it('refuses a group jid, same restriction the ported mod feature enforces', () => {
		const c = client()
		expect(() => c.simulateIncomingMessage('120363000000000001@g.us', 'hi')).toThrow(
			/not for groups/,
		)
	})

	it('reads back as fromMe: false through serialize() - the entire trick needs nothing more', () => {
		const c = client()
		const raw = c.simulateIncomingMessage('alice@s.whatsapp.net', 'pretend this is from alice')
		const m = serialize(c, raw)
		expect(m.fromMe).toBe(false)
		expect(m.chat).toBe('alice@s.whatsapp.net')
		expect(m.text).toBe('pretend this is from alice')
	})
})
