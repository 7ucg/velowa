/*!
 * velowa - https://github.com/7ucg/velowa - (c) 2026 Baron
 * velowa License (MIT with mandatory credit): copying any part of this code, however small, requires credit. See LICENSE.
 * Parts from other projects keep their own licences: see THIRD_PARTY_NOTICES.md.
 */
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  ANTIBAN_DEFAULTS: () => ANTIBAN_DEFAULTS,
  AntiBan: () => AntiBan,
  AntiBanError: () => AntiBanError,
  AppStateCollection: () => AppStateCollection,
  Client: () => Client,
  FrameDecoder: () => FrameDecoder,
  GroupCache: () => GroupCache,
  MemoryAuthStore: () => MemoryAuthStore,
  MemorySignalStorage: () => MemorySignalStorage,
  MemoryStore: () => MemoryStore,
  NoiseTransport: () => NoiseTransport,
  NoiseXxHandshake: () => NoiseXxHandshake,
  ProtocolLogger: () => ProtocolLogger,
  REPORT_FLOWS: () => REPORT_FLOWS,
  ReportStore: () => ReportStore,
  Room: () => Room,
  SignalCipher: () => SignalCipher,
  TypedEmitter: () => TypedEmitter,
  WAM_EVENTS: () => WAM_EVENTS,
  WAM_GLOBALS: () => WAM_GLOBALS,
  areJidsSameUser: () => areJidsSameUser,
  buildReport: () => buildReport,
  callButton: () => callButton,
  compressSession: () => compressSession,
  connHeader: () => connHeader,
  copyButton: () => copyButton,
  createSignalCipher: () => createSignalCipher,
  decodeAudioFile: () => decodeAudioFile,
  decodeNode: () => decodeNode2,
  decodeVideoFile: () => decodeVideoFile,
  encodeFrame: () => encodeFrame,
  encodeNode: () => encodeNode2,
  encodeWam: () => encodeWam,
  fetchLinkPreview: () => fetchLinkPreview,
  findUrl: () => findUrl,
  getContentType: () => getContentType,
  isGroupAdmin: () => isGroupAdmin,
  isJidBroadcast: () => isJidBroadcast,
  isJidGroup: () => isJidGroup,
  isJidNewsletter: () => isJidNewsletter,
  isJidStatusBroadcast: () => isJidStatusBroadcast,
  isJidUser: () => isJidUser,
  isLidUser: () => isLidUser,
  isMe: () => isMe,
  jidDecode: () => jidDecode,
  jidEncode: () => jidEncode,
  jidNormalizedUser: () => jidNormalizedUser,
  linkPreviewMessage: () => linkPreviewMessage,
  listSessions: () => listSessions,
  messageText: () => messageText,
  migrateFlatSessions: () => migrateFlatSessions,
  newAppStateCollection: () => newAppStateCollection,
  newIdentityKeyPair: () => newIdentityKeyPair,
  newPreKeys: () => newPreKeys,
  newSignedPreKey: () => newSignedPreKey,
  normalizeMessageContent: () => normalizeMessageContent,
  parseButtonReply: () => parseButtonReply,
  pollOptionHash: () => pollOptionHash,
  pruneSessions: () => pruneSessions,
  quickReply: () => quickReply2,
  restoreAppStateCollection: () => restoreAppStateCollection,
  richResponse: () => richResponse,
  serialize: () => serialize2,
  singleSelect: () => singleSelect,
  splitAnnexB: () => splitAnnexB,
  startXxHandshake: () => startXxHandshake,
  tokenizeCode: () => tokenizeCode,
  urlButton: () => urlButton,
  vcardFor: () => vcardFor,
  writeWav: () => writeWav
});
module.exports = __toCommonJS(src_exports);

// node_modules/tsup/assets/cjs_shims.js
var getImportMetaUrl = () => typeof document === "undefined" ? new URL(`file:${__filename}`).href : document.currentScript && document.currentScript.tagName.toUpperCase() === "SCRIPT" ? document.currentScript.src : new URL("main.js", document.baseURI).href;
var importMetaUrl = /* @__PURE__ */ getImportMetaUrl();

// src/events/emitter.ts
var TypedEmitter = class {
  #listeners = /* @__PURE__ */ new Map();
  on(event, listener) {
    let set = this.#listeners.get(event);
    if (!set) this.#listeners.set(event, set = /* @__PURE__ */ new Set());
    set.add(listener);
    return () => set.delete(listener);
  }
  emit(event, payload) {
    for (const l of [...this.#listeners.get(event) ?? []]) l(payload);
  }
  /** Async-iterable view of one event; stops when `signal` aborts. */
  async *events(event, signal) {
    const queue = [];
    let wake;
    const off = this.on(event, (p) => {
      queue.push(p);
      wake?.();
    });
    const onAbort = () => wake?.();
    signal?.addEventListener("abort", onAbort);
    try {
      while (!signal?.aborted) {
        if (queue.length === 0) await new Promise((r) => wake = r);
        while (queue.length > 0) yield queue.shift();
      }
    } finally {
      off();
      signal?.removeEventListener("abort", onAbort);
    }
  }
};

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

// src/wasm/velowa_wasm_bridge.js
var AppStateCollection = class _AppStateCollection {
  static __wrap(ptr) {
    const obj = Object.create(_AppStateCollection.prototype);
    obj.__wbg_ptr = ptr;
    AppStateCollectionFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    AppStateCollectionFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_appstatecollection_free(ptr, 0);
  }
  /**
   * Apply an encoded `SyncdPatch`. Transactional: on error the collection is unchanged.
   * @param {Uint8Array | number[]} patch
   * @param {AppStateKeyLookup} get_key
   * @param {PreviousValueMacLookup} get_previous_value_mac
   * @returns {AppStateResult}
   */
  applyPatch(patch, get_key, get_previous_value_mac) {
    const ptr0 = passArray8ToWasm0(patch, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.appstatecollection_applyPatch(this.__wbg_ptr, ptr0, len0, get_key, get_previous_value_mac);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * Apply an encoded `SyncdSnapshot`, rebuilding the collection from scratch.
   * @param {Uint8Array | number[]} snapshot
   * @param {AppStateKeyLookup} get_key
   * @returns {AppStateResult}
   */
  applySnapshot(snapshot, get_key) {
    const ptr0 = passArray8ToWasm0(snapshot, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.appstatecollection_applySnapshot(this.__wbg_ptr, ptr0, len0, get_key);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * Build, encrypt and sign a patch carrying `mutations` on top of the current state. The new
   * state is held as pending: call `commitPending()` once the server accepted the patch, or
   * `discardPending()` if it did not.
   * @param {Uint8Array | number[]} key_id
   * @param {Uint8Array | number[]} key_data
   * @param {OutgoingMutation[]} mutations
   * @param {PreviousValueMacLookup} get_previous_value_mac
   * @returns {BuiltPatch}
   */
  buildPatch(key_id, key_data, mutations, get_previous_value_mac) {
    let ptr0, len0, ptr1, len1;
    try {
      ptr0 = passArray8ToWasm0(key_id, wasm.__wbindgen_malloc);
      len0 = WASM_VECTOR_LEN;
      ptr1 = passArray8ToWasm0(key_data, wasm.__wbindgen_malloc);
      len1 = WASM_VECTOR_LEN;
    } catch (e) {
      if (ptr1) {
        wasm.__wbindgen_free(ptr1, len1 * 1, 1);
      }
      if (ptr0) {
        wasm.__wbindgen_free(ptr0, len0 * 1, 1);
      }
      throw e;
    }
    const ret = wasm.appstatecollection_buildPatch(this.__wbg_ptr, ptr0, len0, ptr1, len1, mutations, get_previous_value_mac);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
  }
  /**
   * The server accepted the patch from `buildPatch`: make its state current.
   */
  commitPending() {
    const ret = wasm.appstatecollection_commitPending(this.__wbg_ptr);
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0]);
    }
  }
  /**
   * Drop the state from `buildPatch` (the server rejected the patch).
   */
  discardPending() {
    wasm.appstatecollection_discardPending(this.__wbg_ptr);
  }
  /**
   * Restore from bytes produced by `serializeState`.
   * @param {string} name
   * @param {Uint8Array | number[]} state
   * @returns {AppStateCollection}
   */
  static fromState(name, state) {
    let ptr0, len0, ptr1, len1;
    try {
      ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      len0 = WASM_VECTOR_LEN;
      ptr1 = passArray8ToWasm0(state, wasm.__wbindgen_malloc);
      len1 = WASM_VECTOR_LEN;
    } catch (e) {
      if (ptr1) {
        wasm.__wbindgen_free(ptr1, len1 * 1, 1);
      }
      if (ptr0) {
        wasm.__wbindgen_free(ptr0, len0 * 1, 1);
      }
      throw e;
    }
    const ret = wasm.appstatecollection_fromState(ptr0, len0, ptr1, len1);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return _AppStateCollection.__wrap(ret[0]);
  }
  /**
   * 128-byte LTHash.
   * @returns {Uint8Array}
   */
  get hash() {
    const ret = wasm.appstatecollection_hash(this.__wbg_ptr);
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @returns {string}
   */
  get name() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm.appstatecollection_name(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm0(ret[0], ret[1]);
    } finally {
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * A fresh, never-synced collection.
   * @param {string} name
   */
  constructor(name) {
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.appstatecollection_new(ptr0, len0);
    this.__wbg_ptr = ret;
    AppStateCollectionFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * Opaque bytes to persist; feed back to `fromState`.
   * @returns {Uint8Array}
   */
  serializeState() {
    const ret = wasm.appstatecollection_serializeState(this.__wbg_ptr);
    if (ret[3]) {
      throw takeFromExternrefTable0(ret[2]);
    }
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * @returns {number}
   */
  get version() {
    const ret = wasm.appstatecollection_version(this.__wbg_ptr);
    return ret;
  }
};
if (Symbol.dispose) AppStateCollection.prototype[Symbol.dispose] = AppStateCollection.prototype.free;
var FrameDecoder = class {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    FrameDecoderFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_framedecoder_free(ptr, 0);
  }
  /**
   * @param {Uint8Array | number[]} data
   */
  feed(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    wasm.framedecoder_feed(this.__wbg_ptr, ptr0, len0);
  }
  constructor() {
    const ret = wasm.framedecoder_new();
    this.__wbg_ptr = ret;
    FrameDecoderFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * The next complete frame payload, or `undefined` when more bytes are needed.
   * @returns {Uint8Array | undefined}
   */
  nextFrame() {
    const ret = wasm.framedecoder_nextFrame(this.__wbg_ptr);
    let v1;
    if (ret[0] !== 0) {
      v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
      wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    }
    return v1;
  }
};
if (Symbol.dispose) FrameDecoder.prototype[Symbol.dispose] = FrameDecoder.prototype.free;
var NoiseTransport = class _NoiseTransport {
  static __wrap(ptr) {
    const obj = Object.create(_NoiseTransport.prototype);
    obj.__wbg_ptr = ptr;
    NoiseTransportFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    NoiseTransportFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_noisetransport_free(ptr, 0);
  }
  /**
   * @param {Uint8Array | number[]} ciphertext
   * @returns {Uint8Array}
   */
  decrypt(ciphertext) {
    const ptr0 = passArray8ToWasm0(ciphertext, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.noisetransport_decrypt(this.__wbg_ptr, ptr0, len0);
    if (ret[3]) {
      throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
  }
  /**
   * @param {Uint8Array | number[]} plaintext
   * @returns {Uint8Array}
   */
  encrypt(plaintext) {
    const ptr0 = passArray8ToWasm0(plaintext, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.noisetransport_encrypt(this.__wbg_ptr, ptr0, len0);
    if (ret[3]) {
      throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
  }
};
if (Symbol.dispose) NoiseTransport.prototype[Symbol.dispose] = NoiseTransport.prototype.free;
var NoiseXxHandshake = class {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    NoiseXxHandshakeFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_noisexxhandshake_free(ptr, 0);
  }
  /**
   * Encoded HandshakeMessage carrying the client ephemeral (not yet framed).
   * @returns {Uint8Array}
   */
  buildClientHello() {
    const ret = wasm.noisexxhandshake_buildClientHello(this.__wbg_ptr);
    if (ret[3]) {
      throw takeFromExternrefTable0(ret[2]);
    }
    var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v1;
  }
  /**
   * Completes the handshake and yields the transport ciphers. Consumes the handshake.
   * @returns {NoiseTransport}
   */
  finish() {
    const ret = wasm.noisexxhandshake_finish(this.__wbg_ptr);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    return NoiseTransport.__wrap(ret[0]);
  }
  /**
   * `staticPrivate`/`staticPublic`: the device's 32-byte Noise static key pair.
   * `clientPayload`: encoded ClientPayload protobuf. `prologue` defaults to the WA connection header.
   * @param {Uint8Array | number[]} static_private
   * @param {Uint8Array | number[]} static_public
   * @param {Uint8Array | number[]} client_payload
   * @param {Uint8Array | number[] | null} [prologue]
   */
  constructor(static_private, static_public, client_payload, prologue) {
    let ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3;
    try {
      ptr0 = passArray8ToWasm0(static_private, wasm.__wbindgen_malloc);
      len0 = WASM_VECTOR_LEN;
      ptr1 = passArray8ToWasm0(static_public, wasm.__wbindgen_malloc);
      len1 = WASM_VECTOR_LEN;
      ptr2 = passArray8ToWasm0(client_payload, wasm.__wbindgen_malloc);
      len2 = WASM_VECTOR_LEN;
      ptr3 = isLikeNone(prologue) ? 0 : passArray8ToWasm0(prologue, wasm.__wbindgen_malloc);
      len3 = WASM_VECTOR_LEN;
    } catch (e) {
      if (ptr3) {
        wasm.__wbindgen_free(ptr3, len3 * 1, 1);
      }
      if (ptr2) {
        wasm.__wbindgen_free(ptr2, len2 * 1, 1);
      }
      if (ptr1) {
        wasm.__wbindgen_free(ptr1, len1 * 1, 1);
      }
      if (ptr0) {
        wasm.__wbindgen_free(ptr0, len0 * 1, 1);
      }
      throw e;
    }
    const ret = wasm.noisexxhandshake_new(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1]);
    }
    this.__wbg_ptr = ret[0];
    NoiseXxHandshakeFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * Verifies the server hello (incl. certificate chain) and returns the encoded client finish.
   * @param {Uint8Array | number[]} server_hello
   * @returns {Uint8Array}
   */
  readServerHelloAndBuildClientFinish(server_hello) {
    const ptr0 = passArray8ToWasm0(server_hello, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.noisexxhandshake_readServerHelloAndBuildClientFinish(this.__wbg_ptr, ptr0, len0);
    if (ret[3]) {
      throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
  }
};
if (Symbol.dispose) NoiseXxHandshake.prototype[Symbol.dispose] = NoiseXxHandshake.prototype.free;
var SignalCipher = class {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    SignalCipherFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_signalcipher_free(ptr, 0);
  }
  /**
   * Create (or re-export) our sender-key distribution message for a group.
   * @param {string} group
   * @param {string} sender
   * @returns {Promise<Uint8Array>}
   */
  createSenderKeyDistribution(group, sender) {
    let ptr0, len0, ptr1, len1;
    try {
      ptr0 = passStringToWasm0(group, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      len0 = WASM_VECTOR_LEN;
      ptr1 = passStringToWasm0(sender, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      len1 = WASM_VECTOR_LEN;
    } catch (e) {
      if (ptr1) {
        wasm.__wbindgen_free(ptr1, len1 * 1, 1);
      }
      if (ptr0) {
        wasm.__wbindgen_free(ptr0, len0 * 1, 1);
      }
      throw e;
    }
    const ret = wasm.signalcipher_createSenderKeyDistribution(this.__wbg_ptr, ptr0, len0, ptr1, len1);
    return ret;
  }
  /**
   * Decrypt a `msg` / `pkmsg` envelope. The updated session is persisted before this resolves;
   * `preKeyId` (pkmsg only) is then safe to delete.
   * @param {string} name
   * @param {number} device
   * @param {string} kind
   * @param {Uint8Array | number[]} ciphertext
   * @returns {Promise<DecryptedMessage>}
   */
  decrypt(name, device, kind, ciphertext) {
    const val4 = +device;
    let ptr0, len0, ptr1, len1, ptr2, len2;
    try {
      ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      len0 = WASM_VECTOR_LEN;
      ptr1 = passStringToWasm0(kind, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      len1 = WASM_VECTOR_LEN;
      ptr2 = passArray8ToWasm0(ciphertext, wasm.__wbindgen_malloc);
      len2 = WASM_VECTOR_LEN;
    } catch (e) {
      if (ptr2) {
        wasm.__wbindgen_free(ptr2, len2 * 1, 1);
      }
      if (ptr1) {
        wasm.__wbindgen_free(ptr1, len1 * 1, 1);
      }
      if (ptr0) {
        wasm.__wbindgen_free(ptr0, len0 * 1, 1);
      }
      throw e;
    }
    const ret = wasm.signalcipher_decrypt(this.__wbg_ptr, ptr0, len0, val4, ptr1, len1, ptr2, len2);
    return ret;
  }
  /**
   * Double-Ratchet encrypt. The session is persisted before this resolves.
   * @param {string} name
   * @param {number} device
   * @param {Uint8Array | number[]} plaintext
   * @returns {Promise<EncryptedMessage>}
   */
  encrypt(name, device, plaintext) {
    const val3 = +device;
    let ptr0, len0, ptr1, len1;
    try {
      ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      len0 = WASM_VECTOR_LEN;
      ptr1 = passArray8ToWasm0(plaintext, wasm.__wbindgen_malloc);
      len1 = WASM_VECTOR_LEN;
    } catch (e) {
      if (ptr1) {
        wasm.__wbindgen_free(ptr1, len1 * 1, 1);
      }
      if (ptr0) {
        wasm.__wbindgen_free(ptr0, len0 * 1, 1);
      }
      throw e;
    }
    const ret = wasm.signalcipher_encrypt(this.__wbg_ptr, ptr0, len0, val3, ptr1, len1);
    return ret;
  }
  /**
   * Group (sender-key) decrypt of an `skmsg`.
   * @param {string} group
   * @param {string} sender
   * @param {Uint8Array | number[]} ciphertext
   * @returns {Promise<Uint8Array>}
   */
  groupDecrypt(group, sender, ciphertext) {
    let ptr0, len0, ptr1, len1, ptr2, len2;
    try {
      ptr0 = passStringToWasm0(group, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      len0 = WASM_VECTOR_LEN;
      ptr1 = passStringToWasm0(sender, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      len1 = WASM_VECTOR_LEN;
      ptr2 = passArray8ToWasm0(ciphertext, wasm.__wbindgen_malloc);
      len2 = WASM_VECTOR_LEN;
    } catch (e) {
      if (ptr2) {
        wasm.__wbindgen_free(ptr2, len2 * 1, 1);
      }
      if (ptr1) {
        wasm.__wbindgen_free(ptr1, len1 * 1, 1);
      }
      if (ptr0) {
        wasm.__wbindgen_free(ptr0, len0 * 1, 1);
      }
      throw e;
    }
    const ret = wasm.signalcipher_groupDecrypt(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
    return ret;
  }
  /**
   * Group (sender-key) encrypt. Create the distribution message first.
   * @param {string} group
   * @param {string} sender
   * @param {Uint8Array | number[]} plaintext
   * @returns {Promise<Uint8Array>}
   */
  groupEncrypt(group, sender, plaintext) {
    let ptr0, len0, ptr1, len1, ptr2, len2;
    try {
      ptr0 = passStringToWasm0(group, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      len0 = WASM_VECTOR_LEN;
      ptr1 = passStringToWasm0(sender, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      len1 = WASM_VECTOR_LEN;
      ptr2 = passArray8ToWasm0(plaintext, wasm.__wbindgen_malloc);
      len2 = WASM_VECTOR_LEN;
    } catch (e) {
      if (ptr2) {
        wasm.__wbindgen_free(ptr2, len2 * 1, 1);
      }
      if (ptr1) {
        wasm.__wbindgen_free(ptr1, len1 * 1, 1);
      }
      if (ptr0) {
        wasm.__wbindgen_free(ptr0, len0 * 1, 1);
      }
      throw e;
    }
    const ret = wasm.signalcipher_groupEncrypt(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
    return ret;
  }
  /**
   * Whether a session with this device exists.
   * @param {string} name
   * @param {number} device
   * @returns {Promise<boolean>}
   */
  hasSession(name, device) {
    const val2 = +device;
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.signalcipher_hasSession(this.__wbg_ptr, ptr0, len0, val2);
    return ret;
  }
  /**
   * @param {SignalStorage} storage
   */
  constructor(storage) {
    const ret = wasm.signalcipher_new(storage);
    this.__wbg_ptr = ret;
    SignalCipherFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * Establish an outgoing session from a device's pre-key bundle (X3DH).
   * @param {string} name
   * @param {number} device
   * @param {PreKeyBundleInput} bundle
   * @returns {Promise<boolean>}
   */
  processPreKeyBundle(name, device, bundle) {
    const val2 = +device;
    const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.signalcipher_processPreKeyBundle(this.__wbg_ptr, ptr0, len0, val2, bundle);
    return ret;
  }
  /**
   * Process a received sender-key distribution message.
   * @param {string} group
   * @param {string} sender
   * @param {Uint8Array | number[]} skdm
   * @returns {Promise<void>}
   */
  processSenderKeyDistribution(group, sender, skdm) {
    let ptr0, len0, ptr1, len1, ptr2, len2;
    try {
      ptr0 = passStringToWasm0(group, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      len0 = WASM_VECTOR_LEN;
      ptr1 = passStringToWasm0(sender, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      len1 = WASM_VECTOR_LEN;
      ptr2 = passArray8ToWasm0(skdm, wasm.__wbindgen_malloc);
      len2 = WASM_VECTOR_LEN;
    } catch (e) {
      if (ptr2) {
        wasm.__wbindgen_free(ptr2, len2 * 1, 1);
      }
      if (ptr1) {
        wasm.__wbindgen_free(ptr1, len1 * 1, 1);
      }
      if (ptr0) {
        wasm.__wbindgen_free(ptr0, len0 * 1, 1);
      }
      throw e;
    }
    const ret = wasm.signalcipher_processSenderKeyDistribution(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
    return ret;
  }
};
if (Symbol.dispose) SignalCipher.prototype[Symbol.dispose] = SignalCipher.prototype.free;
function curveSign(private_key, message) {
  let ptr0, len0, ptr1, len1;
  try {
    ptr0 = passArray8ToWasm0(private_key, wasm.__wbindgen_malloc);
    len0 = WASM_VECTOR_LEN;
    ptr1 = passArray8ToWasm0(message, wasm.__wbindgen_malloc);
    len1 = WASM_VECTOR_LEN;
  } catch (e) {
    if (ptr1) {
      wasm.__wbindgen_free(ptr1, len1 * 1, 1);
    }
    if (ptr0) {
      wasm.__wbindgen_free(ptr0, len0 * 1, 1);
    }
    throw e;
  }
  const ret = wasm.curveSign(ptr0, len0, ptr1, len1);
  if (ret[3]) {
    throw takeFromExternrefTable0(ret[2]);
  }
  var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
  wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
  return v3;
}
function curveVerify(public_key, message, signature) {
  let ptr0, len0, ptr1, len1, ptr2, len2;
  try {
    ptr0 = passArray8ToWasm0(public_key, wasm.__wbindgen_malloc);
    len0 = WASM_VECTOR_LEN;
    ptr1 = passArray8ToWasm0(message, wasm.__wbindgen_malloc);
    len1 = WASM_VECTOR_LEN;
    ptr2 = passArray8ToWasm0(signature, wasm.__wbindgen_malloc);
    len2 = WASM_VECTOR_LEN;
  } catch (e) {
    if (ptr2) {
      wasm.__wbindgen_free(ptr2, len2 * 1, 1);
    }
    if (ptr1) {
      wasm.__wbindgen_free(ptr1, len1 * 1, 1);
    }
    if (ptr0) {
      wasm.__wbindgen_free(ptr0, len0 * 1, 1);
    }
    throw e;
  }
  const ret = wasm.curveVerify(ptr0, len0, ptr1, len1, ptr2, len2);
  return ret !== 0;
}
function decodeNode(data) {
  const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.decodeNode(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return takeFromExternrefTable0(ret[0]);
}
function encodeFrame(payload, header2) {
  let ptr0, len0, ptr1, len1;
  try {
    ptr0 = passArray8ToWasm0(payload, wasm.__wbindgen_malloc);
    len0 = WASM_VECTOR_LEN;
    ptr1 = isLikeNone(header2) ? 0 : passArray8ToWasm0(header2, wasm.__wbindgen_malloc);
    len1 = WASM_VECTOR_LEN;
  } catch (e) {
    if (ptr1) {
      wasm.__wbindgen_free(ptr1, len1 * 1, 1);
    }
    if (ptr0) {
      wasm.__wbindgen_free(ptr0, len0 * 1, 1);
    }
    throw e;
  }
  const ret = wasm.encodeFrame(ptr0, len0, ptr1, len1);
  if (ret[3]) {
    throw takeFromExternrefTable0(ret[2]);
  }
  var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
  wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
  return v3;
}
function encodeNode(node) {
  const ret = wasm.encodeNode(node);
  if (ret[3]) {
    throw takeFromExternrefTable0(ret[2]);
  }
  var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
  wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
  return v1;
}
function generateIdentityKeyPair() {
  const ret = wasm.generateIdentityKeyPair();
  return ret;
}
function generatePreKeys(start, count) {
  const ret = wasm.generatePreKeys(start, count);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return takeFromExternrefTable0(ret[0]);
}
function generateSignedPreKey(identity_private, id) {
  const val2 = +id;
  const ptr0 = passArray8ToWasm0(identity_private, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.generateSignedPreKey(ptr0, len0, val2);
  if (ret[2]) {
    throw takeFromExternrefTable0(ret[1]);
  }
  return takeFromExternrefTable0(ret[0]);
}
function waConnHeader() {
  const ret = wasm.waConnHeader();
  var v1 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
  wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
  return v1;
}
function __wbg_get_imports() {
  const import0 = {
    __proto__: null,
    __wbg_Error_208446807d0d1e30: function(arg0, arg1) {
      const ret = Error(getStringFromWasm0(arg0, arg1));
      return ret;
    },
    __wbg___wbindgen_is_function_741ff2bb612836f5: function(arg0) {
      const ret = typeof arg0 === "function";
      return ret;
    },
    __wbg___wbindgen_is_null_c22311b1cc228e3a: function(arg0) {
      const ret = arg0 === null;
      return ret;
    },
    __wbg___wbindgen_is_undefined_be5b34249ff1fc15: function(arg0) {
      const ret = arg0 === void 0;
      return ret;
    },
    __wbg___wbindgen_number_get_934b640d0889af78: function(arg0, arg1) {
      const obj = arg1;
      const ret = typeof obj === "number" ? obj : void 0;
      getDataViewMemory0().setFloat64((arg0 >>> 0) + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
      getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, !isLikeNone(ret), true);
    },
    __wbg___wbindgen_string_get_7ce8eee7fd327545: function(arg0, arg1) {
      const obj = arg1;
      const ret = typeof obj === "string" ? obj : void 0;
      var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      var len1 = WASM_VECTOR_LEN;
      getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
      getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
    },
    __wbg___wbindgen_throw_4c88d8bf264fd984: function(arg0, arg1) {
      throw new Error(getStringFromWasm0(arg0, arg1));
    },
    __wbg__wbg_cb_unref_09736879a3f67559: function(arg0) {
      arg0._wbg_cb_unref();
    },
    __wbg_call_a410eb4b59ed5965: function() {
      return handleError(function(arg0, arg1, arg2) {
        const ret = arg0.call(arg1, arg2);
        return ret;
      }, arguments);
    },
    __wbg_entries_7bb1459bd9b5c2b9: function(arg0) {
      const ret = Object.entries(arg0);
      return ret;
    },
    __wbg_error_757e9472f8410341: function(arg0, arg1) {
      let deferred0_0;
      let deferred0_1;
      try {
        deferred0_0 = arg0;
        deferred0_1 = arg1;
        console.error(getStringFromWasm0(arg0, arg1));
      } finally {
        wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
      }
    },
    __wbg_from_eac91875c8a5ffa4: function(arg0) {
      const ret = Array.from(arg0);
      return ret;
    },
    __wbg_getIdentityKeyPair_67101351805b6738: function() {
      return handleError(function(arg0) {
        const ret = arg0.getIdentityKeyPair();
        return ret;
      }, arguments);
    },
    __wbg_getLocalRegistrationId_150bb551cdc78390: function() {
      return handleError(function(arg0) {
        const ret = arg0.getLocalRegistrationId();
        return ret;
      }, arguments);
    },
    __wbg_getRandomValues_8b6f1f663e6f188d: function() {
      return handleError(function(arg0, arg1) {
        globalThis.crypto.getRandomValues(getArrayU8FromWasm0(arg0, arg1));
      }, arguments);
    },
    __wbg_get_2080c49015e35254: function() {
      return handleError(function(arg0, arg1) {
        const ret = Reflect.get(arg0, arg1);
        return ret;
      }, arguments);
    },
    __wbg_get_d7176cfb76d71114: function(arg0, arg1) {
      const ret = arg0[arg1 >>> 0];
      return ret;
    },
    __wbg_get_unchecked_e6325ad374eff861: function(arg0, arg1) {
      const ret = arg0[arg1 >>> 0];
      return ret;
    },
    __wbg_instanceof_Uint8Array_d7aeb0dcb3108fea: function(arg0) {
      let result;
      try {
        result = arg0 instanceof Uint8Array;
      } catch (_) {
        result = false;
      }
      const ret = result;
      return ret;
    },
    __wbg_isArray_bcf1376d0d732d08: function(arg0) {
      const ret = Array.isArray(arg0);
      return ret;
    },
    __wbg_length_186163212ffe79c3: function(arg0) {
      const ret = arg0.length;
      return ret;
    },
    __wbg_length_b03a0fabb109b1e9: function(arg0) {
      const ret = arg0.length;
      return ret;
    },
    __wbg_loadIdentity_e50ea51cad692e93: function() {
      return handleError(function(arg0, arg1, arg2, arg3) {
        const ret = arg0.loadIdentity(getStringFromWasm0(arg1, arg2), arg3 >>> 0);
        return ret;
      }, arguments);
    },
    __wbg_loadPreKey_a4157c82229eb62e: function() {
      return handleError(function(arg0, arg1) {
        const ret = arg0.loadPreKey(arg1 >>> 0);
        return ret;
      }, arguments);
    },
    __wbg_loadSenderKey_848c448c0889f20a: function() {
      return handleError(function(arg0, arg1, arg2) {
        const ret = arg0.loadSenderKey(getStringFromWasm0(arg1, arg2));
        return ret;
      }, arguments);
    },
    __wbg_loadSession_cae7ffc36f0f728e: function() {
      return handleError(function(arg0, arg1, arg2, arg3) {
        const ret = arg0.loadSession(getStringFromWasm0(arg1, arg2), arg3 >>> 0);
        return ret;
      }, arguments);
    },
    __wbg_loadSignedPreKey_19907049f01ade04: function() {
      return handleError(function(arg0, arg1) {
        const ret = arg0.loadSignedPreKey(arg1 >>> 0);
        return ret;
      }, arguments);
    },
    __wbg_new_13de428334042d26: function(arg0) {
      const ret = new Uint8Array(arg0);
      return ret;
    },
    __wbg_new_37eb45aaf5eeb820: function() {
      const ret = new Array();
      return ret;
    },
    __wbg_new_bb74001155cb8ca8: function() {
      const ret = new Error();
      return ret;
    },
    __wbg_new_cd4348290afae586: function() {
      const ret = new Object();
      return ret;
    },
    __wbg_new_from_slice_b8daf545a41c6aa0: function(arg0, arg1) {
      const ret = new Uint8Array(getArrayU8FromWasm0(arg0, arg1));
      return ret;
    },
    __wbg_new_typed_e09da9dae6ee5935: function(arg0, arg1) {
      try {
        var state0 = { a: arg0, b: arg1 };
        var cb0 = (arg02, arg12) => {
          const a = state0.a;
          state0.a = 0;
          try {
            return wasm_bindgen__convert__closures_____invoke__hb7b22d56ac48bf30(a, state0.b, arg02, arg12);
          } finally {
            state0.a = a;
          }
        };
        const ret = new Promise(cb0);
        return ret;
      } finally {
        state0.a = 0;
      }
    },
    __wbg_new_with_length_a3dc62dea6e2e158: function(arg0) {
      const ret = new Array(arg0 >>> 0);
      return ret;
    },
    __wbg_now_463ac581d2fc7ea3: function() {
      const ret = Date.now();
      return ret;
    },
    __wbg_prototypesetcall_13162965d1fe7aa3: function(arg0, arg1, arg2) {
      Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
    },
    __wbg_push_c9f4893fc209f768: function(arg0, arg1) {
      const ret = arg0.push(arg1);
      return ret;
    },
    __wbg_queueMicrotask_1e8503a8a690f0a3: function(arg0) {
      const ret = arg0.queueMicrotask;
      return ret;
    },
    __wbg_queueMicrotask_4a1a4d8dd332373b: function(arg0) {
      queueMicrotask(arg0);
    },
    __wbg_removePreKey_e7a7c092419b807f: function() {
      return handleError(function(arg0, arg1) {
        const ret = arg0.removePreKey(arg1 >>> 0);
        return ret;
      }, arguments);
    },
    __wbg_resolve_dbf78ab4942478b0: function(arg0) {
      const ret = Promise.resolve(arg0);
      return ret;
    },
    __wbg_saveIdentity_81fc49ca8a94ed4d: function() {
      return handleError(function(arg0, arg1, arg2, arg3, arg4) {
        const ret = arg0.saveIdentity(getStringFromWasm0(arg1, arg2), arg3 >>> 0, arg4);
        return ret;
      }, arguments);
    },
    __wbg_set_2793479888329cb6: function() {
      return handleError(function(arg0, arg1, arg2) {
        const ret = Reflect.set(arg0, arg1, arg2);
        return ret;
      }, arguments);
    },
    __wbg_set_d2d33b52458e984a: function(arg0, arg1, arg2) {
      arg0[arg1 >>> 0] = arg2;
    },
    __wbg_stack_575c4e0918581b9c: function(arg0, arg1) {
      const ret = arg1.stack;
      const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len1 = WASM_VECTOR_LEN;
      getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
      getDataViewMemory0().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
    },
    __wbg_static_accessor_GLOBAL_THIS_003ee833af9699fc: function() {
      const ret = typeof globalThis === "undefined" ? void 0 : globalThis;
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    },
    __wbg_static_accessor_GLOBAL_e4293fb22cbe77da: function() {
      const ret = typeof global === "undefined" ? void 0 : global;
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    },
    __wbg_static_accessor_SELF_53bb20457401453d: function() {
      const ret = typeof self === "undefined" ? void 0 : self;
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    },
    __wbg_static_accessor_WINDOW_b5e0810bfecb7feb: function() {
      const ret = typeof window === "undefined" ? void 0 : window;
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
    },
    __wbg_storePreKey_1cc8f61285d8ee66: function() {
      return handleError(function(arg0, arg1, arg2) {
        const ret = arg0.storePreKey(arg1 >>> 0, arg2);
        return ret;
      }, arguments);
    },
    __wbg_storeSenderKey_94fa08f8793f5532: function() {
      return handleError(function(arg0, arg1, arg2, arg3) {
        const ret = arg0.storeSenderKey(getStringFromWasm0(arg1, arg2), arg3);
        return ret;
      }, arguments);
    },
    __wbg_storeSession_61ba23761d5a8578: function() {
      return handleError(function(arg0, arg1, arg2, arg3, arg4) {
        const ret = arg0.storeSession(getStringFromWasm0(arg1, arg2), arg3 >>> 0, arg4);
        return ret;
      }, arguments);
    },
    __wbg_storeSignedPreKey_299692d1c8aa6304: function() {
      return handleError(function(arg0, arg1, arg2) {
        const ret = arg0.storeSignedPreKey(arg1 >>> 0, arg2);
        return ret;
      }, arguments);
    },
    __wbg_stringify_0a0fbf2ef722380a: function() {
      return handleError(function(arg0) {
        const ret = JSON.stringify(arg0);
        return ret;
      }, arguments);
    },
    __wbg_then_656f253a5dd7d8ea: function(arg0, arg1, arg2) {
      const ret = arg0.then(arg1, arg2);
      return ret;
    },
    __wbg_then_e3f7f2d365708be8: function(arg0, arg1) {
      const ret = arg0.then(arg1);
      return ret;
    },
    __wbindgen_generic_0000000000000001: function(arg0, arg1) {
      const ret = makeMutClosure(arg0, arg1, wasm_bindgen__convert__closures_____invoke__h90d5bc40910f6a2c);
      return ret;
    },
    __wbindgen_generic_0000000000000002: function(arg0) {
      const ret = arg0;
      return ret;
    },
    __wbindgen_generic_0000000000000003: function(arg0, arg1) {
      const ret = getStringFromWasm0(arg0, arg1);
      return ret;
    },
    __wbindgen_generic_0000000000000004: function(arg0, arg1) {
      var v0 = getArrayU8FromWasm0(arg0, arg1).slice();
      wasm.__wbindgen_free(arg0, arg1 * 1, 1);
      const ret = v0;
      return ret;
    },
    __wbindgen_init_externref_table: function() {
      const table = wasm.__wbindgen_externrefs;
      table.set(0, void 0);
      table.set(1024, void 0);
      table.set(1025, null);
      table.set(1026, true);
      table.set(1027, false);
    }
  };
  return {
    __proto__: null,
    "./velowa_wasm_bridge_bg.js": import0
  };
}
function wasm_bindgen__convert__closures_____invoke__h90d5bc40910f6a2c(arg0, arg1, arg2) {
  const ret = wasm.wasm_bindgen__convert__closures_____invoke__h90d5bc40910f6a2c(arg0, arg1, arg2);
  if (ret[1]) {
    throw takeFromExternrefTable0(ret[0]);
  }
}
function wasm_bindgen__convert__closures_____invoke__hb7b22d56ac48bf30(arg0, arg1, arg2, arg3) {
  wasm.wasm_bindgen__convert__closures_____invoke__hb7b22d56ac48bf30(arg0, arg1, arg2, arg3);
}
var AppStateCollectionFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_appstatecollection_free(ptr, 1));
var FrameDecoderFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_framedecoder_free(ptr, 1));
var NoiseTransportFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_noisetransport_free(ptr, 1));
var NoiseXxHandshakeFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_noisexxhandshake_free(ptr, 1));
var SignalCipherFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_signalcipher_free(ptr, 1));
function addToExternrefTable0(obj) {
  const idx = wasm.__externref_table_alloc();
  wasm.__wbindgen_externrefs.set(idx, obj);
  return idx;
}
var CLOSURE_DTORS = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((state) => wasm.__wbindgen_destroy_closure(state.a, state.b));
function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}
var cachedDataViewMemory0 = null;
function getDataViewMemory0() {
  if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || cachedDataViewMemory0.buffer.detached === void 0 && cachedDataViewMemory0.buffer !== wasm.memory.buffer) {
    cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
  }
  return cachedDataViewMemory0;
}
function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return decodeText(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}
var cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}
function handleError(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    const idx = addToExternrefTable0(e);
    wasm.__wbindgen_exn_store(idx);
  }
}
function isLikeNone(x) {
  return x === void 0 || x === null;
}
function makeMutClosure(arg0, arg1, f) {
  const state = { a: arg0, b: arg1, cnt: 1 };
  const real = (...args) => {
    state.cnt++;
    const a = state.a;
    state.a = 0;
    try {
      return f(a, state.b, ...args);
    } finally {
      state.a = a;
      real._wbg_cb_unref();
    }
  };
  real._wbg_cb_unref = () => {
    if (--state.cnt === 0) {
      wasm.__wbindgen_destroy_closure(state.a, state.b);
      state.a = 0;
      CLOSURE_DTORS.unregister(state);
    }
  };
  CLOSURE_DTORS.register(real, state, state);
  return real;
}
function passArray8ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 1, 1) >>> 0;
  getUint8ArrayMemory0().set(arg, ptr / 1);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}
function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === void 0) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr2 = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory0().subarray(ptr2, ptr2 + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr2;
  }
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8ArrayMemory0();
  let offset = 0;
  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 127) break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
    const ret = cachedTextEncoder.encodeInto(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN = offset;
  return ptr;
}
function takeFromExternrefTable0(idx) {
  const value = wasm.__wbindgen_externrefs.get(idx);
  wasm.__externref_table_dealloc(idx);
  return value;
}
var cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true });
cachedTextDecoder.decode();
var MAX_SAFARI_DECODE_BYTES = 2146435072;
var numBytesDecoded = 0;
function decodeText(bytes2) {
  numBytesDecoded += bytes2.length;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true });
    cachedTextDecoder.decode();
    numBytesDecoded = bytes2.length;
  }
  return cachedTextDecoder.decode(bytes2);
}
var cachedTextEncoder = new TextEncoder();
if (!("encodeInto" in cachedTextEncoder)) {
  cachedTextEncoder.encodeInto = function(arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
      read: arg.length,
      written: buf.length
    };
  };
}
var WASM_VECTOR_LEN = 0;
var wasmModule;
var wasmInstance;
var wasm;
function __wbg_finalize_init(instance, module2) {
  wasmInstance = instance;
  wasm = instance.exports;
  wasmModule = module2;
  cachedDataViewMemory0 = null;
  cachedUint8ArrayMemory0 = null;
  wasm.__wbindgen_start();
  return wasm;
}
function initSync(module2) {
  if (wasm !== void 0) return wasm;
  if (module2 !== void 0) {
    if (Object.getPrototypeOf(module2) === Object.prototype) {
      ({ module: module2 } = module2);
    } else {
      console.warn("using deprecated parameters for `initSync()`; pass a single object instead");
    }
  }
  const imports = __wbg_get_imports();
  if (!(module2 instanceof WebAssembly.Module)) {
    module2 = new WebAssembly.Module(module2);
  }
  const instance = new WebAssembly.Instance(module2, imports);
  return __wbg_finalize_init(instance, module2);
}

// src/wasm-init.ts
var import_node_fs = require("fs");
var ready = false;
function ensureWasm() {
  if (ready) return;
  initSync({ module: (0, import_node_fs.readFileSync)(new URL("./wasm/velowa_wasm_bridge_bg.wasm", importMetaUrl)) });
  ready = true;
}

// src/codec/index.ts
function encodeNode2(node) {
  ensureWasm();
  return encodeNode(node);
}
function decodeNode2(payload) {
  ensureWasm();
  return decodeNode(payload);
}

// src/crypto/noise.ts
function startXxHandshake(staticPrivate, staticPublic, clientPayload) {
  ensureWasm();
  return new NoiseXxHandshake(staticPrivate, staticPublic, clientPayload);
}
function connHeader() {
  ensureWasm();
  return waConnHeader();
}

// src/crypto/signal.ts
function newIdentityKeyPair() {
  ensureWasm();
  return generateIdentityKeyPair();
}
function newSignedPreKey(identityPrivate, id) {
  ensureWasm();
  return generateSignedPreKey(identityPrivate, id);
}
function newPreKeys(start, count) {
  ensureWasm();
  return generatePreKeys(start, count);
}
function createSignalCipher(storage) {
  ensureWasm();
  const raw = new SignalCipher(storage);
  let tail = Promise.resolve();
  return new Proxy(raw, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      return (...args) => {
        const run = tail.then(() => value.apply(target, args));
        tail = run.catch(() => void 0);
        return run;
      };
    }
  });
}
var MemorySignalStorage = class {
  constructor(identity, registrationId) {
    this.identity = identity;
    this.registrationId = registrationId;
  }
  identity;
  registrationId;
  #sessions = /* @__PURE__ */ new Map();
  #identities = /* @__PURE__ */ new Map();
  #preKeys = /* @__PURE__ */ new Map();
  #signedPreKeys = /* @__PURE__ */ new Map();
  #senderKeys = /* @__PURE__ */ new Map();
  getIdentityKeyPair() {
    return Promise.resolve(this.identity);
  }
  getLocalRegistrationId() {
    return Promise.resolve(this.registrationId);
  }
  loadIdentity(name, device) {
    return Promise.resolve(this.#identities.get(`${name}.${device}`));
  }
  saveIdentity(name, device, key) {
    this.#identities.set(`${name}.${device}`, key);
    return Promise.resolve();
  }
  loadSession(name, device) {
    return Promise.resolve(this.#sessions.get(`${name}.${device}`));
  }
  storeSession(name, device, record) {
    this.#sessions.set(`${name}.${device}`, record.slice());
    return Promise.resolve();
  }
  loadPreKey(id) {
    return Promise.resolve(this.#preKeys.get(id));
  }
  storePreKey(id, record) {
    this.#preKeys.set(id, record);
    return Promise.resolve();
  }
  removePreKey(id) {
    this.#preKeys.delete(id);
    return Promise.resolve();
  }
  loadSignedPreKey(id) {
    return Promise.resolve(this.#signedPreKeys.get(id));
  }
  storeSignedPreKey(id, record) {
    this.#signedPreKeys.set(id, record);
    return Promise.resolve();
  }
  loadSenderKey(key) {
    return Promise.resolve(this.#senderKeys.get(key));
  }
  storeSenderKey(key, record) {
    this.#senderKeys.set(key, record.slice());
    return Promise.resolve();
  }
};
function xeddsaSign(privateKey, message) {
  ensureWasm();
  return curveSign(privateKey, message);
}
function xeddsaVerify(publicKey, message, signature) {
  ensureWasm();
  return curveVerify(publicKey, message, signature);
}

// src/crypto/appstate.ts
function newAppStateCollection(name) {
  ensureWasm();
  return new AppStateCollection(name);
}
function restoreAppStateCollection(name, state) {
  ensureWasm();
  return AppStateCollection.fromState(name, state);
}

// src/client/client.ts
var import_node_fs15 = require("fs");

// src/client/features/message/send-content.ts
var import_promises2 = require("fs/promises");

// src/client/features/message/link-preview.ts
var import_node_dns = require("dns");
var import_promises = require("dns/promises");
var import_node_http = __toESM(require("http"), 1);
var import_node_https = __toESM(require("https"), 1);
var import_node_net = require("net");
var URL_RE = /\bhttps?:\/\/[^\s<>"']+/i;
var MAX_REDIRECTS = 4;
function findUrl(text4) {
  const m = URL_RE.exec(text4);
  return m?.[0].replace(/[.,;:!?)\]}]+$/, "");
}
function isPrivateAddress(ip) {
  const v = (0, import_node_net.isIP)(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a === 100 && b >= 64 && b <= 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 192 && b === 0 || a >= 224;
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === "::" || x === "::1") return true;
    if (x.startsWith("::ffff:")) return isPrivateAddress(x.slice(7));
    return /^(fc|fd|fe[89ab])/.test(x) || x.startsWith("ff");
  }
  return true;
}
async function resolveAll(host) {
  if ((0, import_node_net.isIP)(host)) return [host];
  return (await (0, import_promises.lookup)(host, { all: true })).map((a) => a.address);
}
function guardedFetch(timeoutMs, hardCapBytes = 2 * 1024 * 1024) {
  return ((input2, init) => new Promise((resolve2, reject) => {
    const u = new URL(String(input2));
    const mod = u.protocol === "https:" ? import_node_https.default : import_node_http.default;
    const req = mod.request(
      u,
      {
        method: "GET",
        headers: init?.headers,
        timeout: timeoutMs,
        lookup: (host, options, cb) => (0, import_node_dns.lookup)(host, { ...options, all: true }, (err, addrs) => {
          const done = cb;
          if (err) return done(err);
          const list = addrs;
          if (!list.length || list.some((a) => isPrivateAddress(a.address)))
            return done(new Error("refusing private address"));
          if (options.all) return done(null, list);
          done(null, list[0].address, list[0].family);
        })
      },
      (res) => {
        const headers = new Headers();
        for (const [k, v] of Object.entries(res.headers))
          if (typeof v === "string") headers.set(k, v);
          else if (Array.isArray(v)) headers.set(k, v.join(", "));
        let seen = 0;
        const body = new ReadableStream({
          start(controller) {
            res.pause();
            res.on("data", (c) => {
              seen += c.length;
              if (seen > hardCapBytes) {
                res.destroy();
                controller.error(new Error("response too large"));
                return;
              }
              controller.enqueue(new Uint8Array(c));
              if ((controller.desiredSize ?? 0) <= 0) res.pause();
            });
            res.on("end", () => controller.close());
            res.on("error", (e) => controller.error(e));
          },
          pull() {
            res.resume();
          },
          cancel() {
            res.destroy();
          }
        });
        const status = res.statusCode ?? 0;
        resolve2(
          new Response(
            status === 204 || status === 304 || status >= 300 && status < 400 ? null : body,
            {
              status: status < 200 ? 200 : status,
              headers
            }
          )
        );
      }
    );
    const deadline = setTimeout(() => req.destroy(new Error("timeout")), timeoutMs);
    req.on("close", () => clearTimeout(deadline));
    const abort = () => req.destroy(new Error("aborted"));
    if (init?.signal?.aborted) abort();
    else init?.signal?.addEventListener("abort", abort, { once: true });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  }));
}
async function safeGet(url, o, maxBytes, accept) {
  const doFetch = o.fetch ?? guardedFetch(o.timeoutMs, maxBytes + 64 * 1024);
  const resolve2 = o.resolve ?? resolveAll;
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = new URL(current);
    if (u.protocol !== "http:" && u.protocol !== "https:") return void 0;
    if (u.username || u.password) return void 0;
    if (u.port && u.port !== "80" && u.port !== "443") return void 0;
    const host = u.hostname.replace(/^\[|\]$/g, "");
    const addrs = await resolve2(host);
    if (!addrs.length || addrs.some(isPrivateAddress)) return void 0;
    const res = await doFetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(o.timeoutMs),
      headers: {
        accept,
        "user-agent": "Mozilla/5.0 (compatible; WhatsApp/2.24; +https://www.whatsapp.com)"
      }
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.body?.cancel().catch(() => void 0);
      if (!loc) return void 0;
      current = new URL(loc, current).toString();
      continue;
    }
    if (!res.ok || !res.body) {
      await res.body?.cancel().catch(() => void 0);
      return void 0;
    }
    if (Number(res.headers.get("content-length")) > maxBytes) {
      await res.body.cancel().catch(() => void 0);
      return void 0;
    }
    const chunks = [];
    let total = 0;
    const reader = res.body.getReader();
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    return {
      body: Buffer.concat(chunks),
      finalUrl: current,
      type: res.headers.get("content-type") ?? ""
    };
  }
  return void 0;
}
var decodeEntities = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
function parseHead(html) {
  const meta = /* @__PURE__ */ new Map();
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = {};
    for (const a of tag[0].matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g))
      attrs[a[1].toLowerCase()] = a[3] ?? a[4] ?? "";
    const key = (attrs["property"] ?? attrs["name"])?.toLowerCase();
    if (key && attrs["content"] !== void 0 && !meta.has(key))
      meta.set(key, decodeEntities(attrs["content"]).trim());
  }
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return { meta, ...t && { title: decodeEntities(t[1]).replace(/\s+/g, " ").trim() } };
}
async function makeThumbnail(image, type, maxBytes) {
  try {
    const name = "sharp";
    const mod = await import(name);
    return await mod.default(image).resize({ width: 192, withoutEnlargement: true }).jpeg({ quality: 50 }).toBuffer();
  } catch {
    const isJpeg = image[0] === 255 && image[1] === 216 && /jpe?g/i.test(type);
    return isJpeg && image.length <= maxBytes ? image : void 0;
  }
}
async function fetchLinkPreview(text4, opts = {}) {
  const url = findUrl(text4);
  if (!url) return void 0;
  const o = { timeoutMs: 4e3, ...opts };
  let page;
  try {
    page = await safeGet(url, o, opts.maxPageBytes ?? 512 * 1024, "text/html,application/xhtml+xml");
  } catch {
    return void 0;
  }
  if (!page || !/html/i.test(page.type)) return void 0;
  const { meta, title: docTitle } = parseHead(Buffer.from(page.body).toString("utf8"));
  const title = meta.get("og:title") ?? meta.get("twitter:title") ?? docTitle;
  if (!title) return void 0;
  const description = meta.get("og:description") ?? meta.get("twitter:description") ?? meta.get("description");
  const rawImage = meta.get("og:image") ?? meta.get("twitter:image");
  let imageUrl;
  if (rawImage) {
    try {
      imageUrl = new URL(rawImage, page.finalUrl).toString();
    } catch {
    }
  }
  let jpegThumbnail;
  if (imageUrl) {
    try {
      const img = await safeGet(imageUrl, o, opts.maxImageBytes ?? 1024 * 1024, "image/*");
      if (img)
        jpegThumbnail = await makeThumbnail(img.body, img.type, opts.maxThumbBytes ?? 30 * 1024);
    } catch {
    }
  }
  return {
    matchedText: url,
    canonicalUrl: meta.get("og:url") ?? page.finalUrl,
    title,
    ...description && { description },
    ...imageUrl && { imageUrl },
    ...jpegThumbnail && { jpegThumbnail }
  };
}
function linkPreviewMessage(text4, p) {
  return {
    extendedTextMessage: {
      text: text4,
      matchedText: p.matchedText,
      canonicalUrl: p.canonicalUrl,
      title: p.title,
      ...p.description && { description: p.description },
      previewType: "NONE",
      ...p.jpegThumbnail && { jpegThumbnail: p.jpegThumbnail }
    }
  };
}

// src/client/features/message/send-content.ts
var MAX_DOWNLOAD = 128 * 1024 * 1024;
async function toBytes(src) {
  if (src instanceof Uint8Array) return src;
  if ("url" in src) {
    if (!/^https?:\/\//i.test(src.url))
      throw new Error("url must be http(s); use { path } for a local file");
    const res = await guardedFetch(6e4, MAX_DOWNLOAD)(src.url);
    if (!res.ok) throw new Error(`could not fetch ${src.url}: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  if ("path" in src) return (0, import_promises2.readFile)(src.path);
  if ("stream" in src) {
    const chunks = [];
    let size = 0;
    for await (const c of src.stream) {
      const b = Buffer.from(c);
      size += b.length;
      if (size > MAX_DOWNLOAD) throw new Error("stream is larger than the allowed size");
      chunks.push(b);
    }
    return Buffer.concat(chunks);
  }
  throw new Error("unsupported media source");
}
async function sendContent(client, jid, content, options = {}) {
  const c = content;
  const common = {
    ...options.quoted && { quoted: options.quoted },
    ...c.mentions?.length && { mentions: c.mentions },
    ...options.expiration && { expiration: options.expiration }
  };
  if ("react" in c) {
    const r = c["react"];
    return client.react(r.key, r.emoji);
  }
  if ("revoke" in c) return client.revoke(c["revoke"]);
  if ("edit" in c) return client.edit(c["edit"], c["text"]);
  if ("forward" in c) return client.forwardMessage(jid, c["forward"]);
  if ("poll" in c) {
    const p = c["poll"];
    return client.sendPoll(jid, p.name, p.values, p.selectableCount ?? 1);
  }
  if ("location" in c) {
    const l = c["location"];
    return client.sendLocation(jid, l.latitude, l.longitude, {
      ...l.name && { name: l.name },
      ...l.address && { address: l.address }
    });
  }
  if ("contacts" in c) {
    const set = c["contacts"];
    const [first] = set.contacts;
    if (!first) throw new Error("contacts needs at least one contact");
    return client.sendMessage(
      jid,
      set.contacts.length === 1 ? { contactMessage: { displayName: first.name, vcard: first.vcard } } : {
        contactsArrayMessage: {
          displayName: set.displayName ?? "",
          contacts: set.contacts.map((x) => ({ displayName: x.name, vcard: x.vcard }))
        }
      }
    );
  }
  if ("buttons" in c)
    return client.sendButtons(jid, {
      text: c["text"],
      buttons: c["buttons"],
      ...typeof c["footer"] === "string" && { footer: c["footer"] },
      ...typeof c["title"] === "string" && { title: c["title"] }
    });
  if ("sections" in c)
    return client.sendList(jid, {
      title: c["title"],
      text: c["text"],
      buttonText: c["buttonText"],
      sections: c["sections"],
      ...typeof c["footer"] === "string" && { footer: c["footer"] }
    });
  for (const kind of ["image", "video", "audio", "document", "sticker"]) {
    if (!(kind in c)) continue;
    return client.sendMedia(jid, kind, await toBytes(c[kind]), {
      ...common,
      ...typeof c["caption"] === "string" && { caption: c["caption"] },
      ...typeof c["mimetype"] === "string" && { mimetype: c["mimetype"] },
      ...typeof c["fileName"] === "string" && { fileName: c["fileName"] },
      ...typeof c["seconds"] === "number" && { seconds: c["seconds"] },
      ...c["voiceNote"] === true && { ptt: true },
      ...c["gif"] === true && { gifPlayback: true },
      ...c.viewOnce && { viewOnce: true }
    });
  }
  if (typeof c["text"] === "string")
    return client.sendText(jid, c["text"], {
      ...common,
      ...c["linkPreview"] === true && { linkPreview: true }
    });
  throw new Error(`send: this content is not supported (keys: ${Object.keys(c).join(", ")})`);
}

// src/client/server-failure.ts
function classifyServerFailure(node) {
  const byCode = (code) => code === "401" ? "logged-out" : code === "403" ? "forbidden" : void 0;
  if (node.tag === "failure") return byCode(node.attrs["reason"]);
  if (node.tag !== "stream:error") return void 0;
  const conflict = Array.isArray(node.content) ? node.content.find((c) => c.tag === "conflict") : void 0;
  const type = conflict?.attrs["type"];
  if (type === "device_removed") return "logged-out";
  if (type === "replaced") return "replaced";
  return byCode(node.attrs["code"]);
}

// src/client/auth-dir.ts
var import_node_fs2 = require("fs");
var import_node_os = require("os");
var import_node_path = require("path");
function resolveAuthDir(o) {
  if (o.authDir !== void 0) return { dir: o.authDir, temporary: false };
  if (o.guest) return { dir: (0, import_node_fs2.mkdtempSync)((0, import_node_path.join)((0, import_node_os.tmpdir)(), "velowa-guest-")), temporary: true };
  return { dir: "auth", temporary: false };
}

// src/client/features/call/media-files.ts
var import_node_child_process2 = require("child_process");
var import_node_path2 = require("path");

// src/client/features/call/local-audio.ts
var import_node_child_process = require("child_process");
var DEVICE = /^[A-Za-z0-9_.:@+-]{1,200}$/;
var RAW = ["--raw", "--format=s16le", "--rate=16000", "--channels=1", "--latency-msec=60"];
function localAudioCommands(o) {
  const device = (name, flag) => {
    if (typeof name !== "string") return [];
    if (!DEVICE.test(name)) throw new Error(`not a valid audio device name: ${name}`);
    return [`${flag}=${name}`];
  };
  return {
    ...o.mic && { mic: ["parec", [...RAW, ...device(o.mic, "--device")]] },
    ...o.speaker && {
      speaker: ["pacat", ["--playback", ...RAW, ...device(o.speaker, "--device")]]
    }
  };
}
function startLocalAudio(o, onMic, onError) {
  const cmd = localAudioCommands(o);
  const procs = [];
  let speakerIn;
  if (cmd.mic) {
    const p = (0, import_node_child_process.spawn)(cmd.mic[0], cmd.mic[1], { stdio: ["ignore", "pipe", "ignore"] });
    p.on("error", (e) => onError("microphone", e));
    let rest = Buffer.alloc(0);
    p.stdout.on("data", (chunk) => {
      rest = Buffer.concat([rest, chunk]);
      const whole = rest.length - rest.length % 2;
      if (!whole) return;
      const copy = Buffer.from(rest.subarray(0, whole));
      rest = rest.subarray(whole);
      onMic(new Int16Array(copy.buffer, copy.byteOffset, whole >> 1));
    });
    procs.push(p);
  }
  if (cmd.speaker) {
    const p = (0, import_node_child_process.spawn)(cmd.speaker[0], cmd.speaker[1], { stdio: ["pipe", "ignore", "ignore"] });
    p.on("error", (e) => onError("speaker", e));
    p.stdin.on("error", () => void 0);
    speakerIn = p;
    procs.push(p);
  }
  return {
    play(pcm) {
      const stdin = speakerIn?.stdin;
      if (!stdin || stdin.destroyed || stdin.writableLength > 64 * 1024) return;
      stdin.write(Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength));
    },
    stop() {
      for (const p of procs) p.kill("SIGTERM");
    }
  };
}

// src/client/features/call/call-media.ts
var import_node_dgram = require("dgram");
var import_node_module = require("module");
var import_node_fs4 = require("fs");
var import_node_perf_hooks = require("perf_hooks");

// src/voip-wasm.ts
var import_node_fs3 = require("fs");

// src/wasm-voip/velowa_wasm_voip.js
var CallEngine = class _CallEngine {
  static __wrap(ptr) {
    const obj = Object.create(_CallEngine.prototype);
    obj.__wbg_ptr = ptr;
    CallEngineFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    CallEngineFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm2.__wbg_callengine_free(ptr, 0);
  }
  /**
   * Install the shared group epoch (the raw key the creator delivered in `enc_rekey`).
   * @param {number} transaction_id
   * @param {Uint8Array | number[]} raw_epoch
   * @returns {string}
   */
  applyGroupEpoch(transaction_id, raw_epoch) {
    let deferred4_0;
    let deferred4_1;
    try {
      const val2 = +transaction_id;
      const ptr0 = passArray8ToWasm02(raw_epoch, wasm2.__wbindgen_malloc);
      const len0 = WASM_VECTOR_LEN2;
      const ret = wasm2.callengine_applyGroupEpoch(this.__wbg_ptr, val2, ptr0, len0);
      var ptr3 = ret[0];
      var len3 = ret[1];
      if (ret[3]) {
        ptr3 = 0;
        len3 = 0;
        throw takeFromExternrefTable02(ret[2]);
      }
      deferred4_0 = ptr3;
      deferred4_1 = len3;
      return getStringFromWasm02(ptr3, len3);
    } finally {
      wasm2.__wbindgen_free(deferred4_0, deferred4_1, 1);
    }
  }
  /**
   * @param {string} config_json
   * @returns {CallEngine}
   */
  static create(config_json) {
    const ptr0 = passStringToWasm02(config_json, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN2;
    const ret = wasm2.callengine_create(ptr0, len0);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return _CallEngine.__wrap(ret[0]);
  }
  /**
   * Stop sending and decoding video (the camera went off); audio carries on.
   */
  disableVideo() {
    wasm2.callengine_disableVideo(this.__wbg_ptr);
  }
  /**
   * Bring the video plane up in a running call. `gated` holds our outbound video back until the peer accepted.
   * @param {boolean} gated
   * @returns {boolean}
   */
  enableVideo(gated) {
    const ret = wasm2.callengine_enableVideo(this.__wbg_ptr, gated);
    return ret !== 0;
  }
  /**
   * Who sent the encoded audio of the last `6` output (group calls: the participant's device JID), or empty.
   * @returns {string}
   */
  encodedSender() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm2.callengine_encodedSender(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm02(ret[0], ret[1]);
    } finally {
      wasm2.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * STUN error code of a `RelayAllocateFailed` event, or -1.
   * @returns {number}
   */
  eventCode() {
    const ret = wasm2.callengine_eventCode(this.__wbg_ptr);
    return ret;
  }
  /**
   * The whole last event as text (e.g. who reacted with which emoji).
   * @returns {string}
   */
  eventDetail() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm2.callengine_eventDetail(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm02(ret[0], ret[1]);
    } finally {
      wasm2.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * Name of the last `3` output's event (`RelayAllocated`, `MediaConnected`, ...); empty if none.
   * @returns {string}
   */
  eventName() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm2.callengine_eventName(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm02(ret[0], ret[1]);
    } finally {
      wasm2.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * One H.264 Annex-B access unit (video calls).
   * One complete encoded audio payload (Opus mode).
   * @param {number} now
   * @param {Uint8Array | number[]} payload
   */
  handleEncodedAudio(now, payload) {
    const val2 = +now;
    const ptr0 = passArray8ToWasm02(payload, wasm2.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN2;
    wasm2.callengine_handleEncodedAudio(this.__wbg_ptr, val2, ptr0, len0);
  }
  /**
   * One 60 ms mic frame: exactly 960 samples, 16 kHz mono.
   * @param {number} now
   * @param {Int16Array | number[]} pcm
   */
  handleMicFrame(now, pcm) {
    const val2 = +now;
    const ptr0 = passArray16ToWasm0(pcm, wasm2.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN2;
    wasm2.callengine_handleMicFrame(this.__wbg_ptr, val2, ptr0, len0);
  }
  /**
   * @param {number} now
   * @param {Uint8Array | number[]} packet
   */
  handleRelayPacket(now, packet) {
    const val2 = +now;
    const ptr0 = passArray8ToWasm02(packet, wasm2.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN2;
    wasm2.callengine_handleRelayPacket(this.__wbg_ptr, val2, ptr0, len0);
  }
  /**
   * @param {number} now
   */
  handleTimeout(now) {
    wasm2.callengine_handleTimeout(this.__wbg_ptr, now);
  }
  /**
   * @param {number} now
   * @param {Uint8Array | number[]} frame
   */
  handleVideoFrame(now, frame) {
    const val2 = +now;
    const ptr0 = passArray8ToWasm02(frame, wasm2.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN2;
    wasm2.callengine_handleVideoFrame(this.__wbg_ptr, val2, ptr0, len0);
  }
  /**
   * @returns {boolean}
   */
  isAllocated() {
    const ret = wasm2.callengine_isAllocated(this.__wbg_ptr);
    return ret !== 0;
  }
  /**
   * @returns {boolean}
   */
  isTerminated() {
    const ret = wasm2.callengine_isTerminated(this.__wbg_ptr);
    return ret !== 0;
  }
  /**
   * @returns {boolean}
   */
  isVideoEnabled() {
    const ret = wasm2.callengine_isVideoEnabled(this.__wbg_ptr);
    return ret !== 0;
  }
  /**
   * Deadline (ms) of the last `0` output, or -1 for none.
   * @returns {number}
   */
  lastTimeout() {
    const ret = wasm2.callengine_lastTimeout(this.__wbg_ptr);
    return ret;
  }
  /**
   * The engine's media counters as text (RTP received, SRTP failures, silence reason ...), for diagnostics.
   * @returns {string}
   */
  mediaStats() {
    let deferred1_0;
    let deferred1_1;
    try {
      const ret = wasm2.callengine_mediaStats(this.__wbg_ptr);
      deferred1_0 = ret[0];
      deferred1_1 = ret[1];
      return getStringFromWasm02(ret[0], ret[1]);
    } finally {
      wasm2.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
   * Drain one output: 0 = drained (timer armed), 1 = datagram to send, 2 = PCM to play, 3 = event, 4 = video
   * access unit from the peer, 5 = something else (ignore).
   * @returns {number}
   */
  pollOutput() {
    const ret = wasm2.callengine_pollOutput(this.__wbg_ptr);
    return ret;
  }
  /**
   * @returns {number}
   */
  pollTimeout() {
    const ret = wasm2.callengine_pollTimeout(this.__wbg_ptr);
    return ret;
  }
  /**
   * Re-derive the receive keys once the answering device is known.
   * @param {string} answering_peer_lid
   * @returns {boolean}
   */
  rekeyRecv(answering_peer_lid) {
    const ptr0 = passStringToWasm02(answering_peer_lid, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN2;
    const ret = wasm2.callengine_rekeyRecv(this.__wbg_ptr, ptr0, len0);
    return ret !== 0;
  }
  /**
   * The replacement relay transport is open: start the Allocate response budget.
   * @param {number} now
   */
  relayReconnected(now) {
    wasm2.callengine_relayReconnected(this.__wbg_ptr, now);
  }
  /**
   * React in a group call (an emoji; the empty string takes the reaction back).
   * @param {number} now
   * @param {string} emoji
   */
  sendGroupReaction(now, emoji) {
    const val2 = +now;
    const ptr0 = passStringToWasm02(emoji, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN2;
    const ret = wasm2.callengine_sendGroupReaction(this.__wbg_ptr, val2, ptr0, len0);
    if (ret[1]) {
      throw takeFromExternrefTable02(ret[0]);
    }
  }
  /**
   * Start the call (relay allocate). `now` is monotonic ms, `wallclockMs` unix epoch ms.
   * @param {number} now
   * @param {number} wallclock_ms
   */
  start(now, wallclock_ms) {
    wasm2.callengine_start(this.__wbg_ptr, now, wallclock_ms);
  }
  /**
   * The peer's encoded audio payload of the last `6` output (Opus mode).
   * @returns {Uint8Array | undefined}
   */
  takeEncodedAudio() {
    const ret = wasm2.callengine_takeEncodedAudio(this.__wbg_ptr);
    let v1;
    if (ret[0] !== 0) {
      v1 = getArrayU8FromWasm02(ret[0], ret[1]).slice();
      wasm2.__wbindgen_free(ret[0], ret[1] * 1, 1);
    }
    return v1;
  }
  /**
   * @returns {Int16Array | undefined}
   */
  takePlayout() {
    const ret = wasm2.callengine_takePlayout(this.__wbg_ptr);
    let v1;
    if (ret[0] !== 0) {
      v1 = getArrayI16FromWasm0(ret[0], ret[1]).slice();
      wasm2.__wbindgen_free(ret[0], ret[1] * 2, 2);
    }
    return v1;
  }
  /**
   * The relay (`ip:port`) the last `OUT_RECONNECT` output asks us to dial.
   * @returns {string | undefined}
   */
  takeReconnect() {
    const ret = wasm2.callengine_takeReconnect(this.__wbg_ptr);
    let v1;
    if (ret[0] !== 0) {
      v1 = getStringFromWasm02(ret[0], ret[1]);
      wasm2.__wbindgen_free(ret[0], ret[1] * 1, 1);
    }
    return v1;
  }
  /**
   * @returns {Uint8Array | undefined}
   */
  takeTransmit() {
    const ret = wasm2.callengine_takeTransmit(this.__wbg_ptr);
    let v1;
    if (ret[0] !== 0) {
      v1 = getArrayU8FromWasm02(ret[0], ret[1]).slice();
      wasm2.__wbindgen_free(ret[0], ret[1] * 1, 1);
    }
    return v1;
  }
  /**
   * The peer's video access unit (Annex-B bytes) of the last `4` output.
   * @returns {Uint8Array | undefined}
   */
  takeVideo() {
    const ret = wasm2.callengine_takeVideo(this.__wbg_ptr);
    let v1;
    if (ret[0] !== 0) {
      v1 = getArrayU8FromWasm02(ret[0], ret[1]).slice();
      wasm2.__wbindgen_free(ret[0], ret[1] * 1, 1);
    }
    return v1;
  }
};
if (Symbol.dispose) CallEngine.prototype[Symbol.dispose] = CallEngine.prototype.free;
var GroupSession = class {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    GroupSessionFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm2.__wbg_groupsession_free(ptr, 0);
  }
  /**
   * The `<ack>` of our offer (or of a link join): the first roster and the shared relay.
   * @param {Uint8Array | number[]} encoded_ack
   * @returns {any}
   */
  applyAck(encoded_ack) {
    const ptr0 = passArray8ToWasm02(encoded_ack, wasm2.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN2;
    const ret = wasm2.groupsession_applyAck(this.__wbg_ptr, ptr0, len0);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * The `<offer>` of an invitation into a group call (its action node, encoded): the roster it carries, if any.
   * @param {Uint8Array | number[]} encoded_offer
   * @returns {any}
   */
  applyInvite(encoded_offer) {
    const ptr0 = passArray8ToWasm02(encoded_offer, wasm2.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN2;
    const ret = wasm2.groupsession_applyInvite(this.__wbg_ptr, ptr0, len0);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * A `<group_update>` (the call stanza's action node, encoded).
   * @param {Uint8Array | number[]} encoded_action
   * @returns {any}
   */
  applyUpdate(encoded_action) {
    const ptr0 = passArray8ToWasm02(encoded_action, wasm2.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN2;
    const ret = wasm2.groupsession_applyUpdate(this.__wbg_ptr, ptr0, len0);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return takeFromExternrefTable02(ret[0]);
  }
  /**
   * Build the group media engine from the relay snapshot. `opus` selects standard Opus (encoded I/O).
   * @param {boolean} incoming
   * @param {boolean} opus
   * @param {boolean} video
   * @returns {CallEngine}
   */
  createEngine(incoming, opus, video) {
    const ret = wasm2.groupsession_createEngine(this.__wbg_ptr, incoming, opus, video);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    return CallEngine.__wrap(ret[0]);
  }
  /**
   * `self_jid` is our own device LID; `creator` the call creator's device LID.
   * @param {string} call_id
   * @param {string} creator
   * @param {string} self_jid
   */
  constructor(call_id, creator, self_jid) {
    let ptr0, len0, ptr1, len1, ptr2, len2;
    try {
      ptr0 = passStringToWasm02(call_id, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
      len0 = WASM_VECTOR_LEN2;
      ptr1 = passStringToWasm02(creator, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
      len1 = WASM_VECTOR_LEN2;
      ptr2 = passStringToWasm02(self_jid, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
      len2 = WASM_VECTOR_LEN2;
    } catch (e) {
      if (ptr2) {
        wasm2.__wbindgen_free(ptr2, len2 * 1, 1);
      }
      if (ptr1) {
        wasm2.__wbindgen_free(ptr1, len1 * 1, 1);
      }
      if (ptr0) {
        wasm2.__wbindgen_free(ptr0, len0 * 1, 1);
      }
      throw e;
    }
    const ret = wasm2.groupsession_new(ptr0, len0, ptr1, len1, ptr2, len2);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    this.__wbg_ptr = ret[0];
    GroupSessionFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * Hand the engine the roster the session holds now (after `applyUpdate`).
   * @param {CallEngine} engine
   * @param {number} now
   * @returns {string}
   */
  pushToEngine(engine, now) {
    let deferred2_0;
    let deferred2_1;
    try {
      _assertClass(engine, CallEngine);
      const ret = wasm2.groupsession_pushToEngine(this.__wbg_ptr, engine.__wbg_ptr, now);
      var ptr1 = ret[0];
      var len1 = ret[1];
      if (ret[3]) {
        ptr1 = 0;
        len1 = 0;
        throw takeFromExternrefTable02(ret[2]);
      }
      deferred2_0 = ptr1;
      deferred2_1 = len1;
      return getStringFromWasm02(ptr1, len1);
    } finally {
      wasm2.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
  }
};
if (Symbol.dispose) GroupSession.prototype[Symbol.dispose] = GroupSession.prototype.free;
var RelayChannel = class {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    RelayChannelFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm2.__wbg_relaychannel_free(ptr, 0);
  }
  /**
   * @param {number} now_ms
   */
  close(now_ms) {
    wasm2.relaychannel_close(this.__wbg_ptr, now_ms);
  }
  /**
   * Feed a datagram from the relay. Returns an error text when the channel ended or failed.
   * @param {number} now_ms
   * @param {Uint8Array | number[]} data
   * @returns {string | undefined}
   */
  handleDatagram(now_ms, data) {
    const val2 = +now_ms;
    const ptr0 = passArray8ToWasm02(data, wasm2.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN2;
    const ret = wasm2.relaychannel_handleDatagram(this.__wbg_ptr, val2, ptr0, len0);
    let v3;
    if (ret[0] !== 0) {
      v3 = getStringFromWasm02(ret[0], ret[1]);
      wasm2.__wbindgen_free(ret[0], ret[1] * 1, 1);
    }
    return v3;
  }
  /**
   * @param {number} now_ms
   * @returns {string | undefined}
   */
  handleTimeout(now_ms) {
    const ret = wasm2.relaychannel_handleTimeout(this.__wbg_ptr, now_ms);
    let v1;
    if (ret[0] !== 0) {
      v1 = getStringFromWasm02(ret[0], ret[1]);
      wasm2.__wbindgen_free(ret[0], ret[1] * 1, 1);
    }
    return v1;
  }
  /**
   * @returns {boolean}
   */
  isOpen() {
    const ret = wasm2.relaychannel_isOpen(this.__wbg_ptr);
    return ret !== 0;
  }
  /**
   * Dial the relay at `ip:port`. Nothing is sent until `pollTransmit` is drained.
   * @param {string} ip
   * @param {number} port
   */
  constructor(ip, port) {
    const val2 = +port;
    const ptr0 = passStringToWasm02(ip, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN2;
    const ret = wasm2.relaychannel_new(ptr0, len0, val2);
    if (ret[2]) {
      throw takeFromExternrefTable02(ret[1]);
    }
    this.__wbg_ptr = ret[0];
    RelayChannelFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * The next media message from the relay, if any.
   * @returns {Uint8Array | undefined}
   */
  pollInbound() {
    const ret = wasm2.relaychannel_pollInbound(this.__wbg_ptr);
    let v1;
    if (ret[0] !== 0) {
      v1 = getArrayU8FromWasm02(ret[0], ret[1]).slice();
      wasm2.__wbindgen_free(ret[0], ret[1] * 1, 1);
    }
    return v1;
  }
  /**
   * Milliseconds (on the caller's clock) when `handleTimeout` is due, or -1.
   * @returns {number}
   */
  pollTimeout() {
    const ret = wasm2.relaychannel_pollTimeout(this.__wbg_ptr);
    return ret;
  }
  /**
   * The next datagram to send to the relay, if any.
   * @returns {Uint8Array | undefined}
   */
  pollTransmit() {
    const ret = wasm2.relaychannel_pollTransmit(this.__wbg_ptr);
    let v1;
    if (ret[0] !== 0) {
      v1 = getArrayU8FromWasm02(ret[0], ret[1]).slice();
      wasm2.__wbindgen_free(ret[0], ret[1] * 1, 1);
    }
    return v1;
  }
  /**
   * Queue one media message (STUN/RTP/RTCP bytes from the call engine).
   * @param {number} now_ms
   * @param {Uint8Array | number[]} data
   * @returns {string | undefined}
   */
  write(now_ms, data) {
    const val2 = +now_ms;
    const ptr0 = passArray8ToWasm02(data, wasm2.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN2;
    const ret = wasm2.relaychannel_write(this.__wbg_ptr, val2, ptr0, len0);
    let v3;
    if (ret[0] !== 0) {
      v3 = getStringFromWasm02(ret[0], ret[1]);
      wasm2.__wbindgen_free(ret[0], ret[1] * 1, 1);
    }
    return v3;
  }
};
if (Symbol.dispose) RelayChannel.prototype[Symbol.dispose] = RelayChannel.prototype.free;
function buildGroupEncRekey(params_json) {
  const ptr0 = passStringToWasm02(params_json, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
  const len0 = WASM_VECTOR_LEN2;
  const ret = wasm2.buildGroupEncRekey(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable02(ret[1]);
  }
  return takeFromExternrefTable02(ret[0]);
}
function buildGroupOffer(params_json) {
  const ptr0 = passStringToWasm02(params_json, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
  const len0 = WASM_VECTOR_LEN2;
  const ret = wasm2.buildGroupOffer(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable02(ret[1]);
  }
  return takeFromExternrefTable02(ret[0]);
}
function deriveCallParticipantSsrc(call_id, self_lid, slot_word) {
  const val3 = +slot_word;
  let ptr0, len0, ptr1, len1;
  try {
    ptr0 = passStringToWasm02(call_id, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
    len0 = WASM_VECTOR_LEN2;
    ptr1 = passStringToWasm02(self_lid, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
    len1 = WASM_VECTOR_LEN2;
  } catch (e) {
    if (ptr1) {
      wasm2.__wbindgen_free(ptr1, len1 * 1, 1);
    }
    if (ptr0) {
      wasm2.__wbindgen_free(ptr0, len0 * 1, 1);
    }
    throw e;
  }
  const ret = wasm2.deriveCallParticipantSsrc(ptr0, len0, ptr1, len1, val3);
  return ret >>> 0;
}
function parseGroupEncRekey(encoded_node) {
  const ptr0 = passArray8ToWasm02(encoded_node, wasm2.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN2;
  const ret = wasm2.parseGroupEncRekey(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable02(ret[1]);
  }
  return takeFromExternrefTable02(ret[0]);
}
function parseRelayFromNode(encoded_node) {
  const ptr0 = passArray8ToWasm02(encoded_node, wasm2.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN2;
  const ret = wasm2.parseRelayFromNode(ptr0, len0);
  if (ret[2]) {
    throw takeFromExternrefTable02(ret[1]);
  }
  return takeFromExternrefTable02(ret[0]);
}
function __wbg_get_imports2() {
  const import0 = {
    __proto__: null,
    __wbg___wbindgen_is_function_741ff2bb612836f5: function(arg0) {
      const ret = typeof arg0 === "function";
      return ret;
    },
    __wbg___wbindgen_is_object_8b968c3ab8e96595: function(arg0) {
      const val = arg0;
      const ret = typeof val === "object" && val !== null;
      return ret;
    },
    __wbg___wbindgen_is_string_fc456fee5d3317de: function(arg0) {
      const ret = typeof arg0 === "string";
      return ret;
    },
    __wbg___wbindgen_is_undefined_be5b34249ff1fc15: function(arg0) {
      const ret = arg0 === void 0;
      return ret;
    },
    __wbg___wbindgen_throw_4c88d8bf264fd984: function(arg0, arg1) {
      throw new Error(getStringFromWasm02(arg0, arg1));
    },
    __wbg_call_a410eb4b59ed5965: function() {
      return handleError2(function(arg0, arg1, arg2) {
        const ret = arg0.call(arg1, arg2);
        return ret;
      }, arguments);
    },
    __wbg_crypto_23f565a907d30078: function(arg0) {
      const ret = arg0.crypto;
      return ret;
    },
    __wbg_error_757e9472f8410341: function(arg0, arg1) {
      let deferred0_0;
      let deferred0_1;
      try {
        deferred0_0 = arg0;
        deferred0_1 = arg1;
        console.error(getStringFromWasm02(arg0, arg1));
      } finally {
        wasm2.__wbindgen_free(deferred0_0, deferred0_1, 1);
      }
    },
    __wbg_getRandomValues_8b6f1f663e6f188d: function() {
      return handleError2(function(arg0, arg1) {
        globalThis.crypto.getRandomValues(getArrayU8FromWasm02(arg0, arg1));
      }, arguments);
    },
    __wbg_getRandomValues_d2908e0b99612b91: function() {
      return handleError2(function(arg0, arg1) {
        arg0.getRandomValues(arg1);
      }, arguments);
    },
    __wbg_length_186163212ffe79c3: function(arg0) {
      const ret = arg0.length;
      return ret;
    },
    __wbg_msCrypto_d5f06fad6bf1409b: function(arg0) {
      const ret = arg0.msCrypto;
      return ret;
    },
    __wbg_new_37eb45aaf5eeb820: function() {
      const ret = new Array();
      return ret;
    },
    __wbg_new_bb74001155cb8ca8: function() {
      const ret = new Error();
      return ret;
    },
    __wbg_new_cd4348290afae586: function() {
      const ret = new Object();
      return ret;
    },
    __wbg_new_from_slice_b8daf545a41c6aa0: function(arg0, arg1) {
      const ret = new Uint8Array(getArrayU8FromWasm02(arg0, arg1));
      return ret;
    },
    __wbg_new_with_length_01b143a7e5dd5a3e: function(arg0) {
      const ret = new Uint8Array(arg0 >>> 0);
      return ret;
    },
    __wbg_node_86166ff8ce1f2002: function(arg0) {
      const ret = arg0.node;
      return ret;
    },
    __wbg_now_463ac581d2fc7ea3: function() {
      const ret = Date.now();
      return ret;
    },
    __wbg_parse_c3f72b5a24f83c01: function() {
      return handleError2(function(arg0, arg1) {
        const ret = JSON.parse(getStringFromWasm02(arg0, arg1));
        return ret;
      }, arguments);
    },
    __wbg_process_91f425a63f58e399: function(arg0) {
      const ret = arg0.process;
      return ret;
    },
    __wbg_prototypesetcall_13162965d1fe7aa3: function(arg0, arg1, arg2) {
      Uint8Array.prototype.set.call(getArrayU8FromWasm02(arg0, arg1), arg2);
    },
    __wbg_push_c9f4893fc209f768: function(arg0, arg1) {
      const ret = arg0.push(arg1);
      return ret;
    },
    __wbg_randomFillSync_34b023059e3363de: function() {
      return handleError2(function(arg0, arg1) {
        arg0.randomFillSync(arg1);
      }, arguments);
    },
    __wbg_require_9a7d8cc2e1d275c0: function() {
      return handleError2(function() {
        const ret = module.require;
        return ret;
      }, arguments);
    },
    __wbg_set_2793479888329cb6: function() {
      return handleError2(function(arg0, arg1, arg2) {
        const ret = Reflect.set(arg0, arg1, arg2);
        return ret;
      }, arguments);
    },
    __wbg_stack_575c4e0918581b9c: function(arg0, arg1) {
      const ret = arg1.stack;
      const ptr1 = passStringToWasm02(ret, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
      const len1 = WASM_VECTOR_LEN2;
      getDataViewMemory02().setInt32((arg0 >>> 0) + 4 * 1, len1, true);
      getDataViewMemory02().setInt32((arg0 >>> 0) + 4 * 0, ptr1, true);
    },
    __wbg_static_accessor_GLOBAL_THIS_003ee833af9699fc: function() {
      const ret = typeof globalThis === "undefined" ? void 0 : globalThis;
      return isLikeNone2(ret) ? 0 : addToExternrefTable02(ret);
    },
    __wbg_static_accessor_GLOBAL_e4293fb22cbe77da: function() {
      const ret = typeof global === "undefined" ? void 0 : global;
      return isLikeNone2(ret) ? 0 : addToExternrefTable02(ret);
    },
    __wbg_static_accessor_SELF_53bb20457401453d: function() {
      const ret = typeof self === "undefined" ? void 0 : self;
      return isLikeNone2(ret) ? 0 : addToExternrefTable02(ret);
    },
    __wbg_static_accessor_WINDOW_b5e0810bfecb7feb: function() {
      const ret = typeof window === "undefined" ? void 0 : window;
      return isLikeNone2(ret) ? 0 : addToExternrefTable02(ret);
    },
    __wbg_subarray_58f388a9247ac0bb: function(arg0, arg1, arg2) {
      const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
      return ret;
    },
    __wbg_versions_6e128a981b0df859: function(arg0) {
      const ret = arg0.versions;
      return ret;
    },
    __wbindgen_generic_0000000000000001: function(arg0, arg1) {
      const ret = getArrayU8FromWasm02(arg0, arg1);
      return ret;
    },
    __wbindgen_generic_0000000000000002: function(arg0, arg1) {
      const ret = getStringFromWasm02(arg0, arg1);
      return ret;
    },
    __wbindgen_init_externref_table: function() {
      const table = wasm2.__wbindgen_externrefs;
      table.set(0, void 0);
      table.set(1024, void 0);
      table.set(1025, null);
      table.set(1026, true);
      table.set(1027, false);
    }
  };
  return {
    __proto__: null,
    "./velowa_wasm_voip_bg.js": import0
  };
}
var CallEngineFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm2.__wbg_callengine_free(ptr, 1));
var GroupSessionFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm2.__wbg_groupsession_free(ptr, 1));
var RelayChannelFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm2.__wbg_relaychannel_free(ptr, 1));
function addToExternrefTable02(obj) {
  const idx = wasm2.__externref_table_alloc();
  wasm2.__wbindgen_externrefs.set(idx, obj);
  return idx;
}
function _assertClass(instance, klass) {
  if (!(instance instanceof klass)) {
    throw new Error(`expected instance of ${klass.name}`);
  }
}
function getArrayI16FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getInt16ArrayMemory0().subarray(ptr / 2, ptr / 2 + len);
}
function getArrayU8FromWasm02(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory02().subarray(ptr / 1, ptr / 1 + len);
}
var cachedDataViewMemory02 = null;
function getDataViewMemory02() {
  if (cachedDataViewMemory02 === null || cachedDataViewMemory02.buffer.detached === true || cachedDataViewMemory02.buffer.detached === void 0 && cachedDataViewMemory02.buffer !== wasm2.memory.buffer) {
    cachedDataViewMemory02 = new DataView(wasm2.memory.buffer);
  }
  return cachedDataViewMemory02;
}
var cachedInt16ArrayMemory0 = null;
function getInt16ArrayMemory0() {
  if (cachedInt16ArrayMemory0 === null || cachedInt16ArrayMemory0.byteLength === 0) {
    cachedInt16ArrayMemory0 = new Int16Array(wasm2.memory.buffer);
  }
  return cachedInt16ArrayMemory0;
}
function getStringFromWasm02(ptr, len) {
  ptr = ptr >>> 0;
  return decodeText2(getUint8ArrayMemory02().subarray(ptr, ptr + len));
}
var cachedUint16ArrayMemory0 = null;
function getUint16ArrayMemory0() {
  if (cachedUint16ArrayMemory0 === null || cachedUint16ArrayMemory0.byteLength === 0) {
    cachedUint16ArrayMemory0 = new Uint16Array(wasm2.memory.buffer);
  }
  return cachedUint16ArrayMemory0;
}
var cachedUint8ArrayMemory02 = null;
function getUint8ArrayMemory02() {
  if (cachedUint8ArrayMemory02 === null || cachedUint8ArrayMemory02.byteLength === 0) {
    cachedUint8ArrayMemory02 = new Uint8Array(wasm2.memory.buffer);
  }
  return cachedUint8ArrayMemory02;
}
function handleError2(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    const idx = addToExternrefTable02(e);
    wasm2.__wbindgen_exn_store(idx);
  }
}
function isLikeNone2(x) {
  return x === void 0 || x === null;
}
function passArray16ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 2, 2) >>> 0;
  getUint16ArrayMemory0().set(arg, ptr / 2);
  WASM_VECTOR_LEN2 = arg.length;
  return ptr;
}
function passArray8ToWasm02(arg, malloc) {
  const ptr = malloc(arg.length * 1, 1) >>> 0;
  getUint8ArrayMemory02().set(arg, ptr / 1);
  WASM_VECTOR_LEN2 = arg.length;
  return ptr;
}
function passStringToWasm02(arg, malloc, realloc) {
  if (realloc === void 0) {
    const buf = cachedTextEncoder2.encode(arg);
    const ptr2 = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory02().subarray(ptr2, ptr2 + buf.length).set(buf);
    WASM_VECTOR_LEN2 = buf.length;
    return ptr2;
  }
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8ArrayMemory02();
  let offset = 0;
  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 127) break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8ArrayMemory02().subarray(ptr + offset, ptr + len);
    const ret = cachedTextEncoder2.encodeInto(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN2 = offset;
  return ptr;
}
function takeFromExternrefTable02(idx) {
  const value = wasm2.__wbindgen_externrefs.get(idx);
  wasm2.__externref_table_dealloc(idx);
  return value;
}
var cachedTextDecoder2 = new TextDecoder("utf-8", { ignoreBOM: true });
cachedTextDecoder2.decode();
var MAX_SAFARI_DECODE_BYTES2 = 2146435072;
var numBytesDecoded2 = 0;
function decodeText2(bytes2) {
  numBytesDecoded2 += bytes2.length;
  if (numBytesDecoded2 >= MAX_SAFARI_DECODE_BYTES2) {
    cachedTextDecoder2 = new TextDecoder("utf-8", { ignoreBOM: true });
    cachedTextDecoder2.decode();
    numBytesDecoded2 = bytes2.length;
  }
  return cachedTextDecoder2.decode(bytes2);
}
var cachedTextEncoder2 = new TextEncoder();
if (!("encodeInto" in cachedTextEncoder2)) {
  cachedTextEncoder2.encodeInto = function(arg, view) {
    const buf = cachedTextEncoder2.encode(arg);
    view.set(buf);
    return {
      read: arg.length,
      written: buf.length
    };
  };
}
var WASM_VECTOR_LEN2 = 0;
var wasmModule2;
var wasmInstance2;
var wasm2;
function __wbg_finalize_init2(instance, module2) {
  wasmInstance2 = instance;
  wasm2 = instance.exports;
  wasmModule2 = module2;
  cachedDataViewMemory02 = null;
  cachedInt16ArrayMemory0 = null;
  cachedUint16ArrayMemory0 = null;
  cachedUint8ArrayMemory02 = null;
  wasm2.__wbindgen_start();
  return wasm2;
}
function initSync2(module2) {
  if (wasm2 !== void 0) return wasm2;
  if (module2 !== void 0) {
    if (Object.getPrototypeOf(module2) === Object.prototype) {
      ({ module: module2 } = module2);
    } else {
      console.warn("using deprecated parameters for `initSync()`; pass a single object instead");
    }
  }
  const imports = __wbg_get_imports2();
  if (!(module2 instanceof WebAssembly.Module)) {
    module2 = new WebAssembly.Module(module2);
  }
  const instance = new WebAssembly.Instance(module2, imports);
  return __wbg_finalize_init2(instance, module2);
}

// src/voip-wasm.ts
var ready2 = false;
function ensureVoipWasm() {
  if (ready2) return;
  initSync2({
    module: (0, import_node_fs3.readFileSync)(new URL("./wasm-voip/velowa_wasm_voip_bg.wasm", importMetaUrl))
  });
  ready2 = true;
}

// src/client/features/call/call-media.ts
function newOpus() {
  const O = (0, import_node_module.createRequire)(importMetaUrl)("opusscript");
  return new O(16e3, 1, O.Application.VOIP);
}
function writeWav(path, pcm, rate = 16e3) {
  const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  (0, import_node_fs4.writeFileSync)(path, Buffer.concat([h, data]));
}
function splitAnnexB(data) {
  const starts = [];
  for (let i = 0; i + 3 < data.length; i++) {
    if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1 && (data[i + 3] & 31) === 9)
      starts.push(i > 0 && data[i - 1] === 0 ? i - 1 : i);
  }
  if (!starts.length) throw new Error("no access-unit delimiters; encode with x264 aud=1");
  return starts.map((s, k) => data.subarray(s, starts[k + 1] ?? data.length));
}
var MAX_DECODERS = 64;
var FRAME_SAMPLES = 960;
function applyGain(frame, gain) {
  if (gain === 1) return;
  for (let i = 0; i < frame.length; i++) {
    const v = Math.round(frame[i] * gain);
    frame[i] = v > 32767 ? 32767 : v < -32768 ? -32768 : v;
  }
}
var FRAME_MS = 60;
var MediaSession = class extends TypedEmitter {
  #engine;
  #socket;
  #channel;
  /** A replacement channel is dialling; the engine waits for it before it sends again. */
  #redial = false;
  #t0 = import_node_perf_hooks.performance.now();
  #relay;
  #timer;
  #mic;
  #closed = false;
  #sent = 0;
  #received = 0;
  #audioIn;
  #localAudioOptions;
  #local;
  #audioPos = 0;
  #paused = false;
  #gain = 1;
  constructor(o) {
    super();
    ensureVoipWasm();
    if (o.group) {
      this.#relay = {
        relay_ip: o.group.relay.ip,
        relay_port: o.group.relay.port,
        relay_token: [],
        auth_token: [],
        integrity_key: [],
        warp_mi_tag_len: 4
      };
    } else {
      if (!o.relay) throw new Error("a call needs a relay");
      const bytes2 = encodeNode2({ tag: "ack", attrs: {}, content: [o.relay] });
      this.#relay = parseRelayFromNode(bytes2);
    }
    const ssrc = o.group ? 0 : deriveCallParticipantSsrc(o.callId, o.selfLid, 0);
    this.#engine = o.group?.engine ?? CallEngine.create(
      JSON.stringify({
        call_id: o.callId,
        direction: o.direction,
        self_lid: o.selfLid,
        peer_lid: o.peerLid,
        call_key: [...o.callKey],
        ssrc,
        relay_token: this.#relay.relay_token,
        auth_token: this.#relay.auth_token,
        relay_ip: this.#relay.relay_ip,
        relay_port: this.#relay.relay_port,
        integrity_key: this.#relay.integrity_key,
        warp_mi_tag_len: this.#relay.warp_mi_tag_len,
        enable_media: true,
        enable_video: !!o.enableVideo,
        enable_sframe: true,
        audio: o.codec === "mlow" ? "mlow" : "opus"
      })
    );
    this.#audioIn = o.audioIn;
    this.#localAudioOptions = o.localAudio;
    if (o.codec !== "mlow") this.#opus = newOpus();
    this.#recordTo = o.recordTo;
    this.#videoOut = o.video?.frames;
    this.#videoFps = o.video?.fps ?? 15;
    this.#recordVideoTo = o.recordVideoTo;
    this.#channel = new RelayChannel(this.#relay.relay_ip, this.#relay.relay_port);
    this.#socket = this.#openSocket();
  }
  /** One UDP flow per relay channel: a redial must not reuse the 5-tuple of the old DTLS association. */
  #openSocket() {
    const socket = (0, import_node_dgram.createSocket)("udp4");
    socket.on("message", (msg) => {
      if (this.#closed || socket !== this.#socket) return;
      this.#received++;
      const err = this.#channel.handleDatagram(this.#now(), msg);
      if (err) return this.close(`relay: ${err}`);
      this.#pump();
    });
    socket.on("error", (e) => this.close(`socket: ${e.message}`));
    return socket;
  }
  #now() {
    return import_node_perf_hooks.performance.now() - this.#t0;
  }
  /** Packets exchanged with the relay so far. */
  get stats() {
    return { sent: this.#sent, received: this.#received };
  }
  /** The engine's own counters (RTP in, SRTP failures, why it is silent) as text. */
  get engineStats() {
    return this.#engine.mediaStats();
  }
  #started = false;
  #opus;
  /** Group calls: one Opus decoder per speaking device. */
  #decoders = /* @__PURE__ */ new Map();
  #videoOut;
  #videoFps = 15;
  #videoPos = 0;
  #videoTimer;
  #recordVideoTo;
  #videoIn = [];
  #recordTo;
  #recorded = [];
  /** Dial the relay: DTLS handshake first; the engine starts once the media channel is open. */
  start() {
    this.#pump();
  }
  /** Our camera goes on in a running call: the frames are sent (looped) once the plane is up. */
  startVideo(frames, fps = 15, gated = false) {
    if (this.#closed || !frames.length) return false;
    const ok = this.#engine.enableVideo(gated);
    if (!ok) return false;
    this.#videoOut = frames;
    this.#videoFps = fps;
    if (this.#videoTimer) clearInterval(this.#videoTimer);
    this.#videoTimer = void 0;
    this.#videoPos = 0;
    this.#startVideo();
    this.#pump();
    return true;
  }
  /** The peer accepted our upgrade: let the (held back) outbound video go. */
  releaseVideo() {
    this.#engine.enableVideo(false);
    this.#pump();
  }
  /** Our camera goes off; audio carries on. */
  stopVideo() {
    if (this.#videoTimer) clearInterval(this.#videoTimer);
    this.#videoTimer = void 0;
    this.#videoOut = void 0;
    this.#engine.disableVideo();
    this.#pump();
  }
  /** Prepare to receive the peer's video (they turned their camera on). */
  acceptVideo() {
    const ok = this.#engine.enableVideo(true);
    this.#pump();
    return ok;
  }
  /** React in a group call; an empty emoji takes the reaction back. */
  react(emoji) {
    this.#engine.sendGroupReaction(this.#now(), emoji);
    this.#pump();
  }
  /** After the peer answered from a specific device, re-derive the keys we receive with. */
  rekeyRecv(answeringPeerLid) {
    return this.#engine.rekeyRecv(answeringPeerLid);
  }
  /**
   * Move everything that is due: datagrams between the socket and the DTLS/SCTP channel, media messages between
   * the channel and the engine, then arm one timer for whichever of the two wants waking first.
   */
  #pump() {
    if (this.#closed) return;
    for (let guard = 0; guard < 1e3; guard++) {
      let moved = false;
      for (let d = this.#channel.pollTransmit(); d; d = this.#channel.pollTransmit()) {
        this.#sent++;
        this.#socket.send(d, this.#relay.relay_port, this.#relay.relay_ip);
        moved = true;
      }
      if (this.#redial && this.#channel.isOpen()) {
        this.#redial = false;
        this.#engine.relayReconnected(this.#now());
        moved = true;
      }
      if (!this.#started && this.#channel.isOpen()) {
        this.#started = true;
        this.#engine.start(this.#now(), Date.now());
        moved = true;
      }
      for (let m = this.#channel.pollInbound(); m && !this.#redial; m = this.#channel.pollInbound()) {
        this.#engine.handleRelayPacket(this.#now(), m);
        moved = true;
      }
      if (this.#started && !this.#redial) {
        for (; ; ) {
          const kind = this.#engine.pollOutput();
          if (kind === 0) break;
          moved = true;
          if (kind === 7) {
            const target = this.#engine.takeReconnect()?.match(/^(.+):(\d+)$/);
            if (target)
              this.#relay = { ...this.#relay, relay_ip: target[1], relay_port: Number(target[2]) };
            const old = this.#socket;
            this.#channel = new RelayChannel(this.#relay.relay_ip, this.#relay.relay_port);
            this.#socket = this.#openSocket();
            old.close();
            this.#redial = true;
            break;
          }
          if (kind === 1) {
            const pkt = this.#engine.takeTransmit();
            if (pkt) {
              const err = this.#channel.write(this.#now(), pkt);
              if (err) return this.close(`relay: ${err}`);
            }
          } else if (kind === 4) {
            const au = this.#engine.takeVideo();
            if (au) {
              if (this.#recordVideoTo) this.#videoIn.push(au);
              this.emit("video", au);
            }
          } else if (kind === 6 && this.#opus) {
            const pkt = this.#engine.takeEncodedAudio();
            if (pkt) {
              try {
                const who = this.#engine.encodedSender();
                let dec = this.#opus;
                if (who) {
                  const known = this.#decoders.get(who);
                  if (known) dec = known;
                  else {
                    if (this.#decoders.size >= MAX_DECODERS) {
                      const oldest = this.#decoders.keys().next().value;
                      this.#decoders.get(oldest)?.delete();
                      this.#decoders.delete(oldest);
                    }
                    dec = newOpus();
                    this.#decoders.set(who, dec);
                  }
                }
                if (who) this.emit("speaker", who);
                const raw = dec.decode(Buffer.from(pkt));
                this.#heard(new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1).slice());
              } catch {
              }
            }
          } else if (kind === 2) {
            const pcm = this.#engine.takePlayout();
            if (pcm) this.#heard(Int16Array.from(pcm));
          } else if (kind === 3) {
            const name = this.#engine.eventName();
            const code = this.#engine.eventCode();
            this.emit("event", {
              name,
              ...code >= 0 && { code },
              ...name === "Reaction" && { detail: this.#engine.eventDetail() }
            });
            if (name === "MediaConnected" || name === "RelayAllocated") {
              this.emit("connected", void 0);
              this.#startMic();
              this.#startVideo();
            }
            if (name === "RelayAllocateFailed" || name === "RelayAllocateTimedOut" || name === "MediaSetupFailed")
              return this.close(name);
          }
        }
      }
      if (!moved) break;
    }
    const times = [
      this.#channel.pollTimeout(),
      this.#started ? this.#engine.pollTimeout() : -1
    ].filter((t) => t >= 0);
    if (this.#timer) clearTimeout(this.#timer);
    if (times.length && !this.#closed) {
      const due = Math.min(...times);
      this.#timer = setTimeout(
        () => {
          if (this.#closed) return;
          const err = this.#channel.handleTimeout(this.#now());
          if (err) return this.close(`relay: ${err}`);
          if (this.#started) this.#engine.handleTimeout(this.#now());
          this.#pump();
        },
        Math.max(0, due - this.#now())
      );
    }
  }
  #heard(pcm) {
    if (this.#recordTo) this.#recorded.push(pcm);
    this.#local?.play(pcm);
    this.emit("audio", pcm);
  }
  #startMic() {
    if (this.#mic) return;
    if (this.#localAudioOptions && !this.#local)
      this.#local = startLocalAudio(
        this.#localAudioOptions,
        (pcm) => this.feedMic(pcm),
        (what, e) => this.emit("event", { name: `LocalAudioFailed:${what}:${e.message}` })
      );
    this.#mic = setInterval(() => {
      if (this.#closed) return;
      const frame = new Int16Array(FRAME_SAMPLES);
      if (this.#audioIn && !this.#paused) {
        frame.set(this.#audioIn.subarray(this.#audioPos, this.#audioPos + FRAME_SAMPLES));
        this.#audioPos += FRAME_SAMPLES;
        if (this.#audioPos >= this.#audioIn.length) this.#audioIn = void 0;
      }
      applyGain(frame, this.#gain);
      if (this.#opus) {
        const enc2 = this.#opus.encode(Buffer.from(frame.buffer), FRAME_SAMPLES);
        this.#engine.handleEncodedAudio(this.#now(), enc2);
      } else this.#engine.handleMicFrame(this.#now(), frame);
      this.#pump();
    }, FRAME_MS);
  }
  #startVideo() {
    if (this.#videoTimer || !this.#videoOut?.length) return;
    this.#videoTimer = setInterval(
      () => {
        if (this.#closed || !this.#videoOut || this.#paused) return;
        const au = this.#videoOut[this.#videoPos % this.#videoOut.length];
        this.#videoPos++;
        this.#engine.handleVideoFrame(this.#now(), au);
        this.#pump();
      },
      Math.round(1e3 / this.#videoFps)
    );
  }
  /**
   * Live microphone samples (16 kHz mono PCM): sent with the next ticks. At most about half a second is kept, so a
   * capture that runs ahead of the call clock drops its oldest audio instead of falling behind.
   */
  feedMic(pcm) {
    const cap = FRAME_SAMPLES * 8;
    const rest = this.#audioIn ? this.#audioIn.subarray(this.#audioPos) : new Int16Array(0);
    const next = new Int16Array(Math.min(cap, rest.length + pcm.length));
    const all = new Int16Array(rest.length + pcm.length);
    all.set(rest);
    all.set(pcm, rest.length);
    next.set(all.subarray(all.length - next.length));
    this.#audioIn = next;
    this.#audioPos = 0;
  }
  /** Loudness of what this call sends: 0 (silent) to 2 (twice as loud, loud peaks are clipped). Default 1. Takes effect at once, also for audio already queued. */
  setVolume(gain) {
    if (!Number.isFinite(gain) || gain < 0 || gain > 2) throw new Error("volume is a number from 0 to 2");
    this.#gain = gain;
  }
  get volume() {
    return this.#gain;
  }
  /** Hold the audio queue and freeze the picture; `resume()` goes on exactly where it stopped. The call carries silence meanwhile. */
  pause() {
    this.#paused = true;
  }
  resume() {
    this.#paused = false;
  }
  get paused() {
    return this.#paused;
  }
  /** Seconds of queued audio that are still to be played (0 while the call carries only silence). */
  get queuedSeconds() {
    return this.#audioIn ? (this.#audioIn.length - this.#audioPos) / 16e3 : 0;
  }
  /** Drop whatever is still queued: the call carries silence from the next tick on. */
  clearAudio() {
    this.#audioIn = void 0;
    this.#audioPos = 0;
  }
  /** Say something (16 kHz mono PCM); queued after whatever is still playing. */
  speak(pcm) {
    const rest = this.#audioIn ? this.#audioIn.subarray(this.#audioPos) : new Int16Array(0);
    const next = new Int16Array(rest.length + pcm.length);
    next.set(rest);
    next.set(pcm, rest.length);
    this.#audioIn = next;
    this.#audioPos = 0;
  }
  close(reason = "closed") {
    if (this.#closed) return;
    this.#closed = true;
    if (this.#recordTo && this.#recorded.length) {
      const all = new Int16Array(this.#recorded.reduce((n, c) => n + c.length, 0));
      let at = 0;
      for (const c of this.#recorded) {
        all.set(c, at);
        at += c.length;
      }
      writeWav(this.#recordTo, all);
    }
    if (this.#videoTimer) clearInterval(this.#videoTimer);
    if (this.#recordVideoTo && this.#videoIn.length)
      (0, import_node_fs4.writeFileSync)(this.#recordVideoTo, Buffer.concat(this.#videoIn));
    for (const d of this.#decoders.values()) d.delete();
    this.#opus?.delete();
    if (this.#timer) clearTimeout(this.#timer);
    this.#local?.stop();
    if (this.#mic) clearInterval(this.#mic);
    try {
      this.#channel.close(this.#now());
    } catch {
    }
    try {
      this.#socket.close();
    } catch {
    }
    this.emit("closed", { reason });
  }
};

// src/client/features/call/media-files.ts
var MAX_BYTES = 512 * 1024 * 1024;
function ffmpeg(args, limit) {
  return new Promise((res, rej) => {
    const p = (0, import_node_child_process2.spawn)("ffmpeg", ["-v", "error", "-nostdin", ...args], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    const out = [];
    let size = 0;
    let err = "";
    p.stdout.on("data", (b) => {
      size += b.length;
      if (size > limit) {
        p.kill("SIGKILL");
        return rej(new Error("the media file decodes to more than the allowed size"));
      }
      out.push(b);
    });
    p.stderr.on("data", (b) => {
      if (err.length < 2e3) err += b.toString();
    });
    p.on("error", (e) => rej(new Error(`ffmpeg could not be started: ${e.message}`)));
    p.on(
      "close",
      (code) => code === 0 ? res(Buffer.concat(out)) : rej(new Error(`ffmpeg failed: ${err.trim() || code}`))
    );
  });
}
var input = (path) => ["-i", (0, import_node_path2.resolve)(path)];
async function decodeAudioFile(path, o = {}) {
  const seconds2 = Math.max(1, Math.min(o.maxSeconds ?? 600, 3600));
  const raw = await ffmpeg(
    [...input(path), "-vn", "-t", String(seconds2), "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
    16e3 * 2 * seconds2 + 4096
  );
  if (!raw.length) throw new Error(`${path} has no audio`);
  const even = raw.length - raw.length % 2;
  const copy = Buffer.from(raw.subarray(0, even));
  return new Int16Array(copy.buffer, copy.byteOffset, even >> 1);
}
async function decodeVideoFile(path, o = {}) {
  const seconds2 = Math.max(1, Math.min(o.maxSeconds ?? 600, 3600));
  const fps = Math.max(5, Math.min(Math.round(o.fps ?? 15), 30));
  const width = Math.max(64, Math.min(Math.round(o.width ?? 480), 1280));
  const raw = await ffmpeg(
    [
      ...input(path),
      "-an",
      "-t",
      String(seconds2),
      "-vf",
      `fps=${fps},scale=${width}:-2`,
      "-pix_fmt",
      "yuv420p",
      "-c:v",
      "libx264",
      "-profile:v",
      "baseline",
      "-preset",
      "veryfast",
      "-g",
      String(fps * 2),
      "-x264-params",
      "aud=1:repeat-headers=1",
      "-f",
      "h264",
      "-"
    ],
    MAX_BYTES
  );
  if (!raw.length) throw new Error(`${path} has no video`);
  return { frames: splitAnnexB(raw), fps };
}
async function resolveCallFiles(o) {
  if (!o.audioFile && !o.videoFile) return o;
  const next = { ...o };
  if (o.videoFile) {
    const v = await decodeVideoFile(o.videoFile, o.fileOptions);
    next.videoFrames = v.frames;
    next.videoFps = v.fps;
  }
  const sound = o.audioFile ?? o.videoFile;
  if (sound && !o.audioIn) {
    try {
      next.audioIn = await decodeAudioFile(sound, o.fileOptions);
    } catch (e) {
      if (o.audioFile) throw e;
    }
  }
  return next;
}

// src/client/client.ts
var import_node_crypto20 = require("crypto");
var import_node_path11 = require("path");

// src/auth/creds.ts
var import_node_crypto = require("crypto");
var import_node_fs5 = require("fs");
var import_node_path3 = require("path");
function initAuthCreds() {
  const signedIdentityKey = newIdentityKeyPair();
  const spk = newSignedPreKey(signedIdentityKey.privateKey, 1);
  return {
    noiseKey: newIdentityKeyPair(),
    signedIdentityKey,
    signedPreKey: {
      keyId: spk.id,
      record: spk.record,
      publicKey: spk.publicKey,
      signature: spk.signature
    },
    signedPreKeyAt: Date.now(),
    registrationId: (0, import_node_crypto.randomInt)(1, 16380),
    advSecretKey: (0, import_node_crypto.randomBytes)(32).toString("base64"),
    nextPreKeyId: 1,
    pairingEphemeralKey: newIdentityKeyPair()
  };
}
var BYTES = "$bytes";
var isBufferJson = (v) => typeof v === "object" && v !== null && v.type === "Buffer" && Array.isArray(v.data);
function replacer(_k, v) {
  if (v instanceof Uint8Array) return { [BYTES]: Buffer.from(v).toString("base64") };
  if (isBufferJson(v)) return { [BYTES]: Buffer.from(v.data).toString("base64") };
  return v;
}
function reviver(_k, v) {
  if (v && typeof v === "object" && BYTES in v)
    return new Uint8Array(Buffer.from(v[BYTES], "base64"));
  if (isBufferJson(v)) return new Uint8Array(v.data);
  return v;
}
function saveAuthCreds(path, creds) {
  (0, import_node_fs5.mkdirSync)((0, import_node_path3.dirname)(path), { recursive: true, mode: 448 });
  (0, import_node_fs5.writeFileSync)(path, JSON.stringify(creds, replacer, 2), { mode: 384 });
  (0, import_node_fs5.chmodSync)(path, 384);
}
function loadAuthCreds(path) {
  if (!(0, import_node_fs5.existsSync)(path)) return void 0;
  const creds = JSON.parse((0, import_node_fs5.readFileSync)(path, "utf8"), reviver);
  creds.nextPreKeyId ??= 1;
  creds.pairingEphemeralKey ??= newIdentityKeyPair();
  return creds;
}

// src/auth/file-signal-storage.ts
var import_node_fs6 = require("fs");
var import_node_path4 = require("path");
var FileSignalStorage = class {
  constructor(dir, identity, registrationId) {
    this.dir = dir;
    this.identity = identity;
    this.registrationId = registrationId;
    for (const sub of ["sessions", "identities", "prekeys", "signed-prekeys", "sender-keys"])
      (0, import_node_fs6.mkdirSync)((0, import_node_path4.join)(dir, sub), { recursive: true, mode: 448 });
  }
  dir;
  identity;
  registrationId;
  #path(kind, id) {
    return (0, import_node_path4.join)(this.dir, kind, encodeURIComponent(id));
  }
  #read(kind, id) {
    try {
      return new Uint8Array((0, import_node_fs6.readFileSync)(this.#path(kind, id)));
    } catch (e) {
      if (e.code === "ENOENT") return void 0;
      throw e;
    }
  }
  #write(kind, id, data) {
    const target = this.#path(kind, id);
    const tmp = `${target}.tmp`;
    (0, import_node_fs6.writeFileSync)(tmp, data, { mode: 384 });
    const fd = (0, import_node_fs6.openSync)(tmp, "r");
    try {
      (0, import_node_fs6.fsyncSync)(fd);
    } finally {
      (0, import_node_fs6.closeSync)(fd);
    }
    (0, import_node_fs6.renameSync)(tmp, target);
  }
  getIdentityKeyPair() {
    return Promise.resolve(this.identity);
  }
  getLocalRegistrationId() {
    return Promise.resolve(this.registrationId);
  }
  loadIdentity(name, device) {
    return Promise.resolve(this.#read("identities", `${name}.${device}`));
  }
  saveIdentity(name, device, key) {
    this.#write("identities", `${name}.${device}`, key);
    return Promise.resolve();
  }
  loadSession(name, device) {
    return Promise.resolve(this.#read("sessions", `${name}.${device}`));
  }
  storeSession(name, device, record) {
    this.#write("sessions", `${name}.${device}`, record);
    return Promise.resolve();
  }
  loadPreKey(id) {
    return Promise.resolve(this.#read("prekeys", String(id)));
  }
  storePreKey(id, record) {
    this.#write("prekeys", String(id), record);
    return Promise.resolve();
  }
  removePreKey(id) {
    (0, import_node_fs6.rmSync)(this.#path("prekeys", String(id)), { force: true });
    return Promise.resolve();
  }
  loadSignedPreKey(id) {
    return Promise.resolve(this.#read("signed-prekeys", String(id)));
  }
  storeSignedPreKey(id, record) {
    this.#write("signed-prekeys", String(id), record);
    return Promise.resolve();
  }
  /** Destroy a rotated-out signed pre-key (its private key must not outlive the time messages can still use it). */
  removeSignedPreKey(id) {
    (0, import_node_fs6.rmSync)(this.#path("signed-prekeys", String(id)), { force: true });
    return Promise.resolve();
  }
  loadSenderKey(key) {
    return Promise.resolve(this.#read("sender-keys", key));
  }
  storeSenderKey(key, record) {
    this.#write("sender-keys", key, record);
    return Promise.resolve();
  }
};

// src/logging/protocol-logger.ts
var import_node_fs9 = require("fs");
var import_node_path6 = require("path");

// src/logging/storage.ts
var import_node_fs7 = require("fs");
var import_node_fs8 = require("fs");
var import_node_path5 = require("path");
var import_promises3 = require("stream/promises");
var import_node_zlib = require("zlib");
var DAY = /^\d{4}-\d{2}-\d{2}$/;
var LEGACY = /^(.+)-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/;
var KEEP_FILE = ".keep";
var SESSION_FILE = "session.json";
function dirBytes(path) {
  let total = 0;
  for (const f of (0, import_node_fs8.readdirSync)(path, { withFileTypes: true })) {
    if (f.isFile()) total += (0, import_node_fs8.lstatSync)((0, import_node_path5.join)(path, f.name)).size;
  }
  return total;
}
function readMeta(path) {
  try {
    return JSON.parse((0, import_node_fs8.readFileSync)((0, import_node_path5.join)(path, SESSION_FILE), "utf8"));
  } catch {
    return void 0;
  }
}
function describe(path, name) {
  const files = (0, import_node_fs8.readdirSync)(path);
  const meta = readMeta(path);
  const legacy = LEGACY.exec(name.split("/").pop());
  if (!meta && !(legacy && files.some((f) => f.startsWith("events.jsonl")))) return void 0;
  const started = typeof meta?.["startedAt"] === "string" ? new Date(meta["startedAt"]) : /* @__PURE__ */ new Date(`${legacy[2]}T${legacy[3]}:${legacy[4]}:${legacy[5]}.${legacy[6]}Z`);
  if (Number.isNaN(started.getTime())) return void 0;
  return {
    path,
    name,
    label: typeof meta?.["label"] === "string" ? meta["label"] : legacy?.[1] ?? name.split("-").slice(1).join("-"),
    startedAt: started,
    ...typeof meta?.["endedAt"] === "string" && { endedAt: new Date(meta["endedAt"]) },
    ...typeof meta?.["reason"] === "string" && { reason: meta["reason"] },
    bytes: dirBytes(path),
    pinned: files.includes(KEEP_FILE),
    compressed: files.some((f) => f.endsWith(".gz"))
  };
}
function listSessions(dir) {
  const out = [];
  let entries;
  try {
    entries = (0, import_node_fs8.readdirSync)(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const path = (0, import_node_path5.join)(dir, e.name);
    if (DAY.test(e.name)) {
      for (const s of (0, import_node_fs8.readdirSync)(path, { withFileTypes: true })) {
        if (!s.isDirectory()) continue;
        const info = describe((0, import_node_path5.join)(path, s.name), `${e.name}/${s.name}`);
        if (info) out.push(info);
      }
    } else {
      const info = describe(path, e.name);
      if (info) out.push(info);
    }
  }
  return out.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
}
function dayAndTime(at) {
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return {
    day: `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}`,
    time: `${p(at.getHours())}-${p(at.getMinutes())}-${p(at.getSeconds())}`
  };
}
function migrateFlatSessions(dir) {
  let moved = 0;
  for (const s of listSessions(dir)) {
    if (s.name.includes("/")) continue;
    const { day, time } = dayAndTime(s.startedAt);
    const target = (0, import_node_path5.join)(dir, day, `${time}-${s.label}`);
    try {
      (0, import_node_fs8.mkdirSync)((0, import_node_path5.join)(dir, day), { recursive: true, mode: 448 });
      (0, import_node_fs8.renameSync)(s.path, target);
      if (!readMeta(target)) {
        const newest = Math.max(
          ...(0, import_node_fs8.readdirSync)(target).map((f) => (0, import_node_fs8.lstatSync)((0, import_node_path5.join)(target, f)).mtimeMs)
        );
        (0, import_node_fs8.writeFileSync)(
          (0, import_node_path5.join)(target, SESSION_FILE),
          JSON.stringify(
            {
              version: 1,
              label: s.label,
              startedAt: s.startedAt.toISOString(),
              endedAt: new Date(newest).toISOString(),
              migrated: true
            },
            null,
            2
          ) + "\n",
          { mode: 384 }
        );
      }
      moved++;
    } catch {
    }
  }
  return moved;
}
async function compressSession(path) {
  let saved = 0;
  for (const f of (0, import_node_fs8.readdirSync)(path)) {
    if (f.endsWith(".gz") || f === SESSION_FILE || f === KEEP_FILE) continue;
    if (!/\.(jsonl|log)$/.test(f)) continue;
    const from = (0, import_node_path5.join)(path, f);
    const before = (0, import_node_fs8.lstatSync)(from).size;
    if (before < 4096) continue;
    const to = `${from}.gz`;
    try {
      await (0, import_promises3.pipeline)(
        (0, import_node_fs7.createReadStream)(from),
        (0, import_node_zlib.createGzip)({ level: 9 }),
        (0, import_node_fs7.createWriteStream)(to, { mode: 384 })
      );
      saved += before - (0, import_node_fs8.lstatSync)(to).size;
      (0, import_node_fs8.unlinkSync)(from);
    } catch {
      try {
        (0, import_node_fs8.unlinkSync)(to);
      } catch {
      }
    }
  }
  if (saved > 0) {
    const meta = readMeta(path);
    if (meta) {
      try {
        (0, import_node_fs8.writeFileSync)(
          (0, import_node_path5.join)(path, SESSION_FILE),
          JSON.stringify({ ...meta, compressed: true }, null, 2) + "\n"
        );
      } catch {
      }
    }
  }
  return saved;
}
function pruneSessions(dir, retention = {}, keep = []) {
  const maxAge = (retention.maxAgeDays ?? 30) * 864e5;
  const maxBytes = (retention.maxTotalMB ?? 1024) * 1024 * 1024;
  const maxSessions = retention.maxSessions ?? 0;
  const all = listSessions(dir);
  const removable = (s) => !s.pinned && !keep.includes(s.path);
  const gone = [];
  const remove = (s) => {
    try {
      (0, import_node_fs8.rmSync)(s.path, { recursive: true, force: true });
      gone.push(s);
    } catch {
    }
  };
  const now = Date.now();
  let rest = all;
  if (maxAge > 0)
    rest = rest.filter((s) => {
      if (!removable(s) || now - s.startedAt.getTime() <= maxAge) return true;
      remove(s);
      return false;
    });
  if (maxSessions > 0) {
    for (const s of [...rest]) {
      if (rest.length <= maxSessions) break;
      if (!removable(s)) continue;
      remove(s);
      rest = rest.filter((r) => r !== s);
    }
  }
  if (maxBytes > 0) {
    let total = rest.reduce((n, s) => n + s.bytes, 0);
    for (const s of rest) {
      if (total <= maxBytes) break;
      if (!removable(s)) continue;
      remove(s);
      total -= s.bytes;
    }
  }
  try {
    for (const e of (0, import_node_fs8.readdirSync)(dir, { withFileTypes: true }))
      if (e.isDirectory() && DAY.test(e.name)) {
        try {
          (0, import_node_fs8.rmdirSync)((0, import_node_path5.join)(dir, e.name));
        } catch {
        }
      }
  } catch {
  }
  return gone;
}
async function housekeeping(dir, o = {}) {
  const keep = o.current ? [o.current] : [];
  let compressed = 0;
  const hours = o.compressAfterHours ?? 24;
  if (hours > 0) {
    for (const s of listSessions(dir)) {
      if (s.compressed || keep.includes(s.path)) continue;
      if (Date.now() - s.startedAt.getTime() < hours * 36e5) continue;
      const meta = readMeta(s.path);
      if (meta && meta["endedAt"] === void 0 && Date.now() - s.startedAt.getTime() < 7 * 864e5)
        continue;
      if (await compressSession(s.path) > 0) compressed++;
    }
  }
  const removed = o.retention === false ? 0 : pruneSessions(dir, o.retention ?? {}, keep).length;
  return { compressed, removed };
}

// src/logging/protocol-logger.ts
var ProtocolLogger = class {
  enabled;
  sessionDir;
  #baseDir;
  #label;
  #rotateBytes;
  #startedAt = /* @__PURE__ */ new Date();
  #files = /* @__PURE__ */ new Map();
  #totals = /* @__PURE__ */ new Map();
  #seq = 0;
  #closed = false;
  constructor(options = {}) {
    this.enabled = options.enabled ?? true;
    this.#baseDir = options.dir ?? "logs";
    this.#label = (options.label ?? "session").replace(/[^A-Za-z0-9._-]/g, "_");
    this.#rotateBytes = (options.rotateMB ?? 32) * 1024 * 1024;
    if (!this.enabled) return;
    const { day, time } = dayAndTime(this.#startedAt);
    this.sessionDir = (0, import_node_path6.join)(this.#baseDir, day, `${time}-${this.#label}`);
    (0, import_node_fs9.mkdirSync)(this.sessionDir, { recursive: true, mode: 448 });
    this.#writeSession();
    if (options.keep) this.#tryWrite((0, import_node_path6.join)(this.sessionDir, KEEP_FILE), "");
    this.#linkLatest();
    this.event("logger.start", { pid: process.pid, node: process.version, argv: process.argv });
    const dir = this.#baseDir;
    const current = this.sessionDir;
    setImmediate(() => {
      housekeeping(dir, {
        retention: options.retention ?? {},
        compressAfterHours: options.compressAfterHours ?? 24,
        current
      }).catch(() => void 0);
    }).unref();
  }
  /** What `session.json` says about this run so far. */
  #writeSession(end) {
    if (!this.sessionDir) return;
    const files = {};
    for (const [name, t] of this.#totals) files[name] = t;
    this.#tryWrite(
      (0, import_node_path6.join)(this.sessionDir, SESSION_FILE),
      JSON.stringify(
        {
          version: 1,
          label: this.#label,
          startedAt: this.#startedAt.toISOString(),
          ...end && { endedAt: (/* @__PURE__ */ new Date()).toISOString(), reason: end.reason },
          pid: process.pid,
          node: process.version,
          argv: process.argv,
          files
        },
        jsonReplacer,
        2
      ) + "\n"
    );
  }
  /** `<dir>/latest` and `<dir>/latest-<label>` point at this run (best effort: not every system allows links). */
  #linkLatest() {
    if (!this.sessionDir) return;
    for (const name of ["latest", `latest-${this.#label}`]) {
      const link = (0, import_node_path6.join)(this.#baseDir, name);
      const tmp = `${link}.${process.pid}.tmp`;
      try {
        (0, import_node_fs9.symlinkSync)((0, import_node_path6.relative)(this.#baseDir, this.sessionDir), tmp, "dir");
        (0, import_node_fs9.renameSync)(tmp, link);
      } catch {
        try {
          (0, import_node_fs9.unlinkSync)(tmp);
        } catch {
        }
      }
    }
  }
  #tryWrite(path, data) {
    try {
      (0, import_node_fs9.writeFileSync)(path, data, { mode: 384 });
    } catch {
    }
  }
  /** Free-form protocol/lifecycle event. */
  event(kind, data) {
    this.#write("events.jsonl", { kind, data });
  }
  /** Raw bytes on the wire (WebSocket message payload). */
  frame(direction, bytes2, note) {
    if (!this.enabled) return;
    const entry2 = { direction, length: bytes2.length, hex: Buffer.from(bytes2).toString("hex"), note };
    this.#write("frames.jsonl", entry2);
    this.#write("events.jsonl", {
      kind: `frame.${direction}`,
      data: { length: bytes2.length, note }
    });
  }
  /** A decoded stanza. */
  node(direction, node) {
    if (!this.enabled) return;
    this.#write("nodes.jsonl", { direction, node: toJson(node) });
    this.#append(
      "nodes.xml.log",
      `${(/* @__PURE__ */ new Date()).toISOString()} ${direction === "send" ? ">>" : "<<"}
${toXml(node)}

`
    );
    this.#write("events.jsonl", {
      kind: `node.${direction}`,
      data: { tag: node.tag, attrs: node.attrs }
    });
  }
  /** HTTP exchange. */
  http(entry2) {
    this.#write("http.jsonl", entry2);
    this.#write("events.jsonl", {
      kind: "http",
      data: { method: entry2.method, url: entry2.url, status: entry2.status }
    });
  }
  /** Final entry; call on disconnect / server stop. Idempotent. */
  close(reason, detail) {
    if (!this.enabled || this.#closed) return;
    this.event("logger.end", { reason, detail });
    this.#closed = true;
    this.#writeSession({ reason, detail });
    for (const f of this.#files.values()) {
      try {
        (0, import_node_fs9.closeSync)(f.fd);
      } catch {
      }
    }
    this.#files.clear();
  }
  #write(file, entry2) {
    if (!this.enabled) return;
    this.#append(
      file,
      JSON.stringify({ seq: this.#seq++, t: (/* @__PURE__ */ new Date()).toISOString(), ...entry2 }, jsonReplacer) + "\n"
    );
  }
  #append(file, line) {
    if (!this.enabled || !this.sessionDir) return;
    try {
      const data = Buffer.from(line);
      let f = this.#files.get(file);
      if (f && this.#rotateBytes > 0 && f.bytes > 0 && f.bytes + data.length > this.#rotateBytes) {
        (0, import_node_fs9.closeSync)(f.fd);
        f.part++;
        const dot = file.lastIndexOf(".");
        const part = `${file.slice(0, dot)}.${String(f.part).padStart(4, "0")}${file.slice(dot)}`;
        (0, import_node_fs9.renameSync)((0, import_node_path6.join)(this.sessionDir, file), (0, import_node_path6.join)(this.sessionDir, part));
        f = {
          fd: (0, import_node_fs9.openSync)((0, import_node_path6.join)(this.sessionDir, file), "a", 384),
          bytes: 0,
          lines: 0,
          part: f.part
        };
        this.#files.set(file, f);
      }
      if (!f) {
        f = { fd: (0, import_node_fs9.openSync)((0, import_node_path6.join)(this.sessionDir, file), "a", 384), bytes: 0, lines: 0, part: 0 };
        this.#files.set(file, f);
      }
      (0, import_node_fs9.writeSync)(f.fd, data);
      f.bytes += data.length;
      f.lines++;
      const t = this.#totals.get(file) ?? { bytes: 0, lines: 0 };
      t.bytes += data.length;
      t.lines++;
      this.#totals.set(file, t);
    } catch {
    }
  }
};
function jsonReplacer(_key, value) {
  if (value instanceof Uint8Array) return { $bytes: Buffer.from(value).toString("hex") };
  if (value instanceof Error)
    return { name: value.name, message: value.message, stack: value.stack };
  if (typeof value === "bigint") return value.toString();
  return value;
}
function toJson(node) {
  const content = node.content;
  return {
    tag: node.tag,
    attrs: node.attrs,
    content: content === void 0 ? void 0 : typeof content === "string" ? content : content instanceof Uint8Array ? { $bytes: Buffer.from(content).toString("hex"), utf8: printable(content) } : content.map(toJson)
  };
}
function printable(bytes2) {
  const s = Buffer.from(bytes2).toString("utf8");
  return /^[\x20-\x7e\n\r\t]*$/.test(s) ? s : void 0;
}
function toXml(node, indent = "") {
  const tag = escapeXml(node.tag);
  const attrs = Object.entries(node.attrs).map(([k, v]) => ` ${escapeXml(k)}="${escapeXml(v)}"`).join("");
  const c = node.content;
  if (c === void 0) return `${indent}<${tag}${attrs}/>`;
  if (typeof c === "string") return `${indent}<${tag}${attrs}>${escapeXml(c)}</${tag}>`;
  if (c instanceof Uint8Array) {
    const text4 = printable(c);
    return `${indent}<${tag}${attrs}>${text4 !== void 0 && text4.length > 0 ? escapeXml(text4) : `{${c.length} bytes: ${Buffer.from(c).toString("hex")}}`}</${tag}>`;
  }
  return `${indent}<${tag}${attrs}>
${c.map((n) => toXml(n, indent + "  ")).join("\n")}
${indent}</${tag}>`;
}
function escapeXml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, (c) => `&#x${c.charCodeAt(0).toString(16)};`).replace(/\n/g, "&#xa;");
}

// src/client/connection.ts
var import_ws = __toESM(require("ws"), 1);
var WA_WS_URL = "wss://web.whatsapp.com/ws/chat";
var WA_ORIGIN = "https://web.whatsapp.com";
var USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
async function loggedFetch(logger, url, headers = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT, "sec-fetch-site": "none", ...headers }
    });
    const body = await res.text();
    logger.http({
      method: "GET",
      url,
      requestHeaders: { "user-agent": USER_AGENT, "sec-fetch-site": "none", ...headers },
      status: res.status,
      responseHeaders: Object.fromEntries(res.headers.entries()),
      body,
      ms: Date.now() - started
    });
    return { status: res.status, body };
  } catch (error) {
    logger.http({ method: "GET", url, error, ms: Date.now() - started });
    throw error;
  }
}
var Connection = class {
  constructor(logger, creds, clientPayload, events, url = WA_WS_URL, userAgent = USER_AGENT) {
    this.logger = logger;
    this.creds = creds;
    this.clientPayload = clientPayload;
    this.events = events;
    this.url = url;
    this.userAgent = userAgent;
    ensureWasm();
    this.#decoder = new FrameDecoder();
  }
  logger;
  creds;
  clientPayload;
  events;
  url;
  userAgent;
  #ws;
  #state = "idle";
  #hs;
  #transport;
  #decoder;
  #firstFrameSent = false;
  get state() {
    return this.#state;
  }
  connect() {
    const headers = { Origin: WA_ORIGIN, "User-Agent": this.userAgent };
    this.logger.event("ws.connect", { url: this.url, headers });
    const ws = new import_ws.default(this.url, { headers, handshakeTimeout: 2e4 });
    this.#ws = ws;
    this.#state = "handshake";
    ws.on(
      "upgrade",
      (res) => this.logger.event("ws.upgrade", {
        status: res.statusCode,
        statusMessage: res.statusMessage,
        headers: res.headers
      })
    );
    ws.on("unexpected-response", (_req, res) => {
      this.logger.event("ws.unexpected-response", { status: res.statusCode, headers: res.headers });
    });
    ws.on("ping", (d) => this.logger.event("ws.ping", { hex: d.toString("hex") }));
    ws.on("pong", (d) => this.logger.event("ws.pong", { hex: d.toString("hex") }));
    ws.on("error", (error) => {
      this.logger.event("ws.error", error);
      this.#finish("error", void 0, error);
    });
    ws.on("close", (code, reason) => this.#finish(reason.toString() || "closed", code));
    ws.on("open", () => {
      this.logger.event("ws.open");
      try {
        this.#hs = startXxHandshake(
          this.creds.noiseKey.privateKey,
          this.creds.noiseKey.publicKey,
          this.clientPayload
        );
        const hello = this.#hs.buildClientHello();
        this.logger.event("noise.client-hello", { length: hello.length });
        this.#sendRaw(encodeFrame(hello, connHeader()), "client-hello (with conn header)");
        this.#firstFrameSent = true;
      } catch (error) {
        this.logger.event("noise.error", error);
        this.#finish("handshake-start-failed", void 0, error);
      }
    });
    ws.on("message", (data) => {
      const bytes2 = new Uint8Array(Buffer.isBuffer(data) ? data : Buffer.concat(data));
      this.logger.frame("recv", bytes2);
      this.#decoder.feed(bytes2);
      try {
        for (let frame = this.#decoder.nextFrame(); frame; frame = this.#decoder.nextFrame())
          this.#onFrame(frame);
      } catch (error) {
        this.logger.event("frame.error", error);
        this.#finish("protocol-error", void 0, error);
      }
    });
  }
  #onFrame(frame) {
    if (this.#state === "handshake") {
      const hs = this.#hs;
      const finish = hs.readServerHelloAndBuildClientFinish(frame);
      this.logger.event("noise.server-hello-verified", { clientFinishLength: finish.length });
      this.#sendRaw(encodeFrame(finish, void 0), "client-finish");
      this.#transport = hs.finish();
      this.#hs = void 0;
      this.#state = "open";
      this.logger.event("noise.handshake-complete");
      this.events.onOpen();
      return;
    }
    const plain = this.#transport.decrypt(frame);
    this.logger.frame("recv", plain, "decrypted stanza (WABinary payload)");
    const node = decodeNode2(plain);
    this.logger.node("recv", node);
    this.events.onNode(node);
  }
  /** Encrypt and send a stanza. */
  send(node) {
    if (this.#state !== "open") throw new Error(`cannot send in state ${this.#state}`);
    this.logger.node("send", node);
    const plain = encodeNode2(node);
    this.logger.frame("send", plain, "plaintext stanza before encryption (WABinary payload)");
    const cipher = this.#transport.encrypt(plain);
    this.#sendRaw(encodeFrame(cipher, void 0), `stanza <${node.tag}>`);
  }
  close(reason = "client-close") {
    this.logger.event("ws.close-requested", { reason });
    this.#ws?.close(1e3, reason);
  }
  #sendRaw(bytes2, note) {
    this.logger.frame("send", bytes2, note);
    this.#ws?.send(bytes2);
  }
  #finish(reason, code, error) {
    if (this.#state === "closed") return;
    this.#state = "closed";
    this.logger.event("connection.closed", {
      reason,
      code,
      error,
      firstFrameSent: this.#firstFrameSent
    });
    this.events.onClose({
      ...code !== void 0 && { code },
      reason,
      ...error !== void 0 && { error }
    });
  }
};

// src/client/guest.ts
var import_node_child_process3 = require("child_process");
var import_node_crypto3 = require("crypto");

// src/client/fingerprint.ts
var import_node_crypto2 = require("crypto");
var OS_VARIANTS = [
  { osName: "Linux", osVersion: "x86_64", uaPlatform: "X11; Linux x86_64" },
  { osName: "Linux", osVersion: "i686", uaPlatform: "X11; Linux i686" },
  { osName: "Windows", osVersion: "10.0", uaPlatform: "Windows NT 10.0; Win64; x64" },
  { osName: "Windows", osVersion: "6.1", uaPlatform: "Windows NT 6.1; Win64; x64" },
  { osName: "Mac OS X", osVersion: "10.15.7", uaPlatform: "Macintosh; Intel Mac OS X 10_15_7" },
  { osName: "Mac OS X", osVersion: "11.6.0", uaPlatform: "Macintosh; Intel Mac OS X 11_6_0" },
  { osName: "Mac OS X", osVersion: "12.6.0", uaPlatform: "Macintosh; Intel Mac OS X 12_6_0" },
  { osName: "Mac OS X", osVersion: "13.4.0", uaPlatform: "Macintosh; Intel Mac OS X 13_4_0" }
];
var CHROME_MAJORS = Array.from({ length: 60 }, (_, i) => 100 + i);
var POOL = OS_VARIANTS.flatMap(
  (os) => CHROME_MAJORS.map((major) => {
    const browserVersion = `${major}.0.0.0`;
    return {
      osName: os.osName,
      osVersion: os.osVersion,
      browser: "Chrome",
      browserVersion,
      userAgent: `Mozilla/5.0 (${os.uaPlatform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`
    };
  })
);
if (POOL.length < 250) throw new Error(`fingerprint pool has only ${POOL.length} entries, need >= 250`);
function randomFingerprint() {
  return POOL[(0, import_node_crypto2.randomInt)(POOL.length)];
}

// src/client/guest.ts
var GUEST_REG_URL = "https://v.whatsapp.net/v2/guest_reg";
var be = (n, len) => {
  const b = Buffer.alloc(len);
  b.writeUIntBE(n, 0, len);
  return b;
};
var b64url = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
var percentEncodeBytes = (b) => {
  let out = "";
  for (const byte of b) {
    const ch = String.fromCharCode(byte);
    out += /[A-Za-z0-9\-_.~]/.test(ch) ? ch : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return out;
};
function newGuestSession() {
  return {
    accessSessionId: (0, import_node_crypto3.randomUUID)(),
    expid: (0, import_node_crypto3.randomBytes)(16).toString("base64url"),
    fingerprint: randomFingerprint()
  };
}
async function guestReg(creds, config, o) {
  const [lc, lg] = o.locale ?? ["DE", "DE"];
  const fp = o.fingerprint ?? randomFingerprint();
  const idBytes = (0, import_node_crypto3.randomBytes)(20);
  const q = (k, v) => `${k}=${encodeURIComponent(v)}`;
  const query = [
    q("mcc", "310"),
    q("mnc", "999"),
    q("lc", lc),
    q("lg", lg),
    q("tos_version", "1"),
    q("device_id", (0, import_node_crypto3.randomUUID)()),
    q("access_session_id", o.accessSessionId ?? (0, import_node_crypto3.randomUUID)()),
    q("authkey", b64url(creds.noiseKey.publicKey)),
    q("e_regid", b64url(be(creds.registrationId, 4))),
    q("e_keytype", b64url(Buffer.from([5]))),
    q("e_ident", b64url(creds.signedIdentityKey.publicKey)),
    q("e_skey_id", b64url(be(creds.signedPreKey.keyId, 3))),
    q("e_skey_val", b64url(creds.signedPreKey.publicKey)),
    q("e_skey_sig", b64url(creds.signedPreKey.signature)),
    q("os_name", fp.osName),
    q("os_version", fp.osVersion),
    q("browser", fp.browser),
    q("browser_version", fp.browserVersion),
    q("web_build_version", `2.${config.version[1]}.${config.version[2]}`),
    q("guest_type", "guest_calling"),
    q("invite_code", o.inviteCode),
    q("guest_name", o.guestName),
    `id=${percentEncodeBytes(idBytes)}`,
    `backup_token=${percentEncodeBytes(idBytes)}`
  ].join("&");
  const url = `${GUEST_REG_URL}?${query}`;
  const headers = {
    "user-agent": fp.userAgent,
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
    "accept-encoding": "gzip, deflate, br",
    "sec-fetch-site": "same-site",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    origin: "https://web.whatsapp.com",
    referer: "https://web.whatsapp.com/"
  };
  const { status, body } = await fetchWithCurlFallback(url, headers, o.fetch);
  if (status !== 200) return { status, body };
  try {
    const parsed = JSON.parse(body);
    if (parsed.status === "ok") {
      return {
        status,
        body,
        ...parsed.lid && { lid: parsed.lid },
        ...parsed.ent_access_token && { entAccessToken: parsed.ent_access_token },
        ...parsed.ent_canonical_fbid && { entCanonicalFbid: parsed.ent_canonical_fbid }
      };
    }
  } catch {
  }
  return { status, body };
}
async function guestPreFlightLog(event, session, config, fetchOverride) {
  const action = {
    guest_calling_join_clicked: "click",
    guest_calling_join_success: "continue",
    guest_calling_waiting_room_entered: "view"
  }[event];
  const clientMetrics = JSON.stringify({
    inviteCode: null,
    appVersion: `2.${config.version[1]}.${config.version[2]}`,
    guestExperienceType: "guest_calling",
    join_attempt: 1
  });
  const q = (k, v) => `${k}=${encodeURIComponent(v)}`;
  const query = [
    q("expid", session.expid),
    q("access_session_id", session.accessSessionId),
    q("current_screen", "guest_calling_landing"),
    q("previous_screen", ""),
    q("action_taken", action),
    q("event_name", event),
    q("access_funnel_type", "guest"),
    q("os_name", session.fingerprint.osName),
    q("os_version", session.fingerprint.osVersion),
    q("browser", session.fingerprint.browser),
    q("browser_version", session.fingerprint.browserVersion),
    q("client_metrics", clientMetrics)
  ].join("&");
  try {
    await (fetchOverride ?? fetch)(`https://v.whatsapp.net/v2/pre_pn_client_log?${query}`, {
      headers: { "user-agent": session.fingerprint.userAgent }
    });
  } catch {
  }
}
async function fetchWithCurlFallback(url, headers, overrideFetch) {
  const viaFetch = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8e3);
    try {
      const res = await (overrideFetch ?? fetch)(url, { headers, signal: controller.signal });
      return { status: res.status, body: await res.text() };
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    return await viaFetch();
  } catch (error) {
    if (overrideFetch) throw error;
    try {
      return await curlGet(url, headers);
    } catch {
      throw error;
    }
  }
}
function curlGet(url, headers) {
  return new Promise((resolve2, reject) => {
    const headerArgs = Object.entries(headers).flatMap(([k, v]) => ["-H", `${k}: ${v}`]);
    (0, import_node_child_process3.execFile)(
      "curl",
      ["-sS", "-o", "-", "-w", "\n__STATUS__%{http_code}", "--max-time", "20", ...headerArgs, url],
      { maxBuffer: 10 * 1024 * 1024 },
      (error, stdout) => {
        if (error) return reject(error);
        const marker = stdout.lastIndexOf("\n__STATUS__");
        if (marker < 0) return reject(new Error("curl: no status marker in output"));
        resolve2({
          status: Number(stdout.slice(marker + "\n__STATUS__".length)),
          body: stdout.slice(0, marker)
        });
      }
    );
  });
}

// src/client/pairing.ts
var import_node_crypto4 = require("crypto");

// src/client/proto.ts
var import_node_fs10 = require("fs");
var import_node_url = require("url");
var import_protobufjs = __toESM(require("protobufjs"), 1);
function schemaPath() {
  for (const rel of ["./proto/WAProto.proto", "../../proto/WAProto.proto"]) {
    const path = (0, import_node_url.fileURLToPath)(new URL(rel, importMetaUrl));
    if ((0, import_node_fs10.existsSync)(path)) return path;
  }
  throw new Error("WAProto.proto not found next to the library");
}
var root;
function protoRoot() {
  if (!root) {
    const r = new import_protobufjs.default.Root();
    r.loadSync(schemaPath());
    r.resolveAll();
    root = r;
  }
  return root;
}
var protoType = (name) => protoRoot().lookupType(`proto.${name}`);
var encodeProto = (type, obj) => {
  const t = protoType(type);
  return t.encode(t.fromObject(obj)).finish();
};

// src/client/pairing.ts
var DEFAULT_CONFIG = {
  version: [2, 3e3, 1050701434],
  browser: ["Windows", "Desktop"],
  countryCode: "US"
};
var be2 = (n, len) => {
  const b = Buffer.alloc(len);
  b.writeUIntBE(n, 0, len);
  return b;
};
function basePayload(config) {
  return {
    connectType: "WIFI_UNKNOWN",
    connectReason: "USER_ACTIVATED",
    userAgent: {
      appVersion: {
        primary: config.version[0],
        secondary: config.version[1],
        tertiary: config.version[2]
      },
      platform: "WEB",
      releaseChannel: "RELEASE",
      osVersion: "0.1",
      device: "Desktop",
      osBuildNumber: "0.1",
      localeLanguageIso6391: "en",
      mnc: "000",
      mcc: "000",
      localeCountryIso31661Alpha2: config.countryCode
    },
    webInfo: { webSubPlatform: "WEB_BROWSER" }
  };
}
function registrationPayload(creds, config) {
  const deviceProps = encodeProto("DeviceProps", {
    os: config.browser[0],
    platformType: "DESKTOP",
    requireFullSync: false,
    historySyncConfig: {
      fullSyncDaysLimit: 30,
      storageQuotaMb: 10240,
      inlineInitialPayloadInE2EeMsg: true,
      supportBotUserAgentChatHistory: true,
      supportCagReactionsAndPolls: true,
      supportBizHostedMsg: true,
      supportRecentSyncChunkMessageCountTuning: true,
      supportHostedGroupMsg: true,
      supportFbidBotChatHistory: true,
      supportMessageAssociation: true,
      supportGroupHistory: true,
      supportGuestChat: true
    },
    version: { primary: 10, secondary: 15, tertiary: 7 }
  });
  return encodeProto("ClientPayload", {
    ...basePayload(config),
    passive: false,
    pull: false,
    devicePairingData: {
      buildHash: (0, import_node_crypto4.createHash)("md5").update(config.version.join(".")).digest(),
      deviceProps,
      eRegid: be2(creds.registrationId, 4),
      eKeytype: Buffer.from([5]),
      eIdent: creds.signedIdentityKey.publicKey,
      eSkeyId: be2(creds.signedPreKey.keyId, 3),
      eSkeyVal: creds.signedPreKey.publicKey,
      eSkeySig: creds.signedPreKey.signature
    }
  });
}
function guestPayload(creds, config, lid) {
  void creds;
  const username = lid?.split("@")[0];
  return encodeProto("ClientPayload", {
    ...basePayload(config),
    passive: false,
    pull: false,
    product: "WHATSAPP_LID",
    accountType: "GUEST",
    ...username && { username: Number(username) }
  });
}
function loginPayload(creds, config) {
  if (!creds.me) throw new Error("loginPayload needs a paired device");
  const [userAndDevice] = creds.me.id.split("@");
  const [user, device] = userAndDevice.split(":");
  return encodeProto("ClientPayload", {
    ...basePayload(config),
    passive: true,
    pull: true,
    username: Number(user),
    device: Number(device ?? 0),
    lidDbMigrated: false
  });
}
function qrString(ref, creds) {
  return [
    ref,
    Buffer.from(creds.noiseKey.publicKey).toString("base64"),
    Buffer.from(creds.signedIdentityKey.publicKey).toString("base64"),
    creds.advSecretKey
  ].join(",");
}
var ACCOUNT_SIG_PREFIX = Buffer.from([6, 0]);
var DEVICE_SIG_PREFIX = Buffer.from([6, 1]);
var HOSTED_ACCOUNT_SIG_PREFIX = Buffer.from([6, 5]);
var child = (n, tag) => Array.isArray(n.content) ? n.content.find((c) => c.tag === tag) : void 0;
function handlePairSuccess(stanza, creds) {
  const success = child(stanza, "pair-success");
  const identityNode = success && child(success, "device-identity");
  const deviceNode = success && child(success, "device");
  if (!success || !identityNode || !deviceNode || !(identityNode.content instanceof Uint8Array)) {
    throw new Error("pair-success is missing device-identity or device");
  }
  const hmacType = protoType("ADVSignedDeviceIdentityHMAC");
  const hm = hmacType.toObject(hmacType.decode(identityNode.content), {
    bytes: Buffer,
    enums: Number,
    defaults: true
  });
  const hostedType = protoRoot().lookupEnum("proto.ADVEncryptionType").values["HOSTED"];
  const prefix = hm.accountType === hostedType ? HOSTED_ACCOUNT_SIG_PREFIX : Buffer.alloc(0);
  const expected = (0, import_node_crypto4.createHmac)("sha256", Buffer.from(creds.advSecretKey, "base64")).update(Buffer.concat([prefix, hm.details])).digest();
  if (expected.length !== hm.hmac.length || !(0, import_node_crypto4.timingSafeEqual)(expected, hm.hmac)) {
    throw new Error("Invalid account signature (HMAC)");
  }
  const accType = protoType("ADVSignedDeviceIdentity");
  const account = accType.toObject(accType.decode(hm.details), {
    bytes: Buffer,
    defaults: true
  });
  const idType = protoType("ADVDeviceIdentity");
  const deviceIdentity = idType.toObject(idType.decode(account.details), {
    enums: Number,
    defaults: true
  });
  const accountPrefix = deviceIdentity.deviceType === hostedType ? HOSTED_ACCOUNT_SIG_PREFIX : ACCOUNT_SIG_PREFIX;
  const accountMsg = Buffer.concat([
    accountPrefix,
    account.details,
    creds.signedIdentityKey.publicKey
  ]);
  if (!xeddsaVerify(account.accountSignatureKey, accountMsg, account.accountSignature)) {
    throw new Error("Failed to verify account signature");
  }
  const deviceMsg = Buffer.concat([
    DEVICE_SIG_PREFIX,
    account.details,
    creds.signedIdentityKey.publicKey,
    account.accountSignatureKey
  ]);
  account.deviceSignature = Buffer.from(xeddsaSign(creds.signedIdentityKey.privateKey, deviceMsg));
  const fullAccount = encodeProto("ADVSignedDeviceIdentity", {
    details: account.details,
    accountSignatureKey: account.accountSignatureKey,
    accountSignature: account.accountSignature,
    deviceSignature: account.deviceSignature
  });
  const encoded = encodeProto("ADVSignedDeviceIdentity", {
    details: account.details,
    accountSignature: account.accountSignature,
    deviceSignature: account.deviceSignature
  });
  const reply = {
    tag: "iq",
    attrs: { to: "s.whatsapp.net", type: "result", id: stanza.attrs["id"] ?? "" },
    content: [
      {
        tag: "pair-device-sign",
        attrs: {},
        content: [
          {
            tag: "device-identity",
            attrs: { "key-index": String(deviceIdentity.keyIndex) },
            content: encoded
          }
        ]
      }
    ]
  };
  const bizNode2 = child(success, "biz");
  const platformNode = child(success, "platform");
  const me = { id: deviceNode.attrs["jid"] ?? "" };
  if (deviceNode.attrs["lid"]) me.lid = deviceNode.attrs["lid"];
  if (bizNode2?.attrs["name"]) me.name = bizNode2.attrs["name"];
  const update = { me, account: fullAccount };
  if (platformNode?.attrs["name"]) update.platform = platformNode.attrs["name"];
  return { reply, update };
}

// src/jid.ts
var DOMAIN_TYPE = {
  "s.whatsapp.net": 0,
  "c.us": 0,
  lid: 1,
  hosted: 128,
  "hosted.lid": 129
};
function jidDecode(jid) {
  const at = jid.indexOf("@");
  if (at < 0) throw new Error(`not a JID: "${jid}"`);
  const server2 = jid.slice(at + 1);
  const left = jid.slice(0, at);
  const [userAgent, deviceStr] = left.split(":");
  const user = userAgent.split("_")[0];
  const device = deviceStr ? Number(deviceStr) : 0;
  return { user, server: server2, device, domainType: DOMAIN_TYPE[server2] ?? 0 };
}
function signalAddress(jid) {
  const { user, device, domainType } = jidDecode(jid);
  if (!user) throw new Error(`JID has no user: "${jid}"`);
  return { name: domainType === 0 ? user : `${user}_${domainType}`, device };
}
var signalAddressString = (jid) => {
  const a = signalAddress(jid);
  return `${a.name}.${a.device}`;
};
var jidEncode = (user, server2, device) => `${user ?? ""}${device ? `:${device}` : ""}@${server2}`;
function jidNormalizedUser(jid) {
  const d = decodeLoose(jid);
  if (!d) return "";
  return jidEncode(d.user, d.server === "c.us" ? "s.whatsapp.net" : d.server);
}
var areJidsSameUser = (a, b) => decodeLoose(a)?.user === decodeLoose(b)?.user;
var server = (jid) => decodeLoose(jid)?.server;
var isJidGroup = (jid) => server(jid) === "g.us";
var isJidUser = (jid) => server(jid) === "s.whatsapp.net";
var isLidUser = (jid) => server(jid) === "lid";
var isJidBroadcast = (jid) => server(jid) === "broadcast";
var isJidStatusBroadcast = (jid) => jid === "status@broadcast";
var isJidNewsletter = (jid) => server(jid) === "newsletter";
function decodeLoose(jid) {
  if (!jid || !jid.includes("@")) return void 0;
  const d = jidDecode(jid);
  return { user: d.user, server: d.server };
}

// src/client/features/call/call-events.ts
function waitingUsers(info) {
  const room = (Array.isArray(info.content) ? info.content : []).find(
    (k) => k.tag === "waiting_room"
  );
  return (Array.isArray(room?.content) ? room.content : []).filter(
    (u) => u.tag === "user" && /^\d+(:\d+)?@(lid|s\.whatsapp\.net)$/.test(u.attrs["jid"] ?? "")
  ).map((u) => ({
    jid: u.attrs["jid"],
    ...u.attrs["push_name"] && { name: u.attrs["push_name"].slice(0, 128) },
    guest: u.attrs["account_kind"] === "guest",
    state: u.attrs["state"] ?? ""
  }));
}
function rosterUsers(info) {
  const gi = (Array.isArray(info.content) ? info.content : []).find((k) => k.tag === "group_info");
  return (Array.isArray(gi?.content) ? gi.content : []).filter(
    (u) => u.tag === "user" && /^\d+(:\d+)?@(lid|s\.whatsapp\.net)$/.test(u.attrs["jid"] ?? "")
  ).map((u) => ({
    jid: u.attrs["jid"],
    ...u.attrs["push_name"] && { name: u.attrs["push_name"].slice(0, 128) },
    guest: u.attrs["account_kind"] === "guest",
    state: u.attrs["state"] ?? ""
  }));
}
function parseCall(node) {
  const info = Array.isArray(node.content) ? node.content[0] : void 0;
  if (!info) return void 0;
  const callId = info.attrs["call-id"];
  if (!callId) return void 0;
  const hasVideo = Array.isArray(info.content) && info.content.some((c) => c.tag === "video");
  return {
    status: info.tag,
    callId,
    from: node.attrs["from"] ?? "",
    ...info.attrs["call-creator"] && { creator: info.attrs["call-creator"] },
    ...info.tag === "offer" && { isVideo: hasVideo },
    ...(info.attrs["type"] === "group" || info.attrs["group-jid"] || Array.isArray(info.content) && info.content.some((c) => c.tag === "group_info")) && {
      isGroup: true
    },
    ...info.attrs["group-jid"] && { group: info.attrs["group-jid"] },
    ...info.attrs["lightweight"] === "1" && { lightweight: true },
    ...info.tag === "offer" && (() => {
      const reason = (Array.isArray(info.content) ? info.content : []).find(
        (k) => k.tag === "silence"
      )?.attrs["reason"];
      return reason && /^[a-z0-9_]{1,64}$/.test(reason) ? { silence: reason } : {};
    })(),
    ...info.attrs["caller_pn"] && /^\d{5,20}@s\.whatsapp\.net$/.test(info.attrs["caller_pn"]) && {
      callerPn: info.attrs["caller_pn"]
    },
    ...info.tag === "video" && /^\d{1,2}$/.test(info.attrs["state"] ?? "") && { videoState: Number(info.attrs["state"]) },
    ...info.tag === "user_action" && info.attrs["action"] === "raise_hand" && {
      handRaised: (Array.isArray(info.content) ? info.content : []).find((k) => k.tag === "raise_hand")?.attrs["raise-hand-state"] === "1"
    },
    ...info.tag === "screen_share" && /^[12]$/.test(info.attrs["screenshare_state"] ?? "") && {
      screenShare: {
        state: info.attrs["screenshare_state"] === "1" ? "started" : "stopped",
        .../^\d{1,3}$/.test(info.attrs["version"] ?? "") && {
          version: Number(info.attrs["version"])
        },
        .../^\d{1,10}$/.test(info.attrs["screen_share_id"] ?? "") && {
          id: Number(info.attrs["screen_share_id"])
        }
      }
    },
    ...info.tag === "waiting_room_update" && { waitingRoom: waitingUsers(info) },
    ...info.tag === "group_update" && { roster: rosterUsers(info) },
    ...node.attrs["t"] && /^\d{1,12}$/.test(node.attrs["t"]) && { timestamp: Number(node.attrs["t"]) }
  };
}
function rejectCall(callId, callCreator, id) {
  return {
    tag: "call",
    attrs: { id, to: callCreator },
    content: [
      { tag: "reject", attrs: { "call-id": callId, "call-creator": callCreator, count: "0" } }
    ]
  };
}
function callAck(node) {
  const first = Array.isArray(node.content) ? node.content[0] : void 0;
  return {
    tag: "ack",
    attrs: {
      id: node.attrs["id"] ?? "",
      to: node.attrs["from"] ?? "",
      class: "call",
      ...first && { type: first.tag }
    }
  };
}

// src/client/features/message/comment.ts
var import_node_crypto5 = require("crypto");
var keyFor = (c) => Buffer.from(
  (0, import_node_crypto5.hkdfSync)(
    "sha256",
    c.secret,
    Buffer.alloc(32),
    Buffer.concat([
      Buffer.from(c.parentMsgId),
      Buffer.from(c.parentSenderJid),
      Buffer.from(c.modifierJid),
      Buffer.from(c.useCase)
    ]),
    32
  )
);
function encryptAddon(body, c) {
  const iv = (0, import_node_crypto5.randomBytes)(12);
  const cipher = (0, import_node_crypto5.createCipheriv)("aes-256-gcm", keyFor(c), iv);
  const plain = encodeProto("Message", body);
  const out = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
  return { encPayload: new Uint8Array(out), encIv: new Uint8Array(iv) };
}
function decryptAddon(enc2, c) {
  if (enc2.encPayload.length < 17) throw new Error("add-on too short");
  const body = Buffer.from(enc2.encPayload);
  const d = (0, import_node_crypto5.createDecipheriv)("aes-256-gcm", keyFor(c), enc2.encIv);
  d.setAuthTag(body.subarray(body.length - 16));
  const plain = Buffer.concat([d.update(body.subarray(0, body.length - 16)), d.final()]);
  const T = protoType("Message");
  return T.toObject(T.decode(plain), { bytes: Buffer, longs: Number });
}
function commentMessage(parent, text4, ctx) {
  const enc2 = encryptAddon(
    { extendedTextMessage: { text: text4 } },
    { ...ctx, parentMsgId: parent.id, useCase: "Enc Comment" }
  );
  return {
    encCommentMessage: {
      targetMessageKey: {
        remoteJid: parent.remoteJid,
        fromMe: !!parent.fromMe,
        id: parent.id,
        participant: parent.participant ?? ctx.parentSenderJid
      },
      ...enc2
    },
    messageContextInfo: { messageSecret: (0, import_node_crypto5.randomBytes)(32) }
  };
}

// src/client/features/message/event-message.ts
var import_node_crypto6 = require("crypto");
var seconds = (t) => t === void 0 ? void 0 : Math.floor(t instanceof Date ? t.getTime() / 1e3 : t);
function eventMessage(o) {
  if (!o.name.trim()) throw new Error("an event needs a name");
  return {
    eventMessage: {
      name: o.name,
      ...o.description !== void 0 && { description: o.description },
      ...o.startTime !== void 0 && { startTime: seconds(o.startTime) },
      ...o.endTime !== void 0 && { endTime: seconds(o.endTime) },
      ...o.joinLink && { joinLink: o.joinLink },
      ...o.location && { location: o.location },
      isCanceled: o.isCanceled ?? false,
      ...o.extraGuestsAllowed !== void 0 && { extraGuestsAllowed: o.extraGuestsAllowed },
      isScheduleCall: o.isScheduledCall ?? false
    },
    messageContextInfo: { messageSecret: (0, import_node_crypto6.randomBytes)(32) }
  };
}
var keyFor2 = (c) => Buffer.from(
  (0, import_node_crypto6.hkdfSync)(
    "sha256",
    c.secret,
    Buffer.alloc(32),
    Buffer.concat([
      Buffer.from(c.eventMsgId),
      Buffer.from(c.eventCreatorJid),
      Buffer.from(c.responderJid),
      Buffer.from("Event Response")
    ]),
    32
  )
);
var aadFor = (c) => Buffer.from(`${c.eventMsgId}\0${c.responderJid}`);
function encryptEventResponse(response, c, now = Date.now()) {
  const T = protoType("Message.EventResponseMessage");
  const plain = T.encode(
    T.fromObject({
      response: response.response,
      timestampMs: now,
      ...response.extraGuestCount !== void 0 && { extraGuestCount: response.extraGuestCount }
    })
  ).finish();
  const iv = (0, import_node_crypto6.randomBytes)(12);
  const cipher = (0, import_node_crypto6.createCipheriv)("aes-256-gcm", keyFor2(c), iv);
  cipher.setAAD(aadFor(c));
  const body = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
  return { encPayload: new Uint8Array(body), encIv: new Uint8Array(iv) };
}
function decryptEventResponse(enc2, c) {
  if (enc2.encPayload.length < 17) throw new Error("event response too short");
  const d = (0, import_node_crypto6.createDecipheriv)("aes-256-gcm", keyFor2(c), enc2.encIv);
  d.setAAD(aadFor(c));
  const body = Buffer.from(enc2.encPayload);
  d.setAuthTag(body.subarray(body.length - 16));
  const plain = Buffer.concat([d.update(body.subarray(0, body.length - 16)), d.final()]);
  const T = protoType("Message.EventResponseMessage");
  const o = T.toObject(T.decode(plain), { enums: String, longs: Number });
  return { ...o, response: o.response ?? "UNKNOWN" };
}
function eventResponse(key, response, c) {
  const enc2 = encryptEventResponse(response, c);
  return {
    encEventResponseMessage: {
      eventCreationMessageKey: {
        remoteJid: key.remoteJid,
        fromMe: !!key.fromMe,
        id: key.id,
        ...key.participant && { participant: key.participant }
      },
      ...enc2
    }
  };
}

// src/client/features/message/extras.ts
var import_node_crypto7 = require("crypto");
function poll(name, values, selectableCount = 1, o = {}) {
  if (!name.trim()) throw new Error("poll needs a question");
  if (values.length < 2 || values.length > 12) throw new Error("a poll needs 2 to 12 options");
  if (new Set(values).size !== values.length) throw new Error("poll options must be unique");
  if (selectableCount < 0 || selectableCount > values.length) {
    throw new Error(`selectableCount must be between 0 and ${values.length}`);
  }
  const quiz = o.correctAnswer !== void 0;
  if (quiz && !values.includes(o.correctAnswer))
    throw new Error("correctAnswer must be one of the options");
  if (quiz && selectableCount !== 1) throw new Error("a quiz has exactly one selectable answer");
  if (o.optionImageHashes && o.optionImageHashes.length !== values.length)
    throw new Error("optionImageHashes needs one hash per option");
  const image = !!o.optionImageHashes;
  const option = (optionName) => ({
    optionName,
    ...o.optionImageHashes && { optionHash: o.optionImageHashes[values.indexOf(optionName)] }
  });
  const creation = {
    name,
    selectableOptionsCount: selectableCount,
    options: values.map(option),
    ...image && { pollContentType: "IMAGE" },
    pollType: quiz ? "QUIZ" : "POLL",
    ...quiz && { correctAnswer: option(o.correctAnswer) }
  };
  const field = quiz || image ? "pollCreationMessageV5" : selectableCount === 1 ? "pollCreationMessageV3" : "pollCreationMessage";
  return {
    message: { messageContextInfo: { messageSecret: (0, import_node_crypto7.randomBytes)(32) }, [field]: creation },
    // `contenttype` is only read for channel posts; chats ignore it.
    opts: {
      extraNodes: [
        {
          tag: "meta",
          attrs: {
            polltype: quiz ? "quiz_creation" : "creation",
            contenttype: image ? "image" : "text"
          }
        }
      ]
    }
  };
}
function question(inner) {
  return {
    message: { questionMessage: { message: inner } },
    opts: { extraNodes: [{ tag: "meta", attrs: { questiontype: "question" } }] }
  };
}
function musicParts(m) {
  const music = {
    songId: m.songId,
    title: m.title,
    author: m.author,
    artistAttribution: m.artistAttribution,
    isExplicit: m.isExplicit ?? false
  };
  return {
    contextInfo: {
      forwardingScore: 0,
      featureEligibilities: { canBeReshared: true },
      pairedMediaType: "NOT_PAIRED_MEDIA",
      statusSourceType: "MUSIC_STANDALONE",
      statusAttributions: [{ type: "MUSIC", music }]
    },
    // `annotations` is a field of the video itself, not of its contextInfo.
    fields: {
      accessibilityLabel: "Music sticker",
      annotations: [
        {
          // The music sticker sits in the middle of the frame.
          polygonVertices: [
            { x: 0.175, y: 0.3377 },
            { x: 0.825, y: 0.3377 },
            { x: 0.825, y: 0.6623 },
            { x: 0.175, y: 0.6623 }
          ],
          shouldSkipConfirmation: true,
          embeddedContent: {
            embeddedMusic: {
              ...music,
              ...m.catalog,
              musicSongStartTimeInMs: m.startTimeMs ?? 0,
              overlapDurationInMs: 3e4
            }
          },
          embeddedAction: true
        }
      ]
    }
  };
}
function groupStatusContext(authorLid, sourceType, attributions = []) {
  return {
    forwardingScore: 0,
    featureEligibilities: {
      cannotBeRanked: false,
      canBeReshared: false,
      canReceiveMultiReact: true
    },
    statusSourceType: sourceType,
    statusAttributions: [
      { type: "GROUP_STATUS", groupStatus: { authorJid: authorLid } },
      ...attributions
    ],
    isGroupStatus: true,
    posterStatusId: (0, import_node_crypto7.randomBytes)(32).toString("base64")
  };
}
function groupStatus(inner) {
  return {
    message: { groupStatusMessageV2: { message: inner } },
    opts: { extraNodes: [{ tag: "meta", attrs: { is_group_status: "true" } }] }
  };
}
var viewOnce = (message) => ({
  viewOnceMessageV2: { message }
});
var location = (latitude, longitude, o = {}) => ({
  locationMessage: { degreesLatitude: latitude, degreesLongitude: longitude, ...o }
});
var contactCard = (displayName, vcard) => ({
  contactMessage: { displayName, vcard }
});
function vcardFor(name, phoneE164) {
  const digits2 = phoneE164.replace(/[^\d]/g, "");
  return `BEGIN:VCARD
VERSION:3.0
FN:${name}
TEL;type=CELL;type=VOICE;waid=${digits2}:+${digits2}
END:VCARD`;
}
var pollOptionHash = (name) => (0, import_node_crypto7.createHash)("sha256").update(name).digest("hex");
function decryptPollVote(vote, ctx) {
  if (vote.encPayload.length < 17) throw new Error("poll vote too short");
  const info = Buffer.concat([
    Buffer.from(ctx.pollMsgId),
    Buffer.from(ctx.pollCreatorJid),
    Buffer.from(ctx.voterJid),
    Buffer.from("Poll Vote")
  ]);
  const key = Buffer.from((0, import_node_crypto7.hkdfSync)("sha256", ctx.pollSecret, Buffer.alloc(32), info, 32));
  const d = (0, import_node_crypto7.createDecipheriv)("aes-256-gcm", key, vote.encIv);
  d.setAAD(Buffer.from(`${ctx.pollMsgId}\0${ctx.voterJid}`));
  d.setAuthTag(Buffer.from(vote.encPayload.subarray(vote.encPayload.length - 16)));
  const plain = Buffer.concat([
    d.update(vote.encPayload.subarray(0, vote.encPayload.length - 16)),
    d.final()
  ]);
  const T = protoType("Message.PollVoteMessage");
  const decoded = T.toObject(T.decode(plain), { bytes: Buffer });
  return (decoded.selectedOptions ?? []).map((b) => Buffer.from(b).toString("hex"));
}

// src/client/meta-ai.ts
var import_node_crypto8 = require("crypto");
var BOT_MESSAGE_INFO = "Bot Message";
var MAX_SECRETS_PER_CHAT = 20;
var MessageSecrets = class {
  #byId = /* @__PURE__ */ new Map();
  #byChat = /* @__PURE__ */ new Map();
  /** The secret stored for exactly this message id (no chat-wide fallback). */
  byId(id) {
    return this.#byId.get(id);
  }
  /** Is a secret already stored for this id? (First write wins: a later message with the same id cannot replace it.) */
  has(id) {
    return this.#byId.has(id);
  }
  set(id, secret, chat) {
    const buf = Buffer.from(secret);
    this.#byId.set(id, buf);
    if (!chat) return;
    const list = (this.#byChat.get(chat) ?? []).filter((e) => e.id !== id && !e.secret.equals(buf));
    list.unshift({ id, secret: buf });
    list.length = Math.min(list.length, MAX_SECRETS_PER_CHAT);
    this.#byChat.set(chat, list);
  }
  /** Secrets to try, most specific first (named ids, then the chat's recent ones), de-duplicated. */
  candidates(ids, chat) {
    const out = [];
    const add = (b) => b && !out.some((o) => o.equals(b)) && out.push(b);
    for (const id of ids) if (id) add(this.#byId.get(id));
    for (const e of this.#byChat.get(chat) ?? []) {
      if (out.length >= 6) break;
      add(e.secret);
    }
    return out;
  }
};
var normalizeLid = (jid) => jid && jid.endsWith("@lid") && jid.includes(":") ? `${jid.split(":")[0]}@lid` : jid;
var hkdf = (ikm, info) => Buffer.from((0, import_node_crypto8.hkdfSync)("sha256", ikm, Buffer.alloc(0), info, 32));
function decryptMsmsg(messageSecret, ctx, encIv, encPayload) {
  const msgIds = [
    ...new Set(
      [ctx.botEditTargetId, ctx.stanzaId, ctx.metaTargetId].filter((x) => !!x)
    )
  ];
  const targets = [
    ...new Set(
      [normalizeLid(ctx.targetSenderJid ?? ctx.meLid ?? ctx.meId), normalizeLid(ctx.meLid)].filter(
        (x) => !!x
      )
    )
  ];
  if (!msgIds.length) throw new Error("msmsg: no target message id");
  if (!targets.length) throw new Error("msmsg: no target JID");
  if (encPayload.length < 16) throw new Error("msmsg: payload too short");
  const bot = Buffer.from(ctx.botJid);
  const k1 = hkdf(messageSecret, Buffer.from(BOT_MESSAGE_INFO));
  const tag = Buffer.from(encPayload.subarray(encPayload.length - 16));
  const body = Buffer.from(encPayload.subarray(0, encPayload.length - 16));
  let last;
  for (const id of msgIds) {
    const idBuf = Buffer.from(id);
    for (const target of targets) {
      try {
        const key = hkdf(k1, Buffer.concat([idBuf, Buffer.from(target), bot]));
        const d = (0, import_node_crypto8.createDecipheriv)("aes-256-gcm", key, encIv);
        d.setAAD(Buffer.concat([idBuf, Buffer.from([0]), bot]));
        d.setAuthTag(tag);
        return Buffer.concat([d.update(body), d.final()]);
      } catch (e) {
        last = e;
      }
    }
  }
  throw new Error("msmsg decryption failed: all key derivation candidates exhausted", {
    cause: last
  });
}
function extractMetaAiText(message) {
  if (!message) return void 0;
  const m = message;
  const body = m["protocolMessage"]?.editedMessage ?? m;
  const direct = body.extendedTextMessage?.text ?? body.conversation;
  if (typeof direct === "string") return direct;
  const rr = body.richResponseMessage;
  if (!rr) return void 0;
  const parts = (rr.submessages ?? []).map((s) => s.messageText).filter((t) => typeof t === "string" && t);
  if (parts.length) return parts.join("\n");
  const data = rr.unifiedResponse?.data;
  if (typeof data === "string") {
    try {
      const j = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
      const texts = (j.sections ?? []).map((s) => s.view_model?.primitive?.text).filter((t) => !!t);
      if (texts.length) return texts.join("\n");
    } catch {
    }
  }
  return void 0;
}

// src/client/receiver.ts
var S_WHATSAPP_NET = "s.whatsapp.net";
var MIN_PREKEY_COUNT = 5;
var UPLOAD_PREKEY_COUNT = 30;
var MAX_RETRIES = 5;
var REQUEST_TIMEOUT_MS = 2e4;
var children = (n, tag) => Array.isArray(n.content) ? n.content.filter((c) => tag === void 0 || c.tag === tag) : [];
var be3 = (n, len) => {
  const b = Buffer.alloc(len);
  b.writeUIntBE(n, 0, len);
  return b;
};
function unpadRandomMax16(data) {
  if (data.length === 0) throw new Error("unpad given empty bytes");
  const pad = data[data.length - 1];
  if (pad < 1 || pad > 16 || pad > data.length) throw new Error(`invalid padding length ${pad}`);
  return data.subarray(0, data.length - pad);
}
function buildAck(node, meId) {
  const attrs = {
    id: node.attrs["id"] ?? "",
    to: node.attrs["from"] ?? "",
    class: node.tag
  };
  if (node.attrs["participant"]) attrs["participant"] = node.attrs["participant"];
  if (node.attrs["recipient"]) attrs["recipient"] = node.attrs["recipient"];
  if (node.attrs["type"]) attrs["type"] = node.attrs["type"];
  if (node.tag === "message" && meId) attrs["from"] = meId;
  return { tag: "ack", attrs };
}
var Receiver = class {
  constructor(d) {
    this.d = d;
  }
  d;
  #pending = /* @__PURE__ */ new Map();
  #acks = /* @__PURE__ */ new Map();
  /** Acks of our own `<call>` stanzas (class=call), by stanza id. */
  #callAcks = /* @__PURE__ */ new Map();
  #retryCounts = /* @__PURE__ */ new Map();
  #secrets = new MessageSecrets();
  /** poll id -> options and who created it (from our own state or the creation message's author). */
  #polls = /* @__PURE__ */ new Map();
  /** ids of messages we sent: nothing a peer sends may overwrite their secret or poll data. */
  #ownIds = /* @__PURE__ */ new Set();
  #queue = Promise.resolve();
  #idCounter = 0;
  /** Route an incoming stanza. Returns true when it was handled here. */
  handle(node) {
    if (node.tag === "iq" && (node.attrs["type"] === "result" || node.attrs["type"] === "error")) {
      const p = this.#pending.get(node.attrs["id"] ?? "");
      if (p) {
        this.#pending.delete(node.attrs["id"]);
        if (node.attrs["type"] === "error")
          p.reject(new Error(`iq error: ${JSON.stringify(node.content)}`));
        else p.resolve(node);
        return true;
      }
      return false;
    }
    if (node.tag === "ack" && node.attrs["class"] === "call") {
      const p = this.#callAcks.get(node.attrs["id"] ?? "");
      if (p) {
        this.#callAcks.delete(node.attrs["id"]);
        const failed = node.attrs["error"] && node.attrs["error"] !== "207";
        if (failed) p.reject(new Error(`call rejected by server (error ${node.attrs["error"]})`));
        else p.resolve(node);
        return true;
      }
      return false;
    }
    if (node.tag === "ack" && node.attrs["class"] === "message") {
      const p = this.#acks.get(node.attrs["id"] ?? "");
      if (p) {
        this.#acks.delete(node.attrs["id"]);
        if (node.attrs["error"])
          p.reject(new Error(`message rejected by server (error ${node.attrs["error"]})`));
        else p.resolve(node);
        return true;
      }
      return false;
    }
    if (node.tag === "status") {
      const type = node.attrs["edit"] ? "revoke" : node.attrs["type"] ?? "text";
      this.#sendSafe({
        tag: "ack",
        attrs: { id: node.attrs["id"] ?? "", to: node.attrs["from"] ?? "", class: "status", type }
      });
      this.d.onChannelStatus?.(node);
      return true;
    }
    if (node.tag === "call") {
      this.#sendSafe(callAck(node));
      this.d.onCall?.(node);
      return true;
    }
    if (node.tag === "message" || node.tag === "receipt" || node.tag === "notification") {
      this.#queue = this.#queue.then(() => this.#process(node)).catch((e) => this.d.logger.event("receiver.error", e));
      return true;
    }
    return false;
  }
  /** Remember what we sent: its secret (replies, votes) and, for polls, the option texts. */
  rememberOwn(id, chat, message) {
    this.#ownIds.add(id);
    if (this.#ownIds.size > 2e3) this.#ownIds.delete(this.#ownIds.values().next().value);
    const secret = message["messageContextInfo"]?.messageSecret;
    if (secret) this.#secrets.set(id, secret, chat);
    this.#notePoll(id, message, this.d.creds.me?.id ?? "", true);
  }
  /** Polls are identified by who created them *and* the id: two different peers may use the same id. */
  #pollKey(creator, id) {
    try {
      return `${jidDecode(creator).user}|${id}`;
    } catch {
      return `${creator}|${id}`;
    }
  }
  #notePoll(id, message, creator, own = false) {
    if (!own && this.#ownIds.has(id)) return;
    const pollKey = this.#pollKey(creator, id);
    if (this.#polls.has(pollKey)) return;
    const poll2 = message["pollCreationMessage"] ?? message["pollCreationMessageV2"] ?? message["pollCreationMessageV3"];
    if (poll2?.options) {
      this.#polls.set(pollKey, {
        options: poll2.options.map((o) => o.optionName),
        creator
      });
      if (this.#polls.size > 500) this.#polls.delete(this.#polls.keys().next().value);
    }
  }
  /** Send a stanza as-is (fire and forget). */
  sendNode(node) {
    this.d.send(node);
  }
  /** Wait for everything queued so far (used by tests). */
  idle() {
    return this.#queue;
  }
  nextId() {
    return `velowa-${Date.now().toString(36)}-${this.#idCounter++}`;
  }
  /** Send an iq and await its result/error. */
  request(node) {
    const id = node.attrs["id"] ?? this.nextId();
    const withId = { ...node, attrs: { ...node.attrs, id } };
    return new Promise((resolve2, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`request ${id} timed out`));
      }, REQUEST_TIMEOUT_MS);
      this.#pending.set(id, {
        resolve: (n) => (clearTimeout(timer), resolve2(n)),
        reject: (e) => (clearTimeout(timer), reject(e))
      });
      try {
        this.d.send(withId);
      } catch (e) {
        clearTimeout(timer);
        this.#pending.delete(id);
        reject(e);
      }
    });
  }
  /** Send a message stanza and resolve with the server's `<ack class="message">`. */
  /** Send a `<call>` stanza and wait for the server's `<ack class=call>` to it (the offer's carries the relay). */
  sendCallAndWait(node, timeoutMs = 2e4) {
    const id = node.attrs["id"] ?? "";
    return new Promise((resolve2, reject) => {
      const timer = setTimeout(() => {
        this.#callAcks.delete(id);
        reject(new Error(`no server ack for call stanza ${id}`));
      }, timeoutMs);
      this.#callAcks.set(id, {
        resolve: (n) => (clearTimeout(timer), resolve2(n)),
        reject: (e) => (clearTimeout(timer), reject(e))
      });
      try {
        this.d.send(node);
      } catch (e) {
        clearTimeout(timer);
        this.#callAcks.delete(id);
        reject(e);
      }
    });
  }
  sendAndWaitAck(node) {
    const id = node.attrs["id"] ?? "";
    return new Promise((resolve2, reject) => {
      const timer = setTimeout(() => {
        this.#acks.delete(id);
        reject(new Error(`no server ack for message ${id}`));
      }, REQUEST_TIMEOUT_MS);
      this.#acks.set(id, {
        resolve: (n) => (clearTimeout(timer), resolve2(n)),
        reject: (e) => (clearTimeout(timer), reject(e))
      });
      try {
        this.d.send(node);
      } catch (e) {
        clearTimeout(timer);
        this.#acks.delete(id);
        reject(e);
      }
    });
  }
  // ---- pre-keys ----------------------------------------------------------------------------
  /** Ask the server how many one-time pre-keys it still holds; top up when low. */
  async ensurePreKeys() {
    const res = await this.request({
      tag: "iq",
      attrs: { xmlns: "encrypt", type: "get", to: S_WHATSAPP_NET },
      content: [{ tag: "count", attrs: {} }]
    });
    const count = Number(children(res, "count")[0]?.attrs["value"] ?? 0);
    this.d.logger.event("prekeys.server-count", { count });
    if (count < MIN_PREKEY_COUNT) await this.uploadPreKeys(UPLOAD_PREKEY_COUNT);
  }
  async uploadPreKeys(count) {
    const keys = await this.#generatePreKeys(count);
    const { creds } = this.d;
    const node = {
      tag: "iq",
      attrs: { xmlns: "encrypt", type: "set", to: S_WHATSAPP_NET },
      content: [
        { tag: "registration", attrs: {}, content: be3(creds.registrationId, 4) },
        { tag: "type", attrs: {}, content: Buffer.from([5]) },
        { tag: "identity", attrs: {}, content: creds.signedIdentityKey.publicKey },
        { tag: "list", attrs: {}, content: keys.map(xmppPreKey) },
        xmppSignedPreKey(creds)
      ]
    };
    await this.request(node);
    this.d.logger.event("prekeys.uploaded", { count, firstId: keys[0]?.id });
  }
  async #generatePreKeys(count) {
    const { creds, storage } = this.d;
    const keys = newPreKeys(creds.nextPreKeyId, count);
    for (const k of keys) await storage.storePreKey(k.id, k.record);
    creds.nextPreKeyId += count;
    this.d.saveCreds();
    return keys;
  }
  // ---- incoming stanzas -----------------------------------------------------------------------
  async #process(node) {
    const meId = this.d.creds.me?.id;
    if (node.tag === "notification") {
      if (node.attrs["type"] === "encrypt") {
        const count = children(node, "count")[0];
        if (count && Number(count.attrs["value"]) < MIN_PREKEY_COUNT) {
          await this.uploadPreKeys(UPLOAD_PREKEY_COUNT).catch(
            (e) => this.d.logger.event("prekeys.upload-failed", e)
          );
        }
      }
      this.#sendSafe(buildAck(node, meId));
      this.d.onNotification?.(node);
      return;
    }
    if (node.tag === "receipt") {
      this.#sendSafe(buildAck(node, meId));
      this.d.onReceipt?.(node);
      return;
    }
    await this.#processMessage(node);
  }
  async #processMessage(node) {
    const { logger } = this.d;
    const from = node.attrs["from"] ?? "";
    const id = node.attrs["id"] ?? "";
    const participant = node.attrs["participant"];
    const author = participant ?? from;
    const plaintexts = children(node, "plaintext").filter((e) => e.content instanceof Uint8Array);
    const encs = children(node, "enc").filter((e) => e.content instanceof Uint8Array);
    const isGroupEnc = (e) => e.attrs["type"] === "skmsg" || e.attrs["type"] === "frskmsg";
    const ordered = [
      ...plaintexts.map((p) => ({ ...p, attrs: { ...p.attrs, type: "plaintext" } })),
      ...encs.filter((e) => !isGroupEnc(e)),
      ...encs.filter(isGroupEnc)
    ];
    let decrypted = 0;
    let retryable = 0;
    const failures = [];
    for (const enc2 of ordered) {
      const type = enc2.attrs["type"] ?? "";
      if (type !== "msmsg" && type !== "plaintext") retryable++;
      try {
        const data = enc2.content;
        const plain = type === "plaintext" ? data : type === "msmsg" ? this.#decryptMsmsg(node, author, data) : await this.#decryptEnc(from, author, type, data);
        const msg = await this.#decodeAndApply(node, plain, author, id, from, type === "msmsg");
        decrypted++;
        logger.event("message.decrypted", { id, from, participant, type, message: msg.json });
        const decoded = { id, from, message: msg.json };
        if (participant) decoded.participant = participant;
        const ts = Number(node.attrs["t"]);
        if (ts) decoded.timestamp = ts;
        if (node.attrs["notify"]) decoded.pushName = node.attrs["notify"];
        const rep = children(node, "reporting")[0];
        if (rep) {
          const tag = children(rep, "reporting_tag")[0]?.content;
          const tok = children(rep, "reporting_token")[0];
          decoded.reporting = {
            ...tag instanceof Uint8Array && { tag },
            ...tok?.content instanceof Uint8Array && { token: tok.content },
            ...tok?.attrs["v"] && { version: Number(tok.attrs["v"]) }
          };
        }
        this.d.onMessage?.(decoded);
      } catch (error) {
        failures.push(`${type}: ${error.message}`);
        logger.event("message.decrypt-failed", { id, from, participant, type, error });
      }
    }
    if (failures.length > 0 && decrypted === 0 && retryable > 0) await this.#sendRetry(node);
    else if (decrypted > 0 && node.attrs["type"] !== "peer_msg" && !from.endsWith("@newsletter")) {
      const attrs = { id, to: from };
      if (participant) attrs["participant"] = participant;
      this.#sendSafe({ tag: "receipt", attrs });
    }
    this.#sendSafe(buildAck(node, this.d.creds.me?.id));
  }
  /**
   * The call key from an offer's `<enc>` (a Signal message from the caller's device carrying `Message.call.callKey`).
   * Returns undefined when the envelope holds no call key.
   */
  async decryptCallKey(author, type, data) {
    const plain = await this.#decryptEnc(author, author, type, data);
    const msg = protoType("Message").toObject(protoType("Message").decode(plain), {
      bytes: Buffer
    });
    const key = msg.call?.callKey;
    return key && key.length >= 32 ? key : void 0;
  }
  async #decryptEnc(from, author, type, data) {
    if (type === "skmsg" || type === "frskmsg") {
      return unpadRandomMax16(
        await this.d.cipher.groupDecrypt(from, signalAddressString(author), data)
      );
    }
    if (type !== "pkmsg" && type !== "msg") throw new Error(`unsupported enc type "${type}"`);
    const { name, device } = signalAddress(this.d.lids.resolve(author));
    const res = await this.d.cipher.decrypt(name, device, type, data);
    if (res.preKeyId !== void 0) await this.d.storage.removePreKey(res.preKeyId);
    return unpadRandomMax16(res.plaintext);
  }
  #pollVote(raw, voter, chat) {
    const upd = raw["pollUpdateMessage"];
    const key = upd?.pollCreationMessageKey;
    const vote = upd?.vote;
    if (!key?.id || !vote?.encPayload || !vote?.encIv) return void 0;
    const claimedCreator = key.fromMe ? this.d.creds.me?.id ?? "" : key.participant ?? key.remoteJid ?? chat;
    const poll2 = this.#polls.get(this.#pollKey(claimedCreator, key.id));
    const exact = this.#secrets.byId(key.id);
    const secrets = exact ? [exact] : [];
    if (!secrets.length) return { pollId: key.id, error: "poll secret unknown" };
    const creator = poll2?.creator ?? claimedCreator;
    let lastError = "poll vote did not decrypt";
    for (const secret of secrets) {
      try {
        const hashes = decryptPollVote(
          { encPayload: new Uint8Array(vote.encPayload), encIv: new Uint8Array(vote.encIv) },
          { pollCreatorJid: creator, pollMsgId: key.id, pollSecret: secret, voterJid: voter }
        );
        const names = poll2 ? hashes.map((h) => poll2.options.find((n) => pollOptionHash(n) === h)).filter((n) => !!n) : void 0;
        return { pollId: key.id, selected: hashes, ...names && { options: names } };
      } catch (e) {
        lastError = e.message;
      }
    }
    return { pollId: key.id, error: lastError };
  }
  /** The secret of a message we sent or received (events and polls are answered with it). */
  secretOf(id) {
    return this.#secrets.byId(id);
  }
  /** Comments and encrypted reactions: decrypted with the parent post's secret, or an error saying why not. */
  #addon(raw, who, chat) {
    for (const [field, useCase] of [
      ["encCommentMessage", "Enc Comment"],
      ["encReactionMessage", "Enc Reaction"]
    ]) {
      const enc2 = raw[field];
      const key = enc2?.targetMessageKey;
      if (!key?.id || !enc2?.encPayload || !enc2?.encIv) continue;
      const parentSender = key.fromMe ? this.d.creds.me?.id ?? "" : key.participant ?? key.remoteJid ?? chat;
      const secret = this.#secrets.byId(key.id);
      if (!secret) return { kind: useCase, targetId: key.id, error: "parent secret unknown" };
      const strip = (j) => j.replace(/:\d+@/, "@");
      try {
        const message = decryptAddon(
          { encPayload: new Uint8Array(enc2.encPayload), encIv: new Uint8Array(enc2.encIv) },
          {
            parentMsgId: key.id,
            parentSenderJid: strip(parentSender),
            modifierJid: strip(who),
            secret,
            useCase
          }
        );
        return { kind: useCase, targetId: key.id, message };
      } catch (e) {
        return { kind: useCase, targetId: key.id, error: e.message };
      }
    }
    return void 0;
  }
  #eventResponse(raw, responder, chat) {
    const enc2 = raw["encEventResponseMessage"];
    const key = enc2?.eventCreationMessageKey;
    if (!key?.id || !enc2?.encPayload || !enc2?.encIv) return void 0;
    const creator = key.fromMe ? this.d.creds.me?.id ?? "" : key.participant ?? key.remoteJid ?? chat;
    const secret = this.#secrets.byId(key.id);
    if (!secret) return { eventId: key.id, error: "event secret unknown" };
    try {
      const r = decryptEventResponse(
        { encPayload: new Uint8Array(enc2.encPayload), encIv: new Uint8Array(enc2.encIv) },
        { eventMsgId: key.id, eventCreatorJid: creator, responderJid: responder, secret }
      );
      return { eventId: key.id, ...r };
    } catch (e) {
      return { eventId: key.id, error: e.message };
    }
  }
  /** A peer-category stanza (the phone talking to its linked devices) from our own account. */
  #isOwnPeer(node, author) {
    return node.attrs["category"] === "peer" && this.#isOwnAccount(author);
  }
  /** Is this JID (any device) one of our own account's, by phone number or LID? */
  #isOwnAccount(jid) {
    const me = this.d.creds.me;
    if (!me) return false;
    try {
      const a = jidDecode(jid);
      const same = (other) => {
        const b = jidDecode(other);
        return a.user === b.user && a.domainType === b.domainType;
      };
      return same(me.id) || me.lid !== void 0 && same(me.lid);
    } catch {
      return false;
    }
  }
  /** Meta AI reply: decrypt with the secret of the message it answers (see meta-ai.ts). */
  #decryptMsmsg(node, author, data) {
    const { creds } = this.d;
    const meta = children(node, "meta")[0]?.attrs ?? {};
    const bot = children(node, "bot")[0]?.attrs ?? {};
    const botEditTargetId = bot["edit_target_id"] || void 0;
    const candidates = this.#secrets.candidates(
      [botEditTargetId, meta["target_id"], node.attrs["id"]],
      node.attrs["from"] ?? ""
    );
    if (candidates.length === 0)
      throw new Error("msmsg: no messageSecret known for the original message");
    const m = protoType("MessageSecretMessage").toObject(
      protoType("MessageSecretMessage").decode(data),
      {
        bytes: Buffer
      }
    );
    if (!m.encIv || !m.encPayload) throw new Error("msmsg: missing encIv/encPayload");
    let last;
    for (const secret of candidates) {
      try {
        return decryptMsmsg(
          secret,
          {
            // In a 1:1 chat with the bot the stanza has no participant: the bot is `from`.
            botJid: author,
            meId: creds.me?.id ?? "",
            meLid: creds.me?.lid,
            targetSenderJid: meta["target_sender_jid"],
            botEditTargetId,
            metaTargetId: meta["target_id"],
            stanzaId: node.attrs["id"]
          },
          m.encIv,
          m.encPayload
        );
      } catch (e) {
        last = e;
      }
    }
    throw last instanceof Error ? last : new Error("msmsg decryption failed");
  }
  async #decodeAndApply(node, plain, author, id, chat, lenient) {
    const T = protoType("Message");
    let decoded = T.decode(plain);
    if (lenient) {
      try {
        const unpadded = T.decode(unpadRandomMax16(plain));
        if (Object.keys(unpadded.toJSON()).some((k) => k !== "messageContextInfo"))
          decoded = unpadded;
      } catch {
      }
    }
    const asJson = T.toObject(decoded, { longs: String, bytes: String, enums: String });
    const raw = T.toObject(decoded, { bytes: Buffer });
    const secret = raw.messageContextInfo?.messageSecret;
    if (secret && !this.#ownIds.has(id) && !this.#secrets.has(id))
      this.#secrets.set(id, secret, chat);
    const shared = raw.protocolMessage?.appStateSyncKeyShare?.keys;
    if (shared?.length && this.d.onAppStateKeys && !this.#isOwnPeer(node, author)) {
      this.d.logger.event("appstate.key-share-rejected", { author, count: shared.length });
    } else if (shared?.length && this.d.onAppStateKeys) {
      const keys = shared.flatMap(
        (k) => k.keyId?.keyId && k.keyData?.keyData ? [{ keyId: new Uint8Array(k.keyId.keyId), keyData: new Uint8Array(k.keyData.keyData) }] : []
      );
      if (keys.length) this.d.onAppStateKeys(keys);
    }
    const pdo = raw.protocolMessage?.peerDataOperationRequestResponseMessage?.peerDataOperationResult;
    if (pdo?.length && this.d.onResentMessage) {
      if (!this.#isOwnPeer(node, author)) {
        this.d.logger.event("resend.rejected", { author });
      } else {
        for (const r of pdo) {
          const bytes2 = r.placeholderMessageResendResponse?.webMessageInfoBytes;
          if (bytes2) this.d.onResentMessage(new Uint8Array(bytes2));
        }
      }
    }
    const hist = raw.protocolMessage?.historySyncNotification;
    if (hist && this.d.onHistory && this.#isOwnPeer(node, author)) {
      const b = (x) => x instanceof Uint8Array ? new Uint8Array(x) : void 0;
      const mk = b(hist["mediaKey"]);
      if (mk || hist["initialHistBootstrapInlinePayload"]) {
        const inline = b(hist["initialHistBootstrapInlinePayload"]);
        this.d.onHistory({
          ref: {
            ...typeof hist["directPath"] === "string" && { directPath: hist["directPath"] },
            mediaKey: mk ?? new Uint8Array(32),
            ...b(hist["fileSha256"]) && { fileSha256: b(hist["fileSha256"]) },
            ...b(hist["fileEncSha256"]) && { fileEncSha256: b(hist["fileEncSha256"]) },
            ...hist["fileLength"] !== void 0 && { fileLength: Number(hist["fileLength"]) }
          },
          ...typeof hist["syncType"] === "number" || typeof hist["syncType"] === "string" ? { syncType: String(hist["syncType"]) } : {},
          ...hist["chunkOrder"] !== void 0 && { chunkOrder: Number(hist["chunkOrder"]) },
          ...hist["progress"] !== void 0 && { progress: Number(hist["progress"]) },
          ...inline && { inline }
        });
        this.#sendSafe({
          tag: "receipt",
          attrs: { id: node.attrs["id"] ?? "", to: node.attrs["from"] ?? "", type: "hist_sync" }
        });
      }
    } else if (hist) {
      this.d.logger.event("history.rejected", { author });
    }
    const skdm = raw.senderKeyDistributionMessage;
    if (skdm?.axolotlSenderKeyDistributionMessage && skdm.groupId) {
      await this.d.cipher.processSenderKeyDistribution(
        skdm.groupId,
        signalAddressString(author),
        new Uint8Array(skdm.axolotlSenderKeyDistributionMessage)
      );
      this.d.logger.event("sender-key.installed", { group: skdm.groupId, author });
    }
    this.#notePoll(id, asJson, author);
    const vote = this.#pollVote(raw, author, chat);
    if (vote) asJson["pollVote"] = vote;
    const addon = this.#addon(raw, author, chat);
    if (addon) asJson["addon"] = addon;
    const rsvp = this.#eventResponse(raw, author, chat);
    if (rsvp) asJson["eventResponse"] = rsvp;
    const text4 = lenient ? extractMetaAiText(asJson) : void 0;
    return { json: text4 !== void 0 ? { ...asJson, metaAiText: text4 } : asJson };
  }
  /** Ask the sender to re-encrypt for us; from the 2nd attempt on, include our key bundle. */
  async #sendRetry(node) {
    const { creds, logger } = this.d;
    const id = node.attrs["id"] ?? "";
    const key = `${id}:${node.attrs["participant"] ?? ""}`;
    const count = (this.#retryCounts.get(key) ?? 0) + 1;
    if (count > MAX_RETRIES) {
      logger.event("retry.giving-up", { id });
      const from = node.attrs["from"] ?? "";
      const participant = node.attrs["participant"];
      if (id && from)
        this.d.onUndecryptable?.({
          remoteJid: from,
          id,
          fromMe: false,
          ...participant && { participant }
        });
      return;
    }
    this.#retryCounts.set(key, count);
    const attrs = { id, type: "retry", to: node.attrs["from"] ?? "" };
    if (node.attrs["recipient"]) attrs["recipient"] = node.attrs["recipient"];
    if (node.attrs["participant"]) attrs["participant"] = node.attrs["participant"];
    const content = [
      {
        tag: "retry",
        attrs: { count: String(count), id, t: node.attrs["t"] ?? "", v: "1", error: "1" }
      },
      { tag: "registration", attrs: {}, content: be3(creds.registrationId, 4) }
    ];
    if (count > 1 && creds.account) {
      const [pre] = await this.#generatePreKeys(1);
      content.push({
        tag: "keys",
        attrs: {},
        content: [
          { tag: "type", attrs: {}, content: Buffer.from([5]) },
          { tag: "identity", attrs: {}, content: creds.signedIdentityKey.publicKey },
          xmppPreKey(pre),
          xmppSignedPreKey(creds),
          { tag: "device-identity", attrs: {}, content: creds.account }
        ]
      });
    }
    this.#sendSafe({ tag: "receipt", attrs, content });
    logger.event("retry.sent", { id, count, withKeys: count > 1 });
  }
  #sendSafe(node) {
    try {
      this.d.send(node);
    } catch (error) {
      this.d.logger.event("send.failed", { tag: node.tag, error });
    }
  }
};
var xmppPreKey = (k) => ({
  tag: "key",
  attrs: {},
  content: [
    { tag: "id", attrs: {}, content: be3(k.id, 3) },
    { tag: "value", attrs: {}, content: k.publicKey }
  ]
});
var xmppSignedPreKey = (creds) => ({
  tag: "skey",
  attrs: {},
  content: [
    { tag: "id", attrs: {}, content: be3(creds.signedPreKey.keyId, 3) },
    { tag: "value", attrs: {}, content: creds.signedPreKey.publicKey },
    { tag: "signature", attrs: {}, content: creds.signedPreKey.signature }
  ]
});

// src/client/antiban.ts
var import_node_crypto9 = require("crypto");
var AntiBanError = class extends Error {
  constructor(message, reason) {
    super(message);
    this.reason = reason;
    this.name = "AntiBanError";
  }
  reason;
};
var ANTIBAN_DEFAULTS = {
  maxPerMinute: 12,
  maxPerHour: 400,
  maxPerDay: 2500,
  minDelayMs: 1200,
  maxDelayMs: 4e3,
  newChatDelayMs: 2e3,
  maxIdenticalMessages: 10,
  identicalWindowMs: 30 * 6e4,
  burstAllowance: 5,
  burstResetMs: 3e4,
  warmUpDays: 0,
  typing: false
};
var MINUTE = 6e4;
var HOUR = 60 * MINUTE;
var DAY2 = 24 * HOUR;
var realClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms))
};
var AntiBan = class {
  constructor(config = {}, clock = realClock, random = Math.random) {
    this.clock = clock;
    this.random = random;
    this.config = { ...ANTIBAN_DEFAULTS, ...config };
  }
  clock;
  random;
  config;
  #sent = [];
  #identical = /* @__PURE__ */ new Map();
  #chats = /* @__PURE__ */ new Set();
  #burst = 0;
  #last = 0;
  #tail = Promise.resolve();
  /** Fraction of the caps that applies right now (1 = full). */
  warmUpFactor() {
    const { warmUpDays, firstSeen } = this.config;
    if (!warmUpDays || firstSeen === void 0) return 1;
    const age = (this.clock.now() - firstSeen) / DAY2;
    return Math.min(1, Math.max(0.1, age / warmUpDays));
  }
  /** Stable key of a message's content for the identical-text check. */
  static signature(content) {
    return (0, import_node_crypto9.createHash)("sha1").update(content).digest("hex");
  }
  /**
   * Wait until sending `signature` to `chat` is fine, or throw `AntiBanError`. Calls are served in order, so a loop
   * that fires many sends at once is spread out.
   */
  gate(chat, signature) {
    const run = this.#tail.then(() => this.#gate(chat, signature));
    this.#tail = run.catch(() => void 0);
    return run;
  }
  async #gate(chat, signature) {
    const c = this.config;
    const f = this.warmUpFactor();
    const cap = (n) => Math.max(1, Math.floor(n * f));
    let now = this.clock.now();
    this.#prune(now);
    if (this.#count(now, DAY2) >= cap(c.maxPerDay))
      throw new AntiBanError("daily message cap reached", "day-limit");
    if (this.#count(now, HOUR) >= cap(c.maxPerHour))
      throw new AntiBanError("hourly message cap reached", "hour-limit");
    const same = this.#identical.get(signature) ?? [];
    if (same.length >= c.maxIdenticalMessages)
      throw new AntiBanError("too many identical messages", "identical-messages");
    const minute = this.#sent.filter((t) => now - t < MINUTE);
    if (minute.length >= cap(c.maxPerMinute)) {
      await this.clock.sleep(minute[0] + MINUTE - now + 1);
      now = this.clock.now();
    }
    if (now - this.#last > c.burstResetMs) this.#burst = 0;
    let gap = 0;
    if (this.#burst >= c.burstAllowance)
      gap = c.minDelayMs + this.random() * (c.maxDelayMs - c.minDelayMs);
    gap = Math.max(0, gap - (now - this.#last));
    const wait = gap + (this.#chats.has(chat) ? 0 : c.newChatDelayMs);
    if (wait > 0) {
      await this.clock.sleep(wait);
      now = this.clock.now();
    }
    this.#burst++;
    this.#last = now;
    this.#chats.add(chat);
    this.#sent.push(now);
    this.#identical.set(signature, [...same, now]);
  }
  #count(now, window2) {
    return this.#sent.filter((t) => now - t < window2).length;
  }
  #prune(now) {
    while (this.#sent.length && now - this.#sent[0] >= DAY2) this.#sent.shift();
    for (const [k, v] of this.#identical) {
      const keep = v.filter((t) => now - t < this.config.identicalWindowMs);
      if (keep.length) this.#identical.set(k, keep);
      else this.#identical.delete(k);
    }
  }
  /** How long "typing..." should last for a text (about 40 ms per character, 600 ms to 4 s). */
  typingMs(text4) {
    return Math.min(4e3, Math.max(600, text4.length * 40)) * (0.8 + this.random() * 0.4);
  }
};

// src/client/sender.ts
var import_node_crypto11 = require("crypto");
var import_node_fs11 = require("fs");
var import_node_path7 = require("path");

// src/client/reporting.ts
var import_node_crypto10 = require("crypto");
var IMG = { f: 17, s: [{ f: 21 }, { f: 22 }] };
var FIELDS = [
  { f: 1 },
  { f: 3, s: [{ f: 2 }, { f: 3 }, { f: 8 }, { f: 11 }, IMG, { f: 25 }] },
  { f: 4, s: [{ f: 1 }, { f: 16 }, IMG] },
  { f: 5, s: [{ f: 3 }, { f: 4 }, { f: 5 }, { f: 16 }, IMG] },
  { f: 6, s: [{ f: 1 }, IMG, { f: 30 }] },
  { f: 7, s: [{ f: 2 }, { f: 7 }, { f: 10 }, IMG, { f: 20 }] },
  { f: 8, s: [{ f: 2 }, { f: 7 }, { f: 9 }, IMG, { f: 21 }] },
  { f: 9, s: [{ f: 2 }, { f: 6 }, { f: 7 }, { f: 13 }, IMG, { f: 20 }] },
  { f: 12, s: [{ f: 1 }, { f: 2 }, { f: 14, m: true }, { f: 15 }] },
  { f: 18, s: [{ f: 6 }, { f: 16 }, IMG] },
  { f: 26, s: [{ f: 4 }, { f: 5 }, { f: 8 }, { f: 13 }, IMG] },
  {
    f: 28,
    s: [{ f: 1 }, { f: 2 }, { f: 4 }, { f: 5 }, { f: 6 }, { f: 7, s: [{ f: 21 }, { f: 22 }] }]
  },
  { f: 37, s: [{ f: 1, m: true }] },
  {
    f: 49,
    s: [
      { f: 2 },
      { f: 3, s: [{ f: 1 }, { f: 2 }] },
      { f: 5, s: [{ f: 21 }, { f: 22 }] },
      { f: 8, s: [{ f: 1 }, { f: 2 }] }
    ]
  },
  { f: 53, s: [{ f: 1, m: true }] },
  { f: 55, s: [{ f: 1, m: true }] },
  { f: 58, s: [{ f: 1, m: true }] },
  { f: 59, s: [{ f: 1, m: true }] },
  {
    f: 60,
    s: [
      { f: 2 },
      { f: 3, s: [{ f: 1 }, { f: 2 }] },
      { f: 5, s: [{ f: 21 }, { f: 22 }] },
      { f: 8, s: [{ f: 1 }, { f: 2 }] }
    ]
  },
  {
    f: 64,
    s: [
      { f: 2 },
      { f: 3, s: [{ f: 1 }, { f: 2 }] },
      { f: 5, s: [{ f: 21 }, { f: 22 }] },
      { f: 8, s: [{ f: 1 }, { f: 2 }] }
    ]
  },
  { f: 66, s: [{ f: 2 }, { f: 6 }, { f: 7 }, { f: 13 }, IMG, { f: 20 }] },
  { f: 74, s: [{ f: 1, m: true }] },
  { f: 87, s: [{ f: 1, m: true }] },
  { f: 88, s: [{ f: 1 }, { f: 2, s: [{ f: 1 }] }, { f: 3, s: [{ f: 21 }, { f: 22 }] }] },
  { f: 92, s: [{ f: 1, m: true }] },
  { f: 93, s: [{ f: 1, m: true }] },
  { f: 94, s: [{ f: 1, m: true }] }
];
var compile = (fields) => new Map(fields.map((f) => [f.f, { m: f.m, children: f.s ? compile(f.s) : void 0 }]));
var COMPILED = compile(FIELDS);
var EMPTY = /* @__PURE__ */ new Map();
function readVarint(buf, offset) {
  let value = 0;
  let bytes2 = 0;
  let shift = 0;
  while (offset + bytes2 < buf.length) {
    const cur = buf[offset + bytes2];
    value |= (cur & 127) << shift;
    bytes2++;
    if ((cur & 128) === 0) return { value, bytes: bytes2 };
    shift += 7;
    if (shift > 35) return void 0;
  }
  return void 0;
}
function writeVarint(value) {
  const parts = [];
  let rest = value >>> 0;
  while (rest > 127) {
    parts.push(rest & 127 | 128);
    rest >>>= 7;
  }
  parts.push(rest);
  return Buffer.from(parts);
}
function extract(data, cfg) {
  const out = [];
  let i = 0;
  while (i < data.length) {
    const tag = readVarint(data, i);
    if (!tag) return void 0;
    const num3 = tag.value >> 3;
    const wire = tag.value & 7;
    const start = i;
    i += tag.bytes;
    const field = cfg.get(num3);
    const keepOrSkip = (end) => {
      if (end > data.length) return false;
      if (field) out.push({ num: num3, bytes: Buffer.from(data.subarray(start, end)) });
      i = end;
      return true;
    };
    if (wire === 0) {
      const v = readVarint(data, i);
      if (!v || !keepOrSkip(i + v.bytes)) return void 0;
    } else if (wire === 1) {
      if (!keepOrSkip(i + 8)) return void 0;
    } else if (wire === 5) {
      if (!keepOrSkip(i + 4)) return void 0;
    } else if (wire === 2) {
      const len = readVarint(data, i);
      if (!len) return void 0;
      const valStart = i + len.bytes;
      const valEnd = valStart + len.value;
      if (valEnd > data.length) return void 0;
      if (!field) {
        i = valEnd;
      } else if (field.m || field.children) {
        const sub = extract(data.subarray(valStart, valEnd), field.children ?? EMPTY);
        if (!sub) return void 0;
        if (sub.length > 0)
          out.push({
            num: num3,
            bytes: Buffer.concat([writeVarint(tag.value), writeVarint(sub.length), sub])
          });
        i = valEnd;
      } else {
        out.push({ num: num3, bytes: Buffer.from(data.subarray(start, valEnd)) });
        i = valEnd;
      }
    } else {
      return void 0;
    }
  }
  out.sort((a, b) => a.num - b.num);
  return Buffer.concat(out.map((f) => f.bytes));
}
function reportableContent(encodedMessage) {
  const c = extract(encodedMessage, COMPILED);
  return c && c.length > 0 ? c : void 0;
}
function reportingNode(encodedMessage, messageSecret, key) {
  const info = Buffer.concat([
    Buffer.from(key.id),
    Buffer.from(key.from),
    Buffer.from(key.to),
    Buffer.from("Report Token")
  ]);
  const secret = Buffer.from((0, import_node_crypto10.hkdfSync)("sha256", messageSecret, Buffer.alloc(0), info, 32));
  const content = extract(encodedMessage, COMPILED);
  if (!content || content.length === 0) return void 0;
  const token = (0, import_node_crypto10.createHmac)("sha256", secret).update(content).digest().subarray(0, 16);
  return {
    tag: "reporting",
    attrs: {},
    content: [{ tag: "reporting_token", attrs: { v: "2" }, content: token }]
  };
}

// src/client/sender.ts
var S_WHATSAPP_NET2 = "s.whatsapp.net";
var SENT_CACHE_SIZE = 500;
var MAX_RESEND_COUNT = 5;
var children2 = (n, tag) => Array.isArray(n.content) ? n.content.filter((c) => tag === void 0 || c.tag === tag) : [];
function padRandomMax16(data) {
  const n = ((0, import_node_crypto11.randomBytes)(1)[0] & 15) + 1;
  return Buffer.concat([data, Buffer.alloc(n, n)]);
}
function generateMessageId(meId) {
  const data = Buffer.alloc(8 + 20 + 16);
  data.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1e3)));
  const user = jidDecode(meId).user;
  data.write(user, 8);
  data.write("@c.us", 8 + user.length);
  (0, import_node_crypto11.randomBytes)(16).copy(data, 28);
  return "3EB0" + (0, import_node_crypto11.createHash)("sha256").update(data).digest("hex").toUpperCase().slice(0, 18);
}
var Sender = class {
  constructor(d) {
    this.d = d;
    this.#memory = d.senderKeyMemoryPath && (0, import_node_fs11.existsSync)(d.senderKeyMemoryPath) ? JSON.parse((0, import_node_fs11.readFileSync)(d.senderKeyMemoryPath, "utf8")) : {};
  }
  d;
  /** Recently sent messages, kept so a device that could not decrypt one can be answered (retry receipts). */
  #sent = /* @__PURE__ */ new Map();
  /** phone-number user -> LID user, learned from usync, so an answer from either identity counts as the same person. */
  #lidAlias = /* @__PURE__ */ new Map();
  /** Resends done per message+device (we do not trust the count in the receipt). */
  #resends = /* @__PURE__ */ new Map();
  /** `group|senderKeyId` -> the devices that already got that sender key (keyed by the key's owner: see #groupStanza). */
  #memory;
  /** Send plain text to a user or group JID. Returns the message id. */
  async sendText(to, text4) {
    return this.sendMessage(to, { extendedTextMessage: { text: text4 } });
  }
  /** Send an arbitrary WAProto `Message` (plain object form). */
  async sendMessage(to, message, opts = {}) {
    const { creds } = this.d;
    if (!creds.me) throw new Error("not paired");
    await this.d.gate?.(to, message);
    const id = opts.messageId ?? generateMessageId(creds.me.id);
    const withSecret = withMessageSecret(message);
    if (to.endsWith("@newsletter")) {
      const { messageContextInfo: info, ...bare3 } = message;
      const association = info?.messageAssociation;
      const post = channelPost({
        ...bare3,
        ...association ? { messageContextInfo: { messageAssociation: association } } : {}
      });
      const stanza2 = {
        tag: "message",
        attrs: { id, to, type: messageType(post), ...opts.stanzaAttrs },
        content: [
          {
            tag: "plaintext",
            attrs: { ...opts.encAttrs },
            content: encodeProto("Message", post)
          },
          ...opts.extraNodes ?? []
        ]
      };
      this.d.logger.event("send.message", { id, to });
      const ack = await this.d.receiver.sendAndWaitAck(stanza2);
      opts.onAck?.(ack);
      this.d.logger.event("send.acked", { id, to });
      return id;
    }
    this.#remember(id, to, withSecret);
    this.d.onSent?.(id, to, withSecret);
    const stanza = to.endsWith("@g.us") || to === "status@broadcast" ? await this.#groupStanza(id, to, withSecret, opts) : await this.#directStanza(id, to, withSecret, opts);
    this.d.logger.event("send.message", { id, to });
    await this.d.receiver.sendAndWaitAck(stanza);
    if (!to.endsWith("@g.us") && to !== "status@broadcast" && !message["protocolMessage"])
      this.d.tc?.issueTo(this.d.lids.resolve(to), (n) => this.d.receiver.request(n));
    this.d.logger.event("send.acked", { id, to });
    return id;
  }
  /**
   * Send a "peer" message to our own primary phone (device 0): app-state key requests and similar
   * device-to-device traffic. Wrapped as a deviceSentMessage like every message to our own devices.
   */
  async sendPeerMessage(message) {
    const { creds, logger } = this.d;
    if (!creds.me) throw new Error("not paired");
    const meBare = `${jidDecode(creds.me.id).user}@${S_WHATSAPP_NET2}`;
    const id = generateMessageId(creds.me.id);
    this.#sent.set(id, {
      to: meBare,
      message,
      audience: /* @__PURE__ */ new Set([
        jidDecode(creds.me.id).user,
        ...creds.me.lid ? [jidDecode(creds.me.lid).user] : []
      ]),
      stanzaAttrs: { category: "peer", push_priority: "high_force" },
      extraNodes: [{ tag: "meta", attrs: { appdata: "default" } }]
    });
    await this.assertSessions([meBare]);
    const a = this.addr(meBare);
    const body = { deviceSentMessage: { destinationJid: meBare, message } };
    const enc2 = await this.d.cipher.encrypt(
      a.name,
      a.device,
      padRandomMax16(encodeProto("Message", body))
    );
    const content = [
      { tag: "enc", attrs: { v: "2", type: enc2.type }, content: enc2.ciphertext },
      { tag: "meta", attrs: { appdata: "default" } }
    ];
    if (enc2.type === "pkmsg" && creds.account)
      content.push({ tag: "device-identity", attrs: {}, content: creds.account });
    logger.event("send.peer", { id, kind: Object.keys(message)[0] });
    await this.d.receiver.sendAndWaitAck({
      tag: "message",
      attrs: { id, to: meBare, type: "text", category: "peer", push_priority: "high_force" },
      content
    });
    return id;
  }
  /** Signal address for a device JID, through the LID mapping. */
  addr(jid) {
    return signalAddress(this.d.lids.resolve(jid));
  }
  /** Record who a message was actually sent to: only they may later ask for a resend. */
  #setAudience(id, devices) {
    const entry2 = this.#sent.get(id);
    if (!entry2) return;
    const users = new Set(devices.map((d) => d.user));
    for (const u of [...users]) {
      const alias = this.#lidAlias.get(u);
      if (alias) users.add(alias);
    }
    entry2.audience = users;
  }
  #remember(id, to, message) {
    this.#sent.set(id, { to, message });
    if (this.#sent.size > SENT_CACHE_SIZE) this.#sent.delete(this.#sent.keys().next().value);
  }
  /**
   * A device told us (`<receipt type="retry">`) that it could not decrypt one of our messages: re-encrypt
   * it for exactly that device, with a fresh session when the receipt carries a key bundle.
   */
  async handleRetryReceipt(receipt) {
    const { creds, logger } = this.d;
    const id = receipt.attrs["id"] ?? "";
    const cached = this.#sent.get(id);
    const target = receipt.attrs["participant"] ?? receipt.attrs["from"] ?? "";
    if (!cached || !target) {
      logger.event("retry.unknown-message", { id, target });
      return false;
    }
    if (!receipt.attrs["from"]) return false;
    const targetUser = jidDecode(target).user;
    const chatOk = cached.to.endsWith("@g.us") ? receipt.attrs["from"] === cached.to && !!receipt.attrs["participant"] : true;
    if (!chatOk || !cached.audience?.has(targetUser)) {
      logger.event("retry.rejected", { id, target, reason: "not an original recipient" });
      return false;
    }
    const retry = children2(receipt, "retry")[0];
    const claimed = Number(retry?.attrs["count"] ?? 1);
    const resendKey = `${id}|${target}`;
    const done = this.#resends.get(resendKey) ?? 0;
    if (!(claimed >= 1) || done >= MAX_RESEND_COUNT) return false;
    this.#resends.set(resendKey, done + 1);
    if (this.#resends.size > SENT_CACHE_SIZE * 4)
      this.#resends.delete(this.#resends.keys().next().value);
    const count = Math.min(Math.max(claimed, done + 1), MAX_RESEND_COUNT);
    const keys = children2(receipt, "keys")[0];
    if (keys) {
      const registration = children2(receipt, "registration")[0]?.content;
      const node = {
        tag: "user",
        attrs: { jid: target },
        content: [
          ...registration ? [{ tag: "registration", attrs: {}, content: registration }] : [],
          ...Array.isArray(keys.content) ? keys.content.filter((c) => c.tag !== "device-identity") : []
        ]
      };
      const a2 = this.addr(target);
      await this.d.cipher.processPreKeyBundle(a2.name, a2.device, parseBundle(node));
      logger.event("retry.session-from-keys", { id, target });
    } else {
      await this.assertSessions([target]);
    }
    const { user: meUser } = jidDecode(creds.me.id);
    const targetIsMe = jidDecode(target).user === meUser || !!creds.me?.lid && jidDecode(target).user === jidDecode(creds.me.lid).user;
    const body = targetIsMe ? {
      deviceSentMessage: { destinationJid: cached.to, message: cached.message },
      ...cached.message["messageContextInfo"] ? { messageContextInfo: cached.message["messageContextInfo"] } : {}
    } : cached.message;
    const a = this.addr(target);
    const enc2 = await this.d.cipher.encrypt(
      a.name,
      a.device,
      padRandomMax16(encodeProto("Message", body))
    );
    const isGroup = cached.to.endsWith("@g.us");
    const attrs = {
      id,
      type: messageType(cached.message),
      ...cached.stanzaAttrs
    };
    if (isGroup) {
      attrs["to"] = cached.to;
      attrs["participant"] = target;
    } else {
      attrs["to"] = target;
      attrs["device_fanout"] = "false";
      if (targetIsMe) attrs["recipient"] = cached.to;
    }
    const content = [
      {
        tag: "enc",
        attrs: { v: "2", type: enc2.type, count: String(count) },
        content: enc2.ciphertext
      }
    ];
    if (creds.account) content.push({ tag: "device-identity", attrs: {}, content: creds.account });
    if (cached.to.endsWith("@s.whatsapp.net")) content.push({ tag: "bot", attrs: { biz_bot: "1" } });
    content.push(...cached.extraNodes ?? []);
    await this.d.receiver.sendAndWaitAck({ tag: "message", attrs, content });
    logger.event("retry.resent", { id, target, count });
    return true;
  }
  // ---- devices -------------------------------------------------------------------------------
  /** All devices (excluding this one) of the given users, via usync. */
  async getDevices(userJids) {
    const { creds, receiver } = this.d;
    const me = jidDecode(creds.me.id);
    const meLidUser = creds.me?.lid ? jidDecode(creds.me.lid).user : void 0;
    const res = await receiver.request({
      tag: "iq",
      attrs: { to: S_WHATSAPP_NET2, type: "get", xmlns: "usync" },
      content: [
        {
          tag: "usync",
          attrs: {
            context: "message",
            mode: "query",
            sid: receiver.nextId(),
            last: "true",
            index: "0"
          },
          content: [
            {
              tag: "query",
              attrs: {},
              content: [
                { tag: "devices", attrs: { version: "2" } },
                { tag: "lid", attrs: {} }
              ]
            },
            {
              tag: "list",
              attrs: {},
              content: userJids.map((jid) => ({ tag: "user", attrs: { jid } }))
            }
          ]
        }
      ]
    });
    const list = children2(children2(children2(res, "usync")[0] ?? res, "list")[0] ?? res, "user");
    const out = [];
    for (const user of list) {
      const jid = user.attrs["jid"] ?? "";
      const { user: u, server: server2 } = jidDecode(jid);
      const lid = children2(user, "lid")[0]?.attrs["val"];
      if (lid && server2 !== "lid") {
        this.#lidAlias.set(u, jidDecode(lid).user);
        this.d.lids.set(jid, lid);
      }
      const deviceList = children2(
        children2(children2(user, "devices")[0] ?? user, "device-list")[0] ?? user,
        "device"
      );
      for (const dev of deviceList) {
        const device = Number(dev.attrs["id"]);
        if (device !== 0 && !dev.attrs["key-index"]) continue;
        if (device === 99) continue;
        const isThisDevice = (u === me.user || u === meLidUser) && device === me.device;
        if (isThisDevice) continue;
        out.push({
          jid: device === 0 ? `${u}@${server2}` : `${u}:${device}@${server2}`,
          user: u,
          device
        });
      }
    }
    this.d.logger.event("send.devices", { users: userJids, devices: out.map((o) => o.jid) });
    return out;
  }
  /** Make sure a Signal session exists for each device, fetching pre-key bundles for the missing ones. */
  async assertSessions(jids) {
    const missing = [];
    for (const jid of new Set(jids)) {
      const a = this.addr(jid);
      if (!await this.d.cipher.hasSession(a.name, a.device)) missing.push(jid);
    }
    if (!missing.length) return;
    const res = await this.d.receiver.request({
      tag: "iq",
      attrs: { xmlns: "encrypt", type: "get", to: S_WHATSAPP_NET2 },
      content: [
        {
          tag: "key",
          attrs: {},
          content: missing.map((jid) => ({
            tag: "user",
            attrs: { jid: this.d.lids.resolve(jid) }
          }))
        }
      ]
    });
    for (const user of children2(children2(res, "list")[0] ?? res, "user")) {
      const jid = user.attrs["jid"] ?? "";
      if (children2(user, "error").length) {
        this.d.logger.event("send.prekey-error", { jid, error: children2(user, "error")[0]?.attrs });
        continue;
      }
      const bundle = parseBundle(user);
      const a = this.addr(jid);
      await this.d.cipher.processPreKeyBundle(a.name, a.device, bundle);
      this.d.logger.event("send.session-created", { jid });
    }
  }
  /**
   * Encrypt one message (e.g. a call key) separately for each device. Sessions are fetched first; a device that
   * cannot be keyed is skipped, as the app does, so one broken device does not stop the rest.
   */
  async encryptForDevices(jids, message) {
    await this.assertSessions(jids);
    const plain = padRandomMax16(encodeProto("Message", message));
    const out = [];
    for (const jid of jids) {
      try {
        const a = this.addr(jid);
        const enc2 = await this.d.cipher.encrypt(a.name, a.device, plain);
        out.push({ jid, type: enc2.type, ciphertext: enc2.ciphertext });
      } catch (e) {
        this.d.logger.event("call.encrypt-skipped", { jid, error: e });
      }
    }
    return out;
  }
  // ---- 1:1 -----------------------------------------------------------------------------------
  async #directStanza(id, to, message, opts) {
    const { creds } = this.d;
    const meUser = jidDecode(creds.me.id).user;
    const ownBare = `${meUser}@${S_WHATSAPP_NET2}`;
    const selfChat = jidDecode(to).user === meUser;
    const devices = await this.getDevices([.../* @__PURE__ */ new Set([ownBare, to])]);
    const toUser = jidDecode(to).user;
    const mine = devices.filter(
      (d) => d.user === meUser || d.user === (creds.me?.lid ? jidDecode(creds.me.lid).user : "#")
    );
    const picked = devices.filter((d) => !mine.includes(d));
    const others = picked.filter(
      (d) => opts.devices === "primary" || opts.devices === "no-linked" ? d.device === 0 : true
    );
    if (!others.length && !selfChat) throw new Error(`no devices found for ${to} (user ${toUser})`);
    const ownKept = opts.devices === "recipient" || opts.devices === "primary" ? [] : mine;
    await this.assertSessions([...ownKept, ...others].map((d) => d.jid));
    this.#setAudience(id, [...ownKept, ...others]);
    const ownTargets = opts.devices === "recipient" || opts.devices === "primary" ? [] : mine;
    const dsm = {
      deviceSentMessage: { destinationJid: to, message },
      ...message["messageContextInfo"] ? { messageContextInfo: message["messageContextInfo"] } : {}
    };
    const participants = [];
    let needsIdentity = false;
    for (const [targets, msg] of [
      [ownTargets, dsm],
      [others, message]
    ]) {
      const plain = padRandomMax16(encodeProto("Message", msg));
      for (const t of targets) {
        const a = this.addr(t.jid);
        const enc2 = await this.d.cipher.encrypt(a.name, a.device, plain);
        if (enc2.type === "pkmsg") needsIdentity = true;
        const ownLid = creds.me?.lid ? jidDecode(creds.me.lid).user : void 0;
        const jid = to.endsWith("@lid") && ownLid && (t.user === meUser || t.user === ownLid) ? t.device === 0 ? `${ownLid}@lid` : `${ownLid}:${t.device}@lid` : t.jid;
        participants.push({
          tag: "to",
          attrs: { jid },
          content: [
            {
              tag: "enc",
              attrs: { v: "2", type: enc2.type, ...opts.encAttrs },
              content: enc2.ciphertext
            }
          ]
        });
      }
    }
    const content = [{ tag: "participants", attrs: {}, content: participants }];
    if (needsIdentity && creds.account)
      content.push({ tag: "device-identity", attrs: {}, content: creds.account });
    const reporting = this.#reporting(
      id,
      to.endsWith("@lid") && this.d.creds.me?.lid ? this.d.creds.me.lid : this.d.creds.me.id,
      to,
      message
    );
    if (reporting) content.push(reporting);
    if (to.endsWith("@s.whatsapp.net")) content.push({ tag: "bot", attrs: { biz_bot: "1" } });
    const tc = this.#tcToken(to);
    if (tc) content.push({ tag: "tctoken", attrs: {}, content: tc });
    content.push(...opts.extraNodes ?? []);
    return {
      tag: "message",
      attrs: {
        id,
        to,
        type: messageType(message),
        ...opts.devices && !selfChat && { device_fanout: "false" },
        ...opts.stanzaAttrs
      },
      content
    };
  }
  /** The trusted-contact token for a 1:1 message (kept under the LID address once that is known). */
  #tcToken(to) {
    if (!this.d.tc) return void 0;
    const me = this.d.creds.me;
    if (me && jidDecode(to).user === jidDecode(me.id).user) return void 0;
    return this.d.tc.tokenFor(this.d.lids.resolve(to)) ?? this.d.tc.tokenFor(to);
  }
  // ---- groups --------------------------------------------------------------------------------
  /** Participant JIDs and addressing mode of a group. */
  async groupParticipants(group) {
    const res = await this.d.receiver.request({
      tag: "iq",
      attrs: { type: "get", xmlns: "w:g2", to: group },
      content: [{ tag: "query", attrs: { request: "interactive" } }]
    });
    const g = children2(res, "group")[0];
    if (!g) throw new Error(`no group metadata for ${group}`);
    for (const p of children2(g, "participant")) {
      const jid = p.attrs["jid"] ?? "";
      const other = p.attrs["phone_number"] ?? p.attrs["lid"];
      if (jid && other) this.d.lids.set(jid, other);
    }
    return {
      participants: children2(g, "participant").map((p) => p.attrs["jid"] ?? "").filter(Boolean),
      addressingMode: g.attrs["addressing_mode"] ?? "lid"
    };
  }
  async #groupStanza(id, group, message, opts) {
    const { creds } = this.d;
    const isStatus = group === "status@broadcast";
    if (isStatus && !opts.statusRecipients?.length)
      throw new Error("a status needs statusRecipients");
    const { participants, addressingMode } = isStatus ? { participants: opts.statusRecipients, addressingMode: "lid" } : await this.groupParticipants(group);
    const devices = await this.getDevices(participants);
    this.#setAudience(id, devices);
    const senderId = addressingMode === "lid" && creds.me?.lid ? creds.me.lid : creds.me.id;
    const senderKeyId = signalAddressString(senderId);
    const skdm = await this.d.cipher.createSenderKeyDistribution(group, senderKeyId);
    const skmsg = await this.d.cipher.groupEncrypt(
      group,
      senderKeyId,
      padRandomMax16(encodeProto("Message", message))
    );
    const memoryKey = `${group}|${senderKeyId}`;
    const known = new Set(this.#memory[memoryKey] ?? []);
    const fresh = devices.filter((d) => !known.has(d.jid));
    const nodes = [];
    let needsIdentity = false;
    if (fresh.length) {
      await this.assertSessions(fresh.map((d) => d.jid));
      const dist = padRandomMax16(
        encodeProto("Message", {
          senderKeyDistributionMessage: {
            groupId: group,
            axolotlSenderKeyDistributionMessage: skdm
          }
        })
      );
      for (const t of fresh) {
        const a = this.addr(t.jid);
        const enc2 = await this.d.cipher.encrypt(a.name, a.device, dist);
        if (enc2.type === "pkmsg") needsIdentity = true;
        nodes.push({
          tag: "to",
          attrs: { jid: t.jid },
          content: [
            {
              tag: "enc",
              attrs: { v: "2", type: enc2.type, ...opts.encAttrs },
              content: enc2.ciphertext
            }
          ]
        });
        known.add(t.jid);
      }
      for (const k of Object.keys(this.#memory))
        if (k === group || k.startsWith(`${group}|`) && k !== memoryKey) delete this.#memory[k];
      this.#memory[memoryKey] = [...known];
      this.#saveMemory();
    }
    const content = [
      { tag: "enc", attrs: { v: "2", type: "skmsg", ...opts.encAttrs }, content: skmsg }
    ];
    if (nodes.length) content.unshift({ tag: "participants", attrs: {}, content: nodes });
    if (needsIdentity && creds.account)
      content.push({ tag: "device-identity", attrs: {}, content: creds.account });
    if (/^\d{1,15}-\d+@g\.us$/.test(group) && !message["reactionMessage"])
      content.push({ tag: "multicast", attrs: {} });
    const reporting = this.#reporting(id, senderId, group, message);
    if (reporting) content.push(reporting);
    if (isStatus && !opts.stanzaAttrs?.["edit"])
      content.push({
        tag: "meta",
        attrs: { status_setting: opts.statusPrivacy ?? "contacts", session_scope: "status" }
      });
    content.push(...opts.extraNodes ?? []);
    return {
      tag: "message",
      attrs: {
        id,
        to: group,
        type: messageType(message),
        ...isStatus ? {} : { addressing_mode: addressingMode },
        ...opts.stanzaAttrs
      },
      content
    };
  }
  /**
   * Reporting token over the unpadded message. The key is bound to the sender and the receiver (the other user in a
   * chat, the group in a group), both as plain user JIDs without a device: that is what a recipient derives when it
   * reports the message, and what the server compares against.
   */
  #reporting(id, from, to, message) {
    const secret = message["messageContextInfo"]?.messageSecret;
    if (!secret || message["reactionMessage"]) return void 0;
    return reportingNode(encodeProto("Message", message), secret, {
      id,
      from: from.replace(/:\d+@/, "@"),
      to: to.replace(/:\d+@/, "@")
    });
  }
  #saveMemory() {
    const path = this.d.senderKeyMemoryPath;
    if (!path) return;
    (0, import_node_fs11.mkdirSync)((0, import_node_path7.dirname)(path), { recursive: true, mode: 448 });
    (0, import_node_fs11.writeFileSync)(`${path}.tmp`, JSON.stringify(this.#memory), { mode: 384 });
    (0, import_node_fs11.renameSync)(`${path}.tmp`, path);
  }
};
function channelPost(message) {
  const ext = message["extendedTextMessage"];
  if (ext && typeof ext["text"] === "string" && Object.keys(ext).every((k) => k === "text")) {
    const { extendedTextMessage: _drop, ...rest } = message;
    void _drop;
    return { ...rest, conversation: ext["text"] };
  }
  return message;
}
function withMessageSecret(message) {
  if (message["reactionMessage"] || message["encReactionMessage"] || message["pollUpdateMessage"])
    return message;
  const info = message["messageContextInfo"] ?? {};
  if (info["messageSecret"]) return message;
  return { ...message, messageContextInfo: { ...info, messageSecret: (0, import_node_crypto11.randomBytes)(32) } };
}
function messageType(message) {
  const q = message["questionMessage"]?.message;
  if (q) return messageType(q);
  if (message["reactionMessage"]) return "reaction";
  if (message["pollCreationMessage"] || message["pollCreationMessageV2"] || message["pollCreationMessageV3"] || message["pollCreationMessageV5"])
    return "poll";
  if (message["pollCreationOptionImageMessage"]) return "media";
  if (["imageMessage", "videoMessage", "audioMessage", "documentMessage", "stickerMessage"].some(
    (k) => message[k]
  ))
    return "media";
  return "text";
}
function parseBundle(user) {
  const bytes2 = (n, tag) => {
    const c = n && children2(n, tag)[0]?.content;
    return c instanceof Uint8Array ? c : void 0;
  };
  const uint = (b) => b ? b.reduce((acc, x) => acc * 256 + x, 0) : NaN;
  const skey = children2(user, "skey")[0];
  const key = children2(user, "key")[0];
  const identityKey = bytes2(user, "identity");
  const signedPreKeyPublic = bytes2(skey, "value");
  const signedPreKeySignature = bytes2(skey, "signature");
  if (!identityKey || !signedPreKeyPublic || !signedPreKeySignature)
    throw new Error("incomplete pre-key bundle");
  const { device } = jidDecode(user.attrs["jid"] ?? "");
  return {
    registrationId: uint(bytes2(user, "registration")),
    deviceId: device,
    ...key && { preKeyId: uint(bytes2(key, "id")), preKeyPublic: bytes2(key, "value") },
    signedPreKeyId: uint(bytes2(skey, "id")),
    signedPreKeyPublic,
    signedPreKeySignature,
    identityKey
  };
}

// src/client/features/chat/appstate-sync.ts
var import_node_fs12 = require("fs");
var import_node_path8 = require("path");

// src/client/features/message/media.ts
var import_node_crypto12 = require("crypto");
var HKDF_LABEL = {
  "md-app-state": "App State",
  "md-msg-hist": "History",
  "sticker-pack": "Sticker Pack",
  "sticker-pack-thumbnail": "Sticker Pack Thumbnail",
  image: "Image",
  video: "Video",
  audio: "Audio",
  document: "Document",
  sticker: "Image"
};
var UPLOAD_PATH = {
  image: "/mms/image",
  video: "/mms/video",
  audio: "/mms/audio",
  document: "/mms/document",
  sticker: "/mms/image"
};
var NEWSLETTER_PATH = {
  image: "/newsletter/newsletter-image",
  video: "/newsletter/newsletter-video",
  audio: "/newsletter/newsletter-audio",
  document: "/newsletter/newsletter-document",
  sticker: "/newsletter/newsletter-image"
};
var NEWSLETTER_THUMBNAIL_PATH = "/newsletter/newsletter-thumbnail-image";
var MEDIA_HOST = "mmg.whatsapp.net";
var ORIGIN = "https://web.whatsapp.com";
var MAC_LENGTH = 10;
function mediaKeys(mediaKey, type) {
  const okm = Buffer.from(
    (0, import_node_crypto12.hkdfSync)("sha256", mediaKey, Buffer.alloc(0), `WhatsApp ${HKDF_LABEL[type]} Keys`, 112)
  );
  return { iv: okm.subarray(0, 16), cipherKey: okm.subarray(16, 48), macKey: okm.subarray(48, 80) };
}
function encryptMedia(plain, type, mediaKey = (0, import_node_crypto12.randomBytes)(32)) {
  const { iv, cipherKey, macKey } = mediaKeys(mediaKey, type);
  const cipher = (0, import_node_crypto12.createCipheriv)("aes-256-cbc", cipherKey, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  const mac = (0, import_node_crypto12.createHmac)("sha256", macKey).update(iv).update(body).digest().subarray(0, MAC_LENGTH);
  const encrypted = Buffer.concat([body, mac]);
  return {
    mediaKey,
    encrypted,
    fileSha256: (0, import_node_crypto12.createHash)("sha256").update(plain).digest(),
    fileEncSha256: (0, import_node_crypto12.createHash)("sha256").update(encrypted).digest(),
    fileLength: plain.length
  };
}
function rawMedia(plain) {
  const sha = (0, import_node_crypto12.createHash)("sha256").update(plain).digest();
  return {
    mediaKey: Buffer.alloc(0),
    encrypted: Buffer.from(plain),
    fileSha256: sha,
    fileEncSha256: sha,
    fileLength: plain.length
  };
}
function stripMediaKeys(message) {
  for (const body of Object.values(message)) {
    if (body && typeof body === "object") {
      const b = body;
      delete b["mediaKey"];
      delete b["fileEncSha256"];
      delete b["mediaKeyTimestamp"];
    }
  }
}
function decryptMedia(encrypted, mediaKey, type, expect = {}) {
  if (encrypted.length <= MAC_LENGTH) throw new Error("media payload too short");
  if (expect.fileEncSha256 && !timingSafeEqualSafe((0, import_node_crypto12.createHash)("sha256").update(encrypted).digest(), expect.fileEncSha256)) {
    throw new Error("encrypted media hash mismatch");
  }
  const { iv, cipherKey, macKey } = mediaKeys(mediaKey, type);
  const body = Buffer.from(encrypted.subarray(0, encrypted.length - MAC_LENGTH));
  const mac = Buffer.from(encrypted.subarray(encrypted.length - MAC_LENGTH));
  const expectedMac = (0, import_node_crypto12.createHmac)("sha256", macKey).update(iv).update(body).digest().subarray(0, MAC_LENGTH);
  if (!timingSafeEqualSafe(expectedMac, mac)) throw new Error("media MAC mismatch");
  const d = (0, import_node_crypto12.createDecipheriv)("aes-256-cbc", cipherKey, iv);
  const plain = Buffer.concat([d.update(body), d.final()]);
  if (expect.fileSha256 && !timingSafeEqualSafe((0, import_node_crypto12.createHash)("sha256").update(plain).digest(), expect.fileSha256)) {
    throw new Error("media hash mismatch");
  }
  return plain;
}
var timingSafeEqualSafe = (a, b) => a.length === b.length && (0, import_node_crypto12.timingSafeEqual)(a, b);
var mediaConnRequest = () => ({
  tag: "iq",
  attrs: { type: "set", xmlns: "w:m", to: "s.whatsapp.net" },
  content: [{ tag: "media_conn", attrs: {} }]
});
function parseMediaConn(res, now = Date.now()) {
  const mc = Array.isArray(res.content) ? res.content.find((c) => c.tag === "media_conn") : void 0;
  if (!mc) throw new Error("no media_conn in response");
  const hosts = (Array.isArray(mc.content) ? mc.content : []).filter((c) => c.tag === "host").map((c) => c.attrs["hostname"]);
  return { hosts, auth: mc.attrs["auth"] ?? "", ttl: Number(mc.attrs["ttl"] ?? 0), fetchedAt: now };
}
var uploadToken = (hash) => Buffer.from(hash).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
var pollOptionHash2 = (name, imageSha256) => (0, import_node_crypto12.createHash)("sha256").update(
  (0, import_node_crypto12.createHash)("sha256").update(name, "utf8").digest("hex") + Buffer.from(imageSha256).toString("base64"),
  "utf8"
).digest("hex");
async function uploadMedia(conn, type, media, fetchImpl = fetch, channel = false, pathOverride) {
  const token = uploadToken(media.fileEncSha256);
  let lastError;
  for (const host of conn.hosts) {
    const url = `https://${host}${pathOverride ?? (channel ? NEWSLETTER_PATH[type] : UPLOAD_PATH[type])}/${token}?auth=${encodeURIComponent(conn.auth)}&token=${token}`;
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream", Origin: ORIGIN },
        body: new Uint8Array(media.encrypted)
      });
      const json = await res.json().catch(() => void 0);
      if (json?.url && json.direct_path) {
        const t = json.thumbnail_info;
        return {
          url: json.url,
          directPath: json.direct_path,
          ...t?.thumbnail_direct_path && t.thumbnail_sha256 && {
            thumbnail: {
              directPath: t.thumbnail_direct_path,
              sha256: Buffer.from(t.thumbnail_sha256, "base64")
            }
          }
        };
      }
      lastError = new Error(
        `upload to ${host} failed (HTTP ${res.status}): ${JSON.stringify(json)}`
      );
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error("media upload failed on all hosts", { cause: lastError });
}
var MAX_DOWNLOAD_BYTES = 256 * 1024 * 1024;
function safeMediaUrls(ref) {
  const urls = [];
  const dp = ref.directPath;
  if (dp !== void 0) {
    if (!dp.startsWith("/") || dp.startsWith("//") || /[\\@\s]|\.\.|[\u0000-\u001f]/.test(dp))
      throw new Error("unsafe media directPath");
    const u = new URL(dp, `https://${MEDIA_HOST}`);
    if (u.hostname !== MEDIA_HOST || u.protocol !== "https:" || u.username || u.password || u.port)
      throw new Error("unsafe media directPath");
    urls.push(u.toString());
  }
  if (ref.url) {
    try {
      const u = new URL(ref.url);
      const okHost = u.hostname === MEDIA_HOST || u.hostname.endsWith(".whatsapp.net");
      if (u.protocol === "https:" && okHost && !u.username && !u.password && !u.port)
        urls.push(u.toString());
    } catch {
    }
  }
  return urls;
}
async function readCapped(res, limit) {
  const declared = Number(res.headers.get("content-length"));
  if (declared > limit) throw new Error(`media too large (${declared} > ${limit} bytes)`);
  if (!res.body) return new Uint8Array(await res.arrayBuffer());
  const chunks = [];
  let total = 0;
  const reader = res.body.getReader();
  for (; ; ) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new Error(`media too large (> ${limit} bytes)`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
async function downloadMedia(ref, type, fetchImpl = fetch) {
  const urls = safeMediaUrls(ref);
  if (!urls.length)
    throw new Error("media message has neither a usable directPath nor a WhatsApp https url");
  const limit = Math.min(
    MAX_DOWNLOAD_BYTES,
    ref.fileLength !== void 0 ? ref.fileLength + 16 + MAC_LENGTH : MAX_DOWNLOAD_BYTES
  );
  let lastError;
  for (const url of [...new Set(urls)]) {
    try {
      const res = await fetchImpl(url, { headers: { Origin: ORIGIN }, redirect: "error" });
      if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
      return decryptMedia(await readCapped(res, limit), ref.mediaKey, type, {
        ...ref.fileSha256 && { fileSha256: ref.fileSha256 },
        ...ref.fileEncSha256 && { fileEncSha256: ref.fileEncSha256 }
      });
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error("media download failed", { cause: lastError });
}
var DEFAULT_MIME = {
  image: "image/jpeg",
  video: "video/mp4",
  audio: "audio/ogg; codecs=opus",
  document: "application/octet-stream",
  sticker: "image/webp"
};
function mediaMessage(type, media, uploaded, o = {}, nowSeconds = Math.floor(Date.now() / 1e3)) {
  const common = {
    url: uploaded.url,
    directPath: uploaded.directPath,
    mediaKey: media.mediaKey,
    fileEncSha256: media.fileEncSha256,
    fileSha256: media.fileSha256,
    fileLength: media.fileLength,
    mediaKeyTimestamp: nowSeconds,
    mimetype: o.mimetype ?? DEFAULT_MIME[type]
  };
  const dims = { ...o.width && { width: o.width }, ...o.height && { height: o.height } };
  const thumb = o.jpegThumbnail ? { jpegThumbnail: o.jpegThumbnail } : {};
  switch (type) {
    case "image":
      return {
        message: {
          imageMessage: { ...common, ...dims, ...thumb, ...o.caption && { caption: o.caption } }
        },
        mediaType: "image"
      };
    case "video":
      return {
        message: {
          videoMessage: {
            ...common,
            ...dims,
            ...thumb,
            ...o.seconds !== void 0 && { seconds: o.seconds },
            ...o.gifPlayback && { gifPlayback: true },
            ...o.caption && { caption: o.caption }
          }
        },
        mediaType: o.gifPlayback ? "gif" : "video"
      };
    case "audio":
      return {
        message: {
          audioMessage: {
            ...common,
            ...o.seconds !== void 0 && { seconds: o.seconds },
            ...o.ptt && { ptt: true },
            ...o.waveform && { waveform: o.waveform }
          }
        },
        mediaType: o.ptt ? "ptt" : "audio"
      };
    case "document":
      return {
        message: {
          documentMessage: {
            ...common,
            ...thumb,
            fileName: o.fileName ?? "file",
            title: o.fileName ?? "file",
            ...o.caption && { caption: o.caption }
          }
        },
        mediaType: "document"
      };
    case "sticker":
      return { message: { stickerMessage: { ...common, ...dims } }, mediaType: "sticker" };
  }
}
function mediaOf(message) {
  const map = [
    ["imageMessage", "image"],
    ["videoMessage", "video"],
    ["audioMessage", "audio"],
    ["documentMessage", "document"],
    ["stickerMessage", "sticker"]
  ];
  for (const [field, type] of map) {
    const m = message[field];
    if (m?.["mediaKey"]) {
      const b = (x) => typeof x === "string" ? new Uint8Array(Buffer.from(x, "base64")) : x instanceof Uint8Array ? x : void 0;
      return {
        type,
        ref: {
          url: m["url"],
          directPath: m["directPath"],
          ...m["fileLength"] !== void 0 && { fileLength: Number(m["fileLength"]) },
          mediaKey: b(m["mediaKey"]),
          ...b(m["fileSha256"]) && { fileSha256: b(m["fileSha256"]) },
          ...b(m["fileEncSha256"]) && { fileEncSha256: b(m["fileEncSha256"]) }
        }
      };
    }
  }
  return void 0;
}

// src/client/features/chat/appstate-sync.ts
var APP_STATE_COLLECTIONS = [
  "critical_block",
  "critical_unblock_low",
  "regular_high",
  "regular_low",
  "regular"
];
var MAX_ATTEMPTS = 3;
var MAX_ROUNDS = 200;
var KNOWN = new Set(APP_STATE_COLLECTIONS);
function assertKnown(name) {
  if (!KNOWN.has(name)) throw new Error(`unknown app-state collection "${name}"`);
}
var b64 = (b) => Buffer.from(b).toString("base64");
var AppStateSync = class {
  constructor(d) {
    this.d = d;
    (0, import_node_fs12.mkdirSync)((0, import_node_path8.join)(d.dir, "keys"), { recursive: true, mode: 448 });
    for (const f of (0, import_node_fs12.readdirSync)((0, import_node_path8.join)(d.dir, "keys"))) {
      if (f === ".latest") continue;
      this.#keys.set(decodeURIComponent(f), new Uint8Array((0, import_node_fs12.readFileSync)((0, import_node_path8.join)(d.dir, "keys", f))));
    }
    const latest = (0, import_node_path8.join)(d.dir, "keys", ".latest");
    if ((0, import_node_fs12.existsSync)(latest)) this.#latestKeyId = (0, import_node_fs12.readFileSync)(latest, "utf8");
  }
  d;
  #keys = /* @__PURE__ */ new Map();
  #collections = /* @__PURE__ */ new Map();
  #macs = /* @__PURE__ */ new Map();
  #latestKeyId;
  #running = Promise.resolve();
  get keyCount() {
    return this.#keys.size;
  }
  /** Store keys received from the phone (`appStateSyncKeyShare.keys`). */
  addKeys(keys) {
    for (const k of keys) {
      const id = b64(k.keyId);
      this.#keys.set(id, k.keyData);
      this.#write((0, import_node_path8.join)(this.d.dir, "keys", encodeURIComponent(id)), k.keyData);
      this.#latestKeyId = id;
    }
    if (this.#latestKeyId) this.#write((0, import_node_path8.join)(this.d.dir, "keys", ".latest"), this.#latestKeyId);
    this.d.logger.event("appstate.keys-added", { count: keys.length });
  }
  /**
   * Send changes to the other devices: bring the collection up to date, build + sign the patch,
   * push it and only then adopt the new state (a rejected patch leaves everything untouched).
   */
  async push(collection, mutations) {
    const run = async () => {
      const keyId = this.#latestKeyId;
      const keyData = keyId ? this.#keys.get(keyId) : void 0;
      if (!keyId || !keyData)
        throw new Error("no app-state sync key yet: the phone shares it after linking");
      await this.#sync([collection]);
      const c = this.#collection(collection);
      const macs = this.#macsOf(collection);
      const built = c.buildPatch(
        new Uint8Array(Buffer.from(keyId, "base64")),
        keyData,
        mutations,
        (indexMac) => {
          const v = macs.get(b64(indexMac));
          return v ? new Uint8Array(Buffer.from(v, "base64")) : void 0;
        }
      );
      try {
        await this.d.request({
          tag: "iq",
          attrs: { to: "s.whatsapp.net", type: "set", xmlns: "w:sync:app:state" },
          content: [
            {
              tag: "sync",
              attrs: {},
              content: [
                {
                  tag: "collection",
                  attrs: {
                    name: collection,
                    version: String(built.version - 1),
                    return_snapshot: "false"
                  },
                  content: [{ tag: "patch", attrs: {}, content: built.patch }]
                }
              ]
            }
          ]
        });
      } catch (error) {
        c.discardPending();
        throw error;
      }
      c.commitPending();
      for (const m of built.addedMacs) macs.set(b64(m.indexMac), b64(m.valueMac));
      for (const r of built.removedIndexMacs) macs.delete(b64(r));
      this.#persist(collection);
      for (const m of mutations) {
        this.d.onEvent(
          toEvent(collection, {
            index: JSON.parse(m.index),
            operation: m.operation,
            value: m.value
          })
        );
      }
      this.d.logger.event("appstate.pushed", {
        collection,
        version: built.version,
        mutations: mutations.length
      });
    };
    const result = this.#running.then(run);
    this.#running = result.catch(() => void 0);
    return result;
  }
  /** Forget what we stored of these collections, so the next sync fetches them from the start (a snapshot). */
  reset(names = APP_STATE_COLLECTIONS) {
    for (const name of names) {
      assertKnown(name);
      this.#collections.delete(name);
      (0, import_node_fs12.rmSync)((0, import_node_path8.join)(this.d.dir, `${name}.state`), { force: true });
    }
  }
  /** Sync the given collections (serialised: concurrent calls queue up). */
  sync(names = APP_STATE_COLLECTIONS) {
    this.#running = this.#running.then(() => this.#sync(names)).catch((e) => this.d.logger.event("appstate.sync-error", e));
    return this.#running;
  }
  #collection(name) {
    assertKnown(name);
    let c = this.#collections.get(name);
    if (!c) {
      const p = (0, import_node_path8.join)(this.d.dir, `${name}.state`);
      c = (0, import_node_fs12.existsSync)(p) ? restoreAppStateCollection(name, new Uint8Array((0, import_node_fs12.readFileSync)(p))) : newAppStateCollection(name);
      this.#collections.set(name, c);
    }
    return c;
  }
  #macsOf(name) {
    assertKnown(name);
    let m = this.#macs.get(name);
    if (!m) {
      const p = (0, import_node_path8.join)(this.d.dir, `${name}.macs.json`);
      m = new Map(
        (0, import_node_fs12.existsSync)(p) ? Object.entries(JSON.parse((0, import_node_fs12.readFileSync)(p, "utf8"))) : []
      );
      this.#macs.set(name, m);
    }
    return m;
  }
  #persist(name) {
    assertKnown(name);
    this.#write((0, import_node_path8.join)(this.d.dir, `${name}.state`), this.#collection(name).serializeState());
    this.#write(
      (0, import_node_path8.join)(this.d.dir, `${name}.macs.json`),
      JSON.stringify(Object.fromEntries(this.#macsOf(name)))
    );
  }
  #write(path, data) {
    (0, import_node_fs12.writeFileSync)(`${path}.tmp`, data, { mode: 384 });
    (0, import_node_fs12.renameSync)(`${path}.tmp`, path);
  }
  #missing = /* @__PURE__ */ new Map();
  #requestedAt = /* @__PURE__ */ new Map();
  #lookupKey = (id) => {
    const k = this.#keys.get(b64(id));
    if (!k) this.#missing.set(b64(id), new Uint8Array(id));
    return k;
  };
  /** Ask for missing keys, at most once a minute per key. */
  #requestMissing() {
    const now = Date.now();
    const ids = [...this.#missing.entries()].filter(
      ([k]) => now - (this.#requestedAt.get(k) ?? 0) > 6e4
    );
    this.#missing.clear();
    if (!ids.length || !this.d.onMissingKeys) return;
    for (const [k] of ids) this.#requestedAt.set(k, now);
    this.d.logger.event("appstate.keys-requested", { count: ids.length });
    this.d.onMissingKeys(ids.map(([, v]) => v));
  }
  async #sync(names) {
    try {
      await this.#syncInner(names);
    } finally {
      this.#requestMissing();
    }
  }
  async #syncInner(names) {
    const todo = new Set(names);
    const attempts = /* @__PURE__ */ new Map();
    const forceSnapshot = /* @__PURE__ */ new Set();
    let rounds = 0;
    while (todo.size) {
      if (++rounds > MAX_ROUNDS) {
        this.d.logger.event("appstate.sync-aborted", {
          reason: "too many rounds",
          pending: [...todo]
        });
        return;
      }
      const nodes = [];
      for (const name of todo) {
        const version = this.#collection(name).version;
        this.d.logger.event("appstate.sync", {
          name,
          version,
          snapshot: forceSnapshot.has(name) || !version
        });
        nodes.push({
          tag: "collection",
          attrs: {
            name,
            version: String(version),
            return_snapshot: String(forceSnapshot.delete(name) || !version)
          }
        });
      }
      const res = await this.d.request({
        tag: "iq",
        attrs: { to: "s.whatsapp.net", xmlns: "w:sync:app:state", type: "set" },
        content: [{ tag: "sync", attrs: {}, content: nodes }]
      });
      const syncNode = Array.isArray(res.content) ? res.content.find((c) => c.tag === "sync") : void 0;
      const answered = /* @__PURE__ */ new Set();
      for (const node of Array.isArray(syncNode?.content) ? syncNode.content : []) {
        if (node.tag !== "collection") continue;
        const name = node.attrs["name"] ?? "";
        if (!todo.has(name)) {
          this.d.logger.event("appstate.unrequested-collection", { name: name.slice(0, 64) });
          continue;
        }
        answered.add(name);
        try {
          const before = this.#collection(name).version;
          const more = await this.#applyCollection(name, node);
          const progressed = this.#collection(name).version > before;
          if (!more || !progressed) todo.delete(name);
        } catch (error) {
          const n = (attempts.get(name) ?? 0) + 1;
          attempts.set(name, n);
          this.d.logger.event("appstate.collection-error", { name, attempt: n, error });
          const missingKey = String(error.message).includes("key");
          if (n >= MAX_ATTEMPTS) todo.delete(name);
          else forceSnapshot.add(name);
          if (missingKey && n >= 1 && this.#keys.size === 0) todo.delete(name);
        }
      }
      for (const name of todo) if (!answered.has(name)) todo.delete(name);
    }
  }
  /** Apply one `<collection>` answer. Returns true when the server has more patches for it. */
  async #applyCollection(name, node) {
    const c = this.#collection(name);
    const macs = this.#macsOf(name);
    const kids10 = (n, tag) => Array.isArray(n.content) ? n.content.filter((x) => x.tag === tag) : [];
    const events = [];
    const download = this.d.download ?? downloadMedia;
    const snapshotNode = kids10(node, "snapshot")[0];
    if (snapshotNode?.content instanceof Uint8Array) {
      const ref = protoType("ExternalBlobReference").toObject(
        protoType("ExternalBlobReference").decode(snapshotNode.content),
        { bytes: Uint8Array }
      );
      const data = await download(ref, "md-app-state");
      const res = c.applySnapshot(new Uint8Array(data), this.#lookupKey);
      macs.clear();
      for (const m of res.addedMacs) macs.set(b64(m.indexMac), b64(m.valueMac));
      events.push(...res.mutations);
      this.d.logger.event("appstate.snapshot-applied", {
        name,
        version: c.version,
        mutations: res.mutations.length
      });
    }
    const patchesNode = kids10(node, "patches")[0] ?? node;
    for (const p of kids10(patchesNode, "patch")) {
      if (!(p.content instanceof Uint8Array)) continue;
      const bytes2 = this.#withVersion(
        await this.#withExternalMutations(p.content, download),
        c.version + 1
      );
      const res = c.applyPatch(bytes2, this.#lookupKey, (indexMac) => {
        const v = macs.get(b64(indexMac));
        return v ? new Uint8Array(Buffer.from(v, "base64")) : void 0;
      });
      for (const m of res.addedMacs) macs.set(b64(m.indexMac), b64(m.valueMac));
      for (const r of res.removedIndexMacs) macs.delete(b64(r));
      events.push(...res.mutations);
      this.d.logger.event("appstate.patch-applied", {
        name,
        version: c.version,
        mutations: res.mutations.length
      });
    }
    this.#persist(name);
    for (const m of events) this.d.onEvent(toEvent(name, m));
    return node.attrs["has_more_patches"] === "true";
  }
  /**
   * Patches the server relays may carry no `version`; it is then the next one after ours (the patches of a
   * collection are consecutive). Same rule as the reference implementation.
   */
  #withVersion(patch, next) {
    const T = protoType("SyncdPatch");
    const obj = T.toObject(T.decode(patch), { bytes: Uint8Array, longs: Number });
    if (obj.version?.version) return patch;
    return encodeProto("SyncdPatch", { ...obj, version: { version: next } });
  }
  /** A patch can reference its mutations as an external blob; inline them before verification. */
  async #withExternalMutations(patch, download) {
    const T = protoType("SyncdPatch");
    const decoded = T.decode(patch);
    const obj = T.toObject(decoded, { bytes: Uint8Array });
    if (!obj.externalMutations) return patch;
    const blob = await download(obj.externalMutations, "md-app-state");
    const muts = protoType("SyncdMutations").toObject(protoType("SyncdMutations").decode(blob), {
      bytes: Uint8Array
    });
    const full = { ...obj, mutations: muts.mutations ?? [] };
    delete full["externalMutations"];
    return encodeProto("SyncdPatch", full);
  }
};
function toEvent(collection, m) {
  let value;
  let timestamp;
  if (m.value) {
    const T = protoType("SyncActionValue");
    value = T.toObject(T.decode(m.value), {
      longs: String,
      bytes: String,
      enums: String
    });
    const t = Number(value["timestamp"]);
    if (t) timestamp = t;
  }
  return {
    collection,
    index: m.index,
    action: m.index[0] ?? "",
    operation: m.operation,
    ...value && { value },
    ...timestamp !== void 0 && { timestamp }
  };
}
var asNumber = (v) => v === void 0 || v === null || v === "" ? void 0 : Number(v);
function interpret(e) {
  const id = e.index[1] ?? "";
  const v = e.value ?? {};
  if (e.operation === "remove") {
    if (e.action === "deleteChat") return { chat: { id, deleted: true } };
    if (e.action === "clearChat") return { chat: { id, cleared: true } };
    return {};
  }
  switch (e.action) {
    case "mute": {
      const m = v["muteAction"];
      const end = asNumber(m?.["muteEndTimestamp"]);
      return { chat: { id, muteEndTimestamp: m?.["muted"] ? end ?? -1 : null } };
    }
    case "archive":
      return { chat: { id, archived: Boolean(v["archiveChatAction"]?.["archived"]) } };
    case "pin_v1":
      return { chat: { id, pinned: Boolean(v["pinAction"]?.["pinned"]) } };
    case "markChatAsRead":
      return { chat: { id, unread: !v["markChatAsReadAction"]?.["read"] } };
    case "deleteChat":
      return { chat: { id, deleted: true } };
    case "clearChat":
      return { chat: { id, cleared: true } };
    case "contact": {
      const c = v["contactAction"];
      return {
        contact: {
          id,
          ...c?.["fullName"] ? { fullName: String(c["fullName"]) } : {},
          ...c?.["firstName"] ? { firstName: String(c["firstName"]) } : {},
          ...c?.["lidJid"] ? { lid: String(c["lidJid"]) } : {}
        }
      };
    }
    case "setting_pushName": {
      const name = v["pushNameSetting"]?.["name"];
      return name ? { pushName: String(name) } : {};
    }
    default:
      return {};
  }
}

// src/client/features/chat/chat-actions.ts
function messageRange(last) {
  if (!last?.length) return void 0;
  return {
    lastMessageTimestamp: last[last.length - 1].messageTimestamp,
    messages: last.map((m) => {
      if (!m.key.id || !m.key.remoteJid) throw new Error("incomplete message key in range");
      if (m.key.remoteJid.endsWith("@g.us") && !m.key.fromMe && !m.key.participant)
        throw new Error("a group message from someone else needs its participant");
      if (!m.messageTimestamp) throw new Error("missing timestamp in last message list");
      return {
        key: {
          remoteJid: m.key.remoteJid,
          fromMe: m.key.fromMe ?? false,
          id: m.key.id,
          ...m.key.participant && { participant: m.key.participant }
        },
        messageTimestamp: m.messageTimestamp
      };
    })
  };
}
var plan = (collection, index, version, valueObject, operation = "set") => ({
  collection,
  mutation: { operation, index: JSON.stringify(index), version, valueObject }
});
var mute = (jid, untilMs) => plan("regular_high", ["mute", jid], 2, {
  muteAction: { muted: untilMs !== null, ...untilMs !== null && { muteEndTimestamp: untilMs } }
});
var archive = (jid, archived, last) => plan("regular_low", ["archive", jid], 3, {
  archiveChatAction: {
    archived,
    ...messageRange(last) && { messageRange: messageRange(last) }
  }
});
var markRead = (jid, read, last) => plan("regular_low", ["markChatAsRead", jid], 3, {
  markChatAsReadAction: { read, ...messageRange(last) && { messageRange: messageRange(last) } }
});
var pin = (jid, pinned) => plan("regular_low", ["pin_v1", jid], 5, { pinAction: { pinned } });
var star = (key, starred) => plan(
  "regular_low",
  ["star", key.remoteJid, key.id, key.fromMe ? "1" : "0", key.participant ?? "0"],
  2,
  { starAction: { starred } }
);
var deleteChat = (jid, last) => plan("regular_high", ["deleteChat", jid, "1"], 6, {
  deleteChatAction: { ...messageRange(last) && { messageRange: messageRange(last) } }
});
var clearChat = (jid, last) => plan("regular_high", ["clearChat", jid, "1", "0"], 6, {
  clearChatAction: { ...messageRange(last) && { messageRange: messageRange(last) } }
});
var deleteMessageForMe = (key, timestamp, deleteMedia = false) => plan(
  "regular_high",
  ["deleteMessageForMe", key.remoteJid, key.id, key.fromMe ? "1" : "0", "0"],
  3,
  {
    deleteMessageForMeAction: { deleteMedia, messageTimestamp: timestamp }
  }
);
var pushName = (name) => plan("critical_block", ["setting_pushName"], 1, { pushNameSetting: { name } });
var contact = (jid, c) => plan(
  "critical_unblock_low",
  ["contact", jid],
  2,
  c ? { contactAction: c } : { contactAction: {} },
  c ? "set" : "remove"
);
var addLabel = (l) => plan("regular", ["label_edit", l.id], 3, {
  labelEditAction: {
    name: l.name,
    color: l.color,
    ...l.predefinedId && { predefinedId: l.predefinedId },
    ...l.deleted !== void 0 && { deleted: l.deleted }
  }
});
var labelChat = (jid, labelId, labeled) => plan("regular", ["label_jid", labelId, jid], 3, { labelAssociationAction: { labeled } });
var labelMessage = (jid, labelId, messageId, labeled) => plan("regular", ["label_message", labelId, jid, messageId, "0", "0"], 3, {
  labelAssociationAction: { labeled }
});
var chatEphemeral = (jid, seconds2) => plan("regular", ["ephemeral", jid], 1, {
  chatEphemeralAction: { ephemeralExpiration: seconds2, ephemeralSettingTimestamp: Date.now() }
});
var lockChat = (jid, locked) => plan("regular_high", ["lock_chat", jid], 1, { lockChatAction: { locked } });
var favorites = (jids) => plan("regular", ["favorites"], 1, { favoritesAction: { favorites: jids.map((id) => ({ id })) } });
var disableLinkPreviews = (isPreviewsDisabled) => plan("regular", ["setting_disableLinkPreviews"], 8, {
  privacySettingDisableLinkPreviewsAction: { isPreviewsDisabled }
});
var relayAllCalls = (isEnabled) => plan("regular", ["setting_relayAllCalls"], 8, { privacySettingRelayAllCalls: { isEnabled } });
var privateProcessing = (enabled) => plan("regular", ["setting_private_processing"], 1, {
  privateProcessingSettingAction: { privateProcessingStatus: enabled ? "ENABLED" : "DISABLED" }
});
var muteStatus = (jid, muted) => plan("regular", ["user_status_mute", jid], 1, { userStatusMuteAction: { muted } });
var quickReply = (q) => plan("regular", ["quick_reply", q.timestamp ?? String(Math.floor(Date.now() / 1e3))], 2, {
  quickReplyAction: {
    shortcut: q.shortcut,
    message: q.message,
    keywords: q.keywords ?? [],
    count: 0,
    deleted: q.deleted ?? false
  }
});
var reorderLabels = (sortedLabelIds) => plan("regular", ["label_reordering"], 1, { labelReorderingAction: { sortedLabelIds } });
function toOutgoing(p) {
  return {
    operation: p.mutation.operation,
    index: p.mutation.index,
    version: p.mutation.version,
    value: encodeProto("SyncActionValue", { timestamp: Date.now(), ...p.mutation.valueObject })
  };
}
var statusPrivacy = (audience, jids = [], allowSharing) => {
  const mode = audience === "contacts" ? "CONTACTS" : audience === "except" ? "DENY_LIST" : "ALLOW_LIST";
  return plan("regular_high", ["status_privacy"], 7, {
    statusPrivacy: {
      mode,
      modes: [mode],
      ...audience !== "contacts" && { userJid: jids },
      ...allowSharing !== void 0 && { shareToFb: false, shareToIg: false }
    }
  });
};

// src/client/features/contact/contacts.ts
var kids = (n, tag) => n && Array.isArray(n.content) ? n.content.filter((c) => tag === void 0 || c.tag === tag) : [];
var textOf = (n) => !n ? void 0 : typeof n.content === "string" ? n.content : n.content instanceof Uint8Array ? Buffer.from(n.content).toString("utf8") : void 0;
var contactProtocol = {
  name: "contact",
  query: { tag: "contact", attrs: {} },
  user: (u) => u.phone ? { tag: "contact", attrs: {}, content: u.phone } : u.username ? { tag: "contact", attrs: { username: u.username, ...u.pin && { pin: u.pin } } } : { tag: "contact", attrs: {} }
};
var statusProtocol = { name: "status", query: { tag: "status", attrs: {} } };
var usernameProtocol = {
  name: "username",
  query: { tag: "username", attrs: {} }
};
var lidProtocol = { name: "lid", query: { tag: "lid", attrs: {} } };
async function usync(request, sid, context, protocols, users) {
  const res = await request({
    tag: "iq",
    attrs: { to: "s.whatsapp.net", type: "get", xmlns: "usync" },
    content: [
      {
        tag: "usync",
        attrs: { context, mode: "query", sid, last: "true", index: "0" },
        content: [
          { tag: "query", attrs: {}, content: protocols.map((p) => p.query) },
          {
            tag: "list",
            attrs: {},
            content: users.map((u) => ({
              tag: "user",
              attrs: u.jid ? { jid: u.jid } : {},
              content: protocols.map((p) => p.user?.(u) ?? null).filter((n) => n !== null)
            }))
          }
        ]
      }
    ]
  });
  const list = kids(kids(kids(res, "usync")[0] ?? res, "list")[0], "user");
  return list.map((u) => ({
    id: u.attrs["jid"] ?? "",
    nodes: Object.fromEntries(kids(u).map((c) => [c.tag, c]))
  }));
}
async function fetchStatus(request, sid, jids) {
  const entries = await usync(
    request,
    sid,
    "interactive",
    [statusProtocol],
    jids.map((jid) => ({ jid }))
  );
  return entries.flatMap((e) => {
    const n = e.nodes["status"];
    if (!n) return [];
    const status = textOf(n);
    return [
      {
        jid: e.id,
        status: status ? status : null,
        setAt: new Date(Number(n.attrs["t"] ?? 0) * 1e3)
      }
    ];
  });
}
async function contactUsernames(request, sid, jids) {
  const entries = await usync(
    request,
    sid,
    "interactive",
    [usernameProtocol],
    jids.map((jid) => ({ jid }))
  );
  return entries.flatMap((e) => {
    const username = textOf(e.nodes["username"]);
    return username ? [{ jid: e.id, username }] : [];
  });
}
async function onWhatsApp(request, sid, numbers) {
  const phones = numbers.filter((n) => !n.endsWith("@lid")).map((n) => `+${n.replace("+", "").split("@")[0].split(":")[0]}`);
  if (!phones.length) return [];
  const entries = await usync(
    request,
    sid,
    "interactive",
    [contactProtocol],
    phones.map((phone) => ({ phone }))
  );
  return entries.flatMap((e) => {
    const c = e.nodes["contact"];
    return c ? [{ jid: e.id, exists: c.attrs["type"] === "in" }] : [];
  });
}
async function lidsFor(request, sid, jids) {
  const entries = await usync(
    request,
    sid,
    "background",
    [lidProtocol],
    jids.filter((j) => !j.endsWith("@lid")).map((jid) => ({ jid }))
  );
  return entries.flatMap(
    (e) => e.nodes["lid"]?.attrs["val"] ? [{ pn: e.id, lid: e.nodes["lid"].attrs["val"] }] : []
  );
}
async function profilePictureUrl(request, jid, type = "preview") {
  try {
    const res = await request({
      tag: "iq",
      attrs: {
        target: jid.replace(/:\d+@/, "@"),
        to: "s.whatsapp.net",
        type: "get",
        xmlns: "w:profile:picture"
      },
      content: [{ tag: "picture", attrs: { type, query: "url" } }]
    });
    return kids(res, "picture")[0]?.attrs["url"];
  } catch (e) {
    if (/"code":"(404|401|403)"/.test(String(e.message))) return void 0;
    throw e;
  }
}
async function updateStatus(request, text4) {
  await request({
    tag: "iq",
    attrs: { to: "s.whatsapp.net", type: "set", xmlns: "status" },
    content: [{ tag: "status", attrs: {}, content: Buffer.from(text4, "utf8") }]
  });
}
async function fetchBlocklist(request) {
  const res = await request({
    tag: "iq",
    attrs: { xmlns: "blocklist", to: "s.whatsapp.net", type: "get" }
  });
  return kids(kids(res, "list")[0], "item").map((i) => i.attrs["jid"] ?? "").filter(Boolean);
}
async function updateBlockStatus(request, jid, action, o = {}) {
  const addr = o.lid ?? jid;
  await request({
    tag: "iq",
    attrs: { xmlns: "blocklist", to: "s.whatsapp.net", type: "set" },
    content: [
      {
        tag: "item",
        // The server only wants the PN next to the LID on a block; an unblock with it never gets an answer.
        attrs: {
          action,
          jid: addr,
          ...action === "block" && o.lid && !jid.endsWith("@lid") && { pn_jid: jid }
        },
        content: action === "block" && (o.reason || o.reasonDescription) ? [
          {
            tag: "biz_opt_out",
            attrs: {
              ...o.reason && { reason: o.reason },
              ...o.reasonDescription && { reason_description: o.reasonDescription },
              ...o.entryPoint && { entry_point: o.entryPoint }
            }
          }
        ] : void 0
      },
      ...action === "block" && o.entryPoint ? [{ tag: "entry_point", attrs: { source: o.entryPoint } }] : []
    ]
  });
}
async function fetchPrivacySettings(request) {
  const res = await request({
    tag: "iq",
    attrs: { xmlns: "privacy", to: "s.whatsapp.net", type: "get" },
    content: [{ tag: "privacy", attrs: {} }]
  });
  const out = {};
  for (const c of kids(kids(res, "privacy")[0], "category"))
    if (c.attrs["name"]) out[c.attrs["name"]] = c.attrs["value"] ?? "";
  return out;
}
async function updatePrivacy(request, name, value) {
  await request({
    tag: "iq",
    attrs: { xmlns: "privacy", to: "s.whatsapp.net", type: "set" },
    content: [
      { tag: "privacy", attrs: {}, content: [{ tag: "category", attrs: { name, value } }] }
    ]
  });
}
async function updateProfilePicture(request, jpeg, jid) {
  if (jpeg[0] !== 255 || jpeg[1] !== 216) throw new Error("profile pictures must be JPEG");
  await request({
    tag: "iq",
    attrs: {
      to: "s.whatsapp.net",
      type: "set",
      xmlns: "w:profile:picture",
      ...jid && { target: jid }
    },
    content: [{ tag: "picture", attrs: { type: "image" }, content: jpeg }]
  });
}
async function removeProfilePicture(request, jid) {
  await request({
    tag: "iq",
    attrs: {
      to: "s.whatsapp.net",
      type: "set",
      xmlns: "w:profile:picture",
      ...jid && { target: jid }
    }
  });
}
async function findUserByUsername(request, sid, username, pin2) {
  const entries = await usync(
    request,
    sid,
    "interactive",
    [contactProtocol],
    [{ username: username.replace(/^@/, ""), ...pin2 && { pin: pin2 } }]
  );
  const e = entries[0];
  if (!e || !e.id) return null;
  return { jid: e.id, exists: e.nodes["contact"]?.attrs["type"] === "in" };
}

// src/client/features/message/interactive.ts
var quickReply2 = (displayText, id) => ({
  name: "quick_reply",
  params: { display_text: displayText, id }
});
var urlButton = (displayText, url, merchantUrl = url) => ({
  name: "cta_url",
  params: { display_text: displayText, url, merchant_url: merchantUrl }
});
var callButton = (displayText, phoneNumber) => ({
  name: "cta_call",
  params: { display_text: displayText, phone_number: phoneNumber }
});
var copyButton = (displayText, copyCode) => ({
  name: "cta_copy",
  params: { display_text: displayText, copy_code: copyCode }
});
var singleSelect = (buttonTitle, sections) => ({
  name: "single_select",
  params: {
    title: buttonTitle,
    sections: sections.map((s) => ({
      title: s.title,
      highlight_label: "",
      rows: s.rows.map((r) => ({
        header: "",
        title: r.title,
        description: r.description ?? "",
        id: r.id
      }))
    }))
  }
});
var SPECIAL_FLOWS = /* @__PURE__ */ new Set([
  "mpm",
  "cta_catalog",
  "send_location",
  "call_permission_request",
  "wa_payment_transaction_details",
  "automated_greeting_message_view_catalog"
]);
function bizNode(buttons, nowSeconds = Math.floor(Date.now() / 1e3)) {
  const first = buttons[0]?.name;
  if (first === "review_and_pay" || first === "payment_info") {
    return {
      tag: "biz",
      attrs: { native_flow_name: first === "review_and_pay" ? "order_details" : first }
    };
  }
  const flow = first && SPECIAL_FLOWS.has(first) ? { v: "2", name: first } : { v: "9", name: "mixed" };
  return {
    tag: "biz",
    attrs: { actual_actors: "2", host_storage: "2", privacy_mode_ts: String(nowSeconds) },
    content: [
      {
        tag: "interactive",
        attrs: { type: "native_flow", v: "1" },
        content: [{ tag: "native_flow", attrs: flow }]
      },
      { tag: "quality_control", attrs: { source_type: "third_party" } }
    ]
  };
}
function interactive(o) {
  if (!o.buttons.length) throw new Error("an interactive message needs at least one button");
  if (o.buttons.length > 10) throw new Error("at most 10 buttons");
  const interactiveMessage = {
    body: { text: o.body },
    ...o.footer && { footer: { text: o.footer } },
    ...o.header && {
      header: {
        title: o.header.title ?? "",
        subtitle: o.header.subtitle ?? "",
        hasMediaAttachment: false
      }
    },
    nativeFlowMessage: {
      buttons: o.buttons.map((b) => ({ name: b.name, buttonParamsJson: JSON.stringify(b.params) })),
      messageParamsJson: "",
      messageVersion: 1
    }
  };
  return {
    message: {
      viewOnceMessage: {
        message: {
          messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
          interactiveMessage
        }
      }
    },
    opts: { extraNodes: [bizNode(o.buttons)] }
  };
}

// src/client/features/message/events.ts
var kids2 = (n, tag) => Array.isArray(n.content) ? n.content.filter((c) => tag === void 0 || c.tag === tag) : [];
var digits = (v) => v && /^\d{1,12}$/.test(v) ? Number(v) : void 0;
function parseReceipt(node) {
  const ids = [node.attrs["id"] ?? ""];
  for (const list of kids2(node, "list"))
    for (const item of kids2(list, "item")) if (item.attrs["id"]) ids.push(item.attrs["id"]);
  return {
    chat: node.attrs["from"] ?? "",
    ...node.attrs["participant"] && { participant: node.attrs["participant"] },
    ids: ids.filter(Boolean),
    type: node.attrs["type"] ?? "delivery",
    ...digits(node.attrs["t"]) !== void 0 && { timestamp: digits(node.attrs["t"]) }
  };
}
function parsePresence(node) {
  const chat = node.attrs["from"] ?? "";
  const participant = node.attrs["participant"];
  const base = { chat, ...participant && { participant } };
  if (node.tag === "presence") {
    const t = node.attrs["type"];
    if (t !== void 0 && t !== "available" && t !== "unavailable") return void 0;
    return {
      ...base,
      state: t ?? "available",
      ...digits(node.attrs["last"]) !== void 0 && { lastSeen: digits(node.attrs["last"]) }
    };
  }
  if (node.tag === "chatstate") {
    const c = kids2(node)[0];
    if (!c) return void 0;
    if (c.tag === "composing")
      return { ...base, state: c.attrs["media"] === "audio" ? "recording" : "composing" };
    if (c.tag === "paused") return { ...base, state: "paused" };
  }
  return void 0;
}

// src/client/features/contact/business.ts
var kids3 = (n, tag) => n && Array.isArray(n.content) ? n.content.filter((c) => tag === void 0 || c.tag === tag) : [];
var text = (n) => !n ? void 0 : typeof n.content === "string" ? n.content : n.content instanceof Uint8Array ? Buffer.from(n.content).toString("utf8") : void 0;
var childText = (n, tag) => text(kids3(n, tag)[0]);
var bool = (v) => v === void 0 ? void 0 : v === "true";
async function getBusinessProfile(request, jid) {
  const [profileRes, nameRes] = await Promise.all([
    request({
      tag: "iq",
      attrs: { to: "s.whatsapp.net", xmlns: "w:biz", type: "get" },
      content: [
        {
          tag: "business_profile",
          attrs: { v: "116" },
          content: [{ tag: "profile", attrs: { jid } }]
        }
      ]
    }),
    request({
      tag: "iq",
      attrs: { to: "s.whatsapp.net", xmlns: "w:biz", type: "get" },
      content: [{ tag: "verified_name", attrs: { jid } }]
    }).catch(() => void 0)
  ]);
  const p = kids3(kids3(profileRes, "business_profile")[0], "profile")[0];
  if (!p) return null;
  const hours = kids3(p, "business_hours")[0];
  const cert = kids3(kids3(nameRes ?? { tag: "iq", attrs: {} }, "verified_name")[0], "certificate")[0];
  const verifiedName = cert ? kids3(cert, "details")[0]?.attrs["verified_name"] ?? text(kids3(cert, "details")[0]) : void 0;
  const site = childText(p, "website");
  return {
    ...p.attrs["jid"] && { jid: p.attrs["jid"] },
    ...childText(p, "address") !== void 0 && { address: childText(p, "address") },
    description: childText(p, "description") ?? "",
    website: site ? [site] : [],
    ...childText(p, "email") !== void 0 && { email: childText(p, "email") },
    ...text(kids3(kids3(p, "categories")[0], "category")[0]) !== void 0 && {
      category: text(kids3(kids3(p, "categories")[0], "category")[0])
    },
    ...hours && {
      businessHours: {
        ...hours.attrs["timezone"] && { timezone: hours.attrs["timezone"] },
        config: kids3(hours, "business_hours_config").map((c) => ({
          ...c.attrs["day_of_week"] && { dayOfWeek: c.attrs["day_of_week"] },
          ...c.attrs["mode"] && { mode: c.attrs["mode"] },
          ...c.attrs["open_time"] && { openTime: c.attrs["open_time"] },
          ...c.attrs["close_time"] && { closeTime: c.attrs["close_time"] }
        }))
      }
    },
    catalogExists: p.attrs["catalog_exists"] === "true",
    ...bool(p.attrs["cart_enabled"]) !== void 0 && {
      cartEnabled: bool(p.attrs["cart_enabled"])
    },
    ...verifiedName && { verifiedName }
  };
}
async function updateBusinessProfile(request, u) {
  const content = [];
  for (const key of ["address", "email", "description"]) {
    if (u[key] !== void 0) content.push({ tag: key, attrs: {}, content: u[key] });
  }
  for (const w of u.websites ?? []) content.push({ tag: "website", attrs: {}, content: w });
  if (u.hours) {
    content.push({
      tag: "business_hours",
      attrs: { timezone: u.hours.timezone },
      content: u.hours.days.map((d) => ({
        tag: "business_hours_config",
        attrs: {
          day_of_week: d.day,
          mode: d.mode,
          ...d.mode === "specific_hours" && {
            open_time: d.openTimeInMinutes ?? "0",
            close_time: d.closeTimeInMinutes ?? "0"
          }
        }
      }))
    });
  }
  if (!content.length) throw new Error("nothing to update");
  return request({
    tag: "iq",
    attrs: { to: "s.whatsapp.net", type: "set", xmlns: "w:biz" },
    content: [{ tag: "business_profile", attrs: { v: "3", mutation_type: "delta" }, content }]
  });
}
function parseProduct(n) {
  const media = kids3(n, "media")[0];
  const price = childText(n, "price");
  return {
    ...childText(n, "id") !== void 0 && { id: childText(n, "id") },
    ...childText(n, "name") !== void 0 && { name: childText(n, "name") },
    ...childText(n, "retailer_id") !== void 0 && { retailerId: childText(n, "retailer_id") },
    ...childText(n, "url") !== void 0 && { url: childText(n, "url") },
    ...childText(n, "description") !== void 0 && { description: childText(n, "description") },
    ...price !== void 0 && !Number.isNaN(+price) && { price: +price },
    ...childText(n, "currency") !== void 0 && { currency: childText(n, "currency") },
    isHidden: n.attrs["is_hidden"] === "true",
    imageUrls: kids3(media, "image").map((i) => childText(i, "request_image_url") ?? "").filter(Boolean)
  };
}
var sized = (tag, v) => ({ tag, attrs: {}, content: Buffer.from(v) });
async function getCatalog(request, jid, limit = 10, cursor) {
  const res = await request({
    tag: "iq",
    attrs: { to: "s.whatsapp.net", type: "get", xmlns: "w:biz:catalog" },
    content: [
      {
        tag: "product_catalog",
        attrs: { jid, allow_shop_source: "true" },
        content: [
          sized("limit", String(limit)),
          sized("width", "100"),
          sized("height", "100"),
          ...cursor ? [{ tag: "after", attrs: {}, content: cursor }] : []
        ]
      }
    ]
  });
  const cat = kids3(res, "product_catalog")[0];
  const after = childText(kids3(cat, "paging")[0], "after");
  return {
    products: kids3(cat, "product").map(parseProduct),
    ...after && { nextPageCursor: after }
  };
}
async function getCollections(request, jid, limit = 51) {
  const res = await request({
    tag: "iq",
    attrs: { to: "s.whatsapp.net", type: "get", xmlns: "w:biz:catalog", smax_id: "35" },
    content: [
      {
        tag: "collections",
        attrs: { biz_jid: jid },
        content: [
          sized("collection_limit", String(limit)),
          sized("item_limit", String(limit)),
          sized("width", "100"),
          sized("height", "100")
        ]
      }
    ]
  });
  return kids3(kids3(res, "collections")[0], "collection").map((c) => ({
    ...childText(c, "id") !== void 0 && { id: childText(c, "id") },
    ...childText(c, "name") !== void 0 && { name: childText(c, "name") },
    products: kids3(c, "product").map(parseProduct)
  }));
}

// src/client/features/group/groups.ts
var kids4 = (n, tag) => n && Array.isArray(n.content) ? n.content.filter((c) => tag === void 0 || c.tag === tag) : [];
var text2 = (n) => {
  if (!n) return void 0;
  if (typeof n.content === "string") return n.content;
  return n.content instanceof Uint8Array ? Buffer.from(n.content).toString("utf8") : void 0;
};
var num = (v) => v !== void 0 && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : void 0;
function parseGroup(nodeOrResult) {
  const group = nodeOrResult.tag === "group" ? nodeOrResult : kids4(nodeOrResult, "group")[0];
  if (!group) throw new Error("no <group> in response");
  const a = group.attrs;
  const id = (a["id"] ?? "").includes("@") ? a["id"] : `${a["id"]}@g.us`;
  const descNode = kids4(group, "description")[0];
  const eph = kids4(group, "ephemeral")[0]?.attrs["expiration"];
  const participants = kids4(group, "participant").map((p) => {
    const jid = p.attrs["jid"] ?? "";
    return {
      id: jid,
      ...jid.endsWith("@lid") && p.attrs["phone_number"] && { phoneNumber: p.attrs["phone_number"] },
      ...jid.endsWith("@s.whatsapp.net") && p.attrs["lid"] && { lid: p.attrs["lid"] },
      admin: p.attrs["type"] === "admin" || p.attrs["type"] === "superadmin" ? p.attrs["type"] : null
    };
  });
  return {
    id,
    subject: a["subject"] ?? "",
    ...a["s_o"] && { subjectOwner: a["s_o"] },
    ...num(a["s_t"]) !== void 0 && { subjectTime: num(a["s_t"]) },
    ...num(a["creation"]) !== void 0 && { creation: num(a["creation"]) },
    ...a["creator"] && { owner: a["creator"] },
    ...descNode && text2(kids4(descNode, "body")[0]) !== void 0 && { desc: text2(kids4(descNode, "body")[0]) },
    ...descNode?.attrs["id"] && { descId: descNode.attrs["id"] },
    size: num(a["size"]) ?? participants.length,
    addressingMode: a["addressing_mode"] === "lid" ? "lid" : "pn",
    restrict: kids4(group, "locked").length > 0,
    announce: kids4(group, "announcement").length > 0,
    isCommunity: kids4(group, "parent").length > 0,
    isCommunityAnnounce: kids4(group, "default_sub_group").length > 0,
    ...kids4(group, "linked_parent")[0]?.attrs["jid"] && {
      linkedParent: kids4(group, "linked_parent")[0].attrs["jid"]
    },
    joinApprovalMode: kids4(group, "membership_approval_mode").length > 0,
    memberAddAll: text2(kids4(group, "member_add_mode")[0]) === "all_member_add",
    ...eph && { ephemeralDuration: Number(eph) },
    participants
  };
}
var GROUP_QUERY = {
  INFO: "27508847222068472",
  INFO_INCLUDE_BOTS: "27795062750123057",
  IS_INTERNAL: "34119218944390847",
  INFO_BY_CODE: "24576337542042464",
  BATCH: "26440064815661176",
  INVITE_LINK: "29247029834912157",
  PARTICIPATING: "26664341543184776",
  SUGGESTED: "26012055225051916",
  LINKED: "25629003043401452",
  SUBGROUPS: "9935467776504344",
  ADD_PARTICIPANTS: "32627550323510250",
  RESET_INVITE_LINK: "24812851838367452",
  CREATE: "32341779532133480",
  ALLOW_NON_ADMIN_CREATION: "32024438593867696",
  PRE_REG_ADD_REQUESTS: "25018599251091280",
  SUGGESTED_CONTACTS: "27208468032086900"
};
var Groups = class {
  constructor(request, mex) {
    this.request = request;
    this.mex = mex;
  }
  request;
  mex;
  #mexCall(id, variables, path) {
    if (!this.mex) return Promise.reject(new Error("this Groups object has no GraphQL access"));
    return this.mex(id, variables, path);
  }
  #query(jid, type, content) {
    return this.request({ tag: "iq", attrs: { type, xmlns: "w:g2", to: jid }, content });
  }
  /** People who left (or were removed from) a group, with the reason and the time (unix seconds). */
  async pastParticipants(jid) {
    const res = await this.#query(jid, "get", [{ tag: "past_participants", attrs: {} }]);
    return kids4(kids4(res, "past_participants")[0], "past_participant").map((p) => ({
      jid: p.attrs["jid"] ?? "",
      ...p.attrs["reason"] && { reason: p.attrs["reason"] },
      ...p.attrs["t"] && { leftAt: Number(p.attrs["t"]) }
    }));
  }
  /** Take back a request to join. */
  async cancelMembershipRequest(jid, participantJid) {
    await this.#query(jid, "set", [
      {
        tag: "cancel_membership_requests",
        attrs: {},
        content: [{ tag: "participant", attrs: { jid: participantJid } }]
      }
    ]);
  }
  /** Accept the group's current rules / notice ("OK" on the group-changed banner). */
  async acknowledge(jid) {
    await this.#query(jid, "set", [{ tag: "ack", attrs: {} }]);
  }
  /** Messages that members reported to the admins, with who reported them. */
  async reportedMessages(jid) {
    const res = await this.#query(jid, "get", [{ tag: "reports", attrs: {} }]);
    return kids4(kids4(res, "reports")[0], "report").map((r) => ({
      messageId: r.attrs["message_id"] ?? "",
      reporters: kids4(r, "reporter").map((x) => ({
        jid: x.attrs["jid"] ?? "",
        ...x.attrs["timestamp"] && { at: Number(x.attrs["timestamp"]) }
      }))
    }));
  }
  /** Join a group by the invite that was sent to you as a message (`groupInviteMessage`); `admin` is who sent it. */
  async acceptInviteV4(invite) {
    await this.#query(invite.groupJid, "set", [
      {
        tag: "accept",
        attrs: {
          code: invite.inviteCode,
          expiration: String(invite.inviteExpiration),
          admin: invite.admin
        }
      }
    ]);
  }
  /** Withdraw an invite that you sent to someone (they can no longer use the message). */
  async revokeInviteV4(jid, invitedJid) {
    await this.#query(jid, "set", [
      { tag: "revoke", attrs: {}, content: [{ tag: "participant", attrs: { jid: invitedJid } }] }
    ]);
  }
  /** Members of a community's linked groups. */
  async linkedParticipants(jid) {
    const res = await this.#query(jid, "get", [{ tag: "linked_groups_participants", attrs: {} }]);
    return kids4(kids4(res, "linked_groups_participants")[0], "participant").map((p) => ({
      jid: p.attrs["jid"] ?? "",
      ...(p.attrs["phone_number"] ?? p.attrs["pn"]) && {
        phoneNumber: p.attrs["phone_number"] ?? p.attrs["pn"]
      }
    }));
  }
  /** Sub-groups of a community. */
  async linkedSubgroups(communityJid) {
    const res = await this.#query(communityJid, "get", [
      { tag: "links", attrs: { link_type: "sub_group" } }
    ]);
    return kids4(kids4(res, "links")[0], "link").flatMap((l) => {
      const jid = kids4(l, "group")[0]?.attrs["jid"];
      return jid ? [{ jid, ...l.attrs["link_type"] && { linkType: l.attrs["link_type"] } }] : [];
    });
  }
  /** Join a sub-group of a community you are in. `approvalRequested` is true when an admin has to let you in. */
  async joinLinked(parentJid, linkedGroupJid, type) {
    const res = await this.#query(parentJid, "set", [
      { tag: "join_linked_group", attrs: { jid: linkedGroupJid, ...type && { type } } }
    ]);
    return { approvalRequested: kids4(res, "membership_approval_request").length > 0 };
  }
  // ---- the GraphQL forms (they answer with more than the stanza forms) ----
  /** Full group info as GraphQL gives it. */
  info = (jid) => this.#mexCall(
    GROUP_QUERY.INFO,
    { id: jid, query_context: "INTERACTIVE", include_username: false },
    "xwa2_group_query_by_id"
  );
  infoWithBots = (jid) => this.#mexCall(
    GROUP_QUERY.INFO_INCLUDE_BOTS,
    { id: jid, query_context: "INTERACTIVE", include_username: false },
    "xwa2_group_query_by_id"
  );
  async isInternal(jid) {
    const r = await this.#mexCall(
      GROUP_QUERY.IS_INTERNAL,
      { id: jid },
      "xwa2_group_query_by_id"
    );
    return r?.properties?.internal === true;
  }
  /** What a group is, by its invite code, before you join. */
  infoByCode = (code) => this.#mexCall(
    GROUP_QUERY.INFO_BY_CODE,
    { group_input: { invite_code: code } },
    "xwa2_group_query_by_id"
  );
  /** Several groups in one call. */
  batch = (jids) => this.#mexCall(
    GROUP_QUERY.BATCH,
    { groups_input: jids.map((group_id) => ({ group_id })) },
    "xwa2_group_query_batch"
  );
  inviteLink = (jid) => this.#mexCall(
    GROUP_QUERY.INVITE_LINK,
    { group_input: { group_id: jid } },
    "xwa2_group_query_by_id"
  );
  participating = () => this.#mexCall(GROUP_QUERY.PARTICIPATING, {}, "xwa2_group_query_participating");
  /** Groups WhatsApp suggests adding to a community. */
  suggested = (communityJid) => this.#mexCall(
    GROUP_QUERY.SUGGESTED,
    { group_input: { group_id: communityJid } },
    "xwa2_group_query_by_id"
  );
  linkedInfo = (jid) => this.#mexCall(GROUP_QUERY.LINKED, { group_input: { group_id: jid } }, "xwa2_group_query_by_id");
  subgroups = (communityJid) => this.#mexCall(
    GROUP_QUERY.SUBGROUPS,
    { group_id: communityJid, query_context: "INTERACTIVE" },
    "xwa2_group_query_by_id"
  );
  createViaGraphql = (subject, participantJids) => this.#mexCall(
    GROUP_QUERY.CREATE,
    { input: { subject, participants: participantJids.map((jid) => ({ jid })) } },
    "xwa2_group_create"
  );
  addParticipantsViaGraphql = (jid, participantJids) => this.#mexCall(
    GROUP_QUERY.ADD_PARTICIPANTS,
    { group_id: jid, participants: participantJids.map((p) => ({ user_jid: p })) },
    "xwa2_group_add_participants"
  );
  resetInviteLink = (jid) => this.#mexCall(GROUP_QUERY.RESET_INVITE_LINK, { group_jid: jid }, "xwa2_group_reset_invite_link");
  /** Let members who are not admins create sub-groups in a community. */
  allowNonAdminSubgroupCreation = (communityJid, allow) => this.#mexCall(
    GROUP_QUERY.ALLOW_NON_ADMIN_CREATION,
    { group_jid: communityJid, allow_non_admin_sub_group_creation: allow },
    "xwa2_group_allow_non_admin_creation"
  );
  preRegisteredAddRequests = (jid) => this.#mexCall(
    GROUP_QUERY.PRE_REG_ADD_REQUESTS,
    { group_jid: jid },
    "xwa2_group_pre_reg_add_requests"
  );
  suggestedContacts = (jid) => this.#mexCall(
    GROUP_QUERY.SUGGESTED_CONTACTS,
    { group_jid: jid },
    "xwa2_group_suggested_contacts"
  );
  /** Profile pictures of several groups (or users) at once: `type` `preview` is the small one, `image` the full size. */
  async pictures(jids, type = "preview") {
    const res = await this.#query("s.whatsapp.net", "get", [
      {
        tag: "pictures",
        attrs: {},
        content: jids.map((id) => ({ tag: "picture", attrs: { id, type } }))
      }
    ]);
    return kids4(res, "picture").map((p) => ({
      jid: p.attrs["id"] ?? p.attrs["jid"] ?? "",
      ...p.attrs["type"] && { type: p.attrs["type"] },
      ...p.attrs["direct_path"] && { directPath: p.attrs["direct_path"] },
      ...p.attrs["url"] && { url: p.attrs["url"] }
    }));
  }
  /** Full metadata of one group. */
  async metadata(jid) {
    return parseGroup(
      await this.#query(jid, "get", [{ tag: "query", attrs: { request: "interactive" } }])
    );
  }
  /** Every group we are in, keyed by JID. */
  async fetchAll() {
    const res = await this.#query("@g.us", "get", [
      {
        tag: "participating",
        attrs: {},
        content: [
          { tag: "participants", attrs: {} },
          { tag: "description", attrs: {} }
        ]
      }
    ]);
    const out = {};
    for (const g of kids4(kids4(res, "groups")[0], "group")) {
      const m = parseGroup(g);
      out[m.id] = m;
    }
    return out;
  }
  async create(subject, participants, meId = "") {
    const res = await this.#query("@g.us", "set", [
      {
        tag: "create",
        attrs: { subject, key: generateMessageId(meId || "0@s.whatsapp.net") },
        content: participants.map((jid) => ({ tag: "participant", attrs: { jid } }))
      }
    ]);
    return parseGroup(res);
  }
  async leave(id) {
    await this.#query("@g.us", "set", [
      { tag: "leave", attrs: {}, content: [{ tag: "group", attrs: { id } }] }
    ]);
  }
  async setSubject(jid, subject) {
    await this.#query(jid, "set", [
      { tag: "subject", attrs: {}, content: Buffer.from(subject, "utf8") }
    ]);
  }
  /** Set or (with an empty string) delete the description. */
  async setDescription(jid, description) {
    const prev = (await this.metadata(jid)).descId;
    await this.#query(jid, "set", [
      {
        tag: "description",
        attrs: {
          ...description ? { id: generateMessageId("0@s.whatsapp.net") } : { delete: "true" },
          ...prev && { prev }
        },
        ...description && {
          content: [{ tag: "body", attrs: {}, content: Buffer.from(description, "utf8") }]
        }
      }
    ]);
  }
  /** Add / remove / promote / demote members. Returns the per-member status (`200` = ok). */
  async updateParticipants(jid, participants, action) {
    const res = await this.#query(jid, "set", [
      {
        tag: action,
        attrs: {},
        content: participants.map((p) => ({ tag: "participant", attrs: { jid: p } }))
      }
    ]);
    return kids4(kids4(res, action)[0], "participant").map((p) => ({
      jid: p.attrs["jid"] ?? "",
      status: p.attrs["error"] ?? "200"
    }));
  }
  /** Add Meta AI (or another bot) to a group so it can be mentioned there. */
  addBot(jid, botUser = "867051314767696") {
    return this.updateParticipants(jid, [`${botUser}@bot`], "add");
  }
  async inviteCode(jid) {
    return kids4(await this.#query(jid, "get", [{ tag: "invite", attrs: {} }]), "invite")[0]?.attrs["code"];
  }
  async revokeInvite(jid) {
    return kids4(await this.#query(jid, "set", [{ tag: "invite", attrs: {} }]), "invite")[0]?.attrs["code"];
  }
  /** Join a group by invite code; returns the group JID. */
  async acceptInvite(code) {
    return kids4(await this.#query("@g.us", "set", [{ tag: "invite", attrs: { code } }]), "group")[0]?.attrs["jid"];
  }
  async inviteInfo(code) {
    return parseGroup(await this.#query("@g.us", "get", [{ tag: "invite", attrs: { code } }]));
  }
  /** Disappearing messages: seconds (86400, 604800, 7776000) or 0 to turn off. */
  async setEphemeral(jid, seconds2) {
    await this.#query(jid, "set", [
      seconds2 ? { tag: "ephemeral", attrs: { expiration: String(seconds2) } } : { tag: "not_ephemeral", attrs: {} }
    ]);
  }
  /** `announcement` = only admins send; `locked` = only admins edit info. */
  async setting(jid, setting) {
    await this.#query(jid, "set", [{ tag: setting, attrs: {} }]);
  }
  async setMemberAddMode(jid, mode) {
    await this.#query(jid, "set", [{ tag: "member_add_mode", attrs: {}, content: mode }]);
  }
  async setJoinApproval(jid, mode) {
    await this.#query(jid, "set", [
      {
        tag: "membership_approval_mode",
        attrs: {},
        content: [{ tag: "group_join", attrs: { state: mode } }]
      }
    ]);
  }
  async joinRequests(jid) {
    const res = await this.#query(jid, "get", [{ tag: "membership_approval_requests", attrs: {} }]);
    return kids4(kids4(res, "membership_approval_requests")[0], "membership_approval_request").map(
      (r) => r.attrs
    );
  }
  async updateJoinRequests(jid, participants, action) {
    const res = await this.#query(jid, "set", [
      {
        tag: "membership_requests_action",
        attrs: {},
        content: [
          {
            tag: action,
            attrs: {},
            content: participants.map((p) => ({ tag: "participant", attrs: { jid: p } }))
          }
        ]
      }
    ]);
    const node = kids4(kids4(res, "membership_requests_action")[0], action)[0];
    return kids4(node, "participant").map((p) => ({
      jid: p.attrs["jid"] ?? "",
      status: p.attrs["error"] ?? "200"
    }));
  }
};
function parseGroupNotification(node) {
  const out = [];
  const base = {
    group: node.attrs["from"] ?? "",
    ...node.attrs["participant"] && { actor: node.attrs["participant"] },
    ...node.attrs["t"] && { timestamp: Number(node.attrs["t"]) }
  };
  for (const c of kids4(node)) {
    const participants = kids4(c, "participant").map((p) => p.attrs["jid"] ?? "").filter(Boolean);
    const n = {
      ...base,
      action: c.tag,
      ...participants.length && { participants }
    };
    if (c.tag === "subject" && c.attrs["subject"]) n.subject = c.attrs["subject"];
    if (c.tag === "description") n.description = text2(kids4(c, "body")[0]) ?? "";
    out.push(n);
  }
  return out;
}
var GROUP_SET_PROPERTY_QUERY = "9418211574894172";
var setGroupProperty = (mex, jid, property, value) => mex(
  GROUP_SET_PROPERTY_QUERY,
  { group_id: jid, update: { [property]: value } },
  "xwa2_group_update_property"
);
function memberLabelMessage(label, nowSeconds = Math.floor(Date.now() / 1e3)) {
  return {
    protocolMessage: {
      type: "GROUP_MEMBER_LABEL_CHANGE",
      memberLabel: { label: label.slice(0, 30), labelTimestamp: nowSeconds }
    }
  };
}

// src/client/features/community/communities.ts
var kids5 = (n, tag) => n && Array.isArray(n.content) ? n.content.filter((c) => tag === void 0 || c.tag === tag) : [];
var Communities = class {
  constructor(request, mex, groups) {
    this.request = request;
    this.#groups = groups ?? new Groups(request, mex);
    this.#mex = mex;
  }
  request;
  #groups;
  #mex;
  #query(jid, type, content) {
    return this.request({ tag: "iq", attrs: { type, xmlns: "w:g2", to: jid }, content });
  }
  metadata = (jid) => this.#groups.metadata(jid);
  /** The same actions as for groups, on a community JID (so they are all in one place). */
  inviteCode = (jid) => this.#groups.inviteCode(jid);
  revokeInvite = (jid) => this.#groups.revokeInvite(jid);
  inviteInfo = (code) => this.#groups.inviteInfo(code);
  setSubject = (jid, subject) => this.#groups.setSubject(jid, subject);
  setDescription = (jid, text4) => this.#groups.setDescription(jid, text4);
  setEphemeral = (jid, seconds2) => this.#groups.setEphemeral(jid, seconds2);
  updateParticipants = (jid, participants, action) => this.#groups.updateParticipants(jid, participants, action);
  setting = (jid, setting) => this.#groups.setting(jid, setting);
  setMemberAddMode = (jid, mode) => this.#groups.setMemberAddMode(jid, mode);
  setJoinApproval = (jid, mode) => this.#groups.setJoinApproval(jid, mode);
  joinRequests = (jid) => this.#groups.joinRequests(jid);
  updateJoinRequests = (...a) => this.#groups.updateJoinRequests(...a);
  acceptInviteV4 = (...a) => this.#groups.acceptInviteV4(...a);
  revokeInviteV4 = (jid, invitedJid) => this.#groups.revokeInviteV4(jid, invitedJid);
  /** Every community the account is in, by JID. */
  async fetchAll() {
    const all = await this.#groups.fetchAll();
    return Object.fromEntries(Object.entries(all).filter(([, g]) => g.isCommunity));
  }
  /** Set (JPEG bytes) or remove the community's picture. */
  async setPicture(jid, jpeg) {
    if (jpeg[0] !== 255 || jpeg[1] !== 216) throw new Error("community pictures must be JPEG");
    await this.#query(jid, "set", [{ tag: "picture", attrs: { type: "image" }, content: jpeg }]);
  }
  async removePicture(jid) {
    await this.#query(jid, "set", [{ tag: "picture", attrs: { type: "delete" } }]);
  }
  #gql(id, variables, path) {
    if (!this.#mex)
      return Promise.reject(new Error("this Communities object has no GraphQL access"));
    return this.#mex(id, variables, path);
  }
  /** How many people are in the community. */
  async participantCount(jid) {
    const r = await this.#gql(
      "31981537024824320",
      { group_input: { group_id: jid } },
      "xwa2_group_query_by_id"
    );
    const n = r?.["participant_count"] ?? r?.["participantCount"] ?? r?.["count"];
    return typeof n === "number" ? n : void 0;
  }
  async subgroupParticipantCount(subgroupJid) {
    const r = await this.#gql(
      "24079399904996141",
      { group_input: { group_id: subgroupJid } },
      "xwa2_group_query_by_id"
    );
    const n = r?.["participant_count"] ?? r?.["participantCount"] ?? r?.["count"];
    return typeof n === "number" ? n : void 0;
  }
  /** Groups WhatsApp suggests adding as sub-groups. */
  async subgroupSuggestions(communityJid, hint = "", context = "INTERACTIVE") {
    const r = await this.#gql(
      "23972005349071865",
      { group_input: { group_id: communityJid, query_context: context, sub_group_hint: hint } },
      "xwa2_group_query_by_id"
    );
    return (r?.sub_group_suggestions?.edges ?? []).map((e) => e?.node).filter(Boolean);
  }
  /** Sub-groups as GraphQL lists them. */
  subgroups = (jid) => this.#groups.subgroups(jid);
  /** Hand the community to someone else (you stay an admin). */
  transferOwnership = (communityJid, newOwnerJid) => this.#gql(
    "24781435194845316",
    {
      group_id: communityJid,
      role_updates: [{ user_jid: newOwnerJid, new_role: "SUPERADMIN_MEMBER" }]
    },
    "xwa2_community_update_owner"
  );
  /** Create a community; it starts with an announcement and a general sub-group. */
  async create(subject, description = "") {
    const res = await this.#query("@g.us", "set", [
      {
        tag: "create",
        attrs: { subject },
        content: [
          {
            tag: "description",
            attrs: { id: generateMessageId("0@s.whatsapp.net").slice(0, 12) },
            content: [{ tag: "body", attrs: {}, content: Buffer.from(description, "utf8") }]
          },
          { tag: "parent", attrs: { default_membership_approval_mode: "request_required" } },
          { tag: "allow_non_admin_sub_group_creation", attrs: {} },
          { tag: "create_general_chat", attrs: {} }
        ]
      }
    ]);
    return parseGroup(res);
  }
  /** Create a new group inside a community. */
  async createGroup(subject, participants, communityJid) {
    const res = await this.#query("@g.us", "set", [
      {
        tag: "create",
        attrs: { subject, key: generateMessageId("0@s.whatsapp.net") },
        content: [
          ...participants.map((jid) => ({ tag: "participant", attrs: { jid } })),
          { tag: "linked_parent", attrs: { jid: communityJid } }
        ]
      }
    ]);
    return parseGroup(res);
  }
  async leave(id) {
    await this.#query("@g.us", "set", [
      { tag: "leave", attrs: {}, content: [{ tag: "community", attrs: { id } }] }
    ]);
  }
  async linkGroup(groupJid, communityJid) {
    await this.#query(communityJid, "set", [
      {
        tag: "links",
        attrs: {},
        content: [
          {
            tag: "link",
            attrs: { link_type: "sub_group" },
            content: [{ tag: "group", attrs: { jid: groupJid } }]
          }
        ]
      }
    ]);
  }
  async unlinkGroup(groupJid, communityJid, removeOrphanedMembers = false) {
    await this.#query(communityJid, "set", [
      {
        tag: "unlink",
        attrs: { unlink_type: "sub_group" },
        content: [
          {
            tag: "group",
            attrs: removeOrphanedMembers ? { jid: groupJid, remove_orphaned_members: "true" } : { jid: groupJid }
          }
        ]
      }
    ]);
  }
  /** The sub-groups of a community (pass a sub-group JID to find its community first). */
  async linkedGroups(jid) {
    const meta = await this.#groups.metadata(jid);
    const communityJid = meta.linkedParent ?? jid;
    const res = await this.#query(communityJid, "get", [{ tag: "sub_groups", attrs: {} }]);
    const linkedGroups = kids5(kids5(res, "sub_groups")[0], "group").flatMap(
      (g) => g.attrs["id"] ? [
        {
          id: g.attrs["id"].includes("@") ? g.attrs["id"] : `${g.attrs["id"]}@g.us`,
          subject: g.attrs["subject"] ?? "",
          ...g.attrs["creation"] && { creation: Number(g.attrs["creation"]) },
          ...g.attrs["creator"] && { owner: g.attrs["creator"] },
          ...g.attrs["size"] && { size: Number(g.attrs["size"]) }
        }
      ] : []
    );
    return { communityJid, linkedGroups };
  }
  /** Join a community by invite code; returns the community JID. */
  async acceptInvite(code) {
    return kids5(
      await this.#query("@g.us", "set", [{ tag: "invite", attrs: { code } }]),
      "community"
    )[0]?.attrs["jid"];
  }
  /** Deactivate (delete) a community. Its sub-groups stay as normal groups. */
  async deactivate(jid) {
    await this.#query(jid, "set", [{ tag: "delete_parent", attrs: {} }]);
  }
};

// src/client/lid-map.ts
var import_node_fs13 = require("fs");
var import_node_path9 = require("path");
var LidMap = class {
  constructor(path) {
    this.path = path;
    if (path && (0, import_node_fs13.existsSync)(path)) {
      for (const [pn, lid] of Object.entries(
        JSON.parse((0, import_node_fs13.readFileSync)(path, "utf8"))
      )) {
        this.#pnToLid.set(pn, lid);
        this.#lidToPn.set(lid, pn);
      }
    }
  }
  path;
  #pnToLid = /* @__PURE__ */ new Map();
  #lidToPn = /* @__PURE__ */ new Map();
  /** Remember that these two JIDs (any device) are the same account. Returns true when it was new. */
  set(a, b) {
    let pn;
    let lid;
    try {
      const da = jidDecode(a);
      const db = jidDecode(b);
      if (da.server === "lid" && db.server === "s.whatsapp.net") [lid, pn] = [da.user, db.user];
      else if (db.server === "lid" && da.server === "s.whatsapp.net") [lid, pn] = [db.user, da.user];
      else return false;
    } catch {
      return false;
    }
    if (!pn || !lid || this.#pnToLid.get(pn) === lid) return false;
    this.#pnToLid.set(pn, lid);
    this.#lidToPn.set(lid, pn);
    this.#save();
    return true;
  }
  lidUser(pnUser) {
    return this.#pnToLid.get(pnUser);
  }
  pnUser(lidUser) {
    return this.#lidToPn.get(lidUser);
  }
  /** The JID whose Signal address to use: the LID form for a phone-number JID with a known mapping, else the input. */
  resolve(jid) {
    let d;
    try {
      d = jidDecode(jid);
    } catch {
      return jid;
    }
    if (d.server !== "s.whatsapp.net") return jid;
    const lid = this.#pnToLid.get(d.user);
    if (!lid) return jid;
    return d.device ? `${lid}:${d.device}@lid` : `${lid}@lid`;
  }
  #save() {
    if (!this.path) return;
    (0, import_node_fs13.mkdirSync)((0, import_node_path9.dirname)(this.path), { recursive: true, mode: 448 });
    (0, import_node_fs13.writeFileSync)(`${this.path}.tmp`, JSON.stringify(Object.fromEntries(this.#pnToLid)), {
      mode: 384
    });
    (0, import_node_fs13.renameSync)(`${this.path}.tmp`, this.path);
  }
};

// src/client/features/account/pairing-code.ts
var import_node_crypto13 = require("crypto");
var import_node_util = require("util");
var pbkdf2Async = (0, import_node_util.promisify)(import_node_crypto13.pbkdf2);
var CROCKFORD = "123456789ABCDEFGHJKLMNPQRSTVWXYZ";
var PBKDF2_ITERATIONS = 2 << 16;
function generatePairingCode() {
  let value = 0;
  let bits = 0;
  let out = "";
  for (const byte of (0, import_node_crypto13.randomBytes)(5)) {
    value = value << 8 | byte;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[value >>> bits - 5 & 31];
      bits -= 5;
    }
  }
  return out;
}
var isValidPairingCode = (code) => code.length === 8 && [...code.toUpperCase()].every((c) => CROCKFORD.includes(c));
function normalizePairingCode(code) {
  if (!isValidPairingCode(code))
    throw new Error(
      `invalid pairing code "${code}": must be exactly 8 characters from ${CROCKFORD}`
    );
  return code.toUpperCase();
}
var x25519Private = (raw) => (0, import_node_crypto13.createPrivateKey)({
  key: Buffer.concat([Buffer.from("302e020100300506032b656e04220420", "hex"), raw]),
  format: "der",
  type: "pkcs8"
});
var x25519Public = (raw) => (0, import_node_crypto13.createPublicKey)({
  key: Buffer.concat([Buffer.from("302a300506032b656e032100", "hex"), raw]),
  format: "der",
  type: "spki"
});
var sharedKey = (privateKey, publicKey) => (0, import_node_crypto13.diffieHellman)({
  privateKey: x25519Private(privateKey),
  publicKey: x25519Public(publicKey.length === 33 ? publicKey.subarray(1) : publicKey)
});
var codeKey = (code, salt) => pbkdf2Async(Buffer.from(code), salt, PBKDF2_ITERATIONS, 32, "sha256");
var COMPANION_WEB_CLIENT = {
  CHROME: { id: "1", name: "Chrome" },
  EDGE: { id: "2", name: "Edge" },
  FIREFOX: { id: "3", name: "Firefox" },
  IE: { id: "4", name: "IE" },
  OPERA: { id: "5", name: "Opera" },
  SAFARI: { id: "6", name: "Safari" },
  // A desktop app (Electron); the library's own default browser[1].
  DESKTOP: { id: "7", name: "Chrome" },
  UWP: { id: "8", name: "Chrome" }
};
var OTHER_WEB_CLIENT = { id: "9", name: "Chrome" };
var companionWebClient = (deviceType) => COMPANION_WEB_CLIENT[deviceType.toUpperCase()] ?? OTHER_WEB_CLIENT;
function canonicalOs(os) {
  const o = os.trim().toLowerCase();
  const word = (w) => new RegExp(`(^|[^a-z0-9])${w}($|[^a-z0-9])`).test(o);
  if (!o) return "Linux";
  if (o.includes("windows")) return "Windows";
  if (o.includes("mac") || o.includes("osx") || o.includes("darwin")) return "Mac OS";
  if (o.includes("ipad") || o.includes("iphone") || word("ios")) return "iOS";
  if (o.includes("android")) return "Android";
  if (o.includes("linux") || o.includes("ubuntu") || o.includes("debian") || o.includes("fedora") || o.includes("chrome os") || o.includes("chromeos") || o.includes("chromium") || word("arch") || word("cros"))
    return "Linux";
  return "Linux";
}
var ctr = (decrypt, data, key, iv) => {
  const c = (decrypt ? import_node_crypto13.createDecipheriv : import_node_crypto13.createCipheriv)("aes-256-ctr", key, iv);
  return Buffer.concat([c.update(data), c.final()]);
};
async function companionHello(creds, phoneNumber, code, browser = ["Windows", "Desktop"]) {
  const salt = (0, import_node_crypto13.randomBytes)(32);
  const iv = (0, import_node_crypto13.randomBytes)(16);
  const wrapped = Buffer.concat([
    salt,
    iv,
    ctr(false, creds.pairingEphemeralKey.publicKey, await codeKey(code, salt), iv)
  ]);
  const client = companionWebClient(browser[1]);
  return {
    tag: "iq",
    attrs: { to: "s.whatsapp.net", type: "set", xmlns: "md" },
    content: [
      {
        tag: "link_code_companion_reg",
        attrs: {
          jid: `${phoneNumber.replace(/\D/g, "")}@s.whatsapp.net`,
          stage: "companion_hello",
          should_show_push_notification: "true"
        },
        content: [
          { tag: "link_code_pairing_wrapped_companion_ephemeral_pub", attrs: {}, content: wrapped },
          { tag: "companion_server_auth_key_pub", attrs: {}, content: creds.noiseKey.publicKey },
          { tag: "companion_platform_id", attrs: {}, content: client.id },
          {
            tag: "companion_platform_display",
            attrs: {},
            content: `${client.name} (${canonicalOs(browser[0])})`
          },
          // The raw byte 0x00 (`new Uint8Array(1)` on WA Web, `[]byte{0}` in whatsmeow) - NOT the
          // ASCII character '0' (0x30), which a plain JS string here would encode as.
          { tag: "link_code_pairing_nonce", attrs: {}, content: new Uint8Array([0]) }
        ]
      }
    ]
  };
}
var child2 = (n, tag) => {
  const c = Array.isArray(n.content) ? n.content.find((x) => x.tag === tag)?.content : void 0;
  return c instanceof Uint8Array ? c : void 0;
};
async function companionFinish(notification, creds, phoneNumber, code) {
  const reg = Array.isArray(notification.content) ? notification.content.find((c) => c.tag === "link_code_companion_reg") : void 0;
  if (!reg) return void 0;
  const ref = child2(reg, "link_code_pairing_ref");
  const primaryIdentity = child2(reg, "primary_identity_pub");
  const wrapped = child2(reg, "link_code_pairing_wrapped_primary_ephemeral_pub");
  if (!ref || !primaryIdentity || !wrapped || wrapped.length < 80 || primaryIdentity.length !== 32)
    return void 0;
  const primaryEphemeral = ctr(
    true,
    wrapped.subarray(48, 80),
    await codeKey(code, wrapped.subarray(0, 32)),
    wrapped.subarray(32, 48)
  );
  const companionShared = sharedKey(creds.pairingEphemeralKey.privateKey, primaryEphemeral);
  const random = (0, import_node_crypto13.randomBytes)(32);
  const salt = (0, import_node_crypto13.randomBytes)(32);
  const bundleKey = Buffer.from(
    (0, import_node_crypto13.hkdfSync)("sha256", companionShared, salt, "link_code_pairing_key_bundle_encryption_key", 32)
  );
  const iv = (0, import_node_crypto13.randomBytes)(12);
  const gcm = (0, import_node_crypto13.createCipheriv)("aes-256-gcm", bundleKey, iv);
  const body = Buffer.concat([
    gcm.update(Buffer.concat([creds.signedIdentityKey.publicKey, primaryIdentity, random])),
    gcm.final(),
    gcm.getAuthTag()
  ]);
  const identityShared = sharedKey(creds.signedIdentityKey.privateKey, primaryIdentity);
  const advSecret = Buffer.from(
    (0, import_node_crypto13.hkdfSync)(
      "sha256",
      Buffer.concat([companionShared, identityShared, random]),
      Buffer.alloc(0),
      "adv_secret",
      32
    )
  );
  return {
    advSecretKey: advSecret.toString("base64"),
    finish: {
      tag: "iq",
      attrs: { to: "s.whatsapp.net", type: "set", xmlns: "md" },
      content: [
        {
          tag: "link_code_companion_reg",
          attrs: {
            jid: `${phoneNumber.replace(/\D/g, "")}@s.whatsapp.net`,
            stage: "companion_finish"
          },
          content: [
            {
              tag: "link_code_pairing_wrapped_key_bundle",
              attrs: {},
              content: Buffer.concat([salt, iv, body])
            },
            {
              tag: "companion_identity_public",
              attrs: {},
              content: creds.signedIdentityKey.publicKey
            },
            { tag: "link_code_pairing_ref", attrs: {}, content: ref }
          ]
        }
      ]
    }
  };
}

// src/client/features/chat/history.ts
var import_node_zlib2 = require("zlib");
var MAX_INFLATED_BYTES = 512 * 1024 * 1024;
var num2 = (v) => v === void 0 || v === null || v === "" ? void 0 : Number(v);
function parseHistory(compressed) {
  const inflated = (0, import_node_zlib2.inflateSync)(compressed, { maxOutputLength: MAX_INFLATED_BYTES });
  const T = protoType("HistorySync");
  const h = T.toObject(T.decode(inflated), { longs: String, bytes: String, enums: String });
  const chats = (h["conversations"] ?? []).map((c) => {
    const messages = (c["messages"] ?? []).flatMap((m) => {
      const w = m["message"];
      if (!w?.["key"]) return [];
      return [
        {
          key: {
            remoteJid: w["key"].remoteJid ?? c["id"],
            fromMe: Boolean(w["key"].fromMe),
            id: w["key"].id,
            ...w["key"].participant && { participant: w["key"].participant }
          },
          ...w["message"] && { message: w["message"] },
          ...num2(w["messageTimestamp"]) !== void 0 && {
            timestamp: num2(w["messageTimestamp"])
          },
          ...w["pushName"] && { pushName: w["pushName"] }
        }
      ];
    });
    return {
      id: c["id"],
      ...c["name"] && { name: c["name"] },
      ...c["unreadCount"] !== void 0 && { unreadCount: Number(c["unreadCount"]) },
      ...num2(c["conversationTimestamp"]) !== void 0 && {
        conversationTimestamp: num2(c["conversationTimestamp"])
      },
      ...c["archived"] !== void 0 && { archived: Boolean(c["archived"]) },
      ...num2(c["pinned"]) !== void 0 && { pinned: num2(c["pinned"]) > 0 },
      ...num2(c["muteEndTime"]) !== void 0 && { muteEndTime: num2(c["muteEndTime"]) },
      ...num2(c["ephemeralExpiration"]) !== void 0 && {
        ephemeralExpiration: num2(c["ephemeralExpiration"])
      },
      messages
    };
  });
  return {
    syncType: String(h["syncType"] ?? "UNKNOWN"),
    ...num2(h["progress"]) !== void 0 && { progress: num2(h["progress"]) },
    ...num2(h["chunkOrder"]) !== void 0 && { chunkOrder: num2(h["chunkOrder"]) },
    chats,
    pushNames: (h["pushnames"] ?? []).filter((p) => p.id && p.pushname).map((p) => ({ id: p.id, name: p.pushname })),
    lidMappings: (h["phoneNumberToLidMappings"] ?? []).filter((m) => m.lidJid && m.pnJid).map((m) => ({ lid: m.lidJid, pn: m.pnJid }))
  };
}
async function loadHistory(n, download = downloadMedia) {
  const compressed = n.inline?.length ? n.inline : await download(n.ref, "md-msg-hist");
  const chunk = parseHistory(compressed);
  return {
    ...chunk,
    ...n.progress !== void 0 && chunk.progress === void 0 && { progress: n.progress },
    ...n.chunkOrder !== void 0 && chunk.chunkOrder === void 0 && { chunkOrder: n.chunkOrder }
  };
}

// src/client/features/mex.ts
var MexError = class extends Error {
  constructor(message, code, detail) {
    super(message);
    this.code = code;
    this.detail = detail;
    this.name = "MexError";
  }
  code;
  detail;
};
async function mexQuery(request, id, queryId, variables, dataPath) {
  const res = await request({
    tag: "iq",
    attrs: { id, type: "get", to: "s.whatsapp.net", xmlns: "w:mex" },
    content: [
      {
        tag: "query",
        attrs: { query_id: queryId },
        content: Buffer.from(JSON.stringify({ variables }), "utf8")
      }
    ]
  });
  const result = Array.isArray(res.content) ? res.content.find((c) => c.tag === "result") : void 0;
  const raw = result?.content;
  if (!raw) throw new MexError("empty w:mex response", 400, res);
  const text4 = typeof raw === "string" ? raw : Buffer.from(raw).toString("utf8");
  const data = JSON.parse(text4);
  if (data.errors?.length) {
    const first = data.errors[0];
    throw new MexError(
      `GraphQL server error: ${data.errors.map((e) => e.message ?? "unknown").join(", ")}`,
      first.extensions?.error_code ?? 400,
      first
    );
  }
  const out = dataPath ? data.data?.[dataPath] : data.data;
  if (out === void 0)
    throw new MexError(`unexpected w:mex response${dataPath ? ` (no ${dataPath})` : ""}`, 400, data);
  return out;
}
var mexFor = (request, nextId) => (queryId, variables, dataPath) => mexQuery(request, nextId(), queryId, variables, dataPath);

// src/client/features/channel/newsletters.ts
var NEWSLETTER_QUERY = {
  CREATE: "25149874324715067",
  UPDATE_METADATA: "27150690864552229",
  METADATA: "26629010453445271",
  SUBSCRIBERS: "27472091235714801",
  FOLLOW: "24404358912487870",
  UNFOLLOW: "9767147403369991",
  MUTE: "25033614912931367",
  UNMUTE: "24551592861177484",
  DELETE: "30062808666639665",
  LABEL_AI_CONTENT: "27909718265289596",
  LABEL_PAID_PARTNERSHIP: "26102375079404865",
  ADMIN_DEMOTE: "9880997548630971",
  ADMIN_INVITE: "9387141988078609",
  ADMIN_INVITE_REVOKE: "9656078347839416",
  ADMIN_INVITE_ACCEPT: "9580828702035549",
  ADMIN_COUNT: "27579307995002556",
  ADMIN_CAPABILITIES: "9801384413216421",
  ADMIN_INFO: "26278439461859188",
  ADMIN_METADATA: "26882701001369256",
  ADMIN_PROFILE_UPDATE: "25959584293627630",
  CHANGE_OWNER: "24737692515842078",
  BLOCK_USER: "25106066249006236",
  INSIGHTS: "24672564052397921",
  USER_REPORTS: "27149305681394065",
  ENFORCEMENTS: "27835373536068060",
  CREATE_REPORT_APPEAL: "27792557363683798",
  UPDATE_VERIFICATION: "27133493439664458",
  CREATE_VERIFIED: "27777918425146464",
  UPDATE_USER_SETTING: "31938993655691868",
  POLL_VOTER_LIST: "9407762219322536",
  REACTION_SENDERS: "29575462448733991",
  QUESTION_RESPONSE_STATE: "24896618076668076",
  LINK_PREVIEW_CHECK: "9101130456653613",
  DEHYDRATED: "26944199458535748",
  SEARCH: "25909596625362196",
  DIRECTORY_LIST: "26125047313831973",
  DIRECTORY_SEARCH: "26301059626252132",
  DIRECTORY_CATEGORY_PREVIEW: "35266481849605779",
  RECOMMENDED: "25806748772361516",
  SIMILAR: "26217043484590756",
  FOLLOWING: "26856957210673444"
};
var ROLES = ["OWNER", "ADMIN", "SUBSCRIBER"];
var STATES = ["ACTIVE", "SUSPENDED", "GEO_SUSPENDED"];
function parseNewsletter(raw) {
  const r = raw?.["result"] ?? raw;
  if (!r || typeof r["id"] !== "string") throw new Error("not a newsletter answer");
  const t = r["thread_metadata"] ?? {};
  const v = r["viewer_metadata"] ?? {};
  const upper = (x) => String(x ?? "").toUpperCase();
  const num3 = (x) => x === void 0 || x === null ? void 0 : parseInt(String(x), 10);
  return {
    id: r["id"],
    ...t["name"]?.text !== void 0 && { name: t["name"].text },
    ...t["description"]?.text !== void 0 && { description: t["description"].text },
    ...t["invite"] && { invite: t["invite"] },
    ...num3(t["creation_time"]) !== void 0 && { creationTime: num3(t["creation_time"]) },
    ...num3(t["subscribers_count"]) !== void 0 && { subscribers: num3(t["subscribers_count"]) },
    ...t["verification"] && { verification: t["verification"] },
    ...t["picture"]?.direct_path && { pictureDirectPath: t["picture"].direct_path },
    ...v["mute"] !== void 0 && { muted: upper(v["mute"]) === "ON" },
    role: ROLES.includes(upper(v["role"])) ? upper(v["role"]) : "GUEST",
    state: STATES.includes(upper(t["state"] ?? r["state"])) ? upper(t["state"] ?? r["state"]) : "UNKNOWN"
  };
}
var Newsletters = class {
  constructor(mex, request, nextId) {
    this.mex = mex;
    this.request = request;
    this.nextId = nextId;
  }
  mex;
  request;
  nextId;
  /**
   * Mark one of our posts as AI-generated content (`serverId` is the number from the send ack). The app only shows
   * this label on image and video posts, not on text posts.
   */
  labelAiContent = (jid, serverId, messageType2 = "MESSAGE") => this.mex(
    NEWSLETTER_QUERY.LABEL_AI_CONTENT,
    { newsletter_id: jid, server_id: String(serverId), message_type: messageType2 },
    "xwa2_newsletter_label_ai_content"
  );
  /** Mark one of our posts as a paid partnership. */
  labelPaidPartnership = (jid, serverId, messageType2 = "MESSAGE") => this.mex(
    NEWSLETTER_QUERY.LABEL_PAID_PARTNERSHIP,
    { newsletter_id: jid, server_id: String(serverId), message_type: messageType2 },
    "xwa2_newsletter_label_paid_partnership"
  );
  create = async (name, description) => parseNewsletter(
    await this.mex(
      NEWSLETTER_QUERY.CREATE,
      { input: { name, description: description ?? null } },
      "xwa2_newsletter_create"
    )
  );
  /** Look up by `jid` (`1203...@newsletter`) or by `invite` code. */
  metadata = async (type, key) => parseNewsletter(
    await this.mex(
      NEWSLETTER_QUERY.METADATA,
      {
        fetch_creation_time: true,
        fetch_full_image: true,
        fetch_viewer_metadata: true,
        input: { key, type: type.toUpperCase() }
      },
      "xwa2_newsletter"
    )
  );
  follow = (jid) => this.mex(NEWSLETTER_QUERY.FOLLOW, { newsletter_id: jid }, "xwa2_newsletter_join_v2");
  unfollow = (jid) => this.mex(NEWSLETTER_QUERY.UNFOLLOW, { newsletter_id: jid }, "xwa2_newsletter_leave_v2");
  mute = (jid) => this.mex(NEWSLETTER_QUERY.MUTE, { newsletter_id: jid }, "xwa2_newsletter_mute_v2");
  unmute = (jid) => this.mex(NEWSLETTER_QUERY.UNMUTE, { newsletter_id: jid }, "xwa2_newsletter_unmute_v2");
  delete = (jid) => this.mex(NEWSLETTER_QUERY.DELETE, { newsletter_id: jid }, "xwa2_newsletter_delete_v2");
  subscribers = (jid) => this.mex(NEWSLETTER_QUERY.SUBSCRIBERS, { newsletter_id: jid }, "xwa2_newsletter_followers");
  /** Change the name, the description, the `topic` (category) or the `picture` (base64 JPEG; `''` removes it). */
  update = (jid, updates) => this.mex(
    NEWSLETTER_QUERY.UPDATE_METADATA,
    { newsletter_id: jid, updates: { ...updates, settings: null } },
    "xwa2_newsletter_update"
  );
  /** Set the channel's picture (JPEG bytes) or take it away. */
  setPicture = (jid, jpeg) => {
    if (jpeg[0] !== 255 || jpeg[1] !== 216) throw new Error("channel pictures must be JPEG");
    return this.update(jid, { picture: Buffer.from(jpeg).toString("base64") });
  };
  removePicture = (jid) => this.update(jid, { picture: "" });
  setCategory = (jid, topic) => this.update(jid, { topic });
  /** Channel settings that are not text (for example who may react, `{ reaction_codes: { value: 'ALL' } }`). */
  updateSettings = (jid, settings) => this.mex(
    NEWSLETTER_QUERY.UPDATE_METADATA,
    { newsletter_id: jid, updates: { settings } },
    "xwa2_newsletter_update"
  );
  /** Your own settings for a channel (for example muting, reaction notifications). */
  updateUserSetting = (jid, setting) => this.mex(
    NEWSLETTER_QUERY.UPDATE_USER_SETTING,
    { input: { newsletter_id: jid, ...setting } },
    "xwa2_newsletter_update_user_setting"
  );
  // ---- admins ----
  /** Make someone an admin straight away (a stanza). `inviteAdmin` asks them first. */
  async promoteAdmin(jid, userJid) {
    await this.request({
      tag: "iq",
      attrs: { id: this.nextId(), type: "set", xmlns: "newsletter", to: jid },
      content: [
        {
          tag: "admin_promote",
          attrs: {},
          content: [{ tag: "participant", attrs: { jid: userJid } }]
        }
      ]
    });
  }
  demoteAdmin = (jid, userJid) => this.mex(
    NEWSLETTER_QUERY.ADMIN_DEMOTE,
    { newsletter_id: jid, user_id: userJid },
    "xwa2_newsletter_admin_demote"
  );
  inviteAdmin = (jid, userJid) => this.mex(
    NEWSLETTER_QUERY.ADMIN_INVITE,
    { newsletter_id: jid, user_id: userJid },
    "xwa2_newsletter_admin_invite_create"
  );
  acceptAdminInvite = (jid) => this.mex(
    NEWSLETTER_QUERY.ADMIN_INVITE_ACCEPT,
    { newsletter_id: jid },
    "xwa2_newsletter_admin_invite_accept"
  );
  revokeAdminInvite = (jid, userJid) => this.mex(
    NEWSLETTER_QUERY.ADMIN_INVITE_REVOKE,
    { newsletter_id: jid, user_id: userJid },
    "xwa2_newsletter_admin_invite_revoke"
  );
  /** Hand the channel to another admin. */
  changeOwner = (jid, newOwnerJid) => this.mex(
    NEWSLETTER_QUERY.CHANGE_OWNER,
    { newsletter_id: jid, user_id: newOwnerJid },
    "xwa2_newsletter_change_owner"
  );
  async adminCount(jid) {
    const r = await this.mex(
      NEWSLETTER_QUERY.ADMIN_COUNT,
      { newsletter_id: jid },
      "xwa2_newsletter_admin"
    );
    return r?.admin_count;
  }
  async adminCapabilities(jid) {
    const r = await this.mex(
      NEWSLETTER_QUERY.ADMIN_CAPABILITIES,
      { newsletter_id: jid },
      "xwa2_newsletter_admin"
    );
    return r?.capabilities;
  }
  adminInfo = (jid) => this.mex(NEWSLETTER_QUERY.ADMIN_INFO, { newsletter_id: jid }, "xwa2_newsletter_admin");
  /** Admin view of a channel: pending invites, admin count, capabilities, your admin profile. */
  adminMetadata = (jid, o = {}) => this.mex(
    NEWSLETTER_QUERY.ADMIN_METADATA,
    {
      jid,
      include_thread_metadata: false,
      include_messages: false,
      fetch_pending_admin_invites: o.pendingAdmins ?? true,
      fetch_admin_count: o.adminCount ?? true,
      fetch_capabilities: o.capabilities ?? false,
      fetch_admin_profile: o.adminProfile ?? false,
      include_admin_settings: o.adminSettings ?? false,
      include_jarvis_config: false
    },
    "xwa2_newsletter_admin"
  );
  updateAdminProfile = (jid, updates) => this.mex(
    NEWSLETTER_QUERY.ADMIN_PROFILE_UPDATE,
    { newsletter_id: jid, updates },
    "xwa2_newsletter_admin_profile_update"
  );
  /** Keep a user from following or reacting. */
  blockUser = (jid, userJid) => this.mex(
    NEWSLETTER_QUERY.BLOCK_USER,
    { newsletter_id: jid, user_id: userJid },
    "xwa2_newsletter_block_user"
  );
  /** Statistics of a channel (`period` as the app names it). */
  insights = (jid, period) => this.mex(
    NEWSLETTER_QUERY.INSIGHTS,
    { newsletter_id: jid, ...period && { period } },
    "xwa2_newsletter_admin_insights"
  );
  userReports = (jid, cursor) => this.mex(
    NEWSLETTER_QUERY.USER_REPORTS,
    { newsletter_id: jid, ...cursor && { cursor } },
    "xwa2_newsletter_user_reports"
  );
  enforcements = (jid, locale = "en") => this.mex(
    NEWSLETTER_QUERY.ENFORCEMENTS,
    { newsletter_id: jid, locale },
    "xwa2_channel_enforcements"
  );
  appealReport = (jid, reason) => this.mex(
    NEWSLETTER_QUERY.CREATE_REPORT_APPEAL,
    { newsletter_id: jid, reason },
    "xwa2_newsletter_create_report_appeal"
  );
  updateVerification = (jid, verification) => this.mex(
    NEWSLETTER_QUERY.UPDATE_VERIFICATION,
    { newsletter_id: jid, verification },
    "xwa2_newsletter_update_verification"
  );
  createVerified = (name, description) => this.mex(
    NEWSLETTER_QUERY.CREATE_VERIFIED,
    { input: { name, description: description ?? null } },
    "xwa2_newsletter_create_verified"
  );
  // ---- posts ----
  /** Pin a post for `seconds` (default one day). `serverId` is the post's number. */
  async pinMessage(jid, serverId, seconds2 = 86400) {
    await this.request({
      tag: "iq",
      attrs: { id: this.nextId(), type: "set", xmlns: "newsletter", to: jid },
      content: [{ tag: "pin", attrs: { server_id: String(serverId), duration: String(seconds2) } }]
    });
  }
  async unpinMessage(jid, serverId) {
    await this.request({
      tag: "iq",
      attrs: { id: this.nextId(), type: "set", xmlns: "newsletter", to: jid },
      content: [{ tag: "unpin", attrs: { server_id: String(serverId) } }]
    });
  }
  /** Delete one of the channel's posts. */
  async revokeMessage(jid, serverId) {
    await this.request({
      tag: "message",
      attrs: { to: jid, type: "text", edit: "7", server_id: String(serverId), id: this.nextId() },
      content: []
    });
  }
  /** Tell the channel these posts were viewed (the view counter). */
  async sendViewReceipt(jid, serverIds) {
    await this.request({
      tag: "receipt",
      attrs: { to: jid, id: this.nextId(), type: "view" },
      content: [
        {
          tag: "list",
          attrs: {},
          content: serverIds.map((id) => ({ tag: "item", attrs: { server_id: String(id) } }))
        }
      ]
    });
  }
  /** View and reaction counters of one post (the raw answer). */
  viewStats = (jid, serverId) => this.request({
    tag: "iq",
    attrs: { id: this.nextId(), type: "get", xmlns: "newsletter", to: jid },
    content: [{ tag: "message_updates", attrs: { count: "1", server_id: String(serverId) } }]
  });
  /** Subscribe to live updates of a channel; answers how long the subscription lasts. */
  async liveUpdates(jid) {
    const res = await this.request({
      tag: "iq",
      attrs: { id: this.nextId(), type: "set", xmlns: "newsletter", to: jid },
      content: [{ tag: "live_updates", attrs: {}, content: [] }]
    });
    const d = (Array.isArray(res.content) ? res.content : []).find((c) => c.tag === "live_updates")?.attrs["duration"];
    return d ? { duration: d } : null;
  }
  /** The number of one of the recent posts, by its message id (looks at the last `limit`). */
  async serverIdOf(jid, messageId, limit = 50) {
    const res = await this.fetchMessages(jid, limit);
    const updates = (Array.isArray(res.content) ? res.content : []).find((c) => c.tag === "message_updates") ?? res;
    for (const m of Array.isArray(updates.content) ? updates.content : []) {
      if (m.tag === "message" && (m.attrs["message_id"] === messageId || m.attrs["id"] === messageId))
        return m.attrs["server_id"] ? Number(m.attrs["server_id"]) : null;
    }
    return null;
  }
  pollVoters = (jid, serverId, o = {}) => this.mex(
    NEWSLETTER_QUERY.POLL_VOTER_LIST,
    {
      input: {
        newsletter_id: jid,
        server_id: serverId,
        limit: o.limit ?? 20,
        ...o.voteHash && { vote_hash: o.voteHash }
      }
    },
    "voter_list"
  );
  reactionSenders = (jid, serverId) => this.mex(
    NEWSLETTER_QUERY.REACTION_SENDERS,
    { input: { id: jid, server_id: serverId } },
    "xwa2_newsletters_reaction_sender_list"
  );
  /** Mark a question post as answered / open (the answers box). */
  setQuestionState = (jid, serverId, state) => this.mex(
    NEWSLETTER_QUERY.QUESTION_RESPONSE_STATE,
    { newsletter_id: jid, server_id: serverId, state },
    "xwa2_newsletter_question_response_state_update"
  );
  /** Whether a link may get a preview in a channel post. */
  linkPreviewCheck = (url) => this.mex(
    NEWSLETTER_QUERY.LINK_PREVIEW_CHECK,
    { input: { url } },
    "xwa2_newsletter_link_preview"
  );
  // ---- finding channels ----
  /** Search the channel directory by words. */
  search = (text4, limit = 20, cursor) => this.directorySearch(text4, { limit, ...cursor && { cursor } });
  /** The directory by view: `RECOMMENDED`, `NEW`, `POPULAR`, `FEATURED` or `TRENDING`. */
  directoryList = (o = {}) => this.mex(
    NEWSLETTER_QUERY.DIRECTORY_LIST,
    {
      input: {
        view: o.view ?? "RECOMMENDED",
        filters: { country_codes: o.countryCodes ?? ["US"], categories: o.categories ?? [] },
        limit: o.limit ?? 20,
        ...o.cursor && { start_cursor: o.cursor }
      },
      fetch_status_metadata: false
    },
    "xwa2_newsletters_directory_list"
  );
  directorySearch = (text4, o = {}) => this.mex(
    NEWSLETTER_QUERY.DIRECTORY_SEARCH,
    {
      input: {
        search_text: text4,
        categories: o.categories ?? [],
        limit: o.limit ?? 20,
        ...o.cursor && { start_cursor: o.cursor }
      },
      fetch_status_metadata: false
    },
    "xwa2_newsletters_directory_search"
  );
  directoryCategories = (o = {}) => this.mex(
    NEWSLETTER_QUERY.DIRECTORY_CATEGORY_PREVIEW,
    {
      input: {
        categories: o.categories ?? [],
        ...o.countryCode && { country_code: o.countryCode },
        per_category_limit: o.perCategoryLimit ?? 5
      },
      fetch_status_metadata: false
    },
    "xwa2_newsletters_directory_category_preview"
  );
  recommended = (limit = 10, countryCodes = ["US"]) => this.mex(
    NEWSLETTER_QUERY.RECOMMENDED,
    { input: { limit, country_codes: countryCodes }, fetch_status_metadata: false },
    "xwa2_newsletters_recommended"
  );
  similar = (jid, limit = 10, countryCodes = ["US"]) => this.mex(
    NEWSLETTER_QUERY.SIMILAR,
    {
      input: { newsletter_id: jid, limit, country_codes: countryCodes },
      fetch_status_metadata: false
    },
    "xwa2_newsletters_similar"
  );
  /** The channels you follow. */
  following = (cursor, limit = 20) => this.mex(
    NEWSLETTER_QUERY.FOLLOWING,
    { limit, ...cursor && { start_cursor: cursor } },
    "xwa2_newsletter_following"
  );
  /** A channel by invite code or JID, the light way (`type` is `'invite'` or `'jid'`). */
  async dehydrated(type, key, o = {}) {
    return parseNewsletter(
      await this.mex(
        NEWSLETTER_QUERY.DEHYDRATED,
        {
          input: { key, type: type.toUpperCase(), view_role: o.role ?? "GUEST" },
          fetch_wamo_sub: false,
          fetch_pinned_messages: o.pinned ?? false
        },
        "xwa2_newsletter"
      )
    );
  }
  /** React to a channel post by its numeric `serverId`; empty `emoji` removes the reaction. */
  async react(jid, serverId, emoji) {
    await this.request({
      tag: "message",
      attrs: {
        to: jid,
        ...emoji ? {} : { edit: "7" },
        type: "reaction",
        server_id: serverId,
        id: this.nextId()
      },
      content: [{ tag: "reaction", attrs: emoji ? { code: emoji } : {} }]
    });
  }
  /** Recent posts (raw `<message_updates>` answer). */
  fetchMessages(jid, count, opts = {}) {
    return this.request({
      tag: "iq",
      attrs: { id: this.nextId(), type: "get", xmlns: "newsletter", to: jid },
      content: [
        {
          tag: "message_updates",
          attrs: {
            count: String(count),
            ...opts.since !== void 0 && { since: String(opts.since) },
            ...opts.after && { after: opts.after }
          }
        }
      ]
    });
  }
};
var childOf = (n, tag) => Array.isArray(n.content) ? n.content.find((c) => c.tag === tag) : void 0;
function parseChannelStatus(node, decode) {
  const a = node.attrs;
  if (!a["from"]?.endsWith("@newsletter") || !a["id"]) return void 0;
  const type = a["type"] ?? "text";
  const plain = childOf(node, "plaintext");
  const meta = childOf(node, "meta");
  const views = childOf(node, "views_count");
  const reactions = childOf(node, "reactions");
  let message;
  if (plain?.content instanceof Uint8Array && !a["edit"]) {
    try {
      message = decode(plain.content);
    } catch {
    }
  }
  return {
    channel: a["from"],
    id: a["id"],
    ...a["server_id"] && { serverId: Number(a["server_id"]) },
    ...a["t"] && { timestamp: Number(a["t"]) },
    fromMe: a["is_sender"] === "true",
    type,
    ...a["edit"] && { edit: a["edit"] },
    ...message && { message },
    ...plain?.attrs["mediatype"] && { mediaType: plain.attrs["mediatype"] },
    ...type === "reaction" && { reaction: childOf(node, "reaction")?.attrs["code"] ?? "" },
    ...meta && { meta: meta.attrs },
    ...views?.attrs["count"] && { viewsCount: Number(views.attrs["count"]) },
    ...Array.isArray(reactions?.content) && {
      reactions: reactions.content.filter((r) => r.tag === "reaction").map((r) => ({ code: r.attrs["code"] ?? "", count: Number(r.attrs["count"] ?? 0) }))
    }
  };
}

// src/client/features/contact/username.ts
var import_node_crypto14 = require("crypto");
var USERNAME_QUERY = {
  CHECK: "26122779627399568",
  CHECK_MULTI: "27134626522840286",
  SET: "27108705368767936",
  GET: "25347099718279209",
  GET_RECOMMENDATIONS: "26077456248616957",
  PIN_SET: "9749436995157074"
};
var Usernames = class {
  constructor(mex) {
    this.mex = mex;
  }
  mex;
  async check(username, includeSuggestions = true, sessionId = (0, import_node_crypto14.randomUUID)()) {
    const data = await this.mex(
      USERNAME_QUERY.CHECK,
      {
        username,
        include_suggestions: includeSuggestions,
        session_id: sessionId,
        source: "USER_INPUT"
      },
      "xwa2_username_check"
    );
    if (data?.result === "SUCCESS") return { available: true, username, sessionId };
    return {
      available: false,
      username,
      sessionId,
      suggestions: data?.suggestions ?? [],
      rejectionReasons: data?.rejection_reasons ?? [],
      suggestionsEligible: data?.suggestions_eligible ?? true
    };
  }
  checkMany = (usernames) => this.mex(USERNAME_QUERY.CHECK_MULTI, { usernames }, "xwa2_username_check_multi");
  /** Claim a username. */
  set = (username, o = {}) => this.mex(
    USERNAME_QUERY.SET,
    {
      username,
      reserved: true,
      source: o.source ?? "USER_INPUT",
      session_id: o.sessionId ?? (0, import_node_crypto14.randomUUID)(),
      ...o.pin && { pin: o.pin }
    },
    "xwa2_username_set"
  );
  delete = () => this.mex(USERNAME_QUERY.SET, { username: null }, "xwa2_username_delete");
  async mine() {
    const data = await this.mex(USERNAME_QUERY.GET, {}, "xwa2_username_get");
    return data?.username ?? null;
  }
  recommendations = (source) => this.mex(
    USERNAME_QUERY.GET_RECOMMENDATIONS,
    source ? { source } : {},
    "xwa2_username_get_recommendations"
  );
  /** Set (or with `null` clear) the 4-digit PIN others need to message you by username. */
  setPin = (pin2) => this.mex(USERNAME_QUERY.PIN_SET, pin2 != null ? { pin: pin2 } : {}, "xwa2_username_pin_set");
};

// src/client/features/account/account.ts
var removeDeviceNode = (jid, reason = "user_initiated") => ({
  tag: "iq",
  attrs: { to: "s.whatsapp.net", xmlns: "md", type: "set" },
  content: [{ tag: "remove-companion-device", attrs: { jid, reason } }]
});
var IDS = {
  TRUSTED_ADD: "24522952587403287",
  TRUSTED_LIST: "27391232653862770",
  TRUSTED_UNTRUST: "26574930682133620",
  TRUSTED_DELETE: "33867503889559538",
  LINKED_PROFILES_SET: "25013968611531010",
  LINKED_PROFILES_REMOVE: "24537675509265525",
  LINKED_PROFILES_UPDATE: "24876967165297614"
};
var Account = class {
  constructor(request, mex) {
    this.request = request;
    this.mex = mex;
  }
  request;
  mex;
  /** Remove one of the account's linked devices (a phone's "Linked devices" entry). Needs the device's own JID. */
  async removeDevice(jid, reason = "user_initiated") {
    await this.request(removeDeviceNode(jid, reason));
  }
  /** Devices that are marked trusted for this account. */
  trustedDevices = () => this.mex(IDS.TRUSTED_LIST, {}, "xwa2_get_trusted_devices");
  trustDevice = (deviceId, deviceName) => this.mex(
    IDS.TRUSTED_ADD,
    { device_id: deviceId, device_name: deviceName },
    "xwa2_add_trusted_device"
  );
  untrustDevice = (deviceId, reason = "USER_INITIATED") => this.mex(IDS.TRUSTED_UNTRUST, { device_id: deviceId, reason }, "xwa2_untrust_trusted_device");
  deleteTrustedDevice = (deviceId) => this.mex(IDS.TRUSTED_DELETE, { device_id: deviceId }, "xwa2_delete_trusted_device");
  /** Show other accounts on the profile (Instagram, Facebook, ...): by account id (`vid`) or username. */
  setLinkedProfiles = (profiles) => this.mex(
    IDS.LINKED_PROFILES_SET,
    {
      profiles: profiles.map((p) => ({
        type: p.type,
        ...p.vid ? { vid: p.vid } : p.username ? { username: p.username } : {}
      }))
    },
    "xwa2_linked_profiles_set"
  );
  removeLinkedProfiles = (types) => this.mex(
    IDS.LINKED_PROFILES_REMOVE,
    { profiles: types.map((type) => ({ type })) },
    "xwa2_linked_profiles_remove"
  );
  showLinkedProfiles = (profiles) => this.mex(
    IDS.LINKED_PROFILES_UPDATE,
    { profiles: profiles.map((p) => ({ type: p.type, show_on_profile: p.showOnProfile })) },
    "xwa2_linked_profiles_update"
  );
};

// src/client/features/message/media-retry.ts
var import_node_crypto15 = require("crypto");
var retryKey = (mediaKey) => Buffer.from(
  (0, import_node_crypto15.hkdfSync)("sha256", mediaKey, Buffer.alloc(0), "WhatsApp Media Retry Notification", 32)
);
function mediaRetryRequest(key, mediaKey, meId) {
  const iv = (0, import_node_crypto15.randomBytes)(12);
  const c = (0, import_node_crypto15.createCipheriv)("aes-256-gcm", retryKey(mediaKey), iv);
  c.setAAD(Buffer.from(key.id));
  const body = Buffer.concat([
    c.update(encodeProto("ServerErrorReceipt", { stanzaId: key.id })),
    c.final(),
    c.getAuthTag()
  ]);
  const bare3 = meId.replace(/:\d+@/, "@");
  return {
    tag: "receipt",
    attrs: { id: key.id, to: bare3, type: "server-error" },
    content: [
      {
        tag: "encrypt",
        attrs: {},
        content: [
          { tag: "enc_p", attrs: {}, content: body },
          { tag: "enc_iv", attrs: {}, content: iv }
        ]
      },
      {
        tag: "rmr",
        attrs: {
          jid: key.remoteJid,
          from_me: String(!!key.fromMe),
          ...key.participant && { participant: key.participant }
        }
      }
    ]
  };
}
var bytes = (n) => n && n.content instanceof Uint8Array ? n.content : void 0;
function decodeMediaRetryNode(node) {
  const kids10 = Array.isArray(node.content) ? node.content : [];
  const rmr = kids10.find((c) => c.tag === "rmr");
  if (!rmr) return void 0;
  const event = {
    key: {
      id: node.attrs["id"] ?? "",
      remoteJid: rmr.attrs["jid"] ?? "",
      fromMe: rmr.attrs["from_me"] === "true",
      ...rmr.attrs["participant"] && { participant: rmr.attrs["participant"] }
    }
  };
  const error = kids10.find((c) => c.tag === "error");
  if (error) return { ...event, error: { code: Number(error.attrs["code"] ?? 0) } };
  const enc2 = kids10.find((c) => c.tag === "encrypt");
  const sub = Array.isArray(enc2?.content) ? enc2.content : [];
  const ciphertext = bytes(sub.find((c) => c.tag === "enc_p"));
  const iv = bytes(sub.find((c) => c.tag === "enc_iv"));
  return ciphertext && iv ? { ...event, media: { ciphertext, iv } } : { ...event, error: { code: 404 } };
}
function decryptMediaRetry(media, mediaKey, msgId) {
  const buf = Buffer.from(media.ciphertext);
  const d = (0, import_node_crypto15.createDecipheriv)("aes-256-gcm", retryKey(mediaKey), media.iv);
  d.setAAD(Buffer.from(msgId));
  d.setAuthTag(buf.subarray(buf.length - 16));
  const plain = Buffer.concat([d.update(buf.subarray(0, buf.length - 16)), d.final()]);
  const t = protoType("MediaRetryNotification");
  const n = t.toObject(t.decode(plain), { enums: String });
  return { result: n.result ?? "GENERAL_ERROR", ...n.directPath && { directPath: n.directPath } };
}

// src/client/features/contact/tctoken.ts
var import_node_fs14 = require("fs");
var import_node_path10 = require("path");
var BUCKET = 604800;
var BUCKETS = 4;
var isTcTokenExpired = (t, now = Date.now() / 1e3) => {
  if (!t || Number.isNaN(t)) return true;
  const cutoff = (Math.floor(now / BUCKET) - (BUCKETS - 1)) * BUCKET;
  return t < cutoff;
};
var shouldIssueTcToken = (senderTs, now = Date.now() / 1e3) => senderTs === void 0 || Math.floor(now / BUCKET) > Math.floor(senderTs / BUCKET);
var isRegularUser = (jid) => {
  const [user = "", server2 = ""] = jid.split("@");
  if (user === "0" || /^1313555\d{4}$|^131655500\d{2}$/.test(user)) return false;
  return server2 === "s.whatsapp.net" || server2 === "lid" || server2 === "c.us";
};
var bare = (jid) => jid.replace(/:\d+@/, "@");
var TcTokens = class {
  constructor(path) {
    this.path = path;
    if (path && (0, import_node_fs14.existsSync)(path)) {
      try {
        for (const [k, v] of Object.entries(
          JSON.parse((0, import_node_fs14.readFileSync)(path, "utf8"))
        ))
          this.#data.set(k, v);
      } catch {
      }
    }
  }
  path;
  #data = /* @__PURE__ */ new Map();
  #issuing = /* @__PURE__ */ new Set();
  #save() {
    if (!this.path) return;
    (0, import_node_fs14.mkdirSync)((0, import_node_path10.dirname)(this.path), { recursive: true, mode: 448 });
    const tmp = `${this.path}.tmp`;
    (0, import_node_fs14.writeFileSync)(tmp, JSON.stringify(Object.fromEntries(this.#data)), { mode: 384 });
    (0, import_node_fs14.renameSync)(tmp, this.path);
  }
  /** The token to attach to a message for `jid`, if we hold a fresh one. */
  tokenFor(jid) {
    const e = this.#data.get(bare(jid));
    if (!e?.token) return void 0;
    if (isTcTokenExpired(e.t)) {
      this.#data.set(bare(jid), {
        token: "",
        ...e.senderTs !== void 0 && { senderTs: e.senderTs }
      });
      this.#save();
      return void 0;
    }
    return new Uint8Array(Buffer.from(e.token, "base64"));
  }
  /** Keep the tokens of a `<tokens>` node (an iq answer or a `privacy_token` notification). */
  storeFrom(node, fallbackJid) {
    const tokens = Array.isArray(node.content) ? node.content.find((c) => c.tag === "tokens") : void 0;
    let stored = 0;
    for (const n of Array.isArray(tokens?.content) ? tokens.content : []) {
      if (n.tag !== "token" || n.attrs["type"] !== "trusted_contact") continue;
      if (!(n.content instanceof Uint8Array)) continue;
      const jid = bare(fallbackJid || n.attrs["jid"] || "");
      const t = Number(n.attrs["t"] ?? 0);
      if (!jid || !isRegularUser(jid) || !t) continue;
      const old = this.#data.get(jid);
      if (old?.t && old.t > t) continue;
      this.#data.set(jid, { ...old, token: Buffer.from(n.content).toString("base64"), t });
      stored++;
    }
    if (stored) this.#save();
    return stored;
  }
  /**
   * After a 1:1 message: give the contact our token (once per 7 days). Fire and forget; never throws.
   * `request` is the iq channel; `storageJid` is the contact's address.
   */
  issueTo(jid, request, now = Date.now() / 1e3) {
    const key = bare(jid);
    if (!isRegularUser(key) || this.#issuing.has(key)) return;
    if (!shouldIssueTcToken(this.#data.get(key)?.senderTs, now)) return;
    this.#issuing.add(key);
    const t = Math.floor(now);
    void request({
      tag: "iq",
      attrs: { to: "s.whatsapp.net", type: "set", xmlns: "privacy" },
      content: [
        {
          tag: "tokens",
          attrs: {},
          content: [{ tag: "token", attrs: { jid: key, t: String(t), type: "trusted_contact" } }]
        }
      ]
    }).then((res) => {
      this.storeFrom(res, key);
      const e = this.#data.get(key);
      this.#data.set(key, { token: "", ...e, senderTs: t });
      this.#save();
    }).catch(() => void 0).finally(() => this.#issuing.delete(key));
  }
};

// src/client/features/message/sticker-pack.ts
var import_node_crypto16 = require("crypto");
var MAX_STICKERS = 60;
var CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(data) {
  let c = 4294967295;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 255] ^ c >>> 8;
  return (c ^ 4294967295) >>> 0;
}
function zipStore(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(67324752, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(2048, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(f.data.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, Buffer.from(f.data));
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(33639248, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(2048, 8);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(f.data.length, 20);
    dir.writeUInt32LE(f.data.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, name);
    offset += 30 + name.length + f.data.length;
  }
  const cdSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(101010256, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, end]);
}
function isAnimatedWebp(d) {
  const b = Buffer.from(d);
  return b.length > 21 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP" && b.toString("latin1", 12, 16) === "VP8X" && (b[20] & 2) !== 0;
}
function createStickerPackZip(packId, stickers, cover) {
  if (!packId || packId.length > 128 || /[/\\.\u0000-\u001f]/.test(packId))
    throw new Error(
      "invalid pack id: 1 to 128 characters, no path separators, dots or control characters"
    );
  if (!stickers.length) throw new Error("a sticker pack needs at least one sticker");
  if (stickers.length > MAX_STICKERS)
    throw new Error(`a sticker pack holds at most ${MAX_STICKERS} stickers`);
  const trayIconFileName = `${packId}.webp`;
  const files = [{ name: trayIconFileName, data: cover }];
  const seen = /* @__PURE__ */ new Set();
  const list = stickers.map((s) => {
    const name = `${(0, import_node_crypto16.createHash)("sha256").update(s.data).digest("base64url")}.webp`;
    if (!seen.has(name)) {
      seen.add(name);
      files.push({ name, data: s.data });
    }
    return {
      fileName: name,
      isAnimated: isAnimatedWebp(s.data),
      emojis: s.emojis ?? [],
      ...s.accessibilityLabel && { accessibilityLabel: s.accessibilityLabel },
      isLottie: false,
      mimetype: "image/webp"
    };
  });
  return { zip: zipStore(files), stickers: list, trayIconFileName };
}
var newPackId = () => (0, import_node_crypto16.randomUUID)().toUpperCase();

// src/client/features/contact/bots.ts
var kids6 = (n, tag) => n && Array.isArray(n.content) ? n.content.filter((c) => c.tag === tag) : [];
var entry = (n) => {
  const jid = n.attrs["jid"];
  const personaId = n.attrs["persona_id"];
  if (!jid || !personaId) return void 0;
  return {
    jid,
    personaId,
    ...n.attrs["card_title"] && { cardTitle: n.attrs["card_title"] },
    ...n.attrs["count"] && { count: Number(n.attrs["count"]) }
  };
};
var botListRequest = () => ({
  tag: "iq",
  attrs: { type: "get", xmlns: "bot", to: "s.whatsapp.net" },
  content: [{ tag: "bot", attrs: { v: "2" } }]
});
function parseBotList(res) {
  const bot = kids6(res, "bot")[0];
  if (!bot) throw new Error("no <bot> in the bot directory answer");
  const sections = kids6(bot, "section").map((s) => ({
    name: s.attrs["name"] ?? "",
    type: s.attrs["type"] ?? "all",
    ...s.attrs["display_type"] && { displayType: s.attrs["display_type"] },
    bots: kids6(s, "bot").map(entry).filter((e) => !!e)
  }));
  const d = kids6(bot, "default")[0];
  const defaultBot = d?.attrs["jid"] && d.attrs["persona_id"] ? { jid: d.attrs["jid"], personaId: d.attrs["persona_id"] } : void 0;
  const bots = sections.flatMap((s) => s.bots);
  if (defaultBot && !bots.some((b) => b.jid === defaultBot.jid))
    bots.unshift({ jid: defaultBot.jid, personaId: defaultBot.personaId });
  return {
    version: bot.attrs["v"] ?? "2",
    ...defaultBot && { defaultBot },
    sections,
    bots
  };
}
var listBots = async (request) => parseBotList(await request(botListRequest()));

// src/client/features/contact/prekey-rotation.ts
var SIGNED_PRE_KEY_INTERVAL_MS = 27 * 24 * 60 * 60 * 1e3;
var SIGNED_PRE_KEY_RETENTION = 3;
var be32 = (n) => new Uint8Array([n >> 16 & 255, n >> 8 & 255, n & 255]);
var rotateSignedPreKeyNode = (id, publicKey, signature) => ({
  tag: "iq",
  attrs: { to: "s.whatsapp.net", type: "set", xmlns: "encrypt" },
  content: [
    {
      tag: "rotate",
      attrs: {},
      content: [
        {
          tag: "skey",
          attrs: {},
          content: [
            { tag: "id", attrs: {}, content: be32(id) },
            { tag: "value", attrs: {}, content: publicKey },
            { tag: "signature", attrs: {}, content: signature }
          ]
        }
      ]
    }
  ]
});

// src/client/features/account/server.ts
var IDS2 = {
  REACHOUT_TIMELOCK: "23983697327930364",
  NEW_CHAT_CAP: "27910975521856601"
};
var kids7 = (n, tag) => n && Array.isArray(n.content) ? n.content.filter((c) => c.tag === tag) : [];
var abPropsRequest = (o = {}) => ({
  tag: "iq",
  attrs: { to: "s.whatsapp.net", type: "get", xmlns: "abt" },
  content: [
    {
      tag: "props",
      attrs: {
        protocol: "1",
        ...o.hash && { hash: o.hash },
        ...o.refreshId && { refresh_id: o.refreshId }
      }
    }
  ]
});
function parseAbProps(res) {
  const p = kids7(res, "props")[0];
  const props = {};
  for (const n of kids7(p, "prop"))
    if (n.attrs["config_code"] !== void 0)
      props[n.attrs["config_code"]] = n.attrs["config_value"] ?? "";
  return {
    props,
    ...p?.attrs["hash"] && { hash: p.attrs["hash"] },
    ...p?.attrs["refresh_id"] && { refreshId: p.attrs["refresh_id"] },
    ...p?.attrs["refresh"] && { refresh: Number(p.attrs["refresh"]) }
  };
}
var passiveNode = (active) => ({
  tag: "iq",
  attrs: { to: "s.whatsapp.net", type: "set", xmlns: "passive" },
  content: [{ tag: active ? "active" : "passive", attrs: {} }]
});
var ServerInfo = class {
  constructor(request, mex) {
    this.request = request;
    this.mex = mex;
  }
  request;
  mex;
  /** The server's experiment flags (A/B props). Pass the last `hash` and `refreshId` to get changes only. */
  async abProps(o = {}) {
    return parseAbProps(await this.request(abPropsRequest(o)));
  }
  /** Whether the account is restricted from starting chats with people who do not know it ("reachout timelock"). */
  reachoutTimelock = () => this.mex(IDS2.REACHOUT_TIMELOCK, {}, "xwa2_fetch_account_reachout_timelock");
  /** How many new chats the account may start in the current period. */
  newChatCap = () => this.mex(
    IDS2.NEW_CHAT_CAP,
    { input: { type: "INDIVIDUAL_NEW_CHAT_THREAD" } },
    "xwa2_message_capping_info"
  );
  /** Go active (get every notification) or passive (background; fewer stanzas). */
  setPassive = async (passive) => {
    await this.request(passiveNode(!passive));
  };
};

// src/client/features/call/room.ts
var bare2 = (jid) => jid.replace(/:\d+@/, "@");
var Room = class extends TypedEmitter {
  /** The link to hand out. */
  url;
  token;
  callId;
  media;
  #host;
  #rule;
  #maxGuests;
  #waiting = /* @__PURE__ */ new Map();
  #inside = /* @__PURE__ */ new Map();
  #handled = /* @__PURE__ */ new Set();
  #owner;
  #off;
  #closed = false;
  constructor(host, info, o = {}) {
    super();
    this.#host = host;
    this.url = info.url;
    this.token = info.token;
    this.callId = info.callId;
    this.media = info.media;
    this.#owner = bare2(info.owner);
    this.#rule = o.admit ?? "all";
    this.#maxGuests = o.maxGuests ?? Number.POSITIVE_INFINITY;
    this.#off = host.on("call", (e) => void this.#handle(e));
  }
  /** People waiting to be let in. */
  get waiting() {
    return [...this.#waiting.values()];
  }
  /** People in the call now (the owner not included). */
  get inside() {
    return [...this.#inside.values()];
  }
  get closed() {
    return this.#closed;
  }
  /** Let a waiting person in. */
  async admit(jid) {
    const p = this.#waiting.get(bare2(jid)) ?? { jid, guest: false };
    await this.#host.answerWaitingRoom(this.callId, jid, true);
    this.#waiting.delete(bare2(jid));
    this.emit("admitted", p);
  }
  /** Turn a waiting person away. */
  async deny(jid) {
    const p = this.#waiting.get(bare2(jid)) ?? { jid, guest: false };
    await this.#host.answerWaitingRoom(this.callId, jid, false);
    this.#waiting.delete(bare2(jid));
    this.emit("denied", p);
  }
  /** Ask for approval (the default) or let everybody straight in. */
  setApprovalRequired(on) {
    return this.#host.setApprovalRequired(this.callId, on);
  }
  /** End the call for everybody and stop watching. */
  async close(reason = "closed") {
    if (this.#closed) return;
    this.#closed = true;
    this.#off?.();
    this.#off = void 0;
    await this.#host.endCall(this.callId).catch(() => void 0);
    this.emit("closed", { reason });
  }
  async #decide(p) {
    if (this.#inside.size >= this.#maxGuests) return false;
    if (this.#rule === "all") return true;
    if (this.#rule === "guests") return p.guest;
    if (this.#rule === "none") return false;
    return this.#rule(p);
  }
  async #handle(e) {
    if (this.#closed || e.callId !== this.callId) return;
    this.emit("trace", { kind: e.status, data: e.node ?? e });
    if (e.status === "terminate" && (e.from === `${this.callId}@call` || bare2(e.from) === this.#owner)) {
      this.#closed = true;
      this.#off?.();
      this.emit("closed", { reason: "terminated" });
      return;
    }
    for (const w of e.waitingRoom ?? []) {
      const key = bare2(w.jid);
      if (key === this.#owner || w.state !== "waiting_room_joined" || this.#handled.has(key))
        continue;
      this.#handled.add(key);
      const person = { jid: w.jid, guest: w.guest, ...w.name && { name: w.name } };
      this.#waiting.set(key, person);
      this.emit("request", person);
      try {
        if (await this.#decide(person)) await this.admit(w.jid);
        else if (this.#rule !== "none") await this.deny(w.jid);
      } catch (err) {
        this.emit("trace", { kind: "decision-failed", data: String(err.message) });
        this.#handled.delete(key);
      }
    }
    for (const r of e.roster ?? []) {
      const key = bare2(r.jid);
      if (key === this.#owner) continue;
      const person = { jid: r.jid, guest: r.guest, ...r.name && { name: r.name } };
      if (r.state === "connected" && !this.#inside.has(key)) {
        this.#inside.set(key, person);
        this.emit("joined", person);
      } else if (r.state === "terminated" && this.#inside.has(key)) {
        this.#inside.delete(key);
        this.#handled.delete(key);
        this.emit("left", person);
      }
    }
  }
};

// src/client/features/business/manage.ts
var IDS3 = {
  CREATE_CATALOG: "29232780583035464",
  CREATE_COLLECTION: "29361942130088470",
  UPDATE_COLLECTION: "24486970300891371",
  DELETE_COLLECTIONS: "29970196299234260",
  APPEAL_PRODUCT: "29276343172013990",
  APPEAL_COLLECTION: "9971242039605207"
};
var text3 = (tag, v) => ({ tag, attrs: {}, content: Buffer.from(v) });
var kids8 = (n, tag) => n && Array.isArray(n.content) ? n.content.filter((c) => c.tag === tag) : [];
function productNode(id, p) {
  const attrs = {};
  const content = [];
  if (id !== void 0) content.push(text3("id", id));
  if (p.name !== void 0) content.push(text3("name", p.name));
  if (p.description !== void 0) content.push(text3("description", p.description));
  if (p.retailerId !== void 0) content.push(text3("retailer_id", p.retailerId));
  if (p.images?.length)
    content.push({
      tag: "media",
      attrs: {},
      content: p.images.map((img) => ({
        tag: "image",
        attrs: {},
        content: [text3("url", img.url)]
      }))
    });
  if (p.price !== void 0) content.push(text3("price", String(p.price)));
  if (p.currency !== void 0) content.push(text3("currency", p.currency));
  if ("originCountryCode" in p) {
    if (p.originCountryCode === void 0) attrs["compliance_category"] = "COUNTRY_ORIGIN_EXEMPT";
    else
      content.push({
        tag: "compliance_info",
        attrs: {},
        content: [text3("country_code_origin", p.originCountryCode)]
      });
  }
  if (p.isHidden !== void 0) attrs["is_hidden"] = String(p.isHidden);
  return { tag: "product", attrs, content };
}
var Business = class {
  constructor(request, mex) {
    this.request = request;
    this.mex = mex;
  }
  request;
  mex;
  async #edit(op, node) {
    const res = await this.request({
      tag: "iq",
      attrs: { to: "s.whatsapp.net", type: "set", xmlns: "w:biz:catalog" },
      content: [
        {
          tag: op,
          attrs: { v: "1" },
          content: [node, text3("width", "100"), text3("height", "100")]
        }
      ]
    });
    const product = kids8(kids8(res, op)[0], "product")[0];
    if (!product) throw new Error(`${op}: no product in the answer`);
    return parseProduct(product);
  }
  /** Add a product to the catalog. */
  createProduct = (p) => this.#edit("product_catalog_add", productNode(void 0, { ...p, isHidden: !!p.isHidden }));
  /** Change a product: only the fields you pass are sent. */
  updateProduct = (productId, p) => this.#edit("product_catalog_edit", productNode(productId, p));
  /** Delete products; returns how many the server deleted. */
  async deleteProducts(productIds) {
    const res = await this.request({
      tag: "iq",
      attrs: { to: "s.whatsapp.net", type: "set", xmlns: "w:biz:catalog" },
      content: [
        {
          tag: "product_catalog_delete",
          attrs: { v: "1" },
          content: productIds.map((id) => ({
            tag: "product",
            attrs: {},
            content: [text3("id", id)]
          }))
        }
      ]
    });
    return { deleted: +(kids8(res, "product_catalog_delete")[0]?.attrs["deleted_count"] ?? 0) };
  }
  /** Catalog and collection changes go through GraphQL; `input` is the server's input object. */
  createCatalog = (input2) => this.mex(IDS3.CREATE_CATALOG, { input: input2 }, "xfb_whatsapp_catalog_create");
  createCollection = (input2) => this.mex(IDS3.CREATE_COLLECTION, { input: input2 }, "xfb_whatsapp_catalog_create_collection");
  updateCollection = (input2) => this.mex(IDS3.UPDATE_COLLECTION, { input: input2 }, "xfb_whatsapp_catalog_update_collection");
  deleteCollections = (input2) => this.mex(IDS3.DELETE_COLLECTIONS, { input: input2 }, "xfb_whatsapp_catalog_delete_collections");
  /** Ask WhatsApp to look again at a product or collection it rejected. */
  appealProduct = (input2) => this.mex(IDS3.APPEAL_PRODUCT, { input: input2 }, "xfb_whatsapp_catalog_appeal_product");
  appealCollection = (input2) => this.mex(IDS3.APPEAL_COLLECTION, { input: input2 }, "xfb_whatsapp_catalog_appeal_collection");
  async #profileDelta(child4) {
    await this.request({
      tag: "iq",
      attrs: { to: "s.whatsapp.net", type: "set", xmlns: "w:biz" },
      content: [
        { tag: "business_profile", attrs: { v: "3", mutation_type: "delta" }, content: [child4] }
      ]
    });
  }
  /** Point the profile at an uploaded cover photo (the receipt of \`uploadCoverPhoto\`). */
  setCoverPhoto = (u) => this.#profileDelta({
    tag: "cover_photo",
    attrs: { op: "update", id: u.id, token: u.token, ts: String(u.timestamp) }
  });
  /** Remove the cover photo with this id (the one \`uploadCoverPhoto\` returned). */
  removeCoverPhoto = (id) => this.#profileDelta({ tag: "cover_photo", attrs: { op: "delete", id } });
  /** Delete a broadcast list. */
  async deleteBroadcastList(listId) {
    await this.request({
      tag: "iq",
      attrs: { to: "s.whatsapp.net", xmlns: "w:b", type: "set" },
      content: [{ tag: "delete", attrs: {}, content: [{ tag: "list", attrs: { id: listId } }] }]
    });
  }
  /** How many broadcast messages the business may still send in the current period (null if the server gives no limits). */
  async broadcastQuota() {
    const res = await this.request({
      tag: "iq",
      attrs: { xmlns: "w:biz", to: "s.whatsapp.net", type: "get" },
      content: [{ tag: "broadcast_list_quota", attrs: {}, content: [] }]
    });
    const find = (tag) => kids8(res, tag)[0] ?? kids8(kids8(res, "broadcast_list_quota")[0], tag)[0];
    const limits = find("limits");
    const frame = find("timeframe");
    if (!limits) return null;
    const num3 = (n, key) => {
      const child4 = kids8(n, key)[0]?.content;
      const raw = n?.attrs[key] ?? (typeof child4 === "string" ? child4 : child4 && Buffer.from(child4).toString());
      return parseInt(raw ?? "0", 10) || 0;
    };
    const flag = limits.attrs["is_heavy_sender"] ?? "";
    return {
      messagesLeft: num3(limits, "messages_left"),
      totalLimit: num3(limits, "total_limit"),
      isHeavySender: flag === "true",
      startTs: num3(frame, "start_ts_s"),
      endTs: num3(frame, "end_ts_s"),
      resetTs: num3(frame, "reset_ts_s")
    };
  }
};

// src/client/features/event/events.ts
var ENDPOINT = "https://graph.whatsapp.com/graphql";
var NONCE = { id: "24635485196143064", path: "xwa2_ent_get_canonical_ent_device_nonce" };
var EXCHANGE = { id: "25727187160203620", path: "xwa2_www_exchange_nonce_for_access_token" };
var DOC = {
  ADD_INVITATIONS: "26095825686706664",
  CREATE: "27259582783645464",
  DELETE: "24671535952543812",
  GET: "26814174831581200",
  LINK_PREVIEW: "26580394538296892",
  INVITE_LINK: "26392982740362904",
  LIST: "35283909937920624",
  PRESET_COVERS: "34976018872012652",
  REMOVE_INVITATIONS: "27723734560563308",
  REMOVE_SELF: "27063717026648636",
  ROTATE_LINK: "27134834146102810",
  UPDATE: "35415093074772810",
  RSVP: "25954023907630800"
};
var WwwError = class extends Error {
  constructor(message, status, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
    this.name = "WwwError";
  }
  status;
  detail;
};
var WwwClient = class {
  constructor(mex, doFetch = (url, init) => fetch(url, init)) {
    this.mex = mex;
    this.doFetch = doFetch;
  }
  mex;
  doFetch;
  #token;
  #acquire() {
    this.#token ??= (async () => {
      const n = await this.mex(NONCE.id, {}, NONCE.path);
      const nonce = typeof n === "string" ? n : n?.nonce;
      if (!nonce) throw new WwwError("no nonce from the server", 400, n);
      const t = await this.mex(
        EXCHANGE.id,
        { nonce },
        EXCHANGE.path
      );
      const token = typeof t === "string" ? t : t?.access_token;
      if (!token) throw new WwwError("no access token from the server", 400, t);
      return token;
    })().catch((e) => {
      this.#token = void 0;
      throw e;
    });
    return this.#token;
  }
  /** Forget the token (a new session or account must not reuse it). */
  invalidate() {
    this.#token = void 0;
  }
  async query(docId, variables, dataPath) {
    for (let attempt = 0; ; attempt++) {
      const token = await this.#acquire();
      const res = await this.doFetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: token, doc_id: docId, variables, lang: "en" })
      });
      if ((res.status === 401 || res.status === 403) && attempt === 0) {
        this.#token = void 0;
        continue;
      }
      if (!res.ok) throw new WwwError(`GraphQL HTTP error ${res.status}`, res.status);
      const json = await res.json();
      if (json.errors?.length)
        throw new WwwError(
          `GraphQL error: ${json.errors.map((e) => e.message ?? "unknown").join(", ")}`,
          json.errors[0].extensions?.error_code ?? 400,
          json.errors[0]
        );
      const out = json.data?.[dataPath];
      if (out === void 0) throw new WwwError(`no ${dataPath} in the answer`, 400, json);
      return out;
    }
  }
};
var Events = class {
  constructor(www) {
    this.www = www;
  }
  www;
  /** Create an event. `input` is the server's event input (name, start time, chat, ...). */
  create = (input2) => this.www.query(DOC.CREATE, { input: input2 }, "xwa2_create_event");
  get = (eventId) => this.www.query(DOC.GET, { event_id: eventId }, "xwa2_get_event");
  update = (eventId, updates) => this.www.query(DOC.UPDATE, { ...updates, event_id: eventId }, "xwa2_update_event");
  delete = (eventId) => this.www.query(DOC.DELETE, { event_id: eventId }, "xwa2_delete_event");
  list = (options = {}) => this.www.query(DOC.LIST, options, "xwa2_list_events");
  /** Answer an invitation: going, not going, maybe. */
  rsvp = (eventId, rsvp) => this.www.query(DOC.RSVP, { event_id: eventId, rsvp }, "xwa2_update_event_rsvp");
  invite = (eventId, jids) => this.www.query(DOC.ADD_INVITATIONS, { event_id: eventId, jids }, "xwa2_add_event_invitations");
  uninvite = (eventId, jids) => this.www.query(
    DOC.REMOVE_INVITATIONS,
    { event_id: eventId, jids },
    "xwa2_remove_event_invitations"
  );
  /** Take yourself off an event's guest list. */
  leave = (eventId) => this.www.query(DOC.REMOVE_SELF, { event_id: eventId }, "xwa2_remove_self_event_invitation");
  inviteLink = (eventId) => this.www.query(DOC.INVITE_LINK, { event_id: eventId }, "xwa2_get_or_create_event_invite_link");
  rotateInviteLink = (eventId) => this.www.query(DOC.ROTATE_LINK, { event_id: eventId }, "xwa2_rotate_event_invite_link");
  linkPreview = (url) => this.www.query(DOC.LINK_PREVIEW, { url }, "xwa2_get_event_link_preview");
  presetCovers = () => this.www.query(DOC.PRESET_COVERS, {}, "xwa2_list_preset_cover_images");
};

// src/client/features/contact/privacy.ts
var DEFAULT_FEATURES = [
  "LAST",
  "ONLINE",
  "PROFILE",
  "ABOUT",
  "READRECEIPTS",
  "GROUPADD",
  "STATUS",
  "CALLADD",
  "MESSAGES"
];
var IDS4 = {
  GET_SETTINGS: "25637004609323493",
  SET_SETTING: "26887749497493182",
  UPDATE_CONTACT_LIST: "26375158178762799",
  GET_CONTACT_LIST: "26806428515612550",
  UPDATE_TEXT_STATUS: "9152604461510864",
  GET_TEXT_STATUS_LIST: "24072923595647473",
  UPDATE_USER_STATUS: "7452341274886724",
  FETCH_USER_PICTURE: "24983561624604407",
  PROFILE_PICTURE: "24714239711610700",
  MIGRATE_BLOCKLIST_LID: "25028600226770432",
  ONLINE_STATUS: "24599444653063564",
  ONLINE_STATUS_LAST_SEEN: "24653084284365540",
  SUGGESTED_CONTACTS: "31663643799945793",
  REMINDER_CREATE: "32149118614673399",
  REMINDER_DELETE: "25462476600019778"
};
var kids9 = (n, tag) => n && Array.isArray(n.content) ? n.content.filter((c) => tag === void 0 || c.tag === tag) : [];
var iq = (xmlns, type, content) => ({
  tag: "iq",
  attrs: { to: "s.whatsapp.net", xmlns, type },
  ...content && { content }
});
var defaultDisappearingNode = (seconds2) => iq("disappearing_mode", "set", [
  { tag: "disappearing_mode", attrs: { duration: String(seconds2) } }
]);
var Privacy = class {
  constructor(request, mex) {
    this.request = request;
    this.mex = mex;
  }
  request;
  mex;
  // ---- settings by feature name (the GraphQL form: LAST_SEEN, ONLINE, PROFILE_PHOTO, STATUS, GROUPS, READ_RECEIPTS, ...) ----
  /** All privacy settings of an account (yours: `client.me.id`). `features` narrows the answer. */
  settings = (jid, features = DEFAULT_FEATURES) => this.mex(
    IDS4.GET_SETTINGS,
    { input: { query_input: [{ jid, privacy_features: features }] } },
    "xwa2_fetch_wa_users"
  );
  /** Change one setting: `set('LAST_SEEN', 'CONTACTS')`. */
  set = (feature, setting) => this.mex(IDS4.SET_SETTING, { feature, setting }, "xwa2_privacy_feature_update");
  /** The allow / block list behind a setting ("my contacts except..."): for `category` such as `LAST`, and `type` such as `CONTACT_BLACKLIST`. */
  contactList = (jid, category, type, dhash = "") => this.mex(
    IDS4.GET_CONTACT_LIST,
    {
      input: {
        query_input: [{ jid, privacy_contact_list_type: { dhash, category, type } }]
      }
    },
    "xwa2_fetch_wa_users"
  );
  setContactList = (feature, setting, jids) => this.mex(
    IDS4.UPDATE_CONTACT_LIST,
    { feature, setting, contacts: jids.map((jid) => ({ jid })) },
    "xwa2_privacy_contact_list_update"
  );
  /** Default disappearing-messages timer for new chats, in seconds (0 = off). */
  async setDefaultDisappearing(seconds2) {
    await this.request(defaultDisappearingNode(seconds2));
  }
  // ---- blocking and push settings (plain stanzas) ----
  async blockingStatus() {
    const res = await this.request(
      iq("w:comms:chat", "get", [
        { tag: "query", attrs: {}, content: [{ tag: "blocking_status", attrs: {} }] }
      ])
    );
    return (kids9(res, "blocking")[0] ?? kids9(kids9(res, "query")[0], "blocking")[0])?.attrs["status"];
  }
  async setBlocking(action) {
    const res = await this.request(
      iq("w:comms:chat", "set", [{ tag: "blocking", attrs: { action } }])
    );
    return kids9(res, "blocking")[0]?.attrs["status"];
  }
  /** The server's "opt out" list. Returned as the raw answer. */
  optOutList = () => this.request(iq("optoutlist", "get"));
  async pushConfig() {
    const res = await this.request(
      iq("urn:xmpp:whatsapp:push", "get", [{ tag: "settings", attrs: {} }])
    );
    return kids9(res, "settings")[0]?.attrs;
  }
  async setPushConfig(config) {
    await this.request(iq("urn:xmpp:whatsapp:push", "set", [{ tag: "config", attrs: config }]));
  }
  /** Notices the user has to be shown (terms, disclosures) since `since`. */
  async disclosures(since = 0) {
    const res = await this.request(
      iq("tos", "get", [{ tag: "get_user_disclosures", attrs: { t: String(since) } }])
    );
    return kids9(res, "notice").map((n) => ({ ...n.attrs }));
  }
  // ---- text status ("About" with an emoji) and profile ----
  setTextStatus = (text4, emoji) => this.mex(
    IDS4.UPDATE_TEXT_STATUS,
    { text_status_input: { text: text4, ...emoji && { emoji: { content: emoji } } } },
    "xwa2_text_status_update"
  );
  textStatusList = (jids, lastUpdateTime = null) => this.mex(
    IDS4.GET_TEXT_STATUS_LIST,
    { input: jids.map((jid) => ({ jid, last_update_time: lastUpdateTime })) },
    "xwa2_text_status_list"
  );
  setUserStatus = (status) => this.mex(IDS4.UPDATE_USER_STATUS, { status }, "xwa2_update_user_status");
  pictureInfo = (jid) => this.mex(IDS4.FETCH_USER_PICTURE, { jid }, "xwa2_fetch_user_picture_info");
  /** Set the profile picture through GraphQL (base64 image). The plain way is `client.updateProfilePicture`. */
  setPictureBase64 = (imageBase64, type = "image") => this.mex(
    IDS4.PROFILE_PICTURE,
    { input: { image: imageBase64, type } },
    "xwa2_profile_picture_mutation"
  );
  // ---- contacts ----
  /** Whether these accounts are online right now. */
  onlineStatus = (jids) => this.mex(IDS4.ONLINE_STATUS, { jids }, "xwa2_query_online_status");
  onlineStatusLastSeen = (jids) => this.mex(IDS4.ONLINE_STATUS_LAST_SEEN, { jids }, "xwa2_query_online_status_last_seen");
  suggestedContacts = (limit = 20) => this.mex(IDS4.SUGGESTED_CONTACTS, { limit }, "xwa2_suggested_contacts_v2");
  /** Move the block list to LIDs (the server's account-id format). */
  migrateBlocklistToLid = (jids, dhash = "", dirtyAck = true) => this.mex(
    IDS4.MIGRATE_BLOCKLIST_LID,
    { input: { blocklist: jids.map((jid) => ({ jid })), dhash, dirty_ack: dirtyAck } },
    "xwa2_migrate_blocklist_lid"
  );
  // ---- reminders ----
  createReminder = (title, body, scheduledTime) => this.mex(
    IDS4.REMINDER_CREATE,
    { input: { title, body, scheduled_time: scheduledTime } },
    "xwa2_reminder_set"
  );
  deleteReminder = (reminderId) => this.mex(IDS4.REMINDER_DELETE, { reminder_id: reminderId }, "xwa2_reminder_delete");
};

// src/client/features/message/messages.ts
var normalizedUser = (jid) => {
  const { user, server: server2 } = jidDecode(jid);
  return `${user}@${server2}`;
};
function contentOf(message) {
  for (const k of Object.keys(message)) {
    if (k === "messageContextInfo") continue;
    const inner = message[k];
    if (inner && typeof inner === "object") {
      const { contextInfo: _drop, ...rest } = inner;
      void _drop;
      return { [k]: rest };
    }
  }
  return {};
}
function withContext(message, chat, opts, meId) {
  if (!opts.quoted && !opts.mentions?.length && !opts.expiration && !opts.isQuestion) return message;
  const field = Object.keys(message).find((k) => k !== "messageContextInfo");
  if (!field) return message;
  const body = { ...message[field] };
  const ctx = {
    ...body["contextInfo"]
  };
  if (opts.quoted) {
    const { key } = opts.quoted;
    ctx["participant"] = normalizedUser(key.fromMe ? meId : key.participant ?? key.remoteJid);
    ctx["stanzaId"] = key.id;
    ctx["quotedMessage"] = contentOf(opts.quoted.message);
    if (key.remoteJid !== chat) ctx["remoteJid"] = key.remoteJid;
  }
  if (opts.mentions?.length) ctx["mentionedJid"] = opts.mentions;
  if (opts.expiration) ctx["expiration"] = opts.expiration;
  if (opts.isQuestion) ctx["isQuestion"] = true;
  body["contextInfo"] = ctx;
  return { ...message, [field]: body };
}
function textMessage(text4) {
  return { extendedTextMessage: { text: text4 } };
}
var wireKey = (key) => ({
  remoteJid: key.remoteJid,
  fromMe: key.fromMe ?? false,
  id: key.id,
  ...key.participant && { participant: key.participant }
});
function reaction(key, emoji) {
  return {
    message: { reactionMessage: { key: wireKey(key), text: emoji, senderTimestampMs: Date.now() } },
    opts: { encAttrs: { "decrypt-fail": "hide" } }
  };
}
function edit(key, newText) {
  return {
    message: {
      protocolMessage: {
        key: wireKey({ ...key, fromMe: true }),
        editedMessage: textMessage(newText),
        timestampMs: Date.now(),
        type: "MESSAGE_EDIT"
      }
    },
    opts: { stanzaAttrs: { edit: "1" } }
  };
}
function revoke(key) {
  const adminDelete = key.remoteJid.endsWith("@g.us") && !key.fromMe;
  return {
    message: { protocolMessage: { key: wireKey(key), type: "REVOKE" } },
    opts: { stanzaAttrs: { edit: adminDelete ? "8" : "7" } }
  };
}
function buildReceipts(keys, type, nowSeconds) {
  const groups = /* @__PURE__ */ new Map();
  for (const k of keys) {
    if (k.fromMe) continue;
    const gk = `${k.remoteJid}:${k.participant ?? ""}`;
    const g = groups.get(gk) ?? { jid: k.remoteJid, participant: k.participant, ids: [] };
    g.ids.push(k.id);
    groups.set(gk, g);
  }
  return [...groups.values()].map(({ jid, participant, ids }) => {
    const attrs = { id: ids[0], to: jid };
    if (participant) attrs["participant"] = participant;
    if (type === "read" || type === "read-self") attrs["t"] = String(nowSeconds);
    if (type) attrs["type"] = type;
    const node = { tag: "receipt", attrs };
    if (ids.length > 1) {
      node.content = [
        {
          tag: "list",
          attrs: {},
          content: ids.slice(1).map((id) => ({ tag: "item", attrs: { id } }))
        }
      ];
    }
    return node;
  });
}
function chatState(from, to, state) {
  return {
    tag: "chatstate",
    attrs: { from, to },
    content: [
      {
        tag: state === "recording" ? "composing" : state,
        attrs: state === "recording" ? { media: "audio" } : {}
      }
    ]
  };
}
function presence(name, type) {
  return { tag: "presence", attrs: { name: name.replace(/@/g, ""), type } };
}
function unifiedSession(serverSeconds) {
  const day = 24 * 60 * 60 * 1e3;
  const id = String((serverSeconds * 1e3 + 3 * day) % (7 * day));
  return { tag: "ib", attrs: {}, content: [{ tag: "unified_session", attrs: { id } }] };
}
function presenceSubscribe(jid, id) {
  return { tag: "presence", attrs: { to: jid, id, type: "subscribe" } };
}
function forward(message, score = 1) {
  const field = Object.keys(message).find((k) => k !== "messageContextInfo");
  if (!field) throw new Error("empty message");
  const body = { ...message[field] };
  const ctx = { ...body["contextInfo"] };
  delete ctx["quotedMessage"];
  delete ctx["stanzaId"];
  delete ctx["participant"];
  body["contextInfo"] = { ...ctx, isForwarded: true, forwardingScore: Math.max(1, score) };
  const { messageContextInfo: _drop, ...rest } = message;
  void _drop;
  return { ...rest, [field]: body };
}

// src/client/features/call/calls.ts
var import_node_crypto17 = require("crypto");
var CAPABILITY_OFFER = Uint8Array.from([1, 5, 247, 9, 224, 187, 19]);
var CAPABILITY_VIDEO_OFFER = Uint8Array.from([1, 5, 247, 9, 224, 187, 83]);
var CAPABILITY_PREACCEPT = Uint8Array.from([1, 5, 247, 9, 224, 187, 7]);
var noMlow = (b) => Uint8Array.from(b, (v, i) => i === 5 ? v & 127 : v);
var CAPABILITY_STANDARD_OPUS_OFFER = noMlow(CAPABILITY_OFFER);
var CAPABILITY_STANDARD_OPUS_VIDEO_OFFER = noMlow(CAPABILITY_VIDEO_OFFER);
var CAPABILITY_STANDARD_OPUS_PREACCEPT = noMlow(CAPABILITY_PREACCEPT);
var newCallId = () => "00" + (0, import_node_crypto17.randomBytes)(15).toString("hex");
var wrap = (to, id, action) => ({
  tag: "call",
  attrs: { to, ...id && { id } },
  content: [action]
});
var audio = (rate) => ({ tag: "audio", attrs: { enc: "opus", rate } });
var encopt = { tag: "encopt", attrs: { keygen: "2" } };
var capabilityNode = (blob) => ({
  tag: "capability",
  attrs: { ver: "1" },
  content: blob
});
var videoOffer = {
  tag: "video",
  attrs: {
    enc: "h.264",
    dec: "H264",
    screen_width: "0",
    screen_height: "0",
    device_orientation: "0"
  }
};
var enc = (k) => ({
  tag: "enc",
  attrs: { v: "2", type: k.type, count: "0" },
  content: k.ciphertext
});
function buildOffer(o) {
  const children3 = [];
  if (o.privacyToken) children3.push({ tag: "privacy", attrs: {}, content: o.privacyToken });
  for (const rate of o.audioRates ?? ["16000"]) children3.push(audio(rate));
  if (o.video) children3.push(videoOffer);
  children3.push({ tag: "net", attrs: { medium: "3" } });
  children3.push(
    capabilityNode(o.video ? CAPABILITY_STANDARD_OPUS_VIDEO_OFFER : CAPABILITY_STANDARD_OPUS_OFFER)
  );
  if (o.keys.length > 1 || o.multiDevice) {
    children3.push({
      tag: "destination",
      attrs: {},
      content: o.keys.map((k) => ({ tag: "to", attrs: { jid: k.jid }, content: [enc(k)] }))
    });
  } else if (o.keys[0]) {
    children3.push(enc(o.keys[0]));
  }
  children3.push(encopt);
  if (o.deviceIdentity)
    children3.push({ tag: "device-identity", attrs: {}, content: o.deviceIdentity });
  return wrap(o.to, o.id, {
    tag: "offer",
    attrs: { "call-id": o.callId, "call-creator": o.creator },
    content: children3
  });
}
var buildTerminate = (callId, to, creator, id, reason) => wrap(to, id, {
  tag: "terminate",
  attrs: { "call-id": callId, "call-creator": creator, ...reason && { reason } }
});
var buildTerminateTimed = (callId, creator, ms, id) => wrap(`${callId}@call`, id, {
  tag: "terminate",
  attrs: {
    "call-id": callId,
    "call-creator": creator,
    duration: String(ms),
    audio_duration: String(ms)
  }
});
var VIDEO_STATE = { enabled: 1, accept: 4, reject: 5, stopped: 6, request: 11 };
var buildVideoState = (callId, to, creator, id, state, o = {}) => wrap(to, id, {
  tag: "video",
  attrs: {
    "call-id": callId,
    "call-creator": creator,
    state: String(state),
    ...o.dec && { dec: o.dec },
    ...state === VIDEO_STATE.request && { voip_settings: "video" },
    ...o.orientation !== void 0 && { device_orientation: String(o.orientation) }
  }
});
var buildRaiseHand = (callId, creator, raised, id) => wrap(`${callId}@call`, id, {
  tag: "user_action",
  attrs: { "call-id": callId, "call-creator": creator, action: "raise_hand" },
  content: [{ tag: "raise_hand", attrs: { "raise-hand-state": raised ? "1" : "0" } }]
});
var buildScreenShare = (callId, creator, started, shareId, id) => wrap(`${callId}@call`, id, {
  tag: "screen_share",
  attrs: {
    "call-id": callId,
    "call-creator": creator,
    screenshare_state: started ? "1" : "2",
    version: "2",
    ...shareId !== void 0 && { screen_share_id: String(shareId) }
  }
});
var buildHeartbeat = (callId, creator, id) => wrap(`${callId}@call`, id, {
  tag: "heartbeat",
  attrs: { "call-id": callId, "call-creator": creator }
});
var buildMuteState = (callId, creator, muted, id) => wrap(`${callId}@call`, id, {
  tag: "mute_v2",
  attrs: { "call-id": callId, "call-creator": creator, "mute-state": muted ? "1" : "0" }
});
var buildRelayLatency = (callId, creator, transactionId, relayName, rttMs, address, id) => wrap(`${callId}@call`, id, {
  tag: "relaylatency",
  attrs: { "call-id": callId, "call-creator": creator, "transaction-id": transactionId },
  content: [
    {
      tag: "te",
      // bit 25 marks a measured value, the low bits are the round trip in milliseconds
      attrs: {
        latency: String(33554432 + Math.max(0, Math.round(rttMs))),
        relay_name: relayName
      },
      content: address
    }
  ]
});
var buildTransportHint = (callId, to, creator, id) => wrap(to, id, {
  tag: "transport",
  attrs: { "call-id": callId, "call-creator": creator, "transport-message-type": "4" },
  content: [{ tag: "net", attrs: { medium: "2", protocol: "0" } }]
});
var buildGroupDuration = (callId, creator, ms, id) => wrap("call", id, {
  tag: "group_call_duration",
  attrs: {
    "call-id": callId,
    "call-creator": creator,
    type: "group",
    audio_duration: String(ms)
  }
});
var VOIP_SETTINGS_OPUS_16K = new TextEncoder().encode(
  '{"encode":{"use_mlow_codec_v1":"false"},"options":{"enable_48khz_rtp_clock":"false"}}'
);
function buildAccept(callId, to, creator, id, video = false, bare3 = false) {
  if (bare3)
    return wrap(to, id, {
      tag: "accept",
      attrs: { "call-id": callId, "call-creator": creator },
      content: [
        audio("16000"),
        ...video ? [{ tag: "video", attrs: { dec: "H264", device_orientation: "0" } }] : [],
        { tag: "net", attrs: { medium: "2" } },
        encopt
      ]
    });
  return wrap(to, id, {
    tag: "accept",
    attrs: { "call-id": callId, "call-creator": creator },
    content: [
      audio("16000"),
      ...video ? [{ tag: "video", attrs: { dec: "H264", device_orientation: "0" } }] : [],
      { tag: "net", attrs: { medium: "2" } },
      encopt,
      ...video ? [] : [capabilityNode(CAPABILITY_STANDARD_OPUS_OFFER)],
      { tag: "voip_settings", attrs: { uncompressed: "1" }, content: VOIP_SETTINGS_OPUS_16K }
    ]
  });
}
var buildPreaccept = (callId, to, creator, id, video = false) => wrap(to, id, {
  tag: "preaccept",
  attrs: { "call-id": callId, "call-creator": creator },
  content: [
    audio("16000"),
    ...video ? [
      {
        tag: "video",
        attrs: {
          dec: "H264",
          device_orientation: "0",
          screen_width: "0",
          screen_height: "0"
        }
      }
    ] : [],
    { tag: "encopt", attrs: { keygen: "2" } },
    capabilityNode(video ? CAPABILITY_STANDARD_OPUS_OFFER : CAPABILITY_STANDARD_OPUS_PREACCEPT)
  ]
});
var pickMediaOptions = (o) => ({
  ...o.audioIn && { audioIn: o.audioIn },
  ...o.recordTo && { recordTo: o.recordTo },
  ...o.videoFrames && { videoFrames: o.videoFrames },
  ...o.recordVideoTo && { recordVideoTo: o.recordVideoTo },
  ...o.localAudio && { localAudio: o.localAudio },
  ...o.videoFps && { videoFps: o.videoFps }
});
var callLinkUrl = (token, media) => `https://call.whatsapp.com/${media === "video" ? "video" : "voice"}/${token}`;
var service = (id, action) => ({
  tag: "call",
  attrs: { to: "@call", id },
  content: [action]
});
var buildLinkCreate = (media, id) => service(id, { tag: "link_create", attrs: { media } });
var TOKEN = /^[A-Za-z0-9_-]{4,64}$/;
function parseCallLinkToken(link) {
  let token = link.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(token)) {
    let u;
    try {
      u = new URL(token);
    } catch {
      throw new Error("not a call link");
    }
    const segs = u.pathname.split("/").filter(Boolean);
    if (u.protocol !== "https:" || u.hostname !== "call.whatsapp.com" || segs.length !== 2 || !["voice", "video"].includes(segs[0]))
      throw new Error("not a WhatsApp call link");
    token = segs[1];
  }
  if (!TOKEN.test(token)) throw new Error("invalid call-link token");
  return token;
}
var buildLinkQuery = (token, media, id) => {
  if (!TOKEN.test(token)) throw new Error("invalid call-link token");
  return service(id, { tag: "link_query", attrs: { token, media } });
};
var roomRequest = (callId, creator, id, tag, attrs = {}, content) => wrap(`${callId}@call`, id, {
  tag,
  attrs: { "call-id": callId, "call-creator": creator, ...attrs },
  ...content && { content }
});
var buildWaitingRoomToggle = (callId, creator, enabled, id) => roomRequest(callId, creator, id, "waiting_room_toggle", { enabled: enabled ? "1" : "0" });
var buildWaitingRoomHeartbeat = (callId, creator, id) => roomRequest(callId, creator, id, "heartbeat", { type: "waiting_room" });
var buildWaitingRoomAdmit = (callId, creator, user, id, deny = false) => roomRequest(callId, creator, id, deny ? "waiting_room_deny" : "waiting_room_admit", {}, [
  { tag: "user", attrs: { jid: user } }
]);
var buildLinkJoin = (token, media, id, pushName2) => {
  if (!TOKEN.test(token)) throw new Error("invalid call-link token");
  return service(id, {
    tag: "link_join",
    attrs: { token, media, ...pushName2 && { push_name: pushName2 } },
    content: [
      audio("16000"),
      ...media === "video" ? [{ tag: "video", attrs: { dec: "H264", device_orientation: "0" } }] : [],
      { tag: "net", attrs: { medium: "2" } },
      capabilityNode(
        media === "video" ? CAPABILITY_STANDARD_OPUS_VIDEO_OFFER : CAPABILITY_STANDARD_OPUS_OFFER
      )
    ]
  });
};
function parseLinkJoinAck(ack, token) {
  const group = child3(ack, "group_info");
  const room = child3(ack, "waiting_room");
  const src = group ?? room;
  const callId = src?.attrs["call-id"];
  const creator = src?.attrs["call-creator"];
  if (!src || !callId || !creator) throw new Error("link_join ack names no call");
  if (room?.attrs["link-token"] && room.attrs["link-token"] !== token)
    throw new Error("the waiting room belongs to another link");
  const media = (group?.attrs["media"] ?? room?.attrs["media"]) === "video" ? "video" : "audio";
  return {
    callId,
    creator,
    media,
    inWaitingRoom: !!room && !group,
    admitted: !!group,
    isAdmin: room?.attrs["is_admin"] === "1"
  };
}
var child3 = (n, tag) => Array.isArray(n.content) ? n.content.find((c) => c.tag === tag) : void 0;
function parseLinkCreateAck(ack) {
  const c = child3(ack, "link_create");
  const token = c?.attrs["token"];
  if (!token) throw new Error("link_create ack carries no token");
  const media = c.attrs["media"] === "video" ? "video" : "audio";
  return { token, media, url: callLinkUrl(token, media) };
}
function parseLinkQueryAck(ack) {
  const c = child3(ack, "link_query");
  const token = c?.attrs["token"];
  if (!c || !token) throw new Error("link_query ack carries no link");
  const media = c.attrs["media"] === "video" ? "video" : "audio";
  const waiting = child3(c, "waiting_room");
  return {
    token,
    media,
    url: callLinkUrl(token, media),
    creator: c.attrs["link_creator"] ?? "",
    waitingRoomEnabled: waiting?.attrs["enabled"] === "1",
    isAdmin: waiting?.attrs["is_admin"] === "1"
  };
}

// src/client/features/message/buttons.ts
var quality = { tag: "quality_control", attrs: { source_type: "third_party" } };
var bizAttrs = (now) => ({
  actual_actors: "2",
  host_storage: "2",
  privacy_mode_ts: String(now)
});
function buttonsMessage(o, now = Math.floor(Date.now() / 1e3)) {
  if (!o.buttons.length) throw new Error("at least one button");
  if (o.buttons.length > 3)
    throw new Error("at most 3 buttons (use a list or native buttons for more)");
  return {
    message: {
      viewOnceMessage: {
        message: {
          messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
          buttonsMessage: {
            contentText: o.text,
            ...o.footer && { footerText: o.footer },
            ...o.title ? { text: o.title, headerType: "TEXT" } : { headerType: "EMPTY" },
            buttons: o.buttons.map((b) => ({
              buttonId: b.id,
              buttonText: { displayText: b.text },
              type: "RESPONSE"
            }))
          }
        }
      }
    },
    opts: {
      extraNodes: [
        {
          tag: "biz",
          attrs: bizAttrs(now),
          content: [
            {
              tag: "interactive",
              attrs: { type: "native_flow", v: "1" },
              content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }]
            },
            quality
          ]
        }
      ]
    }
  };
}
function listMessage(o, now = Math.floor(Date.now() / 1e3)) {
  if (!o.sections.length || o.sections.some((s) => !s.rows.length))
    throw new Error("every section needs rows");
  if (o.sections.reduce((n, s) => n + s.rows.length, 0) > 10)
    throw new Error("at most 10 rows in total");
  return {
    message: {
      viewOnceMessage: {
        message: {
          messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
          listMessage: {
            title: o.title,
            description: o.text,
            buttonText: o.buttonText,
            listType: "SINGLE_SELECT",
            ...o.footer && { footerText: o.footer },
            sections: o.sections.map((s) => ({
              title: s.title,
              rows: s.rows.map((r) => ({
                title: r.title,
                rowId: r.id,
                ...r.description && { description: r.description }
              }))
            }))
          }
        }
      }
    },
    opts: {
      extraNodes: [
        {
          tag: "biz",
          attrs: bizAttrs(now),
          content: [{ tag: "list", attrs: { v: "2", type: "product_list" } }, quality]
        }
      ]
    }
  };
}
function templateMessage(o, now = Math.floor(Date.now() / 1e3)) {
  if (!o.buttons.length || o.buttons.length > 4) throw new Error("1 to 4 template buttons");
  const hydrated = {
    hydratedContentText: o.text,
    ...o.footer && { hydratedFooterText: o.footer },
    ...o.title && { hydratedTitleText: o.title },
    templateId: o.templateId ?? String(now),
    hydratedButtons: o.buttons.map((b, index) => ({
      index,
      ...b.type === "reply" && { quickReplyButton: { displayText: b.text, id: b.id } },
      ...b.type === "url" && { urlButton: { displayText: b.text, url: b.url } },
      ...b.type === "call" && { callButton: { displayText: b.text, phoneNumber: b.phone } }
    }))
  };
  return {
    message: {
      viewOnceMessage: {
        message: {
          messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
          templateMessage: { fourRowTemplate: hydrated, hydratedTemplate: hydrated }
        }
      }
    },
    opts: { extraNodes: [{ tag: "biz", attrs: bizAttrs(now) }] }
  };
}
var buttonsResponse = (id, displayText) => ({
  buttonsResponseMessage: {
    selectedButtonId: id,
    selectedDisplayText: displayText,
    type: "DISPLAY_TEXT"
  }
});
var listResponse = (rowId, title, description) => ({
  listResponseMessage: {
    title,
    listType: "SINGLE_SELECT",
    singleSelectReply: { selectedRowId: rowId },
    ...description && { description }
  }
});
var templateButtonReply = (id, displayText, index = 0) => ({
  templateButtonReplyMessage: {
    selectedId: id,
    selectedDisplayText: displayText,
    selectedIndex: index
  }
});
var interactiveResponse = (name, params, bodyText = "") => ({
  interactiveResponseMessage: {
    body: { text: bodyText, format: "DEFAULT" },
    nativeFlowResponseMessage: { name, paramsJson: JSON.stringify(params), version: 3 }
  }
});
function parseButtonReply(message) {
  const m = message;
  const b = m["buttonsResponseMessage"];
  if (b)
    return {
      kind: "button",
      id: String(b["selectedButtonId"] ?? ""),
      text: String(b["selectedDisplayText"] ?? "")
    };
  const l = m["listResponseMessage"];
  if (l)
    return {
      kind: "list",
      id: String(
        l["singleSelectReply"]?.selectedRowId ?? ""
      ),
      text: String(l["title"] ?? "")
    };
  const t = m["templateButtonReplyMessage"];
  if (t)
    return {
      kind: "template",
      id: String(t["selectedId"] ?? ""),
      text: String(t["selectedDisplayText"] ?? "")
    };
  const i = m["interactiveResponseMessage"];
  const nf = i?.["nativeFlowResponseMessage"];
  if (nf) {
    let params = {};
    try {
      params = JSON.parse(nf.paramsJson || "{}");
    } catch {
    }
    const p = params;
    return {
      kind: "native-flow",
      id: String(p.id ?? p.selected_id ?? ""),
      text: String(p.display_text ?? i?.["body"]?.text ?? ""),
      flow: { name: nf.name ?? "", params }
    };
  }
  return void 0;
}

// src/client/features/message/rich-response.ts
var import_node_crypto18 = require("crypto");
var KEYWORDS = new Set(
  "break case catch continue debugger default delete do else finally for function if in instanceof new return switch this throw try typeof var void while with true false null undefined NaN Infinity class const let super extends export import yield static constructor of async await get set implements interface package private protected public enum throws transient".split(
    " "
  )
);
function tokenizeCode(code) {
  const tokens = [];
  let i = 0;
  const n = code.length;
  while (i < n) {
    const c = code[i];
    const start = i;
    if (/\s/.test(c)) {
      while (i < n && /\s/.test(code[i])) i++;
      tokens.push({ content: code.slice(start, i), type: "DEFAULT" });
    } else if (c === '"' || c === "'" || c === "`") {
      i++;
      while (i < n && code[i] !== c) {
        if (code[i] === "\\") i++;
        i++;
      }
      i++;
      tokens.push({ content: code.slice(start, i), type: "STR" });
    } else if (c === "/" && code[i + 1] === "/") {
      while (i < n && code[i] !== "\n") i++;
      tokens.push({ content: code.slice(start, i), type: "COMMENT" });
    } else if (c === "/" && code[i + 1] === "*") {
      i += 2;
      while (i + 1 < n && !(code[i] === "*" && code[i + 1] === "/")) i++;
      i += 2;
      tokens.push({ content: code.slice(start, Math.min(i, n)), type: "COMMENT" });
    } else if (/[0-9]/.test(c)) {
      while (i < n && /[0-9.]/.test(code[i])) i++;
      tokens.push({ content: code.slice(start, i), type: "NUMBER" });
    } else if (/[a-zA-Z_$]/.test(c)) {
      while (i < n && /[a-zA-Z0-9_$]/.test(code[i])) i++;
      const word = code.slice(start, i);
      let j = i;
      while (j < n && /\s/.test(code[j])) j++;
      tokens.push({
        content: word,
        type: KEYWORDS.has(word) ? "KEYWORD" : code[j] === "(" ? "METHOD" : "DEFAULT"
      });
    } else {
      tokens.push({ content: c, type: "DEFAULT" });
      i++;
    }
  }
  const merged = [];
  for (const t of tokens) {
    const last = merged[merged.length - 1];
    if (last && last.type === "DEFAULT" && t.type === "DEFAULT") last.content += t.content;
    else merged.push({ ...t });
  }
  return merged;
}
var widget = (title, labels, toast) => ({
  __typename: "GenAI3PExtWidgetPrimitive",
  header: { __typename: "GenAI3PExtWidgetStandardHeader", title },
  body: {
    __typename: "GenAI3PExtCalendarEventList",
    ctas: labels.map((label) => ({
      label,
      state: "PENDING",
      kind: "OTHER",
      tool_call_id: (0, import_node_crypto18.randomBytes)(8).toString("hex"),
      toast: { label: toast, __typename: "GenAI3PExtWidgetToast" },
      __typename: "GenAI3PExtWidgetCTA"
    })),
    sections: []
  }
});
var section = (primitive, typename) => ({
  __typename: "GenAIUnifiedResponseSection",
  view_model: {
    primitive: { ...primitive, __typename: typename },
    __typename: "GenAISingleLayoutViewModel"
  }
});
function richResponse(o) {
  const sections = [];
  if (o.text) sections.push(section({ text: o.text }, "GenAIMarkdownTextUXPrimitive"));
  if (o.code)
    sections.push(
      section(
        { language: o.language ?? "javascript", code_blocks: tokenizeCode(o.code) },
        "GenAICodeUXPrimitive"
      )
    );
  if (o.table?.rows)
    sections.push(
      section(
        { rows: o.table.rows.map((row) => ({ cells: row.map((c) => ({ text: String(c) })) })) },
        "GenAITableUXPrimitive"
      )
    );
  if (o.latex !== void 0) {
    const list = Array.isArray(o.latex) ? o.latex : [o.latex];
    sections.push(
      section({ expressions: list.map((expression) => ({ expression })) }, "GenAILatexUXPrimitive")
    );
  }
  if (o.map)
    sections.push(
      section(
        {
          latitude: o.map.latitude,
          longitude: o.map.longitude,
          zoom: o.map.zoom,
          title: o.map.title,
          annotations: o.map.annotations ?? []
        },
        "GenAIMapUXPrimitive"
      )
    );
  if (o.html !== void 0 && !o.allowRawHtml)
    throw new Error(
      "html is rendered as raw markup; pass allowRawHtml: true to confirm it is trusted"
    );
  if (o.html !== void 0 && Buffer.byteLength(o.html) > 64 * 1024)
    throw new Error("html is limited to 64 KiB");
  if (o.html !== void 0)
    sections.push(
      section({ trusted_sources: [], payload: o.html.trim() }, "FOAHtmlPrimitiveDemoDONOTUSE")
    );
  if (o.imageUrl) sections.push(section({ url: o.imageUrl }, "GenAIInlineImageUXPrimitive"));
  if (o.buttons)
    sections.push({
      __typename: "GenAIUnifiedResponseSection",
      view_model: {
        primitive: widget(o.buttons.title ?? "", o.buttons.labels, o.buttons.toast ?? ""),
        __typename: "GenAISingleLayoutViewModel"
      }
    });
  if (o.cards?.items.length)
    sections.push({
      __typename: "GenAIUnifiedResponseSection",
      view_model: {
        primitives: o.cards.items.map((c) => widget(c.title, c.buttons, c.toast ?? "")),
        __typename: o.cards.layout === "row" ? "GenAIActionRowLayoutViewModel" : "GenAIHScrollLayoutViewModel"
      }
    });
  if (o.footer)
    sections.push({
      __typename: "GenAIUnifiedResponseSection",
      view_model: {
        primitives: [
          {
            cta_text: o.footer.text,
            cta_type: "OPEN_URL",
            cta_url: o.footer.url,
            __typename: "GenAIFooterActionPrimitive"
          }
        ],
        __typename: "GenAIActionRowLayoutViewModel"
      }
    });
  if (o.imageUrls?.length)
    sections.push(
      section({ urls: o.imageUrls.map((url) => ({ url })) }, "GenAIGridImageUXPrimitive")
    );
  if (!sections.length) sections.push(section({ text: "" }, "GenAIMarkdownTextUXPrimitive"));
  const data = {
    __typename: "GenAIUnifiedResponse",
    response_id: o.responseId ?? (0, import_node_crypto18.randomUUID)(),
    sections
  };
  return {
    message: {
      messageContextInfo: {
        deviceListMetadata: {},
        deviceListMetadataVersion: 2,
        messageSecret: (0, import_node_crypto18.randomBytes)(32)
      },
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            submessages: [],
            messageType: 1,
            unifiedResponse: { data: Buffer.from(JSON.stringify(data)) },
            contextInfo: {
              forwardingScore: 1,
              isForwarded: true,
              forwardOrigin: 4,
              forwardedAiBotMessageInfo: { botJid: o.botJid ?? "867051314767696@bot" }
            }
          }
        }
      }
    },
    opts: {}
  };
}

// src/client/features/report/report.ts
var import_node_crypto19 = require("crypto");
var REPORT_FLOWS = {
  /** Report from the open chat. */
  chat: "chat",
  /** "Report" in a message's menu. */
  message: "message_menu",
  /** Report contact from the chat's overflow menu. */
  overflowMenu: "overflow_menu_report",
  /** Report from the contact info screen. */
  accountInfo: "account_info_report",
  /** "Report spam" banner on an unknown chat. */
  spamBanner: "1_1_spam_banner_report",
  /** Safety card in a chat from an unknown number. */
  safetyCard: "chat_fmx_card_safety_tools_report",
  /** Report group from the group info screen. */
  groupInfo: "group_info_report",
  /** Report group from the spam banner. */
  groupBanner: "group_spam_banner_report",
  /** Report group while leaving. */
  groupLeave: "group_info_leave_report_upsell",
  /** Report channel from its info screen. */
  channel: "newsletter_info_report",
  /** Report a status post. */
  statusPost: "status_post_report",
  /** Report from the media viewer. */
  mediaViewer: "media_viewer"
};
var REJECTED_FLOWS = /* @__PURE__ */ new Set([
  "account_info",
  "account_info_report_as_guest_user",
  "block_dialog",
  "call_log",
  "call_spam_dialog_block",
  "channel_status_report",
  "chat_fmx_card_report_as_guest_user",
  "chat_list_context_menu_block",
  "chat_list_swipe_delete_block_upsell",
  "chat_list_swipe_delete_report_upsell",
  "ent_client",
  "frx",
  "group_chatlist_swipe_leave_report_upsell",
  "group_info",
  "guest_call_participant_report",
  "guest_call_report",
  "overflow_menu",
  "overflow_menu_community_report",
  "payment_transaction_report"
]);
var DEFAULT_FLOW = {
  user: REPORT_FLOWS.chat,
  group: REPORT_FLOWS.groupInfo,
  newsletter: REPORT_FLOWS.channel,
  status: REPORT_FLOWS.statusPost
};
var MEDIA_TYPES = [
  ["imageMessage", "image"],
  ["videoMessage", "video"],
  ["audioMessage", "audio"],
  ["documentMessage", "document"],
  ["stickerMessage", "sticker"],
  ["locationMessage", "location"],
  ["liveLocationMessage", "livelocation"],
  ["contactMessage", "vcard"],
  ["contactsArrayMessage", "contact_array"],
  ["pollCreationMessage", "url"]
];
var normalize = (jid) => jid.replace(/:\d+@/, "@");
function reportedMessageNode(m, kind) {
  const plain = encodeProto("Message", m.message);
  const secret = m.message["messageContextInfo"]?.messageSecret;
  const content = reportableContent(plain);
  const evidence = [];
  if (!m.fromMe && m.reporting?.tag && m.reporting.token && secret && content) {
    const key = Buffer.from(
      (0, import_node_crypto19.hkdfSync)(
        "sha256",
        secret,
        Buffer.alloc(0),
        Buffer.concat([
          Buffer.from(m.id),
          Buffer.from(m.participant ?? m.chat),
          // receiver: the group in a group, our own JID in a chat (set when the message is stored)
          Buffer.from(m.chat.endsWith("@g.us") ? m.chat : m.meId ?? m.chat),
          Buffer.from("Report Token")
        ]),
        32
      )
    );
    evidence.push(
      {
        tag: "reporting",
        attrs: {},
        content: [{ tag: "reporting_tag", attrs: {}, content: m.reporting.tag }]
      },
      {
        tag: "content_validation",
        attrs: { type: "e2e_proto_message" },
        content: [
          {
            tag: "reporting_token",
            attrs: { v: String(m.reporting.version ?? 2) },
            content: m.reporting.token
          },
          { tag: "reporting_token_key", attrs: {}, content: key }
        ]
      }
    );
  }
  const mediatype = MEDIA_TYPES.find(([k]) => m.message[k])?.[1];
  const who = m.fromMe ? { to: m.chat } : { from: kind === "group" ? m.chat : m.participant ?? m.chat };
  return {
    tag: "message",
    attrs: {
      ...who,
      t: String(m.t),
      id: m.id,
      ...kind === "group" && !m.fromMe && m.participant ? { participant: m.participant } : {}
    },
    content: [
      {
        tag: "raw",
        attrs: { v: "2", ...mediatype && { mediatype } },
        content: plain
      },
      ...evidence
    ]
  };
}
function buildReport(kind, jid, id, o = {}) {
  const flow = o.flow ?? DEFAULT_FLOW[kind];
  if (REJECTED_FLOWS.has(flow))
    throw new Error(`report flow "${flow}" is refused by the app itself`);
  if (o.wiTraceId !== void 0 && o.wiTraceId.length !== 24)
    throw new Error("wiTraceId must be exactly 24 characters");
  const messages = (o.messages ?? []).slice(-210);
  if ((kind === "group" || kind === "newsletter") && o.subject === void 0)
    throw new Error(
      `a ${kind} report needs the ${kind === "group" ? "group" : "channel"} name as subject`
    );
  return {
    tag: "iq",
    attrs: { id, to: "s.whatsapp.net", type: "set", xmlns: "spam" },
    content: [
      {
        tag: "spam_list",
        attrs: {
          jid: normalize(jid),
          spam_flow: flow,
          ...o.wiTraceId && { wi_trace_id: o.wiTraceId },
          ...o.isKnownChat !== void 0 && { is_known_chat: String(o.isKnownChat) },
          ...o.subject !== void 0 && { subject: o.subject },
          ...o.source && { source: normalize(o.source) }
        },
        content: messages.map((m) => reportedMessageNode(m, kind))
      }
    ]
  };
}
function reportId(res) {
  const r = Array.isArray(res.content) ? res.content.find((c) => c.tag === "report") : void 0;
  return r?.attrs["id"];
}
function reportToAdmins(group, id, messageId) {
  return {
    tag: "iq",
    attrs: { id, to: group, type: "set", xmlns: "w:g2" },
    content: [
      {
        tag: "reports",
        attrs: {},
        content: [{ tag: "report", attrs: { message_id: messageId } }]
      }
    ]
  };
}
function setMemberReports(group, id, allow) {
  return {
    tag: "iq",
    attrs: { id, to: group, type: "set", xmlns: "w:g2" },
    content: [{ tag: allow ? "allow_admin_reports" : "not_allow_admin_reports", attrs: {} }]
  };
}
var ReportStore = class {
  constructor(perChat = 50) {
    this.perChat = perChat;
  }
  perChat;
  #byChat = /* @__PURE__ */ new Map();
  add(m) {
    const list = this.#byChat.get(m.chat) ?? [];
    if (list.some((x) => x.id === m.id)) return;
    list.push(m);
    if (list.length > this.perChat) list.shift();
    this.#byChat.set(m.chat, list);
    if (this.#byChat.size > 500) this.#byChat.delete(this.#byChat.keys().next().value);
  }
  /** The latest messages of a chat; `fromOthers` skips our own. */
  recent(chat, n = 5, fromOthers = false) {
    const list = (this.#byChat.get(chat) ?? []).filter((m) => !fromOthers || !m.fromMe);
    return list.slice(-n);
  }
};

// src/client/features/payment/payments.ts
var noteOf = (text4) => ({
  extendedTextMessage: { text: text4 ?? "" }
});
var wireKey2 = (key) => ({
  remoteJid: key.remoteJid,
  fromMe: key.fromMe ?? false,
  id: key.id,
  ...key.participant && { participant: key.participant }
});
function requestPayment(chat, p) {
  if (!Number.isInteger(p.amount1000) || p.amount1000 <= 0)
    throw new Error("amount1000 must be a positive whole number");
  if (!/^[A-Za-z]{3}$/.test(p.currency)) throw new Error("currency must be an ISO 4217 code");
  return {
    requestPaymentMessage: {
      amount1000: p.amount1000,
      currencyCodeIso4217: p.currency.toUpperCase(),
      requestFrom: p.from ?? chat,
      noteMessage: noteOf(p.note),
      ...p.expiry !== void 0 && { expiryTimestamp: p.expiry }
    }
  };
}
function sendPayment(request, o = {}) {
  return {
    sendPaymentMessage: {
      requestMessageKey: wireKey2(request),
      noteMessage: noteOf(o.note),
      ...o.transactionData && { transactionData: o.transactionData }
    }
  };
}
var declinePaymentRequest = (request) => ({
  declinePaymentRequestMessage: { key: wireKey2(request) }
});
var cancelPaymentRequest = (request) => ({
  cancelPaymentRequestMessage: { key: wireKey2(request) }
});
var PAYMENTS_QUERY = {
  PASSKEY_HAS_CREDENTIAL: "36878915648418618",
  PASSKEY_ENROLL_CHALLENGE: "25233109079721001",
  PASSKEY_ENROLL_VERIFY: "26563835863283058",
  PASSKEY_REGISTER_FINISH: "26658791263822236",
  PASSKEY_AUTH_CHALLENGE: "26425370627105628",
  PASSKEY_TOGGLE_ON: "25841989828834577",
  PASSKEY_TOGGLE_OFF: "26267673096201391",
  PASSKEY_TOGGLE_CHALLENGE: "26133062322993192",
  PASSKEY_TOGGLE_CLEANUP: "26492078607084840",
  PASSKEY_CLEANUP: "26538338805859092",
  IS_RECOVERABLE: "27351347491148282",
  UPI_SEND_OTP: "25829794080022469",
  UPI_VERIFY_OTP: "34104109149204669"
};
var Payments = class {
  constructor(mex) {
    this.mex = mex;
  }
  mex;
  hasPasskey = () => this.mex(PAYMENTS_QUERY.PASSKEY_HAS_CREDENTIAL, {}, "xwa2_payments_passkey_has_credential");
  enrollChallenge = () => this.mex(PAYMENTS_QUERY.PASSKEY_ENROLL_CHALLENGE, {}, "xwa2_payments_passkey_enroll_challenge");
  enrollVerify = (credentialId, attestationObject, clientDataJson) => this.mex(
    PAYMENTS_QUERY.PASSKEY_ENROLL_VERIFY,
    {
      credential_id: credentialId,
      attestation_object: attestationObject,
      client_data_json: clientDataJson
    },
    "xwa2_payments_passkey_enroll_verify"
  );
  registerFinish = (credentialId, attestationObject, clientDataJson) => this.mex(
    PAYMENTS_QUERY.PASSKEY_REGISTER_FINISH,
    {
      credential_id: credentialId,
      attestation_object: attestationObject,
      client_data_json: clientDataJson
    },
    "xwa2_payments_passkey_register_finish"
  );
  authChallenge = (credentialId) => this.mex(
    PAYMENTS_QUERY.PASSKEY_AUTH_CHALLENGE,
    { credential_id: credentialId },
    "xwa2_payments_passkey_auth_challenge"
  );
  toggleOn = () => this.mex(PAYMENTS_QUERY.PASSKEY_TOGGLE_ON, {}, "xwa2_payments_passkey_toggle_on");
  toggleOff = () => this.mex(PAYMENTS_QUERY.PASSKEY_TOGGLE_OFF, {}, "xwa2_payments_passkey_toggle_off");
  toggleChallenge = (credentialId) => this.mex(
    PAYMENTS_QUERY.PASSKEY_TOGGLE_CHALLENGE,
    { credential_id: credentialId },
    "xwa2_payments_passkey_toggle_challenge"
  );
  toggleCleanup = () => this.mex(PAYMENTS_QUERY.PASSKEY_TOGGLE_CLEANUP, {}, "xwa2_payments_passkey_toggle_cleanup");
  cleanup = () => this.mex(PAYMENTS_QUERY.PASSKEY_CLEANUP, {}, "xwa2_payments_passkey_cleanup");
  isRecoverable = () => this.mex(PAYMENTS_QUERY.IS_RECOVERABLE, {}, "xwa2_payments_is_account_recoverable");
  upiSendOtp = (phoneNumber) => this.mex(PAYMENTS_QUERY.UPI_SEND_OTP, { phone_number: phoneNumber }, "xwa2_upi_send_otp");
  upiVerifyOtp = (phoneNumber, otp) => this.mex(
    PAYMENTS_QUERY.UPI_VERIFY_OTP,
    { phone_number: phoneNumber, otp },
    "xwa2_upi_verify_otp"
  );
};

// src/wam/schema.ts
var WAM_EVENTS = {
  WamDroppedEvent: {
    id: 4358,
    weight: 1,
    props: { droppedEventCode: 1, droppedEventCount: 2, isFromWamsys: 3 }
  },
  MetaVerifiedInteraction: {
    id: 4870,
    weight: 1,
    props: {
      businessOwnerJid: 1,
      businessOwnerPlatform: 2,
      metaVerifiedInteractionAction: 3,
      metaVerifiedInteractionAssetType: 4,
      metaVerifiedInteractionReferral: 5,
      metaVerifiedInteractionSurface: 6
    }
  },
  WebHdMediaAwarenessInteraction: { id: 5426, weight: 1, props: { hdMediaSelected: 1 } },
  GraphqlCatalogRequest: {
    id: 3206,
    weight: 1,
    props: {
      businessJid: 4,
      businessType: 5,
      graphqlCatalogEndpoint: 1,
      graphqlErrorCode: 3,
      graphqlRequestResult: 2
    }
  },
  UiRevokeAction: {
    id: 3298,
    weight: 1,
    props: { messageAction: 1, uiRevokeActionDuration: 2, uiRevokeActionSessionId: 3 }
  },
  LwiEntryPointImpression: {
    id: 2906,
    weight: 1,
    props: {
      businessToolsSessionId: 2,
      catalogSessionId: 1,
      itemsCount: 7,
      lwiEntryPoint: 3,
      lwiSubEntryPoint: 6,
      statusSessionId: 5,
      userHasLinkedFbPage: 4
    }
  },
  EphemeralSyncResponseSend: {
    id: 4778,
    weight: 1,
    props: {
      clientDisappearingModeInitiator: 1,
      clientEphemeralityDuration: 2,
      clientEphemeralityInitiator: 3,
      clientEphemeralitySettingTimestamp: 4,
      clientEphemeralityTriggerAction: 5,
      esrDisappearingModeInitiator: 6,
      esrEphemeralityDuration: 7,
      esrEphemeralityInitiator: 8,
      esrEphemeralitySettingTimestamp: 9,
      esrEphemeralityTriggerAction: 10,
      esrFailureReason: 11,
      esrSendAttempt: 12,
      esrSendResult: 13,
      isAGroup: 14,
      messageDisappearingModeInitiator: 15,
      messageEphemeralityDuration: 16,
      messageEphemeralityInitiator: 17,
      messageEphemeralitySettingTimestamp: 18,
      messageEphemeralityTriggerAction: 19,
      threadId: 20
    }
  },
  ChatMute: {
    id: 2280,
    weight: 1,
    props: {
      actionConducted: 3,
      chatMuteNotificationChoice: 5,
      muteChatType: 4,
      muteDuration: 1,
      muteEntryPoint: 6,
      muteGroupSize: 2,
      waOfficialAccountName: 7
    }
  },
  AdvMetadataCreationFailure: { id: 3048, weight: 1, props: { advMetadataIsMe: 1 } },
  GroupJourney: {
    id: 4512,
    weight: 1,
    props: {
      actionType: 1,
      appSessionId: 2,
      groupSize: 3,
      surface: 4,
      threadType: 5,
      uiSurface: 7,
      userRole: 6
    }
  },
  CoexPrivacySysMsg: {
    id: 5204,
    weight: 1,
    props: {
      coexStatusReplyPrivacyDisclaimerUserAction: 8,
      coexSysMsgBusinessId: 1,
      coexSysMsgInsertionChannel: 9,
      coexSysMsgInsertionErrorCode: 2,
      coexSysMsgInsertionErrorMsg: 3,
      coexSysMsgInsertionSuccess: 4,
      coexSysMsgIsSelf: 5,
      coexSysMsgMultiDeviceId: 6,
      coexSysMsgStateTransitionAttempt: 7
    }
  },
  E2eMessageSend: {
    id: 476,
    weight: 20,
    props: {
      agentEngagementType: 15,
      botType: 17,
      e2eBackfill: 18,
      e2eCiphertextType: 5,
      e2eCiphertextVersion: 6,
      e2eDestination: 4,
      e2eFailureReason: 2,
      e2eReceiverDeviceType: 19,
      e2eReceiverType: 8,
      e2eSuccessful: 1,
      editType: 14,
      encRetryCount: 9,
      groupEncryptionState: 22,
      invisibleMessageCategory: 21,
      isLid: 12,
      localAddressingMode: 16,
      messageDistributionType: 20,
      messageIsInvisible: 10,
      messageMediaType: 7,
      retryCount: 3,
      revokeType: 11,
      typeOfGroup: 13
    }
  },
  GifSearchCancelled: { id: 1126, weight: 1, props: { gifSearchProvider: 1 } },
  ChatPsaRead: {
    id: 3574,
    weight: 1,
    props: { messageMediaType: 1, psaCampaignId: 4, psaMsgId: 5, readEntryPoint: 3 }
  },
  WebcEmojiOpen: { id: 1166, weight: 1, props: { webcEmojiOpenTab: 1 } },
  SignCredential: {
    id: 2242,
    weight: 1,
    props: {
      applicationState: 6,
      isFromWameta: 8,
      overallT: 4,
      projectCode: 7,
      retryCount: 2,
      signCredentialResult: 1,
      signCredentialT: 3,
      waConnectedToChatd: 5
    }
  },
  WebcMessageProcessingPerf: {
    id: 5790,
    weight: 100,
    props: {
      dbStoringT: 7,
      decryptionT: 1,
      isOffline: 2,
      lidProcessingT: 8,
      parsingT: 3,
      postProcessingT: 4,
      preProcessingT: 5,
      processingT: 6,
      reportTokenValidationT: 9
    }
  },
  WaFsSingleEmojiMessageDaily: {
    id: 5602,
    weight: 1,
    props: {
      animatedEmojiEnabled: 1,
      animatedEmojiReceiveCnt: 2,
      animatedEmojiSendCnt: 3,
      emojiClickCnt: 4,
      emojiReplyCount: 5,
      pauseAnimationCnt: 6,
      replayAnimationCnt: 7,
      singleEmojiReceiveCnt: 8,
      singleEmojiSendCnt: 9
    }
  },
  MexEventV2: {
    id: 4336,
    weight: 1,
    props: {
      mexEventV2DurationMs: 1,
      mexEventV2EndTime: 2,
      mexEventV2ErrorCodes: 3,
      mexEventV2Errors: 4,
      mexEventV2HasData: 5,
      mexEventV2IsArgoPayload: 10,
      mexEventV2IsMex: 6,
      mexEventV2OperationName: 7,
      mexEventV2QueryId: 8,
      mexEventV2StartTime: 9,
      mexFbUserType: 11
    }
  },
  BotJourney: {
    id: 4630,
    weight: 1,
    props: {
      actionType: 1,
      additionalCategory: 11,
      aiCreationAvatarCropChanges: 38,
      aiCreationInputType: 29,
      aiCreationPersonalityCategoryInsert: 26,
      aiCreationPersonalityCategorySelect: 27,
      aiDiscoveryTab: 4,
      aiSessionId: 18,
      aiVoiceOnSelectionDefault: 24,
      aiVoiceSelectionEnum: 25,
      appSessionId: 2,
      botDiscoveryPath: 8,
      botEntryPoint: 7,
      botPersonaId: 5,
      callRandomId: 13,
      conversationStarterCategory: 22,
      conversationStarterIndex: 23,
      conversationStarterPromptMode: 28,
      deviceLanguage: 16,
      discoveryOrigin: 19,
      inlineTosNoticeId: 20,
      inlineTosStatus: 21,
      isMetaAiAssistant: 12,
      isMetaAiCharacterBotChat: 9,
      isUserCreatedAgent: 10,
      metricCount: 17,
      uiSurface: 6,
      xmaReelIndex: 14,
      xmaReelMaxIndex: 15
    }
  },
  SearchTheWebFunnel: {
    id: 5702,
    weight: 1,
    props: {
      imageSearchFailedErrorType: 5,
      messageType: 1,
      stwEntryPoint: 2,
      stwFormat: 3,
      stwInteraction: 4
    }
  },
  VideoTranscoder: {
    id: 1802,
    weight: 1,
    props: {
      sourceAudioBitRate: 12,
      sourceDuration: 8,
      sourceFileSize: 7,
      sourceFormat: 14,
      sourceFrameRate: 13,
      sourceHeight: 10,
      sourceVideoBitRate: 11,
      sourceWidth: 9,
      targetAudioBitRate: 20,
      targetDuration: 16,
      targetFileSize: 15,
      targetFormat: 22,
      targetFrameRate: 21,
      targetHeight: 18,
      targetVideoBitRate: 19,
      targetWidth: 17,
      transcoderAlgorithm: 1,
      transcoderContainsVideocomposition: 5,
      transcoderHasEdits: 6,
      transcoderIsPassthrough: 4,
      transcoderResult: 2,
      transcoderT: 3
    }
  },
  SyncdKeyCount: {
    id: 3978,
    weight: 1,
    props: {
      keysUsedInSnapshotCount: 1,
      p80MuationsPerKey: 2,
      p95MuationsPerKey: 3,
      syncdSessionLengthDays: 4,
      totalKeyCount: 5
    }
  },
  Ptt: {
    id: 458,
    weight: 1,
    props: {
      isMetaAiThread: 15,
      pttAvgNoiseLoudness: 11,
      pttAvgNoiseLoudnessReduction: 12,
      pttAvgSpeechLoudness: 13,
      pttAvgSpeechLoudnessReduction: 14,
      pttDraftPlayCnt: 7,
      pttDraftSeekCnt: 8,
      pttDuration: 5,
      pttLock: 4,
      pttPauseCnt: 9,
      pttResult: 1,
      pttSize: 3,
      pttSource: 2,
      pttStop: 6,
      pttStopTapCnt: 10
    }
  },
  StickerSend: {
    id: 1840,
    weight: 1,
    props: {
      stickerIsAi: 7,
      stickerIsAnimated: 3,
      stickerIsAvatar: 6,
      stickerIsFirstParty: 2,
      stickerIsFromStickerMaker: 5,
      stickerIsFromUserCreatedPack: 12,
      stickerIsGiphy: 10,
      stickerIsLottie: 9,
      stickerIsTenor: 11,
      stickerMakerSourceType: 8,
      stickerSendMessageType: 4,
      stickerSendOrigin: 1
    }
  },
  ChannelDiscoveryVisibilityTracking: {
    id: 5766,
    weight: 1,
    props: {
      channelCategoryIndex: 1,
      channelCategoryName: 2,
      channelDirectorySessionId: 3,
      channelEventUnit: 4,
      channelIndex: 5,
      cid: 6,
      countrySelector: 7,
      discoverySurface: 8,
      isSubImpression: 16,
      pillSelected: 11,
      similarChannelsSessionId: 13,
      unifiedSessionId: 14,
      updatesTabSessionId: 17
    }
  },
  UpdatesTabSearch: {
    id: 4838,
    weight: 1,
    props: {
      channelsAdminCount: 5,
      channelsFollowedCount: 1,
      premiumChannelsFollowedCount: 8,
      recentStatusItemCount: 2,
      recentStatusRowCount: 3,
      updateTabSearchEventType: 4,
      updatesTabSearchModeType: 11,
      updatesTabSearchResultType: 9,
      updatesTabSearchSessionId: 10,
      viewedStatusItemCount: 6,
      viewedStatusRowCount: 7
    }
  },
  BusinessUnmute: { id: 1378, weight: 1, props: { muteeId: 1 } },
  MdBootstrapAppStateCriticalDataProcessing: {
    id: 3164,
    weight: 1,
    props: {
      bootstrapAppStateDataStage: 1,
      mdBootstrapPayloadType: 2,
      mdRegAttemptId: 3,
      mdSessionId: 4,
      mdTimestamp: 5
    }
  },
  CommunityFeatureUsage: {
    id: 3696,
    weight: 1,
    props: { communityId: 2, communityUiAction: 4, communityUiFeature: 3 }
  },
  PsGroupSafetyCheckSheetSeen: {
    id: 6240,
    weight: 1,
    props: { integrityGroupUserHashedId: 2, psSafetyCheckGroupJid: 1 }
  },
  ChannelCoreEvent: {
    id: 4692,
    weight: 1,
    props: {
      channelCoreEventSequenceNumber: 8,
      channelCoreEventType: 1,
      channelDirectorySessionId: 7,
      channelEntryPoint: 2,
      channelEntryPointApp: 3,
      channelEntryPointMetadata: 10,
      channelEventUnit: 12,
      cid: 4,
      directoryChannelIndex: 9,
      discoverySurface: 14,
      entryPointMetadata: 5,
      eventSurface: 6,
      similarChannelsSessionId: 13
    }
  },
  WebcFingerprint: {
    id: 1704,
    weight: 1,
    props: {
      browserEngine: 26,
      connectionRtt: 37,
      cpuMake: 38,
      deviceMemory: 39,
      extentionIds: 27,
      externalSources: 36,
      gpuMake: 40,
      hasChrome: 28,
      hasTaskbar: 29,
      hasWebShare: 30,
      historyLength: 41,
      mimeTypeCount: 31,
      notificationPermission: 32,
      pdfViewerEnabled: 33,
      peripherals: 42,
      platformEstimate: 34,
      pluginCount: 35,
      screenResolution: 43,
      sessionStorageLength: 44,
      timezone: 45,
      touchPresence: 46,
      viewportSize: 47,
      webcCanvasFingerprint: 25,
      webcWebglFingerprint: 24,
      webcWebglRenderer: 23,
      webcWebglVendor: 22,
      webcWindowNavigatorWebdriver: 21
    }
  },
  DisappearingMessageKeepInChat: {
    id: 3482,
    weight: 1,
    props: {
      canEditDmSettings: 16,
      chatEphemeralityDuration: 1,
      isAGroup: 2,
      isAdmin: 3,
      keptCount: 15,
      keptDelta: 4,
      kicActionName: 5,
      kicActor: 6,
      kicEntryPoint: 7,
      mediaType: 8,
      messageExpiredOnUnkeep: 9,
      messageExpiryTimer: 10,
      messagesInFolder: 11,
      messagesSelected: 12,
      threadId: 13
    }
  },
  ChatLockAction: {
    id: 4212,
    weight: 1,
    props: {
      actionEntryPoint: 3,
      actionFolderChatsCount: 4,
      authType: 5,
      chatLockActionType: 1,
      chatLockIsGroup: 2
    }
  },
  WebcMemoryStat: {
    id: 1188,
    weight: 10,
    props: {
      appContext: 26,
      appContextBitfield: 27,
      chatCollectionSize: 17,
      chatDbSize: 18,
      contactCollectionSize: 19,
      contactDbSize: 20,
      isForeground: 13,
      jsHeapSizeLimit: 9,
      messageCollectionSize: 24,
      messageDbSize: 25,
      peakUsedJsHeapSize: 14,
      scenario: 15,
      totalJsHeapSize: 10,
      uptime: 6,
      usedJsHeapSize: 11,
      usedJsHeapSizeDelta: 16,
      webcRuntimeEnv: 23
    }
  },
  WebcMediaEditorSend: {
    id: 2890,
    weight: 1,
    props: {
      blurImageCount: 7,
      editedImageCount: 2,
      emojiLayerCount: 5,
      imageCount: 1,
      paintedImageCount: 3,
      stickerLayerCount: 6,
      textLayerCount: 4
    }
  },
  WebContactListStartNewChat: {
    id: 4560,
    weight: 1,
    props: { webContactListStartNewChatSearch: 1, webContactListStartNewChatType: 2 }
  },
  InvalidMacIncomingMutation: {
    id: 6072,
    weight: 1,
    props: {
      collection: 1,
      doesIndexExistLocally: 2,
      isSenderPrimary: 3,
      mutationActionName: 4,
      mutationIndexMac: 5,
      mutationOperationType: 6,
      patchSenderPlatform: 7,
      patchVersionNum: 8,
      senderDeviceId: 9
    }
  },
  WebcButterbarEvent: {
    id: 3932,
    weight: 1,
    props: { webcButterbarAction: 1, webcButterbarType: 2 }
  },
  MdBootstrapAppStateDataDownloaded: {
    id: 2294,
    weight: 1,
    props: {
      appContext: 14,
      appContextBitfield: 15,
      applicationState: 13,
      mdBootstrapContactsCount: 5,
      mdBootstrapHistoryPayloadType: 11,
      mdBootstrapPayloadSize: 4,
      mdBootstrapPayloadType: 2,
      mdBootstrapStepDuration: 6,
      mdBootstrapStepResult: 7,
      mdRegAttemptId: 10,
      mdSessionId: 1,
      mdStorageQuotaBytes: 8,
      mdStorageQuotaUsedBytes: 9,
      mdTimestamp: 3
    }
  },
  WebcSocketConnect: {
    id: 5450,
    weight: 1,
    props: {
      webcAuthHandshakeDuration: 1,
      webcSocketConnectDuration: 2,
      webcSocketConnectReason: 3,
      webcSocketHostname: 4
    }
  },
  DisappearingModeSettingChange: {
    id: 3056,
    weight: 1,
    props: {
      disappearingModeEntryPoint: 4,
      lastToggleTimestamp: 3,
      newEphemeralityDuration: 2,
      previousEphemeralityDuration: 1
    }
  },
  AddressingModeMismatch: {
    id: 4750,
    weight: 1,
    props: {
      iqResponse: 1,
      localAddressingMode: 2,
      mismatchOrigin: 6,
      notificationTag: 3,
      serverAddressingMode: 5
    }
  },
  DeepLinkClick: {
    id: 1156,
    weight: 1,
    props: {
      deepLinkHasPhoneNumber: 2,
      deepLinkHasText: 1,
      deepLinkHasUsername: 4,
      deepLinkHasUsernamePin: 5,
      deepLinkRequirePinEntry: 6,
      deepLinkSessionId: 3
    }
  },
  PsGroupOpened: {
    id: 6236,
    weight: 1,
    props: {
      integrityGroupUserHashedId: 4,
      isGroupSafetyCheckAbpropEnabled: 2,
      isPartOfGroupSafetyCheckExperiment: 3,
      openedGroupJid: 1
    }
  },
  DeepLinkConversion: {
    id: 1432,
    weight: 1,
    props: {
      callInitiator: 8,
      ctwaChatCreationMode: 4,
      ctwaConversionType: 3,
      ctwaSignals: 9,
      deepLinkConversionData: 2,
      deepLinkConversionSource: 1,
      isPriority: 7,
      trustBannerAction: 5,
      trustBannerType: 6
    }
  },
  EditBusinessProfile: {
    id: 1466,
    weight: 1,
    props: {
      businessProfileEntryPoint: 10,
      editBusinessProfileSessionId: 2,
      editProfileAction: 1,
      editProfileActionField: 9,
      hasAddress: 5,
      hasCategory: 4,
      hasDescription: 3,
      hasEmail: 7,
      hasHours: 6,
      hasPaymentInfo: 11,
      hasWebsite: 8
    }
  },
  PsGroupExitExperienceGroupAction: {
    id: 6332,
    weight: 1,
    props: {
      psGroupExitExperienceAction: 1,
      psGroupExitExperienceEnabled: 2,
      psGroupExitExperienceGroupJid: 3,
      psGroupExitExperienceTouchPoint: 4
    }
  },
  WebcLinkPreviewDisplay: {
    id: 3864,
    weight: 1,
    props: { didFallbackNonHq: 2, didRequestHq: 3, didRespondHqPreview: 4, webcDisplayStatus: 1 }
  },
  MdRetryFromUnknownDevice: { id: 2178, weight: 1, props: { offline: 2, senderType: 1 } },
  PinInChatMessageSend: {
    id: 4438,
    weight: 1,
    props: {
      groupRole: 1,
      groupTypeClient: 2,
      isAGroup: 3,
      isSelfParentMessage: 7,
      isSelfPin: 8,
      mediaType: 4,
      pinInChatExpirySecs: 5,
      pinInChatType: 6,
      timeRemainingToExpirySecs: 9
    }
  },
  InlineVideoPlaybackClosed: {
    id: 2032,
    weight: 1,
    props: {
      inlineVideoCancelBeforePlayStateT: 7,
      inlineVideoComplete: 8,
      inlineVideoCompletionRate: 9,
      inlineVideoCtaClick: 10,
      inlineVideoDurationT: 2,
      inlineVideoError: 11,
      inlineVideoHasRcat: 13,
      inlineVideoPlayStartT: 6,
      inlineVideoPlayed: 3,
      inlineVideoStallT: 4,
      inlineVideoType: 1,
      inlineVideoWatchT: 5,
      messageType: 12
    }
  },
  ChannelDirectory: {
    id: 4544,
    weight: 1,
    props: {
      channelCategoryIndex: 11,
      channelCategoryName: 12,
      channelDirectoryAction: 1,
      channelDirectoryActionSequenceNumber: 5,
      channelDirectoryEntryPoint: 2,
      channelDirectorySearchSessionId: 14,
      channelDirectorySessionId: 3,
      channelDirectorySurface: 13,
      channelIndex: 6,
      cid: 4,
      countrySelector: 8,
      impReason: 9,
      pillSelected: 10,
      searchMode: 7
    }
  },
  OfflineCountTooHigh: {
    id: 2638,
    weight: 1,
    props: {
      callStanzaType: 7,
      invisibleMessageCategory: 8,
      mediaType: 3,
      messageType: 4,
      notificationStanzaType: 6,
      offlineCount: 2,
      receiptStanzaType: 5,
      stanzaType: 1
    }
  },
  GatedMessageReceived: { id: 3152, weight: 1, props: { chatGatedReason: 1 } },
  PrivacyHighlightDaily: {
    id: 3522,
    weight: 1,
    props: {
      dialogAppearCount: 1,
      dialogSelectCount: 2,
      narrativeAppearCount: 3,
      privacyHighlightCategory: 4,
      privacyHighlightSurface: 5
    }
  },
  NotificationSetting: {
    id: 3684,
    weight: 1,
    props: {
      groupReactionNotification: 1,
      groupShowNotification: 2,
      groupSoundTone: 3,
      inAppNotificationAlertStyle: 4,
      inAppNotificationSound: 5,
      inAppNotificationVibrate: 6,
      messageReactionNotification: 7,
      messageShowNotification: 8,
      messageSoundTone: 9,
      offlineNotification: 11,
      showPreview: 10,
      statusNotificationPriority: 14,
      statusNotificationVibration: 15,
      statusReactionNotification: 16,
      statusReminderNotification: 12,
      statusShowNotification: 18,
      statusSoundTone: 17,
      unreadBadgeSetting: 13
    }
  },
  WebcImgError: { id: 1700, weight: 1, props: { webcImgErrorCode: 1 } },
  ChannelMessageVisibilityTracking: {
    id: 5998,
    weight: 1,
    props: { cid: 1, isStarredPost: 8, isVpvImpression: 7, postId: 4, unifiedSessionId: 6 }
  },
  WebcQplHealth: {
    id: 3134,
    weight: 1,
    props: { webcQplHealthEventData: 1, webcQplHealthEventType: 2 }
  },
  StickerError: { id: 5024, weight: 1, props: { stickerErrorType: 1 } },
  MessageContextMenuActions: {
    id: 3694,
    weight: 1,
    props: {
      isAGroup: 1,
      isMultiAction: 2,
      isOriginalSender: 3,
      messageContextMenuAction: 4,
      messageContextMenuOption: 5
    }
  },
  Login: {
    id: 460,
    weight: 1,
    props: {
      androidKeystoreState: 10,
      appContext: 20,
      appContextBitfield: 21,
      connectionOrigin: 6,
      connectionSequenceStep: 11,
      connectionT: 5,
      dnsResolutionMethod: 12,
      loginDnsResolver: 13,
      loginIpSource: 14,
      loginPort: 15,
      loginResolvedPop: 19,
      loginResult: 1,
      loginSocketProvider: 22,
      loginT: 3,
      logoutSessionId: 18,
      longConnect: 4,
      noiseProtocolVersion: 16,
      passive: 8,
      pendingAcksCount: 17,
      retryCount: 2,
      sequenceStep: 7,
      serverErrorCode: 9
    }
  },
  GroupProfilePicture: {
    id: 3652,
    weight: 1,
    props: {
      groupCreationDs: 1,
      groupProfileAction: 7,
      hasProfilePicture: 3,
      isAdmin: 4,
      preciseGroupSizeBucket: 5,
      profilePictureType: 6
    }
  },
  WebcMediaAnalyzed: {
    id: 912,
    weight: 1,
    props: { webcMediaAnalyzeT: 3, webcMediaExtensions: 2, webcMediaSupported: 1 }
  },
  NotificationEngagement: {
    id: 3796,
    weight: 1,
    props: {
      avgNotifEngagementT: 1,
      groupSizeBucket: 2,
      groupTypeClient: 3,
      isAGroup: 4,
      isWebBackgroundSyncNotif: 18,
      threadId: 5,
      totalLinkReshareMessageNotifShown: 19,
      totalLinkReshareMessageNotifShownFb: 21,
      totalLinkReshareMessageNotifShownIg: 22,
      totalLinkReshareMessageNotifTapToOpen: 20,
      totalLinkReshareMessageNotifTapToOpenFb: 23,
      totalLinkReshareMessageNotifTapToOpenIg: 24,
      totalMessageReminderNotifShown: 16,
      totalMessageReminderNotifTapToOpen: 17,
      totalNotifMarkAsRead: 6,
      totalNotifMissedCallVoipCallback: 7,
      totalNotifMissedCallVoipMessage: 8,
      totalNotifOthers: 9,
      totalNotifReply: 10,
      totalNotifRtcVoipAccept: 11,
      totalNotifRtcVoipDecline: 12,
      totalNotifShowPreview: 13,
      totalNotifShown: 14,
      totalNotifTapToOpen: 15
    }
  },
  ChatPsaAction: {
    id: 3572,
    weight: 1,
    props: { messageMediaType: 1, psaCampaignId: 4, psaMessageActionType: 2, psaMsgId: 5 }
  },
  MetaAiUpsellCta: {
    id: 6532,
    weight: 1,
    props: { metaAiUpsellCtaOperation: 1, metaAiUpsellCtaSource: 2 }
  },
  ChannelMembershipActionEvent: { id: 5762, weight: 1, props: { actionResult: 1, cid: 2 } },
  WebcRawPlatforms: { id: 2416, weight: 1, props: { webcRawPlatform: 1 } },
  PnhDaily: {
    id: 3806,
    weight: 1,
    props: {
      communityId: 1,
      mappingMissing: 7,
      pnhIndicatorClicksChat: 2,
      pnhIndicatorClicksInfoScreen: 3,
      reactionDeleteCount: 4,
      reactionOpenTrayCount: 5,
      totalContacts: 8,
      typeOfGroup: 6
    }
  },
  MessageSend: {
    id: 854,
    weight: 1,
    props: {
      agentEngagementType: 49,
      appContext: 72,
      appContextBitfield: 73,
      botType: 55,
      chatOrigins: 58,
      chatSessionId: 67,
      deviceCount: 31,
      deviceSizeBucket: 25,
      disappearingChatInitiator: 30,
      e2eBackfill: 23,
      e2eCiphertextType: 10,
      e2eCiphertextVersion: 9,
      e2eFailureReason: 46,
      editDuration: 43,
      editType: 44,
      ephemeralityDuration: 21,
      ephemeralityInitiator: 47,
      ephemeralityTriggerAction: 48,
      excessPayloadKbSize: 40,
      fastForwardEnabled: 15,
      hasUsername: 59,
      hasUsernamePin: 74,
      invisibleMessageCategory: 64,
      isAComment: 54,
      isAReply: 35,
      isFromWamsys: 19,
      isLid: 39,
      isPremium: 69,
      isViewOnce: 22,
      isWhatsapiBuild: 75,
      localAddressingMode: 53,
      logoutReason: 70,
      mediaCaptionPresent: 8,
      mediaUploadError: 61,
      mediaUploadRetryCount: 62,
      messageDistributionType: 41,
      messageForwardAgeT: 14,
      messageIsFanout: 5,
      messageIsFastForward: 13,
      messageIsFirstUserMessage: 26,
      messageIsForward: 4,
      messageIsInternational: 7,
      messageIsInvisible: 29,
      messageIsRevoke: 24,
      messageKeyHash: 57,
      messageMediaType: 3,
      messageSendOptUploadEnabled: 12,
      messageSendResult: 1,
      messageSendResultIsTerminal: 17,
      messageSendSource: 66,
      messageSendT: 11,
      messageType: 2,
      networkWasDisconnected: 37,
      oppositeVisibleIdentification: 60,
      overallMediaSize: 42,
      pairedMediaType: 71,
      participantCount: 32,
      receiverDefaultDisappearingDuration: 28,
      resendCount: 16,
      retryCount: 6,
      revokeDuration: 33,
      revokeType: 34,
      runningTasks: 63,
      sendButtonPressT: 45,
      senderDefaultDisappearingDuration: 27,
      serverErrorCode: 56,
      stickerIsAi: 50,
      stickerIsAvatar: 38,
      stickerIsFirstParty: 18,
      stickerIsFromStickerMaker: 51,
      stickerMakerSourceType: 52,
      thumbSize: 20,
      typeOfGroup: 36,
      unifiedSessionId: 68,
      userToDeviceSizeBucket: 65
    }
  },
  WebcNavbar: { id: 5258, weight: 1, props: { webcNavbarItemLabel: 1 } },
  StickerCommonQueryToStaticServer: {
    id: 2740,
    weight: 1,
    props: { httpResponseCode: 2, params: 3, queryLatencyMs: 4, queryType: 1 }
  },
  PaidMessagingUserInteractionsLogger: {
    id: 4740,
    weight: 1,
    props: {
      pmxActionTarget: 1,
      pmxActionType: 2,
      pmxComponentType: 3,
      pmxHashedMessageId: 13,
      pmxHashedMessageKey: 11,
      pmxHeaderMediaType: 4,
      pmxHostStorage: 8,
      pmxMarketingFormat: 5,
      pmxMessageDeliveredTs: 10,
      pmxMessageStanzaAcceptedTs: 12,
      pmxQueryParams: 6,
      pmxSenderCountryCode: 9,
      templateId: 7
    }
  },
  WebcProgressiveImage: {
    id: 2226,
    weight: 10,
    props: {
      webcFirstRenderScans: 1,
      webcFirstRenderT: 2,
      webcFullQualityT: 4,
      webcMidQualityT: 3
    }
  },
  CrashLog: {
    id: 494,
    weight: 1,
    props: {
      activeSubfunnelId: 20,
      activeSubfunnelType: 21,
      appContext: 32,
      appContextBitfield: 33,
      chatSessionId: 22,
      crashApplicationState: 23,
      crashContext: 3,
      crashCount: 5,
      crashLogProductArea: 28,
      crashLogTimeSpentViewName: 27,
      crashReason: 2,
      crashTimeout: 24,
      crashType: 6,
      iphoneProcessNonGlobal: 30,
      iphoneTimeSpentSurfaceId: 26,
      lowPowerModeEnabled: 31,
      peripheralConnected: 19,
      processIdentifier: 18,
      runningTasks: 16,
      ufadReportType: 29,
      unifiedSessionId: 25
    }
  },
  PsStructuredMessageInteraction: {
    id: 3052,
    weight: 1,
    props: {
      bizPlatform: 1,
      businessOwnerJid: 7,
      messageClass: 3,
      messageClassAttributes: 5,
      messageInteraction: 4,
      messageMediaType: 2,
      templateId: 8,
      threadIdHmac: 9
    }
  },
  DeepLinkMsgSent: { id: 3198, weight: 1, props: { deepLinkAction: 1, deepLinkSessionId: 2 } },
  ReactionActions: {
    id: 3184,
    weight: 20,
    props: { mediaType: 3, messageType: 1, reactionAction: 2 }
  },
  MediaUpload2: {
    id: 1588,
    weight: 1,
    props: {
      appContext: 63,
      appContextBitfield: 64,
      batchSize: 57,
      connectionType: 43,
      debugMediaException: 34,
      debugMediaIp: 32,
      debugUrl: 33,
      estimatedBandwidth: 45,
      estimatedBandwidthV2: 61,
      fileHeight: 55,
      fileWidth: 56,
      finalizeConnectT: 28,
      finalizeHttpCode: 31,
      finalizeIsReuse: 30,
      finalizeNetworkT: 29,
      httpProtocolVersionType: 51,
      isViewOnce: 49,
      mediaCollectionId: 60,
      mediaId: 46,
      messageKeyHash: 58,
      networkStack: 42,
      originalSize: 53,
      overallAttemptCount: 4,
      overallConnBlockFetchT: 10,
      overallConnectionClass: 41,
      overallCumT: 37,
      overallCumUserVisibleT: 38,
      overallDomain: 5,
      overallEncryptT: 50,
      overallIsFinal: 36,
      overallIsForward: 16,
      overallIsManual: 13,
      overallLastUploadRetryPhase: 11,
      overallMediaKeyReuse: 40,
      overallMediaSize: 7,
      overallMediaType: 1,
      overallMmsVersion: 6,
      overallOptimisticFlag: 12,
      overallQueueT: 9,
      overallRetryCount: 3,
      overallT: 8,
      overallTranscodeT: 15,
      overallUploadMode: 39,
      overallUploadOrigin: 44,
      overallUploadResult: 35,
      overallUserVisibleT: 14,
      pairedMediaType: 62,
      photoQualitySetting: 52,
      resumeConnectT: 17,
      resumeHttpCode: 20,
      resumeIsReuse: 19,
      resumeNetworkT: 18,
      uploadBytesTransferred: 27,
      uploadConnectT: 22,
      uploadHttpCode: 25,
      uploadIsReuse: 24,
      uploadIsStreaming: 26,
      uploadNetworkT: 23,
      uploadResumePoint: 21,
      uploadSource: 48,
      usedFallbackHint: 47,
      videoQualitySetting: 54
    }
  },
  MdAppStateDirtyBits: { id: 2520, weight: 1e3, props: { dirtyBitsFalsePositive: 2 } },
  AutomaticEventsUserJourney: {
    id: 6636,
    weight: 1,
    props: { automaticEventsTargetComponent: 1, smbUserActionType: 2, surface: 3 }
  },
  PsBufferUpload: {
    id: 2244,
    weight: 100,
    props: {
      applicationState: 6,
      isFromWamsys: 12,
      isRealtime: 15,
      isUserSampled: 14,
      psBufferSequenceNumber: 13,
      psBufferUploadHttpResponseCode: 3,
      psBufferUploadResult: 1,
      psBufferUploadT: 2,
      psDitheredT: 11,
      psForceUpload: 10,
      psTokenNotReadyReason: 4,
      psUploadReason: 9,
      waConnectedToChatd: 5
    }
  },
  CtwaConsumerDisclosure: {
    id: 4406,
    weight: 1,
    props: {
      ctwaConsumerDisclosureVersion: 3,
      disclosureAction: 1,
      disclosureContext: 5,
      disclosureEntryPoint: 4,
      disclosureType: 2
    }
  },
  GroupJoinC: { id: 158, weight: 1, props: {} },
  WaFsGroupJoinRequestAction: {
    id: 3944,
    weight: 1,
    props: {
      groupJid: 1,
      groupJoinRequestAction: 2,
      groupJoinRequestGroupsInCommon: 5,
      isSuccessful: 3,
      serverResponseTime: 4
    }
  },
  TestAnonymousIdLess: { id: 3004, weight: 1, props: { psTimeSinceLastEventInMin: 1 } },
  MessageDeleteActions: {
    id: 3626,
    weight: 1,
    props: { deleteActionType: 1, isAGroup: 2, mediaType: 6, messagesDeleted: 3, threadId: 4 }
  },
  WebcLogin: {
    id: 1664,
    weight: 1,
    props: {
      webcBrowserNetworkType: 14,
      webcBrowserStorageQuotaBytes: 15,
      webcBrowserStorageQuotaUsedBytes: 16,
      webcLoginT: 3,
      webcPersistentLoginEnabled: 17,
      webcQrCodes: 1,
      webcQrLoadT: 2,
      webcSyncChatCount: 8,
      webcSyncChatSize: 10,
      webcSyncChatT: 9,
      webcSyncContactCount: 11,
      webcSyncContactSize: 13,
      webcSyncContactT: 12,
      webcSyncMessageCount: 5,
      webcSyncMessageSize: 7,
      webcSyncMessageT: 6,
      webcSyncT: 4
    }
  },
  CtwaUserJourney: {
    id: 3466,
    weight: 1,
    props: {
      adId: 1,
      businessJid: 2,
      ctwaChatCreationMode: 6,
      ctwaUserJourneyMetadata: 12,
      ctwaUserJourneyOperation: 3,
      elapsedTimeInMs: 13,
      featureEnabled: 9,
      icebreakersShown: 4,
      sequenceNumber: 5,
      threadCreationDate: 10,
      threadIdHmac: 11,
      trustBannerAction: 7,
      trustBannerType: 8
    }
  },
  MdBootstrapHistoryDataStartDownloading: {
    id: 4650,
    weight: 1,
    props: {
      historySyncChunkOrder: 1,
      historySyncStageProgress: 2,
      mdBootstrapHistoryPayloadType: 3,
      mdBootstrapPayloadSize: 4,
      mdBootstrapPayloadType: 5,
      mdBootstrapStepDuration: 6,
      mdSessionId: 7,
      mdTimestamp: 8
    }
  },
  ReportingTokenValidationFailureSender: {
    id: 6094,
    weight: 1,
    props: {
      clientMessageId: 1,
      e2eReceiverType: 2,
      e2eSenderType: 3,
      editType: 4,
      isLid: 5,
      isMessageMediaRetry: 14,
      isMessageRetry: 6,
      isSecretEncryptedMsg: 12,
      messageIsForward: 15,
      messageMediaType: 7,
      messageType: 8,
      offline: 9,
      reportingTokenValidationFailureReason: 10,
      reportingTokenVersion: 13,
      senderJid: 11
    }
  },
  Ctwa3pdConversion: {
    id: 5138,
    weight: 1,
    props: {
      ctwa3pdConversionMetadata: 1,
      ctwa3pdConversionSubtype: 2,
      ctwa3pdConversionType: 3,
      ctwa3pdSchemaVersion: 4,
      ctwa3pdSurfaceType: 5,
      ctwaSignals: 7,
      ctwaTrackingPayload: 6
    }
  },
  BusinessToolsImpression: {
    id: 2220,
    weight: 1,
    props: {
      businessToolsEntryPoint: 4,
      businessToolsSequenceNumber: 2,
      businessToolsSessionId: 1
    }
  },
  UnknownStanza: { id: 3448, weight: 1, props: { unknownStanzaTag: 1, unknownStanzaType: 2 } },
  PrivacyTipAction: { id: 4794, weight: 1, props: { privacyTipActionType: 1 } },
  WebcLinkPreviewResponseHandle: {
    id: 3860,
    weight: 1,
    props: {
      didRespondHqPreview: 5,
      isPreviewSuccess: 2,
      previewDurationMs: 4,
      previewSessionId: 3
    }
  },
  ListUpdate: {
    id: 5830,
    weight: 1,
    props: {
      groupsAdded: 9,
      groupsAfterUpdate: 10,
      listAction: 1,
      listId: 2,
      listType: 3,
      predefinedId: 13,
      updateEntryPoint: 8,
      usersAdded: 11,
      usersAfterUpdate: 12
    }
  },
  MdCriticalEvent: { id: 2746, weight: 1, props: { collection: 2, mdCriticalEventCode: 1 } },
  OrderDetailsActionsSmb: {
    id: 3456,
    weight: 1,
    props: {
      acceptedPayMethods: 1,
      actionCategory: 2,
      entryPointConversionSource: 13,
      extraAttributes: 3,
      hasAddedPrice: 4,
      hasCatalog: 5,
      hasNote: 6,
      lastMessageDirection: 14,
      messageDepth: 15,
      orderDetailEntryPoint: 7,
      orderDetailsCreationAction: 8,
      orderEligibleToSend: 11,
      paymentStatus: 9,
      paymentType: 10,
      sharingOrderStatusEvents: 12,
      threadIdHmac: 16
    }
  },
  CtwaLabelSignal: {
    id: 4662,
    weight: 1,
    props: {
      ctwaLabelSignalVersion: 1,
      ctwaLabelTarget: 2,
      ctwaLabelType: 3,
      ctwaSignalMetadata: 9,
      customerAdsSharingSettingEnabled: 10,
      deepLinkConversionData: 4,
      deepLinkConversionSource: 5,
      eventSharingSettingEnabled: 6,
      globalSharingSettingEnabled: 7,
      threadIdHmac: 8
    }
  },
  EphemeralOutOfSyncInfo: {
    id: 3892,
    weight: 1,
    props: {
      groupSizeBucket: 1,
      incomingMessageEphemeralityDuration: 2,
      isAGroup: 3,
      isNewThreadForUser: 5,
      otherDefaultModeDuration: 6,
      threadEphemeralityDuration: 7,
      threadId: 8,
      userDefaultModeDuration: 9
    }
  },
  WebcChatCreate: { id: 6132, weight: 1, props: { creationMethod: 1, noCreated: 2 } },
  MdChatAssignmentSecondaryAction: {
    id: 3716,
    weight: 1,
    props: {
      mdChatAssignmentSecondaryActionAgentId: 1,
      mdChatAssignmentSecondaryActionAssignmentType: 8,
      mdChatAssignmentSecondaryActionBrowserId: 2,
      mdChatAssignmentSecondaryActionChatType: 3,
      mdChatAssignmentSecondaryActionError: 4,
      mdChatAssignmentSecondaryActionMdId: 5,
      mdChatAssignmentSecondaryActionSource: 6,
      mdChatAssignmentSecondaryActionType: 7
    }
  },
  ClockSkewDifferenceT: { id: 3178, weight: 1e4, props: { clockSkewHourly: 1 } },
  BugReportSession: {
    id: 3850,
    weight: 1,
    props: {
      bugReportErrorMessage: 2,
      bugReportFlowAction: 1,
      bugReportImageCount: 8,
      bugReportMediaCount: 3,
      bugReportNumberOfChars: 9,
      bugReportNumberOfWords: 10,
      bugReportTaskId: 7,
      bugReportVideoCount: 11,
      bugReportingEntryPoint: 12,
      submitBugCategory: 6,
      submitBugContainsTitle: 5
    }
  },
  WebcJobInfo: {
    id: 3054,
    weight: 1,
    props: {
      jobName: 1,
      jobPriority: 2,
      jobResultType: 5,
      pendingJobsCount: 4,
      scenario: 3,
      webcJobAddedT: 6,
      webcJobCompletedT: 8,
      webcJobStartedT: 7
    }
  },
  WebcMenu: { id: 2504, weight: 1, props: { webcMenuAction: 2, webcMenuItemLabel: 3 } },
  SettingsClick: {
    id: 2214,
    weight: 1,
    props: {
      isBookmarkAppInstalled: 4,
      settingsClickEntryPoint: 2,
      settingsItem: 1,
      settingsPageType: 3
    }
  },
  TestAnonymousDaily: { id: 2328, weight: 1, props: {} },
  KeepInChatNux: {
    id: 3486,
    weight: 1,
    props: { chatEphemeralityDuration: 1, kicNuxActionName: 2, threadId: 3, trigger: 4 }
  },
  WefrClientExposure: { id: 5504, weight: 1, props: { exposureKey: 1, sentWithDaily: 3 } },
  MessageHighRetryCount: {
    id: 3132,
    weight: 20,
    props: {
      deviceSizeBucket: 5,
      e2eSenderType: 3,
      invisibleMessageCategory: 6,
      isReceiverLidBased: 7,
      isSenderLidBased: 8,
      mediaType: 1,
      messageType: 4,
      retryCount: 2
    }
  },
  TestAnonymousDailyId: { id: 2958, weight: 1, props: { psTestEnumField: 1, psTestFloatField: 2 } },
  WebcPageLoad: {
    id: 642,
    weight: 1,
    props: {
      webcAppcacheStatus: 29,
      webcCached: 30,
      webcConnectEnd: 10,
      webcConnectStart: 9,
      webcDomComplete: 19,
      webcDomContentLoadedEventEnd: 18,
      webcDomContentLoadedEventStart: 17,
      webcDomInteractive: 16,
      webcDomLoading: 15,
      webcDomainLookupEnd: 8,
      webcDomainLookupStart: 7,
      webcExeDone: 23,
      webcExeStart: 22,
      webcFetchStart: 6,
      webcInitialMountT: 38,
      webcInitialNavMountT: 39,
      webcInitialPanel: 42,
      webcInitialPanelMountStartT: 43,
      webcInitialPanelMountT: 40,
      webcInitialPanelRenderT: 46,
      webcJsLoadT: 37,
      webcLoadEventEnd: 21,
      webcLoadEventStart: 20,
      webcLoadInForeground: 53,
      webcMainScriptEnd: 45,
      webcMainScriptStart: 44,
      webcNativeLoadT: 36,
      webcNavigation: 32,
      webcPageLoadId: 54,
      webcPageLoadT: 34,
      webcParallellyFetched: 41,
      webcQrCode: 31,
      webcRedirectCount: 33,
      webcRedirectEnd: 5,
      webcRedirectStart: 4,
      webcRequestStart: 12,
      webcResponseEnd: 14,
      webcResponseStart: 13,
      webcSecureConnectionStart: 11,
      webcUnloadEventEnd: 3,
      webcUnloadEventStart: 2,
      webcWsAttempts: 28,
      webcWsNormal: 27,
      webcWsOpening: 24,
      webcWsPairing: 25,
      webcWsSyncing: 26
    }
  },
  MessageSecretErrors: {
    id: 3686,
    weight: 1,
    props: { messageMediaType: 3, messageSecretAllowedList: 1, messageSecretError: 2 }
  },
  EditMessageSend: {
    id: 3990,
    weight: 1,
    props: {
      editDuration: 1,
      editType: 2,
      mediaType: 8,
      messageSendResultIsTerminal: 3,
      messageType: 4,
      resendCount: 5,
      retryCount: 6,
      typeOfGroup: 9
    }
  },
  PsGroupSafetyCheckUiInteractions: {
    id: 6242,
    weight: 1,
    props: { integrityGroupUserHashedId: 3, psSafetyCheckGroupJid: 1, psSafetyCheckInteraction: 2 }
  },
  GifSearchNoResults: {
    id: 1128,
    weight: 1,
    props: { gifSearchProvider: 1, inputLanguageCode: 3, languageCode: 2 }
  },
  WebcAssetLoad: {
    id: 1358,
    weight: 1,
    props: {
      webcAssetCacheType: 4,
      webcAssetFromCache: 2,
      webcAssetLoadT: 3,
      webcAssetName: 1,
      webcAssetSize: 5
    }
  },
  CatalogBiz: {
    id: 1722,
    weight: 1,
    props: {
      adId: 19,
      cartToggle: 13,
      catalogAppealReason: 4,
      catalogBizAction: 1,
      catalogEntryPoint: 7,
      catalogSessionId: 3,
      collectionCount: 18,
      collectionId: 14,
      collectionIndex: 15,
      deepLinkOpenFrom: 8,
      entryPointConversionSource: 20,
      errorCode: 5,
      extraAttributes: 24,
      isOrderMsgAttached: 10,
      lastMessageDirection: 21,
      messageDepth: 22,
      orderId: 9,
      productCount: 6,
      productId: 2,
      productIds: 12,
      productIndex: 16,
      quantity: 11,
      threadIdHmac: 23
    }
  },
  ChannelSimilarChannels: {
    id: 5202,
    weight: 1,
    props: {
      bannerStatus: 1,
      bannerStatusReason: 2,
      cid: 3,
      similarChannelDisplayRank: 4,
      similarChannelEventSurface: 5,
      similarChannelId: 6,
      similarChannelRank: 7,
      similarChannelUserType: 9,
      similarChannelsSessionId: 10
    }
  },
  OfflineResume: {
    id: 3112,
    weight: 1,
    props: {
      affectedBySleepMode: 35,
      appContext: 49,
      appContextBitfield: 50,
      attemptNumber: 36,
      chatThreadCount: 1,
      dbDurationT: 39,
      dbMainThreadDurationT: 40,
      dbMainThreadReadsCount: 41,
      dbMainThreadWritesCount: 42,
      dbReadsCount: 43,
      dbWritesCount: 44,
      disconnected: 45,
      expectedOfflineCallCount: 23,
      expectedOfflineMessageCount: 17,
      expectedOfflineNotificationCount: 18,
      expectedOfflineReceiptCount: 19,
      isOfflineCompleteMissed: 2,
      isResumeInForeground: 13,
      isResumeStartedInForeground: 37,
      isRunningFromServiceExtension: 22,
      lastStanzaT: 3,
      logoutSessionId: 38,
      mailboxAge: 14,
      mainScreenLoadT: 4,
      nseMergeT: 54,
      offlineCallCount: 24,
      offlineDecryptErrorCount: 5,
      offlineMessageCount: 6,
      offlineNotificationCount: 7,
      offlinePreviewT: 8,
      offlineProcessingT: 20,
      offlineReceiptCount: 9,
      offlineResumeResult: 21,
      offlineSessionT: 46,
      offlineSizeBytes: 10,
      onTrickleMode: 15,
      pageLoadT: 11,
      passiveModeT: 25,
      preackCallCount: 26,
      preackMessageCount: 27,
      preackNotificationCount: 28,
      preackReceiptCount: 29,
      preacksCount: 47,
      processedCallCount: 30,
      processedMessageCount: 31,
      processedNotificationCount: 32,
      processedReceiptCount: 33,
      queuedMessageCount: 51,
      queuedNotificationCount: 52,
      queuedReceiptCount: 53,
      runningTasks: 48,
      socketConnectT: 12,
      transientOfflineSessionId: 34
    }
  },
  WebcPageLoad2: { id: 5392, weight: 1, props: { webcPageLoadId: 1 } },
  RevokeMessageSend: {
    id: 3656,
    weight: 1,
    props: {
      messageSendResultIsTerminal: 1,
      messageType: 2,
      resendCount: 3,
      retryCount: 4,
      revokeDuration: 5,
      revokeType: 6
    }
  },
  UiMessageYourselfAction: {
    id: 3780,
    weight: 1,
    props: {
      uiMessageYourselfActionSessionId: 1,
      uiMessageYourselfActionType: 2,
      uiMessageYourselfFunnelName: 3
    }
  },
  ScreenLockSettingsData: { id: 4802, weight: 1, props: { screenAutoLockDuration: 1 } },
  DisappearingModeSettingEvents: {
    id: 3446,
    weight: 1,
    props: {
      disappearingModeEntryPoint: 5,
      disappearingModeSettingEventName: 1,
      lastToggleTimestamp: 2,
      newEphemeralityDuration: 3,
      previousEphemeralityDuration: 4
    }
  },
  GroupCreateC: { id: 156, weight: 1, props: {} },
  MdChatAssignment: {
    id: 3752,
    weight: 1,
    props: {
      assignerAgentId: 1,
      assignerBrowserId: 2,
      assignerMdId: 3,
      chatAssignmentAction: 4,
      chatAssignmentAgentId: 5,
      chatAssignmentBrowserId: 6,
      chatAssignmentChatType: 7,
      chatAssignmentEntryPoint: 8,
      chatAssignmentMdId: 9,
      chatsCnt: 10
    }
  },
  E2eMessageRecv: {
    id: 478,
    weight: 20,
    props: {
      agentEngagementType: 15,
      botType: 19,
      e2eCiphertextType: 5,
      e2eCiphertextVersion: 6,
      e2eDestination: 4,
      e2eFailureReason: 2,
      e2eSenderType: 8,
      e2eSuccessful: 1,
      editType: 13,
      groupEncryptionState: 23,
      invisibleMessageCategory: 22,
      isHostedChat: 20,
      isLid: 11,
      localAddressingMode: 16,
      messageAddressingMode: 17,
      messageDistributionType: 21,
      messageMediaType: 7,
      offline: 9,
      retryCount: 3,
      revokeType: 10,
      serverAddressingMode: 18,
      stanzaType: 14,
      typeOfGroup: 12
    }
  },
  Daily: {
    id: 1158,
    weight: 1,
    props: {
      accessibilityVoiceover: 108,
      addressbookSize: 11,
      addressbookWhatsappSize: 12,
      aiMemorySavedCnt: 223,
      aiWidgetInstalled: 210,
      androidAdvertisingId: 135,
      androidKeystoreState: 139,
      androidXmppWorkersRuntime: 167,
      appCodeHash: 103,
      appLastOpenTimestamp: 212,
      appStandbyBucket: 121,
      autoDlAudioCellular: 90,
      autoDlAudioRoaming: 91,
      autoDlAudioWifi: 89,
      autoDlDocCellular: 96,
      autoDlDocRoaming: 97,
      autoDlDocWifi: 95,
      autoDlImageCellular: 87,
      autoDlImageRoaming: 88,
      autoDlImageWifi: 86,
      autoDlVideoCellular: 93,
      autoDlVideoRoaming: 94,
      autoDlVideoWifi: 92,
      backupNetworkSetting: 10,
      backupRestoreEncryptionVersion: 138,
      backupSchedule: 9,
      channelsMediaFolderSize: 186,
      chatDatabaseSize: 19,
      chatLockFolderCount: 168,
      contactsCreatedOnWhatsappSize: 200,
      contactsPermissionAuthorizationStatus: 201,
      count1on1Threads: 216,
      countEphemeralThreads: 181,
      countEphemeralThreadsEnabledByMe: 182,
      countGroupThreads: 217,
      countLimitSharing1on1Threads: 218,
      countLimitSharingGroupThreads: 219,
      dbAddressbookTableSize: 206,
      defaultDisappearingDuration: 140,
      defenseMode: 214,
      deprecatedContactsSize: 228,
      deviceLanguage: 153,
      emailState: 174,
      entSecurityNotificationsEnabled: 134,
      experimentTmoPreloadGroupDaily: 166,
      favoritedAnimatedStickerCount: 113,
      favoritedFirstPartyStickerCount: 112,
      favoritedTotalStickerCount: 111,
      galleryPermission: 164,
      hasTextstatusEmojiModified24h: 175,
      hasTextstatusModified24h: 176,
      hasTextstatusTextModified24h: 177,
      hasUsername: 187,
      hasUsernamePin: 222,
      inNetworkContactsSize: 190,
      installedAnimatedStickerPackCount: 116,
      installedAnimatedThirdPartyStickerPackCount: 137,
      installedFirstPartyStickerPackCount: 115,
      installedTotalStickerPackCount: 114,
      isContactSyncToOsDefaultOn: 202,
      isDefaultDisappearingMessagingUser: 183,
      isEphemeralMessagingUser: 184,
      isProfilePhotoSet: 195,
      keyboardLanguage: 154,
      languageCode: 5,
      lastBackupTimestamp: 63,
      lastCloudBackupSize: 185,
      locationCode: 6,
      lockFolderHidden: 171,
      lowestAppStandbyBucket: 160,
      mdPairTime: 124,
      mediaFolderFileCount: 21,
      mediaFolderSize: 20,
      mediaQualitySetting: 188,
      metaAiModelActual: 198,
      metaAiModelSelected: 199,
      metaAiVoiceDefaultOn: 220,
      metaAiVoiceSelection: 221,
      modifiedInternalProps: 155,
      nativeContactsGlobalSettingEnabled: 205,
      networkIsRoaming: 7,
      networkOperatorName: 159,
      numAccounts: 163,
      numContactsWithTextstatus24h: 178,
      numContactsWithTextstatusEmoji24h: 179,
      numContactsWithTextstatusText24h: 180,
      osBuildNumber: 4,
      osNotificationSetting: 118,
      outOfNetworkContactsSize: 191,
      packageName: 102,
      passkeyExists: 165,
      paymentsIsEnabled: 100,
      peripheralConnected: 209,
      peripheralLinkedProductLine: 229,
      permissionAccessCoarseLocation: 57,
      permissionAccessFineLocation: 58,
      permissionCamera: 56,
      permissionContacts: 104,
      permissionReadExternalStorage: 53,
      permissionRecordAudio: 55,
      phoneCores: 156,
      phoneyid: 162,
      preloadsAppManagerId: 224,
      preloadsAttributionJson: 227,
      privacySettingsAbout: 141,
      privacySettingsAboutExceptNum: 142,
      privacySettingsGroups: 143,
      privacySettingsGroupsExceptNum: 144,
      privacySettingsLastSeen: 145,
      privacySettingsLastSeenExceptNum: 146,
      privacySettingsProfileLinks: 225,
      privacySettingsProfileLinksExceptNum: 226,
      privacySettingsProfilePhoto: 147,
      privacySettingsProfilePhotoExceptNum: 148,
      privacySettingsStatus: 150,
      privacySettingsStatusExceptNum: 151,
      privacySettingsStatusShareNum: 152,
      profileLinksCount: 211,
      receiptsEnabled: 8,
      secretCodeActive: 172,
      showMetaAiButtonSetting: 173,
      simMcc: 2,
      simMnc: 3,
      storageAvailSize: 31,
      storageTotalSize: 32,
      supportedDecoders: 169,
      supportedEncoders: 170,
      syncedInNetworkContactsSize: 192,
      totalCountInNetworkUniquePhoneNumber: 193,
      totalCountSyncedInNetworkUniquePhoneNumber: 194,
      trafficAnonymization: 215,
      unreadBadgeFrequency: 213,
      videoFolderFileCount: 23,
      videoFolderSize: 22,
      webcContactsTableSize: 207,
      webcFilteredContactsSize: 208
    }
  },
  StructuredMessageReceive: {
    id: 3222,
    weight: 1,
    props: {
      bizPlatform: 1,
      businessOwnerJid: 2,
      entryPointConversationInitiated: 7,
      entryPointConversionApp: 8,
      entryPointConversionSource: 9,
      lastMessageDirection: 10,
      messageClass: 3,
      messageClassAttributes: 4,
      messageDepth: 11,
      messageMediaType: 5,
      templateId: 6,
      threadIdHmac: 12
    }
  },
  StatusReply: {
    id: 1180,
    weight: 1,
    props: {
      isMentioned: 7,
      isPosterBiz: 4,
      isPosterInAddressBook: 6,
      isRecentQuickReplyUsed: 16,
      isReplyBarBelowCanvas: 9,
      isReplyBarOverMedia: 10,
      mediaHeight: 11,
      mediaWidth: 12,
      postContainedPrompt: 15,
      replyEntryMethod: 13,
      replyExitMethod: 14,
      statusContentType: 8,
      statusReplyMessageType: 3,
      statusReplyResult: 2,
      statusSessionId: 1
    }
  },
  LidMigrationDaily: {
    id: 5842,
    weight: 1,
    props: {
      completedMigrations: 1,
      lidMigrationSource: 7,
      numberOfPnChatsWithoutMapping: 5,
      numberOfPnhCtwaThreadsKnownMapping: 2,
      numberOfPnhCtwaThreadsMissingMapping: 3,
      numberOfSplitThreads: 4,
      numberOfUserChatsWithoutAccountLid: 6
    }
  },
  ListUpdateUserJourney: {
    id: 5958,
    weight: 1,
    props: {
      listAction: 1,
      listId: 2,
      listType: 3,
      listUpdateUserJourneyAction: 4,
      predefinedId: 5,
      updateEntryPoint: 6
    }
  },
  MdSyncdMutation: {
    id: 5970,
    weight: 1,
    props: {
      appSessionId: 1,
      companionSessionIds: 2,
      contentLength: 3,
      isInBootstrap: 4,
      isUsingLid: 5,
      mutationBundle: 6,
      mutationDirection: 7,
      mutationMac: 8,
      mutationName: 9,
      mutationOperation: 10,
      patchMac: 15,
      seqNumber: 11,
      syncdCollection: 12,
      syncdKeyhash: 13,
      syncdKeyid: 14
    }
  },
  SystemMessageClick: {
    id: 5082,
    weight: 1,
    props: { isAGroup: 1, isANewThread: 2, systemMessageCategory: 3, systemMessageType: 4 }
  },
  CommunityTabAction: {
    id: 3496,
    weight: 1,
    props: {
      communityNoActionTabViews: 4,
      communityTabGroupNavigations: 1,
      communityTabToHomeViews: 2,
      communityTabViews: 3,
      communityTabViewsViaContextMenu: 5
    }
  },
  ContactUsSession: {
    id: 470,
    weight: 1,
    props: {
      contactUsAutomaticEmail: 3,
      contactUsExitState: 1,
      contactUsFaq: 2,
      contactUsLogs: 4,
      contactUsMenuFaqT: 12,
      contactUsOutage: 5,
      contactUsOutageEmail: 6,
      contactUsScreenshotC: 19,
      contactUsT: 11,
      languageCode: 21
    }
  },
  MessagingUserJourney: {
    id: 5134,
    weight: 1,
    props: {
      appSessionId: 1,
      isSelfPin: 8,
      mediaType: 9,
      messagingActionType: 2,
      pinInChatExpirySecs: 3,
      threadType: 4,
      uiSurface: 5,
      unifiedSessionId: 10,
      userJourneyFunnelId: 6,
      userRole: 7
    }
  },
  MarketingMessageUserControlsJourney: {
    id: 6070,
    weight: 1,
    props: {
      businessPhoneNumber: 9,
      isSuccess: 1,
      mmUserControlsAction: 2,
      mmUserControlsEntryPoint: 3,
      mmUserControlsErrorType: 4,
      mmUserControlsRolloutVariant: 5,
      sequenceNumber: 6,
      templateId: 7,
      unifiedSessionId: 8
    }
  },
  SettingsSearchTap: { id: 4016, weight: 1, props: { tapItemName: 1, topLevelParentSetting: 2 } },
  WebWamForceFlush: { id: 3264, weight: 1, props: {} },
  PsGroupExitExperienceExitDialogInteraction: {
    id: 6318,
    weight: 1,
    props: {
      psExitExperienceReportingEnabled: 1,
      psGroupExitExperienceEnabled: 2,
      psGroupExitExperienceExitDialogAction: 3,
      psGroupExitExperienceGroupJid: 4,
      psGroupExitExperienceTouchPoint: 6
    }
  },
  SmbDataSharingConsentScreen: {
    id: 3972,
    weight: 1,
    props: {
      smbDataSharingConsentScreenEntryPoint: 3,
      smbDataSharingConsentScreenType: 1,
      smbDataSharingConsentScreenVersion: 2
    }
  },
  WebDbVersionNonAnonymous: {
    id: 4816,
    weight: 20,
    props: { webDbName: 1, webDbVersionNumber: 2 }
  },
  PttPlayback: {
    id: 2044,
    weight: 1,
    props: {
      pttDuration: 12,
      pttMainThreadBlock: 7,
      pttMiniPlayerClick: 15,
      pttMiniPlayerClose: 16,
      pttMiniPlayerPauseCnt: 17,
      pttPlayRequestT: 1,
      pttPlaybackFailed: 8,
      pttPlaybackOverallT: 4,
      pttPlaybackSpeed: 10,
      pttPlaybackSpeedCnt: 11,
      pttPlayedOutOfChat: 18,
      pttPlayedPct: 14,
      pttPlayer: 9,
      pttPlayerInitT: 2,
      pttPlayerPlayT: 3,
      pttSeekCnt: 13,
      pttTrigger: 5,
      pttType: 6
    }
  },
  PsGroupSafetyCheckEnabled: {
    id: 6238,
    weight: 1,
    props: {
      didJoinByGil: 3,
      integrityGroupUserHashedId: 4,
      psSafetyCheckGroupJid: 1,
      psWasSafetyCheckGroupInitiallyMuted: 2,
      wasAddedByContact: 5,
      willSafetyCheckBeSeen: 6
    }
  },
  WebcBackgroundSyncAdoption: {
    id: 5302,
    weight: 1,
    props: {
      offboardSource: 1,
      onboardSource: 2,
      pushNotificationInteraction: 3,
      webOsNotificationSetting: 4
    }
  },
  GifSearchResultTapped: { id: 1122, weight: 1, props: { gifSearchProvider: 1, rank: 2 } },
  UserActivity: {
    id: 1384,
    weight: 1,
    props: {
      userActivityBitmapHigh: 4,
      userActivityBitmapLen: 5,
      userActivityBitmapLow: 3,
      userActivitySessionCum: 7,
      userActivitySessionId: 1,
      userActivitySessionSeq: 6,
      userActivityStartTime: 2
    }
  },
  StickerLatency: {
    id: 5026,
    weight: 1,
    props: { size: 1, stickerLatencyAction: 2, stickerLatencyTtAction: 3 }
  },
  TsBitArray: {
    id: 4332,
    weight: 1,
    props: {
      bitarrayHigh: 1,
      bitarrayLength: 2,
      bitarrayLow: 3,
      cumulativeBits: 4,
      relativeTimestampMs: 5,
      sessionSeq: 6,
      tsSessionId: 7,
      tsTimestampMs: 8,
      unifiedSessionId: 9
    }
  },
  ChatFolderOpen: {
    id: 2808,
    weight: 1,
    props: { activityIndicatorCount: 2, folderType: 1, hasImportantMessages: 3 }
  },
  ViewBusinessProfile: {
    id: 1522,
    weight: 1,
    props: {
      bizFbSize: 9,
      bizIgSize: 10,
      businessProfileJid: 3,
      catalogSessionId: 6,
      hasCoverPhoto: 12,
      isProfileLinked: 11,
      isSelfView: 7,
      linkedAccount: 5,
      profileEntryPoint: 8,
      scrollDepth: 4,
      viewBusinessProfileAction: 1,
      websiteSource: 2
    }
  },
  E2eRetryReject: {
    id: 3578,
    weight: 1,
    props: {
      invisibleMessageCategory: 6,
      mediaType: 7,
      messageType: 1,
      msgRetryCount: 2,
      retryRejectReason: 3,
      retryRevoke: 4,
      senderDeviceType: 5
    }
  },
  MdFatalError: {
    id: 2304,
    weight: 1,
    props: {
      appContext: 46,
      appContextBitfield: 47,
      appSessionId: 41,
      collection: 2,
      companionSessionIds: 42,
      currentPrimaryAppVersion: 14,
      daysSinceLastPeriodicSync: 11,
      didBootstrapFromSnapshot: 38,
      hoursSinceFirstFiniteFailure: 12,
      isBootstrap: 3,
      isFatal: 16,
      isPatchSenderPrimary: 23,
      isPreviousPatchAnIncomingPatch: 24,
      isPreviousPatchSenderPrimary: 25,
      isSenderIndexSameAsPreviousSenderIndex: 39,
      isThereAnotherSyncdCompanion: 40,
      isWebLthashConsistent: 17,
      macFatalCollectionNameMismatch: 18,
      macFatalCurrentLthashMismatch: 19,
      macFatalDidPreviousPatchFailPostSaveValidation: 26,
      macFatalDidUseMacFetchFallback: 36,
      macFatalFirstTwoBytesFromAHashOfSnapshotMacKeyMismatch: 20,
      macFatalHasMissingRemove: 37,
      macFatalNewLthashMismatch: 21,
      macFatalNewLthashSubtractMismatch: 27,
      macFatalNumberAddMismatch: 28,
      macFatalNumberHasOverrideMutation: 29,
      macFatalNumberNumAddMutation: 30,
      macFatalNumberNumRemoveMutation: 31,
      macFatalNumberOverrideMismatch: 32,
      macFatalNumberRemoveMismatch: 33,
      macFatalPatchVersionMismatch: 22,
      macFatalPreviousPatchNewLthashToCurrentPatchCurrentLthash: 34,
      macFatalSenderCurrentLthashToLocalCalculatedCurrentLthashMismatch: 35,
      mailboxAgeDays: 13,
      mdCompanionDeviceAccountType: 43,
      mdFatalErrorCode: 1,
      mdRegAttemptId: 44,
      patchSnapshotMutationCount: 9,
      patchVersion: 5,
      seqNumber: 45,
      sessionStartPrimaryAppVersion: 15,
      sourceType: 10,
      timeSincePairingMs: 6,
      timeSinceRefreshMs: 7,
      timeSinceTabTakeoverMs: 8
    }
  },
  FmxAction: {
    id: 4444,
    weight: 1,
    props: {
      commonGroupNum: 1,
      countryShown: 2,
      fmxEntryPoint: 3,
      fmxEvent: 4,
      highlightGroupType: 6,
      isSenderSmb: 7,
      notAContactShown: 5,
      threadIdHmac: 8,
      trustSignals: 9
    }
  },
  GroupCatchUp: { id: 3058, weight: 1, props: { mentionsCountPendingPercentage: 4 } },
  ChatPsaRemove: {
    id: 3582,
    weight: 1,
    props: {
      lastReceivedMediaType: 2,
      lastReceivedMessageTs: 4,
      lastReceivedMsgId: 8,
      psaBlockReason: 10,
      psaCampaignId: 9,
      psaMessageRemoveAction: 5,
      psaMessageRemoveEntryPoint: 6,
      waOfficialAccountName: 7
    }
  },
  WebcStatusSession: {
    id: 1880,
    weight: 1,
    props: {
      webcStatusMutedItemCount: 4,
      webcStatusMutedRowCount: 7,
      webcStatusRecentItemCount: 2,
      webcStatusRecentRowCount: 5,
      webcStatusSessionId: 1,
      webcStatusViewedItemCount: 3,
      webcStatusViewedRowCount: 6
    }
  },
  LabelEvent: {
    id: 1422,
    weight: 1,
    props: {
      customLabelTitle: 9,
      entryPointConversionSource: 10,
      itemsLabeledCount: 5,
      labelCount: 4,
      labelOperation: 2,
      labelOperationEntryPoint: 6,
      labelTarget: 1,
      lastMessageDirection: 14,
      messageDepth: 15,
      predefinedLabelNumber: 3,
      threadCreationDate: 11,
      threadId: 12,
      threadIdHmac: 13
    }
  },
  BusinessInteraction: {
    id: 3450,
    weight: 1,
    props: {
      businessInteractionAction: 1,
      businessInteractionTargetScreen: 2,
      businessJid: 3,
      entryPointApp: 4,
      entryPointSource: 5,
      internalEntryPoint: 6,
      sequenceNumber: 7
    }
  },
  WebcNativeUpsellCta: {
    id: 3934,
    weight: 1,
    props: {
      webcNativeUpsellCtaEventType: 2,
      webcNativeUpsellCtaIsBetaUser: 5,
      webcNativeUpsellCtaQrScreenExperimentGroup: 3,
      webcNativeUpsellCtaReleaseChannel: 4,
      webcNativeUpsellCtaSource: 1
    }
  },
  WebDbTableUsage: {
    id: 5074,
    weight: 100,
    props: {
      offlineSessionId: 1,
      webScenario: 2,
      webTable: 3,
      webTableLogReason: 4,
      webTableReadCount: 5,
      webTableWriteCount: 6
    }
  },
  TsExternal: {
    id: 4574,
    weight: 1,
    props: {
      relativeTimestampMs: 1,
      tsDuration: 2,
      tsExternalEventSource: 3,
      tsSessionId: 4,
      tsTimestampMs: 5,
      unifiedSessionId: 6
    }
  },
  UiAction: {
    id: 472,
    weight: 5e3,
    props: {
      agentEngagementType: 9,
      appContext: 21,
      appContextBitfield: 22,
      botType: 11,
      dbBgThreadReadsDurationT: 17,
      dbBgThreadWritesDurationT: 18,
      dbMainThreadCount: 13,
      dbMainThreadReadsDurationT: 19,
      dbMainThreadWritesDurationT: 20,
      dbReadsCount: 14,
      dbWritesCount: 15,
      deviceCount: 5,
      isLid: 8,
      isLowPowerMode: 23,
      localAddressingMode: 10,
      participantCount: 6,
      peripheralConnected: 16,
      sizeBucket: 4,
      uiActionChatType: 7,
      uiActionPreloaded: 2,
      uiActionT: 3,
      uiActionTtrcSurfaceName: 12,
      uiActionType: 1
    }
  },
  CtwaActionBannerUnderstand: {
    id: 3586,
    weight: 1,
    props: {
      bannerIdentifier: 1,
      bannerLocale: 2,
      clientLocale: 3,
      hasLocalLink: 4,
      hasUniversalLink: 5,
      invalidLink: 6,
      lwiFlowIdentifier: 7,
      preferredLink: 8,
      validLocale: 9,
      validNotification: 10
    }
  },
  CriticalEvent: {
    id: 1684,
    weight: 1,
    props: {
      context: 2,
      crashApplicationState: 8,
      crashlogType: 6,
      debug: 3,
      extraDebug: 7,
      mobileBuildId: 5,
      name: 1
    }
  },
  TestAnonymousWeeklyId: {
    id: 2956,
    weight: 1,
    props: { psTestBooleanField: 2, psTestStringField: 3, psTimeSinceLastEventInMin: 1 }
  },
  EphemeralSettingChange: {
    id: 2370,
    weight: 1,
    props: {
      chatEphemeralityDuration: 1,
      ephemeralSettingEntryPoint: 3,
      ephemeralSettingGroupSize: 5,
      previousEphemeralityDuration: 2,
      threadId: 6
    }
  },
  MdGroupParticipantMissAck: {
    id: 4146,
    weight: 1,
    props: {
      groupSizeBucket: 1,
      isLid: 2,
      messageIsRevoke: 3,
      participantAddCount: 4,
      participantRemoveCount: 5,
      typeOfGroup: 6
    }
  },
  WebcMediaLoad: { id: 1202, weight: 1, props: { webcMediaLoadResult: 2, webcMediaLoadT: 1 } },
  MdBadDeviceSentMessage: {
    id: 2176,
    weight: 1,
    props: {
      dsmError: 2,
      editType: 3,
      isLid: 4,
      mediaType: 5,
      messageType: 6,
      peerType: 1,
      revokeType: 7
    }
  },
  ViewOnceScreenshotActions: {
    id: 3606,
    weight: 1,
    props: { isAGroup: 1, threadId: 2, voMessageType: 3, voSsAction: 4 }
  },
  WebcPageResume: { id: 884, weight: 1, props: { webcResumeCount: 1 } },
  GifSearchSessionStarted: { id: 1134, weight: 1, props: { gifSearchProvider: 1 } },
  LimitSharingSettingUpdate: { id: 6390, weight: 1, props: { threadId: 1, toggleUpdateAction: 2 } },
  LwiEntryTap: {
    id: 2770,
    weight: 1,
    props: {
      businessToolsSessionId: 4,
      catalogSessionId: 2,
      itemsCount: 11,
      lwiEntryPoint: 3,
      lwiFlowId: 1,
      lwiSubEntryPoint: 7,
      statusSessionId: 6,
      statusTypeMedia: 12,
      userHasLinkedFbPage: 5,
      waCampaignId: 10
    }
  },
  WebcMediaRmr: {
    id: 1906,
    weight: 1,
    props: {
      messageMediaType: 10,
      webcBrowserNetworkType: 2,
      webcBrowserStorageQuotaBytes: 11,
      webcBrowserStorageQuotaUsedBytes: 12,
      webcChatPosition: 1,
      webcChatType: 9,
      webcMediaRmrError: 8,
      webcMediaRmrT: 6,
      webcMediaSize: 7,
      webcMessageIndex: 3,
      webcMessageT: 5,
      webcRmrReason: 14,
      webcRmrStatusCode: 13
    }
  },
  MediaPicker: {
    id: 1038,
    weight: 1,
    props: {
      audienceSelectorClicked: 24,
      audienceSelectorUpdated: 25,
      autoScaleCount: 51,
      captionPositions: 37,
      chatRecipients: 16,
      hasCollectionCaption: 38,
      hdToggleChange: 34,
      hdToggleEligible: 35,
      hdToggleState: 36,
      isSentInLandscape: 41,
      isViewOnce: 22,
      itemCaptionCount: 39,
      mediaPickerArBackground: 42,
      mediaPickerArFilter: 43,
      mediaPickerArFunEffect: 44,
      mediaPickerAvatarStickers: 33,
      mediaPickerChanged: 4,
      mediaPickerCroppedRotated: 10,
      mediaPickerDeleted: 3,
      mediaPickerDrawing: 11,
      mediaPickerFilter: 18,
      mediaPickerHasLocationSticker: 26,
      mediaPickerIgluLowlight: 47,
      mediaPickerIgluTouchup: 48,
      mediaPickerLikeDoc: 19,
      mediaPickerNotLikeDoc: 20,
      mediaPickerOrigin: 14,
      mediaPickerOriginThirdParty: 21,
      mediaPickerSent: 2,
      mediaPickerSentUnchanged: 5,
      mediaPickerSessionId: 29,
      mediaPickerStickers: 12,
      mediaPickerT: 15,
      mediaPickerText: 13,
      mediaType: 1,
      motionPhotoImpressionCount: 31,
      motionPhotoSentCount: 32,
      numberOfArPostCapture: 45,
      numberOfArPreCapture: 46,
      numberOfIgluPostCapture: 49,
      numberOfIgluPreCapture: 50,
      photoGalleryDurationT: 23,
      photoQualitySetting: 27,
      pickerSessionId: 30,
      statusRecipients: 17,
      transformCount: 52,
      videoQualitySetting: 28
    }
  },
  PollsActions: {
    id: 3676,
    weight: 1,
    props: {
      chatType: 8,
      groupSizeBucket: 1,
      isAGroup: 6,
      isAdmin: 2,
      pollAction: 3,
      pollCreationDs: 4,
      pollOptionsCount: 5,
      typeOfGroup: 7
    }
  },
  ChatLockDaily: {
    id: 4214,
    weight: 1,
    props: {
      folderChatsCount: 1,
      folderOpenCount: 2,
      lockFolderHidden: 5,
      newAddChatCount: 3,
      newRemoveChatCount: 4,
      secretCodeActive: 6
    }
  },
  ChannelLinkShare: {
    id: 4728,
    weight: 1,
    props: {
      channelLinkShareDirection: 1,
      channelLinkShareEntryPoint: 2,
      channelLinkShareScreen: 4,
      cid: 3
    }
  },
  ReportingTokenValidationFailure: {
    id: 5466,
    weight: 1,
    props: {
      editType: 1,
      isLid: 5,
      isMessageMediaRetry: 10,
      isMessageRetry: 6,
      isSecretEncryptedMsg: 8,
      messageIsForward: 11,
      messageMediaType: 2,
      messageType: 3,
      offline: 7,
      reportingTokenValidationFailureReason: 4,
      reportingTokenVersion: 9
    }
  },
  PsIdUpdate: {
    id: 2862,
    weight: 1,
    props: { isFromWamsys: 4, psIdAction: 2, psIdKey: 1, psIdRotationFrequence: 3 }
  },
  GatedChatOpened: { id: 3150, weight: 1, props: { chatGatedReason: 1, selfInitiated: 2 } },
  OfflineResumeStage: {
    id: 3536,
    weight: 1,
    props: {
      attemptId: 13,
      chatThreadCount: 4,
      currentOfflineStage: 1,
      isResumeInForeground: 5,
      isResumeStartedInForeground: 14,
      lastPushTimestampMs: 12,
      mailboxAge: 6,
      offlineCallCount: 15,
      offlineDecryptErrorCount: 7,
      offlineMessageCount: 8,
      offlineNotificationCount: 9,
      offlineReceiptCount: 10,
      offlineResumeMode: 11,
      offlineSessionId: 2,
      offlineSizeBytes: 16,
      offlineStageTimestampMs: 3,
      passiveModeT: 17
    }
  },
  PsChannelsSnaplEvent: { id: 6254, weight: 1, props: { appId: 2, videoEventJson: 1 } },
  MdBootstrapHistorySyncStatusAfterPairing: {
    id: 4652,
    weight: 1,
    props: {
      activeTimeAfterPairing: 1,
      isLoopRunning: 12,
      lastProcessedNotificationChunkOrder: 2,
      lastProcessedNotificationChunkProgress: 3,
      mdBootstrapHistoryPayloadType: 4,
      mdHistorySyncStatusResult: 5,
      mdSessionId: 6,
      mdTimestamp: 7,
      missingNotificationCount: 8,
      nextNotificationChunkOrder: 9,
      totalProcessedMessageCount: 10,
      unprocessedNotificationCount: 11
    }
  },
  PnhRequestRevealAction: {
    id: 3808,
    weight: 1,
    props: { pnhAction: 1, pnhChatParty: 2, pnhChatType: 3, pnhEntryPoint: 4, threadId: 5 }
  },
  ChatAction: {
    id: 2312,
    weight: 1,
    props: {
      chatActionChatType: 3,
      chatActionEntryPoint: 2,
      chatActionMuteDuration: 4,
      chatActionType: 1
    }
  },
  MdAppStateKeyRotation: {
    id: 2518,
    weight: 1e3,
    props: {
      appSessionId: 2,
      companionSessionIds: 3,
      mdAppStateKeyRotationReason: 1,
      oldSyncdKeyhash: 6,
      oldSyncdKeyid: 7,
      seqNumber: 8,
      syncdKeyhashAfterRotation: 9,
      syncdKeyidAfterRotation: 10
    }
  },
  PlaceholderActivity: {
    id: 1980,
    weight: 1,
    props: {
      deviceCount: 9,
      deviceSizeBucket: 8,
      e2eSenderType: 16,
      isHostedChat: 19,
      isLid: 12,
      localAddressingMode: 20,
      messageBeforeReg: 15,
      messageIsRevoke: 7,
      messageKeyHash: 14,
      messageMediaType: 6,
      messageType: 5,
      participantCount: 10,
      placeholderActionInd: 2,
      placeholderAddReason: 11,
      placeholderChatTypeInd: 3,
      placeholderPopulationType: 17,
      placeholderTimePeriod: 4,
      placeholderTypeInd: 1,
      typeOfGroup: 13
    }
  },
  SettingsSearchInitiate: { id: 4014, weight: 1, props: { settingsPageType: 1 } },
  SmbUserJourney: {
    id: 5462,
    weight: 1,
    props: {
      actionType: 1,
      contactIsSaved: 2,
      entryPoint: 3,
      extraAttributes: 4,
      oppositePlatform: 5,
      prevSurface: 14,
      recipientSize: 12,
      seqId: 7,
      smbFeatureName: 8,
      smbUserActionType: 13,
      smbUserSessionId: 9,
      surface: 10,
      userActionTarget: 11
    }
  },
  LwiScreen: {
    id: 2772,
    weight: 1,
    props: {
      adContentRecommendation: 41,
      adMediaTemplateName: 61,
      adMediaTypeSelected: 40,
      adsContentSelected: 42,
      alertCount: 33,
      audienceType: 45,
      billingStatus: 36,
      createAdEnabled: 12,
      ctwaAdAccountType: 58,
      ctwaLoginType: 59,
      defaultAdsContentSelected: 9,
      defaultAudienceLocationType: 57,
      itemCount: 39,
      lwiAdCampaignId: 46,
      lwiAdsIdentityType: 22,
      lwiAlertReason: 6,
      lwiBudgetInLocal: 15,
      lwiBudgetOptionsInLocal: 54,
      lwiCtwaAdCtaType: 24,
      lwiCtwaAdStatusType: 25,
      lwiCurrency: 16,
      lwiDefaultBudgetInLocal: 17,
      lwiDefaultDurationInDays: 18,
      lwiDefaultTargetingSpec: 19,
      lwiDurationInDays: 20,
      lwiEventSequenceNumber: 2,
      lwiExtras: 30,
      lwiFlowId: 1,
      lwiIsFbAppInstalled: 27,
      lwiIsIgAppInstalled: 51,
      lwiLocationTypesSetOnAudienceSelection: 55,
      lwiMaxDurationInDays: 52,
      lwiMinDurationInDays: 53,
      lwiScreenAction: 5,
      lwiScreenReference: 4,
      lwiTargetingSpec: 21,
      lwiTotalCtwaAds: 26,
      lwiViewerHasEditPermission: 28,
      lwiViewerHasPromotePermission: 32,
      mediaEdited: 49,
      onboardingEntryPoint: 38,
      paymentMethodSet: 13,
      productId: 3,
      selectedProductsIdsList: 8,
      totalMediaCount: 50,
      usedSavedAudience: 31,
      userHasAdvancedAudience: 35,
      userHasBpCredentials: 43,
      userHasCatalogItemsToPromote: 10,
      userHasChangedDefaultCityLevelAudience: 56,
      userHasLinkedFbPage: 7,
      userHasMultisourceMedia: 60,
      userHasSeenRecommendedBudget: 34,
      userHasStatusToPromote: 11,
      userProvidedFbConsent: 14,
      userWentThroughFbWebLogin: 23,
      validationStatus: 37,
      waAdAccountId: 44
    }
  },
  MdBootstrapDataApplied: {
    id: 2298,
    weight: 1,
    props: {
      appContext: 22,
      appContextBitfield: 23,
      applicationState: 21,
      chunkChatsApplied: 15,
      chunkMsgsApplied: 16,
      collection: 5,
      historySyncChunkOrder: 14,
      historySyncStageProgress: 11,
      mdBootstrapChatsCount: 17,
      mdBootstrapContactsCount: 8,
      mdBootstrapHistoryPayloadType: 10,
      mdBootstrapMessagesCount: 18,
      mdBootstrapPayloadType: 3,
      mdBootstrapSource: 2,
      mdBootstrapStepDuration: 6,
      mdBootstrapStepResult: 12,
      mdDroppedMsgType: 19,
      mdRegAttemptId: 9,
      mdSessionId: 1,
      mdSyncFailureReason: 20,
      mdTimestamp: 4,
      sentViaMms: 13,
      usedSnapshot: 7
    }
  },
  MexEvent: {
    id: 3782,
    weight: 1,
    props: {
      isMex: 1,
      mexEventData: 2,
      mexEventDurationT: 12,
      mexEventEndTime: 3,
      mexEventEnvelopeResponseStatus: 13,
      mexEventOperation: 7,
      mexEventPayloadResponseStatus: 14,
      mexEventRequestSize: 8,
      mexEventResponseSize: 9,
      mexEventRetries: 10,
      mexEventStartTime: 11
    }
  },
  ManageAdsEntryPointImpression: { id: 4124, weight: 1, props: { manageAdsEntryPoint: 1 } },
  MdBootstrapHistoryDataReceived: {
    id: 2998,
    weight: 1,
    props: {
      historySyncChunkOrder: 6,
      historySyncStageProgress: 5,
      mdBootstrapHistoryPayloadType: 3,
      mdBootstrapPayloadType: 2,
      mdSessionId: 1,
      mdTimestamp: 4
    }
  },
  SnackbarDeleteUndo: {
    id: 3628,
    weight: 1,
    props: { isAGroup: 1, mediaType: 6, messagesUndeleted: 2, snackbarActionType: 3, threadId: 4 }
  },
  PsChannelPostForward: {
    id: 4746,
    weight: 1,
    props: {
      channelForwardContentType: 6,
      channelForwardGroupType: 1,
      cid: 2,
      destinationChannelId: 7,
      destinationPostId: 8,
      mediaType: 3,
      postId: 4
    }
  },
  WebcDbOpen: {
    id: 1940,
    weight: 2e3,
    props: { webcDbName: 1, webcDbOpenNumAttempts: 3, webcDbOpenWasSuccess: 2 }
  },
  MdAppStateSyncDaily: {
    id: 2300,
    weight: 1,
    props: {
      crossIndexConflictCount: 11,
      invalidActionCount: 4,
      keyRotationRemoveCount: 12,
      missingKeyCount: 9,
      mutationCount: 1,
      storedMutationCount: 7,
      unsetActionCount: 8,
      unsupportedActionCount: 5,
      uploadConflictCount: 10
    }
  },
  ReportToAdminEvents: {
    id: 4420,
    weight: 1,
    props: { reportToAdminInteraction: 1, rtaGroupId: 2 }
  },
  ChannelProducerInsightsNavigation: {
    id: 5626,
    weight: 1,
    props: {
      channelProducerInsightsActionTarget: 1,
      channelProducerInsightsActionType: 2,
      channelProducerInsightsEntryPoint: 3,
      channelProducerInsightsSequenceNumber: 4,
      channelProducerInsightsSurface: 5,
      cid: 6,
      producerInsightsSessionId: 7
    }
  },
  ChannelDyi: { id: 4726, weight: 1, props: { channelDyiEventType: 1 } },
  BusinessToolsClick: {
    id: 2218,
    weight: 1,
    props: {
      businessToolsEntryPoint: 5,
      businessToolsItem: 3,
      businessToolsSequenceNumber: 2,
      businessToolsSessionId: 1,
      linkingTarget: 4
    }
  },
  StatusItemView: {
    id: 1658,
    weight: 1,
    props: {
      externalSourceDomainType: 34,
      isAlreadyDownloaded: 35,
      isForwardable: 44,
      isForwarded: 45,
      isPosterBiz: 23,
      isPosterInAddressBook: 25,
      isResharable: 37,
      isReshare: 40,
      isViewedInLandscape: 29,
      mediaType: 4,
      musicBlocked: 32,
      pairedMediaType: 38,
      psaCampaignId: 17,
      psaCampaignItemIndex: 18,
      psaLinkAvailable: 19,
      psaLinkClick: 22,
      psaLinkLoadTime: 21,
      psaLinkOpenResult: 20,
      reshareSource: 41,
      statusContainsMusic: 30,
      statusItem3sViewCount: 31,
      statusItemImpressionCount: 14,
      statusItemIndex: 16,
      statusItemLength: 7,
      statusItemLoadTime: 5,
      statusItemReplied: 8,
      statusItemUnread: 9,
      statusItemViewCount: 10,
      statusItemViewResult: 3,
      statusItemViewTime: 6,
      statusMediaHeight: 42,
      statusMediaWidth: 43,
      statusPairedMediaQuality: 39,
      statusRowIndex: 2,
      statusRowSection: 11,
      statusType: 36,
      statusViewerSessionId: 1,
      urlStatusClicked: 26,
      urlStatusType: 27
    }
  },
  PrekeysDepletion: {
    id: 3014,
    weight: 20,
    props: { deviceSizeBucket: 3, messageType: 2, prekeysFetchReason: 1 }
  },
  NotificationDelivery: {
    id: 3748,
    weight: 1,
    props: {
      clientMessageId: 1,
      notificationAction: 2,
      notificationDeliveryT: 3,
      notificationDestination: 4,
      notificationId: 5,
      notificationSource: 6,
      threadId: 7,
      uiNotificationType: 8
    }
  },
  ChannelAdmin: {
    id: 4556,
    weight: 1,
    props: {
      adminFlowActionSequenceNumber: 1,
      adminFlowType: 2,
      channelAdminAction: 3,
      channelAdminSessionId: 4
    }
  },
  CtwaBizUserJourney: {
    id: 5992,
    weight: 1,
    props: {
      adId: 3,
      bizFeatureEnabled: 4,
      businessPhoneNumber: 5,
      ctwaBizUserJouneryEntryPoint: 6,
      ctwaBizUserJourneyMetadata: 1,
      ctwaBizUserJourneyOperation: 2
    }
  },
  PrivacySettingsClick: {
    id: 3726,
    weight: 1,
    props: { privacyControlEntryPoint: 1, privacyControlItem: 2 }
  },
  BotBizJourney: {
    id: 4868,
    weight: 1,
    props: { appSessionId: 1, botBizActionType: 5, botBizEntryPoint: 6, botBizType: 7, botType: 4 }
  },
  PsGroupExitExperienceExitDeleteConfirmationDialogUiInteraction: {
    id: 6316,
    weight: 1,
    props: {
      psGroupExitExperienceDeleteConfirmationDialogAction: 1,
      psGroupExitExperienceGroupJid: 2,
      psGroupExitExperienceTouchPoint: 4
    }
  },
  PsPhoneNumberHyperlink: {
    id: 3266,
    weight: 1,
    props: {
      isPhoneNumHyperlinkOwner: 1,
      phoneNumHyperlinkAction: 2,
      phoneNumberStatusOnWa: 3,
      sequenceNumber: 4
    }
  },
  NativeContactsNuxEvent: {
    id: 5788,
    weight: 1,
    props: { nativeContactsNuxEntryPoint: 3, nativeContactsNuxEventType: 1 }
  },
  WebcChatOpen: {
    id: 864,
    weight: 5,
    props: {
      webcChatOpenBeforePaintT: 7,
      webcChatOpenPaintedT: 6,
      webcChatOpenT: 2,
      webcFinalRenderedMessageCount: 5,
      webcRenderedMessageCount: 4,
      webcUnreadCount: 1,
      webcWindowHeightFloat: 8
    }
  },
  NonMessagePeerDataMediaUpload: {
    id: 3902,
    weight: 1,
    props: {
      peerDataErrorCount: 1,
      peerDataExistingDataNoUploadCount: 2,
      peerDataNotFoundCount: 3,
      peerDataRequestCount: 4,
      peerDataRequestSessionId: 5,
      peerDataRequestType: 6,
      peerDataResponseResult: 8,
      peerDataSuccessInlineNoUploadCount: 9,
      peerDataSuccessUploadCount: 7
    }
  },
  PsGroupSafetyCheckExitDialog: {
    id: 6252,
    weight: 1,
    props: {
      integrityGroupUserHashedId: 3,
      psGroupSafetyCheckExitDialogAction: 1,
      psSafetyCheckGroupJid: 2
    }
  },
  MessagingFavoritesUpdate: {
    id: 5460,
    weight: 1,
    props: {
      contactFavCountAfterUpdate: 1,
      contactFavCountBeforeUpdate: 2,
      favoritesUpdateEntryPoint: 3,
      groupFavCountAfterUpdate: 4,
      groupFavCountBeforeUpdate: 5
    }
  },
  LockFolderUnlock: {
    id: 4218,
    weight: 1,
    props: { landingSurface: 1, totalChatCount: 2, unlockEntryPoint: 3 }
  },
  AppLaunch: {
    id: 1094,
    weight: 1,
    props: {
      appContext: 22,
      appContextBitfield: 23,
      appLaunchCpuT: 2,
      appLaunchDestination: 7,
      appLaunchMainPreT: 3,
      appLaunchMainRunT: 4,
      appLaunchT: 1,
      appLaunchTypeT: 5,
      dbBgThreadReadsDurationT: 17,
      dbBgThreadWritesDurationT: 18,
      dbMainThreadCount: 10,
      dbMainThreadReadsDurationT: 19,
      dbMainThreadWritesDurationT: 20,
      dbReadsCount: 8,
      dbWritesCount: 9,
      lowPowerModeEnabled: 12,
      peripheralConnected: 16,
      processIdentifier: 15
    }
  },
  CompanionsContactEvent: {
    id: 5718,
    weight: 1,
    props: {
      companionAddContactActionType: 1,
      companionAddContactEventType: 2,
      companionAddContactSessionId: 3,
      companionAddContactSource: 4,
      companionContactSaveResult: 5,
      companionFnameEdited: 6,
      companionIsContactSyncToOs: 7,
      companionLnameEdited: 8,
      companionPhNumberEdited: 9,
      companionSyncSettingChanged: 10
    }
  },
  SettingsChange: {
    id: 6396,
    weight: 1,
    props: { currentSettingValue: 4, previousSettingValue: 2, settingType: 3 }
  },
  Lid11MigrationLifecycle: {
    id: 6154,
    weight: 1,
    props: {
      chatNotInMappingCount: 1,
      companionHasADifferentMappingCount: 2,
      currentLocalTimeSeconds: 10,
      fakeLidCount: 3,
      isStageInOfflineResume: 11,
      isSyncdLidSession: 4,
      latestMappingCount: 5,
      mappingCount: 6,
      migratedThreadCount: 7,
      migrationStage: 8,
      peerMappingBytesLength: 12,
      primaryMigrationTimeSeconds: 13,
      stageFailureReason: 9
    }
  },
  MerchantCommerceEvent: {
    id: 4688,
    weight: 1,
    props: {
      acceptedPaymentMethods: 1,
      adId: 2,
      appSessionId: 3,
      bizPlatform: 4,
      commerceExperience: 6,
      commerceFlowId: 20,
      commerceInteractionAction: 7,
      commerceInteractionActionType: 21,
      commerceOrderStatus: 22,
      commercePaymentStatus: 8,
      commerceSessionId: 9,
      commerceSurface: 10,
      extraAttributes: 11,
      isCtwaOriginated: 12,
      isEligibleForAdSignal: 13,
      merchantHasCatalog: 14,
      merchantIsDiscoverable: 15,
      p2mFlow: 17,
      referral: 18,
      sequenceId: 19
    }
  },
  AndroidMessageSendPerf: {
    id: 1994,
    weight: 2e3,
    props: {
      agentEngagementType: 47,
      appRestart: 16,
      bucketedSenderKeyDistributionCountPercentage: 32,
      bucketedSenderKeyDistributionHashTime: 35,
      deviceCount: 36,
      deviceSizeBucket: 26,
      durationAbs: 11,
      durationRelative: 12,
      durationT: 1,
      editType: 42,
      fetchPrekeys: 15,
      fetchPrekeysPercentage: 21,
      groupSizeBucket: 17,
      invisibleMessageCategory: 45,
      isDirectedMessage: 33,
      isE2eBackfill: 27,
      isLid: 41,
      isMessageFanout: 9,
      isMessageForward: 8,
      isRevokeMessage: 24,
      isViewOnce: 29,
      jobsInQueue: 18,
      mediaType: 3,
      messageIsFirstUserMessage: 30,
      messageIsInvisible: 31,
      messageType: 4,
      networkWasDisconnected: 14,
      participantCount: 37,
      phoneCores: 34,
      prekeysEligibleForPrallelProcessing: 28,
      receiverDeviceCount: 39,
      runningTasks: 44,
      sendCount: 13,
      sendRetryCount: 10,
      sendStage: 2,
      senderDeviceCount: 40,
      senderKeyDistributionCountPercentage: 23,
      sessionsMissingWhenComposing: 25,
      targetDeviceGroupSizeBucket: 20,
      threadsInExecution: 19,
      typeOfGroup: 38,
      userToDeviceSizeBucket: 46
    }
  },
  HfmTextSearchComplete: { id: 2186, weight: 1, props: {} },
  WamClientErrors: {
    id: 1144,
    weight: 1,
    props: {
      isFromWamsys: 27,
      wamClientBufferDropErrorCount: 28,
      wamClientBufferFetchErrorCount: 29,
      wamClientBufferRotateErrorCount: 43,
      wamClientBufferStoreErrorCount: 30,
      wamClientCorruptedBuffersCount: 42,
      wamClientDroppedEventCount: 2,
      wamClientDroppedEventCountNoEnoughStorage: 41,
      wamClientDroppedEventSize: 3,
      wamClientErrorFlags: 1,
      wamClientMetadataReadErrorCount: 37,
      wamClientMetadataWriteErrorCount: 38,
      wamClientPrivateDroppedEventCount: 24,
      wamClientPrivateDroppedEventSize: 25,
      wamClientPrivateRealtimeDroppedEventCount: 34,
      wamClientPrivateRealtimeDroppedEventSize: 35,
      wamClientPrivateRealtimeRejectedEventCount: 36,
      wamClientPrivateRejectedEventCount: 31,
      wamClientRealtimeDroppedEventCount: 22,
      wamClientRealtimeDroppedEventSize: 23,
      wamClientRealtimeRejectedEventCount: 32,
      wamClientRejectedEventCount: 33,
      wamErrorBadCurrentEventBufferChecksum: 18,
      wamErrorBadEventBuffer: 16,
      wamErrorBadFileHeader: 15,
      wamErrorBadFileSize: 8,
      wamErrorBadHeaderChecksum: 17,
      wamErrorBadRotatedEventBufferChecksum: 19,
      wamErrorCloseFile: 11,
      wamErrorCreateWamFile: 14,
      wamErrorFseekFile: 9,
      wamErrorOpenFile: 10,
      wamErrorOpenPsUploadQueueFile: 26,
      wamErrorOpenWamFile: 13,
      wamErrorPersistence: 20,
      wamErrorReadFile: 7,
      wamErrorRemoveFile: 12,
      wamErrorWriteEventBuffer: 6,
      wamErrorWriteFile: 4,
      wamErrorWriteHeader: 5,
      wamFirstErrorReadMetadata: 39,
      wamFirstErrorWriteMetadata: 40
    }
  },
  BlockEventsFs: {
    id: 4288,
    weight: 1,
    props: {
      blockEntryPoint: 1,
      blockEventActionType: 2,
      blockEventIsSuspicious: 3,
      blockEventIsUnsub: 4,
      pastCall: 5,
      pastCallResult: 6
    }
  },
  WebcStorageStat: {
    id: 1504,
    weight: 1,
    props: { webcAgeOfStorage: 3, webcPackingEnabled: 4, webcStorageQuota: 2, webcStorageUsage: 1 }
  },
  PttDaily: {
    id: 2938,
    weight: 1,
    props: {
      pttCancelBroadcast: 9,
      pttCancelGroup: 8,
      pttCancelIndividual: 7,
      pttCancelInterop: 42,
      pttCancelNewsletter: 32,
      pttDraftReviewBroadcast: 15,
      pttDraftReviewGroup: 14,
      pttDraftReviewIndividual: 13,
      pttDraftReviewInterop: 43,
      pttDraftReviewNewsletter: 33,
      pttFastplaybackBroadcast: 21,
      pttFastplaybackGroup: 20,
      pttFastplaybackIndividual: 19,
      pttFastplaybackInterop: 44,
      pttFastplaybackNewsletter: 34,
      pttLockBroadcast: 12,
      pttLockGroup: 11,
      pttLockIndividual: 10,
      pttLockInterop: 45,
      pttLockNewsletter: 35,
      pttOutOfChatBroadcast: 29,
      pttOutOfChatGroup: 30,
      pttOutOfChatIndividual: 31,
      pttOutOfChatInterop: 46,
      pttOutOfChatNewsletter: 36,
      pttPausedRecordBroadcast: 22,
      pttPausedRecordGroup: 23,
      pttPausedRecordIndividual: 24,
      pttPausedRecordInterop: 47,
      pttPausedRecordNewsletter: 37,
      pttPlaybackBroadcast: 18,
      pttPlaybackGroup: 17,
      pttPlaybackIndividual: 16,
      pttPlaybackInterop: 48,
      pttPlaybackNewsletter: 38,
      pttRecordBroadcast: 3,
      pttRecordGroup: 2,
      pttRecordIndividual: 1,
      pttRecordInterop: 49,
      pttRecordNewsletter: 39,
      pttSendBroadcast: 6,
      pttSendGroup: 5,
      pttSendIndividual: 4,
      pttSendInterop: 50,
      pttSendNewsletter: 40,
      pttStopTapBroadcast: 25,
      pttStopTapGroup: 26,
      pttStopTapIndividual: 27,
      pttStopTapInterop: 51,
      pttStopTapNewsletter: 41
    }
  },
  SmbPaidMessagesButtonLogger: {
    id: 4508,
    weight: 1,
    props: {
      businessPhoneNumber: 1,
      pmButtonCount: 2,
      pmButtonEventType: 3,
      pmButtonIndex: 4,
      pmButtonType: 5,
      pmIsTrackableLink: 7,
      pmServerCampaignId: 6
    }
  },
  WebDbLoadFromVersionFailureNonAnonymous: {
    id: 4814,
    weight: 1,
    props: { webDbLoader: 1, webDbName: 2 }
  },
  KeepInChatErrors: {
    id: 3698,
    weight: 1,
    props: {
      canEditDmSettings: 7,
      isAGroup: 2,
      isAdmin: 3,
      kicAction: 4,
      kicErrorCode: 5,
      kicMessageEphemeralityDuration: 6
    }
  },
  WebcPwaEvent: { id: 4116, weight: 1, props: { webcPwaAction: 2 } },
  WebcStatusSync: {
    id: 1878,
    weight: 1,
    props: {
      webcStatusMutedItemCount: 4,
      webcStatusMutedRowCount: 7,
      webcStatusRecentItemCount: 2,
      webcStatusRecentRowCount: 5,
      webcStatusSyncT: 1,
      webcStatusViewedItemCount: 3,
      webcStatusViewedRowCount: 6
    }
  },
  SenderKeyExpired: {
    id: 3130,
    weight: 1,
    props: { chatType: 1, deviceSizeBucket: 2, expiryReason: 3 }
  },
  WaOldCode: { id: 3940, weight: 1, props: { deviceId: 1 } },
  WebcMessageSend: {
    id: 2072,
    weight: 1,
    props: { messageIsForward: 3, messageMediaType: 2, messageSendT: 4, messageType: 1 }
  },
  WebcMessageQuery: {
    id: 1876,
    weight: 5,
    props: {
      webcAudioMessageCount: 14,
      webcBrowserNetworkType: 1,
      webcBrowserStorageQuotaBytes: 20,
      webcBrowserStorageQuotaUsedBytes: 21,
      webcChatPosition: 2,
      webcChatType: 13,
      webcDocumentMessageCount: 16,
      webcEarliestMessageIndex: 11,
      webcEarliestMessageT: 12,
      webcMessageCount: 4,
      webcMessageQueryTrigger: 19,
      webcMessageQueryType: 3,
      webcOtherMessageCount: 18,
      webcPhotoMessageCount: 7,
      webcPttMessageCount: 15,
      webcQueryT: 9,
      webcResponseBytes: 10,
      webcStickerMessageCount: 17,
      webcTextMessageCount: 5,
      webcVideoMessageCount: 6
    }
  },
  MdAppStateSyncMutationStats: {
    id: 3180,
    weight: 100,
    props: { applied: 1, failed: 2, invalid: 3, orphan: 4, syncdAction: 5, unsupported: 6 }
  },
  DeepLinkOpen: {
    id: 2136,
    weight: 1,
    props: {
      campaign: 8,
      deepLinkOpenFrom: 2,
      deepLinkSessionId: 6,
      deepLinkType: 3,
      isContact: 4,
      linkOwnerType: 5,
      sourceSurface: 7
    }
  },
  ManageAdsEntryPointTap: { id: 4126, weight: 1, props: { manageAdsEntryPoint: 1 } },
  EphemeralSyncResponseReceive: {
    id: 4780,
    weight: 1,
    props: {
      clientDisappearingModeInitiator: 1,
      clientEphemeralityDuration: 2,
      clientEphemeralityInitiator: 3,
      clientEphemeralitySettingTimestamp: 4,
      clientEphemeralityTriggerAction: 5,
      esrDisappearingModeInitiator: 6,
      esrEphemeralityDuration: 7,
      esrEphemeralityInitiator: 8,
      esrEphemeralitySettingTimestamp: 9,
      esrEphemeralityTriggerAction: 10,
      esrFailureReason: 11,
      esrResolveResult: 12,
      isAGroup: 13,
      threadId: 14
    }
  },
  WebcMinorEventLog: {
    id: 5440,
    weight: 100,
    props: { additionalDebugContext: 1, logContext: 2, logCount: 3, logReason: 4, logType: 5 }
  },
  NonMessagePeerDataRequest: {
    id: 3906,
    weight: 1,
    props: { peerDataRequestCount: 1, peerDataRequestSessionId: 2, peerDataRequestType: 3 }
  },
  AttachmentTrayActions: {
    id: 3980,
    weight: 1,
    props: {
      actionDurationMs: 1,
      actionThreadType: 9,
      attachmentTrayAction: 2,
      attachmentTrayActionTarget: 3,
      groupSizeBucket: 4,
      isAGroup: 5,
      isSuccessful: 6,
      sendMediaType: 7,
      sendTime: 8
    }
  },
  MessageReceive: {
    id: 450,
    weight: 5,
    props: {
      agentEngagementType: 28,
      appContext: 43,
      appContextBitfield: 44,
      botType: 37,
      chatOrigins: 38,
      deviceCount: 16,
      deviceSizeBucket: 10,
      disappearingChatInitiator: 14,
      editType: 25,
      ephemeralityDuration: 13,
      ephemeralityInitiator: 26,
      ephemeralityTriggerAction: 27,
      hasUsername: 39,
      hasUsernamePin: 45,
      invisibleMessageCategory: 41,
      isAComment: 36,
      isAReply: 19,
      isForwardedForward: 18,
      isLid: 24,
      isViewOnce: 9,
      localAddressingMode: 33,
      messageAddressingMode: 34,
      messageIsInternational: 4,
      messageIsInvisible: 23,
      messageIsOffline: 5,
      messageMediaType: 2,
      messageQueueTime: 15,
      messageReceiveT0: 6,
      messageReceiveT1: 7,
      messageType: 1,
      mutedGroupMessage: 8,
      numOfWebUrlsInTextMessage: 3,
      offlineCount: 30,
      oppositeVisibleIdentification: 40,
      paddingBytesSize: 22,
      pairedMediaType: 42,
      participantCount: 17,
      receiverDefaultDisappearingDuration: 12,
      revokeType: 20,
      senderDefaultDisappearingDuration: 11,
      serverAddressingMode: 35,
      stickerIsAi: 29,
      stickerIsFromStickerMaker: 31,
      stickerMakerSourceType: 32,
      typeOfGroup: 21
    }
  },
  WebcOfflineNotificationProcess: {
    id: 4222,
    weight: 1,
    props: {
      currentOfflineProcessStage: 4,
      offlineProcessDecryptErrorCount: 5,
      offlineProcessMailboxAge: 6,
      offlineProcessMessageCount: 7,
      offlineProcessNotificationCount: 8,
      offlineProcessSessionId: 9,
      offlineProcessStageTimestampMs: 10,
      runReason: 12,
      swVersion: 11
    }
  },
  MdAppStateMessageRange: { id: 2522, weight: 1e3, props: { additionalMessagesCount: 1 } },
  PinInChatInteraction: {
    id: 4436,
    weight: 1,
    props: {
      groupRole: 1,
      groupSize: 2,
      groupTypeClient: 3,
      isAGroup: 4,
      isSelfPin: 8,
      mediaType: 5,
      pinCount: 6,
      pinInChatInteractionType: 7,
      pinIndex: 9
    }
  },
  WebcMediaErrorUnknownDetails: {
    id: 2352,
    weight: 1,
    props: { mediaId: 1, webcMediaErrorMessage: 4, webcMediaErrorName: 3, webcMediaOperation: 2 }
  },
  CommunityCreation: {
    id: 3492,
    weight: 1,
    props: {
      communityCreationActionCount: 1,
      communityCreationActionTaken: 2,
      communityCreationCurrentScreen: 3,
      communityCreationEntrypoint: 5,
      communityCreationSessionId: 4,
      communityId: 6
    }
  },
  DisappearingMessageChatPicker: {
    id: 3398,
    weight: 1,
    props: {
      chatsSelected: 1,
      dmChatPickerEntryPoint: 2,
      dmChatPickerEventName: 3,
      ephemeralityDuration: 4,
      groupChatsSelected: 5,
      groupSizeDistributionJson: 9,
      newlyEphemeralChats: 7,
      totalChatsInChatPicker: 8
    }
  },
  OtpRetriever: {
    id: 3468,
    weight: 1,
    props: {
      businessLid: 26,
      businessLidOrJid: 28,
      businessPhoneNumber: 1,
      chatId: 19,
      chatsFolderType: 12,
      ctaFallbackReason: 2,
      ctaType: 3,
      isKeepChatsArchivedEnabled: 13,
      isMessageNotificationEnabled: 14,
      isNotificationEnabled: 15,
      messageReceivedElapsedTimeSeconds: 11,
      otpCorrelationId: 20,
      otpEventSource: 5,
      otpEventType: 6,
      otpFailureReason: 16,
      otpHandshakeElapsedTimeMs: 21,
      otpHandshakeId: 23,
      otpMaskLinkedDevices: 24,
      otpProductType: 7,
      otpSdkVersion: 22,
      otpSenderAttributes: 27,
      otpSessionId: 8,
      receiverCountryCode: 18,
      templateId: 17,
      thirdPartyPackageNameFromIntent: 9,
      thirdPartyPackageSignatureHash: 10,
      waDeviceId: 25
    }
  },
  BizCatalogView: {
    id: 3006,
    weight: 1,
    props: {
      adId: 26,
      bizPlatform: 14,
      cartToggle: 13,
      catalogCategoryId: 19,
      catalogEntryPoint: 2,
      catalogEventSampled: 11,
      catalogOwnerJid: 10,
      catalogReportReasonCode: 8,
      catalogSessionId: 3,
      catalogViewAction: 1,
      collectionId: 15,
      collectionIndex: 16,
      deepLinkOpenFrom: 12,
      entryPointConversationInitiated: 22,
      entryPointConversionApp: 20,
      entryPointConversionSource: 21,
      hasVariants: 23,
      isNewProductAddedToCart: 7,
      isOrderMsgAttached: 5,
      orderId: 4,
      productId: 9,
      productIndex: 17,
      quantity: 6,
      sequenceNumber: 18,
      variantTypes: 24,
      variantsExtraAttributes: 25
    }
  },
  GifFromProviderSent: { id: 1124, weight: 1, props: { gifSearchProvider: 1 } },
  ChatMessageCounts: {
    id: 1644,
    weight: 1,
    props: {
      aiChatOrigins: 224,
      aiDiscoveryTab: 195,
      aptTestId: 212,
      audioMessagesReceived: 149,
      audioMessagesSent: 150,
      autoReplyFromIcebreakerSent: 190,
      awayMsgsSent: 56,
      bizCatalogType: 60,
      bizConversationDepth: 65,
      blockReason: 33,
      bottomSheetAnimatedSent: 206,
      bottomSheetEditedAnimatedSent: 207,
      bottomSheetEditedSent: 208,
      bottomSheetForwardMessagesSent: 196,
      bottomSheetImagesEdited: 209,
      bottomSheetImagesGenerated: 197,
      bottomSheetMemuImagesGenerated: 220,
      bottomSheetMemuInitiated: 221,
      bottomSheetMemuMessagesSent: 222,
      bottomSheetMessagesDownloaded: 198,
      bottomSheetMessagesReceived: 199,
      bottomSheetMessagesSent: 200,
      bottomSheetPromptsInitiated: 201,
      bottomSheetRegeneratedSent: 210,
      broadcastMsgsReceived: 30,
      broadcastMsgsSent: 29,
      callOffersReceived: 27,
      callOffersSent: 26,
      callsResultBusy: 70,
      callsResultCancelled: 71,
      callsResultConnected: 72,
      callsResultError: 78,
      callsResultMissed: 73,
      callsResultRejected: 74,
      canEditDmSettings: 88,
      cartViews: 86,
      chatEphemeralityDuration: 15,
      chatMuted: 8,
      chatOrigins: 179,
      chatOverflowClicks: 79,
      chatTypeInd: 2,
      collectionInquiriesSent: 44,
      commandSheetShow: 174,
      commentsReceived: 126,
      commerceMsgsReceived: 41,
      commerceMsgsSent: 40,
      deviceLanguage: 219,
      disappearingChatInitiator: 59,
      documentMessagesReceived: 151,
      documentMessagesSent: 152,
      editedMsgsSent: 100,
      emuFlashPlaybacks: 184,
      emuFlashPreviewShow: 182,
      emuFlashSent: 183,
      entryPointConversionApp: 47,
      entryPointConversionSource: 46,
      ephemeralMessagesExpired: 248,
      ephemeralMessagesReceived: 14,
      ephemeralMessagesSent: 13,
      ephemeralMessagesUnreadExpired: 69,
      ephemeralityInitiator: 109,
      ephemeralityTriggerAction: 110,
      eventCreationMessagesReceived: 142,
      eventCreationMessagesSent: 143,
      eventResponseMessagesReceived: 144,
      eventResponseMessagesSent: 145,
      fbCtaInquiriesSent: 45,
      firstResponseTime: 25,
      fmxNotMvBottomSheetDismissedCount: 234,
      fmxNotMvBottomSheetGetMvButtonClicks: 235,
      fmxNotMvBottomSheetGetMvButtonImpressions: 236,
      fmxNotMvBottomSheetImpressions: 237,
      fmxNotMvBottomSheetLearnMoreButtonClicks: 238,
      fmxNotMvClicks: 229,
      forwardAudioMessagesReceived: 153,
      forwardAudioMessagesSent: 154,
      forwardDocumentMessagesReceived: 155,
      forwardDocumentMessagesSent: 156,
      forwardGifMessagesReceived: 157,
      forwardGifMessagesSent: 158,
      forwardMessagesReceived: 89,
      forwardMessagesSent: 90,
      forwardPhotoMessagesReceived: 128,
      forwardPhotoMessagesSent: 129,
      forwardPtvMessagesReceived: 159,
      forwardPtvMessagesSent: 160,
      forwardStatusReplyMessagesReceived: 161,
      forwardStatusReplyMessagesSent: 162,
      forwardStickerMessagesReceived: 163,
      forwardStickerMessagesSent: 164,
      forwardTextMessagesReceived: 130,
      forwardTextMessagesSent: 131,
      forwardUrlMessagesReceived: 132,
      forwardUrlMessagesSent: 133,
      forwardVideoMessagesReceived: 165,
      forwardVideoMessagesSent: 166,
      gaStatus: 22,
      gifMessagesReceived: 167,
      gifMessagesSent: 168,
      googleSearchClick: 214,
      googleSearchShow: 215,
      greetingMsgsSent: 57,
      groupContainsBiz: 75,
      groupInfoSetting: 87,
      groupLimitSharingOnCnt: 225,
      groupMembershipReplies: 51,
      groupPrivateReplies: 52,
      groupSize: 19,
      hasReplied1On1: 216,
      hasUsername: 180,
      hasUsernamePin: 228,
      imagineCommandClick: 175,
      imagineMeMessagesSent: 202,
      imagineMePromptsInitiatedCount: 203,
      imagineMentionClick: 146,
      imagineMentionShow: 176,
      isAContact: 6,
      isAContactAtThreadCreation: 213,
      isAGroup: 5,
      isArchived: 10,
      isAutoMuted: 108,
      isBizMvFrictionEligible: 230,
      isBlocked: 32,
      isCartAddClicked: 36,
      isCommerceViewed: 35,
      isCtaOnPdpClicked: 37,
      isDeleted: 185,
      isInviteCreatedThread: 106,
      isLabelled: 54,
      isMessageYourself: 91,
      isMetaAiAssistant: 211,
      isOppositePartyInitiated: 62,
      isPinned: 9,
      isPnhEnabledChat: 92,
      isReported: 186,
      isUser1pBizBotChat: 141,
      isUser3pBotChat: 140,
      isUserAgent: 111,
      isUserCreatedAgent: 123,
      isWaPayRegistered: 81,
      labelledMsgs: 55,
      limitSharingOption: 226,
      locationsSent: 96,
      markedReadCnt: 193,
      markedReadMessageCnt: 194,
      matchedMessagesMarkedAsReadWithDeltaTime: 246,
      matchedMessagesReadWithDeltaTime: 247,
      messagesRead: 127,
      messagesReceived: 4,
      messagesReceivedWithEnabledReadReceipt: 245,
      messagesSent: 3,
      messagesStarred: 12,
      messagesUnread: 11,
      metaAiMentionClick: 147,
      metaAiMentionShow: 148,
      newThread: 68,
      notMvImpressions: 231,
      odReceived: 82,
      oppositePartyHasBadge: 240,
      oppositePartyHasBusinessIntent: 204,
      oppositePartyHasProfilePhoto: 217,
      oppositePartyLimitSharingOption: 227,
      oppositeVisibleIdentification: 181,
      ordersSent: 38,
      p2mOdNnpTransactionsSent: 83,
      p2mOdNpTransactionsSent: 84,
      paymentsSent: 39,
      pdpInquiriesSent: 42,
      pdpViews: 61,
      photoMessagesReceived: 134,
      photoMessagesSent: 135,
      pollCreationMessagesReceived: 115,
      pollCreationMessagesSent: 116,
      pollUpdateMessagesReceived: 117,
      pollUpdateMessagesSent: 118,
      profileReplies: 64,
      profileViews: 63,
      pttMessagesReceived: 119,
      pttMessagesSent: 120,
      ptvMessagesReceived: 121,
      ptvMessagesSent: 122,
      quickRepliesSent: 58,
      reactionsReceived: 97,
      reactionsSent: 98,
      receiverDefaultDisappearingDuration: 21,
      repliesSent: 80,
      requestedPhoneNumber: 93,
      seenMaskedPhoneNumber: 94,
      senderDefaultDisappearingDuration: 20,
      sharedPhoneNumber: 99,
      sharesCommonGroup: 218,
      smbMarketingMessagesReactionsSent: 101,
      smbMarketingMessagesRepliesSent: 102,
      smbMarketingMessagesSpamReports: 103,
      smbMarketingMsgsReceived: 104,
      smbMarketingMsgsSent: 105,
      spamReports: 31,
      startTime: 7,
      statusReactionsReceived: 191,
      statusReactionsSent: 192,
      statusReplies: 50,
      statusReplyMessagesReceived: 169,
      statusViews: 49,
      stickerMessagesReceived: 170,
      stickerMessagesSent: 171,
      storefrontInquiriesSent: 43,
      suggestionPromptsClick: 177,
      suggestionPromptsShow: 178,
      textMessagesReceived: 136,
      textMessagesSent: 137,
      textMessagesToUserCreatedAgentCnt: 124,
      threadCreationDate: 189,
      threadDs: 66,
      threadId: 67,
      threadIdMonthly: 223,
      totalCallDuration: 28,
      totalMessageEditsFromAgentCnt: 112,
      totalMessageFromAgentCnt: 113,
      totalMessageToAgentCnt: 114,
      totalMessagesToUserCreatedAgentCnt: 125,
      typeOfGroup: 85,
      urlMessagesReceived: 138,
      urlMessagesSent: 139,
      userHasBusinessIntent: 205,
      viaContactlessChats: 107,
      videoCallsOffered: 76,
      videoMessagesReceived: 172,
      videoMessagesSent: 173,
      viewOnceMessagesOpened: 18,
      viewOnceMessagesReceived: 17,
      viewOnceMessagesSent: 16,
      voiceCallsOffered: 77
    }
  },
  WebcResourceLoad: {
    id: 688,
    weight: 2e3,
    props: { webcResourceCached: 3, webcResourceDuration: 2, webcResourceName: 1 }
  },
  AdvertiseTooltipImpression: {
    id: 4024,
    weight: 1,
    props: { lwiEntryPoint: 1, tooltipAction: 2 }
  },
  MdAppStateOfflineNotifications: { id: 2602, weight: 1e3, props: { redundantCount: 1 } },
  SendDocument: {
    id: 2172,
    weight: 1,
    props: { documentExt: 3, documentSize: 1, documentType: 2 }
  },
  CtwaOrderSignal: {
    id: 4264,
    weight: 1,
    props: {
      ctwaOrderSignalVersion: 1,
      ctwaSignalMetadata: 10,
      customerAdsSharingSettingEnabled: 11,
      deepLinkConversionData: 2,
      deepLinkConversionSource: 3,
      eventSharingSettingEnabled: 4,
      globalSharingSettingEnabled: 5,
      orderPaid: 8,
      orderSignalType: 6,
      orderStatus: 7,
      threadIdHmac: 9
    }
  },
  WebDbVersionsSource: {
    id: 4784,
    weight: 1,
    props: { webDbVersionSource: 1, webSchemaInitiator: 2 }
  },
  TestAnonymousMonthlyId: { id: 2960, weight: 1e3, props: {} },
  BusinessToolsEntry: {
    id: 2216,
    weight: 1,
    props: {
      businessToolsEntryPoint: 3,
      businessToolsSequenceNumber: 2,
      businessToolsSessionId: 1
    }
  },
  AdvStoredTimestampExpired: { id: 3036, weight: 1, props: { advExpireTimeInHours: 1 } },
  ForwardSend: {
    id: 1728,
    weight: 1,
    props: {
      disappearingChatInitiator: 21,
      e2eCiphertextType: 12,
      e2eCiphertextVersion: 11,
      ephemeralityDuration: 18,
      ephemeralityInitiator: 24,
      ephemeralityTriggerAction: 25,
      fastForwardEnabled: 5,
      forwardPickerOrigin: 27,
      isForwardedForward: 22,
      isFrequentlyForwarded: 14,
      mediaCaptionPresent: 10,
      messageBizType: 26,
      messageForwardAgeT: 4,
      messageIsFanout: 6,
      messageIsFastForward: 3,
      messageIsInternational: 9,
      messageMediaType: 2,
      messageSendT: 13,
      messageType: 1,
      receiverDefaultDisappearingDuration: 20,
      resendCount: 8,
      retryCount: 7,
      senderDefaultDisappearingDuration: 19,
      typeOfGroup: 23,
      wouldBeFrequentlyForwardedAt3: 16,
      wouldBeFrequentlyForwardedAt4: 17
    }
  },
  CommunityHomeAction: {
    id: 3494,
    weight: 1,
    props: {
      communityHomeGroupDiscoveries: 1,
      communityHomeGroupJoins: 2,
      communityHomeGroupNavigations: 3,
      communityHomeId: 4,
      communityHomeViews: 5
    }
  },
  StatusReportingEvents: { id: 3920, weight: 1, props: { statusReportInteraction: 1 } },
  IncomingMessageDrop: {
    id: 3724,
    weight: 1,
    props: {
      agentEngagementType: 12,
      botType: 14,
      e2eCiphertextType: 1,
      e2eDestination: 2,
      e2eFailureReason: 9,
      e2eSenderType: 3,
      invisibleMessageCategory: 13,
      isLid: 15,
      localAddressingMode: 16,
      messageDropReason: 4,
      messageMediaType: 5,
      offline: 6,
      offlineCount: 11,
      retryCount: 7,
      revokeType: 8,
      typeOfGroup: 10
    }
  },
  ChannelsVideoPlay: {
    id: 6556,
    weight: 1,
    props: {
      autoPlayT: 1,
      cid: 2,
      finishCount: 13,
      height: 3,
      postId: 4,
      videoDuration: 5,
      videoInitialBufferingT: 6,
      videoPlayOrigin: 7,
      videoPlayResult: 8,
      videoPlayT: 9,
      videoPlayType: 10,
      videoSize: 11,
      width: 12
    }
  },
  MdDeviceSyncAck: {
    id: 2180,
    weight: 1,
    props: {
      chatType: 1,
      invisibleMessageCategory: 7,
      isLid: 3,
      localAddressingMode: 5,
      revoke: 2,
      serverAddressingMode: 6,
      typeOfGroup: 4
    }
  },
  ReceiptStanzaReceive: {
    id: 2496,
    weight: 2e3,
    props: {
      dbReadsCount: 12,
      dbWritesCount: 13,
      mediaType: 2,
      messageType: 10,
      processingDeferred: 14,
      receiptAggregation: 11,
      receiptStanzaDuration: 1,
      receiptStanzaHasOrphaned: 6,
      receiptStanzaOfflineCount: 3,
      receiptStanzaProcessedCount: 8,
      receiptStanzaRetryVer: 5,
      receiptStanzaStage: 9,
      receiptStanzaTotalCount: 7,
      receiptStanzaType: 4,
      stanzaBatchSize: 15,
      stanzaProcessCount: 16
    }
  },
  WaShopsManagement: {
    id: 2908,
    weight: 1,
    props: { isShopsProductPreviewVisible: 2, shopsManagementAction: 1, shopsSellerJid: 3 }
  },
  WebcStreamModeChange: { id: 770, weight: 1, props: { webcStreamMode: 1 } },
  MediaDownload2: {
    id: 1590,
    weight: 50,
    props: {
      activeThreadCount: 55,
      aiFetchMediaType: 62,
      appContext: 64,
      appContextBitfield: 65,
      clientMessageId: 50,
      connectionType: 31,
      daysSinceReceive: 46,
      debugMediaException: 24,
      debugMediaIp: 22,
      debugUrl: 23,
      deviceCount: 49,
      downloadBytesTransferred: 20,
      downloadConnectT: 15,
      downloadHttpCode: 18,
      downloadIsReuse: 17,
      downloadIsStreaming: 19,
      downloadNetworkT: 16,
      downloadQuality: 37,
      downloadResumePoint: 14,
      downloadTimeToFirstByteT: 21,
      estimatedBandwidth: 36,
      estimatedBandwidthV2: 59,
      expressPathBytesSaved: 42,
      expressPathDownloadState: 56,
      expressPathTimeSavedMs: 43,
      fileHeight: 47,
      fileWidth: 48,
      hasLeveragedExpressPath: 44,
      httpProtocolVersionType: 45,
      isProcessedVideo: 58,
      isSenderPlatformCapi: 52,
      isViewOnce: 41,
      maxThreadCount: 57,
      mediaId: 38,
      networkStack: 30,
      overallAttemptCount: 4,
      overallBackendStore: 39,
      overallConnBlockFetchT: 10,
      overallConnectionClass: 29,
      overallCumT: 27,
      overallCumUserVisibleT: 60,
      overallCumV2T: 53,
      overallDecryptT: 12,
      overallDomain: 5,
      overallDownloadMode: 11,
      overallDownloadOrigin: 35,
      overallDownloadResult: 25,
      overallFileValidationT: 13,
      overallIsEncrypted: 28,
      overallIsFinal: 26,
      overallMediaSize: 7,
      overallMediaType: 1,
      overallMmsVersion: 6,
      overallQueueT: 9,
      overallRetryCount: 3,
      overallT: 8,
      overallUserVisibleT: 61,
      pairedMediaType: 63,
      sleepModeAffected: 51,
      timeDelayed: 54,
      usedFallbackHint: 40
    }
  },
  StatusRowView: {
    id: 1656,
    weight: 1,
    props: {
      psaCampaigns: 8,
      statusRowEntryMethod: 5,
      statusRowIndex: 4,
      statusRowSection: 3,
      statusRowUnreadItemCount: 7,
      statusRowViewCount: 6,
      statusSessionId: 1,
      statusViewerSessionId: 2
    }
  },
  SupportAiSession: {
    id: 4970,
    weight: 1,
    props: {
      citationCmsId: 5,
      supportAiErrorCode: 3,
      supportAiErrorMessage: 4,
      supportAiEventType: 1
    }
  },
  WebDynamicSamplingTestEventWithSampling: { id: 5320, weight: 1e4, props: {} },
  WebcFtsStorage: { id: 3642, weight: 1, props: { ftsTotalSize: 1 } },
  SmbDataSharingConsentSetting: {
    id: 3974,
    weight: 1,
    props: {
      smbDataSharingConsentSettingEntryPoint: 1,
      smbDataSharingConsentSettingType: 2,
      smbDataSharingConsentSettingVersion: 3
    }
  },
  WhatsappQuickPromotionClientEligibilityWaterfall: {
    id: 4360,
    weight: 1,
    props: {
      clientExtraData: 6,
      eligibilityStatus: 1,
      instanceLogData: 5,
      promotionId: 2,
      qpFailureReason: 3,
      step: 4
    }
  },
  WebcStickerMakerEvents: { id: 3104, weight: 1, props: { stickerMakerEventName: 1 } },
  SendRevokeMessage: {
    id: 1348,
    weight: 1,
    props: { messageMediaType: 2, messageType: 1, revokeSendDelay: 3 }
  },
  TsNavigation: {
    id: 4334,
    weight: 1,
    props: {
      cid: 19,
      entryPointConversationInitiated: 23,
      entryPointConversionApp: 24,
      entryPointConversionSource: 25,
      groupSize: 1,
      isCatalogVisible: 29,
      isCloudapi: 26,
      isMetaAiThread: 30,
      isOnpremises: 27,
      isSmb: 28,
      navigationDestination: 2,
      navigationDestinationProductArea: 34,
      navigationDestinationViewName: 35,
      navigationSource: 3,
      referrerAction: 31,
      relativeTimestampMs: 4,
      smbCatalogBusinessVertical: 20,
      smbCatalogIsCatalogVisible: 21,
      smbCatalogIsToggleCart: 22,
      threadType: 7,
      tsSessionId: 5,
      tsTimestampMs: 32,
      typeOfGroup: 6,
      unifiedSessionId: 33
    }
  },
  MdSyncdDogfoodingFeatureUsage: { id: 3016, weight: 1, props: { mdSyncdDogfoodingFeature: 1 } },
  ChannelOpen: {
    id: 4316,
    weight: 1,
    props: {
      channelDirectorySessionId: 8,
      channelEntryPoint: 1,
      channelEntryPointMetadata: 9,
      channelSessionId: 3,
      channelUserType: 4,
      cid: 6,
      discoverySurface: 15,
      entryPointMetadata: 12,
      hasNetworkConnection: 7,
      isPremium: 14,
      similarChannelsSessionId: 11,
      unreadMessages: 5,
      unreadPremiumMessages: 13
    }
  },
  KeepInChatNotif: {
    id: 3484,
    weight: 1,
    props: {
      kicGroupNotificationTaps: 3,
      kicGroupNotifications: 4,
      kicNotificationTaps: 5,
      kicNotifications: 6
    }
  },
  MediaStreamPlayback: {
    id: 1584,
    weight: 1,
    props: {
      bytesDownloadedStart: 4,
      bytesTransferred: 5,
      didPlay: 15,
      forcedPlayCount: 12,
      initialBufferingT: 7,
      mediaSize: 2,
      mediaType: 3,
      overallPlayT: 10,
      overallT: 1,
      playbackCount: 14,
      playbackError: 17,
      playbackOrigin: 16,
      playbackState: 11,
      seekCount: 13,
      totalRebufferingCount: 9,
      totalRebufferingT: 8,
      videoDuration: 6
    }
  },
  MdExpansionAgentBrowserMdId: {
    id: 3390,
    weight: 1,
    props: {
      agentId: 1,
      browserId: 2,
      companionMdId: 5,
      isCustomAgentName: 6,
      isNewAgent: 9,
      loginTimestamp: 3,
      logoutTimestamp: 4,
      mdLinkedCount: 8,
      multideviceAction: 7
    }
  },
  KeepInChatPerf: {
    id: 3488,
    weight: 1,
    props: {
      chatEphemeralityDuration: 1,
      kicErrorCode: 2,
      kicMessageEphemeralityDuration: 3,
      kicRequestType: 4,
      requestSendTime: 5,
      response: 6,
      threadId: 7
    }
  },
  BusinessMute: { id: 1376, weight: 1, props: { muteT: 2, muteeId: 1 } },
  WebDynamicSamplingTestEventWithoutSampling: { id: 5322, weight: 1, props: {} },
  UserNotice: {
    id: 2472,
    weight: 1,
    props: {
      noticeTriggeredBy: 5,
      noticeType: 4,
      tsMs: 6,
      userNoticeContentVersion: 2,
      userNoticeEvent: 3,
      userNoticeId: 1
    }
  },
  SuspendedGroupDelete: { id: 4342, weight: 1, props: { deleteBtnSource: 1 } },
  ChatFilterEvent: {
    id: 1616,
    weight: 1,
    props: {
      actionType: 1,
      activitySessionId: 6,
      filterType: 2,
      labelName: 11,
      listId: 12,
      listIndex: 13,
      listType: 14,
      metadata: 7,
      predefinedId: 10,
      searchQueryId: 8,
      searchRequestId: 9,
      searchResultType: 4,
      sessionId: 3,
      targetScreen: 5,
      threadId: 15
    }
  },
  UserNoticeError: {
    id: 2474,
    weight: 1,
    props: { noticeType: 4, userNoticeContentVersion: 2, userNoticeErrorEvent: 3, userNoticeId: 1 }
  },
  MdBootstrapHistoryDataDownloaded: {
    id: 2296,
    weight: 1,
    props: {
      appContext: 18,
      appContextBitfield: 19,
      applicationState: 17,
      historySyncChunkOrder: 15,
      historySyncStageProgress: 14,
      mdBootstrapChatsCount: 6,
      mdBootstrapHistoryPayloadType: 13,
      mdBootstrapMessagesCount: 5,
      mdBootstrapPayloadSize: 4,
      mdBootstrapPayloadType: 2,
      mdBootstrapStepDuration: 7,
      mdBootstrapStepResult: 8,
      mdHsOldestMessageTimestamp: 11,
      mdRegAttemptId: 12,
      mdSessionId: 1,
      mdStorageQuotaBytes: 9,
      mdStorageQuotaUsedBytes: 10,
      mdSyncFailureReason: 16,
      mdTimestamp: 3
    }
  },
  PaymentsUserAction: {
    id: 2162,
    weight: 1,
    props: {
      actionTarget: 4,
      merchantType: 43,
      p2mType: 44,
      paymentAccountRowSelected: 24,
      paymentActionType: 3,
      paymentMode: 7,
      paymentNumberOfAccountsAvailable: 23,
      paymentNumberOfPeopleInvited: 32,
      paymentPinSetUp: 33,
      paymentSent: 34,
      paymentSmsProviderNumber: 15,
      paymentTransactionStatus: 45,
      paymentsAccountsExist: 13,
      paymentsBankId: 11,
      paymentsBanksRowSelected: 22,
      paymentsBanksScrolled: 21,
      paymentsBanksSearchActivated: 18,
      paymentsBanksSearchSelected: 20,
      paymentsBanksSearchString: 19,
      paymentsBanksSelectedName: 25,
      paymentsContactsBucket: 31,
      paymentsCountryCode: 2,
      paymentsErrorCode: 9,
      paymentsErrorText: 10,
      paymentsErrorTitle: 47,
      paymentsEventId: 1,
      paymentsHasMultipleSims: 29,
      paymentsIqCallStatus: 42,
      paymentsIsMandate: 40,
      paymentsIsOrder: 36,
      paymentsMandate: 41,
      paymentsOrderType: 38,
      paymentsP2mPaymentConfigId: 39,
      paymentsRequestName: 17,
      paymentsRequestRetryCount: 26,
      paymentsRequestRetryTimeDelaySeconds: 27,
      paymentsResponseResult: 12,
      paymentsSmsProviderRetryCount: 14,
      paymentsSmsRequestRetryCount: 16,
      paymentsUpiCheckPinErrorReason: 28,
      paymentsVerifyCardResult: 30,
      previousScreenName: 46,
      queryParams: 35,
      referral: 6,
      referralContext: 37,
      screen: 5,
      upiPaymentsPspId: 8
    }
  },
  QuickReply: {
    id: 1468,
    weight: 1,
    props: {
      attachmentGifCount: 7,
      attachmentImageCount: 5,
      attachmentVideoCount: 6,
      isSmartDefault: 10,
      labelThreadId: 12,
      lastMessageDirection: 16,
      messageDepth: 17,
      quickReplyAction: 1,
      quickReplyCount: 2,
      quickReplyEntryPoint: 11,
      quickReplyKeywordCount: 3,
      quickReplyKeywordMatched: 4,
      quickReplyOrigin: 9,
      quickReplyTranscodeResult: 8,
      quickReplyType: 19,
      threadCreationDate: 14,
      threadEntryPoint: 13,
      threadIdHmac: 15
    }
  },
  CadminDemote: {
    id: 3426,
    weight: 1,
    props: { cadminDemoteOrigin: 1, cadminDemoteResult: 2, isLastCadminOrCreator: 4 }
  },
  MdLinkDeviceCompanion: {
    id: 2576,
    weight: 1,
    props: {
      appContext: 13,
      appContextBitfield: 14,
      applicationState: 12,
      mdCompanionRefHash: 10,
      mdDurationS: 8,
      mdLinkDeviceCompanionErrorCode: 6,
      mdLinkDeviceCompanionStage: 4,
      mdLinkDeviceExperienceId: 11,
      mdRegAttemptId: 9,
      mdSessionId: 1,
      mdTimestampS: 7,
      mdWasUpgraded: 5
    }
  },
  BannerEvent: { id: 1578, weight: 1, props: { bannerId: 3, bannerOperation: 2, bannerType: 1 } },
  NonMessagePeerDataOperationResponse: {
    id: 3904,
    weight: 1,
    props: {
      peerDataErrorCount: 1,
      peerDataNotFoundCount: 2,
      peerDataRequestSessionId: 3,
      peerDataRequestType: 4,
      peerDataResponseApplyResult: 8,
      peerDataResponseCount: 5,
      peerDataSuccessProcessCount: 6,
      peerDataSuccessResponseCount: 7
    }
  },
  MetaVerifiedUserAction: {
    id: 4986,
    weight: 1,
    props: {
      metaVerifiedQuickPromotionId: 12,
      metaVerifiedUserActionAction: 1,
      metaVerifiedUserActionAssetType: 2,
      metaVerifiedUserActionErrorDetails: 8,
      metaVerifiedUserActionExtra: 13,
      metaVerifiedUserActionGreenDotVisible: 7,
      metaVerifiedUserActionInteractionError: 6,
      metaVerifiedUserActionIsSubscribed: 9,
      metaVerifiedUserActionReferral: 3,
      metaVerifiedUserActionResult: 5,
      metaVerifiedUserActionSurface: 4,
      userActionErrorCode: 10,
      userActionSessionId: 11
    }
  },
  GroupCreate: {
    id: 594,
    weight: 1,
    props: { ephemeralityDuration: 2, groupCreateEntryPoint: 1, hasGroupName: 3 }
  },
  ContactSyncEvent: {
    id: 1006,
    weight: 1,
    props: {
      contactSyncBusinessResponseNew: 20,
      contactSyncChangedVersionRowCount: 10,
      contactSyncConsecutiveCount: 26,
      contactSyncDeviceResponseNew: 19,
      contactSyncDisappearingModeResponseNew: 22,
      contactSyncEndTimestamp: 23,
      contactSyncErrorCode: 14,
      contactSyncFailureProtocol: 16,
      contactSyncIsMultiIq: 33,
      contactSyncLatency: 17,
      contactSyncMultiIqCompletedPages: 34,
      contactSyncMultiIqFailedPageIndex: 35,
      contactSyncMultiIqSessionDurationMs: 36,
      contactSyncMultiIqTotalPages: 37,
      contactSyncNewLidToPnMappings: 38,
      contactSyncNewLidToUsernameMappings: 39,
      contactSyncNoop: 12,
      contactSyncOsImportedContactsToRemove: 40,
      contactSyncPayResponseNew: 21,
      contactSyncRequestClearWaSyncData: 6,
      contactSyncRequestIsUrgent: 5,
      contactSyncRequestOrigin: 28,
      contactSyncRequestPreparationLatency: 27,
      contactSyncRequestProtocol: 15,
      contactSyncRequestRetryCount: 7,
      contactSyncRequestShouldRetry: 8,
      contactSyncRequestedCount: 11,
      contactSyncResponseCount: 13,
      contactSyncSidelistRequestedCount: 30,
      contactSyncSidelistResponseCount: 31,
      contactSyncSource: 24,
      contactSyncStartTimestamp: 25,
      contactSyncStatusResponseNew: 18,
      contactSyncSuccess: 9,
      contactSyncType: 1,
      contactSyncTypeCode: 4,
      contactSyncTypeIsBackground: 3,
      contactSyncTypeIsFull: 2,
      contactSyncTypeIsMetadata: 29,
      contactSyncTypeIsSnapshot: 32
    }
  },
  StatusPost: {
    id: 1176,
    weight: 1,
    props: {
      channelStatusId: 57,
      cid: 58,
      containsPrompt: 19,
      defaultStatusPrivacySetting: 6,
      dualUploadPairedMediaId: 44,
      editable: 15,
      externalInteractables: 16,
      externalPackageName: 17,
      extraStickersData: 22,
      groupMentionCount: 48,
      hasArFilters: 23,
      hasCaption: 24,
      hasDrawings: 25,
      hasFilters: 26,
      individualMentionCount: 49,
      isCropped: 36,
      isDraft: 55,
      isForwardable: 51,
      isForwarded: 52,
      isFromLayouts: 41,
      isMediaAiImagineGenerated: 43,
      isPromptResponse: 20,
      isResharable: 47,
      isReshare: 13,
      isResultTerminal: 11,
      isRotated: 37,
      isSameSongFromAttribution: 40,
      isVideoManuallyTrimmed: 38,
      isVideoMuted: 27,
      isVideoTrimmed: 28,
      mediaType: 2,
      messageKeyHash: 21,
      messageSendT: 12,
      pairedMediaType: 45,
      perPostStatusPrivacySetting: 7,
      retryCount: 5,
      shareType: 18,
      statusAudienceSelected: 56,
      statusAudienceSelectorClicked: 8,
      statusAudienceSelectorUpdated: 9,
      statusAudienceSize: 39,
      statusCategory: 53,
      statusContainsMusic: 14,
      statusId: 29,
      statusMentionCount: 10,
      statusPairedMediaQuality: 46,
      statusPostOrigin: 4,
      statusPostResult: 3,
      statusSessionId: 1,
      statusType: 30,
      stickersCount: 31,
      textStatusColorChanged: 32,
      textStatusFontChanged: 33,
      textToolCount: 34,
      unifiedSessionId: 35,
      updatesTabSessionId: 54,
      urlHasAdditionalText: 42
    }
  },
  StatusRevoke: {
    id: 1250,
    weight: 1,
    props: {
      mediaType: 2,
      statusId: 4,
      statusLifeT: 3,
      statusSessionId: 1,
      unifiedSessionId: 5,
      updatesTabSessionId: 6
    }
  },
  MemoryStat: {
    id: 1336,
    weight: 1,
    props: {
      appContext: 14,
      appContextBitfield: 15,
      hasVerifiedNumber: 7,
      numMessages: 8,
      privateBytes: 3,
      processType: 5,
      sharedBytes: 4,
      uptime: 6,
      workingSetPeakSize: 2,
      workingSetSize: 1
    }
  },
  StickerAddToFavorite: {
    id: 1842,
    weight: 1,
    props: {
      stickerAddToFavoriteOrigin: 1,
      stickerIsAi: 5,
      stickerIsAnimated: 3,
      stickerIsAvatar: 4,
      stickerIsFirstParty: 2,
      stickerIsFromStickerMaker: 6,
      stickerIsFromUserCreatedPack: 10,
      stickerIsGiphy: 8,
      stickerIsKlipy: 11,
      stickerIsPremium: 13,
      stickerIsTenor: 9,
      stickerIsText: 12,
      stickerMakerSourceType: 7
    }
  },
  StickerPickerOpened: { id: 1854, weight: 1, props: {} },
  JoinableCall: {
    id: 2572,
    weight: 1,
    props: {
      acceptAckLatencyMs: 23,
      callLinkRandomId: 51,
      callRandomId: 1,
      callReplayerId: 31,
      callSide: 41,
      groupAcceptNoCriticalGroupUpdate: 37,
      groupAcceptToCriticalGroupUpdateMs: 38,
      hasScheduleExactAlarmPermission: 42,
      hasSpamDialog: 26,
      isCallFull: 30,
      isDeviceSwitch: 55,
      isEventsLink: 50,
      isFromCallLink: 32,
      isLidCall: 45,
      isLinkCreator: 39,
      isLinkJoin: 33,
      isLinkedGroupCall: 24,
      isOneOnOneCall: 54,
      isPendingCall: 14,
      isPhashBased: 46,
      isPhashMismatch: 48,
      isRejoin: 3,
      isRering: 8,
      isScheduledCall: 40,
      isTransferRejoin: 56,
      isUpgradedGroupCallBeforeConnected: 47,
      isVoiceChat: 43,
      isWaitingRoomEnabled: 52,
      joinAckLatencyMs: 34,
      joinableAcceptBeforeLobbyAck: 16,
      joinableDuringCall: 9,
      joinableEndCallBeforeLobbyAck: 17,
      legacyCallResult: 6,
      lobbyAckLatencyMs: 19,
      lobbyEntryPoint: 2,
      lobbyExit: 4,
      lobbyExitNackCode: 5,
      lobbyOpenDurationMs: 49,
      lobbyQueryWhileConnected: 18,
      lobbyVisibleT: 7,
      nseEnabled: 27,
      nseOfflineQueueMs: 28,
      numConnectedPeers: 13,
      numInvitedParticipants: 12,
      numOutgoingRingingPeers: 20,
      queryAckLatencyMs: 35,
      randomScheduledId: 44,
      receivedByNse: 29,
      rejoinMissingDbMapping: 22,
      timeInWaitingRoomMs: 53,
      timeSinceAcceptMs: 36,
      timeSinceLastClientPollMinutes: 21,
      videoEnabled: 10
    }
  },
  StatusMute: {
    id: 2978,
    weight: 1,
    props: {
      cid: 15,
      isPosterBiz: 9,
      isPosterInAddressBook: 10,
      muteAction: 8,
      muteOrigin: 6,
      psaCampaignId: 7,
      psaCampaignIds: 4,
      psaCampaignItemIndex: 5,
      statusCategory: 13,
      statusItemIndex: 3,
      statusPosterContactType: 14,
      statusSessionId: 1,
      statusViewerSessionId: 2,
      unifiedSessionId: 11,
      updatesTabSessionId: 12
    }
  },
  StickerStoreOpened: { id: 3020, weight: 1, props: { stickerStoreOpenedOrigin: 1 } },
  StatusPrivacySettings: {
    id: 3200,
    weight: 1,
    props: {
      allowForwarding: 10,
      allowResharing: 9,
      contactSuggestion: 12,
      contactSuggestionsCount: 14,
      lastSuccessfulRankingUpdate: 15,
      previousSetting: 2,
      selectedContactsSize: 7,
      selectedGroupsSize: 8,
      selectedListSize: 3,
      selectionPillPos: 13,
      setting: 1,
      statusPostingSessionId: 6,
      statusPrivacyLists: 16,
      statusPrivacySettingsAction: 5,
      statusPrivacySettingsView: 11,
      statusPrivacySurface: 4
    }
  },
  StatusPosterActions: {
    id: 3546,
    weight: 1,
    props: {
      canSaveAsDraft: 32,
      cardType: 34,
      cardVariant: 35,
      cid: 36,
      defaultTrimmedVideoDuration: 26,
      editable: 14,
      externalInteractables: 15,
      externalPackageName: 16,
      hasDraftAvailable: 33,
      isFavoured: 28,
      mediaIndex: 29,
      originalVideoDuration: 27,
      pairedMediaType: 24,
      retryCount: 1,
      selectedLayoutConfigId: 21,
      selectedMediaCount: 22,
      shareType: 17,
      statusAudienceSize: 2,
      statusCategory: 30,
      statusContentSource: 3,
      statusContentType: 4,
      statusCreationEntryPoint: 5,
      statusDuration: 13,
      statusEventType: 7,
      statusId: 12,
      statusMediaPickerFormatType: 23,
      statusPairedMediaQuality: 25,
      statusPostFailureReason: 8,
      statusPostingSessionId: 20,
      statusPrivacyType: 10,
      statusSessionId: 11,
      stickerType: 18,
      unifiedSessionId: 19,
      updatesTabSessionId: 31
    }
  },
  QbmIncomingMessage: {
    id: 3790,
    weight: 1,
    props: {
      apiDailyThreadCount7d: 21,
      apiMessageCount1d: 22,
      apiMessageCount7d: 23,
      apiTotalMessageCount: 26,
      apiTotalNewThreadCount: 27,
      apiUniqueThreadCount1d: 24,
      apiUniqueThreadCount7d: 25,
      bizTrustTier: 36,
      bodyUrlCountInt: 52,
      bodyUrlUniqueCountInt: 53,
      buttonValueJsonArray: 45,
      chatsFolderType: 1,
      companionDevices: 10,
      contactType: 2,
      ctaUrlUniqueCountInt: 54,
      decisionId: 41,
      entSourceSubplatform: 40,
      fmxCardShown: 43,
      gapRules: 58,
      geEvaluationTimestamp: 59,
      hsmTagStr: 14,
      iasEntryPoint: 60,
      iasOptinDs: 61,
      isBizIntent: 37,
      isBroadcastMessage: 38,
      isCoex: 56,
      isFromAdsManagerMm: 15,
      isFromCapi: 16,
      isIasSubscriber: 62,
      isInsubContact: 39,
      isMuted: 20,
      isOba: 44,
      isThroughDecisionService: 57,
      keepChatsArchivedEnabled: 3,
      lastOutgoingMessageDeltaTime: 11,
      lastOutgoingMessageDeltaTimeReceived: 13,
      messageFieldJsonArray: 46,
      messageHasButton: 18,
      messageHasUrl: 19,
      messageIdHmac: 17,
      messageTypeStr: 7,
      muted: 4,
      notificationEnabled: 5,
      qbmFlag: 6,
      qbmFlagStr: 12,
      readReceiptsEnabled: 9,
      smbDailyThreadCount7d: 28,
      smbMessageCount1d: 29,
      smbMessageCount7d: 30,
      smbTotalMessageCount: 31,
      smbTotalNewThreadCount: 32,
      smbUniqueThreadCount1d: 33,
      smbUniqueThreadCount7d: 34,
      submessageFieldJsonArray: 47,
      threadCreationTime: 35,
      threadIdHmac: 8,
      threadLidHmac: 42,
      urlUniqueCountInt: 55
    }
  },
  QbmMessageRead: {
    id: 3792,
    weight: 1,
    props: {
      apiDailyThreadCount7d: 18,
      apiMessageCount1d: 19,
      apiMessageCount7d: 20,
      apiTotalMessageCount: 23,
      apiTotalNewThreadCount: 24,
      apiUniqueThreadCount1d: 21,
      apiUniqueThreadCount7d: 22,
      bizTrustTier: 34,
      bodyUrlCountInt: 51,
      bodyUrlUniqueCountInt: 52,
      buttonValueJsonArray: 44,
      chatsFolderType: 1,
      companionDevices: 41,
      contactType: 2,
      ctaUrlUniqueCountInt: 53,
      decisionId: 40,
      deltaTime: 3,
      deltaTimeReceived: 8,
      entSourceSubplatform: 39,
      hsmTagStr: 9,
      iasEntryPoint: 57,
      iasOptinDs: 58,
      isBizIntent: 37,
      isBroadcastMessage: 38,
      isBulkAction: 14,
      isCoex: 55,
      isFromAdsManagerMm: 10,
      isFromCapi: 11,
      isIasSubscriber: 59,
      isInsubContact: 35,
      isMuted: 15,
      isOba: 43,
      isThroughDecisionService: 56,
      messageFieldJsonArray: 45,
      messageHasButton: 16,
      messageHasUrl: 17,
      messageIdHmac: 13,
      messageTypeStr: 6,
      qbmFlag: 4,
      readReceiptsEnabled: 12,
      readSource: 5,
      smbDailyThreadCount7d: 25,
      smbMessageCount1d: 26,
      smbMessageCount7d: 27,
      smbTotalMessageCount: 28,
      smbTotalNewThreadCount: 29,
      smbUniqueThreadCount1d: 30,
      smbUniqueThreadCount7d: 31,
      submessageFieldJsonArray: 46,
      threadCreationTime: 32,
      threadDwellTime: 33,
      threadIdHmac: 7,
      threadLidHmac: 42,
      thumbnailType: 36,
      urlUniqueCountInt: 54
    }
  },
  CallLinkActionEvent: {
    id: 3852,
    weight: 1,
    props: {
      appSessionId: 5,
      callLinkAction: 1,
      callLinkActionEntryPoint: 2,
      callLinkMedia: 3,
      callLinkShareChatType: 6,
      callLinkSharedApp: 4,
      callLinkType: 7,
      isWaitingRoomEnabled: 10,
      userJourneyEventMs: 8,
      userJourneyFunnelId: 9
    }
  },
  ExtensionScreenProgress: {
    id: 4112,
    weight: 1,
    props: {
      adContext: 22,
      bizPlatform: 1,
      businessOwnerJid: 2,
      clickSequenceNumber: 24,
      embeddedError: 3,
      embeddedFlow: 4,
      embeddedFlowType: 5,
      entryPointConversationInitiated: 19,
      entryPointConversionApp: 20,
      entryPointConversionSource: 21,
      extensionCategory: 6,
      extensionRestoredFromCache: 17,
      extensionScreenLength: 7,
      extensionStatus: 18,
      extensionsFlowId: 8,
      extensionsMessageId: 9,
      extensionsSessionId: 10,
      flowEntryPoint: 23,
      flowStatusExit: 11,
      hsmCategory: 12,
      hsmTag: 16,
      isSuccessScreen: 25,
      isTemplate: 13,
      layoutType: 26,
      screenProgress: 14,
      sequenceNumber: 15,
      shoppingCartItemsCount: 27
    }
  },
  ExtensionsStructuredMessageInteraction: {
    id: 4114,
    weight: 1,
    props: {
      adContext: 10,
      bizPlatform: 1,
      businessOwnerJid: 2,
      entryPointConversationInitiated: 7,
      entryPointConversionApp: 8,
      entryPointConversionSource: 9,
      flowEntryPoint: 11,
      messageClass: 3,
      messageClassAttributes: 4,
      messageInteraction: 5,
      messageMediaType: 6,
      threadIdHmac: 12
    }
  },
  StatusCrosspostRequest: {
    id: 4994,
    weight: 1,
    props: {
      cacSessionId: 1,
      crosspostDestination: 2,
      crosspostErrorType: 3,
      crosspostOrigin: 4,
      defaultStatusPrivacySettings: 5,
      isAutoCrosspostEnabledInSettings: 6,
      isAutoCrossposted: 7,
      statusCrossPostPerPostStatusPrivacySetting: 8,
      statusCrosspostEntryPoint: 12,
      statusCrosspostEventType: 14,
      statusCrosspostFlowTraceId: 15,
      statusCrosspostMediaType: 9,
      statusCrosspostResult: 10,
      statusCrosspostShareType: 13,
      statusCrosspostTraceId: 16,
      statusId: 11,
      userJourneyEventMs: 17
    }
  },
  QbmMessageClick: {
    id: 5178,
    weight: 1,
    props: {
      bizTrustTier: 10,
      bodyUrlCountInt: 27,
      bodyUrlUniqueCountInt: 28,
      buttonClickedType: 1,
      buttonValueJsonArray: 20,
      chatsFolderType: 2,
      contactType: 3,
      ctaUrlUniqueCountInt: 29,
      decisionId: 17,
      deltaTime: 4,
      deltaTimeReceived: 5,
      entSourceSubplatform: 16,
      hsmTagStr: 6,
      iasEntryPoint: 33,
      iasOptinDs: 34,
      isBizIntent: 13,
      isBroadcastMessage: 14,
      isCoex: 31,
      isIasSubscriber: 35,
      isInsubContact: 15,
      isOba: 19,
      isThroughDecisionService: 32,
      messageFieldJsonArray: 21,
      messageIdHmac: 11,
      messageTypeStr: 7,
      qbmFlag: 8,
      submessageFieldJsonArray: 22,
      threadIdHmac: 9,
      threadLidHmac: 18,
      thumbnailType: 12,
      urlUniqueCountInt: 30
    }
  },
  UsernameCreationAction: {
    id: 5224,
    weight: 1,
    props: {
      eligibleToLink: 14,
      linkedAccountsFb: 10,
      linkedAccountsIg: 11,
      userJourneyEventMs: 17,
      usernameCreationActionName: 2,
      usernameCreationCurrentScreen: 3,
      usernameCreationDeepLinkCampaign: 15,
      usernameCreationDeepLinkChannel: 16,
      usernameCreationEntrypoint: 4,
      usernameCreationErrorCd: 7,
      usernameCreationErrorMessage: 13,
      usernameCreationFlowType: 9,
      usernameCreationUsernameSessionId: 6,
      usernameLinkOriginSurface: 18,
      usernameLinkType: 12,
      usernameSource: 8
    }
  },
  ChatWallpaper: {
    id: 5264,
    weight: 1,
    props: {
      appearanceType: 5,
      chatWallpaperChangeApplied: 1,
      chatWallpaperSource: 2,
      chatWallpaperType: 3,
      chatWallpaperVisit: 4
    }
  },
  ChatListWallpaper: {
    id: 5284,
    weight: 1,
    props: { anyWallpaperApplied: 1, chatThemesEnabled: 2 }
  },
  ChatThreadWallpaper: {
    id: 5286,
    weight: 1,
    props: {
      appearanceType: 5,
      belongsToCommunity: 1,
      chatThemeId: 6,
      chatThemeSource: 7,
      chatType: 2,
      colorSchemeId: 8,
      threadId: 3,
      wallpaperApplied: 4,
      wallpaperId: 9
    }
  },
  ContactNotificationSettingUserJourney: {
    id: 5304,
    weight: 1,
    props: { appSessionId: 1, contactNotificationSettingActionType: 2, groupSize: 3, uiSurface: 4 }
  },
  SearchActionEvent: {
    id: 5308,
    weight: 1,
    props: {
      bizSearchCount: 1,
      resultPageShown: 11,
      searchAction: 2,
      searchActionEntryPoint: 3,
      searchAiSuggestionCount: 4,
      searchChatsCount: 5,
      searchContactsCount: 6,
      searchFilterCount: 7,
      searchGroupsCount: 8,
      searchMessagesCount: 9,
      selectedItemRank: 10
    }
  },
  GroupMemberAddingUserJourney: {
    id: 5336,
    weight: 1,
    props: {
      addSelectedContactsCount: 1,
      appSessionId: 2,
      bundleSendSource: 20,
      frequentlyContactedIndex: 3,
      groupAddMemberEntryPoint: 28,
      groupCreateEntryPoint: 16,
      groupCreationGroupId: 11,
      groupHistoryMessagesCount: 21,
      groupHistoryOutWindowPinsCount: 25,
      groupHistoryPinsCount: 26,
      groupHistoryUncountedMessagesCount: 27,
      groupMemberAddingActionType: 4,
      groupMemberAddingMemberType: 24,
      groupServerErrorCode: 18,
      groupServerErrorCodeMsg: 19,
      hasGroupName: 12,
      hasProfilePicture: 13,
      isAdmin: 29,
      isGroupHistoryToggledOn: 22,
      isTeeBotNoticeOnly: 30,
      potentialTotalSuggestionCount: 10,
      recentlyContactedIndex: 5,
      selectedMemberCnt: 14,
      suggestedContactsCount: 6,
      suggestedContactsIndex: 7,
      uiSurface: 8,
      unifiedSessionId: 23,
      userJourneyEventMs: 15,
      userJourneyFunnelId: 9
    }
  },
  PttMessageUserJourney: {
    id: 5402,
    weight: 1,
    props: {
      appSessionId: 1,
      chatbarInitialState: 7,
      isMetaAiThread: 12,
      pttIntensityAggregateValue: 14,
      pttMessageUserJourneyAction: 2,
      pttMessageUserJourneyContainsQuotedItem: 11,
      pttMessageUserJourneyFailureReason: 9,
      pttMessageUserJourneyStage: 3,
      pttWaveformResult: 13,
      uiSurface: 4,
      unifiedSessionId: 10,
      userJourneyChatType: 5,
      userJourneyEventMs: 8,
      userJourneyFunnelId: 6
    }
  },
  TextMessageUserJourney: {
    id: 5404,
    weight: 1,
    props: {
      appSessionId: 1,
      botType: 10,
      chatbarInitialState: 6,
      textMessageUserJourneyAction: 2,
      textMessageUserJourneyContainsQuotedItem: 9,
      uiSurface: 3,
      unifiedSessionId: 8,
      userJourneyChatType: 4,
      userJourneyEventMs: 7,
      userJourneyFunnelId: 5
    }
  },
  MmSignal: {
    id: 5572,
    weight: 1,
    props: {
      consentSource: 10,
      disclosed: 4,
      isLatestConversionToken: 5,
      mmConversationDepth: 6,
      mmConversationRepeat: 7,
      mmConversionSchemaVersion: 8,
      mmDirectionFrom: 9,
      mmSignalData: 1,
      mmSignalType: 2
    }
  },
  ImagineActions: {
    id: 5620,
    weight: 1,
    props: {
      aiSessionId: 14,
      imagineAction: 1,
      imagineActionDuration: 8,
      imagineActionSource: 3,
      imagineActionSourceSubtype: 13,
      imagineActionTarget: 4,
      imagineActionThreadType: 5,
      imagineMediaType: 12,
      implementationType: 11,
      isCancelled: 6,
      isSent: 7,
      maxIndex: 9,
      metaAiConversationThreadId: 16,
      selectedImageIndex: 10,
      textModality: 17,
      threadSessionId: 15,
      unifiedSessionId: 18
    }
  },
  PreCallUserJourneyChatThread: {
    id: 5634,
    weight: 1,
    props: {
      appSessionId: 1,
      callRandomId: 13,
      callSize: 9,
      callSizeType: 7,
      groupSize: 2,
      isCommunityGroup: 11,
      isVideoCall: 12,
      preCallActionType: 3,
      subSurface: 4,
      surfaceSessionId: 5,
      userJourneyEventMs: 10,
      userJourneyFunnelId: 6
    }
  },
  PreCallUserJourneyCallsTab: {
    id: 5680,
    weight: 1,
    props: {
      appSessionId: 1,
      callSizeType: 7,
      callsTabSource: 2,
      itemPosition: 10,
      preCallActionType: 3,
      subSurface: 4,
      surfaceSessionId: 5,
      userJourneyEventMs: 9,
      userJourneyFunnelId: 6
    }
  },
  ShareContentUserJourney: {
    id: 5734,
    weight: 1,
    props: {
      appSessionId: 1,
      captionAdded: 12,
      forwardUserJourneyFunnelId: 27,
      hasBotImagineImages: 22,
      hasCaptionPrefilled: 21,
      hasFiles: 2,
      hasImages: 3,
      hasLinks: 4,
      hasMusic: 17,
      hasStatusRecipient: 25,
      hasVideo: 5,
      isForwardFlow: 15,
      mediaCount: 6,
      messageSelectedCount: 16,
      numberOfRecipients: 7,
      prefilledCaptionRemoved: 23,
      shareContentUserJourneyAction: 8,
      shareContentUserJourneyEntryPoint: 24,
      shareContentUserJourneySurfaceEntryPoint: 9,
      uiSurface: 10,
      unifiedSessionId: 14,
      userJourneyEventMs: 13,
      userJourneyFunnelId: 11
    }
  },
  ReactionUserJourney: {
    id: 5752,
    weight: 1,
    props: {
      appSessionId: 1,
      messageHasOwnReaction: 2,
      messageHasReaction: 3,
      messageMediaType: 10,
      messageType: 4,
      reactionUserJourneyAction: 5,
      reactionUserJourneyEntryPoint: 6,
      uiSurface: 7,
      unifiedSessionId: 12,
      userJourneyChatType: 8,
      userJourneyEventMs: 11,
      userJourneyFunnelId: 9
    }
  },
  MdSyncdBundle: {
    id: 5966,
    weight: 1,
    props: {
      appSessionId: 1,
      bundleVersion: 2,
      companionSessionIds: 3,
      computedLthash: 4,
      expectedMac: 5,
      kmpSyncdFlow: 17,
      mutationBundle: 6,
      mutationDirection: 7,
      patchMac: 8,
      patchSize: 9,
      processingErrorMessage: 10,
      seqNumber: 11,
      snapshotMac: 12,
      snapshotSize: 13,
      syncdCollection: 14,
      syncdKeyhash: 15,
      syncdKeyid: 16
    }
  },
  QbmMessageLevelAction: {
    id: 5976,
    weight: 1,
    props: {
      bizTrustTier: 1,
      bodyUrlCountInt: 23,
      bodyUrlUniqueCountInt: 24,
      buttonValueJsonArray: 16,
      contactType: 2,
      ctaUrlUniqueCountInt: 25,
      decisionId: 13,
      deltaTimeReceived: 3,
      entSourceSubplatform: 12,
      iasEntryPoint: 29,
      iasOptinDs: 30,
      isBizIntent: 10,
      isBroadcastMessage: 11,
      isCoex: 27,
      isIasSubscriber: 31,
      isInsubContact: 4,
      isOba: 15,
      isThroughDecisionService: 28,
      messageActionEntryPoint: 5,
      messageFieldJsonArray: 17,
      messageHasUrl: 6,
      messageIdHmac: 7,
      messageLevelAction: 8,
      submessageFieldJsonArray: 18,
      threadIdHmac: 9,
      threadLidHmac: 14,
      urlUniqueCountInt: 26
    }
  },
  ChatThemeScreen: {
    id: 6036,
    weight: 1,
    props: {
      appearanceType: 1,
      chatThemeChangeApplied: 2,
      chatThemeId: 3,
      chatThemeSource: 4,
      chatWallpaperType: 5,
      colorSchemeId: 6,
      wallpaperId: 7
    }
  },
  ProtobufValidationError: {
    id: 6110,
    weight: 1,
    props: {
      protobufCorrelationOutcome: 8,
      protobufLegacyValidationDropped: 7,
      protobufValidationContext: 9,
      protobufValidationDropped: 1,
      protobufValidationErrorMessage: 2,
      protobufValidationExpression: 3,
      protobufValidationFlow: 4,
      protobufValidationPath: 5,
      protobufValidationRuleId: 6
    }
  },
  MdSyncdMutationsSummary: {
    id: 6302,
    weight: 1,
    props: {
      appSessionId: 1,
      companionSessionIds: 2,
      isInBootstrap: 3,
      lidMutations: 4,
      mutationBundle: 5,
      mutationDirection: 6,
      patchMac: 7,
      removeMutations: 8,
      seqNumber: 9,
      setMutations: 10,
      snapshotMac: 11,
      syncdCollection: 12,
      syncdKeyidKeyhash: 13
    }
  },
  SearchUserJourney: {
    id: 6358,
    weight: 1,
    props: {
      searchDsSendContentType: 32,
      searchDsTimeSpentMs: 33,
      searchFtsAndSemanticMessagesCount: 21,
      searchFtsMessagesCount: 22,
      searchHasSemanticSearchResults: 23,
      searchSelectedMessageSource: 24,
      searchSemanticMessagesCount: 25,
      searchSessionQueryId: 26,
      searchUjAiSuggestionCount: 1,
      searchUjBizCount: 2,
      searchUjChatsCount: 3,
      searchUjContactsCount: 4,
      searchUjCriteriaType: 5,
      searchUjDismissType: 6,
      searchUjFilterCount: 7,
      searchUjFilterType: 8,
      searchUjGroupsInCommonCount: 9,
      searchUjHasFuzzyResults: 10,
      searchUjInviteCount: 31,
      searchUjItemType: 11,
      searchUjMessagesCount: 12,
      searchUjPushnamesCount: 34,
      searchUjRecentSearchesGroupCount: 29,
      searchUjRecentSearchesIndividualCount: 30,
      searchUjResultCount: 13,
      searchUjSelectedItemRank: 14,
      searchUniqueSessionId: 27,
      searchUseCase: 15,
      searchUserJourneyAction: 16,
      selectedMessageDistance: 28,
      uiSurface: 17,
      unifiedSessionId: 18,
      userJourneyEventMs: 19,
      userJourneyFunnelId: 20
    }
  },
  ThreadInteractionDataVoip: {
    id: 6362,
    weight: 1,
    props: {
      callOffersReceived: 1,
      callOffersSent: 2,
      callsResultBusy: 3,
      callsResultCancelled: 4,
      callsResultConnected: 5,
      callsResultError: 6,
      callsResultMissed: 7,
      callsResultRejected: 8,
      threadCreationDate: 16,
      threadDs: 9,
      threadId: 14,
      threadIdByLid: 15,
      totalCallDuration: 11,
      videoCallsOffered: 12,
      voiceCallsOffered: 13
    }
  },
  StatusPostImpression: {
    id: 6364,
    weight: 1,
    props: {
      channelStatusId: 46,
      channelUserType: 47,
      cid: 48,
      entryMethod: 29,
      externalSourceDomainType: 1,
      groupStatusSizeBucket: 41,
      isCloseSharingPost: 42,
      isEngagementCard: 45,
      isFirstView: 2,
      isLastStatus: 43,
      isPosterBiz: 3,
      isResharable: 49,
      isReshare: 50,
      isSelfView: 24,
      isSubImpression: 4,
      isSubscribed: 33,
      isSuccessfulView: 30,
      isViewedInLandscape: 5,
      musicBlocked: 6,
      pairedMediaType: 51,
      pogViewSequenceIndex: 37,
      psaCampaignId: 7,
      psaLinkAvailable: 8,
      statusAttributionTypes: 38,
      statusCategory: 25,
      statusContainsMusic: 9,
      statusContainsQuestion: 28,
      statusContainsReactionSticker: 34,
      statusContentType: 10,
      statusGroupId: 39,
      statusId: 11,
      statusItemViewResult: 31,
      statusLoadTime: 12,
      statusMediaType: 13,
      statusPogIndex: 15,
      statusPostIndex: 16,
      statusPostPlaybackDuration: 17,
      statusPosterContactType: 35,
      statusPosterHashId: 26,
      statusPosterId: 40,
      statusViewEntrypoint: 18,
      statusViewExitMethod: 44,
      statusViewTime: 19,
      statusViewerSessionId: 20,
      traceIdInt: 52,
      unifiedSessionId: 21,
      updatesTabSessionId: 22,
      urlStatusType: 23,
      viewSequenceIndex: 32
    }
  },
  ThreadInteractionDataAi: {
    id: 6410,
    weight: 1,
    props: {
      aiChatOrigins: 1,
      aiDiscoveryTab: 29,
      bottomSheetAnimatedSent: 2,
      bottomSheetEditedAnimatedSent: 3,
      bottomSheetEditedSent: 4,
      bottomSheetImagesGenerated: 5,
      bottomSheetMemuInitiated: 6,
      bottomSheetMemuMessagesSent: 7,
      bottomSheetMessagesSent: 8,
      bottomSheetPromptsInitiated: 9,
      bottomSheetRegeneratedSent: 10,
      commandSheetShow: 11,
      imagineCommandClick: 14,
      imagineMeMessagesSent: 15,
      imagineMePromptsInitiatedCount: 16,
      metaAiMentionClick: 19,
      metaAiMentionShow: 20,
      suggestionPromptsClick: 21,
      suggestionPromptsShow: 22,
      threadCreationDate: 28,
      threadDs: 17,
      threadId: 26,
      threadIdByLid: 27,
      totalMessageFromAgentCnt: 24,
      totalMessageToAgentCnt: 25
    }
  },
  ThreadInteractionDataNotification: {
    id: 6412,
    weight: 1,
    props: {
      groupSizeBucket: 1,
      groupTypeClient: 2,
      isAGroup: 3,
      threadCreationDate: 26,
      threadDs: 4,
      threadId: 24,
      threadIdByLid: 25,
      totalLinkReshareMessageNotifShown: 6,
      totalLinkReshareMessageNotifShownFb: 7,
      totalLinkReshareMessageNotifShownIg: 8,
      totalLinkReshareMessageNotifTapToOpen: 9,
      totalLinkReshareMessageNotifTapToOpenFb: 10,
      totalLinkReshareMessageNotifTapToOpenIg: 11,
      totalMessageReminderNotifShown: 12,
      totalMessageReminderNotifTapToOpen: 13,
      totalNotifMarkAsRead: 14,
      totalNotifMissedCallVoipCallback: 15,
      totalNotifMissedCallVoipMessage: 16,
      totalNotifOthers: 17,
      totalNotifReply: 18,
      totalNotifRtcVoipAccept: 19,
      totalNotifRtcVoipDecline: 20,
      totalNotifShowPreview: 21,
      totalNotifShown: 22,
      totalNotifTapToOpen: 23
    }
  },
  QuotedMessageUserJourney: {
    id: 6444,
    weight: 1,
    props: {
      appSessionId: 1,
      chatbarInitialState: 12,
      messageMediaType: 2,
      messageType: 3,
      quotedMediaType: 4,
      quotedMessageTypeEnum: 5,
      quotedMessageUserJourneyAction: 6,
      quotedMessageUserJourneyEntryPoint: 7,
      quotedMessageUserJourneyNavigateResult: 13,
      uiSurface: 8,
      unifiedSessionId: 11,
      userJourneyChatType: 9,
      userJourneyFunnelId: 10
    }
  },
  ThreadInteractionDataBiz: {
    id: 6464,
    weight: 1,
    props: {
      autoReplyFromIcebreakerSent: 51,
      awayMsgsSent: 1,
      bizAiSuggestedRepliesSeen: 52,
      bizAiSuggestedRepliesSentWithEdits: 53,
      bizAiSuggestedRepliesSentWithoutEdits: 54,
      bizCatalogType: 2,
      bizConversationDepth: 3,
      cartViews: 4,
      chatOrigins: 5,
      collectionInquiriesSent: 6,
      commerceMsgsReceived: 7,
      commerceMsgsSent: 8,
      entryPointConversionApp: 9,
      entryPointConversionSource: 10,
      firstResponseTime: 11,
      fmxNotMvBottomSheetDismissedCount: 41,
      fmxNotMvBottomSheetGetMvButtonClicks: 42,
      fmxNotMvBottomSheetGetMvButtonImpressions: 43,
      fmxNotMvBottomSheetImpressions: 44,
      fmxNotMvBottomSheetLearnMoreButtonClicks: 45,
      fmxNotMvClicks: 46,
      groupContainsBiz: 13,
      isBizMvFrictionEligible: 47,
      isCommerceViewed: 14,
      isCtaOnPdpClicked: 15,
      isLabelled: 16,
      isOppositePartyInitiated: 36,
      isUser1pBizBotChat: 17,
      isUser3pBotChat: 18,
      isUserAgent: 19,
      isUserCreatedAgent: 20,
      labelledMsgs: 21,
      locationsSent: 37,
      matchedMessagesMarkedAsReadWithDeltaTime: 49,
      matchedMessagesReadWithDeltaTime: 50,
      notMvImpressions: 48,
      oppositePartyHasBadge: 40,
      oppositePartyHasBusinessIntent: 22,
      ordersSent: 23,
      pdpInquiriesSent: 24,
      pdpViews: 25,
      quickRepliesSent: 26,
      smbMarketingMessagesReactionsSent: 27,
      smbMarketingMessagesRepliesSent: 28,
      smbMarketingMessagesSpamReports: 29,
      smbMarketingMsgsReceived: 30,
      smbMarketingMsgsSent: 31,
      threadCreationDate: 39,
      threadDs: 32,
      threadId: 33,
      threadIdByLid: 38,
      userHasBusinessIntent: 35
    }
  },
  ThreadInteractionDataCoreConsumer: {
    id: 6466,
    weight: 1,
    props: {
      afterReadDuration: 138,
      afterReadMessagesExpired: 139,
      afterReadMessagesReceived: 144,
      afterReadMessagesSent: 140,
      afterReadMessagesUnreadExpired: 141,
      afterReadTurnedOff: 142,
      afterReadTurnedOn: 143,
      audioMessagesReceived: 1,
      audioMessagesSent: 2,
      broadcastMsgsReceived: 3,
      broadcastMsgsSent: 4,
      chatEphemeralityDuration: 6,
      chatMuted: 7,
      chatOverflowClicks: 8,
      chatTypeInd: 9,
      commentsReceived: 10,
      documentMessagesReceived: 13,
      documentMessagesSent: 14,
      editedMsgsSent: 15,
      ephemeralMessagesExpired: 110,
      ephemeralMessagesReceived: 16,
      ephemeralMessagesSent: 17,
      ephemeralMessagesUnreadExpired: 18,
      eventCreationMessagesReceived: 21,
      eventCreationMessagesSent: 22,
      eventResponseMessagesReceived: 23,
      eventResponseMessagesSent: 24,
      forwardAudioMessagesReceived: 25,
      forwardAudioMessagesSent: 26,
      forwardDocumentMessagesReceived: 27,
      forwardDocumentMessagesSent: 28,
      forwardGifMessagesReceived: 29,
      forwardGifMessagesSent: 30,
      forwardMessagesReceived: 31,
      forwardMessagesSent: 32,
      forwardPhotoMessagesReceived: 33,
      forwardPhotoMessagesSent: 34,
      forwardPtvMessagesReceived: 134,
      forwardPtvMessagesSent: 135,
      forwardStickerMessagesReceived: 35,
      forwardStickerMessagesSent: 36,
      forwardTextMessagesReceived: 37,
      forwardTextMessagesSent: 38,
      forwardUrlMessagesReceived: 39,
      forwardUrlMessagesSent: 40,
      forwardVideoMessagesReceived: 41,
      forwardVideoMessagesSent: 42,
      gaStatus: 43,
      gifMessagesReceived: 44,
      gifMessagesSent: 45,
      groupMembershipReplies: 47,
      groupPrivateReplies: 48,
      groupSize: 49,
      groupStatusLikesOthersToOthers: 113,
      groupStatusLikesOthersToOwn: 114,
      groupStatusLikesOwnToOthers: 115,
      groupStatusLikesOwnToOwn: 116,
      groupStatusRepliesOthersToOthers: 117,
      groupStatusRepliesOthersToOwn: 118,
      groupStatusRepliesOwnToOthers: 119,
      groupStatusRepliesOwnToOwn: 120,
      hasReplied1On1: 145,
      hasUsername: 50,
      hasUsernamePin: 51,
      isAContact: 52,
      isAContactAtThreadCreation: 53,
      isAGroup: 54,
      isArchived: 55,
      isDeleted: 57,
      isGuestThread: 112,
      isInviteCreatedThread: 58,
      isManagedAccount: 121,
      isMessageYourself: 136,
      isMetaAiAssistant: 59,
      isNewManagedAccountEmIgnored: 122,
      isPinned: 60,
      isPnhEnabledChat: 61,
      isUsernameThread: 123,
      isUsernameThreadAtCreation: 137,
      limitSharingOption: 124,
      markedReadCnt: 62,
      markedReadMessageCnt: 63,
      matchedMessagesMarkedAsReadWithDeltaTime: 131,
      matchedMessagesReadWithDeltaTime: 132,
      messagesRead: 64,
      messagesReceived: 65,
      messagesReceivedWithEnabledReadReceipt: 133,
      messagesSent: 66,
      messagesUnread: 68,
      oppositePartyHasProfilePhoto: 146,
      oppositePartyLimitSharingOption: 125,
      oppositeVisibleIdentification: 69,
      photoMessagesReceived: 70,
      photoMessagesSent: 71,
      pollCreationMessagesReceived: 72,
      pollCreationMessagesSent: 73,
      pollUpdateMessagesReceived: 74,
      pollUpdateMessagesSent: 75,
      profileReplies: 76,
      profileViews: 77,
      pttMessagesReceived: 78,
      pttMessagesSent: 79,
      ptvMessagesReceived: 80,
      ptvMessagesSent: 81,
      reactionsReceived: 82,
      reactionsSent: 83,
      repliesSent: 85,
      requestedPhoneNumber: 86,
      seenMaskedPhoneNumber: 87,
      sharedPhoneNumber: 89,
      sharesCommonGroup: 107,
      statusReactionsReceived: 90,
      statusReactionsSent: 126,
      statusReplies: 91,
      statusReplyMessagesReceived: 127,
      statusViews: 92,
      stickerMessagesReceived: 93,
      stickerMessagesSent: 94,
      textMessagesReceived: 95,
      textMessagesSent: 96,
      threadCreationDate: 111,
      threadDs: 97,
      threadId: 98,
      threadIdByLid: 109,
      tombstoneAiFutureproofedMessagesReceived: 130,
      tombstoneEphemeralMessagesReceived: 128,
      tombstoneViewOnceMessagesReceived: 129,
      typeOfGroup: 108,
      urlMessagesReceived: 99,
      urlMessagesSent: 100,
      videoMessagesReceived: 102,
      videoMessagesSent: 103,
      viewOnceMessagesOpened: 104,
      viewOnceMessagesReceived: 105,
      viewOnceMessagesSent: 106
    }
  },
  ThreadInteractionDataIntegrity: {
    id: 6468,
    weight: 1,
    props: {
      blockReason: 1,
      isBlocked: 2,
      isReported: 3,
      smbMarketingMessagesSpamReports: 4,
      spamReports: 5,
      threadCreationDate: 9,
      threadDs: 6,
      threadId: 7,
      threadIdByLid: 8
    }
  },
  ForwardActionUserJourney: {
    id: 6506,
    weight: 1,
    props: {
      appSessionId: 1,
      forwardActionUserJourneyAction: 2,
      forwardUserJourneyFunnelId: 11,
      messageIsFromMe: 3,
      messageMediaType: 4,
      messageType: 5,
      uiSurface: 6,
      unifiedSessionId: 9,
      userJourneyChatType: 7,
      userJourneyEventMs: 12,
      userJourneyFunnelId: 8
    }
  },
  MmDisclosureStateEvent: {
    id: 6552,
    weight: 1,
    props: {
      businessLidOrJid: 1,
      deltaTimeReceived: 15,
      disclosureEventType: 3,
      disclosureInteraction: 4,
      disclosureSource: 5,
      disclosureSuppressionReason: 6,
      disclosureSurface: 7,
      entSourceSubplatform: 16,
      isCompanionDevice: 14,
      isNetworkAvailable: 18,
      isUserDisclosed: 8,
      mmDisclosureFlags: 19,
      mmHasDisclosedUrl: 9,
      mmHasShowDisclosureFlag: 10,
      templateId: 11,
      userBecameDisclosed: 13
    }
  },
  MmSignalSharingVerificationEvent: {
    id: 6554,
    weight: 1,
    props: {
      accountLinked: 28,
      businessLidOrJid: 1,
      collectionWindowId: 3,
      consentSource: 29,
      deltaTimeReceived: 18,
      entSourceSubplatform: 17,
      isCompanionDevice: 16,
      isIabRestore: 22,
      isLatestConversionToken: 24,
      isNetworkAvailable: 20,
      isShimmingSignal: 21,
      isUserDisclosed: 4,
      mmConversationDepth: 25,
      mmConversationRepeat: 26,
      mmDirectionFrom: 27,
      onePdSignalNotSharedReason: 5,
      signalCanceledReason: 6,
      signalMessageState: 7,
      signalMessageType: 8,
      signalOrigin: 9,
      signalSharingStatus: 10,
      signalSurface: 11,
      signalType: 12,
      signalTypeOrigin: 23,
      spSignalNotSharedReason: 13,
      templateId: 14
    }
  },
  CtwaAdCreationAndManagementJourney: {
    id: 6562,
    weight: 1,
    props: {
      ctwaAdAccountType: 1,
      extraAttributes: 2,
      lwiActionType: 3,
      lwiEntryPoint: 4,
      lwiFlowId: 5,
      lwiSubEntryPoint: 6,
      lwiSurface: 7,
      seqId: 8,
      targetComponent: 9,
      unifiedSessionId: 10,
      waAdAccountEligibility: 11,
      waAdAccountId: 12
    }
  },
  ContactSearchExperience: {
    id: 6574,
    weight: 1,
    props: {
      contactSearchEntrypoint: 5,
      isUsernameSearch: 1,
      searchActionName: 2,
      searchStartsWithAt: 4
    }
  },
  WefrGroupClientExposure: {
    id: 6640,
    weight: 1,
    props: { exposureKey: 1, groupJid: 2, sentWithDaily: 3 }
  },
  StatusViewerAction: {
    id: 6692,
    weight: 1,
    props: {
      attributionType: 1,
      attributionTypes: 3,
      externalSourceDomainType: 5,
      statusCategory: 4,
      urlStatusClicked: 6,
      urlStatusType: 7,
      viewerActionType: 2
    }
  },
  DangerousFileOpenStatsV2: {
    id: 6708,
    weight: 1,
    props: { harmfulFileWarningClickthroughAction: 1, harmfulFileWarningSenderRelationship: 2 }
  },
  MmCollectionWindowStateEvent: {
    id: 6744,
    weight: 1,
    props: {
      businessLidOrJid: 1,
      entSourceSubplatform: 7,
      isUserDisclosed: 8,
      mmDisclosureFlags: 6,
      mmHasDisclosedToken: 2,
      mmHasDisclosedUrl: 3,
      mmHasShowDisclosureFlag: 4,
      mmHasUndisclosedToken: 9,
      templateId: 5
    }
  },
  SmbQpCallHealth: {
    id: 6746,
    weight: 1,
    props: { fetchExceptionMessage: 1, fetchMechanism: 2, fetchResult: 3 }
  },
  MmDisclosureStateFsEvent: {
    id: 6796,
    weight: 1,
    props: {
      disclosureEventType: 1,
      disclosureInteraction: 2,
      disclosureSource: 3,
      disclosureSuppressionReason: 4,
      disclosureSurface: 5,
      isCompanionDevice: 6,
      isUserDisclosed: 7,
      mmDisclosureFlags: 12,
      mmHasDisclosedUrl: 8,
      mmHasShowDisclosureFlag: 9,
      threadIdHmac: 10,
      userBecameDisclosed: 11
    }
  },
  MmSignalSharingVerificationFsEvent: {
    id: 6798,
    weight: 1,
    props: {
      accountLinked: 19,
      consentSource: 20,
      isCompanionDevice: 1,
      isLatestConversionToken: 15,
      isShimmingSignal: 13,
      isUserDisclosed: 2,
      mmConversationDepth: 16,
      mmConversationRepeat: 17,
      mmDirectionFrom: 18,
      onePdSignalNotSharedReason: 3,
      signalCanceledReason: 4,
      signalMessageState: 5,
      signalMessageType: 6,
      signalOrigin: 7,
      signalSharingStatus: 8,
      signalSurface: 9,
      signalType: 10,
      signalTypeOrigin: 14,
      spSignalNotSharedReason: 11,
      threadIdHmac: 12
    }
  },
  AboutConsumption: { id: 6814, weight: 1, props: { aboutConsumptionSurface: 1 } },
  AboutConsumptionDaily: {
    id: 6816,
    weight: 1,
    props: {
      aboutChatBubbleTapCount: 1,
      aboutChatConsumptionCount: 2,
      aboutLocale: 3,
      aboutMessageSendCount: 4
    }
  },
  AboutCreation: {
    id: 6818,
    weight: 1,
    props: {
      aboutDuration: 1,
      aboutEntrypoint: 2,
      aboutLength: 3,
      aboutLocale: 4,
      aboutOverallT: 5,
      aboutPresetSelected: 6,
      aboutPrompt: 9,
      aboutRequestType: 7,
      preset: 8
    }
  },
  AboutCreationDaily: {
    id: 6820,
    weight: 1,
    props: {
      aboutCreationStarted: 1,
      aboutCreationVisit: 2,
      aboutEntrypoint: 3,
      aboutFailureCount: 4,
      aboutLocale: 5,
      aboutSuccessCount: 6
    }
  },
  MessageCapping: {
    id: 6854,
    weight: 1,
    props: {
      extraAttributes: 2,
      messageCappingActionType: 6,
      messageCappingEntryPoint: 9,
      messageCappingSequence: 7,
      messageCappingSession: 8,
      surface: 4,
      userActionTarget: 5
    }
  },
  MmSignalSharingVerificationWithSignalDataEvent: {
    id: 6856,
    weight: 1,
    props: {
      accountLinked: 23,
      consentSource: 24,
      entSourceSubplatform: 1,
      isCompanionDevice: 2,
      isLatestConversionToken: 19,
      isNetworkAvailable: 16,
      isShimmingSignal: 17,
      isUserDisclosed: 3,
      isUserMatched: 4,
      mmConversationDepth: 20,
      mmConversationRepeat: 21,
      mmDirectionFrom: 22,
      mmSignalData: 5,
      onePdSignalNotSharedReason: 6,
      signalCanceledReason: 7,
      signalMessageState: 8,
      signalMessageType: 9,
      signalOrigin: 10,
      signalSharingStatus: 11,
      signalSurface: 12,
      signalType: 13,
      signalTypeOrigin: 18,
      spSignalNotSharedReason: 14
    }
  },
  PsRichOrderStatusMessageInconsistentPayloadReceived: {
    id: 6938,
    weight: 1,
    props: {
      businessJid: 1,
      hasCurrencyChanged: 2,
      hasHeaderImageChanged: 3,
      hasItemImageChanged: 4,
      hasItemNameChanged: 5,
      hasItemNumberChanged: 6,
      hasItemPriceChanged: 7,
      hasItemQuantityChanged: 8,
      hasItemVariantChanged: 9
    }
  },
  QbmRichOrderStatusInteraction: {
    id: 6940,
    weight: 1,
    props: {
      actionTypeRichOrderStatus: 1,
      chatsFolderType: 2,
      contactType: 3,
      decisionId: 4,
      deltaTime: 5,
      deltaTimeReceived: 6,
      entryPoint: 7,
      hsmTagStr: 8,
      isBizIntent: 9,
      isBroadcastMessage: 10,
      isInsubContact: 11,
      isMuted: 12,
      messageIdHmac: 13,
      qbmFlag: 14,
      readReceiptsEnabled: 15,
      threadIdHmac: 16,
      unifiedSessionId: 17
    }
  },
  GroupMemberTagUpdate: {
    id: 7010,
    weight: 1,
    props: {
      groupId: 1,
      groupMemberTagUpdateAction: 2,
      hasMemberTagAtStart: 3,
      memberTagEntryPoint: 4,
      uiSurface: 5,
      unifiedSessionId: 6,
      userJourneyEventMs: 7
    }
  },
  PsFmxAction: {
    id: 7054,
    weight: 1,
    props: {
      commonGroupNum: 1,
      countryShown: 2,
      fmxEntryPoint: 3,
      fmxEvent: 4,
      highlightGroupType: 5,
      isSenderSmb: 6,
      isSuspiciousFmx: 8,
      newAccountShown: 9,
      notAContactShown: 7
    }
  },
  GroupHistoryReceiverUserJourney: {
    id: 7064,
    weight: 1,
    props: {
      groupHistoryDbIgnoredOlderMessages: 9,
      groupHistoryMessagesCount: 1,
      groupHistoryOutWindowPinsCount: 12,
      groupHistoryPinsCount: 13,
      groupHistoryReceiverActionType: 2,
      groupHistoryReceiverGroupId: 3,
      groupHistoryUncountedMessagesCount: 14,
      isAutoProcess: 4,
      messageKeyHash: 10,
      messageReceivedTs: 5,
      receiverFailureReason: 11,
      uiSurface: 6,
      unifiedSessionId: 7,
      userJourneyMs: 8
    }
  },
  DialogEvent: {
    id: 7068,
    weight: 1,
    props: { dialogEventSource: 1, dialogEventType: 2, dialogName: 3 }
  },
  BusinessTemplateRichOrderStatus: {
    id: 7076,
    weight: 1,
    props: {
      actionTypeRichOrderStatus: 1,
      businessJid: 2,
      chatsFolderType: 3,
      contactType: 4,
      isBizIntent: 5,
      isInsubContact: 6,
      isMuted: 7,
      readReceiptsEnabled: 8,
      templateId: 9
    }
  },
  MentionPickerAction: {
    id: 7082,
    weight: 1,
    props: {
      groupSize: 1,
      groupTypeClient: 2,
      isAGroup: 3,
      mentionGroupId: 6,
      mentionType: 4,
      threadId: 5
    }
  },
  AboutInteraction: { id: 7084, weight: 1, props: { aboutConsumptionSurface: 1, aboutLocale: 2 } },
  MediaHubUserJourney: {
    id: 7090,
    weight: 1,
    props: {
      customFields: 1,
      mediaHubAction: 2,
      mediaHubEntryPoint: 3,
      mediaHubSequenceNumber: 4,
      mediaHubSessionId: 5,
      mediaHubSurface: 6,
      unifiedSessionId: 7
    }
  },
  DefenseModeClick: {
    id: 7096,
    weight: 1,
    props: { controlName: 1, defenseModeClickAccepted: 2, desiredState: 3 }
  },
  DefenseModeQuarantine: {
    id: 7098,
    weight: 1,
    props: {
      defenseModeQuarantineEventCount: 2,
      defenseModeQuarantineIsCapi: 3,
      jidDomain: 4,
      quarantineAction: 1
    }
  },
  SmbListEvent: {
    id: 7102,
    weight: 1,
    props: {
      appSessionId: 17,
      bulkLabeling: 12,
      currentListState: 13,
      customListTitle: 1,
      entryPointConversionSource: 2,
      extraAttributes: 18,
      labelOperation: 3,
      labelTarget: 14,
      lastMessageDirection: 4,
      listId: 5,
      listIndex: 6,
      listType: 7,
      listsApplied: 15,
      listsRemoved: 16,
      messageDepth: 8,
      predefinedId: 9,
      smbListFeatureName: 20,
      smbListSurface: 21,
      threadIdHmac: 10,
      updateEntryPoint: 11,
      userActionTarget: 19
    }
  },
  NewsletterEnforcementEvents: {
    id: 7112,
    weight: 1,
    props: {
      cid: 1,
      enforcementInteractionEvent: 2,
      enforcementType: 3,
      interactionEntryPoint: 4,
      interactionSurface: 5,
      newsletterEnforcementSessionId: 6,
      violationCategory: 7
    }
  },
  ChannelOpenFromInvite: {
    id: 7134,
    weight: 1,
    props: { channelEntryPoint: 1, channelUserType: 2, cid: 4, discoverySurface: 3 }
  },
  GuestUpsellInteraction: {
    id: 7146,
    weight: 1,
    props: { guestUpsellAction: 1, guestUpsellEntryPoint: 2 }
  },
  DyiReportDownload: {
    id: 7162,
    weight: 1,
    props: { dyiDownloadErrorMessage: 3, dyiDownloadSucceeded: 1, dyiReportType: 2 }
  },
  DyiReportRequest: { id: 7166, weight: 1, props: { dyiReportType: 1, dyiTriggerType: 2 } },
  GroupBulkRemoval: {
    id: 7222,
    weight: 1,
    props: {
      appSessionId: 1,
      bulkRemovalGroupId: 2,
      groupBulkRemovalAction: 3,
      groupBulkRemovalEntryPoint: 4,
      removedMembersCount: 5
    }
  },
  AiThreadsUserJourney: {
    id: 7224,
    weight: 1,
    props: {
      aiSessionId: 1,
      appSessionId: 2,
      conversationThreadCreationTs: 3,
      conversationThreadId: 4,
      eventTsMs: 5,
      isCanonicalThread: 10,
      isIncognitoMode: 6,
      metaAiActionEntryPoint: 9,
      rawBotEntryPoint: 7,
      threadActionType: 8
    }
  },
  BroadcastInvalidChannelsContextSourceMessageDrop: {
    id: 7284,
    weight: 1,
    props: { wasDropped: 1 }
  },
  CanonicalEntRecoveryCompanion: {
    id: 7434,
    weight: 1,
    props: {
      canonicalEntEventCompanionMarker: 1,
      canonicalEntFeatureName: 8,
      canonicalEntRecoveryCompanionEvent: 2,
      canonicalEntRecoveryEventMetadata: 12,
      canonicalEntRecoveryTimeoutSeconds: 9,
      canonicalEntRegistrationTraceId: 3,
      canonicalEntRequestId: 4,
      canonicalEntSequenceNumberSinceLastRegistration: 7,
      canonicalEntStorageSource: 10,
      deviceId: 5,
      familyDeviceId: 6,
      traceIdInt: 11
    }
  },
  CanonicalEntRecoveryCriticalEvent: {
    id: 7442,
    weight: 1,
    props: {
      canonicalEntRecoveryCriticalEventMetadata: 1,
      canonicalEntRecoveryCriticalEventName: 2,
      canonicalEntRegistrationTraceId: 3,
      canonicalEntRequestId: 4,
      canonicalEntSequenceNumberSinceLastRegistration: 7,
      deviceId: 5,
      familyDeviceId: 6,
      traceIdInt: 8
    }
  },
  WebcWebtpPdfViewer: {
    id: 7506,
    weight: 1,
    props: {
      webtpErrorCode: 1,
      webtpErrorMessage: 2,
      webtpErrorStack: 3,
      webtpErrorType: 4,
      webtpEvent: 5,
      webtpFileSize: 6,
      webtpSdkVersion: 7,
      webtpSessionId: 8,
      webtpSource: 9,
      webtpTelemetryData: 10
    }
  },
  StructuredMessageBuyerInteraction: {
    id: 7518,
    weight: 1,
    props: {
      bizPlatform: 1,
      messageClass: 2,
      messageClassAttributes: 3,
      messageInteraction: 4,
      messageMediaType: 5
    }
  },
  StructuredMessageBuyerReceive: {
    id: 7520,
    weight: 1,
    props: {
      bizPlatform: 1,
      messageClass: 2,
      messageClassAttributes: 3,
      messageInteraction: 4,
      messageMediaType: 5
    }
  },
  GroupSuspensionAppealEvents: {
    id: 7574,
    weight: 1,
    props: {
      groupJid: 5,
      groupSuspensionAppealErrorMessage: 6,
      groupSuspensionAppealUiAction: 1,
      groupSuspensionAppealUiSurface: 2,
      groupTypeClient: 3,
      isAdmin: 4
    }
  },
  PinnedChatsMaxAlert: {
    id: 7606,
    weight: 1,
    props: { addToListSelected: 1, premiumStatus: 2, subscribeSelected: 3 }
  },
  UsernameExposed: { id: 7614, weight: 1, props: { usernameExposureContext: 1 } },
  PinnedChats: { id: 7630, weight: 1, props: { pinnedChatNumber: 1, pinnedChatsPremiumStatus: 2 } },
  MdLabelSyncTracking: {
    id: 7638,
    weight: 1,
    props: {
      labelSyncDeviceRole: 1,
      labelSyncDirection: 2,
      labelSyncHasPending: 3,
      labelSyncHash: 4,
      labelSyncIsCapiHosted: 5,
      labelSyncIsLabeled: 6,
      labelSyncPredefinedId: 10,
      labelSyncResult: 7,
      labelSyncTimestamp: 8,
      labelSyncType: 9
    }
  },
  PaidMessageVpvImpression: {
    id: 7652,
    weight: 1,
    props: {
      bodyUrlCountInt: 1,
      bodyUrlUniqueCountInt: 2,
      buttonValueJsonArray: 3,
      chatsFolderType: 4,
      contactType: 5,
      ctaUrlUniqueCountInt: 6,
      decisionId: 7,
      deltaTime: 8,
      deltaTimeReceived: 9,
      hsmTagStr: 10,
      isBizIntent: 11,
      isBroadcastMessage: 12,
      isInsubContact: 13,
      isMuted: 14,
      messageBodyType: 25,
      messageBubbleHeightPx: 27,
      messageBubbleWidthPx: 28,
      messageFieldJsonArray: 15,
      messageIdHmac: 16,
      mmCarouselCardIndex: 26,
      qbmFlag: 17,
      readReceiptsEnabled: 18,
      submessageFieldJsonArray: 19,
      threadIdHmac: 20,
      unifiedSessionId: 21,
      urlUniqueCountInt: 22,
      vpvDwellTimeMs: 23,
      vpvJsonObject: 24
    }
  },
  ConsumerBizInteractionJourney: {
    id: 7760,
    weight: 1,
    props: {
      businessJid: 9,
      consumerBizActionTarget: 1,
      consumerBizActionType: 2,
      consumerBizEntryPoint: 3,
      consumerBizExtraAttributes: 4,
      consumerBizFeature: 5,
      consumerBizSeqId: 6,
      consumerBizSessionId: 7,
      consumerBizSurface: 8,
      sensitiveExtraAttributes: 10
    }
  },
  GroupMemberUpdates: {
    id: 7768,
    weight: 1,
    props: {
      fetchedMessageCount: 1,
      fetchedMessageLatency: 5,
      groupMemberUpdatesActionName: 2,
      groupMemberUpdatesCurrentScreen: 3,
      groupMemberUpdatesSessionId: 4
    }
  },
  MdLinkedDevicesWindowsXdr: {
    id: 7804,
    weight: 1,
    props: {
      mdLinkedDevicesWindowsXdrStage: 1,
      mdXdrDebounceTimeoutInMs: 2,
      mdXdrErrorReason: 3,
      mdXdrPayload: 4,
      mdXdrSessionUuid: 5,
      mdXdrTransportType: 6
    }
  },
  HatchUserJourney: {
    id: 7806,
    weight: 1,
    props: { aiSessionId: 1, botEntryPoint: 2, hatchActionType: 3, unifiedSessionId: 4 }
  },
  MmSignalRealtimeWeb: {
    id: 7860,
    weight: 1,
    props: { mmCarouselCardIndex: 1, mmCtaButtonIndex: 2, mmSignalData: 3, mmSignalType: 4 }
  },
  MmSignalUndisclosedWeb: {
    id: 7862,
    weight: 1,
    props: { mmCarouselCardIndex: 1, mmCtaButtonIndex: 2, mmSignalData: 3, mmSignalType: 4 }
  },
  ArInterstitialScreenImpression: {
    id: 7890,
    weight: 1,
    props: { accountAfterReadDuration: 1, afterReadScreenEntryPoint: 2, nuxVersion: 3 }
  },
  WaPlusBenefitUserJourney: {
    id: 7896,
    weight: 1,
    props: {
      wpbujAction: 1,
      wpbujActionTarget: 11,
      wpbujBenefitStatus: 2,
      wpbujBenefitType: 3,
      wpbujCustomFields: 4,
      wpbujErrorMessage: 5,
      wpbujOutcomeName: 6,
      wpbujSessionId: 7,
      wpbujSource: 8,
      wpbujSurface: 9,
      wsuaProductType: 10
    }
  },
  AudienceManagement: {
    id: 7900,
    weight: 1,
    props: {
      audienceEventSurface: 1,
      audienceExtraData: 2,
      audienceManagementAction: 3,
      audiencePredicateType: 4,
      audienceResolutionTrigger: 5
    }
  },
  WebcWhatsNewImpression: {
    id: 8200,
    weight: 1,
    props: {
      webcWhatsNewAction: 1,
      webcWhatsNewSurface: 2,
      webcWhatsNewTimeSpent: 3,
      webcWhatsNewVariant: 4
    }
  },
  CompanionInviteContact: {
    id: 8230,
    weight: 1,
    props: {
      companionInviteAction: 8,
      companionInviteCodeError: 1,
      companionInviteMethod: 2,
      companionInviteNumContactsAddressBook: 3,
      companionInviteNumContactsWa: 4,
      companionInviteOrigin: 5,
      companionInviteSessionId: 6,
      companionValidInviteCode: 7
    }
  },
  SmbPerCustomerDataSharingControl: {
    id: 8232,
    weight: 1,
    props: {
      smbPerCustomerDataSharingControlAction: 1,
      smbPerCustomerDataSharingControlActionOptInStatus: 2,
      smbPerCustomerDataSharingControlCurrentOptInStatus: 3,
      smbPerCustomerDataSharingControlEntryPoint: 4,
      smbPerCustomerDataSharingControlGlobalDataSharingEntryPoint: 6,
      smbPerCustomerDataSharingControlOptInCustomerCount: 7,
      smbPerCustomerDataSharingControlVersion: 5
    }
  },
  WaffleCompanionStateLifecycle: {
    id: 8248,
    weight: 1,
    props: {
      waffleLifecycleElapsedMs: 1,
      waffleLifecycleErrorAction: 2,
      waffleLifecycleErrorCode: 3,
      waffleLifecycleHasAccessToken: 4,
      waffleLifecycleHasExistingRow: 5,
      waffleLifecycleLinkState: 6,
      waffleLifecycleRetryCount: 7,
      waffleLifecycleTraceAction: 8,
      waffleLifecycleTraceSource: 9,
      waffleLifecycleUnlinkType: 10
    }
  },
  StatusPogImpression: {
    id: 8302,
    weight: 1,
    props: {
      cid: 1,
      pogIndex: 2,
      statusCategory: 3,
      statusGroupId: 4,
      statusPosterHashId: 5,
      statusPosterId: 6,
      statusViewEntrypoint: 7,
      tsSurface: 8
    }
  },
  WebcQuickAction: {
    id: 8326,
    weight: 1,
    props: {
      webcQuickActionEventType: 1,
      webcQuickActionId: 2,
      webcQuickActionIsCustomized: 3,
      webcQuickActionNumVisible: 4,
      webcQuickActionSlotPosition: 5,
      webcQuickActionSurface: 6
    }
  }
};
var WAM_GLOBALS = {
  abKey2: 4473,
  appBuild: 1657,
  appIsBetaRelease: 21,
  appVersion: 17,
  beaconSessionId: 18529,
  browser: 779,
  browserVersion: 295,
  datacenter: 2795,
  deviceClassification: 14507,
  deviceName: 13,
  deviceVersion: 4505,
  expoKey: 5029,
  isInCohort: 19129,
  mcc: 5,
  memClass: 655,
  mnc: 3,
  networkIsWifi: 23,
  numCpu: 10317,
  ocVersion: 6251,
  osVersion: 15,
  platform: 11,
  psCountryCode: 6833,
  psId: 6005,
  serviceImprovementOptOut: 13293,
  streamId: 3543,
  wametaLoggerTestFilter: 15881,
  webcBucket: 875,
  webcEnv: 633,
  webcNativeAutolaunch: 1009,
  webcNativeBetaUpdates: 1007,
  webcPhoneAppVersion: 1005,
  webcPhoneCharging: 783,
  webcPhoneDeviceManufacturer: 829,
  webcPhoneDeviceModel: 831,
  webcPhoneOsBuildNumber: 833,
  webcPhoneOsVersion: 835,
  webcPhonePlatform: 707,
  webcRevision: 18491,
  webcTabId: 3727,
  webcWebArch: 6605,
  webcWebDeviceManufacturer: 6599,
  webcWebDeviceModel: 6601,
  webcWebOsReleaseNumber: 6603,
  webcWebPlatform: 899,
  yearClass: 689,
  yearClass2016: 2617,
  commitTime: 47,
  sequenceNumber: 3433
};

// src/wam/index.ts
var FLAG_GLOBAL = 0;
var FLAG_EVENT = 1;
var FLAG_FIELD = 2;
var FLAG_EXTENDED = 4;
var FLAG_BYTE = 8;
function header(buf, key, flag) {
  if (key < 256) buf.push(flag, key);
  else buf.push(flag | FLAG_BYTE, key & 255, key >> 8);
}
function serialize(key, raw, flag) {
  const out = [];
  const value = typeof raw === "boolean" ? raw ? 1 : 0 : raw;
  if (value === null) {
    if (flag === FLAG_GLOBAL) {
      header(out, key, flag);
      return out;
    }
    throw new Error(`WAM: null is only valid for globals (key ${key})`);
  }
  if (typeof value === "number") {
    const b = Buffer.alloc(8);
    if (Number.isInteger(value)) {
      if (value === 0 || value === 1) return header(out, key, flag | value + 1 << 4), out;
      if (value >= -128 && value < 128) {
        header(out, key, flag | 3 << 4);
        b.writeInt8(value);
        return out.concat([...b.subarray(0, 1)]);
      }
      if (value >= -32768 && value < 32768) {
        header(out, key, flag | 4 << 4);
        b.writeInt16LE(value);
        return out.concat([...b.subarray(0, 2)]);
      }
      if (value >= -2147483648 && value < 2147483648) {
        header(out, key, flag | 5 << 4);
        b.writeInt32LE(value);
        return out.concat([...b.subarray(0, 4)]);
      }
    }
    header(out, key, flag | 7 << 4);
    b.writeDoubleLE(value);
    return out.concat([...b]);
  }
  const bytes2 = Buffer.from(value, "utf8");
  if (bytes2.length < 256) {
    header(out, key, flag | 8 << 4);
    out.push(bytes2.length);
  } else if (bytes2.length < 65536) {
    header(out, key, flag | 9 << 4);
    out.push(bytes2.length & 255, bytes2.length >> 8);
  } else {
    header(out, key, flag | 10 << 4);
    const l = Buffer.alloc(4);
    l.writeUInt32LE(bytes2.length);
    out.push(...l);
  }
  return out.concat([...bytes2]);
}
function encodeWam(events, sequence = 0, protocolVersion = 5) {
  const out = [
    87,
    65,
    77,
    protocolVersion,
    1,
    sequence >> 8 & 255,
    sequence & 255,
    0
  ];
  for (const e of events) {
    const def = WAM_EVENTS[e.name];
    if (!def) throw new Error(`unknown WAM event ${e.name}`);
    for (const [g, v] of Object.entries(e.globals ?? {})) {
      const id = WAM_GLOBALS[g];
      if (id === void 0) throw new Error(`unknown WAM global ${g}`);
      out.push(...serialize(id, v, FLAG_GLOBAL));
    }
    const props = Object.entries(e.props ?? {});
    const hasProps = props.length > 0;
    out.push(...serialize(def.id, -def.weight, hasProps ? FLAG_EVENT : FLAG_EVENT | FLAG_EXTENDED));
    props.forEach(([k, v], i) => {
      const id = def.props[k];
      if (id === void 0) throw new Error(`unknown property ${k} of WAM event ${e.name}`);
      const last = i === props.length - 1;
      out.push(...serialize(id, v, last ? FLAG_FIELD | FLAG_EXTENDED : FLAG_EVENT));
    });
  }
  return Buffer.from(out);
}

// src/client/client.ts
function signatureOf(m) {
  const field = Object.keys(m).find((k) => k !== "messageContextInfo") ?? "";
  const body = m[field];
  if (typeof body === "string") return `${field}:${body}`;
  const b = body ?? {};
  const text4 = b["text"] ?? b["caption"] ?? b["name"];
  return `${field}:${typeof text4 === "string" ? text4 : ""}`;
}
var Client = class {
  logger;
  #events = new TypedEmitter();
  #credsPath;
  #signalDir;
  #tcTokens;
  #autoRecover;
  #recoverTimes = [];
  #signalStorage;
  #rotating;
  #serverOffsetMs = 0;
  #options;
  #creds;
  #config;
  #conn;
  #receiver;
  #sender;
  #qrTimer;
  #keepAlive;
  #stopped = false;
  /** Set when the server ended the session for good (see `classifyServerFailure`): no reconnect, reported on close. */
  #terminal;
  /** A guest's private auth folder, removed again on `close()`. */
  #guestTmp;
  #isOpen = false;
  #mediaConn;
  #appState;
  #pairing;
  #ready = Promise.resolve();
  #isGuest;
  #guestRegistered = false;
  #guestLid;
  #guestSession;
  constructor(options = {}) {
    if (options.customPairingCode !== void 0 && !options.pairWithPhoneNumber)
      throw new Error("customPairingCode needs pairWithPhoneNumber");
    if (options.customPairingCode !== void 0) normalizePairingCode(options.customPairingCode);
    this.#options = options;
    this.#isGuest = Boolean(options.guest);
    const { dir, temporary } = resolveAuthDir(options);
    this.#guestTmp = temporary ? dir : void 0;
    this.#credsPath = (0, import_node_path11.join)(dir, "creds.json");
    this.#signalDir = (0, import_node_path11.join)(dir, "signal");
    this.#autoRecover = options.autoRecover !== false;
    this.#tcTokens = new TcTokens((0, import_node_path11.join)(dir, "signal", "tctokens.json"));
    this.logger = options.logger ?? new ProtocolLogger({ label: "client" });
    this.#creds = this.#isGuest ? initAuthCreds() : loadAuthCreds(this.#credsPath) ?? initAuthCreds();
    saveAuthCreds(this.#credsPath, this.#creds);
    this.#config = { ...DEFAULT_CONFIG, ...options.config };
    if (options.antiban) this.antiban = new AntiBan(options.antiban === true ? {} : options.antiban);
  }
  /** The outgoing-message limiter, when the `antiban` option is on. */
  antiban;
  on = (event, listener) => this.#events.on(event, listener);
  events = (event, signal) => this.#events.events(event, signal);
  /** The paired identity, once linked. */
  get me() {
    return this.#creds.me;
  }
  /** Connect (and pair if this device is not linked yet). Resolves when the socket is started. */
  async connect() {
    this.#stopped = false;
    if (!this.#options.config?.version) this.#config = await this.#resolveVersion();
    this.#start();
  }
  /** Resolves once logged in and ready. */
  ready() {
    if (this.#isOpen) return Promise.resolve();
    return new Promise((resolve2) => {
      const off = this.on("open", () => (off(), resolve2()));
    });
  }
  async #live() {
    await this.#ready;
    if (!this.#sender || !this.#receiver) throw new Error("not connected");
    if (!this.#isGuest && !this.#creds.me) throw new Error("not connected");
    return { sender: this.#sender, receiver: this.#receiver, meId: this.#creds.me?.id ?? "" };
  }
  /** Next id for a stanza built by hand (`request`/`sendCallAndWait`), e.g. `callSig.buildLinkJoin`. */
  async nextId() {
    return (await this.#live()).receiver.nextId();
  }
  /** Send a `<call>` stanza and wait for the server's matching `<ack class="call">` (20 s timeout by default). */
  async sendCallAndWait(node, timeoutMs) {
    return (await this.#live()).receiver.sendCallAndWait(node, timeoutMs);
  }
  /** Send text, optionally as a reply (`quoted`) and/or with @mentions. Returns the message id. */
  async sendText(to, text4, opts = {}) {
    const { sender, meId } = await this.#live();
    if (this.antiban?.config.typing && !to.endsWith("@newsletter")) {
      await this.sendChatState(to, "composing").catch(() => void 0);
      await new Promise((r) => setTimeout(r, this.antiban.typingMs(text4)));
      await this.sendChatState(to, "paused").catch(() => void 0);
    }
    let body = textMessage(text4);
    if (opts.linkPreview) {
      const p = opts.linkPreview === true ? await fetchLinkPreview(text4).catch(() => void 0) : opts.linkPreview;
      if (p) body = linkPreviewMessage(text4, p);
    }
    return sender.sendMessage(to, withContext(body, to, opts, meId));
  }
  /** Forward a received message (its WAProto content) to another chat. */
  async forwardMessage(to, message, score = 1) {
    return this.sendMessage(to, forward(message, score));
  }
  /**
   * Send anything with one call: `client.send(jid, { text: 'hi' })`, `{ image }`, `{ video }`, `{ audio, voiceNote }`,
   * `{ document, mimetype }`, `{ sticker }`, `{ poll }`, `{ location }`, `{ contacts }`, `{ react }`, `{ edit, text }`,
   * `{ revoke }`, `{ forward }`, `{ text, buttons }`, `{ text, sections, buttonText }`. Media can be bytes, a file
   * path or URL (`{ url }`) or a stream. Returns the message id.
   */
  send = (to, content, options) => sendContent(this, to, content, options);
  /** Send a raw stanza (an `iq`) and wait for its answer: the escape hatch for anything not wrapped yet. */
  request = async (node) => (await this.#live()).receiver.request(node);
  /** Send a raw stanza as-is, with no `id` added and no answer awaited (for stanzas such as `chatstate` and `ib`). */
  sendNode = async (node) => {
    ;
    (await this.#live()).receiver.sendNode(node);
  };
  /** Run any WhatsApp Web GraphQL (`w:mex`) query by id, e.g. the ones listed in baron-baileys-v2. */
  mex = (queryId, variables, dataPath) => mexFor(
    async (n) => (await this.#live()).receiver.request(n),
    () => `mex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  )(queryId, variables, dataPath);
  /** Send a raw WAProto `Message` object. */
  async sendMessage(to, message, opts = {}) {
    const { sender } = await this.#live();
    return sender.sendMessage(to, message, opts);
  }
  /** React to a message with an emoji (empty string removes the reaction). */
  async react(key, emoji) {
    const { sender } = await this.#live();
    const r = reaction(key, emoji);
    return sender.sendMessage(key.remoteJid, r.message, r.opts);
  }
  /** Edit the text of one of our own messages. */
  async edit(key, newText) {
    const { sender } = await this.#live();
    const r = edit(key, newText);
    return sender.sendMessage(key.remoteJid, r.message, r.opts);
  }
  /** Delete a message for everyone. */
  async revoke(key) {
    const { sender } = await this.#live();
    const r = revoke(key);
    return sender.sendMessage(key.remoteJid, r.message, r.opts);
  }
  async #getMediaConn() {
    const { receiver } = await this.#live();
    const c = this.#mediaConn;
    if (c && Date.now() - c.fetchedAt < c.ttl * 1e3) return c;
    return this.#mediaConn = parseMediaConn(
      await receiver.request(mediaConnRequest())
    );
  }
  /** Encrypt, upload and send an image / video / audio / document / sticker. */
  async sendMedia(to, type, data, opts = {}) {
    const { sender, meId } = await this.#live();
    const channel = to.endsWith("@newsletter");
    const enc2 = channel ? rawMedia(data) : encryptMedia(data, type);
    const uploaded = await uploadMedia(await this.#getMediaConn(), type, enc2, fetch, channel);
    const built = mediaMessage(type, enc2, uploaded, opts);
    if (channel) stripMediaKeys(built.message);
    if (opts.fields) {
      const key = Object.keys(built.message)[0];
      built.message[key] = { ...built.message[key], ...opts.fields };
    }
    if (channel && type === "video" && !uploaded.thumbnail && opts.jpegThumbnail) {
      const raw = rawMedia(opts.jpegThumbnail);
      const t = await uploadMedia(
        await this.#getMediaConn(),
        "image",
        raw,
        fetch,
        true,
        NEWSLETTER_THUMBNAIL_PATH
      );
      uploaded.thumbnail = { directPath: t.directPath, sha256: raw.fileSha256 };
    }
    if (uploaded.thumbnail && (type === "image" || type === "video")) {
      const body = built.message[Object.keys(built.message)[0]];
      body["thumbnailDirectPath"] = uploaded.thumbnail.directPath;
      body["thumbnailSha256"] = uploaded.thumbnail.sha256;
    }
    let message = withContext(built.message, to, opts, meId);
    if (opts.association)
      message = {
        ...message,
        messageContextInfo: {
          ...message["messageContextInfo"],
          messageAssociation: opts.association
        }
      };
    const field = Object.keys(message).find((k) => k !== "messageContextInfo");
    const authorLid = (this.#creds.me?.lid ?? "").replace(/[:.]\d+@/, "@");
    const gsSource = type === "audio" ? "AUDIO" : opts.contextInfo?.["statusSourceType"] === "MUSIC_STANDALONE" ? "MUSIC_STANDALONE" : type === "video" ? "VIDEO" : "IMAGE";
    const extraContext = {
      ...opts.contextInfo,
      ...opts.groupStatus && {
        ...groupStatusContext(
          authorLid,
          gsSource,
          opts.contextInfo?.["statusAttributions"] ?? []
        )
      },
      ...channel && { mediaDomainInfo: { mediaKeyDomain: "MEDIA_KEY_DOMAIN_NON_E2EE" } }
    };
    if (Object.keys(extraContext).length) {
      const body = message[field];
      message = {
        ...message,
        [field]: { ...body, contextInfo: { ...body["contextInfo"], ...extraContext } }
      };
    }
    const wire = opts.viewOnce ? viewOnce(message) : message;
    const gs = opts.groupStatus ? groupStatus(wire) : void 0;
    const q = opts.isQuestion ? question(wire) : void 0;
    let serverId;
    const id = await sender.sendMessage(to, gs ? gs.message : q ? q.message : wire, {
      // Group statuses go out like text: no mediatype on the enc node.
      ...!gs && { encAttrs: { mediatype: built.mediaType } },
      extraNodes: [
        ...gs?.opts.extraNodes ?? [],
        ...q?.opts.extraNodes ?? [],
        ...opts.extraNodes ?? []
      ],
      onAck: (ack) => serverId = ack.attrs["server_id"]
    });
    if (channel && serverId && opts.labels?.aiContent)
      await this.newsletters.labelAiContent(to, serverId);
    if (channel && serverId && opts.labels?.paidPartnership)
      await this.newsletters.labelPaidPartnership(to, serverId);
    return id;
  }
  sendImage = (to, data, opts = {}) => this.sendMedia(to, "image", data, opts);
  sendVideo = (to, data, opts = {}) => this.sendMedia(to, "video", data, opts);
  sendAudio = (to, data, opts = {}) => this.sendMedia(to, "audio", data, opts);
  sendDocument = (to, data, opts = {}) => this.sendMedia(to, "document", data, opts);
  sendSticker = (to, data, opts = {}) => this.sendMedia(to, "sticker", data, opts);
  /** Download and decrypt the media of a received message (`event.message`). */
  async downloadMedia(message, opts = {}) {
    const m = mediaOf(message);
    if (!m) throw new Error("message carries no downloadable media");
    try {
      return await downloadMedia(m.ref, m.type);
    } catch (e) {
      const text4 = `${e.message} ${e.cause?.message ?? ""}`;
      if (!this.#autoRecover || !opts.key || !/HTTP (404|410)\b/.test(text4)) throw e;
      const fresh = await this.updateMediaMessage(opts.key, message);
      const again = mediaOf(fresh);
      return downloadMedia(again.ref, again.type);
    }
  }
  async #peerDataOperation(request) {
    const { sender } = await this.#live();
    return sender.sendPeerMessage({
      protocolMessage: {
        type: "PEER_DATA_OPERATION_REQUEST_MESSAGE",
        peerDataOperationRequestMessage: request
      }
    });
  }
  /**
   * Send a sticker pack: WebP stickers (512x512, up to 60), a WebP cover and a JPEG thumbnail. The recipient
   * can add the whole pack to their stickers.
   */
  async sendStickerPack(to, pack) {
    const { sender } = await this.#live();
    const packId = pack.packId ?? newPackId();
    const zip = createStickerPackZip(packId, pack.stickers, pack.cover);
    const mediaKey = (0, import_node_crypto20.randomBytes)(32);
    const encZip = encryptMedia(zip.zip, "sticker-pack", mediaKey);
    const encThumb = encryptMedia(pack.thumbnail, "sticker-pack-thumbnail", mediaKey);
    const conn = await this.#getMediaConn();
    const [zipUp, thumbUp] = await Promise.all([
      uploadMedia(conn, "document", encZip, fetch, false, "/mms/sticker-pack"),
      uploadMedia(conn, "document", encThumb, fetch, false, "/mms/thumbnail-sticker-pack")
    ]);
    return sender.sendMessage(to, {
      stickerPackMessage: {
        stickerPackId: packId,
        name: pack.name,
        publisher: pack.publisher,
        stickers: zip.stickers,
        fileLength: encZip.fileLength,
        fileSha256: encZip.fileSha256,
        fileEncSha256: encZip.fileEncSha256,
        mediaKey,
        directPath: zipUp.directPath,
        mediaKeyTimestamp: Math.floor(Date.now() / 1e3),
        ...pack.caption !== void 0 && { caption: pack.caption },
        ...pack.description !== void 0 && { packDescription: pack.description },
        thumbnailDirectPath: thumbUp.directPath,
        thumbnailSha256: encThumb.fileSha256,
        thumbnailEncSha256: encThumb.fileEncSha256,
        stickerPackSize: zip.zip.length,
        trayIconFileName: zip.trayIconFileName
      }
    });
  }
  /**
   * Send an event card (invitation with name, time, place and an optional call link) to a chat or group.
   * Guests answer it; their answers arrive as messages with an `eventResponse` field.
   */
  async sendEvent(to, o) {
    const { sender } = await this.#live();
    return sender.sendMessage(to, eventMessage(o));
  }
  /**
   * Comment on a post in a Community Announcement Group (an announcement under a community). `parent` is the post's
   * key; it must have been received here (its secret is needed). Comments arrive as `addon` on the message.
   */
  async sendComment(parent, text4) {
    const { sender, receiver } = await this.#live();
    const secret = receiver.secretOf(parent.id);
    if (!secret) throw new Error("the secret of this post is unknown (it was not received here)");
    const me = this.#creds.me;
    if (!me) throw new Error("not paired");
    const strip = (j) => j.replace(/:\d+@/, "@");
    const author = parent.participant ?? (parent.fromMe ? me.id : parent.remoteJid);
    return sender.sendMessage(
      parent.remoteJid,
      commentMessage(parent, text4, {
        parentSenderJid: strip(author),
        modifierJid: strip(me.lid ?? me.id),
        secret
      })
    );
  }
  /**
   * Answer an event card: going, not going or maybe. `key` is the card's key and `creator` who sent it
   * (the card must have been seen by this client, because its secret is needed).
   */
  async respondToEvent(key, creator, response, extraGuestCount) {
    const { sender, receiver } = await this.#live();
    const secret = receiver.secretOf(key.id);
    if (!secret)
      throw new Error("the secret of this event is unknown (the card was not received here)");
    const me = this.#creds.me?.id;
    if (!me) throw new Error("not paired");
    const strip = (j) => j.replace(/:\d+@/, "@");
    return sender.sendMessage(
      key.remoteJid,
      eventResponse(
        key,
        { response, ...extraGuestCount !== void 0 && { extraGuestCount } },
        {
          eventMsgId: key.id,
          eventCreatorJid: strip(creator),
          responderJid: strip(
            creator.endsWith("@lid") && this.#creds.me?.lid ? this.#creds.me.lid : me
          ),
          secret
        }
      ),
      { encAttrs: { "decrypt-fail": "hide" } }
    );
  }
  /**
   * Ask the phone for older messages of a chat, starting before `oldest` (the oldest message you have).
   * The answer arrives as a `history` event.
   */
  fetchMessageHistory = (count, oldest, oldestTimestampMs) => this.#peerDataOperation({
    peerDataOperationRequestType: "HISTORY_SYNC_ON_DEMAND",
    historySyncOnDemandRequest: {
      chatJid: oldest.remoteJid,
      oldestMsgFromMe: !!oldest.fromMe,
      oldestMsgId: oldest.id,
      oldestMsgTimestampMs: oldestTimestampMs,
      onDemandMsgCount: count
    }
  });
  /**
   * Ask the phone to send a message again that arrived undecryptable ("Waiting for this message").
   * The answer arrives as a `message.resent` event.
   */
  requestPlaceholderResend = (key) => this.#peerDataOperation({
    peerDataOperationRequestType: "PLACEHOLDER_MESSAGE_RESEND",
    placeholderMessageResendRequest: [{ messageKey: key }]
  });
  /**
   * Ask the phone that sent a media message to upload it again (the file expired on WhatsApp's servers).
   * Returns the message with the new `directPath`, ready for `downloadMedia`.
   */
  async updateMediaMessage(key, message, timeoutMs = 3e4) {
    const m = mediaOf(message);
    if (!m) throw new Error("message carries no media");
    const me = this.#creds.me;
    if (!me) throw new Error("not paired");
    const ownUsers = new Set(
      [me.id, me.lid].filter((x) => !!x).map((x) => x.split(/[:@]/)[0])
    );
    const answer = new Promise((resolve2, reject) => {
      const timer = setTimeout(() => (off(), reject(new Error("media retry timed out"))), timeoutMs);
      const off = this.on("notification", ({ type, node }) => {
        if (type !== "mediaretry" || node.attrs["id"] !== key.id) return;
        const from = node.attrs["from"] ?? "";
        if (from !== "s.whatsapp.net" && !ownUsers.has(from.split(/[:@]/)[0])) return;
        const ev = decodeMediaRetryNode(node);
        if (!ev || ev.key.remoteJid !== key.remoteJid || !!ev.key.fromMe !== !!key.fromMe || (ev.key.participant ?? "") !== (key.participant ?? ""))
          return;
        if (ev.error) {
          clearTimeout(timer);
          off();
          reject(new Error(`media re-upload failed (${ev.error.code})`));
          return;
        }
        if (!ev.media) return;
        try {
          const r2 = decryptMediaRetry(ev.media, m.ref.mediaKey, key.id);
          clearTimeout(timer);
          off();
          resolve2(r2);
        } catch {
        }
      });
    });
    answer.catch(() => void 0);
    await this.#q(mediaRetryRequest(key, m.ref.mediaKey, me.lid ?? me.id));
    const r = await answer;
    if (r.result !== "SUCCESS" || !r.directPath)
      throw new Error(`media re-upload failed on the phone (${r.result})`);
    const field = Object.keys(message).find((k) => {
      const v = message[k];
      return typeof v === "object" && v !== null && "mediaKey" in v;
    });
    return {
      ...message,
      [field]: {
        ...message[field],
        directPath: r.directPath,
        url: `https://${MEDIA_HOST}${r.directPath}`
      }
    };
  }
  /** Mark messages as read (`read-self` keeps read receipts private). */
  async markRead(keys, type = "read") {
    const { receiver } = await this.#live();
    for (const node of buildReceipts(keys, type, Math.floor(Date.now() / 1e3)))
      receiver.sendNode(node);
  }
  /** Show "typing…" / "recording…" / stop in a chat. */
  async sendChatState(to, state) {
    const { receiver, meId } = await this.#live();
    const me = to.endsWith("@lid") && this.#creds.me?.lid ? this.#creds.me.lid : meId;
    receiver.sendNode(chatState(me, to, state));
  }
  /** Go online/offline. Needs the account's display name (`setName`). */
  async sendPresence(type) {
    const { receiver } = await this.#live();
    const name = this.#creds.me?.name;
    if (!name) throw new Error("set a display name first: client.setName(...)");
    if (type === "available") receiver.sendNode(unifiedSession(this.serverTime()));
    receiver.sendNode(presence(name, type));
  }
  /** Resolve once the phone has shared the app-state keys (needed for chat actions); false on timeout. */
  async waitForAppState(timeoutMs = 3e4) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if ((this.#appState?.keyCount ?? 0) > 0) return true;
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  }
  /**
   * Fetch the app-state collections again (chats, contacts, settings synced from the phone). With `fromScratch`
   * the local copy is dropped first and the full state is downloaded; use it when chat actions stop sticking.
   */
  async resyncAppState(collections, o = {}) {
    if (!this.#appState) throw new Error("not connected");
    if (o.fromScratch) this.#appState.reset(collections);
    await this.#appState.sync(collections);
  }
  /**
   * Set the cover photo of a business profile: uploads the JPEG (unencrypted, to the profile-picture service) and
   * points the profile at it. Returns the photo's id, which \`business.removeCoverPhoto\` takes.
   */
  async setBusinessCoverPhoto(jpeg) {
    const raw = rawMedia(jpeg);
    const conn = await this.#getMediaConn();
    const token = uploadToken(raw.fileSha256);
    let last;
    for (const host of conn.hosts) {
      try {
        const res = await fetch(
          `https://${host}/pps/biz-cover-photo/${token}?auth=${encodeURIComponent(conn.auth)}&token=${token}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/octet-stream",
              Origin: "https://web.whatsapp.com"
            },
            body: new Uint8Array(raw.encrypted)
          }
        );
        const j = await res.json().catch(() => void 0);
        if (res.ok && j?.fbid !== void 0 && j.meta_hmac && j.ts !== void 0) {
          const id = String(j.fbid);
          await this.business.setCoverPhoto({ id, token: j.meta_hmac, timestamp: Number(j.ts) });
          return id;
        }
        last = new Error(`cover photo upload to ${host} failed (HTTP ${res.status})`);
      } catch (e) {
        last = e;
      }
    }
    throw new Error("cover photo upload failed on all hosts", { cause: last });
  }
  /**
   * Make a new signed pre-key and tell the server (WhatsApp Web does this about every four weeks, and so does
   * this client after connecting). The old key stays on disk, so messages already on the way still decrypt.
   * Returns the new key id.
   */
  rotateSignedPreKey() {
    this.#rotating ??= this.#rotateSignedPreKey().finally(() => this.#rotating = void 0);
    return this.#rotating;
  }
  async #rotateSignedPreKey() {
    const { receiver } = await this.#live();
    const storage = this.#signalStorage;
    if (!storage) throw new Error("not connected");
    const creds = this.#creds;
    let id = creds.signedPreKey.keyId;
    for (let tries = 0; ; tries++) {
      id = id >= 16777215 ? 1 : id + 1;
      if (!await storage.loadSignedPreKey(id)) break;
      if (tries > 100) throw new Error("no free signed pre-key id");
    }
    const spk = newSignedPreKey(creds.signedIdentityKey.privateKey, id);
    await storage.storeSignedPreKey(id, spk.record);
    await receiver.request(rotateSignedPreKeyNode(id, spk.publicKey, spk.signature));
    const chain = [creds.signedPreKey.keyId, ...creds.retiredSignedPreKeys ?? []];
    creds.signedPreKey = {
      keyId: id,
      record: spk.record,
      publicKey: spk.publicKey,
      signature: spk.signature
    };
    creds.signedPreKeyAt = Date.now();
    creds.retiredSignedPreKeys = chain.slice(0, SIGNED_PRE_KEY_RETENTION - 1);
    saveAuthCreds(this.#credsPath, creds);
    for (const stale of chain.slice(SIGNED_PRE_KEY_RETENTION - 1))
      await storage.removeSignedPreKey(stale);
    return id;
  }
  /** Server-side information: experiment flags, reachout timelock, the new-chat limit, passive mode. */
  server = new ServerInfo(
    (n) => this.#q(n),
    (queryId, variables, dataPath) => this.#mexCall(queryId, variables, dataPath)
  );
  /** The server's clock in unix seconds (our clock corrected by the offset seen at login). */
  serverTime = () => Math.floor((Date.now() + this.#serverOffsetMs) / 1e3);
  /** The AI bots WhatsApp offers this account (Meta AI and others), by section. */
  listBots = async () => listBots((n) => this.#q(n));
  /** Group management: `client.groups.create(...)`, `.updateParticipants(...)`, `.metadata(...)`, ... */
  groups = new Groups(
    async (node) => (await this.#live()).receiver.request(node),
    (queryId, variables, dataPath) => this.#mexCall(queryId, variables, dataPath)
  );
  async #push(p) {
    await this.#live();
    if (!this.#appState) throw new Error("not connected");
    await this.#appState.push(p.collection, [toOutgoing(p)]);
  }
  /** Archive / unarchive a chat on all devices. */
  archiveChat = (jid, archived = true, last) => this.#push(archive(jid, archived, last));
  /** Mute until the given unix-millisecond time (`-1` = forever), or `null` to unmute. */
  muteChat = (jid, untilMs) => this.#push(mute(jid, untilMs));
  pinChat = (jid, pinned = true) => this.#push(pin(jid, pinned));
  /** Lock a chat behind the phone's screen lock (or unlock it). */
  lockChat = (jid, locked = true) => this.#push(lockChat(jid, locked));
  /** The list of favourite chats: pass every JID that should be a favourite (an empty list clears it). */
  setFavorites = (jids) => this.#push(favorites(jids));
  /** Hide a contact's statuses (or show them again). */
  muteContactStatus = (jid, muted = true) => this.#push(muteStatus(jid, muted));
  /** Business quick replies ("/shortcut"): create or change one, or delete it with the timestamp it was made with. */
  setQuickReply = (q) => this.#push(quickReply(q));
  /** Order of the labels in the list (numeric label ids). */
  reorderLabels = (ids) => this.#push(reorderLabels(ids));
  /** Settings of the whole account kept in app state: previews off, relay all calls, private processing. */
  setLinkPreviewsDisabled = (disabled = true) => this.#push(disableLinkPreviews(disabled));
  setRelayAllCalls = (enabled = true) => this.#push(relayAllCalls(enabled));
  setPrivateProcessing = (enabled = true) => this.#push(privateProcessing(enabled));
  /** Mark a chat read / unread on all devices. */
  markChatRead = (jid, read = true, last) => this.#push(markRead(jid, read, last));
  starMessage = (key, starred = true) => this.#push(star(key, starred));
  deleteChat = (jid, last) => this.#push(deleteChat(jid, last));
  clearChat = (jid, last) => this.#push(clearChat(jid, last));
  deleteMessageForMe = (key, timestamp, deleteMedia = false) => this.#push(deleteMessageForMe(key, timestamp, deleteMedia));
  /** Save a contact in the phone's address book, or remove it with `null`. */
  saveContact = (jid, c) => this.#push(contact(jid, c));
  /** Change the account's display name (push name). */
  async updateProfileName(name) {
    await this.#push(pushName(name));
    this.setName(name);
  }
  addLabel = (l) => this.#push(addLabel(l));
  labelChat = (jid, labelId, labeled = true) => this.#push(labelChat(jid, labelId, labeled));
  labelMessage = (jid, labelId, messageId, labeled = true) => this.#push(labelMessage(jid, labelId, messageId, labeled));
  /** Default disappearing-messages timer for a 1:1 chat, in seconds (0 = off). */
  setChatEphemeral = (jid, seconds2) => this.#push(chatEphemeral(jid, seconds2));
  /** Communities: create, link sub-groups, deactivate (members/settings: use `groups` with the community JID). */
  communities = new Communities(
    async (node) => (await this.#live()).receiver.request(node),
    (queryId, variables, dataPath) => this.#mexCall(queryId, variables, dataPath),
    this.groups
  );
  /** Channels: `client.newsletters.metadata('invite', code)`, `.follow(jid)`, ... (posting: `sendText(jid, ...)`). */
  newsletters = new Newsletters(
    (queryId, variables, dataPath) => mexFor(
      async (n) => (await this.#live()).receiver.request(n),
      () => `mex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    )(queryId, variables, dataPath),
    async (n) => (await this.#live()).receiver.request(n),
    () => `nl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  );
  /** Usernames: `client.usernames.check('name')`, `.set(...)`, `.mine()`. */
  usernames = new Usernames(
    (queryId, variables, dataPath) => mexFor(
      async (n) => (await this.#live()).receiver.request(n),
      () => `mex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    )(queryId, variables, dataPath)
  );
  #mexCall = (queryId, variables, dataPath) => mexFor(
    async (n) => (await this.#live()).receiver.request(n),
    () => `mex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  )(queryId, variables, dataPath);
  /** The account: `client.account.trustedDevices()`, `.removeDevice(jid)`, linked profiles. See also `logout()`. */
  account = new Account(
    (n) => this.#q(n),
    (queryId, variables, dataPath) => this.#mexCall(queryId, variables, dataPath)
  );
  /** More privacy: settings by feature, allow / block lists, text status, who is online, reminders, push settings. */
  privacy = new Privacy(
    (n) => this.#q(n),
    (queryId, variables, dataPath) => this.#mexCall(queryId, variables, dataPath)
  );
  /** Run a business: products, catalog and collections, broadcast lists and their quota. */
  business = new Business(
    (n) => this.#q(n),
    (queryId, variables, dataPath) => this.#mexCall(queryId, variables, dataPath)
  );
  /** Calendar events (Termine): create, list, update, RSVP, invite, invite link. Uses WhatsApp's HTTP GraphQL. */
  #www = new WwwClient(
    (queryId, variables, dataPath) => this.#mexCall(queryId, variables, dataPath)
  );
  calendar = new Events(this.#www);
  #q = async (node) => (await this.#live()).receiver.request(node);
  #sid = async () => (await this.#live()).receiver.nextId();
  /** Which phone numbers are registered on WhatsApp? */
  async onWhatsApp(...numbers) {
    return onWhatsApp(this.#q, await this.#sid(), numbers);
  }
  /** Look up an account by username (`@name`). */
  async findUserByUsername(username, pin2) {
    return findUserByUsername(this.#q, await this.#sid(), username, pin2);
  }
  /** Profile "About" text of users. */
  async fetchStatus(...jids) {
    return fetchStatus(this.#q, await this.#sid(), jids);
  }
  /** The usernames some contacts have set. */
  async contactUsernames(...jids) {
    return contactUsernames(this.#q, await this.#sid(), jids);
  }
  /** LIDs for phone-number JIDs. */
  async lidsFor(...jids) {
    return lidsFor(this.#q, await this.#sid(), jids);
  }
  profilePictureUrl = (jid, type = "preview") => profilePictureUrl(this.#q, jid, type);
  /** Set our own "About" text. */
  updateProfileStatus = (text4) => updateStatus(this.#q, text4);
  fetchBlocklist = () => fetchBlocklist(this.#q);
  /** Block a contact; `entryPoint` / `reason` are what the app reports with it (see `contacts.BlockOptions`). */
  async blockUser(jid, o = {}) {
    return updateBlockStatus(this.#q, jid, "block", await this.#withLid(jid, o));
  }
  async unblockUser(jid) {
    return updateBlockStatus(this.#q, jid, "unblock", await this.#withLid(jid, {}));
  }
  async #withLid(jid, o) {
    if (o.lid || jid.endsWith("@lid")) return o;
    const found = await this.lidsFor(jid).catch(() => []);
    const lid = found.find((x) => x.pn === jid)?.lid;
    return lid ? { ...o, lid } : o;
  }
  fetchPrivacySettings = () => fetchPrivacySettings(this.#q);
  updatePrivacy = (name, value) => updatePrivacy(this.#q, name, value);
  /** Post a text status/story visible to `recipients` (the audience must be given explicitly). */
  async sendStatusText(text4, recipients, privacy = "contacts") {
    const { sender } = await this.#live();
    return sender.sendMessage("status@broadcast", textMessage(text4), {
      statusRecipients: recipients,
      statusPrivacy: privacy
    });
  }
  /** Public business profile of an account (null if it is not a business). */
  getBusinessProfile = (jid) => getBusinessProfile(this.#q, jid);
  /** Edit our own business profile (WhatsApp Business accounts only). */
  updateBusinessProfile = (u) => updateBusinessProfile(this.#q, u);
  getCatalog = (jid, limit = 10, cursor) => getCatalog(
    this.#q,
    jid ?? this.#creds.me?.id.replace(/:\d+@/, "@") ?? "",
    limit,
    cursor
  );
  getCollections = (jid, limit = 51) => getCollections(this.#q, jid ?? this.#creds.me?.id.replace(/:\d+@/, "@") ?? "", limit);
  /** Buttons / list message (native flow). Build buttons with `quickReply`, `urlButton`, `singleSelect`, ... from the package. */
  async sendInteractive(to, o) {
    const { sender } = await this.#live();
    const m = interactive(o);
    return sender.sendMessage(to, m.message, m.opts);
  }
  /** Who may see our statuses (the "Status privacy" screen). */
  setStatusPrivacy = (audience, jids = []) => this.#push(statusPrivacy(audience, jids));
  /** Group permission "Add other members": everyone or only admins. */
  setGroupMemberAddMode = (jid, mode) => this.groups.setMemberAddMode(jid, mode);
  /** Group permission "Send message history" (members may send past messages to new members). */
  setGroupShareHistory = (jid, mode) => setGroupProperty(this.mex, jid, "member_share_group_history_mode", mode.toUpperCase());
  /** Our "member tag" in a group (shown next to the name; empty string removes it). */
  async setMemberLabel(groupJid, label) {
    const { sender } = await this.#live();
    return sender.sendMessage(groupJid, memberLabelMessage(label), {
      extraNodes: [{ tag: "meta", attrs: { tag_reason: "user_update", appdata: "member_tag" } }]
    });
  }
  /** Send a poll (2-12 options). Votes arrive encrypted as `pollUpdateMessage`. */
  /** Resolve with the next received message for which `match` is true, or `undefined` after `timeoutMs`. */
  waitForMessage(match = () => true, timeoutMs = 3e4) {
    return new Promise((resolve2) => {
      const timer = setTimeout(() => (off(), resolve2(void 0)), timeoutMs);
      const off = this.on("message", (m) => {
        if (!match(m)) return;
        clearTimeout(timer);
        off();
        resolve2(m);
      });
    });
  }
  /** Pin a message in its chat for `seconds` (default 24 hours; 7 days = 604800, 30 days = 2592000). */
  async pinMessage(key, seconds2 = 86400) {
    return this.sendMessage(
      key.remoteJid,
      {
        pinInChatMessage: { key, type: "PIN_FOR_ALL", senderTimestampMs: Date.now() },
        messageContextInfo: {
          messageSecret: (0, import_node_crypto20.randomBytes)(32),
          messageAddOnDurationInSecs: seconds2,
          messageAddOnExpiryType: "STATIC"
        }
      },
      { encAttrs: { "decrypt-fail": "hide" }, stanzaAttrs: { edit: "2" } }
    );
  }
  async unpinMessage(key) {
    return this.sendMessage(
      key.remoteJid,
      {
        pinInChatMessage: { key, type: "UNPIN_FOR_ALL", senderTimestampMs: Date.now() },
        messageContextInfo: {
          messageSecret: (0, import_node_crypto20.randomBytes)(32),
          messageAddOnDurationInSecs: 0,
          messageAddOnExpiryType: "STATIC"
        }
      },
      { encAttrs: { "decrypt-fail": "hide" }, stanzaAttrs: { edit: "2" } }
    );
  }
  /**
   * Send an album: two to ten pictures and videos that WhatsApp shows as one block. Every item is a picture
   * (`image`) or a video (`video`) with an optional `caption`. Returns the id of the album message.
   */
  async sendAlbum(to, items, o = {}) {
    if (items.length < 2 || items.length > 10) throw new Error("an album has 2 to 10 items");
    for (const i of items)
      if (!i.image === !i.video) throw new Error("each album item is an image or a video");
    const { sender } = await this.#live();
    const albumId = await sender.sendMessage(to, {
      albumMessage: {
        expectedImageCount: items.filter((i) => i.image).length,
        expectedVideoCount: items.filter((i) => i.video).length
      }
    });
    for (const item of items) {
      const kind = item.image ? "image" : "video";
      await this.sendMedia(to, kind, await toBytes(item.image ?? item.video), {
        ...item.caption && { caption: item.caption },
        ...item.mimetype && { mimetype: item.mimetype },
        association: {
          associationType: "MEDIA_ALBUM",
          parentMessageKey: { remoteJid: to, fromMe: true, id: albumId }
        }
      });
      await new Promise((r) => setTimeout(r, o.delayMs ?? 500));
    }
    return albumId;
  }
  async sendPoll(to, name, values, selectableCount = 1) {
    const { sender } = await this.#live();
    const p = poll(name, values, selectableCount);
    return sender.sendMessage(to, p.message, p.opts);
  }
  /**
   * Post to a channel and optionally label the post ("AI content", "paid partnership").
   * Returns the message id and the post's server number.
   */
  async postToChannel(channel, message, labels = {}, opts = {}) {
    const { sender } = await this.#live();
    let serverId;
    const id = await sender.sendMessage(
      channel,
      typeof message === "string" ? textMessage(message) : message,
      { ...opts, onAck: (ack) => serverId = ack.attrs["server_id"] }
    );
    if (serverId && labels.aiContent) await this.newsletters.labelAiContent(channel, serverId);
    if (serverId && labels.paidPartnership)
      await this.newsletters.labelPaidPartnership(channel, serverId);
    return { id, ...serverId && { serverId } };
  }
  /**
   * Post a text status to a group. Pictures, videos and voice notes: `sendImage(group, data, { groupStatus: true })`,
   * `sendVideo`, `sendAudio(..., { ptt: true, groupStatus: true })`.
   */
  async sendGroupStatusText(group, text4, o = {}) {
    const { sender } = await this.#live();
    const lid = (this.#creds.me?.lid ?? "").replace(/[:.]\d+@/, "@");
    const gs = groupStatus({
      extendedTextMessage: {
        text: text4,
        textArgb: o.textArgb ?? 4294967295,
        backgroundArgb: o.backgroundArgb ?? 4280191205,
        font: o.font ?? "SYSTEM",
        previewType: "NONE",
        contextInfo: groupStatusContext(lid, "TEXT")
      }
    });
    return sender.sendMessage(group, gs.message, gs.opts);
  }
  // ---- calls ---------------------------------------------------------------------------------
  #calls = /* @__PURE__ */ new Map();
  /** Calls this client knows about (placed or received), by call id. */
  get calls() {
    return this.#calls;
  }
  /**
   * Place a voice (or video) call and let the callee's devices ring. Resolves with the call once the server accepted
   * the offer; follow it through the `call` events (`preaccept` = ringing, `accept`, `reject`, `terminate`).
   * Media is not connected here: without it the callee can answer but hears nothing, and the call ends.
   */
  async startCall(to, o = {}) {
    o = await resolveCallFiles(o);
    const { sender, receiver } = await this.#live();
    const own = this.#creds.me?.lid;
    if (!own) throw new Error("no own LID yet; wait for the login to finish");
    let peer = to.replace(/:\d+@/, "@");
    if (!peer.endsWith("@lid")) {
      const found = (await this.lidsFor(peer)).find((x) => x.pn === peer);
      if (!found) throw new Error(`no LID known for ${peer}`);
      peer = found.lid;
    }
    const devices = await sender.getDevices([peer]);
    const ring = devices.map((d) => d.jid);
    if (!ring.length) throw new Error(`no devices found for ${peer}`);
    const callKey = new Uint8Array((0, import_node_crypto20.randomBytes)(32));
    const keys = await sender.encryptForDevices(ring, { call: { callKey } });
    if (!keys.length) throw new Error("could not encrypt the call key for any device");
    const callId = newCallId();
    const id = receiver.nextId();
    const offer = buildOffer({
      callId,
      to: peer,
      creator: own,
      keys: keys.map((k) => ({ jid: k.jid, type: k.type, ciphertext: k.ciphertext })),
      multiDevice: ring.length > 1,
      video: !!o.video,
      opus: true,
      id,
      ...keys.some((k) => k.type === "pkmsg") && this.#creds.account && { deviceIdentity: this.#creds.account }
    });
    const state = {
      callId,
      peer,
      creator: own,
      direction: "outgoing",
      video: !!o.video,
      devices: ring,
      status: "calling",
      startedAt: Date.now(),
      callKey
    };
    this.#calls.set(callId, state);
    try {
      const ack = await receiver.sendCallAndWait(offer);
      const relay = (Array.isArray(ack.content) ? ack.content : []).find((c) => c.tag === "relay");
      if (relay) {
        state.relay = relay;
        const media = new MediaSession({
          callId,
          direction: "outgoing",
          selfLid: own,
          peerLid: peer,
          callKey,
          relay,
          codec: "opus",
          enableVideo: !!o.video,
          ...o.audioIn && { audioIn: o.audioIn },
          ...o.recordTo && { recordTo: o.recordTo },
          ...o.videoFrames && {
            video: { frames: o.videoFrames, ...o.videoFps && { fps: o.videoFps } }
          },
          ...o.recordVideoTo && { recordVideoTo: o.recordVideoTo },
          ...o.localAudio && { localAudio: o.localAudio }
        });
        state.media = media;
        media.on("closed", () => void 0);
        media.start();
      }
    } catch (e) {
      state.status = "ended";
      throw e;
    }
    return state;
  }
  /** The roster and key traffic of a group call (`group_update`, `enc_rekey`) from the call's creator. */
  #groupCallTraffic(c, node) {
    const st = this.#calls.get(c.callId);
    const action = Array.isArray(node.content) ? node.content[0] : void 0;
    if (!st?.groupSession || !action) return;
    if (c.status === "group_update") {
      this.#reportRelayLatency(st, action);
      try {
        const summary = st.groupSession.applyUpdate(encodeNode2(action));
        if (summary.applied === "applied") {
          for (const m of summary.members) st.members?.add(m);
          if (st.waiting) {
            st.waiting = false;
            if (st.heartbeat) clearInterval(st.heartbeat);
            delete st.heartbeat;
            this.#startHeartbeat(st);
          }
          if (st.groupEngine) {
            const r = st.groupSession.pushToEngine(st.groupEngine, performance.now());
            this.logger.event("call.group-push", { transaction: summary.transaction_id, result: r });
          }
          void this.#startGroupMedia(st, summary, {}).catch(
            (e) => this.logger.event("call.group-error", e)
          );
        }
      } catch (e) {
        this.logger.event("call.group-update-failed", e);
      }
    } else if (c.status === "enc_rekey") {
      void this.#installEpoch(st, action, c.from).catch(
        (e) => this.logger.event("call.epoch-failed", e)
      );
    }
  }
  /** Decrypt a shared key delivered to us and give it to the engine. */
  async #installEpoch(st, action, from) {
    const { receiver } = await this.#live();
    const r = parseGroupEncRekey(encodeNode2(action));
    const raw = await receiver.decryptCallKey(from, r.enc_type, Uint8Array.from(r.ciphertext));
    if (!raw) throw new Error("the epoch envelope holds no key");
    if (!st.groupEngine) {
      st.pendingEpoch = { transaction: r.transaction_id, key: raw };
      this.logger.event("call.group-epoch", {
        transaction: r.transaction_id,
        from,
        applied: "pending"
      });
      return;
    }
    const applied = st.groupEngine.applyGroupEpoch(r.transaction_id, raw);
    this.logger.event("call.group-epoch", { transaction: r.transaction_id, from, applied });
    st.epochTx = r.transaction_id;
  }
  #trackCall(c, node) {
    const userOf = (jid) => jid.split("@")[0].replace(/[:.]\d+$/, "");
    const st = this.#calls.get(c.callId);
    if (st) {
      const fromService = c.from === `${c.callId}@call`;
      const fromMember = !!st.members?.has(userOf(c.from) + "@lid");
      const allowed = st.groupSession ? fromService || fromMember : st.group ? (
        // a group invitation we have not answered yet: the call service or the person who started it
        fromService || userOf(c.from) === userOf(st.creator)
      ) : userOf(c.from) === userOf(st.peer);
      if (!allowed) {
        this.logger.event("call.ignored-stanza", {
          callId: c.callId,
          from: c.from,
          status: c.status
        });
        return;
      }
      if (node && st.groupSession) {
        if (c.status === "group_update" && fromService) this.#groupCallTraffic(c, node);
        if (c.status === "enc_rekey" && fromMember) this.#groupCallTraffic(c, node);
      }
      if (c.status === "video" && c.videoState !== void 0) this.#onVideoState(st, c);
      if (c.status === "accept" && !st.groupSession) st.peerDevice = c.from;
      if (c.status === "preaccept" || c.status === "ringing") st.status = "ringing";
      else if (c.status === "accept") {
        st.status = "connected";
        if (!st.groupSession) st.media?.rekeyRecv(c.from);
      } else if (c.status === "reject" || c.status === "terminate") {
        if (st.groupSession && !fromService) return;
        this.#finishCall(st, c.status);
      }
      return;
    }
    if (c.status !== "offer") return;
    const creator = c.creator ?? c.from;
    if (!c.isGroup && userOf(creator) !== userOf(c.from)) {
      this.logger.event("call.ignored-offer", { callId: c.callId, from: c.from, creator });
      return;
    }
    this.#calls.set(c.callId, {
      callId: c.callId,
      peer: creator.replace(/:\d+@/, "@"),
      creator,
      direction: "incoming",
      video: !!c.isVideo,
      devices: [creator],
      status: "ringing",
      startedAt: Date.now(),
      ...c.isGroup && { group: c.group ?? c.from },
      ...c.lightweight && { lightweight: true },
      ...node && { offer: node, offerFrom: c.from }
    });
    this.#pruneCalls();
  }
  /** Mark a call over: stop its media, forget its key. */
  #finishCall(st, reason) {
    st.status = "ended";
    if (st.heartbeat) clearInterval(st.heartbeat);
    delete st.heartbeat;
    st.media?.close(reason);
    delete st.media;
    st.callKey?.fill(0);
    delete st.callKey;
    this.#pruneCalls();
  }
  /** Keep the call table small: at most 200 entries, ended calls go first. */
  #pruneCalls() {
    if (this.#calls.size <= 200) return;
    for (const [id, c] of this.#calls) {
      if (c.status === "ended") this.#calls.delete(id);
      if (this.#calls.size <= 200) return;
    }
    while (this.#calls.size > 200) this.#calls.delete(this.#calls.keys().next().value);
  }
  /**
   * Answer an incoming call: decrypt the call key from the offer, tell the caller we are ringing and answering, and
   * connect the media. `audioIn` is spoken into the call, `recordTo` saves what the caller says (16 kHz mono WAV).
   */
  async acceptCall(callId, o = {}) {
    o = await resolveCallFiles(o);
    const c = this.#calls.get(callId);
    if (!c || c.direction !== "incoming" || !c.offer) throw new Error(`no incoming call ${callId}`);
    if (c.lightweight)
      throw new Error(
        `call ${callId} is a silent group call (a voice chat invitation): it rings nobody, and a linked device cannot join it (the server answers 403 while the account's voice_chat_companion_experience_version is below 2)`
      );
    if (c.group) return this.#acceptGroupCall(c, o);
    const { receiver } = await this.#live();
    const own = this.#creds.me;
    if (!own?.lid) throw new Error("no own LID yet");
    const inner = Array.isArray(c.offer.content) ? c.offer.content[0] : void 0;
    const kids10 = Array.isArray(inner?.content) ? inner.content : [];
    const ours = (n) => [own.lid, own.id].includes(n.attrs["jid"] ?? "");
    let enc2 = kids10.find((k) => k.tag === "enc");
    if (!enc2) {
      const dest = kids10.find((k) => k.tag === "destination");
      const to = (Array.isArray(dest?.content) ? dest.content : []).find(ours);
      enc2 = (Array.isArray(to?.content) ? to.content : []).find((k) => k.tag === "enc");
    }
    if (!enc2 || !(enc2.content instanceof Uint8Array))
      throw new Error("the offer carries no call key for this device");
    const relay = kids10.find((k) => k.tag === "relay");
    if (!relay) throw new Error("the offer carries no relay");
    const target = c.offerFrom ?? c.creator;
    receiver.sendNode(buildPreaccept(callId, target, c.creator, receiver.nextId(), c.video));
    const callKey = await receiver.decryptCallKey(
      c.creator,
      enc2.attrs["type"] ?? "msg",
      enc2.content
    );
    if (!callKey) throw new Error("could not read the call key");
    c.callKey = callKey;
    const media = new MediaSession({
      callId,
      direction: "incoming",
      selfLid: own.lid,
      peerLid: c.creator,
      callKey,
      relay,
      codec: "opus",
      enableVideo: c.video,
      ...o.audioIn && { audioIn: o.audioIn },
      ...o.recordTo && { recordTo: o.recordTo },
      ...o.videoFrames && {
        video: { frames: o.videoFrames, ...o.videoFps && { fps: o.videoFps } }
      },
      ...o.recordVideoTo && { recordVideoTo: o.recordVideoTo },
      ...o.localAudio && { localAudio: o.localAudio }
    });
    c.media = media;
    media.start();
    receiver.sendNode(buildAccept(callId, target, c.creator, receiver.nextId(), c.video));
    c.status = "connected";
    return c;
  }
  /** Create a call link (a "room") that others can join: `https://call.whatsapp.com/{voice|video}/{token}`. */
  async createCallLink(media = "audio") {
    const { receiver } = await this.#live();
    const ack = await receiver.sendCallAndWait(buildLinkCreate(media, receiver.nextId()));
    return parseLinkCreateAck(ack);
  }
  /**
   * Open a room: create a call link, join it as its owner and let people in by a rule (`admit`: everybody, only
   * guests without a WhatsApp account, nobody automatically, or your own function). People open the link in a browser.
   * The returned room tells you who asks, who is let in, who is inside and who leaves (see \`RoomEvents\`).
   */
  async createRoom(o = {}) {
    const media = o.media ?? "video";
    const { admit, maxGuests, media: _unused, ...mediaOptions } = o;
    void _unused;
    const link = await this.createCallLink(media);
    const call = await this.joinCallLink(link.url, media, mediaOptions);
    const me = this.#creds.me?.lid ?? this.#creds.me?.id ?? "";
    const room = new Room(
      this,
      { url: link.url, token: link.token, callId: call.callId, media, owner: me },
      { ...admit !== void 0 && { admit }, ...maxGuests !== void 0 && { maxGuests } }
    );
    room.on("trace", (t) => this.logger.event(`room.${t.kind}`, t.data));
    for (const k of ["request", "admitted", "denied", "joined", "left", "closed"])
      room.on(k, (p) => this.logger.event(`room.${k}`, p));
    await room.setApprovalRequired(true);
    return room;
  }
  /** Who made a call link and whether joiners have to be let in. `link` is the token or the whole URL. */
  async queryCallLink(link, media = "audio") {
    const token = parseCallLinkToken(link);
    const { receiver } = await this.#live();
    const ack = await receiver.sendCallAndWait(
      buildLinkQuery(token, media, receiver.nextId())
    );
    return parseLinkQueryAck(ack);
  }
  /**
   * Start a group call: an ad-hoc call with at least two other people, or one bound to an existing group
   * (`o.group`, at least one other member). Everyone's devices ring. The shared media key is generated here and sent
   * to every device that connects.
   */
  async startGroupCall(targets, o = {}) {
    o = await resolveCallFiles(o);
    const { sender, receiver } = await this.#live();
    const own = this.#creds.me?.lid;
    if (!own) throw new Error("no own LID yet; wait for the login to finish");
    ensureVoipWasm();
    const ownUser = own.replace(/:\d+@/, "@");
    if (o.group && !targets.length)
      targets = (await this.groups.metadata(o.group)).participants.map((p) => p.id);
    const users = [];
    for (const t of targets) {
      let u = t.replace(/:\d+@/, "@");
      if (!u.endsWith("@lid")) {
        const found = (await this.lidsFor(u)).find((x) => x.pn === u);
        if (!found) throw new Error(`no LID known for ${u}`);
        u = found.lid;
      }
      if (u !== ownUser && !users.includes(u)) users.push(u);
    }
    const isHosted = (jid) => /:99@/.test(jid);
    const devices = (await sender.getDevices(users)).filter((d) => !isHosted(d.jid));
    const participants = [
      {
        jid: ownUser,
        devices: [{ jid: own, capability: [...CAPABILITY_STANDARD_OPUS_OFFER] }]
      },
      ...users.map((u) => ({
        jid: u,
        devices: devices.filter((d) => d.jid.replace(/:\d+@/, "@") === u).map((d) => ({ jid: d.jid }))
      }))
    ];
    if (participants.slice(1).some((p) => !p.devices.length))
      throw new Error("a participant has no devices");
    const callId = newCallId();
    const id = receiver.nextId();
    const offer = buildGroupOffer(
      JSON.stringify({
        call_id: callId,
        id,
        creator: own,
        ...o.group && { group_jid: o.group },
        participants,
        audio_rate: 16e3,
        video: !!o.video
      })
    );
    const session = new GroupSession(callId, own, own);
    const state = {
      callId,
      peer: o.group ?? users[0],
      creator: own,
      direction: "outgoing",
      video: !!o.video,
      ...o.group && { group: o.group },
      devices: devices.map((d) => d.jid),
      status: "calling",
      startedAt: Date.now(),
      groupSession: session,
      members: /* @__PURE__ */ new Set([ownUser, ...users])
    };
    this.#calls.set(callId, state);
    try {
      const ack = await receiver.sendCallAndWait(offer);
      const summary = session.applyAck(encodeNode2(ack));
      this.#startHeartbeat(state);
      await this.#startGroupMedia(state, summary, o);
    } catch (e) {
      try {
        receiver.sendNode(buildTerminate(callId, `${callId}@call`, own, receiver.nextId()));
      } catch {
      }
      this.#finishCall(state, "failed");
      throw e;
    }
    return state;
  }
  /** Build the group engine once the server gave us a relay, then deliver the shared key where it is owed. */
  async #startGroupMedia(state, summary, o) {
    const session = state.groupSession;
    if (!summary.relay_endpoint && (state.direction === "incoming" || state.awaitsRelay)) return;
    if (!summary.relay_endpoint) throw new Error("the group call has no relay yet");
    o = { ...state.mediaOptions, ...o };
    if (!state.groupEngine) {
      const engine = session.createEngine(state.direction === "incoming", true, state.video);
      state.groupEngine = engine;
      const media = new MediaSession({
        callId: state.callId,
        direction: state.direction,
        selfLid: state.creator,
        peerLid: state.creator,
        callKey: new Uint8Array(32),
        group: {
          engine,
          relay: { ip: summary.relay_endpoint[0], port: summary.relay_endpoint[1] }
        },
        codec: "opus",
        enableVideo: state.video,
        ...o.audioIn && { audioIn: o.audioIn },
        ...o.recordTo && { recordTo: o.recordTo },
        ...o.videoFrames && {
          video: { frames: o.videoFrames, ...o.videoFps && { fps: o.videoFps } }
        },
        ...o.recordVideoTo && { recordVideoTo: o.recordVideoTo },
        ...o.localAudio && { localAudio: o.localAudio }
      });
      state.media = media;
      media.on("connected", () => {
        if (state.status !== "ended") state.status = "connected";
      });
      media.start();
      if (state.pendingEpoch) {
        const { transaction, key } = state.pendingEpoch;
        delete state.pendingEpoch;
        const applied = engine.applyGroupEpoch(transaction, key);
        state.epochTx = transaction;
        this.logger.event("call.group-epoch", { transaction, applied });
        key.fill(0);
      }
    }
    await this.#groupEpoch(state, summary);
    this.#hintTransport(state, summary);
  }
  /**
   * Tell the call service how far each relay of a roster update is from us (once per relay block). The service
   * picks the call's relay from everyone's reports, and drops a participant that never reported.
   */
  #reportRelayLatency(st, holder) {
    const relay = (Array.isArray(holder.content) ? holder.content : []).find(
      (k) => k.tag === "relay"
    );
    const tx = relay?.attrs["transaction-id"];
    if (!relay || !tx || st.latencyTx === tx) return;
    st.latencyTx = tx;
    const seen = /* @__PURE__ */ new Set();
    const reports = [];
    for (const te of Array.isArray(relay.content) ? relay.content : []) {
      const name = te.attrs["relay_name"];
      if (te.tag !== "te2" || !name || seen.has(name)) continue;
      if (!(te.content instanceof Uint8Array) || te.content.length !== 6) continue;
      seen.add(name);
      reports.push({ name, rtt: Number(te.attrs["c2r_rtt"] ?? 0) || 0, address: te.content });
    }
    void this.#live().then(({ receiver }) => {
      for (const r of reports)
        receiver.sendNode(
          buildRelayLatency(
            st.callId,
            st.creator,
            tx,
            r.name,
            r.rtt,
            r.address,
            receiver.nextId()
          )
        );
    }).catch((e) => this.logger.event("call.latency-failed", e));
  }
  /** A pending call-link join pings the waiting room every 10 s until it is let in. */
  #startWaitingHeartbeat(st) {
    const beat = () => {
      void this.#live().then(
        ({ receiver }) => receiver.sendNode(
          buildWaitingRoomHeartbeat(st.callId, st.creator, receiver.nextId())
        )
      ).catch((e) => this.logger.event("call.heartbeat-failed", e));
    };
    beat();
    st.heartbeat = setInterval(beat, 1e4);
    st.heartbeat.unref();
  }
  /**
   * Join a call link ("room"). When the creator wants to approve joiners the call waits in the waiting room
   * (`status` `ringing`, `waiting` true) and goes on once the creator lets us in.
   */
  async joinCallLink(link, media = "audio", o = {}) {
    o = await resolveCallFiles(o);
    const token = parseCallLinkToken(link);
    const { receiver } = await this.#live();
    const own = this.#creds.me?.lid;
    if (!own) throw new Error("no own LID yet; wait for the login to finish");
    ensureVoipWasm();
    const ack = await receiver.sendCallAndWait(
      buildLinkJoin(
        token,
        media,
        receiver.nextId(),
        this.#isGuest ? this.#options.guest.guestName : void 0
      )
    );
    const join7 = parseLinkJoinAck(ack, token);
    if (this.#isGuest && join7.inWaitingRoom && this.#guestSession)
      void guestPreFlightLog("guest_calling_waiting_room_entered", this.#guestSession, this.#config);
    const user = (j) => j.replace(/:\d+@/, "@");
    const session = new GroupSession(join7.callId, join7.creator, own);
    const state = {
      callId: join7.callId,
      peer: user(join7.creator),
      creator: join7.creator,
      direction: "outgoing",
      video: join7.media === "video",
      devices: [],
      status: join7.admitted ? "connected" : "ringing",
      startedAt: Date.now(),
      groupSession: session,
      members: /* @__PURE__ */ new Set([user(join7.creator), user(own)]),
      mediaOptions: pickMediaOptions(o),
      ...join7.inWaitingRoom && { waiting: true },
      awaitsRelay: true
    };
    this.#calls.set(join7.callId, state);
    try {
      if (join7.admitted) {
        this.#startHeartbeat(state);
      } else this.#startWaitingHeartbeat(state);
    } catch (e) {
      try {
        receiver.sendNode(
          buildTerminate(
            join7.callId,
            `${join7.callId}@call`,
            join7.creator,
            receiver.nextId()
          )
        );
      } catch {
      }
      this.#finishCall(state, "failed");
      throw e;
    }
    return state;
  }
  /** Where in-call video changes go: the call service in a group call, otherwise the other side's device. */
  #videoTarget(c) {
    if (c.groupSession) return `${c.callId}@call`;
    return c.peerDevice ?? c.offerFrom ?? c.creator;
  }
  /** The other side changed its video: answer a request later with `acceptVideoUpgrade`, follow an accept. */
  #onVideoState(st, c) {
    const state = c.videoState;
    if (state === VIDEO_STATE.request || state === 3) {
      st.videoRequest = true;
    } else if (state === VIDEO_STATE.accept) {
      st.media?.releaseVideo();
    } else if (state === VIDEO_STATE.enabled) {
      if (st.media) st.media.acceptVideo();
    } else if (state === VIDEO_STATE.reject) {
      st.media?.stopVideo();
    }
  }
  /** Turn our camera on in a running call: asks the other side and sends once they accept. */
  async enableCamera(callId, o = {}) {
    const c = this.#calls.get(callId);
    if (!c?.media) throw new Error(`no running call ${callId}`);
    o = await resolveCallFiles(o);
    if (!o.videoFrames?.length) throw new Error("enableCamera needs videoFrames or videoFile");
    const { receiver } = await this.#live();
    if (!c.media.startVideo(o.videoFrames, o.videoFps ?? 15, true))
      throw new Error("the call cannot carry video");
    c.video = true;
    receiver.sendNode(
      buildVideoState(
        callId,
        this.#videoTarget(c),
        c.creator,
        receiver.nextId(),
        VIDEO_STATE.request,
        { dec: "H264", orientation: 0 }
      )
    );
  }
  /** Turn our camera off; the call goes on with sound. */
  async disableCamera(callId) {
    const c = this.#calls.get(callId);
    if (!c?.media) throw new Error(`no running call ${callId}`);
    const { receiver } = await this.#live();
    c.media.stopVideo();
    receiver.sendNode(
      buildVideoState(
        callId,
        this.#videoTarget(c),
        c.creator,
        receiver.nextId(),
        VIDEO_STATE.stopped
      )
    );
  }
  /** The other side asked to turn video on (see `call` events with `videoState` 11): accept, optionally sending our own picture. */
  async acceptVideoUpgrade(callId, o = {}) {
    const c = this.#calls.get(callId);
    if (!c?.media || !c.videoRequest) throw new Error(`no video request on call ${callId}`);
    o = await resolveCallFiles(o);
    const { receiver } = await this.#live();
    c.videoRequest = false;
    c.video = true;
    const to = this.#videoTarget(c);
    if (o.videoFrames?.length) c.media.startVideo(o.videoFrames, o.videoFps ?? 15);
    else c.media.acceptVideo();
    receiver.sendNode(
      buildVideoState(
        callId,
        to,
        c.creator,
        receiver.nextId(),
        VIDEO_STATE.accept,
        {
          dec: "H264,AV1",
          orientation: 0
        }
      )
    );
    if (o.videoFrames?.length)
      receiver.sendNode(
        buildVideoState(
          callId,
          to,
          c.creator,
          receiver.nextId(),
          VIDEO_STATE.enabled,
          {
            dec: "H264",
            orientation: 0
          }
        )
      );
  }
  /** Refuse the other side's request to turn video on. */
  async rejectVideoUpgrade(callId) {
    const c = this.#calls.get(callId);
    if (!c || !c.videoRequest) throw new Error(`no video request on call ${callId}`);
    const { receiver } = await this.#live();
    c.videoRequest = false;
    receiver.sendNode(
      buildVideoState(
        callId,
        this.#videoTarget(c),
        c.creator,
        receiver.nextId(),
        VIDEO_STATE.reject
      )
    );
  }
  /** Raise (or lower) the hand in a group call. */
  async raiseHand(callId, raised = true) {
    const c = this.#calls.get(callId);
    if (!c?.groupSession) throw new Error(`${callId} is not a running group call`);
    const { receiver } = await this.#live();
    receiver.sendNode(buildRaiseHand(callId, c.creator, raised, receiver.nextId()));
  }
  /**
   * Tell the group call that we start or stop sharing a screen. This is the signal only: the picture itself is
   * not sent. Others report it as \`screenShare\` on the call event.
   */
  async setScreenShare(callId, started, shareId) {
    const c = this.#calls.get(callId);
    if (!c?.groupSession) throw new Error(`${callId} is not a running group call`);
    const { receiver } = await this.#live();
    receiver.sendNode(
      buildScreenShare(callId, c.creator, started, shareId, receiver.nextId())
    );
  }
  /** React with an emoji in a group call (the empty string takes it back). */
  async sendReaction(callId, emoji) {
    const c = this.#calls.get(callId);
    if (!c?.groupSession || !c.media) throw new Error(`${callId} is not a running group call`);
    if (Buffer.byteLength(emoji, "utf8") > 32) throw new Error("a reaction is a single emoji");
    c.media.react(emoji);
  }
  /** Creator of a call link: require approval for joiners (or not). */
  async setApprovalRequired(callId, enabled) {
    const c = this.#calls.get(callId);
    if (!c) throw new Error(`unknown call ${callId}`);
    const { receiver } = await this.#live();
    await receiver.sendCallAndWait(
      buildWaitingRoomToggle(callId, c.creator, enabled, receiver.nextId())
    );
  }
  /** Creator of a call link: let a waiting person in, or turn them away. */
  async answerWaitingRoom(callId, user, admit = true) {
    const c = this.#calls.get(callId);
    if (!c) throw new Error(`unknown call ${callId}`);
    const { receiver } = await this.#live();
    await receiver.sendCallAndWait(
      buildWaitingRoomAdmit(callId, c.creator, user, receiver.nextId(), !admit)
    );
  }
  /** The creator pings the call service every 10 s; without it the server drops the call. */
  #startHeartbeat(st) {
    if (st.direction !== "outgoing" || st.heartbeat) return;
    const beat = () => {
      void this.#live().then(
        ({ receiver }) => receiver.sendNode(buildHeartbeat(st.callId, st.creator, receiver.nextId()))
      ).catch((e) => this.logger.event("call.heartbeat-failed", e));
    };
    beat();
    st.heartbeat = setInterval(beat, 1e4);
    st.heartbeat.unref();
  }
  /** Once a device is in the call, tell it our network (once) and announce that we are unmuted. */
  #hintTransport(st, summary) {
    if (st.direction !== "outgoing") return;
    const fresh = summary.epoch_recipients.filter(
      (j) => st.members?.has(j.replace(/:\d+@/, "@")) && !st.hinted?.has(j)
    );
    if (!fresh.length) return;
    const hinted = st.hinted ??= /* @__PURE__ */ new Set();
    void this.#live().then(({ receiver }) => {
      for (const j of fresh) {
        hinted.add(j);
        receiver.sendNode(buildTransportHint(st.callId, j, st.creator, receiver.nextId()));
      }
      receiver.sendNode(buildMuteState(st.callId, st.creator, false, receiver.nextId()));
    }).catch((e) => this.logger.event("call.transport-failed", e));
  }
  /** If the server asked for a shared key (and we are the creator), send it to every connected device. */
  async #groupEpoch(state, summary) {
    if (!summary.rekey_requested && !summary.rekey_owed) return;
    if (state.direction !== "outgoing" || !summary.transaction_id) return;
    if (state.epochTx !== void 0 && state.epochTx >= summary.transaction_id) return;
    const { sender, receiver } = await this.#live();
    const raw = new Uint8Array((0, import_node_crypto20.randomBytes)(32));
    const recipients = summary.epoch_recipients.filter(
      (j) => state.members?.has(j.replace(/:\d+@/, "@"))
    );
    const keys = recipients.length ? await sender.encryptForDevices(recipients, { call: { callKey: raw } }) : [];
    for (const k of keys) {
      receiver.sendNode(
        buildGroupEncRekey(
          JSON.stringify({
            call_id: state.callId,
            id: receiver.nextId(),
            to: k.jid,
            creator: state.creator,
            transaction_id: summary.transaction_id,
            enc_type: k.type,
            ciphertext: [...k.ciphertext],
            ...k.type === "pkmsg" && this.#creds.account && { device_identity: [...this.#creds.account] }
          })
        )
      );
    }
    state.groupEngine?.applyGroupEpoch(summary.transaction_id, raw);
    state.epochTx = summary.transaction_id;
    raw.fill(0);
  }
  /** Answer an invitation into a group call: join at the call service, the relay and the shared key follow. */
  async #acceptGroupCall(c, o) {
    const { receiver } = await this.#live();
    const own = this.#creds.me?.lid;
    if (!own) throw new Error("no own LID yet");
    ensureVoipWasm();
    const inner = Array.isArray(c.offer.content) ? c.offer.content[0] : void 0;
    const session = new GroupSession(c.callId, c.creator, own);
    const summary = session.applyInvite(encodeNode2(inner));
    c.groupSession = session;
    c.members = /* @__PURE__ */ new Set([c.creator.replace(/:\d+@/, "@"), ...summary.members]);
    c.mediaOptions = pickMediaOptions(o);
    const service2 = `${c.callId}@call`;
    await receiver.sendCallAndWait(
      buildPreaccept(c.callId, service2, c.creator, receiver.nextId(), c.video)
    );
    receiver.sendNode(
      buildAccept(c.callId, service2, c.creator, receiver.nextId(), c.video, true)
    );
    c.status = "connected";
    await this.#startGroupMedia(c, summary, o);
    return c;
  }
  /**
   * Play audio into a running call: an audio file path (mp3, ogg, wav, m4a, ...; needs ffmpeg) or 16 kHz mono PCM.
   * By default it is queued after what is still playing; with `replace` the current audio is dropped first, so this is
   * "change the music". The call must have its media path up (status `connected`). Returns the seconds now queued.
   */
  async playInCall(callId, source, o = {}) {
    const media = this.#calls.get(callId)?.media;
    if (!media) throw new Error(`call ${callId} has no media path yet`);
    const pcm = typeof source === "string" ? await decodeAudioFile(source, o.maxSeconds ? { maxSeconds: o.maxSeconds } : {}) : source;
    if (o.replace) media.clearAudio();
    media.speak(pcm);
    return media.queuedSeconds;
  }
  /** Set how loud this call's outgoing audio is: 0 (silent) to 2 (twice as loud, peaks are clipped), 1 = unchanged. Works at once, also for queued audio. */
  setCallVolume(callId, gain) {
    const media = this.#calls.get(callId)?.media;
    if (!media) throw new Error(`call ${callId} has no media path yet`);
    media.setVolume(gain);
  }
  /** The outgoing volume of a call (1 = unchanged), or undefined when it has no media path. */
  callVolume(callId) {
    return this.#calls.get(callId)?.media?.volume;
  }
  /** Pause a running call's media: the queued audio is held (the call carries silence) and the picture freezes. */
  pauseMedia(callId) {
    const media = this.#calls.get(callId)?.media;
    if (!media) throw new Error(`call ${callId} has no media path yet`);
    media.pause();
  }
  /** Go on after `pauseMedia`, exactly where it stopped. */
  resumeMedia(callId) {
    const media = this.#calls.get(callId)?.media;
    if (!media) throw new Error(`call ${callId} has no media path yet`);
    media.resume();
  }
  /** Is the media of this call paused? undefined when the call has no media path. */
  isMediaPaused(callId) {
    return this.#calls.get(callId)?.media?.paused;
  }
  /** Silence a running call (drops the audio that is still queued). The call itself goes on. */
  stopAudio(callId) {
    const media = this.#calls.get(callId)?.media;
    if (!media) throw new Error(`call ${callId} has no media path yet`);
    media.clearAudio();
  }
  /** Seconds of audio still queued in a call (0 when silent), or undefined when the call has no media path. */
  queuedAudioSeconds(callId) {
    return this.#calls.get(callId)?.media?.queuedSeconds;
  }
  /** Hang up a call we placed or answered (also cancels one that is still ringing). */
  async endCall(callId) {
    const c = this.#calls.get(callId);
    if (!c) throw new Error(`unknown call ${callId}`);
    const { receiver } = await this.#live();
    if (c.groupSession) {
      const ms = Math.max(0, Date.now() - c.startedAt);
      receiver.sendNode(buildTerminateTimed(callId, c.creator, ms, receiver.nextId()));
      receiver.sendNode(buildGroupDuration(callId, c.creator, ms, receiver.nextId()));
    } else
      for (const device of c.devices)
        receiver.sendNode(buildTerminate(callId, device, c.creator, receiver.nextId()));
    this.#finishCall(c, "hangup");
  }
  // ---- buttons, lists, templates, rich answers ----------------------------------------------
  /** Up to three reply buttons under a text (`buttonsMessage`). The tap arrives as a `message` event; see `parseButtonReply`. */
  async sendButtons(to, o) {
    const { sender } = await this.#live();
    const m = buttonsMessage(o);
    return sender.sendMessage(to, m.message, m.opts);
  }
  /** A "choose from a list" message (`listMessage`). */
  async sendList(to, o) {
    const { sender } = await this.#live();
    const m = listMessage(o);
    return sender.sendMessage(to, m.message, m.opts);
  }
  /** Template buttons: quick replies, a link and a phone number (`templateMessage`). */
  async sendTemplate(to, o) {
    const { sender } = await this.#live();
    const m = templateMessage(o);
    return sender.sendMessage(to, m.message, m.opts);
  }
  /** Answer a buttons message; the tapped button's id and text come from the received message. */
  replyToButtons = (to, id, displayText) => this.sendMessage(to, buttonsResponse(id, displayText));
  replyToList = (to, rowId, title, description) => this.sendMessage(to, listResponse(rowId, title, description));
  replyToTemplate = (to, id, displayText, index = 0) => this.sendMessage(to, templateButtonReply(id, displayText, index));
  replyToNativeFlow = (to, name, params, bodyText = "") => this.sendMessage(to, interactiveResponse(name, params, bodyText));
  /** A Meta AI style answer with text, code, table, LaTeX, map and images. */
  async sendRichResponse(to, o) {
    const { sender } = await this.#live();
    const m = richResponse(o);
    return sender.sendMessage(to, m.message, m.opts);
  }
  /**
   * Raw HTML as a Meta AI answer (experimental on WhatsApp's side). Rendered as markup and not sanitised: pass only
   * HTML you wrote, never received or generated text. Calling this method is the opt-in.
   */
  sendHtml = (to, html) => this.sendRichResponse(to, { html, allowRawHtml: true });
  // ---- reports ----------------------------------------------------------------------------
  #reports = new ReportStore();
  async #sendReport(kind, jid, o) {
    const { receiver } = await this.#live();
    const res = await receiver.request(buildReport(kind, jid, receiver.nextId(), o));
    const id = reportId(res);
    return id ? { reportId: id } : {};
  }
  /**
   * Report a user to WhatsApp, as "Report" in the contact menu does. The latest 5 messages of the chat go along as
   * evidence unless you pass `messages` or `withMessages: false`. `block: true` blocks the contact afterwards
   * ("Block contact and delete chat" additionally with `deleteChat: true`).
   */
  async reportUser(jid, o = {}) {
    const messages = o.messages ?? (o.withMessages === false ? [] : this.#reports.recent(jid, 5));
    const sent = await this.#sendReport("user", jid, { ...o, messages });
    if (o.block) await this.blockUser(jid, { entryPoint: o.flow ?? "overflow_menu_block" });
    if (o.block && o.deleteChat) await this.deleteChat(jid);
    return { ...sent, blocked: !!o.block };
  }
  /**
   * Report a group. `leave: true` leaves it afterwards ("Exit group and report"). The group name is looked up when
   * you do not give `subject`.
   */
  async reportGroup(group, o = {}) {
    const subject = o.subject ?? (await this.groups.metadata(group)).subject;
    const messages = o.messages ?? (o.withMessages === false ? [] : this.#reports.recent(group, 5));
    const sent = await this.#sendReport("group", group, { ...o, subject, messages });
    if (o.leave) await this.groups.leave(group);
    return { ...sent, left: !!o.leave };
  }
  /** Report a channel (`unfollow: true` leaves it afterwards). */
  async reportChannel(channel, o = {}) {
    const subject = o.subject ?? (await this.newsletters.metadata("jid", channel)).name ?? "";
    const messages = o.messages ?? (o.withMessages === false ? [] : this.#reports.recent(channel, 5));
    const sent = await this.#sendReport("newsletter", channel, { ...o, subject, messages });
    if (o.unfollow) await this.newsletters.unfollow(channel);
    return sent;
  }
  /** Tell a group's admins about a message (it shows in their "reported messages"). */
  async reportToAdmins(group, messageId) {
    const { receiver } = await this.#live();
    await receiver.request(reportToAdmins(group, receiver.nextId(), messageId));
  }
  /** Group setting: may members report messages to the admins? */
  async setMemberReportsAllowed(group, allow) {
    const { receiver } = await this.#live();
    await receiver.request(setMemberReports(group, receiver.nextId(), allow));
  }
  /** Ask a contact to pay (`amount1000` is thousandths of the currency unit). */
  requestPayment = (to, p) => this.sendMessage(to, requestPayment(to, p));
  /** Answer a payment request with a payment note. */
  sendPaymentNote = (to, request, o) => this.sendMessage(to, sendPayment(request, o));
  declinePaymentRequest = (to, request) => this.sendMessage(to, declinePaymentRequest(request));
  cancelPaymentRequest = (to, request) => this.sendMessage(to, cancelPaymentRequest(request));
  /** Payments account settings (passkey, recovery check, UPI onboarding). */
  payments = new Payments((q, v, p) => this.mex(q, v, p));
  #wamSeq = 0;
  /** Report usage-statistics events (WAM) the way WhatsApp Web does. `name`s are in `WAM_EVENTS`. */
  async sendWam(events) {
    const { receiver } = await this.#live();
    const buffer = encodeWam(events, this.#wamSeq);
    this.#wamSeq = this.#wamSeq + 1 & 65535;
    await receiver.request({
      tag: "iq",
      attrs: { to: "s.whatsapp.net", type: "set", xmlns: "w:stats" },
      content: [
        { tag: "add", attrs: { t: String(Math.round(Date.now() / 1e3)) }, content: buffer }
      ]
    });
  }
  /** Send a quiz: a single-choice poll with a right answer (`correctAnswer` must be one of `values`). */
  async sendQuiz(to, name, values, correctAnswer) {
    const { sender } = await this.#live();
    const p = poll(name, values, 1, { correctAnswer });
    return sender.sendMessage(to, p.message, p.opts);
  }
  /**
   * Channel poll or quiz whose options are images (`images[i]` belongs to `values[i]`). Like the phone, every option
   * image goes out first as its own post pointing at the poll's id, then the poll itself.
   */
  async sendImagePoll(to, name, values, images, o = {}) {
    if (images.length !== values.length) throw new Error("one image per option");
    const { sender, meId } = await this.#live();
    const conn = await this.#getMediaConn();
    const parentId = generateMessageId(meId);
    const hashes = [];
    for (const [i, img] of images.entries()) {
      const raw = rawMedia(img);
      const uploaded = await uploadMedia(conn, "image", raw, fetch, true);
      hashes.push(pollOptionHash2(values[i], raw.fileSha256));
      await sender.sendMessage(
        to,
        {
          pollCreationOptionImageMessage: {
            message: {
              imageMessage: {
                url: uploaded.url,
                directPath: uploaded.directPath,
                fileSha256: raw.fileSha256,
                fileLength: raw.fileLength,
                mimetype: "image/jpeg",
                caption: values[i],
                ...uploaded.thumbnail && {
                  thumbnailDirectPath: uploaded.thumbnail.directPath,
                  thumbnailSha256: uploaded.thumbnail.sha256
                },
                contextInfo: { mediaDomainInfo: { mediaKeyDomain: "MEDIA_KEY_DOMAIN_NON_E2EE" } }
              }
            }
          },
          messageContextInfo: {
            messageAssociation: {
              associationType: "MEDIA_POLL",
              parentMessageKey: { remoteJid: to, fromMe: true, id: parentId }
            }
          }
        },
        { encAttrs: { mediatype: "image" } }
      );
    }
    const p = poll(name, values, 1, { ...o, optionImageHashes: hashes });
    return sender.sendMessage(to, p.message, { ...p.opts, messageId: parentId });
  }
  /** Send a question (the audience answers in a box). */
  async sendQuestion(to, text4) {
    const { sender } = await this.#live();
    const q = question({
      extendedTextMessage: { text: text4, previewType: "NONE", contextInfo: { isQuestion: true } }
    });
    return sender.sendMessage(to, q.message, q.opts);
  }
  sendQuestionImage = (to, data, question2, opts = {}) => this.sendMedia(to, "image", data, { ...opts, caption: question2, isQuestion: true });
  /** Send a video with a song attached (the app's "music" post; the video is what plays). */
  sendMusic = (to, video, music, opts = {}) => {
    const parts = musicParts(music);
    return this.sendMedia(to, "video", video, {
      ...opts,
      contextInfo: { ...opts.contextInfo, ...parts.contextInfo },
      fields: { ...opts.fields, ...parts.fields },
      // Only channels carry the song marker; in a group it is rejected.
      ...to.endsWith("@newsletter") && {
        extraNodes: [{ tag: "meta", attrs: { contenttype: "song" } }]
      }
    });
  };
  async sendLocation(to, latitude, longitude, o = {}) {
    return this.sendMessage(to, location(latitude, longitude, o));
  }
  async sendContact(to, name, phoneE164) {
    return this.sendMessage(to, contactCard(name, vcardFor(name, phoneE164)));
  }
  /** Decline an incoming call (`call.callId`, `call.creator ?? call.from`). */
  async rejectCall(callId, callCreator) {
    const { receiver } = await this.#live();
    receiver.sendNode(rejectCall(callId, callCreator, receiver.nextId()));
  }
  /** Set our own profile picture (square JPEG), or a group's when `jid` is given. */
  updateProfilePicture = (jpeg, jid) => updateProfilePicture(this.#q, jpeg, jid);
  removeProfilePicture = (jid) => removeProfilePicture(this.#q, jid);
  /** Remember the account's display name (used for presence). */
  setName(name) {
    if (!this.#creds.me) throw new Error("not paired");
    this.#creds.me.name = name;
    saveAuthCreds(this.#credsPath, this.#creds);
  }
  /** Get presence updates for a contact. */
  async subscribePresence(jid) {
    const { receiver } = await this.#live();
    receiver.sendNode(presenceSubscribe(jid, receiver.nextId()));
  }
  /**
   * Log this device out of the account: tell WhatsApp to unlink it, then close. The phone shows the device gone from
   * "Linked devices". `deleteAuth` also erases the saved login (credentials, Signal keys, app-state) from `authDir`;
   * without it the files stay, but they no longer work.
   */
  async logout(o = {}) {
    const me = this.#creds.me?.id;
    if (me) {
      const { receiver } = await this.#live();
      await receiver.request(removeDeviceNode(me)).catch(() => void 0);
    }
    this.close("logged-out");
    if (o.deleteAuth) {
      (0, import_node_fs15.rmSync)(this.#credsPath, { force: true });
      (0, import_node_fs15.rmSync)(this.#signalDir, { recursive: true, force: true });
      (0, import_node_fs15.rmSync)((0, import_node_path11.join)(this.#signalDir, "..", "app-state"), { recursive: true, force: true });
    }
  }
  /** Close the connection and stop reconnecting. */
  close(reason = "client-close") {
    this.#stopped = true;
    this.#teardown();
    this.#conn?.close(reason);
    this.logger.close(reason);
    if (this.#guestTmp) (0, import_node_fs15.rmSync)(this.#guestTmp, { recursive: true, force: true });
  }
  // ---- internals -----------------------------------------------------------------------------
  async #resolveVersion() {
    try {
      const { body } = await loggedFetch(this.logger, "https://web.whatsapp.com/sw.js");
      const rev = body.match(/\\?"client_revision\\?":\s*(\d+)/)?.[1];
      if (rev) {
        this.logger.event("version.resolved", { revision: rev });
        return { ...this.#config, version: [2, 3e3, Number(rev)] };
      }
      this.logger.event("version.fallback", { reason: "no client_revision in sw.js" });
    } catch (error) {
      this.logger.event("version.fallback", { reason: "fetch failed", error });
    }
    return this.#config;
  }
  #teardown() {
    this.#www.invalidate();
    clearTimeout(this.#qrTimer);
    clearInterval(this.#keepAlive);
    this.#receiver = void 0;
    this.#sender = void 0;
    this.#appState = void 0;
    this.#isOpen = false;
  }
  /**
   * One-time `guest_reg` HTTP call for guest mode; cached so a reconnect does not re-register.
   * Brackets it with the same `pre_pn_client_log` beacons a real browser guest session sends, under
   * one shared `access_session_id`/`expid` (see `newGuestSession()` in `guest.ts`) — not required for
   * `guest_reg` or the login to work, done to match the real client's request pattern.
   */
  async #registerGuest() {
    const session = this.#guestSession ??= newGuestSession();
    const inviteCode = parseCallLinkToken(this.#options.guest.inviteCode);
    void guestPreFlightLog("guest_calling_join_clicked", session, this.#config);
    const r = await guestReg(this.#creds, this.#config, {
      ...this.#options.guest,
      inviteCode,
      accessSessionId: session.accessSessionId,
      fingerprint: session.fingerprint
    });
    this.logger.event("guest.registered", { status: r.status, inviteCode, lid: r.lid });
    if (r.status !== 200)
      throw new Error(`guest_reg failed: HTTP ${r.status} ${r.body.slice(0, 300)}`);
    this.#guestLid = r.lid;
    if (r.lid) this.#creds.me = { id: r.lid, lid: r.lid };
    this.#guestRegistered = true;
    void guestPreFlightLog("guest_calling_join_success", session, this.#config);
  }
  #start() {
    this.#terminal = void 0;
    if (this.#isGuest && !this.#guestRegistered) {
      this.#events.emit("connection", { state: "connecting" });
      void this.#registerGuest().then(() => this.#startConnection()).catch((error) => {
        this.logger.event("guest.reg-failed", error);
        this.#events.emit("close", { reason: "guest-registration-failed", willReconnect: false });
        this.#events.emit("connection", {
          state: "close",
          reason: "guest-registration-failed",
          willReconnect: false
        });
      });
      return;
    }
    this.#startConnection();
  }
  #startConnection() {
    const paired = Boolean(this.#creds.me);
    const payload = this.#isGuest ? guestPayload(this.#creds, this.#config, this.#guestLid) : paired ? loginPayload(this.#creds, this.#config) : registrationPayload(this.#creds, this.#config);
    this.logger.event("client.start", {
      mode: this.#isGuest ? "guest" : paired ? "login" : "register",
      version: this.#config.version,
      me: this.#creds.me
    });
    const conn = new Connection(
      this.logger,
      this.#creds,
      payload,
      {
        onOpen: () => {
        },
        onNode: (node) => this.#handle(conn, node),
        onClose: ({ code, reason: closeReason }) => {
          this.#teardown();
          const reason = this.#terminal ?? closeReason;
          const willReconnect = !this.#stopped && !this.#terminal && (this.#options.autoReconnect ?? true) && Boolean(this.#creds.me) && reason !== "logged-out";
          this.#events.emit("close", { ...code !== void 0 && { code }, reason, willReconnect });
          this.#events.emit("connection", {
            state: willReconnect ? "connecting" : "close",
            reason,
            ...code !== void 0 && { code },
            willReconnect,
            loggedOut: reason === "logged-out"
          });
          if (willReconnect) setTimeout(() => !this.#stopped && this.#start(), 1e3);
          else this.logger.close("disconnect", { code, reason });
        }
      },
      void 0,
      this.#isGuest ? this.#guestSession?.fingerprint.userAgent : void 0
    );
    this.#conn = conn;
    this.#events.emit("connection", { state: "connecting" });
    conn.connect();
    if (this.#isGuest)
      void loggedFetch(this.logger, "https://web.whatsapp.com/status.json").catch(() => {
      });
  }
  #handle(conn, node) {
    const failure = classifyServerFailure(node);
    if (failure) {
      this.#terminal = failure;
      this.#stopped = true;
      this.logger.event("server.terminal", { reason: failure, node });
      conn.close(failure);
      return;
    }
    if (this.#receiver?.handle(node)) return;
    const child4 = (tag) => Array.isArray(node.content) ? node.content.find((c) => c.tag === tag) : void 0;
    if (node.tag === "presence" || node.tag === "chatstate") {
      const p = parsePresence(node);
      if (p) this.#events.emit("presence", p);
      return;
    }
    const dirty = node.tag === "ib" ? child4("dirty") : void 0;
    if (dirty) {
      if (dirty.attrs["type"] === "account_sync") void this.#appState?.sync();
      conn.send({
        tag: "iq",
        attrs: {
          to: "s.whatsapp.net",
          type: "set",
          xmlns: "urn:xmpp:whatsapp:dirty",
          id: this.#receiver?.nextId() ?? "dirty"
        },
        content: [
          {
            tag: "clean",
            attrs: {
              type: dirty.attrs["type"] ?? "",
              ...dirty.attrs["timestamp"] && { timestamp: dirty.attrs["timestamp"] }
            }
          }
        ]
      });
      return;
    }
    if (node.tag === "iq" && node.attrs["type"] === "error" && this.#pairing && (node.attrs["id"] === this.#pairing.helloId || node.attrs["id"] === this.#pairing.finishId)) {
      this.logger.event("pairing-code.rejected", {
        phone: this.#pairing.phone,
        detail: node.content
      });
      this.#pairing = void 0;
      conn.close("pairing-code-rejected");
      return;
    }
    const pairDevice = node.tag === "iq" && child4("pair-device");
    if (pairDevice) {
      conn.send({
        tag: "iq",
        attrs: { to: "s.whatsapp.net", type: "result", id: node.attrs["id"] ?? "" }
      });
      const phone = this.#options.pairWithPhoneNumber;
      if (phone) {
        if (!this.#pairing) {
          const code = this.#options.customPairingCode ? normalizePairingCode(this.#options.customPairingCode) : generatePairingCode();
          const helloId = `pc-${Date.now().toString(36)}`;
          this.#pairing = { phone, code, helloId };
          void companionHello(this.#creds, phone, code, this.#config.browser).then((hello) => {
            conn.send({ ...hello, attrs: { ...hello.attrs, id: helloId } });
            this.logger.event("pairing-code.requested", { phone });
            this.#events.emit("pairing-code", { code });
            this.#events.emit("connection", { state: "connecting", pairingCode: code });
          }).catch((error) => this.logger.event("pairing-code.error", error));
        }
        return;
      }
      const refs = pairDevice.content.filter((c) => c.tag === "ref");
      let ms = 6e4;
      const next = () => {
        const ref = refs.shift();
        if (!ref) {
          this.logger.event("qr.exhausted");
          conn.close("qr-timeout");
          return;
        }
        const qr = qrString(Buffer.from(ref.content).toString("utf8"), this.#creds);
        this.logger.event("qr.generated", { qr });
        this.#events.emit("qr", { qr });
        this.#events.emit("connection", { state: "connecting", qr });
        this.#qrTimer = setTimeout(next, ms);
        ms = 2e4;
      };
      next();
      return;
    }
    if (node.tag === "notification" && node.attrs["type"] === "link_code_companion_reg" && this.#pairing) {
      conn.send({
        tag: "ack",
        attrs: {
          id: node.attrs["id"] ?? "",
          to: node.attrs["from"] ?? "",
          class: "notification",
          type: "link_code_companion_reg"
        }
      });
      const p = this.#pairing;
      const finishId = `pf-${Date.now().toString(36)}`;
      this.#pairing = { ...p, finishId };
      void companionFinish(node, this.#creds, p.phone, p.code).then((r) => {
        if (!r) return this.logger.event("pairing-code.empty-notification");
        this.#creds.advSecretKey = r.advSecretKey;
        saveAuthCreds(this.#credsPath, this.#creds);
        conn.send({ ...r.finish, attrs: { ...r.finish.attrs, id: finishId } });
        this.logger.event("pairing-code.finish-sent");
      }).catch((error) => this.logger.event("pairing-code.error", error));
      return;
    }
    if (node.tag === "iq" && child4("pair-success")) {
      clearTimeout(this.#qrTimer);
      try {
        const { reply, update } = handlePairSuccess(node, this.#creds);
        this.#creds = { ...this.#creds, ...update };
        saveAuthCreds(this.#credsPath, this.#creds);
        this.logger.event("pair.success", { me: this.#creds.me, platform: this.#creds.platform });
        this.#events.emit("paired", {
          id: this.#creds.me.id,
          ...this.#creds.me.lid && { lid: this.#creds.me.lid }
        });
        this.#events.emit("connection", { state: "connecting", newLogin: true });
        conn.send(reply);
      } catch (error) {
        this.logger.event("pair.error", error);
        conn.close("pair-verification-failed");
      }
      return;
    }
    if (node.tag === "success") {
      const t = Number(node.attrs["t"]);
      if (t > 1e9) this.#serverOffsetMs = t * 1e3 - Date.now();
      this.#ready = this.#onLoggedIn(conn);
      return;
    }
    if (node.tag === "iq" && node.attrs["type"] === "get" && node.attrs["xmlns"] === "urn:xmpp:ping") {
      conn.send({
        tag: "iq",
        attrs: { to: "s.whatsapp.net", type: "result", id: node.attrs["id"] ?? "" }
      });
    }
  }
  #onAppState(e) {
    this.#events.emit("app-state", e);
    const i = interpret(e);
    if (i.chat) this.#events.emit("chat.update", i.chat);
    if (i.contact) this.#events.emit("contact.update", i.contact);
    if (i.pushName && this.#creds.me && this.#creds.me.name !== i.pushName) {
      this.#creds.me.name = i.pushName;
      saveAuthCreds(this.#credsPath, this.#creds);
    }
  }
  async #onLoggedIn(conn) {
    const creds = this.#creds;
    const storage = new FileSignalStorage(
      this.#signalDir,
      creds.signedIdentityKey,
      creds.registrationId
    );
    await storage.storeSignedPreKey(creds.signedPreKey.keyId, creds.signedPreKey.record);
    this.#signalStorage = storage;
    const cipher = createSignalCipher(storage);
    const lids = new LidMap((0, import_node_path11.join)(this.#signalDir, "lid-map.json"));
    if (creds.me?.lid) lids.set(creds.me.id, creds.me.lid);
    const receiver = new Receiver({
      creds,
      saveCreds: () => saveAuthCreds(this.#credsPath, creds),
      storage,
      lids,
      cipher,
      logger: this.logger,
      send: (n) => conn.send(n),
      onMessage: (m) => {
        this.#reports.add({
          id: m.id,
          t: m.timestamp ?? Math.floor(Date.now() / 1e3),
          fromMe: false,
          chat: m.from,
          ...m.participant && { participant: m.participant },
          message: m.message,
          ...m.reporting && { reporting: m.reporting },
          // The key is derived with our JID in the same addressing as the sender's.
          ...this.#creds.me && {
            meId: (m.from.endsWith("@g.us") ? m.from : (m.participant ?? m.from).endsWith("@lid") && this.#creds.me.lid ? this.#creds.me.lid : this.#creds.me.id).replace(/:\d+@/, "@")
          }
        });
        this.#events.emit("message", m);
      },
      onHistory: (n) => {
        void loadHistory(n).then((chunk) => {
          this.logger.event("history.chunk", {
            syncType: chunk.syncType,
            progress: chunk.progress,
            chats: chunk.chats.length,
            messages: chunk.chats.reduce((a, c) => a + c.messages.length, 0)
          });
          for (const m of chunk.lidMappings) lids.set(m.pn, m.lid);
          this.#events.emit("history", chunk);
        }).catch((error) => this.logger.event("history.error", error));
      },
      onChannelStatus: (node) => {
        const T = protoType("Message");
        const e = parseChannelStatus(
          node,
          (b) => T.toObject(T.decode(b), { longs: String, enums: String })
        );
        if (e) this.#events.emit("channel.status", e);
      },
      onCall: (node) => {
        const c = parseCall(node);
        if (c) this.#trackCall(c, node);
        if (c) this.#events.emit("call", { ...c, node });
      },
      onReceipt: (node) => {
        if (node.attrs["from"]) this.#events.emit("receipt", parseReceipt(node));
        if (node.attrs["type"] === "retry" && node.attrs["from"])
          void this.#sender?.handleRetryReceipt(node).catch((e) => this.logger.event("retry.error", e));
      },
      onUndecryptable: (key) => {
        this.#events.emit("message.undecryptable", { key });
        if (!this.#autoRecover) return;
        const now = Date.now();
        this.#recoverTimes = this.#recoverTimes.filter((t) => now - t < 6e4);
        if (this.#recoverTimes.length >= 10) return;
        this.#recoverTimes.push(now);
        void this.requestPlaceholderResend(key).catch(
          (e) => this.logger.event("recover.resend-failed", e)
        );
      },
      onResentMessage: (bytes2) => {
        const t = protoType("WebMessageInfo");
        const w = t.toObject(t.decode(bytes2), { bytes: Buffer, longs: Number });
        if (w.key && w.message)
          this.#events.emit("message.resent", {
            key: w.key,
            message: w.message,
            ...w.messageTimestamp !== void 0 && { timestamp: Number(w.messageTimestamp) }
          });
      },
      onAppStateKeys: (keys) => {
        this.#appState?.addKeys(keys);
        void this.#appState?.sync();
      },
      onNotification: (node) => {
        const type = node.attrs["type"] ?? "";
        this.#events.emit("notification", { type, node });
        if (type === "privacy_token") {
          const from = node.attrs["sender_lid"] ?? node.attrs["from"] ?? "";
          this.#tcTokens.storeFrom(node, from.replace(/:\d+@/, "@"));
        }
        if (type === "w:gp2")
          for (const n of parseGroupNotification(node)) this.#events.emit("group.update", n);
        if (type === "server_sync") {
          const names = (Array.isArray(node.content) ? node.content : []).filter((c) => c.tag === "collection").map((c) => c.attrs["name"] ?? "").filter(Boolean);
          void this.#appState?.sync(names);
        }
      }
    });
    this.#receiver = receiver;
    this.#appState = new AppStateSync({
      dir: (0, import_node_path11.join)(this.#signalDir, "..", "app-state"),
      request: (n) => receiver.request(n),
      logger: this.logger,
      onEvent: (e) => this.#onAppState(e),
      onMissingKeys: (ids) => {
        void this.#sender?.sendPeerMessage({
          protocolMessage: {
            type: "APP_STATE_SYNC_KEY_REQUEST",
            appStateSyncKeyRequest: { keyIds: ids.map((keyId) => ({ keyId })) }
          }
        }).catch((e) => this.logger.event("appstate.key-request-failed", e));
      }
    });
    this.#sender = new Sender({
      creds,
      storage,
      lids,
      cipher,
      receiver,
      logger: this.logger,
      senderKeyMemoryPath: (0, import_node_path11.join)(this.#signalDir, "sender-key-memory.json"),
      tc: this.#tcTokens,
      onSent: (id, to, m) => {
        receiver.rememberOwn(id, to, m);
        this.#reports.add({
          id,
          t: Math.floor(Date.now() / 1e3),
          fromMe: true,
          chat: to,
          message: m
        });
      },
      ...this.antiban && {
        gate: (to, m) => this.antiban.gate(to, AntiBan.signature(signatureOf(m)))
      }
    });
    try {
      await receiver.request({
        tag: "iq",
        attrs: { to: "s.whatsapp.net", type: "set", xmlns: "passive" },
        content: [{ tag: "active", attrs: {} }]
      });
      await receiver.ensurePreKeys();
      void this.#appState.sync();
    } catch (error) {
      this.logger.event("login.setup-failed", error);
    }
    this.#keepAlive = setInterval(() => {
      if (conn.state === "open")
        conn.send({
          tag: "iq",
          attrs: { id: receiver.nextId(), to: "s.whatsapp.net", type: "get", xmlns: "w:p" }
        });
    }, 3e4);
    this.#isOpen = true;
    this.#events.emit("open", { id: creds.me?.id ?? "" });
    if (!creds.signedPreKeyAt || Date.now() - creds.signedPreKeyAt >= SIGNED_PRE_KEY_INTERVAL_MS)
      void this.rotateSignedPreKey().catch((e) => this.logger.event("prekey.rotate-failed", e));
    this.#events.emit("connection", { state: "open" });
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
function serialize2(client, raw) {
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ANTIBAN_DEFAULTS,
  AntiBan,
  AntiBanError,
  AppStateCollection,
  Client,
  FrameDecoder,
  GroupCache,
  MemoryAuthStore,
  MemorySignalStorage,
  MemoryStore,
  NoiseTransport,
  NoiseXxHandshake,
  ProtocolLogger,
  REPORT_FLOWS,
  ReportStore,
  Room,
  SignalCipher,
  TypedEmitter,
  WAM_EVENTS,
  WAM_GLOBALS,
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
});
