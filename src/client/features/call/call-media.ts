// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { startLocalAudio, type LocalAudioHandle, type LocalAudioOptions } from './local-audio.js'
import { createSocket, type Socket } from 'node:dgram'
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { encodeNode, type BinaryNode } from '../../../codec/index.js'
import {
	CallEngine,
	RelayChannel,
	deriveCallParticipantSsrc,
	ensureVoipWasm,
	parseRelayFromNode,
} from '../../../voip-wasm.js'
import { TypedEmitter } from '../../../events/emitter.js'

interface OpusCodec {
	encode(pcm: Buffer, frameSize: number): Buffer
	decode(packet: Buffer): Buffer
	delete(): void
}

/** libopus compiled to WebAssembly (`opusscript`); loaded only for calls. */
function newOpus(): OpusCodec {
	const O = createRequire(import.meta.url)('opusscript') as {
		new (rate: number, channels: number, app: number): OpusCodec
		Application: { VOIP: number }
	}
	return new O(16000, 1, O.Application.VOIP)
}

/** Write 16 kHz mono 16-bit PCM as a WAV file. */
export function writeWav(path: string, pcm: Int16Array, rate = 16000): void {
	const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)
	const h = Buffer.alloc(44)
	h.write('RIFF', 0)
	h.writeUInt32LE(36 + data.length, 4)
	h.write('WAVEfmt ', 8)
	h.writeUInt32LE(16, 16)
	h.writeUInt16LE(1, 20)
	h.writeUInt16LE(1, 22)
	h.writeUInt32LE(rate, 24)
	h.writeUInt32LE(rate * 2, 28)
	h.writeUInt16LE(2, 32)
	h.writeUInt16LE(16, 34)
	h.write('data', 36)
	h.writeUInt32LE(data.length, 40)
	writeFileSync(path, Buffer.concat([h, data]))
}

/**
 * Split an H.264 Annex-B stream into access units. Needs access-unit delimiters (NAL type 9), which encoders write
 * with e.g. `x264 aud=1`; every delimiter starts a new unit.
 */
export function splitAnnexB(data: Uint8Array): Uint8Array[] {
	const starts: number[] = []
	for (let i = 0; i + 3 < data.length; i++) {
		if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1 && (data[i + 3]! & 0x1f) === 9)
			// include a leading zero byte of a 4-byte start code
			starts.push(i > 0 && data[i - 1] === 0 ? i - 1 : i)
	}
	if (!starts.length) throw new Error('no access-unit delimiters; encode with x264 aud=1')
	return starts.map((s, k) => data.subarray(s, starts[k + 1] ?? data.length))
}

/** Most decoders a group call keeps (WhatsApp group calls hold far fewer people). */
const MAX_DECODERS = 64

/** One mic frame is 60 ms of 16 kHz mono PCM. */
export const FRAME_SAMPLES = 960
const FRAME_MS = 60

export interface RelayConfig {
	relay_ip: string
	relay_port: number
	relay_token: number[]
	auth_token: number[]
	integrity_key: number[]
	warp_mi_tag_len: number
}

export interface MediaSessionOptions {
	callId: string
	direction: 'incoming' | 'outgoing'
	selfLid: string
	peerLid: string
	callKey: Uint8Array
	/** The `<relay>` block of the offer ack (outgoing) or the offer (incoming). */
	relay?: BinaryNode
	/** Group calls: an engine already built from the roster snapshot, and where the shared relay is. */
	group?: { engine: CallEngine; relay: { ip: string; port: number } }
	/** 16 kHz mono signed 16-bit PCM to speak into the call, played once from the start. */
	audioIn?: Int16Array
	/** Audio codec on the wire: standard Opus (default) or MLow. Must match what the offer announced. */
	codec?: 'opus' | 'mlow'
	/** Save what the peer says (16 kHz mono WAV) when the session ends. */
	recordTo?: string
	/** Video calls: H.264 access units to send (looped) and where to save the peer's stream (Annex-B). */
	video?: { frames: Uint8Array[]; fps?: number }
	recordVideoTo?: string
	/** Build the video plane: the call is a video call. */
	enableVideo?: boolean
	/** Use this machine's microphone and speaker for the call (PulseAudio / PipeWire). */
	localAudio?: LocalAudioOptions
}

