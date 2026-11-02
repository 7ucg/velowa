// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { randomInt } from 'node:crypto'

/**
 * A `User-Agent` string plus the `os_name`/`os_version`/`browser`/`browser_version` fields `guest_reg`
 * takes separately (see `guest.ts`) — the four always describe the same browser, so they are generated
 * together, never independently.
 */
export interface BrowserFingerprint {
	osName: string
	osVersion: string
	browser: string
	browserVersion: string
	userAgent: string
}

interface OsVariant {
	osName: string
	osVersion: string
	/** The part of the UA string between `Mozilla/5.0 (` and `)`. */
	uaPlatform: string
}

// Only `{ osName: 'Linux', osVersion: 'x86_64' }` with a Chrome build was ever actually sent to
// `guest_reg` and accepted (the captured session this whole flow is built from) — every other OS
// variant and every Chrome version here is a plausible, NOT individually wire-confirmed, extrapolation
// for fingerprint diversity. If `guest_reg` ever turns out to validate `os_name`/`browser` against an
// allow-list, only the Linux row is guaranteed to still work.
const OS_VARIANTS: OsVariant[] = [
	{ osName: 'Linux', osVersion: 'x86_64', uaPlatform: 'X11; Linux x86_64' },
	{ osName: 'Linux', osVersion: 'i686', uaPlatform: 'X11; Linux i686' },
	{ osName: 'Windows', osVersion: '10.0', uaPlatform: 'Windows NT 10.0; Win64; x64' },
	{ osName: 'Windows', osVersion: '6.1', uaPlatform: 'Windows NT 6.1; Win64; x64' },
	{ osName: 'Mac OS X', osVersion: '10.15.7', uaPlatform: 'Macintosh; Intel Mac OS X 10_15_7' },
	{ osName: 'Mac OS X', osVersion: '11.6.0', uaPlatform: 'Macintosh; Intel Mac OS X 11_6_0' },
	{ osName: 'Mac OS X', osVersion: '12.6.0', uaPlatform: 'Macintosh; Intel Mac OS X 12_6_0' },
	{ osName: 'Mac OS X', osVersion: '13.4.0', uaPlatform: 'Macintosh; Intel Mac OS X 13_4_0' },
]

// Chrome majors 100-159: spans several years of real releases around the captured session's own
// Chrome/156, so a given run's version is never implausible for "someone's installed browser".
const CHROME_MAJORS = Array.from({ length: 60 }, (_, i) => 100 + i)

/** `OS_VARIANTS.length * CHROME_MAJORS.length` complete, internally consistent fingerprints — at
 * least 250 by construction (currently {@link OS_VARIANTS}.length * {@link CHROME_MAJORS}.length). */
const POOL: BrowserFingerprint[] = OS_VARIANTS.flatMap((os) =>
	CHROME_MAJORS.map((major) => {
		const browserVersion = `${major}.0.0.0`
		return {
			osName: os.osName,
			osVersion: os.osVersion,
			browser: 'Chrome',
			browserVersion,
			userAgent: `Mozilla/5.0 (${os.uaPlatform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`,
		}
	}),
)

if (POOL.length < 250) throw new Error(`fingerprint pool has only ${POOL.length} entries, need >= 250`)

/** One full, self-consistent fingerprint, uniformly at random from a pool of {@link POOL.length}. */
export function randomFingerprint(): BrowserFingerprint {
	return POOL[randomInt(POOL.length)]!
}
