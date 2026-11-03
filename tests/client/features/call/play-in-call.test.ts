import { describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '../../../../src/client/client.js'

// A stand-in for the media path with the same queue rules as MediaSession (speak appends, clearAudio drops).
function fakeMedia() {
	let queue = 0
	let paused = false
	const log: string[] = []
	return {
		log,
		get queuedSeconds() {
			return queue / 16000
		},
		get paused() {
			return paused
		},
		pause: () => {
			paused = true
		},
		resume: () => {
			paused = false
		},
		clearAudio: () => {
			queue = 0
			log.push('clear')
		},
		speak: (pcm: Int16Array) => {
			queue += pcm.length
			log.push(`speak ${pcm.length / 16000}s`)
		},
	}
}

function clientWithCall() {
	const client = new Client({ authDir: mkdtempSync(join(tmpdir(), 'velowa-pic-')) })
	const media = fakeMedia()
	;(client.calls as Map<string, unknown>).set('c1', { callId: 'c1', status: 'connected', media })
	;(client.calls as Map<string, unknown>).set('c2', { callId: 'c2', status: 'ringing' }) // no media path yet
	return { client, media }
}

describe('playInCall / stopAudio', () => {
	it('queues audio by default and replaces it with `replace`', async () => {
		const { client, media } = clientWithCall()
		expect(await client.playInCall('c1', new Int16Array(16000 * 3))).toBe(3)
		expect(await client.playInCall('c1', new Int16Array(16000 * 2))).toBe(5) // queued after the first
		expect(await client.playInCall('c1', new Int16Array(16000 * 4), { replace: true })).toBe(4) // changed the music
		expect(media.log).toEqual(['speak 3s', 'speak 2s', 'clear', 'speak 4s'])
		expect(client.queuedAudioSeconds('c1')).toBe(4)
	})

	it('stops the audio and says so when the call has no media path', async () => {
		const { client } = clientWithCall()
		await client.playInCall('c1', new Int16Array(16000))
		client.stopAudio('c1')
		expect(client.queuedAudioSeconds('c1')).toBe(0)
		expect(client.queuedAudioSeconds('c2')).toBeUndefined()
		await expect(client.playInCall('c2', new Int16Array(16))).rejects.toThrow(/no media path/)
		expect(() => client.stopAudio('nope')).toThrow(/no media path/)
	})

	it('pauses and resumes the media of a call and knows when there is none', async () => {
		const { client } = clientWithCall()
		expect(client.isMediaPaused('c1')).toBe(false)
		client.pauseMedia('c1')
		expect(client.isMediaPaused('c1')).toBe(true)
		client.resumeMedia('c1')
		expect(client.isMediaPaused('c1')).toBe(false)
		expect(client.isMediaPaused('c2')).toBeUndefined()
		expect(() => client.pauseMedia('c2')).toThrow(/no media path/)
		expect(() => client.resumeMedia('nope')).toThrow(/no media path/)
	})
})
