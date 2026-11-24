// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import {
	createCipheriv,
	createDecipheriv,
	createHash,
	createHmac,
	hkdfSync,
	randomBytes,
	timingSafeEqual,
} from 'node:crypto'
import type { BinaryNode } from '../../../codec/index.js'

/** Media kinds that have their own key-derivation label, upload path and message field. */
export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker'
/** Blobs the server hands out for sync (downloaded the same way, but never uploaded by us). */
export type BlobType =
	MediaType | 'md-app-state' | 'md-msg-hist' | 'sticker-pack' | 'sticker-pack-thumbnail'

const HKDF_LABEL: Record<BlobType, string> = {
	'md-app-state': 'App State',
	'md-msg-hist': 'History',
	'sticker-pack': 'Sticker Pack',
	'sticker-pack-thumbnail': 'Sticker Pack Thumbnail',
	image: 'Image',
	video: 'Video',
	audio: 'Audio',
	document: 'Document',
	sticker: 'Image',
}
const UPLOAD_PATH: Record<MediaType, string> = {
	image: '/mms/image',
	video: '/mms/video',
	audio: '/mms/audio',
	document: '/mms/document',
	sticker: '/mms/image',
}
/** Channel media has its own upload paths. */
const NEWSLETTER_PATH: Record<MediaType, string> = {
	image: '/newsletter/newsletter-image',
	video: '/newsletter/newsletter-video',
	audio: '/newsletter/newsletter-audio',
	document: '/newsletter/newsletter-document',
	sticker: '/newsletter/newsletter-image',
}
/** Where a channel post's preview picture goes (the server answers with its own path for it). */
export const NEWSLETTER_THUMBNAIL_PATH = '/newsletter/newsletter-thumbnail-image'
export const MEDIA_HOST = 'mmg.whatsapp.net'
const ORIGIN = 'https://web.whatsapp.com'
const MAC_LENGTH = 10

/** iv, AES key and HMAC key from a 32-byte media key: HKDF-SHA256 -> 112 bytes. */
export function mediaKeys(mediaKey: Uint8Array, type: BlobType) {
	const okm = Buffer.from(
		hkdfSync('sha256', mediaKey, Buffer.alloc(0), `WhatsApp ${HKDF_LABEL[type]} Keys`, 112),
	)
	return { iv: okm.subarray(0, 16), cipherKey: okm.subarray(16, 48), macKey: okm.subarray(48, 80) }
}

export interface EncryptedMedia {
	mediaKey: Buffer
	/** AES-256-CBC ciphertext followed by the first 10 bytes of HMAC-SHA256(iv || ciphertext). */
	encrypted: Buffer
	fileSha256: Buffer
	fileEncSha256: Buffer
	fileLength: number
}

export function encryptMedia(
	plain: Uint8Array,
	type: BlobType,
	mediaKey: Buffer = randomBytes(32),
): EncryptedMedia {
	const { iv, cipherKey, macKey } = mediaKeys(mediaKey, type)
	const cipher = createCipheriv('aes-256-cbc', cipherKey, iv)
	const body = Buffer.concat([cipher.update(plain), cipher.final()])
	const mac = createHmac('sha256', macKey).update(iv).update(body).digest().subarray(0, MAC_LENGTH)
	const encrypted = Buffer.concat([body, mac])
	return {
		mediaKey,
		encrypted,
		fileSha256: createHash('sha256').update(plain).digest(),
		fileEncSha256: createHash('sha256').update(encrypted).digest(),
		fileLength: plain.length,
	}
}

/** Channel media is uploaded unencrypted; the upload token is the hash of the file itself. */
export function rawMedia(plain: Uint8Array): EncryptedMedia {
	const sha = createHash('sha256').update(plain).digest()
	return {
		mediaKey: Buffer.alloc(0),
		encrypted: Buffer.from(plain),
		fileSha256: sha,
		fileEncSha256: sha,
		fileLength: plain.length,
	}
}

/** Remove the fields that only make sense for encrypted media from a channel message. */
export function stripMediaKeys(message: Record<string, unknown>): void {
	for (const body of Object.values(message)) {
		if (body && typeof body === 'object') {
			const b = body as Record<string, unknown>
			delete b['mediaKey']
			delete b['fileEncSha256']
			delete b['mediaKeyTimestamp']
		}
	}
}

