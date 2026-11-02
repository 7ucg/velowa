import { Readable } from 'node:stream';

/** Typed event bus. `EventMap` maps event name -> payload type. */
type Listener<T> = (payload: T) => void;
type Unsubscribe = () => void;
declare class TypedEmitter<EventMap extends Record<string, unknown>> {
    #private;
    on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): Unsubscribe;
    emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void;
    /** Async-iterable view of one event; stops when `signal` aborts. */
    events<K extends keyof EventMap>(event: K, signal?: AbortSignal): AsyncGenerator<EventMap[K]>;
}

/**
 * Pluggable persistence. The library never decides where state lives; consumers pass an AuthStore.
 * All methods return Promises so durable backends (SQLite, Redis) fit; Signal session writes must be
 * durable before the matching ack is sent.
 */
interface AuthStore {
    get(group: string, id: string): Promise<Uint8Array | undefined>;
    /** Atomic batch: `undefined` value deletes the entry. */
    set(entries: ReadonlyArray<{
        group: string;
        id: string;
        value: Uint8Array | undefined;
    }>): Promise<void>;
}
declare class MemoryAuthStore implements AuthStore {
    #private;
    get(group: string, id: string): Promise<Uint8Array | undefined>;
    set(entries: ReadonlyArray<{
        group: string;
        id: string;
        value: Uint8Array | undefined;
    }>): Promise<void>;
}

/* tslint:disable */
/* eslint-disable */

/** A WABinary node. `content` may be a string, raw bytes or child nodes when encoding; a decoded node has only `Uint8Array` or `BinaryNode[]` (the wire format does not tell string from bytes). */
interface BinaryNode {
    tag: string;
    attrs: Record<string, string>;
    content?: string | Uint8Array | BinaryNode[];
}



/** One change to send to the other devices. `index` is the JSON-encoded index array. */
interface OutgoingMutation {
    operation: 'set' | 'remove';
    /** e.g. JSON.stringify(['archive', '4915...@s.whatsapp.net']) */
    index: string;
    /** Encoded SyncActionValue protobuf. */
    value: Uint8Array;
    /** The action's schema version (WA Web stamps each action type; most are 2, labels 3). */
    version: number;
}
interface BuiltPatch {
    /** Encoded SyncdPatch to put into the `<patch>` node. */
    patch: Uint8Array;
    version: number;
    addedMacs: AppStateMac[];
    removedIndexMacs: Uint8Array[];
}



/** Persistence the consumer provides. All writes must be durable when the promise resolves. */
interface SignalStorage {
    getIdentityKeyPair(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }>;
    getLocalRegistrationId(): Promise<number>;
    loadIdentity(name: string, device: number): Promise<Uint8Array | undefined>;
    saveIdentity(name: string, device: number, identityKey: Uint8Array): Promise<void>;
    loadSession(name: string, device: number): Promise<Uint8Array | undefined>;
    storeSession(name: string, device: number, record: Uint8Array): Promise<void>;
    loadPreKey(id: number): Promise<Uint8Array | undefined>;
    storePreKey(id: number, record: Uint8Array): Promise<void>;
    removePreKey(id: number): Promise<void>;
    loadSignedPreKey(id: number): Promise<Uint8Array | undefined>;
    storeSignedPreKey(id: number, record: Uint8Array): Promise<void>;
    loadSenderKey(key: string): Promise<Uint8Array | undefined>;
    storeSenderKey(key: string, record: Uint8Array): Promise<void>;
}

/** A device's pre-key bundle as WhatsApp delivers it (32-byte raw X25519 keys). */
interface PreKeyBundleInput {
    registrationId: number;
    deviceId: number;
    preKeyId?: number;
    preKeyPublic?: Uint8Array;
    signedPreKeyId: number;
    signedPreKeyPublic: Uint8Array;
    signedPreKeySignature: Uint8Array;
    identityKey: Uint8Array;
}

interface EncryptedMessage { type: 'msg' | 'pkmsg'; ciphertext: Uint8Array }
interface DecryptedMessage { plaintext: Uint8Array; preKeyId?: number; identityChanged: boolean }



/** Resolve an app-state sync key by id; return the 32-byte key data or undefined. */
type AppStateKeyLookup = (keyId: Uint8Array) => Uint8Array | undefined;
/** Value MAC of the previous SET for an index MAC, or undefined if none is stored. */
type PreviousValueMacLookup = (indexMac: Uint8Array) => Uint8Array | undefined;

interface AppStateMutation {
    /** Index components, e.g. ["mute", "123@s.whatsapp.net"]. */
    index: string[];
    operation: 'set' | 'remove';
    /** Encoded SyncActionValue protobuf (absent for a bare remove). */
    value?: Uint8Array;
}
interface AppStateMac { indexMac: Uint8Array; valueMac: Uint8Array }
interface AppStateResult {
    mutations: AppStateMutation[];
    /** MACs to persist so later patches can resolve REMOVEs. */
    addedMacs: AppStateMac[];
    /** Index MACs whose stored value MAC must be deleted. */
    removedIndexMacs: Uint8Array[];
}



/**
 * Hash state + MAC verification for one app-state collection.
 */
declare class AppStateCollection {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Apply an encoded `SyncdPatch`. Transactional: on error the collection is unchanged.
     */
    applyPatch(patch: Uint8Array | number[], get_key: AppStateKeyLookup, get_previous_value_mac: PreviousValueMacLookup): AppStateResult;
    /**
     * Apply an encoded `SyncdSnapshot`, rebuilding the collection from scratch.
     */
    applySnapshot(snapshot: Uint8Array | number[], get_key: AppStateKeyLookup): AppStateResult;
    /**
     * Build, encrypt and sign a patch carrying `mutations` on top of the current state. The new
     * state is held as pending: call `commitPending()` once the server accepted the patch, or
     * `discardPending()` if it did not.
     */
    buildPatch(key_id: Uint8Array | number[], key_data: Uint8Array | number[], mutations: OutgoingMutation[], get_previous_value_mac: PreviousValueMacLookup): BuiltPatch;
    /**
     * The server accepted the patch from `buildPatch`: make its state current.
     */
    commitPending(): void;
    /**
     * Drop the state from `buildPatch` (the server rejected the patch).
     */
    discardPending(): void;
    /**
     * Restore from bytes produced by `serializeState`.
     */
    static fromState(name: string, state: Uint8Array | number[]): AppStateCollection;
    /**
     * A fresh, never-synced collection.
     */
    constructor(name: string);
    /**
     * Opaque bytes to persist; feed back to `fromState`.
     */
    serializeState(): Uint8Array;
    /**
     * 128-byte LTHash.
     */
    readonly hash: Uint8Array;
    readonly name: string;
    readonly version: number;
}

/**
 * Incremental frame reassembly: `feed` raw socket bytes, then drain with `nextFrame`.
 */
declare class FrameDecoder {
    free(): void;
    [Symbol.dispose](): void;
    feed(data: Uint8Array | number[]): void;
    constructor();
    /**
     * The next complete frame payload, or `undefined` when more bytes are needed.
     */
    nextFrame(): Uint8Array | undefined;
}

/**
 * Post-handshake AES-256-GCM transport. Counters live here so TS cannot desync them.
 */
declare class NoiseTransport {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    decrypt(ciphertext: Uint8Array | number[]): Uint8Array;
    encrypt(plaintext: Uint8Array | number[]): Uint8Array;
}

/**
 * Client side of the Noise XX handshake (first connect / pairing).
 */
declare class NoiseXxHandshake {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Encoded HandshakeMessage carrying the client ephemeral (not yet framed).
     */
    buildClientHello(): Uint8Array;
    /**
     * Completes the handshake and yields the transport ciphers. Consumes the handshake.
     */
    finish(): NoiseTransport;
    /**
     * `staticPrivate`/`staticPublic`: the device's 32-byte Noise static key pair.
     * `clientPayload`: encoded ClientPayload protobuf. `prologue` defaults to the WA connection header.
     */
    constructor(static_private: Uint8Array | number[], static_public: Uint8Array | number[], client_payload: Uint8Array | number[], prologue?: Uint8Array | number[] | null);
    /**
     * Verifies the server hello (incl. certificate chain) and returns the encoded client finish.
     */
    readServerHelloAndBuildClientFinish(server_hello: Uint8Array | number[]): Uint8Array;
}

/**
 * Signal sessions and group ciphers bound to a consumer-provided `SignalStorage`.
 */
declare class SignalCipher {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Create (or re-export) our sender-key distribution message for a group.
     */
    createSenderKeyDistribution(group: string, sender: string): Promise<Uint8Array>;
    /**
     * Decrypt a `msg` / `pkmsg` envelope. The updated session is persisted before this resolves;
     * `preKeyId` (pkmsg only) is then safe to delete.
     */
    decrypt(name: string, device: number, kind: string, ciphertext: Uint8Array | number[]): Promise<DecryptedMessage>;
    /**
     * Double-Ratchet encrypt. The session is persisted before this resolves.
     */
    encrypt(name: string, device: number, plaintext: Uint8Array | number[]): Promise<EncryptedMessage>;
    /**
     * Group (sender-key) decrypt of an `skmsg`.
     */
    groupDecrypt(group: string, sender: string, ciphertext: Uint8Array | number[]): Promise<Uint8Array>;
    /**
     * Group (sender-key) encrypt. Create the distribution message first.
     */
    groupEncrypt(group: string, sender: string, plaintext: Uint8Array | number[]): Promise<Uint8Array>;
    /**
     * Whether a session with this device exists.
     */
    hasSession(name: string, device: number): Promise<boolean>;
    constructor(storage: SignalStorage);
    /**
     * Establish an outgoing session from a device's pre-key bundle (X3DH).
     */
    processPreKeyBundle(name: string, device: number, bundle: PreKeyBundleInput): Promise<boolean>;
    /**
     * Process a received sender-key distribution message.
     */
    processSenderKeyDistribution(group: string, sender: string, skdm: Uint8Array | number[]): Promise<void>;
}

/**
 * Wrap a payload in a 3-byte length-prefixed frame; `header` is prepended once (first frame only).
 */
declare function encodeFrame(payload: Uint8Array | number[], header?: Uint8Array | number[] | null): Uint8Array;

/** Encode a node into a frame payload (plain format byte + node bytes). */
declare function encodeNode(node: BinaryNode): Uint8Array;
/** Decode a frame payload (format byte + node bytes; zlib-compressed payloads are inflated). */
declare function decodeNode(payload: Uint8Array): BinaryNode;

/** Start a Noise XX handshake with the device's static key pair and encoded ClientPayload. */
declare function startXxHandshake(staticPrivate: Uint8Array, staticPublic: Uint8Array, clientPayload: Uint8Array): NoiseXxHandshake;
/** The 4-byte connection header, sent once in front of the first frame. */
declare function connHeader(): Uint8Array;

interface IdentityKeys {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
}
interface GeneratedSignedPreKey {
    id: number;
    record: Uint8Array;
    publicKey: Uint8Array;
    signature: Uint8Array;
}
interface GeneratedPreKey {
    id: number;
    record: Uint8Array;
    publicKey: Uint8Array;
}
declare function newIdentityKeyPair(): IdentityKeys;
declare function newSignedPreKey(identityPrivate: Uint8Array, id: number): GeneratedSignedPreKey;
declare function newPreKeys(start: number, count: number): GeneratedPreKey[];
/**
 * The wasm `SignalCipher` borrows itself mutably across `await`s, so two overlapping calls (a decrypt while a
 * resend encrypts, ...) trip Rust's re-entrancy guard and could interleave ratchet updates. Every call goes
 * through one queue, which also gives the ordering Double-Ratchet state needs.
 */
declare function createSignalCipher(storage: SignalStorage): SignalCipher;
/** Volatile storage: fine for tests and throwaway sessions, never for a real account. */
declare class MemorySignalStorage implements SignalStorage {
    #private;
    private readonly identity;
    private readonly registrationId;
    constructor(identity: IdentityKeys, registrationId: number);
    getIdentityKeyPair(): Promise<IdentityKeys>;
    getLocalRegistrationId(): Promise<number>;
    loadIdentity(name: string, device: number): Promise<Uint8Array<ArrayBufferLike> | undefined>;
    saveIdentity(name: string, device: number, key: Uint8Array): Promise<void>;
    loadSession(name: string, device: number): Promise<Uint8Array<ArrayBufferLike> | undefined>;
    storeSession(name: string, device: number, record: Uint8Array): Promise<void>;
    loadPreKey(id: number): Promise<Uint8Array<ArrayBufferLike> | undefined>;
    storePreKey(id: number, record: Uint8Array): Promise<void>;
    removePreKey(id: number): Promise<void>;
    loadSignedPreKey(id: number): Promise<Uint8Array<ArrayBufferLike> | undefined>;
    storeSignedPreKey(id: number, record: Uint8Array): Promise<void>;
    loadSenderKey(key: string): Promise<Uint8Array<ArrayBufferLike> | undefined>;
    storeSenderKey(key: string, record: Uint8Array): Promise<void>;
}

/** A never-synced collection (`regular`, `regular_low`, `regular_high`, `critical_block`, `critical_unblock_low`). */
declare function newAppStateCollection(name: string): AppStateCollection;
/** Restore a collection from `AppStateCollection.serializeState()` bytes. */
declare function restoreAppStateCollection(name: string, state: Uint8Array): AppStateCollection;

interface LinkPreview {
    /** The URL as found in the text. */
    matchedText: string;
    /** Where the page says it lives (`og:url`, else the final URL). */
    canonicalUrl: string;
    title: string;
    description?: string;
    imageUrl?: string;
    /** Small JPEG preview picture, when one could be made. */
    jpegThumbnail?: Uint8Array;
}
interface LinkPreviewOptions {
    fetch?: typeof fetch;
    /** Resolves a host to its addresses; replaced in tests. */
    resolve?: (host: string) => Promise<string[]>;
    timeoutMs?: number;
    /** Cap for the page (default 512 KiB) and the picture (default 1 MiB). */
    maxPageBytes?: number;
    maxImageBytes?: number;
    /** Thumbnails larger than this are dropped when no image library is installed. */
    maxThumbBytes?: number;
}
/** First http(s) URL in a text, without trailing punctuation. */
declare function findUrl(text: string): string | undefined;
/**
 * Build the preview WhatsApp shows under a link: title, description and a small picture, read from the page's Open
 * Graph / Twitter / `<title>` tags. Returns undefined when the text has no link or the page gives no title. Hosts
 * that resolve to private addresses are never contacted.
 */
declare function fetchLinkPreview(text: string, opts?: LinkPreviewOptions): Promise<LinkPreview | undefined>;
/** The text message that carries a preview. */
declare function linkPreviewMessage(text: string, p: LinkPreview): Record<string, unknown>;

interface RetentionOptions {
    /** Delete runs older than this many days. Default 30; 0 turns the rule off. */
    maxAgeDays?: number;
    /** Delete the oldest runs until the logs take at most this many megabytes. Default 1024; 0 turns it off. */
    maxTotalMB?: number;
    /** Keep at most this many runs. Default unlimited. */
    maxSessions?: number;
}
interface SessionInfo {
    /** Absolute path of the run's directory. */
    path: string;
    /** `<day>/<time>-<label>` (or the flat name of an old run). */
    name: string;
    label: string;
    startedAt: Date;
    endedAt?: Date;
    reason?: string;
    bytes: number;
    pinned: boolean;
    compressed: boolean;
}
/** Every run under `dir` (grouped by day, or flat from older versions), oldest first. Symlinks are ignored. */
declare function listSessions(dir: string): SessionInfo[];
/** Move runs from the old flat layout into their day folders. Returns how many moved. */
declare function migrateFlatSessions(dir: string): number;
/** gzip every large text log of a finished run (`x.jsonl` becomes `x.jsonl.gz`). */
declare function compressSession(path: string): Promise<number>;
/** Delete runs by age, count and total size. Returns the runs removed. `keep` are paths that must stay. */
declare function pruneSessions(dir: string, retention?: RetentionOptions, keep?: string[]): SessionInfo[];

