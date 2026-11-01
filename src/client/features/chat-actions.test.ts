import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { BinaryNode } from '../../codec/index.js'
import { ProtocolLogger } from '../../logging/protocol-logger.js'
import { AppStateSync } from './appstate-sync.js'
import type { AppStateEvent } from './appstate-sync.js'
import * as act from './chat-actions.js'

const KEY_ID = Buffer.from([9, 9, 9, 1])
const KEY = Buffer.alloc(32, 3)
const CHAT = '4915611111111@s.whatsapp.net'

const kids = (n: BinaryNode, tag?: string) =>
	Array.isArray(n.content) ? n.content.filter((c) => !tag || c.tag === tag) : []

function device(answer: (req: BinaryNode) => BinaryNode | Promise<BinaryNode>) {
	const events: AppStateEvent[] = []
	const requests: BinaryNode[] = []
	const sync = new AppStateSync({
		dir: mkdtempSync(join(tmpdir(), 'velowa-act-')),
		request: async (n) => (requests.push(n), answer(n)),
		logger: new ProtocolLogger({ enabled: false }),
		onEvent: (e) => events.push(e),
	})
	sync.addKeys([{ keyId: KEY_ID, keyData: KEY }])
	return { sync, events, requests }
}

const emptyCollection = (name: string, version = '0'): BinaryNode => ({
	tag: 'iq',
	attrs: { type: 'result' },
	content: [{ tag: 'sync', attrs: {}, content: [{ tag: 'collection', attrs: { name, version } }] }],
})

describe('chat actions as outgoing patches', () => {
	it('a patch built by one device is verified and decrypted by another', async () => {
		const sentPatches: Uint8Array[] = []
		const a = device((req) => {
			const col = kids(kids(req, 'sync')[0]!, 'collection')[0]!
			const patch = kids(col, 'patch')[0]
			if (patch) {
				sentPatches.push(patch.content as Uint8Array)
				return { tag: 'iq', attrs: { type: 'result' } }
			}
			return emptyCollection(col.attrs['name']!, col.attrs['version'])
		})

		const first = act.archive(CHAT, true)
		await a.sync.push(first.collection, [act.toOutgoing(first)])
		const second = act.archive(CHAT, false)
		await a.sync.push(second.collection, [act.toOutgoing(second)])
		expect(sentPatches).toHaveLength(2)
		expect(
			a.events.map((e) =>
				Boolean(
					(e.value as { archiveChatAction: { archived?: boolean } }).archiveChatAction.archived,
				),
			),
		).toEqual([true, false])

		// the "phone": same key, empty state, receives both patches one after another
		let served = 0
		const b = device((req) => {
			const col = kids(kids(req, 'sync')[0]!, 'collection')[0]!
			const patches = sentPatches.slice(served)
			served = sentPatches.length
			return {
				tag: 'iq',
				attrs: {},
				content: [
					{
						tag: 'sync',
						attrs: {},
						content: [
							{
								tag: 'collection',
								attrs: { name: col.attrs['name']!, version: '2' },
								content: [
									{
										tag: 'patches',
										attrs: {},
										content: patches.map((p) => ({ tag: 'patch', attrs: {}, content: p })),
									},
								],
							},
						],
					},
				],
			}
		})
		await b.sync.sync(['regular_low'])
		expect(b.events.map((e) => e.action)).toEqual(['archive', 'archive'])
		expect(b.events[0]!.index).toEqual(['archive', CHAT])
	})

	it('removal after set keeps the LTHash consistent (verified by the receiving side)', async () => {
		const sent: Uint8Array[] = []
		const a = device((req) => {
			const col = kids(kids(req, 'sync')[0]!, 'collection')[0]!
			const patch = kids(col, 'patch')[0]
			if (patch)
				return (sent.push(patch.content as Uint8Array), { tag: 'iq', attrs: { type: 'result' } })
			return emptyCollection(col.attrs['name']!, col.attrs['version'])
		})
		const set = act.contact(CHAT, { fullName: 'Max Muster' })
		await a.sync.push(set.collection, [act.toOutgoing(set)])
		const remove = act.contact(CHAT, null)
		await a.sync.push(remove.collection, [act.toOutgoing(remove)])
		const b = device((req) => {
			const col = kids(kids(req, 'sync')[0]!, 'collection')[0]!
			return {
				tag: 'iq',
				attrs: {},
				content: [
					{
						tag: 'sync',
						attrs: {},
						content: [
							{
								tag: 'collection',
								attrs: { name: col.attrs['name']!, version: '2' },
								content: [
									{
										tag: 'patches',
										attrs: {},
										content: sent.map((p) => ({ tag: 'patch', attrs: {}, content: p })),
									},
								],
							},
						],
					},
				],
			}
		})
		await b.sync.sync(['critical_unblock_low'])
		expect(b.events.map((e) => [e.action, e.operation])).toEqual([
			['contact', 'set'],
			['contact', 'remove'],
		])
		expect(b.events[0]!.value).toMatchObject({ contactAction: { fullName: 'Max Muster' } })
	})

	it('leaves state untouched when the server rejects the patch, and can retry', async () => {
		let reject = true
		const a = device((req) => {
			const col = kids(kids(req, 'sync')[0]!, 'collection')[0]!
			if (kids(col, 'patch')[0]) {
				if (reject) throw new Error('409 conflict')
				return { tag: 'iq', attrs: { type: 'result' } }
			}
			return emptyCollection(col.attrs['name']!, col.attrs['version'])
		})
		const p = act.pin(CHAT, true)
		await expect(a.sync.push(p.collection, [act.toOutgoing(p)])).rejects.toThrow(/409/)
		expect(a.events).toHaveLength(0)
		reject = false
		await a.sync.push(p.collection, [act.toOutgoing(p)])
		const patchReq = a.requests.filter((r) =>
			kids(kids(r, 'sync')[0]!, 'collection').some((c) => kids(c, 'patch').length),
		)
		// the retry carries the same base version as the rejected attempt (state was not advanced)
		expect(kids(kids(patchReq[0]!, 'sync')[0]!, 'collection')[0]!.attrs['version']).toBe('0')
		expect(kids(kids(patchReq[1]!, 'sync')[0]!, 'collection')[0]!.attrs['version']).toBe('0')
	})

	it('refuses to push without a sync key', async () => {
		const sync = new AppStateSync({
			dir: mkdtempSync(join(tmpdir(), 'velowa-act-')),
			request: async () => emptyCollection('regular'),
			logger: new ProtocolLogger({ enabled: false }),
			onEvent: () => {},
		})
		const m = act.mute(CHAT, null)
		await expect(sync.push(m.collection, [act.toOutgoing(m)])).rejects.toThrow(/sync key/)
	})
})

