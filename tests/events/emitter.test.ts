import { describe, expect, it } from 'vitest'
import { TypedEmitter } from '../../src/events/emitter.js'

type Events = { message: { text: string }; close: undefined }

describe('TypedEmitter', () => {
	it('delivers payloads and unsubscribes', () => {
		const e = new TypedEmitter<Events>()
		const got: string[] = []
		const off = e.on('message', (m) => got.push(m.text))
		e.emit('message', { text: 'a' })
		off()
		e.emit('message', { text: 'b' })
		expect(got).toEqual(['a'])
	})

	it('exposes an async iterator that ends on abort', async () => {
		const e = new TypedEmitter<Events>()
		const ac = new AbortController()
		const got: string[] = []
		const done = (async () => {
			for await (const m of e.events('message', ac.signal)) got.push(m.text)
		})()
		e.emit('message', { text: 'x' })
		e.emit('message', { text: 'y' })
		await new Promise((r) => setTimeout(r, 0))
		ac.abort()
		await done
		expect(got).toEqual(['x', 'y'])
	})
})