interface ProtocolLoggerOptions {
    /** Master switch. Default true. When false every method is a no-op. */
    enabled?: boolean;
    /** Base directory; one sub-directory per run is created inside, grouped by day. Default `./logs`. */
    dir?: string;
    /** Label added to the run's directory name. */
    label?: string;
    /** Start a new part of a log file after this many megabytes (`frames.0001.jsonl`, ...). Default 32; 0 turns it off. */
    rotateMB?: number;
    /** Delete old runs by age / total size when a logger starts. `false` keeps everything. Default 30 days and 1 GB. */
    retention?: RetentionOptions | false;
    /** Compress runs older than this many hours when a logger starts. Default 24; 0 turns it off. */
    compressAfterHours?: number;
    /** Never delete this run (adds a `.keep` file to it). */
    keep?: boolean;
}
type Direction = 'send' | 'recv';
/**
 * Records everything a connection does, unfiltered, from the first byte until disconnect or
 * server stop: raw wire frames, decoded stanzas, HTTP requests, socket lifecycle and free-form
 * protocol events. Every entry is written straight to the file (no buffering in this process), so nothing is
 * lost if the process dies.
 *
 * Layout (see `storage.ts`): `<dir>/<YYYY-MM-DD>/<HH-MM-SS>-<label>/` holds
 *   - `session.json`  label, start/end, reason, sizes and line counts
 *   - `events.jsonl`  every entry in order (the complete timeline)
 *   - `frames.jsonl`  raw WebSocket payloads (hex) in both directions, before decrypt / after encrypt
 *   - `nodes.jsonl`   decoded stanzas (JSON) in both directions
 *   - `nodes.xml.log` the same stanzas as readable XML
 *   - `http.jsonl`    HTTP requests and responses (headers + body)
 * A file that grows past `rotateMB` continues in `name.0001.ext`. `<dir>/latest` and `<dir>/latest-<label>` link
 * to the newest run. When a logger starts, runs older than a day are compressed and old ones are deleted by age and
 * total size (30 days / 1 GB by default; `retention: false` keeps everything, a `.keep` file pins one run).
 *
 * Logs contain account data (identifiers, later message content). Keep them private.
 */
declare class ProtocolLogger {
    #private;
    readonly enabled: boolean;
    readonly sessionDir: string | undefined;
    constructor(options?: ProtocolLoggerOptions);
    /** Free-form protocol/lifecycle event. */
    event(kind: string, data?: unknown): void;
    /** Raw bytes on the wire (WebSocket message payload). */
    frame(direction: Direction, bytes: Uint8Array, note?: string): void;
    /** A decoded stanza. */
    node(direction: Direction, node: BinaryNode): void;
    /** HTTP exchange. */
    http(entry: Record<string, unknown>): void;
    /** Final entry; call on disconnect / server stop. Idempotent. */
    close(reason: string, detail?: unknown): void;
}

type MexFn = <T = unknown>(queryId: string, variables: unknown, dataPath?: string) => Promise<T>;

type RequestFn = (node: BinaryNode) => Promise<BinaryNode>;
interface GroupParticipant {
    id: string;
    phoneNumber?: string;
    lid?: string;
    /** `superadmin` (creator), `admin`, or null for regular members. */
    admin: 'admin' | 'superadmin' | null;
}
interface GroupMetadata {
    id: string;
    subject: string;
    subjectOwner?: string;
    subjectTime?: number;
    creation?: number;
    owner?: string;
    desc?: string;
    descId?: string;
    size: number;
    addressingMode: 'lid' | 'pn';
    /** Only admins may edit group info. */
    restrict: boolean;
    /** Only admins may send messages. */
    announce: boolean;
    isCommunity: boolean;
    isCommunityAnnounce: boolean;
    linkedParent?: string;
    joinApprovalMode: boolean;
    /** `all_member_add` when every member may add participants. */
    memberAddAll: boolean;
    ephemeralDuration?: number;
    participants: GroupParticipant[];
}
type ParticipantAction = 'add' | 'remove' | 'promote' | 'demote';
type GroupSetting = 'announcement' | 'not_announcement' | 'locked' | 'unlocked';
declare class Groups {
    #private;
    private readonly request;
    private readonly mex?;
    constructor(request: RequestFn, mex?: MexFn | undefined);
    /** People who left (or were removed from) a group, with the reason and the time (unix seconds). */
    pastParticipants(jid: string): Promise<{
        jid: string;
        reason?: string;
        leftAt?: number;
    }[]>;
    /** Take back a request to join. */
    cancelMembershipRequest(jid: string, participantJid: string): Promise<void>;
    /** Accept the group's current rules / notice ("OK" on the group-changed banner). */
    acknowledge(jid: string): Promise<void>;
    /** Messages that members reported to the admins, with who reported them. */
    reportedMessages(jid: string): Promise<{
        messageId: string;
        reporters: {
            jid: string;
            at?: number;
        }[];
    }[]>;
    /** Join a group by the invite that was sent to you as a message (`groupInviteMessage`); `admin` is who sent it. */
    acceptInviteV4(invite: {
        groupJid: string;
        inviteCode: string;
        inviteExpiration: number | string;
        admin: string;
    }): Promise<void>;
    /** Withdraw an invite that you sent to someone (they can no longer use the message). */
    revokeInviteV4(jid: string, invitedJid: string): Promise<void>;
    /** Members of a community's linked groups. */
    linkedParticipants(jid: string): Promise<{
        jid: string;
        phoneNumber?: string;
    }[]>;
    /** Sub-groups of a community. */
    linkedSubgroups(communityJid: string): Promise<{
        jid: string;
        linkType?: string;
    }[]>;
    /** Join a sub-group of a community you are in. `approvalRequested` is true when an admin has to let you in. */
    joinLinked(parentJid: string, linkedGroupJid: string, type?: string): Promise<{
        approvalRequested: boolean;
    }>;
    /** Full group info as GraphQL gives it. */
    info: (jid: string) => Promise<unknown>;
    infoWithBots: (jid: string) => Promise<unknown>;
    isInternal(jid: string): Promise<boolean>;
    /** What a group is, by its invite code, before you join. */
    infoByCode: (code: string) => Promise<unknown>;
    /** Several groups in one call. */
    batch: (jids: string[]) => Promise<unknown>;
    inviteLink: (jid: string) => Promise<unknown>;
    participating: () => Promise<unknown>;
    /** Groups WhatsApp suggests adding to a community. */
    suggested: (communityJid: string) => Promise<unknown>;
    linkedInfo: (jid: string) => Promise<unknown>;
    subgroups: (communityJid: string) => Promise<unknown>;
    createViaGraphql: (subject: string, participantJids: string[]) => Promise<unknown>;
    addParticipantsViaGraphql: (jid: string, participantJids: string[]) => Promise<unknown>;
    resetInviteLink: (jid: string) => Promise<unknown>;
    /** Let members who are not admins create sub-groups in a community. */
    allowNonAdminSubgroupCreation: (communityJid: string, allow: boolean) => Promise<unknown>;
    preRegisteredAddRequests: (jid: string) => Promise<unknown>;
    suggestedContacts: (jid: string) => Promise<unknown>;
    /** Profile pictures of several groups (or users) at once: `type` `preview` is the small one, `image` the full size. */
    pictures(jids: string[], type?: 'preview' | 'image'): Promise<{
        jid: string;
        type?: string;
        directPath?: string;
        url?: string;
    }[]>;
    /** Full metadata of one group. */
    metadata(jid: string): Promise<GroupMetadata>;
    /** Every group we are in, keyed by JID. */
    fetchAll(): Promise<Record<string, GroupMetadata>>;
    create(subject: string, participants: string[], meId?: string): Promise<GroupMetadata>;
    leave(id: string): Promise<void>;
    setSubject(jid: string, subject: string): Promise<void>;
    /** Set or (with an empty string) delete the description. */
    setDescription(jid: string, description: string): Promise<void>;
    /** Add / remove / promote / demote members. Returns the per-member status (`200` = ok). */
    updateParticipants(jid: string, participants: string[], action: ParticipantAction): Promise<{
        jid: string;
        status: string;
    }[]>;
    /** Add Meta AI (or another bot) to a group so it can be mentioned there. */
    addBot(jid: string, botUser?: string): Promise<{
        jid: string;
        status: string;
    }[]>;
    inviteCode(jid: string): Promise<string | undefined>;
    revokeInvite(jid: string): Promise<string | undefined>;
    /** Join a group by invite code; returns the group JID. */
    acceptInvite(code: string): Promise<string | undefined>;
    inviteInfo(code: string): Promise<GroupMetadata>;
    /** Disappearing messages: seconds (86400, 604800, 7776000) or 0 to turn off. */
    setEphemeral(jid: string, seconds: number): Promise<void>;
    /** `announcement` = only admins send; `locked` = only admins edit info. */
    setting(jid: string, setting: GroupSetting): Promise<void>;
    setMemberAddMode(jid: string, mode: 'admin_add' | 'all_member_add'): Promise<void>;
    setJoinApproval(jid: string, mode: 'on' | 'off'): Promise<void>;
    joinRequests(jid: string): Promise<Record<string, string>[]>;
    updateJoinRequests(jid: string, participants: string[], action: 'approve' | 'reject'): Promise<{
        jid: string;
        status: string;
    }[]>;
}
interface GroupNotification {
    group: string;
    /** Who did it, when known. */
    actor?: string;
    timestamp?: number;
    /** `add` / `remove` / `promote` / `demote` / `subject` / `description` / `announcement` / `locked` / `ephemeral` / ... */
    action: string;
    participants?: string[];
    subject?: string;
    description?: string;
}

interface DecodedMessage {
    id: string;
    from: string;
    participant?: string;
    timestamp?: number;
    pushName?: string;
    /** The server's `reporting_tag` and the sender's token (for reports); present on end-to-end encrypted messages. */
    reporting?: {
        tag?: Uint8Array;
        token?: Uint8Array;
        version?: number;
    };
    message: Record<string, unknown>;
}

/** Extras for one outgoing message. */
interface SendOptions {
    /** Extra attributes on the `<message>` stanza, e.g. `{ edit: '1' }` for an edit, `{ edit: '7' }` for a revoke. */
    stanzaAttrs?: Record<string, string>;
    /** Attributes added to every `<enc>` node, e.g. `{ mediatype: 'image' }` or `{ 'decrypt-fail': 'hide' }`. */
    encAttrs?: Record<string, string>;
    /** Status/story posts: who may see it (the status audience). Required for `status@broadcast`. */
    statusRecipients?: string[];
    /** Audience mode written to `<meta status_setting>`; defaults to `contacts`. */
    statusPrivacy?: 'contacts' | 'allowlist' | 'denylist';
    /** Extra child nodes of `<message>` (e.g. `<meta .../>`). */
    extraNodes?: BinaryNode[];
    /**
     * Which devices a 1:1 message goes to (default: all of them, ours included):
     * `recipient` only the other person's devices (none of our own), `primary` only their phone,
     * `no-linked` their phone and our own devices, but not their linked devices.
     */
    devices?: 'recipient' | 'primary' | 'no-linked';
    /** Use this message id instead of a fresh one (when another message has to point at it). */
    messageId?: string;
    /** Called with the server's ack (channels: `server_id` is the post's number, needed for labels). */
    onAck?: (ack: BinaryNode) => void;
}

/** Identifies a message in a chat (WhatsApp's "message key"). */
interface MessageKey {
    remoteJid: string;
    id: string;
    fromMe?: boolean;
    /** Author inside a group (set for messages from others in groups). */
    participant?: string;
}
/** A message being replied to. `message` is the quoted message's WAProto content. */
interface Quoted {
    key: MessageKey;
    message: Record<string, unknown>;
}
interface TextOptions {
    quoted?: Quoted;
    /** JIDs to @mention; the text must contain `@<number>` for each. */
    mentions?: string[];
    /** Disappearing-message timer in seconds for this message (use the chat's current setting). */
    expiration?: number;
    /**
     * Text only: attach a link preview. `true` fetches one for the first link in the text; or pass your own
     * (`fetchLinkPreview`).
     */
    linkPreview?: boolean | LinkPreview;
    /** Mark the message as a question (channels show it with an answer box). */
    isQuestion?: boolean;
}
type ReceiptType = 'read' | 'read-self' | 'played' | 'sender';
type ChatState = 'composing' | 'paused' | 'recording';

/**
 * Media as bytes, an `http(s)` URL, a local file, or a stream. `{ url }` can only ever be fetched from the network;
 * a local file needs the explicit `{ path }`, so a link that came from outside can never read a file off this machine.
 * Only pass `{ path }` for paths you chose yourself.
 */
type MediaSource = Uint8Array | {
    url: string;
} | {
    path: string;
} | {
    stream: Readable;
};
interface Common {
    /** JIDs to @mention (the text needs `@<number>` for each). */
    mentions?: string[];
    /** Open-once media. */
    viewOnce?: boolean;
}
type MessageContent = Common & ({
    text: string;
    linkPreview?: boolean;
} | {
    image: MediaSource;
    caption?: string;
    mimetype?: string;
} | {
    video: MediaSource;
    caption?: string;
    mimetype?: string;
    gif?: boolean;
} | {
    audio: MediaSource;
    voiceNote?: boolean;
    mimetype?: string;
    seconds?: number;
} | {
    document: MediaSource;
    mimetype: string;
    fileName?: string;
    caption?: string;
} | {
    sticker: MediaSource;
} | {
    react: {
        key: MessageKey;
        emoji: string;
    };
} | {
    edit: MessageKey;
    text: string;
} | {
    revoke: MessageKey;
} | {
    forward: Record<string, unknown>;
} | {
    poll: {
        name: string;
        values: string[];
        selectableCount?: number;
    };
} | {
    location: {
        latitude: number;
        longitude: number;
        name?: string;
        address?: string;
    };
} | {
    contacts: {
        displayName?: string;
        contacts: {
            name: string;
            vcard: string;
        }[];
    };
} | {
    text: string;
    buttons: {
        id: string;
        text: string;
    }[];
    footer?: string;
    title?: string;
} | {
    text: string;
    title: string;
    buttonText: string;
    footer?: string;
    sections: {
        title: string;
        rows: {
            id: string;
            title: string;
            description?: string;
        }[];
    }[];
});
interface SendContentOptions {
    /** Reply to this message (what a received message gives you as `{ key, message }`). */
    quoted?: Quoted;
    /** Disappearing-message timer in seconds for this message. */
    expiration?: number;
}

interface MediaFileOptions {
    /** Play at most this many seconds of the file (default 600). */
    maxSeconds?: number;
}
interface VideoFileOptions extends MediaFileOptions {
    /** Frames per second to send (default 15). */
    fps?: number;
    /** The picture is scaled to fit this width, keeping its aspect ratio (default 480; the height is even). */
    width?: number;
}
/** Files the call options can name instead of raw audio and video. */
interface CallFileOptions {
    /** An audio file (mp3, ogg, wav, m4a, ...) to say into the call. It plays once; silence follows. */
    audioFile?: string;
    /** A video file (mp4, ...) to send as the picture, looped. Its sound plays too unless `audioFile` is given. */
    videoFile?: string;
    fileOptions?: VideoFileOptions;
}
/** Decode any audio (or the sound of a video) to 16 kHz mono PCM. */
declare function decodeAudioFile(path: string, o?: MediaFileOptions): Promise<Int16Array>;
/** Decode a video to H.264 access units (Annex-B, baseline, a keyframe every two seconds). */
declare function decodeVideoFile(path: string, o?: VideoFileOptions): Promise<{
    frames: Uint8Array[];
    fps: number;
}>;

interface LocalAudioOptions {
    /** Send the microphone: `true` for the default source, or a source name from `pactl list short sources`. */
    mic?: boolean | string;
    /** Play the call: `true` for the default sink, or a sink name from `pactl list short sinks`. */
    speaker?: boolean | string;
}

/**
 * A `User-Agent` string plus the `os_name`/`os_version`/`browser`/`browser_version` fields `guest_reg`
 * takes separately (see `guest.ts`) — the four always describe the same browser, so they are generated
 * together, never independently.
 */
interface BrowserFingerprint {
    osName: string;
    osVersion: string;
    browser: string;
    browserVersion: string;
    userAgent: string;
}

interface ClientConfig {
    /** WhatsApp Web client revision, e.g. [2, 3000, 1050701434]. */
    version: [number, number, number];
    /** [os, device-type] shown under "Linked devices". */
    browser: [string, string];
    countryCode: string;
}

interface GuestRegOptions {
    /** The call-link token (just the token; resolve a full URL with `parseCallLinkToken` first). */
    inviteCode: string;
    /** Display name shown to the other call participants; copied into the roster at admission. */
    guestName: string;
    /** UI locale as two codes, both the same case the real client sends. Default `['DE', 'DE']` (unconfirmed semantics — see guest.ts doc comment). */
    locale?: [lc: string, lg: string];
    /** Reuse an existing session's `accessSessionId` (from `newGuestSession()`) instead of generating a fresh one — the real client sends `guest_reg` and its `pre_pn_client_log` beacons (`guestPreFlightLog()`) under the same id. */
    accessSessionId?: string;
    /** The `os_name`/`os_version`/`browser`/`browser_version` to send and the `User-Agent` to send them
     * under — one random, internally consistent pick from `randomFingerprint()` (`fingerprint.ts`) by
     * default. Pass one explicitly to also use it for the WS connection's own `User-Agent` (see
     * `newGuestSession()` below and `Client`'s guest mode, which does exactly that). */
    fingerprint?: BrowserFingerprint;
    /** Replaced in tests. */
    fetch?: typeof fetch;
}

