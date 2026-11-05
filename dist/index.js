/*!
 * velowa - https://github.com/7ucg/velowa - (c) 2026 Baron
 * velowa License (MIT with mandatory credit): copying any part of this code, however small, requires credit. See LICENSE.
 * Parts from other projects keep their own licences: see THIRD_PARTY_NOTICES.md.
 */
import {
  ANTIBAN_DEFAULTS,
  AntiBan,
  AntiBanError,
  AppStateCollection,
  Browsers,
  Client,
  DEVICE_PROFILES,
  FrameDecoder,
  MemorySignalStorage,
  NoiseTransport,
  NoiseXxHandshake,
  PLATFORM_TYPES,
  ProtocolLogger,
  RELEASE_CHANNELS,
  REPORT_FLOWS,
  ReportStore,
  Room,
  SignalCipher,
  TypedEmitter,
  USER_AGENT_PLATFORMS,
  WAM_EVENTS,
  WAM_GLOBALS,
  WEB_SUB_PLATFORMS,
  areJidsSameUser,
  buildReport,
  callButton,
  connHeader,
  copyButton,
  createSignalCipher,
  decodeAudioFile,
  decodeNode,
  decodeVideoFile,
  deviceProfile,
  encodeFrame,
  encodeNode,
  encodeWam,
  fetchLinkPreview,
  findUrl,
  isJidBroadcast,
  isJidGroup,
  isJidNewsletter,
  isJidStatusBroadcast,
  isJidUser,
  isLidUser,
  jidDecode,
  jidEncode,
  jidNormalizedUser,
  linkPreviewMessage,
  newAppStateCollection,
  newIdentityKeyPair,
  newPreKeys,
  newSignedPreKey,
  parseButtonReply,
  pollOptionHash,
  quickReply,
  restoreAppStateCollection,
  richResponse,
  singleSelect,
  splitAnnexB,
  startXxHandshake,
  tokenizeCode,
  urlButton,
  vcardFor,
  writeWav
} from "./chunk-6IU6ZPMY.js";
import {
  compressSession,
  listSessions,
  migrateFlatSessions,
  pruneSessions
} from "./chunk-UJTLWSE6.js";

// src/auth/store.ts
var MemoryAuthStore = class {
  #data = /* @__PURE__ */ new Map();
  async get(group, id) {
    return this.#data.get(`${group}\0${id}`);
  }
  async set(entries) {
    for (const { group, id, value } of entries) {
      const key = `${group}\0${id}`;
      if (value === void 0) this.#data.delete(key);
      else this.#data.set(key, value);
    }
  }
};

// src/client/features/message/content-type.ts
function getContentType(content) {
  if (!content) return void 0;
  const keys = Object.keys(content).filter(
    (k) => content[k] != null && k !== "senderKeyDistributionMessage" && k !== "messageContextInfo"
  );
  return keys[0];
}
function normalizeMessageContent(content) {
  let c = content ?? void 0;
  for (let depth = 0; c && depth < 5; depth++) {
    const wrapper = [
      "ephemeralMessage",
      "viewOnceMessage",
      "viewOnceMessageV2",
      "viewOnceMessageV2Extension",
      "documentWithCaptionMessage",
      "editedMessage"
    ].map((k) => c[k]).find((w) => w?.message);
    if (!wrapper) break;
    c = wrapper.message;
  }
  return c;
}
function nativeFlowReplyId(reply) {
  const flow = reply?.["nativeFlowResponseMessage"];
  if (!flow?.paramsJson) return void 0;
  try {
    const p = JSON.parse(flow.paramsJson);
    const id = p.id ?? p.selected_id;
    return typeof id === "string" && id ? id : void 0;
  } catch {
    return void 0;
  }
}
function messageText(content) {
  const c = normalizeMessageContent(content);
  if (!c) return void 0;
  const get = (k) => c[k];
  return (typeof c["conversation"] === "string" ? c["conversation"] : void 0) ?? get("extendedTextMessage")?.["text"] ?? get("imageMessage")?.["caption"] ?? get("videoMessage")?.["caption"] ?? get("documentMessage")?.["caption"] ?? get("buttonsResponseMessage")?.["selectedButtonId"] ?? get("listResponseMessage")?.["singleSelectReply"]?.selectedRowId ?? get("templateButtonReplyMessage")?.["selectedId"] ?? nativeFlowReplyId(get("interactiveResponseMessage"));
}

