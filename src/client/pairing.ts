// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { AuthCreds } from '../auth/creds.js'
import type { BinaryNode } from '../codec/index.js'
import { xeddsaSign, xeddsaVerify } from '../crypto/signal.js'

import { historySyncFlags } from './device-profile.js'
import type {
	HistorySyncFlag,
	PlatformType,
	ReleaseChannel,
	UserAgentPlatform,
	WebSubPlatform,
} from './device-profile.js'
import { encodeProto as encode, protoRoot as proto, protoType as T } from './proto.js'

export interface ClientConfig {
	/** WhatsApp Web client revision, e.g. [2, 3000, 1050701434]. */
	version: [number, number, number]
	/** [os, device-type] shown under "Linked devices". */
	browser: [string, string]
	countryCode: string
	/** `DeviceProps.PlatformType` shown under "Linked devices" (default `DESKTOP`); read when pairing. See `PLATFORM_TYPES`. */
	platformType?: PlatformType
	/** Release track sent when connecting (default `RELEASE`); `BETA`, `ALPHA` and `DEBUG` are the other tracks. */
	releaseChannel?: ReleaseChannel
	/** App family sent when connecting (default `WEB`). See `USER_AGENT_PLATFORMS`. */
	platform?: UserAgentPlatform
	/** Web sub-platform, only sent while `platform` is `WEB` (default `WEB_BROWSER`). */
	webSubPlatform?: WebSubPlatform
	/**
	 * Which history-sync features this device announces when pairing (`HISTORY_SYNC_FLAGS`): `'all'` sets every flag, an object
	 * changes single flags on top of the defaults. Read when pairing; untested beyond the defaults.
	 */
	historySync?: 'all' | Partial<Record<HistorySyncFlag, boolean>>
}

export const DEFAULT_CONFIG: ClientConfig = {
	version: [2, 3000, 1050701434],
	browser: ['Windows', 'Desktop'],
	countryCode: 'US',
}

const be = (n: number, len: number) => {
	const b = Buffer.alloc(len)
	b.writeUIntBE(n, 0, len)
	return b
}

function basePayload(config: ClientConfig) {
	return {
		connectType: 'WIFI_UNKNOWN',
		connectReason: 'USER_ACTIVATED',
		userAgent: {
			appVersion: {
				primary: config.version[0],
				secondary: config.version[1],
				tertiary: config.version[2],
			},
			platform: config.platform ?? 'WEB',
			releaseChannel: config.releaseChannel ?? 'RELEASE',
			osVersion: '0.1',
			device: 'Desktop',
			osBuildNumber: '0.1',
			localeLanguageIso6391: 'en',
			mnc: '000',
			mcc: '000',
			localeCountryIso31661Alpha2: config.countryCode,
		},
		...((config.platform ?? 'WEB') === 'WEB' && {
			webInfo: { webSubPlatform: config.webSubPlatform ?? 'WEB_BROWSER' },
		}),
	}
}

/** ClientPayload for a device that has not been paired yet (shows the QR flow). */
export function registrationPayload(creds: AuthCreds, config: ClientConfig): Uint8Array {
	const deviceProps = encode('DeviceProps', {
		os: config.browser[0],
		platformType: config.platformType ?? 'DESKTOP',
		requireFullSync: false,
		historySyncConfig: {
			fullSyncDaysLimit: 30,
			storageQuotaMb: 10240,
			...historySyncFlags(config.historySync),
		},

		version: { primary: 10, secondary: 15, tertiary: 7 },
	})
	return encode('ClientPayload', {
		...basePayload(config),
		passive: false,
		pull: false,
		devicePairingData: {
			buildHash: createHash('md5').update(config.version.join('.')).digest(),
			deviceProps,
			eRegid: be(creds.registrationId, 4),
			eKeytype: Buffer.from([5]),
			eIdent: creds.signedIdentityKey.publicKey,
			eSkeyId: be(creds.signedPreKey.keyId, 3),
			eSkeyVal: creds.signedPreKey.publicKey,
			eSkeySig: creds.signedPreKey.signature,
		},
	})
}

/**
 * ClientPayload for a call-link guest: an ephemeral identity already registered with the server
 * via `guestReg()` (see `guest.ts`), not paired to any phone. No `devicePairingData` (the identity
 * bundle went out over HTTP already) — just the `accountType`/`product` pair a real browser guest
 * session sends, confirmed from its own bundle source (see WA_CALL_LINKS.md §15 in whatsapp-docs).
 *
 * `lid` is the numeric id `guestReg()`'s response returned (its `lid` field, without `@lid`) — set
 * as `username` the same way `loginPayload` sets it from `creds.me.id`. This is NOT source-confirmed
 * like the rest of this payload: the dumped builder literal only showed `product`/`accountType`, not
 * a complete object, and a guest connection without `username` set got its WebSocket silently closed
 * (code 1006) right after the handshake in live testing — setting it from `guestReg()`'s own response
 * is the fix that was tried, not something read out of the client's source.
 */
export function guestPayload(creds: AuthCreds, config: ClientConfig, lid?: string): Uint8Array {
	void creds // the identity is proven by the Noise static key, not by anything in this payload
	const username = lid?.split('@')[0]
	return encode('ClientPayload', {
		...basePayload(config),
		passive: false,
		pull: false,
		product: 'WHATSAPP_LID',
		accountType: 'GUEST',
		...(username && { username: Number(username) }),
	})
}

