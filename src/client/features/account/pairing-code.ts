// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import {
	createCipheriv,
	createDecipheriv,
	createPrivateKey,
	createPublicKey,
	diffieHellman,
	hkdfSync,
	pbkdf2,
	randomBytes,
} from 'node:crypto'
import { promisify } from 'node:util'
import type { AuthCreds } from '../../../auth/creds.js'
import type { BinaryNode } from '../../../codec/index.js'

const pbkdf2Async = promisify(pbkdf2)
const CROCKFORD = '123456789ABCDEFGHJKLMNPQRSTVWXYZ'
// PBKDF2 iteration count of the pairing-code protocol (2 << 16 = 131072); an interop constant, not a free choice.
const PBKDF2_ITERATIONS = 2 << 16

/** 8-character pairing code the user types on the phone (Crockford base32 of 5 random bytes). */
export function generatePairingCode(): string {
	let value = 0
	let bits = 0
	let out = ''
	for (const byte of randomBytes(5)) {
		value = (value << 8) | byte
		bits += 8
		while (bits >= 5) {
			out += CROCKFORD[(value >>> (bits - 5)) & 31]
			bits -= 5
		}
	}
	return out
}

const x25519Private = (raw: Uint8Array) =>
	createPrivateKey({
		key: Buffer.concat([Buffer.from('302e020100300506032b656e04220420', 'hex'), raw]),
		format: 'der',
		type: 'pkcs8',
	})
const x25519Public = (raw: Uint8Array) =>
	createPublicKey({
		key: Buffer.concat([Buffer.from('302a300506032b656e032100', 'hex'), raw]),
		format: 'der',
		type: 'spki',
	})

/** X25519 shared secret from raw 32-byte keys. */
export const sharedKey = (privateKey: Uint8Array, publicKey: Uint8Array): Buffer =>
	diffieHellman({
		privateKey: x25519Private(privateKey),
		publicKey: x25519Public(publicKey.length === 33 ? publicKey.subarray(1) : publicKey),
	})

const codeKey = (code: string, salt: Uint8Array) =>
	pbkdf2Async(Buffer.from(code), salt, PBKDF2_ITERATIONS, 32, 'sha256')

/**
 * `companion_platform_id` wire bytes and the browser name `companion_platform_display` has to show with them.
 * This is its own small id space (`'1'`-`'9'`), NOT the `DeviceProps.PlatformType` proto enum used elsewhere in
 * this file for QR pairing (there a `platformType`/`os` mismatch is tolerated; here the `companion_hello` server
 * validates it and a mismatch is the kind of thing that leaves the phone saying "couldn't link device" with no
 * error on the wire). A non-browser client (a desktop app, UWP, anything unrecognised) always shows "Chrome" as
 * its name: that's the underlying Chromium renderer WA Web's own UA parser reports for those. Cross-checked
 * against `whatsapp-rust`'s `companion_reg.rs`, which carries wire-level tests for these exact values.
 */
const COMPANION_WEB_CLIENT: Record<string, { id: string; name: string }> = {
	CHROME: { id: '1', name: 'Chrome' },
	EDGE: { id: '2', name: 'Edge' },
	FIREFOX: { id: '3', name: 'Firefox' },
	IE: { id: '4', name: 'IE' },
	OPERA: { id: '5', name: 'Opera' },
	SAFARI: { id: '6', name: 'Safari' },
	// A desktop app (Electron); the library's own default browser[1].
	DESKTOP: { id: '7', name: 'Chrome' },
	UWP: { id: '8', name: 'Chrome' },
}
/** Anything not in `COMPANION_WEB_CLIENT` above (id `'9'`, "OtherWebClient" in the reference). */
const OTHER_WEB_CLIENT = { id: '9', name: 'Chrome' }

const companionWebClient = (deviceType: string): { id: string; name: string } =>
	COMPANION_WEB_CLIENT[deviceType.toUpperCase()] ?? OTHER_WEB_CLIENT

/**
 * The `companion_hello` server only accepts a real OS name in `companion_platform_display` (unlike QR pairing,
 * which never sends this field and tolerates an arbitrary branding string there) — an unrecognised one is coerced
 * to `Linux` here, the same default the reference uses, rather than risk sending something it rejects.
 */
function canonicalOs(os: string): string {
	const o = os.trim().toLowerCase()
	const word = (w: string) => new RegExp(`(^|[^a-z0-9])${w}($|[^a-z0-9])`).test(o)
	if (!o) return 'Linux'
	if (o.includes('windows')) return 'Windows'
	if (o.includes('mac') || o.includes('osx') || o.includes('darwin')) return 'Mac OS'
	if (o.includes('ipad') || o.includes('iphone') || word('ios')) return 'iOS'
	if (o.includes('android')) return 'Android'
	if (
		o.includes('linux') ||
		o.includes('ubuntu') ||
		o.includes('debian') ||
		o.includes('fedora') ||
		o.includes('chrome os') ||
		o.includes('chromeos') ||
		o.includes('chromium') ||
		word('arch') ||
		word('cros')
	)
		return 'Linux'
	return 'Linux'
}

