// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { randomUUID } from 'node:crypto'

/** Pack attribution a sticker carries so WhatsApp shows "Added by X" and groups it under its pack. */
export interface StickerMetadata {
	/** A random UUID is generated if omitted. */
	packId?: string
	packName: string
	publisher: string
	emojis?: string[]
	androidAppStoreLink?: string
	iosAppStoreLink?: string
}

interface RiffChunk {
	tag: string
	data: Buffer
}

/** The 22-byte minimal TIFF/IFD wrapper WhatsApp puts its sticker JSON metadata inside, under a custom "AW" tag. */
const EXIF_HEADER = Buffer.from([
	0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
	0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
])

function parseRiff(webp: Uint8Array): RiffChunk[] {
	const buf = Buffer.from(webp)
	if (
		buf.length < 12 ||
		buf.toString('ascii', 0, 4) !== 'RIFF' ||
		buf.toString('ascii', 8, 12) !== 'WEBP'
	)
		throw new Error('not a WebP image')
	const chunks: RiffChunk[] = []
	let offset = 12
	while (offset + 8 <= buf.length) {
		const tag = buf.toString('ascii', offset, offset + 4)
		const size = buf.readUInt32LE(offset + 4)
		const dataStart = offset + 8
		const dataEnd = dataStart + size
		if (dataEnd > buf.length) throw new Error('truncated WebP chunk')
		chunks.push({ tag, data: buf.subarray(dataStart, dataEnd) })
		offset = dataEnd + (size % 2)
	}
	return chunks
}

function buildRiff(chunks: RiffChunk[]): Buffer {
	const parts: Buffer[] = []
	for (const c of chunks) {
		const header = Buffer.alloc(8)
		header.write(c.tag, 0, 4, 'ascii')
		header.writeUInt32LE(c.data.length, 4)
		parts.push(header, c.data)
		if (c.data.length % 2) parts.push(Buffer.from([0]))
	}
	const body = Buffer.concat(parts)
	const out = Buffer.alloc(12 + body.length)
	out.write('RIFF', 0, 4, 'ascii')
	out.writeUInt32LE(4 + body.length, 4)
	out.write('WEBP', 8, 4, 'ascii')
	body.copy(out, 12)
	return out
}

/** Pixel dimensions from a simple (non-extended) WebP's single image chunk, needed to build a VP8X header for it. */
function dimensionsOf(tag: string, data: Buffer): { width: number; height: number } {
	if (tag === 'VP8 ') {
		if (data.length < 10 || data[3] !== 0x9d || data[4] !== 0x01 || data[5] !== 0x2a)
			throw new Error('invalid VP8 bitstream')
		return { width: data.readUInt16LE(6) & 0x3fff, height: data.readUInt16LE(8) & 0x3fff }
	}
	if (tag === 'VP8L') {
		if (data.length < 5 || data[0] !== 0x2f) throw new Error('invalid VP8L bitstream')
		const bits = data.readUInt32LE(1)
		return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
	}
	throw new Error('not a supported WebP image (no VP8/VP8L chunk)')
}

function buildExifPayload(metadata: StickerMetadata): Buffer {
	const json: Record<string, unknown> = {
		'sticker-pack-id': metadata.packId || randomUUID(),
		'sticker-pack-name': metadata.packName,
		'sticker-pack-publisher': metadata.publisher,
	}
	if (metadata.emojis?.length) json['emojis'] = metadata.emojis
	if (metadata.androidAppStoreLink) json['android-app-store-link'] = metadata.androidAppStoreLink
	if (metadata.iosAppStoreLink) json['ios-app-store-link'] = metadata.iosAppStoreLink
	const jsonBytes = Buffer.from(JSON.stringify(json), 'utf8')
	const header = Buffer.from(EXIF_HEADER)
	header.writeUInt32LE(jsonBytes.length, 14)
	return Buffer.concat([header, jsonBytes])
}

const isWhatsAppStickerExif = (exif: Buffer): boolean =>
	exif.length > EXIF_HEADER.length &&
	exif[0] === 0x49 &&
	exif[1] === 0x49 &&
	exif[2] === 0x2a &&
	exif[3] === 0x00 &&
	exif[10] === 0x41 &&
	exif[11] === 0x57

/**
 * Attach pack attribution to a WebP sticker, so the real app shows "Added by X" and groups it under its pack.
 * Upgrades a simple (non-extended) WebP to the extended format it needs to carry EXIF; an already-extended one
 * (e.g. animated, or with alpha) keeps its other chunks and just gets the EXIF bit set and the chunk placed
 * where the format requires it. Any pre-existing sticker metadata is replaced, not merged.
 */
export function addStickerMetadata(webp: Uint8Array, metadata: StickerMetadata): Uint8Array {
	const chunks = parseRiff(webp).filter((c) => c.tag !== 'EXIF')
	const exifChunk: RiffChunk = { tag: 'EXIF', data: buildExifPayload(metadata) }
	const vp8xIndex = chunks.findIndex((c) => c.tag === 'VP8X')
	let out: RiffChunk[]
	if (vp8xIndex === -1) {
		const image = chunks.find((c) => c.tag === 'VP8 ' || c.tag === 'VP8L')
		if (!image) throw new Error('not a supported WebP image (no VP8/VP8L chunk)')
		const { width, height } = dimensionsOf(image.tag, image.data)
		const vp8x = Buffer.alloc(10)
		vp8x[0] = 0x08 // EXIF flag only; no alpha/animation/ICC to preserve on a simple WebP
		vp8x.writeUIntLE(width - 1, 4, 3)
		vp8x.writeUIntLE(height - 1, 7, 3)
		out = [{ tag: 'VP8X', data: vp8x }, ...chunks, exifChunk]
	} else {
		out = [...chunks]
		const vp8x = Buffer.from(out[vp8xIndex]!.data)
		vp8x[0] = vp8x[0]! | 0x08
		out[vp8xIndex] = { tag: 'VP8X', data: vp8x }
		// Required chunk order: VP8X, [ICCP], image data (ANIM/ALPH/VP8/VP8L), [EXIF], [XMP].
		const xmpIndex = out.findIndex((c) => c.tag === 'XMP ')
		if (xmpIndex === -1) out.push(exifChunk)
		else out.splice(xmpIndex, 0, exifChunk)
	}
	return buildRiff(out)
}

/** Read a WebP sticker's pack attribution, if it carries any. */
export function getStickerMetadata(webp: Uint8Array): StickerMetadata | undefined {
	const exif = parseRiff(webp).find((c) => c.tag === 'EXIF')
	if (!exif || !isWhatsAppStickerExif(exif.data)) return undefined
	let json: Record<string, unknown>
	try {
		json = JSON.parse(exif.data.subarray(EXIF_HEADER.length).toString('utf8'))
	} catch {
		return undefined
	}
	const emojis = json['emojis']
	return {
		...(typeof json['sticker-pack-id'] === 'string' && { packId: json['sticker-pack-id'] }),
		packName: typeof json['sticker-pack-name'] === 'string' ? json['sticker-pack-name'] : '',
		publisher:
			typeof json['sticker-pack-publisher'] === 'string' ? json['sticker-pack-publisher'] : '',
		...(Array.isArray(emojis) && emojis.length && { emojis }),
		...(typeof json['android-app-store-link'] === 'string' && {
			androidAppStoreLink: json['android-app-store-link'],
		}),
		...(typeof json['ios-app-store-link'] === 'string' && {
			iosAppStoreLink: json['ios-app-store-link'],
		}),
	}
}
