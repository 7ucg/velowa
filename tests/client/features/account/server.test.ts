import { describe, expect, it } from 'vitest'
import type { BinaryNode } from '../../../../src/codec/index.js'
import {
	ServerInfo,
	abPropsRequest,
	markNotDirtyNode,
	parseAbProps,
	passiveNode,
} from '../../../../src/client/features/account/server.js'

describe('server info', () => {
	it('asks for the experiment flags, with the last hash if known', () => {
		expect(abPropsRequest().content).toEqual([{ tag: 'props', attrs: { protocol: '1' } }])
		expect(abPropsRequest({ hash: 'h', refreshId: '7' }).content).toEqual([
			{ tag: 'props', attrs: { protocol: '1', hash: 'h', refresh_id: '7' } },
		])
	})

	it('reads config codes and values, skipping event sampling entries', () => {
		const res: BinaryNode = {
			tag: 'iq',
			attrs: {},
			content: [
				{
					tag: 'props',
					attrs: { hash: 'H', refresh_id: '9', refresh: '3600' },
					content: [
						{ tag: 'prop', attrs: { config_code: '123', config_value: 'on' } },
						{ tag: 'prop', attrs: { event_code: '5138', sampling_weight: '-1' } },
						{ tag: 'prop', attrs: { config_code: '456' } },
					],
				},
			],
		}
		expect(parseAbProps(res)).toEqual({
			props: { '123': 'on', '456': '' },
			hash: 'H',
			refreshId: '9',
			refresh: 3600,
		})
		expect(parseAbProps({ tag: 'iq', attrs: {} })).toEqual({ props: {} })
	})

	it('builds the passive and active stanzas', () => {
		expect(passiveNode(true).content).toEqual([{ tag: 'active', attrs: {} }])
		expect(passiveNode(false).content).toEqual([{ tag: 'passive', attrs: {} }])
	})

	it('builds the mark-not-dirty stanza', () => {
		const n = markNotDirtyNode('groups', 1700000000)
		expect(n.attrs['xmlns']).toBe('urn:xmpp:whatsapp:dirty')
		expect(n.content).toEqual([
			{ tag: 'clean', attrs: { type: 'groups', timestamp: '1700000000' } },
		])
	})

	it('acknowledges a dirty category as clean', async () => {
		const sent: BinaryNode[] = []
		const s = new ServerInfo(
			async (n) => (sent.push(n), { tag: 'iq', attrs: {} }),
			(async () => ({}) as never) as never,
		)
		await s.markNotDirty('groups', 42)
		expect(sent[0]!.content).toEqual([{ tag: 'clean', attrs: { type: 'groups', timestamp: '42' } }])
	})

	it('uses the ids from WhatsApp Web for the account checks', async () => {
		const calls: unknown[][] = []
		const s = new ServerInfo(
			async () => ({ tag: 'iq', attrs: {} }),
			(async (...a: unknown[]) => (calls.push(a), {})) as never,
		)
		await s.reachoutTimelock()
		await s.newChatCap()
		expect(calls).toEqual([
			['23983697327930364', {}, 'xwa2_fetch_account_reachout_timelock'],
			[
				'27910975521856601',
				{ input: { type: 'INDIVIDUAL_NEW_CHAT_THREAD' } },
				'xwa2_message_capping_info',
			],
		])
	})
})
