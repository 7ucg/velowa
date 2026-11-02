// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { execFile } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import type { AuthCreds } from '../auth/creds.js'
import { randomFingerprint, type BrowserFingerprint } from './fingerprint.js'
import type { ClientConfig } from './pairing.js'

const GUEST_REG_URL = 'https://v.whatsapp.net/v2/guest_reg'

const be = (n: number, len: number) => {
	const b = Buffer.alloc(len)
	b.writeUIntBE(n, 0, len)
	return b
}

/** Standard base64, `+/` swapped for `-_` (url-safe) — but padding kept, unlike Node's own `base64url`. */
const b64url = (b: Uint8Array): string =>
	Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')

/** `%XX` for every byte outside RFC 3986's unreserved set, one byte at a time — not `encodeURIComponent`
 * on a decoded string, which would turn bytes ≥0x80 into multi-byte UTF-8 escapes instead of themselves. */
const percentEncodeBytes = (b: Uint8Array): string => {
	let out = ''
	for (const byte of b) {
		const ch = String.fromCharCode(byte)
		out += /[A-Za-z0-9\-_.~]/.test(ch) ? ch : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`
	}
	return out
}

export interface GuestRegOptions {
	/** The call-link token (just the token; resolve a full URL with `parseCallLinkToken` first). */
	inviteCode: string
	/** Display name shown to the other call participants; copied into the roster at admission. */
	guestName: string
	/** UI locale as two codes, both the same case the real client sends. Default `['DE', 'DE']` (unconfirmed semantics — see guest.ts doc comment). */
	locale?: [lc: string, lg: string]
	/** Reuse an existing session's `accessSessionId` (from `newGuestSession()`) instead of generating a fresh one — the real client sends `guest_reg` and its `pre_pn_client_log` beacons (`guestPreFlightLog()`) under the same id. */
	accessSessionId?: string
	/** The `os_name`/`os_version`/`browser`/`browser_version` to send and the `User-Agent` to send them
	 * under — one random, internally consistent pick from `randomFingerprint()` (`fingerprint.ts`) by
	 * default. Pass one explicitly to also use it for the WS connection's own `User-Agent` (see
	 * `newGuestSession()` below and `Client`'s guest mode, which does exactly that). */
	fingerprint?: BrowserFingerprint
	/** Replaced in tests. */
	fetch?: typeof fetch
}

/**
 * Everything generated once per guest session and then reused everywhere it needs to stay
 * consistent: `accessSessionId`/`expid` across `guestReg()` and its `pre_pn_client_log` beacons
 * (`guestPreFlightLog()`), and `fingerprint` across those *and* the WS connection's `User-Agent`
 * (`Client`'s guest mode threads it through to `Connection`) — a guest_reg from "Chrome on Windows"
 * followed by a WebSocket login from "Chrome on Linux" would be an obvious tell.
 */
export interface GuestSession {
	accessSessionId: string
	/** Opaque per-session id the real client sends on every `pre_pn_client_log` call. Origin unconfirmed
	 * (looks client-generated, not tied to any server round-trip observed before it first appears) —
	 * a random url-safe token of the same shape is used here. */
	expid: string
	fingerprint: BrowserFingerprint
}

export function newGuestSession(): GuestSession {
	return {
		accessSessionId: randomUUID(),
		expid: randomBytes(16).toString('base64url'),
		fingerprint: randomFingerprint(),
	}
}

/**
 * Register a throwaway guest identity for one call link — what a browser does before it ever opens
 * the Noise WebSocket, when a call link is opened without being logged into WhatsApp. On success the
 * identity in `creds` (`noiseKey`, `signedIdentityKey`, `signedPreKey`, `registrationId`) is live on
 * the server, scoped to this one call link, and ready to log in with `guestPayload()` from `pairing.ts`.
 *
 * Every parameter and its exact wire encoding here is byte-for-byte from one captured human-driven
 * guest session (see WA_CALL_LINKS.md §14 and §15 in whatsapp-docs, and the raw capture it cites).
 * `locale` is NOT wire-confirmed and best-effort (`lc`/`lg` were both `"DE"` in that capture — a
 * session-specific value, not shown to be meaningful). `os_name`/`os_version`/`browser`/`browser_version`
 * and the `User-Agent` they go out under are a random, internally consistent pick from
 * `randomFingerprint()` (`fingerprint.ts`) by default, deliberately NOT the one literal combination the
 * capture showed — see that file's own doc comment for which parts of a picked fingerprint are and
 * are not wire-confirmed. Pass `fingerprint` to pin one (`Client`'s guest mode does, so the same
 * fingerprint's `userAgent` also goes on the WS connection — see `connection.ts`).
 *
 * `id`/`backup_token` are 20 raw random bytes, percent-encoded byte-by-byte — NOT base64, unlike every
 * other binary field here. On success the body is JSON: `{ ent_access_token, ent_canonical_fbid, lid,
 * status: "ok" }` — confirmed live; `lid` is the guest's own JID number, already assigned here (not
 * only at call admission, as WA_CALL_LINKS.md §6 assumed from the browser capture alone — the capture
 * never saw this response body). `ent_access_token`/`ent_canonical_fbid` are not used by anything in
 * this file; keep them if a future guest feature needs the GraphQL/MEX path (WA_CALL_LINKS.md §2's
 * `access_token=WA|...` is the same shape).
 *
 * The request needs a full browser-style header set (`Accept`/`Accept-Language`/`Accept-Encoding`,
 * `Origin`/`Referer`, `Sec-Fetch-*`); a bare `User-Agent` also gets accepted but never answered.
 *
 * Node's own `fetch` (undici) is, even with that full header set, unreliable against this one host:
 * live testing saw it silently stall and time out (~30s, then an empty-body HTTP 408) on roughly half
 * of otherwise-identical attempts, while `curl` against the exact same URL and headers answered in
 * 2-3s every time, repeatedly. The cause (TLS/HTTP2 fingerprinting on WhatsApp's edge, something in
 * undici's request shape, plain bad luck with this environment's network path) was not root-caused.
 * The practical fix applied here: `fetch` gets 8s (every real success observed was 2-3s) before this
 * falls back to shelling out to `curl` — still just one request, not a retry loop — and only propagates
 * the original `fetch` error if `curl` is missing or fails too. A caller-supplied `fetch` (tests; a
 * custom client) is trusted as-is and never gets this fallback.
 *
 * This does not handle the Arkose/captcha challenge WhatsApp may put in front of `guest_reg` on
 * suspected automated/high-volume registration (risk-based, did not fire in either capture session
 * this is based on) — that is an anti-abuse control, out of scope here, same as in the RE report.
 */
export interface GuestRegResult {
	status: number
	body: string
	/** Parsed from the body on a 200 with `status: "ok"` — see the doc comment above. */
	lid?: string
	entAccessToken?: string
	entCanonicalFbid?: string
}

export async function guestReg(
	creds: AuthCreds,
	config: ClientConfig,
	o: GuestRegOptions,
): Promise<GuestRegResult> {
	const [lc, lg] = o.locale ?? ['DE', 'DE']
	const fp = o.fingerprint ?? randomFingerprint()
	const idBytes = randomBytes(20)
	const q = (k: string, v: string) => `${k}=${encodeURIComponent(v)}`
	const query = [
		q('mcc', '310'),
		q('mnc', '999'),
		q('lc', lc),
		q('lg', lg),
		q('tos_version', '1'),
		q('device_id', randomUUID()),
		q('access_session_id', o.accessSessionId ?? randomUUID()),
		q('authkey', b64url(creds.noiseKey.publicKey)),
		q('e_regid', b64url(be(creds.registrationId, 4))),
		q('e_keytype', b64url(Buffer.from([5]))),
		q('e_ident', b64url(creds.signedIdentityKey.publicKey)),
		q('e_skey_id', b64url(be(creds.signedPreKey.keyId, 3))),
		q('e_skey_val', b64url(creds.signedPreKey.publicKey)),
		q('e_skey_sig', b64url(creds.signedPreKey.signature)),
		q('os_name', fp.osName),
		q('os_version', fp.osVersion),
		q('browser', fp.browser),
		q('browser_version', fp.browserVersion),
		q('web_build_version', `2.${config.version[1]}.${config.version[2]}`),
		q('guest_type', 'guest_calling'),
		q('invite_code', o.inviteCode),
		q('guest_name', o.guestName),
		`id=${percentEncodeBytes(idBytes)}`,
		`backup_token=${percentEncodeBytes(idBytes)}`,
	].join('&')
	const url = `${GUEST_REG_URL}?${query}`
	const headers = {
		'user-agent': fp.userAgent,
		accept: '*/*',
		'accept-language': 'en-US,en;q=0.9',
		'accept-encoding': 'gzip, deflate, br',
		'sec-fetch-site': 'same-site',
		'sec-fetch-mode': 'cors',
		'sec-fetch-dest': 'empty',
		origin: 'https://web.whatsapp.com',
		referer: 'https://web.whatsapp.com/',
	}
	const { status, body } = await fetchWithCurlFallback(url, headers, o.fetch)
	if (status !== 200) return { status, body }
	try {
		const parsed = JSON.parse(body) as {
			status?: string
			lid?: string
			ent_access_token?: string
			ent_canonical_fbid?: string
		}
		if (parsed.status === 'ok') {
			return {
				status,
				body,
				...(parsed.lid && { lid: parsed.lid }),
				...(parsed.ent_access_token && { entAccessToken: parsed.ent_access_token }),
				...(parsed.ent_canonical_fbid && { entCanonicalFbid: parsed.ent_canonical_fbid }),
			}
		}
	} catch {
		/* not JSON, or not the expected shape: return the raw body as-is */
	}
	return { status, body }
}

/**
 * One of the three client-side telemetry beacons a real guest session sends to `pre_pn_client_log`
 * around the join (`guest_calling_join_clicked` before `guest_reg`, `guest_calling_join_success`
 * right after it, `guest_calling_waiting_room_entered` once `link_join` puts the guest in the
 * waiting room — see WA_CALL_LINKS.md in whatsapp-docs for the capture this is from). Fire-and-forget:
 * errors are swallowed, since a real browser's beacon is not on the critical path either and nothing
 * here observes its result. Every one of the (several, all identical) captured calls carried the
 * same `inviteCode: null` in `client_metrics`, even for events sent well after the invite code was
 * known — replicated as-is rather than "fixed", since the point is to match the real client exactly.
 */
export async function guestPreFlightLog(
	event: 'guest_calling_join_clicked' | 'guest_calling_join_success' | 'guest_calling_waiting_room_entered',
	session: GuestSession,
	config: ClientConfig,
	fetchOverride?: typeof fetch,
): Promise<void> {
	const action = {
		guest_calling_join_clicked: 'click',
		guest_calling_join_success: 'continue',
		guest_calling_waiting_room_entered: 'view',
	}[event]
	const clientMetrics = JSON.stringify({
		inviteCode: null,
		appVersion: `2.${config.version[1]}.${config.version[2]}`,
		guestExperienceType: 'guest_calling',
		join_attempt: 1,
	})
	const q = (k: string, v: string) => `${k}=${encodeURIComponent(v)}`
	const query = [
		q('expid', session.expid),
		q('access_session_id', session.accessSessionId),
		q('current_screen', 'guest_calling_landing'),
		q('previous_screen', ''),
		q('action_taken', action),
		q('event_name', event),
		q('access_funnel_type', 'guest'),
		q('os_name', session.fingerprint.osName),
		q('os_version', session.fingerprint.osVersion),
		q('browser', session.fingerprint.browser),
		q('browser_version', session.fingerprint.browserVersion),
		q('client_metrics', clientMetrics),
	].join('&')
	try {
		await (fetchOverride ?? fetch)(`https://v.whatsapp.net/v2/pre_pn_client_log?${query}`, {
			headers: { 'user-agent': session.fingerprint.userAgent },
		})
	} catch {
		/* telemetry only: never fail the guest flow over this */
	}
}

