import { createDecipheriv, hkdfSync } from 'node:crypto'

const BOT_MESSAGE_INFO = 'Bot Message'
const MAX_SECRETS_PER_CHAT = 20

/**
 * Remembers the `messageSecret` of every message we decode, by message id and per chat: a Meta AI
 * reply (`<enc type="msmsg">`) is keyed from the secret of the message it answers.
 */
export class MessageSecrets {
	readonly #byId = new Map<string, Buffer>()
	readonly #byChat = new Map<string, { id: string; secret: Buffer }[]>()

	/** Is a secret already stored for this id? (First write wins: a later message with the same id cannot replace it.) */
	has(id: string): boolean {
		return this.#byId.has(id)
	}

	set(id: string, secret: Uint8Array, chat?: string): void {
		const buf = Buffer.from(secret)
		this.#byId.set(id, buf)
		if (!chat) return
		const list = (this.#byChat.get(chat) ?? []).filter((e) => e.id !== id && !e.secret.equals(buf))
		list.unshift({ id, secret: buf })
		list.length = Math.min(list.length, MAX_SECRETS_PER_CHAT)
		this.#byChat.set(chat, list)
	}

	/** Secrets to try, most specific first (named ids, then the chat's recent ones), de-duplicated. */
	candidates(ids: (string | undefined)[], chat: string): Buffer[] {
		const out: Buffer[] = []
		const add = (b?: Buffer) => b && !out.some((o) => o.equals(b)) && out.push(b)
		for (const id of ids) if (id) add(this.#byId.get(id))
		for (const e of this.#byChat.get(chat) ?? []) {
			if (out.length >= 6) break
			add(e.secret)
		}
		return out
	}
}

/** "user:device@lid" -> "user@lid" (the non-AD form the key derivation uses). */
const normalizeLid = (jid?: string): string | undefined =>
	jid && jid.endsWith('@lid') && jid.includes(':') ? `${jid.split(':')[0]}@lid` : jid

export interface MsmsgContext {
	/** The bot's JID (the stanza's participant). */
	botJid: string
	/** Our own JID and LID. */
	meId: string
	meLid?: string | undefined
	/** `meta target_sender_jid`: the author of the message the bot answers, preferred over `meId`. */
	targetSenderJid?: string | undefined
	botEditTargetId?: string | undefined
	metaTargetId?: string | undefined
	stanzaId?: string | undefined
}

const hkdf = (ikm: Uint8Array, info: Uint8Array): Buffer =>
	Buffer.from(hkdfSync('sha256', ikm, Buffer.alloc(0), info, 32))

/**
 * Decrypt a Meta AI `msmsg` payload (two-pass HKDF, then AES-256-GCM):
 *   k1  = HKDF(messageSecret, info = "Bot Message")
 *   k2  = HKDF(k1, info = msgId || targetSenderJid || botJid)
 *   AAD = msgId || 0x00 || botJid
 * `encPayload` carries the GCM tag in its last 16 bytes. Each (msgId, target JID) pair is tried
 * because the sender picks the id depending on whether the reply is an edit or a full answer.
 */
export function decryptMsmsg(
	messageSecret: Uint8Array,
	ctx: MsmsgContext,
	encIv: Uint8Array,
	encPayload: Uint8Array,
): Buffer {
	const msgIds = [
		...new Set(
			[ctx.botEditTargetId, ctx.stanzaId, ctx.metaTargetId].filter((x): x is string => !!x),
		),
	]
	const targets = [
		...new Set(
			[normalizeLid(ctx.targetSenderJid ?? ctx.meLid ?? ctx.meId), normalizeLid(ctx.meLid)].filter(
				(x): x is string => !!x,
			),
		),
	]
	if (!msgIds.length) throw new Error('msmsg: no target message id')
	if (!targets.length) throw new Error('msmsg: no target JID')
	if (encPayload.length < 16) throw new Error('msmsg: payload too short')

	const bot = Buffer.from(ctx.botJid)
	const k1 = hkdf(messageSecret, Buffer.from(BOT_MESSAGE_INFO))
	const tag = Buffer.from(encPayload.subarray(encPayload.length - 16))
	const body = Buffer.from(encPayload.subarray(0, encPayload.length - 16))
	let last: unknown
	for (const id of msgIds) {
		const idBuf = Buffer.from(id)
		for (const target of targets) {
			try {
				const key = hkdf(k1, Buffer.concat([idBuf, Buffer.from(target), bot]))
				const d = createDecipheriv('aes-256-gcm', key, encIv)
				d.setAAD(Buffer.concat([idBuf, Buffer.from([0]), bot]))
				d.setAuthTag(tag)
				return Buffer.concat([d.update(body), d.final()])
			} catch (e) {
				last = e
			}
		}
	}
	throw new Error('msmsg decryption failed: all key derivation candidates exhausted', {
		cause: last,
	})
}

/** The answer text of a Meta AI message (plain, streamed edit chunk, or rich response). Input is the JSON form. */
export function extractMetaAiText(
	message: Record<string, unknown> | undefined,
): string | undefined {
	if (!message) return undefined
	const m = message as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
	const body = m['protocolMessage']?.editedMessage ?? m
	const direct = body.extendedTextMessage?.text ?? body.conversation
	if (typeof direct === 'string') return direct
	const rr = body.richResponseMessage
	if (!rr) return undefined
	const parts = (rr.submessages ?? [])
		.map((s: { messageText?: string }) => s.messageText)
		.filter((t: unknown) => typeof t === 'string' && t)
	if (parts.length) return parts.join('\n')
	const data = rr.unifiedResponse?.data
	if (typeof data === 'string') {
		try {
			const j = JSON.parse(Buffer.from(data, 'base64').toString('utf8')) as {
				sections?: { view_model?: { primitive?: { text?: string } } }[]
			}
			const texts = (j.sections ?? [])
				.map((s) => s.view_model?.primitive?.text)
				.filter((t): t is string => !!t)
			if (texts.length) return texts.join('\n')
		} catch {
			/* not JSON */
		}
	}
	return undefined
}
