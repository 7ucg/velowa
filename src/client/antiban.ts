// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { createHash } from 'node:crypto'

/** What the limiter does when a send would break a limit it cannot wait out. */
export class AntiBanError extends Error {
	constructor(
		message: string,
		readonly reason: 'day-limit' | 'hour-limit' | 'identical-messages',
	) {
		super(message)
		this.name = 'AntiBanError'
	}
}

export interface AntiBanConfig {
	/** Sliding-window caps; a send over the minute cap waits, over the hour/day cap throws `AntiBanError`. */
	maxPerMinute: number
	maxPerHour: number
	maxPerDay: number
	/** Random pause between two sends, once the burst allowance is used up. */
	minDelayMs: number
	maxDelayMs: number
	/** Extra pause before the first message to a chat we have not written to in this session. */
	newChatDelayMs: number
	/** The same text more than this often within `identicalWindowMs` is refused (copy-paste spam). */
	maxIdenticalMessages: number
	identicalWindowMs: number
	/** Messages that go out without the random pause, after a quiet spell of `burstResetMs`. */
	burstAllowance: number
	burstResetMs: number
	/**
	 * New accounts get a fraction of the caps that grows to 100 % over `warmUpDays` after `firstSeen`
	 * (pass the account's creation time; unset disables the ramp-up).
	 */
	warmUpDays: number
	firstSeen?: number
	/** Show "typing..." for a moment before text goes out, as a person typing would. */
	typing: boolean
}

export const ANTIBAN_DEFAULTS: AntiBanConfig = {
	maxPerMinute: 12,
	maxPerHour: 400,
	maxPerDay: 2500,
	minDelayMs: 1200,
	maxDelayMs: 4000,
	newChatDelayMs: 2000,
	maxIdenticalMessages: 10,
	identicalWindowMs: 30 * 60_000,
	burstAllowance: 5,
	burstResetMs: 30_000,
	warmUpDays: 0,
	typing: false,
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

type Clock = { now(): number; sleep(ms: number): Promise<void> }
const realClock: Clock = {
	now: () => Date.now(),
	sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
}

/**
 * Keeps an account's sending pattern human-looking: caps per minute/hour/day, random gaps, a pause before new
 * chats, a limit on identical texts, and an optional warm-up for fresh accounts. In memory only: a restart starts
 * the windows from zero.
 */
export class AntiBan {
	readonly config: AntiBanConfig
	readonly #sent: number[] = []
	readonly #identical = new Map<string, number[]>()
	readonly #chats = new Set<string>()
	#burst = 0
	#last = 0
	#tail: Promise<void> = Promise.resolve()

	constructor(
		config: Partial<AntiBanConfig> = {},
		private readonly clock: Clock = realClock,
		private readonly random: () => number = Math.random,
	) {
		this.config = { ...ANTIBAN_DEFAULTS, ...config }
	}

	/** Fraction of the caps that applies right now (1 = full). */
	warmUpFactor(): number {
		const { warmUpDays, firstSeen } = this.config
		if (!warmUpDays || firstSeen === undefined) return 1
		const age = (this.clock.now() - firstSeen) / DAY
		return Math.min(1, Math.max(0.1, age / warmUpDays))
	}

	/** Stable key of a message's content for the identical-text check. */
	static signature(content: string): string {
		return createHash('sha1').update(content).digest('hex')
	}

	/**
	 * Wait until sending `signature` to `chat` is fine, or throw `AntiBanError`. Calls are served in order, so a loop
	 * that fires many sends at once is spread out.
	 */
	gate(chat: string, signature: string): Promise<void> {
		const run = this.#tail.then(() => this.#gate(chat, signature))
		this.#tail = run.catch(() => undefined)
		return run
	}

	async #gate(chat: string, signature: string): Promise<void> {
		const c = this.config
		const f = this.warmUpFactor()
		const cap = (n: number) => Math.max(1, Math.floor(n * f))
		let now = this.clock.now()
		this.#prune(now)

		if (this.#count(now, DAY) >= cap(c.maxPerDay))
			throw new AntiBanError('daily message cap reached', 'day-limit')
		if (this.#count(now, HOUR) >= cap(c.maxPerHour))
			throw new AntiBanError('hourly message cap reached', 'hour-limit')
		const same = this.#identical.get(signature) ?? []
		if (same.length >= c.maxIdenticalMessages)
			throw new AntiBanError('too many identical messages', 'identical-messages')

		// Over the minute cap: wait for the oldest send of the last minute to fall out of the window.
		const minute = this.#sent.filter((t) => now - t < MINUTE)
		if (minute.length >= cap(c.maxPerMinute)) {
			await this.clock.sleep(minute[0]! + MINUTE - now + 1)
			now = this.clock.now()
		}

		if (now - this.#last > c.burstResetMs) this.#burst = 0
		// The random gap counts from the last send; the new-chat pause is on top of it.
		let gap = 0
		if (this.#burst >= c.burstAllowance)
			gap = c.minDelayMs + this.random() * (c.maxDelayMs - c.minDelayMs)
		gap = Math.max(0, gap - (now - this.#last))
		const wait = gap + (this.#chats.has(chat) ? 0 : c.newChatDelayMs)
		if (wait > 0) {
			await this.clock.sleep(wait)
			now = this.clock.now()
		}

		this.#burst++
		this.#last = now
		this.#chats.add(chat)
		this.#sent.push(now)
		this.#identical.set(signature, [...same, now])
	}

	#count(now: number, window: number): number {
		return this.#sent.filter((t) => now - t < window).length
	}

	#prune(now: number): void {
		while (this.#sent.length && now - this.#sent[0]! >= DAY) this.#sent.shift()
		for (const [k, v] of this.#identical) {
			const keep = v.filter((t) => now - t < this.config.identicalWindowMs)
			if (keep.length) this.#identical.set(k, keep)
			else this.#identical.delete(k)
		}
	}

	/** How long "typing..." should last for a text (about 40 ms per character, 600 ms to 4 s). */
	typingMs(text: string): number {
		return Math.min(4000, Math.max(600, text.length * 40)) * (0.8 + this.random() * 0.4)
	}
}
