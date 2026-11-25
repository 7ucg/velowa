import { describe, expect, it } from 'vitest'
import { encodeProto } from '../../../../src/client/proto.js'
import { decodeMsg } from '../../../helpers/world.testkit.js'

// The wallpaper feature builds a CHAT_THEME_SETTING protocol message carrying the uploaded image. This checks
// the proto shape setChatWallpaper relies on round-trips intact (field names, the custom-image sub-message).
describe('chat wallpaper message', () => {
	it('encodes a CHAT_THEME_SETTING protocolMessage with the custom image', () => {
		const message = {
			protocolMessage: {
				type: 'CHAT_THEME_SETTING',
				chatThemeSetting: {
					settingTimestampMs: 1795645655296,
					customImage: {
						directPath: '/v/t62/wallpaper.enc',
						mediaKey: new Uint8Array(32).fill(7),
						fileEncSha256: new Uint8Array(32).fill(1),
						fileSha256: new Uint8Array(32).fill(2),
						dimLevel: 0.25,
					},
				},
			},
		}
		const decoded = decodeMsg(Uint8Array.from([...encodeProto('Message', message), 1]))
		const pm = decoded['protocolMessage']
		expect(pm.type).toBe(34) // ProtocolMessage.Type.CHAT_THEME_SETTING
		const ci = pm.chatThemeSetting.customImage
		expect(ci.directPath).toBe('/v/t62/wallpaper.enc')
		expect(Buffer.from(ci.mediaKey).equals(Buffer.alloc(32, 7))).toBe(true)
		expect(Buffer.from(ci.fileEncSha256).equals(Buffer.alloc(32, 1))).toBe(true)
		expect(Buffer.from(ci.fileSha256).equals(Buffer.alloc(32, 2))).toBe(true)
		expect(ci.dimLevel).toBeCloseTo(0.25)
		expect(Number(pm.chatThemeSetting.settingTimestampMs)).toBe(1795645655296)
	})

	it('encodes a solid-colour theme (fixed32 ARGB survives 0xFFFF0000)', () => {
		const message = {
			protocolMessage: {
				type: 'CHAT_THEME_SETTING',
				chatThemeSetting: {
					settingTimestampMs: 1,
					solidColor: {
						backgroundLightArgb: 0xffff0000,
						backgroundDarkArgb: 0xffff0000,
						isDoodleEnabled: false,
					},
				},
			},
		}
		const decoded = decodeMsg(Uint8Array.from([...encodeProto('Message', message), 1]))
		const sc = decoded['protocolMessage'].chatThemeSetting.solidColor
		expect(sc.backgroundLightArgb >>> 0).toBe(0xffff0000)
		expect(sc.backgroundDarkArgb >>> 0).toBe(0xffff0000)
	})

	it('encodes a preset theme id and a clear', () => {
		const theme = decodeMsg(
			Uint8Array.from([
				...encodeProto('Message', {
					protocolMessage: {
						type: 'CHAT_THEME_SETTING',
						chatThemeSetting: { settingTimestampMs: 1, colorSchemeId: 'Emerald@Minimal' },
					},
				}),
				1,
			]),
		)
		expect(theme['protocolMessage'].chatThemeSetting.colorSchemeId).toBe('Emerald@Minimal')
		const clear = decodeMsg(
			Uint8Array.from([
				...encodeProto('Message', {
					protocolMessage: {
						type: 'CHAT_THEME_SETTING',
						chatThemeSetting: { settingTimestampMs: 1, clearTheme: true },
					},
				}),
				1,
			]),
		)
		expect(clear['protocolMessage'].chatThemeSetting.clearTheme).toBe(true)
	})
})
