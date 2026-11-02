import { describe, expect, it } from 'vitest'
import {
	cancelPaymentRequest,
	declinePaymentRequest,
	Payments,
	PAYMENTS_QUERY,
	requestPayment,
	sendPayment,
} from '../../../../src/client/features/payment/payments.js'

describe('payment messages', () => {
	it('builds a request and validates amount and currency', () => {
		expect(
			requestPayment('a@s.whatsapp.net', {
				amount1000: 12500,
				currency: 'eur',
				note: 'Pizza',
				expiry: 99,
			}),
		).toEqual({
			requestPaymentMessage: {
				amount1000: 12500,
				currencyCodeIso4217: 'EUR',
				requestFrom: 'a@s.whatsapp.net',
				noteMessage: { extendedTextMessage: { text: 'Pizza' } },
				expiryTimestamp: 99,
			},
		})
		expect(() => requestPayment('a', { amount1000: 0, currency: 'EUR' })).toThrow()
		expect(() => requestPayment('a', { amount1000: 1.5, currency: 'EUR' })).toThrow()
		expect(() => requestPayment('a', { amount1000: 5, currency: 'EURO' })).toThrow()
	})

	it('answers, declines and cancels by the request key', () => {
		const key = { remoteJid: 'a@s.whatsapp.net', id: 'R1', fromMe: false }
		expect(sendPayment(key, { note: 'paid' })).toMatchObject({
			sendPaymentMessage: { requestMessageKey: { id: 'R1', fromMe: false } },
		})
		expect(declinePaymentRequest(key)).toEqual({
			declinePaymentRequestMessage: {
				key: { remoteJid: 'a@s.whatsapp.net', fromMe: false, id: 'R1' },
			},
		})
		expect(cancelPaymentRequest(key)).toHaveProperty('cancelPaymentRequestMessage.key.id', 'R1')
	})

	it('calls the passkey mutations', async () => {
		const calls: unknown[][] = []
		const p = new Payments((async (...a: unknown[]) => (calls.push(a), {})) as never)
		await p.authChallenge('cred')
		await p.isRecoverable()
		expect(calls).toEqual([
			[
				PAYMENTS_QUERY.PASSKEY_AUTH_CHALLENGE,
				{ credential_id: 'cred' },
				'xwa2_payments_passkey_auth_challenge',
			],
			[PAYMENTS_QUERY.IS_RECOVERABLE, {}, 'xwa2_payments_is_account_recoverable'],
		])
	})
})
