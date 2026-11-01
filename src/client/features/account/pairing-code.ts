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
					{ tag: 'companion_platform_id', attrs: {}, content: '1' },
					{
						tag: 'companion_platform_display',
						attrs: {},
						content: `${browser[1]} (${browser[0]})`,
					},
					{ tag: 'link_code_pairing_nonce', attrs: {}, content: '0' },
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
