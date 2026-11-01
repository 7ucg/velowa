/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import {
	buildOffer,
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
})
