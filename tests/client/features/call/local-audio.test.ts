import { describe, expect, it } from 'vitest'
import { localAudioCommands } from '../../../../src/client/features/call/local-audio.js'

describe('local audio', () => {
	it('builds the pipes for the default devices', () => {
		const c = localAudioCommands({ mic: true, speaker: true })
		expect(c.mic![0]).toBe('parec')
		expect(c.mic![1]).toEqual(
			expect.arrayContaining(['--format=s16le', '--rate=16000', '--channels=1']),
		)
		expect(c.speaker![0]).toBe('pacat')
		expect(c.speaker![1]).toContain('--playback')
		expect(c.mic![1].some((a) => a.startsWith('--device'))).toBe(false)
	})

	it('names a device, and refuses one that is not a plain identifier', () => {
		expect(localAudioCommands({ mic: 'alsa_input.usb-X-00.mono-fallback' }).mic![1]).toContain(
			'--device=alsa_input.usb-X-00.mono-fallback',
		)
		expect(() => localAudioCommands({ speaker: 'x; rm -rf /' })).toThrow()
		expect(() => localAudioCommands({ mic: '--evil' })).not.toThrow() // a leading dash is part of the value, never a flag
		expect(localAudioCommands({}).mic).toBeUndefined()
	})
})