/** What the limiter does when a send would break a limit it cannot wait out. */
declare class AntiBanError extends Error {
    readonly reason: 'day-limit' | 'hour-limit' | 'identical-messages';
    constructor(message: string, reason: 'day-limit' | 'hour-limit' | 'identical-messages');
}
interface AntiBanConfig {
    /** Sliding-window caps; a send over the minute cap waits, over the hour/day cap throws `AntiBanError`. */
    maxPerMinute: number;
    maxPerHour: number;
    maxPerDay: number;
    /** Random pause between two sends, once the burst allowance is used up. */
    minDelayMs: number;
    maxDelayMs: number;
    /** Extra pause before the first message to a chat we have not written to in this session. */
    newChatDelayMs: number;
    /** The same text more than this often within `identicalWindowMs` is refused (copy-paste spam). */
    maxIdenticalMessages: number;
    identicalWindowMs: number;
    /** Messages that go out without the random pause, after a quiet spell of `burstResetMs`. */
    burstAllowance: number;
    burstResetMs: number;
    /**
     * New accounts get a fraction of the caps that grows to 100 % over `warmUpDays` after `firstSeen`
     * (pass the account's creation time; unset disables the ramp-up).
     */
    warmUpDays: number;
    firstSeen?: number;
    /** Show "typing..." for a moment before text goes out, as a person typing would. */
    typing: boolean;
}
declare const ANTIBAN_DEFAULTS: AntiBanConfig;
type Clock = {
    now(): number;
    sleep(ms: number): Promise<void>;
};
/**
 * Keeps an account's sending pattern human-looking: caps per minute/hour/day, random gaps, a pause before new
 * chats, a limit on identical texts, and an optional warm-up for fresh accounts. In memory only: a restart starts
 * the windows from zero.
 */
declare class AntiBan {
    #private;
    private readonly clock;
    private readonly random;
    readonly config: AntiBanConfig;
    constructor(config?: Partial<AntiBanConfig>, clock?: Clock, random?: () => number);
    /** Fraction of the caps that applies right now (1 = full). */
    warmUpFactor(): number;
    /** Stable key of a message's content for the identical-text check. */
    static signature(content: string): string;
    /**
     * Wait until sending `signature` to `chat` is fine, or throw `AntiBanError`. Calls are served in order, so a loop
     * that fires many sends at once is spread out.
     */
    gate(chat: string, signature: string): Promise<void>;
    /** How long "typing..." should last for a text (about 40 ms per character, 600 ms to 4 s). */
    typingMs(text: string): number;
}

/** Media kinds that have their own key-derivation label, upload path and message field. */
type MediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker';
interface MediaOptions {
    /** Post as a group status (to a group JID) instead of a normal message. */
    groupStatus?: boolean;
    /** Channels only: label the post after sending (needs the post's server number from the ack). */
    labels?: {
        aiContent?: boolean;
        paidPartnership?: boolean;
    };
    /** Extra fields of the media message itself (e.g. `annotations`). */
    fields?: Record<string, unknown>;
    /** Extra `contextInfo` fields merged into the message (e.g. music attribution). */
    contextInfo?: Record<string, unknown>;
    /** Extra stanza children, e.g. `<meta contenttype="song"/>`. */
    extraNodes?: BinaryNode[];
    mimetype?: string;
    /** Tie this message to another (an album item to its album): goes into `messageContextInfo.messageAssociation`. */
    association?: {
        associationType: string;
        parentMessageKey: {
            remoteJid: string;
            fromMe: boolean;
            id: string;
        };
    };
    caption?: string;
    /** Documents: shown file name. */
    fileName?: string;
    /** Audio / video length in seconds. */
    seconds?: number;
    /** Voice note (push-to-talk) instead of an audio file. */
    ptt?: boolean;
    /** Open-once media (images / videos / voice notes). */
    viewOnce?: boolean;
    /** Video as looping GIF. */
    gifPlayback?: boolean;
    width?: number;
    height?: number;
    /** Small JPEG preview (no image library is bundled, so supply one if you want a thumbnail). */
    jpegThumbnail?: Uint8Array;
    /** 64 byte waveform for voice notes. */
    waveform?: Uint8Array;
}

declare const APP_STATE_COLLECTIONS: readonly ["critical_block", "critical_unblock_low", "regular_high", "regular_low", "regular"];
type CollectionName = (typeof APP_STATE_COLLECTIONS)[number];
/** One decoded app-state change (a chat was muted, a contact renamed, ...). */
interface AppStateEvent {
    collection: string;
    /** Index components, e.g. `['mute', '49151...@s.whatsapp.net']`. */
    index: string[];
    /** `mute`, `pin_v1`, `archive`, `contact`, `setting_pushName`, ... (the first index component). */
    action: string;
    operation: 'set' | 'remove';
    /** The decoded SyncActionValue as JSON (undefined for removals). */
    value?: Record<string, unknown>;
    timestamp?: number;
}
interface ChatUpdate {
    id: string;
    muteEndTimestamp?: number | null;
    archived?: boolean;
    pinned?: boolean;
    unread?: boolean;
    deleted?: boolean;
    cleared?: boolean;
}
interface ContactUpdate {
    id: string;
    fullName?: string;
    firstName?: string;
    lid?: string;
}

/** A message reference used to bound "mark read / archive / delete chat" actions (`messageRange`). */
interface RangeMessage {
    key: MessageKey;
    /** Unix seconds. */
    messageTimestamp: number;
}
interface PlannedMutation {
    collection: CollectionName;
    mutation: Pick<OutgoingMutation, 'operation' | 'index' | 'version'> & {
        valueObject: Record<string, unknown>;
    };
}
declare const addLabel: (l: {
    id: string;
    name: string;
    color: number;
    predefinedId?: string;
    deleted?: boolean;
}) => PlannedMutation;
/** A quick reply ("/shortcut" text) of a business account. Deleting needs the same \`timestamp\` it was made with. */
declare const quickReply$1: (q: {
    shortcut: string;
    message: string;
    timestamp?: string;
    deleted?: boolean;
    keywords?: string[];
}) => PlannedMutation;
type StatusAudience = 'contacts' | 'except' | 'only';

interface WhatsAppLookup {
    jid: string;
    exists: boolean;
}
interface StatusInfo {
    jid: string;
    status: string | null;
    setAt: Date;
}
interface BlockOptions {
    /** The contact's LID; the server wants blocks addressed by LID once one exists. */
    lid?: string;
    /** Where the block comes from (`entry_point`); the app sends its screen name. */
    entryPoint?: string;
    /** Why (business chats): `spam`, `scam_or_fraud`, `no_longer_needed`, `no_sign_up`, `offensive_messages`, `other`. */
    reason?: string;
    reasonDescription?: string;
}
type PrivacyCategory = 'last' | 'online' | 'profile' | 'status' | 'groupadd' | 'readreceipts' | 'calladd' | 'messages' | 'stickers' | 'about';
type PrivacyValue = 'all' | 'contacts' | 'contact_blacklist' | 'none' | 'match_last_seen';

interface CallEvent {
    /** `offer`, `terminate`, `reject`, `accept`, `timeout`, ... (the call stanza's first child). */
    status: string;
    callId: string;
    /** The chat / device the call stanza came from. */
    from: string;
    /** Who started the call. */
    creator?: string;
    isVideo?: boolean;
    isGroup?: boolean;
    /** `<video state>` of an in-call video change: 1 on, 3/11 upgrade request, 4 accept, 5 reject, 6 stopped. */
    videoState?: number;
    /** `<user_action>` raise-hand: true raised, false lowered. */
    handRaised?: boolean;
    /** `<screen_share>`: a participant started or stopped sharing their screen (the signal only, no picture). */
    screenShare?: {
        state: 'started' | 'stopped';
        version?: number;
        id?: number;
    };
    /**
     * A "silent" group call (a voice chat that someone opened in a group, `lightweight="1"`): it does not ring.
     * \`silence\` is the reason the app gives, for example \`vc_wave_all\` (the opener waves at everyone).
     */
    lightweight?: boolean;
    silence?: string;
    /** The caller's phone number, when the stanza names it (silent calls do). */
    callerPn?: string;
    /** The group a call was placed in (`group-jid`). */
    group?: string;
    timestamp?: number;
    /** `<waiting_room_update>` of a call link we run: who is waiting (or has just left the waiting room). */
    waitingRoom?: {
        jid: string;
        name?: string;
        guest: boolean;
        state: string;
    }[];
    /** `<group_update>` of a call: everyone the roster names and whether they are `connected` or `terminated`. */
    roster?: {
        jid: string;
        name?: string;
        guest: boolean;
        state: string;
    }[];
    /** The stanza as received, for everything the fields above do not cover (waiting room lists, rosters, ...). */
    node?: BinaryNode;
}

/**
 * The song itself must already be in the video's audio track; the music card (title, cover) comes from `catalog`.
 */
interface MusicInfo {
    title: string;
    author: string;
    songId: string;
    artistAttribution?: string;
    isExplicit?: boolean;
    /** Where the shared snippet starts, in milliseconds. */
    startTimeMs?: number;
    /**
     * Catalog data of the song (`musicContentMediaId`, `artworkDirectPath`, `artworkSha256`, `artworkEncSha256`,
     * `countryBlocklist`, ...). Only WhatsApp's music catalog hands these out; copy them from a received music
     * post (`annotations[0].embeddedContent.embeddedMusic`) to re-post the same song.
     */
    catalog?: Record<string, unknown>;
}
/** Minimal vCard for a phone number. */
declare function vcardFor(name: string, phoneE164: string): string;
/** WhatsApp identifies poll options by the SHA-256 of their text. */
declare const pollOptionHash: (name: string) => string;

/** One button of a native-flow ("interactive") message. `params` is serialised into `buttonParamsJson`. */
interface NativeButton {
    name: string;
    params: Record<string, unknown>;
}
declare const quickReply: (displayText: string, id: string) => NativeButton;
declare const urlButton: (displayText: string, url: string, merchantUrl?: string) => NativeButton;
declare const callButton: (displayText: string, phoneNumber: string) => NativeButton;
declare const copyButton: (displayText: string, copyCode: string) => NativeButton;
interface ListSection {
    title: string;
    rows: {
        id: string;
        title: string;
        description?: string;
    }[];
}
/** A "choose from a list" button. */
declare const singleSelect: (buttonTitle: string, sections: ListSection[]) => NativeButton;
interface InteractiveOptions {
    body: string;
    footer?: string;
    header?: {
        title?: string;
        subtitle?: string;
    };
    buttons: NativeButton[];
}

interface ReceiptEvent {
    /** Chat the receipt belongs to (the group for group receipts). */
    chat: string;
    /** Who produced it (group member / other device), when given. */
    participant?: string;
    /** Message ids covered. */
    ids: string[];
    /** `delivery` (no type attribute), `read`, `played`, `sender`, `retry`, `inactive`, ... */
    type: string;
    timestamp?: number;
}
interface PresenceEvent {
    /** Chat or user the presence is about. */
    chat: string;
    /** Who in a group, when given. */
    participant?: string;
    state: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused';
    /** Last seen (unix seconds) for `unavailable`, when the contact shares it. */
    lastSeen?: number;
}

interface BusinessProfile {
    jid?: string;
    address?: string;
    description: string;
    website: string[];
    email?: string;
    category?: string;
    businessHours?: {
        timezone?: string;
        config: {
            dayOfWeek?: string;
            mode?: string;
            openTime?: string;
            closeTime?: string;
        }[];
    };
    catalogExists: boolean;
    cartEnabled?: boolean;
    verifiedName?: string;
}
interface BusinessProfileUpdate {
    address?: string;
    email?: string;
    description?: string;
    websites?: string[];
    hours?: {
        timezone: string;
        days: {
            day: string;
            mode: 'open_24h' | 'appointment_only' | 'specific_hours' | 'closed';
            openTimeInMinutes?: string;
            closeTimeInMinutes?: string;
        }[];
    };
}
interface Product {
    id?: string;
    name?: string;
    retailerId?: string;
    url?: string;
    description?: string;
    price?: number;
    currency?: string;
    isHidden: boolean;
    imageUrls: string[];
}

interface LinkedGroup {
    id: string;
    subject: string;
    creation?: number;
    owner?: string;
    size?: number;
}
/**
 * Communities are `w:g2` groups with a `<parent>` marker and linked sub-groups. Everything that works
 * on a plain group (members, settings, invite codes) works on a community JID via `client.groups`;
 * this class only adds what is different.
 */
declare class Communities {
    #private;
    private readonly request;
    constructor(request: RequestFn, mex?: MexFn, groups?: Groups);
    metadata: (jid: string) => Promise<GroupMetadata>;
    /** The same actions as for groups, on a community JID (so they are all in one place). */
    inviteCode: (jid: string) => Promise<string | undefined>;
    revokeInvite: (jid: string) => Promise<string | undefined>;
    inviteInfo: (code: string) => Promise<GroupMetadata>;
    setSubject: (jid: string, subject: string) => Promise<void>;
    setDescription: (jid: string, text: string) => Promise<void>;
    setEphemeral: (jid: string, seconds: number) => Promise<void>;
    updateParticipants: (jid: string, participants: string[], action: Parameters<Groups["updateParticipants"]>[2]) => Promise<{
        jid: string;
        status: string;
    }[]>;
    setting: (jid: string, setting: Parameters<Groups["setting"]>[1]) => Promise<void>;
    setMemberAddMode: (jid: string, mode: "admin_add" | "all_member_add") => Promise<void>;
    setJoinApproval: (jid: string, mode: "on" | "off") => Promise<void>;
    joinRequests: (jid: string) => Promise<Record<string, string>[]>;
    updateJoinRequests: (...a: Parameters<Groups["updateJoinRequests"]>) => Promise<{
        jid: string;
        status: string;
    }[]>;
    acceptInviteV4: (...a: Parameters<Groups["acceptInviteV4"]>) => Promise<void>;
    revokeInviteV4: (jid: string, invitedJid: string) => Promise<void>;
    /** Every community the account is in, by JID. */
    fetchAll(): Promise<Record<string, GroupMetadata>>;
    /** Set (JPEG bytes) or remove the community's picture. */
    setPicture(jid: string, jpeg: Uint8Array): Promise<void>;
    removePicture(jid: string): Promise<void>;
    /** How many people are in the community. */
    participantCount(jid: string): Promise<number | undefined>;
    subgroupParticipantCount(subgroupJid: string): Promise<number | undefined>;
    /** Groups WhatsApp suggests adding as sub-groups. */
    subgroupSuggestions(communityJid: string, hint?: string, context?: string): Promise<unknown[]>;
    /** Sub-groups as GraphQL lists them. */
    subgroups: (jid: string) => Promise<unknown>;
    /** Hand the community to someone else (you stay an admin). */
    transferOwnership: (communityJid: string, newOwnerJid: string) => Promise<unknown>;
    /** Create a community; it starts with an announcement and a general sub-group. */
    create(subject: string, description?: string): Promise<GroupMetadata>;
    /** Create a new group inside a community. */
    createGroup(subject: string, participants: string[], communityJid: string): Promise<GroupMetadata>;
    leave(id: string): Promise<void>;
    linkGroup(groupJid: string, communityJid: string): Promise<void>;
    unlinkGroup(groupJid: string, communityJid: string, removeOrphanedMembers?: boolean): Promise<void>;
    /** The sub-groups of a community (pass a sub-group JID to find its community first). */
    linkedGroups(jid: string): Promise<{
        communityJid: string;
        linkedGroups: LinkedGroup[];
    }>;
    /** Join a community by invite code; returns the community JID. */
    acceptInvite(code: string): Promise<string | undefined>;
    /** Deactivate (delete) a community. Its sub-groups stay as normal groups. */
    deactivate(jid: string): Promise<void>;
}