describe('action builders', () => {
	it('use the same indices and collections as WhatsApp Web', () => {
		expect(act.mute(CHAT, 1800000000000)).toMatchObject({
			collection: 'regular_high',
			mutation: { index: JSON.stringify(['mute', CHAT]) },
		})
		expect(act.archive(CHAT, true).collection).toBe('regular_low')
		expect(act.pin(CHAT, true).mutation.version).toBe(5)
		expect(act.star({ remoteJid: CHAT, id: 'M1', fromMe: true }, true).mutation.index).toBe(
			JSON.stringify(['star', CHAT, 'M1', '1', '0']),
		)
		expect(act.labelChat(CHAT, 'L1', true).mutation.index).toBe(
			JSON.stringify(['label_jid', 'L1', CHAT]),
		)
		expect(act.contact(CHAT, null).mutation.operation).toBe('remove')
		expect(act.pushName('x').collection).toBe('critical_block')
	})

	it('validates the optional message range', () => {
		const g = '120363@g.us'
		expect(() =>
			act.archive(g, true, [
				{ key: { remoteJid: g, id: 'A', fromMe: false }, messageTimestamp: 1 },
			]),
		).toThrow(/participant/)
		expect(() =>
			act.archive(CHAT, true, [
				{ key: { remoteJid: CHAT, id: 'A', fromMe: false }, messageTimestamp: 0 },
			]),
		).toThrow(/timestamp/)
		expect(
			act.archive(CHAT, true, [
				{ key: { remoteJid: CHAT, id: 'A', fromMe: false }, messageTimestamp: 5 },
			]).mutation.valueObject,
		).toMatchObject({
			archiveChatAction: { archived: true, messageRange: { lastMessageTimestamp: 5 } },
		})
	})
})
