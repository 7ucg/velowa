// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { MexFn } from '../mex.js'

// Calendar events (Termine) in chats and groups. They are not on the stanza channel: WhatsApp Web asks
// https://graph.whatsapp.com/graphql over HTTPS, with an access token it gets through two w:mex calls.

const ENDPOINT = 'https://graph.whatsapp.com/graphql'
const NONCE = { id: '24635485196143064', path: 'xwa2_ent_get_canonical_ent_device_nonce' }
const EXCHANGE = { id: '25727187160203620', path: 'xwa2_www_exchange_nonce_for_access_token' }

const DOC = {
	ADD_INVITATIONS: '26095825686706664',
	CREATE: '27259582783645464',
	DELETE: '24671535952543812',
	GET: '26814174831581200',
	LINK_PREVIEW: '26580394538296892',
	INVITE_LINK: '26392982740362904',
	LIST: '35283909937920624',
	PRESET_COVERS: '34976018872012652',
	REMOVE_INVITATIONS: '27723734560563308',
	REMOVE_SELF: '27063717026648636',
	ROTATE_LINK: '27134834146102810',
	UPDATE: '35415093074772810',
	RSVP: '25954023907630800',
}

export type FetchFn = (
	url: string,
	init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

export type EventRsvp = 'GOING' | 'NOT_GOING' | 'MAYBE' | (string & {})

export class WwwError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly detail?: unknown,
	) {
		super(message)
		this.name = 'WwwError'
	}
}

/** The HTTP GraphQL channel: gets its token on first use, keeps it, asks for a new one once if the server refuses it. */
export class WwwClient {
	#token?: Promise<string>
	constructor(
		private readonly mex: MexFn,
		private readonly doFetch: FetchFn = (url, init) => fetch(url, init),
	) {}

	#acquire(): Promise<string> {
		this.#token ??= (async () => {
			const n = await this.mex<{ nonce?: string } | string>(NONCE.id, {}, NONCE.path)
			const nonce = typeof n === 'string' ? n : n?.nonce
			if (!nonce) throw new WwwError('no nonce from the server', 400, n)
			const t = await this.mex<{ access_token?: string } | string>(
				EXCHANGE.id,
				{ nonce },
				EXCHANGE.path,
			)
			const token = typeof t === 'string' ? t : t?.access_token
			if (!token) throw new WwwError('no access token from the server', 400, t)
			return token
		})().catch((e) => {
			this.#token = undefined
			throw e
		})
		return this.#token
	}

	/** Forget the token (a new session or account must not reuse it). */
	invalidate(): void {
		this.#token = undefined
	}

	async query<T = unknown>(docId: string, variables: unknown, dataPath: string): Promise<T> {
		for (let attempt = 0; ; attempt++) {
			const token = await this.#acquire()
			const res = await this.doFetch(ENDPOINT, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ access_token: token, doc_id: docId, variables, lang: 'en' }),
			})
			if ((res.status === 401 || res.status === 403) && attempt === 0) {
				this.#token = undefined
				continue
			}
			if (!res.ok) throw new WwwError(`GraphQL HTTP error ${res.status}`, res.status)
			const json = (await res.json()) as {
				data?: Record<string, unknown>
				errors?: { message?: string; extensions?: { error_code?: number } }[]
			}
			if (json.errors?.length)
				throw new WwwError(
					`GraphQL error: ${json.errors.map((e) => e.message ?? 'unknown').join(', ')}`,
					json.errors[0]!.extensions?.error_code ?? 400,
					json.errors[0],
				)
			const out = json.data?.[dataPath]
			if (out === undefined) throw new WwwError(`no ${dataPath} in the answer`, 400, json)
			return out as T
		}
	}
}

export interface EventInput {
	[key: string]: unknown
}

export class Events {
	constructor(private readonly www: WwwClient) {}

	/** Create an event. `input` is the server's event input (name, start time, chat, ...). */
	create = (input: EventInput): Promise<unknown> =>
		this.www.query(DOC.CREATE, { input }, 'xwa2_create_event')
	get = (eventId: string): Promise<unknown> =>
		this.www.query(DOC.GET, { event_id: eventId }, 'xwa2_get_event')
	update = (eventId: string, updates: EventInput): Promise<unknown> =>
		this.www.query(DOC.UPDATE, { ...updates, event_id: eventId }, 'xwa2_update_event')
	delete = (eventId: string): Promise<unknown> =>
		this.www.query(DOC.DELETE, { event_id: eventId }, 'xwa2_delete_event')
	list = (options: EventInput = {}): Promise<unknown> =>
		this.www.query(DOC.LIST, options, 'xwa2_list_events')
	/** Answer an invitation: going, not going, maybe. */
	rsvp = (eventId: string, rsvp: EventRsvp): Promise<unknown> =>
		this.www.query(DOC.RSVP, { event_id: eventId, rsvp }, 'xwa2_update_event_rsvp')
	invite = (eventId: string, jids: string[]): Promise<unknown> =>
		this.www.query(DOC.ADD_INVITATIONS, { event_id: eventId, jids }, 'xwa2_add_event_invitations')
	uninvite = (eventId: string, jids: string[]): Promise<unknown> =>
		this.www.query(
			DOC.REMOVE_INVITATIONS,
			{ event_id: eventId, jids },
			'xwa2_remove_event_invitations',
		)
	/** Take yourself off an event's guest list. */
	leave = (eventId: string): Promise<unknown> =>
		this.www.query(DOC.REMOVE_SELF, { event_id: eventId }, 'xwa2_remove_self_event_invitation')
	inviteLink = (eventId: string): Promise<unknown> =>
		this.www.query(DOC.INVITE_LINK, { event_id: eventId }, 'xwa2_get_or_create_event_invite_link')
	rotateInviteLink = (eventId: string): Promise<unknown> =>
		this.www.query(DOC.ROTATE_LINK, { event_id: eventId }, 'xwa2_rotate_event_invite_link')
	linkPreview = (url: string): Promise<unknown> =>
		this.www.query(DOC.LINK_PREVIEW, { url }, 'xwa2_get_event_link_preview')
	presetCovers = (): Promise<unknown> =>
		this.www.query(DOC.PRESET_COVERS, {}, 'xwa2_list_preset_cover_images')
}
