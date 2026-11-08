import { describe, expect, it } from 'vitest'
import { classifyServerFailure } from '../../src/client/server-failure.js'

const node = (tag: string, attrs: Record<string, string> = {}, content?: unknown[]) =>
	({ tag, attrs, ...(content && { content }) }) as Parameters<typeof classifyServerFailure>[0]

describe('classifyServerFailure', () => {
	it('knows a login the server no longer accepts (the device was unlinked): failure 401', () => {
		expect(classifyServerFailure(node('failure', { reason: '401', location: 'rva' }))).toBe(
			'logged-out',
		)
	})

	it('knows a refused account and the stream:error forms', () => {
		expect(classifyServerFailure(node('failure', { reason: '403' }))).toBe('forbidden')
		expect(classifyServerFailure(node('stream:error', { code: '401' }))).toBe('logged-out')
		expect(
			classifyServerFailure(
				node('stream:error', {}, [node('conflict', { type: 'device_removed' })]),
			),
		).toBe('logged-out')
		expect(
			classifyServerFailure(node('stream:error', {}, [node('conflict', { type: 'replaced' })])),
		).toBe('replaced')
	})

	it('only reconnects on failure 500/503 and stream:error codes with no specific meaning', () => {
		expect(classifyServerFailure(node('failure', { reason: '500' }))).toBeUndefined()
		expect(classifyServerFailure(node('failure', { reason: '503' }))).toBeUndefined()
		expect(classifyServerFailure(node('stream:error', { code: '515' }))).toBeUndefined() // restart required
		expect(classifyServerFailure(node('message', { reason: '401' }))).toBeUndefined()
		expect(classifyServerFailure(node('iq', { type: 'result' }))).toBeUndefined()
	})

	it('stops retrying on every other failure reason, named or not, instead of looping against a refusal', () => {
		expect(classifyServerFailure(node('failure', { reason: '402' }))).toBe('rejected') // temp ban
		expect(classifyServerFailure(node('failure', { reason: '405' }))).toBe('rejected') // client outdated
		expect(classifyServerFailure(node('failure', { reason: '600' }))).toBe('rejected') // outside WA Web's range
		expect(classifyServerFailure(node('failure', {}))).toBe('rejected') // no reason at all
	})
})
