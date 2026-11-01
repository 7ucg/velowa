import { describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import {
	guardedFetch,
	fetchLinkPreview,
	findUrl,
	isPrivateAddress,
	linkPreviewMessage,
	parseHead,
} from '../../../../src/client/features/message/link-preview.js'

const html = `<html><head><title>Fallback</title>
<meta property="og:title" content="Hello &amp; welcome">
<meta property="og:description" content='A "page"'>
<meta property="og:image" content="/pic.jpg">
<meta property="og:url" content="https://example.com/canon"></head></html>`

function fakeFetch(routes: Record<string, () => Response>) {
	const seen: string[] = []
	const f = (async (url: string) => {
		seen.push(url)
		const r = routes[url]
		if (!r) return new Response('nope', { status: 404 })
		return r()
	}) as unknown as typeof fetch
	return { f, seen }
}

describe('link previews', () => {
	it('finds the first link and trims punctuation', () => {
		expect(findUrl('see https://example.com/a?b=1, ok')).toBe('https://example.com/a?b=1')
		expect(findUrl('no link')).toBeUndefined()
	})

	it('parses Open Graph tags and entities', () => {
		const { meta, title } = parseHead(html)
		expect(meta.get('og:title')).toBe('Hello & welcome')
		expect(meta.get('og:description')).toBe('A "page"')
		expect(title).toBe('Fallback')
	})

	it('classifies private addresses', () => {
		for (const ip of [
			'127.0.0.1',
			'10.1.2.3',
			'192.168.0.9',
			'169.254.169.254',
			'172.20.0.1',
			'::1',
			'fd00::1',
			'::ffff:10.0.0.1',
			'100.64.0.1',
		])
			expect(isPrivateAddress(ip), ip).toBe(true)
		for (const ip of ['8.8.8.8', '93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946'])
			expect(isPrivateAddress(ip), ip).toBe(false)
	})

	it('builds a preview with title, description and a small JPEG', async () => {
		const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
		const { f } = fakeFetch({
			'https://example.com/post': () =>
				new Response(html, { headers: { 'content-type': 'text/html' } }),
			'https://example.com/pic.jpg': () =>
				new Response(jpeg, { headers: { 'content-type': 'image/jpeg' } }),
		})
		const p = await fetchLinkPreview('look https://example.com/post', {
			fetch: f,
			resolve: async () => ['93.184.216.34'],
		})
		expect(p).toMatchObject({
			matchedText: 'https://example.com/post',
			canonicalUrl: 'https://example.com/canon',
			title: 'Hello & welcome',
			description: 'A "page"',
			imageUrl: 'https://example.com/pic.jpg',
		})
		expect(p?.jpegThumbnail).toBeDefined()
		expect(linkPreviewMessage('look', p!)).toMatchObject({
			extendedTextMessage: { matchedText: 'https://example.com/post', title: 'Hello & welcome' },
		})
	})

	it('never contacts private hosts, also not through a redirect', async () => {
		const { f, seen } = fakeFetch({
			'https://evil.example/go': () =>
				new Response(null, {
					status: 302,
					headers: { location: 'http://internal.example/secret' },
				}),
		})
		const resolve = async (h: string) =>
			h === 'internal.example' ? ['10.0.0.5'] : ['93.184.216.34']
		expect(await fetchLinkPreview('https://evil.example/go', { fetch: f, resolve })).toBeUndefined()
		expect(seen).toEqual(['https://evil.example/go']) // the redirect target was refused before any request
		expect(
			await fetchLinkPreview('http://localhost/x', {
				fetch: f,
				resolve: async () => ['127.0.0.1'],
			}),
		).toBeUndefined()
		expect(
			await fetchLinkPreview('https://example.com:8443/x', { fetch: f, resolve }),
		).toBeUndefined()
	})
})

describe('connect-time guard (DNS rebinding)', () => {
	it('refuses to connect when the name resolves to a loopback address', async () => {
		let hit = false
		const server = createServer((_, res) => {
			hit = true
			res.end('secret')
		})
		await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
		const port = (server.address() as { port: number }).port
		// "localhost" passes no string check here: only the lookup at connect time can stop it.
		await expect(guardedFetch(2000)(`http://localhost:${port}/`)).rejects.toThrow(/private address/)
		expect(hit).toBe(false)
		server.close()
	})

	it('honours the caller abort and an overall deadline', async () => {
		// Both fail before any data flows; example.com is only resolved, never needed to answer.
		const ac = new AbortController()
		ac.abort()
		await expect(
			guardedFetch(5000)('http://example.com/', { signal: ac.signal } as RequestInit),
		).rejects.toThrow()
		await expect(guardedFetch(1)('http://example.com/')).rejects.toThrow()
	})
})
