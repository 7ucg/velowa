import { describe, expect, it } from 'vitest'
import { backoffDelayMs, fibonacciBackoffMs } from '../../src/client/reconnect-backoff.js'

describe('fibonacciBackoffMs', () => {
	it("follows WA Web's own schedule in seconds, capped at 900", () => {
		const seconds = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 900]
		for (const [attempt, s] of seconds.entries()) expect(fibonacciBackoffMs(attempt)).toBe(s * 1000)
	})

	it('stays at the cap for any attempt past it, however large', () => {
		expect(fibonacciBackoffMs(16)).toBe(900_000)
		expect(fibonacciBackoffMs(64)).toBe(900_000)
		expect(fibonacciBackoffMs(1_000_000)).toBe(900_000)
	})
})

describe('backoffDelayMs', () => {
	it('spreads +-10% around the base, inclusive at both ends', () => {
		expect(backoffDelayMs(1000, () => 0)).toBe(900)
		expect(backoffDelayMs(1000, () => 0.999999)).toBe(1100)
		expect(backoffDelayMs(1000, () => 0.5)).toBe(1000)
	})
})