/**
 * `fetch` (or `overrideFetch`, when given — trusted as-is, no fallback) with an 8s timeout; on a
 * timeout or any other `fetch` error, retries once via `curl` (if it's on PATH) before giving up.
 * See the `guestReg` doc comment above for why this exists.
 */
async function fetchWithCurlFallback(
	url: string,
	headers: Record<string, string>,
	overrideFetch?: typeof fetch,
): Promise<{ status: number; body: string }> {
	const viaFetch = async (): Promise<{ status: number; body: string }> => {
		const controller = new AbortController()
		const timer = setTimeout(() => controller.abort(), 8_000)
		try {
			const res = await (overrideFetch ?? fetch)(url, { headers, signal: controller.signal })
			return { status: res.status, body: await res.text() }
		} finally {
			clearTimeout(timer)
		}
	}
	try {
		return await viaFetch()
	} catch (error) {
		if (overrideFetch) throw error
		try {
			return await curlGet(url, headers)
		} catch {
			throw error
		}
	}
}

function curlGet(url: string, headers: Record<string, string>): Promise<{ status: number; body: string }> {
	return new Promise((resolve, reject) => {
		const headerArgs = Object.entries(headers).flatMap(([k, v]) => ['-H', `${k}: ${v}`])
		execFile(
			'curl',
			['-sS', '-o', '-', '-w', '\n__STATUS__%{http_code}', '--max-time', '20', ...headerArgs, url],
			{ maxBuffer: 10 * 1024 * 1024 },
			(error, stdout) => {
				if (error) return reject(error)
				const marker = stdout.lastIndexOf('\n__STATUS__')
				if (marker < 0) return reject(new Error('curl: no status marker in output'))
				resolve({
					status: Number(stdout.slice(marker + '\n__STATUS__'.length)),
					body: stdout.slice(0, marker),
				})
			},
		)
	})
}
