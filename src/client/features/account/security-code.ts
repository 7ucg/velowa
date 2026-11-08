// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { createHash } from 'node:crypto'

/** `V3` is phone-number based (what the app calls it for a PN contact), `V4` is LID based. Never compare the two. */
export type SecurityCodeVersion = 'V3' | 'V4'

/** Signal's type-prefixed identity-key encoding: `0x05` (DJB/Curve25519) + the 32-byte raw public key. */
const serializeIdentityKey = (key: Uint8Array): Buffer => Buffer.concat([Buffer.from([5]), key])

const PN_PREFIXES = [
	'1',
	'7',
	'20',
	'27',
	'30',
	'31',
	'32',
	'33',
	'34',
	'36',
	'39',
	'40',
	'41',
	'43',
	'44',
	'45',
	'46',
	'47',
	'48',
	'49',
	'51',
	'52',
	'53',
	'54',
	'55',
	'56',
	'57',
	'58',
	'60',
	'61',
	'62',
	'63',
	'64',
	'65',
	'66',
	'81',
	'82',
	'84',
	'86',
	'90',
	'91',
	'92',
	'93',
	'94',
	'95',
	'98',
]

/**
 * WhatsApp's numeric-identifier convention for one side of a security code: a PN is country-code-prefix plus a
 * short suffix (WA Web `WAWebIdentityVerificationApi`'s regexp), a LID is just its bare digits.
 */
export function securityCodeIdentifier(version: SecurityCodeVersion, user: string): string {
	if (!user || !/^\d+$/.test(user))
		throw new Error('security codes require a numeric phone-number or LID user')
	if (version === 'V4') return user
	const prefix = PN_PREFIXES.find((p) => user.startsWith(p) && user.length >= p.length + 4)
	if (prefix) return prefix + user.slice(user.length - Math.min(user.length - prefix.length, 6))
	if (user.length >= 7)
		return user.slice(0, 3) + user.slice(user.length - Math.min(user.length - 3, 6))
	return `${user}@c.us`
}

/** One side's 30-digit half: 5200 rounds of SHA-512 over the sorted serialized keys, like Signal's own fingerprint. */
function half(identifier: string, keys: Uint8Array[]): string {
	if (!keys.length)
		throw new Error('security codes require at least one public identity key per account')
	const serialized = keys.map(serializeIdentityKey).sort(Buffer.compare)
	let digest = createHash('sha512')
		.update(Buffer.from([0, 0]))
		.update(Buffer.concat(serialized))
		.update(identifier, 'utf8')
		.update(Buffer.concat(serialized))
		.digest()
	for (let i = 1; i < 5200; i++) {
		const h = createHash('sha512').update(digest)
		for (const key of serialized) h.update(key)
		digest = h.digest()
	}
	let result = ''
	for (let i = 0; i < 30; i += 5) {
		let value = 0n
		for (let j = i; j < i + 5; j++) value = (value << 8n) | BigInt(digest[j]!)
		result += String(value % 100_000n).padStart(5, '0')
	}
	return result
}

/**
 * The 60 ASCII digits WhatsApp Web shows for comparing two accounts' complete identity-key sets out of band
 * (a safety-number style check, independent of the server). Both sides must supply the exact same device sets
 * - including their own device - or the two ends will compute different codes; this is a point-in-time snapshot,
 * invalid again after either account's keys or device list change. `local`/`remote` are plain user ids (PN
 * digits for `V3`, LID digits for `V4` - never mixed).
 */
export function numericSecurityCode(
	version: SecurityCodeVersion,
	local: string,
	localKeys: Uint8Array[],
	remote: string,
	remoteKeys: Uint8Array[],
): string {
	const halves = [
		half(securityCodeIdentifier(version, local), localKeys),
		half(securityCodeIdentifier(version, remote), remoteKeys),
	]
	halves.sort()
	return halves.join('')
}
