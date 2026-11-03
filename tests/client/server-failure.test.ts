import { describe, expect, it } from 'vitest'
import { classifyServerFailure } from '../../src/client/server-failure.js'

const node = (tag: string, attrs: Record<string, string> = {}, content?: unknown[]) =>
	({ tag, attrs, ...(content && { content }) }) as Parameters<typeof classifyServerFailure>[0]

describe('classifyServerFailure', () => {
	it('knows a login the server no longer accepts (the device was unlinked): failure 401', () => {
		expect(classifyServerFailure(node('failure', { reason: '401', location: 'rva' }))).toBe('logged-out')
	})

	it('knows a refused account and the stream:error forms', () => {
		expect(classifyServerFailure(node('failure', { reason: '403' }))).toBe('forbidden')
		expect(classifyServerFailure(node('stream:error', { code: '401' }))).toBe('logged-out')
		expect(classifyServerFailure(node('stream:error', {}, [node('conflict', { type: 'device_removed' })]))).toBe('logged-out')
		expect(classifyServerFailure(node('stream:error', {}, [node('conflict', { type: 'replaced' })]))).toBe('replaced')
	})

	it('leaves everything else alone, so ordinary stanzas and temporary errors still reconnect', () => {
		expect(classifyServerFailure(node('failure', { reason: '503' }))).toBeUndefined()
		expect(classifyServerFailure(node('failure', {}))).toBeUndefined()
		expect(classifyServerFailure(node('stream:error', { code: '515' }))).toBeUndefined() // restart required
		expect(classifyServerFailure(node('message', { reason: '401' }))).toBeUndefined()
		expect(classifyServerFailure(node('iq', { type: 'result' }))).toBeUndefined()
	})
})
