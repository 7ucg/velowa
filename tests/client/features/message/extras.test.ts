import { describe, expect, it } from 'vitest'
import {
	contactCard,
	location,
	poll,
	musicParts,
	question,
	vcardFor,
	viewOnce,
} from '../../../../src/client/features/message/extras.js'

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
