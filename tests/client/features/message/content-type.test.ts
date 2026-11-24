import { describe, expect, it } from 'vitest'
import {
	getContentType,
	messageText,
	normalizeMessageContent,
} from '../../../../src/client/features/message/content-type.js'

describe('normalizeMessageContent', () => {
	it('unwraps ephemeral/view-once/edited/document-with-caption as before', () => {
		expect(
			normalizeMessageContent({ ephemeralMessage: { message: { conversation: 'hi' } } }),
		).toEqual({ conversation: 'hi' })
		expect(normalizeMessageContent(undefined)).toBeUndefined()
	})

	it('unwraps the newer FutureProofMessage wrapper types (spoiler, group-mentioned, stickers, ...)', () => {
		expect(
			normalizeMessageContent({
				spoilerMessage: { message: { extendedTextMessage: { text: 'surprise' } } },
			}),
		).toEqual({ extendedTextMessage: { text: 'surprise' } })
		expect(
			normalizeMessageContent({
				groupMentionedMessage: { message: { conversation: 'hey all' } },
			}),
		).toEqual({ conversation: 'hey all' })
		expect(
			normalizeMessageContent({
				lottieStickerMessage: { message: { stickerMessage: { url: 'x' } } },
			}),
		).toEqual({ stickerMessage: { url: 'x' } })
		expect(
			normalizeMessageContent({
				audioStickerMessage: { message: { stickerMessage: { url: 'y' } } },
			}),
		).toEqual({ stickerMessage: { url: 'y' } })
		expect(
			normalizeMessageContent({
				newsletterAdminProfileStatusMessage: { message: { conversation: 'status' } },
			}),
		).toEqual({ conversation: 'status' })
	})

	it('unwraps nested combinations, e.g. an edited spoiler', () => {
		expect(
			normalizeMessageContent({
				editedMessage: { message: { spoilerMessage: { message: { conversation: 'edited' } } } },
			}),
		).toEqual({ conversation: 'edited' })
	})
})

describe('getContentType / messageText with the newer wrappers', () => {
	it('finds the real type and text through a spoiler wrapper', () => {
		const content = normalizeMessageContent({
			spoilerMessage: { message: { extendedTextMessage: { text: 'surprise' } } },
		})
		expect(getContentType(content)).toBe('extendedTextMessage')
		expect(
			messageText({ spoilerMessage: { message: { extendedTextMessage: { text: 'surprise' } } } }),
		).toBe('surprise')
	})
})