interface HistoryMessage {
    key: {
        remoteJid: string;
        fromMe: boolean;
        id: string;
        participant?: string;
    };
    message?: Record<string, unknown>;
    timestamp?: number;
    pushName?: string;
}
interface HistoryChat {
    id: string;
    name?: string;
    unreadCount?: number;
    conversationTimestamp?: number;
    archived?: boolean;
    pinned?: boolean;
    muteEndTime?: number;
    ephemeralExpiration?: number;
    messages: HistoryMessage[];
}
interface HistoryChunk {
    syncType: string;
    progress?: number;
    chunkOrder?: number;
    chats: HistoryChat[];
    pushNames: {
        id: string;
        name: string;
    }[];
    /** LID <-> phone-number pairs learned from the history. */
    lidMappings: {
        lid: string;
        pn: string;
    }[];
}

interface NewsletterMetadata {
    id: string;
    name?: string;
    description?: string;
    invite?: string;
    creationTime?: number;
    subscribers?: number;
    verification?: string;
    pictureDirectPath?: string;
    muted?: boolean;
    role: 'OWNER' | 'ADMIN' | 'SUBSCRIBER' | 'GUEST';
    state: 'ACTIVE' | 'SUSPENDED' | 'GEO_SUSPENDED' | 'UNKNOWN';
}
/** Channels ("newsletters"): lookup, follow, post metadata, reactions. */
declare class Newsletters {
    private readonly mex;
    private readonly request;
    private readonly nextId;
    constructor(mex: MexFn, request: RequestFn, nextId: () => string);
    /**
     * Mark one of our posts as AI-generated content (`serverId` is the number from the send ack). The app only shows
     * this label on image and video posts, not on text posts.
     */
    labelAiContent: (jid: string, serverId: string | number, messageType?: string) => Promise<unknown>;
    /** Mark one of our posts as a paid partnership. */
    labelPaidPartnership: (jid: string, serverId: string | number, messageType?: string) => Promise<unknown>;
    create: (name: string, description?: string) => Promise<NewsletterMetadata>;
    /** Look up by `jid` (`1203...@newsletter`) or by `invite` code. */
    metadata: (type: "jid" | "invite", key: string) => Promise<NewsletterMetadata>;
    follow: (jid: string) => Promise<unknown>;
    unfollow: (jid: string) => Promise<unknown>;
    mute: (jid: string) => Promise<unknown>;
    unmute: (jid: string) => Promise<unknown>;
    delete: (jid: string) => Promise<unknown>;
    subscribers: (jid: string) => Promise<unknown>;
    /** Change the name, the description, the `topic` (category) or the `picture` (base64 JPEG; `''` removes it). */
    update: (jid: string, updates: {
        name?: string;
        description?: string;
        topic?: string;
        picture?: string;
    }) => Promise<unknown>;
    /** Set the channel's picture (JPEG bytes) or take it away. */
    setPicture: (jid: string, jpeg: Uint8Array) => Promise<unknown>;
    removePicture: (jid: string) => Promise<unknown>;
    setCategory: (jid: string, topic: string) => Promise<unknown>;
    /** Channel settings that are not text (for example who may react, `{ reaction_codes: { value: 'ALL' } }`). */
    updateSettings: (jid: string, settings: Record<string, unknown>) => Promise<unknown>;
    /** Your own settings for a channel (for example muting, reaction notifications). */
    updateUserSetting: (jid: string, setting: Record<string, unknown>) => Promise<unknown>;
    /** Make someone an admin straight away (a stanza). `inviteAdmin` asks them first. */
    promoteAdmin(jid: string, userJid: string): Promise<void>;
    demoteAdmin: (jid: string, userJid: string) => Promise<unknown>;
    inviteAdmin: (jid: string, userJid: string) => Promise<unknown>;
    acceptAdminInvite: (jid: string) => Promise<unknown>;
    revokeAdminInvite: (jid: string, userJid: string) => Promise<unknown>;
    /** Hand the channel to another admin. */
    changeOwner: (jid: string, newOwnerJid: string) => Promise<unknown>;
    adminCount(jid: string): Promise<number | undefined>;
    adminCapabilities(jid: string): Promise<unknown>;
    adminInfo: (jid: string) => Promise<unknown>;
    /** Admin view of a channel: pending invites, admin count, capabilities, your admin profile. */
    adminMetadata: (jid: string, o?: {
        pendingAdmins?: boolean;
        adminCount?: boolean;
        capabilities?: boolean;
        adminProfile?: boolean;
        adminSettings?: boolean;
    }) => Promise<unknown>;
    updateAdminProfile: (jid: string, updates: Record<string, unknown>) => Promise<unknown>;
    /** Keep a user from following or reacting. */
    blockUser: (jid: string, userJid: string) => Promise<unknown>;
    /** Statistics of a channel (`period` as the app names it). */
    insights: (jid: string, period?: string) => Promise<unknown>;
    userReports: (jid: string, cursor?: string) => Promise<unknown>;
    enforcements: (jid: string, locale?: string) => Promise<unknown>;
    appealReport: (jid: string, reason: string) => Promise<unknown>;
    updateVerification: (jid: string, verification: string) => Promise<unknown>;
    createVerified: (name: string, description?: string) => Promise<unknown>;
    /** Pin a post for `seconds` (default one day). `serverId` is the post's number. */
    pinMessage(jid: string, serverId: string | number, seconds?: number): Promise<void>;
    unpinMessage(jid: string, serverId: string | number): Promise<void>;
    /** Delete one of the channel's posts. */
    revokeMessage(jid: string, serverId: string | number): Promise<void>;
    /** Tell the channel these posts were viewed (the view counter). */
    sendViewReceipt(jid: string, serverIds: (string | number)[]): Promise<void>;
    /** View and reaction counters of one post (the raw answer). */
    viewStats: (jid: string, serverId: string | number) => Promise<BinaryNode>;
    /** Subscribe to live updates of a channel; answers how long the subscription lasts. */
    liveUpdates(jid: string): Promise<{
        duration: string;
    } | null>;
    /** The number of one of the recent posts, by its message id (looks at the last `limit`). */
    serverIdOf(jid: string, messageId: string, limit?: number): Promise<number | null>;
    pollVoters: (jid: string, serverId: string, o?: {
        voteHash?: string;
        limit?: number;
    }) => Promise<unknown>;
    reactionSenders: (jid: string, serverId: string) => Promise<unknown>;
    /** Mark a question post as answered / open (the answers box). */
    setQuestionState: (jid: string, serverId: string, state: string) => Promise<unknown>;
    /** Whether a link may get a preview in a channel post. */
    linkPreviewCheck: (url: string) => Promise<unknown>;
    /** Search the channel directory by words. */
    search: (text: string, limit?: number, cursor?: string) => Promise<unknown>;
    /** The directory by view: `RECOMMENDED`, `NEW`, `POPULAR`, `FEATURED` or `TRENDING`. */
    directoryList: (o?: {
        view?: string;
        limit?: number;
        cursor?: string;
        categories?: string[];
        countryCodes?: string[];
    }) => Promise<unknown>;
    directorySearch: (text: string, o?: {
        limit?: number;
        cursor?: string;
        categories?: string[];
    }) => Promise<unknown>;
    directoryCategories: (o?: {
        categories?: string[];
        countryCode?: string;
        perCategoryLimit?: number;
    }) => Promise<unknown>;
    recommended: (limit?: number, countryCodes?: string[]) => Promise<unknown>;
    similar: (jid: string, limit?: number, countryCodes?: string[]) => Promise<unknown>;
    /** The channels you follow. */
    following: (cursor?: string, limit?: number) => Promise<unknown>;
    /** A channel by invite code or JID, the light way (`type` is `'invite'` or `'jid'`). */
    dehydrated(type: 'invite' | 'jid', key: string, o?: {
        role?: string;
        pinned?: boolean;
    }): Promise<NewsletterMetadata>;
    /** React to a channel post by its numeric `serverId`; empty `emoji` removes the reaction. */
    react(jid: string, serverId: string, emoji: string): Promise<void>;
    /** Recent posts (raw `<message_updates>` answer). */
    fetchMessages(jid: string, count: number, opts?: {
        since?: number;
        after?: string;
    }): Promise<BinaryNode>;
}
interface ChannelStatusEvent {
    channel: string;
    id: string;
    serverId?: number;
    timestamp?: number;
    /** True when this account (on another device) is the sender. */
    fromMe: boolean;
    /** `text`, `media` or `reaction`; edits and revokes carry `edit` (`1`, `7`, `8`). */
    type: string;
    edit?: string;
    /** Decoded WAProto message for `text` / `media`. */
    message?: Record<string, unknown>;
    mediaType?: string;
    /** Emoji of a `reaction`. */
    reaction?: string;
    meta?: Record<string, string>;
    viewsCount?: number;
    reactions?: {
        code: string;
        count: number;
    }[];
}

type UsernameSource = 'FB' | 'IG' | 'USER_INPUT' | 'SUGGESTION';
type UsernameCheck = {
    available: true;
    username: string;
    sessionId: string;
} | {
    available: false;
    username: string;
    sessionId: string;
    suggestions: string[];
    rejectionReasons: string[];
    suggestionsEligible: boolean;
};
/** WhatsApp usernames (@name): availability, claiming, deleting, PIN. */
declare class Usernames {
    private readonly mex;
    constructor(mex: MexFn);
    check(username: string, includeSuggestions?: boolean, sessionId?: string): Promise<UsernameCheck>;
    checkMany: (usernames: string[]) => Promise<unknown>;
    /** Claim a username. */
    set: (username: string, o?: {
        source?: UsernameSource;
        sessionId?: string;
        pin?: string;
    }) => Promise<unknown>;
    delete: () => Promise<unknown>;
    mine(): Promise<string | null>;
    recommendations: (source?: UsernameSource) => Promise<unknown>;
    /** Set (or with `null` clear) the 4-digit PIN others need to message you by username. */
    setPin: (pin: string | null) => Promise<unknown>;
}

interface TrustedDevice {
    device_id?: string;
    device_name?: string;
    [key: string]: unknown;
}
type LinkedProfile = {
    type: string;
    vid?: string;
    username?: string;
};
declare class Account {
    private readonly request;
    private readonly mex;
    constructor(request: RequestFn, mex: MexFn);
    /** Remove one of the account's linked devices (a phone's "Linked devices" entry). Needs the device's own JID. */
    removeDevice(jid: string, reason?: string): Promise<void>;
    /** Devices that are marked trusted for this account. */
    trustedDevices: () => Promise<TrustedDevice[]>;
    trustDevice: (deviceId: string, deviceName: string) => Promise<unknown>;
    untrustDevice: (deviceId: string, reason?: string) => Promise<unknown>;
    deleteTrustedDevice: (deviceId: string) => Promise<unknown>;
    /** Show other accounts on the profile (Instagram, Facebook, ...): by account id (`vid`) or username. */
    setLinkedProfiles: (profiles: LinkedProfile[]) => Promise<unknown>;
    removeLinkedProfiles: (types: string[]) => Promise<unknown>;
    showLinkedProfiles: (profiles: {
        type: string;
        showOnProfile: boolean;
    }[]) => Promise<unknown>;
}

interface EventOptions {
    name: string;
    description?: string;
    /** Start and end: a `Date` or unix seconds. */
    startTime?: Date | number;
    endTime?: Date | number;
    /** A call link (`https://call.whatsapp.com/...`) guests can join. */
    joinLink?: string;
    location?: {
        name?: string;
        address?: string;
        degreesLatitude?: number;
        degreesLongitude?: number;
    };
    isCanceled?: boolean;
    extraGuestsAllowed?: boolean;
    isScheduledCall?: boolean;
}
type EventResponseType = 'GOING' | 'NOT_GOING' | 'MAYBE';

interface StickerInput {
    /** A 512x512 WebP. */
    data: Uint8Array;
    emojis?: string[];
    accessibilityLabel?: string;
}

interface BotEntry {
    jid: string;
    personaId: string;
    cardTitle?: string;
    count?: number;
}
interface BotSection {
    name: string;
    /** `all`, `category` or `featured`. */
    type: string;
    displayType?: string;
    bots: BotEntry[];
}
interface BotDirectory {
    version: string;
    defaultBot?: {
        jid: string;
        personaId: string;
    };
    sections: BotSection[];
    /** Every bot of every section, the default one first if no section holds it. */
    bots: BotEntry[];
}

interface AbProps {
    /** `config_code` -> `config_value` of every experiment flag the server sent. */
    props: Record<string, string>;
    /** The hash and refresh id to ask with next time (the server answers with changes only). */
    hash?: string;
    refreshId?: string;
    /** Seconds until the flags should be fetched again. */
    refresh?: number;
}
declare class ServerInfo {
    private readonly request;
    private readonly mex;
    constructor(request: RequestFn, mex: MexFn);
    /** The server's experiment flags (A/B props). Pass the last `hash` and `refreshId` to get changes only. */
    abProps(o?: {
        hash?: string;
        refreshId?: string;
    }): Promise<AbProps>;
    /** Whether the account is restricted from starting chats with people who do not know it ("reachout timelock"). */
    reachoutTimelock: () => Promise<unknown>;
    /** How many new chats the account may start in the current period. */
    newChatCap: () => Promise<unknown>;
    /** Go active (get every notification) or passive (background; fewer stanzas). */
    setPassive: (passive: boolean) => Promise<void>;
}

interface RoomPerson {
    jid: string;
    /** The name they typed (guests) or their push name. */
    name?: string;
    /** True for someone without a WhatsApp account. */
    guest: boolean;
}
/**
 * Who gets in: `'all'` everybody, `'guests'` only people without an account, `'none'` nobody automatically (you
 * call `admit` yourself), or a function that decides per request.
 */
type RoomAdmit = 'all' | 'guests' | 'none' | ((p: RoomPerson) => boolean | Promise<boolean>);
interface RoomOptions {
    /** `'video'` (default) rooms also take cameras; `'audio'` rooms are voice only. */
    media?: 'audio' | 'video';
    /** Default `'all'`. */
    admit?: RoomAdmit;
    /** Stop letting people in once this many are inside (the owner not counted). Default no limit. */
    maxGuests?: number;
}
type RoomEvents = {
    /** Someone asked to join. */
    request: RoomPerson;
    /** Someone was let in (by the rule or by `admit`). */
    admitted: RoomPerson;
    /** Someone was turned away. */
    denied: RoomPerson;
    /** Someone is in the call (connected). */
    joined: RoomPerson;
    /** Someone left the call. */
    left: RoomPerson;
    /** The room was closed. */
    closed: {
        reason: string;
    };
    /** Everything the room saw, as it came: for logging. */
    trace: {
        kind: string;
        data: unknown;
    };
};
/** What a room needs from the client. */
interface RoomHost {
    on(event: 'call', listener: (e: CallEvent) => void): () => void;
    setApprovalRequired(callId: string, enabled: boolean): Promise<void>;
    answerWaitingRoom(callId: string, user: string, admit?: boolean): Promise<void>;
    endCall(callId: string): Promise<void>;
}
declare class Room extends TypedEmitter<RoomEvents> {
    #private;
    /** The link to hand out. */
    readonly url: string;
    readonly token: string;
    readonly callId: string;
    readonly media: 'audio' | 'video';
    constructor(host: RoomHost, info: {
        url: string;
        token: string;
        callId: string;
        media: 'audio' | 'video';
        owner: string;
    }, o?: RoomOptions);
    /** People waiting to be let in. */
    get waiting(): RoomPerson[];
    /** People in the call now (the owner not included). */
    get inside(): RoomPerson[];
    get closed(): boolean;
    /** Let a waiting person in. */
    admit(jid: string): Promise<void>;
    /** Turn a waiting person away. */
    deny(jid: string): Promise<void>;
    /** Ask for approval (the default) or let everybody straight in. */
    setApprovalRequired(on: boolean): Promise<void>;
    /** End the call for everybody and stop watching. */
    close(reason?: string): Promise<void>;
}

