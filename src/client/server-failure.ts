// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { BinaryNode } from '../codec/index.js'

/**
 * Why the server ended a session for good. Reconnecting would only repeat the refusal (and hammer the server), so the
 * client stops: `logged-out` (the device was unlinked on the phone or the session was revoked: link again),
 * `forbidden` (the account may not use this client), `replaced` (another session of the same device took over) and
 * `rejected` (every other `<failure>` reason - a temp ban, an outdated client, one this client has no specific name
 * for, or none at all).
 */
export type ServerFailure = 'logged-out' | 'forbidden' | 'replaced' | 'rejected'

/**
 * Recognise the stanzas with which the server refuses or ends a session:
 *   `<failure reason="401"/>` right after the handshake (a login with credentials the server no longer knows),
 *   `<stream:error code="401"/>`, `<stream:error><conflict type="device_removed"/></stream:error>` and
 *   `<stream:error><conflict type="replaced"/></stream:error>`.
 *
 * A `<failure reason="...">` covers WA Web's whole 400..599 `ConnectFailureReason` space, and almost every one of
 * those means "retrying will only repeat the refusal" - only `500` (`InternalServerError`) and `503`
 * (`ServiceUnavailable`) are transient and worth another attempt. So that branch is an allow-list of what stays
 * non-terminal, not a deny-list of what becomes terminal: a reason this client has no specific name for - including
 * one that's missing entirely, which WA Web itself can't classify either - falls back to the generic `rejected`
 * instead of being retried forever against a server that will keep saying no.
 *
 * `<stream:error>`'s own `code` space is unrelated (it includes transient codes like `515` "restart required") and
 * keeps its existing deny-list behavior: anything other than `401`/`403`/a recognised `<conflict>` is not terminal.
 */
export function classifyServerFailure(node: BinaryNode): ServerFailure | undefined {
	const byCode = (code: string | undefined): ServerFailure | undefined =>
		code === '401' ? 'logged-out' : code === '403' ? 'forbidden' : undefined
	if (node.tag === 'failure') {
		const reason = node.attrs['reason']
		if (reason === '500' || reason === '503') return undefined
		return byCode(reason) ?? 'rejected'
	}
	if (node.tag !== 'stream:error') return undefined
	const conflict = Array.isArray(node.content)
		? node.content.find((c) => c.tag === 'conflict')
		: undefined
	const type = conflict?.attrs['type']
	if (type === 'device_removed') return 'logged-out'
	if (type === 'replaced') return 'replaced'
	return byCode(node.attrs['code'])
}
