// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { readFile } from 'node:fs/promises'
import type { Readable } from 'node:stream'
import type { Client } from '../../client.js'
import { guardedFetch } from './link-preview.js'
import type { MessageKey, Quoted } from './messages.js'

// `client.send(jid, content)`: say what to send in one object, instead of picking the method.
//
//   await client.send(jid, { text: 'hi' })
//   await client.send(jid, { image: fs.readFileSync('a.jpg'), caption: 'look' }, { quoted: m })
//   await client.send(jid, { poll: { name: 'Pizza?', values: ['yes', 'no'] } })

/**
 * Media as bytes, an `http(s)` URL, a local file, or a stream. `{ url }` can only ever be fetched from the network;
 * a local file needs the explicit `{ path }`, so a link that came from outside can never read a file off this machine.
 * Only pass `{ path }` for paths you chose yourself.
 */
export type MediaSource = Uint8Array | { url: string } | { path: string } | { stream: Readable }

interface Common {
	/** JIDs to @mention (the text needs `@<number>` for each). */
	mentions?: string[]
	/** Open-once media. */
	viewOnce?: boolean
}

export type MessageContent = Common &
	(
		| { text: string; linkPreview?: boolean }
		| { image: MediaSource; caption?: string; mimetype?: string }
		| { video: MediaSource; caption?: string; mimetype?: string; gif?: boolean }
		| { audio: MediaSource; voiceNote?: boolean; mimetype?: string; seconds?: number }
		| { document: MediaSource; mimetype: string; fileName?: string; caption?: string }
		| { sticker: MediaSource }
		| { react: { key: MessageKey; emoji: string } }
		| { edit: MessageKey; text: string }
		| { revoke: MessageKey }
		| { forward: Record<string, unknown> }
		| { poll: { name: string; values: string[]; selectableCount?: number } }
		| { location: { latitude: number; longitude: number; name?: string; address?: string } }
		| { contacts: { displayName?: string; contacts: { name: string; vcard: string }[] } }
		| {
				text: string
				buttons: { id: string; text: string }[]
				footer?: string
				title?: string
		  }
		| {
				text: string
				title: string
				buttonText: string
				footer?: string
				sections: { title: string; rows: { id: string; title: string; description?: string }[] }[]
		  }
	)

export interface SendContentOptions {
	/** Reply to this message (what a received message gives you as `{ key, message }`). */
	quoted?: Quoted
	/** Disappearing-message timer in seconds for this message. */
	expiration?: number
}

const MAX_DOWNLOAD = 128 * 1024 * 1024

/** The bytes behind a media source. URLs go through the guarded fetch (http(s) only, no private addresses, size cap). */
export async function toBytes(src: MediaSource): Promise<Uint8Array> {
	if (src instanceof Uint8Array) return src
	if ('url' in src) {
		if (!/^https?:\/\//i.test(src.url))
			throw new Error('url must be http(s); use { path } for a local file')
		const res = await guardedFetch(60_000, MAX_DOWNLOAD)(src.url)
		if (!res.ok) throw new Error(`could not fetch ${src.url}: ${res.status}`)
		return new Uint8Array(await res.arrayBuffer())
	}
	if ('path' in src) return readFile(src.path)
	if ('stream' in src) {
		const chunks: Buffer[] = []
		let size = 0
		for await (const c of src.stream) {
			const b = Buffer.from(c as Uint8Array)
			size += b.length
			if (size > MAX_DOWNLOAD) throw new Error('stream is larger than the allowed size')
			chunks.push(b)
		}
		return Buffer.concat(chunks)
	}
	throw new Error('unsupported media source')
}

/** Send `content` and return the message id. */
export async function sendContent(
	client: Client,
	jid: string,
	content: MessageContent,
	options: SendContentOptions = {},
): Promise<string> {
	const c = content as unknown as Record<string, unknown> & Common
	const common = {
		...(options.quoted && { quoted: options.quoted }),
		...(c.mentions?.length && { mentions: c.mentions }),
		...(options.expiration && { expiration: options.expiration }),
	}

	if ('react' in c) {
		const r = c['react'] as { key: MessageKey; emoji: string }
		return client.react(r.key, r.emoji)
	}
	if ('revoke' in c) return client.revoke(c['revoke'] as MessageKey)
	if ('edit' in c) return client.edit(c['edit'] as MessageKey, c['text'] as string)
	if ('forward' in c) return client.forwardMessage(jid, c['forward'] as Record<string, unknown>)
	if ('poll' in c) {
		const p = c['poll'] as { name: string; values: string[]; selectableCount?: number }
		return client.sendPoll(jid, p.name, p.values, p.selectableCount ?? 1)
	}
	if ('location' in c) {
		const l = c['location'] as {
			latitude: number
			longitude: number
			name?: string
			address?: string
		}
		return client.sendLocation(jid, l.latitude, l.longitude, {
			...(l.name && { name: l.name }),
			...(l.address && { address: l.address }),
		})
	}
	if ('contacts' in c) {
		const set = c['contacts'] as {
			displayName?: string
			contacts: { name: string; vcard: string }[]
		}
		const [first] = set.contacts
		if (!first) throw new Error('contacts needs at least one contact')
		return client.sendMessage(
			jid,
			set.contacts.length === 1
				? { contactMessage: { displayName: first.name, vcard: first.vcard } }
				: {
						contactsArrayMessage: {
							displayName: set.displayName ?? '',
							contacts: set.contacts.map((x) => ({ displayName: x.name, vcard: x.vcard })),
						},
					},
		)
	}
	if ('buttons' in c)
		return client.sendButtons(jid, {
			text: c['text'] as string,
			buttons: c['buttons'] as { id: string; text: string }[],
			...(typeof c['footer'] === 'string' && { footer: c['footer'] }),
			...(typeof c['title'] === 'string' && { title: c['title'] }),
		})
	if ('sections' in c)
		return client.sendList(jid, {
			title: c['title'] as string,
			text: c['text'] as string,
			buttonText: c['buttonText'] as string,
			sections: c['sections'] as { title: string; rows: { id: string; title: string }[] }[],
			...(typeof c['footer'] === 'string' && { footer: c['footer'] }),
		})
	for (const kind of ['image', 'video', 'audio', 'document', 'sticker'] as const) {
		if (!(kind in c)) continue
		return client.sendMedia(jid, kind, await toBytes(c[kind] as MediaSource), {
			...common,
			...(typeof c['caption'] === 'string' && { caption: c['caption'] }),
			...(typeof c['mimetype'] === 'string' && { mimetype: c['mimetype'] }),
			...(typeof c['fileName'] === 'string' && { fileName: c['fileName'] }),
			...(typeof c['seconds'] === 'number' && { seconds: c['seconds'] }),
			...(c['voiceNote'] === true && { ptt: true }),
			...(c['gif'] === true && { gifPlayback: true }),
			...(c.viewOnce && { viewOnce: true }),
		})
	}
	if (typeof c['text'] === 'string')
		return client.sendText(jid, c['text'], {
			...common,
			...(c['linkPreview'] === true && { linkPreview: true }),
		})
	throw new Error(`send: this content is not supported (keys: ${Object.keys(c).join(', ')})`)
}
