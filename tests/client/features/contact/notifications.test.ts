import { describe, expect, it } from 'vitest'
import type { BinaryNode } from '../../../../src/codec/index.js'
import {
	parseContactsNotification,
	parseDisappearingModeNotification,
	parsePictureNotification,
	parseStatusNotification,
} from '../../../../src/client/features/contact/notifications.js'

const node = (
	tag: string,
	attrs: Record<string, string> = {},
	content?: BinaryNode[] | string | Uint8Array,
) => ({ tag, attrs, ...(content !== undefined && { content }) }) as BinaryNode

describe('parsePictureNotification', () => {
	it('parses a set (update)', () => {
		expect(
			parsePictureNotification(
				node('notification', { from: 'a@s.whatsapp.net', t: '1700000000' }, [
					node('set', { jid: 'a@s.whatsapp.net', author: 'a@s.whatsapp.net', id: 'P1' }),
				]),
			),
		).toEqual({
			jid: 'a@s.whatsapp.net',
			author: 'a@s.whatsapp.net',
			removed: false,
			pictureId: 'P1',
			timestamp: 1700000000,
		})
	})

	it('parses a delete, and a bare notification as a removal too', () => {
		expect(
			parsePictureNotification(
				node('notification', { from: 'a@s.whatsapp.net' }, [
					node('delete', { jid: 'a@s.whatsapp.net' }),
				]),
			),
		).toMatchObject({ jid: 'a@s.whatsapp.net', removed: true })
		expect(parsePictureNotification(node('notification', { from: 'a@s.whatsapp.net' }))).toEqual({
			jid: 'a@s.whatsapp.net',
			removed: true,
		})
	})

	it('requires from', () => {
		expect(parsePictureNotification(node('notification', {}))).toBeUndefined()
	})
})

describe('parseStatusNotification', () => {
	it('parses the new About text', () => {
		expect(
			parseStatusNotification(
				node('notification', { from: 'a@s.whatsapp.net', t: '5' }, [node('set', {}, 'hi there')]),
			),
		).toEqual({ jid: 'a@s.whatsapp.net', status: 'hi there', timestamp: 5 })
	})

	it('requires a <set> child', () => {
		expect(
			parseStatusNotification(node('notification', { from: 'a@s.whatsapp.net' })),
		).toBeUndefined()
	})
})

describe('parseDisappearingModeNotification', () => {
	it('parses duration and the required timestamp', () => {
		expect(
			parseDisappearingModeNotification(
				node('notification', { from: 'a@s.whatsapp.net' }, [
					node('disappearing_mode', { duration: '604800', t: '100' }),
				]),
			),
		).toEqual({ jid: 'a@s.whatsapp.net', duration: 604800, settingTimestamp: 100 })
	})

	it('requires the timestamp attribute (defaults duration to 0 only)', () => {
		expect(
			parseDisappearingModeNotification(
				node('notification', { from: 'a@s.whatsapp.net' }, [node('disappearing_mode', {})]),
			),
		).toBeUndefined()
	})
})

describe('parseContactsNotification', () => {
	it('parses update, modify and sync actions', () => {
		expect(
			parseContactsNotification(
				node('notification', { t: '1' }, [node('update', { jid: 'a@s.whatsapp.net' })]),
			),
		).toEqual({ action: 'update', jid: 'a@s.whatsapp.net', timestamp: 1 })
		expect(
			parseContactsNotification(
				node('notification', {}, [
					node('modify', {
						old: 'a@s.whatsapp.net',
						new: 'b@s.whatsapp.net',
						old_lid: '1@lid',
						new_lid: '2@lid',
					}),
				]),
			),
		).toEqual({
			action: 'number-changed',
			oldJid: 'a@s.whatsapp.net',
			newJid: 'b@s.whatsapp.net',
			oldLid: '1@lid',
			newLid: '2@lid',
		})
		expect(
			parseContactsNotification(node('notification', {}, [node('sync', { after: '42' })])),
		).toEqual({
			action: 'sync-requested',
			after: 42,
		})
	})

	it('ignores add/remove housekeeping and an empty notification', () => {
		expect(parseContactsNotification(node('notification', {}, [node('add', {})]))).toBeUndefined()
		expect(parseContactsNotification(node('notification', {}))).toBeUndefined()
	})
})
