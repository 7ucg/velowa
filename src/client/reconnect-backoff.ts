// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.

/** Past this delay, every further attempt stays here: WA Web's own 15-minute ceiling. */
const MAX_MS = 900_000

/** A reconnect attempt counter past this is pointless: `fibonacciBackoffMs` is already at its ceiling long before. */
export const BACKOFF_MAX_ATTEMPTS = 64

/** A connection open this long counts as proven stable: the next disconnect starts the backoff over from attempt 0. */
export const BACKOFF_STABLE_RESET_MS = 30_000

/**
 * WA Web's own reconnect delay for attempt `0, 1, 2, ...`: a Fibonacci sequence in milliseconds
 * (1000, 1000, 2000, 3000, 5000, 8000, ...), capped at `MAX_MS`. Mirrors `fibonacci_base_millis`
 * (`wacore/src/protocol/reconnect.rs`) exactly, including the early-exit once the running value
 * already reached the cap, so a huge `attempt` costs one loop iteration, not thousands.
 */
export function fibonacciBackoffMs(attempt: number): number {
	let a = 1000
	let b = 1000
	for (let i = 0; i < attempt; i++) {
		if (a >= MAX_MS) break
		const next = Math.min(a + b, MAX_MS)
		a = b
		b = next
	}
	return Math.min(a, MAX_MS)
}

/**
 * `baseMs` jittered by +-10%: a uniform sample over `0..=2*spread` added to `baseMs - spread`, same shape as
 * the reference's `backoff_delay`. `random` defaults to `Math.random` and exists only so a test can pin it.
 */
export function backoffDelayMs(baseMs: number, random: () => number = Math.random): number {
	const spread = Math.floor(baseMs / 10)
	return baseMs - spread + Math.floor(random() * (2 * spread + 1))
}
