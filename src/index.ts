// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
export { TypedEmitter } from './events/emitter.js'
export type { Listener, Unsubscribe } from './events/emitter.js'
export { MemoryAuthStore } from './auth/store.js'
export type { AuthStore } from './auth/store.js'
export { encodeNode, decodeNode } from './codec/index.js'
export type { BinaryNode } from './codec/index.js'
export {
	startXxHandshake,
	connHeader,
	encodeFrame,
	FrameDecoder,
	NoiseTransport,
	NoiseXxHandshake,
} from './crypto/noise.js'
export {
	SignalCipher,
	MemorySignalStorage,
	createSignalCipher,
	newIdentityKeyPair,
	newPreKeys,
	newSignedPreKey,
} from './crypto/signal.js'
export type {
	SignalStorage,
	PreKeyBundleInput,
	EncryptedMessage,
	DecryptedMessage,
} from './crypto/signal.js'
export {
	AppStateCollection,
	newAppStateCollection,
	restoreAppStateCollection,
} from './crypto/appstate.js'
export type {
	AppStateKeyLookup,
	AppStateMac,
	AppStateMutation,
	AppStateResult,
} from './crypto/appstate.js'
export { Client } from './client/client.js'
export type { ClientOptions, ClientEvents, ConnectionUpdate } from './client/client.js'
export { ProtocolLogger } from './logging/protocol-logger.js'
export type { ProtocolLoggerOptions } from './logging/protocol-logger.js'
export {
	compressSession,
	listSessions,
	migrateFlatSessions,
	pruneSessions,
	type RetentionOptions,
	type SessionInfo,
} from './logging/storage.js'
export {
	quickReply,
	urlButton,
	callButton,
	copyButton,
	singleSelect,
} from './client/features/message/interactive.js'
export type {
	NativeButton,
	InteractiveOptions,
	ListSection,
} from './client/features/message/interactive.js'
export { pollOptionHash, vcardFor } from './client/features/message/extras.js'
export { deviceOf } from './client/sender.js'
export type { MessageIdDevice } from './client/sender.js'
export { getFakeMsg } from './client/features/contact/fake-chat.js'
export type { FakeMsg, FakeChatDetected } from './client/features/contact/fake-chat.js'
export type { MessageKey, Quoted, TextOptions } from './client/features/message/messages.js'
export { AntiBan, AntiBanError, ANTIBAN_DEFAULTS } from './client/antiban.js'
export type { AntiBanConfig } from './client/antiban.js'
export {
	fetchLinkPreview,
	findUrl,
	linkPreviewMessage,
} from './client/features/message/link-preview.js'
export type { LinkPreview, LinkPreviewOptions } from './client/features/message/link-preview.js'
export { encodeWam, WAM_EVENTS, WAM_GLOBALS } from './wam/index.js'
export type { WamEvent, WamValue } from './wam/index.js'
export type { PaymentRequestInput } from './client/features/payment/payments.js'
export { parseButtonReply } from './client/features/message/buttons.js'
export type {
	ButtonReply,
	ButtonsOptions,
	ListOptions,
	TemplateOptions,
} from './client/features/message/buttons.js'
export { richResponse, tokenizeCode } from './client/features/message/rich-response.js'
export type { RichResponseOptions } from './client/features/message/rich-response.js'
export { buildReport, REPORT_FLOWS, ReportStore } from './client/features/report/report.js'
export type { ReportOptions, ReportedMessage } from './client/features/report/report.js'
export { splitAnnexB, writeWav } from './client/features/call/call-media.js'
export { type LocalAudioOptions } from './client/features/call/local-audio.js'
export {
	decodeAudioFile,
	decodeVideoFile,
	type CallFileOptions,
	type MediaFileOptions,
	type VideoFileOptions,
} from './client/features/call/media-files.js'

// jid helpers and message reading
export {
	areJidsSameUser,
	isJidBroadcast,
	isJidGroup,
	isJidNewsletter,
	isJidStatusBroadcast,
	isJidUser,
	isLidUser,
	jidDecode,
	jidEncode,
	jidNormalizedUser,
} from './jid.js'
export {
	getContentType,
	messageText,
	normalizeMessageContent,
} from './client/features/message/content-type.js'
export type {
	MediaSource,
	MessageContent,
	SendContentOptions,
} from './client/features/message/send-content.js'

// helpers for bots: a received message and a group, ready to use
export { serialize, isMe, GroupCache, isGroupAdmin } from './bot/index.js'
export type { Message, QuotedMessage, GroupInfo } from './bot/index.js'
export type { EventOptions, EventResponseType } from './client/features/message/event-message.js'
export type { StickerInput } from './client/features/message/sticker-pack.js'
export {
	addStickerMetadata,
	getStickerMetadata,
} from './client/features/message/sticker-metadata.js'
export type { StickerMetadata } from './client/features/message/sticker-metadata.js'
export type {
	BotDirectory,
	BotEntry,
	BotSection,
	BotProfile,
} from './client/features/contact/bots.js'
export type { SecurityCodeVersion } from './client/features/account/security-code.js'
export type { Order, OrderProduct } from './client/features/contact/business.js'
export type { MediaRetryResult } from './client/features/message/media-retry.js'
export type { ProductInput, BroadcastQuota } from './client/features/business/manage.js'
export { MemoryStore } from './client/store.js'
export type { AbProps } from './client/features/account/server.js'
export { Room } from './client/features/call/room.js'
export type { RoomOptions, RoomAdmit, RoomPerson, RoomEvents } from './client/features/call/room.js'
export {
	Browsers,
	DEVICE_PROFILES,
	DEFAULT_HISTORY_SYNC,
	HISTORY_SYNC_FLAGS,
	PLATFORM_TYPES,
	RELEASE_CHANNELS,
	USER_AGENT_PLATFORMS,
	WEB_SUB_PLATFORMS,
	deviceProfile,
} from './client/device-profile.js'
export type {
	HistorySyncFlag,
	PlatformType,
	ReleaseChannel,
	UserAgentPlatform,
	WebSubPlatform,
} from './client/device-profile.js'