/** A hash or MAC check failed: every media host serves the same ciphertext, so this is never a
 * transient, per-host problem - retrying a different host (or the same one again) will fail the
 * same way. Matches WA Web's own `MmsDownloadFilehashMismatchError` handling, which stops at the
 * first mismatch instead of exhausting every host first. */
export class MediaVerificationError extends Error {}

/** Decrypt downloaded media; throws if the MAC (or the optional plaintext hash) does not match.
 * `expect.unencrypted` must be set by the *caller* (channel media, most thumbnails) - never inferred from
 * `mediaKey` being empty, which an attacker-shaped message could claim just as easily to downgrade a
 * normally-encrypted download into an unauthenticated one. In that mode at least one of `fileSha256`/
 * `fileEncSha256` (the same value either way, nothing is encrypted) is required, not optional. */
export function decryptMedia(
	encrypted: Uint8Array,
	mediaKey: Uint8Array,
	type: BlobType,
	expect: { fileSha256?: Uint8Array; fileEncSha256?: Uint8Array; unencrypted?: boolean } = {},
): Buffer {
	if (expect.unencrypted) {
		const hash = expect.fileSha256 ?? expect.fileEncSha256
		if (!hash)
			throw new Error('unencrypted media needs fileSha256 or fileEncSha256 to verify against')
		const plain = Buffer.from(encrypted)
		if (!timingSafeEqualSafe(createHash('sha256').update(plain).digest(), hash))
			throw new MediaVerificationError('media hash mismatch')
		return plain
	}
	if (mediaKey.length !== 32) throw new Error('mediaKey must be 32 bytes')
	if (encrypted.length <= MAC_LENGTH) throw new Error('media payload too short')
	if (
		expect.fileEncSha256 &&
		!timingSafeEqualSafe(createHash('sha256').update(encrypted).digest(), expect.fileEncSha256)
	) {
		throw new MediaVerificationError('encrypted media hash mismatch')
	}
	const { iv, cipherKey, macKey } = mediaKeys(mediaKey, type)
	const body = Buffer.from(encrypted.subarray(0, encrypted.length - MAC_LENGTH))
	const mac = Buffer.from(encrypted.subarray(encrypted.length - MAC_LENGTH))
	const expectedMac = createHmac('sha256', macKey)
		.update(iv)
		.update(body)
		.digest()
		.subarray(0, MAC_LENGTH)
	if (!timingSafeEqualSafe(expectedMac, mac)) throw new MediaVerificationError('media MAC mismatch')
	const d = createDecipheriv('aes-256-cbc', cipherKey, iv)
	const plain = Buffer.concat([d.update(body), d.final()])
	if (
		expect.fileSha256 &&
		!timingSafeEqualSafe(createHash('sha256').update(plain).digest(), expect.fileSha256)
	) {
		throw new MediaVerificationError('media hash mismatch')
	}
	return plain
}

const timingSafeEqualSafe = (a: Uint8Array, b: Uint8Array): boolean =>
	a.length === b.length && timingSafeEqual(a, b)

// ---- upload / download ------------------------------------------------------------------------

export interface MediaConn {
	hosts: string[]
	auth: string
	ttl: number
	fetchedAt: number
}

/** `iq set w:m <media_conn/>` and its parsed answer. */
export const mediaConnRequest = (): BinaryNode => ({
	tag: 'iq',
	attrs: { type: 'set', xmlns: 'w:m', to: 's.whatsapp.net' },
	content: [{ tag: 'media_conn', attrs: {} }],
})

export function parseMediaConn(res: BinaryNode, now = Date.now()): MediaConn {
	const mc = Array.isArray(res.content)
		? res.content.find((c) => c.tag === 'media_conn')
		: undefined
	if (!mc) throw new Error('no media_conn in response')
	const hosts = (Array.isArray(mc.content) ? mc.content : [])
		.filter((c) => c.tag === 'host')
		.map((c) => c.attrs['hostname']!)
	return { hosts, auth: mc.attrs['auth'] ?? '', ttl: Number(mc.attrs['ttl'] ?? 0), fetchedAt: now }
}

