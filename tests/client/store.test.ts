import { describe, expect, it } from 'vitest'
import type { Client } from '../../src/client/client.js'
import { MemoryStore } from '../../src/client/store.js'

type Listener = (p: never) => void
function fakeClient() {
	const l = new Map<string, Listener[]>()
	const client = {
		on: (e: string, f: Listener) => {
			l.set(e, [...(l.get(e) ?? []), f])
			return () =>
				l.set(
					e,
					(l.get(e) ?? []).filter((x) => x !== f),
				)
		},
	} as unknown as Client
	const emit = (e: string, p: unknown) => (l.get(e) ?? []).forEach((f) => f(p as never))
	return { client, emit, count: (e: string) => l.get(e)?.length ?? 0 }
}

describe('MemoryStore', () => {
	it('keeps the latest messages per chat, oldest first, and the names it saw', () => {
		const { client, emit } = fakeClient()
		const s = new MemoryStore({ perChat: 2 }).bind(client)
		emit('message', { id: '1', from: 'a@g.us', message: {}, timestamp: 10 })
		emit('message', {
			id: '2',
			from: 'a@g.us',
			message: {},
			participant: 'p@lid',
			pushName: 'Pat',
			timestamp: 20,
		})
		emit('message', { id: '3', from: 'a@g.us', message: {}, timestamp: 30 })
		emit('message', { id: '4', from: 'b@s.whatsapp.net', message: {}, timestamp: 40 })
		expect(s.messages('a@g.us').map((m) => m.id)).toEqual(['2', '3']) // capped at 2
		expect(s.message('a@g.us', '3')?.id).toBe('3')
		expect(s.message('a@g.us', '1')).toBeUndefined()
		expect(s.name('p@lid')).toBe('Pat')
		expect(s.chats().map((c) => c.jid)).toEqual(['b@s.whatsapp.net', 'a@g.us'])
	})

	it('stores a resent message too and stops listening when unbound', () => {
		const { client, emit, count } = fakeClient()
		const s = new MemoryStore().bind(client)
		emit('message.resent', {
			key: { remoteJid: 'a@g.us', id: 'R', participant: 'p@lid' },
			message: { conversation: 'x' },
			timestamp: 5,
		})
		expect(s.message('a@g.us', 'R')?.participant).toBe('p@lid')
		s.unbind()
		expect(count('message')).toBe(0)
		emit('message', { id: 'late', from: 'a@g.us', message: {} })
		expect(s.message('a@g.us', 'late')).toBeUndefined()
	})

	it('drops the least recently active chats and the oldest names when full', () => {
		const { client, emit } = fakeClient()
		const s = new MemoryStore({ maxChats: 2, maxNames: 2 }).bind(client)
		emit('message', { id: '1', from: 'a', message: {}, pushName: 'A', timestamp: 1 })
		emit('message', { id: '2', from: 'b', message: {}, pushName: 'B', timestamp: 2 })
		emit('message', { id: '3', from: 'a', message: {}, timestamp: 3 }) // a is active again
		emit('message', { id: '4', from: 'c', message: {}, pushName: 'C'.repeat(500), timestamp: 4 })
		expect(
			s
				.chats()
				.map((c) => c.jid)
				.sort(),
		).toEqual(['a', 'c'])
		expect(s.message('b', '2')).toBeUndefined()
		expect(s.name('a')).toBeUndefined() // names capped at 2: a was the oldest
		expect(s.name('b')).toBe('B')
		expect(s.name('c')).toHaveLength(128)
	})
})