interface ProductInput {
    name?: string;
    description?: string;
    retailerId?: string;
    /** Images that are already on WhatsApp's servers (their URL); uploading new ones is not done here. */
    images?: {
        url: string;
    }[];
    price?: number;
    currency?: string;
    /** A two-letter country code, or `undefined` with the key present to mark the product exempt. */
    originCountryCode?: string;
    isHidden?: boolean;
}
/** What the cover photo upload answers with and the profile change needs back. */
interface CoverPhotoUpload {
    id: string;
    token: string;
    timestamp: number;
}
interface BroadcastQuota {
    messagesLeft: number;
    totalLimit: number;
    isHeavySender: boolean;
    startTs: number;
    endTs: number;
    resetTs: number;
}
declare class Business {
    #private;
    private readonly request;
    private readonly mex;
    constructor(request: RequestFn, mex: MexFn);
    /** Add a product to the catalog. */
    createProduct: (p: ProductInput) => Promise<Product>;
    /** Change a product: only the fields you pass are sent. */
    updateProduct: (productId: string, p: ProductInput) => Promise<Product>;
    /** Delete products; returns how many the server deleted. */
    deleteProducts(productIds: string[]): Promise<{
        deleted: number;
    }>;
    /** Catalog and collection changes go through GraphQL; `input` is the server's input object. */
    createCatalog: (input: unknown) => Promise<unknown>;
    createCollection: (input: unknown) => Promise<unknown>;
    updateCollection: (input: unknown) => Promise<unknown>;
    deleteCollections: (input: unknown) => Promise<unknown>;
    /** Ask WhatsApp to look again at a product or collection it rejected. */
    appealProduct: (input: unknown) => Promise<unknown>;
    appealCollection: (input: unknown) => Promise<unknown>;
    /** Point the profile at an uploaded cover photo (the receipt of \`uploadCoverPhoto\`). */
    setCoverPhoto: (u: CoverPhotoUpload) => Promise<void>;
    /** Remove the cover photo with this id (the one \`uploadCoverPhoto\` returned). */
    removeCoverPhoto: (id: string) => Promise<void>;
    /** Delete a broadcast list. */
    deleteBroadcastList(listId: string): Promise<void>;
    /** How many broadcast messages the business may still send in the current period (null if the server gives no limits). */
    broadcastQuota(): Promise<BroadcastQuota | null>;
}

type FetchFn = (url: string, init: {
    method: string;
    headers: Record<string, string>;
    body: string;
}) => Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
}>;
type EventRsvp = 'GOING' | 'NOT_GOING' | 'MAYBE' | (string & {});
/** The HTTP GraphQL channel: gets its token on first use, keeps it, asks for a new one once if the server refuses it. */
declare class WwwClient {
    #private;
    private readonly mex;
    private readonly doFetch;
    constructor(mex: MexFn, doFetch?: FetchFn);
    /** Forget the token (a new session or account must not reuse it). */
    invalidate(): void;
    query<T = unknown>(docId: string, variables: unknown, dataPath: string): Promise<T>;
}
interface EventInput {
    [key: string]: unknown;
}
declare class Events {
    private readonly www;
    constructor(www: WwwClient);
    /** Create an event. `input` is the server's event input (name, start time, chat, ...). */
    create: (input: EventInput) => Promise<unknown>;
    get: (eventId: string) => Promise<unknown>;
    update: (eventId: string, updates: EventInput) => Promise<unknown>;
    delete: (eventId: string) => Promise<unknown>;
    list: (options?: EventInput) => Promise<unknown>;
    /** Answer an invitation: going, not going, maybe. */
    rsvp: (eventId: string, rsvp: EventRsvp) => Promise<unknown>;
    invite: (eventId: string, jids: string[]) => Promise<unknown>;
    uninvite: (eventId: string, jids: string[]) => Promise<unknown>;
    /** Take yourself off an event's guest list. */
    leave: (eventId: string) => Promise<unknown>;
    inviteLink: (eventId: string) => Promise<unknown>;
    rotateInviteLink: (eventId: string) => Promise<unknown>;
    linkPreview: (url: string) => Promise<unknown>;
    presetCovers: () => Promise<unknown>;
}

type BlockingAction = string;
declare class Privacy {
    private readonly request;
    private readonly mex;
    constructor(request: RequestFn, mex: MexFn);
    /** All privacy settings of an account (yours: `client.me.id`). `features` narrows the answer. */
    settings: (jid: string, features?: string[]) => Promise<unknown>;
    /** Change one setting: `set('LAST_SEEN', 'CONTACTS')`. */
    set: (feature: string, setting: string) => Promise<unknown>;
    /** The allow / block list behind a setting ("my contacts except..."): for `category` such as `LAST`, and `type` such as `CONTACT_BLACKLIST`. */
    contactList: (jid: string, category: string, type: string, dhash?: string) => Promise<unknown>;
    setContactList: (feature: string, setting: string, jids: string[]) => Promise<unknown>;
    /** Default disappearing-messages timer for new chats, in seconds (0 = off). */
    setDefaultDisappearing(seconds: number): Promise<void>;
    blockingStatus(): Promise<string | undefined>;
    setBlocking(action: BlockingAction): Promise<string | undefined>;
    /** The server's "opt out" list. Returned as the raw answer. */
    optOutList: () => Promise<BinaryNode>;
    pushConfig(): Promise<Record<string, string> | undefined>;
    setPushConfig(config: Record<string, string>): Promise<void>;
    /** Notices the user has to be shown (terms, disclosures) since `since`. */
    disclosures(since?: number): Promise<Record<string, string>[]>;
    setTextStatus: (text: string, emoji?: string) => Promise<unknown>;
    textStatusList: (jids: string[], lastUpdateTime?: number | null) => Promise<unknown>;
    setUserStatus: (status: string) => Promise<unknown>;
    pictureInfo: (jid: string) => Promise<unknown>;
    /** Set the profile picture through GraphQL (base64 image). The plain way is `client.updateProfilePicture`. */
    setPictureBase64: (imageBase64: string, type?: string) => Promise<unknown>;
    /** Whether these accounts are online right now. */
    onlineStatus: (jids: string[]) => Promise<unknown>;
    onlineStatusLastSeen: (jids: string[]) => Promise<unknown>;
    suggestedContacts: (limit?: number) => Promise<unknown>;
    /** Move the block list to LIDs (the server's account-id format). */
    migrateBlocklistToLid: (jids: string[], dhash?: string, dirtyAck?: boolean) => Promise<unknown>;
    createReminder: (title: string, body: string, scheduledTime: number) => Promise<unknown>;
    deleteReminder: (reminderId: string) => Promise<unknown>;
}

/* tslint:disable */
/* eslint-disable */

/**
 * Sans-IO call engine: the relay control plane (STUN allocate, keepalive) and the media plane (MLow PCM, E2E-SRTP).
 * Feed inputs, then drain `pollOutput` until it returns 0 and arm one timer for `lastTimeout`.
 */
declare class CallEngine {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Install the shared group epoch (the raw key the creator delivered in `enc_rekey`).
     */
    applyGroupEpoch(transaction_id: number, raw_epoch: Uint8Array | number[]): string;
    static create(config_json: string): CallEngine;
    /**
     * Stop sending and decoding video (the camera went off); audio carries on.
     */
    disableVideo(): void;
    /**
     * Bring the video plane up in a running call. `gated` holds our outbound video back until the peer accepted.
     */
    enableVideo(gated: boolean): boolean;
    /**
     * Who sent the encoded audio of the last `6` output (group calls: the participant's device JID), or empty.
     */
    encodedSender(): string;
    /**
     * STUN error code of a `RelayAllocateFailed` event, or -1.
     */
    eventCode(): number;
    /**
     * The whole last event as text (e.g. who reacted with which emoji).
     */
    eventDetail(): string;
    /**
     * Name of the last `3` output's event (`RelayAllocated`, `MediaConnected`, ...); empty if none.
     */
    eventName(): string;
    /**
     * One H.264 Annex-B access unit (video calls).
     * One complete encoded audio payload (Opus mode).
     */
    handleEncodedAudio(now: number, payload: Uint8Array | number[]): void;
    /**
     * One 60 ms mic frame: exactly 960 samples, 16 kHz mono.
     */
    handleMicFrame(now: number, pcm: Int16Array | number[]): void;
    handleRelayPacket(now: number, packet: Uint8Array | number[]): void;
    handleTimeout(now: number): void;
    handleVideoFrame(now: number, frame: Uint8Array | number[]): void;
    isAllocated(): boolean;
    isTerminated(): boolean;
    isVideoEnabled(): boolean;
    /**
     * Deadline (ms) of the last `0` output, or -1 for none.
     */
    lastTimeout(): number;
    /**
     * The engine's media counters as text (RTP received, SRTP failures, silence reason ...), for diagnostics.
     */
    mediaStats(): string;
    /**
     * Drain one output: 0 = drained (timer armed), 1 = datagram to send, 2 = PCM to play, 3 = event, 4 = video
     * access unit from the peer, 5 = something else (ignore).
     */
    pollOutput(): number;
    pollTimeout(): number;
    /**
     * Re-derive the receive keys once the answering device is known.
     */
    rekeyRecv(answering_peer_lid: string): boolean;
    /**
     * The replacement relay transport is open: start the Allocate response budget.
     */
    relayReconnected(now: number): void;
    /**
     * React in a group call (an emoji; the empty string takes the reaction back).
     */
    sendGroupReaction(now: number, emoji: string): void;
    /**
     * Start the call (relay allocate). `now` is monotonic ms, `wallclockMs` unix epoch ms.
     */
    start(now: number, wallclock_ms: number): void;
    /**
     * The peer's encoded audio payload of the last `6` output (Opus mode).
     */
    takeEncodedAudio(): Uint8Array | undefined;
    takePlayout(): Int16Array | undefined;
    /**
     * The relay (`ip:port`) the last `OUT_RECONNECT` output asks us to dial.
     */
    takeReconnect(): string | undefined;
    takeTransmit(): Uint8Array | undefined;
    /**
     * The peer's video access unit (Annex-B bytes) of the last `4` output.
     */
    takeVideo(): Uint8Array | undefined;
}

/**
 * The roster the server holds for one group call, in the order its transactions say.
 */
declare class GroupSession {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * The `<ack>` of our offer (or of a link join): the first roster and the shared relay.
     */
    applyAck(encoded_ack: Uint8Array | number[]): any;
    /**
     * The `<offer>` of an invitation into a group call (its action node, encoded): the roster it carries, if any.
     */
    applyInvite(encoded_offer: Uint8Array | number[]): any;
    /**
     * A `<group_update>` (the call stanza's action node, encoded).
     */
    applyUpdate(encoded_action: Uint8Array | number[]): any;
    /**
     * Build the group media engine from the relay snapshot. `opus` selects standard Opus (encoded I/O).
     */
    createEngine(incoming: boolean, opus: boolean, video: boolean): CallEngine;
    /**
     * `self_jid` is our own device LID; `creator` the call creator's device LID.
     */
    constructor(call_id: string, creator: string, self_jid: string);
    /**
     * Hand the engine the roster the session holds now (after `applyUpdate`).
     */
    pushToEngine(engine: CallEngine, now: number): string;
}

/** Write 16 kHz mono 16-bit PCM as a WAV file. */
declare function writeWav(path: string, pcm: Int16Array, rate?: number): void;
/**
 * Split an H.264 Annex-B stream into access units. Needs access-unit delimiters (NAL type 9), which encoders write
 * with e.g. `x264 aud=1`; every delimiter starts a new unit.
 */
declare function splitAnnexB(data: Uint8Array): Uint8Array[];
interface MediaSessionOptions {
    callId: string;
    direction: 'incoming' | 'outgoing';
    selfLid: string;
    peerLid: string;
    callKey: Uint8Array;
    /** The `<relay>` block of the offer ack (outgoing) or the offer (incoming). */
    relay?: BinaryNode;
    /** Group calls: an engine already built from the roster snapshot, and where the shared relay is. */
    group?: {
        engine: CallEngine;
        relay: {
            ip: string;
            port: number;
        };
    };
    /** 16 kHz mono signed 16-bit PCM to speak into the call, played once from the start. */
    audioIn?: Int16Array;
    /** Audio codec on the wire: standard Opus (default) or MLow. Must match what the offer announced. */
    codec?: 'opus' | 'mlow';
    /** Save what the peer says (16 kHz mono WAV) when the session ends. */
    recordTo?: string;
    /** Video calls: H.264 access units to send (looped) and where to save the peer's stream (Annex-B). */
    video?: {
        frames: Uint8Array[];
        fps?: number;
    };
    recordVideoTo?: string;
    /** Build the video plane: the call is a video call. */
    enableVideo?: boolean;
    /** Use this machine's microphone and speaker for the call (PulseAudio / PipeWire). */
    localAudio?: LocalAudioOptions;
}
type MediaEvents = {
    /** The relay accepted us; the media path is up. */
    connected: undefined;
    /** One access unit (Annex-B) of the peer's video. */
    video: Uint8Array;
    /** Group calls: who is speaking in the chunk of the last `audio` event. */
    speaker: string;
    /** A 60 ms chunk of the peer's audio (16 kHz mono PCM). */
    audio: Int16Array;
    /** Engine events by name (`RelayAllocated`, `MediaConnected`, ...). */
    event: {
        name: string;
        code?: number;
        detail?: string;
    };
    /** The media path ended (relay failed or the session was closed). */
    closed: {
        reason: string;
    };
};
/**
 * Drives the call engine for one call: UDP to the relay, the engine's timers, microphone frames in and speaker
 * frames out. The engine itself (E2E-SRTP, STUN allocate, MLow) is the vendored Rust stack.
 */
declare class MediaSession extends TypedEmitter<MediaEvents> {
    #private;
    constructor(o: MediaSessionOptions);
    /** Packets exchanged with the relay so far. */
    get stats(): {
        sent: number;
        received: number;
    };
    /** The engine's own counters (RTP in, SRTP failures, why it is silent) as text. */
    get engineStats(): string;
    /** Dial the relay: DTLS handshake first; the engine starts once the media channel is open. */
    start(): void;
    /** Our camera goes on in a running call: the frames are sent (looped) once the plane is up. */
    startVideo(frames: Uint8Array[], fps?: number, gated?: boolean): boolean;
    /** The peer accepted our upgrade: let the (held back) outbound video go. */
    releaseVideo(): void;
    /** Our camera goes off; audio carries on. */
    stopVideo(): void;
    /** Prepare to receive the peer's video (they turned their camera on). */
    acceptVideo(): boolean;
    /** React in a group call; an empty emoji takes the reaction back. */
    react(emoji: string): void;
    /** After the peer answered from a specific device, re-derive the keys we receive with. */
    rekeyRecv(answeringPeerLid: string): boolean;
    /**
     * Live microphone samples (16 kHz mono PCM): sent with the next ticks. At most about half a second is kept, so a
     * capture that runs ahead of the call clock drops its oldest audio instead of falling behind.
     */
    feedMic(pcm: Int16Array): void;
    /** Say something (16 kHz mono PCM); queued after whatever is still playing. */
    speak(pcm: Int16Array): void;
    close(reason?: string): void;
}

/** What a group call does with its media: audio to send, video to send, and where to record what comes in. */
interface GroupMediaOptions {
    audioIn?: Int16Array;
    recordTo?: string;
    /** H.264 access units (Annex-B, with AUD NALs) to send, looped. */
    videoFrames?: Uint8Array[];
    recordVideoTo?: string;
    /** Use this machine's microphone and speaker. */
    localAudio?: LocalAudioOptions;
    videoFps?: number;
}
interface CallState {
    callId: string;
    /** The other side (user JID). */
    peer: string;
    /** The call creator as it appears in the stanzas. */
    creator: string;
    direction: 'outgoing' | 'incoming';
    video: boolean;
    group?: string;
    /** A silent group call (voice chat invitation, `lightweight="1"`): a notification that cannot be answered. */
    lightweight?: boolean;
    /** Devices the call rang on / came from; terminate goes to each. */
    devices: string[];
    status: 'calling' | 'ringing' | 'connected' | 'ended';
    startedAt: number;
    /** Group calls: keep-alive timer, and the devices that already got our transport hint. */
    heartbeat?: NodeJS.Timeout;
    hinted?: Set<string>;
    /** The 32-byte call key (end-to-end media key). */
    callKey?: Uint8Array;
    /** The offer stanza as received (incoming calls): its `<enc>` holds the call key. */
    offer?: BinaryNode;
    /** The `<call>` wrapper id of the offer, and the device it came from. */
    offerFrom?: string;
    /** The server's `<relay>` block from the offer ack (outgoing) or the offer (incoming). */
    relay?: BinaryNode;
    /** Group calls: the users (LIDs, no device) who belong in this call; the shared key goes to nobody else. */
    members?: Set<string>;
    /** Group calls: the roster the server holds, and the engine the roster feeds. */
    groupSession?: GroupSession;
    groupEngine?: CallEngine;
    /** Group calls we answered: media options kept until the relay arrives, and a shared key that came before the engine. */
    /** The newest relay block we reported latencies for. */
    latencyTx?: string;
    /** The device of the other side that answered (1:1), where in-call video changes go. */
    peerDevice?: string;
    /** The peer asked to turn video on and waits for our answer. */
    videoRequest?: boolean;
    /** Joined through a call link: the relay comes with the first roster update, not with the join ack. */
    awaitsRelay?: boolean;
    /** Joined through a call link and still in the waiting room. */
    waiting?: boolean;
    mediaOptions?: GroupMediaOptions;
    pendingEpoch?: {
        transaction: number;
        key: Uint8Array;
    };
    /** The newest shared-epoch transaction we installed. */
    epochTx?: number;
    /** The media path (relay socket + engine) once the call has a relay. */
    media?: MediaSession;
}
type CallLinkMedia = 'audio' | 'video';
interface CallLink {
    token: string;
    media: CallLinkMedia;
    url: string;
}
interface CallLinkPreview extends CallLink {
    creator: string;
    waitingRoomEnabled: boolean;
    /** We created the link (admin of its waiting room). */
    isAdmin: boolean;
}