/** Upload token form of a base64 hash: URL-safe, no padding. */
export const uploadToken = (hash: Uint8Array): string =>
	Buffer.from(hash).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export interface UploadResult {
	url: string
	directPath: string
	/** Channel uploads: the server-made thumbnail. */
	thumbnail?: { directPath: string; sha256: Uint8Array }
	/** Channel STATUS uploads only: the `media_id` attribute `sendChannelStatus` puts on the `<status>` stanza
	 * (confirmed against WA Web's own upload: `?...&media_id=<client token>&server_thumb_gen=1` on the same
	 * `/newsletter/newsletter-image` path this client already posts to - the response's `handle` field, not
	 * the query's own `media_id`, is what the stanza actually carries). */
	handle?: string
}

/** Hash that ties a poll option to its image: sha256-hex(sha256-hex(name) + base64(image sha256)). */
export const pollOptionHash = (name: string, imageSha256: Uint8Array): string =>
	createHash('sha256')
		.update(
			createHash('sha256').update(name, 'utf8').digest('hex') +
				Buffer.from(imageSha256).toString('base64'),
			'utf8',
		)
		.digest('hex')

type Fetch = typeof fetch

/** POST the encrypted blob to the first media host that accepts it. */
export async function uploadMedia(
	conn: MediaConn,
	type: MediaType,
	media: EncryptedMedia,
	fetchImpl: Fetch = fetch,
	channel = false,
	pathOverride?: string,
	extraQuery?: Record<string, string>,
): Promise<UploadResult> {
	const token = uploadToken(media.fileEncSha256)
	const query = extraQuery
		? '&' +
			Object.entries(extraQuery)
				.map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
				.join('&')
		: ''
	let lastError: unknown
	for (const host of conn.hosts) {
		const url = `https://${host}${pathOverride ?? (channel ? NEWSLETTER_PATH[type] : UPLOAD_PATH[type])}/${token}?auth=${encodeURIComponent(conn.auth)}&token=${token}${query}`
		try {
			const res = await fetchImpl(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/octet-stream', Origin: ORIGIN },
				body: new Uint8Array(media.encrypted),
			})
			const json = (await res.json().catch(() => undefined)) as
				| {
						url?: string
						direct_path?: string
						handle?: string
						thumbnail_info?: { thumbnail_direct_path?: string; thumbnail_sha256?: string }
				  }
				| undefined
			if (json?.url && json.direct_path) {
				const t = json.thumbnail_info
				return {
					url: json.url,
					directPath: json.direct_path,
					...(json.handle && { handle: json.handle }),
					...(t?.thumbnail_direct_path &&
						t.thumbnail_sha256 && {
							thumbnail: {
								directPath: t.thumbnail_direct_path,
								sha256: Buffer.from(t.thumbnail_sha256, 'base64'),
							},
						}),
				}
			}
			lastError = new Error(
				`upload to ${host} failed (HTTP ${res.status}): ${JSON.stringify(json)}`,
			)
		} catch (e) {
			lastError = e
		}
	}
	throw new Error('media upload failed on all hosts', { cause: lastError })
}

/** Delete an uploaded blob from the first media host that accepts it (e.g. after a failed/unwanted send). Only
 * the upload itself is removed - any message already pointing at it keeps failing to load, same as whatsmeow's
 * own `DeleteMedia`. `handle` is a channel upload's own `UploadResult.handle`, if there is one. */
export async function deleteMedia(
	conn: MediaConn,
	type: MediaType,
	directPath: string,
	fileEncSha256: Uint8Array,
	handle?: string,
	fetchImpl: Fetch = fetch,
): Promise<void> {
	const path = directPath.split('?')[0]!
	if (!path.startsWith('/') || path.startsWith('//') || /[\\@\s]|\.\.|[\u0000-\u001f]/.test(path))
		throw new Error('unsafe media directPath')
	if (fileEncSha256.length !== 32) throw new Error('fileEncSha256 must be a 32 byte sha256')
	const token = uploadToken(fileEncSha256)
	const dMd = Buffer.from(path, 'utf8').toString('base64url')
	let lastError: unknown
	for (const host of conn.hosts) {
		const url = `https://${host}${UPLOAD_PATH[type]}/${token}?token=${token}&d_md=${dMd}&auth=${encodeURIComponent(conn.auth)}${handle ? `&e_handle=${encodeURIComponent(handle)}` : ''}`
		try {
			const res = await fetchImpl(url, { method: 'DELETE', headers: { Origin: ORIGIN } })
			if (res.ok) return
			lastError = new Error(`delete on ${host} failed (HTTP ${res.status})`)
		} catch (e) {
			lastError = e
		}
	}
	throw new Error('media delete failed on all hosts', { cause: lastError })
}