type MediaEvents = {
	/** The relay accepted us; the media path is up. */
	connected: undefined
	/** One access unit (Annex-B) of the peer's video. */
	video: Uint8Array
	/** Group calls: who is speaking in the chunk of the last `audio` event. */
	speaker: string
	/** A 60 ms chunk of the peer's audio (16 kHz mono PCM). */
	audio: Int16Array
	/** Engine events by name (`RelayAllocated`, `MediaConnected`, ...). */
	event: { name: string; code?: number; detail?: string }
	/** The media path ended (relay failed or the session was closed). */
	closed: { reason: string }
}

/**
 * Drives the call engine for one call: UDP to the relay, the engine's timers, microphone frames in and speaker
 * frames out. The engine itself (E2E-SRTP, STUN allocate, MLow) is the vendored Rust stack.
 */
export class MediaSession extends TypedEmitter<MediaEvents> {
	readonly #engine: CallEngine
	#socket: Socket
	#channel: RelayChannel
	/** A replacement channel is dialling; the engine waits for it before it sends again. */
	#redial = false
	readonly #t0 = performance.now()
	#relay: RelayConfig
	#timer: NodeJS.Timeout | undefined
	#mic: NodeJS.Timeout | undefined
	#closed = false
	#sent = 0
	#received = 0
	#audioIn: Int16Array | undefined
	#localAudioOptions: LocalAudioOptions | undefined
	#local: LocalAudioHandle | undefined
	#audioPos = 0

