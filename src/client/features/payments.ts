import type { MessageKey } from './messages.js'
import type { MexFn } from './mex.js'

// ---- payment request messages -----------------------------------------------------------------

export interface PaymentRequestInput {
	/** Amount in thousandths of the currency unit (12.50 EUR = 12500). Positive whole number. */
	amount1000: number
	/** ISO 4217 code, e.g. `EUR`. */
	currency: string
	/** Who is asked to pay (JID). Defaults to the chat. */
	from?: string
	/** Text shown with the request. */
	note?: string
	/** Unix seconds after which the request expires. */
	expiry?: number
}

const noteOf = (text: string | undefined): Record<string, unknown> => ({
	extendedTextMessage: { text: text ?? '' },
})

const wireKey = (key: MessageKey) => ({
	remoteJid: key.remoteJid,
	fromMe: key.fromMe ?? false,
	id: key.id,
	...(key.participant && { participant: key.participant }),
})

/** Ask the other side to pay. */
export function requestPayment(chat: string, p: PaymentRequestInput): Record<string, unknown> {
	if (!Number.isInteger(p.amount1000) || p.amount1000 <= 0)
		throw new Error('amount1000 must be a positive whole number')
	if (!/^[A-Za-z]{3}$/.test(p.currency)) throw new Error('currency must be an ISO 4217 code')
	return {
		requestPaymentMessage: {
			amount1000: p.amount1000,
			currencyCodeIso4217: p.currency.toUpperCase(),
			requestFrom: p.from ?? chat,
			noteMessage: noteOf(p.note),
			...(p.expiry !== undefined && { expiryTimestamp: p.expiry }),
		},
	}
}

/** Answer a payment request with a payment note (the money itself moves in the payments app). */
export function sendPayment(
	request: MessageKey,
	o: { note?: string; transactionData?: string } = {},
): Record<string, unknown> {
	return {
		sendPaymentMessage: {
			requestMessageKey: wireKey(request),
			noteMessage: noteOf(o.note),
			...(o.transactionData && { transactionData: o.transactionData }),
		},
	}
}

export const declinePaymentRequest = (request: MessageKey): Record<string, unknown> => ({
	declinePaymentRequestMessage: { key: wireKey(request) },
})

export const cancelPaymentRequest = (request: MessageKey): Record<string, unknown> => ({
	cancelPaymentRequestMessage: { key: wireKey(request) },
})

// ---- payments account (w:mex) -----------------------------------------------------------------

// Query ids from the WhatsApp Web build the reference was verified against; a stale id shows up as a MexError.
export const PAYMENTS_QUERY = {
	PASSKEY_HAS_CREDENTIAL: '36878915648418618',
	PASSKEY_ENROLL_CHALLENGE: '25233109079721001',
	PASSKEY_ENROLL_VERIFY: '26563835863283058',
	PASSKEY_REGISTER_FINISH: '26658791263822236',
	PASSKEY_AUTH_CHALLENGE: '26425370627105628',
	PASSKEY_TOGGLE_ON: '25841989828834577',
	PASSKEY_TOGGLE_OFF: '26267673096201391',
	PASSKEY_TOGGLE_CHALLENGE: '26133062322993192',
	PASSKEY_TOGGLE_CLEANUP: '26492078607084840',
	PASSKEY_CLEANUP: '26538338805859092',
	IS_RECOVERABLE: '27351347491148282',
	UPI_SEND_OTP: '25829794080022469',
	UPI_VERIFY_OTP: '34104109149204669',
} as const

/** Payments account settings: passkey protection, account recovery check, UPI onboarding (India). */
export class Payments {
	constructor(private readonly mex: MexFn) {}

	hasPasskey = () =>
		this.mex(PAYMENTS_QUERY.PASSKEY_HAS_CREDENTIAL, {}, 'xwa2_payments_passkey_has_credential')
	enrollChallenge = () =>
		this.mex(PAYMENTS_QUERY.PASSKEY_ENROLL_CHALLENGE, {}, 'xwa2_payments_passkey_enroll_challenge')
	enrollVerify = (credentialId: string, attestationObject: string, clientDataJson: string) =>
		this.mex(
			PAYMENTS_QUERY.PASSKEY_ENROLL_VERIFY,
			{
				credential_id: credentialId,
				attestation_object: attestationObject,
				client_data_json: clientDataJson,
			},
			'xwa2_payments_passkey_enroll_verify',
		)
	registerFinish = (credentialId: string, attestationObject: string, clientDataJson: string) =>
		this.mex(
			PAYMENTS_QUERY.PASSKEY_REGISTER_FINISH,
			{
				credential_id: credentialId,
				attestation_object: attestationObject,
				client_data_json: clientDataJson,
			},
			'xwa2_payments_passkey_register_finish',
		)
	authChallenge = (credentialId: string) =>
		this.mex(
			PAYMENTS_QUERY.PASSKEY_AUTH_CHALLENGE,
			{ credential_id: credentialId },
			'xwa2_payments_passkey_auth_challenge',
		)
	toggleOn = () => this.mex(PAYMENTS_QUERY.PASSKEY_TOGGLE_ON, {}, 'xwa2_payments_passkey_toggle_on')
	toggleOff = () =>
		this.mex(PAYMENTS_QUERY.PASSKEY_TOGGLE_OFF, {}, 'xwa2_payments_passkey_toggle_off')
	toggleChallenge = (credentialId: string) =>
		this.mex(
			PAYMENTS_QUERY.PASSKEY_TOGGLE_CHALLENGE,
			{ credential_id: credentialId },
			'xwa2_payments_passkey_toggle_challenge',
		)
	toggleCleanup = () =>
		this.mex(PAYMENTS_QUERY.PASSKEY_TOGGLE_CLEANUP, {}, 'xwa2_payments_passkey_toggle_cleanup')
	cleanup = () => this.mex(PAYMENTS_QUERY.PASSKEY_CLEANUP, {}, 'xwa2_payments_passkey_cleanup')
	isRecoverable = () =>
		this.mex(PAYMENTS_QUERY.IS_RECOVERABLE, {}, 'xwa2_payments_is_account_recoverable')
	upiSendOtp = (phoneNumber: string) =>
		this.mex(PAYMENTS_QUERY.UPI_SEND_OTP, { phone_number: phoneNumber }, 'xwa2_upi_send_otp')
	upiVerifyOtp = (phoneNumber: string, otp: string) =>
		this.mex(
			PAYMENTS_QUERY.UPI_VERIFY_OTP,
			{ phone_number: phoneNumber, otp },
			'xwa2_upi_verify_otp',
		)
}
