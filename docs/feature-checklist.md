# Feature checklist (historical snapshot, 2026-11-01)

A build-time tracking doc against `baron-baileys-v2` `src/` (~15.7k lines in `Socket/`), frozen the day it was
written; several rows below (antiban, WAM telemetry, channels, channel status, ...) have since shipped and gone
live. **For what velowa can do today, see the "What exists and works" table in the main [README](../README.md)**.
This file is kept for the mapping from reference JS to area, not as a live status board.

| Area | Reference | Notes |
| --- | --- | --- |
| Connection, Noise, keepalive, login/pairing | Socket/socket.js (1096), Utils/noise-handler, validate-connection | |
| Registration | Socket/registration.js (434) | |
| Receive pipeline, decrypt, retries, receipts | Socket/messages-recv.js (3127), Utils/decode-wa-message, message-retry-manager, offline-node-processor | biggest single file |
| Send pipeline, fanout, media | Socket/messages-send.js (2255), Utils/messages, messages-media, message-composer | |
| Chats, app-state sync, labels, presence | Socket/chats.js (2401), Utils/chat-utils, lt-hash, sync-action-utils | |
| Groups / AI groups | Socket/groups.js (889), aigroups.js (240) | |
| Communities | Socket/communities.js (605) | |
| Newsletters | Socket/newsletter.js (1078) | |
| Business | Socket/business.js (522), Utils/business | |
| Privacy, username | Socket/privacy.js (452), username.js (230) | |
| Interop, managed accounts | Socket/interop.js (566), managed-account.js (214) | |
| Mex / GraphQL | Socket/mex.js, graphql.js (915) | query ids: from the WhatsApp Web build |
| Interactive messages | Socket/interactive-handler.js (579) | |
| History sync | Utils/history.js, group-history.js | |
| Signal, pre-key management, identity change | Signal/, Utils/signal, pre-key-manager, identity-change-handler | |
| Auth state | Utils/auth-utils, use-multi-file-auth-state | |
| Antiban / fingerprint | antiban.js, Utils/browser-utils | shipped since; see README |
| WAM telemetry | WAM/ | shipped since; see README |
| VoIP rekey | Utils/voip-rekey.js | shipped since; see README |

## Status as last recorded here (2026-11-01)

Legend: **done** = implemented with tests; **live** = also exercised against a real account; **open** = not built
*at the time this snapshot was taken*.

| Area | Status |
| --- | --- |
| Connection, Noise, keepalive, QR + pairing-code login | done; QR/login **live**, pairing code verified against a simulated phone only |
| Receive pipeline (1:1, groups, channels, Meta AI, retries, receipts, acks, history, polls) | done; decryption/acks/retries/Meta AI **live** |
| Send pipeline (1:1, groups, status, channels, media, polls, interactive, forward, edit/revoke/react) | done; to the own chat **live**: text, reply, react, edit, delete, poll, location, contact, buttons, image, document; **also live to a second account, a group and a channel** (text, reply, react, edit, delete, image, poll, post; delivery/read receipts came back); text status posting **live** (audience = one account) |
| Chats / app-state sync (read + write), labels, presence | done; sync (key request to the phone, 328 mutations) and pin/archive writes **live** |
| Groups, AI-group bot, communities | done; group metadata, invite code and sending to a group **live**; management **live** too (subject, description, announce/locked, disappearing timer, remove/add/promote/demote, 14 notifications came back as events); communities request-level only |
| Newsletters | done; metadata (role OWNER) and posting **live**; other mex ids may be stale |
| Business profile, catalog, collections | done (read + profile update) |
| Privacy, contacts, blocklist, username | done |
| Mex / GraphQL | generic `client.mex(queryId, variables, path)`; no typed wrappers for the ~hundreds of Baileys query ids |
| Registration (primary device) | open (not needed for a companion client) |
| Interop, managed accounts, payments/passkey, ads | open at the time (use `client.mex` with the ids from Baileys) |
| Link previews, thumbnails, waveforms, audio duration | open at the time (shipped since - see README) |
| Antiban / fingerprinting, WAM telemetry, VoIP rekey | open at the time (**shipped since - see README**) |