export interface MediaRef {
	url?: string
	directPath?: string
	mediaKey: Uint8Array
	fileSha256?: Uint8Array
	fileEncSha256?: Uint8Array
	/** Plaintext length announced by the sender; bounds the download. */
	fileLength?: number
	/** Set only by a caller that knows, from its own context (channel media, a thumbnail with no
	 * `thumbnailEncSha256`) - never inferred from `mediaKey` alone - that this blob was never encrypted.
	 * Requires `fileSha256` or `fileEncSha256` to verify against; see `decryptMedia`. */
	unencrypted?: boolean
}

/** Hard ceiling for any single download (the largest WhatsApp media is 2 GB; this client buffers in memory). */
export const MAX_DOWNLOAD_BYTES = 256 * 1024 * 1024

/**
 * Media references come from other users, so they are not trusted: the target is always a WhatsApp media
 * host, or one of `extraHosts` (e.g. a configured self-hosted relay), verbatim and exact - never a suffix
 * match (`directPath` is joined onto each host and re-checked; `url` must already be https on one of them,
 * or a `*.whatsapp.net` host, with no credentials or custom port).
 */
export function safeMediaUrls(ref: MediaRef, extraHosts: string[] = []): string[] {
	const urls: string[] = []
	const hosts = [MEDIA_HOST, ...extraHosts]
	const dp = ref.directPath
	if (dp !== undefined) {
		if (!dp.startsWith('/') || dp.startsWith('//') || /[\\@\s]|\.\.|[\u0000-\u001f]/.test(dp))
			throw new Error('unsafe media directPath')
		for (const host of hosts) {
			const u = new URL(dp, `https://${host}`)
			if (u.hostname !== host || u.protocol !== 'https:' || u.username || u.password || u.port)
				throw new Error('unsafe media directPath')
			urls.push(u.toString())
		}
	}
	if (ref.url) {
		try {
			const u = new URL(ref.url)
			const okHost =
				u.hostname === MEDIA_HOST ||
				u.hostname.endsWith('.whatsapp.net') ||
				hosts.includes(u.hostname)
			if (u.protocol === 'https:' && okHost && !u.username && !u.password && !u.port)
				urls.push(u.toString())
		} catch {
			/* ignore a malformed url; directPath may still work */
		}
	}
	return urls
}

/** Read a response body, aborting once it exceeds `limit` bytes. */
async function readCapped(res: Response, limit: number): Promise<Uint8Array> {
	const declared = Number(res.headers.get('content-length'))
	if (declared > limit) throw new Error(`media too large (${declared} > ${limit} bytes)`)
	if (!res.body) return new Uint8Array(await res.arrayBuffer())
	const chunks: Uint8Array[] = []
	let total = 0
	const reader = res.body.getReader()
	for (;;) {
		const { done, value } = await reader.read()
		if (done) break
		total += value.length
		if (total > limit) {
			await reader.cancel()
			throw new Error(`media too large (> ${limit} bytes)`)
		}
		chunks.push(value)
	}
	return Buffer.concat(chunks)
}

