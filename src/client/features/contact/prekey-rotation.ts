// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { BinaryNode } from '../../../codec/index.js'

/** How often a new signed pre-key is made (the interval WhatsApp Web uses). */
export const SIGNED_PRE_KEY_INTERVAL_MS = 27 * 24 * 60 * 60 * 1000

/** Signed pre-keys kept: the current one and the most recent ones it replaced. Older private keys are destroyed. */
export const SIGNED_PRE_KEY_RETENTION = 3

const be3 = (n: number): Uint8Array => new Uint8Array([(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff])

/** The stanza that replaces our signed pre-key on the server. */
export const rotateSignedPreKeyNode = (
	id: number,
	publicKey: Uint8Array,
	signature: Uint8Array,
): BinaryNode => ({
	tag: 'iq',
	attrs: { to: 's.whatsapp.net', type: 'set', xmlns: 'encrypt' },
	content: [
		{
			tag: 'rotate',
			attrs: {},
			content: [
				{
					tag: 'skey',
					attrs: {},
					content: [
						{ tag: 'id', attrs: {}, content: be3(id) },
						{ tag: 'value', attrs: {}, content: publicKey },
						{ tag: 'signature', attrs: {}, content: signature },
					],
				},
			],
		},
	],
})
