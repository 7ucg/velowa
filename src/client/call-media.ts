import { createSocket, type Socket } from 'node:dgram'
import { performance } from 'node:perf_hooks'
import { encodeNode, type BinaryNode } from '../codec/index.js'
import {
	CallEngine,
	RelayChannel,
	deriveCallParticipantSsrc,
	ensureVoipWasm,
	parseRelayFromNode,
} from '../voip-wasm.js'
import { TypedEmitter } from '../events/emitter.js'

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
	relay: BinaryNode
	/** 16 kHz mono signed 16-bit PCM to speak into the call, played once from the start. */
	audioIn?: Int16Array
}

type MediaEvents = {
	/** The relay accepted us; the media path is up. */
	connected: undefined
	/** A 60 ms chunk of the peer's audio (16 kHz mono PCM). */
	audio: Int16Array
	/** Engine events by name (`RelayAllocated`, `MediaConnected`, ...). */
	event: { name: string; code?: number }
	/** The media path ended (relay failed or the session was closed). */
	closed: { reason: string }
}

/**
 * Drives the call engine for one call: UDP to the relay, the engine's timers, microphone frames in and speaker
 * frames out. The engine itself (E2E-SRTP, STUN allocate, MLow) is the vendored Rust stack.
 */
export class MediaSession extends TypedEmitter<MediaEvents> {
	readonly #engine: CallEngine
	readonly #socket: Socket
	readonly #channel: RelayChannel
	readonly #t0 = performance.now()
	readonly #relay: RelayConfig
	#timer: NodeJS.Timeout | undefined
	#mic: NodeJS.Timeout | undefined
	#closed = false
	#sent = 0
	#received = 0
	#audioIn: Int16Array | undefined
	#audioPos = 0

	constructor(o: MediaSessionOptions) {
		super()
		ensureVoipWasm()
		const bytes = encodeNode({ tag: 'ack', attrs: {}, content: [o.relay] })
		this.#relay = parseRelayFromNode(bytes) as RelayConfig
		const ssrc = deriveCallParticipantSsrc(o.callId, o.selfLid, 0)
		this.#engine = CallEngine.create(
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
				enable_video: false,
				enable_sframe: true,
			}),
		)
		this.#audioIn = o.audioIn
		// Media rides a DataChannel over SCTP over DTLS over this UDP flow (as in WhatsApp Web's peer connection).
		this.#channel = new RelayChannel(this.#relay.relay_ip, this.#relay.relay_port)
		this.#socket = createSocket('udp4')
		this.#socket.on('message', (msg) => {
			if (this.#closed) return
			this.#received++
			const err = this.#channel.handleDatagram(this.#now(), msg)
			if (err) return this.close(`relay: ${err}`)
			this.#pump()
		})
		this.#socket.on('error', (e) => this.close(`socket: ${e.message}`))
	}

	#now(): number {
		return performance.now() - this.#t0
	}

	/** Packets exchanged with the relay so far. */
	get stats(): { sent: number; received: number } {
		return { sent: this.#sent, received: this.#received }
	}

	#started = false

	/** Dial the relay: DTLS handshake first; the engine starts once the media channel is open. */
	start(): void {
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
			// 2. the engine starts when the media channel is up
			if (!this.#started && this.#channel.isOpen()) {
				this.#started = true
				this.#engine.start(this.#now(), Date.now())
				moved = true
			}
			// 3. media messages from the relay go to the engine
			for (let m = this.#channel.pollInbound(); m; m = this.#channel.pollInbound()) {
				this.#engine.handleRelayPacket(this.#now(), m)
				moved = true
			}
			// 4. what the engine wants
			if (this.#started) {
				for (;;) {
					const kind = this.#engine.pollOutput()
					if (kind === 0) break
					moved = true
					if (kind === 1) {
						const pkt = this.#engine.takeTransmit()
						if (pkt) {
							const err = this.#channel.write(this.#now(), pkt)
							if (err) return this.close(`relay: ${err}`)
						}
					} else if (kind === 2) {
						const pcm = this.#engine.takePlayout()
						if (pcm) this.emit('audio', Int16Array.from(pcm))
					} else if (kind === 3) {
						const name = this.#engine.eventName()
						const code = this.#engine.eventCode()
						this.emit('event', { name, ...(code >= 0 && { code }) })
						if (name === 'MediaConnected' || name === 'RelayAllocated') {
							this.emit('connected', undefined)
							this.#startMic()
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

	/** Feed a prepared recording into the call, one 60 ms frame at a time, once the media path is up. */
	#startMic(): void {
		if (this.#mic || !this.#audioIn) return
		this.#mic = setInterval(() => {
			if (this.#closed || !this.#audioIn) return
			const frame = new Int16Array(FRAME_SAMPLES)
			frame.set(this.#audioIn.subarray(this.#audioPos, this.#audioPos + FRAME_SAMPLES))
			this.#audioPos += FRAME_SAMPLES
			this.#engine.handleMicFrame(this.#now(), frame)
			this.#pump()
			if (this.#audioPos >= this.#audioIn.length) {
				clearInterval(this.#mic)
				this.#mic = undefined
			}
		}, FRAME_MS)
	}

	close(reason = 'closed'): void {
		if (this.#closed) return
		this.#closed = true
		if (this.#timer) clearTimeout(this.#timer)
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