/** A failed HTTP response worth retrying: rate-limited, or a server-side error, not a client one. */
class RetryableHttpError extends Error {
	constructor(
		readonly status: number,
		readonly retryAfterSec: number | undefined,
	) {
		super(`download failed: HTTP ${status}`)
	}
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** Download and decrypt one media message's payload, retrying a transient failure on each
 * candidate URL (network error, HTTP 429, or a 5xx) with capped, `Retry-After`-aware backoff
 * before giving up on that URL and moving to the next. */
export async function downloadMedia(
	ref: MediaRef,
	type: BlobType,
	fetchImpl: Fetch = fetch,
	extraHosts: string[] = [],
): Promise<Buffer> {
	const urls = safeMediaUrls(ref, extraHosts)
	if (!urls.length)
		throw new Error('media message has neither a usable directPath nor a WhatsApp https url')
	// AES-CBC output is at most one block longer than the input, plus the 10-byte MAC.
	const limit = Math.min(
		MAX_DOWNLOAD_BYTES,
		ref.fileLength !== undefined ? ref.fileLength + 16 + MAC_LENGTH : MAX_DOWNLOAD_BYTES,
	)
	const MAX_ATTEMPTS_PER_URL = 3
	let lastError: unknown
	for (const url of [...new Set(urls)]) {
		for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_URL; attempt++) {
			try {
				const res = await fetchImpl(url, { headers: { Origin: ORIGIN }, redirect: 'error' })
				if (!res.ok) {
					if (res.status === 429 || res.status >= 500) {
						const retryAfter = Number(res.headers.get('retry-after'))
						throw new RetryableHttpError(
							res.status,
							Number.isFinite(retryAfter) ? retryAfter : undefined,
						)
					}
					throw new Error(`download failed: HTTP ${res.status}`)
				}
				return decryptMedia(await readCapped(res, limit), ref.mediaKey, type, {
					...(ref.fileSha256 && { fileSha256: ref.fileSha256 }),
					...(ref.fileEncSha256 && { fileEncSha256: ref.fileEncSha256 }),
					...(ref.unencrypted && { unencrypted: true }),
				})
			} catch (e) {
				// Every host serves the same bytes, so a hash/MAC mismatch will fail identically on all
				// of them - stop immediately instead of downloading the whole file again per remaining host.
				if (e instanceof MediaVerificationError) throw e
				lastError = e
				const retryable = e instanceof RetryableHttpError || e instanceof TypeError
				if (!retryable || attempt === MAX_ATTEMPTS_PER_URL) break
				const retryAfterMs =
					e instanceof RetryableHttpError && e.retryAfterSec ? e.retryAfterSec * 1000 : 0
				await sleep(Math.max(retryAfterMs, 300 * 2 ** (attempt - 1)))
			}
		}
	}
	throw new Error('media download failed', { cause: lastError })
}

// ---- message building -------------------------------------------------------------------------

export interface MediaOptions {
	/** Post as a group status (to a group JID) instead of a normal message. */
	groupStatus?: boolean
	/** Channels only: label the post after sending (needs the post's server number from the ack). */
	labels?: { aiContent?: boolean; paidPartnership?: boolean }
	/** Extra fields of the media message itself (e.g. `annotations`). */
	fields?: Record<string, unknown>
	/** Extra `contextInfo` fields merged into the message (e.g. music attribution). */
	contextInfo?: Record<string, unknown>
	/** Extra stanza children, e.g. `<meta contenttype="song"/>`. */
	extraNodes?: BinaryNode[]
	mimetype?: string
	/** Tie this message to another (an album item to its album): goes into `messageContextInfo.messageAssociation`. */
	association?: {
		associationType: string
		parentMessageKey: { remoteJid: string; fromMe: boolean; id: string }
	}
	caption?: string
	/** Documents: shown file name. */
	fileName?: string
	/** Audio / video length in seconds. */
	seconds?: number
	/** Voice note (push-to-talk) instead of an audio file. */
	ptt?: boolean
	/** Open-once media (images / videos / voice notes). */
	viewOnce?: boolean
	/** Video as looping GIF. */
	gifPlayback?: boolean
	width?: number
	height?: number
	/** Small JPEG preview (no image library is bundled, so supply one if you want a thumbnail). */
	jpegThumbnail?: Uint8Array
	/** 64 byte waveform for voice notes. */
	waveform?: Uint8Array
}

const DEFAULT_MIME: Record<MediaType, string> = {
	image: 'image/jpeg',
	video: 'video/mp4',
	audio: 'audio/ogg; codecs=opus',
	document: 'application/octet-stream',
	sticker: 'image/webp',
}

