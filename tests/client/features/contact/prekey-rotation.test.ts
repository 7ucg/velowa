import { describe, expect, it } from 'vitest'
import {
	SIGNED_PRE_KEY_INTERVAL_MS,
	rotateSignedPreKeyNode,
} from '../../../../src/client/features/contact/prekey-rotation.js'

describe('signed pre-key rotation', () => {
	it('builds the rotate stanza with a 3 byte big-endian id', () => {
		const n = rotateSignedPreKeyNode(
			0xabcdef,
			new Uint8Array(32).fill(1),
			new Uint8Array(64).fill(2),
		)
		expect(n.attrs).toEqual({ to: 's.whatsapp.net', type: 'set', xmlns: 'encrypt' })
		type N = { content: { content: (Uint8Array | N)[] }[] }
		const skey = (n as unknown as N).content[0]!.content[0] as unknown as {
			tag: string
			content: { content: Uint8Array }[]
		}
		expect(skey.tag).toBe('skey')
		expect([...skey.content[0]!.content]).toEqual([0xab, 0xcd, 0xef])
		expect(skey.content[1]!.content).toHaveLength(32)
		expect(skey.content[2]!.content).toHaveLength(64)
	})

	it('rotates about every four weeks', () => {
		expect(SIGNED_PRE_KEY_INTERVAL_MS).toBe(27 * 86_400_000)
	})
})
