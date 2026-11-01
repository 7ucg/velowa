import { spawn, type ChildProcess } from 'node:child_process'

// The machine's microphone and speaker for a call, through PulseAudio / PipeWire's `parec` and `pacat`.
// Node has no audio API; these two tools are on every desktop Linux and speak raw PCM on a pipe.

export interface LocalAudioOptions {
	/** Send the microphone: `true` for the default source, or a source name from `pactl list short sources`. */
	mic?: boolean | string
	/** Play the call: `true` for the default sink, or a sink name from `pactl list short sinks`. */
	speaker?: boolean | string
}

/** Pulse device names are plain identifiers; anything else never reaches a command line. */
const DEVICE = /^[A-Za-z0-9_.:@+-]{1,200}$/

const RAW = ['--raw', '--format=s16le', '--rate=16000', '--channels=1', '--latency-msec=60']

/** The command lines for the two pipes (exported for tests). */
export function localAudioCommands(o: LocalAudioOptions): {
	mic?: [string, string[]]
	speaker?: [string, string[]]
} {
	const device = (name: boolean | string | undefined, flag: string): string[] => {
		if (typeof name !== 'string') return []
		if (!DEVICE.test(name)) throw new Error(`not a valid audio device name: ${name}`)
		return [`${flag}=${name}`]
	}
	return {
		...(o.mic && { mic: ['parec', [...RAW, ...device(o.mic, '--device')]] as [string, string[]] }),
		...(o.speaker && {
			speaker: ['pacat', ['--playback', ...RAW, ...device(o.speaker, '--device')]] as [
				string,
				string[],
			],
		}),
	}
}

export interface LocalAudioHandle {
	/** Play a chunk of the call (16 kHz mono PCM). */
	play(pcm: Int16Array): void
	stop(): void
}

/**
 * Start the pipes. `onMic` gets microphone samples as they are captured; `onError` hears about a tool that is
 * missing or dies (the call goes on without that side).
 */
export function startLocalAudio(
	o: LocalAudioOptions,
	onMic: (pcm: Int16Array) => void,
	onError: (what: string, e: Error) => void,
): LocalAudioHandle {
	const cmd = localAudioCommands(o)
	const procs: ChildProcess[] = []
	let speakerIn: ChildProcess | undefined
	if (cmd.mic) {
		const p = spawn(cmd.mic[0], cmd.mic[1], { stdio: ['ignore', 'pipe', 'ignore'] })
		p.on('error', (e) => onError('microphone', e))
		let rest = Buffer.alloc(0)
		p.stdout!.on('data', (chunk: Buffer) => {
			rest = Buffer.concat([rest, chunk])
			const whole = rest.length - (rest.length % 2)
			if (!whole) return
			const copy = Buffer.from(rest.subarray(0, whole))
			rest = rest.subarray(whole)
			onMic(new Int16Array(copy.buffer, copy.byteOffset, whole >> 1))
		})
		procs.push(p)
	}
	if (cmd.speaker) {
		const p = spawn(cmd.speaker[0], cmd.speaker[1], { stdio: ['pipe', 'ignore', 'ignore'] })
		p.on('error', (e) => onError('speaker', e))
		p.stdin!.on('error', () => undefined)
		speakerIn = p
		procs.push(p)
	}
	return {
		play(pcm) {
			const stdin = speakerIn?.stdin
			// Never let a slow sink pile audio up in memory: drop what it cannot take.
			if (!stdin || stdin.destroyed || stdin.writableLength > 64 * 1024) return
			stdin.write(Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength))
		},
		stop() {
			for (const p of procs) p.kill('SIGTERM')
		},
	}
}
