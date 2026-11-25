// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { spawn } from 'node:child_process'

// Turn any image or short animation into a WhatsApp sticker WebP. `ffmpeg` does the work - the same tool, and the
// same safe spawn pattern (no shell, bounded output, input only on stdin), as the call media-file path. A still
// (PNG, JPEG, ...) becomes a 512x512 static WebP; an animation (GIF, APNG, MP4, ...) becomes an animated WebP.

/** True if the bytes are already a WebP file (`RIFF....WEBP`), so no conversion is needed. */
export function isWebp(bytes: Uint8Array): boolean {
	return (
		bytes.length >= 12 &&
		bytes[0] === 0x52 && // R
		bytes[1] === 0x49 && // I
		bytes[2] === 0x46 && // F
		bytes[3] === 0x46 && // F
		bytes[8] === 0x57 && // W
		bytes[9] === 0x45 && // E
		bytes[10] === 0x42 && // B
		bytes[11] === 0x50 // P
	)
}

export interface StickerConvertOptions {
	/** Output square size in pixels (default 512, WhatsApp's sticker size). */
	size?: number
	/** libwebp quality 0-100 (default 75). */
	quality?: number
	/** Largest WebP to accept, in bytes (default 2 MiB); conversion fails rather than emit more. */
	maxBytes?: number
}

/**
 * Convert image/animation `bytes` into a square WhatsApp sticker WebP via `ffmpeg`. The picture is scaled to fit,
 * keeping its aspect ratio, and padded to a transparent square. Throws if `ffmpeg` is missing or the input cannot
 * be decoded.
 */
export function toStickerWebp(
	bytes: Uint8Array,
	opts: StickerConvertOptions = {},
): Promise<Uint8Array> {
	const size = opts.size ?? 512
	const quality = opts.quality ?? 75
	const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024
	const args = [
		'-v',
		'error',
		'-nostdin',
		'-i',
		'pipe:0',
		'-vf',
		`scale=${size}:${size}:force_original_aspect_ratio=decrease,` +
			`pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1`,
		'-c:v',
		'libwebp',
		'-pix_fmt',
		'yuva420p',
		'-loop',
		'0',
		'-an',
		'-q:v',
		String(quality),
		'-f',
		'webp',
		'pipe:1',
	]
	return new Promise((resolve, reject) => {
		const p = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] })
		const out: Buffer[] = []
		const err: Buffer[] = []
		let size2 = 0
		let killed = false
		p.stdout.on('data', (d: Buffer) => {
			size2 += d.length
			if (size2 > maxBytes) {
				killed = true
				p.kill()
				reject(new Error(`sticker conversion exceeded ${maxBytes} bytes`))
				return
			}
			out.push(d)
		})
		p.stderr.on('data', (d: Buffer) => err.push(d))
		p.on('error', (e) =>
			reject(
				new Error(
					`ffmpeg could not be started (needed to convert a non-WebP sticker): ${e.message}`,
				),
			),
		)
		p.on('close', (code) => {
			if (killed) return
			if (code === 0) resolve(new Uint8Array(Buffer.concat(out)))
			else
				reject(
					new Error(
						`ffmpeg sticker conversion failed: ${Buffer.concat(err).toString().trim() || code}`,
					),
				)
		})
		p.stdin.on('error', () => {}) // a killed ffmpeg can EPIPE the write; the close handler reports the real error
		p.stdin.end(Buffer.from(bytes))
	})
}

/** Sticker bytes as WebP: pass through if already WebP, otherwise convert with `ffmpeg`. */
export async function ensureStickerWebp(
	bytes: Uint8Array,
	opts: StickerConvertOptions = {},
): Promise<Uint8Array> {
	return isWebp(bytes) ? bytes : toStickerWebp(bytes, opts)
}
