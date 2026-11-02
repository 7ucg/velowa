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

/** Look through the wrappers (ephemeral, view-once, edited, document with caption) to the real content. */
export function normalizeMessageContent(
	content: Record<string, unknown> | undefined | null,
): Record<string, unknown> | undefined {
	let c = content ?? undefined
	for (let depth = 0; c && depth < 5; depth++) {
		const wrapper = [
			'ephemeralMessage',
			'viewOnceMessage',
			'viewOnceMessageV2',
			'viewOnceMessageV2Extension',
			'documentWithCaptionMessage',
			'editedMessage',
		]
			.map((k) => c![k] as { message?: Record<string, unknown> } | undefined)
			.find((w) => w?.message)
		if (!wrapper) break
		c = wrapper.message
	}
	return c
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
			?.selectedRowId
	)
}
