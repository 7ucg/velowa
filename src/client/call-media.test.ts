import { describe, expect, it } from 'vitest'
import { splitAnnexB } from './call-media.js'

const nal = (type: number, ...body: number[]) => [0, 0, 0, 1, type, ...body]

describe('splitAnnexB', () => {
	it('starts a new access unit at every delimiter and keeps each unit whole', () => {
		const stream = Uint8Array.from([
			...nal(9, 0xf0),
			...nal(7, 1, 2),
			...nal(5, 9, 9, 9),
			...nal(9, 0xf0),
			...nal(1, 7, 7),
		])
		const units = splitAnnexB(stream)
		expect(units).toHaveLength(2)
		expect([...units[0]!]).toEqual([...nal(9, 0xf0), ...nal(7, 1, 2), ...nal(5, 9, 9, 9)])
		expect([...units[1]!]).toEqual([...nal(9, 0xf0), ...nal(1, 7, 7)])
		expect(units.reduce((n, u) => n + u.length, 0)).toBe(stream.length)
	})

	it('also accepts 3-byte start codes and refuses streams without delimiters', () => {
		expect(splitAnnexB(Uint8Array.from([0, 0, 1, 9, 0xf0, 0, 0, 1, 1, 5]))).toHaveLength(1)
		expect(() => splitAnnexB(Uint8Array.from(nal(5, 1, 2)))).toThrow(/aud=1/)
	})
})
