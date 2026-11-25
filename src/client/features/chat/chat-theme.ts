// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.

/** WhatsApp's built-in preset chat themes, by their `colorSchemeId` (what `setChatTheme` takes). */
export const CHAT_THEME_IDS = [
	'Default-Blue@Minimal',
	'Default-Blue@Tonal@Minimal',
	'Emerald@Minimal',
	'Emerald@Tonal@Minimal',
	'Pink@Minimal',
	'Red@Minimal',
	'Royal-Blue@Minimal',
	'Tyrian-Purple@Minimal',
	'WhatsApp-Green@Minimal',
] as const

export type ChatThemeId = (typeof CHAT_THEME_IDS)[number]
