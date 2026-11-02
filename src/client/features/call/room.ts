// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { TypedEmitter } from '../../../events/emitter.js'
import type { CallEvent } from './call-events.js'

// A "room": a call link that the account owns and runs. People open the link in a browser (with or without a
// WhatsApp account), ask to join, and the room lets them in by a rule you choose.

export interface RoomPerson {
	jid: string
	/** The name they typed (guests) or their push name. */
	name?: string
	/** True for someone without a WhatsApp account. */
	guest: boolean
}

/**
 * Who gets in: `'all'` everybody, `'guests'` only people without an account, `'none'` nobody automatically (you
 * call `admit` yourself), or a function that decides per request.
 */
export type RoomAdmit = 'all' | 'guests' | 'none' | ((p: RoomPerson) => boolean | Promise<boolean>)

export interface RoomOptions {
	/** `'video'` (default) rooms also take cameras; `'audio'` rooms are voice only. */
	media?: 'audio' | 'video'
	/** Default `'all'`. */
	admit?: RoomAdmit
	/** Stop letting people in once this many are inside (the owner not counted). Default no limit. */
	maxGuests?: number
}

export type RoomEvents = {
	/** Someone asked to join. */
	request: RoomPerson
	/** Someone was let in (by the rule or by `admit`). */
	admitted: RoomPerson
	/** Someone was turned away. */
	denied: RoomPerson
	/** Someone is in the call (connected). */
	joined: RoomPerson
	/** Someone left the call. */
	left: RoomPerson
	/** The room was closed. */
	closed: { reason: string }
	/** Everything the room saw, as it came: for logging. */
	trace: { kind: string; data: unknown }
}

/** What a room needs from the client. */
export interface RoomHost {
	on(event: 'call', listener: (e: CallEvent) => void): () => void
	setApprovalRequired(callId: string, enabled: boolean): Promise<void>
	answerWaitingRoom(callId: string, user: string, admit?: boolean): Promise<void>
	endCall(callId: string): Promise<void>
}

const bare = (jid: string): string => jid.replace(/:\d+@/, '@')

export class Room extends TypedEmitter<RoomEvents> {
	/** The link to hand out. */
	readonly url: string
	readonly token: string
	readonly callId: string
	readonly media: 'audio' | 'video'
	readonly #host: RoomHost
	readonly #rule: RoomAdmit
	readonly #maxGuests: number
	readonly #waiting = new Map<string, RoomPerson>()
	readonly #inside = new Map<string, RoomPerson>()
	readonly #handled = new Set<string>()
	readonly #owner: string
	#off: (() => void) | undefined
	#closed = false

	constructor(
		host: RoomHost,
		info: { url: string; token: string; callId: string; media: 'audio' | 'video'; owner: string },
		o: RoomOptions = {},
	) {
		super()
		this.#host = host
		this.url = info.url
		this.token = info.token
		this.callId = info.callId
		this.media = info.media
		this.#owner = bare(info.owner)
		this.#rule = o.admit ?? 'all'
		this.#maxGuests = o.maxGuests ?? Number.POSITIVE_INFINITY
		this.#off = host.on('call', (e) => void this.#handle(e))
	}

	/** People waiting to be let in. */
	get waiting(): RoomPerson[] {
		return [...this.#waiting.values()]
	}

	/** People in the call now (the owner not included). */
	get inside(): RoomPerson[] {
		return [...this.#inside.values()]
	}

	get closed(): boolean {
		return this.#closed
	}

	/** Let a waiting person in. */
	async admit(jid: string): Promise<void> {
		const p = this.#waiting.get(bare(jid)) ?? { jid, guest: false }
		await this.#host.answerWaitingRoom(this.callId, jid, true)
		this.#waiting.delete(bare(jid))
		this.emit('admitted', p)
	}

	/** Turn a waiting person away. */
	async deny(jid: string): Promise<void> {
		const p = this.#waiting.get(bare(jid)) ?? { jid, guest: false }
		await this.#host.answerWaitingRoom(this.callId, jid, false)
		this.#waiting.delete(bare(jid))
		this.emit('denied', p)
	}

	/** Ask for approval (the default) or let everybody straight in. */
	setApprovalRequired(on: boolean): Promise<void> {
		return this.#host.setApprovalRequired(this.callId, on)
	}

	/** End the call for everybody and stop watching. */
	async close(reason = 'closed'): Promise<void> {
		if (this.#closed) return
		this.#closed = true
		this.#off?.()
		this.#off = undefined
		await this.#host.endCall(this.callId).catch(() => undefined)
		this.emit('closed', { reason })
	}

	async #decide(p: RoomPerson): Promise<boolean> {
		if (this.#inside.size >= this.#maxGuests) return false
		if (this.#rule === 'all') return true
		if (this.#rule === 'guests') return p.guest
		if (this.#rule === 'none') return false
		return this.#rule(p)
	}

	async #handle(e: CallEvent): Promise<void> {
		if (this.#closed || e.callId !== this.callId) return
		this.emit('trace', { kind: e.status, data: e.node ?? e })
		if (
			e.status === 'terminate' &&
			(e.from === `${this.callId}@call` || bare(e.from) === this.#owner)
		) {
			this.#closed = true
			this.#off?.()
			this.emit('closed', { reason: 'terminated' })
			return
		}
		for (const w of e.waitingRoom ?? []) {
			const key = bare(w.jid)
			if (key === this.#owner || w.state !== 'waiting_room_joined' || this.#handled.has(key))
				continue
			this.#handled.add(key)
			const person: RoomPerson = { jid: w.jid, guest: w.guest, ...(w.name && { name: w.name }) }
			this.#waiting.set(key, person)
			this.emit('request', person)
			try {
				if (await this.#decide(person)) await this.admit(w.jid)
				else if (this.#rule !== 'none') await this.deny(w.jid)
			} catch (err) {
				this.emit('trace', { kind: 'decision-failed', data: String((err as Error).message) })
				this.#handled.delete(key)
			}
		}
		for (const r of e.roster ?? []) {
			const key = bare(r.jid)
			if (key === this.#owner) continue
			const person: RoomPerson = { jid: r.jid, guest: r.guest, ...(r.name && { name: r.name }) }
			if (r.state === 'connected' && !this.#inside.has(key)) {
				this.#inside.set(key, person)
				this.emit('joined', person)
			} else if (r.state === 'terminated' && this.#inside.has(key)) {
				this.#inside.delete(key)
				this.#handled.delete(key)
				this.emit('left', person)
			}
		}
	}
}