/** The WAProto content field for an uploaded media blob, plus the `mediatype` hint for the `<enc>` nodes. */
export function mediaMessage(
	type: MediaType,
	media: EncryptedMedia,
	uploaded: UploadResult,
	o: MediaOptions = {},
	nowSeconds = Math.floor(Date.now() / 1000),
): { message: Record<string, unknown>; mediaType: string } {
	const common = {
		url: uploaded.url,
		directPath: uploaded.directPath,
		mediaKey: media.mediaKey,
		fileEncSha256: media.fileEncSha256,
		fileSha256: media.fileSha256,
		fileLength: media.fileLength,
		mediaKeyTimestamp: nowSeconds,
		mimetype: o.mimetype ?? DEFAULT_MIME[type],
	}
	const dims = { ...(o.width && { width: o.width }), ...(o.height && { height: o.height }) }
	const thumb = o.jpegThumbnail ? { jpegThumbnail: o.jpegThumbnail } : {}
	switch (type) {
		case 'image':
			return {
				message: {
					imageMessage: { ...common, ...dims, ...thumb, ...(o.caption && { caption: o.caption }) },
				},
				mediaType: 'image',
			}
		case 'video':
			return {
				message: {
					videoMessage: {
						...common,
						...dims,
						...thumb,
						...(o.seconds !== undefined && { seconds: o.seconds }),
						...(o.gifPlayback && { gifPlayback: true }),
						...(o.caption && { caption: o.caption }),
					},
				},
				mediaType: o.gifPlayback ? 'gif' : 'video',
			}
		case 'audio':
			return {
				message: {
					audioMessage: {
						...common,
						...(o.seconds !== undefined && { seconds: o.seconds }),
						...(o.ptt && { ptt: true }),
						...(o.waveform && { waveform: o.waveform }),
					},
				},
				mediaType: o.ptt ? 'ptt' : 'audio',
			}
		case 'document':
			return {
				message: {
					documentMessage: {
						...common,
						...thumb,
						fileName: o.fileName ?? 'file',
						title: o.fileName ?? 'file',
						...(o.caption && { caption: o.caption }),
					},
				},
				mediaType: 'document',
			}
		case 'sticker':
			return { message: { stickerMessage: { ...common, ...dims } }, mediaType: 'sticker' }
	}
}

/** Which media field and type a received message carries, if any. */
export function mediaOf(
	message: Record<string, unknown>,
): { type: MediaType; ref: MediaRef } | undefined {
	const map: [string, MediaType][] = [
		['imageMessage', 'image'],
		['videoMessage', 'video'],
		['audioMessage', 'audio'],
		['documentMessage', 'document'],
		['stickerMessage', 'sticker'],
	]
	for (const [field, type] of map) {
		const m = message[field] as Record<string, unknown> | undefined
		if (m?.['mediaKey']) {
			const b = (x: unknown) =>
				typeof x === 'string'
					? new Uint8Array(Buffer.from(x, 'base64'))
					: x instanceof Uint8Array
						? x
						: undefined
			return {
				type,
				ref: {
					url: m['url'] as string | undefined,
					directPath: m['directPath'] as string | undefined,
					...(m['fileLength'] !== undefined && { fileLength: Number(m['fileLength']) }),
					mediaKey: b(m['mediaKey'])!,
					...(b(m['fileSha256']) && { fileSha256: b(m['fileSha256'])! }),
					...(b(m['fileEncSha256']) && { fileEncSha256: b(m['fileEncSha256'])! }),
				},
			}
		}
	}
	return undefined
}

/** A message's own thumbnail (a link preview's picture, or a media message's small preview), independent
 * of its main attachment - e.g. `extendedTextMessage.contextInfo.externalAdReply`'s or an image/video
 * message's `thumbnailDirectPath`. Unencrypted when `thumbnailEncSha256` is absent (most link previews),
 * same as whatsmeow's own `DownloadThumbnail`; a present `thumbnailEncSha256` requires a real 32 byte
 * `mediaKey` to go with it, or the message is rejected outright rather than silently downgraded to an
 * unauthenticated download. */
