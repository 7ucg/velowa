import { describe, expect, it } from 'vitest'
import {
	audioStickerSound,
	getContentType,
	isAudioSticker,
	isLottieSticker,
	messageText,
	normalizeMessageContent,
	stickerReactionParentKey,
} from '../../../../src/client/features/message/content-type.js'

describe('audio sticker + sticker reaction (real wire shapes)', () => {
	// An audio sticker: a stickerMessage carrying the sound as its nested audioMessage.
	const audioSticker = {
		audioStickerMessage: {
			message: {
				stickerMessage: {
					url: 'https://mmg/enc',
					mediaKey: 'k',
					mimetype: 'image/webp',
					isAnimated: true,
					emojis: '🔊',
					audioMessage: {
						url: 'https://mmg/audio.enc',
						mimetype: 'audio/ogg; codecs=opus',
						seconds: 9,
					},
				},
			},
		},
	}
	// A sticker reaction: associatedChildMessage + messageContextInfo.messageAssociation.
	const stickerReaction = {
		messageContextInfo: {
			messageAssociation: {
				associationType: 'STICKER_ANNOTATION',
				parentMessageKey: { remoteJid: '123@g.us', fromMe: true, id: 'ABCD' },
			},
		},
		associatedChildMessage: {
			message: { stickerMessage: { url: 'https://mmg/enc', mediaKey: 'k' } },
		},
	}

	it('recognises the audio sticker and exposes its sound for download', () => {
		expect(isAudioSticker(audioSticker)).toBe(true)
		const sound = audioStickerSound(audioSticker)
		expect(sound?.audioMessage).toMatchObject({ mimetype: 'audio/ogg; codecs=opus', seconds: 9 })
		expect(audioStickerSound({ stickerMessage: { url: 'x' } })).toBeUndefined()
	})

	it('reads the parent key of a sticker reaction', () => {
		expect(stickerReactionParentKey(stickerReaction)).toEqual({
			remoteJid: '123@g.us',
			fromMe: true,
			id: 'ABCD',
		})
		expect(stickerReactionParentKey({ conversation: 'x' })).toBeUndefined()
		// the sticker itself normalizes out of the associatedChildMessage wrapper for download
		expect(normalizeMessageContent(stickerReaction)).toMatchObject({
			stickerMessage: { mediaKey: 'k' },
		})
	})
})

describe('sticker-wrapper detection', () => {
	it('recognises audio and lottie stickers, incl. under an outer wrapper', () => {
		expect(
			isAudioSticker({ audioStickerMessage: { message: { stickerMessage: { url: 'x' } } } }),
		).toBe(true)
		expect(
			isLottieSticker({ lottieStickerMessage: { message: { stickerMessage: { url: 'x' } } } }),
		).toBe(true)
		// nested under an ephemeral wrapper still counts
		expect(
			isAudioSticker({
				ephemeralMessage: { message: { audioStickerMessage: { message: { stickerMessage: {} } } } },
			}),
		).toBe(true)
		expect(isAudioSticker({ stickerMessage: { url: 'x' } })).toBe(false)
		expect(isLottieSticker({ audioStickerMessage: { message: { stickerMessage: {} } } })).toBe(
			false,
		)
		expect(isAudioSticker(undefined)).toBe(false)
	})
})

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
