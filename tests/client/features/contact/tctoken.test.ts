import { createHmac } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { BinaryNode } from '../../../../src/codec/index.js'
import {
	TcTokens,
	computeCsToken,
	isRegularUser,
	isTcTokenExpired,
	shouldIssueTcToken,
} from '../../../../src/client/features/contact/tctoken.js'

const now = Math.floor(Date.now() / 1000)
const tokensNode = (jid: string, t: number, bytes = [1, 2, 3]): BinaryNode => ({
	tag: 'notification',
	attrs: {},
	content: [
		{
			tag: 'tokens',
			attrs: {},
			content: [
				{
					tag: 'token',
					attrs: { jid, t: String(t), type: 'trusted_contact' },
					content: new Uint8Array(bytes),
				},
			],
		},
	],
})

describe('tctoken', () => {
	it('expires after about four weeks', () => {
		expect(isTcTokenExpired(now)).toBe(false)
		expect(isTcTokenExpired(now - 20 * 86400)).toBe(false)
		expect(isTcTokenExpired(now - 40 * 86400)).toBe(true)
		expect(isTcTokenExpired(undefined)).toBe(true)
	})

	it('issues ours once per 7 day bucket', () => {
		expect(shouldIssueTcToken(undefined)).toBe(true)
		expect(shouldIssueTcToken(now)).toBe(false)
		expect(shouldIssueTcToken(now - 8 * 86400)).toBe(true)
	})

	it('knows regular users from bots and the PSA account', () => {
		expect(isRegularUser('491511@s.whatsapp.net')).toBe(true)
		expect(isRegularUser('123@lid')).toBe(true)
		expect(isRegularUser('0@s.whatsapp.net')).toBe(false)
		expect(isRegularUser('13135550001@s.whatsapp.net')).toBe(false)
		expect(isRegularUser('123-456@g.us')).toBe(false)
	})

	it('stores a token, hands it out and ignores older and invalid ones', () => {
		const t = new TcTokens()
		expect(t.storeFrom(tokensNode('9@lid', now), '9@lid')).toBe(1)
		expect([...t.tokenFor('9:3@lid')!]).toEqual([1, 2, 3])
		expect(t.storeFrom(tokensNode('9@lid', now - 1000, [9]), '9@lid')).toBe(0)
		expect([...t.tokenFor('9@lid')!]).toEqual([1, 2, 3])
		expect(t.storeFrom(tokensNode('0@s.whatsapp.net', now), '0@s.whatsapp.net')).toBe(0)
		expect(t.storeFrom(tokensNode('8@lid', 0), '8@lid')).toBe(0)
	})

	it('drops an expired token when it is asked for', () => {
		const t = new TcTokens()
		t.storeFrom(tokensNode('9@lid', now - 40 * 86400), '9@lid')
		expect(t.tokenFor('9@lid')).toBeUndefined()
	})

	it('keeps tokens on disk', () => {
		const dir = mkdtempSync(join(tmpdir(), 'tc-'))
		try {
			const path = join(dir, 'tc.json')
			new TcTokens(path).storeFrom(tokensNode('9@lid', now), '9@lid')
			expect([...new TcTokens(path).tokenFor('9@lid')!]).toEqual([1, 2, 3])
		} finally {
			rmSync(dir, { recursive: true, force: true })
		}
	})

	it('computes cstoken as an HMAC-SHA256 of the recipient LID, keyed by the history-synced salt', () => {
		const salt = new Uint8Array(32).fill(7)
		const token = computeCsToken(salt, '99@lid')
		expect(token).toHaveLength(32)
		expect(Buffer.from(token)).toEqual(createHmac('sha256', salt).update('99@lid').digest())
		expect(computeCsToken(salt, '98@lid')).not.toEqual(token) // bound to the exact recipient
	})

	it('issues our token once and remembers the time', async () => {
		const t = new TcTokens()
		const sent: BinaryNode[] = []
		const request = async (n: BinaryNode) => (sent.push(n), { tag: 'iq', attrs: {} })
		t.issueTo('7@lid', request)
		t.issueTo('7@lid', request)
		await new Promise((r) => setTimeout(r, 10))
		t.issueTo('7@lid', request)
		expect(sent).toHaveLength(1)
		expect(sent[0]!.attrs).toMatchObject({ xmlns: 'privacy', type: 'set' })
		t.issueTo('0@s.whatsapp.net', request)
		expect(sent).toHaveLength(1)
	})
})