type Msg = Record<string, unknown>;
interface QuickButton {
    id: string;
    text: string;
}
interface ButtonsOptions {
    text: string;
    footer?: string;
    /** Up to 3 quick-reply buttons. */
    buttons: QuickButton[];
    /** A title shown above the text. */
    title?: string;
}
interface ListOptions {
    title: string;
    text: string;
    /** Label of the button that opens the list. */
    buttonText: string;
    footer?: string;
    sections: {
        title: string;
        rows: {
            id: string;
            title: string;
            description?: string;
        }[];
    }[];
}
type TemplateButton = {
    type: 'reply';
    text: string;
    id: string;
} | {
    type: 'url';
    text: string;
    url: string;
} | {
    type: 'call';
    text: string;
    phone: string;
};
interface TemplateOptions {
    text: string;
    footer?: string;
    title?: string;
    buttons: TemplateButton[];
    templateId?: string;
}
interface ButtonReply {
    kind: 'button' | 'list' | 'template' | 'native-flow';
    /** Id of the tapped button / row. */
    id: string;
    /** What the user saw. */
    text: string;
    /** Native flow: the button's name and parameters. */
    flow?: {
        name: string;
        params: unknown;
    };
}
/**
 * Normalise the answer to a button / list / template / native-flow message from a received message
 * (`event.message`). Returns undefined for anything else.
 */
declare function parseButtonReply(message: Msg): ButtonReply | undefined;

interface CodeToken {
    content: string;
    type: 'DEFAULT' | 'STR' | 'COMMENT' | 'NUMBER' | 'KEYWORD' | 'METHOD';
}
/** Split source code into the coloured tokens the code block view expects. */
declare function tokenizeCode(code: string): CodeToken[];
interface RichResponseOptions {
    /** Markdown text. */
    text?: string;
    code?: string;
    language?: string;
    /** Table rows; each row an array of cell texts. */
    table?: {
        rows: string[][];
    };
    /** One or more LaTeX expressions. */
    latex?: string | string[];
    map?: {
        latitude: number;
        longitude: number;
        zoom?: number;
        title?: string;
        annotations?: unknown[];
    };
    /**
     * Raw HTML shown in the answer (an experimental surface WhatsApp ships under an internal name). It is rendered as
     * markup, scripts and handlers included, and is NOT sanitised here: never build it from received messages, user
     * input or model output. Needs `allowRawHtml: true`; capped at 64 KiB.
     */
    html?: string;
    allowRawHtml?: boolean;
    imageUrl?: string;
    imageUrls?: string[];
    /** Tap buttons under a title (the "menu" widget): each button answers with its label. */
    buttons?: {
        title?: string;
        labels: string[];
        toast?: string;
    };
    /** Cards with their own buttons, side by side as a scrolling carousel or as one row. */
    cards?: {
        items: {
            title: string;
            buttons: string[];
            toast?: string;
        }[];
        layout?: 'carousel' | 'row';
    };
    /** An "open link" button at the bottom. */
    footer?: {
        text: string;
        url: string;
    };
    /** The bot the answer is attributed to (default: Meta AI). */
    botJid?: string;
    responseId?: string;
}
/**
 * A "rich response" as the Meta AI chat shows it: markdown text, code with highlighting, tables, LaTeX, a map and
 * images in one bot answer. The sections are JSON inside a `richResponseMessage` forwarded as a bot message.
 */
declare function richResponse(o: RichResponseOptions): {
    message: Record<string, unknown>;
    opts: SendOptions;
};

/** Entry points (`spam_flow`) the app sends most often. Any other value from WhatsApp's list also works. */
declare const REPORT_FLOWS: {
    /** Report from the open chat. */
    readonly chat: "chat";
    /** "Report" in a message's menu. */
    readonly message: "message_menu";
    /** Report contact from the chat's overflow menu. */
    readonly overflowMenu: "overflow_menu_report";
    /** Report from the contact info screen. */
    readonly accountInfo: "account_info_report";
    /** "Report spam" banner on an unknown chat. */
    readonly spamBanner: "1_1_spam_banner_report";
    /** Safety card in a chat from an unknown number. */
    readonly safetyCard: "chat_fmx_card_safety_tools_report";
    /** Report group from the group info screen. */
    readonly groupInfo: "group_info_report";
    /** Report group from the spam banner. */
    readonly groupBanner: "group_spam_banner_report";
    /** Report group while leaving. */
    readonly groupLeave: "group_info_leave_report_upsell";
    /** Report channel from its info screen. */
    readonly channel: "newsletter_info_report";
    /** Report a status post. */
    readonly statusPost: "status_post_report";
    /** Report from the media viewer. */
    readonly mediaViewer: "media_viewer";
};
/** A message to hand over as evidence. Taken from what this client sent or received (`ReportStore`). */
interface ReportedMessage {
    id: string;
    /** Unix seconds. */
    t: number;
    fromMe: boolean;
    /** The sender inside a group. */
    participant?: string;
    /** The chat the message belongs to. */
    chat: string;
    /** Decoded message (as in the `message` event). */
    message: Record<string, unknown>;
    /** Our own jid, used for the reporting key of messages we received. */
    meId?: string;
    /** What the server attached to a message we received: its `reporting_tag` and the sender's token. */
    reporting?: {
        tag?: Uint8Array;
        token?: Uint8Array;
        version?: number;
    };
}
interface ReportOptions {
    /** Where the report comes from; see `REPORT_FLOWS`. Defaults per kind. */
    flow?: string;
    /** Evidence (up to 210). Without any, the server only gets the chat. */
    messages?: ReportedMessage[];
    /** Whether the chat is in the address book (user) or we are a member (group); sent as `is_known_chat`. */
    isKnownChat?: boolean;
    /** 24 characters; WhatsApp's own trace id. Optional. */
    wiTraceId?: string;
    /** Group / channel name (required by the server for those). */
    subject?: string;
    /** Groups: the user who added us. */
    source?: string;
}
type ReportKind = 'user' | 'group' | 'newsletter' | 'status';
/**
 * One report as the app sends it: `iq set xmlns=spam` with a single `spam_list` (the reasons in the app are only the
 * entry point, `spam_flow`). Blocking, leaving a group or deleting the chat are separate actions.
 */
declare function buildReport(kind: ReportKind, jid: string, id: string, o?: ReportOptions): BinaryNode;
/** Remembers recent messages (sent and received) so they can be attached to a report. In memory only. */
declare class ReportStore {
    #private;
    private readonly perChat;
    constructor(perChat?: number);
    add(m: ReportedMessage): void;
    /** The latest messages of a chat; `fromOthers` skips our own. */
    recent(chat: string, n?: number, fromOthers?: boolean): ReportedMessage[];
}

interface PaymentRequestInput {
    /** Amount in thousandths of the currency unit (12.50 EUR = 12500). Positive whole number. */
    amount1000: number;
    /** ISO 4217 code, e.g. `EUR`. */
    currency: string;
    /** Who is asked to pay (JID). Defaults to the chat. */
    from?: string;
    /** Text shown with the request. */
    note?: string;
    /** Unix seconds after which the request expires. */
    expiry?: number;
}
/** Payments account settings: passkey protection, account recovery check, UPI onboarding (India). */
declare class Payments {
    private readonly mex;
    constructor(mex: MexFn);
    hasPasskey: () => Promise<unknown>;
    enrollChallenge: () => Promise<unknown>;
    enrollVerify: (credentialId: string, attestationObject: string, clientDataJson: string) => Promise<unknown>;
    registerFinish: (credentialId: string, attestationObject: string, clientDataJson: string) => Promise<unknown>;
    authChallenge: (credentialId: string) => Promise<unknown>;
    toggleOn: () => Promise<unknown>;
    toggleOff: () => Promise<unknown>;
    toggleChallenge: (credentialId: string) => Promise<unknown>;
    toggleCleanup: () => Promise<unknown>;
    cleanup: () => Promise<unknown>;
    isRecoverable: () => Promise<unknown>;
    upiSendOtp: (phoneNumber: string) => Promise<unknown>;
    upiVerifyOtp: (phoneNumber: string, otp: string) => Promise<unknown>;
}

declare const WAM_EVENTS: Record<string, {
    id: number;
    weight: number;
    props: Record<string, number>;
}>;
declare const WAM_GLOBALS: Record<string, number>;

type WamValue = number | string | boolean | null;
interface WamEvent {
    /** Name from `WAM_EVENTS`, e.g. `WebcSocketConnect`. */
    name: string;
    /** Property name -> value (enums are their numeric value, booleans become 0/1). */
    props?: Record<string, WamValue>;
    /** Global attribute name (see `WAM_GLOBALS`) -> value. */
    globals?: Record<string, WamValue>;
}
/**
 * Encode stats events into the WAM wire format sent in `iq set w:stats <add t=...>`.
 * `sequence` is a counter that goes up with every flushed buffer (16 bit).
 */
declare function encodeWam(events: WamEvent[], sequence?: number, protocolVersion?: number): Buffer;

interface ClientOptions {
    /** Directory for credentials and Signal state. Default `./auth`. */
    authDir?: string;
    /** Protocol logger; by default a new one that records everything under `./logs`. */
    logger?: ProtocolLogger;
    /** Override the WhatsApp Web client version / browser identity. */
    config?: Partial<ClientConfig>;
    /** Link with a pairing code instead of a QR: the phone number (digits, with country code) of the account. */
    pairWithPhoneNumber?: string;
    /**
     * Join one call link as a call-link guest instead of a WhatsApp account: no QR, no phone pairing.
     * The client registers a throwaway identity for `inviteCode` (a bare token or a full
     * `https://call.whatsapp.com/...` URL, same as `joinCallLink`) via `guest_reg` (see `guest.ts`)
     * before its first connection, then logs in with that identity (`ClientPayload.accountType = GUEST`,
     * `username` the lid `guest_reg` returned) — the same steps a browser does when a call link is
     * opened while logged out. Once `ready()` resolves, `me`/`me.lid` is that assigned lid and
     * `joinCallLink()` (relay, roster, media — audioFile/videoFile/localAudio included — and
     * `endCall()`) works exactly as it does for a paired account joining its own room; see "Joining as
     * a guest" in the README. `authDir`/`autoRecover` and chat/message/group features do not apply.
     */
    guest?: GuestRegOptions;
    /** Reconnect automatically after a drop (default true). */
    autoReconnect?: boolean;
    /**
     * Throttle outgoing messages like a person would (rate caps, random gaps, a pause before new chats, a limit on
     * identical texts). `true` for the defaults, or your own limits. Off by default.
     */
    antiban?: boolean | Partial<AntiBanConfig>;
    /**
     * Heal by itself (default true): a message that stays unreadable after the sender's retries is asked for again
     * from the phone (arrives as `message.resent`), and `downloadMedia` with a key asks the phone to upload expired
     * media again. Turn it off to handle `message.undecryptable` yourself.
     */
    autoRecover?: boolean;
}
/**
 * The connection in one event: where it is (`state`) and what just happened. `qr` and `pairingCode` appear while
 * the account is being linked, `newLogin` once it was, `reason` / `code` / `willReconnect` / `loggedOut` on a close.
 */
