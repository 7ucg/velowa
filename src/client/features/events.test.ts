import { describe, expect, it } from 'vitest'
import { parsePresence, parseReceipt } from './events.js'

describe('incoming receipts and presence', () => {
	it('parses delivery, read and batched receipts', () => {
		expect(
			parseReceipt({
				tag: 'receipt',
				attrs: { from: 'a@s.whatsapp.net', id: 'M1', t: '1700000000' },
			}),
		).toEqual({ chat: 'a@s.whatsapp.net', ids: ['M1'], type: 'delivery', timestamp: 1700000000 })
		expect(
			parseReceipt({
				tag: 'receipt',
				attrs: { from: 'g@g.us', id: 'M1', type: 'read', participant: 'p@lid' },
				content: [
					{
						tag: 'list',
						attrs: {},
						content: [
							{ tag: 'item', attrs: { id: 'M2' } },
							{ tag: 'item', attrs: { id: 'M3' } },
						],
					},
				],
			}),
		).toEqual({ chat: 'g@g.us', participant: 'p@lid', ids: ['M1', 'M2', 'M3'], type: 'read' })
	})

	it('parses online/offline and typing', () => {
		expect(
			parsePresence({
				tag: 'presence',
				attrs: { from: 'a@s.whatsapp.net', type: 'unavailable', last: '1700000000' },
			}),
		).toEqual({ chat: 'a@s.whatsapp.net', state: 'unavailable', lastSeen: 1700000000 })
		expect(
			parsePresence({ tag: 'presence', attrs: { from: 'a@s.whatsapp.net', last: 'deny' } }),
		).toEqual({ chat: 'a@s.whatsapp.net', state: 'available' })
		expect(
			parsePresence({
				tag: 'chatstate',
				attrs: { from: 'g@g.us', participant: 'p@lid' },
				content: [{ tag: 'composing', attrs: { media: 'audio' } }],
			}),
		).toEqual({ chat: 'g@g.us', participant: 'p@lid', state: 'recording' })
		expect(
			parsePresence({
				tag: 'chatstate',
				attrs: { from: 'a@x' },
				content: [{ tag: 'paused', attrs: {} }],
			})?.state,
		).toBe('paused')
		expect(parsePresence({ tag: 'chatstate', attrs: { from: 'a@x' } })).toBeUndefined()
		expect(
			parsePresence({ tag: 'presence', attrs: { from: 'a@x', type: 'weird' } }),
		).toBeUndefined()
		expect(
			parseReceipt({ tag: 'receipt', attrs: { from: 'a@x', id: 'M', t: 'NaN' } }).timestamp,
		).toBeUndefined()
	})
})
