// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { BinaryNode } from '../codec/index.js'

/**
 * Why the server ended a session for good. Reconnecting would only repeat the refusal (and hammer the server), so the
 * client stops: `logged-out` (the device was unlinked on the phone or the session was revoked: link again),
 * `forbidden` (the account may not use this client) and `replaced` (another session of the same device took over).
 */
export type ServerFailure = 'logged-out' | 'forbidden' | 'replaced'

/**
 * Recognise the stanzas with which the server refuses or ends a session:
 *   `<failure reason="401"/>` right after the handshake (a login with credentials the server no longer knows),
 *   `<stream:error code="401"/>`, `<stream:error><conflict type="device_removed"/></stream:error>` and
 *   `<stream:error><conflict type="replaced"/></stream:error>`.
 * Anything else, including other failure codes, is not terminal and returns undefined.
 */
export function classifyServerFailure(node: BinaryNode): ServerFailure | undefined {
	const byCode = (code: string | undefined): ServerFailure | undefined =>
		code === '401' ? 'logged-out' : code === '403' ? 'forbidden' : undefined
	if (node.tag === 'failure') return byCode(node.attrs['reason'])
	if (node.tag !== 'stream:error') return undefined
	const conflict = Array.isArray(node.content) ? node.content.find((c) => c.tag === 'conflict') : undefined
	const type = conflict?.attrs['type']
	if (type === 'device_removed') return 'logged-out'
	if (type === 'replaced') return 'replaced'
	return byCode(node.attrs['code'])
}
