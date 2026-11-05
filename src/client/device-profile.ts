// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { ClientConfig } from './pairing.js'

/** `DeviceProps.PlatformType`: what "Linked devices" shows the phone as (chosen when the device is paired). */
export const PLATFORM_TYPES = [
	'UNKNOWN',
	'CHROME',
	'FIREFOX',
	'IE',
	'OPERA',
	'SAFARI',
	'EDGE',
	'DESKTOP',
	'IPAD',
	'ANDROID_TABLET',
	'OHANA',
	'ALOHA',
	'CATALINA',
	'TCL_TV',
	'IOS_PHONE',
	'IOS_CATALYST',
	'ANDROID_PHONE',
	'ANDROID_AMBIGUOUS',
	'WEAR_OS',
	'AR_WRIST',
	'AR_DEVICE',
	'UWP',
	'VR',
	'CLOUD_API',
	'SMARTGLASSES',
	'WAIL',
	'WASS',
	'BUSINESS_BACK_OFFICE',
	'WAIL_WAI',
	'WAIL_ALEXA',
	'AUTOMOTIVE',
] as const
export type PlatformType = (typeof PLATFORM_TYPES)[number]

/** `ClientPayload.UserAgent.ReleaseChannel`: which WhatsApp release track the client says it is on. */
export const RELEASE_CHANNELS = ['RELEASE', 'BETA', 'ALPHA', 'DEBUG'] as const
export type ReleaseChannel = (typeof RELEASE_CHANNELS)[number]

/** `ClientPayload.UserAgent.Platform`: the app family sent when connecting. */
export const USER_AGENT_PLATFORMS = [
	'ANDROID',
	'IOS',
	'WINDOWS_PHONE',
	'BLACKBERRY',
	'BLACKBERRYX',
	'S40',
	'S60',
	'PYTHON_CLIENT',
	'TIZEN',
	'ENTERPRISE',
	'SMB_ANDROID',
	'KAIOS',
	'SMB_IOS',
	'WINDOWS',
	'WEB',
	'PORTAL',
	'GREEN_ANDROID',
	'GREEN_IPHONE',
	'BLUE_ANDROID',
	'BLUE_IPHONE',
	'FBLITE_ANDROID',
	'MLITE_ANDROID',
	'IGLITE_ANDROID',
	'PAGE',
	'MACOS',
	'OCULUS_MSG',
	'OCULUS_CALL',
	'MILAN',
	'CAPI',
	'WEAROS',
	'ARDEVICE',
	'VRDEVICE',
	'BLUE_WEB',
	'IPAD',
	'TEST',
	'SMART_GLASSES',
	'BLUE_VR',
	'AR_WRIST',
	'WAIL',
	'WORK_ANDROID',
	'WORK_IOS',
	'AUTOMOTIVE',
] as const
export type UserAgentPlatform = (typeof USER_AGENT_PLATFORMS)[number]

/** `ClientPayload.WebInfo.WebSubPlatform` (only sent while the platform is `WEB`). */
export const WEB_SUB_PLATFORMS = [
	'WEB_BROWSER',
	'APP_STORE',
	'WIN_STORE',
	'DARWIN',
	'WIN32',
	'WIN_HYBRID',
] as const
export type WebSubPlatform = (typeof WEB_SUB_PLATFORMS)[number]

/**
 * Browser names as Baileys offers them (`Browsers.ubuntu('Chrome')`, `Browsers.macOS('Safari')`, ...), as the
 * `[os, device]` pair of `config.browser`.
 */
export const Browsers = {
	ubuntu: (browser: string): [string, string] => ['Ubuntu', browser],
	macOS: (browser: string): [string, string] => ['Mac OS', browser],
	windows: (browser: string): [string, string] => ['Windows', browser],
	appropriate: (browser: string): [string, string] => [
		{ darwin: 'Mac OS', win32: 'Windows', linux: 'Ubuntu' }[process.platform as string] ?? 'Ubuntu',
		browser,
	],
	baileys: (browser: string): [string, string] => ['Baileys', browser],
	velowa: (browser: string): [string, string] => ['velowa', browser],
}

type Profile = Pick<ClientConfig, 'browser' | 'platformType'> &
	Partial<Pick<ClientConfig, 'platform' | 'webSubPlatform'>>

/**
 * Ready-made device identities (`config: deviceProfile('safari-mac')`). Only `windows-desktop` (the default) is
 * checked against a live account; the rest are the values WhatsApp's own clients use, so the phone may list or
 * treat the linked device differently. The device type is read when pairing: re-link to change it.
 */
