import { describe, expect, it } from 'vitest'
import {
	addStickerMetadata,
	getStickerMetadata,
} from '../../../../src/client/features/message/sticker-metadata.js'

// Real WebP bytes from `ffmpeg -f lavfi -i color=red:s=32x32 -frames:v 1 -c:v libwebp -lossless 0`, and the
// lossless/animated equivalents - not hand-built, so a bug in the chunk rewriting shows up against a real decoder
// (verified separately, out of band, by round-tripping through ffmpeg: decoded pixels came back byte-identical).
const LOSSY_WEBP = Buffer.from(
	'UklGRkwAAABXRUJQVlA4IEAAAABQAwCdASogACAAPpFCnEolo6KhqAgAsBIJZQDGqoAAQFEcAAD+7tPf/uOwN14t//ucD/ucD/ucD+NspCdnCgAA',
	'base64',
)
const LOSSLESS_WEBP = Buffer.from('UklGRhwAAABXRUJQVlA4TA8AAAAvH8AHAAcQ0f/+ByKi/wEA', 'base64')
const ANIM_WEBP = Buffer.from(
	'UklGRpQBAABXRUJQVlA4WAoAAAASAAAAHwAAHwAAQU5JTQYAAAD/////AABBTk1GVAAAAAAAAAAAAB8AAB8AAPoAAABWUDggPAAAADADAJ0BKiAAIAA+kUKcSiWjoqGoCACwEgllAMkCgABAUFAA/u7T3/xbn7ddIf/4tDrQ60NEUUifCAAAAEFOTUZUAAAAAAAAAAAAHwAAHwAA+gAAAFZQOCA8AAAAMAMAnQEqIAAgAD6RQpxKJaOioagIALASCWUAyQKAAEBQUAD+7tPf/Fuft10h//i0OtDrQ0RRSJ8IAAAAQU5NRlQAAAAAAAAAAAAfAAAfAAD6AAAAVlA4IDwAAAAwAwCdASogACAAPpFCnEolo6KhqAgAsBIJZQDJAoAAQFBQAP7u09/8W5+3XSH/+LQ60OtDRFFInwgAAABBTk1GVAAAAAAAAAAAAB8AAB8AAPoAAABWUDggPAAAADADAJ0BKiAAIAA+kUKcSiWjoqGoCACwEgllAMkCgABAUFAA/u7T3/xbn7ddIf/4tDrQ60NEUUifCAAAAA==',
	'base64',
)

const packInfo = {
	packId: 'fixed-id-123',
	packName: 'Test Pack',
	publisher: 'Baron',
	emojis: ['😀'],
}

describe('sticker pack attribution', () => {
	it('has no metadata on a plain WebP', () => {
		expect(getStickerMetadata(LOSSY_WEBP)).toBeUndefined()
		expect(getStickerMetadata(LOSSLESS_WEBP)).toBeUndefined()
	})

	it('round-trips on a simple lossy WebP, upgrading it to the extended format', () => {
		const out = addStickerMetadata(LOSSY_WEBP, packInfo)
		expect(Buffer.from(out).toString('ascii', 12, 16)).toBe('VP8X') // upgraded from a bare VP8 chunk
		expect(getStickerMetadata(out)).toEqual(packInfo)
	})

	it('round-trips on a simple lossless WebP', () => {
		const out = addStickerMetadata(LOSSLESS_WEBP, packInfo)
		expect(getStickerMetadata(out)).toEqual(packInfo)
	})

	it('generates a pack id when none is given', () => {
		const out = addStickerMetadata(LOSSY_WEBP, { packName: 'P', publisher: 'Q' })
		const read = getStickerMetadata(out)
		expect(read?.packId).toMatch(/^[0-9a-f-]{36}$/)
	})

	it('round-trips on an already-extended (animated) WebP, keeping its other chunks', () => {
		const out = Buffer.from(addStickerMetadata(ANIM_WEBP, packInfo))
		expect(getStickerMetadata(out)).toEqual(packInfo)
		// VP8X flags: EXIF bit (0x08) now set, animation bit (0x02) from the original still set.
		const vp8xFlags = out[20]!
		expect(vp8xFlags & 0x08).toBe(0x08)
		expect(vp8xFlags & 0x02).toBe(0x02)
		// the ANIM/ANMF frame chunks are all still present, unmodified in count
		const anmfCount = out.toString('latin1').split('ANMF').length - 1
		expect(anmfCount).toBe(4)
	})

	it('replaces (does not duplicate) pre-existing metadata', () => {
		const once = addStickerMetadata(LOSSY_WEBP, packInfo)
		const twice = addStickerMetadata(once, { ...packInfo, packName: 'Renamed' })
		expect(getStickerMetadata(twice)?.packName).toBe('Renamed')
		expect(Buffer.from(twice).toString('latin1').split('EXIF').length - 1).toBe(1)
	})

	it('rejects a non-WebP input', () => {
		expect(() => addStickerMetadata(Buffer.from('not a webp'), packInfo)).toThrow(/WebP/)
		expect(() => getStickerMetadata(Buffer.from('not a webp'))).toThrow(/WebP/)
	})
})
