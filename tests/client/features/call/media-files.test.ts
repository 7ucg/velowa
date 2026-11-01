import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
	decodeAudioFile,
	decodeVideoFile,
	resolveCallFiles,
} from '../../../../src/client/features/call/media-files.js'

const haveFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0
const dir = mkdtempSync(join(tmpdir(), 'velowa-media-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe.skipIf(!haveFfmpeg)('call media from files', () => {
	const mp3 = join(dir, 'tone.mp3')
	const mp4 = join(dir, 'clip.mp4')
	const make = (args: string[]) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args])

	it('decodes an mp3 to 16 kHz mono PCM', async () => {
		make(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', mp3])
		const pcm = await decodeAudioFile(mp3)
		expect(pcm.length).toBeGreaterThan(16000 * 1.8)
		expect(pcm.length).toBeLessThan(16000 * 2.3)
		expect(Math.max(...pcm.subarray(8000, 9000))).toBeGreaterThan(1000)
	})

	it('cuts a file at maxSeconds', async () => {
		const pcm = await decodeAudioFile(mp3, { maxSeconds: 1 })
		expect(pcm.length).toBeLessThanOrEqual(16000 + 2000)
	})

	it('decodes an mp4 to H.264 access units and keeps its sound', async () => {
		make([
			'-f',
			'lavfi',
			'-i',
			'testsrc=duration=2:size=320x240:rate=15',
			'-f',
			'lavfi',
			'-i',
			'sine=frequency=330:duration=2',
			'-c:v',
			'libx264',
			'-c:a',
			'aac',
			'-shortest',
			mp4,
		])
		const v = await decodeVideoFile(mp4, { fps: 10, width: 160 })
		expect(v.fps).toBe(10)
		expect(v.frames.length).toBeGreaterThan(15)
		expect(v.frames.length).toBeLessThan(25)
		const o = await resolveCallFiles({ videoFile: mp4 })
		expect(o.videoFrames?.length).toBeGreaterThan(20)
		expect(o.audioIn?.length).toBeGreaterThan(16000)
		expect(o.videoFps).toBe(15)
	})

	it('says so when there is nothing to decode', async () => {
		await expect(decodeAudioFile(join(dir, 'missing.mp3'))).rejects.toThrow(/ffmpeg failed/)
		await expect(resolveCallFiles({ audioFile: mp4 + '.nope' })).rejects.toThrow()
	})
})