	constructor(o: MediaSessionOptions) {
		super()
		ensureVoipWasm()
		if (o.group) {
			this.#relay = {
				relay_ip: o.group.relay.ip,
				relay_port: o.group.relay.port,
				relay_token: [],
				auth_token: [],
				integrity_key: [],
				warp_mi_tag_len: 4,
			}
		} else {
			if (!o.relay) throw new Error('a call needs a relay')
			const bytes = encodeNode({ tag: 'ack', attrs: {}, content: [o.relay] })
			this.#relay = parseRelayFromNode(bytes) as RelayConfig
		}
		const ssrc = o.group ? 0 : deriveCallParticipantSsrc(o.callId, o.selfLid, 0)
		this.#engine =
			o.group?.engine ??
			CallEngine.create(
				JSON.stringify({
					call_id: o.callId,
					direction: o.direction,
					self_lid: o.selfLid,
					peer_lid: o.peerLid,
					call_key: [...o.callKey],
					ssrc,
					relay_token: this.#relay.relay_token,
					auth_token: this.#relay.auth_token,
					relay_ip: this.#relay.relay_ip,
					relay_port: this.#relay.relay_port,
					integrity_key: this.#relay.integrity_key,
					warp_mi_tag_len: this.#relay.warp_mi_tag_len,
					enable_media: true,
					enable_video: !!o.enableVideo,
					enable_sframe: true,
					audio: o.codec === 'mlow' ? 'mlow' : 'opus',
				}),
			)
		this.#audioIn = o.audioIn
		this.#localAudioOptions = o.localAudio
		if (o.codec !== 'mlow') this.#opus = newOpus()
		this.#recordTo = o.recordTo
		this.#videoOut = o.video?.frames
		this.#videoFps = o.video?.fps ?? 15
		this.#recordVideoTo = o.recordVideoTo
		// Media rides a DataChannel over SCTP over DTLS over this UDP flow (as in WhatsApp Web's peer connection).
		this.#channel = new RelayChannel(this.#relay.relay_ip, this.#relay.relay_port)
		this.#socket = this.#openSocket()
	}

	/** One UDP flow per relay channel: a redial must not reuse the 5-tuple of the old DTLS association. */
	#openSocket(): Socket {
		const socket = createSocket('udp4')
		socket.on('message', (msg) => {
			if (this.#closed || socket !== this.#socket) return
			this.#received++
			const err = this.#channel.handleDatagram(this.#now(), msg)
			if (err) return this.close(`relay: ${err}`)
			this.#pump()
		})
		socket.on('error', (e) => this.close(`socket: ${e.message}`))
		return socket
	}

	#now(): number {
		return performance.now() - this.#t0
	}

	/** Packets exchanged with the relay so far. */
	get stats(): { sent: number; received: number } {
		return { sent: this.#sent, received: this.#received }
	}

	/** The engine's own counters (RTP in, SRTP failures, why it is silent) as text. */
	get engineStats(): string {
		return this.#engine.mediaStats()
	}

	#started = false
	#opus: OpusCodec | undefined
	/** Group calls: one Opus decoder per speaking device. */
	readonly #decoders = new Map<string, OpusCodec>()
	#videoOut: Uint8Array[] | undefined
	#videoFps = 15
	#videoPos = 0
	#videoTimer: NodeJS.Timeout | undefined
	#recordVideoTo: string | undefined
	#videoIn: Uint8Array[] = []
	#recordTo: string | undefined
	#recorded: Int16Array[] = []

	/** Dial the relay: DTLS handshake first; the engine starts once the media channel is open. */
	start(): void {
		this.#pump()
	}

	/** Our camera goes on in a running call: the frames are sent (looped) once the plane is up. */
	startVideo(frames: Uint8Array[], fps = 15, gated = false): boolean {
		if (this.#closed || !frames.length) return false
		const ok = this.#engine.enableVideo(gated)
		if (!ok) return false
		this.#videoOut = frames
		this.#videoFps = fps
		if (this.#videoTimer) clearInterval(this.#videoTimer)
		this.#videoTimer = undefined
		this.#videoPos = 0
		this.#startVideo()
		this.#pump()
		return true
	}

	/** The peer accepted our upgrade: let the (held back) outbound video go. */
	releaseVideo(): void {
		this.#engine.enableVideo(false)
		this.#pump()
	}

	/** Our camera goes off; audio carries on. */
	stopVideo(): void {
		if (this.#videoTimer) clearInterval(this.#videoTimer)
		this.#videoTimer = undefined
		this.#videoOut = undefined
		this.#engine.disableVideo()
		this.#pump()
	}

	/** Prepare to receive the peer's video (they turned their camera on). */
	acceptVideo(): boolean {
		const ok = this.#engine.enableVideo(true)
		this.#pump()
		return ok
	}

	/** React in a group call; an empty emoji takes the reaction back. */
	react(emoji: string): void {
		this.#engine.sendGroupReaction(this.#now(), emoji)
		this.#pump()
	}

	/** After the peer answered from a specific device, re-derive the keys we receive with. */
	rekeyRecv(answeringPeerLid: string): boolean {
		return this.#engine.rekeyRecv(answeringPeerLid)
	}

	/**
	 * Move everything that is due: datagrams between the socket and the DTLS/SCTP channel, media messages between
	 * the channel and the engine, then arm one timer for whichever of the two wants waking first.
	 */
	#pump(): void {
		if (this.#closed) return
		for (let guard = 0; guard < 1000; guard++) {
			let moved = false
			// 1. what the channel wants on the wire
			for (let d = this.#channel.pollTransmit(); d; d = this.#channel.pollTransmit()) {
				this.#sent++
				this.#socket.send(d, this.#relay.relay_port, this.#relay.relay_ip)
				moved = true
			}
			if (this.#redial && this.#channel.isOpen()) {
				this.#redial = false
				this.#engine.relayReconnected(this.#now())
				moved = true
			}
			// 2. the engine starts when the media channel is up
			if (!this.#started && this.#channel.isOpen()) {
				this.#started = true
				this.#engine.start(this.#now(), Date.now())
				moved = true
			}
			// 3. media messages from the relay go to the engine
			for (
				let m = this.#channel.pollInbound();
				m && !this.#redial;
				m = this.#channel.pollInbound()
			) {
				this.#engine.handleRelayPacket(this.#now(), m)
				moved = true
			}
			// 4. what the engine wants
			if (this.#started && !this.#redial) {
				for (;;) {
					const kind = this.#engine.pollOutput()
					if (kind === 0) break
					moved = true
					if (kind === 7) {
						// New relay credentials: the old channel is done, the Allocate follows on a fresh one.
						const target = this.#engine.takeReconnect()?.match(/^(.+):(\d+)$/)
						if (target)
							this.#relay = { ...this.#relay, relay_ip: target[1]!, relay_port: Number(target[2]) }
						const old = this.#socket
						this.#channel = new RelayChannel(this.#relay.relay_ip, this.#relay.relay_port)
						this.#socket = this.#openSocket()
						old.close()
						this.#redial = true
						break
					}
					if (kind === 1) {
						const pkt = this.#engine.takeTransmit()
						if (pkt) {
							const err = this.#channel.write(this.#now(), pkt)
							if (err) return this.close(`relay: ${err}`)
						}
					} else if (kind === 4) {
						const au = this.#engine.takeVideo()
						if (au) {
							if (this.#recordVideoTo) this.#videoIn.push(au)
							this.emit('video', au)
						}
					} else if (kind === 6 && this.#opus) {
						const pkt = this.#engine.takeEncodedAudio()
						if (pkt) {
							try {
								const who = this.#engine.encodedSender()
								let dec: OpusCodec = this.#opus
								if (who) {
									const known = this.#decoders.get(who)
									if (known) dec = known
									else {
										// The speaker's id comes from the network: keep at most one decoder per plausible participant.
										if (this.#decoders.size >= MAX_DECODERS) {
											const oldest = this.#decoders.keys().next().value!
											this.#decoders.get(oldest)?.delete()
											this.#decoders.delete(oldest)
										}
										dec = newOpus()
										this.#decoders.set(who, dec)
									}
								}
								if (who) this.emit('speaker', who)
								const raw = dec.decode(Buffer.from(pkt))
								this.#heard(new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1).slice())
							} catch {
								/* one undecodable packet is a gap, not a failure */
							}
						}
					} else if (kind === 2) {
						const pcm = this.#engine.takePlayout()
						if (pcm) this.#heard(Int16Array.from(pcm))
					} else if (kind === 3) {
						const name = this.#engine.eventName()
						const code = this.#engine.eventCode()
						this.emit('event', {
							name,
							...(code >= 0 && { code }),
							...(name === 'Reaction' && { detail: this.#engine.eventDetail() }),
						})
						if (name === 'MediaConnected' || name === 'RelayAllocated') {
							this.emit('connected', undefined)
							this.#startMic()
							this.#startVideo()
						}
						if (
							name === 'RelayAllocateFailed' ||
							name === 'RelayAllocateTimedOut' ||
							name === 'MediaSetupFailed'
						)
							return this.close(name)
					}
				}
			}
			if (!moved) break
		}
		const times = [
			this.#channel.pollTimeout(),
			this.#started ? this.#engine.pollTimeout() : -1,
		].filter((t) => t >= 0)
		if (this.#timer) clearTimeout(this.#timer)
		if (times.length && !this.#closed) {
			const due = Math.min(...times)
			this.#timer = setTimeout(
				() => {
					if (this.#closed) return
					const err = this.#channel.handleTimeout(this.#now())
					if (err) return this.close(`relay: ${err}`)
					if (this.#started) this.#engine.handleTimeout(this.#now())
					this.#pump()
				},
				Math.max(0, due - this.#now()),
			)
		}
	}

	#heard(pcm: Int16Array): void {
		if (this.#recordTo) this.#recorded.push(pcm)
		this.#local?.play(pcm)
		this.emit('audio', pcm)
	}

	#startMic(): void {
		if (this.#mic) return
		if (this.#localAudioOptions && !this.#local)
			this.#local = startLocalAudio(
				this.#localAudioOptions,
				(pcm) => this.feedMic(pcm),
				(what, e) => this.emit('event', { name: `LocalAudioFailed:${what}:${e.message}` }),
			)
		// A call needs a steady stream: the peer shows "reconnecting" a few seconds after the last packet. So the
		// microphone ticks for the whole call and sends silence whenever nothing is queued to say.
		this.#mic = setInterval(() => {
			if (this.#closed) return
			const frame = new Int16Array(FRAME_SAMPLES)
			if (this.#audioIn) {
				frame.set(this.#audioIn.subarray(this.#audioPos, this.#audioPos + FRAME_SAMPLES))
				this.#audioPos += FRAME_SAMPLES
				if (this.#audioPos >= this.#audioIn.length) this.#audioIn = undefined
			}
			if (this.#opus) {
				const enc = this.#opus.encode(Buffer.from(frame.buffer), FRAME_SAMPLES)
				this.#engine.handleEncodedAudio(this.#now(), enc)
			} else this.#engine.handleMicFrame(this.#now(), frame)
			this.#pump()
		}, FRAME_MS)
	}

	#startVideo(): void {
		if (this.#videoTimer || !this.#videoOut?.length) return
		this.#videoTimer = setInterval(
			() => {
				if (this.#closed || !this.#videoOut) return
				const au = this.#videoOut[this.#videoPos % this.#videoOut.length]!
				this.#videoPos++
				this.#engine.handleVideoFrame(this.#now(), au)
				this.#pump()
			},
			Math.round(1000 / this.#videoFps),
		)
	}

	/**
	 * Live microphone samples (16 kHz mono PCM): sent with the next ticks. At most about half a second is kept, so a
	 * capture that runs ahead of the call clock drops its oldest audio instead of falling behind.
	 */
	feedMic(pcm: Int16Array): void {
		const cap = FRAME_SAMPLES * 8
		const rest = this.#audioIn ? this.#audioIn.subarray(this.#audioPos) : new Int16Array(0)
		const next = new Int16Array(Math.min(cap, rest.length + pcm.length))
		const all = new Int16Array(rest.length + pcm.length)
		all.set(rest)
		all.set(pcm, rest.length)
		next.set(all.subarray(all.length - next.length))
		this.#audioIn = next
		this.#audioPos = 0
	}

	/** Say something (16 kHz mono PCM); queued after whatever is still playing. */
	speak(pcm: Int16Array): void {
		const rest = this.#audioIn ? this.#audioIn.subarray(this.#audioPos) : new Int16Array(0)
		const next = new Int16Array(rest.length + pcm.length)
		next.set(rest)
		next.set(pcm, rest.length)
		this.#audioIn = next
		this.#audioPos = 0
	}

	close(reason = 'closed'): void {
		if (this.#closed) return
		this.#closed = true
		if (this.#recordTo && this.#recorded.length) {
			const all = new Int16Array(this.#recorded.reduce((n, c) => n + c.length, 0))
			let at = 0
			for (const c of this.#recorded) {
				all.set(c, at)
				at += c.length
			}
			writeWav(this.#recordTo, all)
		}
		if (this.#videoTimer) clearInterval(this.#videoTimer)
		if (this.#recordVideoTo && this.#videoIn.length)
			writeFileSync(this.#recordVideoTo, Buffer.concat(this.#videoIn))
		for (const d of this.#decoders.values()) d.delete()
		this.#opus?.delete()
		if (this.#timer) clearTimeout(this.#timer)
		this.#local?.stop()
		if (this.#mic) clearInterval(this.#mic)
		try {
			this.#channel.close(this.#now())
		} catch {
			/* channel already gone */
		}
		try {
			this.#socket.close()
		} catch {
			/* already closed */
		}
		this.emit('closed', { reason })
	}
}
