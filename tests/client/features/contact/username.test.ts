import { describe, expect, it } from 'vitest'
import { USERNAME_QUERY, Usernames } from '../../../../src/client/features/contact/username.js'

function harness(answer: unknown) {
	const calls: { id: string; vars: unknown; path?: string | undefined }[] = []
	const u = new Usernames(
		(async (id: string, vars: unknown, path?: string) => (
			calls.push({ id, vars, path }),
			answer
		)) as never,
	)
	return { u, calls }
}

describe('usernames', () => {
	it('reports an available name and a taken one with suggestions', async () => {
		const ok = harness({ result: 'SUCCESS' })
		expect(await ok.u.check('someone', true, 'S1')).toEqual({
			available: true,
			username: 'someone',
			sessionId: 'S1',
		})
		expect(ok.calls[0]).toMatchObject({
			id: USERNAME_QUERY.CHECK,
			path: 'xwa2_username_check',
			vars: {
				username: 'someone',
				include_suggestions: true,
				session_id: 'S1',
				source: 'USER_INPUT',
			},
		})
		const taken = harness({
			result: 'INVALID',
			suggestions: ['someone1'],
			rejection_reasons: ['taken'],
		})
		expect(await taken.u.check('someone')).toMatchObject({
			available: false,
			suggestions: ['someone1'],
			rejectionReasons: ['taken'],
			suggestionsEligible: true,
		})
	})

	it('sets, deletes, reads and pins', async () => {
		const h = harness({ username: 'someone' })
		await h.u.set('someone', { pin: '1234', sessionId: 'S' })
		await h.u.delete()
		expect(await h.u.mine()).toBe('someone')
		await h.u.setPin(null)
		expect(h.calls[0]).toMatchObject({
			id: USERNAME_QUERY.SET,
			path: 'xwa2_username_set',
			vars: {
				username: 'someone',
				reserved: true,
				source: 'USER_INPUT',
				session_id: 'S',
				pin: '1234',
			},
		})
		expect(h.calls[1]).toMatchObject({ path: 'xwa2_username_delete', vars: { username: null } })
		expect(h.calls[3]).toMatchObject({ id: USERNAME_QUERY.PIN_SET, vars: {} })
	})
})
