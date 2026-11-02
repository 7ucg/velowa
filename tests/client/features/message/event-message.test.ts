import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
	decryptEventResponse,
	encryptEventResponse,
	eventMessage,
	eventResponse,
} from '../../../../src/client/features/message/event-message.js'
import { encodeProto, protoType } from '../../../../src/client/proto.js'

const ctx = () => ({
	eventMsgId: 'EV1',
	eventCreatorJid: '1@s.whatsapp.net',
	responderJid: '2@s.whatsapp.net',
	secret: randomBytes(32),
})

describe('event messages', () => {
	it('builds a card with a secret', () => {
		const m = eventMessage({
			name: 'Launch',
			startTime: new Date('2026-12-01T10:00:00Z'),
			endTime: 1796119200,
			location: { name: 'Berlin' },
			extraGuestsAllowed: true,
		}) as {
			eventMessage: Record<string, unknown>
			messageContextInfo: { messageSecret: Buffer }
		}
		expect(m.eventMessage).toMatchObject({
			name: 'Launch',
			startTime: 1796119200,
			endTime: 1796119200,
			isCanceled: false,
			extraGuestsAllowed: true,
		})
		expect(m.messageContextInfo.messageSecret).toHaveLength(32)
		// the card is valid protobuf
		const T = protoType('Message')
		const back = T.toObject(T.decode(encodeProto('Message', m))) as {
			eventMessage: { name: string }
		}
		expect(back.eventMessage.name).toBe('Launch')
		expect(() => eventMessage({ name: ' ' })).toThrow()
	})

	it('encrypts an RSVP so only the same context decrypts it', () => {
		const c = ctx()
		const enc = encryptEventResponse({ response: 'GOING', extraGuestCount: 2 }, c, 1700000000000)
		expect(decryptEventResponse(enc, c)).toMatchObject({
			response: 'GOING',
			timestampMs: 1700000000000,
			extraGuestCount: 2,
		})
		expect(() => decryptEventResponse(enc, { ...c, responderJid: '3@s.whatsapp.net' })).toThrow()
		expect(() => decryptEventResponse(enc, { ...c, secret: randomBytes(32) })).toThrow()
	})

	it('wraps the RSVP with the key of the card', () => {
		const c = ctx()
		const m = eventResponse(
			{ remoteJid: 'g@g.us', id: 'EV1', participant: '1@s.whatsapp.net' },
			{ response: 'MAYBE' },
			c,
		) as {
			encEventResponseMessage: {
				eventCreationMessageKey: Record<string, unknown>
				encPayload: Uint8Array
				encIv: Uint8Array
			}
		}
		expect(m.encEventResponseMessage.eventCreationMessageKey).toEqual({
			remoteJid: 'g@g.us',
			fromMe: false,
			id: 'EV1',
			participant: '1@s.whatsapp.net',
		})
		expect(decryptEventResponse(m.encEventResponseMessage, c).response).toBe('MAYBE')
	})
})
