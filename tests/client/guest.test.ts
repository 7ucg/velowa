import { describe, expect, it } from 'vitest'
import { initAuthCreds } from '../../src/auth/creds.js'
import { DEFAULT_CONFIG } from '../../src/client/pairing.js'
import { guestReg } from '../../src/client/guest.js'

describe('guestReg', () => {
	it('hits v2/guest_reg with the identity bundle and guest params, wire-shaped like the captured request', async () => {
		const creds = initAuthCreds()
		let seenUrl: string | undefined
		let seenHeaders: Record<string, string> | undefined
		const fetch = (async (url: string, init?: RequestInit) => {
			seenUrl = url
			seenHeaders = init?.headers as Record<string, string>
			return { status: 200, text: async () => 'ok' } as Response
		}) as typeof globalThis.fetch

		const result = await guestReg(creds, DEFAULT_CONFIG, {
			inviteCode: 'dMxUichroH94h6O55j7BpS',
			guestName: 'Baron Test',
			fetch,
		})

		expect(result).toEqual({ status: 200, body: 'ok' })
		expect(seenUrl!.startsWith('https://v.whatsapp.net/v2/guest_reg?')).toBe(true)
		expect(seenHeaders!['user-agent']).toMatch(/Chrome/)

		const params = new URL(seenUrl!).searchParams
		expect(params.get('guest_type')).toBe('guest_calling')
		expect(params.get('invite_code')).toBe('dMxUichroH94h6O55j7BpS')
		expect(params.get('guest_name')).toBe('Baron Test')
		expect(seenUrl).toContain('guest_name=Baron%20Test') // %20, not the form-encoded "+"
		expect(params.get('e_keytype')).toBe('BQ==')
		expect(params.get('authkey')).toBe(
			Buffer.from(creds.noiseKey.publicKey).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
		)
		expect(params.get('e_ident')).toBe(
			Buffer.from(creds.signedIdentityKey.publicKey)
				.toString('base64')
				.replace(/\+/g, '-')
				.replace(/\//g, '_'),
		)
		const stdBase64 = (s: string) => s.replace(/-/g, '+').replace(/_/g, '/')
		expect(Buffer.from(stdBase64(params.get('e_regid')!), 'base64').readUInt32BE(0)).toBe(
			creds.registrationId,
		)
		expect(params.get('web_build_version')).toBe(
			`2.${DEFAULT_CONFIG.version[1]}.${DEFAULT_CONFIG.version[2]}`,
		)

		// id/backup_token are 20 raw bytes, percent-encoded byte-for-byte (not base64) — and identical.
		// decodeURIComponent would mis-decode arbitrary bytes as UTF-8 (and often throw); undo the
		// single-byte percent-encoding directly instead.
		const percentDecodeBytes = (s: string): Buffer => {
			const bytes: number[] = []
			for (let i = 0; i < s.length; i++) {
				if (s[i] === '%') {
					bytes.push(parseInt(s.slice(i + 1, i + 3), 16))
					i += 2
				} else bytes.push(s.charCodeAt(i))
			}
			return Buffer.from(bytes)
		}
		const rawMatch = seenUrl!.match(/[?&]id=([^&]+)/)
		expect(rawMatch).toBeTruthy()
		expect(percentDecodeBytes(rawMatch![1]!).length).toBe(20)
		expect(seenUrl).toContain(`backup_token=${rawMatch![1]}`)
	})

	it('propagates a non-200 status with the body', async () => {
		const creds = initAuthCreds()
		const fetch = (async () => ({ status: 403, text: async () => 'blocked' })) as typeof globalThis.fetch
		const result = await guestReg(creds, DEFAULT_CONFIG, {
			inviteCode: 'tok',
			guestName: 'x',
			fetch,
		})
		expect(result).toEqual({ status: 403, body: 'blocked' })
	})
})
