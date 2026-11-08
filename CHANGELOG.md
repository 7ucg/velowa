# Changelog

## Unreleased
- Added: `deviceOf(id)` - guesses which client (`ios`/`web`/`android`/`desktop`/`api`) sent a message from
  its id's own shape (length and prefix) alone, matching whatsmeow/Baileys' own heuristic.
  `generateMessageId`'s own output (confirmed against whatsmeow's Go and an older Baileys' JS
  implementation - identical algorithm already) reads back as `web`.
- Added: `getFakeMsg(jid, msg)` - a test tool for the `fake-chat` defense, not an attack on anyone: builds a
  message that spoofs the `deviceSentMessage` envelope `onOwnDeviceSent`'s own-account check exists to
  reject. Send the result (`client.sendMessage(targetJid, fake.message, fake.opts)`) from an account that
  is *not* the target's own, against a target whose velowa instance you control, to verify over a real
  connection that the spoof is ignored rather than silently trusted - its id never joins the target's own
  `SentMessageIds`, so a later receipt for the same id still gets flagged by `detectFakeChat` too.
- Fixed: the `fake-chat` store (`SentMessageIds`) only ever recorded ids this device itself sent through
  `Sender` - a message the primary phone (or another linked device) sent directly would never show up in
  it, so a real receipt for it would be misread as a forged one. An incoming message that decrypts to a
  `deviceSentMessage` envelope - our own account fanning a send of its own out to its other devices, exactly
  like `Sender`'s own `dsm` does when this device sends - now feeds the same store via a new
  `Receiver.onOwnDeviceSent` hook. Gated on the envelope's sender actually being our own account: a peer has
  no legitimate reason to send one, so the content shape alone is never trusted.
- Added: `fake-chat` event - a delivery/read/played receipt naming a message id we never sent is a known
  scam technique (a fabricated tick staged, often alongside forged history, to make a conversation look
  more credible than it is). Sent message ids are now kept in a small persisted store (`SentMessageIds`,
  `features/contact/fake-chat.ts`) specifically so a receipt for an id sent in an earlier run isn't
  mistaken for a forged one right after every reconnect, when an in-memory-only cache would still be cold.
  Group receipts (no single sender to blame) and our own account's are never flagged.
- Fixed (security): a `contacts` `modify` notification's LID/PN mapping was applied unconditionally,
  letting the least-authoritative source of a mapping overwrite one already trusted from a more reliable
  one (e.g. a live usync lookup). Mirrors wacore's own learning policy for this exact notification source:
  a claim is applied only when it doesn't conflict with what is already cached, never as a blind overwrite.
- Added: six events for server notifications that previously only reached the generic `notification`
  passthrough (parseable, but unparsed) - `identity.changed` (a contact's security code changed; the
  session-clearing logic already existed, it just never told the app), `contact.picture`, `contact.about`,
  `contact.disappearing-mode`, `contact.change` (profile update / phone-number change, now also feeding the
  LID/PN mapping when both forms are known / full-resync request), and `newsletter.live-update` (live
  forwards/reactions/poll-vote counters for recent channel posts).
- Added: `keepInChat` (exempt a disappearing message from auto-delete), `pollResultSnapshot` (final tallies
  once a poll closes, V3 variant included), `stickerSyncRemove` and `conditionalReveal` (the wire envelope
  behind "schedule a message" - `encPayload`/`encIv` decrypt with a one-time reveal key delivered
  separately, not implemented here, same wire-shape-only scope as the payment messages). Rounds out the
  proto audit; the rest (business-template `highlyStructuredMessage`, superseded by `templateMessage`;
  `vpcRequestMessage`, an unclear Meta-AI-platform handshake; duplicate-shape fields like
  `instantImageMessage`/`fastRatchetKeySenderKeyDistributionMessage`; and `pollCreationMessageV4`/`V6`,
  version markers for the same structure `poll()` already builds) is intentionally left alone.
- Fixed (security): the previous fix for the spoofable `secretEncryptedMessage` edit (binding the editor to
  itself) was still incomplete - it let anyone who merely knows a message's secret (every recipient does, by
  design) self-attribute a forged edit of a message that was never theirs, since both HKDF roles equalled
  `who` regardless of whose message it actually was. `MessageSecrets` now records who actually sent each id's
  message (and in which chat) when its secret is first seen; a MESSAGE_EDIT/EVENT_EDIT/POLL_EDIT is rejected
  outright unless that record exists, names the same chat, and names the same person (via LID/PN) as the
  envelope's own sender. `POLL_ADD_OPTION` is tightened too: an unknown poll is now rejected instead of
  falling back to a wire-claimed creator, since there would be nothing left to authorize against.
- Added: `statusLinkPreviewMetadata`, `statusQuotedMessage`, `statusStickerInteraction`,
  `statusNotification` (status/story interaction) and `messageHistoryNotice` (a text-only group-history
  notice - `MessageHistoryBundle`, the variant carrying an actual media attachment, needs the upload
  pipeline and is not covered).