interface ConnectionUpdate {
    state: 'connecting' | 'open' | 'close';
    qr?: string;
    pairingCode?: string;
    newLogin?: boolean;
    /** `close` only. */
    reason?: string;
    code?: number;
    willReconnect?: boolean;
    /** The account was logged out on the phone: delete the auth folder and link again. */
    loggedOut?: boolean;
}
/** Everything a consumer can listen for. Payloads are plain data. */
type ClientEvents = {
    /** Connection state changes, QR codes and pairing codes in one place (the individual events below still fire). */
    connection: ConnectionUpdate;
    /** A QR code to scan (Linked devices > Link a device). Refreshed until it is scanned. */
    qr: {
        qr: string;
    };
    /** The 8-character code to type into WhatsApp > Linked devices > Link with phone number (pairing-code mode). */
    'pairing-code': {
        code: string;
    };
    /** Pairing finished; the connection restarts with the new identity. */
    paired: {
        id: string;
        lid?: string;
    };
    /** Logged in, pre-keys in place, ready to send and receive. */
    open: {
        id: string;
    };
    /** Socket closed. */
    close: {
        code?: number;
        reason: string;
        willReconnect: boolean;
    };
    /** A decrypted incoming message. */
    message: DecodedMessage;
    /** Raw app-state change from the phone (mute, pin, archive, contact, settings, labels, ...). */
    'app-state': AppStateEvent;
    /** A chat was muted / archived / pinned / read / deleted on another device. */
    'chat.update': ChatUpdate;
    /** A contact's saved name changed. */
    'contact.update': ContactUpdate;
    /** Delivery / read / played receipts for messages we sent. */
    receipt: ReceiptEvent;
    /** Online/offline and typing indicators (after `subscribePresence`, or in open chats). */
    presence: PresenceEvent;
    /** An incoming (or ended) call. Decline with `rejectCall`. */
    call: CallEvent;
    /** A channel status (or a reaction / edit / revoke of one) pushed by the server. */
    'channel.status': ChannelStatusEvent;
    /** A chunk of chat history announced by the phone after linking (chats, messages, push names). */
    history: HistoryChunk;
    /** A message could not be decrypted and the sender's retries ran out (before any automatic request to the phone). */
    'message.undecryptable': {
        key: MessageKey;
    };
    /** A message the phone sent again after `requestPlaceholderResend` (the key, the content and the time). */
    'message.resent': {
        key: MessageKey;
        message: Record<string, unknown>;
        timestamp?: number;
    };
    /** A group changed (members, subject, settings). */
    'group.update': GroupNotification;
    /** Any server notification, parsed or not (account_sync, devices, picture, ...). */
    notification: {
        type: string;
        node: BinaryNode;
    };
};
declare class Client {
    #private;
    readonly logger: ProtocolLogger;
    constructor(options?: ClientOptions);
    /** The outgoing-message limiter, when the `antiban` option is on. */
    readonly antiban?: AntiBan;
    on: <K extends keyof ClientEvents>(event: K, listener: (p: ClientEvents[K]) => void) => Unsubscribe;
    events: <K extends keyof ClientEvents>(event: K, signal?: AbortSignal) => AsyncGenerator<ClientEvents[K], any, any>;
    /** The paired identity, once linked. */
    get me(): {
        id: string;
        lid?: string;
        name?: string;
    } | undefined;
    /** Connect (and pair if this device is not linked yet). Resolves when the socket is started. */
    connect(): Promise<void>;
    /** Resolves once logged in and ready. */
    ready(): Promise<void>;
    /** Next id for a stanza built by hand (`request`/`sendCallAndWait`), e.g. `callSig.buildLinkJoin`. */
    nextId(): Promise<string>;
    /** Send a `<call>` stanza and wait for the server's matching `<ack class="call">` (20 s timeout by default). */
    sendCallAndWait(node: BinaryNode, timeoutMs?: number): Promise<BinaryNode>;
    /** Send text, optionally as a reply (`quoted`) and/or with @mentions. Returns the message id. */
    sendText(to: string, text: string, opts?: TextOptions): Promise<string>;
    /** Forward a received message (its WAProto content) to another chat. */
    forwardMessage(to: string, message: Record<string, unknown>, score?: number): Promise<string>;
    /**
     * Send anything with one call: `client.send(jid, { text: 'hi' })`, `{ image }`, `{ video }`, `{ audio, voiceNote }`,
     * `{ document, mimetype }`, `{ sticker }`, `{ poll }`, `{ location }`, `{ contacts }`, `{ react }`, `{ edit, text }`,
     * `{ revoke }`, `{ forward }`, `{ text, buttons }`, `{ text, sections, buttonText }`. Media can be bytes, a file
     * path or URL (`{ url }`) or a stream. Returns the message id.
     */
    send: (to: string, content: MessageContent, options?: SendContentOptions) => Promise<string>;
    /** Send a raw stanza (an `iq`) and wait for its answer: the escape hatch for anything not wrapped yet. */
    request: (node: BinaryNode) => Promise<BinaryNode>;
    /** Send a raw stanza as-is, with no `id` added and no answer awaited (for stanzas such as `chatstate` and `ib`). */
    sendNode: (node: BinaryNode) => Promise<void>;
    /** Run any WhatsApp Web GraphQL (`w:mex`) query by id, e.g. the ones listed in baron-baileys-v2. */
    mex: <T = unknown>(queryId: string, variables: unknown, dataPath?: string) => Promise<T>;
    /** Send a raw WAProto `Message` object. */
    sendMessage(to: string, message: Record<string, unknown>, opts?: SendOptions): Promise<string>;
    /** React to a message with an emoji (empty string removes the reaction). */
    react(key: MessageKey, emoji: string): Promise<string>;
    /** Edit the text of one of our own messages. */
    edit(key: MessageKey, newText: string): Promise<string>;
    /** Delete a message for everyone. */
    revoke(key: MessageKey): Promise<string>;
    /** Encrypt, upload and send an image / video / audio / document / sticker. */
    sendMedia(to: string, type: MediaType, data: Uint8Array, opts?: MediaOptions & TextOptions): Promise<string>;
    sendImage: (to: string, data: Uint8Array, opts?: MediaOptions & TextOptions) => Promise<string>;
    sendVideo: (to: string, data: Uint8Array, opts?: MediaOptions & TextOptions) => Promise<string>;
    sendAudio: (to: string, data: Uint8Array, opts?: MediaOptions & TextOptions) => Promise<string>;
    sendDocument: (to: string, data: Uint8Array, opts?: MediaOptions & TextOptions) => Promise<string>;
    sendSticker: (to: string, data: Uint8Array, opts?: MediaOptions & TextOptions) => Promise<string>;
    /** Download and decrypt the media of a received message (`event.message`). */
    downloadMedia(message: Record<string, unknown>, opts?: {
        key?: MessageKey;
    }): Promise<Buffer>;
    /**
     * Send a sticker pack: WebP stickers (512x512, up to 60), a WebP cover and a JPEG thumbnail. The recipient
     * can add the whole pack to their stickers.
     */
    sendStickerPack(to: string, pack: {
        name: string;
        publisher: string;
        stickers: StickerInput[];
        /** WebP cover (the pack's tray icon). */
        cover: Uint8Array;
        /** JPEG preview shown in the chat. */
        thumbnail: Uint8Array;
        packId?: string;
        description?: string;
        caption?: string;
    }): Promise<string>;
    /**
     * Send an event card (invitation with name, time, place and an optional call link) to a chat or group.
     * Guests answer it; their answers arrive as messages with an `eventResponse` field.
     */
    sendEvent(to: string, o: EventOptions): Promise<string>;
    /**
     * Comment on a post in a Community Announcement Group (an announcement under a community). `parent` is the post's
     * key; it must have been received here (its secret is needed). Comments arrive as `addon` on the message.
     */
    sendComment(parent: MessageKey, text: string): Promise<string>;
    /**
     * Answer an event card: going, not going or maybe. `key` is the card's key and `creator` who sent it
     * (the card must have been seen by this client, because its secret is needed).
     */
    respondToEvent(key: MessageKey, creator: string, response: EventResponseType, extraGuestCount?: number): Promise<string>;
    /**
     * Ask the phone for older messages of a chat, starting before `oldest` (the oldest message you have).
     * The answer arrives as a `history` event.
     */
    fetchMessageHistory: (count: number, oldest: MessageKey, oldestTimestampMs: number) => Promise<string>;
    /**
     * Ask the phone to send a message again that arrived undecryptable ("Waiting for this message").
     * The answer arrives as a `message.resent` event.
     */
    requestPlaceholderResend: (key: MessageKey) => Promise<string>;
    /**
     * Ask the phone that sent a media message to upload it again (the file expired on WhatsApp's servers).
     * Returns the message with the new `directPath`, ready for `downloadMedia`.
     */
    updateMediaMessage(key: MessageKey, message: Record<string, unknown>, timeoutMs?: number): Promise<Record<string, unknown>>;
    /** Mark messages as read (`read-self` keeps read receipts private). */
    markRead(keys: MessageKey[], type?: ReceiptType): Promise<void>;
    /** Show "typing…" / "recording…" / stop in a chat. */
    sendChatState(to: string, state: ChatState): Promise<void>;
    /** Go online/offline. Needs the account's display name (`setName`). */
    sendPresence(type: 'available' | 'unavailable'): Promise<void>;
    /** Resolve once the phone has shared the app-state keys (needed for chat actions); false on timeout. */
    waitForAppState(timeoutMs?: number): Promise<boolean>;
    /**
     * Fetch the app-state collections again (chats, contacts, settings synced from the phone). With `fromScratch`
     * the local copy is dropped first and the full state is downloaded; use it when chat actions stop sticking.
     */
    resyncAppState(collections?: readonly string[], o?: {
        fromScratch?: boolean;
    }): Promise<void>;
    /**
     * Set the cover photo of a business profile: uploads the JPEG (unencrypted, to the profile-picture service) and
     * points the profile at it. Returns the photo's id, which \`business.removeCoverPhoto\` takes.
     */
    setBusinessCoverPhoto(jpeg: Uint8Array): Promise<string>;
    /**
     * Make a new signed pre-key and tell the server (WhatsApp Web does this about every four weeks, and so does
     * this client after connecting). The old key stays on disk, so messages already on the way still decrypt.
     * Returns the new key id.
     */
    rotateSignedPreKey(): Promise<number>;
    /** Server-side information: experiment flags, reachout timelock, the new-chat limit, passive mode. */
    readonly server: ServerInfo;
    /** The server's clock in unix seconds (our clock corrected by the offset seen at login). */
    serverTime: () => number;
    /** The AI bots WhatsApp offers this account (Meta AI and others), by section. */
    listBots: () => Promise<BotDirectory>;
    /** Group management: `client.groups.create(...)`, `.updateParticipants(...)`, `.metadata(...)`, ... */
    readonly groups: Groups;
    /** Archive / unarchive a chat on all devices. */
    archiveChat: (jid: string, archived?: boolean, last?: RangeMessage[]) => Promise<void>;
    /** Mute until the given unix-millisecond time (`-1` = forever), or `null` to unmute. */
    muteChat: (jid: string, untilMs: number | null) => Promise<void>;
    pinChat: (jid: string, pinned?: boolean) => Promise<void>;
    /** Lock a chat behind the phone's screen lock (or unlock it). */
    lockChat: (jid: string, locked?: boolean) => Promise<void>;
    /** The list of favourite chats: pass every JID that should be a favourite (an empty list clears it). */
    setFavorites: (jids: string[]) => Promise<void>;
    /** Hide a contact's statuses (or show them again). */
    muteContactStatus: (jid: string, muted?: boolean) => Promise<void>;
    /** Business quick replies ("/shortcut"): create or change one, or delete it with the timestamp it was made with. */
    setQuickReply: (q: Parameters<typeof quickReply$1>[0]) => Promise<void>;
    /** Order of the labels in the list (numeric label ids). */
    reorderLabels: (ids: number[]) => Promise<void>;
    /** Settings of the whole account kept in app state: previews off, relay all calls, private processing. */
    setLinkPreviewsDisabled: (disabled?: boolean) => Promise<void>;
    setRelayAllCalls: (enabled?: boolean) => Promise<void>;
    setPrivateProcessing: (enabled?: boolean) => Promise<void>;
    /** Mark a chat read / unread on all devices. */
    markChatRead: (jid: string, read?: boolean, last?: RangeMessage[]) => Promise<void>;
    starMessage: (key: MessageKey, starred?: boolean) => Promise<void>;
    deleteChat: (jid: string, last?: RangeMessage[]) => Promise<void>;
    clearChat: (jid: string, last?: RangeMessage[]) => Promise<void>;
    deleteMessageForMe: (key: MessageKey, timestamp: number, deleteMedia?: boolean) => Promise<void>;
    /** Save a contact in the phone's address book, or remove it with `null`. */
    saveContact: (jid: string, c: {
        fullName?: string;
        firstName?: string;
    } | null) => Promise<void>;
    /** Change the account's display name (push name). */
    updateProfileName(name: string): Promise<void>;
    addLabel: (l: Parameters<typeof addLabel>[0]) => Promise<void>;
    labelChat: (jid: string, labelId: string, labeled?: boolean) => Promise<void>;
    labelMessage: (jid: string, labelId: string, messageId: string, labeled?: boolean) => Promise<void>;
    /** Default disappearing-messages timer for a 1:1 chat, in seconds (0 = off). */
    setChatEphemeral: (jid: string, seconds: number) => Promise<void>;
    /** Communities: create, link sub-groups, deactivate (members/settings: use `groups` with the community JID). */
    readonly communities: Communities;
    /** Channels: `client.newsletters.metadata('invite', code)`, `.follow(jid)`, ... (posting: `sendText(jid, ...)`). */
    readonly newsletters: Newsletters;
    /** Usernames: `client.usernames.check('name')`, `.set(...)`, `.mine()`. */
    readonly usernames: Usernames;
    /** The account: `client.account.trustedDevices()`, `.removeDevice(jid)`, linked profiles. See also `logout()`. */
    readonly account: Account;
    /** More privacy: settings by feature, allow / block lists, text status, who is online, reminders, push settings. */
    readonly privacy: Privacy;
    /** Run a business: products, catalog and collections, broadcast lists and their quota. */
    readonly business: Business;
    readonly calendar: Events;
    /** Which phone numbers are registered on WhatsApp? */
    onWhatsApp(...numbers: string[]): Promise<WhatsAppLookup[]>;
    /** Look up an account by username (`@name`). */
    findUserByUsername(username: string, pin?: string): Promise<{
        jid: string;
        exists: boolean;
    } | null>;
    /** Profile "About" text of users. */
    fetchStatus(...jids: string[]): Promise<StatusInfo[]>;
    /** The usernames some contacts have set. */
    contactUsernames(...jids: string[]): Promise<{
        jid: string;
        username: string;
    }[]>;
    /** LIDs for phone-number JIDs. */
    lidsFor(...jids: string[]): Promise<{
        pn: string;
        lid: string;
    }[]>;
    profilePictureUrl: (jid: string, type?: "preview" | "image") => Promise<string | undefined>;
    /** Set our own "About" text. */
    updateProfileStatus: (text: string) => Promise<void>;
    fetchBlocklist: () => Promise<string[]>;
    /** Block a contact; `entryPoint` / `reason` are what the app reports with it (see `contacts.BlockOptions`). */
    blockUser(jid: string, o?: BlockOptions): Promise<void>;
    unblockUser(jid: string): Promise<void>;
    fetchPrivacySettings: () => Promise<Record<string, string>>;
    updatePrivacy: (name: PrivacyCategory, value: PrivacyValue) => Promise<void>;
    /** Post a text status/story visible to `recipients` (the audience must be given explicitly). */
    sendStatusText(text: string, recipients: string[], privacy?: 'contacts' | 'allowlist' | 'denylist'): Promise<string>;
    /** Public business profile of an account (null if it is not a business). */
    getBusinessProfile: (jid: string) => Promise<BusinessProfile | null>;
    /** Edit our own business profile (WhatsApp Business accounts only). */
    updateBusinessProfile: (u: BusinessProfileUpdate) => Promise<BinaryNode>;
    getCatalog: (jid?: string, limit?: number, cursor?: string) => Promise<{
        products: Product[];
        nextPageCursor?: string;
    }>;
    getCollections: (jid?: string, limit?: number) => Promise<{
        id?: string;
        name?: string;
        products: Product[];
    }[]>;
    /** Buttons / list message (native flow). Build buttons with `quickReply`, `urlButton`, `singleSelect`, ... from the package. */
    sendInteractive(to: string, o: InteractiveOptions): Promise<string>;
    /** Who may see our statuses (the "Status privacy" screen). */
    setStatusPrivacy: (audience: StatusAudience, jids?: string[]) => Promise<void>;
    /** Group permission "Add other members": everyone or only admins. */
    setGroupMemberAddMode: (jid: string, mode: "admin_add" | "all_member_add") => Promise<void>;
    /** Group permission "Send message history" (members may send past messages to new members). */
    setGroupShareHistory: (jid: string, mode: "all_member_share" | "admin_share") => Promise<unknown>;
    /** Our "member tag" in a group (shown next to the name; empty string removes it). */
    setMemberLabel(groupJid: string, label: string): Promise<string>;
    /** Send a poll (2-12 options). Votes arrive encrypted as `pollUpdateMessage`. */
    /** Resolve with the next received message for which `match` is true, or `undefined` after `timeoutMs`. */
    waitForMessage(match?: (m: DecodedMessage) => boolean, timeoutMs?: number): Promise<DecodedMessage | undefined>;
    /** Pin a message in its chat for `seconds` (default 24 hours; 7 days = 604800, 30 days = 2592000). */
    pinMessage(key: MessageKey, seconds?: number): Promise<string>;
    unpinMessage(key: MessageKey): Promise<string>;
    /**
     * Send an album: two to ten pictures and videos that WhatsApp shows as one block. Every item is a picture
     * (`image`) or a video (`video`) with an optional `caption`. Returns the id of the album message.
     */
    sendAlbum(to: string, items: {
        image?: MediaSource;
        video?: MediaSource;
        caption?: string;
        mimetype?: string;
    }[], o?: {
        delayMs?: number;
    }): Promise<string>;
    sendPoll(to: string, name: string, values: string[], selectableCount?: number): Promise<string>;
    /**
     * Post to a channel and optionally label the post ("AI content", "paid partnership").
     * Returns the message id and the post's server number.
     */
    postToChannel(channel: string, message: Record<string, unknown> | string, labels?: {
        aiContent?: boolean;
        paidPartnership?: boolean;
    }, opts?: SendOptions): Promise<{
        id: string;
        serverId?: string;
    }>;
    /**
     * Post a text status to a group. Pictures, videos and voice notes: `sendImage(group, data, { groupStatus: true })`,
     * `sendVideo`, `sendAudio(..., { ptt: true, groupStatus: true })`.
     */
    sendGroupStatusText(group: string, text: string, o?: {
        backgroundArgb?: number;
        textArgb?: number;
        font?: string;
    }): Promise<string>;
    /** Calls this client knows about (placed or received), by call id. */
    get calls(): ReadonlyMap<string, CallState>;
    /**
     * Place a voice (or video) call and let the callee's devices ring. Resolves with the call once the server accepted
     * the offer; follow it through the `call` events (`preaccept` = ringing, `accept`, `reject`, `terminate`).
     * Media is not connected here: without it the callee can answer but hears nothing, and the call ends.
     */
    startCall(to: string, o?: {
        video?: boolean;
        audioIn?: Int16Array;
        recordTo?: string;
        /** Video calls: H.264 access units to send, looped (see `splitAnnexB`). */
        videoFrames?: Uint8Array[];
        recordVideoTo?: string;
        /** Use this machine's microphone and speaker. */
        localAudio?: LocalAudioOptions;
        videoFps?: number;
    } & CallFileOptions): Promise<CallState>;
    /**
     * Answer an incoming call: decrypt the call key from the offer, tell the caller we are ringing and answering, and
     * connect the media. `audioIn` is spoken into the call, `recordTo` saves what the caller says (16 kHz mono WAV).
     */
    acceptCall(callId: string, o?: {
        audioIn?: Int16Array;
        recordTo?: string;
        videoFrames?: Uint8Array[];
        recordVideoTo?: string;
        /** Use this machine's microphone and speaker. */
        localAudio?: LocalAudioOptions;
        videoFps?: number;
    } & CallFileOptions): Promise<CallState>;
    /** Create a call link (a "room") that others can join: `https://call.whatsapp.com/{voice|video}/{token}`. */
    createCallLink(media?: CallLinkMedia): Promise<CallLink>;
    /**
     * Open a room: create a call link, join it as its owner and let people in by a rule (`admit`: everybody, only
     * guests without a WhatsApp account, nobody automatically, or your own function). People open the link in a browser.
     * The returned room tells you who asks, who is let in, who is inside and who leaves (see \`RoomEvents\`).
     */
    createRoom(o?: RoomOptions & GroupMediaOptions & CallFileOptions): Promise<Room>;
    /** Who made a call link and whether joiners have to be let in. `link` is the token or the whole URL. */
    queryCallLink(link: string, media?: CallLinkMedia): Promise<CallLinkPreview>;
    /**
     * Start a group call: an ad-hoc call with at least two other people, or one bound to an existing group
     * (`o.group`, at least one other member). Everyone's devices ring. The shared media key is generated here and sent
     * to every device that connects.
     */
    startGroupCall(targets: string[], o?: {
        group?: string;
        video?: boolean;
    } & GroupMediaOptions & CallFileOptions): Promise<CallState>;
    /**
     * Join a call link ("room"). When the creator wants to approve joiners the call waits in the waiting room
     * (`status` `ringing`, `waiting` true) and goes on once the creator lets us in.
     */
    joinCallLink(link: string, media?: CallLinkMedia, o?: GroupMediaOptions & CallFileOptions): Promise<CallState>;
    /** Turn our camera on in a running call: asks the other side and sends once they accept. */
    enableCamera(callId: string, o?: {
        videoFrames?: Uint8Array[];
        videoFps?: number;
    } & CallFileOptions): Promise<void>;
    /** Turn our camera off; the call goes on with sound. */
    disableCamera(callId: string): Promise<void>;
    /** The other side asked to turn video on (see `call` events with `videoState` 11): accept, optionally sending our own picture. */
    acceptVideoUpgrade(callId: string, o?: {
        videoFrames?: Uint8Array[];
        videoFps?: number;
    } & CallFileOptions): Promise<void>;
    /** Refuse the other side's request to turn video on. */
    rejectVideoUpgrade(callId: string): Promise<void>;
    /** Raise (or lower) the hand in a group call. */
    raiseHand(callId: string, raised?: boolean): Promise<void>;
    /**
     * Tell the group call that we start or stop sharing a screen. This is the signal only: the picture itself is
     * not sent. Others report it as \`screenShare\` on the call event.
     */
    setScreenShare(callId: string, started: boolean, shareId?: number): Promise<void>;
    /** React with an emoji in a group call (the empty string takes it back). */
    sendReaction(callId: string, emoji: string): Promise<void>;
    /** Creator of a call link: require approval for joiners (or not). */
    setApprovalRequired(callId: string, enabled: boolean): Promise<void>;
    /** Creator of a call link: let a waiting person in, or turn them away. */
    answerWaitingRoom(callId: string, user: string, admit?: boolean): Promise<void>;
    /** Hang up a call we placed or answered (also cancels one that is still ringing). */
    endCall(callId: string): Promise<void>;
    /** Up to three reply buttons under a text (`buttonsMessage`). The tap arrives as a `message` event; see `parseButtonReply`. */
    sendButtons(to: string, o: ButtonsOptions): Promise<string>;
    /** A "choose from a list" message (`listMessage`). */
    sendList(to: string, o: ListOptions): Promise<string>;
    /** Template buttons: quick replies, a link and a phone number (`templateMessage`). */
    sendTemplate(to: string, o: TemplateOptions): Promise<string>;
    /** Answer a buttons message; the tapped button's id and text come from the received message. */
    replyToButtons: (to: string, id: string, displayText: string) => Promise<string>;
    replyToList: (to: string, rowId: string, title: string, description?: string) => Promise<string>;
    replyToTemplate: (to: string, id: string, displayText: string, index?: number) => Promise<string>;
    replyToNativeFlow: (to: string, name: string, params: Record<string, unknown>, bodyText?: string) => Promise<string>;
    /** A Meta AI style answer with text, code, table, LaTeX, map and images. */
    sendRichResponse(to: string, o: RichResponseOptions): Promise<string>;
    /**
     * Raw HTML as a Meta AI answer (experimental on WhatsApp's side). Rendered as markup and not sanitised: pass only
     * HTML you wrote, never received or generated text. Calling this method is the opt-in.
     */
    sendHtml: (to: string, html: string) => Promise<string>;
    /**
     * Report a user to WhatsApp, as "Report" in the contact menu does. The latest 5 messages of the chat go along as
     * evidence unless you pass `messages` or `withMessages: false`. `block: true` blocks the contact afterwards
     * ("Block contact and delete chat" additionally with `deleteChat: true`).
     */
    reportUser(jid: string, o?: ReportOptions & {
        block?: boolean;
        deleteChat?: boolean;
        withMessages?: boolean;
    }): Promise<{
        reportId?: string;
        blocked: boolean;
    }>;
    /**
     * Report a group. `leave: true` leaves it afterwards ("Exit group and report"). The group name is looked up when
     * you do not give `subject`.
     */
    reportGroup(group: string, o?: ReportOptions & {
        leave?: boolean;
        withMessages?: boolean;
    }): Promise<{
        reportId?: string;
        left: boolean;
    }>;
    /** Report a channel (`unfollow: true` leaves it afterwards). */
    reportChannel(channel: string, o?: ReportOptions & {
        unfollow?: boolean;
        withMessages?: boolean;
    }): Promise<{
        reportId?: string;
    }>;
    /** Tell a group's admins about a message (it shows in their "reported messages"). */
    reportToAdmins(group: string, messageId: string): Promise<void>;
    /** Group setting: may members report messages to the admins? */
    setMemberReportsAllowed(group: string, allow: boolean): Promise<void>;
    /** Ask a contact to pay (`amount1000` is thousandths of the currency unit). */
    requestPayment: (to: string, p: PaymentRequestInput) => Promise<string>;
    /** Answer a payment request with a payment note. */
    sendPaymentNote: (to: string, request: MessageKey, o?: {
        note?: string;
        transactionData?: string;
    }) => Promise<string>;
    declinePaymentRequest: (to: string, request: MessageKey) => Promise<string>;
    cancelPaymentRequest: (to: string, request: MessageKey) => Promise<string>;
    /** Payments account settings (passkey, recovery check, UPI onboarding). */
    readonly payments: Payments;
    /** Report usage-statistics events (WAM) the way WhatsApp Web does. `name`s are in `WAM_EVENTS`. */
    sendWam(events: WamEvent[]): Promise<void>;
    /** Send a quiz: a single-choice poll with a right answer (`correctAnswer` must be one of `values`). */
    sendQuiz(to: string, name: string, values: string[], correctAnswer: string): Promise<string>;
    /**
     * Channel poll or quiz whose options are images (`images[i]` belongs to `values[i]`). Like the phone, every option
     * image goes out first as its own post pointing at the poll's id, then the poll itself.
     */
    sendImagePoll(to: string, name: string, values: string[], images: Uint8Array[], o?: {
        correctAnswer?: string;
    }): Promise<string>;
    /** Send a question (the audience answers in a box). */
    sendQuestion(to: string, text: string): Promise<string>;
    sendQuestionImage: (to: string, data: Uint8Array, question: string, opts?: MediaOptions) => Promise<string>;
    /** Send a video with a song attached (the app's "music" post; the video is what plays). */
    sendMusic: (to: string, video: Uint8Array, music: MusicInfo, opts?: MediaOptions) => Promise<string>;
    sendLocation(to: string, latitude: number, longitude: number, o?: {
        name?: string;
        address?: string;
    }): Promise<string>;
    sendContact(to: string, name: string, phoneE164: string): Promise<string>;
    /** Decline an incoming call (`call.callId`, `call.creator ?? call.from`). */
    rejectCall(callId: string, callCreator: string): Promise<void>;
    /** Set our own profile picture (square JPEG), or a group's when `jid` is given. */
    updateProfilePicture: (jpeg: Uint8Array, jid?: string) => Promise<void>;
    removeProfilePicture: (jid?: string) => Promise<void>;
    /** Remember the account's display name (used for presence). */
    setName(name: string): void;
    /** Get presence updates for a contact. */
    subscribePresence(jid: string): Promise<void>;
    /**
     * Log this device out of the account: tell WhatsApp to unlink it, then close. The phone shows the device gone from
     * "Linked devices". `deleteAuth` also erases the saved login (credentials, Signal keys, app-state) from `authDir`;
     * without it the files stay, but they no longer work.
     */
    logout(o?: {
        deleteAuth?: boolean;
    }): Promise<void>;
    /** Close the connection and stop reconnecting. */
    close(reason?: string): void;
}

