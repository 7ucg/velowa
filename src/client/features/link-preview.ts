import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export interface LinkPreview {
	/** The URL as found in the text. */
	matchedText: string
	/** Where the page says it lives (`og:url`, else the final URL). */
	canonicalUrl: string
	title: string
	description?: string
	imageUrl?: string
	/** Small JPEG preview picture, when one could be made. */
	jpegThumbnail?: Uint8Array
}

export interface LinkPreviewOptions {
	fetch?: typeof fetch
	/** Resolves a host to its addresses; replaced in tests. */
	resolve?: (host: string) => Promise<string[]>
	timeoutMs?: number
	/** Cap for the page (default 512 KiB) and the picture (default 1 MiB). */
	maxPageBytes?: number
	maxImageBytes?: number
	/** Thumbnails larger than this are dropped when no image library is installed. */
	maxThumbBytes?: number
}

const URL_RE = /\bhttps?:\/\/[^\s<>"']+/i
const MAX_REDIRECTS = 4

/** First http(s) URL in a text, without trailing punctuation. */
export function findUrl(text: string): string | undefined {
	const m = URL_RE.exec(text)
	return m?.[0].replace(/[.,;:!?)\]}]+$/, '')
}

/** True for addresses that must never be fetched on behalf of a chat message (loopback, private, link-local, ...). */
export function isPrivateAddress(ip: string): boolean {
	const v = isIP(ip)
	if (v === 4) {
		const [a, b] = ip.split('.').map(Number) as [number, number]
		return (
			a === 0 ||
			a === 10 ||
			a === 127 ||
			(a === 100 && b >= 64 && b <= 127) ||
			(a === 169 && b === 254) ||
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && b === 168) ||
			(a === 192 && b === 0) ||
			a >= 224
		)
	}
	if (v === 6) {
		const x = ip.toLowerCase()
		if (x === '::' || x === '::1') return true
		if (x.startsWith('::ffff:')) return isPrivateAddress(x.slice(7))
		return /^(fc|fd|fe[89ab])/.test(x) || x.startsWith('ff')
	}
	return true
}

async function resolveAll(host: string): Promise<string[]> {
	if (isIP(host)) return [host]
	return (await lookup(host, { all: true })).map((a) => a.address)
}

/** Fetch with a deadline, a manual redirect loop that re-checks every hop, and a byte cap. */
async function safeGet(
	url: string,
	o: Required<Pick<LinkPreviewOptions, 'timeoutMs'>> & LinkPreviewOptions,
	maxBytes: number,
	accept: string,
): Promise<{ body: Uint8Array; finalUrl: string; type: string } | undefined> {
	const doFetch = o.fetch ?? fetch
	const resolve = o.resolve ?? resolveAll
	let current = url
	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		const u = new URL(current)
		if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined
		if (u.username || u.password) return undefined
		if (u.port && u.port !== '80' && u.port !== '443') return undefined
		const host = u.hostname.replace(/^\[|\]$/g, '')
		const addrs = await resolve(host)
		if (!addrs.length || addrs.some(isPrivateAddress)) return undefined
		const res = await doFetch(current, {
			redirect: 'manual',
			signal: AbortSignal.timeout(o.timeoutMs),
			headers: {
				accept,
				'user-agent': 'Mozilla/5.0 (compatible; WhatsApp/2.24; +https://www.whatsapp.com)',
			},
		})
		if (res.status >= 300 && res.status < 400) {
			const loc = res.headers.get('location')
			if (!loc) return undefined
			current = new URL(loc, current).toString()
			continue
		}
		if (!res.ok || !res.body) return undefined
		if (Number(res.headers.get('content-length')) > maxBytes) return undefined
		const chunks: Uint8Array[] = []
		let total = 0
		const reader = res.body.getReader()
		for (;;) {
			const { done, value } = await reader.read()
			if (done) break
			total += value.length
			if (total > maxBytes) {
				await reader.cancel()
				break // a page can be truncated and still hold its <head>
			}
			chunks.push(value)
		}
		return {
			body: Buffer.concat(chunks),
			finalUrl: current,
			type: res.headers.get('content-type') ?? '',
		}
	}
	return undefined
}

