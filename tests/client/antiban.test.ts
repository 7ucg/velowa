import { describe, expect, it } from 'vitest'
import { AntiBan, AntiBanError } from '../../src/client/antiban.js'

function clock() {
	let t = 1_000_000
	const slept: number[] = []
	return {
		slept,
		now: () => t,
		sleep: async (ms: number) => {
			slept.push(ms)
			t += ms
		},
		advance: (ms: number) => (t += ms),
	}
}

describe('AntiBan', () => {
	it('lets a burst through, then spaces sends by a random gap, and delays new chats', async () => {
		const c = clock()
		const ab = new AntiBan(
			{ burstAllowance: 2, newChatDelayMs: 500, minDelayMs: 1000, maxDelayMs: 1000 },
			c,
			() => 0,
		)
		await ab.gate('a', 'x1')
		expect(c.slept).toEqual([500]) // new chat
		await ab.gate('a', 'x2')
		await ab.gate('a', 'x3') // burst used up: 1000 ms gap
		expect(c.slept.at(-1)).toBe(1000)
	})

	it('waits for the minute window and throws at the hour and identical caps', async () => {
		const c = clock()
		const ab = new AntiBan(
			{
				maxPerMinute: 2,
				maxPerHour: 4,
				burstAllowance: 99,
				newChatDelayMs: 0,
				maxIdenticalMessages: 2,
			},
			c,
			() => 0,
		)
		await ab.gate('a', '1')
		await ab.gate('a', '2')
		await ab.gate('a', '3') // minute cap: waits ~60 s
		expect(c.slept.at(-1)!).toBeGreaterThan(50_000)
		await ab.gate('a', '4')
		await expect(ab.gate('a', '5')).rejects.toMatchObject({ reason: 'hour-limit' })
		const ab2 = new AntiBan(
			{ maxIdenticalMessages: 2, burstAllowance: 99, newChatDelayMs: 0 },
			clock(),
			() => 0,
		)
		await ab2.gate('a', 's')
		await ab2.gate('b', 's')
		await expect(ab2.gate('c', 's')).rejects.toBeInstanceOf(AntiBanError)
	})

	it('ramps the caps up for new accounts', () => {
		const c = clock()
		const ab = new AntiBan({ warmUpDays: 10, firstSeen: c.now() - 5 * 86_400_000 }, c)
		expect(ab.warmUpFactor()).toBeCloseTo(0.5)
		expect(new AntiBan({}, c).warmUpFactor()).toBe(1)
	})
})
