import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { encodeProto } from '../../../../src/client/proto.js'
import {
	SentMessageIds,
	detectFakeChat,
	getFakeMsg,
} from '../../../../src/client/features/contact/fake-chat.js'

const notOurs = () => false

describe('SentMessageIds', () => {
	it('tracks ids added in this process', () => {
		const ids = new SentMessageIds()
		expect(ids.has('M1')).toBe(false)
		ids.add('M1')
		expect(ids.has('M1')).toBe(true)
	})

	it('persists across instances, so a reconnect does not forget what we sent', () => {
		const path = join(mkdtempSync(join(tmpdir(), 'velowa-sentids-')), 'sent-ids.json')
		new SentMessageIds(path).add('M1')
		expect(new SentMessageIds(path).has('M1')).toBe(true)
	})

	it('survives a damaged file instead of throwing', () => {
		const path = join(mkdtempSync(join(tmpdir(), 'velowa-sentids-')), 'sent-ids.json')
		writeFileSync(path, 'not json')
		expect(() => new SentMessageIds(path)).not.toThrow()
	})
})

describe('detectFakeChat', () => {
	it('flags a receipt for an id we never sent', () => {
		const ids = new SentMessageIds()
		expect(
			detectFakeChat(
				{ chat: 'mallory@s.whatsapp.net', ids: ['UNKNOWN'], type: 'read' },
				ids,
				notOurs,
			),
		).toEqual({ jid: 'mallory@s.whatsapp.net', ids: ['UNKNOWN'], type: 'read' })
	})

	it('says nothing about a receipt for a message we actually sent', () => {
		const ids = new SentMessageIds()
		ids.add('M1')
		expect(
			detectFakeChat({ chat: 'mallory@s.whatsapp.net', ids: ['M1'], type: 'read' }, ids, notOurs),
		).toBeUndefined()
	})

	it('reports only the ids that do not match, when a receipt batches several', () => {
		const ids = new SentMessageIds()
		ids.add('M1')
		expect(
			detectFakeChat(
				{ chat: 'mallory@s.whatsapp.net', ids: ['M1', 'FORGED'], type: 'read' },
				ids,
				notOurs,
			),
		).toEqual({ jid: 'mallory@s.whatsapp.net', ids: ['FORGED'], type: 'read' })
	})

	it('ignores group receipts (no single sender to blame) and our own account', () => {
		const ids = new SentMessageIds()
		expect(
			detectFakeChat({ chat: '123-456@g.us', ids: ['UNKNOWN'], type: 'read' }, ids, notOurs),
		).toBeUndefined()
		expect(
			detectFakeChat(
				{ chat: '4915600000000@s.whatsapp.net', ids: ['UNKNOWN'], type: 'read' },
				ids,
				(jid) => jid === '4915600000000@s.whatsapp.net',
			),
		).toBeUndefined()
	})
})

describe('getFakeMsg', () => {
	it('builds a deviceSentMessage spoof naming the given jid and a fresh id each time', () => {
		const a = getFakeMsg('alice@s.whatsapp.net', 'hi')
		const b = getFakeMsg('alice@s.whatsapp.net', 'hi')
		expect(a.message).toEqual({
			deviceSentMessage: {
				destinationJid: 'alice@s.whatsapp.net',
				message: { conversation: 'hi' },
			},
		})
		expect(a.opts.messageId).toMatch(/^FAKE[0-9A-F]{16}$/)
		expect(a.opts.messageId).not.toBe(b.opts.messageId)
	})

	it('accepts a full message-content object instead of plain text', () => {
		const fake = getFakeMsg('alice@s.whatsapp.net', { extendedTextMessage: { text: 'hi' } })
		expect(fake.message).toEqual({
			deviceSentMessage: {
				destinationJid: 'alice@s.whatsapp.net',
				message: { extendedTextMessage: { text: 'hi' } },
			},
		})
	})

	it('matches the real proto schema, so a real client accepts it on the wire', () => {
		const fake = getFakeMsg('alice@s.whatsapp.net', 'hi')
		expect(() => encodeProto('Message', fake.message)).not.toThrow()
	})
})
