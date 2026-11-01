import type { OutgoingMutation } from '../../../crypto/appstate.js'
import { encodeProto } from '../../proto.js'
import type { CollectionName } from './appstate-sync.js'
import type { MessageKey } from '../message/messages.js'

/** A message reference used to bound "mark read / archive / delete chat" actions (`messageRange`). */
export interface RangeMessage {
	key: MessageKey
	/** Unix seconds. */
	messageTimestamp: number
}

export interface PlannedMutation {
	collection: CollectionName
	mutation: Pick<OutgoingMutation, 'operation' | 'index' | 'version'> & {
		valueObject: Record<string, unknown>
	}
}

function messageRange(last?: RangeMessage[]): Record<string, unknown> | undefined {
	if (!last?.length) return undefined
	return {
		lastMessageTimestamp: last[last.length - 1]!.messageTimestamp,
		messages: last.map((m) => {
			if (!m.key.id || !m.key.remoteJid) throw new Error('incomplete message key in range')
			if (m.key.remoteJid.endsWith('@g.us') && !m.key.fromMe && !m.key.participant)
				throw new Error('a group message from someone else needs its participant')
			if (!m.messageTimestamp) throw new Error('missing timestamp in last message list')
			return {
				key: {
					remoteJid: m.key.remoteJid,
					fromMe: m.key.fromMe ?? false,
					id: m.key.id,
					...(m.key.participant && { participant: m.key.participant }),
				},
				messageTimestamp: m.messageTimestamp,
			}
		}),
	}
}

const plan = (
	collection: CollectionName,
	index: string[],
	version: number,
	valueObject: Record<string, unknown>,
	operation: 'set' | 'remove' = 'set',
): PlannedMutation => ({
	collection,
	mutation: { operation, index: JSON.stringify(index), version, valueObject },
})

/** Mute until a unix-millisecond timestamp, or unmute with `null`. */
export const mute = (jid: string, untilMs: number | null) =>
	plan('regular_high', ['mute', jid], 2, {
		muteAction: { muted: untilMs !== null, ...(untilMs !== null && { muteEndTimestamp: untilMs }) },
	})

export const archive = (jid: string, archived: boolean, last?: RangeMessage[]) =>
	plan('regular_low', ['archive', jid], 3, {
		archiveChatAction: {
			archived,
			...(messageRange(last) && { messageRange: messageRange(last) }),
		},
	})

export const markRead = (jid: string, read: boolean, last?: RangeMessage[]) =>
	plan('regular_low', ['markChatAsRead', jid], 3, {
		markChatAsReadAction: { read, ...(messageRange(last) && { messageRange: messageRange(last) }) },
	})

export const pin = (jid: string, pinned: boolean) =>
	plan('regular_low', ['pin_v1', jid], 5, { pinAction: { pinned } })

export const star = (key: MessageKey, starred: boolean) =>
	plan(
		'regular_low',
		['star', key.remoteJid, key.id, key.fromMe ? '1' : '0', key.participant ?? '0'],
		2,
		{ starAction: { starred } },
	)

export const deleteChat = (jid: string, last?: RangeMessage[]) =>
	plan('regular_high', ['deleteChat', jid, '1'], 6, {
		deleteChatAction: { ...(messageRange(last) && { messageRange: messageRange(last) }) },
	})

export const clearChat = (jid: string, last?: RangeMessage[]) =>
	plan('regular_high', ['clearChat', jid, '1', '0'], 6, {
		clearChatAction: { ...(messageRange(last) && { messageRange: messageRange(last) }) },
	})

export const deleteMessageForMe = (key: MessageKey, timestamp: number, deleteMedia = false) =>
	plan(
		'regular_high',
		['deleteMessageForMe', key.remoteJid, key.id, key.fromMe ? '1' : '0', '0'],
		3,
		{
			deleteMessageForMeAction: { deleteMedia, messageTimestamp: timestamp },
		},
	)

export const pushName = (name: string) =>
	plan('critical_block', ['setting_pushName'], 1, { pushNameSetting: { name } })

/** Save (or with `null`, remove) a contact in the phone's address book. */
export const contact = (jid: string, c: { fullName?: string; firstName?: string } | null) =>
	plan(
		'critical_unblock_low',
		['contact', jid],
		2,
		c ? { contactAction: c } : { contactAction: {} },
		c ? 'set' : 'remove',
	)

export const addLabel = (l: {
	id: string
	name: string
	color: number
	predefinedId?: string
	deleted?: boolean
}) =>
	plan('regular', ['label_edit', l.id], 3, {
		labelEditAction: {
			name: l.name,
			color: l.color,
			...(l.predefinedId && { predefinedId: l.predefinedId }),
			...(l.deleted !== undefined && { deleted: l.deleted }),
		},
	})

export const labelChat = (jid: string, labelId: string, labeled: boolean) =>
	plan('regular', ['label_jid', labelId, jid], 3, { labelAssociationAction: { labeled } })

export const labelMessage = (jid: string, labelId: string, messageId: string, labeled: boolean) =>
	plan('regular', ['label_message', labelId, jid, messageId, '0', '0'], 3, {
		labelAssociationAction: { labeled },
	})

/** Disappearing-message default for a chat (seconds, 0 = off). */
export const chatEphemeral = (jid: string, seconds: number) =>
	plan('regular', ['ephemeral', jid], 1, {
		chatEphemeralAction: { ephemeralExpiration: seconds, ephemeralSettingTimestamp: Date.now() },
	})

/** Encode the planned mutation into the form the wasm patch builder takes. */
export function toOutgoing(p: PlannedMutation): OutgoingMutation {
	return {
		operation: p.mutation.operation,
		index: p.mutation.index,
		version: p.mutation.version,
		value: encodeProto('SyncActionValue', { timestamp: Date.now(), ...p.mutation.valueObject }),
	}
}

export type StatusAudience = 'contacts' | 'except' | 'only'

/**
 * Who sees our statuses: `contacts` = all, `except` = all contacts except `jids`, `only` = just `jids`
 * ("My contacts" / "My contacts except..." / "Only share with..." in the app).
 */
export const statusPrivacy = (
	audience: StatusAudience,
	jids: string[] = [],
	allowSharing?: boolean,
) => {
	const mode =
		audience === 'contacts' ? 'CONTACTS' : audience === 'except' ? 'DENY_LIST' : 'ALLOW_LIST'
	return plan('regular_high', ['status_privacy'], 7, {
		statusPrivacy: {
			mode,
			modes: [mode],
			...(audience !== 'contacts' && { userJid: jids }),
			...(allowSharing !== undefined && { shareToFb: false, shareToIg: false }),
		},
	})
}
