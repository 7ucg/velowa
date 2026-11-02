import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
	crc32,
	createStickerPackZip,
	isAnimatedWebp,
	zipStore,
} from '../../../../src/client/features/message/sticker-pack.js'

const webp = (animated = false) => {
	const b = Buffer.alloc(30)
	b.write('RIFF', 0, 'latin1')
	b.write('WEBP', 8, 'latin1')
	b.write('VP8X', 12, 'latin1')
	b[20] = animated ? 0x02 : 0
	return b
}

describe('sticker packs', () => {
	it('computes the CRC-32 of the standard test string', () => {
		expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926)
	})

	it('makes a zip that a real unzip tool reads back', () => {
		const dir = mkdtempSync(join(tmpdir(), 'zip-'))
		try {
			const path = join(dir, 'p.zip')
			writeFileSync(
				path,
				zipStore([
					{ name: 'a.txt', data: Buffer.from('hello') },
					{ name: 'b/ä.bin', data: Buffer.from([0, 1, 2, 3]) },
				]),
			)
			const out = execFileSync(
				'python3',
				[
					'-I',
					'-c',
					'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(",".join(f"{i.filename}:{len(z.read(i))}" for i in z.infolist()))',
					path,
				],
				{ encoding: 'utf8' },
			)
			expect(out.trim()).toBe('a.txt:5,b/ä.bin:4')
		} finally {
			rmSync(dir, { recursive: true, force: true })
		}
	})

	it('describes the stickers and drops duplicates from the archive', () => {
		const a = webp()
		const r = createStickerPackZip(
			'PACK1',
			[
				{ data: a, emojis: ['😀'] },
				{ data: a },
				{ data: webp(true), accessibilityLabel: 'moving' },
			],
			webp(),
		)
		expect(r.trayIconFileName).toBe('PACK1.webp')
		expect(r.stickers).toHaveLength(3)
		expect(r.stickers[0]).toMatchObject({
			emojis: ['😀'],
			isAnimated: false,
			mimetype: 'image/webp',
		})
		expect(r.stickers[2]).toMatchObject({ isAnimated: true, accessibilityLabel: 'moving' })
		expect(r.stickers[0]!['fileName']).toBe(r.stickers[1]!['fileName'])
		// cover + two distinct stickers
		expect(r.zip.readUInt16LE(r.zip.length - 12)).toBe(3)
	})

	it('refuses bad pack ids and empty or oversized packs', () => {
		const s = [{ data: webp() }]
		expect(() => createStickerPackZip('../x', s, webp())).toThrow()
		expect(() => createStickerPackZip('a.b', s, webp())).toThrow()
		expect(() => createStickerPackZip('ok', [], webp())).toThrow()
		expect(() => createStickerPackZip('ok', Array(61).fill(s[0]), webp())).toThrow()
	})

	it('sees animation in a WebP header', () => {
		expect(isAnimatedWebp(webp(true))).toBe(true)
		expect(isAnimatedWebp(webp(false))).toBe(false)
		expect(isAnimatedWebp(Buffer.from('nope'))).toBe(false)
	})
})