interface DecodedJid {
    user: string;
    server: string;
    device: number;
    domainType: number;
}
/** `user[:device]@server` -> parts. Group ("g.us") and other non-user servers decode as well. */
declare function jidDecode(jid: string): DecodedJid;
declare const jidEncode: (user: string | number | null, server: string, device?: number) => string;
/** The JID without its device part (`4915...:12@s.whatsapp.net` becomes `4915...@s.whatsapp.net`). */
declare function jidNormalizedUser(jid: string | undefined): string;
declare const areJidsSameUser: (a: string | undefined, b: string | undefined) => boolean;
declare const isJidGroup: (jid: string | undefined) => boolean;
declare const isJidUser: (jid: string | undefined) => boolean;
declare const isLidUser: (jid: string | undefined) => boolean;
declare const isJidBroadcast: (jid: string | undefined) => boolean;
declare const isJidStatusBroadcast: (jid: string | undefined) => boolean;
declare const isJidNewsletter: (jid: string | undefined) => boolean;

/** What kind of message `message` is: `conversation`, `imageMessage`, `extendedTextMessage`, ... */
declare function getContentType(content: Record<string, unknown> | undefined | null): string | undefined;
/** Look through the wrappers (ephemeral, view-once, edited, document with caption) to the real content. */
declare function normalizeMessageContent(content: Record<string, unknown> | undefined | null): Record<string, unknown> | undefined;
/** The text of a message, whatever kind carries it. */
declare function messageText(content: Record<string, unknown> | undefined | null): string | undefined;

/** The message a received message answers to. */
interface QuotedMessage {
    id: string;
    chat: string;
    sender: string;
    fromMe: boolean;
    /** `conversation`, `imageMessage`, ... */
    type: string | undefined;
    text: string;
    mimetype?: string;
    /** The WAProto content of the quoted message. */
    message: Record<string, unknown>;
    /** Use as `reply` target or to `client.react` / `client.revoke` it. */
    key: MessageKey;
    download(): Promise<Buffer>;
}
/**
 * A received message, ready to use: who wrote it, where, what it says, what it answers to, and the usual
 * answers (`reply`, `react`, `delete`, `download`) bound to the chat it came from.
 */
interface Message {
    /** The event as `client.on('message')` delivers it. */
    raw: DecodedMessage;
    id: string;
    /** The chat: a user, a group (`@g.us`) or a channel. */
    chat: string;
    /** Who wrote it (inside a group: the member). */
    sender: string;
    pushName: string;
    fromMe: boolean;
    isGroup: boolean;
    /** Seconds since 1970, when WhatsApp gave one. */
    timestamp: number | undefined;
    /** `conversation`, `extendedTextMessage`, `imageMessage`, `pollCreationMessage`, ... */
    type: string | undefined;
    /** The content with wrappers (disappearing, view once, edited) taken off. */
    content: Record<string, unknown> | undefined;
    /** Text, caption, or the id of a tapped button / chosen list row. Empty when there is none. */
    text: string;
    mimetype: string | undefined;
    /** Image, video, audio, document or sticker (something `download()` can fetch). */
    isMedia: boolean;
    mentionedJids: string[];
    quoted: QuotedMessage | undefined;
    /** `{ key, message }`: what `send(..., { quoted })` wants. */
    key: MessageKey;
    asQuoted: Quoted;
    reply(content: string | MessageContent, options?: SendContentOptions): Promise<string>;
    react(emoji: string): Promise<string>;
    /** Delete for everyone (own messages, or any in a group where we are admin). */
    delete(): Promise<string>;
    markRead(): Promise<void>;
    download(): Promise<Buffer>;
    forward(to: string): Promise<string>;
}
/** Is this JID one of ours (phone number or LID, any device)? */
declare function isMe(client: Pick<Client, 'me'>, jid: string | undefined): boolean;
/**
 * Turn a received message into a `Message`.
 *
 * A message we typed on the phone to someone else arrives wrapped in `deviceSentMessage`: the stanza's `from` is our own
 * account and the real chat is `destinationJid`. It is unwrapped (exactly once) so `chat`, `text` and `reply()` work as
 * expected, but only when the stanza really comes from one of our own devices: `from` / `participant` are set by the
 * server, while the wrapper is part of the payload and anyone can put it into a message they send us.
 */
declare function serialize(client: Client, raw: DecodedMessage): Message;

/** A group, with the people who may do things in it. */
interface GroupInfo {
    id: string;
    subject: string;
    size: number;
    /** Admins and the creator, in every form the group lists them (phone number and LID). */
    admins: string[];
    participants: {
        id: string;
        phoneNumber?: string;
        lid?: string;
        admin: 'admin' | 'superadmin' | null;
    }[];
    /** Only admins may write. */
    announce: boolean;
}
/** Group info with a short memory, so a busy group costs one query a minute, not one per command. */
declare class GroupCache {
    #private;
    private readonly client;
    constructor(client: Client);
    get(id: string): Promise<GroupInfo>;
    /** Forget a group (its members changed). */
    forget(id: string): void;
}
/** Is `jid` one of the group's admins? (Phone-number and LID forms both count.) */
declare const isGroupAdmin: (group: GroupInfo | undefined, jid: string | undefined) => boolean;

interface MediaRetryResult {
    /** `SUCCESS`, `NOT_FOUND`, `DECRYPTION_ERROR` or `GENERAL_ERROR`. */
    result: string;
    directPath?: string;
}

/**
 * A small in-memory store for bots that want to look things up: the latest messages of each chat, push names,
 * and which chats exist. It listens to a client's events; nothing is written to disk.
 *
 *   const store = new MemoryStore().bind(client)
 *   store.messages(chatJid, 20)
 */
declare class MemoryStore {
    #private;
    /** Limits: messages kept per chat, chats kept (least recently active are dropped), names kept. */
    constructor(o?: {
        perChat?: number;
        maxChats?: number;
        maxNames?: number;
    });
    /** Start listening to `client`. Returns the store, so it chains. */
    bind(client: Client): this;
    /** Stop listening. */
    unbind(): void;
    add(m: DecodedMessage): void;
    /** One message of a chat, by id. */
    message(chat: string, id: string): DecodedMessage | undefined;
    /** The last `limit` messages of a chat, oldest first. */
    messages(chat: string, limit?: number): DecodedMessage[];
    /** The name a person or chat showed up with. */
    name(jid: string): string | undefined;
    /** Chats we have seen a message of, most recent first. */
    chats(): {
        jid: string;
        lastSeen: number;
    }[];
}

export { ANTIBAN_DEFAULTS, type AbProps, AntiBan, type AntiBanConfig, AntiBanError, AppStateCollection, type AppStateKeyLookup, type AppStateMac, type AppStateMutation, type AppStateResult, type AuthStore, type BinaryNode, type BotDirectory, type BotEntry, type BotSection, type BroadcastQuota, type ButtonReply, type ButtonsOptions, type CallFileOptions, Client, type ClientEvents, type ClientOptions, type ConnectionUpdate, type DecryptedMessage, type EncryptedMessage, type EventOptions, type EventResponseType, FrameDecoder, GroupCache, type GroupInfo, type InteractiveOptions, type LinkPreview, type LinkPreviewOptions, type ListOptions, type ListSection, type Listener, type LocalAudioOptions, type MediaFileOptions, type MediaRetryResult, type MediaSource, MemoryAuthStore, MemorySignalStorage, MemoryStore, type Message, type MessageContent, type MessageKey, type NativeButton, NoiseTransport, NoiseXxHandshake, type PaymentRequestInput, type PreKeyBundleInput, type ProductInput, ProtocolLogger, type ProtocolLoggerOptions, type Quoted, type QuotedMessage, REPORT_FLOWS, type ReportOptions, ReportStore, type ReportedMessage, type RetentionOptions, type RichResponseOptions, Room, type RoomAdmit, type RoomEvents, type RoomOptions, type RoomPerson, type SendContentOptions, type SessionInfo, SignalCipher, type SignalStorage, type StickerInput, type TemplateOptions, type TextOptions, TypedEmitter, type Unsubscribe, type VideoFileOptions, WAM_EVENTS, WAM_GLOBALS, type WamEvent, type WamValue, areJidsSameUser, buildReport, callButton, compressSession, connHeader, copyButton, createSignalCipher, decodeAudioFile, decodeNode, decodeVideoFile, encodeFrame, encodeNode, encodeWam, fetchLinkPreview, findUrl, getContentType, isGroupAdmin, isJidBroadcast, isJidGroup, isJidNewsletter, isJidStatusBroadcast, isJidUser, isLidUser, isMe, jidDecode, jidEncode, jidNormalizedUser, linkPreviewMessage, listSessions, messageText, migrateFlatSessions, newAppStateCollection, newIdentityKeyPair, newPreKeys, newSignedPreKey, normalizeMessageContent, parseButtonReply, pollOptionHash, pruneSessions, quickReply, restoreAppStateCollection, richResponse, serialize, singleSelect, splitAnnexB, startXxHandshake, tokenizeCode, urlButton, vcardFor, writeWav };
