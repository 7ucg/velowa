import { describe, expect, it } from 'vitest'
import type { BinaryNode } from '../../../../src/codec/index.js'
import {
	parseOfflineCompleted,
	parseOfflinePreview,
} from '../../../../src/client/features/account/offline-sync.js'

const node = (tag: string, attrs: Record<string, string>, content?: BinaryNode[]) =>
	({ tag, attrs, ...(content !== undefined && { content }) }) as BinaryNode

describe('parseOfflinePreview', () => {
	it('reads the counts off the offline_preview child', () => {
		expect(
			parseOfflinePreview(
				node('ib', {}, [
					node('offline_preview', {
						count: '12',
						appdata: '3',
						message: '5',
						notification: '2',
						receipt: '2',
					}),
				]),
			),
		).toEqual({ total: 12, appDataChanges: 3, messages: 5, notifications: 2, receipts: 2 })
	})

	it('is undefined without an offline_preview child', () => {
		expect(parseOfflinePreview(node('ib', {}))).toBeUndefined()
	})
})

describe('parseOfflineCompleted', () => {
	it('reads the count off the offline child', () => {
		expect(parseOfflineCompleted(node('ib', {}, [node('offline', { count: '7' })]))).toEqual({
			count: 7,
		})
	})

	it('is undefined without an offline child', () => {
		expect(parseOfflineCompleted(node('ib', {}))).toBeUndefined()
	})
})