export function thumbnailOf(message: Record<string, unknown>): MediaRef | undefined {
	const b = (x: unknown): Uint8Array | undefined =>
		typeof x === 'string'
			? new Uint8Array(Buffer.from(x, 'base64'))
			: x instanceof Uint8Array
				? x
				: undefined
	for (const body of Object.values(message)) {
		const m = body as Record<string, unknown> | undefined
		const directPath = m?.['thumbnailDirectPath']
		if (typeof directPath !== 'string') continue
		const encSha256 = b(m!['thumbnailEncSha256'])
		if (!encSha256)
			return {
				directPath,
				mediaKey: new Uint8Array(0),
				unencrypted: true,
				...(b(m!['thumbnailSha256']) && { fileSha256: b(m!['thumbnailSha256'])! }),
			}
		const mediaKey = b(m!['mediaKey'])
		if (!mediaKey || mediaKey.length !== 32)
			throw new Error('thumbnail claims encryption (thumbnailEncSha256) but has no valid mediaKey')
		return {
			directPath,
			mediaKey,
			fileEncSha256: encSha256,
			...(b(m!['thumbnailSha256']) && { fileSha256: b(m!['thumbnailSha256'])! }),
		}
	}
	return undefined
}

export interface StickerPackItem {
	directPath?: string
	url?: string
	mediaKey?: Uint8Array
	fileEncSha256?: Uint8Array
	fileSha256?: Uint8Array
	fileSize?: number
	mimetype?: string
	width?: number
	height?: number
	emojis: string[]
	accessibilityText?: string
	handle?: string
}

export interface StickerPackInfo {
	packId: string
	name: string
	publisher: string
	description: string
	stickers: StickerPackItem[]
	animated: boolean
	trayImageId?: string
}

/** Look up a sticker pack's metadata and stickers by id (the id carried on a received
 * `stickerPackMessage.stickerPackId`), the same public, unauthenticated endpoint whatsmeow's
 * `FetchStickerPack` uses - no connection needed. */
export async function fetchStickerPack(
	packId: string,
	fetchImpl: Fetch = fetch,
): Promise<StickerPackInfo> {
	const url = `https://static.whatsapp.net/sticker?lottie=1&cat=sticker_pack_data&id=${encodeURIComponent(packId)}&lg=en`
	const res = await fetchImpl(url, { headers: { Origin: ORIGIN } })
	if (!res.ok) throw new Error(`sticker pack lookup failed: HTTP ${res.status}`)
	const packs = (await res.json()) as {
		'sticker-pack-id'?: string
		name?: string
		publisher?: string
		description?: string
		animated?: number
		'tray-image-id'?: string
		stickers?: {
			'direct-path'?: string
			url?: string
			'media-key'?: string
			'enc-file-hash'?: string
			'file-hash'?: string
			'file-size'?: number
			mimetype?: string
			width?: number
			height?: number
			emojis?: string[]
			'accessibility-text'?: string
			handle?: string
		}[]
	}[]
	const pack = packs[0]
	if (!pack) throw new Error(`no sticker pack found for id ${packId}`)
	const b64 = (x: string | undefined) => (x ? new Uint8Array(Buffer.from(x, 'base64')) : undefined)
	return {
		packId: pack['sticker-pack-id'] ?? packId,
		name: pack.name ?? '',
		publisher: pack.publisher ?? '',
		description: pack.description ?? '',
		animated: !!pack.animated,
		...(pack['tray-image-id'] && { trayImageId: pack['tray-image-id'] }),
		stickers: (pack.stickers ?? []).map((s) => ({
			...(s['direct-path'] && { directPath: s['direct-path'] }),
			...(s.url && { url: s.url }),
			...(b64(s['media-key']) && { mediaKey: b64(s['media-key']) }),
			...(b64(s['enc-file-hash']) && { fileEncSha256: b64(s['enc-file-hash']) }),
			...(b64(s['file-hash']) && { fileSha256: b64(s['file-hash']) }),
			...(s['file-size'] !== undefined && { fileSize: s['file-size'] }),
			...(s.mimetype && { mimetype: s.mimetype }),
			...(s.width !== undefined && { width: s.width }),
			...(s.height !== undefined && { height: s.height }),
			emojis: s.emojis ?? [],
			...(s['accessibility-text'] && { accessibilityText: s['accessibility-text'] }),
			...(s.handle && { handle: s.handle }),
		})),
	}
}
