// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const MAX_ENTRIES = 5000
// 30 days: generous enough that any receipt a real client would still plausibly deliver late has arrived
// well before an id ages out, while keeping the file bounded for an account that never restarts.
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Ids of messages we actually sent, persisted so a receipt for one of them arriving right after a
 * reconnect - a message sent in an earlier run, nothing suspicious - is not mistaken for a receipt on a
 * message that was never sent at all (see `detectFakeChat`). An in-memory-only cache would flag every
 * such legitimate receipt for as long as it takes to warm back up after every restart.
 */
export class SentMessageIds {
	readonly #ids = new Map<string, number>()

	constructor(private readonly path?: string) {
		if (path && existsSync(path)) {
			try {
				const data = JSON.parse(readFileSync(path, 'utf8')) as Record<string, number>
				for (const [id, t] of Object.entries(data)) this.#ids.set(id, t)
			} catch {
				/* a damaged file only costs this feature's memory of what we sent */
			}
		}
		this.#prune()
	}

	add(id: string): void {
		this.#ids.set(id, Date.now())
		this.#prune()
		this.#save()
	}

	has(id: string): boolean {
		return this.#ids.has(id)
	}

	#prune(): void {
		const cutoff = Date.now() - MAX_AGE_MS
		for (const [id, t] of this.#ids) if (t < cutoff) this.#ids.delete(id)
		while (this.#ids.size > MAX_ENTRIES) this.#ids.delete(this.#ids.keys().next().value!)
	}

	#save(): void {
		if (!this.path) return
		mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 })
		const tmp = `${this.path}.tmp`
		writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.#ids)), { mode: 0o600 })
		renameSync(tmp, this.path)
	}
}

export interface FakeChatDetected {
	/** The other party (never a group - there is no single sender to blame there). */
	jid: string
	/** The receipt's ids that don't match anything we sent. */
	ids: string[]
	/** The receipt's own type (`delivery`, `read`, `played`, ...). */
	type: string
}

/**
 * A delivery/read/played receipt naming a message id we never sent is a known scam technique: a fabricated
 * tick on a message that doesn't exist, staged (alongside forged history) to make a conversation look more
 * credible than it is. Ignores group receipts (no single sender to blame) and our own account's (companion
 * devices echo our own sends back to us).
 */
export function detectFakeChat(
	receipt: { chat: string; ids: string[]; type: string },
	sentIds: SentMessageIds,
	isOwnAccount: (jid: string) => boolean,
): FakeChatDetected | undefined {
	if (!receipt.chat || receipt.chat.endsWith('@g.us') || isOwnAccount(receipt.chat))
		return undefined
	const ids = receipt.ids.filter((id) => !sentIds.has(id))
	if (!ids.length) return undefined
	return { jid: receipt.chat, ids, type: receipt.type }
}

export interface FakeMsg {
	message: Record<string, unknown>
	opts: { messageId: string }
}

/**
 * Build a message that spoofs the `deviceSentMessage` envelope `onOwnDeviceSent`'s own-account check
 * exists to reject (see `receiver.ts`): it claims to be our own account fanning a send - originally
 * addressed to `jid` - out to its other devices, when really it's whichever account sends it.
 *
 * This is a test tool for the `fake-chat` defense, not an attack on anyone: send the result from an
 * account that is *not* the target's own, against a target whose velowa instance you control, e.g.
 *
 * ```ts
 * const fake = getFakeMsg(someJid, 'hi, pretending to be your own device')
 * await attackerClient.sendMessage(targetJid, fake.message, fake.opts)
 * ```
 *
 * A correctly-defended target ignores this (the envelope shape alone is never trusted - only the
 * envelope's actual, unspoofable sender matters) and its id never joins its own `SentMessageIds`, so a
 * later receipt for the same id (see `detectFakeChat`) still gets flagged rather than waved through.
 */
export function getFakeMsg(jid: string, msg: string | Record<string, unknown>): FakeMsg {
	const inner = typeof msg === 'string' ? { conversation: msg } : msg
	return {
		message: { deviceSentMessage: { destinationJid: jid, message: inner } },
		opts: { messageId: `FAKE${randomBytes(8).toString('hex').toUpperCase()}` },
	}
}
