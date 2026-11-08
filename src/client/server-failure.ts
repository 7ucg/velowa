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

const byCode = (code: string | undefined): ServerFailure | undefined =>
	code === '401' ? 'logged-out' : code === '403' ? 'forbidden' : undefined

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
 * `<stream:error>`'s own `code` space is unrelated (it includes transient codes like `515` "restart required",
 * handled separately by `streamErrorReconnectHint`) and keeps its own deny-list behavior: anything other than
 * `401`/`403`/`409`/`516`/a recognised `<conflict>` is not terminal.
 */
export function classifyServerFailure(node: BinaryNode): ServerFailure | undefined {
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
	// `<stream:error>`'s own code space is unrelated to `<failure reason>`'s (409/516 mean something else
	// there - see the docstring above) - 409 bare is the same "another session took over" as the
	// <conflict type="replaced"> form, and 516 is a second, less common logged-out code.
	const code = node.attrs['code']
	if (code === '409') return 'replaced'
	if (code === '516') return 'logged-out'
	return byCode(code)
}

/**
 * A non-terminal `<stream:error>` that still changes how the reconnect should behave: `515` ("restart
 * required") is an expected, routine disconnect worth retrying immediately, with no backoff wait; `429`
 * (rate limited) is worth an extra backoff penalty on top of the normal increment, so the client backs off
 * harder instead of hammering a server that just told it to slow down.
 */
export function streamErrorReconnectHint(node: BinaryNode): 'immediate' | 'penalty' | undefined {
	if (node.tag !== 'stream:error') return undefined
	const code = node.attrs['code']
	if (code === '515') return 'immediate'
	if (code === '429') return 'penalty'
	return undefined
}