const decodeEntities = (s: string): string =>
	s
		.replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
		.replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
		.replace(/&quot;/g, '"')
		.replace(/&apos;|&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&')

/** Meta tags (`property` or `name` -> content) and the `<title>` of an HTML page. */
export function parseHead(html: string): { meta: Map<string, string>; title?: string } {
	const meta = new Map<string, string>()
	for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
		const attrs: Record<string, string> = {}
		for (const a of tag[0].matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g))
			attrs[a[1]!.toLowerCase()] = a[3] ?? a[4] ?? ''
		const key = (attrs['property'] ?? attrs['name'])?.toLowerCase()
		if (key && attrs['content'] !== undefined && !meta.has(key))
			meta.set(key, decodeEntities(attrs['content']).trim())
	}
	const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
	return { meta, ...(t && { title: decodeEntities(t[1]!).replace(/\s+/g, ' ').trim() }) }
}

/** Shrink a picture to a chat-sized JPEG with `sharp` when it is installed; otherwise keep small JPEGs as they are. */
async function makeThumbnail(
	image: Uint8Array,
	type: string,
	maxBytes: number,
): Promise<Uint8Array | undefined> {
	try {
		const name = 'sharp'
		const mod = (await import(name)) as {
			default: (b: Uint8Array) => {
				resize(o: object): { jpeg(o: object): { toBuffer(): Promise<Buffer> } }
			}
		}
		return await mod
			.default(image)
			.resize({ width: 192, withoutEnlargement: true })
			.jpeg({ quality: 50 })
			.toBuffer()
	} catch {
		const isJpeg = image[0] === 0xff && image[1] === 0xd8 && /jpe?g/i.test(type)
		return isJpeg && image.length <= maxBytes ? image : undefined
	}
}

/**
 * Build the preview WhatsApp shows under a link: title, description and a small picture, read from the page's Open
 * Graph / Twitter / `<title>` tags. Returns undefined when the text has no link or the page gives no title. Hosts
 * that resolve to private addresses are never contacted.
 */
export async function fetchLinkPreview(
	text: string,
	opts: LinkPreviewOptions = {},
): Promise<LinkPreview | undefined> {
	const url = findUrl(text)
	if (!url) return undefined
	const o = { timeoutMs: 4000, ...opts }
	let page: Awaited<ReturnType<typeof safeGet>>
	try {
		page = await safeGet(url, o, opts.maxPageBytes ?? 512 * 1024, 'text/html,application/xhtml+xml')
	} catch {
		return undefined
	}
	if (!page || !/html/i.test(page.type)) return undefined
	const { meta, title: docTitle } = parseHead(Buffer.from(page.body).toString('utf8'))
	const title = meta.get('og:title') ?? meta.get('twitter:title') ?? docTitle
	if (!title) return undefined
	const description =
		meta.get('og:description') ?? meta.get('twitter:description') ?? meta.get('description')
	const rawImage = meta.get('og:image') ?? meta.get('twitter:image')
	let imageUrl: string | undefined
	if (rawImage) {
		try {
			imageUrl = new URL(rawImage, page.finalUrl).toString()
		} catch {
			/* ignore a broken image link */
		}
	}
	let jpegThumbnail: Uint8Array | undefined
	if (imageUrl) {
		try {
			const img = await safeGet(imageUrl, o, opts.maxImageBytes ?? 1024 * 1024, 'image/*')
			if (img)
				jpegThumbnail = await makeThumbnail(img.body, img.type, opts.maxThumbBytes ?? 30 * 1024)
		} catch {
			/* a preview without a picture is still a preview */
		}
	}
	return {
		matchedText: url,
		canonicalUrl: meta.get('og:url') ?? page.finalUrl,
		title,
		...(description && { description }),
		...(imageUrl && { imageUrl }),
		...(jpegThumbnail && { jpegThumbnail }),
	}
}

/** The text message that carries a preview. */
export function linkPreviewMessage(text: string, p: LinkPreview): Record<string, unknown> {
	return {
		extendedTextMessage: {
			text,
			matchedText: p.matchedText,
			canonicalUrl: p.canonicalUrl,
			title: p.title,
			...(p.description && { description: p.description }),
			previewType: 'NONE',
			...(p.jpegThumbnail && { jpegThumbnail: p.jpegThumbnail }),
		},
	}
}
