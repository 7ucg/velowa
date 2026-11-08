import { describe, expect, it } from 'vitest'
import { encodeProto } from '../../../../src/client/proto.js'
import {
	bCall,
	callLogMessage,
	cancelPaymentRequestMessage,
	contactCard,
	declinePaymentRequestMessage,
	eventInvite,
	futureProofMessage,
	invoice,
	location,
	musicMessage,
	musicParts,
	newsletterAdminInvite,
	newsletterFollowerInvite,
	paymentInviteMessage,
	paymentReminderMessage,
	poll,
	pollAddOption,
	product,
	question,
	questionResponse,
	requestLocation,
	requestLocationUpdate,
	requestPhoneNumber,
	scheduledCallCancel,
	scheduledCallCreate,
	sendPaymentMessage,
	requestPaymentMessage,
	splitPaymentMessage,
	splitPaymentUpdateMessage,
	statusQuestionAnswer,
	vcardFor,
	viewOnce,
} from '../../../../src/client/features/message/extras.js'

const key = { remoteJid: 'g@g.us', fromMe: true, id: 'M1' }
/** Every builder here returns one `Message` field; validate it against the real proto schema. */
const validates = (m: Record<string, unknown>) =>
	expect(() => encodeProto('Message', m)).not.toThrow()

describe('extras', () => {
	it('builds single and multiple choice polls with the creation meta node', () => {
		const single = poll('Pizza?', ['Ja', 'Nein'])
		expect(single.message['pollCreationMessageV3']).toMatchObject({
			name: 'Pizza?',
			selectableOptionsCount: 1,
			options: [{ optionName: 'Ja' }, { optionName: 'Nein' }],
		})
		expect(
			(single.message['messageContextInfo'] as { messageSecret: Buffer }).messageSecret,
		).toHaveLength(32)
		expect(single.opts.extraNodes).toEqual([
			{ tag: 'meta', attrs: { polltype: 'creation', contenttype: 'text' } },
		])
		expect(poll('Was?', ['a', 'b', 'c'], 2).message['pollCreationMessage']).toBeDefined()
	})

	it('builds quizzes with the right answer and rejects bad ones', () => {
		const q = poll('2+2?', ['3', '4'], 1, { correctAnswer: '4' })
		expect(q.message['pollCreationMessageV5']).toMatchObject({
			pollType: 'QUIZ',
			correctAnswer: { optionName: '4' },
		})
		expect(() => poll('x', ['a', 'b'], 1, { correctAnswer: 'c' })).toThrow()
		expect(() => poll('x', ['a', 'b'], 2, { correctAnswer: 'a' })).toThrow()
	})

	it('uses quiz_creation meta, image hashes and the question wrapper', () => {
		const q = poll('x', ['a', 'b'], 1, {
			correctAnswer: 'b',
			optionImageHashes: ['aa', 'bb'],
		})
		expect(q.opts.extraNodes).toEqual([
			{ tag: 'meta', attrs: { polltype: 'quiz_creation', contenttype: 'image' } },
		])
		expect(q.message['pollCreationMessageV5']).toMatchObject({
			pollContentType: 'IMAGE',
			options: [
				{ optionName: 'a', optionHash: 'aa' },
				{ optionName: 'b', optionHash: 'bb' },
			],
			correctAnswer: { optionName: 'b', optionHash: 'bb' },
		})
		expect(question({ extendedTextMessage: { text: 'q' } })).toEqual({
			message: { questionMessage: { message: { extendedTextMessage: { text: 'q' } } } },
			opts: { extraNodes: [{ tag: 'meta', attrs: { questiontype: 'question' } }] },
		})
	})

	it('builds the music context', () => {
		const c = musicParts({ title: 'T', author: 'A', songId: '1' })
		expect(c.fields['annotations']).toHaveLength(1)
		expect(c.contextInfo['statusAttributions']).toEqual([
			{ type: 'MUSIC', music: expect.objectContaining({ title: 'T', author: 'A' }) },
		])
	})

	it('rejects invalid polls', () => {
		expect(() => poll('', ['a', 'b'])).toThrow()
		expect(() => poll('x', ['a'])).toThrow(/2 to 12/)
		expect(() => poll('x', ['a', 'a'])).toThrow(/unique/)
		expect(() => poll('x', ['a', 'b'], 3)).toThrow()
	})

	it('wraps view-once, location and contact messages', () => {
		expect(viewOnce({ imageMessage: {} })).toEqual({
			viewOnceMessageV2: { message: { imageMessage: {} } },
		})
		expect(location(52.5, 13.4, { name: 'Berlin' })).toEqual({
			locationMessage: { degreesLatitude: 52.5, degreesLongitude: 13.4, name: 'Berlin' },
		})
		expect(contactCard('Max', vcardFor('Max', '+49 156 1111-1111'))).toEqual({
			contactMessage: {
				displayName: 'Max',
				vcard: expect.stringContaining('waid=4915611111111:+4915611111111'),
			},
		})
	})
})

