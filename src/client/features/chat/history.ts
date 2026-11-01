// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { inflateSync } from 'node:zlib'
import { protoType } from '../../proto.js'
import { downloadMedia } from '../message/media.js'
import type { MediaRef } from '../message/media.js'

/** Cap on the inflated size of one history chunk (a decompression bomb guard). */
const MAX_INFLATED_BYTES = 512 * 1024 * 1024

export interface HistoryNotification {
	ref: MediaRef
	syncType?: string
	chunkOrder?: number
	progress?: number
	/** Small histories travel inline (zlib-compressed) instead of as a download. */
	inline?: Uint8Array
}

export interface HistoryMessage {
	key: { remoteJid: string; fromMe: boolean; id: string; participant?: string }
	message?: Record<string, unknown>
	timestamp?: number
	pushName?: string
}

export interface HistoryChat {
	id: string
	name?: string
	unreadCount?: number
	conversationTimestamp?: number
	archived?: boolean
	pinned?: boolean
	muteEndTime?: number
	ephemeralExpiration?: number
	messages: HistoryMessage[]
}

export interface HistoryChunk {
	syncType: string
	progress?: number
	chunkOrder?: number
	chats: HistoryChat[]
	pushNames: { id: string; name: string }[]
	/** LID <-> phone-number pairs learned from the history. */
	lidMappings: { lid: string; pn: string }[]
}

type Raw = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const num = (v: unknown): number | undefined =>
	v === undefined || v === null || v === '' ? undefined : Number(v)

/** Decompress + decode one `HistorySync` blob into a plain chunk. */
export function parseHistory(compressed: Uint8Array): HistoryChunk {
	const inflated = inflateSync(compressed, { maxOutputLength: MAX_INFLATED_BYTES })
	const T = protoType('HistorySync')
	const h = T.toObject(T.decode(inflated), { longs: String, bytes: String, enums: String }) as Raw
	const chats: HistoryChat[] = (h['conversations'] ?? []).map((c: Raw): HistoryChat => {
		const messages: HistoryMessage[] = (c['messages'] ?? []).flatMap((m: Raw) => {
			const w: Raw | undefined = m['message']
			if (!w?.['key']) return []
			return [
				{
					key: {
						remoteJid: w['key'].remoteJid ?? c['id'],
						fromMe: Boolean(w['key'].fromMe),
						id: w['key'].id,
						...(w['key'].participant && { participant: w['key'].participant }),
					},
					...(w['message'] && { message: w['message'] }),
					...(num(w['messageTimestamp']) !== undefined && {
						timestamp: num(w['messageTimestamp'])!,
					}),
					...(w['pushName'] && { pushName: w['pushName'] }),
				},
			]
		})
		return {
			id: c['id'],
			...(c['name'] && { name: c['name'] }),
			...(c['unreadCount'] !== undefined && { unreadCount: Number(c['unreadCount']) }),
			...(num(c['conversationTimestamp']) !== undefined && {
				conversationTimestamp: num(c['conversationTimestamp'])!,
			}),
			...(c['archived'] !== undefined && { archived: Boolean(c['archived']) }),
			...(num(c['pinned']) !== undefined && { pinned: num(c['pinned'])! > 0 }),
			...(num(c['muteEndTime']) !== undefined && { muteEndTime: num(c['muteEndTime'])! }),
			...(num(c['ephemeralExpiration']) !== undefined && {
				ephemeralExpiration: num(c['ephemeralExpiration'])!,
			}),
			messages,
		}
	})
	return {
		syncType: String(h['syncType'] ?? 'UNKNOWN'),
		...(num(h['progress']) !== undefined && { progress: num(h['progress'])! }),
		...(num(h['chunkOrder']) !== undefined && { chunkOrder: num(h['chunkOrder'])! }),
		chats,
		pushNames: (h['pushnames'] ?? [])
			.filter((p: Raw) => p.id && p.pushname)
			.map((p: Raw) => ({ id: p.id, name: p.pushname })),
		lidMappings: (h['phoneNumberToLidMappings'] ?? [])
			.filter((m: Raw) => m.lidJid && m.pnJid)
			.map((m: Raw) => ({ lid: m.lidJid, pn: m.pnJid })),
	}
}

/** Fetch (or take inline) and parse the history a phone announced with a `historySyncNotification`. */
export async function loadHistory(
	n: HistoryNotification,
	download: typeof downloadMedia = downloadMedia,
): Promise<HistoryChunk> {
	const compressed = n.inline?.length ? n.inline : await download(n.ref, 'md-msg-hist')
	const chunk = parseHistory(compressed)
	return {
		...chunk,
		...(n.progress !== undefined && chunk.progress === undefined && { progress: n.progress }),
		...(n.chunkOrder !== undefined &&
			chunk.chunkOrder === undefined && { chunkOrder: n.chunkOrder }),
	}
}
