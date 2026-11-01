import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { BinaryNode } from '../../codec/index.js'
import { buildGenesisPatch, keyId, master } from '../../crypto/appstate.testkit.js'
import { ProtocolLogger } from '../../logging/protocol-logger.js'
import { encodeProto, protoType } from '../proto.js'
import { AppStateSync, interpret } from './appstate-sync.js'
import type { AppStateEvent } from './appstate-sync.js'

const collectionAnswer = (
	name: string,
	patches: Uint8Array[],
	attrs: Record<string, string> = {},
): BinaryNode => ({
	tag: 'iq',
	attrs: { type: 'result' },
	content: [
		{
			tag: 'sync',
			attrs: {},
			content: [
				{
					tag: 'collection',
					attrs: { name, version: '1', has_more_patches: 'false', ...attrs },
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
})

function harness(
	answer: (req: BinaryNode) => BinaryNode,
	dir = mkdtempSync(join(tmpdir(), 'velowa-as-')),
	download?: ConstructorParameters<typeof AppStateSync>[0]['download'],
) {
	const requests: BinaryNode[] = []
	const events: AppStateEvent[] = []
	const sync = new AppStateSync({
		dir,
		request: async (n) => (requests.push(n), answer(n)),
		logger: new ProtocolLogger({ enabled: false }),
		onEvent: (e) => events.push(e),
		...(download && { download }),
	})
	return { sync, requests, events, dir }
}

const collectionReq = (n: BinaryNode) =>
	((n.content as BinaryNode[])[0]!.content as BinaryNode[])[0]!

describe('AppStateSync', () => {
	it('applies a patch with a key shared by the phone and emits the decoded change', async () => {
		const { patch } = buildGenesisPatch(
			master,
			keyId,
			'regular',
			['star', 'chat@s.whatsapp.net', 'MSG1', '1'],
			1700000000,
		)
		const { sync, requests, events } = harness(() => collectionAnswer('regular', [patch]))
		sync.addKeys([{ keyId, keyData: master }])
		await sync.sync(['regular'])
		expect(collectionReq(requests[0]!).attrs).toEqual({
			name: 'regular',
			version: '0',
			return_snapshot: 'true',
		})
		expect(events).toHaveLength(1)
		expect(events[0]).toMatchObject({
			collection: 'regular',
			action: 'star',
			operation: 'set',
			timestamp: 1700000000,
		})
		expect(events[0]!.index).toEqual(['star', 'chat@s.whatsapp.net', 'MSG1', '1'])
		expect(events[0]!.value).toMatchObject({ starAction: { starred: true } })
	})

	it('persists state and keys: a new instance asks for the next version only', async () => {
		const { patch } = buildGenesisPatch(master, keyId, 'regular', ['star', 'c'], 1)
		const first = harness(() => collectionAnswer('regular', [patch]))
		first.sync.addKeys([{ keyId, keyData: master }])
		await first.sync.sync(['regular'])
		const second = harness(
			() => ({
				tag: 'iq',
				attrs: {},
				content: [
					{
						tag: 'sync',
						attrs: {},
						content: [{ tag: 'collection', attrs: { name: 'regular', version: '1' } }],
					},
				],
			}),
			first.dir,
		)
		expect(second.sync.keyCount).toBe(1)
		await second.sync.sync(['regular'])
		expect(collectionReq(second.requests[0]!).attrs).toEqual({
			name: 'regular',
			version: '1',
			return_snapshot: 'false',
		})
		expect(second.events).toHaveLength(0)
	})

	it('does not loop forever when the key is missing, and emits nothing', async () => {
		const { patch } = buildGenesisPatch(master, keyId, 'regular', ['star', 'c'], 1)
		const { sync, requests, events } = harness(() => collectionAnswer('regular', [patch]))
		await sync.sync(['regular'])
		expect(events).toHaveLength(0)
		expect(requests.length).toBeLessThanOrEqual(3)
	})

	it('inlines external mutations before verification', async () => {
		const { patch } = buildGenesisPatch(master, keyId, 'regular', ['star', 'c'], 5)
		const T = protoType('SyncdPatch')
		const obj = T.toObject(T.decode(patch), { bytes: Uint8Array }) as { mutations: unknown[] }
		const external = encodeProto('SyncdPatch', {
			...obj,
			mutations: [],
			externalMutations: { directPath: '/v/x', mediaKey: new Uint8Array(32) },
		})
		const blob = encodeProto('SyncdMutations', { mutations: obj.mutations })
		const { sync, events } = harness(
			() => collectionAnswer('regular', [external]),
			undefined,
			async (ref, type) => {
				expect(type).toBe('md-app-state')
				expect(ref.directPath).toBe('/v/x')
				return Buffer.from(blob)
			},
		)
		sync.addKeys([{ keyId, keyData: master }])
		await sync.sync(['regular'])
		expect(events).toHaveLength(1)
	})
})

describe('AppStateSync hardening', () => {
	it('ignores collection names the server invents (they end up in file names)', async () => {
		const { patch } = buildGenesisPatch(master, keyId, 'regular', ['star', 'c'], 1)
		const { sync, events, dir } = harness(() => collectionAnswer('../../evil', [patch]))
		sync.addKeys([{ keyId, keyData: master }])
		await sync.sync(['regular'])
		expect(events).toHaveLength(0)
		const { existsSync } = await import('node:fs')
		expect(existsSync(join(dir, '../../evil.state'))).toBe(false)
		await sync.sync(['../../x', 'regular_low']) // notification-driven names are filtered too
	})

	it('stops when the server keeps announcing more patches without progress', async () => {
		let calls = 0
		const { sync } = harness(() => {
			calls++
			return collectionAnswer('regular', [], { has_more_patches: 'true' })
		})
		sync.addKeys([{ keyId, keyData: master }])
		await sync.sync(['regular'])
		expect(calls).toBe(1)
	})
})

describe('interpret', () => {
	const ev = (
		action: string,
		value: Record<string, unknown>,
		operation: 'set' | 'remove' = 'set',
		more: string[] = ['c@s.whatsapp.net'],
	): AppStateEvent => ({
		collection: 'regular_low',
		index: [action, ...more],
		action,
		operation,
		value,
	})
	it('maps the common chat actions', () => {
		expect(
			interpret(ev('mute', { muteAction: { muted: true, muteEndTimestamp: '1800000000' } })).chat,
		).toEqual({ id: 'c@s.whatsapp.net', muteEndTimestamp: 1800000000 })
		expect(interpret(ev('mute', { muteAction: { muted: false } })).chat).toEqual({
			id: 'c@s.whatsapp.net',
			muteEndTimestamp: null,
		})
		expect(interpret(ev('archive', { archiveChatAction: { archived: true } })).chat).toMatchObject({
			archived: true,
		})
		expect(interpret(ev('pin_v1', { pinAction: { pinned: true } })).chat).toMatchObject({
			pinned: true,
		})
		expect(
			interpret(ev('markChatAsRead', { markChatAsReadAction: { read: false } })).chat,
		).toMatchObject({ unread: true })
		expect(interpret({ ...ev('deleteChat', {}, 'remove'), value: undefined }).chat).toMatchObject({
			deleted: true,
		})
	})
	it('maps contacts and the push name', () => {
		expect(
			interpret(ev('contact', { contactAction: { fullName: 'Max Muster', firstName: 'Max' } }))
				.contact,
		).toEqual({ id: 'c@s.whatsapp.net', fullName: 'Max Muster', firstName: 'Max' })
		expect(
			interpret(ev('setting_pushName', { pushNameSetting: { name: 'Rami' } }, 'set', [])).pushName,
		).toBe('Rami')
		expect(interpret(ev('label_edit', {})).chat).toBeUndefined()
	})
})
