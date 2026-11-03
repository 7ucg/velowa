import { describe, expect, it } from 'vitest'
import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolveAuthDir } from '../../src/client/auth-dir.js'

describe('resolveAuthDir', () => {
	it('keeps `auth` for an account and honours an explicit authDir', () => {
		expect(resolveAuthDir({})).toEqual({ dir: 'auth', temporary: false })
		expect(resolveAuthDir({ authDir: 'mine' })).toEqual({ dir: 'mine', temporary: false })
	})

	it('never lets a guest use the account folder: it gets a private temporary one', () => {
		const a = resolveAuthDir({ guest: { inviteCode: 'x', guestName: 'g' } })
		const b = resolveAuthDir({ guest: { inviteCode: 'x', guestName: 'g' } })
		expect(a.temporary).toBe(true)
		expect(a.dir).not.toBe('auth')
		expect(a.dir.startsWith(tmpdir())).toBe(true)
		expect(existsSync(a.dir)).toBe(true)
		expect(a.dir).not.toBe(b.dir) // one throwaway identity per guest
		rmSync(a.dir, { recursive: true, force: true })
		rmSync(b.dir, { recursive: true, force: true })
	})

	it('lets a guest name its own folder', () => {
		expect(resolveAuthDir({ guest: {}, authDir: 'g1' })).toEqual({ dir: 'g1', temporary: false })
	})
})
