import { execFileSync, spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import {
	ensureStickerWebp,
	isWebp,
	toStickerWebp,
} from '../../../../src/client/features/message/sticker-convert.js'

const haveFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0

// RIFF????WEBP
const fakeWebp = (): Uint8Array => {
	const b = Buffer.alloc(16)
	b.write('RIFF', 0, 'ascii')
	b.writeUInt32LE(8, 4)
	b.write('WEBP', 8, 'ascii')
	return new Uint8Array(b)
}

describe('sticker-convert', () => {
	it('detects WebP by its magic bytes', () => {
		expect(isWebp(fakeWebp())).toBe(true)
		expect(isWebp(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false) // PNG magic
		expect(isWebp(new Uint8Array(4))).toBe(false)
	})

	it('passes a WebP source straight through without converting', async () => {
		const webp = fakeWebp()
		// No ffmpeg should be needed here; the same bytes come back.
		expect(await ensureStickerWebp(webp)).toBe(webp)
	})
})

describe.skipIf(!haveFfmpeg)('sticker-convert (ffmpeg)', () => {
	const png = (): Buffer =>
		execFileSync('ffmpeg', [
			'-v',
			'error',
			'-f',
			'lavfi',
			'-i',
			'color=c=red:s=200x100',
			'-frames:v',
			'1',
			'-f',
			'image2pipe',
			'-c:v',
			'png',
			'pipe:1',
		])

	it('converts a non-WebP image to a 512-sized WebP', async () => {
		const webp = await toStickerWebp(new Uint8Array(png()))
		expect(isWebp(webp)).toBe(true)
		expect(webp.length).toBeGreaterThan(0)
	})

	it('ensureStickerWebp converts a PNG but leaves WebP untouched', async () => {
		const converted = await ensureStickerWebp(new Uint8Array(png()))
		expect(isWebp(converted)).toBe(true)
	})

	it('fails cleanly on input ffmpeg cannot decode', async () => {
		await expect(toStickerWebp(new Uint8Array([1, 2, 3, 4, 5]))).rejects.toThrow(/ffmpeg/)
	})
})
