// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { Client } from './client.js'
import type { DecodedMessage } from './receiver.js'

/**
 * A small in-memory store for bots that want to look things up: the latest messages of each chat, push names,
 * and which chats exist. It listens to a client's events; nothing is written to disk.
 *
 *   const store = new MemoryStore().bind(client)
 *   store.messages(chatJid, 20)
 */
export class MemoryStore {
	readonly #messages = new Map<string, Map<string, DecodedMessage>>()
	readonly #names = new Map<string, string>()
	readonly #seen = new Map<string, number>()
	#offs: (() => void)[] = []

	readonly #perChat: number
	readonly #maxChats: number
	readonly #maxNames: number

	/** Limits: messages kept per chat, chats kept (least recently active are dropped), names kept. */
	constructor(o: { perChat?: number; maxChats?: number; maxNames?: number } = {}) {
		this.#perChat = o.perChat ?? 200
		this.#maxChats = o.maxChats ?? 1000
		this.#maxNames = o.maxNames ?? 5000
	}

	/** Start listening to `client`. Returns the store, so it chains. */
	bind(client: Client): this {
		this.#offs.push(
			client.on('message', (m) => this.add(m)),
			client.on('message.resent', (r) =>
				this.add({
					id: r.key.id,
					from: r.key.remoteJid,
					message: r.message,
					...(r.key.participant && { participant: r.key.participant }),
					...(r.timestamp !== undefined && { timestamp: r.timestamp }),
				}),
			),
		)
		return this
	}

	/** Stop listening. */
	unbind(): void {
		for (const off of this.#offs) off()
		this.#offs = []
	}

	add(m: DecodedMessage): void {
		// Insertion order is recency: a chat that gets a message moves to the end, the oldest are evicted first.
		const chat = this.#messages.get(m.from) ?? new Map<string, DecodedMessage>()
		this.#messages.delete(m.from)
		this.#messages.set(m.from, chat)
		chat.delete(m.id)
		chat.set(m.id, m)
		while (chat.size > this.#perChat) chat.delete(chat.keys().next().value!)
		this.#seen.delete(m.from)
		this.#seen.set(m.from, m.timestamp ?? Math.floor(Date.now() / 1000))
		while (this.#messages.size > this.#maxChats) {
			const oldest = this.#messages.keys().next().value!
			this.#messages.delete(oldest)
			this.#seen.delete(oldest)
		}
		if (m.pushName) {
			const who = m.participant ?? m.from
			this.#names.delete(who)
			this.#names.set(who, m.pushName.slice(0, 128))
			while (this.#names.size > this.#maxNames) this.#names.delete(this.#names.keys().next().value!)
		}
	}

	/** One message of a chat, by id. */
	message(chat: string, id: string): DecodedMessage | undefined {
		return this.#messages.get(chat)?.get(id)
	}

	/** The last `limit` messages of a chat, oldest first. */
	messages(chat: string, limit = 50): DecodedMessage[] {
		return [...(this.#messages.get(chat)?.values() ?? [])].slice(-limit)
	}

	/** The name a person or chat showed up with. */
	name(jid: string): string | undefined {
		return this.#names.get(jid)
	}

	/** Chats we have seen a message of, most recent first. */
	chats(): { jid: string; lastSeen: number }[] {
		return [...this.#seen]
			.map(([jid, lastSeen]) => ({ jid, lastSeen }))
			.sort((a, b) => b.lastSeen - a.lastSeen)
	}
}
