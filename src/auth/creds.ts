import { randomBytes, randomInt } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { newIdentityKeyPair, newSignedPreKey } from '../crypto/signal.js'
import type { IdentityKeys } from '../crypto/signal.js'

export interface SignedPreKeyCreds {
	keyId: number
	record: Uint8Array
	publicKey: Uint8Array
	signature: Uint8Array
}

/** Everything a companion device needs to pair and later log back in. */
export interface AuthCreds {
	noiseKey: IdentityKeys
	signedIdentityKey: IdentityKeys
	signedPreKey: SignedPreKeyCreds
	registrationId: number
	/** base64, 32 random bytes; shared with the phone through the QR code. */
	advSecretKey: string
	/** Set once pairing succeeded. */
	me?: { id: string; lid?: string; name?: string }
	/** Encoded ADVSignedDeviceIdentity incl. account signature key and our device signature. */
	account?: Uint8Array
	platform?: string
	/** Ephemeral key for pairing-code linking (generated lazily for old creds files). */
	pairingEphemeralKey: IdentityKeys
	/** Next unused one-time pre-key id (ids are never reused). */
	nextPreKeyId: number
}

export function initAuthCreds(): AuthCreds {
	const signedIdentityKey = newIdentityKeyPair()
	const spk = newSignedPreKey(signedIdentityKey.privateKey, 1)
	return {
		noiseKey: newIdentityKeyPair(),
		signedIdentityKey,
		signedPreKey: {
			keyId: spk.id,
			record: spk.record,
			publicKey: spk.publicKey,
			signature: spk.signature,
		},
		registrationId: randomInt(1, 16380),
		advSecretKey: randomBytes(32).toString('base64'),
		nextPreKeyId: 1,
		pairingEphemeralKey: newIdentityKeyPair(),
	}
}

const BYTES = '$bytes'

// JSON.stringify applies Buffer#toJSON before the replacer runs, so a Buffer arrives here already
// as { type: 'Buffer', data: number[] }; treat both shapes as bytes.
const isBufferJson = (v: unknown): v is { type: 'Buffer'; data: number[] } =>
	typeof v === 'object' &&
	v !== null &&
	(v as { type?: unknown }).type === 'Buffer' &&
	Array.isArray((v as { data?: unknown }).data)

function replacer(_k: string, v: unknown): unknown {
	if (v instanceof Uint8Array) return { [BYTES]: Buffer.from(v).toString('base64') }
	if (isBufferJson(v)) return { [BYTES]: Buffer.from(v.data).toString('base64') }
	return v
}

function reviver(_k: string, v: unknown): unknown {
	if (v && typeof v === 'object' && BYTES in v)
		return new Uint8Array(Buffer.from((v as Record<string, string>)[BYTES]!, 'base64'))
	if (isBufferJson(v)) return new Uint8Array(v.data) // files written before the fix above
	return v
}

export function saveAuthCreds(path: string, creds: AuthCreds): void {
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
	writeFileSync(path, JSON.stringify(creds, replacer, 2), { mode: 0o600 })
	// `mode` only applies when the file is created; tighten an existing one too.
	chmodSync(path, 0o600)
}

export function loadAuthCreds(path: string): AuthCreds | undefined {
	if (!existsSync(path)) return undefined
	const creds = JSON.parse(readFileSync(path, 'utf8'), reviver) as AuthCreds
	creds.nextPreKeyId ??= 1
	creds.pairingEphemeralKey ??= newIdentityKeyPair()
	return creds
}
