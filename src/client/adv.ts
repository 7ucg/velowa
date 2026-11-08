// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { xeddsaVerify } from '../crypto/signal.js'
import { protoRoot as proto, protoType as T } from './proto.js'

const ACCOUNT_SIG_PREFIX = Buffer.from([6, 0])
const DEVICE_SIG_PREFIX = Buffer.from([6, 1])
const HOSTED_ACCOUNT_SIG_PREFIX = Buffer.from([6, 5])

export type AdvValidation = 'valid' | 'invalid' | 'no-account-key'

/**
 * Verify a fetched device's `ADVSignedDeviceIdentity` binds `fetchedIdentityKey` to the account's ADV
 * chain (WA Web `validateADVwithIdentityKey`): the account key signs `details + fetchedIdentityKey`,
 * and the device itself signs `details + fetchedIdentityKey + accountKey` right back, so neither
 * signature can be forged without the account's or the device's private key.
 *
 * The server omits `accountSignatureKey` from a non-primary device's blob (the client is expected to
 * already trust the account's primary identity): pass it as `accountKeyFallback` when known, e.g. the
 * primary device's own already-verified identity key fetched in the same batch. Returns `'no-account-key'`
 * (not `'invalid'`) when neither the blob nor the fallback supplies one — a legitimate device without a
 * reachable trust anchor yet must not be rejected outright, only left unverified.
 */
export function validateAdvDeviceIdentity(
	deviceIdentityBytes: Uint8Array,
	fetchedIdentityKey: Uint8Array,
	accountKeyFallback?: Uint8Array,
): AdvValidation {
	let account: {
		details?: Buffer
		accountSignatureKey?: Buffer
		accountSignature?: Buffer
		deviceSignature?: Buffer
	}
	try {
		const accType = T('ADVSignedDeviceIdentity')
		account = accType.toObject(accType.decode(deviceIdentityBytes), {
			bytes: Buffer,
			defaults: true,
		})
	} catch {
		return 'invalid'
	}
	if (!account.details || !account.accountSignature || !account.deviceSignature) return 'invalid'
	let deviceType: number | undefined
	try {
		const idType = T('ADVDeviceIdentity')
		const identity = idType.toObject(idType.decode(account.details), {
			enums: Number,
			defaults: true,
		}) as {
			deviceType?: number
		}
		deviceType = identity.deviceType
	} catch {
		return 'invalid'
	}
	const accountKey =
		account.accountSignatureKey && account.accountSignatureKey.length > 0
			? account.accountSignatureKey
			: accountKeyFallback
	if (!accountKey) return 'no-account-key'
	// A self-consistent certificate must not silently replace an already-trusted anchor.
	if (
		account.accountSignatureKey &&
		account.accountSignatureKey.length > 0 &&
		accountKeyFallback &&
		!Buffer.from(accountKey).equals(Buffer.from(accountKeyFallback))
	) {
		return 'invalid'
	}
	const hostedType = proto().lookupEnum('proto.ADVEncryptionType').values['HOSTED']
	const accountPrefix = deviceType === hostedType ? HOSTED_ACCOUNT_SIG_PREFIX : ACCOUNT_SIG_PREFIX
	const accountMsg = Buffer.concat([accountPrefix, account.details, fetchedIdentityKey])
	if (!xeddsaVerify(accountKey, accountMsg, account.accountSignature)) return 'invalid'
	const deviceMsg = Buffer.concat([
		DEVICE_SIG_PREFIX,
		account.details,
		fetchedIdentityKey,
		accountKey,
	])
	if (!xeddsaVerify(fetchedIdentityKey, deviceMsg, account.deviceSignature)) return 'invalid'
	return 'valid'
}