- Fixed (security): `#secretEncrypted` derived a MESSAGE_EDIT/EVENT_EDIT/POLL_EDIT envelope's "original
  sender" from `targetMessageKey.participant`/`fromMe` - attacker-controlled metadata on the *incoming*
  stanza, written in whichever frame the sender chose. A message, event or poll can only be edited by its
  own author; since every chat recipient already knows a message's secret (by design, for reactions and
  comments), this let any of them forge an edit of someone else's message by simply claiming, via that
  field, that the receiver (or anyone else) was the original author. Now the "original sender" for those
  three kinds is never looked up from the wire at all: it's always the envelope's own (Signal-authenticated)
  sender, same as the editor, since the two can never legitimately differ. `POLL_ADD_OPTION` is unaffected -
  any participant may add a poll option, not just its creator, and its "original sender" already came from
  the locally-remembered poll, not the wire.
- Fixed: `pollAddOption()` built `{ pollOption: [...] }`, the shape of a *different*, same-named
  `PollAddOptionMessage` nested elsewhere in the proto (inside `ConsumerApplication`) that protobufjs never
  actually resolves for `Message.pollAddOptionMessage` - the real field is `{ pollCreationMessageKey,
  addOption }`, singular, one option per message. protobufjs drops an unresolved field silently instead of
  throwing, so this shipped without any error; caught by strengthening the new builders' test helper to
  round-trip through encode+decode and check nothing vanished, not just that encoding didn't throw.
