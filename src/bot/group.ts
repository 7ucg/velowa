// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { Client } from '../client/client.js'
import { areJidsSameUser } from '../jid.js'

/** A group, with the people who may do things in it. */
export interface GroupInfo {
	id: string
	subject: string
	size: number
	/** Admins and the creator, in every form the group lists them (phone number and LID). */
	admins: string[]
	participants: {
		id: string
		phoneNumber?: string
		lid?: string
		admin: 'admin' | 'superadmin' | null
	}[]
	/** Only admins may write. */
	announce: boolean
}

const TTL_MS = 60_000

/** Group info with a short memory, so a busy group costs one query a minute, not one per command. */
export class GroupCache {
	readonly #cache = new Map<string, { at: number; info: Promise<GroupInfo> }>()
	constructor(private readonly client: Client) {}

	get(id: string): Promise<GroupInfo> {
		const hit = this.#cache.get(id)
		if (hit && Date.now() - hit.at < TTL_MS) return hit.info
		const info = this.client.groups.metadata(id).then((m) => ({
			id: m.id,
			subject: m.subject,
			size: m.size,
			participants: m.participants,
			announce: m.announce,
			admins: m.participants
				.filter((p) => p.admin)
				.flatMap((p) => [p.id, p.phoneNumber, p.lid].filter((j): j is string => !!j)),
		}))
		info.catch(() => this.#cache.delete(id))
		this.#cache.set(id, { at: Date.now(), info })
		if (this.#cache.size > 500) this.#cache.delete(this.#cache.keys().next().value!)
		return info
	}

	/** Forget a group (its members changed). */
	forget(id: string): void {
		this.#cache.delete(id)
	}
}

/** Is `jid` one of the group's admins? (Phone-number and LID forms both count.) */
export const isGroupAdmin = (group: GroupInfo | undefined, jid: string | undefined): boolean =>
	!!group && !!jid && group.admins.some((a) => areJidsSameUser(a, jid))
