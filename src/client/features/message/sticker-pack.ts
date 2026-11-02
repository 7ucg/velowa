// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { createHash, randomUUID } from 'node:crypto'

// Sticker packs: a ZIP of WebP stickers (plus the cover) that is uploaded like other media, and a message that
// points at it. The recipient can add the pack to their stickers.

const MAX_STICKERS = 60

const CRC_TABLE = (() => {
	const t = new Uint32Array(256)
	for (let n = 0; n < 256; n++) {
		let c = n
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
		t[n] = c >>> 0
	}
	return t
})()

export function crc32(data: Uint8Array): number {
	let c = 0xffffffff
	for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8)
	return (c ^ 0xffffffff) >>> 0
}

/** A ZIP archive without compression ("store"), which is what a sticker pack uses. */
export function zipStore(files: { name: string; data: Uint8Array }[]): Buffer {
	const parts: Buffer[] = []
	const central: Buffer[] = []
	let offset = 0
	for (const f of files) {
		const name = Buffer.from(f.name, 'utf8')
		const crc = crc32(f.data)
		const local = Buffer.alloc(30)
		local.writeUInt32LE(0x04034b50, 0)
		local.writeUInt16LE(20, 4) // version needed
		local.writeUInt16LE(0x0800, 6) // flags: UTF-8 names
		local.writeUInt16LE(0, 8) // method: store
		local.writeUInt32LE(crc, 14)
		local.writeUInt32LE(f.data.length, 18)
		local.writeUInt32LE(f.data.length, 22)
		local.writeUInt16LE(name.length, 26)
		parts.push(local, name, Buffer.from(f.data))
		const dir = Buffer.alloc(46)
		dir.writeUInt32LE(0x02014b50, 0)
		dir.writeUInt16LE(20, 4)
		dir.writeUInt16LE(20, 6)
		dir.writeUInt16LE(0x0800, 8)
		dir.writeUInt32LE(crc, 16)
		dir.writeUInt32LE(f.data.length, 20)
		dir.writeUInt32LE(f.data.length, 24)
		dir.writeUInt16LE(name.length, 28)
		dir.writeUInt32LE(offset, 42)
		central.push(dir, name)
		offset += 30 + name.length + f.data.length
	}
	const cdSize = central.reduce((n, b) => n + b.length, 0)
	const end = Buffer.alloc(22)
	end.writeUInt32LE(0x06054b50, 0)
	end.writeUInt16LE(files.length, 8)
	end.writeUInt16LE(files.length, 10)
	end.writeUInt32LE(cdSize, 12)
	end.writeUInt32LE(offset, 16)
	return Buffer.concat([...parts, ...central, end])
}

/** Does this WebP hold an animation? (An `ANIM` chunk in a VP8X file.) */
export function isAnimatedWebp(d: Uint8Array): boolean {
	const b = Buffer.from(d)
	return (
		b.length > 21 &&
		b.toString('latin1', 0, 4) === 'RIFF' &&
		b.toString('latin1', 8, 12) === 'WEBP' &&
		b.toString('latin1', 12, 16) === 'VP8X' &&
		(b[20]! & 0x02) !== 0
	)
}

export interface StickerInput {
	/** A 512x512 WebP. */
	data: Uint8Array
	emojis?: string[]
	accessibilityLabel?: string
}

export interface StickerPackZip {
	zip: Buffer
	stickers: Record<string, unknown>[]
	trayIconFileName: string
}

export function createStickerPackZip(
	packId: string,
	stickers: StickerInput[],
	cover: Uint8Array,
): StickerPackZip {
	if (!packId || packId.length > 128 || /[/\\.\u0000-\u001f]/.test(packId))
		throw new Error(
			'invalid pack id: 1 to 128 characters, no path separators, dots or control characters',
		)
	if (!stickers.length) throw new Error('a sticker pack needs at least one sticker')
	if (stickers.length > MAX_STICKERS)
		throw new Error(`a sticker pack holds at most ${MAX_STICKERS} stickers`)
	const trayIconFileName = `${packId}.webp`
	const files = [{ name: trayIconFileName, data: cover }]
	const seen = new Set<string>()
	const list = stickers.map((s) => {
		const name = `${createHash('sha256').update(s.data).digest('base64url')}.webp`
		if (!seen.has(name)) {
			seen.add(name)
			files.push({ name, data: s.data })
		}
		return {
			fileName: name,
			isAnimated: isAnimatedWebp(s.data),
			emojis: s.emojis ?? [],
			...(s.accessibilityLabel && { accessibilityLabel: s.accessibilityLabel }),
			isLottie: false,
			mimetype: 'image/webp',
		}
	})
	return { zip: zipStore(files), stickers: list, trayIconFileName }
}

export const newPackId = (): string => randomUUID().toUpperCase()
