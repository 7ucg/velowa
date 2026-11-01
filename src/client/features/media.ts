import {
	createCipheriv,
	createDecipheriv,
	createHash,
	createHmac,
	hkdfSync,
	randomBytes,
	timingSafeEqual,
} from 'node:crypto'
import type { BinaryNode } from '../../codec/index.js'

/** Media kinds that have their own key-derivation label, upload path and message field. */
export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker'
/** Blobs the server hands out for sync (downloaded the same way, but never uploaded by us). */
export type BlobType = MediaType | 'md-app-state' | 'md-msg-hist'

const HKDF_LABEL: Record<BlobType, string> = {
	'md-app-state': 'App State',
	'md-msg-hist': 'History',
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

/** Decrypt downloaded media; throws if the MAC (or the optional plaintext hash) does not match. */
export function decryptMedia(
	encrypted: Uint8Array,
	mediaKey: Uint8Array,
	type: BlobType,
	expect: { fileSha256?: Uint8Array; fileEncSha256?: Uint8Array } = {},
): Buffer {
	if (encrypted.length <= MAC_LENGTH) throw new Error('media payload too short')
	if (
		expect.fileEncSha256 &&
		!timingSafeEqualSafe(createHash('sha256').update(encrypted).digest(), expect.fileEncSha256)
	) {
		throw new Error('encrypted media hash mismatch')
	}
	const { iv, cipherKey, macKey } = mediaKeys(mediaKey, type)
	const body = Buffer.from(encrypted.subarray(0, encrypted.length - MAC_LENGTH))
	const mac = Buffer.from(encrypted.subarray(encrypted.length - MAC_LENGTH))
	const expectedMac = createHmac('sha256', macKey)
		.update(iv)
		.update(body)
		.digest()
		.subarray(0, MAC_LENGTH)
	if (!timingSafeEqualSafe(expectedMac, mac)) throw new Error('media MAC mismatch')
	const d = createDecipheriv('aes-256-cbc', cipherKey, iv)
	const plain = Buffer.concat([d.update(body), d.final()])
	if (
		expect.fileSha256 &&
		!timingSafeEqualSafe(createHash('sha256').update(plain).digest(), expect.fileSha256)
	) {
		throw new Error('media hash mismatch')
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
}

type Fetch = typeof fetch

/** POST the encrypted blob to the first media host that accepts it. */
export async function uploadMedia(
	conn: MediaConn,
	type: MediaType,
	media: EncryptedMedia,
	fetchImpl: Fetch = fetch,
): Promise<UploadResult> {
	const token = uploadToken(media.fileEncSha256)
	let lastError: unknown
	for (const host of conn.hosts) {
		const url = `https://${host}${UPLOAD_PATH[type]}/${token}?auth=${encodeURIComponent(conn.auth)}&token=${token}`
		try {
			const res = await fetchImpl(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/octet-stream', Origin: ORIGIN },
				body: new Uint8Array(media.encrypted),
			})
			const json = (await res.json().catch(() => undefined)) as
				{ url?: string; direct_path?: string } | undefined
			if (json?.url && json.direct_path) return { url: json.url, directPath: json.direct_path }
			lastError = new Error(
				`upload to ${host} failed (HTTP ${res.status}): ${JSON.stringify(json)}`,
			)
		} catch (e) {
			lastError = e
		}
	}
	throw new Error('media upload failed on all hosts', { cause: lastError })
}

export interface MediaRef {
	url?: string
	directPath?: string
	mediaKey: Uint8Array
	fileSha256?: Uint8Array
	fileEncSha256?: Uint8Array
	/** Plaintext length announced by the sender; bounds the download. */
	fileLength?: number
}

/** Hard ceiling for any single download (the largest WhatsApp media is 2 GB; this client buffers in memory). */
export const MAX_DOWNLOAD_BYTES = 256 * 1024 * 1024

/**
 * Media references come from other users, so they are not trusted: the target is always a WhatsApp media
 * host (`directPath` is joined onto the known host and re-checked; `url` must already be https on a
 * `*.whatsapp.net` host with no credentials or custom port).
 */
export function safeMediaUrls(ref: MediaRef): string[] {
	const urls: string[] = []
	const dp = ref.directPath
	if (dp !== undefined) {
		if (!dp.startsWith('/') || dp.startsWith('//') || /[\\@\s]|\.\.|[\u0000-\u001f]/.test(dp))
			throw new Error('unsafe media directPath')
		const u = new URL(dp, `https://${MEDIA_HOST}`)
		if (u.hostname !== MEDIA_HOST || u.protocol !== 'https:' || u.username || u.password || u.port)
			throw new Error('unsafe media directPath')
		urls.push(u.toString())
	}
	if (ref.url) {
		try {
			const u = new URL(ref.url)
			const okHost = u.hostname === MEDIA_HOST || u.hostname.endsWith('.whatsapp.net')
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

/** Download and decrypt one media message's payload. */
export async function downloadMedia(
	ref: MediaRef,
	type: BlobType,
	fetchImpl: Fetch = fetch,
): Promise<Buffer> {
	const urls = safeMediaUrls(ref)
	if (!urls.length)
		throw new Error('media message has neither a usable directPath nor a WhatsApp https url')
	// AES-CBC output is at most one block longer than the input, plus the 10-byte MAC.
	const limit = Math.min(
		MAX_DOWNLOAD_BYTES,
		ref.fileLength !== undefined ? ref.fileLength + 16 + MAC_LENGTH : MAX_DOWNLOAD_BYTES,
	)
	let lastError: unknown
	for (const url of [...new Set(urls)]) {
		try {
			const res = await fetchImpl(url, { headers: { Origin: ORIGIN }, redirect: 'error' })
			if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`)
			return decryptMedia(await readCapped(res, limit), ref.mediaKey, type, {
				...(ref.fileSha256 && { fileSha256: ref.fileSha256 }),
				...(ref.fileEncSha256 && { fileEncSha256: ref.fileEncSha256 }),
			})
		} catch (e) {
			lastError = e
		}
	}
	throw new Error('media download failed', { cause: lastError })
}

// ---- message building -------------------------------------------------------------------------

export interface MediaOptions {
	mimetype?: string
	caption?: string
	/** Documents: shown file name. */
	fileName?: string
	/** Audio / video length in seconds. */
	seconds?: number
	/** Voice note (push-to-talk) instead of an audio file. */
	ptt?: boolean
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
