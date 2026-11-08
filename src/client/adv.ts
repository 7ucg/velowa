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

const KEY_INDEX_SIG_PREFIX = Buffer.from([6, 2])

export interface DecodedKeyIndex {
	currentIndex: number
	validIndexes: number[]
}

/**
 * Decode and verify a usync response's `<key-index-list>` (`ADVSignedKeyIndexList`, WA Web
 * `WAWebAdvKeyIndexSignatureVerify`): signed by the account's primary identity over `[6, 2] + details`.
 * The server attaches a bare `key-index` attribute to every non-primary device in a device list, but
 * that attribute alone proves nothing - this signed list is what actually says which indexes the account
 * currently considers valid (see `isKeyIndexValid`), so a device with a `key-index` the account never
 * signed (e.g. a relay replaying a revoked device's old record) gets filtered out instead of trusted.
 * Returns `undefined` on a malformed blob or a signature that does not verify against `accountIdentity`.
 */
export function verifyKeyIndexList(
	signedBytes: Uint8Array,
	accountIdentity: Uint8Array,
): DecodedKeyIndex | undefined {
	let signed: { details?: Buffer; accountSignature?: Buffer }
	try {
		const t = T('ADVSignedKeyIndexList')
		signed = t.toObject(t.decode(signedBytes), { bytes: Buffer, defaults: true })
	} catch {
		return undefined
	}
	if (!signed.details || !signed.accountSignature) return undefined
	const msg = Buffer.concat([KEY_INDEX_SIG_PREFIX, signed.details])
	if (!xeddsaVerify(accountIdentity, msg, signed.accountSignature)) return undefined
	try {
		const t = T('ADVKeyIndexList')
		const decoded = t.toObject(t.decode(signed.details), { defaults: true }) as {
			currentIndex?: number
			validIndexes?: number[]
		}
		return { currentIndex: decoded.currentIndex ?? 0, validIndexes: decoded.validIndexes ?? [] }
	} catch {
		return undefined
	}
}

/**
 * Whether a device's `key-index` is accepted by a verified `<key-index-list>`: either it is one of the
 * indexes the account's signed list names as currently valid, or it is newer than that list's own
 * `currentIndex` (a device the account added after the list was signed - provisionally trusted until a
 * fresher list arrives, matching WA Web's own `AdvDeviceNotificationApi` rule). The primary device (id 0)
 * is never subject to this check; callers must keep it unconditionally.
 */
export const isKeyIndexValid = (keyIndex: number | undefined, decoded: DecodedKeyIndex): boolean =>
	keyIndex !== undefined &&
	(decoded.validIndexes.includes(keyIndex) || keyIndex > decoded.currentIndex)