const ctr = (decrypt: boolean, data: Uint8Array, key: Uint8Array, iv: Uint8Array): Buffer => {
	const c = (decrypt ? createDecipheriv : createCipheriv)('aes-256-ctr', key, iv)
	return Buffer.concat([c.update(data), c.final()])
}

/** `companion_hello`: our ephemeral key, wrapped under the code, plus our identity for the phone to show. */
export async function companionHello(
	creds: AuthCreds,
	phoneNumber: string,
	code: string,
	browser: [string, string] = ['Windows', 'Desktop'],
): Promise<BinaryNode> {
	const salt = randomBytes(32)
	const iv = randomBytes(16)
	const wrapped = Buffer.concat([
		salt,
		iv,
		ctr(false, creds.pairingEphemeralKey.publicKey, await codeKey(code, salt), iv),
	])
	const client = companionWebClient(browser[1])
	return {
		tag: 'iq',
		attrs: { to: 's.whatsapp.net', type: 'set', xmlns: 'md' },
		content: [
			{
				tag: 'link_code_companion_reg',
				attrs: {
					jid: `${phoneNumber.replace(/\D/g, '')}@s.whatsapp.net`,
					stage: 'companion_hello',
					should_show_push_notification: 'true',
				},
				content: [
					{ tag: 'link_code_pairing_wrapped_companion_ephemeral_pub', attrs: {}, content: wrapped },
					{ tag: 'companion_server_auth_key_pub', attrs: {}, content: creds.noiseKey.publicKey },
					{ tag: 'companion_platform_id', attrs: {}, content: client.id },
					{
						tag: 'companion_platform_display',
						attrs: {},
						content: `${client.name} (${canonicalOs(browser[0])})`,
					},
					// The raw byte 0x00 (`new Uint8Array(1)` on WA Web, `[]byte{0}` in whatsmeow) - NOT the
					// ASCII character '0' (0x30), which a plain JS string here would encode as.
					{ tag: 'link_code_pairing_nonce', attrs: {}, content: new Uint8Array([0]) },
				],
			},
		],
	}
}

const child = (n: BinaryNode, tag: string): Uint8Array | undefined => {
	const c = Array.isArray(n.content) ? n.content.find((x) => x.tag === tag)?.content : undefined
	return c instanceof Uint8Array ? c : undefined
}

/**
 * The phone answered (`primary_hello`): unwrap its ephemeral key, derive the shared secrets and build
 * `companion_finish`. Returns the stanza and the new ADV secret (base64) the later `pair-success` is checked with.
 */
export async function companionFinish(
	notification: BinaryNode,
	creds: AuthCreds,
	phoneNumber: string,
	code: string,
): Promise<{ finish: BinaryNode; advSecretKey: string } | undefined> {
	const reg = Array.isArray(notification.content)
		? notification.content.find((c) => c.tag === 'link_code_companion_reg')
		: undefined
	if (!reg) return undefined
	const ref = child(reg, 'link_code_pairing_ref')
	const primaryIdentity = child(reg, 'primary_identity_pub')
	const wrapped = child(reg, 'link_code_pairing_wrapped_primary_ephemeral_pub')
	if (!ref || !primaryIdentity || !wrapped || wrapped.length < 80 || primaryIdentity.length !== 32)
		return undefined

	const primaryEphemeral = ctr(
		true,
		wrapped.subarray(48, 80),
		await codeKey(code, wrapped.subarray(0, 32)),
		wrapped.subarray(32, 48),
	)
	const companionShared = sharedKey(creds.pairingEphemeralKey.privateKey, primaryEphemeral)
	const random = randomBytes(32)
	const salt = randomBytes(32)
	const bundleKey = Buffer.from(
		hkdfSync('sha256', companionShared, salt, 'link_code_pairing_key_bundle_encryption_key', 32),
	)
	const iv = randomBytes(12)
	const gcm = createCipheriv('aes-256-gcm', bundleKey, iv)
	const body = Buffer.concat([
		gcm.update(Buffer.concat([creds.signedIdentityKey.publicKey, primaryIdentity, random])),
		gcm.final(),
		gcm.getAuthTag(),
	])
	const identityShared = sharedKey(creds.signedIdentityKey.privateKey, primaryIdentity)
	const advSecret = Buffer.from(
		hkdfSync(
			'sha256',
			Buffer.concat([companionShared, identityShared, random]),
			Buffer.alloc(0),
			'adv_secret',
			32,
		),
	)
	return {
		advSecretKey: advSecret.toString('base64'),
		finish: {
			tag: 'iq',
			attrs: { to: 's.whatsapp.net', type: 'set', xmlns: 'md' },
			content: [
				{
					tag: 'link_code_companion_reg',
					attrs: {
						jid: `${phoneNumber.replace(/\D/g, '')}@s.whatsapp.net`,
						stage: 'companion_finish',
					},
					content: [
						{
							tag: 'link_code_pairing_wrapped_key_bundle',
							attrs: {},
							content: Buffer.concat([salt, iv, body]),
						},
						{
							tag: 'companion_identity_public',
							attrs: {},
							content: creds.signedIdentityKey.publicKey,
						},
						{ tag: 'link_code_pairing_ref', attrs: {}, content: ref },
					],
				},
			],
		},
	}
}
