import { describe, expect, it } from 'vitest'
import {
	areJidsSameUser,
	isJidGroup,
	isJidNewsletter,
	isJidStatusBroadcast,
	isJidUser,
	isLidUser,
	jidEncode,
	jidNormalizedUser,
} from '../src/jid.js'
import {
	getContentType,
	messageText,
	normalizeMessageContent,
} from '../src/client/features/message/content-type.js'

describe('jid helpers', () => {
	it('normalises and compares users', () => {
		expect(jidNormalizedUser('4915600000000:23@s.whatsapp.net')).toBe(
			'4915600000000@s.whatsapp.net',
		)
		expect(jidNormalizedUser('4915600000000@c.us')).toBe('4915600000000@s.whatsapp.net')
		expect(jidNormalizedUser('not a jid')).toBe('')
		expect(areJidsSameUser('1:5@s.whatsapp.net', '1@s.whatsapp.net')).toBe(true)
		expect(areJidsSameUser('1@s.whatsapp.net', '2@s.whatsapp.net')).toBe(false)
		expect(jidEncode('49156', 's.whatsapp.net', 3)).toBe('49156:3@s.whatsapp.net')
	})
	it('tells the kinds apart', () => {
		expect(isJidGroup('1@g.us')).toBe(true)
		expect(isJidUser('1@s.whatsapp.net')).toBe(true)
		expect(isLidUser('1@lid')).toBe(true)
		expect(isJidNewsletter('1@newsletter')).toBe(true)
		expect(isJidStatusBroadcast('status@broadcast')).toBe(true)
		expect(isJidGroup(undefined)).toBe(false)
	})
})

describe('reading content', () => {
	it('finds the type, the wrapped content and the text', () => {
		const wrapped = {
			viewOnceMessage: { message: { imageMessage: { caption: 'look' } } },
			messageContextInfo: {},
		}
		expect(getContentType({ messageContextInfo: {}, conversation: 'x' })).toBe('conversation')
		expect(normalizeMessageContent(wrapped)).toEqual({ imageMessage: { caption: 'look' } })
		expect(messageText(wrapped)).toBe('look')
		expect(messageText({ extendedTextMessage: { text: 'link' } })).toBe('link')
		expect(messageText({ pollCreationMessage: {} })).toBeUndefined()
	})
})
