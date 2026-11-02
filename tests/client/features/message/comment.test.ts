import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
	commentMessage,
	decryptAddon,
	encryptAddon,
} from '../../../../src/client/features/message/comment.js'

const secret = randomBytes(32)
const ctx = {
	parentMsgId: 'POST1',
	parentSenderJid: '1@lid',
	modifierJid: '2@lid',
	secret,
	useCase: 'Enc Comment' as const,
}

describe('comments and add-ons', () => {
	it('round-trips a body and refuses a different sender, post or use case', () => {
		const enc = encryptAddon({ extendedTextMessage: { text: 'hi' } }, ctx)
		expect(decryptAddon(enc, ctx)).toMatchObject({ extendedTextMessage: { text: 'hi' } })
		expect(() => decryptAddon(enc, { ...ctx, modifierJid: '3@lid' })).toThrow()
		expect(() => decryptAddon(enc, { ...ctx, parentMsgId: 'POST2' })).toThrow()
		expect(() => decryptAddon(enc, { ...ctx, useCase: 'Enc Reaction' })).toThrow()
	})

	it('builds the comment envelope with the post key and a secret of its own', () => {
		const m = commentMessage({ remoteJid: 'g@g.us', id: 'POST1' }, 'nice', {
			parentSenderJid: '1@lid',
			modifierJid: '2@lid',
			secret,
		}) as {
			encCommentMessage: {
				targetMessageKey: Record<string, unknown>
				encPayload: Uint8Array
				encIv: Uint8Array
			}
			messageContextInfo: { messageSecret: Buffer }
		}
		expect(m.encCommentMessage.targetMessageKey).toEqual({
			remoteJid: 'g@g.us',
			fromMe: false,
			id: 'POST1',
			participant: '1@lid',
		})
		expect(m.messageContextInfo.messageSecret).toHaveLength(32)
		expect(decryptAddon(m.encCommentMessage, ctx)).toMatchObject({
			extendedTextMessage: { text: 'nice' },
		})
	})
})