export const DEVICE_PROFILES: Record<string, Profile> = {
	'windows-desktop': { browser: ['Windows', 'Desktop'], platformType: 'DESKTOP' },
	'mac-desktop': { browser: ['Mac OS', 'Desktop'], platformType: 'DESKTOP' },
	'chrome-windows': { browser: ['Windows', 'Chrome'], platformType: 'CHROME' },
	'chrome-linux': { browser: ['Ubuntu', 'Chrome'], platformType: 'CHROME' },
	'chrome-mac': { browser: ['Mac OS', 'Chrome'], platformType: 'CHROME' },
	'firefox-windows': { browser: ['Windows', 'Firefox'], platformType: 'FIREFOX' },
	'firefox-linux': { browser: ['Ubuntu', 'Firefox'], platformType: 'FIREFOX' },
	'safari-mac': { browser: ['Mac OS', 'Safari'], platformType: 'SAFARI' },
	'edge-windows': { browser: ['Windows', 'Edge'], platformType: 'EDGE' },
	'opera-windows': { browser: ['Windows', 'Opera'], platformType: 'OPERA' },
	'uwp-windows': { browser: ['Windows', 'Desktop'], platformType: 'UWP' },
	'catalina-mac': { browser: ['Mac OS', 'Desktop'], platformType: 'CATALINA' },
	'android-phone': { browser: ['Android', 'Phone'], platformType: 'ANDROID_PHONE' },
	'android-tablet': { browser: ['Android', 'Tablet'], platformType: 'ANDROID_TABLET' },
	'ios-phone': { browser: ['iOS', 'iPhone'], platformType: 'IOS_PHONE' },
	ipad: { browser: ['iOS', 'iPad'], platformType: 'IPAD' },
	'wear-os': { browser: ['Wear OS', 'Watch'], platformType: 'WEAR_OS' },
	'tcl-tv': { browser: ['TCL', 'TV'], platformType: 'TCL_TV' },
	'smart-glasses': { browser: ['Glasses', 'Smart'], platformType: 'SMARTGLASSES' },
	vr: { browser: ['VR', 'Headset'], platformType: 'VR' },
	automotive: { browser: ['Car', 'Automotive'], platformType: 'AUTOMOTIVE' },
}

/** The config part of a named profile; throws with the valid names on a typo. */
export function deviceProfile(
	name: string,
): Pick<ClientConfig, 'browser' | 'platformType'> & Partial<ClientConfig> {
	const p = DEVICE_PROFILES[name]
	if (!p)
		throw new Error(
			`unknown device profile "${name}" (use one of: ${Object.keys(DEVICE_PROFILES).join(', ')})`,
		)
	return { ...p, browser: [...p.browser] as [string, string] }
}

const check = (what: string, value: string | undefined, list: readonly string[]) => {
	if (value !== undefined && !list.includes(value))
		throw new Error(`config.${what} "${value}" is not valid (use one of: ${list.join(', ')})`)
}

/** Throws on a name that is not in the WhatsApp enums, before it reaches the server. */
export function checkDeviceConfig(c: Partial<ClientConfig>): void {
	check('platformType', c.platformType, PLATFORM_TYPES)
	check('releaseChannel', c.releaseChannel, RELEASE_CHANNELS)
	check('platform', c.platform, USER_AGENT_PLATFORMS)
	check('webSubPlatform', c.webSubPlatform, WEB_SUB_PLATFORMS)
	if (c.historySync && c.historySync !== 'all') {
		for (const [k, v] of Object.entries(c.historySync)) {
			if (!(HISTORY_SYNC_FLAGS as readonly string[]).includes(k))
				throw new Error(
					`config.historySync.${k} is not a flag (use one of: ${HISTORY_SYNC_FLAGS.join(', ')})`,
				)
			if (typeof v !== 'boolean') throw new Error(`config.historySync.${k} must be true or false`)
		}
	}
}

/** Every boolean of `DeviceProps.HistorySyncConfig`: what this linked device tells the phone it can take in the first sync. */
export const HISTORY_SYNC_FLAGS = [
	'inlineInitialPayloadInE2EeMsg',
	'supportCallLogHistory',
	'supportBotUserAgentChatHistory',
	'supportCagReactionsAndPolls',
	'supportBizHostedMsg',
	'supportRecentSyncChunkMessageCountTuning',
	'supportHostedGroupMsg',
	'supportFbidBotChatHistory',
	'supportAddOnHistorySyncMigration',
	'supportMessageAssociation',
	'supportGroupHistory',
	'onDemandReady',
	'supportGuestChat',
	'completeOnDemandReady',
	'supportManusHistory',
	'supportHatchHistory',
	'supportInlineContacts',
	'supportNewsletter',
	'supportUniversalReachChat',
	'supportOmittedConversationMetadata',
] as const
export type HistorySyncFlag = (typeof HISTORY_SYNC_FLAGS)[number]

/** The flags velowa sends by default (all others are left out). */
export const DEFAULT_HISTORY_SYNC: Partial<Record<HistorySyncFlag, boolean>> = {
	inlineInitialPayloadInE2EeMsg: true,
	supportBotUserAgentChatHistory: true,
	supportCagReactionsAndPolls: true,
	supportBizHostedMsg: true,
	supportRecentSyncChunkMessageCountTuning: true,
	supportHostedGroupMsg: true,
	supportFbidBotChatHistory: true,
	supportMessageAssociation: true,
	supportGroupHistory: true,
	supportGuestChat: true,
}

/** `'all'` turns every flag on; an object sets single flags on top of the defaults. */
export function historySyncFlags(
	opt: ClientConfig['historySync'],
): Partial<Record<HistorySyncFlag, boolean>> {
	if (opt === 'all') return Object.fromEntries(HISTORY_SYNC_FLAGS.map((f) => [f, true]))
	return { ...DEFAULT_HISTORY_SYNC, ...opt }
}
