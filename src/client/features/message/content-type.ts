// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
// Reading a received message: which kind it is, what is inside the wrappers, what text it carries.

/** What kind of message `message` is: `conversation`, `imageMessage`, `extendedTextMessage`, ... */
export function getContentType(
	content: Record<string, unknown> | undefined | null,
): string | undefined {
	if (!content) return undefined
	const keys = Object.keys(content).filter(
		(k) => content[k] != null && k !== 'senderKeyDistributionMessage' && k !== 'messageContextInfo',
	)
	return keys[0]
}

// `FutureProofMessage { message: Message }` wrappers that carry an inner message: the usual
// ephemeral/view-once/edit wrappers, plus every `FutureProofMessage`-shaped field WA Web itself
// defines (spoilers, polls, status mentions, stickers, bot/newsletter messages, ...) - a message
// using any of them needs the same one-level unwrap to reach its real content. `deviceSentMessage`
// is deliberately not here: unwrapping it safely needs the sender's identity, not just the shape
// (see `serialize()` in `src/bot/message.ts`), so each caller that cares handles it itself first.
const FP_WRAPPERS = [
	'ephemeralMessage',
	'viewOnceMessage',
	'viewOnceMessageV2',
	'viewOnceMessageV2Extension',
	'documentWithCaptionMessage',
	'groupMentionedMessage',
	'botInvokeMessage',
	'associatedChildMessage',
	'pollCreationOptionImageMessage',
	'eventCoverImage',
	'groupStatusMessage',
	'groupStatusMessageV2',
	'groupStatusMentionMessage',
	'statusAddYours',
	'statusMentionMessage',
	'questionMessage',
	'questionReplyMessage',
	'spoilerMessage',
	'lottieStickerMessage',
	'audioStickerMessage',
	'limitSharingMessage',
	'newsletterAdminProfileMessage',
	'newsletterAdminProfileStatusMessage',
	'pollCreationMessageV4',
	'botForwardedMessage',
	'editedMessage',
]

/** Look through the wrappers (ephemeral, view-once, edited, document with caption, ...) to the real content. */
export function normalizeMessageContent(
	content: Record<string, unknown> | undefined | null,
): Record<string, unknown> | undefined {
	let c = content ?? undefined
	for (let depth = 0; c && depth < 5; depth++) {
		const wrapper = FP_WRAPPERS.map(
			(k) => c![k] as { message?: Record<string, unknown> } | undefined,
		).find((w) => w?.message)
		if (!wrapper) break
		c = wrapper.message
	}
	return c
}

/** Whether `content` is wrapped in the named FutureProofMessage wrapper (at any unwrap depth above it). */
function hasFpWrapper(content: Record<string, unknown> | undefined | null, key: string): boolean {
	let c = content ?? undefined
	for (let depth = 0; c && depth < 5; depth++) {
		if ((c[key] as { message?: unknown } | undefined)?.message) return true
		const next = FP_WRAPPERS.map(
			(k) => (c![k] as { message?: Record<string, unknown> } | undefined)?.message,
		).find(Boolean)
		if (!next) break
		c = next
	}
	return false
}

/** True if a received message is an audio sticker (`audioStickerMessage` wrapping a `stickerMessage`). */
export const isAudioSticker = (content: Record<string, unknown> | undefined | null): boolean =>
	hasFpWrapper(content, 'audioStickerMessage')

/** True if a received message is a Lottie (animated) sticker (`lottieStickerMessage`). */
export const isLottieSticker = (content: Record<string, unknown> | undefined | null): boolean =>
	hasFpWrapper(content, 'lottieStickerMessage')

/**
 * The sound of a received audio sticker, ready to hand to `downloadMedia` (`{ audioMessage }`), or undefined
 * if the message is not an audio sticker or carries no sound.
 */
export function audioStickerSound(
	content: Record<string, unknown> | undefined | null,
): { audioMessage: Record<string, unknown> } | undefined {
	const sticker = normalizeMessageContent(content)?.['stickerMessage'] as
		{ audioMessage?: Record<string, unknown> } | undefined
	return sticker?.audioMessage ? { audioMessage: sticker.audioMessage } : undefined
}

/**
 * The message a sticker reaction ("sticker annotation") was sent against, from
 * `messageContextInfo.messageAssociation`, or undefined if this is not a sticker reaction.
 */
export function stickerReactionParentKey(
	content: Record<string, unknown> | undefined | null,
): { remoteJid?: string; fromMe?: boolean; id?: string } | undefined {
	const assoc = (
		content?.['messageContextInfo'] as { messageAssociation?: Record<string, unknown> } | undefined
	)?.messageAssociation
	if (!assoc || assoc['associationType'] !== 'STICKER_ANNOTATION') return undefined
	return assoc['parentMessageKey'] as
		{ remoteJid?: string; fromMe?: boolean; id?: string } | undefined
}

/** The id of the button or row someone tapped on a native-flow message (`interactiveResponseMessage`). */
function nativeFlowReplyId(reply: Record<string, unknown> | undefined): string | undefined {
	const flow = reply?.['nativeFlowResponseMessage'] as { paramsJson?: string } | undefined
	if (!flow?.paramsJson) return undefined
	try {
		const p = JSON.parse(flow.paramsJson) as { id?: unknown; selected_id?: unknown }
		const id = p.id ?? p.selected_id
		return typeof id === 'string' && id ? id : undefined
	} catch {
		return undefined // broken JSON: no text
	}
}

/** The text of a message, whatever kind carries it. */
export function messageText(
	content: Record<string, unknown> | undefined | null,
): string | undefined {
	const c = normalizeMessageContent(content)
	if (!c) return undefined
	const get = (k: string) => c[k] as Record<string, unknown> | undefined
	return (
		(typeof c['conversation'] === 'string' ? c['conversation'] : undefined) ??
		(get('extendedTextMessage')?.['text'] as string | undefined) ??
		(get('imageMessage')?.['caption'] as string | undefined) ??
		(get('videoMessage')?.['caption'] as string | undefined) ??
		(get('documentMessage')?.['caption'] as string | undefined) ??
		(get('buttonsResponseMessage')?.['selectedButtonId'] as string | undefined) ??
		(get('listResponseMessage')?.['singleSelectReply'] as { selectedRowId?: string } | undefined)
			?.selectedRowId ??
		(get('templateButtonReplyMessage')?.['selectedId'] as string | undefined) ??
		nativeFlowReplyId(get('interactiveResponseMessage'))
	)
}