// src/bot/message.ts
var MEDIA = [
  "imageMessage",
  "videoMessage",
  "audioMessage",
  "documentMessage",
  "stickerMessage",
  "ptvMessage"
];
var asObject = (v) => v && typeof v === "object" ? v : void 0;
function isMe(client, jid) {
  const me = client.me;
  return !!jid && !!me && (areJidsSameUser(jid, me.id) || !!me.lid && areJidsSameUser(jid, me.lid));
}
var CHAT_JID = /^[0-9A-Za-z._-]+(?::\d+)?@(?:s\.whatsapp\.net|lid|g\.us)$/;
function serialize(client, raw) {
  const sent = asObject(raw.message["deviceSentMessage"]);
  const wrapped = asObject(sent?.["message"]);
  const destination = sent?.["destinationJid"];
  if (wrapped && typeof destination === "string" && CHAT_JID.test(destination) && isMe(client, raw.participant ?? raw.from)) {
    const own = build(client, { ...raw, from: destination, message: wrapped });
    own.fromMe = true;
    own.key.fromMe = true;
    own.sender = jidNormalizedUser(raw.participant ?? raw.from);
    return own;
  }
  return build(client, raw);
}
function build(client, raw) {
  const chat = raw.from;
  const isGroup = isJidGroup(chat);
  const sender = jidNormalizedUser(raw.participant ?? chat);
  const content = normalizeMessageContent(raw.message);
  const type = getContentType(content);
  const inner = asObject(type ? content?.[type] : void 0);
  const context = asObject(inner?.["contextInfo"]);
  const fromMe = isMe(client, raw.participant) || !!raw.message["fromMe"];
  const key = {
    remoteJid: chat,
    id: raw.id,
    fromMe,
    ...raw.participant && { participant: raw.participant }
  };
  let quoted;
  const quotedContent = normalizeMessageContent(asObject(context?.["quotedMessage"]));
  if (quotedContent && typeof context?.["stanzaId"] === "string") {
    const qType = getContentType(quotedContent);
    const qInner = asObject(qType ? quotedContent[qType] : void 0);
    const qSender = jidNormalizedUser(context["participant"] ?? chat);
    const qKey = {
      remoteJid: chat,
      id: context["stanzaId"],
      fromMe: isMe(client, qSender),
      ...isGroup && { participant: qSender }
    };
    quoted = {
      id: context["stanzaId"],
      chat,
      sender: qSender,
      fromMe: qKey.fromMe ?? false,
      type: qType,
      text: messageText(quotedContent) ?? "",
      ...typeof qInner?.["mimetype"] === "string" && { mimetype: qInner["mimetype"] },
      message: quotedContent,
      key: qKey,
      download: () => client.downloadMedia(quotedContent, { key: qKey })
    };
  }
  const mentioned = context?.["mentionedJid"];
  const message = {
    raw,
    id: raw.id,
    chat,
    sender,
    pushName: raw.pushName ?? "",
    fromMe,
    isGroup,
    timestamp: raw.timestamp,
    type,
    content,
    text: messageText(content) ?? "",
    mimetype: typeof inner?.["mimetype"] === "string" ? inner["mimetype"] : void 0,
    isMedia: !!type && MEDIA.includes(type),
    mentionedJids: Array.isArray(mentioned) ? mentioned.filter((j) => typeof j === "string") : [],
    quoted,
    key,
    asQuoted: { key, message: raw.message },
    reply: (content2, options) => client.send(chat, typeof content2 === "string" ? { text: content2 } : content2, {
      quoted: { key, message: raw.message },
      ...options
    }),
    react: (emoji) => client.react(key, emoji),
    delete: () => client.revoke(key),
    markRead: () => client.markRead([key]),
    download: () => client.downloadMedia(raw.message, { key }),
    forward: (to) => client.forwardMessage(to, raw.message)
  };
  return message;
}

