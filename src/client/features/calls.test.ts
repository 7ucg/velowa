/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import * as callSig from './calls.js'
import {
	buildAccept,
	buildLinkCreate,
	buildLinkQuery,
	callLinkUrl,
	parseCallLinkToken,
	parseLinkCreateAck,
	parseLinkQueryAck,
	buildOffer,
	buildPreaccept,
	buildReject,
	buildTerminate,
	CAPABILITY_OFFER,
	CAPABILITY_STANDARD_OPUS_OFFER,
	newCallId,
} from './calls.js'

const key = (jid: string) => ({ jid, type: 'msg' as const, ciphertext: new Uint8Array([1, 2]) })

describe('call signaling builders', () => {
	it('makes call ids like WhatsApp Web (00 + 15 random bytes)', () => {
		expect(newCallId()).toMatch(/^00[0-9a-f]{30}$/)
		expect(newCallId()).not.toBe(newCallId())
	})

	it('puts the offer children in the order the server enforces', () => {
		const o = buildOffer({
			callId: 'c1',
			to: 'u@lid',
			creator: 'me:24@lid',
			keys: [key('u@lid'), key('u:3@lid')],
			video: true,
			id: 'i1',
			privacyToken: new Uint8Array([9]),
			deviceIdentity: new Uint8Array([7]),
		})
		expect(o.attrs).toEqual({ to: 'u@lid', id: 'i1' })
		const offer = (o.content as any[])[0]
		expect(offer.attrs).toEqual({ 'call-id': 'c1', 'call-creator': 'me:24@lid' })
		expect(offer.content.map((c: any) => c.tag)).toEqual([
			'privacy',
			'audio',
			'video',
			'net',
			'capability',
			'destination',
			'encopt',
			'device-identity',
		])
		expect(offer.content[5].content.map((t: any) => t.attrs.jid)).toEqual(['u@lid', 'u:3@lid'])
	})

	it('addresses a single key bare unless the callee has several devices', () => {
		const one = (
			buildOffer({ callId: 'c', to: 'u@lid', creator: 'me@lid', keys: [key('u@lid')], id: 'i' })
				.content as any[]
		)[0]
		expect(one.content.map((c: any) => c.tag)).toEqual([
			'audio',
			'net',
			'capability',
			'enc',
			'encopt',
		])
		const multi = (
			buildOffer({
				callId: 'c',
				to: 'u@lid',
				creator: 'me@lid',
				keys: [key('u@lid')],
				multiDevice: true,
				id: 'i',
			}).content as any[]
		)[0]
		expect(multi.content.map((c: any) => c.tag)).toContain('destination')
	})

	it('clears the MLow capability bit for the standard-Opus offer', () => {
		expect(CAPABILITY_OFFER[5]! & 0x80).toBe(0x80)
		expect(CAPABILITY_STANDARD_OPUS_OFFER[5]! & 0x80).toBe(0)
		expect(CAPABILITY_STANDARD_OPUS_OFFER[0]).toBe(1)
	})

	it('builds terminate and reject like the reference', () => {
		expect(buildTerminate('c', 'd@lid', 'me@lid', 'i')).toEqual({
			tag: 'call',
			attrs: { to: 'd@lid', id: 'i' },
			content: [{ tag: 'terminate', attrs: { 'call-id': 'c', 'call-creator': 'me@lid' } }],
		})
		expect((buildReject('c', 'd@lid', 'me@lid', 'i').content as any[])[0].attrs.count).toBe('0')
	})

	it('builds accept and preaccept with the children the app sends', () => {
		const a = (buildAccept('c', 'd@lid', 'me@lid', 'i').content as any[])[0]
		expect(a.content.map((c: any) => c.tag)).toEqual([
			'audio',
			'net',
			'encopt',
			'capability',
			'voip_settings',
		])
		expect(a.content[1].attrs.medium).toBe('2')
		expect(a.content[4].attrs.uncompressed).toBe('1')
		const v = (buildAccept('c', 'd@lid', 'me@lid', 'i', true).content as any[])[0]
		expect(v.content.map((c: any) => c.tag)).toEqual([
			'audio',
			'video',
			'net',
			'encopt',
			'voip_settings',
		])
		const p = (buildPreaccept('c', 'd@lid', 'me@lid', 'i').content as any[])[0]
		expect(p.content.map((c: any) => c.tag)).toEqual(['audio', 'encopt', 'capability'])
	})

	it('builds and parses call-link requests', () => {
		expect(buildLinkCreate('video', 'i')).toEqual({
			tag: 'call',
			attrs: { to: '@call', id: 'i' },
			content: [{ tag: 'link_create', attrs: { media: 'video' } }],
		})
		expect((buildLinkQuery('TOKEN123', 'audio', 'i').content as any[])[0].attrs).toEqual({
			token: 'TOKEN123',
			media: 'audio',
		})
		const created = parseLinkCreateAck({
			tag: 'ack',
			attrs: {},
			content: [{ tag: 'link_create', attrs: { token: 'abc', media: 'video' } }],
		})
		expect(created).toEqual({
			token: 'abc',
			media: 'video',
			url: 'https://call.whatsapp.com/video/abc',
		})
		expect(callLinkUrl('x', 'audio')).toBe('https://call.whatsapp.com/voice/x')
		const q = parseLinkQueryAck({
			tag: 'ack',
			attrs: {},
			content: [
				{
					tag: 'link_query',
					attrs: { token: 'abc', media: 'audio', link_creator: 'u@lid' },
					content: [{ tag: 'waiting_room', attrs: { enabled: '1', is_admin: '1' } }],
				},
			],
		})
		expect(q).toMatchObject({ creator: 'u@lid', waitingRoomEnabled: true, isAdmin: true })
		expect(() => parseLinkCreateAck({ tag: 'ack', attrs: {} })).toThrow()
	})

	it('accepts bare tokens and WhatsApp call-link URLs and nothing else', () => {
		expect(parseCallLinkToken('Dyf0xzBaRWkMCJdv2rdkSU')).toBe('Dyf0xzBaRWkMCJdv2rdkSU')
		expect(parseCallLinkToken('https://call.whatsapp.com/voice/abcd1234?x=1')).toBe('abcd1234')
		expect(parseCallLinkToken('https://call.whatsapp.com/video/abcd1234')).toBe('abcd1234')
		for (const bad of [
			'http://call.whatsapp.com/voice/abcd1234',
			'https://evil.example/voice/abcd1234',
			'https://call.whatsapp.com/voice/abcd1234/extra',
			'https://call.whatsapp.com/other/abcd1234',
			'https://call.whatsapp.com.evil.example/voice/abcd1234',
			'ab',
			'a b c d',
			'',
			'javascript:alert(1)',
		])
			expect(() => parseCallLinkToken(bad), bad).toThrow()
		expect(() => buildLinkQuery('', 'audio', 'i')).toThrow()
	})
})

