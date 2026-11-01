// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { splitAnnexB } from './call-media.js'

// Audio and video files as call media. `ffmpeg` does the decoding: any file it reads (mp3, ogg, wav, m4a, mp4,
// mkv, ...) becomes 16 kHz mono PCM for the voice path, and a video file becomes the H.264 access units the video
// path sends. Nothing is passed through a shell, and the output is capped.

export interface MediaFileOptions {
	/** Play at most this many seconds of the file (default 600). */
	maxSeconds?: number
}

export interface VideoFileOptions extends MediaFileOptions {
	/** Frames per second to send (default 15). */
	fps?: number
	/** The picture is scaled to fit this width, keeping its aspect ratio (default 480; the height is even). */
	width?: number
}

/** Files the call options can name instead of raw audio and video. */
export interface CallFileOptions {
	/** An audio file (mp3, ogg, wav, m4a, ...) to say into the call. It plays once; silence follows. */
	audioFile?: string
	/** A video file (mp4, ...) to send as the picture, looped. Its sound plays too unless `audioFile` is given. */
	videoFile?: string
	fileOptions?: VideoFileOptions
}

const MAX_BYTES = 512 * 1024 * 1024

/** Run ffmpeg with an argument list and collect stdout, refusing output beyond `limit` bytes. */
function ffmpeg(args: string[], limit: number): Promise<Buffer> {
	return new Promise((res, rej) => {
		const p = spawn('ffmpeg', ['-v', 'error', '-nostdin', ...args], {
			stdio: ['ignore', 'pipe', 'pipe'],
		})
		const out: Buffer[] = []
		let size = 0
		let err = ''
		p.stdout.on('data', (b: Buffer) => {
			size += b.length
			if (size > limit) {
				p.kill('SIGKILL')
				return rej(new Error('the media file decodes to more than the allowed size'))
			}
			out.push(b)
		})
		p.stderr.on('data', (b: Buffer) => {
			if (err.length < 2000) err += b.toString()
		})
		p.on('error', (e) => rej(new Error(`ffmpeg could not be started: ${e.message}`)))
		p.on('close', (code) =>
			code === 0 ? res(Buffer.concat(out)) : rej(new Error(`ffmpeg failed: ${err.trim() || code}`)),
		)
	})
}

/** An absolute path, so a file name starting with a dash can never be read as an ffmpeg option. */
const input = (path: string): string[] => ['-i', resolve(path)]

/** Decode any audio (or the sound of a video) to 16 kHz mono PCM. */
export async function decodeAudioFile(path: string, o: MediaFileOptions = {}): Promise<Int16Array> {
	const seconds = Math.max(1, Math.min(o.maxSeconds ?? 600, 3600))
	const raw = await ffmpeg(
		[...input(path), '-vn', '-t', String(seconds), '-ac', '1', '-ar', '16000', '-f', 's16le', '-'],
		16000 * 2 * seconds + 4096,
	)
	if (!raw.length) throw new Error(`${path} has no audio`)
	const even = raw.length - (raw.length % 2)
	const copy = Buffer.from(raw.subarray(0, even))
	return new Int16Array(copy.buffer, copy.byteOffset, even >> 1)
}

/** Decode a video to H.264 access units (Annex-B, baseline, a keyframe every two seconds). */
export async function decodeVideoFile(
	path: string,
	o: VideoFileOptions = {},
): Promise<{ frames: Uint8Array[]; fps: number }> {
	const seconds = Math.max(1, Math.min(o.maxSeconds ?? 600, 3600))
	const fps = Math.max(5, Math.min(Math.round(o.fps ?? 15), 30))
	const width = Math.max(64, Math.min(Math.round(o.width ?? 480), 1280))
	const raw = await ffmpeg(
		[
			...input(path),
			'-an',
			'-t',
			String(seconds),
			'-vf',
			`fps=${fps},scale=${width}:-2`,
			'-pix_fmt',
			'yuv420p',
			'-c:v',
			'libx264',
			'-profile:v',
			'baseline',
			'-preset',
			'veryfast',
			'-g',
			String(fps * 2),
			'-x264-params',
			'aud=1:repeat-headers=1',
			'-f',
			'h264',
			'-',
		],
		MAX_BYTES,
	)
	if (!raw.length) throw new Error(`${path} has no video`)
	return { frames: splitAnnexB(raw), fps }
}

/** Turn `audioFile` / `videoFile` into the `audioIn` / `videoFrames` the media session takes. */
export async function resolveCallFiles<
	T extends CallFileOptions & {
		audioIn?: Int16Array
		videoFrames?: Uint8Array[]
		videoFps?: number
	},
>(o: T): Promise<T> {
	if (!o.audioFile && !o.videoFile) return o
	const next = { ...o }
	if (o.videoFile) {
		const v = await decodeVideoFile(o.videoFile, o.fileOptions)
		next.videoFrames = v.frames
		next.videoFps = v.fps
	}
	const sound = o.audioFile ?? o.videoFile
	if (sound && !o.audioIn) {
		try {
			next.audioIn = await decodeAudioFile(sound, o.fileOptions)
		} catch (e) {
			// A silent video is a video; an audio file with no audio is a mistake.
			if (o.audioFile) throw e
		}
	}
	return next
}