// src/bot/group.ts
var TTL_MS = 6e4;
var GroupCache = class {
  constructor(client) {
    this.client = client;
  }
  client;
  #cache = /* @__PURE__ */ new Map();
  get(id) {
    const hit = this.#cache.get(id);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.info;
    const info = this.client.groups.metadata(id).then((m) => ({
      id: m.id,
      subject: m.subject,
      size: m.size,
      participants: m.participants,
      announce: m.announce,
      admins: m.participants.filter((p) => p.admin).flatMap((p) => [p.id, p.phoneNumber, p.lid].filter((j) => !!j))
    }));
    info.catch(() => this.#cache.delete(id));
    this.#cache.set(id, { at: Date.now(), info });
    if (this.#cache.size > 500) this.#cache.delete(this.#cache.keys().next().value);
    return info;
  }
  /** Forget a group (its members changed). */
  forget(id) {
    this.#cache.delete(id);
  }
};
var isGroupAdmin = (group, jid) => !!group && !!jid && group.admins.some((a) => areJidsSameUser(a, jid));

// src/client/store.ts
var MemoryStore = class {
  #messages = /* @__PURE__ */ new Map();
  #names = /* @__PURE__ */ new Map();
  #seen = /* @__PURE__ */ new Map();
  #offs = [];
  #perChat;
  #maxChats;
  #maxNames;
  /** Limits: messages kept per chat, chats kept (least recently active are dropped), names kept. */
  constructor(o = {}) {
    this.#perChat = o.perChat ?? 200;
    this.#maxChats = o.maxChats ?? 1e3;
    this.#maxNames = o.maxNames ?? 5e3;
  }
  /** Start listening to `client`. Returns the store, so it chains. */
  bind(client) {
    this.#offs.push(
      client.on("message", (m) => this.add(m)),
      client.on(
        "message.resent",
        (r) => this.add({
          id: r.key.id,
          from: r.key.remoteJid,
          message: r.message,
          ...r.key.participant && { participant: r.key.participant },
          ...r.timestamp !== void 0 && { timestamp: r.timestamp }
        })
      )
    );
    return this;
  }
  /** Stop listening. */
  unbind() {
    for (const off of this.#offs) off();
    this.#offs = [];
  }
  add(m) {
    const chat = this.#messages.get(m.from) ?? /* @__PURE__ */ new Map();
    this.#messages.delete(m.from);
    this.#messages.set(m.from, chat);
    chat.delete(m.id);
    chat.set(m.id, m);
    while (chat.size > this.#perChat) chat.delete(chat.keys().next().value);
    this.#seen.delete(m.from);
    this.#seen.set(m.from, m.timestamp ?? Math.floor(Date.now() / 1e3));
    while (this.#messages.size > this.#maxChats) {
      const oldest = this.#messages.keys().next().value;
      this.#messages.delete(oldest);
      this.#seen.delete(oldest);
    }
    if (m.pushName) {
      const who = m.participant ?? m.from;
      this.#names.delete(who);
      this.#names.set(who, m.pushName.slice(0, 128));
      while (this.#names.size > this.#maxNames) this.#names.delete(this.#names.keys().next().value);
    }
  }
  /** One message of a chat, by id. */
  message(chat, id) {
    return this.#messages.get(chat)?.get(id);
  }
  /** The last `limit` messages of a chat, oldest first. */
  messages(chat, limit = 50) {
    return [...this.#messages.get(chat)?.values() ?? []].slice(-limit);
  }
  /** The name a person or chat showed up with. */
  name(jid) {
    return this.#names.get(jid);
  }
  /** Chats we have seen a message of, most recent first. */
  chats() {
    return [...this.#seen].map(([jid, lastSeen]) => ({ jid, lastSeen })).sort((a, b) => b.lastSeen - a.lastSeen);
  }
};
export {
  ANTIBAN_DEFAULTS,
  AntiBan,
  AntiBanError,
  AppStateCollection,
  Browsers,
  Client,
  DEVICE_PROFILES,
  FrameDecoder,
  GroupCache,
  MemoryAuthStore,
  MemorySignalStorage,
  MemoryStore,
  NoiseTransport,
  NoiseXxHandshake,
  PLATFORM_TYPES,
  ProtocolLogger,
  RELEASE_CHANNELS,
  REPORT_FLOWS,
  ReportStore,
  Room,
  SignalCipher,
  TypedEmitter,
  USER_AGENT_PLATFORMS,
  WAM_EVENTS,
  WAM_GLOBALS,
  WEB_SUB_PLATFORMS,
  areJidsSameUser,
  buildReport,
  callButton,
  compressSession,
  connHeader,
  copyButton,
  createSignalCipher,
  decodeAudioFile,
  decodeNode,
  decodeVideoFile,
  deviceProfile,
  encodeFrame,
  encodeNode,
  encodeWam,
  fetchLinkPreview,
  findUrl,
  getContentType,
  isGroupAdmin,
  isJidBroadcast,
  isJidGroup,
  isJidNewsletter,
  isJidStatusBroadcast,
  isJidUser,
  isLidUser,
  isMe,
  jidDecode,
  jidEncode,
  jidNormalizedUser,
  linkPreviewMessage,
  listSessions,
  messageText,
  migrateFlatSessions,
  newAppStateCollection,
  newIdentityKeyPair,
  newPreKeys,
  newSignedPreKey,
  normalizeMessageContent,
  parseButtonReply,
  pollOptionHash,
  pruneSessions,
  quickReply,
  restoreAppStateCollection,
  richResponse,
  serialize,
  singleSelect,
  splitAnnexB,
  startXxHandshake,
  tokenizeCode,
  urlButton,
  vcardFor,
  writeWav
};
