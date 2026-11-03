// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Where a client keeps its login. A paired account uses `authDir` (default `auth`). A call-link guest is a throwaway
 * identity that must never touch an account's folder: the constructor writes `creds.json` and the Signal state into the
 * auth folder, so a guest created without its own `authDir` would overwrite the credentials of the account in `auth/`
 * and unlink it. A guest therefore gets a private temporary folder unless one is named explicitly.
 */
export function resolveAuthDir(o: { authDir?: string; guest?: unknown }): { dir: string; temporary: boolean } {
	if (o.authDir !== undefined) return { dir: o.authDir, temporary: false }
	if (o.guest) return { dir: mkdtempSync(join(tmpdir(), 'velowa-guest-')), temporary: true }
	return { dir: 'auth', temporary: false }
}
