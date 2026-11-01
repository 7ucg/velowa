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
		expect(await ok.u.check('rami', true, 'S1')).toEqual({
			available: true,
			username: 'rami',
			sessionId: 'S1',
		})
		expect(ok.calls[0]).toMatchObject({
			id: USERNAME_QUERY.CHECK,
			path: 'xwa2_username_check',
			vars: { username: 'rami', include_suggestions: true, session_id: 'S1', source: 'USER_INPUT' },
		})
		const taken = harness({
			result: 'INVALID',
			suggestions: ['rami1'],
			rejection_reasons: ['taken'],
		})
		expect(await taken.u.check('rami')).toMatchObject({
			available: false,
			suggestions: ['rami1'],
			rejectionReasons: ['taken'],
			suggestionsEligible: true,
		})
	})

	it('sets, deletes, reads and pins', async () => {
		const h = harness({ username: 'rami' })
		await h.u.set('rami', { pin: '1234', sessionId: 'S' })
		await h.u.delete()
		expect(await h.u.mine()).toBe('rami')
		await h.u.setPin(null)
		expect(h.calls[0]).toMatchObject({
			id: USERNAME_QUERY.SET,
			path: 'xwa2_username_set',
			vars: {
				username: 'rami',
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