- Added: builders (`extras.ts`) for a batch of previously-unused `Message` fields - `product`, `invoice`,
  `requestPhoneNumber`, `requestLocation`/`requestLocationUpdate`, `musicMessage` (a standalone music card,
  distinct from `musicParts`' video-embedded one), `eventInvite`, `scheduledCallCreate`/`scheduledCallCancel`,
  `pollAddOption` (the plain, non-secret-encrypted form), `questionResponse`, `statusQuestionAnswer`,
  `newsletterAdminInvite`/`newsletterFollowerInvite`, `bCall`, `callLogMessage`, and the payment envelopes
  (`sendPaymentMessage`, `requestPaymentMessage`, `paymentReminderMessage`, `splitPaymentMessage`/
  `splitPaymentUpdateMessage`, `paymentInviteMessage`, `decline`/`cancelPaymentRequestMessage` - wire shape
  only; WhatsApp Pay itself is region-gated and needs a business partnership with Meta). Also added
  `futureProofMessage(field, message)`, a single generic builder for the ~15 `Message` fields that are all
  just a forward-compatible `{ message }` wrapper on the wire (spoilers, status "add yours", bot-platform
  messages, ...) - one helper instead of a dozen near-identical ones.
- Added: `secretEncryptedMessage` (`EVENT_EDIT`/`MESSAGE_EDIT`/`POLL_EDIT`/`POLL_ADD_OPTION`) - the newer
  generic secret-encrypted envelope for editing a message, an event or a poll, or adding a poll option, built
  and decrypted with `secretEncryptedMessage()`/`decryptSecretEncrypted()` (`comment.ts`), the same add-on
  mechanism as comments/reactions (empty AAD, HKDF over the parent's own `messageSecret`, LID/PN fallback
  included). Wired into the receiver as `message.secretEdit`. `MESSAGE_SCHEDULE` is a distinct mechanism
  (`ConditionalRevealMessage`'s own reveal key) and is intentionally not covered.
- Added: `HistoryChunk.globalSettings`/`callLogRecords` and `HistoryMessage.userReceipts`/`scheduledMessage` -
  four fields the already-decoded `HistorySync` blob carries but `parseHistory` silently dropped: account-wide
  settings (wallpaper, auto-download, notification previews), call history, per-recipient delivered/read/played
  receipts, and "schedule a message" metadata.
- Added: `cstoken` ("client-side"/NCT token), a privacy-token fallback for the very first message to a
  contact we hold no `tctoken` for yet - an HMAC-SHA256 over a salt the phone hands us through history sync
  (`HistorySync.nctSalt`, now parsed and persisted to creds) and the recipient's account LID. Only attached
  when both inputs are known and no `tctoken` exists; a `tctoken` always wins when we have one.
- Fixed: a poll vote, comment, encrypted reaction or event RSVP is decrypted with a key the HKDF derives from
  the exact JID strings of its two parties (the parent post's author and whoever's answering) - as contacts
  migrate to LID, either side alone can arrive addressed differently than the other's record of them, and
  decryption failed outright instead of trying the alternate form. Now retries, mirroring WA Web's own
  `decryptAddOn` resilience: the as-received pair first, then each distinct combination with one or both
  sides swapped to their known LID/PN alternate (`LidMap.swap`), before giving up.
- Fixed: a dropped connection always retried after a flat 1 second, so a server that is actually down got
  hammered with reconnect attempts instead of backing off. Now follows WA Web's own schedule: a Fibonacci
  delay in milliseconds (1s, 1s, 2s, 3s, 5s, ... capped at 15 minutes) with +-10% jitter, and a connection
  that stays up for 30s resets the count back to the start.
- Fixed: `classifyServerFailure` treated an unrecognised (or missing) `<failure reason="...">` as non-terminal,
  the same as a transient server error - so the reconnect loop would spin forever against a refusal the server
  will keep repeating (a temp ban, an outdated-client rejection, ...). WA Web's own `ConnectFailureReason` allow-
  lists only `500`/`503` as worth retrying; everything else now stops reconnecting, surfaced as a new generic
  `rejected` failure when it isn't already `logged-out`/`forbidden`. `<stream:error>`'s own code space (which
  has legitimately non-terminal codes like `515` "restart required") is unchanged.
- Fixed: group sends never carried a `phash` (the participant-hash the server uses to tell a sender its
  device list went stale), and the one helper that computed something hash-shaped (`participantHash`) hashed
  the raw JIDs instead of WA Web's own `user.0:device@server` form (the `.0` agent slot is always literal)
  and truncated the wrong way - dead code nobody called. Now computed over every recipient device plus our
  own sending device and attached to every group message (not a status post, which never carries one).
- Fixed (security): `getDevices()` trusted a non-primary device's bare `key-index` attribute at face value.
  The server also sends a signed `<key-index-list>` (`ADVSignedKeyIndexList`) naming which indexes the account
  actually considers valid; once `assertSessions` has verified a user's primary device at least once this
  session (the same trust anchor the ADV identity check already establishes), that list is now verified and a
  device whose `key-index` it doesn't accept - e.g. a relay replaying a revoked device's stale record - is
  filtered out instead of trusted on the server's word alone. No anchor yet (never-verified account) means no
  list to check against - unverified, not rejected, same as the ADV check's own first-contact behavior.
- Fixed: a structural history-sync event (group created/renamed/participant changed, ... from before this
  device's last sync) arrives as a stub (`messageStubType`/`messageStubParameters`) instead of a real message,
  and `parseHistory` silently dropped both fields - the event vanished entirely, not just undecoded.
  `HistoryMessage` now carries `stubType`/`stubParameters`; `decodeGroupStubParticipant` reads one
  `GROUP_PARTICIPANT_*` parameter (Baileys' JSON-participant convention).
- Fixed: `updateProfileName` synced the new name via app state and remembered it locally, but never sent WA
  Web's own immediate `<presence name="...">` (`WAWebPushNameBridge`'s first step) - the rename could take a
  while to show up anywhere, or not at all if the app-state sync itself failed.
- Added: `stickerMetadata` on `sendSticker` - embeds pack attribution (name, publisher, emojis, app-store links)
  as WhatsApp's own WebP EXIF convention, so the real app shows "Added by X"; `addStickerMetadata`/
  `getStickerMetadata` are exported standalone too. Upgrades a simple WebP to the extended format EXIF needs;
  verified against real `ffmpeg`-encoded lossy, lossless and animated stickers (decoded pixels came back
  byte-identical; the animated case's chunk structure, which this ffmpeg build can't itself decode either way,
  was checked byte-for-byte instead).
- Added: periodically ask the server for its own record of our uploaded prekey bundle
  (`WAWebHandleDigestKey`'s `<iq xmlns="encrypt"><digest/></iq>`) at login; a 404 (no record at all) re-uploads
  it, closing a gap `ensurePreKeys`'s own low-count check doesn't catch on its own.
- Added: `client.fetchBotProfile(jid, personaId)` - one AI bot's name/description/category, suggested prompts
  and slash commands, from `BotEntry.personaId` in `listBots`'s directory.
- Added: `client.inviteParticipant(callId, jid)` / `client.ringParticipant(callId, jid)` - add someone to an
  already-running group call, or re-ring a disconnected roster member, carrying the current roster with the
  offer so they're admitted straight into the live call. Needed a new WASM binding (`buildGroupInviteOffer`,
  wrapping whatsapp-rust's own `build_group_invite_offer`) alongside the existing `buildGroupOffer`.
- Added: `client.securityCode(peerJid, version?)` - the 60-digit numeric security code WhatsApp Web shows for
  comparing two accounts' complete identity-key sets out of band (the idea behind Signal's safety number),
  verified against WhatsApp Web's own official test vectors. Independent of the server, unlike the ADV
  verification `assertSessions` already does.
- Fixed: `subscribePresence`'d contacts went silent (no more `presence`/`chatstate` events, no error) after any
  reconnect - the server forgets presence subscriptions across one. Every subscription is now re-sent once the
  connection is back up; `unsubscribePresence(jid)` stops it (and is itself remembered, so an unsubscribe right
  before a drop stays unsubscribed after the reconnect).
- Added: `client.getOrder(jid, orderId, token)` - a placed order's line items, prices and totals, read from the
  `OrderMessage` a customer's "Review and pay" tap sends (`.sellerJid`/`.orderId`/`.token`). Was previously
  unreadable: velowa already had full catalog/collection read+write but nothing for an order once placed.
- Fixed: a `<receipt type="delivery">` carrying `<error reason="lid" type="feature-incapable"/>` (the LID peer
  never actually received the message) was reported as an ordinary delivery. `parseReceipt` now downgrades it
  to `type: 'sent'`, matching WA Web.
- Added (safety): a per-chat token bucket (burst 20, refill 10/min) on resends done for `<receipt type="retry">`,
  on top of the existing per-message/per-device cap. WhatsApp's anti-abuse penalizes the *aggregate* resend
  rate to one chat, not any single device's depth: during a mass PN<->LID migration, hundreds of devices can
  retry the same messages at once, climbing straight into an account lock while the per-device cap alone never
  engages. A throttled resend is dropped, not queued (the requester gets a fresh sender key on the next
  ordinary send anyway). Cross-referenced from `whatsapp-rust`'s `resend_rate_limiter.rs`.
- Added: react to `<notification type="encrypt"><identity/></notification>` (a contact's primary device got a
  new identity key, e.g. WhatsApp reinstalled) by dropping our stored session for it, so the next send rebuilds
  it via a fresh, ADV-verified prekey fetch instead of silently encrypting to - or failing to decrypt from -
  the old identity. Ignored for a companion device and for our own account. `SignalStorage` gained
  `removeSession` for this (`RemovableSignalStorage`, implemented by both bundled storages).
- Added: `GroupNotification` now decodes the fields `parseGroupNotification` used to drop - `subject`'s
  `subjectOwner`/`subjectOwnerPn`/`subjectOwnerUsername`/`subjectTime`, `locked`'s `threshold`, `ephemeral`'s
  `expiration`/`trigger` (and the `not_ephemeral` alias, collapsed the same way WA Web does), `growth_locked`'s
  `expiration`/`lockType`, and `request_method`/`parentGroupJid` on `membership_approval_request` /
  `created_membership_requests`.
- Fixed: `listBots`'s flattened `bots` list could repeat a bot that appears in more than one section (the real
  server does this, e.g. "Featured" and its own category) - now deduped by jid, first occurrence wins.
- Fixed (security): a prekey fetch (`assertSessions`) never checked a device's `ADVSignedDeviceIdentity`
  against the account that is supposed to own it, so a malicious/compromised relay could swap in its own
  identity key on a brand-new session (libsignal's own trust-on-first-use protects every session after
  that, but not the very first one) and the client would encrypt to it silently. `validateAdvDeviceIdentity`
  (`src/client/adv.ts`) now verifies both halves of the chain (WA Web `validateADVwithIdentityKey`): the
  account signs the device's identity key, and the device signs back; a primary device (id 0) whose own
  blob verifies becomes the trust anchor for that same user's companion devices fetched in the same batch
  (the server omits their account key, expecting the client to already hold it). A device that fails
  verification is skipped - sending to it then fails instead of silently trusting a swapped identity. Found
  by cross-referencing `whatsapp-rust`'s `usync.rs`, which pinned the same class of fix.
- Added: `client.additionalMediaHosts` - extra hostnames `downloadMedia` may also fetch from (a self-hosted
  relay mirroring WhatsApp's media CDN, say), tried after the official host, with the same HTTPS-only,
  no-credentials, no-custom-port checks.
- Added: apply `lidMigrationMappingSyncMessage` (sent by the account's own primary to its companions) to the
  phone-number <-> LID map - the authoritative counterpart to `noteLidFromAttrs`'s opportunistic learning,
  below. Rejected from anyone but our own account, to not let a peer poison the mapping.
- Added: choose the device identity. `config.platformType` (all 31 `DeviceProps.PlatformType` names), `config.releaseChannel` (`RELEASE` / `BETA` / `ALPHA` / `DEBUG`), `config.platform` and `config.webSubPlatform`; `deviceProfile(name)` with 21 presets (`DEVICE_PROFILES`, e.g. `safari-mac`, `ios-phone`), Baileys-style `Browsers.*`. Names are checked in the constructor. The device type is read when pairing; the release channel goes out on every connect. Only the default is checked on a live account. `config.historySync: 'all'` turns on every boolean of `HistorySyncConfig` (`HISTORY_SYNC_FLAGS`, 20 flags); an object sets single flags on top of the defaults.
- Added: `message.unavailable` for messages with no content for this device (view-once photos and videos stay on the phone); `setMuteState` and `muteState` on `call` events.
- Fixed: a 1:1 message could fail with "no devices found for ...@lid" (reported: typing a bot command in the bot
  number's own PN chat). `receiver.ts` never recorded the PN/LID cross-reference WhatsApp attaches to almost
  every stanza (`participant_pn`/`sender_pn`/`peer_recipient_pn` on a LID-addressed one,
  `participant_lid`/`sender_lid`/`peer_recipient_lid` on a legacy PN-addressed one), so a contact never seen
  through a group or a PN `usync` lookup had no alternate address form to fall back to once a LID `usync` query
  came back empty. `noteLidFromAttrs()` now learns the pairing from every incoming stanza, and `getDevices()`
  retries device discovery under the other form (never changing the envelope's `to`) before giving up; it also
  now logs a per-user `<error>` node from `usync` instead of silently treating it as "no devices".
- New: volume of a call's outgoing audio. `client.setCallVolume(callId, gain)` (0 silent, 1 unchanged, 2 twice as loud, peaks are clipped) and `client.callVolume(callId)`; it works at once, also for audio that is already queued, and applies to files, the microphone and everything else the call sends. `MediaSession` gets `setVolume()` / `volume`, and `applyGain()` is the sample scaling.
- New: pause a call's media. `client.pauseMedia(callId)` holds the queued audio (the call carries silence) and freezes the picture, `client.resumeMedia(callId)` goes on exactly where it stopped, `client.isMediaPaused(callId)` asks. `MediaSession` gets `pause()`, `resume()` and `paused`.
- Fixed (serious): a call-link guest (`new Client({ guest })`) created without its own `authDir` wrote its `creds.json` into the default `auth/` folder, overwriting the credentials of a paired account kept there and unlinking it (the next login was answered with `<failure reason="401"/>`). A guest now gets a private temporary auth folder (removed on `close()`) unless `authDir` is given. If you ran a guest next to an account in the same working directory before this fix, link the account again.
- Fixed: a login the server refuses (`<failure reason="401"/>` right after the handshake, or `<stream:error>` with `code="401"` / `conflict type="device_removed"`) made the client reconnect in an endless loop with `loggedOut` never set; `loggedOut` was only ever true after your own `logout()`. The client now recognises it (`classifyServerFailure`): it stops, does not reconnect, and reports `connection` / `close` with `reason: 'logged-out'` and `loggedOut: true` (`'forbidden'` for 403, `'replaced'` when another session of the device took over). Connect again after linking anew.
- New: control the audio of a running call. `client.playInCall(callId, fileOrPcm, { replace?, maxSeconds? })` plays a file (or 16 kHz mono PCM) into a call, queued after what is playing or, with `replace`, instead of it ("change the music"); `client.stopAudio(callId)` silences it; `client.queuedAudioSeconds(callId)` says how much is still queued. `MediaSession` gets `queuedSeconds` and `clearAudio()` for this. They work for any call with a media path: your own calls, answered calls, rooms and guests.
- Fixed: after the account was linked again (a new device number), messages to groups showed "Waiting for this message" on every device. The memory of who already has our sender key was kept per group only, so the new key was never distributed. It is now kept per sender key (`group|senderKeyId`); old entries are dropped and the key goes out to all devices at the next send.
- Fixed: the answer to a native-flow message (`sendInteractive` with `quickReply`, `singleSelect`, ...) and to a template button left `Message.text` empty. `messageText()` now returns the id of the tapped button or row for `interactiveResponseMessage` and `templateButtonReplyMessage`, as it already did for `buttonsResponseMessage` and `listResponseMessage`.

## 1.2.0 - 2026-11-03
- `customPairingCode` (needs `pairWithPhoneNumber`): use your own 8-character code instead of a random one.
  Validated and uppercased in the `Client` constructor, so a bad one throws right away rather than failing deep
  inside the connection; `--code=` on `velowa-pair` too (or the `VELOWA_PAIRING_CODE` env var, which does not
  show up in this machine's process list the way an argv value does). Confirmed live.
- Fixed pairing-code linking (`pairWithPhoneNumber`), reported as not working: `companion_platform_id` was hardcoded
  to `1` (Chrome) regardless of the configured `browser`, instead of the id that actually matches it (`7` for the
  library's own default, `['Windows', 'Desktop']`) — a mismatch against `companion_platform_display` the phone may
  reject. Also: the `companion_hello` / `companion_finish` iqs were sent fire-and-forget before any `Receiver`
  exists to track them, so a rejection from the server (wrong platform id or anything else) vanished silently —
  the code stayed on screen with nothing ever happening. Both requests now carry a fixed id from the moment they
  are built, and a matching `iq type="error"` closes the connection with reason `pairing-code-rejected` and logs
  the server's detail, instead of being dropped. Confirmed live: pairing-code linking now succeeds end to end.
- Call-link guest mode: `new Client({ guest: { inviteCode, guestName } })` registers a throwaway identity via `v.whatsapp.net/v2/guest_reg` and logs in with `ClientPayload.accountType = GUEST` / `product = WHATSAPP_LID` / `username` set to the lid `guest_reg` returned — no QR, no phone pairing. Once connected, `me`/`me.lid` is that lid and `joinCallLink()` (relay, roster, real media — `audioFile`/`videoFile`/`localAudio`, confirmed live: a guest's `enc_rekey` decrypts and its call key installs into the engine — and `endCall()`) works exactly as for a paired account joining its own room; see the README's "Joining as a guest". Verified live end to end multiple times against a real call link, including a full join → waiting room → admission → connected media → clean leave (the host's roster shows `state="terminated"`, not a drop) cycle.
  - Fidelity with a real browser guest session: the three `pre_pn_client_log` telemetry beacons a real session sends around the join (`guest_calling_join_clicked`/`_success`/`_waiting_room_entered`), a `status.json` fetch as the WS opens, and a browser fingerprint (`os_name`/`os_version`/`browser`/`browser_version` plus the matching `User-Agent`, on both `guest_reg` and the WS connection) picked uniformly at random per guest session from a pool of 300+ (3 OS families × 2 variants each × 60 Chrome versions — `fingerprint.ts`) instead of one fixed string. Deliberately NOT replicated: `bootloader-endpoint`/`ajax/bz`/`webworker_v1/init_script` — these carry Comet/React framework session tokens (`lsd`, `__hsi`, `__csr`, `__dyn`, ...) minted server-side when the real HTML page renders, not reproducible without rendering that page first, and carry no WhatsApp-protocol content (confirmed: the whole flow above works without them).
  - Two things only live testing turned up (neither was visible in the original browser capture this was built from): `guest_reg`'s response body is `{ ent_access_token, ent_canonical_fbid, lid, status: "ok" }` — the guest's own `lid` is assigned right there, not only at call admission as the capture alone suggested; and the login `ClientPayload` needs that `username`, above — without it the WebSocket handshake completes but the server silently drops the connection (code 1006) right after.
  - Also found live: Node's own `fetch` is unreliable against `v.whatsapp.net/v2/guest_reg` specifically (silently stalls ~30s then an empty 408, on roughly half of attempts, for reasons not root-caused) — `guestReg()` now gives it 8s before falling back to `curl` once.
  - `buildLinkJoin` takes an optional `pushName` now (confirmed on the wire for a guest join; a paired device re-joining its own link can still omit it).
- Call links: the `call` event has `waitingRoom` (who waits, `guest` for people without a WhatsApp account, their typed name) and `node` (the raw stanza); `roster` (who is connected or left) and `client.createRoom()`: a call link you own and run, with an admit rule (`all`, `guests`, `none` or your own function), guest-aware `request` / `joined` / `left` events and logging. Verified live with a browser guest: requested, admitted, joined, toggled camera and microphone, raised a hand and left.
- Silent group calls (voice chat invitations): the `call` event carries `lightweight`, `silence` and `callerPn`; `acceptCall` refuses them with a clear error (the server answers an answer with 403 and ends the call). Checked live.
- Fixed: `serialize()` did not understand a message typed on the phone to someone else (`deviceSentMessage`): `text` was empty, `chat` was our own account and `fromMe` false. It now unwraps it (once, and only when the stanza's `from` is one of our own devices and `destinationJid` is a well-formed chat JID): `chat` is the recipient, `text` the typed text, `fromMe` true, and `reply()` answers in the right chat. A `deviceSentMessage` inside a message from anyone else is a claim in the payload and is not trusted.

## 1.1.0 - 2026-11-02
- Install straight from git, without Rust: `dist/` (the build) is committed, so `npm install github:7ucg/velowa#v1.1.0` is enough.
- Automatic recovery (option `autoRecover`, on by default): a message that stays unreadable is asked for again from the phone (`message.undecryptable`, then `message.resent`), and `downloadMedia` with a key asks the phone to upload expired media again; the bot `Message.download()` uses it.
- `client.server` (AB props, reachout timelock, new-chat cap, passive mode), `client.serverTime()` and `MemoryStore` (an optional in-memory store of messages, names and chats).
- Round 2 of the Baileys / whatsapp-rust / vansnowi gap list: `updateMediaMessage` (media re-upload), `fetchMessageHistory`, `requestPlaceholderResend` (+ `message.resent` event), trusted-contact tokens (tctoken) on 1:1 messages, the send option `devices` (`recipient`, `primary`, `no-linked`), rich-response menu widgets (buttons, carousel or row of cards, open-link footer), event cards in chats (`sendEvent`, `respondToEvent`, `eventResponse` on received answers), comments and encrypted reactions on community announcement posts (`sendComment`, `addon`), sticker packs (`sendStickerPack`), `listBots`, `resyncAppState`, business cover photo, signed pre-key rotation (`rotateSignedPreKey`, automatic after 27 days) and the screen-share signal in group calls. Not built: SQL auth storage, adaptive offline resume and the history chunk queue (vansnowi), passkey (SHORTCAKE) linking, interceptor hooks, secret-encrypted edits.

## 1.0.0 - 2026-11-01
First release. Everything below is part of it.
- More of the Baileys functions: `client.account` (trusted devices, linked profiles, remove a device), `client.privacy`, `client.business` (products, collections, broadcast lists and quota), `client.calendar` (events), quick replies, `lockChat`, `setFavorites`, `pinMessage`, `sendAlbum`, `waitForMessage`, `logout`, past members and reports of groups, community pictures and ownership, channel admins, pins, search and directory. Unit-tested; the README section lists per function what was checked live, what the server answers with Bad Request or not at all, and what is untested: "More account, chat, group, channel, event and business functions".
- GitHub: no Dependabot configuration either (it runs as "Dependabot Updates" workflows and opens branches). GitHub Actions: all workflows are removed (there is no CI on GitHub; run `npm run lint`, `npm test`, `npm run check:package`, `npm run check:docs` yourself), and Dependabot no longer watches actions.
- Distribution: git only. velowa is `private` (cannot be published to npm by accident), the release workflow, `publishConfig` and the publish gate are gone, and the README and `CONTRIBUTING.md` describe the way in: clone, `npm run build`, `npm install ../velowa`. A release is a git tag.
- Licence: the velowa License (MIT with mandatory credit): copying any part of velowa's code, however small, requires credit; using it as a library does not. A credit line heads every own source file and every built file, `THIRD_PARTY_NOTICES.md` lists the code that comes from other projects with its original notices (including the AGPL-3.0 libsignal code in `rust/wacore-libsignal`), both licence files ship in the npm package, and `tests/package/license.test.ts` enforces it. README gets a "License and credit" section.
- Build: `license-file` must not point at `LICENSE` (wasm-pack emptied the file); the own crates use `LicenseRef-velowa`.
- Workflows: every action pinned to a commit SHA, the release split into a `build` job (no secrets, no cache) and a `publish` job (the token, only GitHub's own actions, publishes the exact tarball that was built), Dependabot for actions, npm and cargo; `tests/package` enforces it.
- Package rules: `npm install velowa` installs only `dist/` (14 files, 1.5 MB), runs no install script and needs no Rust; the pairing helper's `qrcode-terminal` is optional; `velowa-pair` and `velowa-logs` command line tools; npm metadata and provenance; a `prepublishOnly` gate; `tests/package` enforces all of it; `.gitattributes`, `CONTRIBUTING.md` (git and npm rules, release steps), a CI `package` job and a release workflow.
- Examples for the public: `echo-bot`, `cases-bot`, `plugin-bot/`, `notifier`, `channel-post`, `group-admin`, `calls` and `tour`, configured by environment variables (no ids or numbers in the code), with an index in `examples/README.md`; the old internal live-test scripts and the placeholder `basic-bot` are gone. `npm run check:docs` type-checks the README and the examples against the built package.
- Security: media `{ url }` in `client.send` is http(s) only and can no longer read a local file; local files need the explicit `{ path }`.
- Bots: `client.send(jid, content)` (one call for text, media, polls, buttons, lists, location, contacts, reactions, edits, forwards), a `connection` event (state, QR, pairing code, close reason), `serialize()` for a received message, `GroupCache`/`isGroupAdmin`, JID and content helpers, runnable bot examples (cases and plugins) in `examples/`. README rewritten with an index, a feature guide and checked examples (`npm run check:docs`).
- Log storage: runs are grouped by day with a `session.json` each and `logs/latest` links, big files rotate, runs older than a day are gzipped, old runs are pruned by age and total size (`ProtocolLoggerOptions.retention`), `npm run logs` lists/migrates/compresses/prunes/pins them, and the logger keeps its files open instead of reopening them per entry.
- Release build: `tsup` produces ESM (`dist/index.js`) and CommonJS (`dist/index.cjs`) with matching type files and no source maps; `exports` map with `import`/`require`; `npm run check:package` (publint + attw) is clean.
- In-call actions: `enableCamera`/`disableCamera`/`acceptVideoUpgrade`/`rejectVideoUpgrade` (video upgrade handshake, `video` call events carry `videoState`), `raiseHand`, `sendReaction` (group calls; `user_action` events carry `handRaised`, reactions arrive as media events `Reaction` with `detail`).
- Files as call media: `audioFile` (mp3, ogg, wav, m4a, ...) and `videoFile` (mp4, ... with its sound) on `startCall`, `acceptCall`, `startGroupCall` and `joinCallLink`, decoded with ffmpeg (`decodeAudioFile`, `decodeVideoFile`).
- Local audio: `localAudio: { mic, speaker }` on calls uses the machine microphone and speaker through `parec`/`pacat` (PulseAudio/PipeWire). Group video calls: `videoFrames`/`recordVideoTo` on group calls, and the offer spells the codec `h.264`/`H264` (the other spelling is never rung).
- Call links: `joinCallLink` (with or without a waiting room), `setApprovalRequired`, `answerWaitingRoom`; group calls report the relay latencies to the call service. A joiner must take the first roster update as its snapshot, not the join ack.
- Incoming group calls: `acceptCall` joins an invitation into a group call (preaccept acknowledged, then the bare accept at the call service), reads the roster from the offer, waits for the relay and the shared key; group offers are recognised by `group-jid`/`group_info`.
- Group calls: creator behaviour of WhatsApp Web (heartbeat every 10 s, transport hint, mute state, timed terminate + `group_call_duration`), the group Allocate in the web shape, and a fresh channel and UDP flow when the server moves the call to another relay; a group call now reaches the callee audio.
- Phase 0: TypeScript scaffold, vendored `wacore-{derive,binary,libsignal,noise,appstate}` building for native and wasm32, own `waproto`, CI skeleton.
- Phase 1: WABinary binding (`encodeNode`/`decodeNode`) and TS codec.
- Phase 2: Noise XX handshake, transport cipher and frame codec.
- Phase 3: Signal sessions and sender keys over TS-owned storage; key generation.
- Phase 4: app-state `AppStateCollection` (LTHash, MAC validation, mutation decryption, outgoing `buildPatch`).
- Phase 5: `Client` (QR pairing verified live, login, auto-reconnect), protocol logger, receiver (pre-keys, acks, receipts, 1:1/group decryption, retries, Meta AI `msmsg`), sender (1:1, groups, channels; send verified live to own number).
- Phase 6: media, replies/mentions/reactions/edit/delete, polls, groups, communities, newsletters, contacts/privacy, app-state sync and chat actions, history sync, calls (events + reject).
- Pairing-code linking, status posting, interactive messages, business profile/catalog, usernames, forwarding, retry resends, poll votes, `client.mex()`.
- LID addressing for Signal sessions (fixes the phone not decrypting our own-device copies), serialized cipher calls, app-state key request to the phone, `examples/example.js` live check (31/31).
- Username lookup; `examples/example-others.js` live check against a second account, a group and a channel.
- `examples/example-manage.js`: group management and status posting verified live (16/16).
- Channel posts in the phone's wire format (captured from the app): images/videos upload raw to `/newsletter/...` with `mediatype` on the plaintext node, quizzes as `pollCreationMessageV5` + `polltype=quiz_creation`, image polls/quizzes (`sendImagePoll`), questions as `questionMessage` + `questiontype=question` (text and image), music as a video with MUSIC attribution (`sendMusic`). All acked live.
- Channel image quizzes/polls: option images are posted first (MEDIA_POLL association), then the poll with the same pre-chosen id (`sendImagePoll`); music posts carry `annotations` on the video; confirmed on the phone.
- Music posts: the song has to be mixed into the video's audio track; `sendMusic` only adds the music card. Verified on the phone.
- Channel post labels: `client.newsletters.labelAiContent(jid, serverId)` and `labelPaidPartnership(jid, serverId)` (mex mutations on existing posts, seen in the phone's notifications; accepted live).
- `client.postToChannel(channel, message, {aiContent, paidPartnership})` posts and labels in one call, returns `{id, serverId}`.
- AI-content label is only shown by the app on image/video channel posts (confirmed on the phone); paid partnership shows on all.
- Channel `<status>` stanzas (reactions to channel posts, edits/revokes) are acked and emitted as the `channel.status` event.
- Group status (captured from the phone): `sendGroupStatusText`, and `groupStatus: true` on `sendImage` / `sendVideo` / `sendAudio` / `sendMusic` (groupStatusMessageV2 + `<meta is_group_status>`, text-typed stanza, no enc mediatype).
- Group status voice notes need real Opus audio (OGG) with `ptt: true`; verified on the phone.
- Channel status could not be reproduced: posts with a NEWSLETTER_STATUS attribution show up as normal posts; the real wire format needs a capture from an account that can post one.
- Channel videos (music posts) upload their own thumbnail to `/newsletter/newsletter-thumbnail-image` and reference it with `thumbnailDirectPath` / `thumbnailSha256`.
- Antiban (`new Client({ antiban: true | {...} })`): rate caps per minute/hour/day, random gaps, new-chat pause, identical-text limit, warm-up ramp, optional typing indicator. Link previews (`sendText(to, text, { linkPreview: true })`, `fetchLinkPreview`): Open Graph/Twitter/title parsing, SSRF-guarded fetch (private hosts and redirects refused), thumbnail via `sharp` when installed. Payments: `requestPayment`, `sendPaymentNote`, `declinePaymentRequest`, `cancelPaymentRequest`, `client.payments` (passkey/UPI mex; `isRecoverable` answers Bad Request, id probably stale). WAM stats: `encodeWam` (byte-identical to the reference encoder), `client.sendWam`, schema of 426 events.
- Buttons: `sendButtons` (reply buttons), `sendList`, `sendTemplate`, native-flow `sendInteractive`, replies (`replyToButtons`/`replyToList`/`replyToTemplate`/`replyToNativeFlow`) and `parseButtonReply`. Rich AI answers: `sendRichResponse` (text, code, table, LaTeX, map, images). Reports: `reportUser`, `reportGroup`, `reportChannel` (with/without evidence messages, optional block / delete chat / leave / unfollow, any `spam_flow`), `reportToAdmins`, `setMemberReportsAllowed`; evidence for received messages carries the server's reporting tag, the sender's token and the derived key (accepted live, report ids returned). Fixed the reporting-token key of messages we send (sender and receiver, verified against received tokens) and unblocking by LID.
- Rich responses: `html` section (`sendHtml`, the FOAHtml primitive from the reference), sections now carry the `__typename`s of the unified response, bot attribution as in the reference composer.
- Calls: voice and video, both directions (`startCall`, `acceptCall`, `endCall`, `media.speak`, `splitAnnexB`, recordings), over the vendored sans-IO call stack from oxidezap/whatsapp-rust (wasm engine + DTLS/SCTP relay channel, Opus via opusscript, H.264 pass-through); call links (`createCallLink`, `queryCallLink`). Verified live with a second account. Group calls and joining links are not built yet.
- Group calls (experimental, signalling only): `startGroupCall` builds the call-scoped offer (roster lists only the calling device of our own account), applies the server's ordered roster/relay snapshots, installs the shared key a participant delivers, hangs up at the call service. Group media does not connect yet (relay answers a re-allocation with STUN error 452); joining call links, incoming group calls and the waiting room are not built.
