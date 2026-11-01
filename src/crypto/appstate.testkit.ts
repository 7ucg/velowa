import { createCipheriv, createHmac, hkdfSync } from 'node:crypto'

// Independent oracle: the app-state wire crypto re-implemented from the WA Web algorithm with
// node:crypto, so a patch built here is not just echoing the Rust encoder.

const varint = (n: number) => {
	const out: number[] = []
	while (n >= 0x80) {
		out.push((n & 0x7f) | 0x80)
		n = Math.floor(n / 128)
	}
	out.push(n)
	return Buffer.from(out)
}
const ld = (field: number, body: Uint8Array) =>
	Buffer.concat([varint((field << 3) | 2), varint(body.length), body])
const vf = (field: number, n: number) => Buffer.concat([varint(field << 3), varint(n)])

const hkdf = (ikm: Uint8Array, info: string, len: number) =>
	Buffer.from(hkdfSync('sha256', ikm, Buffer.alloc(0), info, len))

function expand(master: Uint8Array) {
	const k = hkdf(master, 'WhatsApp Mutation Keys', 160)
	return {
		index: k.subarray(0, 32),
		valueEnc: k.subarray(32, 64),
		valueMac: k.subarray(64, 96),
		snapshotMac: k.subarray(96, 128),
		patchMac: k.subarray(128, 160),
	}
}

const versionBytes = (v: number) => {
	const b = Buffer.alloc(8)
	b.writeUInt32BE(v, 4)
	return b
}

function ltHashAdd(base: Buffer, items: Buffer[]) {
	const out = Buffer.from(base)
	for (const item of items) {
		const d = hkdf(item, 'WhatsApp Patch Integrity', 128)
		for (let i = 0; i < 128; i += 2)
			out.writeUInt16LE((out.readUInt16LE(i) + d.readUInt16LE(i)) & 0xffff, i)
	}
	return out
}

export function buildGenesisPatch(
	master: Buffer,
	keyId: Buffer,
	name: string,
	index: string[],
	timestamp: number,
) {
	const keys = expand(master)
	const indexJson = Buffer.from(JSON.stringify(index))
	const action = Buffer.concat([
		ld(1, indexJson),
		ld(2, Buffer.concat([vf(1, timestamp), ld(2, vf(1, 1))])),
		vf(4, 2),
	])
	const cipher = createCipheriv('aes-256-cbc', keys.valueEnc, Buffer.alloc(16))
	const withIv = Buffer.concat([Buffer.alloc(16), cipher.update(action), cipher.final()])
	const aad = Buffer.concat([
		Buffer.from([1]),
		keyId,
		withIv,
		Buffer.from([0, 0, 0, 0, 0, 0, 0, keyId.length + 1]),
	])
	const valueMac = createHmac('sha512', keys.valueMac).update(aad).digest().subarray(0, 32)
	const blob = Buffer.concat([withIv, valueMac])
	const indexMac = createHmac('sha256', keys.index).update(indexJson).digest()

	const lt = ltHashAdd(Buffer.alloc(128), [valueMac])
	const snapshotMac = createHmac('sha256', keys.snapshotMac)
		.update(lt)
		.update(versionBytes(1))
		.update(name)
		.digest()
	const patchMac = createHmac('sha256', keys.patchMac)
		.update(snapshotMac)
		.update(valueMac)
		.update(versionBytes(1))
		.update(name)
		.digest()

	const record = Buffer.concat([ld(1, ld(1, indexMac)), ld(2, ld(1, blob)), ld(3, ld(1, keyId))])
	const patch = Buffer.concat([
		ld(1, vf(1, 1)),
		ld(2, Buffer.concat([vf(1, 0), ld(2, record)])),
		ld(4, snapshotMac),
		ld(5, patchMac),
		ld(6, ld(1, keyId)),
	])
	return { patch: new Uint8Array(patch), valueMac, indexMac, lt }
}

export const master = Buffer.alloc(32, 7)
export const keyId = Buffer.from([0, 1, 2, 3, 4, 5])
export const lookup = (id: Uint8Array) =>
	Buffer.from(id).equals(keyId) ? new Uint8Array(master) : undefined