describe('proto message builders', () => {
	it('wraps any field in the FutureProofMessage envelope', () => {
		const m = futureProofMessage('spoilerMessage', { extendedTextMessage: { text: 'surprise!' } })
		expect(m).toEqual({
			spoilerMessage: { message: { extendedTextMessage: { text: 'surprise!' } } },
		})
		validates(m)
	})

	it('builds a product share with an optional catalog/body/footer', () => {
		const m = product(
			{ productId: 'P1', title: 'Widget', currencyCode: 'EUR', priceAmount1000: 9990 },
			{ body: 'check it out', footer: 'shop' },
		)
		expect(m['productMessage']).toMatchObject({
			product: { productId: 'P1', title: 'Widget' },
			body: 'check it out',
			footer: 'shop',
		})
		validates(m)
	})

	it('builds an invoice, phone/location requests and a live-location-update cancel', () => {
		validates(invoice({ note: 'thanks', attachmentType: 'PDF' }))
		validates(requestPhoneNumber())
		validates(requestLocation())
		const cancel = requestLocationUpdate(key, true)
		expect(cancel['requestLocationUpdateMessage']).toMatchObject({ updateType: 'CANCEL' })
		validates(cancel)
		validates(requestLocationUpdate(key))
	})

	it('builds a standalone music-sharing card', () => {
		const m = musicMessage({ title: 'T', author: 'A', songId: '1', songUri: 'https://x' })
		expect(m['musicMessage']).toMatchObject({
			embeddedMusic: { title: 'T', author: 'A', songId: '1' },
			songUri: 'https://x',
		})
		validates(m)
	})

	it('builds an event invite and scheduled-call create/cancel', () => {
		const m = eventInvite({ eventId: 'E1', eventTitle: 'Party', startTime: 1700000000 })
		expect(m['eventInviteMessage']).toMatchObject({ eventId: 'E1', eventTitle: 'Party' })
		validates(m)
		const created = scheduledCallCreate({ scheduledTimestampMs: 1700000000000, callType: 'VIDEO' })
		expect(created['scheduledCallCreationMessage']).toMatchObject({ callType: 'VIDEO' })
		validates(created)
		const cancelled = scheduledCallCancel(key)
		expect(cancelled['scheduledCallEditMessage']).toMatchObject({ editType: 'CANCEL' })
		validates(cancelled)
	})

	it('builds the plain poll-add-option, question-response and status-question-answer messages', () => {
		expect(pollAddOption(['Vielleicht'])).toEqual({
			pollAddOptionMessage: { pollOption: [{ optionName: 'Vielleicht' }] },
		})
		validates(pollAddOption(['Vielleicht']))
		const qr = questionResponse(key, 'my answer')
		expect(qr['questionResponseMessage']).toMatchObject({ text: 'my answer' })
		validates(qr)
		const sqa = statusQuestionAnswer(key, 'my answer')
		expect(sqa['statusQuestionAnswerMessage']).toMatchObject({ text: 'my answer' })
		validates(sqa)
	})

	it('builds newsletter admin/follower invites and call-timeline entries', () => {
		validates(newsletterAdminInvite({ newsletterJid: '1@newsletter', newsletterName: 'News' }))
		validates(newsletterFollowerInvite({ newsletterJid: '1@newsletter' }))
		validates(bCall({ sessionId: 'S1', mediaType: 'VIDEO', masterKey: new Uint8Array(32) }))
		validates(callLogMessage({ isVideo: true, callOutcome: 'MISSED', durationSecs: 0 }))
	})

	it('builds the payment envelopes (wire shape only - no real payment flow)', () => {
		validates(sendPaymentMessage({ transactionData: 'tx' }))
		validates(requestPaymentMessage({ currencyCodeIso4217: 'EUR', amount1000: 5000 }))
		validates(paymentReminderMessage({ reminderId: 'R1', frequency: 'MONTHLY' }))
		validates(splitPaymentMessage({ splitId: 'S1', totalAmount: { value: 1000 } }))
		validates(splitPaymentUpdateMessage('S1', 'bob@s.whatsapp.net'))
		validates(paymentInviteMessage({ serviceType: 'UPI' }))
		validates(declinePaymentRequestMessage(key))
		validates(cancelPaymentRequestMessage(key))
	})
})