describe('group call creator stanzas', () => {
	it('matches the shapes WhatsApp Web sends', () => {
		const id = '00ab'
		const creator = '1:19@lid'
		expect(callSig.buildHeartbeat(id, creator, 'x')).toEqual({
			tag: 'call',
			attrs: { to: '00ab@call', id: 'x' },
			content: [{ tag: 'heartbeat', attrs: { 'call-id': id, 'call-creator': creator } }],
		})
		const t = callSig.buildTransportHint(id, '2@lid', creator, 'y')
		expect(t.attrs['to']).toBe('2@lid')
		expect(
			(t.content as { attrs: Record<string, string> }[])[0]!.attrs['transport-message-type'],
		).toBe('4')
		const m = callSig.buildMuteState(id, creator, false, 'z')
		expect((m.content as { attrs: Record<string, string> }[])[0]!.attrs['mute-state']).toBe('0')
		const e = callSig.buildTerminateTimed(id, creator, 25745, 'w')
		expect((e.content as { attrs: Record<string, string> }[])[0]!.attrs).toMatchObject({
			duration: '25745',
			audio_duration: '25745',
		})
		expect(callSig.buildGroupDuration(id, creator, 5, 'v').attrs['to']).toBe('call')
	})
})

describe('call-link join', () => {
	it('builds the join request and reads both kinds of answer', () => {
		const j = callSig.buildLinkJoin('abcDEF123_-xyz', 'audio', 'i1')
		expect(j.attrs['to']).toBe('@call')
		const link = (
			j.content as { tag: string; attrs: Record<string, string>; content: { tag: string }[] }[]
		)[0]!
		expect(link.tag).toBe('link_join')
		expect(link.content.map((c) => c.tag)).toEqual(['audio', 'net', 'capability'])
		expect(() => callSig.buildLinkJoin('../x', 'audio', 'i')).toThrow()

		const admitted = callSig.parseLinkJoinAck(
			{
				tag: 'ack',
				attrs: {},
				content: [
					{
						tag: 'group_info',
						attrs: { 'call-id': 'C1', 'call-creator': '1:2@lid', media: 'video' },
					},
				],
			},
			'tok',
		)
		expect(admitted).toMatchObject({
			callId: 'C1',
			media: 'video',
			admitted: true,
			inWaitingRoom: false,
		})
		const waiting = callSig.parseLinkJoinAck(
			{
				tag: 'ack',
				attrs: {},
				content: [
					{
						tag: 'waiting_room',
						attrs: {
							'call-id': 'C2',
							'call-creator': '1@lid',
							'link-token': 'tok',
							media: 'audio',
						},
					},
				],
			},
			'tok',
		)
		expect(waiting).toMatchObject({ callId: 'C2', inWaitingRoom: true, admitted: false })
		expect(() =>
			callSig.parseLinkJoinAck(
				{
					tag: 'ack',
					attrs: {},
					content: [
						{
							tag: 'waiting_room',
							attrs: { 'call-id': 'C', 'call-creator': 'x', 'link-token': 'other' },
						},
					],
				},
				'tok',
			),
		).toThrow()
		expect(callSig.buildWaitingRoomHeartbeat('C', 'x@lid', 'h').attrs['to']).toBe('C@call')
		expect(callSig.buildWaitingRoomAdmit('C', 'x@lid', 'u@lid', 'a', true).content).toBeDefined()
	})
})