/** ClientPayload for an already-paired device (`me.id` like "4915…:12@s.whatsapp.net"). */
export function loginPayload(creds: AuthCreds, config: ClientConfig): Uint8Array {
	if (!creds.me) throw new Error('loginPayload needs a paired device')
	const [userAndDevice] = creds.me.id.split('@')
	const [user, device] = userAndDevice!.split(':')
	return encode('ClientPayload', {
		...basePayload(config),
		passive: true,
		pull: true,
		username: Number(user),
		device: Number(device ?? 0),
		lidDbMigrated: false,
	})
}

/** The string the phone scans: `ref,noiseKey,identityKey,advSecret` (all base64). */
export function qrString(ref: string, creds: AuthCreds): string {
	return [
		ref,
		Buffer.from(creds.noiseKey.publicKey).toString('base64'),
		Buffer.from(creds.signedIdentityKey.publicKey).toString('base64'),
		creds.advSecretKey,
	].join(',')
}

const ACCOUNT_SIG_PREFIX = Buffer.from([6, 0])
const DEVICE_SIG_PREFIX = Buffer.from([6, 1])
const HOSTED_ACCOUNT_SIG_PREFIX = Buffer.from([6, 5])

const child = (n: BinaryNode, tag: string): BinaryNode | undefined =>
	Array.isArray(n.content) ? n.content.find((c) => c.tag === tag) : undefined

/**
 * Verify the `pair-success` stanza and build the reply + updated creds. Throws if the HMAC or the
 * account signature does not verify; the caller must then drop the connection.
 */
export function handlePairSuccess(
	stanza: BinaryNode,
	creds: AuthCreds,
): { reply: BinaryNode; update: Pick<AuthCreds, 'me' | 'account' | 'platform'> } {
	const success = child(stanza, 'pair-success')
	const identityNode = success && child(success, 'device-identity')
	const deviceNode = success && child(success, 'device')
	if (!success || !identityNode || !deviceNode || !(identityNode.content instanceof Uint8Array)) {
		throw new Error('pair-success is missing device-identity or device')
	}
	const hmacType = T('ADVSignedDeviceIdentityHMAC')
	const hm = hmacType.toObject(hmacType.decode(identityNode.content), {
		bytes: Buffer,
		enums: Number,
		defaults: true,
	}) as {
		details: Buffer
		hmac: Buffer
		accountType: number
	}
	const hostedType = proto().lookupEnum('proto.ADVEncryptionType').values['HOSTED']
	const prefix = hm.accountType === hostedType ? HOSTED_ACCOUNT_SIG_PREFIX : Buffer.alloc(0)
	const expected = createHmac('sha256', Buffer.from(creds.advSecretKey, 'base64'))
		.update(Buffer.concat([prefix, hm.details]))
		.digest()
	if (expected.length !== hm.hmac.length || !timingSafeEqual(expected, hm.hmac)) {
		throw new Error('Invalid account signature (HMAC)')
	}

	const accType = T('ADVSignedDeviceIdentity')
	const account = accType.toObject(accType.decode(hm.details), {
		bytes: Buffer,
		defaults: true,
	}) as {
		details: Buffer
		accountSignatureKey: Buffer
		accountSignature: Buffer
		deviceSignature?: Buffer
	}
	const idType = T('ADVDeviceIdentity')
	const deviceIdentity = idType.toObject(idType.decode(account.details), {
		enums: Number,
		defaults: true,
	}) as {
		keyIndex: number
		deviceType: number
	}
	const accountPrefix =
		deviceIdentity.deviceType === hostedType ? HOSTED_ACCOUNT_SIG_PREFIX : ACCOUNT_SIG_PREFIX
	const accountMsg = Buffer.concat([
		accountPrefix,
		account.details,
		creds.signedIdentityKey.publicKey,
	])
	if (!xeddsaVerify(account.accountSignatureKey, accountMsg, account.accountSignature)) {
		throw new Error('Failed to verify account signature')
	}
	const deviceMsg = Buffer.concat([
		DEVICE_SIG_PREFIX,
		account.details,
		creds.signedIdentityKey.publicKey,
		account.accountSignatureKey,
	])
	account.deviceSignature = Buffer.from(xeddsaSign(creds.signedIdentityKey.privateKey, deviceMsg))
	// The pair reply omits the account signature key; retry receipts include it (full account).
	const fullAccount = encode('ADVSignedDeviceIdentity', {
		details: account.details,
		accountSignatureKey: account.accountSignatureKey,
		accountSignature: account.accountSignature,
		deviceSignature: account.deviceSignature,
	})
	const encoded = encode('ADVSignedDeviceIdentity', {
		details: account.details,
		accountSignature: account.accountSignature,
		deviceSignature: account.deviceSignature,
	})

	const reply: BinaryNode = {
		tag: 'iq',
		attrs: { to: 's.whatsapp.net', type: 'result', id: stanza.attrs['id'] ?? '' },
		content: [
			{
				tag: 'pair-device-sign',
				attrs: {},
				content: [
					{
						tag: 'device-identity',
						attrs: { 'key-index': String(deviceIdentity.keyIndex) },
						content: encoded,
					},
				],
			},
		],
	}
	const bizNode = child(success, 'biz')
	const platformNode = child(success, 'platform')
	const me: NonNullable<AuthCreds['me']> = { id: deviceNode.attrs['jid'] ?? '' }
	if (deviceNode.attrs['lid']) me.lid = deviceNode.attrs['lid']
	if (bizNode?.attrs['name']) me.name = bizNode.attrs['name']
	const update: Pick<AuthCreds, 'me' | 'account' | 'platform'> = { me, account: fullAccount }
	if (platformNode?.attrs['name']) update.platform = platformNode.attrs['name']
	return { reply, update }
}
