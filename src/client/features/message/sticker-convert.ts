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
	/** Largest input to accept, in bytes (default 64 MiB); rejected before `ffmpeg` is even started. */
	maxInputBytes?: number
	/** Wall-clock limit for the `ffmpeg` run, in ms (default 60_000); it is SIGKILLed past this. */
	timeoutMs?: number
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
	const maxInputBytes = opts.maxInputBytes ?? 64 * 1024 * 1024
	const timeoutMs = opts.timeoutMs ?? 60_000
	if (bytes.length > maxInputBytes)
		return Promise.reject(new Error(`sticker source exceeds ${maxInputBytes} bytes`))
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
		// `timeout` makes Node send `killSignal` (SIGKILL) if ffmpeg runs too long - a hard wall-clock cap.
		const p = spawn('ffmpeg', args, {
			stdio: ['pipe', 'pipe', 'pipe'],
			timeout: timeoutMs,
			killSignal: 'SIGKILL',
		})
		const out: Buffer[] = []
		const err: Buffer[] = []
		let outSize = 0
		let errSize = 0
		let done = false
		const fail = (e: Error): void => {
			if (done) return
			done = true
			p.stdout.destroy()
			p.stdin.destroy()
			p.kill('SIGKILL')
			reject(e)
		}
		p.stdout.on('data', (d: Buffer) => {
			outSize += d.length
			if (outSize > maxBytes)
				return fail(new Error(`sticker conversion exceeded ${maxBytes} bytes`))
			out.push(d)
		})
		p.stderr.on('data', (d: Buffer) => {
			// Keep only the first 64 KiB of diagnostics so a chatty/hostile ffmpeg cannot grow memory.
			if (errSize < 64 * 1024) {
				err.push(d)
				errSize += d.length
			}
		})
		p.on('error', (e) =>
			fail(
				new Error(
					`ffmpeg could not be started (needed to convert a non-WebP sticker): ${e.message}`,
				),
			),
		)
		p.on('close', (code, signal) => {
			if (done) return
			done = true
			if (code === 0) resolve(new Uint8Array(Buffer.concat(out)))
			else if (signal === 'SIGKILL')
				reject(new Error(`ffmpeg sticker conversion timed out after ${timeoutMs} ms`))
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
	if (isWebp(bytes)) {
		// The cap applies to a pass-through WebP too, so an oversized one never slips past unconverted.
		const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024
		if (bytes.length > maxBytes) throw new Error(`sticker WebP exceeds ${maxBytes} bytes`)
		return bytes
	}
	return toStickerWebp(bytes, opts)
}
